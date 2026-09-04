---
status: draft
date: 2026-09-02
subject: 2026-09-02.herdr-omp-agent-driver
topics: [multi-agent, distillation, consensus]
---

# Sources: multi-agent / multi-model response distillation

Access date: 2026-09-02

## Wang et al. 2024 — Mixture-of-Agents (MoA)
- URL: https://arxiv.org/abs/2406.04692
- Accessed: 2026-09-02
- "we construct a layered MoA architecture wherein each layer comprises multiple LLM agents. Each agent takes all the outputs from agents in the previous layer as auxiliary information in generating its response."
- "our MoA using only open-source LLMs is the leader of AlpacaEval 2.0 by a substantial gap, achieving a score of 65.1% compared to 57.5% by GPT-4 Omni."

## Li et al. 2025 — Self-MoA
- URL: https://arxiv.org/abs/2502.00674
- Accessed: 2026-09-02
- "is mixing different LLMs truly beneficial? We propose Self-MoA -- an ensemble method that aggregates outputs from only the single top-performing LLM."
- "Self-MoA achieves 6.6% improvement over MoA on the AlpacaEval 2.0 benchmark, and an average of 3.8% improvement across various benchmarks."
- "the MoA performance is rather sensitive to the quality, and mixing different LLMs often lowers the average quality of the models."

## Du et al. 2023 — Multiagent Debate
- URL: https://arxiv.org/abs/2305.14325
- Accessed: 2026-09-02
- "multiple language model instances propose and debate their individual responses and reasoning processes over multiple rounds to arrive at a common final answer."
- "this approach improves the factual validity of generated content, reducing fallacious answers and hallucinations."
- "such \"society of minds\" approach has the potential to significantly advance the capabilities of LLMs."

## Wang et al. 2022 — Self-Consistency
- URL: https://arxiv.org/abs/2203.11171
- Accessed: 2026-09-02
- "samples a diverse set of reasoning paths instead of only taking the greedy one, and then selects the most consistent answer by marginalizing out the sampled reasoning paths."
- "a complex reasoning problem typically admits multiple different ways of thinking leading to its unique correct answer."
- "boosts the performance of chain-of-thought prompting ... GSM8K (+17.9%), SVAMP (+11.0%), AQuA (+12.2%)."

## Zheng et al. 2023 — LLM-as-a-Judge
- URL: https://arxiv.org/abs/2306.05685
- Accessed: 2026-09-02
- "strong LLM judges like GPT-4 can match both controlled and crowdsourced human preferences well, achieving over 80% agreement, the same level of agreement between humans."
- "we examine the usage and limitations of LLM-as-a-judge, including position, verbosity, and self-enhancement biases."
- "LLM-as-a-judge is a scalable and explainable way to approximate human preferences."
