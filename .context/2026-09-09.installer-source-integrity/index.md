---
status: active
date: 2026-09-09
subject: 2026-09-09.installer-source-integrity
topics: [installer, symlink, source-root, verify, bootstrap-drift]
---

# Installer source integrity

Make `scripts/install.mjs` able to *report* and *warn about* which checkout each harness surface resolves to, so a split install cannot happen silently.

## Artifacts

- [`plan-installer-source-integrity.md`](plan-installer-source-integrity.md) — implementation plan

## Background

- Backlog item: [`../backlog/items/installer-source-split-detection.md`](../backlog/items/installer-source-split-detection.md)
- Incident record: [`../memory/install-source-consolidation-2026-09-09.md`](../memory/install-source-consolidation-2026-09-09.md)
