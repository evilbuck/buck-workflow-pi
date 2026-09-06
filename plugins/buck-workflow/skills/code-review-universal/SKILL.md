---
name: code-review-universal
description: |
  Provides comprehensive code review guidance for React 19, Vue 3, Angular 17+, Svelte 5,
  Rust, TypeScript, Java, Java 8, PHP, Ruby, Rails, Python, Django, FastAPI, Go, C#/.NET, Kotlin, Swift,
  NestJS, C/C++, Zig, CSS/Less/Sass, Qt, and more.
  Covers architecture review, performance review, security audit, code quality anti-patterns,
  and common bugs across all ecosystems.
  Reviews GitHub pull requests and posts one atomic review with severity-tagged inline
  comments via gh (reusing the code-review skill's pr-context/submit-review plumbing).
  Writes a durable review report artifact to .context/ per buck-workflow conventions.
  Use when: reviewing pull requests, conducting PR reviews, posting inline PR review comments
  on GitHub, self-reviewing a PR before requesting review, code review, reviewing code changes,
  establishing review standards, mentoring developers, architecture reviews, security audits,
  performance reviews, checking code quality, finding bugs, giving feedback on code.
---

# Code Review Skill

Transform code reviews from gatekeeping to knowledge sharing through constructive feedback, systematic analysis, and collaborative improvement.

## When to Use This Skill

- Reviewing pull requests and code changes
- Establishing code review standards for teams
- Mentoring junior developers through reviews
- Conducting architecture reviews
- Creating review checklists and guidelines
- Improving team collaboration
- Reducing code review cycle time
- Maintaining code quality standards

## Invocation Modes

Two modes, selected by the invocation argument:

| Argument | Mode | What happens |
|---|---|---|
| *(none)* | **Local diff** | Review uncommitted/branch changes (`git status`, `git diff`, `git diff --cached`) |
| path / glob / diff file | **Local diff** | Review the given target (e.g. `src/auth/`, `changes.patch`) |
| PR URL, `owner/repo#N`, or `#N` | **GitHub PR** | Full PR review, posted back to GitHub as one review with inline comments — see [GitHub PR Mode](#github-pr-mode-inline-comments) |

### Buck Workflow Integration

This skill is a **supporting reviewer**, not a workflow gate. It complements `b-review`; it does not replace it.

| Skill | Role |
|---|---|
| `b-review` | Workflow **gate** on your own work: verifies implementation against a plan/spec/phase acceptance contract, emits Pass/Needs-work verdicts, writes `iterate-*.md` for in-plan defects. |
| `code-review-universal` | **Code-quality reviewer** of any diff or PR (yours or a teammate's): language-depth checks, severity-tagged constructive feedback, GitHub posting. Never gates the workflow. |
| `code-review` | Brutally-honest tone variant; same PR plumbing, writes `CODE-REVIEW.md` at repo root. |
| `b-pr-review-2-issues` | Inverse direction: ingests comments **others** left on **your** PR and turns them into a plan. |

`b-review` MAY consult this skill's `reference/` guides for language-specific checks.

**Durable artifact (required):** every review writes a report to `.context/` — see [Output: The Review Report](#output-the-review-report).

**Subject resolution:** when invoked without arguments inside a buck-workflow session, follow the shared protocol at `skills/_shared/subject-resolution.md` and write the report into the resolved subject folder.

**Routing findings:**
- Review of **your own work** → small fixes route to `/b-iterate` (reference the review report); substantial rework routes to `/b-plan` (the report acts as a `research:` input).
- Review of **someone else's PR** → the posted GitHub review is the deliverable; no further workflow step.
- **Your PR received** review comments → `/b-pr-review-2-issues` ingests them into a plan. Posting your own self-review first is a valid way to seed that loop.

## Core Principles

### 1. The Review Mindset

**Goals of Code Review:**
- Catch bugs and edge cases
- Ensure code maintainability
- Share knowledge across team
- Enforce coding standards
- Improve design and architecture
- Build team culture

**Not the Goals:**
- Show off knowledge
- Nitpick formatting (use linters)
- Block progress unnecessarily
- Rewrite to your preference

### 2. Effective Feedback

**Good Feedback is:**
- Specific and actionable
- Educational, not judgmental
- Focused on the code, not the person
- Balanced (praise good work too)
- Prioritized (critical vs nice-to-have)

```markdown
❌ Bad: "This is wrong."
✅ Good: "This could cause a race condition when multiple users
         access simultaneously. Consider using a mutex here."

❌ Bad: "Why didn't you use X pattern?"
✅ Good: "Have you considered the Repository pattern? It would
         make this easier to test. Here's an example: [link]"

❌ Bad: "Rename this variable."
✅ Good: "[nit] Consider `userCount` instead of `uc` for
         clarity. Not blocking if you prefer to keep it."
```

### 3. Review Scope

**What to Review:**
- Logic correctness and edge cases
- Security vulnerabilities
- Performance implications
- Test coverage and quality
- Error handling
- Documentation and comments
- API design and naming
- Architectural fit

**What Not to Review Manually:**
- Code formatting (use Prettier, Black, etc.)
- Import organization
- Linting violations
- Simple typos

## Review Process

### Phase 1: Context Gathering (2-3 minutes)

Before diving into code, understand:
1. Read PR description and linked issue
2. Check PR size (>400 lines? Ask to split)
3. Review CI/CD status (tests passing?)
4. Understand the business requirement
5. Note any relevant architectural decisions

In **GitHub PR mode**, gather this with `gh`:

```bash
gh pr view <N> --json title,body,baseRefName,headRefName,headRefOid,files,reviews
gh pr checks <N>          # CI status
gh pr diff <N>            # full diff (or read pr.diff from pr-context.ts)
```

> For large diffs, pipe the diff through [`scripts/pr-analyzer.py`](scripts/pr-analyzer.py) (`git diff main...HEAD | python <skill_dir>/scripts/pr-analyzer.py`, or `gh pr diff <N> | python <skill_dir>/scripts/pr-analyzer.py`) to triage complexity and get a suggested review approach before reading.
> Resolve `<skill_dir>` to the directory containing this `SKILL.md` and use that absolute path.

### Phase 2: High-Level Review (5-10 minutes)

1. **Architecture & Design** - Does the solution fit the problem?
   - For significant changes, consult [Architecture Review Guide](reference/architecture-review-guide.md)
   - Check: SOLID principles, coupling/cohesion, anti-patterns
2. **Performance Assessment** - Are there performance concerns?
   - For performance-critical code, consult [Performance Review Guide](reference/performance-review-guide.md)
   - Check: Algorithm complexity, N+1 queries, memory usage
3. **File Organization** - Are new files in the right places?
4. **Testing Strategy** - Are there tests covering edge cases?

### Phase 3: Line-by-Line Review (10-20 minutes)

For each file, check:
- **Logic & Correctness** - Edge cases, off-by-one, null checks, race conditions
- **Security** - Input validation, injection risks, XSS, sensitive data
- **Performance** - N+1 queries, unnecessary loops, memory leaks
- **Maintainability** - Clear names, single responsibility, comments
- **Reuse** - Before accepting new code, search for existing utilities/helpers that could replace it. Check adjacent files and shared modules for similar patterns. See [Universal Quality Guide](reference/code-quality-universal.md) for anti-patterns like parameter sprawl, leaky abstractions, nested conditionals, stringly-typed code, TOCTOU, and no-op updates.

### Phase 4: Summary & Decision (2-3 minutes)

1. Summarize key concerns
2. Highlight what you liked
3. Make clear decision:
   - ✅ Approve
   - 💬 Comment (minor suggestions)
   - 🔄 Request Changes (must address)
4. Offer to pair if complex

## Output: The Review Report

Every review — both modes — writes a **durable report artifact** to `.context/` (buck-workflow persistent-artifact rule).

**Location:**
- **GitHub PR mode** → `.context/YYYY-MM-DD.<pr-number>-<kebab-title>/review-pr-<N>.md`. This is the same subject-folder convention `b-pr-review-2-issues` uses, so both skills share one folder per PR. If the folder already exists, write into it; otherwise create it with an `index.md` carrying `status: active`.
- **Local mode, subject resolved** → `<subject>/review-<slug>-YYYY-MM-DD.md` in the resolved subject folder.
- **Standalone local review** → `.context/YYYY-MM-DD.review-<slug>/review-<slug>-YYYY-MM-DD.md` with an `index.md` (`status: active`).

**Frontmatter:**

```yaml
---
status: draft | active | completed
date: YYYY-MM-DD
subject: YYYY-MM-DD.<subject-name>
topics: [code-review]
source_pr: <N>            # GitHub PR mode only
source_pr_url: <url>      # GitHub PR mode only
review_verdict: approve | comment | request-changes
review_url: <url>         # filled after posting
---
```

Lifecycle: `draft` while reviewing → `active` when delivered (posted to GitHub or handed off; findings open) → `completed` when findings are addressed or acknowledged.

**Body:**

```markdown
# Review: <target>

## Verdict
<Approve / Comment / Request Changes> — <one line>

## Summary
<2-3 sentences: what changed, overall quality>

## Strengths
- <what was done well>

## Findings
### 🔴 [blocking] <title> — `file:line`
<problem, failure scenario, suggested fix>
### 🟡 [important] <title> — `file:line`
### 🟢 [nit] <title> — `file:line`

## Posted
- GitHub review: <review_url> (<N> inline comments) · or "local only"

## Next Step
<`/b-iterate` · `/b-plan` · none — review delivered>
```

## GitHub PR Mode: Inline Comments

Full workflow for reviewing a GitHub PR and posting the result back as **one atomic review with severity-tagged inline comments**. Reuses the zero-dep plumbing from `skills/code-review/scripts/` — do not hand-roll a second posting mechanism.

**Prerequisites:** `gh` (authenticated), `git`, `bun` (for the plumbing scripts; raw fallback below if unavailable).

### Step 1 — Resolve PR context

```bash
bun <skill_dir>/../code-review/scripts/pr-context.ts <pr-url|owner/repo#N|#N|N>
```

Creates `.worktrees/pr-<N>/` containing:
- `pr-context.json` — owner, repo, `head_sha` (pinned commit), changed-file list
- `pr.diff` — the full base→head diff

### Step 2 — Review

Run the four-phase process against `pr.diff` inside the worktree. Triage large diffs first: `python <skill_dir>/scripts/pr-analyzer.py < .worktrees/pr-<N>/pr.diff`. Consult the language-specific guide for each file type touched.

### Step 3 — Write findings

Write two files into the worktree:

**`findings.json`** — one object per inline comment:

```json
[
  { "path": "src/auth.ts", "line": 42, "side": "RIGHT", "severity": "critical", "body": "🔴 **[blocking]** Token expiry is not checked.\n\nAn expired token passes validation…" }
]
```

| Field | Rule |
|---|---|
| `path` | Repo-relative; must be one of the PR's changed files (validated before posting) |
| `line` | ≥1. `RIGHT`: line number in the **new** file. `LEFT`: line number in the **old** file |
| `side` | Optional, default `RIGHT`. Use `LEFT` only to anchor on a removed line |
| `severity` | `critical` or `warning` — mapping below |
| `body` | Full markdown comment; keep the emoji + `[label]` prefix so nuance survives on GitHub |

Severity mapping (findings.json only has two tiers; your labels carry the detail):

| Your label | `severity` |
|---|---|
| 🔴 `[blocking]` | `critical` |
| 🟡 `[important]` · 🟢 `[nit]` · 💡 `[suggestion]` · 📚 `[learning]` · 🎉 `[praise]` | `warning` |

**`summary.md`** — the review body: verdict, strengths, themes, and anything that couldn't be anchored to a diff line (off-diff comments, cross-file concerns, praise for the overall approach).

### Step 4 — Dry run

```bash
bun <skill_dir>/../code-review/scripts/submit-review.ts --worktree .worktrees/pr-<N> --event <EVENT> --dry-run
```

Validates every finding against the PR's changed files and builds the exact payload. Fix all validation issues before posting.

### Step 5 — Post one atomic review

```bash
bun <skill_dir>/../code-review/scripts/submit-review.ts --worktree .worktrees/pr-<N> --event <EVENT>
```

One POST → one review → **one notification**, with `commit_id` pinned to the PR head. Never loop single-comment POSTs — that spams one notification per comment and can leave a half-posted review.

**Event mapping:**

| Outcome | `EVENT` |
|---|---|
| Any 🔴 blocking finding | `REQUEST_CHANGES` |
| Only 🟢/💡/📚/🎉 findings | `APPROVE` (or `COMMENT` if you don't formally approve) |
| Mixed or informational | `COMMENT` |
| Reviewing **your own** PR | `COMMENT` — GitHub rejects `APPROVE`/`REQUEST_CHANGES` on your own PR (422) |

### Step 6 — Record and clean up

Write the [review report](#output-the-review-report) to `.context/`, filling in `review_url` from the script's JSON output. Worktree removal is manual: `git worktree remove .worktrees/pr-<N>`.

### Inline-comment mechanics

- Comments can only anchor to lines **in the diff** (changed lines ± context). An off-diff line → 422 "line is not part of the diff" → re-anchor to a changed line or demote the point into `summary.md`.
- `side=RIGHT` (default): added/changed lines; `line` is the new-file line number.
- `side=LEFT`: removed lines; `line` is the old-file line number.
- Multi-line ranges are not supported by `submit-review.ts` — use the raw fallback below with `start_line`/`start_side`, or keep range-level comments in the summary.

### Raw gh fallback (no bun)

Verified payload construction (`-f` passes strings, `-F` types values):

```bash
gh api repos/{owner}/{repo}/pulls/<N>/reviews \
  -f event=REQUEST_CHANGES -f commit_id=<headRefOid> -f body="Summary…" \
  -f 'comments[][path]=src/auth.ts' -F 'comments[][line]=42' -f 'comments[][side]=RIGHT' -f 'comments[][body]=🔴 **[blocking]** …' \
  -f 'comments[][path]=src/util.ts' -F 'comments[][line]=7'  -f 'comments[][side]=RIGHT' -f 'comments[][body]=🟢 **[nit]** …'
```

- `line` **must** use `-F` — a string `"42"` is rejected: 422 "'properties/line', \"42\" is not a number".
- Start each comment's fields with `path` and keep them adjacent; when a key repeats, `gh` begins a new array element.
- Multi-line range: add `-F 'comments[][start_line]=40' -f 'comments[][start_side]=RIGHT'` inside the comment's block.

### Error handling

| Error | Cause / fix |
|---|---|
| 422 `"…" is not a number` | `line` sent as string — use `-F` (raw mode only) |
| 422 "line is not part of the diff" | Anchor line outside the diff hunks — re-anchor or demote to summary |
| 422 on `APPROVE`/`REQUEST_CHANGES` | You are the PR author — switch to `COMMENT` |
| `gh: command not found` / auth errors | Install gh / `gh auth login` |
| Validation issues from submit-review | `path` not in the PR's changed files, `line` < 1, or empty `body` — fix `findings.json` |

## Review Techniques

### Technique 1: The Checklist Method

Use checklists for consistent reviews. See [Security Review Guide](reference/security-review-guide.md) for comprehensive security checklist.

### Technique 2: The Question Approach

Instead of stating problems, ask questions:

```markdown
❌ "This will fail if the list is empty."
✅ "What happens if `items` is an empty array?"

❌ "You need error handling here."
✅ "How should this behave if the API call fails?"
```

### Technique 3: Suggest, Don't Command

Use collaborative language:

```markdown
❌ "You must change this to use async/await"
✅ "Suggestion: async/await might make this more readable. What do you think?"

❌ "Extract this into a function"
✅ "This logic appears in 3 places. Would it make sense to extract it?"
```

### Technique 4: Differentiate Severity

Use labels to indicate priority:

- 🔴 `[blocking]` - Must fix before merge
- 🟡 `[important]` - Should fix, discuss if disagree
- 🟢 `[nit]` - Nice to have, not blocking
- 💡 `[suggestion]` - Alternative approach to consider
- 📚 `[learning]` - Educational comment, no action needed
- 🎉 `[praise]` - Good work, keep it up!

**Severity levels:** 🔴 / 🟡 / 🟢 are the three severity tiers used as the standard across all guides in this skill — 🔴 blocks the merge, 🟡 should be addressed, 🟢 is optional. The remaining markers (💡 / 📚 / 🎉) are non-blocking annotations.

## Language-Specific Guides

Consult the detailed guide for the language under review:

| Language/Framework | Reference File | Key Topics |
|-------------------|----------------|------------|
| **React** | [React Guide](reference/react.md) | Hooks, useEffect, React 19 Actions, RSC, Suspense, TanStack Query v5 |
| **Vue 3** | [Vue Guide](reference/vue.md) | Composition API, 响应性系统, Props/Emits, Watchers, Composables |
| **Angular 17+** | [Angular Guide](reference/angular.md) | Signals, Standalone, RxJS, Zoneless, 模板优化, 测试, 路由守卫, HttpInterceptor |
| **Rust** | [Rust Guide](reference/rust.md) | 所有权/借用, Unsafe 审查, 异步代码, 取消安全性, 错误处理 |
| **TypeScript** | [TypeScript Guide](reference/typescript.md) | 类型安全, async/await, 不可变性, 测试, 模块解析, TS 5.x |
| **Python** | [Python Guide](reference/python.md) | 可变默认参数, 异常处理, 类属性 |
| **Django / DRF** | [Django Guide](reference/django.md) | 安全审查, N+1 查询, Serializer 反模式, ViewSet, 异步视图 |
| **FastAPI** | [FastAPI Guide](reference/fastapi.md) | Depends, Pydantic v2 validation, async correctness, sessions/N+1, auth vs authorization, test-driven verification |
| **Java** | [Java Guide](reference/java.md) | Java 17/21 新特性, Spring Boot 3, 虚拟线程, Stream/Optional |
| **Java 8 / Legacy** | [Java 8 Guide](reference/java8.md) | Java 8, Spring Boot 2, javax.*, Stream/Optional, java.time, CompletableFuture |
| **PHP** | [PHP Guide](reference/php.md) | PHP 8.x type system, PDO, security review, Composer, PHPUnit/PHPStan |
| **Ruby / Rails** | [Ruby Guide](reference/ruby.md) | Ruby semantics, Rails 8, Active Record, Active Job, security, testing |
| **C# / .NET** | [C# Guide](reference/csharp.md) | C# 12 特性, 异步编程, EF Core 性能, ASP.NET Core, LINQ |
| **Go** | [Go Guide](reference/go.md) | 错误处理, goroutine/channel, context, 接口设计 |
| **Kotlin / Android** | [Kotlin Guide](reference/kotlin.md) | 协程, Flow, Jetpack Compose, 空安全, 内存泄漏, 架构模式 |
| **Swift / SwiftUI** | [Swift Guide](reference/swift.md) | Optionals, Swift Concurrency, Sendable/actors, SwiftUI property wrappers, value vs reference types, API design |
| **NestJS** | [NestJS Guide](reference/nestjs.md) | 依赖注入, 分层架构, DTO 验证, Guard/Interceptor, 循环依赖 |
| **Svelte / SvelteKit** | [Svelte Guide](reference/svelte.md) | Runes, Load 函数, Form Actions, Store 迁移, SSR/CSR 边界 |
| **C** | [C Guide](reference/c.md) | 指针/缓冲区, 内存安全, UB, 安全编码, 可移植性, 测试 |
| **C++** | [C++ Guide](reference/cpp.md) | RAII, 智能指针, C++20/23, constexpr, 测试 |
| **Zig** | [Zig Guide](reference/zig.md) | Allocators, error unions, defer/errdefer, comptime, C interop |
| **CSS/Less/Sass** | [CSS Guide](reference/css-less-sass.md) | 变量规范, !important, 性能优化, 响应式, 兼容性 |
| **Qt** | [Qt Guide](reference/qt.md) | 对象模型, 信号/槽, Model/View, QML, Qt6 迁移, 测试 |

## Cross-Cutting Guides

Language-agnostic patterns applicable to all code reviews:

| Topic | Reference File | Key Topics |
|-------|----------------|------------|
| **Architecture Review** | [Architecture Review Guide](reference/architecture-review-guide.md) | SOLID, anti-patterns, coupling/cohesion, dependency direction |
| **Performance Review** | [Performance Review Guide](reference/performance-review-guide.md) | Web Vitals, N+1, algorithm complexity, memory leaks, caching |
| **Security Review** | [Security Review Guide](reference/security-review-guide.md) | SQLi, XSS, CSRF, SSRF, IDOR, 命令注入, 跨语言示例 |
| **Universal Quality** | [Universal Quality Guide](reference/code-quality-universal.md) | Reuse audit, parameter sprawl, leaky abstractions, nested conditionals, stringly-typed code, TOCTOU, no-op updates, redundant state |
| **Common Bugs** | [Common Bugs Checklist](reference/common-bugs-checklist.md) | Language-specific bug patterns, common pitfalls |
| **SQL Injection Prevention** | [SQL Injection Guide](reference/cross-cutting/sql-injection-prevention.md) | Parameterized queries, ORM safety, 6 languages, dynamic identifiers, detection |
| **XSS Prevention** | [XSS Prevention Guide](reference/cross-cutting/xss-prevention.md) | Output encoding, CSP, 5 frameworks, input validation vs encoding, detection |
| **N+1 Queries** | [N+1 Queries Guide](reference/cross-cutting/n-plus-one-queries.md) | Eager loading, batch fetching, DataLoader, 5 languages, detection |
| **Error Handling** | [Error Handling Guide](reference/cross-cutting/error-handling-principles.md) | Fail fast, error hierarchy, 7 languages, anti-patterns, logging |
| **Async & Concurrency** | [Concurrency Guide](reference/cross-cutting/async-concurrency-patterns.md) | Goroutines, async/await, actors, structured concurrency, 7 languages |
| **Review Best Practices** | [Code Review Best Practices](reference/code-review-best-practices.md) | Communication, reviewer mindset, giving feedback, severity labels |

## Additional Resources

- [PR Review Template](assets/pr-review-template.md) - PR 审查评论模板
- [Review Checklist](assets/review-checklist.md) - 快速参考清单
