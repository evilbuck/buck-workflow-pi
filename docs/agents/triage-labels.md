# Triage Labels

Label vocabulary for `evilbuck/buck-workflow-pi` issues: what each label means and what it gates.

| Label | Meaning | Gates |
|---|---|---|
| `ready-for-agent` | Fully specified and cold-startable: branch, artifacts, and acceptance criteria present. | Automated consumption — the input state pipelines such as `b-auto-fix` expect. Apply only when the issue meets that bar. |
| `needs-triage` | Inbound; awaiting a triage decision. | Default landing state for new issues not yet verified fully specified. |
| `bug` / `enhancement` / `documentation` | Category axis, orthogonal to triage state. | Combine with a triage label as fit (e.g. `bug` + `needs-triage`). |

## Rules

- **Inspect before applying.** Neither `ready-for-agent` nor `needs-triage` is guaranteed to exist — as of 2026-09-10 this repo carries only the GitHub default label set. Run `gh label list` first; `b-issue-create` and `fix-pr` both prefer `ready-for-agent` only *if it exists and the issue is fully specified*, else `needs-triage`.
- Triage state and category are independent axes: every issue should carry one of each when the labels exist.
- `b-auto-fix` additionally skips `in-progress`, `do-not-auto-fix`, `human-only` (see its `labels_skip` config in `skills/b-auto-fix/SKILL.md`); do not route issues carrying those to automated pipelines.
