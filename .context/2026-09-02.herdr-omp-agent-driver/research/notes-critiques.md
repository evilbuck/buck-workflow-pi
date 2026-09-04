---
status: draft
date: 2026-09-02
subject: 2026-09-02.herdr-omp-agent-driver
topics: [multi-agent, distillation, critique, boundary-conditions, llm-as-judge, mixture-of-agents, debate]
---

# Notes: critiques & boundary conditions for multi-agent response distillation

Scope: this note documents where the core combination methods break down, not how they work. The method pages (MoA, debate, LLM-as-judge, self-consistency/best-of-N) are owned by a sibling. Each finding is dated and cited; contradictions between sources are flagged rather than smoothed.

## 1. Self-MoA — quality vs diversity (Li et al. 2502.00674)

- Core claim: mixing *different* LLMs is frequently harmful. Self-MoA aggregates outputs from only the single best LLM (sampled multiple times) and **outperforms standard MoA** that mixes heterogeneous models.
- Numbers (dated 2025-02-02): +6.6% over MoA on AlpacaEval 2.0; avg +3.8% across MMLU, CRUX, MATH. Applying to a top AlpacaEval model reached new SOTA.
- Mechanism finding: MoA performance is *sensitive to quality*; mixing different LLMs lowers the average quality of the pool. Diversity alone does not pay for the quality drag.
- When mixing *does* help (identified scenarios): the paper does identify conditions where heterogeneous mixing helps — flagged here as the "boundary" the method page should not over-claim past.
- Sequential Self-MoA: aggregates a large number of outputs *on-the-fly* over multiple rounds; "as effective as aggregating all outputs at once." This is the cost/latency-relevant result — see §6.
- **Contradiction to flag:** original MoA (Wang et al. 2406.04692) explicitly motivates mixing diverse LLMs via "collaborativeness." Self-MoA directly contradicts the diversity thesis. Both can be true: MoA's gain may come from the *aggregator* (synthesis) step, not from diversity of proposers. `contested: true`.

## 2. Debate — structure vs intrinsic strength + diversity (Wu et al. 2511.07784)

- Controlled study on Knight–Knave–Spy logic puzzles (verifiable ground truth, step-wise evaluation).
- Six factors tested: team size, composition, confidence visibility, debate order, debate depth, task difficulty.
- Dominant drivers of debate success: **intrinsic reasoning strength** and **group diversity**. Structural parameters (order, confidence visibility) yield *limited gains*.
- Process findings: majority pressure suppresses independent correction; effective teams overturn incorrect consensus; rational/validity-aligned reasoning most strongly predicts improvement.
- Implication for Herdr: spend budget on *better models + diverse composition*, not on elaborate debate protocols (rounds/order/confidence signaling).

## 3. Debate failure modes (Wynn, Satija, Hadfield 2509.05396)

- Debate can be *harmful*: accuracy decreases over time — even when stronger models outnumber weaker ones.
- Mechanism: models shift from correct → incorrect in response to peer reasoning; they favor agreement over challenging flawed reasoning.
- Contributing factors tested: sycophancy, social conformity, model type, task type.
- Bottom line: "naive applications of debate may cause performance degradation when agents are neither incentivised nor adequately equipped to resist persuasive but incorrect reasoning."
- **Contradiction to flag:** MAD-positive papers claim debate improves reasoning; this paper shows monotonic degradation in heterogeneous-capability settings. Reconcilable reading: debate helps only when a *truth-seeking* incentive exists and agents can verify claims (cf. Knight–Knave ground truth in §2). Open-ended/consensus settings (like a Herdr pane) resemble the *harmful* regime more than the verify regime. `contested: true`.

## 4. Universal Self-Consistency (Chen et al. 2311.17311)

- Extends self-consistency (SC) beyond extractable answers to free-form generation.
- Standard SC relies on answer extraction (majority vote over short answers); USC replaces extraction with **an LLM that selects the most consistent candidate** from multiple samples.
- Results: on open-ended generation (summarization, open QA) USC *improves* performance where SC is inapplicable; on math it matches standard SC *without* requiring similar answer formats; on code it matches execution-based voting *without* running the code.
- Relevance: USC = the "LLM-as-aggregator/selector" pattern — same mechanism MoA and LLM-as-judge rely on. Its cost profile (N samples + 1 selector pass) is the *cheaper* analog to layered MoA.

## 5. Position bias in pairwise LLM-as-judge (Zheng 2306.05685; Wang 2305.17926)

- Zheng et al. (2306.05685) catalog judge biases: **position**, verbosity, self-enhancement, limited reasoning. GPT-4 as judge reaches >80% agreement with human preferences (≈ human–human agreement), so the bias does not erase judge utility — but it is real.
- Wang et al. (2305.17926) sharpen it: pairwise ranking can be *hacked* by reordering candidates — e.g. Vicuna-13B "beat" ChatGPT on 66/80 queries purely via order, with ChatGPT as the evaluator.
- Mitigations (Wang): (1) Multiple Evidence Calibration — judge generates evidence before rating; (2) **Balanced Position Calibration** — aggregate across both orders (swap + average); (3) Human-in-the-loop via a position-diversity entropy.
- Implication for Herdr: any SELECT (pick-a-winner) or pairwise-judge step MUST swap positions and average, else the "best answer" is partly an artifact of presentation order. LLM-as-judge is usable but not an unbiased oracle.

## 6. Cost / latency boundary

- Layered MoA is expensive: each layer runs the full proposer set + an aggregator pass; latency scales with depth × width.
- Multi-round debate is expensive: every round re-runs every agent with full history; worst case unbounded if no convergence check.
- Cheaper alternatives:
  - **Sequential Self-MoA** (Li 2502.00674): aggregates on-the-fly over rounds, "as effective as aggregating all outputs at once" — same quality, lower peak parallelism / memory, no full N×N layer recompute.
  - **Self-MoA (single best model, N samples)** vs heterogeneous MoA: fewer distinct model endpoints, one provider, N parallel samples + one aggregation pass.
  - **USC** (Chen 2311.17311): N samples + 1 LLM selection pass — no iterative layers, no cross-agent messaging.
- Herdr implication: consensus-not-locked + human watching means latency tolerance is high, but cost is real. Prefer USC / sequential Self-MoA over full layered MoA or deep debate unless quality delta is proven.

## Open questions for the method pages
- Does MoA's gain survive if the *aggregator* is fixed and only proposer diversity varies? (isolates diversity from aggregation quality — not answered cleanly by either MoA or Self-MoA)
- Is debate beneficial *only* under verifiable ground truth (Knight–Knave) and harmful under open consensus? (§2 vs §3 hinge on this)
