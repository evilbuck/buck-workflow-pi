---
status: draft
date: 2026-09-02
subject: 2026-09-02.herdr-omp-agent-driver
topics: [multi-agent, supervisor, group-chat, orchestrator-workers]
---

# Sources: supervisor / aggregator / group-chat frameworks

Access date: 2026-09-02

## Official docs (high confidence)
- AutoGen Conversation Patterns (0.2) — GroupChat / GroupChatManager, speaker-selection strategies, summarizer
  - https://microsoft.github.io/autogen/0.2/docs/tutorial/conversation-patterns/
- LangGraph Supervisor — `create_supervisor()` reference (handoff tools, `parallel_tool_calls`, `output_mode`, hooks)
  - https://reference.langchain.com/python/langgraph-supervisor
  - https://reference.langchain.com/python/langgraph-supervisor/supervisor/create_supervisor
- LangChain: Build a personal assistant with subagents (supervisor pattern tutorial)
  - https://docs.langchain.com/oss/python/langchain/multi-agent/subagents-personal-assistant
- Anthropic: Building Effective Agents (orchestrator-workers, parallelization sectioning/voting, evaluator-optimizer, routing)
  - https://www.anthropic.com/engineering/building-effective-agents
- OpenAI: Practices for Governing Agentic AI Systems (PDF) — §4.5 Automatic Monitoring, §5.4 Correlated failures / algorithmic monoculture
  - https://cdn.openai.com/papers/practices-for-governing-agentic-ai-systems.pdf

## Papers (high confidence)
- AutoGen: Enabling Next-Gen LLM Applications via Multi-Agent Conversation — arXiv:2308.08155
  - https://arxiv.org/abs/2308.08155
- Voting or Consensus? Decision-Making in Multi-Agent Debate — arXiv:2502.19130 (ACL 2025 Findings); voting vs consensus, conformity effect
  - https://arxiv.org/abs/2502.19130

## Community / secondary (medium confidence)
- MindStudio — "Multi-Model AI Agent Councils: Do Multiple LLMs Give Better Answers Than One?" (blog)
  - https://www.mindstudio.ai/blog/multi-model-ai-agent-council
- `focuslead/ai-council-framework` (GitHub — structured debate, consensus synthesis, bias reduction)
  - https://github.com/focuslead/ai-council-framework
- `seanpixel/council-of-ai` (GitHub — council of AIs with veto system)
  - https://github.com/seanpixel/council-of-ai
- "12 Angry AI Agents" — arXiv:2605.01986 (cinematic jury deliberation, conformity pressure; not independently verified)
  - https://arxiv.org/abs/2605.01986
