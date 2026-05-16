#!/usr/bin/env python3
"""
pi-prompt: one-shot client for `pi --mode rpc`.

Spawns pi-coding-agent in RPC mode, sends a single prompt, streams the
assistant's text reply to stdout, and exits when the agent finishes.

Designed to be called from another agent or a shell script. Uses only the
Python stdlib.

Usage:
    pi-prompt.py "Your prompt here" [options]
    echo "Your prompt" | pi-prompt.py [options]

Options:
    --model <pattern>     Pi model pattern (e.g. anthropic/claude-sonnet-4-5)
    --provider <name>     Pi provider (anthropic, openai, google, ...)
    --cwd <path>          Run pi in this directory
    --no-session          Disable session persistence
    --session-dir <path>  Custom session storage directory
    --timeout <seconds>   Hard timeout; sends `abort` and exits non-zero
    --show-tools          Print tool_execution events to stderr
    --json                Print raw events to stdout (one JSON per line)
                          instead of just assistant text deltas
    --pi <path>           Path to the pi binary (default: "pi" from $PATH)
    -h, --help            Show this help

Exit codes:
    0   agent_end received successfully
    1   pi reported a command error or terminated non-zero
    2   bad arguments or pi not found
    3   timeout reached
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import signal
import subprocess
import sys
import threading
import time
from typing import Any, Optional


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(add_help=False)
    p.add_argument("prompt", nargs="?", default=None)
    p.add_argument("--model")
    p.add_argument("--provider")
    p.add_argument("--cwd")
    p.add_argument("--no-session", action="store_true")
    p.add_argument("--session-dir")
    p.add_argument("--timeout", type=float)
    p.add_argument("--show-tools", action="store_true")
    p.add_argument("--json", action="store_true", dest="json_mode")
    p.add_argument("--pi", default="pi")
    p.add_argument("-h", "--help", action="store_true")
    return p.parse_args()


def die(msg: str, code: int = 2) -> None:
    print(f"pi-prompt: {msg}", file=sys.stderr)
    sys.exit(code)


def read_lines(stream, on_line, on_close) -> None:
    """Read LF-delimited JSON lines from a binary stream.

    Strict per RPC framing rules: split on \\n only, strip trailing \\r.
    """
    buf = b""
    try:
        while True:
            chunk = stream.read(4096)
            if not chunk:
                break
            buf += chunk
            while True:
                nl = buf.find(b"\n")
                if nl < 0:
                    break
                line = buf[:nl]
                buf = buf[nl + 1 :]
                if line.endswith(b"\r"):
                    line = line[:-1]
                if not line:
                    continue
                on_line(line.decode("utf-8", errors="replace"))
    finally:
        on_close()


def main() -> int:
    args = parse_args()
    if args.help:
        print(__doc__)
        return 0

    prompt = args.prompt
    if prompt is None:
        if sys.stdin.isatty():
            die("no prompt provided (pass as arg or pipe via stdin)")
        prompt = sys.stdin.read()
    prompt = prompt.strip()
    if not prompt:
        die("empty prompt")

    pi_path = shutil.which(args.pi) or args.pi
    if not pi_path or (not os.path.isabs(pi_path) and not shutil.which(pi_path)):
        die(f"pi binary not found: {args.pi}")

    cmd = [pi_path, "--mode", "rpc"]
    if args.provider:
        cmd += ["--provider", args.provider]
    if args.model:
        cmd += ["--model", args.model]
    if args.no_session:
        cmd += ["--no-session"]
    if args.session_dir:
        cmd += ["--session-dir", args.session_dir]

    try:
        proc = subprocess.Popen(
            cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=sys.stderr,
            cwd=args.cwd or None,
            bufsize=0,
        )
    except FileNotFoundError:
        die(f"failed to spawn {pi_path}")
        return 2

    done = threading.Event()
    exit_code = {"code": 0}
    saw_agent_end = {"flag": False}

    def handle_event(line: str) -> None:
        try:
            evt = json.loads(line)
        except json.JSONDecodeError:
            print(f"pi-prompt: bad JSON from pi: {line!r}", file=sys.stderr)
            return

        if args.json_mode:
            print(line, flush=True)

        etype = evt.get("type")

        if etype == "response":
            if not evt.get("success", False):
                err = evt.get("error", "unknown error")
                print(
                    f"pi-prompt: command {evt.get('command')} failed: {err}",
                    file=sys.stderr,
                )
                exit_code["code"] = 1
                done.set()
            return

        if etype == "message_update" and not args.json_mode:
            ame = evt.get("assistantMessageEvent") or {}
            if ame.get("type") == "text_delta":
                delta = ame.get("delta", "")
                sys.stdout.write(delta)
                sys.stdout.flush()
            return

        if etype == "tool_execution_start" and args.show_tools:
            name = evt.get("toolName")
            args_ = evt.get("args")
            print(f"\n[tool:start] {name} {json.dumps(args_)[:200]}", file=sys.stderr)
            return

        if etype == "tool_execution_end" and args.show_tools:
            name = evt.get("toolName")
            is_err = evt.get("isError")
            print(f"[tool:end] {name} error={is_err}", file=sys.stderr)
            return

        if etype == "extension_ui_request":
            method = evt.get("method")
            # Auto-cancel dialog methods so we don't hang. Fire-and-forget
            # methods need no response.
            if method in ("select", "confirm", "input", "editor"):
                req_id = evt.get("id")
                response = {
                    "type": "extension_ui_response",
                    "id": req_id,
                    "cancelled": True,
                }
                try:
                    proc.stdin.write((json.dumps(response) + "\n").encode())
                    proc.stdin.flush()
                except BrokenPipeError:
                    pass
                print(
                    f"pi-prompt: auto-cancelled extension dialog {method!r}",
                    file=sys.stderr,
                )
            return

        if etype == "extension_error":
            print(
                f"pi-prompt: extension_error: {evt.get('error')}",
                file=sys.stderr,
            )
            return

        if etype == "agent_end":
            saw_agent_end["flag"] = True
            if not args.json_mode:
                sys.stdout.write("\n")
                sys.stdout.flush()
            done.set()
            return

    def on_close() -> None:
        done.set()

    reader = threading.Thread(
        target=read_lines, args=(proc.stdout, handle_event, on_close), daemon=True
    )
    reader.start()

    # Send the prompt
    req = {"id": "req-1", "type": "prompt", "message": prompt}
    try:
        proc.stdin.write((json.dumps(req) + "\n").encode())
        proc.stdin.flush()
    except BrokenPipeError:
        die("pi closed stdin before prompt was accepted", code=1)

    # Wait for completion or timeout
    deadline = time.time() + args.timeout if args.timeout else None
    while not done.is_set():
        remaining = None if deadline is None else max(0.0, deadline - time.time())
        if remaining == 0.0:
            print("pi-prompt: timeout reached, aborting", file=sys.stderr)
            try:
                proc.stdin.write(b'{"type":"abort"}\n')
                proc.stdin.flush()
            except BrokenPipeError:
                pass
            done.wait(timeout=5)
            if proc.poll() is None:
                proc.terminate()
            return 3
        done.wait(timeout=remaining if remaining is not None else 0.5)

    # Clean shutdown
    try:
        proc.stdin.close()
    except Exception:
        pass
    try:
        proc.wait(timeout=5)
    except subprocess.TimeoutExpired:
        proc.terminate()
        proc.wait(timeout=2)

    if proc.returncode and proc.returncode != 0 and exit_code["code"] == 0:
        print(f"pi-prompt: pi exited with code {proc.returncode}", file=sys.stderr)
        return 1

    if not saw_agent_end["flag"] and exit_code["code"] == 0:
        # Stream closed without agent_end — treat as failure
        return 1

    return exit_code["code"]


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        sys.exit(130)
