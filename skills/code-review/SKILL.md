# Release PR Code Review — Reusable Prompt

## Purpose
Perform a thorough production-readiness code review of a release candidate PR (typically `dev → main`). Fan out parallel agents across the highest-risk change areas, trace every finding back to the originating PR and author, and write per-PR review files that can be handed directly to each contributor.

---

## Input
- **PR number** (e.g. `1314`) — the release candidate PR on GitHub
- **Base branch** (e.g. `main`) and **head branch** (e.g. `dev`)

---

## Step 1 — Fetch PR metadata

```bash
gh pr view <PR_NUMBER> --json title,body,baseRefName,headRefName,files
```

Read the PR description carefully. Note any sections labelled "High Risk", automated summaries (e.g. Cursor Bugbot), and the full file list. This tells you which areas to prioritise.

If the diff is too large for the API (`gh pr diff <PR_NUMBER>` returns HTTP 406), work locally:

```bash
git diff <BASE>..<HEAD> --stat
git diff <BASE>..<HEAD> -- <specific-file>
```

---

## Step 2 — Map files to originating PRs

Before reviewing, establish which feature PR introduced each area of change. This allows findings to be assigned to the right author rather than just the release bundler.

```bash
# All commits between base and head with author
git log <BASE>..<HEAD> --format="%H %ae %s"

# Which commit last touched a specific file
git log <BASE>..<HEAD> --oneline -- <file-path>

# What files a specific commit changed
git show <COMMIT_SHA> --stat
```

Build a mental map of: **commit → PR number → author → files changed**.

---

## Step 3 — Fan out parallel review agents

Identify the highest-risk change areas from the PR file list and description. Typical categories for a full-stack release:

| Area | Files to review |
|------|----------------|
| **Database migrations** | `database/schema/migrations/*.sql`, `database/schema/schema.ts` |
| **External integrations** | Any payment, webhook, or third-party API changes |
| **New features** (admin/backend) | New oRPC procedures, router files, component files |
| **New provisioning/cleanup queries** | Large new files in `database/src/queries/` |
| **Frontend layout/routing** | `layout.tsx`, `page.tsx`, removed routes |
| **Seeds, permissions, DB client** | `database/seeds/`, `capability-definitions.ts`, `client.ts` |

Launch one agent per area **in parallel**. Each agent should:
- Run `git diff <BASE>..<HEAD> -- <relevant-files>` to see actual changes
- Read the full current file for context
- Look for the issues listed in Step 4
- Return findings as a structured list: **severity / file:line / description / failure scenario**

---

## Step 4 — What each agent should look for

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

---

## Step 5 — Compile and assign findings

After all agents complete, consolidate into a master list sorted by descending severity:

**Severity levels:**
- **CRITICAL** — Will break production at deploy time or immediately after (migration failure, all webhooks rejected, data loss)
- **HIGH** — Material security, data integrity, or correctness risk that a bad actor or edge case can trigger
- **MEDIUM** — Performance regression, incomplete validation, missing test coverage for a critical path
- **LOW** — Minor correctness issue, UX gap, test brittleness, or code smell

For each finding, record:
```
Severity | File:line | One-line summary | Failure scenario (what actually breaks and when) | Fix suggestion
```

Then group by originating PR using the map from Step 2.

---

## Step 6 — Write per-PR review files

Create one file per feature PR at `/mnt/c/Code/plans/review-PR-<NUMBER>-<slug>.md`.

Each file should contain:
```markdown
# Code Review — PR #<N>: <title>
**Author:** <github-username>
**Merged into:** <branch>
**Date:** <date>
**Part of release:** PR #<release-pr> (<release-title>)

---

## Summary of Changes
<2-3 sentence description of what this PR actually did>

---

## Findings

### <SEVERITY> — <Short title>
**File:** `<path>:<line>`
**Severity:** <CRITICAL / HIGH / MEDIUM / LOW>

<Description of the problem — what the code does, why it's wrong>

<Failure scenario — the specific condition under which this breaks, what the user or system observes>

**Fix:** <Concrete suggestion>
```

---

## Step 7 — Verify before finalising

Before writing any finding as fact:

1. **Third-party API behavior** — search the `wiki/` directory and README first. If not documented there, say "unverified" rather than assuming based on other providers (Stripe, Shopify, etc. differ).
2. **"This will always fail"** claims — trace the specific code path. Consider whether an env var, a config value, or a fallback might prevent the failure.
3. **Data loss claims** — confirm the column/table actually existed and was populated before it was dropped. Check migration history.
4. **Test coverage gaps** — actually check whether a test file exists for the function before saying it's untested.

If a finding cannot be verified from code or docs alone, downgrade severity and explicitly flag it as requiring the author to confirm.

---

## Output summary format

At the end, produce a table for quick assignment:

| Assignee | PR | Findings | Blockers |
|----------|-----|----------|---------|
| @author1 | #N (feature-name) | X CRITICAL, Y HIGH, Z MEDIUM | Yes/No |
| @author2 | #N (feature-name) | X HIGH, Y MEDIUM | No |

Files written to: `/mnt/c/Code/plans/review-PR-<N>-*.md`

---

## Notes on this project

- Use `bun` not `npm` for all commands
- Database is PostgreSQL/Supabase; migrations are Drizzle ORM
- Admin app is at `apps/admin/`; frontend is at `frontend/`; shared DB queries at `database/src/queries/`
- oRPC is the RPC framework; procedures live in `router.ts` files
- Wiki is a git submodule at `wiki/` — run `git submodule update --remote wiki` before reading it
- Do not run `git add`, `git commit`, or `git push` — the user handles all git operations
