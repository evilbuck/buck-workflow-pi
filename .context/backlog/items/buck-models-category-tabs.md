---
title: Replace sequential model setup with category tabs
status: active
priority: medium
created: 2026-11-05
updated: 2026-11-05
completed: null
related:
  - .context/2026-11-05.buck-models-category-tabs/plan-category-tabs.md
  - extensions/buck-models/model-picker.ts
  - extensions/buck-models/index.ts
  - docs/howto/configure-buck-model-profiles.md
---

# Replace sequential model setup with category tabs

Implement the bounded plan in `.context/2026-11-05.buck-models-category-tabs/plan-category-tabs.md`: one tab per canonical stage, selected models and searchable catalog in two columns, per-tab shortcut for the existing thinking choices, and a final Save tab containing one Save button.

Preserve untouched categories and project/global inheritance, notes, unavailable ids, scope/profile prompts, activation, and final write confirmation. Keep the existing save-model category distinct from the final Save action. No schema or runtime picker changes.

Verification: focused editor/command behavior tests, live isolated Pi/OMP TUI and config-persistence smoke, and the durable guardrails contract. This item records planned work; implementation is not complete.
