# Contract Resolution

The order in which the check skill resolves a project's check contract. **First hit wins; resolution never writes a file.** Steps 2–5 warn and offer `/b-init-guardrails`; only that skill writes, and only after its Phase 2 approval.

## 1. `guardrails.json` at repo root

Authoritative. Invoke the deterministic verdict engine — `bun <skill_dir>/scripts/check.ts --cwd <repo root>` — and use its emitted verdict verbatim. The runner honours `version` (v1 → three new gates skipped, see `ratchet-protocol.md` § v1 Compatibility), applies the `enforcement` states, and exits 1 for a required-gate failure or a malformed contract, and 2 when `guardrails.json` is missing. Do not re-implement gate computation in prose. Verdict field: `contract: "durable"`.

**Legacy vendored runner.** The engine is `scripts/check.ts` (Bun). If the skill tree serving this repo has `scripts/check.mjs` (the pre-migration Node runner) instead, the vendored tree is outdated. Emit exactly:

```
Vendored guardrails runner is outdated (skills/b-guardrails-check/scripts/check.mjs). Upgrade with: bun <b-init-guardrails skill_dir>/scripts/install-project-skills.ts --cwd <repo root> — review with --dry-run first.
```

Prerequisite: the installer must come from a current `b-init-guardrails` copy outside the target repository's vendored `skills/` tree. `<b-init-guardrails skill_dir>` in the command above is that external copy, not the outdated vendored tree being replaced. The installer overwrites the two managed skill trees and migrates only the exact previously managed `guardrails:check` package command (`node skills/b-guardrails-check/scripts/check.mjs --cwd .` → `bun skills/b-guardrails-check/scripts/check.ts --cwd .`). It preserves custom commands, may append vendored-tree exclusions to lizard commands in `guardrails.json`, and never deletes the stale `check.mjs`. Review `--dry-run` first; on approval run the installer, then invoke the fresh `check.ts`. If the user declines, run the legacy runner under `bun` and label the verdict as coming from the outdated engine.

## 2. Managed block present but `guardrails.json` missing

If `<!-- BEGIN b-init-guardrails -->` is present in `AGENTS.md` or `CLAUDE.md` but `guardrails.json` is absent at the repo root, the contract is broken. Emit exactly:

```
Managed guardrails block present but guardrails.json is missing — the contract is broken. Run /b-init-guardrails to repair.
```

Then fall through to step 3.

## 3. `detect-stack.ts` reports ≥ 1 ecosystem

Run `bun skills/b-init-guardrails/scripts/detect-stack.ts` from the repo root. If that file is absent, run `bun <b-init-guardrails skill dir>/scripts/detect-stack.ts`. If it reports at least one ecosystem, build an **ephemeral** contract and run **only** the unit-test, functional-test, and lint gates. **Skip coverage, patch, and complexity gates** — those require a recorded baseline that does not exist, and running them without one produces a meaningless verdict.

Emit exactly:

```
No guardrails.json — ran detected commands only (no coverage/complexity baseline). Run /b-init-guardrails to create a durable contract.
```

Verdict field: `contract: "ephemeral"`.

## 4. No ecosystem detected — surface README suggestions

`detect-stack.ts` reports zero ecosystems. Scan `README.md` for the first fenced code block that follows a heading matching:

```
/^#{1,4}\s*(tests?|testing|development|dev|quality|checks?|contributing)\b/i
```

If found, **print the block to the user verbatim as unverified suggestions**. Never execute it — arbitrary README commands are not a safe execution surface. Verdict field: `contract: "suggested"`.

## 5. Nothing found

No `guardrails.json`, no managed block, no detected ecosystem, no README suggestion. Emit:

```
No deterministic check contract found. Run /b-init-guardrails to create one.
```

Verdict field: `contract: "none"`. Gate result: `unenforceable`.

## Closing rule

**Resolution never writes a file.** The five-step chain above is read-only. Steps 2–5 print warnings and the `/b-init-guardrails` offer; only the init skill writes, and only after its Phase 2 approval.
