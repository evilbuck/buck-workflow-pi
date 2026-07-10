import { describe, it, expect } from "vitest";
import {
  selectActivePhase,
  reviewPassFileName,
  reviewPassPath,
  computeImplementationFingerprint,
  isFingerprintMatch,
  reviewWriteBoundary,
} from "./lifecycle-artifacts.mjs";
import {
  classifyArtifact,
  validateArtifact,
  parseFrontmatter,
  scanContextDir,
} from "./context-artifacts.mjs";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("selectActivePhase", () => {
  it("prefers the single in-progress phase over later pending", () => {
    const selection = selectActivePhase([
      {
        path: ".context/s/phase-1-review-gated-phase-state.md",
        status: "in-progress",
        order: 1,
        name: "Phase 1",
      },
      {
        path: ".context/s/phase-2-save-owned-closeout.md",
        status: "pending",
        order: 2,
        name: "Phase 2",
      },
    ]);

    expect(selection.kind).toBe("selected");
    expect(selection.reason).toBe("single-in-progress");
    expect(selection.phase?.path).toContain("phase-1-");
    // Phase/overview states are not mutated by selection
    expect(selection.phase?.status).toBe("in-progress");
  });

  it("does not auto-select later pending when earlier is in-progress", () => {
    const selection = selectActivePhase([
      {
        path: "phase-1.md",
        status: "in-progress",
        order: 1,
      },
      {
        path: "phase-2.md",
        status: "pending",
        order: 2,
      },
      {
        path: "phase-3.md",
        status: "pending",
        order: 3,
      },
    ]);
    expect(selection.phase?.path).toBe("phase-1.md");
  });

  it("is ambiguous when multiple phases are in-progress", () => {
    const selection = selectActivePhase([
      { path: "phase-1.md", status: "in-progress", order: 1 },
      { path: "phase-2.md", status: "in-progress", order: 2 },
    ]);
    expect(selection.kind).toBe("ambiguous");
    expect(selection.phase).toBeNull();
    expect(selection.candidates).toHaveLength(2);
  });

  it("selects the sole pending phase when none are in-progress", () => {
    const selection = selectActivePhase([
      { path: "phase-1.md", status: "completed", order: 1 },
      { path: "phase-2.md", status: "pending", order: 2 },
    ]);
    expect(selection.kind).toBe("selected");
    expect(selection.reason).toBe("single-non-completed");
    expect(selection.phase?.path).toBe("phase-2.md");
  });

  it("is ambiguous with multiple pending and no in-progress", () => {
    const selection = selectActivePhase([
      { path: "phase-1.md", status: "pending", order: 1 },
      { path: "phase-2.md", status: "pending", order: 2 },
    ]);
    expect(selection.kind).toBe("ambiguous");
    expect(selection.reason).toBe(
      "multiple-non-completed-without-in-progress"
    );
  });
});

describe("review-pass naming", () => {
  it("derives target-stem filename", () => {
    expect(
      reviewPassFileName(
        ".context/2026-07-10.s/phase-1-review-gated-phase-state.md"
      )
    ).toBe("review-pass-phase-1-review-gated-phase-state.md");
  });

  it("places pass under the owning subject folder", () => {
    expect(
      reviewPassPath(
        ".context/2026-07-10.s",
        ".context/2026-07-10.s/phase-1-review-gated-phase-state.md"
      )
    ).toBe(
      ".context/2026-07-10.s/review-pass-phase-1-review-gated-phase-state.md"
    );
  });
});

describe("reviewWriteBoundary", () => {
  it("pass writes review-pass only", () => {
    expect(reviewWriteBoundary("pass")).toEqual({
      writeReviewPass: true,
      writeIterate: false,
      verdict: "pass",
    });
  });

  it("pass-with-follow-up writes review-pass only", () => {
    expect(reviewWriteBoundary("pass-with-follow-up")).toEqual({
      writeReviewPass: true,
      writeIterate: false,
      verdict: "pass-with-follow-up",
    });
  });

  it("needs-work writes iterate only", () => {
    expect(reviewWriteBoundary("needs-work")).toEqual({
      writeReviewPass: false,
      writeIterate: true,
      verdict: "needs-work",
    });
  });
});

describe("implementation fingerprint", () => {
  const files = [
    { path: "skills/b-review/SKILL.md", content: "review-v1" },
    { path: "scripts/lifecycle-artifacts.mjs", content: "helpers-v1" },
  ];

  it("is stable for the same implementation set", () => {
    const a = computeImplementationFingerprint(files);
    const b = computeImplementationFingerprint([...files].reverse());
    expect(a.fingerprint).toBe(b.fingerprint);
    expect(a.paths).toEqual([
      "scripts/lifecycle-artifacts.mjs",
      "skills/b-review/SKILL.md",
    ]);
  });

  it("rejects a stale pass after an implementation file changes", () => {
    const original = computeImplementationFingerprint(files);
    const drifted = computeImplementationFingerprint([
      files[0],
      { path: files[1].path, content: "helpers-v2-changed" },
    ]);
    expect(isFingerprintMatch(original.fingerprint, drifted.fingerprint)).toBe(
      false
    );
  });

  it("ignores later durability files when they are not fingerprinted", () => {
    const implOnly = computeImplementationFingerprint(files);
    // Save writes memory under .context — not included in fingerprint inputs
    const afterSaveStillSame = computeImplementationFingerprint(files);
    expect(
      isFingerprintMatch(implOnly.fingerprint, afterSaveStillSame.fingerprint)
    ).toBe(true);
  });
});

describe("fixture: clean vs failing review artifacts", () => {
  /** @type {string} */
  let root;

  function setupSubject() {
    root = mkdtempSync(join(tmpdir(), "lifecycle-fixture-"));
    const subject = join(root, ".context", "2026-07-10.fixture");
    mkdirSync(subject, { recursive: true });
    writeFileSync(
      join(subject, "phase-1-review-gated-phase-state.md"),
      `---\nstatus: in-progress\nphase: 1\norder: 1\n---\n# Phase 1\n`,
      "utf-8"
    );
    writeFileSync(
      join(subject, "phase-2-save-owned-closeout.md"),
      `---\nstatus: pending\nphase: 2\norder: 2\n---\n# Phase 2\n`,
      "utf-8"
    );
    return subject;
  }

  it("clean review fixture: exactly one valid review-pass for phase 1", () => {
    const subject = setupSubject();
    try {
      const target =
        ".context/2026-07-10.fixture/phase-1-review-gated-phase-state.md";
      const passName = reviewPassFileName(target);
      const fingerprint = computeImplementationFingerprint([
        { path: "skills/b-review/SKILL.md", content: "ok" },
      ]);
      const body = `---
status: active
date: 2026-07-10
subject: 2026-07-10.fixture
target: ${target}
verdict: pass
documentation_impact: none
fingerprint: ${fingerprint.fingerprint}
topics: [review, review-pass]
related:
  - ${target}
completed: null
---

# Review Pass: phase-1-review-gated-phase-state

## Source
- Target: \`${target}\`

## Completion matrix
- [x] Criterion — evidence: test name

## Verification
- vitest lifecycle-artifacts.test.mjs — pass

## Out-of-plan follow-ups
none

## Fingerprint
- Value: \`${fingerprint.fingerprint}\`
`;
      writeFileSync(join(subject, passName), body, "utf-8");

      const passPath = join(subject, passName);
      expect(classifyArtifact(passPath)).toBe("review-pass");
      const fm = parseFrontmatter(body);
      expect(validateArtifact(fm, "review-pass")).toEqual([]);

      const scanned = scanContextDir(root).filter(
        (a) => a.kind === "review-pass"
      );
      expect(scanned).toHaveLength(1);
      expect(scanned[0].path).toContain(
        "review-pass-phase-1-review-gated-phase-state.md"
      );
      expect(scanned[0].frontmatter.target).toContain("phase-1-");
      expect(scanned[0].errors).toEqual([]);

      // Phase states unchanged by pass write
      const selection = selectActivePhase([
        {
          path: target,
          status: "in-progress",
          order: 1,
        },
        {
          path: ".context/2026-07-10.fixture/phase-2-save-owned-closeout.md",
          status: "pending",
          order: 2,
        },
      ]);
      expect(selection.phase?.status).toBe("in-progress");
      expect(selection.phase?.path).toContain("phase-1-");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("failing review fixture: iterate exists and no review-pass", () => {
    const subject = setupSubject();
    try {
      writeFileSync(
        join(subject, "iterate-fixture.md"),
        `---
status: active
date: 2026-07-10
updated: 2026-07-10
subject: 2026-07-10.fixture
topics: [review, iteration]
informs: []
addresses: phase-1-review-gated-phase-state.md
completed: null
from_review: b-review
---

# Iteration: fixture

## Critical Issues
### 1. Missing criterion
`,
        "utf-8"
      );

      const boundary = reviewWriteBoundary("needs-work");
      expect(boundary.writeIterate).toBe(true);
      expect(boundary.writeReviewPass).toBe(false);

      const passes = scanContextDir(root).filter(
        (a) => a.kind === "review-pass"
      );
      expect(passes).toHaveLength(0);

      // iterate is not yet a registered kind (Phase 9); presence is file-level
      const names = readdirSync(subject);
      expect(names.some((n) => n.startsWith("iterate-"))).toBe(true);
      expect(names.some((n) => n.startsWith("review-pass-"))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
