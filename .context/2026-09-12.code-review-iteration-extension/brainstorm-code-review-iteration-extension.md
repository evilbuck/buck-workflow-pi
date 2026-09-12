# Plan: Isolated Code Review Iteration Extension

## User Goal

An OMP user can start one command that runs an observable review → verify/fix → re-review loop in isolated contexts until the change is clean, blocked, or reaches a bounded stopping condition, without filling the user's main agent context.

## What we might build

- An OMP extension command that launches the reviewer in an isolated SDK agent session while reusing the repository's existing model/session and live-activity wrappers.
- Seeded reviewer profiles stored as editable Markdown inside the extension folder. One selected persona runs each review pass. Seeds include generic review styles and provider/model-specific personas. Every persona names a default model and temperature, but either can be overridden so the persona remains assignable to any model.
- Invocation arguments for selecting a profile, overriding temperature, and supplying review-specific context.
- Independent bindings for exactly two runtime roles, `Reviewer` and `Fixer`. The Reviewer resolves from the selected persona plus optional role/provider/model overrides. The Fixer can be pinned explicitly or selected automatically from issue hardness and an editable model capability catalog.
- Reviewer prompt assembly always retains a small invariant envelope containing target identity, read-only boundaries, output schema, criticality math, hardness vocabulary, and pass id.
- Default mode appends supplied context after `prompts/reviewer.md` and the selected persona. `--replace-reviewer-prompt` omits those two editable guidance layers and uses the supplied replacement instead; it does not replace the invariant envelope or the Fixer prompt.
- A modest durable review artifact: concise findings, evidence, affected location, impact, confidence, and reproduction steps when reproduction applies. It should describe defects without prescribing an implementation.
- Two separate repeatable classifications: issue criticality (impact, likelihood, and breadth) and fix hardness (`easy`, `medium`, `hard`) used only for model routing.
- The extension owns the full loop: an isolated Reviewer produces findings, the extension validates and persists them, an isolated Fixer first verifies each finding and then fixes valid issues, and a fresh Reviewer checks the resulting change.
- Review-target resolution: any existing non-bare Git checkout counts as a worktree, including the primary checkout. Operate in place on its current branch. Only prompt for a branch and create a linked worktree when the command has a repository target but is not already running inside one; never force one branch into two worktrees.
- Before the first review, fetch the detected default branch from `origin` and automatically rebase the current branch onto that updated remote-tracking ref using autostash semantics. A failed fetch or unresolved rebase is a hard stop rather than a review against stale base code. `--base` may override the branch name, but not the fetch/rebase requirement.
- If the rebase conflicts, route the conflict set to a hard-capability Fixer in an isolated context and continue deterministically. If it cannot complete the rebase, abort and restore the pre-run worktree instead of leaving conflict state behind.
- After the rebase, create one pre-review checkpoint commit when the starting tree is dirty. Show non-ignored untracked paths once with all preselected so the user can exclude files before the checkpoint. This separates the reviewed starting state from later per-pass Fixer commits.

## Why it matters

- Review should not consume or bias the working agent's context.
- Reviewer behavior should be configurable without editing TypeScript.
- Findings need enough evidence for independent verification, but should leave remediation decisions to the fixing agent.
- Severity labels need consistent meaning across reviewer personas and runs.
- Fix routing should choose the lowest sufficient capability tier while preserving independence from the model that found the issue.

## Constraints / preferences

- OMP-first extension; do not create a second portable review skill unless later planning finds a real shared boundary.
- Reuse `extensions/omp-models.ts` and the shared extension activity surface rather than creating a parallel SDK/session or progress convention.
- Keep reviewer prompt/profile files beside the extension implementation and seed useful defaults.
- Treat append and replacement as intentionally different prompt contracts; replacement must be explicit.
- Reviewer work should happen in a separate context and leave a durable handoff artifact.
- Model/provider selection is per role, not one global model for the command. Persona-level reviewer bindings are an optional finer override.
- A persona's default model is a default, never an affinity constraint; any reviewer model can run any persona.
- Criticality, fix hardness, and model capability are separate axes and must not be inferred from one another.
- The extension creates local checkpoint commits but never pushes or force-pushes them.
- Reports are evidence-led and non-prescriptive. Include reproduction only when it is meaningful and observed or clearly identified as unverified.
- Do not revive the deprecated `b-flow` orchestration design or hide multi-agent work behind an opaque state machine.
- Existing `code-review-universal` plumbing and report conventions are prior art; reuse rather than duplicate where the contracts fit.

## Candidate defaults

### Extension-owned Markdown

- `prompts/reviewer.md` — editable base review guidance.
- `prompts/fixer.md` — fixer instruction to verify before editing, preserve evidence, and report dispositions.
- `personas/balanced.md` — broad correctness, regressions, maintainability, and test quality.
- `personas/correctness.md` — state transitions, boundaries, errors, data integrity, and concurrency.
- `personas/security.md` — trust boundaries, authorization, injection, secrets, and unsafe defaults.
- `personas/performance.md` — hot paths, I/O, algorithmic cost, avoidable allocation, and contention.
- Provider/model-specific personas are neutral launchers: each starts with the balanced, evidence-first discipline plus model and temperature defaults, but makes no uncalibrated claim about model-specific strengths or weaknesses.
- `models/<provider>-<model>.md` — separately editable model capability entries used by the Fixer router.
- `review-exec-policy.md` — editable command ids, executable/argv constraints, timeouts, and output caps for reviewer reproduction.

Persona frontmatter stays small: `name`, `description`, `default_model`, and `default_temperature`, followed by the prompt body. An explicit model or role at invocation overrides `default_model`. The scoring contract and output schema stay outside the persona so changing tone cannot silently change severity semantics.

Initial neutral persona seeds:

|File|`default_model`|`default_temperature`|
|---|---|---:|
|`personas/openai-codex-gpt-5.6-terra.md`|`openai-codex/gpt-5.6-terra:high`|`0.2`|
|`personas/zai-glm-5.3.md`|`zai/glm-5.3:high`|`0.2`|
|`personas/anthropic-claude-sonnet-5.md`|`anthropic/claude-sonnet-5:high`|`0.2`|
|`personas/xai-oauth-grok-4.6.md`|`xai-oauth/grok-4.6:high`|`0.2`|
|`personas/opencode-go-kimi-k3.md`|`opencode-go/kimi-k3:high`|`0.2`|

Their initial bodies are intentionally equivalent rather than folklore-based model adapters. `--reviewer-model` can move any persona to another model; `--reviewer-temperature` overrides its default. The pass artifact records the requested and effective model, thinking level, and temperature, including any provider-side unsupported-option omission.

Each model-catalog Markdown file uses the schema below; its body explains the human rationale. Keeping this metadata separate from personas lets a persona move between models without changing routing claims.

### Model catalog schema

Use one Markdown file per exact provider/model selector. YAML frontmatter is the machine contract; the body records the human calibration rationale:

```yaml
---
schema_version: 1
selector: xai-oauth/grok-4.6
family: grok-4.6
aliases: [grok-4.6]
fixer_capability: easy | medium | hard
roles: [reviewer, fixer]
priority: 100
thinking_easy: minimal
thinking_medium: high
thinking_hard: xhigh
enabled: true
calibration_source: seeded | benchmarked | user
reviewed_at: YYYY-MM-DD
---
```

- `selector` is the exact OMP registry identity; provider alternatives are separate entries.
- `family` identifies the underlying model across providers, so routing does not mistake the same model behind another provider for independent review/fix diversity.
- `fixer_capability` is the highest approved hardness; tier-specific thinking values select a supported effort without redefining capability.
- Lower `priority` wins only after minimum sufficient tier and Reviewer-family/provider diversity.
- Invalid or duplicate entries fail catalog preflight visibly. Unavailable selectors are filtered by the OMP registry, and old `reviewed_at` dates produce a staleness warning rather than silently changing capability.

Selectors verified in the current OMP catalog for the requested seed families:

- `openai-codex/gpt-5.6-terra`
- `zai/glm-5.3` and `opencode-go/glm-5.3`
- `anthropic/claude-sonnet-5`
- `xai-oauth/grok-4.6` and `opencode-go/grok-4.6`
- `opencode-go/kimi-k3`

Initial user-calibrated capability seeds:

|Capability|Families / preferred selectors|
|---|---|
|Hard|GLM-5.3 (`zai/glm-5.3`), GPT-5.6-Sol (`openai-codex/gpt-5.6-sol`), Grok 4.6 (`xai-oauth/grok-4.6`), Claude Opus 5 (`anthropic/claude-opus-5`), Kimi K3 (`opencode-go/kimi-k3`)|
|Medium|GPT-5.6-Terra (`openai-codex/gpt-5.6-terra`), Claude Sonnet 5 (`anthropic/claude-sonnet-5`), GLM-5.3-Flash (`zai/glm-5.3-flash`), Muse Spark 1.3 (`meta/muse-spark-1.3`), Qwen3.7 Plus (`opencode-go/qwen3.7-plus`)|
|Easy|GPT-5.6-Luna (`openai-codex/gpt-5.6-luna`), MiniMax M3 (`minimax-code/MiniMax-M3`)|

The unqualified hard-tier `gpt-5.6` maps to Sol because Terra and Luna were classified separately. Equivalent provider selectors may be seeded as lower-priority entries with the same `family` and capability.

### Role and model resolution

Reviewer model precedence:

1. Explicit provider/model (`--reviewer-model`).
2. Explicit OMP model role (`--reviewer-role`).
3. Selected persona `default_model`.
4. Named OMP `modelRoles.reviewer`.
5. OMP `default`.

Fixer model precedence:

1. Explicit provider/model (`--fixer-model`).
2. Explicit OMP model role (`--fixer-role`).
3. Automatic hardness routing through the available model catalog.
4. OMP's existing difficulty mapping for the required tier (`smol`/`slow`/`default` family), as the fallback when the catalog has no eligible available model.

If both role and provider/model are given for one role, the exact provider/model wins. Reviewer temperature resolves from an explicit flag, then persona metadata, then a conservative seeded default. The current `runOmpModelSession` wrapper accepts an exact model override and streams activity, but does not expose temperature; implementation needs one deliberate shared-wrapper addition after checking the installed OMP SDK surface.

### Hardness and Fixer routing

- Every finding includes `fix_hardness: easy | medium | hard`, independent of its criticality.
- Every catalogued model declares the highest Fixer hardness it can handle. Ordered eligibility is `easy < medium < hard`; a higher tier may handle a lower-tier issue.
- For a review pass, required Fixer capability is the maximum `fix_hardness` among its blocking findings. One selected Fixer handles the whole pass; the extension does not split findings across concurrent or sequential Fixer agents.
- The command intersects configured entries with OMP's currently available model registry, then chooses the lowest sufficient capability tier.
- When alternatives exist, exclude the exact Reviewer model. Within a tier, prefer a different provider, then the catalog's stable priority order.
- If the Reviewer model is the only capable available model, reuse it with an explicit activity/report note rather than pretending independence.
- An explicit Fixer role/model bypasses automatic selection. User choice is honored even when catalogued below the requested hardness, with the mismatch recorded in activity and the pass report.

The catalog is hybrid: per-model Markdown is authoritative for capability and priority when an entry exists; the runtime intersects it with OMP's available-model registry; OMP `modelRoles` provides fallback when no eligible catalogued model is available. Routing is never based on runtime model self-ranking.

### Review loop

1. Resolve the target branch/worktree and capture pre-run `HEAD` plus worktree state for recovery.
2. Fetch the selected base branch from `origin`, pin its fetched commit, and rebase the current branch onto it with autostash semantics.
3. On conflict, assign a hard-capability Fixer to resolve the rebase. Continue only after deterministic conflict/staging checks; on failure, abort and restore the pre-run state.
4. If the restored starting tree is dirty, prompt once over non-ignored untracked paths (all selected by default), then create a pre-review checkpoint commit containing the resulting reviewed starting state.
5. Create a disposable detached review worktree at the checkpoint `HEAD`, start a fresh `Reviewer` session there with the selected persona/model and restricted reproduction tool, and require a structured finding payload containing criticality inputs and `fix_hardness`.
6. Validate the payload, compute criticality ratings from the fixed rubric, and persist immutable pass artifacts plus minimal machine state under the repository's common git directory. The extension writes artifacts; the Reviewer does not need write tools.
7. Compute the maximum hardness among blocking findings and select one capable Fixer, excluding the Reviewer model when an eligible alternative is available.
8. Start a fresh `Fixer` session against that exact pass artifact. It independently reproduces or verifies each blocking finding, records `valid`, `invalid`, `already fixed`, or `blocked`, and edits only valid findings.
9. Run the project's deterministic check contract, then create one checkpoint commit for that Fixer pass only when the checks pass.
10. Start another fresh `Reviewer` session against the new `HEAD`.
11. Stop clean when no medium-or-higher findings remain. Advisory and low findings stay report-only. A run allows three Reviewer passes total (initial review plus at most two re-reviews); unresolved blocking findings after pass three end as `exhausted`, not success. Command flags may override the threshold and cap.
12. On every terminal outcome (`clean`, `blocked`, `exhausted`, `cancelled`, or `failed`), write one modest durable report into the resolved `.context/` subject without copying raw prompts or model transcripts.

This default prevents style/nit churn and bounds model use while still routing substantive defects through the Fixer.

### Reviewer execution boundary

- Each Reviewer pass gets a disposable detached worktree at the exact committed `HEAD`. It never runs in the Fixer's mutable checkout.
- The nested Reviewer receives repository read/search tools plus a custom `review_exec`; it receives no `edit`, `write`, or general `bash` tool.
- `review_exec` accepts a command id plus structured argv and an optional repo-relative cwd. It never invokes a shell, rejects cwd/symlink escape, supplies a sanitized environment, caps time/output, and terminates the process tree on timeout.
- Allowed command ids come from the project's deterministic check contract, a fixed set of read-only Git operations, and an editable extension-local command policy. Policy matching is structural, not string-prefix matching.
- Commands run with host network access, as selected. The artifact records that exposure. Credentials and arbitrary caller environment variables are not inherited.
- A denied or unavailable command becomes `not run` with a policy reason. The extension never falls back to unrestricted `bash`.
- Files created or changed by reproduction commands stay in the disposable worktree. After results are captured and sanitized, remove that worktree and verify the Fixer checkout fingerprint is unchanged.

This contains repository mutations but is not a complete security sandbox: an allowed executable with host-network access may still have effects beyond its cwd. The allowlist and sanitized environment are therefore part of the trust boundary.

### Reproduction evidence

`review_exec` records a stable command id, normalized argv, relative cwd, start/end time, exit status or signal, timeout state, and bounded/redacted stdout/stderr excerpts with full-output hashes. The pass artifact references those records rather than copying unbounded logs.

A finding may say `reproduced` only when it cites at least one recorded command and explains which observed result demonstrates the failure. Otherwise it must use `not reproduced`, `not run` (with reason), or `not applicable`. Reproduction evidence supports the finding; it does not prescribe the fix, and the Fixer still verifies it independently.

### Artifact layout

Runtime state lives outside every worktree under `<git-common-dir>/code-review-iteration/<branch-key>/<run-id>/`:

- `state.json` — atomic resumable state: status, base/head commits, pass, selected persona/models, thresholds, and artifact pointers.
- `passes/NN/review.json` — validated machine findings and computed ratings.
- `passes/NN/review.md` — concise human rendering for the Fixer and manual inspection.
- `passes/NN/fixer.json` — per-finding verification disposition, changed paths, checks, and checkpoint commit.
- `passes/NN/fixer.md` — concise human rendering of the Fixer's observed outcome.
- `passes/NN/commands.jsonl` — bounded, sanitized reproduction-command evidence referenced by finding ids.

Pass directories are immutable once complete. The mutable `state.json` points to the active/last complete pass and is written atomically. This state survives linked-worktree removal and cannot feed back into the reviewed diff.

At termination, render one git-portable report in the active subject (or a new review subject when none exists): `<subject>/review-iteration-<run-id>.md`. It summarizes outcome, fetched base, starting/final `HEAD`, persona and actual models, rating/hardness inputs, findings and Fixer dispositions, checkpoint commits, verification, and resume pointer. Raw prompts, hidden reasoning, and full model transcripts stay out.

### Resume and cleanup

- On invocation, automatically resume the newest resumable run for the same repository and branch when its stored `HEAD`, worktree fingerprint, and Git operation state still match.
- Resume reconstructs fresh Reviewer/Fixer sessions from `state.json` and immutable artifacts; nested model conversation history is never required.
- Re-fetch and rebase the configured `origin/<base>` before resumed model work. If the base advanced, supersede any not-yet-fixed finding set and run a fresh Reviewer pass against the rebased tree.
- If state integrity or the worktree fingerprint does not match, do not guess or overwrite it; surface the mismatch and preserve the old run for inspection.
- On `clean`, write and commit the final `.context/` report, then remove only a linked worktree created by this extension and only if it is clean. Never remove the user's pre-existing checkout.
- On `blocked`, `exhausted`, `cancelled`, or `failed`, write/update the final report but retain the created worktree and git-common runtime for automatic resume.
- Git-common runtime artifacts remain until an explicit prune operation; successful cleanup removes the created worktree, not the audit trail.

### Candidate criticality rubric

Criticality answers “how bad is the defect?” Fix hardness answers “what capability is needed to verify and repair it?” A critical one-line authorization omission may be easy to fix; a medium architectural race may require a hard Fixer.

Each finding reports the raw inputs and computed score:

- **Impact `I` (0–4):** none; local inconvenience; secondary behavior wrong/recoverable; primary behavior or meaningful integrity/security failure; authorization/privacy breach, irreversible data loss, or systemic outage.
- **Likelihood `L` (0–3):** no concrete trigger; rare prerequisites; plausible real path; deterministic or common.
- **Breadth `B` (0–2):** one narrow path; shared component/multiple users; system-wide or externally exposed.
- **Score:** `2I + L + B` (0–13).
- **Rating:** 0–2 advisory, 3–5 low, 6–8 medium, 9–10 high, 11–13 critical.

Deterministic floors: a concretely exploitable security boundary or likely irreversible data loss is critical; a primary-path/build/runtime blocker is at least high. Pure style or preference without observable failure is at most low. Confidence is reported separately and never lowers criticality; uncertainty is work for the fixer to verify. The formula and thresholds are deterministic; choosing the input levels remains reviewer judgment constrained by the anchored definitions and rechecked by the Fixer.

The human report for each finding stays non-prescriptive: id, rating and score inputs, confidence, affected location, observed versus expected behavior, evidence, impact, and reproduction status/steps (`reproduced`, `not reproduced`, `not run`, or `not applicable`). Remediation proposals are omitted.

## Scope boundary

- GitHub PR discovery, feedback ingestion, review submission, comments, and merge behavior are outside this extension. It operates only on the local checkout/worktree and leaves GitHub lifecycle ownership to `fix-pr` and `b-pr-manager`.

## Gap check

- **Severity repeatability:** score computation can be exact, but rubric inputs are still reviewer judgments. Persisting raw inputs and having the Fixer re-evaluate them makes disagreements visible.
- **Model routing:** capability labels age as models and providers change. Catalog entries need explicit ownership and availability checks; model names alone are not a stable capability signal.
- **Hardness judgment:** the Reviewer requests a tier, but the extension should record it rather than treating it as objective truth. The Fixer can dispute the classification in its disposition.
- **Host-network risk:** disposable worktree isolation protects the Fixer checkout, not external services. Allowed commands retain host network access by explicit choice, so command policy and credential stripping are mandatory.
- **Completion contract:** reviewer execution uses a disposable worktree and structured allowlisted command runner with host network. Origin freshness, rebase recovery, checkpoints, auto-resume, cleanup, catalog routing, and the local-only GitHub boundary are fixed.

## Brainstorm notes

- Initial input calls for separate reviewer contexts, progress updates through existing SDK wrappers, editable persona/temperature Markdown, appended or replacement context, durable non-prescriptive findings, reproduction guidance, and repeatable criticality ratings.
- User-goal decision: the extension owns the full review loop rather than stopping at a review handoff.
- Target decision: primary and linked checkouts both run in place on their current branch. Branch prompting and worktree creation apply only when the command has a repository target but no current checkout.
- Role configuration requirement: provider/model must be independently selectable for each role, with optional finer selection per reviewer persona.
- Role-topology decision: two runtime roles only. `Fixer` owns independent verification before editing; a fresh `Reviewer` performs the re-review.
- Persona decision: exactly one selected Markdown persona per review pass; no persona panel or automatic specialist fan-out.
- Persona portability clarification: each persona has a default model/temperature, including provider/model-specific personas, but users may assign any available model.
- Dynamic routing requirement: each finding carries fix hardness; the extension chooses a different capable Fixer model when available using an ordered model catalog.
- Model-catalog decision: hybrid — editable per-model Markdown supplies capability/priority, OMP runtime availability filters candidates, and `modelRoles` is fallback only.
- Fixer-assignment decision: one Fixer per review pass, selected at the maximum hardness among its blocking findings.
- Prompt-replacement decision: replace editable reviewer guidance and persona only; always preserve the invariant loop/output/severity envelope.
- Loop-limit decision: medium/high/critical findings block; advisory/low remain report-only; maximum three Reviewer passes total.
- Current-wrapper gaps: `runOmpModelSession` supports model overrides and activity events but has no temperature option, and its default agent id is still `b-save-improved`-specific.
- Model-catalog schema decision: exact provider/model selectors are separate entries; `family` prevents false independence across providers; capability is the highest approved Fixer hardness; supported thinking levels, priority, enablement, calibration source, and review date remain explicit.
- Initial capability decision: hard = GLM-5.3, GPT-5.6-Sol, Grok 4.6, Claude Opus 5, and Kimi K3; medium = GPT-5.6-Terra, Claude Sonnet 5, GLM-5.3-Flash, Muse Spark 1.3, and Qwen3.7 Plus; easy = GPT-5.6-Luna and MiniMax M3.
- Provider/model persona decision: seed neutral launchers for Terra, GLM-5.3, Sonnet 5, Grok 4.6, and Kimi K3 at `:high` and temperature `0.2`; keep the bodies evidence-first and equivalent until calibration supports model-specific adaptations.
- GitHub boundary decision: local loop only; no PR discovery, feedback ingestion, review submission, comments, or merge behavior.
- Worktree-ownership decision: treat every existing non-bare checkout as a usable worktree; never create a duplicate checkout for a branch already owned elsewhere.
- Base decision: fetch the detected default branch from `origin` before reviewing and compare against that exact fetched state; never fall back to a stale local base.
- Commit decision: after each Fixer pass, run the deterministic check contract and create a checkpoint commit only on success.
- Base-integration decision: automatically rebase onto the freshly fetched `origin/<base>` before the first review, preserving tracked work with autostash semantics.
- Rebase-conflict decision: assign a hard-capability Fixer; if deterministic continuation still fails, abort and restore the pre-run state.
- Dirty-tree decision: checkpoint the complete reviewed starting state after rebasing so later pass commits contain only Fixer deltas.
- Untracked-file decision: prompt once before the initial checkpoint, display every non-ignored path with all selected by default, and review/commit only the chosen scope.
- Artifact decision: immutable per-pass Markdown/JSON and resumable state live under the common git directory; every terminal outcome gets one modest final report in `.context/`.
- Resume decision: automatically resume the newest matching run only after `HEAD`/worktree/state validation; reconstruct fresh model sessions from artifacts.
- Cleanup decision: on clean, commit the final `.context/` report and remove only an extension-created clean worktree. Retain non-clean worktrees and all runtime state for resume; prune runtime only explicitly.
- Reviewer-safety decision: each pass uses a disposable detached worktree and a structured `review_exec` policy; no edit/write/general bash tools and no unrestricted fallback.
- Review-command decision: allow deterministic contract commands, read-only Git, and extension-policy entries; use host network with a sanitized credential-free environment and record the exposure.
- Reproduction-evidence decision: persist normalized command/result records; `reproduced` requires a cited record and observed failure signal, while the Fixer independently verifies it.
- Relevant shipped seams: `extensions/omp-models.ts` for OMP model/session resolution and `extensions/extension-activity.ts` for bounded live activity.
- Existing review prior art: `code-review-universal` already distinguishes review critique from `b-review`, writes durable `.context/` reports, and reuses PR context/submission scripts.
- Architecture warning from prior work: isolated `createAgentSession()` supports independent history, model, tools, events, abort, and dispose; opaque extension orchestration (`b-flow`) was later deprecated. The new design needs a visibly bounded command, not a revived general workflow engine.
