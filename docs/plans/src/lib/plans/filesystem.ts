import { readdir, readFile, stat } from 'node:fs/promises';
import { join, posix, relative, resolve, sep } from 'node:path';
import { slugOf, splitFrontmatter, toPlanDocument } from './types.js';
import type { PlanDocument, PlanSource, PlanSubject } from './types.js';

// Reads plan markdown straight from the repo's `.context/<subject>/` folders.
// Directory-walk helper lives here because no other source needs it.

async function collectMarkdownFiles(dir: string, root: string, out: string[]): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      await collectMarkdownFiles(full, root, out);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
      out.push(relative(root, full).split(sep).join(posix.sep));
    }
  }
}

function statusOf(indexRaw: string | null): string | null {
  if (!indexRaw) return null;
  const { frontmatter } = splitFrontmatter(indexRaw);
  return frontmatter.status ?? null;
}

export class FilesystemPlanSource implements PlanSource {
  readonly kind = 'fs';
  private readonly contextDir: string;

  constructor(contextDir?: string) {
    this.contextDir =
      contextDir ?? process.env.PLAN_CONTEXT_DIR ?? resolve(process.cwd(), '../../.context');
  }

  private subjectDir(subject: string): string {
    if (subject.includes('..') || subject.includes('/') || subject.includes('\\')) {
      throw new Error(`Invalid subject: ${subject}`);
    }
    return join(this.contextDir, subject);
  }

  async listSubjects(): Promise<PlanSubject[]> {
    const entries = await readdir(this.contextDir, { withFileTypes: true });
    const subjects: PlanSubject[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const files: string[] = [];
      try {
        await collectMarkdownFiles(join(this.contextDir, entry.name), join(this.contextDir, entry.name), files);
      } catch {
        continue;
      }
      if (files.length === 0) continue;
      files.sort((a, b) => a.localeCompare(b));
      let indexRaw: string | null = null;
      if (files.includes('index.md')) {
        try {
          indexRaw = await readFile(join(this.contextDir, entry.name, 'index.md'), 'utf8');
        } catch {
          indexRaw = null;
        }
      }
      subjects.push({ name: entry.name, status: statusOf(indexRaw), documents: files });
    }
    subjects.sort((a, b) => b.name.localeCompare(a.name));
    return subjects;
  }

  async listDocuments(subject: string): Promise<PlanDocument[]> {
    const dir = this.subjectDir(subject);
    const st = await stat(dir).catch(() => null);
    if (!st?.isDirectory()) return [];
    const files: string[] = [];
    await collectMarkdownFiles(dir, dir, files);
    files.sort((a, b) => a.localeCompare(b));
    const docs: PlanDocument[] = [];
    for (const file of files) {
      const raw = await readFile(join(dir, ...file.split(posix.sep)), 'utf8');
      docs.push(toPlanDocument(subject, file, raw));
    }
    return docs;
  }

  async getDocument(subject: string, slug: string): Promise<PlanDocument | null> {
    if (slug.includes('..')) return null;
    const dir = this.subjectDir(subject);
    const candidates = slug.toLowerCase().endsWith('.md') ? slug : `${slug}.md`;
    // Compare case-insensitively against the walked file list so slugs stay
    // stable even when file names use mixed case.
    const docs = await this.listDocuments(subject);
    const match = docs.find((doc) => doc.file.toLowerCase() === candidates.toLowerCase());
    if (match) return match;
    // Fall back to the extensionless-slug comparison for nested paths.
    const bySlug = docs.find((doc) => slugOf(doc.file) === slug);
    if (bySlug) return bySlug;
    try {
      const raw = await readFile(join(dir, ...candidates.split(posix.sep)), 'utf8');
      return toPlanDocument(subject, candidates, raw);
    } catch {
      return null;
    }
  }
}
