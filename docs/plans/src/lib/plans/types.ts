// Shared plan-domain types. Every PlanSource — filesystem today, SQL
// tomorrow — speaks these shapes so pages never care where markdown lives.

export interface PlanSubject {
  /** Folder name, e.g. `2026-10-02.buck-loop-save-receipt-subject`. */
  name: string;
  /** Parsed `index.md` frontmatter status when present. */
  status: string | null;
  /** Markdown document file names inside the subject (sorted). */
  documents: string[];
}

export interface PlanDocument {
  subject: string;
  /** File name within the subject folder, e.g. `plan-foo.md`. */
  file: string;
  /** Slug without extension, used for routing. */
  slug: string;
  /** Raw markdown including frontmatter. */
  raw: string;
  /** Frontmatter key/value pairs (best-effort parse). */
  frontmatter: Record<string, string>;
  /** Markdown body with frontmatter stripped. */
  body: string;
  /** First `#` heading, or slug fallback. */
  title: string;
}

/** Adapter contract. Pages call only these three methods. */
export interface PlanSource {
  readonly kind: string;
  listSubjects(): Promise<PlanSubject[]>;
  listDocuments(subject: string): Promise<PlanDocument[]>;
  getDocument(subject: string, slug: string): Promise<PlanDocument | null>;
}

/** File name -> URL slug (drops a single trailing `.md`). */
export function slugOf(file: string): string {
  return file.toLowerCase().endsWith('.md') ? file.slice(0, -3) : file;
}

/** Split `---\nfrontmatter\n---\nbody`. Returns empty frontmatter when absent. */
export function splitFrontmatter(raw: string): { frontmatter: Record<string, string>; body: string } {
  if (!raw.startsWith('---')) return { frontmatter: {}, body: raw };
  const end = raw.indexOf('\n---', 3);
  if (end === -1) return { frontmatter: {}, body: raw };
  const block = raw.slice(3, end).trim();
  const body = raw.slice(end + 4).replace(/^\n/, '');
  const frontmatter: Record<string, string> = {};
  for (const line of block.split('\n')) {
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim();
    const value = line.slice(colon + 1).trim();
    if (key) frontmatter[key] = value;
  }
  return { frontmatter, body };
}

/** First `#` heading in the body, else the slug. */
export function titleOf(body: string, fallback: string): string {
  for (const line of body.split('\n')) {
    const match = /^#{1,3}\s+(.+)\s*$/.exec(line.trim());
    if (match) return match[1].trim();
  }
  return fallback;
}

export function toPlanDocument(subject: string, file: string, raw: string): PlanDocument {
  const { frontmatter, body } = splitFrontmatter(raw);
  const slug = slugOf(file);
  return { subject, file, slug, raw, frontmatter, body, title: titleOf(body, slug) };
}
