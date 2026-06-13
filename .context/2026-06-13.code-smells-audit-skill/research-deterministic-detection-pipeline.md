---
status: completed
date: 2026-06-13
subject: 2026-06-13.code-smells-audit-skill
topics: [code-smells, static-analysis, semgrep, reek, eslint, pylint, golangci-lint, clang-tidy, phpmd, clippy, gitnexus]
informs: []
---

# Research: Deterministic Detection Pipeline for Code Smells

## Objective
Evaluate whether the `code-smells` skill should add an analyzer-first preprocessing layer before LLM/subagent judgment.

## Key Findings
- Yes: analyzer-first detection would make the skill faster, cheaper, and more accurate by moving mechanical smell detection out of the LLM path.
- The current skill already requires evidence and mentions `ast_grep`, `search`, git history, LSP, and GitNexus, but it still instructs category subagents to scan source directly. A deterministic preflight would invert that: tools generate candidates first; agents judge and prioritize candidates.
- Semgrep is a strong cross-language substrate because official docs describe custom YAML rule syntax with multiple patterns, messages, metadata, and fixes. Source: https://semgrep.dev/docs/writing-rules/rule-syntax
- Reek is directly relevant for Ruby because its official repository describes it as a tool that examines Ruby classes, modules, and methods and reports code smells. Source: https://github.com/troessner/reek
- eslint-plugin-sonarjs is relevant for JS/TS because SonarSource documents ESLint rules for maintainability/suspicious patterns, including cognitive complexity. Source: https://github.com/SonarSource/eslint-plugin-sonarjs
- Pylint has a full RefactoringCatalog (R-codes: R1705 no-else-return, R1710 inconsistent-return-statements, etc.) that catches structural smells. Source: https://pylint.readthedocs.io/
- golangci-lint bundles gocyclo (cyclomatic complexity) and dupl (duplicate code via suffix-tree on serialized ASTs). Source: https://golangci-lint.run/docs/linters/
- clang-tidy has readability-function-size and readability-function-cognitive-complexity checks; cppcheck complements for value-flow bugs; CPD handles duplication. Source: https://clang.llvm.org/extra/clang-tidy/
- PHPMD (PHP Mess Detector) detects cyclomatic complexity, unused code, duplicated blocks; PHP_CodeSniffer handles standard violations. Source: https://phpmd.org/
- cargo clippy has a complexity lint group covering needlessly complex code, plus perf, pedantic, and nursery groups (550+ lints). Source: https://doc.rust-lang.org/stable/clippy/lints.html

## Incremental Discovery Log

### Current skill inspection
- **Action:** Read `skills/code-smells/SKILL.md` lines 31-240.
- **Discovery:** Current workflow fans out by category and asks each agent to apply heuristics directly against code. It requires evidence, but does not define a tool-generated candidate schema or analyzer preflight stage.
- **Source:** `skills/code-smells/SKILL.md:31-64`, `116-134`.
- **Next Step:** Add an optional/required Tier 0 preflight that emits candidates consumed by agents.

### Tool validation
- **Action:** Checked official/public sources for Semgrep, Reek, and eslint-plugin-sonarjs.
- **Discovery:** These tools map well to deterministic smell candidates: Semgrep for multi-language patterns, Reek for Ruby smells, SonarJS/ESLint for JS/TS complexity and suspicious constructs.
- **Sources:**
  - Semgrep rule syntax: https://semgrep.dev/docs/writing-rules/rule-syntax
  - Reek: https://github.com/troessner/reek
  - SonarJS ESLint plugin: https://github.com/SonarSource/eslint-plugin-sonarjs
- **Next Step:** Recommend a three-stage pipeline: analyzer preflight → graph/history enrichment → LLM adjudication.


### Full language matrix validation
- **Action:** Checked official sources for Python, Go, C, PHP, Rust analyzers.
- **Discovery:** Every language in the user's stack has deterministic coverage:

| Language | Primary analyzer(s) | Smell coverage | Source |
|---|---|---|---|
| **Ruby** | Reek, RuboCop, Flog/Flay, Brakeman | Long Method, Feature Envy, Data Clumps, Duplication, complexity, security | https://github.com/troessner/reek |
| **JS/TS** | ESLint + eslint-plugin-sonarjs | Cognitive complexity, duplicate branches, collapsible conditionals, suspicious patterns | https://github.com/SonarSource/eslint-plugin-sonarjs |
| **Python** | Pylint (RefactoringCatalog), Radon | Cyclomatic complexity, no-else-return, inconsistent returns, maintainability index | https://pylint.readthedocs.io/ |
| **Go** | golangci-lint (gocyclo, dupl, deadcode) | Cyclomatic complexity, duplication, dead code | https://golangci-lint.run/docs/linters/ |
| **C/C++** | clang-tidy, cppcheck, CPD | Function size, cognitive complexity, modernization, value-flow bugs, duplication | https://clang.llvm.org/extra/clang-tidy/ |
| **PHP** | PHPMD, PHP_CodeSniffer | Cyclomatic complexity, unused code, duplicated blocks, standard violations | https://phpmd.org/ |
| **Rust** | cargo clippy (complexity group) | Needlessly complex code, perf, pedantic, dead code (550+ lints) | https://doc.rust-lang.org/stable/clippy/lints.html |
| **All** | Semgrep (custom YAML) | Cross-language structural patterns | https://semgrep.dev/docs/writing-rules/rule-syntax |

- **Source:** Official docs above.
- **Next Step:** The skill should carry a language→analyzer registry so the preflight picks the right tool per detected language.
## Proposed Skill Delta

### Add `0. Deterministic preflight`
Before category subagents run:
1. Detect languages and installed analyzers.
2. Run available analyzers with JSON output when possible.
3. Normalize all outputs into `candidate` records.
4. Enrich candidates with churn, reference count, and graph data.
5. Send only candidates plus minimal snippets to subagents.

### Candidate schema
```json
{
  "tool": "semgrep|reek|rubocop|flog|flay|eslint|sonarjs|pylint|radon|golangci-lint|gocyclo|dupl|clang-tidy|cppcheck|cpd|phpmd|phpcs|clippy|gitnexus|custom-ast",
  "rule_id": "string",
  "smell": "Long Method|Duplicate Code|Feature Envy|...",
  "category": "Bloaters|OO Abusers|Change Preventers|Dispensables|Couplers",
  "location": "path:line[:column]",
  "metric": { "name": "cognitive_complexity", "value": 42, "threshold": 15 },
  "evidence": "raw tool output or concise excerpt",
  "confidence": "high|medium|low",
  "needs_llm": true
}
```

### Escalation rules
- Do not send high-confidence mechanical findings to the LLM for rediscovery. Send them for grouping, impact, and remediation wording only.
- Send low-confidence or semantic smells to the LLM: Feature Envy, Inappropriate Intimacy, Alternative Classes with Different Interfaces, Speculative Generality, naming/responsibility questions.
- Keep raw source reads demand-driven: read only the snippets needed to validate candidates.

## Recommendation
Update the skill. The improvement is material because it reduces token spend, gives repeatable thresholds, and produces stronger evidence for the final buck-workflow report.
