---
status: draft
date: 2026-09-02
subject: 2026-09-02.herdr-omp-agent-driver
topics: [multi-agent, distillation, critique, sources]
---

# Sources: critiques & boundary conditions

Access date: 2026-09-02. All primary (arXiv) unless noted. Confidence high for papers, medium for the cost/latency synthesis in notes (derived from the papers, not a single measured benchmark).

## Papers

1. Li, W., Lin, Y., Xia, M., Chi, J. — *Rethinking Mixture-of-Agents: Is Mixing Different Large Language Models Beneficial?* (Self-MoA). arXiv:2502.00674 (2025-02-02). https://arxiv.org/abs/2502.00674
2. Wu, H., Li, Z., Li, L. — *Can LLM Agents Really Debate? A Controlled Study of Multi-Agent Debate in Logical Reasoning*. arXiv:2511.07784 (2025-11-11). https://arxiv.org/abs/2511.07784
3. Wynn, A., Satija, H., Hadfield, G. — *Talk Isn't Always Cheap: Understanding Failure Modes in Multi-Agent Debate*. arXiv:2509.05396 (2025-09-05, v2 2025-10-13). ICML MAS Workshop 2025. https://arxiv.org/abs/2509.05396
4. Chen, X., Aksitov, R., Alon, U., Ren, J., Xiao, K., Yin, P., Prakash, S., Sutton, C., Wang, X., Zhou, D. — *Universal Self-Consistency for Large Language Model Generation*. arXiv:2311.17311 (2023-11-29). https://arxiv.org/abs/2311.17311
5. Zheng, L., Chiang, W.-L., Sheng, Y., Zhuang, S., Wu, Z., Zhuang, Y., Lin, Z., Li, Z., Li, D., Xing, E. P., Zhang, H., Gonzalez, J. E., Stoica, I. — *Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena*. arXiv:2306.05685 (2023-06-09, v4 2023-12-24). NeurIPS 2023 Datasets & Benchmarks. https://arxiv.org/abs/2306.05685
6. Wang, P., Li, L., Chen, L., Cai, Z., Zhu, D., Lin, B., Cao, Y., Liu, Q., Liu, T., Sui, Z. — *Large Language Models are not Fair Evaluators*. arXiv:2305.17926 (2023-05-29, v2 2023-08-30). https://arxiv.org/abs/2305.17926
7. Wang, J., Wang, J., Athiwaratkun, B., Zhang, C., Zou, J. — *Mixture-of-Agents Enhances Large Language Model Capabilities* (original MoA). arXiv:2406.04692 (2024). https://arxiv.org/abs/2406.04692 — cited for the *diversity/collaborativeness* thesis that Self-MoA (#1) contradicts; abstract-level only.

## Notes on provenance

- #1, #2, #3, #5, #6 read from arXiv abstracts/metadata directly (2026-09-02). #3 also read via HTML landing page (full abstract + author list + workshop venue).
- #4 read via abstract/metadata.
- #7 is the original MoA paper; I cite its central thesis (mixing diverse LLMs helps) as the counter-position to Self-MoA. Its exact numbers are not restated here — the method page for [[Mixture of Agents]] owns them.
- Cost/latency claims in notes §6 are *synthesis* from the papers' stated architectures (layered MoA, multi-round debate, sequential Self-MoA, USC's N-samples + selector), not an independent benchmark. Treat as medium confidence.
