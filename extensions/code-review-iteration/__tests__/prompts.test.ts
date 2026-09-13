import { describe, it, expect } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  parsePersona,
  loadPersonas,
  resolveReviewerModel,
  resolveTemperature,
  assembleReviewerPrompt,
  assembleFixerPrompt,
  PersonaError,
} from "../prompts.js";

const PERSONA_MD = [
  "---",
  "name: balanced",
  "description: broad correctness and maintainability",
  "default_model: zai/glm-5.3:high",
  "default_temperature: 0.2",
  "---",
  "Review for correctness, regressions, maintainability, and test quality.",
].join("\n");

describe("parsePersona", () => {
  it("parses frontmatter and body", () => {
    const persona = parsePersona(PERSONA_MD, "balanced.md");
    expect(persona.name).toBe("balanced");
    expect(persona.defaultModel).toBe("zai/glm-5.3:high");
    expect(persona.defaultTemperature).toBe(0.2);
    expect(persona.body).toMatch(/correctness/);
  });

  it("rejects missing names, bad temperatures, and empty bodies", () => {
    expect(() => parsePersona("---\ndescription: x\n---\nbody", "a.md")).toThrow(/name/);
    expect(() => parsePersona(PERSONA_MD.replace("0.2", "hot"), "a.md")).toThrow(/default_temperature/);
    expect(() => parsePersona("---\nname: x\n---\n", "a.md")).toThrow(/body is empty/);
    expect(() => parsePersona("no frontmatter", "a.md")).toThrow(PersonaError);
  });
});

describe("loadPersonas", () => {
  it("loads a directory keyed by name and aggregates errors", () => {
    const dir = mkdtempSync(join(tmpdir(), "personas-"));
    try {
      writeFileSync(join(dir, "balanced.md"), PERSONA_MD);
      writeFileSync(join(dir, "dupe.md"), PERSONA_MD);
      writeFileSync(join(dir, "broken.md"), "---\nname: ok\ngarbage without colon\n---\nbody");
      const { personas, errors } = loadPersonas(dir);
      expect(personas.size).toBe(1);
      expect(personas.get("balanced")?.file).toBe("balanced.md");
      expect(errors).toHaveLength(2);
      expect(errors.join("\n")).toMatch(/duplicate persona name balanced/);
      expect(errors.join("\n")).toMatch(/broken\.md/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("reports unreadable directories as errors", () => {
    const { personas, errors } = loadPersonas(join(tmpdir(), "missing-personas-xyz"));
    expect(personas.size).toBe(0);
    expect(errors).toHaveLength(1);
  });
});

describe("model + temperature resolution", () => {
  const ompRoles = { reviewer: "zai/glm-5.3", default: "openai-codex/gpt-5.6-terra", slow: "openai-codex/gpt-5.6-sol" };

  it("follows the reviewer precedence chain", () => {
    const personaDefault = { defaultModel: "xai-oauth/grok-4.6:high", defaultTemperature: 0.2, name: "p", description: "", body: "b", file: "p.md" };
    expect(resolveReviewerModel({ explicitModel: "a/b", ompRoles }).model).toBe("a/b");
    expect(resolveReviewerModel({ explicitRole: "slow", ompRoles }).model).toBe("openai-codex/gpt-5.6-sol");
    expect(resolveReviewerModel({ personaDefault: personaDefault.defaultModel, ompRoles }).source).toMatch(/persona/);
    expect(resolveReviewerModel({ ompRoles }).model).toBe("zai/glm-5.3");
    expect(resolveReviewerModel({ ompRoles: {} }).model).toBeNull();
    // explicit model wins over explicit role
    expect(resolveReviewerModel({ explicitModel: "a/b", explicitRole: "slow", ompRoles }).model).toBe("a/b");
  });

  it("temperature: explicit beats persona beats provider default", () => {
    const persona = { defaultModel: null, defaultTemperature: 0.2, name: "p", description: "", body: "b", file: "p.md" };
    expect(resolveTemperature(0.7, persona)).toBe(0.7);
    expect(resolveTemperature(undefined, persona)).toBe(0.2);
    expect(resolveTemperature(undefined, null)).toBeNull();
  });
});

describe("assembleReviewerPrompt", () => {
  const base = { branch: "feature/x", reviewedHead: "a".repeat(40), baseBranch: "master", baseCommit: "b".repeat(40), pass: 1 };

  it("always retains the invariant envelope and output contract", () => {
    const prompt = assembleReviewerPrompt({ ...base, baseGuidance: "", personaBody: null, appendContext: null, replacementGuidance: null });
    expect(prompt).toContain("read-only code reviewer");
    expect(prompt).toContain(`Review pass #1`);
    expect(prompt).toContain("2·impact + likelihood + breadth");
    expect(prompt).toContain("review_exec");
    expect(prompt).toContain('"findings"');
  });

  it("default mode appends context after base guidance and persona", () => {
    const prompt = assembleReviewerPrompt({
      ...base,
      baseGuidance: "BASE-GUIDANCE-MARKER",
      personaBody: "PERSONA-BODY-MARKER",
      appendContext: "OPERATOR-CONTEXT-MARKER",
      replacementGuidance: null,
    });
    const baseIdx = prompt.indexOf("BASE-GUIDANCE-MARKER");
    const personaIdx = prompt.indexOf("PERSONA-BODY-MARKER");
    const ctxIdx = prompt.indexOf("OPERATOR-CONTEXT-MARKER");
    expect(baseIdx).toBeGreaterThan(-1);
    expect(personaIdx).toBeGreaterThan(baseIdx);
    expect(ctxIdx).toBeGreaterThan(personaIdx);
  });

  it("replacement mode drops base guidance and persona but keeps the envelope", () => {
    const prompt = assembleReviewerPrompt({
      ...base,
      baseGuidance: "BASE-GUIDANCE-MARKER",
      personaBody: "PERSONA-BODY-MARKER",
      appendContext: "OPERATOR-CONTEXT-MARKER",
      replacementGuidance: "REPLACEMENT-MARKER",
    });
    expect(prompt).not.toContain("BASE-GUIDANCE-MARKER");
    expect(prompt).not.toContain("PERSONA-BODY-MARKER");
    expect(prompt).toContain("REPLACEMENT-MARKER");
    expect(prompt).toContain("OPERATOR-CONTEXT-MARKER");
    expect(prompt).toContain("Output contract (invariant)");
  });
});

describe("assembleFixerPrompt", () => {
  it("requires independent verification and structured dispositions", () => {
    const prompt = assembleFixerPrompt({ passDir: "/x/passes/01", blockingFindings: "- F1 broken auth", baseBranch: "master" });
    expect(prompt).toContain("independently verify");
    expect(prompt).toContain('"dispositions"');
    expect(prompt).toContain("already_fixed");
    expect(prompt).toContain("/x/passes/01");
  });
});
