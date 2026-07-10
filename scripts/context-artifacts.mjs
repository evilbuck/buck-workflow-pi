import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, relative } from "node:path";
import {
  ARTIFACT_SCHEMAS,
  classifyRelativeContextPath,
  toContextRelative,
} from "./context-artifact-schemas.mjs";

/** @typedef {import("./context-artifact-schemas.mjs").ArtifactKind} ArtifactKind */

/**
 * @typedef {Object} ScannedArtifact
 * @property {string} path
 * @property {ArtifactKind} kind
 * @property {Record<string, string>} frontmatter
 * @property {string[]} errors
 */

/**
 * @typedef {Object} ArtifactRegistryEntry
 * @property {string} path
 * @property {ArtifactKind} kind
 * @property {string} subject
 * @property {string} status
 * @property {string} date
 * @property {string[]} topics
 * @property {string[]} related
 * @property {string[]} errors
 */

/**
 * @typedef {Object} SubjectIndexEntry
 * @property {string} path
 * @property {string} kind
 * @property {string} subject
 * @property {string} status
 * @property {string} date
 * @property {string[]} topics
 * @property {string[]} related
 * @property {string[]} informs
 * @property {string[]} artifacts
 */

/**
 * @typedef {Object} MemoryIndexEntry
 * @property {string} path
 * @property {string} kind
 * @property {string} date
 * @property {string[]} domains
 * @property {string[]} topics
 * @property {string} subject
 * @property {string[]} artifacts
 * @property {string[]} related
 * @property {string} priority
 * @property {string} status
 */

/**
 * @typedef {Object} BacklogIndexEntry
 * @property {string} path
 * @property {string} kind
 * @property {string} title
 * @property {string} status
 * @property {string} priority
 * @property {string} created
 * @property {string} updated
 * @property {string|null} completed
 * @property {string[]} related
 */

/** @type {typeof ARTIFACT_SCHEMAS} */
const SCHEMAS = ARTIFACT_SCHEMAS;

/**
 * @param {string} raw
 * @returns {Record<string, string>}
 */
export function parseFrontmatter(raw) {
  const result = {};
  let currentKey = null;
  let currentValue = "";

  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "") {
      if (currentKey) break;
      continue;
    }
    if (trimmed.startsWith("#")) break;

    const keyMatch = trimmed.match(/^(\w[\w-]*):\s*(.*)$/);
    if (keyMatch) {
      if (currentKey) {
        result[currentKey] = currentValue.trim();
      }
      currentKey = keyMatch[1];
      currentValue = keyMatch[2];
      continue;
    }

    if (line.match(/^\s+-\s+/) || line.match(/^\s+\|/)) {
      currentValue += "\n" + line.trim();
    }
  }

  if (currentKey) {
    result[currentKey] = currentValue.trim();
  }

  return result;
}

/**
 * @param {string} value
 * @returns {string[] | string}
 */
function parseInlineArray(value) {
  const trimmed = value.trim();
  if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) {
    return value;
  }

  return trimmed
    .slice(1, -1)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * @param {string | undefined} value
 * @returns {string[]}
 */
function toArray(value) {
  if (!value) return [];
  const parsed = parseInlineArray(value);
  return Array.isArray(parsed) ? parsed : [parsed];
}

/**
 * @param {string} path
 * @returns {ArtifactKind | null}
 */
export function classifyArtifact(path) {
  return classifyRelativeContextPath(toContextRelative(path));
}

/**
 * @param {Record<string, string>} frontmatter
 * @param {ArtifactKind} kind
 * @returns {string[]}
 */
export function validateArtifact(frontmatter, kind) {
  const schema = SCHEMAS[kind];
  const errors = [];

  for (const field of schema.required) {
    if (!Object.prototype.hasOwnProperty.call(frontmatter, field)) {
      errors.push(`${kind}: missing required field '${field}'`);
    }
  }

  for (const [field, allowed] of Object.entries(schema.enums)) {
    const value = frontmatter[field];
    if (value !== undefined && !allowed.includes(value)) {
      errors.push(`${kind}: '${field}' must be one of [${allowed.join(", ")}], got '${value}'`);
    }
  }

  return errors;
}

/**
 * @param {string} root
 * @returns {ScannedArtifact[]}
 */
export function scanContextDir(root) {
  const contextDir = join(root, ".context");
  const artifacts = [];

  /** @param {string} dir */
  function walk(dir) {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }

      if (!entry.isFile() || !entry.name.endsWith(".md")) {
        continue;
      }

      const kind = classifyArtifact(fullPath);
      if (!kind) {
        continue;
      }

      let frontmatter = {};
      let errors = [];

      try {
        const raw = readFileSync(fullPath, "utf-8");
        const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
        if (match) {
          frontmatter = parseFrontmatter(match[1]);
        }
        errors = validateArtifact(frontmatter, kind);
      } catch (error) {
        errors = [`failed to read file: ${error.message}`];
      }

      artifacts.push({ path: fullPath, kind, frontmatter, errors });
    }
  }

  walk(contextDir);
  return artifacts;
}

/**
 * @param {ScannedArtifact[]} artifacts
 * @returns {{ subjects: SubjectIndexEntry[], memory: MemoryIndexEntry[], backlog: BacklogIndexEntry[], artifacts: ArtifactRegistryEntry[] }}
 */
export function generateIndexes(artifacts) {
  const subjects = [];
  const memory = [];
  const backlog = [];
  const registry = [];

  for (const artifact of artifacts) {
    const { path, kind, frontmatter, errors } = artifact;
    const relPath = relative(".", path);
    const subject = frontmatter.subject || "";
    const status = frontmatter.status || "";
    const date = frontmatter.date || frontmatter.created || "";
    const topics = toArray(frontmatter.topics);
    const related = toArray(frontmatter.related);

    registry.push({
      path: relPath,
      kind,
      subject,
      status,
      date,
      topics,
      related,
      errors: [...errors],
    });

    if (kind === "subject-index") {
      subjects.push({
        path: relPath,
        kind,
        subject,
        status,
        date,
        topics,
        related,
        informs: toArray(frontmatter.informs),
        artifacts: toArray(frontmatter.artifacts),
      });
      continue;
    }

    if (kind === "memory") {
      memory.push({
        path: relPath,
        kind,
        date,
        domains: toArray(frontmatter.domains),
        topics,
        subject,
        artifacts: toArray(frontmatter.artifacts),
        related,
        priority: frontmatter.priority || "",
        status,
      });
      continue;
    }

    if (kind === "backlog-item") {
      backlog.push({
        path: relPath,
        kind,
        title: frontmatter.title || "",
        status,
        priority: frontmatter.priority || "",
        created: frontmatter.created || "",
        updated: frontmatter.updated || "",
        completed: frontmatter.completed === "null" ? null : frontmatter.completed || null,
        related,
      });
    }
  }

  subjects.sort((a, b) => a.subject.localeCompare(b.subject));
  memory.sort((a, b) => b.date.localeCompare(a.date));
  backlog.sort((a, b) => b.created.localeCompare(a.created));
  registry.sort((a, b) => a.path.localeCompare(b.path));

  return { subjects, memory, backlog, artifacts: registry };
}

/**
 * @param {{ subjects: SubjectIndexEntry[], memory: MemoryIndexEntry[], backlog: BacklogIndexEntry[], artifacts: ArtifactRegistryEntry[] }} indexes
 * @param {string} [root]
 */
export function writeIndexes(indexes, root = ".") {
  const outputDir = join(root, ".context", "index");
  mkdirSync(outputDir, { recursive: true });

  for (const [name, data] of Object.entries(indexes)) {
    writeFileSync(join(outputDir, `${name}.json`), JSON.stringify(data, null, 2) + "\n", "utf-8");
  }
}

function runCli() {
  const command = process.argv[2];
  const root = process.argv[3] || ".";

  if (!command || command === "help") {
    console.log([
      "Usage:",
      "  node scripts/context-artifacts.mjs <command>",
      "",
      "Commands:",
      "  index      Scan .context/ and regenerate JSON indexes.",
      "  validate   Scan .context/ and report validation issues.",
      "  help       Show this message.",
    ].join("\n"));
    return 0;
  }

  if (command === "index") {
    const artifacts = scanContextDir(root);
    const indexes = generateIndexes(artifacts);
    writeIndexes(indexes, root);
    console.log(`index: wrote subjects(${indexes.subjects.length}) memory(${indexes.memory.length}) backlog(${indexes.backlog.length}) artifacts(${indexes.artifacts.length})`);
    return 0;
  }

  if (command === "validate") {
    const artifacts = scanContextDir(root);
    let warningCount = 0;
    let errorCount = 0;

    for (const artifact of artifacts) {
      const warnings = artifact.errors.filter((error) => error.includes("missing required field"));
      const hardErrors = artifact.errors.filter((error) => !error.includes("missing required field"));

      if (warnings.length > 0) {
        warningCount += warnings.length;
        console.warn(`${artifact.path}:`);
        for (const warning of warnings) {
          console.warn(`  warn: ${warning}`);
        }
      }

      if (hardErrors.length > 0) {
        errorCount += hardErrors.length;
        console.error(`${artifact.path}:`);
        for (const error of hardErrors) {
          console.error(`  error: ${error}`);
        }
      }
    }

    if (warningCount === 0 && errorCount === 0) {
      console.log("validate: no issues found");
    } else if (errorCount === 0) {
      console.log(`validate: ${warningCount} warning(s), 0 errors`);
    } else {
      console.log(`validate: ${warningCount} warning(s), ${errorCount} error(s)`);
    }

    return errorCount === 0 ? 0 : 1;
  }

  console.error(`unknown command: '${command}'`);
  return 1;
}

const isMain = import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("context-artifacts.mjs");
if (isMain) {
  process.exit(runCli());
}
