---
status: active
date: 2026-06-05
subject: 2026-06-05.current-session-json-design
topics: [session-state, design, merge-conflicts, git-tracking, papertrail, schema-reduction, handoff, multi-machine]
informs: [plan-current-session-redesign.md]
---

# Redesign of `.context/workflow/current-session.json` (handoff-aware)

## 0. The handoff use case (revealed after the first design pass)

The user works on the same workflow across multiple machines. The handoff mechanism is **git**: commit + push on machine A, pull on machine B, continue.
This reframes the original merge-conflict complaint: the conflict isn't just an annoyance, it's a sync barrier. Two machines writing the same file in divergent local trees cannot resolve cleanly. A per-subject file is naturally one-machine-at-a-time (you commit, you push, the other side pulls), so it sidesteps the contention entirely.

The user's three design choices all line up with this use case:
- **Commit the whole file** → the file IS the handoff payload
- **Derive active subject from mtime** → no local-only pointer to sync; the repo is enough
- **Same pattern for grill-session** → consistency for the b-grill-auto handoff path

### 0.1 What gets transferred on handoff?

| Field | Handoff behavior |
|---|---|
| `memory_file` | **transfer** — the link to in-flight context |
| `commands_run` | **transfer** — history of the work, useful on resume |
| `files_modified` | **transfer** (caveat: git is the source of truth; the JSON is a hint) |
| `plan_mode_active` | **transfer** — workflow mode is part of the work |
| `buck_workflow_mode_active` | **transfer** |
| `buck_workflow_mode_source/reason/enabled_at/auto_disabled` | **transfer** |
| `restrict_cwd_active` | **transfer** |
| `started_at` | **reset on bootstrap** — it's the *current* machine's session, not the work's |
| `implementation_happened` | **reset on bootstrap** — the previous machine's session is closed |
| `save_completed` | **reset on bootstrap** — same |

This means the on-bootstrap rewrite is not just a `touch` — it must clear the per-pi-session flags while preserving the workflow state and history fields.

### 0.2 What about the active-subject signal after `git pull`?

Filesystem mtime is set to the commit time after checkout, so it's not a reliable "last touched" signal. Three options:

- (a) `git log -1 --format=%ct -- <subject>/session.json` — most recent commit time of the file. Authoritative, no on-disk mutation needed.
- (b) `last_active_at` field in subject `index.md` frontmatter, updated on bootstrap. Committed, survives handoff, but touches a committed file on every session start.
- (c) On bootstrap, immediately rewrite the file with a new `started_at`. The mtime becomes "now." But the file is then dirty — and since it's committed, this creates a commit-on-bootstrap if the user does `git add` later.

**Trade-off**:
- (a) is the cleanest — no extra fields, no commit-time entanglement, but requires `git log` at session start.
- (b) is the most discoverable — the active subject is visible in any `index.md` inspection, no git commands needed.
- (c) is the simplest code change but has a side effect (dirty file on bootstrap) that may surprise the user.

**Recommendation**: (a) for now. Fall back to (b) if (a) is too slow on large repos.

---

## 1. The actual problem (evidence)

### 1.1 The file is in `.gitignore` *and* tracked in git — the worst of both worlds

`.gitignore` (line 21):
```
.context/workflow/current-session.json
```

`git ls-files --error-unmatch .context/workflow/current-session.json` → **outputs the path**, meaning it is in the index. `git status` is clean only because the working tree matches the index; the file is still in commit history.

History: the file was added in `beb3c80` (initial commit, 2026-04-15). The `.gitignore` rule was added later, never with a `git rm --cached` follow-up. So the ignore rule has been a no-op for the file in question.

The smoking gun in history: `cad21be resolved session papertrail conflicts` — 4 insertions, 33 deletions, single file. That's exactly the kind of merge the user is hitting.

### 1.2 Write frequency: every command, every tool call

`writeState()` is called from:
- `tool_call` / `tool_result` hook — every write/edit tool call (line 1051)
- `agent_end` / command-handler block — every `/b-*` command (lines 884, 895)
- Plan mode toggles (lines 538, 547, 581, 592, 633, 641)
- `/b-save` handler (line 1152)

The whole file is rewritten on each of these. With two branches both running workflow commands, the working-tree JSON diverges constantly.

### 1.3 Why a "merge" conflict happens even on a single-machine workflow

Even without multi-branch work, the file is written so often that:
- A `git stash`/unstash dance during branch switching lands on an out-of-date version
- `git pull --rebase` after the file was committed upstream forces a 3-way merge of two diverging papertrails
- Worktrees share a single working directory; running the same project in two worktrees is the worst case (one write wins, the other has to re-derive)

The root cause is the same: the file is tracked and it changes per session.

---

## 2. Field-lifecycle audit

Each field of `SessionState` (`extensions/index.ts:19-42`) classified by whether it must survive across session restarts.

| Field | Lifecycle | Read by | Write frequency | Persistent? |
|---|---|---|---|---|
| `started_at` | per-session | compaction hook | once at boot | **no** |
| `mode` | per-session | none meaningful | never written | **no** |
| `commands_run` | per-session | compaction hook (latched into system prompt) | every command | **no** |
| `implementation_happened` | per-session | agent_end warning ("unsaved work") | every implementation tool | **no** (derivable from existence of draft-commit.md) |
| `save_completed` | per-session | agent_end warning | on /b-save | **no** (derivable from same) |
| `memory_file` | **cross-session** | all skills, subject resolution | once per session boot | **yes** |
| `files_modified` | per-session | compaction hook (papertrail) | every tool call | **no** (git tracks this authoritatively) |
| `guided_workflow` | per-session | none (legacy) | never | **no** |
| `guided_stage` | per-session | none (legacy) | never | **no** |
| `plan_mode_active` | **cross-session** | system prompt, tool_call write guard | on toggle, on /b-* | **yes** |
| `buck_workflow_mode_active` | **cross-session** | system prompt injection | on toggle, on /b-* | **yes** |
| `buck_workflow_mode_source` | **cross-session** | UI status | on set | **yes** |
| `buck_workflow_mode_reason` | **cross-session** | UI status | on set | **yes** |
| `buck_workflow_mode_enabled_at` | **cross-session** | UI status | on set | **yes** |
| `buck_workflow_mode_auto_disabled` | **cross-session** | /b-mode handler | on manual /b-mode off | **yes** |
| `workflow_intent_count` | per-session | UI (rarely) | rarely | **no** |
| `last_workflow_intent_at` | per-session | UI (rarely) | rarely | **no** |
| `restrict_cwd_active` | **cross-session** | tool_call write guard | on /b-restrict toggle | **yes** |

**Summary**: 5 of 17 fields are cross-session durable. The other 12 are per-session papertrail or unused legacy.

---

## 3. The chosen design (per-subject, committed, handoff-aware)

### 3.1 File layout

```
.context/
├── workflow/
│   └── modes.json                       # gitignored; tiny global fallback for modes
│                                          (only used before a subject exists)
└── YYYY-MM-DD.<subject-slug>/
    ├── index.md                         # committed; status: active|draft|completed
    ├── plan-*.md / spec-*.md / ...      # committed; existing artifacts
    ├── session.json                     # committed; THIS subject's session state
    │                                      (handoff payload, papertrail, modes)
    └── grill-session.json               # committed; same shape, for b-grill-auto runs
```

### 3.2 `.context/<subject>/session.json` schema

```json
{
  "schema_version": 2,
  "started_at": "2026-06-05T01:55:31.800Z",
  "subject": "2026-06-05.current-session-json-design",

  "memory_file": ".context/memory/<topic>-2026-06-05.md",
  "commands_run": [{ "command": "b-build", "at": "..." }],
  "files_modified": ["src/foo.ts", "..."],

  "plan_mode_active": false,
  "buck_workflow_mode_active": true,
  "buck_workflow_mode_source": "command",
  "buck_workflow_mode_reason": "/b-explore command",
  "buck_workflow_mode_enabled_at": "2026-06-05T01:55:31.800Z",
  "buck_workflow_mode_auto_disabled": false,
  "restrict_cwd_active": true,

  "implementation_happened": false,
  "save_completed": false
}
```

Same fields as today's `SessionState`, scoped to the subject. The `subject` field makes the file self-identifying — important for handoff validation (the receiving machine can sanity-check "this session file is for the right subject").

### 3.3 Bootstrap behavior (on `session_start` / `agent_start` hook)

```text
1. Read .context/<subject>/session.json if it exists
2. If exists and was written by a previous machine (heuristic: started_at != now, files_modified nonempty):
   a. Preserve: memory_file, commands_run, files_modified, all buck_workflow_mode_*, plan_mode_active, restrict_cwd_active
   b. Reset: started_at = now, implementation_happened = false, save_completed = false
   c. Add a `handoff: { from_started_at, received_at }` note (audit trail)
3. If no file exists: bootstrap with defaultState() + subject name
4. Write back immediately
```

### 3.4 Active-subject resolution

```text
scanActiveSubject():
  candidates = []
  for each .context/YYYY-MM-DD.*/ folder:
    read index.md
    if status == "completed": skip
    commit_time = git log -1 --format=%ct -- <subject>/session.json (or 0 if missing)
    candidates.push({ subject, mtime: commit_time })

  return candidates.maxBy(mtime)?.subject
```

Subject resolution protocol (`skills/_shared/subject-resolution.md`) updated to call this. The `current-session.json` step (step 2) is replaced by `scanActiveSubject()`.

### 3.5 Migration sketch

1. **On first bootstrap with the new code**:
   - For each existing subject, derive initial `session.json` from the current `current-session.json` (merge: take workflow state, blank per-pi-session flags)
   - Move `current-session.json` content into a `.context/workflow/modes.json` (or delete if no subject exists yet)
2. **`git rm --cached .context/workflow/current-session.json`** and remove the `.gitignore` line (or invert it to *track* the new per-subject files)
3. Add `.context/*/session.json` to `.gitignore` NO — committed! The file is handoff state.
4. Update `.gitignore`:
   ```
   .context/workflow/current-session.json   # legacy
   .context/workflow/grill-session.json    # legacy
   .context/*/papertrail.json               # if we keep an uncommitted papertrail
   ```
5. CHANGELOG / README: explain the new model, the migration is automatic on next bootstrap.

### 3.6 Grill-session parallel

`grill-session.json` moves to `.context/<subject>/grill-session.json` with the same pattern. Same schema (minus the workflow modes that don't apply to grilling). b-grill-auto reads/writes it the same way.

---

## 4. Open questions

1. **Concurrent edit risk on the same machine**: a single machine can have two pi sessions open (rare but possible). Both would write to the same `session.json`. The on-bootstrap rewrite clears per-pi-session flags; the second pi session's writes would clobber the first's. Acceptable for now; could add a file lock if it becomes a problem.

2. **What about the `.context/workflow/` directory at all?**: after the migration, it's only used for `modes.json` (tiny global fallback) and maybe legacy transition state. Could be entirely deleted if the bootstrap flow can always find a subject. Lean toward: keep it for the brief pre-subject window only.

3. **Subject-resolution protocol with no active subject**: today the protocol falls back to "scan all subjects." If we're on a fresh clone with no subject, the bootstrap creates one? Or prompts the user? Likely prompts — `/b-brainstorm` or `/b-explore` is the natural entry point.

4. **Should the handoff metadata (`handoff: { from_started_at, received_at }`) accumulate or just be the latest?**: lean toward latest. Audit trail of multiple handoffs is interesting but grows the file unboundedly.

5. **Bigger question for the user**: does the workflow ever need to be resumed by a human reading the session.json directly (e.g., "where was I?")? If so, the schema needs to be human-readable. Today's `SessionState` is LLM-targeted. Worth a one-line check before locking the schema.

---

## 5. Recommended next step

This is a design proposal; needs a `/b-plan` to turn into a phased implementation. The phases would naturally be:

1. **Phase 1 — Code restructure**: add `subjectSessionPath(subject)` helper, refactor `readState`/`writeState` to be subject-scoped, keep a transitional `.context/workflow/modes.json` as a one-time bridge.
2. **Phase 2 — Active subject resolution**: replace the `current-session.json` step in `subject-resolution.md` with `scanActiveSubject()`.
3. **Phase 3 — Migration + cleanup**: `git rm --cached` the legacy file, remove the `.gitignore` line, update docs, run the buck-mode test suite (it reads the old path).
4. **Phase 4 — Grill parallel**: same treatment for `grill-session.json` in `extensions/b-grill-auto/grill-state.ts`.

The user should call the design intent — confirm the per-subject, committed, handoff-aware model — and then we plan/build.
