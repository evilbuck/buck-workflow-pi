---
status: active
date: 2026-09-02
subject: 2026-09-02.herdr-omp-agent-driver
topics: [multi-agent, distillation, consensus, mixture-of-agents, llm-as-judge, debate, self-consistency]
informs: []
---

# Research: combining multiple agent/model responses

**Question:** How do you distill several agent or model answers into one better combined response — especially for a visible Herdr-pane OMP plugin (human watches runners; consensus not locked)?

## Summary

There is no single “best ideas” method. Four families do different jobs. For this plugin, **the human watching the panes is the consensus mechanism**. Automate *collection and comparison*; do not lock an unaudited merge.

| Family | Operation | Canonical paper | Open-ended coding fit |
|---|---|---|---|
| **VERIFY** | Run candidates; keep what an executable checker accepts | AlphaCode, Li et al. 2022, [2203.07814](https://arxiv.org/abs/2203.07814) | **Best default here** — patches + `guardrails.json` |
| **SELECT** | Keep one complete answer (judge, vote, or human) | LLM-as-judge, Zheng 2023, [2306.05685](https://arxiv.org/abs/2306.05685) | Strong among survivors; swap pairwise order |
| **SYNTHESIZE** | Aggregator writes a *new* answer from proposals | MoA, Wang 2024, [2406.04692](https://arxiv.org/abs/2406.04692) | Use only with cited claims; can invent a middle ground nobody said |
| **DEBATE** | Multi-round critique toward a shared answer | Du 2023, [2305.14325](https://arxiv.org/abs/2305.14325) | Weak — serial, expensive; 2025 papers show it can *hurt* |
| **VOTE** | Majority / most-consistent among comparable answers | Self-consistency, Wang 2022, [2203.11171](https://arxiv.org/abs/2203.11171) | Poor — free-form answers do not string-match |

## Key findings


### VERIFY — execution-grounded selection (AlphaCode 2022)

Every method above scores **prose**. This repo's runners emit **patches**. AlphaCode (Li et al. 2022, arXiv:2203.07814) samples many programs, **filters by unit tests**, clusters the rest, then picks from large clusters. Generated tests + filtering cut false-positive “passes tests but is wrong” from 62% → 4% on their split. Same family as PRM/Best-of-N **when the verifier is executable**, not another LLM.

Local instance: `guardrails.json` (lint + unit/functional gates, 90% patch coverage). Cheapest high-signal aggregator for a Herdr coding driver: **run each runner's tree, drop failures, human or labeled digest among survivors.** Does not replace watching panes — it ranks what the human is looking at.

### Already decided in the vault (do not re-derive)

`10_Projects/OMP MoA Extension (decision & spec).md` (2026-07-05): **do not rebuild review** — `WATCHDOG.yml` + `syncBacklog: 1` already owns multi-model in-loop critique. Build **consultation** only: `/moa` one-shot fans out bare models and injects **per-model labeled opinions with no separate synthesis call** (disagreement must survive). Council mode = `context` event, `user_turn` only; skip `per_iteration`. Architecture note `30_Resources/OMP Multi-Agent Architecture (oh-my-pi).md` mechanism 2 is superseded by that spec.

This Herdr plugin is **not** that MoA extension. It is closer to mechanism 3a (drive *other* agents as visible panes) plus a supervisor control pane. Reuse `/moa`'s “no silent synthesizer” rule; do not fork a second in-process MoA.

### SYNTHESIZE — Mixture-of-Agents (Wang et al. 2024)

Layered proposers: each layer sees all previous outputs, then generates again. Open-source MoA: 65.1% AlpacaEval 2.0 vs GPT-4 Omni 57.5%. This is combine-not-pick — the user’s “orchestrator distills the best parts” candidate.

### Contested — Self-MoA (Li et al. 2025, [2502.00674](https://arxiv.org/abs/2502.00674))

Mixing *different* LLMs often **lowers** quality. Aggregating samples from the **single best** model beat mixed MoA by +6.6% AlpacaEval 2.0 / +3.8% avg (MMLU, CRUX, MATH). Quality of proposers dominates diversity. Sequential Self-MoA aggregates on-the-fly as well as all-at-once.

Reconciliation (untested): mixing helps only when every proposer is near aggregator quality. Do not assume N different models beats N samples of the strongest one. Specialized *roles* (reviewer vs implementer) are a different claim than random model mix.

### DEBATE — Du 2023, then 2025 critiques

Du: propose/debate over rounds; better math/factuality on black-box models.

Wu et al. 2025 ([2511.07784](https://arxiv.org/abs/2511.07784)): intrinsic strength + diversity beat debate *structure*.

Wynn et al. 2025 ([2509.05396](https://arxiv.org/abs/2509.05396)): debate can **degrade** accuracy; models flip correct→incorrect to agree (sycophancy). Helps under verifiable ground truth + truth-seeking incentive; harms under open consensus — closer to a Herdr pane.

ACL 2025 “Voting or Consensus?” ([2502.19130](https://arxiv.org/abs/2502.19130)): voting +13.2% on reasoning; consensus only +2.8% on knowledge; **more debate rounds hurt** (conformity).

### VOTE — Self-consistency (Wang 2022)

Sample diverse CoT; majority/marginalize. GSM8K +17.9% etc. Only when answers are comparable. Universal Self-Consistency ([2311.17311](https://arxiv.org/abs/2311.17311)): LLM picks the most consistent *free-form* candidate (N samples + one selector). Cheapest selector.

### SELECT — LLM-as-judge (Zheng 2023)

GPT-4 judge ~80% agreement with humans (≈ human–human). Pairwise > pointwise for preference. **Position bias is exploitable** (Wang 2023, [2305.17926](https://arxiv.org/abs/2305.17926): Vicuna-13B “beat” ChatGPT on 66/80 queries by order alone). Any pairwise step **must swap positions and average**.

### Frameworks (how products actually combine)

- **AutoGen GroupChat:** pick speaker → speak → broadcast. Combining is the summarizer (`last_msg` vs `reflection_with_llm`). `manual` speaker = human in the loop. Paper [2308.08155](https://arxiv.org/abs/2308.08155).
- **LangGraph supervisor:** handoff tools `transfer_to_<agent>`; default SELECT; `parallel_tool_calls` + `full_history` → SYNTHESIZE.
- **Anthropic orchestrator-workers:** dynamic decompose → workers → synthesize. Parallelization: sectioning (SYNTHESIZE) vs voting (SELECT).
- **LLM Council:** community name; medium confidence. OpenAI governing practices §5.4: correlated failures / monoculture — N similar agents can agree on the same wrong answer.
- **OMP `/moa` precedent:** one-shot skips a separate synthesis call and hands *labeled* opinions to the acting model so disagreement survives.

### Failure mode that matters here

An aggregator told to “merge” can write a moderate claim **no runner said**. Mitigate: SELECT/vote when you need one attributable answer; if synthesizing, **require citations to runner panes**; never let an unaudited merge sit between transcripts and the human.

## Recommendation for the Herdr OMP plugin

v1: **dispatch + visible transcripts. No locked consensus.**

If a combine step is added later:

1. **VERIFY first** when runners emit code: run `guardrails.json` / tests; drop failures. AlphaCode-shaped filter, not an LLM judge.
2. **Control pane = supervisor**: spawn/read runners via herdr CLI; human sees every pane.
3. **Default combine among survivors = labeled digest, not a verdict.** Closest to existing `/moa` one-shot (no extra synthesizer).
4. **Optional SELECT:** pairwise LLM-as-judge with position-swap, advisory; or the human picks.
5. **SYNTHESIZE only** when runners produced complementary slices, and the aggregator must quote pane ids.
6. **Do not default to VOTE** for coding/design. **Do not default to multi-round debate.**
7. **Runner quality floor:** same-role runners near-equal (Self-MoA). Different roles may use different models.
8. Do not rebuild OMP watchdogs or the `/moa` consultation extension as part of this plugin.

## Sources consulted

**Academic papers (high):** 2203.07814, 2406.04692, 2502.00674, 2305.14325, 2203.11171, 2306.05685, 2511.07784, 2509.05396, 2311.17311, 2305.17926, 2502.19130, 2308.08155

**Official docs (high):** AutoGen conversation-patterns; LangGraph supervisor; Anthropic Building Effective Agents; OpenAI Practices for Governing Agentic AI Systems

**Source dictionary types:** Academic/research papers; Official documentation; Source code/repos (OMP MoA spec, Hermes composition note, `guardrails.json`); Blog/GitHub council patterns (medium)

## Vault (written as we went)

Hub: `30_Resources/AI/Multi-Agent Response Distillation.md`

Raw papers: `40_Archives/Raw-Sources/papers/{wang-2024-mixture-of-agents,li-2025-self-moa,du-2023-multiagent-debate,wang-2022-self-consistency,zheng-2023-llm-as-judge}.md`

## Open questions (product, not methodology)

- Attach-only vs launch herdr session (CLI does not auto-create).
- Control pane = OMP TUI vs OMP-inside-a-herdr-pane.
- v1 combine: none vs labeled digest vs advisory judge.
