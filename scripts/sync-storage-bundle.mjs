#!/usr/bin/env node
import { cpSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// The curated bundle ships no extensions. Keep its storage runtime and SQL
// resources byte-identical to the portable canonical implementation.
for (const path of [
  'skills/_shared/storage',
  'skills/_shared/scripts/workflow-state.ts',
  'skills/_shared/scripts/workflow-state-cli.ts',
  'skills/_shared/scripts/workflow-state.test.ts',
  'skills/_shared/scripts/consumer-persist.test.ts',
  'skills/_shared/scripts/file-store.test.ts',
  'skills/_shared/scripts/storage-publication.test.ts',
  'skills/_shared/scripts/plan-source.test.ts',
  'migrations',
  'skills/_shared/scripts/postgres-store.test.ts',
  'skills/_shared/workflow-state-access.md',
]) {
  const target = resolve(root, 'plugins/buck-workflow', path);
  mkdirSync(dirname(target), { recursive: true });
  cpSync(resolve(root, path), target, { recursive: true });
}
