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
