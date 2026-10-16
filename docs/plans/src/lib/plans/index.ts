import { SqlPlanSource } from './sql.js';
import type { PlanSource } from './types.js';

/** Read the selected workflow adapter; filesystem fallback bypasses visibility. */
export function createPlanSource(): PlanSource {
  return new SqlPlanSource();
}
