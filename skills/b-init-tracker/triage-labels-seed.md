# Triage Labels

Skills speak in terms of five canonical triage roles. This file maps those
roles to the actual label strings used in this repo's issue tracker.

| Canonical role | Label in this repo | Meaning |
|---|---|---|
| `needs-triage` | `needs-triage` | Maintainer needs to evaluate this issue |
| `needs-info` | `needs-info` | Waiting on reporter for more information |
| `ready-for-agent` | `ready-for-agent` | Fully specified, ready for an AFK agent |
| `ready-for-human` | `ready-for-human` | Requires human implementation |
| `wontfix` | `wontfix` | Will not be actioned |

Category axis, orthogonal to the state roles above — every triaged issue
carries one state role and one category role:

| Category | Meaning |
|---|---|
| `bug` | Something is broken |
| `enhancement` | New feature or improvement |

When a skill mentions a role (e.g. "apply the AFK-ready triage label"), use
the corresponding label string from the right-hand column.

**Inspect before applying**: labels are not guaranteed to exist in this
repo's tracker until created. Run `gh label list` (or the tracker's
equivalent) before applying any of them.

Edit the right-hand column to match whatever vocabulary this repo actually
uses if it differs from the defaults.
