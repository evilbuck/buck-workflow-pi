import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, basename } from "node:path";
import type { ChunkQueueItem } from "./types.js";

export function buildQueue(
  projectRoot: string,
  subject: string | null,
): ChunkQueueItem[] {
  const queue: ChunkQueueItem[] = [];

  if (!subject) return queue;

  const contextDir = join(projectRoot, ".context");
  const subjectDir = join(contextDir, subject);
  if (!existsSync(subjectDir)) return queue;

  // 1. Phase files in order
  try {
    const phaseFiles = readdirSync(subjectDir)
      .filter((f) => f.match(/^phase-\d+-.*\.md$/))
      .sort()
      .map((f) => join(subjectDir, f));

    for (const path of phaseFiles) {
      const content = readFileSync(path, "utf-8");
      const statusMatch = content.match(/^status:\s*(\S+)/m);
      if (statusMatch && statusMatch[1] === "completed") continue;

      const diffMatch = content.match(/^difficulty:\s*(easy|medium|hard)/m);
      queue.push({
        id: `phase-${basename(path, ".md")}`,
        type: "phase",
        path,
        status: "pending",
        difficulty: (diffMatch?.[1] as ChunkQueueItem["difficulty"]) ?? undefined,
        workerAttempts: 0,
      });
    }
  } catch { /* ignore */ }

  // 2. tasks.md unchecked items
  try {
    const tasksPath = join(subjectDir, "tasks.md");
    if (existsSync(tasksPath)) {
      const content = readFileSync(tasksPath, "utf-8");
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.match(/^- \[ \] /)) {
          const text = line.replace(/^- \[ \] /, "").trim();
          queue.push({
            id: `task-${i}`,
            type: "task",
            path: tasksPath,
            status: "pending",
            workerAttempts: 0,
          });
        }
      }
    }
  } catch { /* ignore */ }

  // 3. Backlog items
  try {
    const todoPath = join(contextDir, "backlog", "todo.md");
    if (existsSync(todoPath)) {
      const content = readFileSync(todoPath, "utf-8");
      const matches = content.matchAll(/\[([^\]]+)\]\(items\/([^)]+)\)/g);
      let idx = 0;
      for (const match of matches) {
        const itemPath = join(contextDir, "backlog", "items", match[2]);
        queue.push({
          id: `backlog-${idx++}`,
          type: "backlog",
          path: itemPath,
          status: "pending",
          workerAttempts: 0,
        });
      }
    }
  } catch { /* ignore */ }

  // 4. Iterate bundles — only queue active (non-completed) iterates.
  // Completed iterate files must NOT become fresh pending queue items.
  // Active iterates are consumed by the current phase lifecycle, not as
  // independent queue chunks, unless a future policy requires it.
  // For now: skip iterate files entirely in the queue. They are handled
  // by the scan-context activeIterate path instead.
  // try {
  //   const iterateFiles = readdirSync(subjectDir)
  //     .filter((f) => f.match(/^iterate-.*\.md$/))
  //     .map((f) => join(subjectDir, f));
  //
  //   for (const path of iterateFiles) {
  //     const content = readFileSync(path, "utf-8");
  //     const statusMatch = content.match(/^status:\s*(\S+)/m);
  //     // Skip completed iterate files
  //     if (statusMatch && statusMatch[1] === "completed") continue;
  //
  //     queue.push({
  //       id: `iterate-${basename(path, ".md")}`,
  //       type: "iterate",
  //       path,
  //       status: "pending",
  //       workerAttempts: 0,
  //     });
  //   }
  // } catch { /* ignore */ }

  return queue;
}
