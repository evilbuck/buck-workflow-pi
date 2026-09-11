# Issue Tracker

Tracker: **GitHub Issues** on `evilbuck/buck-workflow-pi`.

## Addressing issues

- CLI: `gh issue view|create|comment|close <N>` (add `--repo evilbuck/buck-workflow-pi` when running out-of-tree).
- Internal references: `issue://<N>` — e.g. `read issue://<N>` to confirm body, labels, and open state.
- Auth required: `gh auth status` must pass before any issue operation.

## Repo conventions

- Every handoff/tracking issue links the **active branch** and the **`.context` artifacts** behind it (plan, research, memory, presentations), so another agent can cold-start from the issue alone.
- The creation flow — subject-local artifact → backlog item → body file → `gh issue create --body-file` → link-back — is defined in `skills/b-issue-create/SKILL.md`; follow it instead of free-handing issue bodies.
- Verify after creating: `read issue://<N>` shows the expected body, labels, and open state.

## Labels

Triage/category vocabulary lives in `triage-labels.md` (same directory). Inspect repo labels (`gh label list`) before applying any of them — existence is not guaranteed.
