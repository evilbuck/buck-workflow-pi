/**
 * extension-activity — deep module that owns progress lifecycle, animation,
 * bounded rendering, sanitizer, throttle, feature detection, and idempotent
 * cleanup for every currently shipped long-running extension command.
 *
 * Two surfaces are exposed to callers:
 *   - `createActivity({ ui, command, clock?, maxActivityLines? })` returns an
 *     `Activity` handle whose interface stays small:
 *       `phase(label)` — start or replace the current phase; ensures the
 *         spinner timer is running.
 *       `ingest(event)` — accept a normalized `ActivityEvent` from a model
 *         or process adapter.
 *       `succeed(label)` / `fail(label)` — stop animation, publish the
 *         terminal notification, clear transient UI.
 *       `dispose()` — idempotent cleanup.
 *
 * The module hides timer cadence, frame selection, render throttling,
 * line coalescing, sanitization, bounds, feature detection, and unique
 * status/widget keys.
 */

export type ProgressLevel = "info" | "warning" | "error";

export interface ActivityUI {
	notify?: (message: string, level?: ProgressLevel) => void;
	setStatus?: (key: string, text: string | undefined) => void;
	setWidget?: (
		key: string,
		content: string[] | undefined,
		options?: { placement?: "aboveEditor" | "belowEditor" },
	) => void;
}

export type ActivityEvent =
	| { kind: "text"; delta: string }
	| { kind: "toolStart"; tool: string; target?: string }
	| { kind: "toolEnd"; tool: string; ok: boolean; message?: string }
	| { kind: "retry"; message: string }
	| { kind: "complete"; ok: boolean; message?: string };

export interface Activity {
	phase(label: string): void;
	ingest(event: ActivityEvent): void;
	succeed(label: string): void;
	fail(label: string): void;
	dispose(): void;
}

export interface ActivityOptions {
	ui?: ActivityUI;
	command: string;
	/** Fakeable clock for tests. Defaults to `setTimeout`/`clearTimeout`. */
	clock?: {
		setInterval(cb: () => void, ms: number): unknown;
		clearInterval(handle: unknown): void;
	};
	/** Spinner frame interval in ms. Defaults to 120. */
	frameIntervalMs?: number;
	/** Widget redraw throttle in ms. Defaults to 250. */
	widgetThrottleMs?: number;
	/** Maximum activity lines rendered in the widget. Defaults to 8. */
	maxActivityLines?: number;
	/** Maximum widget line width (chars). Defaults to 100. */
	maxLineWidth?: number;
}

const DEFAULT_MAX_LINES = 8;
const DEFAULT_MAX_WIDTH = 100;
const DEFAULT_FRAME_MS = 120;
const DEFAULT_WIDGET_THROTTLE_MS = 250;

// Braille spinner: 10 frames, low-noise in a tight status pill.
const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

// Strip the ANSI escape family + carriage returns + form-feed + bell. Any
// control sequence of the form `\x1b[...letter` is collapsed to a single
// space so the line buffer never receives a literal `\x1b[` that could move
// the cursor or clear the screen in the widget.
const CONTROL_RE = /\x1b\[[0-9;?]*[ -/]*[@-~]|\x07|\x08|\r|\x0c/g;
const MULTI_NL_RE = /\n{2,}/g;

/**
 * Render-safe text. Newlines collapse to single spaces so a single widget
 * line never spills into multiple rows, control characters are stripped, and
 * the result is clipped to `maxWidth` with an ellipsis when truncation
 * actually occurs.
 */
export function sanitizeLine(input: string, maxWidth: number): string {
	const cleaned = input
		.replace(CONTROL_RE, " ")
		.replace(/\r\n?|\n/g, " ")
		.replace(/[ \t]{2,}/g, " ")
		.trim();
	if (cleaned.length <= maxWidth) return cleaned;
	if (maxWidth <= 1) return cleaned.slice(0, maxWidth);
	return cleaned.slice(0, maxWidth - 1) + "…";
}

function coalesceText(buffer: string[], line: string, maxWidth: number): void {
	const cleaned = line.replace(CONTROL_RE, " ").replace(/\s+/g, " ").trim();
	if (!cleaned) return;
	if (buffer.length === 0) {
		buffer.push(sanitizeLine(cleaned, maxWidth));
		return;
	}
	const merged = `${buffer[buffer.length - 1]} ${cleaned}`.trim();
	buffer[buffer.length - 1] = sanitizeLine(merged, maxWidth);
}

function realClock(): NonNullable<ActivityOptions["clock"]> {
	return {
		setInterval(cb, ms) {
			const handle = setInterval(cb, ms);
			// `unref()` so an orphaned spinner never keeps the event loop alive
			// past dispose(); safe in Node + bun.
			if (typeof (handle as { unref?: () => void }).unref === "function") {
				(handle as { unref: () => void }).unref();
			}
			return handle;
		},
		clearInterval(handle) {
			clearInterval(handle as ReturnType<typeof setInterval>);
		},
	};
}

interface InternalState {
	disposed: boolean;
	phaseLabel: string | null;
	spinnerFrame: number;
	frameTimer: unknown;
	widgetTimer: unknown;
	widgetDirty: boolean;
	activityLines: string[];
	pendingLines: string[];
	textLineOpen: boolean;
}

export function createActivity(options: ActivityOptions): Activity {
	const {
		ui,
		command,
		clock = realClock(),
		frameIntervalMs = DEFAULT_FRAME_MS,
		widgetThrottleMs = DEFAULT_WIDGET_THROTTLE_MS,
		maxActivityLines = DEFAULT_MAX_LINES,
		maxLineWidth = DEFAULT_MAX_WIDTH,
	} = options;

	const statusKey = `${command}:activity`;
	const widgetKey = `${command}:activity-window`;
	const state: InternalState = {
		disposed: false,
		phaseLabel: null,
		spinnerFrame: 0,
		frameTimer: null,
		widgetTimer: null,
		widgetDirty: true,
		activityLines: [],
		pendingLines: [],
		textLineOpen: false,
	};

	const callSafe = (fn: (() => void) | undefined): void => {
		if (!fn) return;
		try {
			fn();
		} catch {
			// UI surfaces are optional and must not abort the handler.
		}
	};

	const renderFooter = (): void => {
		if (state.disposed) return;
		const frame = SPINNER_FRAMES[state.spinnerFrame % SPINNER_FRAMES.length];
		const label = state.phaseLabel ?? "working";
		callSafe(() => ui?.setStatus?.(statusKey, `${frame} ${label}`));
	};

	const renderWidget = (): void => {
		if (state.disposed) return;
		const header = `${command} — ${state.phaseLabel ?? "working"}`;
		const lines = [header, ...state.activityLines.slice(-maxActivityLines)];
		callSafe(() => ui?.setWidget?.(widgetKey, lines, { placement: "aboveEditor" }));
		state.widgetDirty = false;
	};

	const scheduleWidgetRender = (): void => {
		state.widgetDirty = true;
		if (state.widgetTimer !== null) return;
		state.widgetTimer = clock.setInterval(() => {
			if (state.disposed) {
				flushWidgetTimer();
				return;
			}
			if (state.widgetDirty) {
				flushPendingLines();
				renderWidget();
			}
		}, widgetThrottleMs);
	};

	const flushWidgetTimer = (): void => {
		if (state.widgetTimer !== null) {
			clock.clearInterval(state.widgetTimer);
			state.widgetTimer = null;
		}
	};

	const flushPendingLines = (): void => {
		if (state.pendingLines.length === 0) return;
		for (const line of state.pendingLines) {
			state.activityLines.push(line);
		}
		state.pendingLines.length = 0;
		if (state.activityLines.length > maxActivityLines) {
			state.activityLines.splice(0, state.activityLines.length - maxActivityLines);
		}
	};

	const ensureSpinner = (): void => {
		if (state.frameTimer !== null) return;
		state.frameTimer = clock.setInterval(() => {
			if (state.disposed) {
				flushFrameTimer();
				return;
			}
			state.spinnerFrame += 1;
			renderFooter();
		}, frameIntervalMs);
	};

	const flushFrameTimer = (): void => {
		if (state.frameTimer !== null) {
			clock.clearInterval(state.frameTimer);
			state.frameTimer = null;
		}
	};

	const pushActivityLine = (line: string): void => {
		const cleaned = sanitizeLine(line, maxLineWidth);
		if (!cleaned) return;
		if (state.textLineOpen) {
			const merged = `${state.activityLines[state.activityLines.length - 1] ?? ""} ${cleaned}`.trim();
			state.activityLines[state.activityLines.length - 1] = sanitizeLine(merged, maxLineWidth);
		} else {
			state.activityLines.push(cleaned);
			if (state.activityLines.length > maxActivityLines) {
				state.activityLines.splice(0, state.activityLines.length - maxActivityLines);
			}
		}
		state.textLineOpen = true;
	};

	const closeTextLine = (): void => {
		state.textLineOpen = false;
	};

	const handleEvent = (event: ActivityEvent): void => {
		switch (event.kind) {
			case "text":
				coalesceText(state.pendingLines, event.delta, maxLineWidth);
				scheduleWidgetRender();
				return;
			case "toolStart": {
				closeTextLine();
				const target = event.target ? ` → ${sanitizeLine(event.target, maxLineWidth)}` : "";
				flushPendingLines();
				pushActivityLine(`▸ ${event.tool}${target}`);
				scheduleWidgetRender();
				return;
			}
			case "toolEnd": {
				closeTextLine();
				flushPendingLines();
				const tail = event.message ? `: ${sanitizeLine(event.message, maxLineWidth)}` : "";
				pushActivityLine(`${event.ok ? "✓" : "✗"} ${event.tool}${tail}`);
				scheduleWidgetRender();
				return;
			}
			case "retry": {
				closeTextLine();
				flushPendingLines();
				pushActivityLine(`↻ retry: ${sanitizeLine(event.message, maxLineWidth)}`);
				scheduleWidgetRender();
				return;
			}
			case "complete": {
				closeTextLine();
				flushPendingLines();
				const tail = event.message ? `: ${sanitizeLine(event.message, maxLineWidth)}` : "";
				pushActivityLine(`${event.ok ? "✓" : "✗"} ${command}${tail}`);
				renderWidget();
				return;
			}
		}
	};

	const clearUI = (): void => {
		callSafe(() => ui?.setStatus?.(statusKey, undefined));
		callSafe(() => ui?.setWidget?.(widgetKey, undefined, { placement: "aboveEditor" }));
	};

	const activity: Activity = {
		phase(label) {
			if (state.disposed) return;
			state.phaseLabel = label;
			ensureSpinner();
			renderFooter();
			renderWidget();
		},
		ingest(event) {
			if (state.disposed) return;
			handleEvent(event);
		},
		succeed(label) {
			if (state.disposed) return;
			state.phaseLabel = label;
			renderFooter();
			flushFrameTimer();
			flushWidgetTimer();
			callSafe(() => ui?.notify?.(`${command}: ${label}`, "info"));
			clearUI();
		},
		fail(label) {
			if (state.disposed) return;
			state.phaseLabel = label;
			renderFooter();
			flushFrameTimer();
			flushWidgetTimer();
			callSafe(() => ui?.notify?.(`${command}: ${label}`, "warning"));
			clearUI();
		},
		dispose() {
			if (state.disposed) return;
			state.disposed = true;
			flushFrameTimer();
			flushWidgetTimer();
			clearUI();
		},
	};

	return activity;
}
