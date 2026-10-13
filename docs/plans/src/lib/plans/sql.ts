import { toPlanDocument, type PlanDocument, type PlanSource, type PlanSubject } from './types.js';

export interface StoredPlan {
  subjectId: string;
  logicalName: string;
  bytes: Uint8Array;
}

export type PlanLoader = () => Promise<readonly StoredPlan[]>;

async function defaultLoader(): Promise<readonly StoredPlan[]> {
  const [{ withConfiguredStore }, { listVisiblePlans }] = await Promise.all([
    import('../../../../../skills/_shared/scripts/workflow-state.js'),
    import('../../../../../skills/_shared/storage/consumers.js'),
  ]);
  return withConfiguredStore(process.cwd(), async (store, context) => {
    if (!context.worktreeId) throw new Error('plan reader requires a trusted worktree identity');
    const visible = await listVisiblePlans(store, {
      projectId: context.projectId,
      branchId: context.branchId,
      worktreeId: context.worktreeId,
      runId: context.runId ?? context.worktreeId,
      publishedRevisionIds: context.publishedRevisionIds,
    });
    return visible.map((item) => ({ subjectId: item.key.subjectId, logicalName: item.key.logicalName, bytes: item.bytes }));
  });
}

/** Adapter-backed plan reader. The old SQL stub is not a source of truth. */
export class SqlPlanSource implements PlanSource {
  readonly kind = 'sql';
  constructor(private readonly load: PlanLoader = defaultLoader) {}

  async listSubjects(): Promise<PlanSubject[]> {
    const grouped = new Map<string, Set<string>>();
    for (const item of await this.load()) {
      const files = grouped.get(item.subjectId) ?? new Set<string>();
      files.add(item.logicalName);
      grouped.set(item.subjectId, files);
    }
    return [...grouped.entries()].map(([name, files]) => ({
      name,
      status: null,
      documents: [...files].sort((left, right) => left.localeCompare(right)),
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
