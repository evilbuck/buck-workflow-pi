const MARKER_TYPE = "turn-memory-tick";
const CONSUMED_TYPE = "turn-memory-consumed";

interface PromptTick {
  identity: string;
  userPrompt: string;
  assistantText: string;
  willContinue: boolean;
}

interface SelectedWindow {
  id: string;
  text: string;
}

function object(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== "object") return null;
  // Persisted session entries are object-shaped; use a named boundary cast after runtime narrowing.
  const record = value as Record<string, unknown>;
  return record;
}

function readTick(value: unknown): PromptTick | null {
  const entry = object(value);
  if (entry?.type !== "custom" || entry.customType !== MARKER_TYPE) return null;
  const data = object(entry.data);
  if (!data || typeof data.identity !== "string") return null;
  return {
    identity: data.identity,
    userPrompt: typeof data.userPrompt === "string" ? data.userPrompt : "",
    assistantText: typeof data.assistantText === "string" ? data.assistantText : "",
    willContinue: data.willContinue === true,
  };
}

function consumedWindowIds(entries: unknown[]): Set<string> {
  const consumed = new Set<string>();
  for (const entryValue of entries) {
    const entry = object(entryValue);
    if (entry?.type !== "custom" || entry.customType !== CONSUMED_TYPE) continue;
    const data = object(entry.data);
    if (data && typeof data.windowId === "string") consumed.add(data.windowId);
  }
  return consumed;
}

function redactAssignment(text: string, key: string): string {
  return text.replace(
    new RegExp(String.raw`\b${key}\b\s*["']?\s*[:=]\s*["']?[^\s,"'}]+`, "gi"),
    `${key}=[REDACTED]`,
  );
}

function redact(text: string): string {
  const withoutBearer = text.replace(/\bBearer\s+\S+/gi, "Bearer [REDACTED]");
  const withoutUrl = redactAssignment(withoutBearer, "SQL_MEMORY_URL");
  return withoutUrl.replace(
    /\b(api[_-]?key|secret|token|password)\b\s*["']?\s*[:=]\s*["']?[^\s,"'}]+/gi,
    "$1=[REDACTED]",
  );
}

/** Select the newest three completed, unconsumed prompts from persisted custom entries. */
export function selectTurnMemoryWindow(
  entries: unknown[],
  options: { maxCharacters?: number } = {},
): SelectedWindow | null {
  const ticks: PromptTick[] = [];
  for (const entry of entries) {
    const tick = readTick(entry);
    if (tick && !tick.willContinue && !ticks.some((item) => item.identity === tick.identity)) ticks.push(tick);
  }
  if (ticks.length < 3) return null;

  const latest = ticks.slice(-3);
  const id = JSON.stringify(latest.map((tick) => tick.identity));
  if (consumedWindowIds(entries).has(id)) return null;

  const maxCharacters = options.maxCharacters ?? 12_000;
  const text = redact(latest.map((tick) => `User: ${tick.userPrompt}\nAssistant: ${tick.assistantText}`).join("\n\n"));
  return { id, text: text.slice(0, Math.max(0, maxCharacters)) };
}
