# Run the /code-review command

Run the isolated review→fix→re-review loop on the current git checkout and read its terminal report.

## Steps

1. Confirm you are inside the git checkout you want reviewed. The command refuses bare repos.
2. Decide persona and reviewer model. Defaults are `balanced` and that persona's `default_model`. Override with `--persona <name>` and `--reviewer-model <selector>`. Optionally pass `--context "..."` to append domain guidance, or `--replace-reviewer-prompt @file.md` to override editable guidance (the invariant envelope stays).
3. Decide the minimum blocking rating and max passes. Defaults are `medium` and `3`. Override with `--min-blocking <level>` and `--max-passes <N>`.
4. Run `/code-review`. The command fetches `origin/<base>`, rebases, prompts once for untracked paths on a dirty start, then runs Reviewer → Fixer → a fresh Reviewer.
5. When the command finishes, open `.context/<subject>/review-iteration-<run-id>.md`.
6. **Eat:** the report file exists, lists every pass with the persona and effective model/thinking level, lists each finding with rating + hardness + reproduction status, and the final status line shows `clean`, `blocked`, `exhausted`, `cancelled`, or `failed`.

If a non-clean run left runtime you no longer need, [prune it](prune-code-review-runtime.md).
