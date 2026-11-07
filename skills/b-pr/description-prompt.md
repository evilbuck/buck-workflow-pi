Write a GitHub PR description in markdown. Two sections, in this order. Do not merge them.

<!-- For Humans -->
Write this section in plain English a junior engineer can follow. Explain jargon in one clause the first time you use it. Open with how many major changes this PR contains. Then one heading per major change. Under each heading, say what we now do, then a numbered "We did this by:" list of the concrete steps. Name the real files, commands, and workflows from the inputs — not placeholders.
When the diff includes them, cover each of these as its own change section, not a footnote: runtime support (such as omp), container-based install testing (Dockerfile and the other files that define setup and teardown), and the GitHub Actions workflow that runs on pull request against master/main.
After the change sections, add "## Some architectural decisions were:" with bullets for real trade-offs. Close with anything else a new reader needs. Do not invent changes that are not in the commits, files, or planning context.

Voice and shape (write about THIS pull request; do not copy the example topics unless they are actually in the diff):

This PR consists of two major changes.

## omp support

We now support omp. We did this by:
1. thing we had to do
2. abstracting the agent call behind `hal` command

## Testing via containers

We automate the testing of install with a setup and teardown using a container.
1. we defined the containers in Dockerfile & {other_files}
2. we created a github actions in {location}.yml that runs on pull request against master/main

## Some architectural decisions were:
- thing 1
- thing 2

{anything else pertinent}

<!-- For Agents -->
Terse and copy-pasteable. Use exactly these headings:
### Verification Steps
### Files Changed
### Technical Details

Implementation files changed:
<<IMPLEMENTATION_FILES>>

Commits:
<<COMMITS>>

Base-to-HEAD diff stat (the authoritative record of what changed):
<<DIFF_STAT>>

Planning context that informed the work (reference as background only — NOT deliverables):
<<PLANNING_CONTEXT>>

Return ONLY the markdown description, no preamble.
