# Inspect project token use

Show attributed token totals and estimated cost for the current Git project, grouped by branch and provider/model.

## Steps

1. Open OMP in the project checkout you want to inspect and complete at least one assistant turn after Buck Workflow is loaded. Attribution is forward-only.
2. Run `/tokens`. If another extension already owns `/tokens`, run `/token-use` instead; it accepts the same argument.
3. To inspect one branch in the current project, run `/tokens <exact-branch-name>` (or `/token-use <exact-branch-name>` after a collision). If the argument is not an exact current-project branch, the command treats it as a project-key substring and lists matching projects.
4. Treat every dollar amount as an estimate copied from OMP's normalized usage data. `unavailable` means the recorded turn had no cost value.
5. **Eat:** the report names the expected project, shows a non-zero token total, and lists the expected branch and provider/model. A project-substring query instead lists the matching project keys.
