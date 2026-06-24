# Backlog — b-create-ux-guide / b-create-styleguide

## Schema reconciliation (open)

**Why**: `b-create-styleguide` consumes `docs/ux-design-brief.json` as a seed inventory and reconciles it by `component.id`. The handoff is currently field-converting: styleguide's schema requires `_managed` (top-level), `status` (per-component, values `active|draft|deprecated`), and `whenToUse` / `whenNotToUse` (per-component). Ux-guide's documented schema has none of these. Until they're optional in ux-guide, every handoff either (a) silently adds fields during consumption or (b) loses them on round-trip.

**Open question**: should these be *optional* in ux-guide's documented schema (zero-cost when standalone, populated when consuming) or *required* (forces ux-guide to think about them on every run)?

**Proposed change** — make optional in ux-guide's `docs/ux-design-brief.json` schema:

- Top-level `_managed`: `null` when standalone, populated with `{ "managedBy": "b-create-styleguide", "version": 1, "lastUpdated": "YYYY-MM-DD" }` when handed off.
- Per-component `status`: optional, default `"active"`. ux-guide never sets it; styleguide sets it during reconciliation.
- `whenToUse` / `whenNotToUse`: already in ux-guide's schema as required. No change.

**Blocked by**: nothing. Can be done as a one-paragraph schema doc edit + an example in ux-guide's "Top-level shape" block.

**Related**: cross-reference edits between ux-guide and styleguide completed 2026-06-24. Conditional handoff offers in place. Schema reconciliation is the only loose thread to make the auto-handoff (if ever wanted) field-additive rather than field-converting.

**Next step** (when picked up): edit `b-create-ux-guide/SKILL.md` Phase 6 to mark `_managed` and `status` as optional in the schema block; add a short paragraph in the closeout noting whether ux-guide ran standalone or was consumed by styleguide.

**Status**: open, low priority. Doesn't block the existing one-way handoff (the offer in styleguide's Phase 0 already works as a manual step).
