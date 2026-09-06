# Contract Resolution

The order in which the check skill resolves a project's check contract. **First hit wins; resolution never writes a file.** Steps 2–5 warn and offer `/b-init-guardrails`; only that skill writes, and only after its Phase 2 approval.

## 1. `guardrails.json` at repo root

Authoritative. Parse the file, honour `version` (v1 → three new gates skipped, see `ratchet-protocol.md` § v1 Compatibility), run all gates. Set `status` according to the gates and the verdict rules in `SKILL.md`. Verdict field: `contract: "durable"`.

## 2. Managed block present but `guardrails.json` missing

If `<!-- BEGIN b-init-guardrails -->` is present in `AGENTS.md` or `CLAUDE.md` but `guardrails.json` is absent at the repo root, the contract is broken. Emit exactly:

```
Managed guardrails block present but guardrails.json is missing — the contract is broken. Run /b-init-guardrails to repair.
```

Then fall through to step 3.

## 3. `detect-stack.ts` reports ≥ 1 ecosystem

Run `bun <skill_dir>/scripts/detect-stack.ts`. If it reports at least one ecosystem, build an **ephemeral** contract and run **only** the unit-test, functional-test, and lint gates. **Skip coverage, patch, and complexity gates** — those require a recorded baseline that does not exist, and running them without one produces a meaningless verdict.

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
