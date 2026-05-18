# Plan: Buck Workflow Checkpoints (Auto Git Commits)

## What we might build
- Automatic Git commits at natural phase boundaries during Buck workflow
- Each commit is a real `git commit` on the working branch (push-ready, shows in `git log`)
- Commit messages use existing Conventional Commits format **plus a checkpoint marker** to distinguish them in history
- No commit on failure or interruption — only fires on successful phase completion

## Why it matters
- Work accumulates across sessions without being saved
- No clean rollback point if something breaks mid-phase
- Lost context between sessions if work isn't committed
- Makes it easier to review what was done and when

## Design Decisions

| Question | Decision |
|----------|----------|
| Real commit or stash-like? | Real git commit on working branch |
| When to fire? | Phase boundaries only (user can still `git commit` manually mid-phase) |
| Message format? | Normal Conventional Commits + checkpoint marker/tag |
| Failure behavior? | No commit — clean rollback to last checkpoint |

## Open Questions

1. **Where does the checkpoint logic live?** — New skill (`b-checkpoint`), built into `b-build`/`b-phase`, or part of `git-commit`?
2. **What's the checkpoint marker format?** — e.g., `checkpoint: feat: add auth flow`, `feat: add auth flow [checkpoint]`, or `🔖 feat: add auth flow`?
3. **Should b-build also checkpoint at its end?** Or is that only for b-phase? (b-build is a single-pass implementation — does it also have a "natural boundary" worth committing?)
4. **How does this interact with b-review?** Should the review step happen before or after the checkpoint commit? Currently b-review validates *before* commit — should that stay the same?
5. **What about b-iterate?** Does each iteration loop create a checkpoint, or is the checkpoint only at the end of the review → iterate → review cycle?
6. **Should checkpoints track phase metadata?** (e.g., phase name, phase index, total phases) so you can see progression in git log?
7. **How does this work with uncommitted user changes?** If the user already has dirty state, should we `git add .` for everything or only the files the agent touched?

## Status
- Formalized as `plan-buck-checkpoints.md`

## Brainstorm notes
- User's core idea: "automatically commit to Git" during phases or builds
- Message generation already exists — reuse existing commit message logic
- User can always manually commit whenever they want; checkpoints don't replace that
- No auto-commit on failure — keeps history clean
