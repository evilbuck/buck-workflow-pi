# Configure and activate a Buck model profile

Create a named profile, map Buck stage groups to installed OMP models, and make the profile active.

## Steps

1. Run `/buck-models` in the project where Buck commands will run.
2. Choose `Project (.omp/config.yml)` to keep the profile in this checkout, or `User-global (~/.omp/agent/config.yml)` to reuse it across projects.
3. Choose `Create or edit a profile`, then `Create a new profile` or an existing profile name.
4. For each stage you want this scope to own, choose `Edit this stage`. Check installed models in the searchable list (`Space` toggles, type to filter, `Enter` saves, `Esc` cancels). Saved ids that are not installed on this machine stay in the list so you can keep them. Existing notes on ids you leave checked are kept. Then choose the stage thinking level. Choose `Keep current stage` when the existing project value or displayed user-global fallthrough is correct.
5. Confirm whether to activate the profile, then confirm the write. Unavailable ids produce a warning but remain saved for use on another machine.
6. To activate an existing profile later, run `/buck-models` again, choose the target scope, choose `Activate a profile`, select its name, and confirm the write.
7. Run a mapped command such as `/b-build`; use `/buck-loop` when you want its nested work and closed-set choice stages routed too.
8. **Eat:** the save notification names the selected profile and config path, and the next mapped stage runs with one of that stage's available configured ids and its configured thinking level. If the active profile, stage, or available-id set is missing, the command stops with a named `buckModels` error instead of using the host model.

Project stage presence overrides the user-global stage, including an explicitly empty model list. Omit a project stage to inherit that stage from the same user-global profile name.

## Audit saved profiles against the live registry

Use `/buck-models --doctor` for a read-only audit before a mapped command fails.

### Steps

1. Run `/buck-models --doctor` in the project where Buck commands will run.
2. Read the notification. The first line states the severity (`INFO`/`WARN`/`ERROR`), counts of configured occurrences, unique ids, and unavailable ids. The second line states the effective active profile using the same project-then-global precedence that runtime routing uses.
3. For each profile the report lists, read its `[scope] name` header — the active profile is marked `*active*`. Each stage below the header shows its scope ownership, thinking level, and per-id availability tagged `[ok]` or `[MISSING]`.
4. If the report shows `WARN` or `ERROR`, decide whether to edit a profile (run plain `/buck-models`) or leave unavailable ids saved for another machine. Doctor mode itself does not edit or activate anything.
5. **Eat:** the notification reports counts that match a manual count of every configured model id across project and user-global config files, the active marker points at the profile runtime will pick, and running `/buck-models` without arguments still opens the interactive editor with no config writes triggered by doctor mode.

Doctor mode only checks exact `provider/id` membership in the live OMP model registry. It does not probe provider authentication, billing, rate limits, network connectivity, context windows, or actual inference. Saved ids that are not currently installed stay saved; they are reported as unavailable, not invalid.
