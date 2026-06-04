---
status: active
date: 2026-06-04
updated: 2026-06-04
subject: 2026-06-04.security-audit-script
topics: [review, iteration, bugfix]
informs: []
addresses: plan-security-audit-script.md
completed: null
ralph_status: pending
from_review: b-review
---

# Iteration: security-audit-script

## Source
- Reviewed after: `/b-build`
- Plan: `plan-security-audit-script.md`

## Critical Issues

### 1. Missing `-H` flag causes incorrect file:line reporting
- **File**: `scripts/security-audit.sh`
- **Problem**: `grep -nE` does not prefix filenames when only one file is matched. This causes the `file`/`lineno`/`match` parsing to produce wrong values. Terminal output shows `1:export AWS_KEY=...` instead of `config.sh:1:export AWS_KEY=...`. JSON output has `"file": "1"`, `"line": "export AWS_KEY=..."`, `"match": "1:export AWS_KEY=..."`.
- **Proposed fix**: Replace all `grep -nE` calls with `grep -HnE` (add `-H` to always print filename). Affected locations:
  - `scan_tracked_files()` secrets scan
  - `scan_tracked_files()` PII scan
  - `scan_tracked_files()` username scan
  - `scan_tracked_files()` profanity scan
  - `scan_git_history()` grep (already different format, but check consistency)

### 2. JSON `file`/`line` parsing breaks on colon-containing paths
- **File**: `scripts/security-audit.sh` — `print_json_report()` function
- **Problem**: The `loc` field from findings uses `|` as delimiter, but the value stored is `file:lineno`. The JSON report splits on the first `:` to get file vs line: `local file="${loc%%:*}"` and `local line="${loc#*:}"`. This works when the filename has no colons, but paths with colons (or the bug above where loc is `1:export...`) produce nonsense.
- **Proposed fix**: Store file and line as separate fields in the findings array (e.g., `severity|category|file|lineno|match|label`) so no string splitting is needed at report time.

## Warnings

### 1. `--username` scan bypasses `--skip-pii`
- **File**: `scripts/security-audit.sh` — `scan_tracked_files()` function
- **Problem**: The username scan is inside `if ! $SKIP_PII; then` block for the PII patterns, but the username scan block has its own `if [[ -n "$USERNAME" ]]; then` guard with no `--skip-pii` check. If user passes `--skip-pii --username buckleyrobinson`, the username still gets scanned.
- **Suggested approach**: Wrap the username scan in `if ! $SKIP_PII && [[ -n "$USERNAME" ]]; then`.

### 2. `--fix-suggest` output is bare in non-TTY mode
- **File**: `scripts/security-audit.sh` — `suggest_fix()` function
- **Problem**: `suggest_fix` uses `$(dim "...")` to add indentation. In pipe/non-TTY mode, `dim()` returns the raw string without ANSI codes. The `→` prefix is visible but no indentation is applied. The fix suggestions appear flush-left with no visual hierarchy.
- **Suggested approach**: Use a plain string prefix like `  →` instead of `$(dim "→")` so the formatting works in all output modes.

### 3. Password regex has syntax issue
- **File**: `scripts/security-audit.sh` — `SECRET_PATTERNS` array
- **Problem**: The Password pattern regex contains `['\"][^[:space:]]{8,}` which has an unbalanced quote character. The intent is to match `password="something123"` but the regex as written may not work correctly in all grep implementations.
- **Suggested approach**: Simplify to `(password|passwd|pwd)['\"]?[[:space:]]*[:=]['\"]?[[:space:]]*[^\s]{8,}` or test against common patterns.

## Recommended Workflow

Start with `/b-iterate` — it will pick up this file automatically.
Then re-run `/b-review` against the same plan.
