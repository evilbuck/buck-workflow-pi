# Anthropic denoise output style

The active prompt is [`skills/anthropic-svn/SKILL.md`](skills/anthropic-svn/SKILL.md), from **Contract** through **Examples**. Edit it there: the skill and exported harness output style share that single source of truth.

The contract targets concise replies from Opus and Sonnet, with Haiku also supported by the skill's model trigger. It specifies result-first answers, a soft length default, decision-relevant caveats, evidence-backed verification, and three response examples. Requested depth and format take precedence; brevity does not reduce engineering or safety requirements.

The skill description asks compatible harnesses to load it when Claude is the running model. This is model-invoked discovery, not a guaranteed per-turn hook. Invoke `/skill:anthropic-svn` explicitly if it is missed.

For Claude Code, OpenCode, or Pi installation, use [`references/install.md`](skills/anthropic-svn/references/install.md). It exports the same contract without skill metadata or installation instructions. Claude Code exports retain `keep-coding-instructions: true`.

This file is an overview, not a second system prompt. Updating the skill does not update previously exported copies; re-export them using the installation reference.
