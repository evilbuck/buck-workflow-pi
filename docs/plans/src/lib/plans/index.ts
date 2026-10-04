import { FilesystemPlanSource } from './filesystem.js';
import { SqlPlanSource } from './sql.js';
import type { PlanDocument, PlanSource, PlanSubject } from './types.js';

// Source selection. PLAN_SOURCE=fs (default) | sql | combined.
// `combined` serves the union of both sources; SQL wins on slug collisions
// so database edits can overlay committed .context/ files.

export type PlanSourceKind = 'fs' | 'sql' | 'combined';

export class CombinedPlanSource implements PlanSource {
  readonly kind = 'combined';
  constructor(
    private readonly primary: PlanSource,
    private readonly fallback: PlanSource,
  ) {}

  async listSubjects(): Promise<PlanSubject[]> {
    const [a, b] = await Promise.all([this.primary.listSubjects(), this.fallback.listSubjects()]);
    const merged = new Map<string, PlanSubject>();
    for (const subject of [...b, ...a]) {
      const existing = merged.get(subject.name);
      if (!existing) {
        merged.set(subject.name, { ...subject, documents: [...subject.documents] });
        continue;
      }
      const files = new Set([...existing.documents, ...subject.documents]);
      merged.set(subject.name, {
        name: subject.name,
        status: existing.status ?? subject.status,
        documents: [...files].sort((x, y) => x.localeCompare(y)),
      });
    }
    return [...merged.values()].sort((x, y) => y.name.localeCompare(x.name));
  }

  async listDocuments(subject: string): Promise<PlanDocument[]> {
    const [a, b] = await Promise.all([
      this.primary.listDocuments(subject).catch(() => []),
      this.fallback.listDocuments(subject).catch(() => []),
    ]);
    const bySlug = new Map<string, PlanDocument>();
    for (const doc of [...b, ...a]) bySlug.set(doc.slug, doc);
    return [...bySlug.values()].sort((x, y) => x.file.localeCompare(y.file));
  }

  async getDocument(subject: string, slug: string): Promise<PlanDocument | null> {
    return (
      (await this.primary.getDocument(subject, slug).catch(() => null)) ??
      (await this.fallback.getDocument(subject, slug).catch(() => null))
    );
  }
}

export function createPlanSource(kind: PlanSourceKind = defaultSourceKind()): PlanSource {
  switch (kind) {
    case 'sql':
      return new SqlPlanSource();
    case 'combined':
      return new CombinedPlanSource(new SqlPlanSource(), new FilesystemPlanSource());
    case 'fs':
    default:
      return new FilesystemPlanSource();
  }
}

function defaultSourceKind(): PlanSourceKind {
  const raw = (process.env.PLAN_SOURCE ?? 'fs').toLowerCase();
  if (raw === 'sql' || raw === 'combined' || raw === 'fs') return raw;
  return 'fs';
}
