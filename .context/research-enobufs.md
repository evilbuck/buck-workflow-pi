---
status: completed
date: 2026-09-18
informs:
  - plan not written — fix applied in-session
---

# Diagnosis: preflight ENOBUFS

## Red loop

```
bun skills/git-commit-improved/scripts/commit-preflight.ts
```

in a throwaway repo with a staged patch ≳ 1.2 MiB.

Before fix:

```json
{"error":"git diff --cached failed: spawnSync git ENOBUFS (stdout or stderr buffer reached maxBuffer size limit)"}
```

exit 1 — same payload the extension wraps as `Preflight failed (exit 1): …`.

Control: 118-byte staged patch → exit 0.

## Minimised repro

| Staged patch | `git diff --cached` bytes | preflight |
|---|---|---|
| 1-line file | 118 | exit 0 |
| 15k unique lines | 424_035 | exit 0 |
| 1.2 MiB single-line `x` | 1_200_113 | exit 1 ENOBUFS |
| 3 files / 42k lines | 1_395_105 | exit 1 ENOBUFS |

Load-bearing: **patch stdout byte size**, not file count. One file is enough.

## Ranked hypotheses

1. **Default 1 MiB `maxBuffer` on `execFileSync` in `execGit(["diff", "--cached"])`** — confirmed. Omitting `maxBuffer` fails at ~1 MiB; `maxBuffer: 2MiB` returns the full patch. ENOBUFS errors still carry partial `stdout`.
2. **stderr contributing to the buffer** — falsified. stderr empty on the failing `git diff --cached`.
3. **Extension `execFileCaptured` 1 MiB cap** — not this incident. The user message includes preflight's JSON `error` string, so `die()` ran inside the script. Residual: if preflight ever emitted >1 MiB JSON, the extension would fail with `no output`.
4. **File-count / Codex bundle specifically** — falsified as the trigger. Byte size of the patch is the trigger; a 98-file bundle just happens to exceed 1 MiB.

## Winning hypothesis

`skills/git-commit-improved/scripts/commit-preflight.ts` always buffered the full staged patch. Node/Bun `execFileSync` default `maxBuffer` is 1 MiB. Consumers (`buildPrompt`, `fallbackDraft`) already truncate to 8000 chars, so the unbounded dump was wasted work and the failure mode.

## Fix

`gatherStagedDiff()`: `maxBuffer` 64 KiB, truncate to 8000 chars (same cap as the model prompt). On `ENOBUFS`, use partial `stdout` if present, else `--shortstat` + `--name-status`. Exit 0.

Script is spawned from disk each run — no OMP restart required.
