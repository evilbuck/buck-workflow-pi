---
name: product-tour
description: Design and ship a first-run guided product tour over real UI. Stack-agnostic — works in any app. Use when adding onboarding tours, walkthroughs, spotlight tips, or demo-event guided flows; when the user says "tour", "walkthrough", "guided onboarding", or "teach the user this flow".
---

# product-tour: Guided Product Walkthroughs

Design and implement a **first-run tour that teaches by doing**, overlaid on real product UI — not a mock, not a slide deck.

This skill is **stack-agnostic**. It defines product rules, step structure, state, and verification. Map those onto whatever the host app already uses (Stimulus, React, Vue, Rails, SPA, mobile web, etc.). Do not invent a framework; reuse the project's patterns.

## When to use

- First-time guest/host/admin needs to learn 2–6 critical actions
- Demo surface, trial event, or specially gated onboarding path
- Existing UI already works; tour should highlight it, not replace it
- User asks for a walkthrough, guided tour, spotlight tips, or "teach them X"

## When not to use

- Permanent help docs or empty-state copy is enough
- Flow needs a full wizard that owns state (use a real multi-step form)
- Every screen needs explanation (tour fatigue) — pick the one critical path
- Feature isn't shipped yet (tour a working product, not a mockup)

## Core principles

1. **Teach by doing.** Advance when the user performs the real action. Prefer no Next button. Optional Continue only when a step is skippable (e.g. crop is optional).
2. **Don't hijack the product.** Tour chrome highlights and explains. App controllers/handlers own camera, forms, uploads, navigation.
3. **Stay inside the frame.** Tooltips and rings live in the app shell / viewport the user actually sees (phone frame, app max-width). Never spill off-screen.
4. **No full-screen blackout by default.** Dim scrims block the product. Default to ring + tooltip only. Add dim only if the user explicitly wants focus mode.
5. **Survive reloads.** Persist step + dismissed/done in client storage (or equivalent). Full page navigations must not strand the tour.
6. **Dismiss is allowed.** Save step; show a small resume control. Don't trap people.
7. **End cleanly.** Finale screen or quiet exit. Mark done so the tour doesn't nag.
8. **Gate narrowly.** One demo surface / role / flag — not every page on day one.

## Output of a tour session

Produce, in the host project's normal locations:

1. **Plan** (if not already planned) — steps, gates, advance rules, risks
2. **Implementation** — tour controller/component + hooks into real UI
3. **Thin automated check** — mount/gate test (don't OS-automate camera)
4. **Manual verification list** — the real path a human walks
5. **Durable note** — decisions + how to add the next tour

Prefer the project's workflow (e.g. Buck `.context/` plans) when present; otherwise keep notes where the team already keeps them.

---

## Phase 0 — Question the user (required)

**Do not design steps, open a PR, or write tour code until intake is done.**
This phase is an interview. The user often has a vague urge ("add a tour") —
your job is to turn that into a sharp teach-by-doing plan, or to talk them
*out* of a tour when something else is better.

### How to interview

- **One question at a time.** Wait for the answer before the next.
- **Re-evaluate remaining gaps** after every answer — don't march a fixed script
  if they already answered three things in one reply.
- **Offer concrete options** when choices are real (gate, finale, dismiss).
- **Push back** when a tour is the wrong tool, too long, or hijacks the product.
- **Read the product first** when the surface exists — then ask smarter questions
  about real controls, not imaginary screens.
- **Stop** when you can fill the Step Table and Locks without guessing.
- **Echo back** a short summary ("So: first-time guests on the demo event learn
  camera → crop → filter → send, action-only, congrats finale. Yes?") and get
  a yes before Phase 1 is "locked."

### Opening — intent (always start here)

If the user hasn't already made this obvious, ask some form of:

> What should someone be able to **do** after this tour that they couldn't
> (or wouldn't) do before?

Follow with whichever still unclear:

- Is this **first-run teaching**, a **demo/sales path**, **feature announcement**,
  or **recovery** ("you're stuck, try this")?
- Is the underlying flow **already shipping and usable** without a tour?
- Success looks like…? (completed action, activated feature, less support load)

If they only want prettier empty-state copy or a changelog banner, **stop** and
recommend that instead of a tour.

### Challenge — should this be a tour at all?

Ask or decide aloud when relevant:

| Signal | Prefer instead |
|--------|----------------|
| One tip, one screen | Inline helper / empty state |
| User must enter lots of data | Real wizard / form |
| Feature not built yet | Build the feature; tour later |
| "Explain the whole app" | Cut to one critical path or docs |
| Audience already power users | Skip, or progressive disclosure |

Say so plainly: "This sounds like empty-state copy, not a tour — want that?"

### Discovery questions (ask only what's still missing)

Work through these buckets. Skip any the user already answered.

**1. Audience**
- Who is this for on first encounter? (guest, host, staff, trial user…)
- First visit only, or every time until success?
- Any segment that must **never** see it?

**2. Surface / gate**
- Exact URL, role, flag, or demo entity?
- Why not the whole app?
- How do we detect "eligible" without a heavy new data model?

**3. Verbs to teach (the heart)**
- List 2–6 **actions** (verbs), in order.
- For each: what control do they touch today?
- What does "they did it" look like in the product (event, navigation, visible state)?
- Which steps are optional / skippable?

If they list screens ("show them the dashboard"), translate: "What should they
*do* on the dashboard?" Keep asking until you have verbs.

**4. Advance rules**
- Real action only (recommended)?
- Optional Continue on which steps, if any?
- Anything that must **never** advance on Next alone?

**5. Interruptions**
- Can they dismiss mid-tour?
- Resume chip, or just stop?
- What if they refresh / open a new tab mid-flow?

**6. Finale**
- Congrats screen, return to product, or spotlight a final real screen?
- Is that final screen actually ready (auth, data, design)? If not → congrats now.
- Primary CTA after success?

**7. Replay & nagging**
- Force replay how? (query param, settings, never)
- Soft reminder later or hard done-is-done?

**8. Feel**
- Ring + tooltip only (default) or dim scrim?
- Copy tone: terse coach, playful, formal?
- Mobile frame / desktop — which is canonical?

**9. Out of scope (name it)**
- Live camera pipelines, multi-language, host-configurable copy, every-event tours…
- Confirm what we are **not** building this round.

### Synthesis gate (before any step table or code)

Post a compact brief and wait for confirmation:

```
Audience: …
Gate: …
Verbs (in order): 1 … 2 … 3 …
Advance: action-only | action + Continue on [steps]
Dismiss/resume: …
Finale: …
Replay: …
Visual: ring-only | dim
Out of scope: …
```

Only after the user confirms (or explicitly says "you choose defaults") proceed
to Phase 1. If they say "just build something," apply **Core principles** as
defaults, state those defaults in one line, and continue.


---

## Phase 1 — Step table (required artifact)

Write a step table before coding. Keep it short.

| # | Teach (verb) | Real control | Advances when | Optional skip? |
|---|--------------|--------------|---------------|----------------|
| 1 | Open camera | shutter button | preview opens | no |
| 2 | Crop | crop chips / stage | ratio picked or pan | Continue |
| 3 | Filter | film strip | preset picked | no |
| 4 | Send | primary send | upload accepted | no |
| — | Finale | congrats route | landed / Done | — |

Rules for the table:

- **Teach** is a user verb, not "show them the toolbar"
- **Real control** is an existing UI element (or one you add as a stable hook)
- **Advances when** is an observable product event, not a timer
- Max **6** teach steps before finale; if more, split tours or cut

Also lock:

```
Gate: <who/where>
Storage key prefix: <app>:tour:<name>:v1
Done key: …:done
Step key: …:step
Dismissed key: …:dismissed
Force replay: <query param or none>
Finale: <route or inline>
```

---

## Phase 2 — Architecture (map to the stack)

### Separation of concerns

| Layer | Owns | Must not own |
|-------|------|--------------|
| **Tour controller/component** | step index, spotlight position, tooltip copy, storage, dismiss/resume | business uploads, auth, form validation |
| **Product UI** | real actions, real state machines | tour step numbers |
| **Bridge** | tiny events or callbacks product already emits ("preview opened", "saved") | polling internal private state |

**Bridge pattern (preferred):** product code dispatches a named app event at existing seams (`preview-opened`, `item-saved`). Tour listens. Product does not import tour modules.

### Chrome

Minimal chrome:

- **Ring** around the active control (pointer-events: none)
- **Tooltip** with title, short text, progress, optional Continue, dismiss
- **Resume chip** when dismissed mid-tour
- **Finale** as its own simple screen (not a fifth spotlight if the UI isn't ready)

Default visual:

- No full-viewport dim
- Tooltip clamped inside app shell
- Respect `prefers-reduced-motion`

### Positioning

1. Resolve target(s) via stable hooks (`data-tour-anchor="camera"`) with CSS fallbacks
2. Measure bounding box relative to the **app frame**, not the browser viewport, when the product is framed (mobile shell, centered column)
3. Prefer below target; flip above if it would clip; clamp all edges
4. If target is hidden/zero-size: hide ring, park tooltip center (or skip to next valid step) — **do not** force app navigation just to show a tip

### State machine (conceptual)

```
idle
  → active(step)
      → active(step+1) on product event or allowed Continue
      → dismissed(step) on dismiss  → resume chip
      → finale on last success
      → done (terminal)
  → done (skip mount)
force-replay overrides done → active(0)
```

Persist at least: `step`, `done`, `dismissed`. Version the key prefix (`v1`) so you can break storage safely later.

### Navigation after a real action

If the product already navigates after success (upload settle, save redirect):

- Persist the next step **before** navigation
- Prefer tour-owned navigation only when the finale is a different route
- Avoid racing two navigations (product settle visit + tour visit). One owner: either product is redirected by tour (`preventDefault` / cancelable event), or tour only rehydrates on the destination.

### Finale

When the post-action UI isn't tour-ready (auth-gated admin, unfinished screen):

- Ship a **simple congratulations screen** in the default product theme
- Mark done on land
- One clear CTA back into the product
- Park the fancy destination for a later tour

Do not block shipping the tour on a half-built manage/admin surface.

---

## Phase 3 — Implementation checklist

Stack-agnostic work items. Translate names to the project.

- [ ] **Gate** — server or client: only mount tour root when eligible
- [ ] **Hooks** — stable anchors on real controls (`data-tour-anchor` or project equivalent)
- [ ] **Bridge events** — emit from product seams; tour listens on window/bus
- [ ] **Tour module** — step table, storage, spotlight, tooltip, dismiss/resume
- [ ] **CSS/tokens** — use the project's design tokens; no one-off hex soup in markup
- [ ] **Finale route/view** — congrats (or real destination when ready)
- [ ] **Force replay** — optional query/flag clears done and restarts
- [ ] **Thin test** — eligible surface mounts tour; ineligible does not
- [ ] **Styleguide/doc note** — if the project has a living styleguide, add a static chrome sample

### Rails + Stimulus example mapping (reference only)

Use only when the host app is Rails/Stimulus-like. Other stacks: same roles, different files.

| Role | Typical place |
|------|----------------|
| Gate | controller local / policy |
| Hooks | ERB `data-*-anchor` |
| Bridge | `window.dispatchEvent(new CustomEvent('app:tour-…'))` |
| Tour module | Stimulus controller |
| Storage | `sessionStorage` |
| Finale | public GET route + simple view |
| Test | integration/system assert mount |

### React/Vue example mapping (reference only)

| Role | Typical place |
|------|----------------|
| Gate | route loader / feature flag / user property |
| Hooks | `data-tour-anchor` or refs registry |
| Bridge | event bus, custom events, or store signals product already emits |
| Tour module | small client component, portal into app shell |
| Storage | `sessionStorage` or existing prefs API |
| Finale | route |
| Test | component/route test for mount gate |

---

## Phase 4 — Verification

### Automated (thin)

- Eligible surface + force flag → tour root present
- Ineligible surface → tour root absent
- Optional: storage done → no auto-start (if easy in JS test env)

Skip OS camera/file-picker automation unless the project already has it.

### Manual (primary)

1. Fresh profile / cleared site data → tour auto-starts on step 1
2. Optional Continue (if any) does **not** perform the product action
3. Real action advances tip; wrong-step events are ignored
4. Dismiss → tip gone, resume chip visible, step preserved
5. Resume → same step
6. Final success → finale screen, done set
7. Reload without force → no tour (or resume chip only if dismissed)
8. Force replay → starts at step 1 even if done
9. Tooltip stays inside app frame at mobile width
10. Reduced motion: no endless pulse (if you animate the ring)

### Browser smoke script (adapt selectors)

```
open eligible URL with force replay
assert tip title step 1
perform or simulate product event for step 1
assert tip advances
dismiss → assert resume chip
resume → assert tip returns
simulate final success event
assert navigation or finale
assert done persistence
```

---

## Anti-patterns (learned the hard way)

| Don't | Do instead |
|-------|------------|
| Full-screen black dim "for focus" | Ring + tooltip; product stays usable |
| Next through the whole tour | Advance on real actions; Continue only when skip is intentional |
| Spotlight a control the user can't use yet | Park tip or wait for the product state that reveals it |
| Tour imports product internals / polls private state | Bridge events at public seams |
| Two navigations after success | One owner; cancelable event or single redirect |
| Stale `done` key blocks force replay | Force clears done |
| Finale is an unfinished auth-gated admin page | Congrats screen now; real page later |
| Tooltip `position: fixed` to the browser viewport in a centered phone shell | Position relative to the app shell |
| 10-step encyclopaedia | 2–6 verbs max |
| Hard-coding copy in tests and views twice | Shared labels if the project already does that |

---

## Interview → ship flow

```
1. Interview (Phase 0)
2. Write step table + gate/storage/finale locks
3. Map layers onto this stack (Phase 2)
4. Implement smallest vertical slice: step 1 mount + one advance event
5. Add remaining steps + dismiss/resume
6. Add finale
7. Thin gate test + manual path
8. Note how to add tour #2 (new step table + gate; reuse chrome)
```

## Adding a second tour later

1. New step table + storage key name (`…:host-dashboard:v1`)
2. New gate (different route/role)
3. Reuse chrome/CSS/controller pattern
4. Do not overload one step list with unrelated audiences

## Done means

- [ ] Step table locked and matched in code
- [ ] Real actions advance; tour doesn't fake product state
- [ ] Dismiss/resume or explicit decision to omit
- [ ] Finale marks done
- [ ] Gate test green
- [ ] Manual path walked once on the target device width
- [ ] Short durable note for the next engineer

## Suggested kickoff prompt

> Tour for `<audience>` on `<surface>`. They must learn: `<verbs>`.  
> Gate: `<rule>`. Finale: `<congrats | real page>`.  
> Stack: whatever this repo uses. Follow `product-tour`.
