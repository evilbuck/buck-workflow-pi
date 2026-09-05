---
status: draft
date: 2026-09-02
subject: 2026-09-02.herdr-omp-agent-driver
topics: [multi-agent, distillation, consensus, llm-as-judge, mixture-of-agents]
---

# Notes: multi-agent / multi-model response distillation

Research question: which methodologies exist for combining several agent or model responses into a better single answer — and which fit a visible Herdr-pane OMP driver (human can watch; consensus not locked)?

Source types selected (research-source-dictionary): Academic/research papers; Official documentation (multi-agent frameworks); Source code/repos; Blog/engineering articles as secondary.

## Session log

### Mixture of Agents (SYNTHESIZE) — confidence: high

- Wang et al. 2024 (arXiv:2406.04692). Layered architecture: each layer holds several LLM agents; each agent in layer *k* takes all outputs from layer *k-1* as auxiliary context. Final layer = single aggregator that *synthesizes* a new answer from the previous layer's outputs — combine-not-just-pick.
- AlpacaEval 2.0: **65.1%** vs GPT-4 Omni 57.5%, using only open-source models; also SOTA on MT-Bench and FLASK.
- Cost/latency scale with fan-out (N proposers × L layers before one aggregator call); proposers are bare text generators, only the aggregator acts. Append proposals at the *end* of the aggregator prompt to keep the KV prefix stable.

### Self-MoA (counterpoint to MoA) — confidence: high

- Li et al. 2025 (arXiv:2502.00674). Asks: is mixing *different* LLMs actually beneficial? Answer: often no.
- Self-MoA = ensemble outputs from only the single top-performing model (multiple samples). Beats standard MoA: **+6.6%** on AlpacaEval 2.0, **+3.8%** average across MMLU/CRUX/MATH.
- Finding: MoA is sensitive to *quality*, not diversity; mixing strong + weak lowers the average output quality. Quality > diversity. Sequential Self-MoA aggregates many outputs on-the-fly over rounds, matching one-shot.
- **Contradiction flag:** Wang says mixing models helps; Li says mixing often lowers quality. Reconciliation: mixing helps only when every proposer ≈ aggregator quality; otherwise single-model sampling (VOTE) wins.

### Multi-Agent Debate (DEBATE) — confidence: high

- Du et al. 2023 (arXiv:2305.14325). Multiple instances propose, read each other's reasoning, critique, and revise over multiple rounds to a common answer. No aggregator, no judge — consensus emerges from mutual pressure.
- Improves math/strategic reasoning and factuality (reduces hallucination); works on black-box models with identical procedure/prompts across tasks.
- Inherently **serial** (N × R round-trips); poor fit for a watch-as-they-run parallel pane driver; good for single-question factual/reasoning convergence.

### Self-Consistency / Best-of-N (VOTE) — confidence: high

- Wang et al. 2022 (arXiv:2203.11171). Replace greedy decoding: sample N diverse CoT paths (temperature sampling), majority-vote / marginalize the final answer.
- Gains: GSM8K +17.9%, SVAMP +11.0%, AQuA +12.2%, StrategyQA +6.4%, ARC-challenge +3.9% — single model, no judge, no aggregator.
- **Limitation:** only works when answers are *comparable* (same finite answer space); open-ended generation breaks majority vote. Best-of-N = generalize the scorer (reward model / judge / verifier).

### LLM-as-a-Judge (SELECT) — confidence: high

- Zheng et al. 2023 (arXiv:2306.05685). Strong LLM judge approximates human preference; GPT-4 judge matches controlled + crowdsourced human preference at **>80% agreement** (same as human-human).
- Two modes: pointwise (rubric grade one answer) vs pairwise (which of two is better; quadratic in N, but better for ranking).
- Biases + mitigations: position bias (swap positions), verbosity bias (length-control prompt), self-enhancement bias (judge from a different family); limited reasoning ability caps judge reliability.

### Hub mapping to Herdr driver — confidence: medium (design recommendation)

- Families: SELECT (judge picks), SYNTHESIZE (aggregator writes new), DEBATE (iterate to consensus), VOTE (majority over comparable answers).
- Herdr = visible control-pane + N runner panes, human watches, consensus optional. Rewards parallel + observable + independent runners; consensus advisory.
- Default: **VOTE** (cheap, parallel, watchable; low ceiling on open-ended). Lock-in when a pick is wanted: **SELECT** (judge, advisory because human watches, position-swap to fix bias). Quality ceiling with near-equal runners: **SYNTHESIZE**. Worst structural fit: **DEBATE** (serial round-trips stall the pane view).
- Practical rule: match runner quality before trusting SYNTHESIZE; when in doubt, VOTE one strong runner.
