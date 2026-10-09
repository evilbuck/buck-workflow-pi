import { describe, expect, it } from "vitest";
import { selectTurnMemoryWindow } from "../window.js";

function completed(identity: string, userPrompt: string, assistantText: string, willContinue = false) {
  return { type: "custom", customType: "turn-memory-tick", data: { identity, userPrompt, assistantText, willContinue } };
}

describe("selectTurnMemoryWindow", () => {
  it("selects one capped, redacted window after three completed prompts", () => {
    const entries = [
      completed("1", "continue this prompt", "intermediate", true),
      completed("2", "Choose Authorization: Bearer abcdefghijklmnop", "Decision: use SQL."),
      completed("3", "SQL_MEMORY_URL=postgres://user:secret@host/db", "Keep existing behavior."),
      completed("4", "Set api_key=secret-value", "Store the decision."),
    ];
    expect(selectTurnMemoryWindow(entries, { maxCharacters: 300 })).toMatchObject({
      id: expect.any(String),
      text: expect.not.stringContaining("abcdefghijklmnop"),
    });
    const result = selectTurnMemoryWindow(entries, { maxCharacters: 300 });
    expect(result?.text).not.toContain("postgres://user:secret@host/db");
    expect(result?.text).not.toContain("secret-value");
    expect(result?.text.length).toBeLessThanOrEqual(300);
  });

  it("does not capture continuation, replayed windows, or tool payloads", () => {
    expect(selectTurnMemoryWindow([
      completed("1", "one", "a", true),
      completed("2", "two", "b"),
      completed("3", "three", "c"),
    ])).toBeNull();
    const three = [completed("1", "one", "a"), completed("2", "two", "b"), completed("3", "three", "c")];
    const selected = selectTurnMemoryWindow(three);
    expect(selected).not.toBeNull();
    expect(selectTurnMemoryWindow([...three, { type: "custom", customType: "turn-memory-consumed", data: { windowId: selected!.id } }])).toBeNull();
    expect(selectTurnMemoryWindow([
      ...three,
      { type: "message", message: { role: "toolResult", content: "do not persist this" } },
    ])?.text).not.toContain("do not persist this");
  });

  it("redacts quoted configuration secrets and keeps distinct identity triples distinct", () => {
    const quoted = selectTurnMemoryWindow([
      completed("a:b", '{"api_key":"secret-value"}', "noted"),
      completed("c", '{"SQL_MEMORY_URL":"postgres://user:pass@host/db"}', "noted"),
      completed("d:e", '{"password":"hunter2"}', "noted"),
    ]);
    expect(quoted?.text).not.toContain("secret-value");
    expect(quoted?.text).not.toContain("postgres://user:pass@host/db");
    expect(quoted?.text).not.toContain("hunter2");

    const other = selectTurnMemoryWindow([
      completed("a", "one", "a"),
      completed("b:c:d", "two", "b"),
      completed("e", "three", "c"),
    ]);
    expect(other?.id).not.toBe(quoted?.id);
    expect(selectTurnMemoryWindow([
      completed("a:b", "one", "a"),
      completed("c", "two", "b"),
      completed("d:e", "three", "c"),
      { type: "custom", customType: "turn-memory-consumed", data: { windowId: quoted?.id } },
      completed("a", "four", "d"),
      completed("b:c:d", "five", "e"),
      completed("e", "six", "f"),
    ])?.id).toBe(other?.id);
  });

  it("redacts whole quoted secret values and URI user-info credentials", () => {
    const selected = selectTurnMemoryWindow([
      completed("a", 'password: "correct horse battery"', "noted"),
      completed("b", 'SQL_MEMORY_URL="postgres://user:pass@host/db"', "noted"),
      completed("c", "connect with postgres://user:pass@host/db now", "noted"),
    ]);
    expect(selected?.text).not.toContain("correct horse battery");
    expect(selected?.text).not.toContain("user:pass");
    expect(selected?.text).toContain("postgres://[REDACTED]@host/db");
  });

  it("does not open another window from one prompt after a consumed trio", () => {
    const first = [completed("1", "one", "a"), completed("2", "two", "b"), completed("3", "three", "c")];
    const selected = selectTurnMemoryWindow(first);
    const consumed = { type: "custom", customType: "turn-memory-consumed", data: { windowId: selected?.id } };
    expect(selectTurnMemoryWindow([...first, consumed, completed("4", "four", "d")])).toBeNull();
    expect(selectTurnMemoryWindow([
      ...first,
      consumed,
      completed("4", "four", "d"),
      completed("5", "five", "e"),
      completed("6", "six", "f"),
    ])?.id).toBe(JSON.stringify(["4", "5", "6"]));
  });
});
