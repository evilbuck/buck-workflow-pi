import { SqlPlanSource } from './sql.js';
import type { PlanSource } from './types.js';

let buildSource: PlanSource | undefined;

/** Read the selected workflow adapter; filesystem fallback bypasses visibility. */
export function createPlanSource(): PlanSource {
  if (process.env.NODE_ENV === 'production') return buildSource ??= new SqlPlanSource();
  return new SqlPlanSource();
}
