#!/usr/bin/env bash
set -euo pipefail
repo="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
cd -- "$repo"
exec omp --no-extensions --no-skills --no-rules --no-tools --no-lsp --no-session --no-title \
  -e "$repo/.context/2026-09-30.buck-loop-tui-preview/preview.ts"
