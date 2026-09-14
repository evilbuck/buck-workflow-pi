#!/usr/bin/env python3
"""Render an analysis.json into a single self-contained HTML report.

Usage:
    python scripts/render.py analysis.json -o report.html

No third-party dependencies. Validates the analysis before rendering and
fails loudly with every problem it found, so you fix the JSON once.
"""

import argparse
import json
import sys
from pathlib import Path

ACTORS = {"script", "llm", "user", "tool"}
TRANSITION_KINDS = {"linear", "branch", "loop", "abort"}
MUTATION_KINDS = {"create", "overwrite", "delete", "external"}
INPUT_SOURCES = {"user", "file", "env", "tool"}


def validate(a):
    """Return a list of human-readable problems. Empty list means good."""
    p = []

    ident = a.get("identity")
    if not isinstance(ident, dict):
        p.append("identity: missing (need an object with at least `name`)")
    elif not ident.get("name"):
        p.append("identity.name: missing")

    steps = a.get("steps")
    if not isinstance(steps, list) or not steps:
        p.append("steps: missing or empty (need at least one step)")
        return p

    ids = []
    for i, s in enumerate(steps):
        where = f"steps[{i}]"
        if not isinstance(s, dict):
            p.append(f"{where}: not an object")
            continue
        sid = s.get("id")
        if not sid:
            p.append(f"{where}.id: missing")
        else:
            ids.append(sid)
        if not s.get("label"):
            p.append(f"{where}.label: missing")
        actor = s.get("actor")
        if actor not in ACTORS:
            p.append(f"{where}.actor: {actor!r} is not one of {sorted(ACTORS)}")
        if not s.get("plain_english"):
            p.append(f"{where}.plain_english: missing — this is the whole point of the report")

    dupes = {i for i in ids if ids.count(i) > 1}
    if dupes:
        p.append(f"steps: duplicate ids {sorted(dupes)}")
    known = set(ids)

    for i, t in enumerate(a.get("transitions", []) or []):
        where = f"transitions[{i}]"
        if not isinstance(t, dict):
            p.append(f"{where}: not an object")
            continue
        for end in ("from", "to"):
            ref = t.get(end)
            if ref not in known:
                p.append(f"{where}.{end}: {ref!r} is not a step id")
        kind = t.get("kind", "linear")
        if kind not in TRANSITION_KINDS:
            p.append(f"{where}.kind: {kind!r} is not one of {sorted(TRANSITION_KINDS)}")

    for i, m in enumerate(a.get("mutations", []) or []):
        kind = (m or {}).get("kind")
        if kind not in MUTATION_KINDS:
            p.append(f"mutations[{i}].kind: {kind!r} is not one of {sorted(MUTATION_KINDS)}")

    for i, inp in enumerate(a.get("inputs", []) or []):
        src = (inp or {}).get("source")
        if src not in INPUT_SOURCES:
            p.append(f"inputs[{i}].source: {src!r} is not one of {sorted(INPUT_SOURCES)}")

    return p


def main():
    ap = argparse.ArgumentParser(description="Render a skill analysis into an HTML report.")
    ap.add_argument("analysis", help="path to analysis.json")
    ap.add_argument("-o", "--output", default="skill-report.html", help="output .html path")
    ap.add_argument(
        "--template",
        default=str(Path(__file__).resolve().parent.parent / "assets" / "template.html"),
        help="override the report template",
    )
    args = ap.parse_args()

    try:
        analysis = json.loads(Path(args.analysis).read_text(encoding="utf-8"))
    except FileNotFoundError:
        sys.exit(f"No analysis file at {args.analysis}")
    except json.JSONDecodeError as e:
        sys.exit(f"{args.analysis} is not valid JSON: {e}")

    problems = validate(analysis)
    if problems:
        sys.exit(
            "The analysis has {} problem(s):\n  - {}".format(
                len(problems), "\n  - ".join(problems)
            )
        )

    template = Path(args.template).read_text(encoding="utf-8")
    payload = json.dumps(analysis, ensure_ascii=False).replace("</", "<\\/")
    title = analysis["identity"]["name"]

    html = template.replace("__ANALYSIS_JSON__", payload).replace("__TITLE__", title)

    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html, encoding="utf-8")
    print(f"Wrote {out} ({len(html):,} bytes, {len(analysis['steps'])} steps)")


if __name__ == "__main__":
    main()
