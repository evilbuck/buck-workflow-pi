import { createHash, randomUUID } from "node:crypto";
import { mkdir, open, readdir, readFile, rename, rm, stat, writeFile, type FileHandle } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import type { ArtifactKey, ArtifactQuery, ArtifactRevision, CheckpointSeal, LifecycleRecord, LifecycleTransition, RunReceipt, ScopedCorrection, StorageStore } from "./contract.js";
import { cloneRevision, keyId, searchableText, validateRevision, visible } from "./adapter-utils.js";
import { assertCorrectionPredecessor, assertReceiptComplete, assertReceiptIdentity, assertReceiptReadback, correctionDecision, correctionQuery, inspectStoredLifecycle, lifecycleRevision, receiptRevisionReadable, selectPage, tombstoneRevision, TOMBSTONE_SOURCE, type KeyedPageItem, type StoredCorrection } from "./domain.js";
import { overlayPublishedRevisions } from "./visibility.js";
import { validateArtifactKey } from "./identity.js";

interface ManifestRecord {
  key: ArtifactKey;
  revision: string;
  sha256: string;
  author: string;
  source: string;
  createdAt: string;
  links: readonly ArtifactKey[];
  blob: string;
  searchText?: string;
}

interface Manifest {
  generation: number;
  current: Record<string, string>;
  revisions: Record<string, ManifestRecord>;
  lifecycle: Record<string, { revision: string; state: string; evidence: readonly string[] }>;
  lifecycleScope: Record<string, { revision: string; state: string; evidence: readonly string[]; provenance: LifecycleRecord["provenance"] }>;
  corrections: Record<string, StoredCorrection>;
  receipts: Record<string, RunReceipt>;
  checkpoints: Record<string, CheckpointSeal & { id: string; boundCommit?: string }>;
}

interface ProjectionStamp {
  projected: Record<string, { revision: string; sha256: string }>;
  owners: Record<string, string>;
}

const EMPTY: Manifest = { generation: 0, current: {}, revisions: {}, lifecycle: {}, lifecycleScope: {}, corrections: {}, receipts: {}, checkpoints: {} };


function correctionStorageKey(correction: ScopedCorrection): string {
  return `${correction.key.projectId}\0${correction.key.branchId ?? ""}\0${keyId(correction.key)}\0${correction.idempotencyKey}`;
}

function listedItem(record: ManifestRecord, revision: string): KeyedPageItem {
  return { key: record.key, revision, createdAt: record.createdAt, logicalName: record.key.logicalName, source: record.source, searchText: record.searchText ?? "" };
}

function matchesListQuery(record: ManifestRecord, revision: string, query: ArtifactQuery): boolean {
  if (record.key.projectId !== query.projectId) return false;
  if (query.subjectId !== undefined && record.key.subjectId !== query.subjectId) return false;
  if (query.kind !== undefined && record.key.kind !== query.kind) return false;
  if (query.logicalNamePrefix !== undefined && !record.key.logicalName.startsWith(query.logicalNamePrefix)) return false;
  return visible({ ...record, revision, bytes: new Uint8Array() } as ArtifactRevision, query);
}

export interface FileStoreOptions {
  root: string;
  editableRoot?: string;
  lockTimeoutMs?: number;
  externalNamespace?: boolean;
  subjectNamespace?: boolean;
  projectKey?: string;
}

export class FileStorageStore implements StorageStore {
  readonly #root: string;
  readonly #editableRoot: string;
  readonly #timeout: number;
  readonly #externalNamespace: boolean;
  readonly #subjectNamespace: boolean;
  #lock: FileHandle | undefined;
  #queue: Promise<void> = Promise.resolve();
  #touched: string[] = [];

  constructor(options: FileStoreOptions) {
    this.#root = resolve(options.root);
    this.#editableRoot = resolve(options.editableRoot ?? options.root);
    this.#timeout = options.lockTimeoutMs ?? 10_000;
    this.#externalNamespace = options.externalNamespace ?? false;
    this.#subjectNamespace = options.subjectNamespace ?? false;
  }

  async read(key: ArtifactKey, revision?: string): Promise<ArtifactRevision | null> {
    return this.#locked(() => this.#readLocked(key, revision));
  }

  async #readLocked(key: ArtifactKey, revision?: string): Promise<ArtifactRevision | null> {
    validateArtifactKey(key);
    await this.#discardInterrupted();
    const manifest = await this.#load();
    const id = keyId(key);
    const revisionId = revision ?? manifest.current[id];
    if (!revisionId) return null;
    const record = manifest.revisions[this.#recordId(id, revisionId)];
    if (!record) return null;
    if (revision === undefined && record.source === TOMBSTONE_SOURCE) return null;
    const bytes = new Uint8Array(await readFile(this.#blobPath(record.blob)));
    if (revision !== undefined) return this.#materialize(record, revisionId, bytes);
    return this.#readCurrent(key, id, revisionId, record, bytes);
  }

  async #readCurrent(key: ArtifactKey, id: string, revisionId: string, record: ManifestRecord, bytes: Uint8Array): Promise<ArtifactRevision> {
    const projection = await this.#readEditable(key);
    if (!projection || projection.equals(Buffer.from(bytes))) return this.#materialize(record, revisionId, bytes);
    if (await this.#isUserEdit(id, revisionId, record.sha256, key)) return this.#storeDirectEdit(key, record, revisionId, projection);
    if (await this.#ownsProjection(id, key)) await this.#projectRecord(record, bytes);
    return this.#materialize(record, revisionId, bytes);
  }

  async #storeDirectEdit(key: ArtifactKey, record: ManifestRecord, revisionId: string, projection: Buffer): Promise<ArtifactRevision> {
    const edited = new Uint8Array(projection);
    const [reconciled] = await this.#mutateLocked(async (manifest) => {
      const item: ArtifactRevision = {
        key: { ...key },
        revision: randomUUID(),
        bytes: edited,
        sha256: createHash("sha256").update(edited).digest("hex"),
        author: record.author,
        source: "direct-file-edit",
        createdAt: new Date().toISOString(),
        links: record.links,
        expectedRevision: revisionId,
      };
      await this.#stageRevision(manifest, item);
      return [cloneRevision(item)];
    });
    if (!reconciled) throw new Error("direct file edit was not stored");
    return reconciled;
  }

  async list(query: ArtifactQuery): Promise<readonly ArtifactRevision[]> {
    return this.#queryPage(query);
  }

  async search(query: ArtifactQuery & { text: string }): Promise<readonly ArtifactRevision[]> {
    return this.#queryPage(query);
  }

  async #queryPage(query: ArtifactQuery & { text?: string }): Promise<ArtifactRevision[]> {
    const manifest = await this.#load();
    for (const [id, revision] of Object.entries(manifest.current)) {
      const record = manifest.revisions[this.#recordId(id, revision)];
      if (record?.key.branchId === query.branchId && matchesListQuery(record, revision, query)) await this.read(record.key);
    }
    return this.#loadPage(selectPage(this.#pageItems(await this.#load(), query), query));
  }

  async writeBatch(revisions: readonly ArtifactRevision[]): Promise<readonly ArtifactRevision[]> {
    return this.#mutate(async (manifest) => {
      for (const item of revisions) await this.#stageRevision(manifest, item);
      return revisions.map(cloneRevision);
    });
  }

  async correct(correction: ScopedCorrection): Promise<ArtifactRevision | null> {
    return this.#mutate((manifest) => this.#applyCorrection(manifest, correction));
  }

  async #applyCorrection(manifest: Manifest, correction: ScopedCorrection): Promise<ArtifactRevision | null> {
    const storedKey = correctionStorageKey(correction);
    const existing = manifest.corrections[storedKey] ?? null;
    if (correctionDecision(existing, correction) === "replay") return this.#replayCorrection(manifest, correction, existing!);
    const expected = assertCorrectionPredecessor(this.#pageItems(manifest, correctionQuery(correction)), correction);
    const item = correction.replacement ?? tombstoneRevision(correction.key, correction.predecessorRevision);
    await this.#stageRevision(manifest, { ...item, expectedRevision: expected });
    manifest.corrections[storedKey] = { predecessorRevision: correction.predecessorRevision, resultRevision: correction.replacement ? item.revision : null, replacementSha256: correction.replacement?.sha256 ?? null };
    return correction.replacement ? cloneRevision(item) : null;
  }


  async #replayCorrection(manifest: Manifest, correction: ScopedCorrection, stored: StoredCorrection): Promise<ArtifactRevision | null> {
    if (!stored.resultRevision) return null;
    const record = manifest.revisions[this.#recordId(keyId(correction.key), stored.resultRevision)];
    if (!record) throw new Error("uncertain persistence blocks save");
    return this.#materialize(record, stored.resultRevision, new Uint8Array(await readFile(this.#blobPath(record.blob))));
  }


  async transition(input: LifecycleTransition): Promise<string> {
    await this.#queryPage({ projectId: input.projectId, branchId: input.branchId, subjectId: input.subjectId, publishedRevisionIds: input.publishedRevisionIds ?? [] });
    return this.#mutate(async (manifest) => {
      const items = await this.#evidenceBodies(manifest, input);
      const item = lifecycleRevision(items, input);
      await this.#stageRevision(manifest, item);
      return item.revision;
    });
  }

  async inspectLifecycle(projectId: string, branchId: string, subjectId: string, publishedRevisionIds: readonly string[] = []): Promise<LifecycleRecord | null> {
    return inspectStoredLifecycle(await this.list({ projectId, branchId, subjectId, publishedRevisionIds }), projectId, branchId, subjectId);
  }

  async writeReceipt(receipt: RunReceipt): Promise<void> {
    await this.#mutate(async (manifest) => { await this.#persistReceipt(manifest, receipt); });
  }

  async #persistReceipt(manifest: Manifest, receipt: RunReceipt): Promise<void> {
    const key = `${receipt.projectId}\0${receipt.runId}`;
    const current = manifest.receipts[key] ?? null;
    assertReceiptIdentity(current, receipt);
    assertReceiptComplete(current, receipt, await this.#readableRevisionIds(manifest, receipt));
    const stored = { ...receipt, artifactRevisions: [...receipt.artifactRevisions], metadataDuties: receipt.metadataDuties ? [...receipt.metadataDuties] : undefined };
    manifest.receipts[key] = stored;
    assertReceiptReadback(stored, receipt);
  }

  async readReceipt(projectId: string, runId: string): Promise<RunReceipt | null> {
    const receipt = (await this.#load()).receipts[`${projectId}\0${runId}`];
    return receipt ? { ...receipt, artifactRevisions: [...receipt.artifactRevisions], metadataDuties: receipt.metadataDuties ? [...receipt.metadataDuties] : undefined } : null;
  }

  #pageItems(manifest: Manifest, query: ArtifactQuery): KeyedPageItem[] {
    const records = [];
    for (const record of Object.values(manifest.revisions)) {
      const revision = record.revision;
      const current = manifest.current[keyId(record.key)] === revision;
      if ((current || (record.key.branchId !== query.branchId && query.publishedRevisionIds.includes(revision))) && matchesListQuery(record, revision, query)) records.push(listedItem(record, revision));
    }
    return overlayPublishedRevisions(records, query.branchId);
  }

  async #loadPage(page: readonly KeyedPageItem[]): Promise<ArtifactRevision[]> {
    const results: ArtifactRevision[] = [];
    for (const item of page) {
      const loaded = await this.read(item.key, item.revision);
      if (loaded) results.push(loaded);
    }
    return results;
  }

  async #evidenceBodies(manifest: Manifest, input: LifecycleTransition): Promise<ArtifactRevision[]> {
    const query: ArtifactQuery = { projectId: input.projectId, branchId: input.branchId, subjectId: input.subjectId, publishedRevisionIds: input.publishedRevisionIds ?? [] };
    const bodies: ArtifactRevision[] = [];
    for (const item of selectPage(this.#pageItems(manifest, query), {})) {
      const record = manifest.revisions[this.#recordId(keyId(item.key), item.revision)];
      if (!record) throw new Error("uncertain persistence blocks save");
      bodies.push(this.#materialize(record, item.revision, new Uint8Array(await readFile(this.#blobPath(record.blob)))));
    }
    return bodies;
  }

  async #readableRevisionIds(manifest: Manifest, receipt: RunReceipt): Promise<Set<string>> {
    const readable = new Set<string>();
    for (const record of Object.values(manifest.revisions)) {
      if (!receipt.artifactRevisions.includes(record.revision)) continue;
      const item = this.#materialize(record, record.revision, new Uint8Array(await readFile(this.#blobPath(record.blob))));
      if (receiptRevisionReadable(item, receipt)) readable.add(record.revision);
    }
    return readable;
  }

  async sealCheckpoint(checkpoint: CheckpointSeal): Promise<string> {
    const current = await this.#load();
    for (const [id, revisionId] of Object.entries(current.current)) {
      const record = current.revisions[this.#recordId(id, revisionId)];
      if (record) await this.read(record.key);
    }
    return this.#mutate((manifest) => {
      const id = randomUUID();
      manifest.checkpoints[id] = { ...checkpoint, revisionSet: checkpoint.revisionSet.map((revision) => ({ ...revision })), id };
      return id;
    });
  }

  async bindCheckpoint(checkpointId: string, commit: string): Promise<void> {
    await this.#mutate((manifest) => {
      const checkpoint = manifest.checkpoints[checkpointId];
      if (!checkpoint || checkpoint.boundCommit) throw new Error("unknown or already-bound checkpoint");
      if (!commit) throw new Error("checkpoint commit is required");
      checkpoint.boundCommit = commit;
    });
  }

  async reconcile(_integrationTip: string): Promise<void> {
    // Promotion requires Git ancestry evidence and belongs to the publication service.
  }

  async *exportArtifacts(query: ArtifactQuery): AsyncIterable<ArtifactRevision> {
    for (const revision of await this.list({ ...query, limit: undefined, cursor: undefined })) yield revision;
  }

  async importArtifacts(revisions: AsyncIterable<ArtifactRevision>): Promise<void> {
    const batch: ArtifactRevision[] = [];
    for await (const revision of revisions) batch.push(revision);
    await this.writeBatch(batch);
  }

  #validateProjectionRevision(item: ArtifactRevision): void {
    validateRevision(item);
    validateArtifactKey(item.key);
    for (const link of item.links) validateArtifactKey(link);
    this.#editablePath(item.key.logicalName, item.key);
  }

  async #stageRevision(manifest: Manifest, item: ArtifactRevision): Promise<void> {
    this.#validateProjectionRevision(item);
    const id = keyId(item.key);
    const current = manifest.current[id] ?? null;
    if (item.expectedRevision !== undefined && item.expectedRevision !== current) throw new Error(`stale revision rejected for ${item.key.logicalName}`);
    const recordId = this.#recordId(id, item.revision);
    if (manifest.revisions[recordId]) throw new Error(`immutable revision already exists: ${item.revision}`);
    const blob = `${item.sha256}.bin`;
    const blobPath = this.#blobPath(blob);
    await mkdir(dirname(blobPath), { recursive: true, mode: 0o700 });
    try { await writeFile(blobPath, item.bytes, { flag: "wx", mode: 0o600 }); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      const existing = await readFile(blobPath);
      if (createHash("sha256").update(existing).digest("hex") !== item.sha256) throw new Error("content-addressed blob hash collision");
    }

    if (!this.#touched.includes(id)) this.#touched.push(id);
    manifest.revisions[recordId] = { key: { ...item.key }, revision: item.revision, sha256: item.sha256, author: item.author, source: item.source, createdAt: item.createdAt, links: item.links.map((link) => ({ ...link })), blob, searchText: searchableText(item.bytes) };
    manifest.current[id] = item.revision;
  }

  async #load(): Promise<Manifest> {
    try {
      const parsed = JSON.parse(await readFile(join(this.#root, "manifest.json"), "utf8")) as Partial<Manifest>;
      return { ...structuredClone(EMPTY), ...parsed, lifecycleScope: parsed.lifecycleScope ?? {}, corrections: parsed.corrections ?? {} };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return structuredClone(EMPTY);
      throw error;
    }
  }

  #recordId(id: string, revision: string): string { return `${id}\0${revision}`; }
  #blobPath(blob: string): string { return join(this.#root, "revisions", blob); }
  #stampPath(): string { return join(this.#root, "projections.json"); }

  async #readEditable(key: ArtifactKey): Promise<Buffer | null> {
    const path = this.#editablePath(key.logicalName, key);
    try { return await readFile(path); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  async #writeEditable(revision: ArtifactRevision): Promise<void> {
    const path = this.#editablePath(revision.key.logicalName, revision.key);
    await mkdir(dirname(path), { recursive: true, mode: 0o700 });
    await writeFile(path, revision.bytes, { mode: 0o600 });
  }

  #editablePath(relative: string, key: ArtifactKey): string {
    if (relative.startsWith("/") || relative.split(/[\\/]/u).includes("..")) throw new Error("unsafe editable artifact path");
    const privateRun = key.runId !== undefined;
    const root = privateRun && !this.#externalNamespace ? join(this.#root, "private") : this.#editableRoot;
    const path = resolve(root, this.#editableRelative(key));
    if (!path.startsWith(`${root}/`)) throw new Error("editable artifact escapes its root");
    return path;
  }

  async #mutate<T>(operation: (manifest: Manifest) => Promise<T> | T): Promise<T> {
    return this.#locked(() => this.#mutateLocked(operation));
  }

  async #mutateLocked<T>(operation: (manifest: Manifest) => Promise<T> | T): Promise<T> {
    await this.#discardInterrupted();
    const manifest = await this.#load();
    this.#touched = [];
    const result = await operation(manifest);
    const touched = this.#touched;
    this.#touched = [];
    await this.#publish(manifest, touched);
    return result;
  }

  async #publish(manifest: Manifest, touched: readonly string[]): Promise<void> {
    manifest.generation += 1;
    const staging = join(this.#root, "manifest.next");
    await writeFile(staging, `${JSON.stringify(manifest)}\n`, { mode: 0o600 });
    const pending = join(this.#root, "projection.pending");
    const pendingNext = join(this.#root, ".projection.next");
    await writeFile(pendingNext, JSON.stringify({ generation: manifest.generation, ids: touched }), { mode: 0o600 });
    await rename(pendingNext, pending);
    await rename(staging, join(this.#root, "manifest.json"));
    try {
      await this.#projectIds(manifest, touched);
      await rm(join(this.#root, "projection.pending"), { force: true });
    } catch (cause) {
      throw new Error(`generation ${manifest.generation} committed; editable projection pending recovery`, { cause });
    }
  }

  async #projectIds(manifest: Manifest, ids: readonly string[]): Promise<void> {
    const stamp = await this.#loadStamp();
    for (const id of ids) {
      const revisionId = manifest.current[id];
      if (!revisionId) continue;
      const record = manifest.revisions[this.#recordId(id, revisionId)];
      if (!record || record.source === TOMBSTONE_SOURCE) continue;
      const bytes = new Uint8Array(await readFile(this.#blobPath(record.blob)));
      await this.#projectRecord(record, bytes);
      stamp.projected[id] = { revision: revisionId, sha256: record.sha256 };
      stamp.owners[this.#editableRelative(record.key)] = id;
    }
    const temporary = join(this.#root, ".projections.tmp");
    await writeFile(temporary, `${JSON.stringify(stamp)}\n`, { mode: 0o600 });
    await rename(temporary, this.#stampPath());
  }

  async #projectRecord(record: ManifestRecord, bytes: Uint8Array): Promise<void> {
    await this.#writeEditable({
      key: record.key,
      revision: record.revision,
      bytes,
      sha256: record.sha256,
      author: record.author,
      source: record.source,
      createdAt: record.createdAt,
      links: record.links,
    });
  }

  async #discardInterrupted(): Promise<void> {
    await this.#recoverProjection();
    await rm(join(this.#root, ".projection.next"), { force: true });
    const staging = await this.#stagingNames();
    if (staging.length === 0) return;
    const manifest = await this.#load();
    const owned = [];
    for (const [id, revisionId] of Object.entries(manifest.current)) {
      const record = manifest.revisions[this.#recordId(id, revisionId)];
      if (record && await this.#ownsProjection(id, record.key)) owned.push(id);
    }
    await this.#projectIds(manifest, owned);
    await Promise.all(staging.map((name) => rm(join(this.#root, name), { force: true })));
  }

  async #recoverProjection(): Promise<void> {
    const path = join(this.#root, "projection.pending");
    let pending: { generation: number; ids: string[] };
    try { pending = JSON.parse(await readFile(path, "utf8")); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
      throw error;
    }
    const manifest = await this.#load();
    if (manifest.generation === pending.generation) await this.#projectIds(manifest, pending.ids);
    await rm(path, { force: true });
  }

  async #stagingNames(): Promise<string[]> {
    try {
      const names = await readdir(this.#root);
      return names.filter((name) => name === "manifest.next" || name.startsWith(".manifest-"));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }

  async #isUserEdit(id: string, revisionId: string, sha256: string, key: ArtifactKey): Promise<boolean> {
    const stamp = await this.#loadStamp();
    const marked = stamp.projected[id];
    return stamp.owners[this.#editableRelative(key)] === id && marked?.revision === revisionId && marked.sha256 === sha256;
  }

  async #ownsProjection(id: string, key: ArtifactKey): Promise<boolean> {
    const stamp = await this.#loadStamp();
    const owner = stamp.owners[this.#editableRelative(key)];
    return owner === undefined || owner === id;
  }

  #editableRelative(key: ArtifactKey): string {
    const scoped = this.#externalNamespace || key.runId !== undefined;
    const parts = scoped ? [key.branchId, key.worktreeId, key.runId] : [];
    if (this.#subjectNamespace || key.runId !== undefined) parts.push(key.subjectId);
    return [...parts.filter((part): part is string => part !== undefined), key.logicalName].join("/");
  }

  async #loadStamp(): Promise<ProjectionStamp> {
    try {
      const stamp = JSON.parse(await readFile(this.#stampPath(), "utf8")) as ProjectionStamp;
      return { projected: stamp.projected ?? {}, owners: stamp.owners ?? {} };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return { projected: {}, owners: {} };
      throw error;
    }
  }

  async #locked<T>(operation: () => Promise<T>): Promise<T> {
    const predecessor = this.#queue;
    const { promise, resolve: release } = Promise.withResolvers<void>();
    this.#queue = promise;
    await predecessor;
    try {
      await this.#acquireLock();
      try { return await operation(); }
      finally { await this.#releaseLock(); }
    } finally { release(); }
  }

  async #acquireLock(): Promise<void> {
    await mkdir(this.#root, { recursive: true, mode: 0o700 });
    const lockPath = join(this.#root, ".lock");
    const deadline = Date.now() + this.#timeout;
    for (;;) {
      const handle = await this.#tryLock(lockPath);
      if (handle) {
        this.#lock = handle;
        return;
      }
      if (Date.now() >= deadline) throw new Error("file storage lock timeout; concurrent or abandoned writer");
      await new Promise((resolveWait) => setTimeout(resolveWait, 15));
    }
  }

  async #tryLock(lockPath: string): Promise<FileHandle | undefined> {
    try {
      const handle = await open(lockPath, "wx", 0o600);
      await handle.writeFile(`${process.pid}\n`);
      return handle;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      if (await this.#holderDead(lockPath)) await rm(lockPath, { force: true });
      return undefined;
    }
  }

  async #holderDead(lockPath: string): Promise<boolean> {
    try {
      const pid = Number((await readFile(lockPath, "utf8")).trim());
      if (!Number.isInteger(pid) || pid <= 0) return (await stat(lockPath)).mtimeMs + this.#timeout < Date.now();
      process.kill(pid, 0);
      return false;
    } catch (error) {
      return (error as NodeJS.ErrnoException).code === "ESRCH" || (error as NodeJS.ErrnoException).code === "ENOENT";
    }
  }

  async #releaseLock(): Promise<void> {
    await this.#lock?.close();
    this.#lock = undefined;
    await rm(join(this.#root, ".lock"), { force: true });
  }

  #materialize(record: ManifestRecord, revisionId: string, bytes: Uint8Array): ArtifactRevision {
    return { ...record, key: { ...record.key }, revision: revisionId, bytes, links: record.links.map((link) => ({ ...link })) };
  }
}

export class RepoFilesStorageStore extends FileStorageStore {
  constructor(options: { contextRoot: string; manifestRoot: string; lockTimeoutMs?: number }) {
    super({ root: options.manifestRoot, editableRoot: options.contextRoot, subjectNamespace: true, lockTimeoutMs: options.lockTimeoutMs });
  }
}

const SAFE_PROJECT_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

export function storageProjectSegment(projectKey: string): string {
  return SAFE_PROJECT_SEGMENT.test(projectKey) ? projectKey : `h-${createHash("sha256").update(projectKey).digest("hex")}`;
}

export class ExternalFilesStorageStore extends FileStorageStore {
  constructor(options: { projectKey: string; root?: string; lockTimeoutMs?: number }) {
    const base = process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
    const template = options.root ?? join(base, "buck-workflow", "{project}", ".context");
    const root = template.replaceAll("{project}", storageProjectSegment(options.projectKey));
    super({ root, editableRoot: root, externalNamespace: true, subjectNamespace: true, lockTimeoutMs: options.lockTimeoutMs, projectKey: options.projectKey });
  }
}
