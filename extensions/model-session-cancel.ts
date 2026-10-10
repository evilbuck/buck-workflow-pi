export function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw new Error("aborted");
}

export async function createCancellableSession<T extends { dispose(): void }>(
  signal: AbortSignal | undefined,
  create: () => Promise<{ session: T }>,
): Promise<T> {
  throwIfAborted(signal);
  let abortedDuringCreate = false;
  const markAborted = (): void => {
    abortedDuringCreate = true;
  };
  signal?.addEventListener("abort", markAborted, { once: true });
  try {
    const created = await create();
    if (abortedDuringCreate || signal?.aborted) {
      created.session.dispose();
      throw new Error("aborted");
    }
    return created.session;
  } finally {
    signal?.removeEventListener("abort", markAborted);
  }
}

export function bindAbort(signal: AbortSignal | undefined, abort: () => void): () => void {
  if (!signal) return () => undefined;
  const onAbort = (): void => abort();
  signal.addEventListener("abort", onAbort);
  return () => signal.removeEventListener("abort", onAbort);
}
