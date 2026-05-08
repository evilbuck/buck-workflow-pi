#!/usr/bin/env python3
"""
Pi Grill Auto - RPC Client for Automated AI Grilling

Spawns a Pi coding agent in RPC mode with a different model and provides
a clean Python interface for automated grilling of plans/designs.

Usage:
    from grill import Grill, GrillConfig
    
    grill = Grill(GrillConfig(model="gpt-5.4", provider="openai-codex"))
    grill.start()
    
    response = grill.ask("What are the edge cases?")
    print(response.text)
    
    grill.close()
"""

import subprocess
import json
import uuid
import threading
import queue
import time
import io
from dataclasses import dataclass, field
from typing import Optional, Callable, List, Dict, Any
from contextlib import contextmanager


@dataclass
class GrillResponse:
    """Response from the grilling model."""
    text: str = ""
    tool_calls: List[Dict] = field(default_factory=list)
    thinking: Optional[str] = None
    stop_reason: str = "unknown"
    raw_events: List[Dict] = field(default_factory=list)


@dataclass
class GrillConfig:
    """Configuration for the grilling session."""
    provider: str = "openai-codex"
    model: str = "gpt-5.4"
    thinking: str = "high"
    session_dir: Optional[str] = None
    no_session: bool = True


class Grill:
    """
    Pi RPC client for automated grilling sessions.
    
    Spawns a Pi instance with a specified model and provides methods
    to send prompts and receive responses.
    """
    
    def __init__(
        self,
        config: Optional[GrillConfig] = None,
        *,
        provider: Optional[str] = None,
        model: Optional[str] = None,
        thinking: Optional[str] = None,
        session_dir: Optional[str] = None,
        no_session: Optional[bool] = None,
    ):
        self.config = config or GrillConfig()
        if provider is not None:
            self.config.provider = provider
        if model is not None:
            self.config.model = model
        if thinking is not None:
            self.config.thinking = thinking
        if session_dir is not None:
            self.config.session_dir = session_dir
        if no_session is not None:
            self.config.no_session = no_session
        self.proc: Optional[subprocess.Popen] = None
        self._reader_thread: Optional[threading.Thread] = None
        self._running = False
        self._partial_text = ""
        self._streaming_callback: Optional[Callable[[str], None]] = None
        self._response_event = threading.Event()
        self._current_events: List[Dict] = []
        self._buffer = ""
        self._last_prompt_error: Optional[str] = None
        
    def _build_command(self) -> List[str]:
        """Build the pi command."""
        cmd = [
            "pi", "--mode", "rpc",
            "--provider", self.config.provider,
            "--model", self.config.model,
            "--thinking", self.config.thinking,
        ]
        
        if self.config.no_session:
            cmd.append("--no-session")
        elif self.config.session_dir:
            cmd.extend(["--session-dir", self.config.session_dir])
            
        return cmd
    
    def _reader_loop(self):
        """Read and dispatch events from stdout."""
        while self._running:
            try:
                # Use select for non-blocking read
                import select
                ready, _, _ = select.select([self.proc.stdout], [], [], 0.5)
                
                if ready:
                    chunk = self.proc.stdout.read(4096)
                    if not chunk:
                        break
                    self._buffer += chunk
                    
                    # Process complete lines
                    while "\n" in self._buffer:
                        line, self._buffer = self._buffer.split("\n", 1)
                        line = line.strip()
                        if not line:
                            continue
                            
                        try:
                            event = json.loads(line)
                            self._dispatch_event(event)
                        except json.JSONDecodeError:
                            continue
                        
            except Exception as e:
                if self._running:
                    pass  # Ignore errors during shutdown
                    
    def _dispatch_event(self, event: Dict[str, Any]):
        """Dispatch event to appropriate handler."""
        event_type = event.get("type")
        
        # Track events
        self._current_events.append(event)
+
+        if event_type == "response" and event.get("command") == "prompt" and not event.get("success", False):
+            self._last_prompt_error = event.get("error") or "Prompt rejected"
+            self._response_event.set()
+            return
        
        # Handle streaming
        if event_type == "message_update":
            delta = event.get("assistantMessageEvent", {})
            if delta.get("type") == "text_delta":
                text = delta.get("delta", "")
                self._partial_text += text
                if self._streaming_callback:
                    self._streaming_callback(text)
        
        # Handle completion - signal response ready
        if event_type == "agent_end":
            self._response_event.set()
                    
    def start(self, initial_context: Optional[str] = None) -> bool:
        """
        Start the Pi RPC session.
        
        Args:
            initial_context: Optional initial context to send
            
        Returns:
            True if startup succeeded
        """
        try:
            cmd = self._build_command()
            self.proc = subprocess.Popen(
                cmd,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                bufsize=1
            )
            
            self._running = True
            self._reader_thread = threading.Thread(target=self._reader_loop, daemon=True)
            self._reader_thread.start()
            
            # Give Pi time to initialize
            time.sleep(2)
            
            # Send initial context if provided
            if initial_context:
                self.ask(initial_context)
                
            return True
            
        except FileNotFoundError:
            print("Error: 'pi' command not found. Is Pi installed?", file=__import__("sys").stderr)
            return False
        except Exception as e:
            print(f"Failed to start: {e}", file=__import__("sys").stderr)
            return False
    
    def ask(self, question: str, timeout: float = 120.0) -> GrillResponse:
        """
        Ask a question and wait for response.
        
        Args:
            question: The question to ask
            timeout: Maximum time to wait
            
        Returns:
            GrillResponse with the model's answer
        """
        if not self.proc:
            raise RuntimeError("Not started. Call start() first.")
            
        # Reset state
        self._partial_text = ""
        self._current_events = []
        self._last_prompt_error = None
        self._response_event.clear()
        
        try:
            # Send prompt
            prompt = {
                "id": str(uuid.uuid4()),
                "type": "prompt",
                "message": question
            }
            self.proc.stdin.write(json.dumps(prompt) + "\n")
            self.proc.stdin.flush()
            
            # Wait for response
            self._response_event.wait(timeout=timeout)
+
+            if self._last_prompt_error:
+                return GrillResponse(text=f"Error: {self._last_prompt_error}", stop_reason="error", raw_events=self._current_events)
+            
+            # Extract content from events
+            response = GrillResponse()
            collected_text = []
            
            for event in self._current_events:
                if event.get("type") == "turn_end":
                    msg = event.get("message", {})
                    for content in msg.get("content", []):
                        if content.get("type") == "text":
                            collected_text.append(content.get("text", ""))
                        elif content.get("type") == "thinking":
                            response.thinking = content.get("thinking")
                        elif content.get("type") == "toolCall":
                            response.tool_calls.append({
                                "name": content.get("name"),
                                "arguments": content.get("arguments", {})
                            })
                    response.stop_reason = msg.get("stopReason", "stop")
                    
                if event.get("type") == "agent_end":
                    msg = event.get("message", {})
                    for content in msg.get("content", []):
                        if content.get("type") == "text":
                            collected_text.append(content.get("text", ""))
                        elif content.get("type") == "thinking":
                            response.thinking = content.get("thinking")
                    response.stop_reason = msg.get("stopReason", "stop")
                    
            response.text = "".join(collected_text)
            response.raw_events = self._current_events
            
            # Fallback to partial text if nothing collected
            if not response.text and self._partial_text:
                response.text = self._partial_text
                
            return response
            
        except Exception as e:
            print(f"Error in ask: {e}", file=__import__("sys").stderr)
            return GrillResponse(text=f"Error: {e}")
    
    def set_streaming_callback(self, callback: Callable[[str], None]):
        """Set callback for streaming text output."""
        self._streaming_callback = callback
        
    def abort(self):
        """Abort current operation."""
        if self.proc:
            try:
                self.proc.stdin.write(json.dumps({"type": "abort"}) + "\n")
                self.proc.stdin.flush()
            except Exception:
                pass
                
    def close(self):
        """Stop the session and cleanup."""
        self._running = False
        
        if self.proc:
            try:
                self.proc.stdin.write(json.dumps({"type": "abort"}) + "\n")
                self.proc.stdin.flush()
                time.sleep(0.5)
                self.proc.stdin.close()
                self.proc.wait(timeout=5)
            except Exception:
                self.proc.kill()
            finally:
                self.proc = None


@contextmanager
def grill_session(
    model: str = "gpt-5.4",
    provider: str = "openai-codex",
    thinking: str = "high",
    initial_context: Optional[str] = None
):
    """
    Context manager for Grill sessions.
    
    Usage:
        with grill_session(model="gpt-4o") as grill:
            response = grill.ask("What are the edge cases?")
            print(response.text)
    """
    config = GrillConfig(
        provider=provider,
        model=model,
        thinking=thinking
    )
    grill = Grill(config)
    
    if not grill.start(initial_context):
        raise RuntimeError("Failed to start grill session")
        
    try:
        yield grill
    finally:
        grill.close()


#-------------------------------------------------------------------------------
# CLI entry point
#-------------------------------------------------------------------------------
if __name__ == "__main__":
    import sys
    import argparse
    
    parser = argparse.ArgumentParser(description="Pi Grill Auto - Automated AI Grilling")
    parser.add_argument("question", nargs="?", help="Question to ask")
    parser.add_argument("--model", "-m", default="openai-codex/gpt-5.4", help="Model to use (supports provider/model or bare model id)")
    parser.add_argument("--provider", "-p", default=None, help="Provider override")
    parser.add_argument("--thinking", "-t", default="high", help="Thinking level")
    parser.add_argument("--list-models", action="store_true", help="List available models")
    
    args = parser.parse_args()
    
    if args.list_models:
        print("Available models (use --model <id>):")
        result = subprocess.run(
            ["pi", "--list-models"],
            capture_output=True,
            text=True,
            stderr=subprocess.DEVNULL
        )
        # Parse and show relevant models
        for line in result.stdout.split("\n")[1:]:  # Skip header
            if line.strip():
                parts = line.split()
                if len(parts) >= 2:
                    print(f"  {parts[0]:12} {parts[1]}")
        sys.exit(0)
        
    if not args.question:
        parser.print_help()
        sys.exit(1)
        
    provider = args.provider
    model = args.model
    if "/" in model and not provider:
        provider, model = model.split("/", 1)
    if not provider:
        provider = "openai-codex"

    print(f"[Grill] Starting with {provider}/{model}")
    print()
    
    config = GrillConfig(
        provider=provider,
        model=model,
        thinking=args.thinking
    )
    grill = Grill(config)
    
    if not grill.start():
        print("Failed to start grill session")
        sys.exit(1)
        
    def stream(text):
        print(text, end="", flush=True)
        
    grill.set_streaming_callback(stream)
    response = grill.ask(args.question)
    
    print()
    print("-" * 60)
    print(f"Stop reason: {response.stop_reason}")
    if response.tool_calls:
        print(f"Tool calls: {[tc['name'] for tc in response.tool_calls]}")
    
    grill.close()
