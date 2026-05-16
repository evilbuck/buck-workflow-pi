# pi RPC protocol reference

Condensed reference for `pi --mode rpc`. Authoritative source:
<https://pi.dev/docs/latest/rpc> (mirror:
`github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/rpc.md`).

This file lives next to `SKILL.md` and is loaded on demand when the one-shot
helper isn't enough.

## Startup

```bash
pi --mode rpc [--provider X] [--model Y] [--no-session] [--session-dir PATH]
```

## Framing

- JSONL over stdin/stdout. One JSON object per line.
- Delimiter: **LF (`\n`) only**. Strip a trailing `\r` on input.
- Do **not** use Node's `readline` — it splits on `U+2028`/`U+2029`, which are
  legal inside JSON strings.
- Every command may carry `"id": "..."`. The matching `response` echoes it.

## Commands (stdin)

### Prompting

| Type | Purpose | Notes |
|---|---|---|
| `prompt` | Send a user message. | While streaming, must include `streamingBehavior: "steer" \| "followUp"`. Optional `images: [{type:"image",data:<base64>,mimeType}]`. |
| `steer` | Queue a message delivered after current turn's tool calls, before next LLM call. | No extension commands. |
| `follow_up` | Queue a message delivered after agent fully finishes. | No extension commands. |
| `abort` | Stop the current run. | |
| `new_session` | Start a fresh session. | Optional `parentSession` path. Returns `{cancelled}`. |

### State

| Type | Returns |
|---|---|
| `get_state` | `{model, thinkingLevel, isStreaming, isCompacting, steeringMode, followUpMode, sessionFile, sessionId, sessionName?, autoCompactionEnabled, messageCount, pendingMessageCount}` |
| `get_messages` | `{messages: AgentMessage[]}` |
| `get_last_assistant_text` | `{text: string \| null}` |

### Model

| Type | Notes |
|---|---|
| `get_available_models` | Returns `{models: Model[]}` — all configured models. |
| `set_model` | Args: `provider`, `modelId`. Returns full `Model`. |
| `cycle_model` | Returns `{model, thinkingLevel, isScoped}`. `isScoped: true` means cycling the `enabledModels` (settings) subset; `false` means cycling everything available. `data` is `null` if only one model exists. |

**There is no `get_scoped_models` RPC command.** To enumerate the scoped (Ctrl+P)
ring, either:
- Loop `cycle_model` calls until `data.model.id` repeats, then `set_model` back to the original; or
- Read the `enabledModels` glob list from `~/.pi/settings.json` (or project `.pi/settings.json`).

### Thinking

| Type | Args / Returns |
|---|---|
| `set_thinking_level` | `level: "off"\|"minimal"\|"low"\|"medium"\|"high"\|"xhigh"` (`xhigh` is OpenAI codex-max only). |
| `cycle_thinking_level` | `{level}` or `null` if model has no thinking. |

### Queue modes

| Type | Modes |
|---|---|
| `set_steering_mode` | `"all"` \| `"one-at-a-time"` (default). |
| `set_follow_up_mode` | `"all"` \| `"one-at-a-time"` (default). |

### Compaction

| Type | Notes |
|---|---|
| `compact` | Optional `customInstructions`. Returns `{summary, firstKeptEntryId, tokensBefore, details}`. |
| `set_auto_compaction` | `enabled: bool`. |

### Retry

| Type | Notes |
|---|---|
| `set_auto_retry` | `enabled: bool`. |
| `abort_retry` | Cancels current retry delay. |

### Bash

| Type | Notes |
|---|---|
| `bash` | `command: string`. Returns `{output, exitCode, cancelled, truncated, fullOutputPath?}`. **No event emitted.** Output is folded into the next `prompt`'s LLM context as a synthetic user message of the form ``Ran `<cmd>`\n```\n<output>\n``` ``. |
| `abort_bash` | Cancel running bash. |

### Session management

| Type | Notes |
|---|---|
| `get_session_stats` | `{sessionFile, sessionId, userMessages, assistantMessages, toolCalls, toolResults, totalMessages, tokens:{input,output,cacheRead,cacheWrite,total}, cost, contextUsage:{tokens, contextWindow, percent}?}`. `contextUsage.tokens/percent` may be `null` right after compaction. |
| `export_html` | Optional `outputPath`. Returns `{path}`. |
| `switch_session` | `sessionPath`. Returns `{cancelled}`. |
| `fork` | `entryId`. Returns `{text, cancelled}` — text of the forked message. |
| `clone` | Duplicate current branch. Returns `{cancelled}`. |
| `get_fork_messages` | `{messages: [{entryId, text}]}` — user messages eligible for forking. |
| `set_session_name` | `name: string`. |

### Commands & skills

`get_commands` → `{commands: [{name, description?, source: "extension"\|"prompt"\|"skill", location?: "user"\|"project"\|"path", path?}]}`.
Invoke any of these from `prompt` by prefixing with `/`. Skill names appear as
`skill:<name>` and are invoked as `/skill:<name>`. Skill commands and prompt
templates are expanded before being sent to the LLM.

## Events (stdout)

Events never include `id`. Only `response` objects do.

| Event | Payload highlights |
|---|---|
| `agent_start` | — |
| `agent_end` | `{messages: AgentMessage[]}` — everything generated this run. |
| `turn_start` / `turn_end` | `turn_end` has `{message, toolResults}`. |
| `message_start` / `message_end` | `{message: AgentMessage}`. |
| `message_update` | `{message, assistantMessageEvent: {type, ...}}` — streaming. |
| `tool_execution_start` | `{toolCallId, toolName, args}`. |
| `tool_execution_update` | `{toolCallId, toolName, args, partialResult}` — `partialResult` is the **accumulated** output, not a delta. |
| `tool_execution_end` | `{toolCallId, toolName, result, isError}`. |
| `queue_update` | `{steering: string[], followUp: string[]}`. |
| `compaction_start` / `compaction_end` | `reason: "manual"\|"threshold"\|"overflow"`. End includes `{result?, aborted, willRetry, errorMessage?}`. |
| `auto_retry_start` / `auto_retry_end` | `{attempt, maxAttempts, delayMs, errorMessage}` / `{success, attempt, finalError?}`. |
| `extension_error` | `{extensionPath, event, error}`. |

### `assistantMessageEvent` delta types

`start`, `text_start`, `text_delta`, `text_end`, `thinking_start`, `thinking_delta`, `thinking_end`, `toolcall_start`, `toolcall_delta`, `toolcall_end` (includes full `toolCall`), `done` (`reason: "stop"\|"length"\|"toolUse"`), `error` (`reason: "aborted"\|"error"`).

For streaming text, watch `text_delta.delta`. For tool calls being constructed live, prefer `toolcall_end` which gives you the complete `toolCall`.

## Extension UI sub-protocol

Some extensions block the agent until the client answers a dialog. In RPC mode
they appear as `extension_ui_request` events on stdout, and you respond with
`extension_ui_response` on stdin keyed by the same `id`.

### Dialog methods (response required)

| `method` | Request fields | Response shape |
|---|---|---|
| `select` | `title`, `options: string[]`, `timeout?` | `{value: string}` or `{cancelled: true}` |
| `confirm` | `title`, `message?`, `timeout?` | `{confirmed: bool}` or `{cancelled: true}` |
| `input` | `title`, `placeholder?` | `{value: string}` or `{cancelled: true}` |
| `editor` | `title`, `prefill?` | `{value: string}` or `{cancelled: true}` |

If a `timeout` is set and you don't reply, the agent auto-resolves with an
"undefined"-equivalent. If you don't want to handle dialogs, run pi without the
extensions that prompt, or auto-send `{cancelled: true}` (see
`scripts/pi-prompt.py`).

### Fire-and-forget methods (no response)

`notify` (`message`, `notifyType: "info"|"warning"|"error"`),
`setStatus` (`statusKey`, `statusText?`),
`setWidget` (`widgetKey`, `widgetLines?: string[]`, `widgetPlacement: "aboveEditor"|"belowEditor"`),
`setTitle` (`title`),
`set_editor_text` (`text`).

### Degraded / unsupported in RPC

`custom()` → `undefined`; `setWorkingMessage`, `setWorkingIndicator`,
`setFooter`, `setHeader`, `setEditorComponent`, `setToolsExpanded` are no-ops;
`getEditorText` returns `""`; `getToolsExpanded` returns `false`; theme APIs are
not functional. `ctx.hasUI` is still `true`.

## Error responses

```json
{"type":"response","command":"set_model","success":false,"error":"Model not found: invalid/model"}
```

A `prompt` accepted (or queued) returns `success: true` immediately. Failures
*after* acceptance arrive via `message_update`/`agent_end`/`auto_retry_end`,
**not** as a second `response` for the same id.

Parse errors come back as `{type:"response",command:"parse",success:false,error:"..."}`.

## Core types (abbreviated)

### Model
```json
{"id":"claude-sonnet-4-20250514","name":"Claude Sonnet 4","api":"anthropic-messages","provider":"anthropic","baseUrl":"https://api.anthropic.com","reasoning":true,"input":["text","image"],"contextWindow":200000,"maxTokens":16384,"cost":{"input":3.0,"output":15.0,"cacheRead":0.3,"cacheWrite":3.75}}
```

### UserMessage
`{role:"user", content: string | (TextContent|ImageContent)[], timestamp, attachments}`

### AssistantMessage
`{role:"assistant", content: (TextContent|ThinkingContent|ToolCallContent)[], api, provider, model, usage:{input,output,cacheRead,cacheWrite,cost:{...,total}}, stopReason:"stop"|"length"|"toolUse"|"error"|"aborted", timestamp}`

### ToolResultMessage
`{role:"toolResult", toolCallId, toolName, content:[{type:"text",text}], isError, timestamp}`

### BashExecutionMessage (from RPC `bash`, not LLM tool calls)
`{role:"bashExecution", command, output, exitCode, cancelled, truncated, fullOutputPath: string|null, timestamp}`

### Attachment
`{id, type:"image", fileName, mimeType, size, content:<base64>, extractedText, preview}`

## Minimal client loop (pseudocode)

```text
spawn pi --mode rpc --no-session
write {"id":"1","type":"prompt","message":"..."} + "\n"
loop:
    line = read until "\n"
    evt = JSON.parse(line.rtrim("\r"))
    if evt.type == "response" and evt.id == "1":
        if not evt.success: fail
    elif evt.type == "message_update":
        if evt.assistantMessageEvent.type == "text_delta":
            stdout(evt.assistantMessageEvent.delta)
    elif evt.type == "extension_ui_request" and evt.method in dialog_methods:
        write {"type":"extension_ui_response","id":evt.id,"cancelled":true} + "\n"
    elif evt.type == "agent_end":
        break
close stdin
wait proc
```

## Sources

- <https://pi.dev/docs/latest/rpc>
- <https://pi.dev/docs/latest/settings> (for `enabledModels` / scoped model rules)
- `packages/coding-agent/src/modes/rpc/rpc-client.ts` in the pi repo — typed reference client
- `packages/coding-agent/src/modes/rpc/rpc-types.ts` — authoritative type definitions
