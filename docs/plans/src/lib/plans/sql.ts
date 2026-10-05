import type { PlanDocument, PlanSource, PlanSubject } from './types.js';

// Future SQL source for plan markdown stored in the database.
//
// The memories schema (migrations/001_initial_schema.sql) has no plan-document
// table yet, so this class is intentionally a typed stub: it implements the
// PlanSource contract, reports whether it is configured, and fails closed with
// a message that names the missing piece. When the table lands, fill in the
// three methods with `pg` queries against SQL_MEMORY_URL and no page needs to
// change — see createPlanSource() in index.ts.
//
// Expected row shape (proposal, not yet migrated):
//   plan_documents(subject text, slug text, title text,
//                  body text, frontmatter jsonb, updated_at timestamptz)

const MISSING = (method: string) =>
  `SqlPlanSource.${method} is not implemented: no plan-document table exists yet. ` +
  `Serve from FilesystemPlanSource (PLAN_SOURCE=fs) until the migration lands.`;

export class SqlPlanSource implements PlanSource {
  readonly kind = 'sql';
  private readonly connectionString: string | undefined;

  constructor(connectionString?: string) {
    this.connectionString = connectionString ?? process.env.SQL_MEMORY_URL;
  }

  isConfigured(): boolean {
    return Boolean(this.connectionString);
  }

  async listSubjects(): Promise<PlanSubject[]> {
    throw new Error(MISSING('listSubjects'));
  }

  async listDocuments(_subject: string): Promise<PlanDocument[]> {
    throw new Error(MISSING('listDocuments'));
  }

  async getDocument(_subject: string, _slug: string): Promise<PlanDocument | null> {
    throw new Error(MISSING('getDocument'));
  }
}
