---
name: b-design-palette
description: Generate a deterministic UI design-brief.jsonc color palette from one brand hex (and optional brief/styleguide overrides) using OKLCH math. Use when the user wants a design palette, theme tokens, or semantic UI colors for a web/app UI.
---

# b-design-palette: Deterministic UI palette → design-brief.jsonc

Turn a brand color (minimum) plus optional overrides from a design brief or styleguide into a full UI color system. **You extract inputs; the script owns every hex.**

This skill writes a **consumer** `design-brief.jsonc` for the project UI. That file is **not** `skills/_shared/design-brief.jsonc` (Buck’s own HTML-deliverable language). Do not overwrite the shared brief unless the user explicitly asks to restyle Buck HTML templates.

## Use when

- The user wants a design palette / theme / semantic color tokens for a web or app UI
- A styleguide or design brief names a brand color and you need scales + roles
- The user says “generate design-brief.jsonc” for colors

## Do not use when

- The user wants a qualitative UI brief from screenshots/layout (use `design-brief`)
- The user wants a living component styleguide (use `b-create-styleguide` / `b-create-ux-guide`)
- The task is restyling Buck’s internal HTML deliverables (edit `skills/_shared/design-brief.jsonc` + `render-design-tokens.ts` instead)

## Procedure

### 1. Extract inputs (LLM step)

From the user’s brief, styleguide, or message, collect:

| Input | Required | Default |
|---|---|---|
| Brand / primary hex | **yes** | — |
| Secondary hex | no | derived via scheme |
| Accent hex | no | derived via scheme |
| Scheme | no | `complementary` (`triadic`, `analogous`, `split-complementary`) |
| Neutral temperature | no | `cool` (`warm`, `pure`) |
| Status color overrides | no | fixed hues matched to brand L/C |
| Dark mode roles | no | on (`--dark`) |
| UI name / purpose / audience | no | `ui-palette` / omitted |

If only a prose brand description exists (“blue like Salesforce”), ask for one hex or propose a single candidate and confirm before calling the script.

Do **not** invent tint scales, on-colors, or dark mappings by hand.

### 2. Call the script (deterministic)

Requires `bun`. Run from the project that will own the output file. `--out` is relative to cwd.
Resolve `scripts/design-palette.ts` relative to this skill's directory (`<skill-dir>`):

```bash
bun <skill-dir>/scripts/design-palette.ts \
  --brand '#3366ff' \
  --scheme complementary \
  --neutral cool \
  --dark \
  --name 'My App' \
  --purpose 'Operator dashboard' \
  --audience 'internal users' \
  --out design-brief.jsonc
```

Useful flags:

- `--secondary`, `--accent` — lock derived hues
- `--status-success|--status-warning|--status-error|--status-info`
- `--no-dark` — light roles only
- `--stdout` — print JSONC instead of writing a file

### 3. Verify

1. Open the written `design-brief.jsonc`.
2. Confirm `inputs.brand` matches what the user approved.
3. Skim `contrast`: every `onPrimary` / `text/background` pair should show `"pass_aa": true` (ratio ≥ 4.5).
4. If the user dislikes secondary/accent, re-run with `--scheme` or explicit `--secondary` / `--accent` — do not hand-edit hex blocks.

## Output contract

Commented sections inside `design-brief.jsonc`:

1. **UI meta** — name, purpose, audience, `generated_by`
2. **Inputs used** — brand and overrides actually applied
3. **Scales** — brand, neutral, success/warning/error/info, secondary, accent (keys `50`–`950`)
4. **Semantic roles** — `light` and optional `dark` (background, surface, border, text*, primary/onPrimary, hover/active/selected/disabled, status fills, focusRing)
5. **Contrast report** — pair, foreground, background, ratio, `pass_aa`

## Related skills

- `design-brief` — qualitative UI extraction (layout, type, imagery)
- `b-create-styleguide` / `b-create-ux-guide` — styleguide / inventory workflows that can consume this palette
