import { describe, it, expect, vi } from "vitest";
import {
	createLineRing,
	execFileCaptured,
	execFileCapturedWithStdin,
	KAMAL_TAIL_LINES,
	recordCommandError,
} from "./subprocess.js";

describe("execFileCaptured", () => {
	it("resolves stdout and code 0 for a successful child", async () => {
		const result = await execFileCaptured(
			process.execPath,
			["-e", "process.stdout.write('ok-out')"],
			process.cwd(),
		);
		expect(result.code).toBe(0);
		expect(result.stdout).toBe("ok-out");
	});

	it("returns captured stdout on a nonzero exit instead of throwing", async () => {
		const result = await execFileCaptured(
			process.execPath,
			["-e", "process.stdout.write(JSON.stringify({ error: 'conflict' })); process.exit(3)"],
			process.cwd(),
		);
		expect(result.code).toBe(3);
		expect(JSON.parse(result.stdout)).toEqual({ error: "conflict" });
	});
});

describe("execFileCapturedWithStdin", () => {
	it("writes stdin to the child and captures stdout", async () => {
		const result = await execFileCapturedWithStdin(
			process.execPath,
			[
				"-e",
				"let s=''; process.stdin.on('data', d => s += d); process.stdin.on('end', () => process.stdout.write(s.toUpperCase()))",
			],
			process.cwd(),
			"ok-in",
		);
		expect(result.code).toBe(0);
		expect(result.stdout).toBe("OK-IN");
	});

	it("returns a nonzero exit without throwing", async () => {
		const result = await execFileCapturedWithStdin(
			process.execPath,
			["-e", "process.stdout.write('from-stdin'); process.exit(2)"],
			process.cwd(),
			"ignored",
		);
		expect(result.code).toBe(2);
		expect(result.stdout).toBe("from-stdin");
	});

	it("normalizes a null close code to 1", async () => {
		const result = await execFileCapturedWithStdin(
			process.execPath,
			["-e", "process.kill(process.pid, 'SIGTERM')"],
			process.cwd(),
			"",
		);
		expect(result.code).toBe(1);
	});

	it("captures stderr from the child", async () => {
		const result = await execFileCapturedWithStdin(
			process.execPath,
			["-e", "process.stderr.write('err-out'); process.exit(0)"],
			process.cwd(),
			"",
		);
		expect(result.code).toBe(0);
		expect(result.stderr).toBe("err-out");
	});

	it("returns code 1 when the binary cannot be spawned", async () => {
		const result = await execFileCapturedWithStdin(
			"/this/binary/does/not/exist",
			[],
			process.cwd(),
			"",
		);
		expect(result.code).toBe(1);
		expect(result.stderr.length).toBeGreaterThan(0);
	});
});

describe("createLineRing", () => {
	it("retains at most N non-empty lines after extra input", () => {
		const ring = createLineRing(KAMAL_TAIL_LINES);
		const lines = Array.from({ length: KAMAL_TAIL_LINES + 7 }, (_, i) => `line-${i + 1}`);
		ring.push(lines.join("\n") + "\n");
		const kept = ring.finish();
		expect(kept.length).toBeLessThanOrEqual(KAMAL_TAIL_LINES);
		expect(kept).toHaveLength(KAMAL_TAIL_LINES);
		expect(kept[0]).toBe("line-8");
		expect(kept[kept.length - 1]).toBe("line-27");
	});

	it("drops empty lines the same way the old slice(-20) filter did", () => {
		const ring = createLineRing(3);
		ring.push("a\n\n\nb\n\nc\nd\n");
		expect(ring.finish()).toEqual(["b", "c", "d"]);
	});
});

describe("recordCommandError", () => {
	it("appends a compact command-error entry", () => {
		const appendEntry = vi.fn();
		recordCommandError({ appendEntry }, "b-save-improved", "preflight", "not a git repository", 1);
		expect(appendEntry).toHaveBeenCalledTimes(1);
		expect(appendEntry).toHaveBeenCalledWith(
			"b-save-improved-error",
			expect.objectContaining({
				step: "preflight",
				code: 1,
				message: "not a git repository",
				at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
			}),
		);
	});

	it("omits code when it is not provided", () => {
		const appendEntry = vi.fn();
		recordCommandError({ appendEntry }, "b-commit-improved", "scribe", "draft failed");
		expect(appendEntry.mock.calls[0][1]).not.toHaveProperty("code");
	});

	it("clips long messages", () => {
		const appendEntry = vi.fn();
		recordCommandError({ appendEntry }, "b-save-improved", "apply", "x".repeat(600));
		const payload = appendEntry.mock.calls[0][1] as { message: string };
		expect(payload.message.length).toBe(501);
		expect(payload.message.endsWith("…")).toBe(true);
	});

	it("does not throw when appendEntry throws", () => {
		expect(() => {
			recordCommandError(
				{ appendEntry: () => { throw new Error("no session"); } },
				"b-save-improved",
				"apply",
				"boom",
			);
		}).not.toThrow();
	});
});
