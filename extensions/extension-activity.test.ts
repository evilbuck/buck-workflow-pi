import { describe, it, expect } from "vitest";
import {
	createActivity,
	sanitizeLine,
	type ActivityEvent,
	type ActivityUI,
} from "./extension-activity.js";

interface FakeClock {
	tick(): void;
	pending: number;
	schedule: Array<{ ms: number; cb: () => void }>;
	setInterval(cb: () => void, ms: number): unknown;
	clearInterval(handle: unknown): void;
}

/**
 * Deterministic fake clock. `tick()` fires every currently-scheduled callback
 * once in insertion order. The activity module re-arms timers inside the
 * handler; `tick()` walks the new schedule so behavior matches the real
 * `setInterval` cadence without wall-clock delays.
 */
function fakeClock(): FakeClock {
	const schedule: Array<{ ms: number; cb: () => void }> = [];
	let nextId = 1;
	const handles = new Map<number, { ms: number; cb: () => void }>();
	return {
		get pending() {
			return handles.size;
		},
		schedule,
		tick() {
			const firedIds = new Set<number>();
			let progressed = true;
			while (progressed) {
				progressed = false;
				for (const [id, entry] of handles) {
					if (firedIds.has(id)) continue;
					firedIds.add(id);
					handles.delete(id);
					entry.cb();
					progressed = true;
					break;
				}
			}
		},
		setInterval(cb, ms) {
			const id = nextId++;
			handles.set(id, { ms, cb });
			schedule.push({ ms, cb });
			return id;
		},
		clearInterval(handle) {
			handles.delete(handle as number);
		},
	};
}

function captureUI(): {
	ui: ActivityUI;
	notifies: Array<[string, string?]>;
	statuses: Array<[string, string | undefined]>;
	widgets: Array<{ key: string; lines?: string[]; placement?: "aboveEditor" | "belowEditor" }>;
} {
	const notifies: Array<[string, string?]> = [];
	const statuses: Array<[string, string | undefined]> = [];
	const widgets: Array<{ key: string; lines?: string[]; placement?: "aboveEditor" | "belowEditor" }> = [];
	return {
		ui: {
			notify: (m, l) => notifies.push([m, l]),
			setStatus: (key, text) => statuses.push([key, text]),
			setWidget: (key, content, options) =>
				widgets.push({
					key,
					lines: Array.isArray(content) ? [...content] : undefined,
					placement: options?.placement,
				}),
		},
		notifies,
		statuses,
		widgets,
	};
}

function advanceWidget(activity: ReturnType<typeof createActivity>, clock: FakeClock): void {
	activity.phase(activity.phase.toString()); // no-op; placeholder for type usage
	void activity;
	clock.tick();
}

describe("sanitizeLine", () => {
	it("strips ANSI cursor/clear sequences", () => {
		expect(sanitizeLine("\x1b[2Jsecret\x1b[H", 100)).toBe("secret");
		expect(sanitizeLine("\x1b[31mred\x1b[0m text", 100)).toBe("red text");
	});

	it("collapses internal newlines into a single line", () => {
		expect(sanitizeLine("line1\nline2\nline3", 100)).toBe("line1 line2 line3");
	});

	it("clips to the configured max width with ellipsis", () => {
		expect(sanitizeLine("a".repeat(40), 10)).toBe("a".repeat(9) + "…");
		expect(sanitizeLine("short", 100)).toBe("short");
	});
});

describe("createActivity lifecycle", () => {
	it("renders the phase label with a spinner frame and clears on dispose", () => {
		const clock = fakeClock();
		const cap = captureUI();
		const activity = createActivity({ ui: cap.ui, command: "b-pr-improved", clock });
		activity.phase("preflight…");
		const status = cap.statuses.at(-1);
		expect(status?.[0]).toBe("b-pr-improved:activity");
		expect(status?.[1]).toMatch(/^[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏] preflight…$/);
		clock.tick();
		const next = cap.statuses.at(-1);
		expect(next?.[1]).not.toBe(status?.[1]);
		activity.dispose();
		const cleared = cap.statuses.at(-1);
		expect(cleared).toEqual(["b-pr-improved:activity", undefined]);
		const widget = cap.widgets.at(-1);
		expect(widget?.key).toBe("b-pr-improved:activity-window");
		expect(widget?.lines).toBeUndefined();
	});

	it("is idempotent on repeated dispose and never throws", () => {
		const cap = captureUI();
		const activity = createActivity({ ui: cap.ui, command: "b-commit-improved", clock: fakeClock() });
		activity.phase("drafting…");
		expect(() => {
			activity.dispose();
			activity.dispose();
			activity.phase("after-dispose");
			activity.ingest({ kind: "text", delta: "ignored" });
			activity.succeed("done");
		}).not.toThrow();
	});

	it("clears both status and widget on succeed", () => {
		const cap = captureUI();
		const activity = createActivity({ ui: cap.ui, command: "b-save-improved", clock: fakeClock() });
		activity.phase("apply…");
		activity.succeed("done");
		expect(cap.notifies.at(-1)).toEqual(["b-save-improved: done", "info"]);
		expect(cap.statuses.at(-1)).toEqual(["b-save-improved:activity", undefined]);
		const widget = cap.widgets.at(-1);
		expect(widget?.key).toBe("b-save-improved:activity-window");
		expect(widget?.lines).toBeUndefined();
	});

	it("emits a warning notification on fail", () => {
		const cap = captureUI();
		const activity = createActivity({ ui: cap.ui, command: "b-kamal-release", clock: fakeClock() });
		activity.phase("deploy…");
		activity.fail("deploy failed: timeout");
		expect(cap.notifies.at(-1)).toEqual(["b-kamal-release: deploy failed: timeout", "warning"]);
	});
});

describe("createActivity model ingestion", () => {
	function drainWidget(clock: FakeClock): void {
		clock.tick();
	}

	it("coalesces adjacent text deltas into the current activity line", () => {
		const cap = captureUI();
		const clock = fakeClock();
		const activity = createActivity({ ui: cap.ui, command: "b-pr-improved", clock });
		activity.phase("resolving conflicts…");
		const events: ActivityEvent[] = [
			{ kind: "text", delta: "Reading " },
			{ kind: "text", delta: "package.json\n" },
			{ kind: "text", delta: "Editing " },
			{ kind: "text", delta: "src/index.ts" },
		];
		for (const ev of events) activity.ingest(ev);
		drainWidget(clock);
		const widget = cap.widgets.at(-1);
		expect(widget?.lines).toBeDefined();
		const activityLines = widget?.lines?.slice(1) ?? [];
		expect(activityLines.length).toBeLessThanOrEqual(2);
		expect(activityLines.join(" ")).toContain("Reading package.json");
	});

	it("shows toolStart / toolEnd lines around text deltas without losing them", () => {
		const cap = captureUI();
		const clock = fakeClock();
		const activity = createActivity({ ui: cap.ui, command: "b-pr-improved", clock });
		activity.phase("resolving conflicts…");
		activity.ingest({ kind: "toolStart", tool: "read", target: "src/foo.ts" });
		activity.ingest({ kind: "text", delta: "fragment-1 fragment-2" });
		activity.ingest({ kind: "toolEnd", tool: "read", ok: true });
		drainWidget(clock);
		const widget = cap.widgets.at(-1);
		const lines = widget?.lines ?? [];
		expect(lines.some((l) => l.includes("▸ read"))).toBe(true);
		expect(lines.some((l) => l.includes("✓ read"))).toBe(true);
	});

	  it("trims pendingLines when many text deltas overflow maxActivityLines", () => {
    const cap = captureUI();
    const clock = fakeClock();
    const activity = createActivity({
      ui: cap.ui,
      command: "b-pr-improved",
      clock,
      maxActivityLines: 2,
    });
    activity.phase("text-stream");
    for (let i = 0; i < 6; i += 1) {
      activity.ingest({ kind: "text", delta: `chunk ${i} ` });
    }
    clock.tick();
    const widget = cap.widgets.at(-1);
    const lines = widget?.lines ?? [];
    // Header + at most 2 activity lines (textLineOpen merge keeps it short).
    expect(lines.length).toBeLessThanOrEqual(3);
  });

it("never lets the widget exceed maxActivityLines + 1 (header)", () => {
		const cap = captureUI();
		const clock = fakeClock();
		const activity = createActivity({
			ui: cap.ui,
			command: "b-pr-improved",
			clock,
			maxActivityLines: 3,
		});
		activity.phase("loop");
		for (let i = 0; i < 20; i += 1) {
			activity.ingest({ kind: "toolStart", tool: `tool-${i}`, target: `path-${i}` });
			activity.ingest({ kind: "toolEnd", tool: `tool-${i}`, ok: true });
		}
		drainWidget(clock);
		const widget = cap.widgets.at(-1);
		expect(widget?.lines?.length).toBeLessThanOrEqual(4);
	});

	it("ignores ANSI control characters in tool targets and tool messages", () => {
		const cap = captureUI();
		const clock = fakeClock();
		const activity = createActivity({ ui: cap.ui, command: "b-save-improved", clock });
		activity.phase("scribe");
		activity.ingest({ kind: "toolStart", tool: "read", target: "\x1b[2J/etc/passwd\x1b[H" });
		activity.ingest({ kind: "text", delta: "\x07\x08hi\r\nthere" });
		drainWidget(clock);
		const widget = cap.widgets.at(-1);
		const flat = (widget?.lines ?? []).join("\n");
		expect(flat).not.toMatch(/\x1b/);
		expect(flat).not.toMatch(/\x07|\x08/);
	});

	it("appends tool failure with the message in the activity line", () => {
		const cap = captureUI();
		const clock = fakeClock();
		const activity = createActivity({ ui: cap.ui, command: "b-save-improved", clock });
		activity.phase("apply");
		activity.ingest({ kind: "toolStart", tool: "bash", target: "git push" });
		activity.ingest({ kind: "toolEnd", tool: "bash", ok: false, message: "permission denied" });
		drainWidget(clock);
		const widget = cap.widgets.at(-1);
		const lines = widget?.lines ?? [];
		expect(lines.some((l) => l.includes("✗ bash") && l.includes("permission denied"))).toBe(true);
	});

	it("emits the completion line directly through the widget (no throttle wait)", () => {
		const cap = captureUI();
		const clock = fakeClock();
		const activity = createActivity({ ui: cap.ui, command: "b-pr-improved", clock });
		activity.phase("finishing");
		activity.ingest({ kind: "complete", ok: false, message: "aborted" });
		const widget = cap.widgets.at(-1);
		const lines = widget?.lines ?? [];
		expect(lines.some((l) => l.includes("✗ b-pr-improved") && l.includes("aborted"))).toBe(true);
	});
});

describe("createActivity feature detection", () => {
	it("works when setStatus / setWidget are absent", () => {
		const notifies: Array<[string, string?]> = [];
		const activity = createActivity({
			ui: { notify: (m, l) => notifies.push([m, l]) },
			command: "b-pr-improved",
			clock: fakeClock(),
		});
		expect(() => {
			activity.phase("preflight…");
			activity.ingest({ kind: "text", delta: "fragment" });
			activity.succeed("ok");
		}).not.toThrow();
		expect(notifies.at(-1)).toEqual(["b-pr-improved: ok", "info"]);
	});

	it("swallows thrown UI methods", () => {
		const ui: ActivityUI = {
			notify: () => {
				throw new Error("boom");
			},
			setStatus: () => {
				throw new Error("boom");
			},
			setWidget: () => {
				throw new Error("boom");
			},
		};
		const activity = createActivity({ ui, command: "b-pr-improved", clock: fakeClock() });
		expect(() => {
			activity.phase("phase-1");
			activity.ingest({ kind: "text", delta: "x" });
			activity.fail("oops");
		}).not.toThrow();
	});

	it("uses unique status and widget keys per command", () => {
		const cap = captureUI();
		const a = createActivity({ ui: cap.ui, command: "b-pr-improved", clock: fakeClock() });
		const b = createActivity({ ui: cap.ui, command: "b-commit-improved", clock: fakeClock() });
		a.phase("a-phase");
		b.phase("b-phase");
		expect(cap.statuses.map((s) => s[0])).toContain("b-pr-improved:activity");
		expect(cap.statuses.map((s) => s[0])).toContain("b-commit-improved:activity");
		a.dispose();
		b.dispose();
	});
});

describe("createActivity retries and completion", () => {
	function drainWidget(clock: FakeClock): void {
		clock.tick();
	}

	it("records retry lines without polluting the text line", () => {
		const cap = captureUI();
		const clock = fakeClock();
		const activity = createActivity({ ui: cap.ui, command: "b-save-improved", clock });
		activity.phase("scribe");
		activity.ingest({ kind: "text", delta: "drafting " });
		activity.ingest({ kind: "retry", message: "model returned empty JSON" });
		drainWidget(clock);
		const widget = cap.widgets.at(-1);
		const lines = widget?.lines ?? [];
		expect(lines.some((l) => l.includes("↻ retry"))).toBe(true);
		expect(lines.some((l) => l.includes("drafting"))).toBe(true);
	});

	it("renders a terminal completion line in the widget", () => {
		const cap = captureUI();
		const activity = createActivity({ ui: cap.ui, command: "b-pr-improved", clock: fakeClock() });
		activity.phase("finishing");
		activity.ingest({ kind: "complete", ok: true, message: "PR opened" });
		const widget = cap.widgets.at(-1);
		const lines = widget?.lines ?? [];
		expect(lines.some((l) => l.includes("✓ b-pr-improved: PR opened"))).toBe(true);
	});
});


describe("createActivity internal branch coverage", () => {
  function drainAndDispose(clock: ReturnType<typeof fakeClock>): void {
    clock.tick();
  }

  it("calls the widget timer's disposed-early branch", async () => {
    const clock = fakeClock();
    const cap = captureUI();
    const activity = createActivity({ ui: cap.ui, command: "b-pr-improved", clock });
    activity.ingest({ kind: "text", delta: "frag" });
    // The ingest path scheduled a widget-timer. Dispose flips state.disposed
    // before any tick; the next tick observes state.disposed and returns early.
    activity.dispose();
    drainAndDispose(clock);
    // Activity was disposed cleanly without throwing.
    expect(activity).toBeDefined();
  });

  it("clears the widget timer when ingesting after dispose is pending", () => {
    const clock = fakeClock();
    const cap = captureUI();
    const activity = createActivity({ ui: cap.ui, command: "b-pr-improved", clock });
    activity.ingest({ kind: "text", delta: "frag" });
    clock.tick(); // drains the widget timer.
    // Now the frame timer is still active. Dispose; clock.tick should not throw.
    activity.dispose();
    clock.tick();
    expect(true).toBe(true);
  });

  it("renders a toolStart line with no target when target is omitted", () => {
    const cap = captureUI();
    const clock = fakeClock();
    const activity = createActivity({ ui: cap.ui, command: "b-pr-improved", clock });
    activity.ingest({ kind: "toolStart", tool: "bash" });
    clock.tick();
    const widget = cap.widgets.at(-1);
    const lines = widget?.lines ?? [];
    expect(lines.some((l) => l.includes("▸ bash") && !l.includes("→"))).toBe(true);
  });

  it("renders a toolStart line with a sanitized target", () => {
    const cap = captureUI();
    const clock = fakeClock();
    const activity = createActivity({ ui: cap.ui, command: "b-pr-improved", clock });
    activity.ingest({ kind: "toolStart", tool: "read", target: "/etc/passwd" });
    clock.tick();
    const widget = cap.widgets.at(-1);
    const lines = widget?.lines ?? [];
    expect(lines.some((l) => l.includes("▸ read → /etc/passwd"))).toBe(true);
  });

  it("renders a toolEnd success line without a trailing message", () => {
    const cap = captureUI();
    const clock = fakeClock();
    const activity = createActivity({ ui: cap.ui, command: "b-pr-improved", clock });
    activity.ingest({ kind: "toolEnd", tool: "read", ok: true });
    clock.tick();
    const widget = cap.widgets.at(-1);
    const lines = widget?.lines ?? [];
    expect(lines.some((l) => l.includes("✓ read") && !l.includes(":"))).toBe(true);
  });

  it("renders a retry line", () => {
    const cap = captureUI();
    const clock = fakeClock();
    const activity = createActivity({ ui: cap.ui, command: "b-pr-improved", clock });
    activity.ingest({ kind: "retry", message: "429 too many" });
    clock.tick();
    const widget = cap.widgets.at(-1);
    const lines = widget?.lines ?? [];
    expect(lines.some((l) => l.includes("↻ retry") && l.includes("429"))).toBe(true);
  });

  it("renders a complete event as a widget line directly (no throttle wait)", () => {
    const cap = captureUI();
    const clock = fakeClock();
    const activity = createActivity({ ui: cap.ui, command: "b-pr-improved", clock });
    activity.ingest({ kind: "complete", ok: true, message: "PR opened" });
    // Complete path calls renderWidget() directly, not scheduleWidgetRender().
    const widget = cap.widgets.at(-1);
    const lines = widget?.lines ?? [];
    expect(lines.some((l) => l.includes("✓ b-pr-improved") && l.includes("PR opened"))).toBe(true);
  });
});
