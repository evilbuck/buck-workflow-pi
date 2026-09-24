# Configure and activate a Buck model profile

Create a named profile, map Buck stage groups to installed OMP models, and make the profile active.

## Steps

1. Run `/buck-models` in the project where Buck commands will run.
2. Choose `Project (.omp/config.yml)` to keep the profile in this checkout, or `User-global (~/.omp/agent/config.yml)` to reuse it across projects.
3. Choose `Create or edit a profile`, then `Create a new profile` or an existing profile name.
4. For each stage you want this scope to own, choose `Edit this stage`. Enter comma-separated `provider/model-id | optional note` rows, then choose its thinking level. Choose `Keep current stage` when the existing project value or displayed user-global fallthrough is correct.
5. Confirm whether to activate the profile, then confirm the write. Unavailable ids produce a warning but remain saved for use on another machine.
6. To activate an existing profile later, run `/buck-models` again, choose the target scope, choose `Activate a profile`, select its name, and confirm the write.
7. Run a mapped command such as `/b-build`; use `/buck-loop` when you want its nested work and closed-set choice stages routed too.
8. **Eat:** the save notification names the selected profile and config path, and the next mapped stage runs with one of that stage's available configured ids and its configured thinking level. If the active profile, stage, or available-id set is missing, the command stops with a named `buckModels` error instead of using the host model.

Project stage presence overrides the user-global stage, including an explicitly empty model list. Omit a project stage to inherit that stage from the same user-global profile name.
