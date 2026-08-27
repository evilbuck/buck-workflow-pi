# Research Memory Index

## High-Value Sources
- Semgrep official docs for rule syntax and custom rule capabilities: https://semgrep.dev/docs/writing-rules/rule-syntax
- Reek official repository for Ruby code-smell detection: https://github.com/troessner/reek
- SonarSource eslint-plugin-sonarjs repository/docs for JS/TS complexity and suspicious-pattern rules: https://github.com/SonarSource/eslint-plugin-sonarjs
- Pylint RefactoringCatalog (R-codes) for Python structural smells: https://pylint.readthedocs.io/
- golangci-lint linters docs (gocyclo, dupl, deadcode) for Go: https://golangci-lint.run/docs/linters/
- clang-tidy official docs for C/C++ function-size and cognitive-complexity checks: https://clang.llvm.org/extra/clang-tidy/
- PHPMD official site for PHP code-smell and complexity detection: https://phpmd.org/
- cargo clippy lint index for Rust complexity/perf/pedantic groups: https://doc.rust-lang.org/stable/clippy/lints.html

## Source Quality Heuristics
- For static-analysis pipeline design, prefer official tool docs and repositories over comparison blog posts.
- For code-smell detection, separate deterministic metric output from LLM judgment. Tool JSON is better as the audit input than raw source scans.

## Dead Ends & Anti-Patterns
- Avoid relying on LLM-only source scanning for mechanical smells; it wastes tokens and produces inconsistent thresholds.

## Vocabulary & Ontology
- Deterministic preflight: analyzer-first pass that emits structured findings before LLM review.
- Evidence gate: a smell candidate is only actionable when backed by tool output, metric, line location, or graph/reference count.
- Escalation rule: only ambiguous or semantic responsibility questions go to the LLM.
