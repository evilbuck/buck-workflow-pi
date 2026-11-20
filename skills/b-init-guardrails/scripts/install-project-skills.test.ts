import { describe, expect, test, afterEach } from "vitest";
import {
  mkdirSync,
  writeFileSync,
  rmSync,
  readFileSync,
  lstatSync,
  symlinkSync,
  existsSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  installProjectSkills,
  insertGuardrailsScript,
  addLizardExclude,
  complexityExcludePatches,
  isExcludedRel,
  GUARDRAILS_CHECK_SCRIPT,
  defaultSourceSkillsDir,
} from "./install-project-skills.mjs";

const roots: string[] = [];

function tempDir(): string {
  const dir = join(tmpdir(), `install-skills-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  roots.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of roots.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function sourceTree(): string {
  const root = tempDir();
  const skills = join(root, "skills");
  mkdirSync(join(skills, "b-guardrails-check/scripts"), { recursive: true });
  mkdirSync(join(skills, "b-guardrails-check/docs"), { recursive: true });
  mkdirSync(join(skills, "b-init-guardrails/scripts"), { recursive: true });
  writeFileSync(join(skills, "b-guardrails-check/SKILL.md"), "# check\n");
  writeFileSync(join(skills, "b-guardrails-check/docs/contract-resolution.md"), "# resolution\n");
  writeFileSync(join(skills, "b-guardrails-check/scripts/check.mjs"), "export const ok = 1;\n");
  writeFileSync(join(skills, "b-guardrails-check/scripts/check.test.ts"), "throw new Error('do not vendor');\n");
  writeFileSync(join(skills, "b-init-guardrails/SKILL.md"), "# init\n");
  writeFileSync(join(skills, "b-init-guardrails/scripts/detect-stack.ts"), "export const detected = true;\n");
  mkdirSync(join(skills, "other-skill"), { recursive: true });
  writeFileSync(join(skills, "other-skill/SKILL.md"), "# leave me\n");
  return skills;
}

describe("installProjectSkills", () => {
  test("copies managed skills as regular files and skips tests", () => {
    const source = sourceTree();
    const cwd = tempDir();
    mkdirSync(join(cwd, "skills/b-guardrails-check/scripts"), { recursive: true });
    mkdirSync(join(cwd, "skills/other-skill"), { recursive: true });
    writeFileSync(join(cwd, "skills/other-skill/SKILL.md"), "# project skill\n");
    symlinkSync(
      join(source, "b-guardrails-check/scripts/check.mjs"),
      join(cwd, "skills/b-guardrails-check/scripts/check.mjs"),
    );

    const result = installProjectSkills({ sourceSkillsDir: source, cwd });

    expect(result.self).toBe(false);
    expect(result.copied).toContain("b-guardrails-check/SKILL.md");
    expect(result.copied).toContain("b-guardrails-check/docs/contract-resolution.md");
    expect(result.copied).toContain("b-guardrails-check/scripts/check.mjs");
    expect(result.copied).toContain("b-init-guardrails/scripts/detect-stack.ts");
    expect(result.copied.join("\n")).not.toContain(".test.");
    expect(existsSync(join(cwd, "skills/b-guardrails-check/scripts/check.test.ts"))).toBe(false);
    expect(lstatSync(join(cwd, "skills/b-guardrails-check/scripts/check.mjs")).isSymbolicLink()).toBe(false);
    expect(readFileSync(join(cwd, "skills/other-skill/SKILL.md"), "utf8")).toBe("# project skill\n");
    expect(readFileSync(join(source, "other-skill/SKILL.md"), "utf8")).toBe("# leave me\n");
  });

  test("second run reports unchanged and does not duplicate", () => {
    const source = sourceTree();
    const cwd = tempDir();
    installProjectSkills({ sourceSkillsDir: source, cwd });
    const again = installProjectSkills({ sourceSkillsDir: source, cwd });
    expect(again.copied).toEqual([]);
    expect(again.unchanged).toContain("b-guardrails-check/SKILL.md");
  });

  test("refuses to rewrite the source repository", () => {
    const source = sourceTree();
    const cwd = join(source, "..");
    const result = installProjectSkills({ sourceSkillsDir: source, cwd });
    expect(result.self).toBe(true);
    expect(result.copied).toEqual([]);
    expect(result.script).toBe("skipped");
    expect(result.excludes).toBe("skipped");
  });

  test("adds the guardrails script and lizard excludes without reformatting other fields", () => {
    const source = sourceTree();
    const cwd = tempDir();
    writeFileSync(join(cwd, "package.json"), '{\n  "name": "demo",\n  "scripts": {\n    "test": "vitest"\n  }\n}\n');
    writeFileSync(
      join(cwd, "guardrails.json"),
      `${JSON.stringify({ version: 2, ecosystems: [{ name: "typescript", complexity_cmd: 'lizard -C 10 -w --csv .' }] }, null, 2)}\n`,
    );
    const result = installProjectSkills({ sourceSkillsDir: source, cwd });
    expect(result.script).toBe("added");
    expect(result.excludes).toBe("added");
    const pkg = readFileSync(join(cwd, "package.json"), "utf8");
    expect(pkg).toContain('"name": "demo"');
    expect(pkg).toContain(`"guardrails:check": "${GUARDRAILS_CHECK_SCRIPT}"`);
    expect(pkg).toContain('"test": "vitest"');
    const contract = JSON.parse(readFileSync(join(cwd, "guardrails.json"), "utf8"));
    expect(contract.ecosystems[0].complexity_cmd).toContain('-x "*/skills/b-guardrails-check/*"');
    expect(contract.ecosystems[0].complexity_cmd).toContain('-x "*/skills/b-init-guardrails/*"');
    expect(contract.version).toBe(2);
  });

  test("refuses to install through a symlinked skill directory without copying", () => {
    const source = sourceTree();
    const cwd = tempDir();
    const outside = tempDir();
    mkdirSync(join(outside, "b-init-guardrails"), { recursive: true });
    writeFileSync(join(outside, "b-init-guardrails/SKILL.md"), "# outside\n");
    mkdirSync(join(cwd, "skills"), { recursive: true });
    symlinkSync(join(outside, "b-init-guardrails"), join(cwd, "skills/b-init-guardrails"));

    expect(() => installProjectSkills({ sourceSkillsDir: source, cwd })).toThrow(/symlinked directory/);
    expect(readFileSync(join(outside, "b-init-guardrails/SKILL.md"), "utf8")).toBe("# outside\n");
    expect(existsSync(join(cwd, "skills/b-guardrails-check/SKILL.md"))).toBe(false);
  });

  test("refuses to install when skills itself is a symlink", () => {
    const source = sourceTree();
    const cwd = tempDir();
    symlinkSync(tempDir(), join(cwd, "skills"));
    expect(() => installProjectSkills({ sourceSkillsDir: source, cwd })).toThrow(/symlinked directory/);
  });

  test("updates both ecosystems when they record the same lizard command", () => {
    const source = sourceTree();
    const cwd = tempDir();
    writeFileSync(
      join(cwd, "guardrails.json"),
      `${JSON.stringify({
        version: 2,
        ecosystems: [
          { name: "typescript", complexity_cmd: "lizard -C 10 ." },
          { name: "python", complexity_cmd: "lizard -C 10 ." },
        ],
      }, null, 2)}\n`,
    );
    const result = installProjectSkills({ sourceSkillsDir: source, cwd });
    expect(result.excludes).toBe("added");
    const again = installProjectSkills({ sourceSkillsDir: source, cwd });
    expect(again.excludes).toBe("present");
    const contract = JSON.parse(readFileSync(join(cwd, "guardrails.json"), "utf8"));
    for (const eco of contract.ecosystems) {
      expect(eco.complexity_cmd).toContain('-x "*/skills/b-guardrails-check/*"');
      expect(eco.complexity_cmd).toContain('-x "*/skills/b-init-guardrails/*"');
    }
  });

  test("creates a scripts object when package.json has none", () => {
    const source = sourceTree();
    const cwd = tempDir();
    writeFileSync(join(cwd, "package.json"), '{\n  "name": "demo"\n}\n');
    const result = installProjectSkills({ sourceSkillsDir: source, cwd });
    expect(result.script).toBe("added");
    const parsed = JSON.parse(readFileSync(join(cwd, "package.json"), "utf8"));
    expect(parsed.name).toBe("demo");
    expect(parsed.scripts["guardrails:check"]).toBe(GUARDRAILS_CHECK_SCRIPT);
  });

  test("adds the script to a compact one-line scripts object", () => {
    const source = sourceTree();
    const cwd = tempDir();
    writeFileSync(join(cwd, "package.json"), '{"scripts":{"build":"tsc"}}');
    const result = installProjectSkills({ sourceSkillsDir: source, cwd });
    expect(result.script).toBe("added");
    const parsed = JSON.parse(readFileSync(join(cwd, "package.json"), "utf8"));
    expect(parsed.scripts.build).toBe("tsc");
    expect(parsed.scripts["guardrails:check"]).toBe(GUARDRAILS_CHECK_SCRIPT);
  });
});

describe("insertGuardrailsScript", () => {
  test("leaves a matching script untouched", () => {
    const text = `{"scripts":{"guardrails:check":${JSON.stringify(GUARDRAILS_CHECK_SCRIPT)}}}`;
    expect(insertGuardrailsScript(text).status).toBe("present");
  });

  test("does not replace a different script", () => {
    const text = '{"scripts":{"guardrails:check":"bun test"}}';
    const result = insertGuardrailsScript(text);
    expect(result.status).toBe("differs");
    expect(result.text).toBe(text);
  });

  test("expands an empty scripts object", () => {
    const result = insertGuardrailsScript('{\n  "scripts": {}\n}\n');
    expect(result.status).toBe("added");
    expect(JSON.parse(result.text).scripts["guardrails:check"]).toBe(GUARDRAILS_CHECK_SCRIPT);
  });

  test("creates a scripts object when package.json has none", () => {
    const compact = insertGuardrailsScript('{"name":"demo"}');
    expect(compact.status).toBe("added");
    const parsed = JSON.parse(compact.text);
    expect(parsed.name).toBe("demo");
    expect(parsed.scripts["guardrails:check"]).toBe(GUARDRAILS_CHECK_SCRIPT);
    const pretty = insertGuardrailsScript('{\n  "name": "demo"\n}\n');
    expect(pretty.status).toBe("added");
    expect(JSON.parse(pretty.text).scripts["guardrails:check"]).toBe(GUARDRAILS_CHECK_SCRIPT);
    expect(pretty.text).toContain('"name": "demo"');
  });

  test("appends to a compact one-line scripts object", () => {
    const result = insertGuardrailsScript('{"scripts":{"build":"tsc"}}');
    expect(result.status).toBe("added");
    const parsed = JSON.parse(result.text);
    expect(parsed.scripts.build).toBe("tsc");
    expect(parsed.scripts["guardrails:check"]).toBe(GUARDRAILS_CHECK_SCRIPT);
  });

  test("inserts after the opening brace when it sits on its own line", () => {
    const result = insertGuardrailsScript('{\n  "scripts":\n  {\n    "test": "vitest"\n  }\n}\n');
    expect(result.status).toBe("added");
    const parsed = JSON.parse(result.text);
    expect(parsed.scripts.test).toBe("vitest");
    expect(parsed.scripts["guardrails:check"]).toBe(GUARDRAILS_CHECK_SCRIPT);
  });

  test("targets the root scripts object even when a nested one comes first", () => {
    const text = JSON.stringify(
      { config: { scripts: { nested: "echo hi" } }, scripts: { test: "vitest" } },
      null,
      2,
    );
    const result = insertGuardrailsScript(text);
    expect(result.status).toBe("added");
    const parsed = JSON.parse(result.text);
    expect(parsed.scripts["guardrails:check"]).toBe(GUARDRAILS_CHECK_SCRIPT);
    expect(parsed.scripts.test).toBe("vitest");
    expect(parsed.config.scripts).toEqual({ nested: "echo hi" });
  });

  test("leaves non-object scripts values untouched", () => {
    for (const text of ['{"scripts":"x"}', '{"scripts":[]}', '{"scripts":null}']) {
      const result = insertGuardrailsScript(text);
      expect(result.status).toBe("unsupported-scripts-shape");
      expect(result.text).toBe(text);
    }
  });
});

describe("complexity excludes", () => {
  test("inserts flags before the trailing dot and is idempotent", () => {
    const once = addLizardExclude("lizard -C 10 -w --csv .", "*/skills/b-guardrails-check/*");
    expect(once).toBe('lizard -C 10 -w --csv -x "*/skills/b-guardrails-check/*" .');
    expect(addLizardExclude(once, "*/skills/b-guardrails-check/*")).toBe(once);
  });

  test("ignores non-lizard commands", () => {
    expect(complexityExcludePatches({ ecosystems: [{ complexity_cmd: "scc --format csv" }] })).toEqual([]);
  });

  test("deduplicates identical ecosystem commands into one patch", () => {
    const patches = complexityExcludePatches({
      ecosystems: [
        { name: "typescript", complexity_cmd: "lizard -C 10 ." },
        { name: "python", complexity_cmd: "lizard -C 10 ." },
      ],
    });
    expect(patches).toEqual([
      {
        from: "lizard -C 10 .",
        to: 'lizard -C 10 -x "*/skills/b-guardrails-check/*" -x "*/skills/b-init-guardrails/*" .',
      },
    ]);
  });
});

describe("helpers", () => {
  test("excludes test files only", () => {
    expect(isExcludedRel("b-guardrails-check/scripts/check.test.ts")).toBe(true);
    expect(isExcludedRel("b-guardrails-check/scripts/check.mjs")).toBe(false);
  });

  test("canonical source contains the files the managed block names", () => {
    const source = defaultSourceSkillsDir();
    expect(existsSync(join(source, "b-guardrails-check/SKILL.md"))).toBe(true);
    expect(existsSync(join(source, "b-guardrails-check/docs/contract-resolution.md"))).toBe(true);
    expect(existsSync(join(source, "b-guardrails-check/scripts/check.mjs"))).toBe(true);
    expect(existsSync(join(source, "b-init-guardrails/scripts/detect-stack.ts"))).toBe(true);
  });
});
