---
name: node5-code-review
description: Review code changes for correctness, security, data integrity, and edge cases in the node5 project. Takes an optional argument that can be a plan/spec path, context description, or nothing (auto-detects from git). Use when asked to review code, review a PR, or check changes for issues in node5.
version: 2.0.0
---

# Node5 Code Review Skill

Review code changes for correctness, security, data integrity, and edge cases in the node5 project.

## Invocation

The skill accepts an optional argument:

| Argument | Example | Behavior |
|---|---|---|
| Plan or spec path | `.context/.../plan-*.md` or `.context/.../spec-*.md` | Review changes against the plan/spec as the acceptance contract |
| Phase path | `.context/.../phase-*.md` | Review only that phase's scope |
| Subject folder | `.context/YYYY-MM-DD.subject/` | Discover artifacts; use active plan/spec as contract |
| Context description | Any freeform text | Use as review focus; discover changes from git |
| *(none)* | — | Auto-detect changes from git and review them |

## Step 1 — Scope resolution

### If a path argument was provided

1. Read the referenced file/folder
2. If it's a subject folder, scan for the best matching artifact (plan → spec → phase → freeform)
3. Extract the **acceptance contract**: what was planned, what files were supposed to change, what verification criteria exist
4. Use git to discover actual changes against the relevant baseline

### If no argument was provided

1. Run `git status`, `git diff --stat`, and `git log --oneline -10` to discover changes
2. Determine the baseline (merge-base with main/dev, or recent commits)
3. Build a change list: which areas are affected, which files changed
4. No acceptance contract — review purely on code quality grounds

## Step 2 — Identify review areas

From the change list, identify which risk areas are relevant. Not every review includes all areas — only flag areas with actual changes.

| Area | Files to review |
|------|----------------|
| **Database migrations** | `database/schema/migrations/*.sql`, `database/schema/schema.ts` |
| **External integrations** | Any payment, webhook, or third-party API changes |
| **New features** (admin/backend) | New oRPC procedures, router files, component files |
| **New provisioning/cleanup queries** | Large new files in `database/src/queries/` |
| **Frontend layout/routing** | `layout.tsx`, `page.tsx`, removed routes |
| **Seeds, permissions, DB client** | `database/seeds/`, `capability-definitions.ts`, `client.ts` |

For each relevant area, read the actual changed files (not just the diff) to understand context.

## Step 3 — Review in parallel

Delegate each relevant area to a parallel subagent using `task`. Each subagent should:

1. Run `git diff <BASE>..<HEAD> -- <relevant-files>` to see actual changes
2. Read the full current file for context
3. Check for the issues listed in Step 4 for their area
4. Return findings as a structured list: **severity / file:line / description / failure scenario**

**Subagent assignment pattern:**

```text
Assign one task per risk area that has actual changes.
Each task gets:
- The area name and checklist from Step 4
- The list of changed files for that area
- The git baseline (merge-base or commit range)
- Instructions to read full files, not just diffs
```

If only one area is relevant, skip task delegation and review directly.

## Step 4 — What to look for (per area)

### Database migrations
- Will any migration fail on a live database with existing data? (Check constraints added after nullable columns; data that violates the new constraint)
- Destructive operations: column/table drops — is there a pre-migration export or rollback path?
- `CREATE INDEX` / `DROP INDEX` without `CONCURRENTLY` on high-traffic tables — causes table locks
- Multi-step index renames across multiple migration files — transient schema drift risk

### External integrations (webhooks, payment processors)
- **Do not assume** timestamp units (seconds vs. milliseconds), header names, or payload formats. If the format is not documented in the codebase (wiki, README, comments), flag it as unverified — do not guess based on other providers.
- Check for existing documentation in `wiki/` before making any claim about third-party API behavior
- Fire-and-forget (`void asyncFn()`) in serverless contexts — response sent before processing completes
- HTTP 200 returned on internal errors — prevents the external service from retrying
- Env vars read at call time with no startup validation — silently fails on first real use
- New signature/auth mechanisms with no tests exercising them

### New admin/backend procedures
- Server-side authorization — does the server enforce the same restrictions the UI shows?
- Unconditional state mutations — can an operation be called on an already-mutated record?
- Silent success on 0 rows affected — UPDATE returning success when UUID matches nothing
- Input validation: server-side vs. UI-only guards

### New provisioning/cleanup queries
- Cross-tenant data isolation — does a cleanup/delete operation scope to the correct tenant?
- Transaction safety — multi-step operations wrapped in transactions?
- Are integration tests present, and do they cover the failure cases? (especially: sibling-tenant isolation for any delete/cleanup operation)
- Infinite loops with no max-iterations guard

### Frontend layout and routing
- Removed routes — are all links/navigation references also removed?
- `void prefetchQuery()` without `await` before `dehydrate()` — ships pending state to client, negating SSR
- New error boundaries — do they match the existing pattern for handling permission/forbidden errors?
- Sentry captures on non-bug conditions (FORBIDDEN, NOT_FOUND)

### Seeds, permissions, DB client
- Seed emails that collide with real user signup flows (especially on `production`-type seeded tenants)
- Real customer names or production-specific UUIDs hardcoded in dev seeds
- Pool/connection references nullified before errors are thrown (prevents proper cleanup)
- Capability definition removals — confirm RBAC catalog sync handles orphaned rows

## Step 5 — Universal checks (apply to all areas)

Regardless of which risk areas are relevant, always check for:

- **Security**: SQL injection, XSS, CSRF, auth bypass, secrets in code, overly broad CORS, missing rate limits
- **Data integrity**: Missing null checks, incorrect null handling, race conditions on shared state, missing transaction boundaries where rows must be atomic
- **Error handling**: Swallowed errors, missing error types, catch-all with no logging, throw-after-response
- **Performance**: N+1 queries, missing indexes for new query patterns, unbounded queries without pagination
- **Correctness**: Off-by-one errors, wrong comparison operators, missing await on promises, floating point in money calculations
- **Testing**: Critical paths with no tests, tests that pass for the wrong reason, mocked assertions that don't verify real behavior

## Step 6 — Compile findings

After all subagents complete (or direct review finishes), consolidate into a master list sorted by descending severity.

**Severity levels:**
- **CRITICAL** — Will break production at deploy time or immediately after (migration failure, all webhooks rejected, data loss)
- **HIGH** — Material security, data integrity, or correctness risk that a bad actor or edge case can trigger
- **MEDIUM** — Performance regression, incomplete validation, missing test coverage for a critical path
- **LOW** — Minor correctness issue, UX gap, test brittleness, or code smell

**Finding format** — each finding must include:
```
Severity | File:line | One-line summary | Failure scenario (what actually breaks and when) | Fix suggestion
```

A finding without a **concrete failure scenario** is not a finding — it's a style opinion. Only flag it if you can describe what breaks and when.

## Step 7 — Produce report

### When reviewing against a plan/spec (acceptance contract exists)

```markdown
## Code Review: <plan or spec name>

### Scope
- Baseline: <git baseline or commit range>
- Changed files: <list>
- Review areas: <which areas from Step 2>

### Acceptance Contract
- Source: <plan/spec path>
- Goal: <one-line summary>
- Verification criteria: <from plan/spec>

### Completion Matrix

| Step/Criterion | Status | Evidence |
|------|--------|----------|
| Step 1 | ✅ complete | <file> changed, behavior verified |
| Step 2 | 🔄 partial | <file> changed but <missing piece> |
| Step 3 | ❌ missing | No evidence found |

### Findings

| # | Severity | File:line | Summary | Failure scenario | Fix |
|---|----------|-----------|---------|------------------|-----|
| 1 | CRITICAL | ... | ... | ... | ... |

### Verdict
<Pass / Pass with warnings / Needs work>

### Recommended next step
<Specific action>
```

### When reviewing without a plan (freeform or auto-detected)

```markdown
## Code Review: <branch or commit range>

### Scope
- Baseline: <git baseline>
- Changed files: <list>
- Review areas: <which areas from Step 2>

### Findings

| # | Severity | File:line | Summary | Failure scenario | Fix |
|---|----------|-----------|---------|------------------|-----|
| 1 | CRITICAL | ... | ... | ... | ... |

### Summary
<2-3 sentence summary of overall risk>

### Recommended next step
<Specific action>
```

### When review passes cleanly

```text
✅ No issues found in <area(s)>.
<Optional: one note about something that was close but acceptable>
Suggested next step: <commit/merge/deploy>
```

## Behavior rules

- **Read full files**, not just diffs. Diffs lack context.
- **Stay read-only** — report findings, don't make changes.
- **Prioritize correctness** over style.
- **Every finding needs a failure scenario.** A claim without a concrete breakage story is a style opinion — drop it or downgrade to LOW with explicit justification.
- **Don't guess about third-party APIs.** If behavior isn't documented in the codebase, flag as unverified.
- **State assumptions explicitly.** If you couldn't verify something, say why.
- **When no plan exists**, review against general code quality, the project's existing patterns, and the domain-specific checks above.

## Cross-references

- This skill is a **complement** to `code-review` (brutally honest, PR-aware). Use `code-review` for harsh stylistic/architectural critique and PR inline comments; use `node5-code-review` for domain-specific node5 checklist review (migrations, integrations, seeding, RBAC) and plan-contract verification.
- After this review finds real issues, the natural follow-up is `/b-iterate` (small fixes) or `/b-build` (larger rework).