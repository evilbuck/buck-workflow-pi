import { resolve } from 'node:path';
import { toPlanDocument } from './types.js';
import type { PlanDocument, PlanSource, PlanSubject } from './types.js';
import { withConfiguredStore } from '../../../../../skills/_shared/scripts/workflow-state.js';
export interface StoredPlan {
  subjectId: string;
  logicalName: string;
  bytes: Uint8Array;
}

export type PlanLoader = () => Promise<readonly StoredPlan[]>;

async function defaultLoader(): Promise<readonly StoredPlan[]> {
  const root = process.env.BUCK_WORKFLOW_ROOT ?? resolve(process.cwd(), '../..');
  return withConfiguredStore(root, async (store, context) => {
    if (!context.worktreeId) throw new Error('plan reader requires a trusted worktree identity');
    const visible = await store.list({
      projectId: context.projectId,
      branchId: context.branchId,
      publishedRevisionIds: context.publishedRevisionIds,
    });
    return visible
      .filter((item) => ['plan', 'phase', 'spec', 'research', 'subject-index', 'review', 'iterate', 'brainstorm', 'capture', 'grill', 'memory', 'backlog'].includes(item.key.kind) && item.key.logicalName.endsWith('.md'))
      .map((item) => ({ subjectId: item.key.subjectId, logicalName: item.key.logicalName, bytes: item.bytes }));
  });
}

/** Adapter-backed plan reader. The old SQL stub is not a source of truth. */
export class SqlPlanSource implements PlanSource {
  readonly kind = 'sql';
  constructor(private readonly load: PlanLoader = defaultLoader) {}

  async listSubjects(): Promise<PlanSubject[]> {
    const grouped = new Map<string, { files: Set<string>; status: string | null }>();
    for (const item of await this.load()) {
      const subject = grouped.get(item.subjectId) ?? { files: new Set<string>(), status: null };
      subject.files.add(item.logicalName);
      if (item.logicalName === 'index.md') {
        subject.status = toPlanDocument(item.subjectId, item.logicalName, new TextDecoder().decode(item.bytes)).frontmatter.status ?? null;
      }
      grouped.set(item.subjectId, subject);
    }
    return [...grouped.entries()].map(([name, value]) => ({
      name,
      status: value.status,
      documents: [...value.files].sort((left, right) => left.localeCompare(right)),
    })).sort((left, right) => right.name.localeCompare(left.name));
  }

  async listDocuments(subject: string): Promise<PlanDocument[]> {
    return (await this.load())
      .filter((item) => item.subjectId === subject)
      .map((item) => toPlanDocument(subject, item.logicalName, new TextDecoder().decode(item.bytes)))
      .sort((left, right) => left.file.localeCompare(right.file));
  }

  async getDocument(subject: string, slug: string): Promise<PlanDocument | null> {
    const documents = await this.listDocuments(subject);
    return documents.find((item) => item.slug === slug) ?? null;
  }
}
