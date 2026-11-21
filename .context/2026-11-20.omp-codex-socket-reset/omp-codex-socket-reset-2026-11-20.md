---
date: 2026-11-20
domains: [tooling]
topics: [omp, openai-codex, econnreset, provider-transport]
subject: 2026-11-20.omp-codex-socket-reset
related: [2026-11-20.bun-typescript-migration]
priority: medium
status: active
---
# OMP Codex socket resets outside the Bun migration checkout

The exact reported error was captured by OMP 19.0.1 in a separate chezmoi session (`01a1fa2e-5fcc-7630-957b-303a4d27e798`). Its OMP diagnostic log (`~/.omp/logs/omp.2026-11-20.1991593.log`, lines 43–59) attributes six failures to the `openai-codex` / `gpt-6-luna` provider turn: five `ECONNRESET` events and one HTTP 503 reporting an upstream connection failure before headers. OMP scheduled six automatic retries, and the session transcript lines 59–65 show the last retry resumed tool use. Several failed records carry partial thinking, consistent with an interrupted response stream. The exact failing network hop is not identified.

The current branch delta `9936d9d...e4ed9c8` changes standalone workflow tooling and only two extension test files, not the OMP provider transport. The cross-checkout event and the upstream 503 point away from the TypeScript/Bun migration. No source changes or live replay were needed or performed. If recurring, switch to a different provider temporarily; collect the warning timestamp and error ID for OMP/provider escalation (135168 for this incident).