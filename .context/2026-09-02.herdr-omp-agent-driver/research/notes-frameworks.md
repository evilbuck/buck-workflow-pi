---
status: draft
date: 2026-09-02
subject: 2026-09-02.herdr-omp-agent-driver
topics: [multi-agent, supervisor, group-chat, orchestrator-workers, consensus, fan-out]
---

# Notes: supervisor / aggregator / group-chat frameworks

Research question: how do the major multi-agent *frameworks* and vendor patterns combine several agent outputs into one answer — and which fit a visible Herdr-pane OMP driver (human watches runner panes; consensus not locked)?

Scope note: academic MoA / distillation papers live in the sibling note `notes-multi-agent-distillation.md`. This note is official-docs + framework patterns only.

## Session log

### Taxonomy: three combination moves
- **SELECT** — pick one answer as winner (vote count, or an LLM judge). Attributable; no new claims.
- **SYNTHESIZE** — merge N answers into a new one via a designated aggregator/orchestrator. Richer; can invent claims nobody authored.
- **DYNAMIC SPEAKER / DEBATE** — iteratively choose who speaks next until convergence. SELECT applied mid-conversation; superset of both.

### AutoGen GroupChat / GroupChatManager (dynamic speaker selection)
- `GroupChat` (N agents + message list) + `GroupChatManager` loop: pick speaker → agent speaks → broadcast to all → repeat until stop/`max_round`.
- Next-speaker strategies: `round_robin`, `random`, `manual` (human), `auto` (default — manager's LLM picks).
- `allowed_or_disallowed_speaker_transitions` = speaker-transition graph → deterministic workflow (basis of StateFlow).
- `send_introductions=True` broadcasts name+description pre-chat.
- Combining = the **summarizer**: `summary_method` `last_msg` (default, SELECT-ish) vs `reflection_with_llm` (SYNTHESIZE). Paper (arXiv:2308.08155) frames AutoGen as generic multi-agent conversation infra.
- Herdr fit: "who speaks next" = "which runner pane gets the prompt next"; broadcast transcript = the visible log; `manual` = human-in-the-loop speaker picker.

### LangGraph supervisor (routing + optional synthesis)
- `create_supervisor()`: central supervisor LLM routes to N subagents (compiled graphs) via handoff tools `transfer_to_<agent>`.
- Default = SELECT (hand off to one specialist, `last_message` returned).
- `parallel_tool_calls=True` (OpenAI/Anthropic) → fan out to multiple subagents at once, read N results back, synthesize.
- `output_mode`: `last_message` (SELECT) vs `full_history` (SYNTHESIZE).
- `pre_model_hook`/`post_model_hook` (trim/summarize, human-in-loop/guardrails); `response_format` (structured final answer via `with_structured_output`).
- Herdr fit: supervisor = control pane, subagents = runner panes; handoff tool = "control pane prompts runner N"; `parallel_tool_calls` = visible fan-out.

### Anthropic orchestrator-workers + parallelization
- *Building Effective Agents* (Dec 2024). Orchestrator **dynamically** decomposes → delegates → **synthesizes** (SYNTHESIZE; subtasks not predefined).
- Parallelization: **Sectioning** (SYNTHESIZE — independent subtasks, aggregate) vs **Voting** (SELECT — same task N times, pick/threshold).
- Also: **evaluator-optimizer** (generate + critique loop), **routing** (classify → specialized follow-up; SELECT at entry).
- Caveat banner on the post: tooling changed since Dec 2024; see Managed Agents for current approach.
- Herdr fit: orchestrator-workers = control pane + runner panes; sectioning = one question per pane; voting = N panes answer the same question.

### LLM Council / practical ensembles (medium confidence)
- Community name for voting/deliberating ensembles (MindStudio, `focuslead/ai-council-framework`, `seanpixel/council-of-ai`). Blog/GitHub — medium confidence.
- Primary anchors: OpenAI *Practices for Governing Agentic AI Systems* §4.5 "Automatic Monitoring" (AI-monitors-AI = watchdog council, not voting) and §5.4 "Correlated failures"/"algorithmic monoculture".
- Empirical voting-vs-consensus: arXiv:2502.19130 (ACL 2025 Findings) — voting +13.2% reasoning, consensus +2.8% knowledge; more agents help, more debate rounds *hurt* (conformity).

### Failure mode — aggregator invents a middle ground
- An aggregator asked to "merge" divergent answers can produce a **compromise no agent said** — a new moderate claim that looks like consensus, authored by nobody.
- Mechanism 1 (conformity): consensus protocols reduce answer diversity; more debate rounds lower performance (arXiv:2502.19130).
- Mechanism 2 (correlated failure): N agents sharing model family/data agree on the same wrong answer; "N models agree" is less reassuring than it looks (OpenAI §5.4).
- Mitigations: prefer SELECT/voting for attribution; instruct SYNTHESIZE to *surface* disagreement, not dissolve it; human-in-loop for irreversible actions (OpenAI §4.2); count votes with thresholds rather than averaging prose.
- omp precedent: `/moa` one-shot skips a separate synthesis call and hands per-model-labeled opinions to the acting model, preserving the disagreement signal (`OMP MoA Extension (decision & spec)`).

### Herdr recommendation (draft)
- Default = **SELECT** with synthesis kept as a *labeled digest*, not a locked verdict — the human watching the panes is the real consensus mechanism.
- Never let an un-audited SYNTHESIZE stand between runner outputs and the pane the human reads.
