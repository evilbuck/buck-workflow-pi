---
name: code-smells
description: Reference catalog of the 23 code smells AND an operational audit that fans out parallel subagents to scan a codebase for them, producing a buck-workflow-ready remediation report (impact, severity, effort).
---

# Code Smells Skill

Two modes:

1. **Reference** — look up a smell by name: symptoms, causes, treatment, payoff.
2. **Audit** — scan a codebase for all 23 smells in parallel and produce an actionable remediation report.

## Usage

### Reference mode

Ask about a specific smell or category:

> "What is Feature Envy?"
> "How do I fix a Long Method?"
> "List all Dispensables."

### Audit mode

> "Scan this codebase for code smells."
> "Run a code-smells audit on `src/`."
> "Find code smells, prioritized for remediation."

---

## Audit Workflow

Scan a codebase for all 23 smells by fanning out **one subagent per category** (5 categories). Each subagent reads its category's `docs/`, applies the detection playbook below, and returns structured findings. The orchestrator ranks findings by severity × impact and writes a buck-workflow-ready report.

### 1. Scope and setup

1. **Resolve scope.** Default = current working directory. Accept an explicit path/glob from the user (`src/`, `extensions/`, a single package). Record it in the report frontmatter.
2. **Create the subject folder:** `.context/YYYY-MM-DD.code-smells-scan/` with an `index.md` carrying `status: active`.
3. **Detect the knowledge graph.** Call `gitnexus_list_repos`. If it returns the target repo, the graph is available — prefer it for coupling/change smells. If not, fall back to `search` / `ast_grep` / git history (see playbook). Record `graph: available|fallback` in the report.
4. **Confirm language mix** (so structural thresholds and `ast_grep` patterns target the right languages). Use `find` to enumerate source file types under scope.

### 2. Execution model

The audit logic is agent-agnostic: **five category subagents run in parallel, each returns a list of findings.** The execution surface differs per harness.

**OMP (preferred).** Run the audit in the `eval` kernel via `parallel()` fanning out one `agent()` per category. The persistent kernel holds the category definitions and finding schema, accumulates results, and assembles the report in Python — no re-serializing across the boundary. A starter cell is provided below. Respect `budget.remaining()`; if budget is low, checkpoint the finished categories and mark the report `status: partial` with explicit `unscanned_categories` instead of dropping coverage. A buck-workflow-ready remediation report is complete only after all 5 categories / 23 smells have been scanned.

**Portable fallback (Pi, Claude Code, Codex, Goose).** Spawn one `task` per category in a single batch (`tasks[]` array, 5 items). Each assignment embeds the category's docs, the detection playbook, and the finding schema. Collect the five outputs and assemble the report.

> Canonical logic is identical either way: the subagent contracts, detection playbook, rubric, and report schema below are the source of truth. Only the fan-out primitive differs.

### 3. Category → subagent mapping

| Subagent | Category | Smells (read each `docs/` file) | Primary tool |
|---|---|---|---|
| **Bloaters** | Bloaters | Long Method, Large Class, Primitive Obsession, Long Parameter List, Data Clumps | `ast_grep` + `search` (structural metrics) |
| **OO Abusers** | Object-Orientation Abusers | Alternative Classes w/ Different Interfaces, Refused Bequest, Switch Statements, Temporary Field | `gitnexus` hierarchy + `ast_grep` |
| **Change Preventers** | Change Preventers | Divergent Change, Parallel Inheritance Hierarchies, Shotgun Surgery | git history + `gitnexus_detect_changes` |
| **Dispensables** | Dispensables | Comments, Duplicate Code, Data Class, Dead Code, Lazy Class, Speculative Generality | `gitnexus_impact` (dead/unused) + `ast_grep` |
| **Couplers** | Couplers | Feature Envy, Inappropriate Intimacy, Incomplete Library Class, Message Chains, Middle Man | `gitnexus_context` + `gitnexus_impact` |

### 4. Detection playbook

Starting heuristics — apply judgment, not blind thresholds. A finding needs **evidence** (tool output), not just a suspicion. Lower the bar to flag, raise the severity only when the smell sits in a high-churn or high-coupling area.

**Bloaters** (structural metrics — `ast_grep` / `search`):

| Smell | Signal | Flag | High |
|---|---|---|---|
| Long Method | method/function body length | > 30 lines | > 60 lines |
| Large Class | class/file size or method count | > 300 lines or > 20 methods | > 600 lines |
| Long Parameter List | parameter count | > 4 params | > 6 params |
| Primitive Obsession | primitives standing in for domain concepts (string for email/id/currency; repeated magic numbers) | any cluster | in public APIs |
| Data Clumps | 3+ params/fields recurring together across 2+ signatures | 2 sites | 4+ sites |

**OO Abusers** (`gitnexus` graph + `ast_grep`):

| Smell | Signal |
|---|---|
| Switch Statements | `switch` / `if-elif` chains keyed on a type discriminator; repeated `instanceof`/type checks |
| Refused Bequest | subclass that overrides/ignores most inherited members — `gitnexus` hierarchy + reference check shows inherited members unused |
| Alternative Classes w/ Different Interfaces | two classes with the same shape/responsibility but mismatched method names — `gitnexus_query` for similar callees |
| Temporary Field | field that is `null`/unset outside one or two methods — field-usage scan |

**Change Preventers** (git-history driven — the strongest signal here is *churn*, not structure):

| Smell | Signal |
|---|---|
| Divergent Change | one file touched by many *unrelated* commits/areas over time — `git log --name-only` clustering |
| Shotgun Surgery | one logical change forces edits across many files — commits whose diff spans many files for one concern |
| Parallel Inheritance Hierarchies | adding a subclass in one hierarchy requires adding one in another — `gitnexus` hierarchy comparison |

`gitnexus_detect_changes` maps recent git changes to flows; pair it with `git log` to quantify churn.

**Dispensables** (`gitnexus_impact` + `ast_grep`):

| Smell | Signal |
|---|---|
| Dead Code | symbol with zero downstream dependents — `gitnexus_impact direction=downstream depth=1` returns empty, or LSP `references` = 0 |
| Duplicate Code | near-identical blocks — normalize and compare; `ast_grep` for structurally identical subtrees |
| Data Class | only fields + accessors, < 2 behavior methods |
| Lazy Class | class doing too little to justify its existence — low member count, low fan-in |
| Speculative Generality | unused generic type params, unused hooks/strategies, "just in case" params |
| Comments | comments narrating *what* code does (vs *why*) — extract-method signal |

**Couplers** (coupling graph — `gitnexus_context` + `gitnexus_impact`):

| Smell | Signal |
|---|---|
| Feature Envy | a method's callees/field-access cluster in another class more than its own — `gitnexus_context` |
| Inappropriate Intimacy | two classes reach into each other's internals — bidirectional high coupling |
| Message Chains | `a.getB().getC().getD()` — `ast_grep` for 3+ chained member accesses |
| Middle Man | > 50% of a class's methods are pure delegation |
| Incomplete Library Class | extending/monkey-patching/wrapping an external library to add a missing method |

### 5. Finding schema (subagent return contract)

Every subagent returns a list of findings. On OMP, pass this as `schema=` to `agent()`; on portable fallback, require the same shape in each `task` assignment's acceptance criteria.

```
finding = {
  smell:        "<Smell Name>",            # from docs/
  category:     "<Category>",
  location:     "path/to/file.ts:42",      # file:line or symbol
  severity:     "critical|high|medium|low",
  impact:       "<why it matters here: blast radius + churn>",
  effort:       "XS|S|M|L|XL",
  evidence:     "<tool output proving the smell>",
  treatment:    "<primary refactoring from the smell's docs>",
  confidence:   "high|medium|low"
}
```

A finding with no `evidence` is a hypothesis, not a finding — either gather evidence or drop it.

### 6. Severity · Impact · Effort rubric

Subagents apply this so findings are consistent across categories.

**Severity** (risk to codebase health):

| Level | Means |
|---|---|
| `critical` | causes bugs/breakage, blocks active development, or a correctness/security risk |
| `high` | sits in a high-churn file with a large blast radius (many dependents) |
| `medium` | real maintenance cost, localized but in an actively-changed area |
| `low` | isolated, low-churn, cosmetic |

**Impact** (free-text, must cite two inputs):

1. **Blast radius** — downstream dependents (`gitnexus_impact direction=downstream`) or reference count.
2. **Churn** — how often the location changes (`git log` over ~90 days). High churn + smell = severity escalation.

**Effort** (remediation cost):

| Size | Effort | Example |
|---|---|---|
| `XS` | < 1 h | delete dead code, extract a small method |
| `S` | 1–4 h | extract method/class, single-file refactor |
| `M` | ~1 day | introduce parameter object, multi-file extract |
| `L` | 2–3 days | cross-class refactor, hierarchy change |
| `XL` | 1 week+ | architectural refactor, replace inheritance with delegation |

### 7. Report assembly

The orchestrator (kernel on OMP, main agent on portable) collects all findings, **deduplicates** (a hotspot often triggers several smells — merge into one finding listing each smell), **ranks** by severity then by impact/effort ratio, and writes:

**`.context/YYYY-MM-DD.code-smells-scan/report.md`**

```markdown
---
type: code-smells-report
status: complete|partial
unscanned_categories: [] # non-empty only when status: partial
date: YYYY-MM-DD
scope: "<scanned path>"
graph: available|fallback
total_findings: N
by_severity: { critical: a, high: b, medium: c, low: d }
by_effort: { XS: .., S: .., M: .., L: .., XL: .. }
top_offenders: ["path/to/file.ts", ...]
---

# Code Smells Audit — <project/scope>

## Summary
<2–4 sentences: overall health, the dominant smell categories, the single highest-leverage fix.>

## Prioritized Findings

### 1. <Smell(s)> — <location>
- **Severity:** high
- **Impact:** <blast radius + churn, with counts>
- **Effort:** M (~1 day)
- **Evidence:** <tool output / gitnexus ref>
- **Treatment:** <refactoring from docs/ + concrete first step>
- **Confidence:** high

### 2. ...

## Quick Wins (high severity, XS–S effort)
<bullet list — the do-these-first set>

## Deferred / Low Confidence
<findings worth noting but not actioning now>

## Methodology
- Tools: <gitnexus | search/ast_grep + git history>
- Categories scanned: all 5 (23 smells)
- Coverage: <files scanned, languages>
```

Ranking rule: `critical` > `high` > `medium` > `low`; within a level, lower effort floats up (impact per hour).

### 8. Visual review (optional)

After `report.md` is written, **ask the user** whether they want a visual synopsis — do not assume:

> Report written to `.context/YYYY-MM-DD.code-smells-scan/report.md` (**N** findings: **a** critical, **b** high, …).
> Would you like a `b-blueprint` generated to review the findings visually?

If yes, run `b-blueprint` against the report. It renders a single-page HTML synopsis — severity distribution, top-offender hotspots, Mermaid diagrams of the coupling/churn clusters, and a per-finding treatment card — so the audit can be scanned at a glance before committing to remediation. This is a review aid, not a prerequisite: if the user declines, proceed straight to the handoff below.

### 9. Buck-workflow handoff

The report is the entry point for remediation. Present both routes; OMP users get the goal-mode path.

**OMP (preferred) — goal mode:**
```
/goal set buck-workflow code-smells-scan-YYYY-MM-DD
```
The objective is "remediate the code smells in `.context/YYYY-MM-DD.code-smells-scan/report.md`, ordered by severity then effort." Goal mode enforces the 6-step completion-audit: each finding closed needs direct current-state evidence (a passing test, a diff), not a checkbox. Suggested budget goes in `omp_goal_budget` when the plan declares it.

**Portable — b-plan:**
```
/b-plan
```
b-plan reads the report as research input and turns the prioritized findings into a remediation plan (one phase per severity tier, or per top-offender file). The report's `treatment` + `effort` fields map directly to plan steps and estimates.

> Whichever route, **do not fix everything at once.** Start with the Quick Wins tier (high severity, XS–S effort) to build momentum and validate the audit, then plan the L/XL refactors as discrete phases.

### OMP starter cell

Drop into the `eval` kernel (OMP workflow mode). Edit `SCOPE`, `CATEGORIES`, and the repo id, then run.

```python
import json, datetime

SCOPE = "src"                      # path/glob to audit
TODAY  = datetime.date.today().isoformat()
SUBJECT = f".context/{TODAY}.code-smells-scan"

# Finding schema — every agent() returns a list of dicts matching this shape.
# additionalProperties: false is required by the eval kernel; see
# docs/eval-kernel.md § Schemas.
FINDING_SCHEMA = {
    "type": "object",
    "properties": {
        "smell":       {"type": "string"},
        "category":    {"type": "string"},
        "location":    {"type": "string"},
        "severity":    {"type": "string", "enum": ["critical","high","medium","low"]},
        "impact":      {"type": "string"},
        "effort":      {"type": "string", "enum": ["XS","S","M","L","XL"]},
        "evidence":    {"type": "string"},
        "treatment":   {"type": "string"},
        "confidence":  {"type": "string", "enum": ["high","medium","low"]},
    },
    "required": ["smell","category","location","severity","impact","effort","evidence","treatment","confidence"],
    "additionalProperties": False,
}
LIST_SCHEMA = {"type": "array", "items": FINDING_SCHEMA}

# One entry per category subagent. `docs` lists the smell reference files
# the subagent MUST read before scanning; `tools` is its preferred toolset.
CATEGORIES = [
    {"name": "Bloaters",          "docs": ["long-method","large-class","primitive-obsession","long-parameter-list","data-clumps"],         "tools": "ast_grep, search (line/param/class-size metrics)"},
    {"name": "OO Abusers",        "docs": ["alternative-classes-with-different-interfaces","refused-bequest","switch-statements","temporary-field"], "tools": "gitnexus hierarchy + ast_grep"},
    {"name": "Change Preventers", "docs": ["divergent-change","parallel-inheritance-hierarchies","shotgun-surgery"],                          "tools": "git log + gitnexus_detect_changes"},
    {"name": "Dispensables",      "docs": ["comments","duplicate-code","data-class","dead-code","lazy-class","speculative-generality"],       "tools": "gitnexus_impact + ast_grep"},
    {"name": "Couplers",          "docs": ["feature-envy","inappropriate-intimacy","incomplete-library-class","message-chains","middle-man"], "tools": "gitnexus_context + gitnexus_impact"},
]

def category_prompt(cat):
    refs = "\n".join(f"- skill://code-smells/docs/{d}.md" for d in cat["docs"])
    return f"""You are scanning {SCOPE!r} for code smells in the **{cat['name']}** category.

FIRST read these reference definitions (symptoms + treatment):
{refs}

Detection strategy: {cat['tools']}. Apply the rubric from skill://code-smells.
Detect gitnexus availability with gitnexus_list_repos; if unavailable, fall back
to search/ast_grep/git history. Every finding MUST cite tool output as evidence;
a finding without evidence is a hypothesis — drop it.

Return ONLY a JSON array of findings matching the schema. Rank within the
category by severity (critical>high>medium>low), then by impact/effort."""

# Fan out — one agent() per category, bounded by the session pool.
phase(f"Scanning {len(CATEGORIES)} smell categories in {SCOPE}")
all_findings = parallel([
    (lambda c=c: agent(category_prompt(c), schema=LIST_SCHEMA, label=c["name"]))
    for c in CATEGORIES
])

# Flatten, then the main agent dedupes + ranks + writes report.md.
report = [f for batch in all_findings for f in batch]
log(f"{len(report)} raw findings across {len(CATEGORIES)} categories")
write(f"{SUBJECT}/findings.json", json.dumps(report, indent=2))
```

After the cell returns `findings.json`, the main agent deduplicates hotspots, applies the ranking rule, and writes `report.md` per §7.

---

## Smell Reference

### Bloaters
Code, methods, and classes grown to unmanageable size.

| Smell | Primary Treatment |
|---|---|
| [Long Method](docs/long-method.md) | Extract Method |
| [Large Class](docs/large-class.md) | Extract Class / Extract Subclass |
| [Primitive Obsession](docs/primitive-obsession.md) | Replace Data Value with Object |
| [Long Parameter List](docs/long-parameter-list.md) | Introduce Parameter Object |
| [Data Clumps](docs/data-clumps.md) | Extract Class / Introduce Parameter Object |

### Object-Orientation Abusers
Incomplete or incorrect application of OOP principles.

| Smell | Primary Treatment |
|---|---|
| [Alternative Classes with Different Interfaces](docs/alternative-classes-with-different-interfaces.md) | Rename Method / Move Method |
| [Refused Bequest](docs/refused-bequest.md) | Replace Inheritance with Delegation |
| [Switch Statements](docs/switch-statements.md) | Replace Conditional with Polymorphism |
| [Temporary Field](docs/temporary-field.md) | Extract Class / Introduce Null Object |

### Change Preventers
Changes in one place force changes in many others.

| Smell | Primary Treatment |
|---|---|
| [Divergent Change](docs/divergent-change.md) | Extract Class |
| [Parallel Inheritance Hierarchies](docs/parallel-inheritance-hierarchies.md) | Move Method / Move Field |
| [Shotgun Surgery](docs/shotgun-surgery.md) | Move Method / Inline Class |

### Dispensables
Unnecessary code whose absence would be an improvement.

| Smell | Primary Treatment |
|---|---|
| [Comments](docs/comments.md) | Extract Method / Rename Method |
| [Duplicate Code](docs/duplicate-code.md) | Extract Method / Pull Up Method |
| [Data Class](docs/data-class.md) | Move Method / Encapsulate Field |
| [Dead Code](docs/dead-code.md) | Delete it |
| [Lazy Class](docs/lazy-class.md) | Inline Class / Collapse Hierarchy |
| [Speculative Generality](docs/speculative-generality.md) | Collapse Hierarchy / Inline Class |

### Couplers
Excessive coupling or excessive delegation.

| Smell | Primary Treatment |
|---|---|
| [Feature Envy](docs/feature-envy.md) | Move Method / Move Field |
| [Inappropriate Intimacy](docs/inappropriate-intimacy.md) | Move Method / Replace Delegation with Inheritance |
| [Incomplete Library Class](docs/incomplete-library-class.md) | Introduce Foreign Method / Local Extension |
| [Message Chains](docs/message-chains.md) | Hide Delegate / Extract Method |
| [Middle Man](docs/middle-man.md) | Remove Middle Man / Inline Method |

## Source

All content adapted from [Refactoring.Guru](https://refactoring.guru/refactoring/smells) — the definitive catalog of code smells by Alexander Shvets. Licensed for reference use.
