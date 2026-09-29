/**
 * Ambiguous postcondition gate. The scan only knows the expected artifact
 * did not land. Before retrying, the supervisor asks whether it can repair
 * that without the operator, then either repairs or stops with the reason.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { runJev } from "../jev-tool/index.js";
import { createTypeSafeEvaluator } from "../typed-output/evaluator.js";

/** Calibrated yes boundary used by typed-output semantic checks. */
const FIX_WITHOUT_OPERATOR_MIN = 0.8;

export type Fixability = { yes: boolean; reason: string };

export function acceptanceCriteria(abs: string): string[] {
  const front = frontmatter(abs);
  const lines = front.split("\n");
  const start = lines.findIndex((line) => line.trim() === "acceptance_criteria:");
  if (start < 0) return [];
  const items: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (/^\S/.test(line)) break;
    const item = line.match(/^\s+-\s+(.*)$/)?.[1]?.trim();
    if (item) items.push(item.replace(/^["']|["']$/g, ""));
  }
  return items;
}

/** All boxes checked, but the scanner only confirms `status: completed`. */
export function repairCheckedPhase(abs: string, at: string): boolean {
  const items = acceptanceCriteria(abs);
  if (items.length === 0 || items.some((item) => !item.startsWith("[x]"))) return false;
  const text = readFileSync(abs, "utf8");
  if (/^status:\s*completed\s*$/m.test(text)) return false;
  let next = text.replace(/^status:\s*.+$/m, "status: completed");
  if (!/^completed_at:/m.test(next)) next = next.replace(/^status: completed$/m, `status: completed\ncompleted_at: ${at}`);
  writeFileSync(abs, next);
  return true;
}

export function explainAmbiguity(abs: string | null): string {
  if (!abs) return "postcondition is ambiguous because the expected artifact did not land";
  const status = frontmatter(abs).match(/^status:\s*(.+)$/m)?.[1]?.trim() ?? "missing";
  const open = acceptanceCriteria(abs).filter((item) => !item.startsWith("[x]"));
  const checkpoint = section(readFileSync(abs, "utf8"), "Execution checkpoint");
  const unchecked = open.length > 0 ? ` Unchecked: ${open.join("; ")}.` : "";
  const why = checkpoint ? ` ${firstSentence(checkpoint)}` : "";
  return `phase status is ${status}, not completed.${unchecked}${why}`;
}

export async function askCanFixWithoutOperator(state: string): Promise<Fixability> {
  try {
    const { details } = await runJev(createTypeSafeEvaluator(), {
      state,
      questions: {
        can_fix: {
          type: "noul",
          instructions:
            "Can the supervisor resolve this ambiguous buck-loop postcondition without operator intervention? Yes only if another skill run or a status write the supervisor can make would confirm it. No if credentials, a disposable database, or any other operator input is required.",
        },
      },
    });
    const noul = readNoul(details);
    if (noul === null) return { yes: false, reason: "Jev did not return a fixability probability" };
    if (noul < FIX_WITHOUT_OPERATOR_MIN) return { yes: false, reason: `Jev says this needs the operator (${noul})` };
    return { yes: true, reason: `Jev says the supervisor can fix this (${noul})` };
  } catch (error) {
    return { yes: false, reason: error instanceof Error ? error.message : "Jev fixability call failed" };
  }
}

function firstSentence(text: string): string {
  return (text.match(/^[\s\S]*?[.!?](?=\s|$)/)?.[0] ?? text.split("\n", 1)[0] ?? "")
    .replace(/\s+/g, " ").trim();
}

function frontmatter(abs: string): string {
  const text = readFileSync(abs, "utf8");
  if (!text.startsWith("---")) return "";
  const end = text.indexOf("\n---", 3);
  return end < 0 ? "" : text.slice(4, end);
}

function section(text: string, heading: string): string | null {
  const match = text.match(new RegExp(`## ${heading}\\n+([\\s\\S]*?)(?:\\n## |\\n# |$)`));
  const body = match?.[1]?.trim();
  return body ? body : null;
}

function readNoul(details: unknown): number | null {
  return probability(field(field(details, "answers"), "can_fix"));
}

function field(value: unknown, key: string): unknown {
  if (!value || typeof value !== "object" || !(key in value)) return null;
  return (value as Record<string, unknown>)[key];
}

function probability(answer: unknown): number | null {
  if (!answer || typeof answer !== "object" || !("noul" in answer)) return null;
  const noul = answer.noul;
  return typeof noul === "number" && noul >= 0 && noul <= 1 ? noul : null;
}

export function phaseAbs(cwd: string, phasePath: string | null): string | null {
  return phasePath ? resolve(cwd, phasePath) : null;
}

/** Fingerprints the running extension before a retry; pre-existing dirt is not a new repair. */
export function loopExtensionFiles(cwd: string): Map<string, string> {
  const root = join(cwd, "extensions/buck-loop");
  const files = new Map<string, string>();
  if (!existsSync(root)) return files;
  function collect(dir: string, relative: string): void {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const name = relative ? `${relative}/${entry.name}` : entry.name;
      const abs = join(dir, entry.name);
      if (entry.isDirectory()) collect(abs, name);
      else if (entry.isFile()) files.set(`extensions/buck-loop/${name}`, createHash("sha256").update(readFileSync(abs)).digest("hex"));
    }
  }
  collect(root, "");
  return files;
}

export function changedLoopExtensionFiles(cwd: string, before: ReadonlyMap<string, string>): string[] {
  const after = loopExtensionFiles(cwd);
  return [...new Set([...before.keys(), ...after.keys()])]
    .filter((path) => before.get(path) !== after.get(path))
    .sort();
}
