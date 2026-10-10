export interface CaptureWindow {
  id: string;
  text: string;
}

export interface CaptureDeadlines {
  judgeMs?: number;
  extractMs?: number;
  rememberMs?: number;
}

export interface CaptureDeps {
  isConsumed: (windowId: string) => boolean;
  persistConsumed: (windowId: string) => void | Promise<void>;
  judge: (windowText: string) => Promise<unknown>;
  extract: (windowText: string, signal: AbortSignal) => Promise<string>;
  remember: (input: {
    cwd: string;
    body: string;
    subject: string;
    phase: string;
    category: string;
  }) => Promise<string>;
  deadlines?: CaptureDeadlines;
}

const DEFAULT_DEADLINE_MS = 8_000;

function durableNoul(value: unknown): number | null {
  if (!value || typeof value !== "object") return null;
  const record = value as {
    ok?: unknown;
    result?: { answers?: { durable?: { type?: unknown; noul?: unknown } } };
  };
  const answer = record.ok === true ? record.result?.answers?.durable : undefined;
  if (!answer || answer.type !== "noul" || typeof answer.noul !== "number") return null;
  if (!Number.isFinite(answer.noul) || answer.noul < 0 || answer.noul > 1) return null;
  return answer.noul;
}

function acceptableFact(body: string): boolean {
  const text = body.trim();
  if (!text || /[\r\n]/.test(text)) return false;
  if (/\[REDACTED\]/i.test(text)) return false;
  if (/\bBearer\s+\S+/i.test(text)) return false;
  if (/\bSQL_MEMORY_URL\b/i.test(text)) return false;
  if (/postgres(?:ql)?:\/\//i.test(text)) return false;
  if (/\b(api[_-]?key|secret|token|password)\b\s*["']?\s*[:=]/i.test(text)) return false;
  const endings = text.match(/[.!?](?=\s|$)/g) ?? [];
  return endings.length <= 1;
}

async function bounded<T>(work: (signal: AbortSignal) => Promise<T>, ms: number): Promise<T> {
  const controller = new AbortController();
  let rejectDeadline: (error: Error) => void = () => undefined;
  const deadline = new Promise<T>((_, reject) => {
    rejectDeadline = reject;
  });
  const timer = setTimeout(() => {
    controller.abort();
    rejectDeadline(new Error("deadline"));
  }, ms);
  try {
    return await Promise.race([work(controller.signal), deadline]);
  } finally {
    clearTimeout(timer);
  }
}

/** Persist the window, then store at most one fact through the injected writer. */
export async function captureTurnMemory(
  input: { window: CaptureWindow | null; cwd: string },
  deps: CaptureDeps,
): Promise<{ savedId: string | null }> {
  if (!input.window || deps.isConsumed(input.window.id)) return { savedId: null };
  try {
    await deps.persistConsumed(input.window.id);
    const noul = durableNoul(await bounded(() => deps.judge(input.window!.text), deps.deadlines?.judgeMs ?? DEFAULT_DEADLINE_MS));
    if (noul === null || noul < 0.7) return { savedId: null };
    const body = await bounded(
      (signal) => deps.extract(input.window!.text, signal),
      deps.deadlines?.extractMs ?? DEFAULT_DEADLINE_MS,
    );
    if (!acceptableFact(body)) return { savedId: null };
    const savedId = await bounded(
      () => deps.remember({
        cwd: input.cwd,
        body: body.trim(),
        subject: "turn-memory",
        phase: input.window!.id,
        category: "project",
      }),
      deps.deadlines?.rememberMs ?? DEFAULT_DEADLINE_MS,
    );
    return { savedId };
  } catch {
    return { savedId: null };
  }
}
