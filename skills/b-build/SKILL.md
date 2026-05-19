---
name: b-build
description: Implement well-defined work using TDD with red-green-refactor loops. Supports unit tests (vitest) and browser tests (Playwright) for UI verification. Use /b-build for straightforward work or /b-build-hard for complex, ambiguous, or higher-risk implementation.
---

# b-build: Implementation Agent with TDD

Implement well-defined work using **test-driven development** with the smallest safe code change. Difficulty adapts behavior:

- **standard** (`/b-build`): Follow existing patterns, keep scope tight, write tests first, run appropriate verification.
- **hard** (`/b-build-hard`): Think through trade-offs before editing, break changes into safe steps, preserve behavior unless change is required, surface risks and migration concerns clearly, run stronger verification.

## Test Strategy

| Test Type | Framework | Use When |
|-----------|-----------|----------|
| **Unit tests** | vitest | Logic, utilities, state machines, business rules |
| **Browser tests** | Playwright | UI rendering, interactions, DOM behavior, visual verification |
| **Integration tests** | vitest + mocks | API flows, file system, multi-component behavior |

**Golden rule**: Tests verify **behavior through public interfaces**, not implementation details.

### When to Use Each

- **vitest**: Core logic, pure functions, state machines, configuration parsing, file operations
- **Playwright**: Any code that renders HTML, responds to user interaction, or requires browser APIs

### UI Verification Mandate

**For any work that touches UI files** (HTML, JavaScript, TypeScript, CSS, SASS, SCSS, or server-side templates):
1. **Write a Playwright test FIRST** — capture the expected behavior
2. **Run the test** — verify it fails (RED phase)
3. **Implement the feature** — make the test pass (GREEN phase)
4. **Refactor** — improve code while tests stay green
5. **Verify in browser** — use available snapshot/screenshot tools to confirm visual correctness

This makes browser verification **repeatable and cheap** — no manual testing required.

## Difficulty Levels

### Standard (default)

- Follow existing patterns.
- Keep scope tight.
- **Write test before code** (red-green-refactor).
- Run appropriate verification (unit + browser as needed).
- Report changed files, assumptions, and results.

### Hard

- Think through trade-offs before editing.
- Break changes into safe steps.
- Preserve behavior unless change is required.
- Surface risks and migration concerns clearly.
- Run stronger verification than standard (browser tests + manual verification).
- Output includes: implementation summary, changed files, verification results, risks/trade-offs, recommended next step.

## TDD Workflow

### 1. Plan (Before Writing Code)

```
[ ] Confirm with user what interface changes are needed
[ ] Confirm which behaviors to test (prioritize critical paths)
[ ] Identify test type: vitest (unit) or Playwright (browser)
[ ] List the behaviors to test (not implementation steps)
[ ] Get user approval on the plan
```

### 2. Red Phase

Write **ONE test** that confirms **ONE behavior**:

```bash
# Unit test (vitest)
npx vitest run --reporter=verbose tests/my-feature.test.ts

# Browser test (Playwright)
npx playwright test tests/e2e/my-feature.spec.ts
```

Test fails → confirms the behavior doesn't exist yet.

### 3. Green Phase

Write **minimal code** to make the test pass:

```bash
# Run tests to verify green
npx vitest run
# or
npx playwright test
```

Rules:
- One test at a time
- Only enough code to pass current test
- No speculative features

### 4. Refactor Phase

After tests pass, look for improvements:

```
[ ] Extract duplication
[ ] Deepen modules (move complexity behind simple interfaces)
[ ] Apply SOLID principles where natural
[ ] Run tests after each refactor step
```

**Never refactor while RED.** Get to GREEN first.

### 5. Verification Cycle

```
RED → GREEN → REFACTOR → RED → GREEN → REFACTOR → ...
```

Repeat until all behaviors are tested.

## Playwright Browser Testing

### Setup Verification

Playwright is pre-installed for this project. Browser tests run against your project's UI.

```bash
# Verify Playwright is available
npx playwright --version

# Install browsers if needed
npm run playwright:install
```

### Test Location

Browser tests are at the **package level** (not inside skills):

```
buck-workflow-pi/
├── playwright.config.ts   # Playwright configuration
├── tests/
│   └── e2e/
│       └── *.spec.ts      # Browser tests
├── extensions/            # Source code (what gets tested)
└── skills/               # Skill guidance (documentation only)
    └── b-build/
        └── SKILL.md
```

### Playwright Test Pattern

```typescript
// tests/e2e/my-feature.spec.ts
import { test, expect } from '@playwright/test';

test('feature description', async ({ page }) => {
  // Arrange: Navigate to the page
  await page.goto('/');
  
  // Act: Interact with the UI
  await page.click('#my-button');
  
  // Assert: Verify expected behavior
  await expect(page.locator('#result')).toHaveText('Expected');
});
```

### Running Browser Tests

```bash
# Run all E2E tests (from project root)
npm run test:e2e

# Run with UI mode
npm run test:e2e:ui

# Debug mode
npm run test:e2e:debug

# Chromium only
npm run test:e2e:chromium

# View HTML report
npm run playwright:report
```

### Dev Server Requirement

Browser tests require a running dev server. Before running Playwright tests:

```bash
# Check if dev server is running
curl -s http://localhost:3000 > /dev/null && echo "Running" || echo "Not running"

# Start dev server if needed (use tmux for background)
tmux new-session -d -s dev-server 'npm run dev'
```

For automated testing, the skill should handle server lifecycle:
1. Check if server is running
2. Start if needed
3. Run tests
4. Optionally stop server (keep running if tests pass)

### Visual Verification Commands

Use these for manual verification when needed:

```bash
# Take screenshot of specific element
npx playwright screenshot --selector='#my-element' output.png

# Record video of test run
npx playwright test --video=on

# Generate trace on failure
npx playwright test --trace=on
```

## Context Resolution

Before building, check for prior planning artifacts using this **resolution order**:

1. **Active subject folder** (from session context): `.context/YYYY-MM-DD.[:subject]/plan-*.md`, `spec-*.md`
2. **All subject folders** (scan for active entities): `.context/*/plan-*.md`, `*/spec-*.md`
3. **Flat directories** (legacy fallback): `.context/plans/*.md`, `.context/specs/active/*.md`
4. **Backlog** (always): `.context/backlog/todo.md` (legacy fallback: `.context/backlog.md`)

### Cross-Reference Following

When you load a plan, also read its linked artifacts:
- **Plan's `research:` field** → read the research files for context
- **Plan's `spec:` field** → read the spec to verify requirements
- **Spec's `plans:` field** → verify coverage (for b-review)

### Subject Folder Note

If you start building without a subject folder (ad-hoc work), **b-save will create one** at session end and consolidate artifacts. You don't need to manage this — just focus on implementation.

If a plan exists, follow its implementation steps and affected files list. If a spec exists, verify the implementation satisfies its requirements.

## Phased Plan Awareness

If a `plan-*-phases.md` file exists in the subject folder:

Ralph loops may resume mid-phase. If a phase file is already `status: in-progress`, treat that as the active phase before selecting the first `pending` phase, and check for any active `iterate-*.md` artifact in the same subject folder.

1. **Read it** and identify the current active phase (first non-completed phase in the summary table).
2. **Read the discrete phase file** linked in the summary table for full implementation details.
3. **Surface the model hint** — tell the user at the start:
   > **Phase N: <name>** — difficulty: `<easy|medium|hard>` — model hint: `<description>` — executing via `/b-build` or `/b-build-hard`
4. **Difficulty mismatch**:
   - **Standard mode, hard phase**: Warn the user:
     > ⚠️ This phase is rated **hard**. Consider switching to `/b-build-hard` for stronger reasoning.
     If the user confirms they want to proceed with standard, continue normally.
   - **Hard mode, easy/medium phase**: Mention it but proceed — the user explicitly chose hard for a reason (risk tolerance, extra verification, etc.).
5. **Scope to the active phase only** — implement only the current phase's steps and acceptance criteria, not the entire plan.
6. **After completing the phase**, note which phase was finished and suggest the next step (queue next phase, run `/b-review`, or `/b-save`).

### Phase State Updates (Required)

When working on a phased plan with discrete phase files:

1. **At start**: Read the phases overview to find the active phase (first non-completed). Read that phase file.
2. **Mark phase in-progress**: Update the phase file's frontmatter `status: in-progress`.
3. **Implement**: Execute only the current phase's scope.
4. **On completion**:
   a. Update acceptance criteria checkboxes in the phase file: `[ ]` → `[x]`
   b. Set `status: completed` and `completed_at: YYYY-MM-DD` in phase file frontmatter
   c. Update the phases overview file (`plan-*-phases.md`): change the phase's status from `pending`/`in-progress` to `completed` in the summary table
   d. Note the next phase to execute
5. Tell the user which phase was completed and what's next.

### Legacy Phased Plans

If the phases overview has no `format: discrete` frontmatter (legacy single-file format), use the old behavior: scan `## Phase N` sections and check inline acceptance criteria. No discrete phase files to update.

## Session Awareness Protocol

The Buck workflow plugin tracks your session automatically. You are responsible for the living memory — the plugin handles the rest.

At the START of your work:
1. Read `.context/workflow/current-session.json` if it exists
2. Read the memory file listed in session state (if any) for prior context

At EACH NATURAL STOP (you finished a coherent unit of work):
3. Read the current session memory file
4. Rewrite it in-place with consolidated, current information:
   - Add new decisions made since last update
   - Move abandoned approaches to an "Abandoned Approaches" section with reasons
   - Update "Files Modified" to reflect actual current state
   - Remove duplicates and superseded entries
   - Update frontmatter topics/domains if scope shifted
5. If no memory file exists yet, create one with proper frontmatter and record its path in current-session.json under memory_file

At COMPLETION:
6. Do a final memory update
7. Tell the user: "Run /b-save to finalize this session's record."

## Ralph Loop Awareness

When `/b-build` is running inside a Ralph loop, preserve durable state before yielding control:

1. If the active plan or phase cannot be completed in this iteration, stop at a coherent boundary.
2. For phased plans, leave the phase file `status: in-progress` and keep acceptance criteria unchecked until verified.
3. Run `/b-save` before calling `ralph_done` so memory, draft commit text, and artifact state are recoverable.
4. On the next iteration, re-read the phases overview, the `in-progress` phase file, and any active `iterate-*.md` artifact before editing.
5. Do not call `ralph_done` after a source change unless durable state has been written or updated.

## Escalation

- **Standard → Hard**: Escalate to `b-build-hard` if the task becomes ambiguous, architectural, or spreads beyond the expected files. Also escalate if the active phase in a phased plan is rated **hard**.
- **Any → Review**: Escalate to `b-review` when implementation is ready for validation.

## Closeout

After completing implementation, report:
1. **Changed files** — list what was modified
2. **Verification** — confirm the changes work (run tests: `npx vitest run` for unit, `npx playwright test` for browser)
3. **Phase status** — if working from a phased plan, note which phase was completed
4. **Draft commit message** — write the draft to the active subject folder (e.g. `.context/YYYY-MM-DD.subject/draft-commit.md`). If no subject folder exists yet, write to `.context/draft-commit.md` at the root. Include a Conventional Commits message based on the staged changes:

   ```markdown
   ## Title
   <type>(<scope>): <short summary>

   ## Body
   <why this change was made, key constraints, notable behavior changes>
   ```

5. **Recommendation** — suggest `/b-review` for validation, then `/b-save` to finalize
