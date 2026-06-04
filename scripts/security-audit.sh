#!/usr/bin/env bash
# security-audit.sh — Scan a git repository for leaked secrets, PII, profanity, and release blockers.
# Runs entirely with standard Unix tools. No API keys, no model calls, no external dependencies beyond git.
#
# Exit codes: 0 = clean, 1 = findings detected, 2 = usage error
#
# Usage: ./security-audit.sh [--repo <path>] [--json] [--strict] [--fix-suggest]
#            [--skip-history] [--skip-profanity] [--skip-pii]
#            [--whitelist-file <file>] [--username <name>] [-h|--help]

set -euo pipefail

# ── Version ──────────────────────────────────────────────────────────────────
VERSION="1.0.0"

# ── Defaults ─────────────────────────────────────────────────────────────────
REPO_PATH="."
JSON_OUTPUT=false
STRICT=false
FIX_SUGGEST=false
SKIP_HISTORY=false
SKIP_PROFANITY=false
SKIP_PII=false
WHITELIST_FILE=""
USERNAME=""
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── Findings storage ─────────────────────────────────────────────────────────
FINDINGS=()
SECRETS_COUNT=0
PII_COUNT=0
PROFANITY_COUNT=0
BINARY_COUNT=0
ENTROPY_COUNT=0

# ── Color helpers ────────────────────────────────────────────────────────────
COLOR_TTY=false
if [[ -t 1 ]]; then
  COLOR_TTY=true
fi

red()    { if $COLOR_TTY && ! $JSON_OUTPUT; then printf '\033[0;31m%s\033[0m' "$*"; else printf '%s' "$*"; fi; }
green()  { if $COLOR_TTY && ! $JSON_OUTPUT; then printf '\033[0;32m%s\033[0m' "$*"; else printf '%s' "$*"; fi; }
yellow() { if $COLOR_TTY && ! $JSON_OUTPUT; then printf '\033[0;33m%s\033[0m' "$*"; else printf '%s' "$*"; fi; }
bold()   { if $COLOR_TTY && ! $JSON_OUTPUT; then printf '\033[1m%s\033[0m' "$*"; else printf '%s' "$*"; fi; }
dim()    { if $COLOR_TTY && ! $JSON_OUTPUT; then printf '\033[2m%s\033[0m' "$*"; else printf '%s' "$*"; fi; }

# ── Usage ────────────────────────────────────────────────────────────────────
usage() {
  cat <<EOF
$(bold "security-audit.sh") v${VERSION} — Git repository security scanner

$(bold "USAGE")
  security-audit.sh [OPTIONS]

$(bold "OPTIONS")
  --repo <path>         Target git repository (default: .)
  --json                Machine-readable JSON output
  --strict              Fail on PII/profanity (default: only secrets)
  --fix-suggest         Print remediation hints per finding
  --skip-history        Skip git history scan (faster)
  --skip-profanity      Skip profanity scan
  --skip-pii            Skip PII scan
  --whitelist-file <f>  File of regex patterns to suppress (one per line)
  --username <name>     Username to scan for in PII check
  -h, --help            Show this help
  --version             Show version

$(bold "EXIT CODES")
  0  Clean (or only PII/profanity in default mode)
  1  Secrets found (or PII/profanity in --strict mode)
  2  Usage error / not a git repo
EOF
}

# ── Argument parsing ─────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo)        REPO_PATH="$2"; shift 2 ;;
    --json)        JSON_OUTPUT=true; shift ;;
    --strict)      STRICT=true; shift ;;
    --fix-suggest) FIX_SUGGEST=true; shift ;;
    --skip-history)    SKIP_HISTORY=true; shift ;;
    --skip-profanity)  SKIP_PROFANITY=true; shift ;;
    --skip-pii)        SKIP_PII=true; shift ;;
    --whitelist-file)  WHITELIST_FILE="$2"; shift 2 ;;
    --username)        USERNAME="$2"; shift 2 ;;
    -h|--help)    usage; exit 0 ;;
    --version)    echo "security-audit.sh v${VERSION}"; exit 0 ;;
    *)            echo "Unknown option: $1" >&2; usage >&2; exit 2 ;;
  esac
done

# Resolve repo path
REPO_PATH="$(cd "$REPO_PATH" 2>/dev/null && pwd)" || {
  echo "Error: Cannot access repo path" >&2
  exit 2
}

# Verify git repo
if ! git -C "$REPO_PATH" rev-parse --git-dir >/dev/null 2>&1; then
  echo "Error: Not a git repository: $REPO_PATH" >&2
  exit 2
fi

# ── Whitelist loading ────────────────────────────────────────────────────────
WHITELIST_PATTERNS=()
load_whitelist() {
  # Built-in whitelist
  WHITELIST_PATTERNS+=(
    "test@example\\.com"
    "noreply\\.github\\.com"
    "users\\.noreply"
    "127\\.0\\.0\\.1"
    "0\\.0\\.0\\.0"
    "localhost"
    "node_modules/"
    "package-lock\\.json"
    "example\\.com"
    "example\\.org"
    "placeholder"
    "your[_-]?(api[_-]?key|token|secret|password)"
    "AKIAIOSFODNN7EXAMPLE"
    "REPLACE[_-]?ME"
    "TODO"
    "FIXME"
  )
  # User-supplied whitelist
  if [[ -n "$WHITELIST_FILE" ]]; then
    if [[ -f "$WHITELIST_FILE" ]]; then
      while IFS= read -r line; do
        [[ -n "$line" ]] && WHITELIST_PATTERNS+=("$line")
      done < "$WHITELIST_FILE"
    else
      echo "Warning: Whitelist file not found: $WHITELIST_FILE" >&2
    fi
  fi
}

is_whitelisted() {
  local match="$1"
  local file="$2"
  for pattern in "${WHITELIST_PATTERNS[@]}"; do
    if echo "$match" | grep -qE "$pattern" 2>/dev/null; then
      return 0
    fi
  done
  # Skip matches inside node_modules or package-lock.json paths
  if echo "$file" | grep -qE '(node_modules/|package-lock\.json)'; then
    return 0
  fi
  return 1
}

load_whitelist

# ── Add finding helper ───────────────────────────────────────────────────────
add_finding() {
  local severity="$1" category="$2" file="$3" line="$4" match="$5" pattern_label="$6"

  # Whitelist check
  if is_whitelisted "$match" "$file"; then
    return
  fi

  FINDINGS+=("${severity}|${category}|${file}:${line}|${match}|${pattern_label}")

  case "$category" in
    secrets)   ((SECRETS_COUNT++)) || true ;;
    pii)       ((PII_COUNT++)) || true ;;
    profanity) ((PROFANITY_COUNT++)) || true ;;
    binary)    ((BINARY_COUNT++)) || true ;;
    entropy)   ((ENTROPY_COUNT++)) || true ;;
  esac
}

# ── Fix suggestions ──────────────────────────────────────────────────────────
suggest_fix() {
  local category="$1" match="$2"
  case "$category" in
    secrets)
      echo "  $(dim "→ Rotate the exposed credential immediately. Use environment variables or a secrets manager.")"
      echo "  $(dim "→ Run: git filter-branch or BFG Repo-Cleaner to purge from history.")"
      ;;
    pii)
      echo "  $(dim "→ Redact or generalize the personal information.")"
      echo "  $(dim "→ Use placeholders or environment-specific config.")"
      ;;
    profanity)
      echo "  $(dim "→ Replace with professional language before public release.")"
      ;;
    binary)
      echo "  $(dim "→ Remove the binary from git tracking or add to .gitignore.")"
      echo "  $(dim "→ Consider Git LFS for large binary assets.")"
      ;;
    entropy)
      echo "  $(dim "→ Verify this is not an encoded secret. If legitimate, add to whitelist.")"
      ;;
  esac
}

# ── Pattern definitions ──────────────────────────────────────────────────────

# Secret patterns: label|regex
SECRET_PATTERNS=(
  "Private key|BEGIN.*(RSA |EC |DSA )?PRIVATE KEY"
  "AWS access key|AKIA[0-9A-Z]{16}"
  "GitHub token|gh[pobrs]_[a-zA-Z0-9_]{20,}"
  "GitHub token|github_pat_[a-zA-Z0-9_]{20,}"
  "Slack token|xox[bpas][-a-zA-Z0-9]+"
  "Google API key|AIza[a-zA-Z0-9_-]{35}"
  "JWT|eyJ[a-zA-Z0-9_-]{10,}[.][a-zA-Z0-9_-]{10,}"
  "OpenAI key|sk-[a-zA-Z0-9]{20,}"
  "Anthropic key|sk-ant-[a-zA-Z0-9-]{20,}"
  "Token|(token|bearer|auth[_-]?token)['\"]?[[:space:]]*[:=]['\"][a-zA-Z0-9_-]{20,}"
  "Password|(password|passwd|pwd)['\"]?[[:space:]]*[:=]['\"]['[:space:]]{0,1}[^[:space:]]{8,}"
  "API key|(api[_-]?key|apikey|api[_-]?secret)['\"]?[[:space:]]*[:=]['\"][a-zA-Z0-9_-]{12,}"
  "Generic secret|(secret|credential)['\"]?[[:space:]]*[:=]['\"][a-zA-Z0-9_-]{16,}"
)

# PII patterns: label|regex
PII_PATTERNS=(
  "Email|[a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}"
  "IP address|[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}"
  "Local path|/home/[a-zA-Z][a-zA-Z0-9._-]*/"
  "Local path|/Users/[a-zA-Z][a-zA-Z0-9._-]*/"
)

# Profanity patterns: label|regex (basic set)
PROFANITY_PATTERNS=(
  "Profanity|\\bfuck\\b"
  "Profanity|\\bshit\\b"
  "Profanity|\\bdamn\\b"
  "Profanity|\\bbitch\\b"
  "Profanity|\\bbastard\\b"
  "Profanity|\\bcrap\\b"
  "Profanity|\\bdick\\b"
  "Profanity|\\bcunt\\b"
  "Profanity|\\bwhore\\b"
  "Profanity|\\bretard\\b"
  "Profanity|\\bnigger\\b"
  "Profanity|\\bfag\\b"
  "Profanity|\\bdyke\\b"
)

# ── Scan: Tracked files ─────────────────────────────────────────────────────
scan_tracked_files() {
  local files
  files=$(git -C "$REPO_PATH" ls-files 2>/dev/null) || return

  [[ -z "$files" ]] && return

  # Secrets scan on tracked files
  for entry in "${SECRET_PATTERNS[@]}"; do
    local label="${entry%%|*}"
    local regex="${entry#*|}"
    while IFS= read -r line; do
      [[ -z "$line" ]] && continue
      local file="${line%%:*}"
      local lineno="${line#*:}"
      lineno="${lineno%%:*}"
      # Extract the actual match
      local match
      match=$(echo "$line" | sed 's/^[^:]*:[0-9]*://') || continue
      add_finding "CRITICAL" "secrets" "$file" "$lineno" "$match" "$label"
    done < <(echo "$files" | xargs grep -nE "$regex" 2>/dev/null || true)
  done

  # PII scan
  if ! $SKIP_PII; then
    for entry in "${PII_PATTERNS[@]}"; do
      local label="${entry%%|*}"
      local regex="${entry#*|}"
      while IFS= read -r line; do
        [[ -z "$line" ]] && continue
        local file="${line%%:*}"
        local lineno="${line#*:}"
        lineno="${lineno%%:*}"
        local match
        match=$(echo "$line" | sed 's/^[^:]*:[0-9]*://') || continue
        add_finding "WARNING" "pii" "$file" "$lineno" "$match" "$label"
      done < <(echo "$files" | xargs grep -nE "$regex" 2>/dev/null || true)
    done

    # Username scan
    if [[ -n "$USERNAME" ]]; then
      while IFS= read -r line; do
        [[ -z "$line" ]] && continue
        local file="${line%%:*}"
        local lineno="${line#*:}"
        lineno="${lineno%%:*}"
        local match
        match=$(echo "$line" | sed 's/^[^:]*:[0-9]*://') || continue
        add_finding "WARNING" "pii" "$file" "$lineno" "$match" "Username"
      done < <(echo "$files" | xargs grep -nE "\\b${USERNAME}\\b" 2>/dev/null || true)
    fi
  fi

  # Profanity scan
  if ! $SKIP_PROFANITY; then
    for entry in "${PROFANITY_PATTERNS[@]}"; do
      local label="${entry%%|*}"
      local regex="${entry#*|}"
      while IFS= read -r line; do
        [[ -z "$line" ]] && continue
        local file="${line%%:*}"
        local lineno="${line#*:}"
        lineno="${lineno%%:*}"
        local match
        match=$(echo "$line" | sed 's/^[^:]*:[0-9]*://') || continue
        add_finding "WARNING" "profanity" "$file" "$lineno" "$match" "$label"
      done < <(echo "$files" | xargs grep -inE "$regex" 2>/dev/null || true)
    done
  fi
}

# ── Scan: Git history (secrets only) ────────────────────────────────────────
scan_git_history() {
  $SKIP_HISTORY && return

  if ! $JSON_OUTPUT; then
    echo "  $(dim "Scanning git history (this may be slow on large repos)...")" >&2
  fi

  for entry in "${SECRET_PATTERNS[@]}"; do
    local label="${entry%%|*}"
    local regex="${entry#*|}"
    while IFS= read -r line; do
      [[ -z "$line" ]] && continue
      # git log --all -p output format: commit sha / diff lines start with +/-
      # We only want lines that start with + (additions) and match the pattern
      local commit
      commit=$(echo "$line" | grep -oE '^[a-f0-9]{8,}' || true)
      local match
      match=$(echo "$line" | sed 's/^[a-f0-9]*:\+//' || true)
      [[ -z "$match" ]] && continue
      add_finding "CRITICAL" "secrets" "git-history:${commit:-unknown}" "0" "$match" "$label"
    done < <(git -C "$REPO_PATH" log --all -p --diff-filter=ACMR 2>/dev/null \
      | grep -nE "^[+]${regex}" 2>/dev/null \
      | grep -v '^[+][+][+]' \
      || true)
  done
}

# ── Scan: Binary files ──────────────────────────────────────────────────────
scan_binary_files() {
  local files
  files=$(git -C "$REPO_PATH" ls-files 2>/dev/null) || return
  [[ -z "$files" ]] && return

  local allowed_binaries=(
    "\.png$"
    "\.jpg$"
    "\.jpeg$"
    "\.gif$"
    "\.webp$"
    "\.ico$"
    "\.woff2?$"
    "\.ttf$"
    "\.eot$"
    "\.otf$"
    "\.mp3$"
    "\.mp4$"
    "\.wav$"
    "\.ogg$"
    "\.pdf$"
    "\.zip$"
    "\.tar\.gz$"
    "\.tgz$"
    "\.gz$"
  )

  while IFS= read -r f; do
    [[ -z "$f" ]] && continue
    local full_path="${REPO_PATH}/${f}"
    [[ ! -f "$full_path" ]] && continue

    # Check if extension is in allowed list
    local is_allowed=false
    for pat in "${allowed_binaries[@]}"; do
      if echo "$f" | grep -qE "$pat"; then
        is_allowed=true
        break
      fi
    done
    $is_allowed && continue

    # Detect binary via file command
    local file_type
    file_type=$(file --brief "$full_path" 2>/dev/null || echo "unknown")
    if echo "$file_type" | grep -qiE '(binary|executable|ELF|PE32|data)'; then
      # Skip if text-like despite "data" label (e.g. some SVGs)
      if echo "$file_type" | grep -qiE '(text|ASCII|UTF)'; then
        continue
      fi
      add_finding "WARNING" "binary" "$f" "0" "$file_type" "Unexpected binary"
    fi
  done < <(echo "$files")
}

# ── Scan: High entropy strings ──────────────────────────────────────────────
scan_entropy() {
  local files
  files=$(git -C "$REPO_PATH" ls-files 2>/dev/null) || return
  [[ -z "$files" ]] && return

  # Exclude known high-entropy false positives
  local exclude_patterns=(
    "package-lock\\.json"
    "yarn\\.lock"
    "pnpm-lock\\.yaml"
    "\\.svg$"
    "\\.woff2?$"
    "\\.ttf$"
    "\\.map$"
    "node_modules/"
    "\\.git/"
  )

  while IFS= read -r f; do
    [[ -z "$f" ]] && continue

    # Check exclusions
    local excluded=false
    for pat in "${exclude_patterns[@]}"; do
      if echo "$f" | grep -qE "$pat"; then
        excluded=true
        break
      fi
    done
    $excluded && continue

    local full_path="${REPO_PATH}/${f}"
    [[ ! -f "$full_path" ]] && continue

    # Look for base64-encoded strings of 40+ chars
    while IFS= read -r line; do
      [[ -z "$line" ]] && continue
      local lineno="${line%%:*}"
      local match
      match=$(echo "$line" | sed 's/^[0-9]*://' || true)
      # Extract the base64 string
      local b64
      b64=$(echo "$match" | grep -oE '[A-Za-z0-9+/]{40,}={0,2}' | head -1 || true)
      [[ -z "$b64" ]] && continue
      # Skip if it looks like a hash (all hex)
      if echo "$b64" | grep -qE '^[0-9a-f]{40,}$'; then
        continue
      fi
      add_finding "WARNING" "entropy" "$f" "$lineno" "$b64" "High-entropy string"
    done < <(grep -nE '[A-Za-z0-9+/]{40,}={0,2}' "$full_path" 2>/dev/null || true)
  done < <(echo "$files")
}

# ── Report: Terminal ────────────────────────────────────────────────────────
print_terminal_report() {
  local repo_name
  repo_name=$(basename "$REPO_PATH")

  echo ""
  echo "$(bold "🔒 Security Audit Report") — ${repo_name}"
  echo ""

  # Group findings by category
  local secrets_finds=() pii_finds=() profanity_finds=() binary_finds=() entropy_finds=() history_finds=()
  for f in "${FINDINGS[@]+"${FINDINGS[@]}"}"; do
    local cat
    cat=$(echo "$f" | cut -d'|' -f2)
    case "$cat" in
      secrets)
        local loc
        loc=$(echo "$f" | cut -d'|' -f3)
        if echo "$loc" | grep -q "^git-history:"; then
          history_finds+=("$f")
        else
          secrets_finds+=("$f")
        fi
        ;;
      pii)       pii_finds+=("$f") ;;
      profanity) profanity_finds+=("$f") ;;
      binary)    binary_finds+=("$f") ;;
      entropy)   entropy_finds+=("$f") ;;
    esac
  done

  # SECRETS section
  echo "SECRETS"
  if [[ ${#secrets_finds[@]} -eq 0 ]]; then
    echo "  $(green "✅ No secrets found")"
  else
    echo "  $(red "❌ ${#secrets_finds[@]} finding(s)")"
    for f in "${secrets_finds[@]}"; do
      local sev cat loc match label
      sev=$(echo "$f" | cut -d'|' -f1)
      loc=$(echo "$f" | cut -d'|' -f3)
      match=$(echo "$f" | cut -d'|' -f4)
      label=$(echo "$f" | cut -d'|' -f5)
      echo "    $(red "CRITICAL") ${loc}  $(dim "[${label}]")"
      $FIX_SUGGEST && suggest_fix "secrets" "$match"
    done
  fi
  echo ""

  # PII section
  if ! $SKIP_PII; then
    echo "PII"
    if [[ ${#pii_finds[@]} -eq 0 ]]; then
      echo "  $(green "✅ No PII found")"
    else
      echo "  $(yellow "⚠️  ${#pii_finds[@]} finding(s)")"
      for f in "${pii_finds[@]}"; do
        local loc match label
        loc=$(echo "$f" | cut -d'|' -f3)
        match=$(echo "$f" | cut -d'|' -f4)
        label=$(echo "$f" | cut -d'|' -f5)
        echo "    $(yellow "WARNING") ${loc}  $(dim "[${label}]")"
        $FIX_SUGGEST && suggest_fix "pii" "$match"
      done
    fi
    echo ""
  fi

  # PROFANITY section
  if ! $SKIP_PROFANITY; then
    echo "PROFANITY"
    if [[ ${#profanity_finds[@]} -eq 0 ]]; then
      echo "  $(green "✅ Clean")"
    else
      echo "  $(yellow "⚠️  ${#profanity_finds[@]} finding(s)")"
      for f in "${profanity_finds[@]}"; do
        local loc match label
        loc=$(echo "$f" | cut -d'|' -f3)
        match=$(echo "$f" | cut -d'|' -f4)
        label=$(echo "$f" | cut -d'|' -f5)
        echo "    $(yellow "WARNING") ${loc}"
        $FIX_SUGGEST && suggest_fix "profanity" "$match"
      done
    fi
    echo ""
  fi

  # GIT HISTORY section
  echo "GIT HISTORY (secrets only)"
  if $SKIP_HISTORY; then
    echo "  $(dim "⏭️  Skipped (--skip-history)")"
  elif [[ ${#history_finds[@]} -eq 0 ]]; then
    echo "  $(green "✅ Clean")"
  else
    echo "  $(red "❌ ${#history_finds[@]} finding(s)")"
    for f in "${history_finds[@]}"; do
      local loc match label
      loc=$(echo "$f" | cut -d'|' -f3)
      match=$(echo "$f" | cut -d'|' -f4)
      label=$(echo "$f" | cut -d'|' -f5)
      echo "    $(red "CRITICAL") ${loc}  $(dim "[${label}]")"
      $FIX_SUGGEST && suggest_fix "secrets" "$match"
    done
  fi
  echo ""

  # BINARY FILES section
  echo "BINARY FILES"
  if [[ ${#binary_finds[@]} -eq 0 ]]; then
    echo "  $(green "✅ No unexpected binaries")"
  else
    echo "  $(yellow "⚠️  ${#binary_finds[@]} finding(s)")"
    for f in "${binary_finds[@]}"; do
      local loc match label
      loc=$(echo "$f" | cut -d'|' -f3)
      match=$(echo "$f" | cut -d'|' -f4)
      label=$(echo "$f" | cut -d'|' -f5)
      echo "    $(yellow "WARNING") ${loc}  $(dim "${match}")"
      $FIX_SUGGEST && suggest_fix "binary" "$match"
    done
  fi
  echo ""

  # HIGH ENTROPY section
  echo "HIGH ENTROPY"
  if [[ ${#entropy_finds[@]} -eq 0 ]]; then
    echo "  $(green "✅ No suspicious strings (excluding package-lock.json)")"
  else
    echo "  $(yellow "⚠️  ${#entropy_finds[@]} finding(s)")"
    for f in "${entropy_finds[@]}"; do
      local loc match label
      loc=$(echo "$f" | cut -d'|' -f3)
      match=$(echo "$f" | cut -d'|' -f4)
      label=$(echo "$f" | cut -d'|' -f5)
      echo "    $(yellow "WARNING") ${loc}  $(dim "[${label}]")"
      $FIX_SUGGEST && suggest_fix "entropy" "$match"
    done
  fi
  echo ""

  # Summary line
  echo "────────────────────────────────────────────────────────────────────────────────"
  local total_secrets=$((SECRETS_COUNT + ${#history_finds[@]}))
  echo "Summary: ${total_secrets} secrets, ${PII_COUNT} PII, ${PROFANITY_COUNT} profanity, ${BINARY_COUNT} binary, ${ENTROPY_COUNT} entropy"

  # Exit reason
  if [[ ${total_secrets} -gt 0 ]]; then
    echo "Exit: $(red "FAIL") (secrets detected)"
  elif $STRICT && [[ ${PII_COUNT} -gt 0 || ${PROFANITY_COUNT} -gt 0 ]]; then
    echo "Exit: $(red "FAIL") (strict mode: PII/profanity not allowed)"
  else
    echo "Exit: $(green "PASS") (secrets-only mode)"
  fi
}

# ── Report: JSON ────────────────────────────────────────────────────────────
print_json_report() {
  local repo_name
  repo_name=$(basename "$REPO_PATH")
  local timestamp
  timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

  # Start JSON
  echo "{"
  echo "  \"repo\": \"${REPO_PATH}\","
  echo "  \"timestamp\": \"${timestamp}\","  
  echo "  \"findings\": ["

  local first=true
  for f in "${FINDINGS[@]+"${FINDINGS[@]}"}"; do
    local sev cat loc match label
    sev=$(echo "$f" | cut -d'|' -f1 | tr '[:upper:]' '[:lower:]')
    cat=$(echo "$f" | cut -d'|' -f2)
    loc=$(echo "$f" | cut -d'|' -f3)
    match=$(echo "$f" | cut -d'|' -f4)
    label=$(echo "$f" | cut -d'|' -f5)

    local file="${loc%%:*}"
    local line="${loc#*:}"
    # Handle git-history entries
    if echo "$file" | grep -q "^git-history:"; then
      line="0"
    fi

    # Escape JSON strings
    match=$(echo "$match" | sed 's/\\/\\\\/g; s/"/\\"/g' | head -c 200)
    file=$(echo "$file" | sed 's/\\/\\\\/g; s/"/\\"/g')
    label=$(echo "$label" | sed 's/\\/\\\\/g; s/"/\\"/g')

    if ! $first; then
      echo ","
    fi
    first=false

    printf '    {"severity": "%s", "category": "%s", "file": "%s", "line": "%s", "match": "%s", "pattern": "%s"}' \
      "$sev" "$cat" "$file" "$line" "$match" "$label"
  done

  echo ""
  echo "  ],"
  echo "  \"summary\": {"
  echo "    \"secrets\": ${SECRETS_COUNT},"
  echo "    \"pii\": ${PII_COUNT},"
  echo "    \"profanity\": ${PROFANITY_COUNT},"
  echo "    \"binary\": ${BINARY_COUNT},"
  echo "    \"entropy\": ${ENTROPY_COUNT}"
  echo "  },"

  # Determine exit code for JSON
  local exit_code=0
  if [[ ${SECRETS_COUNT} -gt 0 ]]; then
    exit_code=1
  elif $STRICT && [[ ${PII_COUNT} -gt 0 || ${PROFANITY_COUNT} -gt 0 ]]; then
    exit_code=1
  fi
  echo "  \"exit_code\": ${exit_code}"
  echo "}"
}

# ── Main ─────────────────────────────────────────────────────────────────────

# Run scans
scan_tracked_files
scan_git_history
scan_binary_files
scan_entropy

# Output report
if $JSON_OUTPUT; then
  print_json_report
else
  print_terminal_report
fi

# ── Exit code ────────────────────────────────────────────────────────────────
if [[ ${SECRETS_COUNT} -gt 0 ]]; then
  exit 1
elif $STRICT && [[ ${PII_COUNT} -gt 0 || ${PROFANITY_COUNT} -gt 0 ]]; then
  exit 1
else
  exit 0
fi
