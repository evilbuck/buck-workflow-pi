---
status: active
date: 2026-06-04
subject: 2026-06-04.security-audit-script
topics: [security, audit, secrets, git-history, shell-script, pre-commit]
research: []
spec:
memory: [security-audit-iteration-2026-06-04.md]
iterations: [iterate-security-audit.md]
---

# Plan: Security Audit Script

## Goal

Create a fast, token-free, repeatable shell script that scans a git repository for leaked secrets, personal information, profanity, and public-release blockers. Runs entirely with standard Unix tools — no API keys, no model calls, no external dependencies beyond `git` and common CLI utilities.

## Context used / assumptions

- **User-provided context**: User wants a scripted version of the manual security audit performed in this session. Must be: repeatable, fast, cheap (zero tokens).
- **Session context**: We manually ran 15+ grep-based scans against `buck-workflow-pi` covering secrets, PII, profanity, git history, and binary files. Every check was `git ls-files | xargs grep` or `git log --all -p | grep`. This translates directly to a shell script.
- **Assumptions**:
  - The script runs from inside a git repository (or takes `--repo <path>`)
  - Standard tools available: `git`, `grep`, `find`, `awk`, `sed`, `file`, `wc`
  - Optional enhancement: `gitleaks` if installed (detected at runtime, not required)
  - Output is human-readable terminal output (color-coded) plus optional `--json` for CI pipelines
  - Exit code 0 = clean, 1 = findings detected, 2 = usage error

## Scope

### In scope

1. **`scripts/security-audit.sh`** — single self-contained shell script
   - Secrets scan (API keys, tokens, passwords, private keys, AWS creds, GitHub tokens, JWTs, Slack tokens, Google API keys)
   - PII scan (emails, IP addresses, local paths `/home/`, `/Users/`, usernames)
   - Profanity scan (common offensive words)
   - Git history scan (same secret patterns in all historical diffs)
   - Binary file detection (unexpected binaries in tracked files)
   - High-entropy string detection (potential base64-encoded secrets)
   - Summary report with pass/fail per category
   - Color-coded terminal output
   - `--json` flag for machine-readable output
   - `--strict` flag that fails on PII/profanity too (default: only fail on secrets)
   - `--fix-suggest` flag that prints remediation suggestions for each finding

### Out of scope

- Auto-fixing or auto-removing secrets (too dangerous to automate)
- Scanning untracked files (only `git ls-files` + `git log`)
- Network-based checks (calling haveibeenpwned, etc.)
- Dependency on `gitleaks`, `trufflehog`, or any external secret scanner (optional enhancement only)
- CI pipeline integration beyond exit codes + JSON output (that's a separate step)
- Git history rewriting to remove secrets (separate tool: `git filter-branch` / BFG)
- Adding a pre-commit hook (separate task — the script could be wired into one later)

## Affected files

| File | Action | Description |
|------|--------|-------------|
| `scripts/security-audit.sh` | **Create** | Self-contained security audit script |
| `.gitignore` | **Edit** | Add `security-audit-report.json` to ignore list |

## Implementation steps

### Step 1: Create `scripts/security-audit.sh`

Create the script with these sections:

**1a. Argument parsing**
- `--repo <path>` — target repo (default: `.`)
- `--json` — machine-readable JSON output
- `--strict` — fail on PII/profanity (default: only secrets trigger exit 1)
- `--fix-suggest` — print remediation hints per finding
- `--skip-history` — skip git history scan (faster, less thorough)
- `--skip-profanity` — skip profanity scan
- `--skip-pii` — skip PII scan
- `-h` / `--help` — usage

**1b. Color output helpers**
- `red()`, `green()`, `yellow()`, `bold()`, `dim()` — ANSI escape wrappers
- Auto-disable color when stdout is not a TTY or `--json` is set

**1c. Secret pattern definitions**
Define patterns as arrays of label + regex pairs:

```
SECRETS:
  "API key"          → (api[_-]?key|apikey|api[_-]?secret)["'\s]*[:=]
  "Token"            → (token|bearer|auth[_-]?token)["'\s]*[:=]["'][a-zA-Z0-9_\-]{20,}
  "Password"         → (password|passwd|pwd)["'\s]*[:=]["'][^\s]{8,}
  "Private key"      → BEGIN.*(RSA |EC |DSA )?PRIVATE KEY
  "AWS access key"   → AKIA[0-9A-Z]{16}
  "GitHub token"     → (ghp_|gho_|github_pat_)[a-zA-Z0-9_]{20,}
  "Slack token"      → xox[bpas]-[a-zA-Z0-9\-]+
  "Google API key"   → AIza[a-zA-Z0-9_-]{35}
  "JWT"              → eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}
  "Generic secret"   → (secret|credential)["'\s]*[:=]["'][a-zA-Z0-9_\-]{16,}
  "OpenAI key"       → sk-[a-zA-Z0-9]{20,}
  "Anthropic key"    → sk-ant-[a-zA-Z0-9\-]{20,}

PII:
  "Email"            → [a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}
  "IP address"       → [0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}
  "Local path"       → /home/[a-zA-Z]+/ | /Users/[a-zA-Z]+/
  "Username"         → buckleyrobinson  (parameterized — user passes their own)

PROFANITY (basic set):
  fuck, shit, damn, bitch, bastard, crap, dick, cunt, whore, retard, nigger, fag, dyke

WHITELIST (allowed patterns that suppress findings):
  test@example.com
  127.0.0.1
  0.0.0.0
  localhost
  node_modules
  package-lock.json
```

**1d. Scan functions**

Each scan function:
- Takes the repo path
- Returns findings as line-based output: `SEVERITY|CATEGORY|FILE:LINE|MATCH`
- Appends to a global `FINDINGS` array

Functions:
- `scan_tracked_files()` — run each pattern against `git ls-files`
- `scan_git_history()` — run secret patterns against `git log --all -p`
- `scan_binary_files()` — detect unexpected binaries via `file` command
- `scan_entropy()` — flag files with 40+ char base64 strings (exclude package-lock.json)

**1e. Whitelist filtering**

After scanning, filter out known-safe matches:
- Emails: `test@example.com`, `*.noreply.github.com`, `users.noreply`
- IPs: `127.0.0.1`, `0.0.0.0`
- Paths in `node_modules/`, `package-lock.json`
- Secret false positives: `apiKey` in code that uses `ctx.modelRegistry.getApiKeyAndHeaders()` (runtime retrieval, not hardcoded value)

The whitelist is configurable via `--whitelist-file` pointing to a file of regex patterns, one per line.

**1f. Report generation**

Terminal output:
```
🔒 Security Audit Report — my-repo

SECRETS
  ✅ No secrets found

PII
  ⚠️  3 findings
    YELLOW .context/memory/foo.md:12 /home/buckley/
    YELLOW README.md:26 buckleyrobinson
    YELLOW package.json:2 buckleyrobinson

PROFANITY
  ✅ Clean

GIT HISTORY (secrets only)
  ✅ Clean

BINARY FILES
  ✅ No unexpected binaries

HIGH ENTROPY
  ✅ No suspicious strings (excluding package-lock.json)

──────────────────────────────────────
Summary: 0 secrets, 3 PII, 0 profanity
Exit: PASS (secrets-only mode)
```

JSON output (`--json`):
```json
{
  "repo": "/path/to/repo",
  "timestamp": "2026-06-04T12:00:00Z",
  "findings": [
    {"severity": "warning", "category": "pii", "file": "README.md", "line": 26, "match": "buckleyrobinson", "pattern": "Username"}
  ],
  "summary": {"secrets": 0, "pii": 3, "profanity": 0, "binary": 0, "entropy": 0},
  "exit_code": 0
}
```

**1g. Exit code logic**
- `0` — clean (or only PII/profanity in default mode)
- `1` — secrets found, or PII/profanity in `--strict` mode
- `2` — usage error / not a git repo

### Step 2: Update `.gitignore`

Add `security-audit-report.json` to the ignore list (output artifact if users redirect JSON output).

## Verification

- [ ] Script runs with no arguments from repo root and produces readable output
- [ ] Script detects the test secret `AKIAIOSFODNN7EXAMPLE` if placed in a temp file
- [ ] Script exits 0 on a clean repo, exits 1 on a repo with secrets
- [ ] `--json` produces valid JSON output
- [ ] `--skip-history` skips the slow git log scan
- [ ] `--strict` fails on PII/profanity findings
- [ ] Script works with no external dependencies beyond git + standard Unix tools
- [ ] Color output works in a terminal, disabled in piped/JSON mode
- [ ] No false positives on `package-lock.json` or `node_modules/`
- [ ] Runs in under 10 seconds on the buck-workflow-pi repo (202 tracked files)

## Risks

| Risk | Mitigation |
|------|------------|
| False positives on legitimate code patterns (e.g., `apiKey` variable names) | Whitelist system + severity levels (secrets in code structure vs actual hardcoded values) |
| Git history scan is slow on large repos | `--skip-history` flag; warn about duration; use `git log --all -p --diff-filter=ACMR` to skip renames |
| Profanity list is incomplete or culturally biased | Document that it's a basic check, not comprehensive; user can extend via config |
| Base64 entropy check flags too many files | Exclude `package-lock.json`, `.svg`, font files by default; configurable |
| Shell portability (macOS vs Linux) | Use POSIX sh where possible; document GNU vs BSD differences for `grep -P` |

## Ralph Instructions

This is a non-phased Ralph-ready plan. Treat the whole plan as one unit:
1. Run `/b-build` against this plan.
2. Run `/b-review` against this plan.
3. If review creates an `iterate-*.md` artifact, run `/b-iterate`, then re-run `/b-review`.
4. Run `/b-save` before `ralph_done` so memory, draft commits, and review/iteration artifacts are durable.
5. If interrupted before completion, leave a clear note in memory and resume from the active plan or iterate artifact next iteration.
