import { describe, expect, it } from "vitest";
import {
  fileAcceptanceCriteria,
  frontmatterAcceptanceCriteria,
  isCheckedCriterion,
  openCriteria,
  planAcceptanceCriteria,
  tickCriteria,
  unphasedCloseout,
} from "./plan-acceptance.js";

const phase = (list: string, eol = "\n") =>
  ["---", "status: in-progress", "acceptance_criteria:", ...list.split("\n"), "completed_at: null", "---", "# Phase", ""].join(eol);

describe("shared acceptance parser", () => {
  it("reads a quoted YAML list", () => {
    expect(frontmatterAcceptanceCriteria(phase('  - "[ ] one"\n  - "[x] two"'))).toEqual(["[ ] one", "[x] two"]);
  });

  it("treats [x] and [X] as checked, [ ] as open", () => {
    expect(isCheckedCriterion("[x] a")).toBe(true);
    expect(isCheckedCriterion("[X] a")).toBe(true);
    expect(isCheckedCriterion("- [X] a")).toBe(true);
    expect(isCheckedCriterion("[ ] a")).toBe(false);
    expect(isCheckedCriterion("a")).toBe(false);
  });

  it("handles CRLF frontmatter", () => {
    expect(frontmatterAcceptanceCriteria(phase('  - "[X] one"\n  - "[ ] two"', "\r\n"))).toEqual(["[X] one", "[ ] two"]);
  });

  it("skips YAML comments inside the list", () => {
    expect(frontmatterAcceptanceCriteria(phase('  # first\n  - "[ ] one"\n  # second\n  - "[x] two"'))).toEqual(["[ ] one", "[x] two"]);
  });

  it("keeps a criterion containing a comma whole in a flow list", () => {
    const text = '---\nacceptance_criteria: ["[ ] a, b and c", "[x] d"]\n---\n';
    expect(frontmatterAcceptanceCriteria(text)).toEqual(["[ ] a, b and c", "[x] d"]);
  });

  it("falls back to lines when a model writes unquoted boxes", () => {
    expect(frontmatterAcceptanceCriteria(phase("  - [x] one\n  - [ ] two"))).toEqual(["[x] one", "[ ] two"]);
  });

  it("returns null for a missing key and [] for an empty one", () => {
    expect(frontmatterAcceptanceCriteria("---\nstatus: x\n---\n")).toBeNull();
    expect(frontmatterAcceptanceCriteria("---\nacceptance_criteria: []\n---\n")).toEqual([]);
  });

  it("reads body boxes with CRLF and any heading case", () => {
    const text = "---\r\nstatus: completed\r\n---\r\n## acceptance criteria\r\n- [X] a\r\n- [ ] b\r\n## Other\r\n- [ ] c\r\n";
    expect(planAcceptanceCriteria(text)).toEqual(["- [X] a", "- [ ] b"]);
    expect(unphasedCloseout(text)).toEqual({ closeEligible: false, openAcceptanceLines: ["- [ ] b"] });
  });

  it("prefers frontmatter criteria over body boxes", () => {
    const text = phase('  - "[ ] fm"') + "## Acceptance criteria\n- [ ] body\n";
    expect(fileAcceptanceCriteria(text)).toEqual({ source: "frontmatter", items: ["[ ] fm"] });
  });
});

describe("tickCriteria", () => {
  it("ticks only the named frontmatter items and keeps quoting", () => {
    const text = phase('  - "[ ] one"\n  - "[ ] two"');
    const next = tickCriteria(text, ["[ ] two"]);
    expect(next).toContain('  - "[ ] one"');
    expect(next).toContain('  - "[x] two"');
    expect(openCriteria(next)).toEqual(["[ ] one"]);
  });

  it("ticks body boxes and preserves CRLF", () => {
    const text = "---\r\nstatus: active\r\n---\r\n## Acceptance criteria\r\n- [ ] a\r\n- [ ] b\r\n";
    const next = tickCriteria(text, ["- [ ] a"]);
    expect(next).toBe("---\r\nstatus: active\r\n---\r\n## Acceptance criteria\r\n- [x] a\r\n- [ ] b\r\n");
  });


  it("ticks inline flow-sequence criteria on the key line", () => {
    const text = '---\nacceptance_criteria: ["[ ] a, b and c", "[ ] d", "[x] e"]\n---\n';
    const next = tickCriteria(text, ["[ ] a, b and c", "[ ] d"]);
    expect(frontmatterAcceptanceCriteria(next)).toEqual(["[x] a, b and c", "[x] d", "[x] e"]);
    expect(next).toContain('acceptance_criteria: ["[x] a, b and c", "[x] d", "[x] e"]');
  });

  it("ticks frontmatter list items through a CRLF round trip", () => {
    const text = phase('  - "[ ] one"\n  - "[ ] two"', "\r\n");
    const next = tickCriteria(text, ["[ ] one"]);
    expect(next).toContain("\r\n");
    expect(openCriteria(next)).toEqual(["[ ] two"]);
    expect(next).toContain('  - "[x] one"');
  });

  it("does not touch boxes outside the acceptance region", () => {
    const text = "---\nstatus: active\n---\n## Acceptance criteria\n- [ ] a\n## Notes\n- [ ] a\n";
    expect(tickCriteria(text, ["- [ ] a"])).toBe("---\nstatus: active\n---\n## Acceptance criteria\n- [x] a\n## Notes\n- [ ] a\n");
  });
});
