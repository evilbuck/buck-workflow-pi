"""End-to-end characterization tests for pi-prompt.py.

Runs the real script against a stub `pi` binary that speaks the RPC line
protocol, pinning the exit codes and outputs the skill documents:

    0   agent_end received successfully
    1   pi reported a command error, exited non-zero, or never sent agent_end
    2   bad arguments or pi not found
    3   timeout reached
"""

import json
import os
import subprocess
import sys
import tempfile
import textwrap
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parent / "pi-prompt.py"

# A stub `pi`: ignores --mode rpc flags, reads one prompt line, then emits a
# scripted sequence of RPC lines (from $STUB_EVENTS, one JSON per line).
STUB = textwrap.dedent(
    """
    #!/usr/bin/env python3
    import json, os, sys
    # Consume the prompt request line.
    sys.stdin.readline()
    for line in os.environ.get("STUB_EVENTS", "").splitlines():
        if line == "@READ_INPUT":
            got = sys.stdin.readline()
            sys.stdout.write(got)
            sys.stdout.flush()
        elif line == "@HANG":
            import time
            time.sleep(30)
        else:
            sys.stdout.write(line + "\\n")
            sys.stdout.flush()
    """
)

OK_EVENTS = [
    json.dumps({"type": "response", "success": True, "command": "prompt"}),
    json.dumps(
        {
            "type": "message_update",
            "assistantMessageEvent": {"type": "text_delta", "delta": "hello "},
        }
    ),
    json.dumps(
        {
            "type": "message_update",
            "assistantMessageEvent": {"type": "text_delta", "delta": "world"},
        }
    ),
    json.dumps({"type": "agent_end"}),
]


def run(args, events=None, pi="stub-pi", make_stub=True):
    stub_dir = tempfile.mkdtemp(prefix="pi-prompt-test-")
    if make_stub:
        stub = os.path.join(stub_dir, pi)
        with open(stub, "w") as f:
            f.write(STUB.lstrip("\n"))
        os.chmod(stub, 0o755)
    env = dict(os.environ)
    env["PATH"] = stub_dir + os.pathsep + env.get("PATH", "")
    if events is not None:
        env["STUB_EVENTS"] = "\n".join(events)
    r = subprocess.run(
        [sys.executable, str(SCRIPT), "--pi", pi] + args,
        capture_output=True,
        text=True,
        env=env,
        timeout=60,
    )
    return r.returncode, r.stdout, r.stderr


class SuccessPaths(unittest.TestCase):
    def test_text_deltas_stream_to_stdout_and_exit_0(self):
        code, out, err = run(["say hi"], OK_EVENTS)
        self.assertEqual(code, 0)
        self.assertEqual(out, "hello world\n")

    def test_json_mode_prints_raw_lines(self):
        code, out, err = run(["say hi", "--json"], OK_EVENTS)
        self.assertEqual(code, 0)
        lines = out.splitlines()
        self.assertEqual(len(lines), len(OK_EVENTS))
        self.assertEqual(json.loads(lines[0])["type"], "response")

    def test_prompt_via_stdin(self):
        stub_dir = tempfile.mkdtemp()
        stub = os.path.join(stub_dir, "stub-pi")
        with open(stub, "w") as f:
            f.write(STUB.lstrip("\n"))
        os.chmod(stub, 0o755)
        env = dict(os.environ)
        env["PATH"] = stub_dir + os.pathsep + env.get("PATH", "")
        env["STUB_EVENTS"] = "\n".join(OK_EVENTS)
        r = subprocess.run(
            [sys.executable, str(SCRIPT), "--pi", "stub-pi"],
            input="piped prompt",
            capture_output=True,
            text=True,
            env=env,
            timeout=60,
        )
        self.assertEqual(r.returncode, 0)

    def test_flags_are_forwarded(self):
        # The stub ignores flags; this pins that parsing accepts them all.
        code, _, _ = run(
            [
                "hi",
                "--model",
                "anthropic/claude-sonnet-4-5",
                "--provider",
                "anthropic",
                "--cwd",
                "/tmp",
                "--no-session",
                "--session-dir",
                "/tmp/s",
                "--show-tools",
            ],
            OK_EVENTS,
        )
        self.assertEqual(code, 0)


class FailurePaths(unittest.TestCase):
    def test_response_failure_exits_1(self):
        events = [
            json.dumps(
                {"type": "response", "success": False, "command": "prompt", "error": "bad"}
            )
        ]
        code, _, err = run(["hi"], events)
        self.assertEqual(code, 1)
        self.assertIn("command prompt failed: bad", err)

    def test_stream_close_without_agent_end_exits_1(self):
        events = [json.dumps({"type": "response", "success": True})]
        code, _, _ = run(["hi"], events)
        self.assertEqual(code, 1)

    def test_pi_binary_not_found_exits_2(self):
        code, _, err = run(["hi"], pi="nonexistent-pi-xyz", make_stub=False)
        self.assertEqual(code, 2)
        self.assertIn("pi binary not found", err)

    def test_empty_prompt_exits_2(self):
        code, _, err = run(["   "], None)
        self.assertEqual(code, 2)
        self.assertIn("empty prompt", err)

    def test_bad_json_line_is_reported_not_fatal(self):
        events = ["{not json", *OK_EVENTS]
        code, _, err = run(["hi"], events)
        self.assertEqual(code, 0)
        self.assertIn("bad JSON from pi", err)


class TimeoutPath(unittest.TestCase):
    def test_timeout_sends_abort_and_exits_3(self):
        # Stub that answers nothing: agent_end never arrives.
        events = [json.dumps({"type": "response", "success": True}), "@HANG"]
        code, _, err = run(["hi", "--timeout", "1"], events)
        self.assertEqual(code, 3)
        self.assertIn("timeout reached, aborting", err)


class ExtensionDialog(unittest.TestCase):
    def test_select_dialog_is_auto_cancelled_via_stdin(self):
        events = [
            json.dumps({"type": "response", "success": True}),
            json.dumps({"type": "extension_ui_request", "id": "r1", "method": "select"}),
            "@READ_INPUT",
            *OK_EVENTS,
        ]
        code, _, err = run(["hi"], events)
        self.assertEqual(code, 0)
        self.assertIn("auto-cancelled extension dialog 'select'", err)

    def test_extension_error_is_reported(self):
        events = [
            json.dumps({"type": "response", "success": True}),
            json.dumps({"type": "extension_error", "error": "boom"}),
            *OK_EVENTS,
        ]
        code, _, err = run(["hi"], events)
        self.assertEqual(code, 0)
        self.assertIn("extension_error: boom", err)


class ToolEvents(unittest.TestCase):
    def test_show_tools_prints_tool_lifecycle(self):
        events = [
            json.dumps({"type": "response", "success": True}),
            json.dumps(
                {"type": "tool_execution_start", "toolName": "read", "args": {"p": 1}}
            ),
            json.dumps({"type": "tool_execution_end", "toolName": "read", "isError": False}),
            *OK_EVENTS,
        ]
        code, _, err = run(["hi", "--show-tools"], events)
        self.assertEqual(code, 0)
        self.assertIn("[tool:start] read", err)
        self.assertIn("[tool:end] read error=False", err)

    def test_tool_events_hidden_without_show_tools(self):
        events = [
            json.dumps({"type": "response", "success": True}),
            json.dumps({"type": "tool_execution_start", "toolName": "read", "args": {}}),
            *OK_EVENTS,
        ]
        code, _, err = run(["hi"], events)
        self.assertEqual(code, 0)
        self.assertNotIn("[tool:start]", err)


if __name__ == "__main__":
    unittest.main()
