# Watch `/buck-loop` activity

1. Start a plan with `/buck-loop <plan-path>` or resume its saved run with `/buck-loop --resume`.
2. From another terminal in the same repository, run:

   ```bash
   tail -F .context/workflow/buck-loop.log.jsonl
   ```

3. Read one JSON object per line. Each record has `version: 1`, an ISO-8601 UTC `timestamp`, an invocation UUID, and a `type`: `invocation`, `progress`, `activity`, or `terminal`.
4. A fresh start truncates the file and writes a new invocation record. Resume appends a new invocation record. `/buck-loop --status` and `/buck-loop --stop` do not alter the file.
5. Treat the file as local runtime data: it is added to `.git/info/exclude`. If that path was already tracked, the start removes it from the Git index, leaves the file on disk, and shows a warning. It is neither committed nor retained across fresh starts, and can contain normalized model text plus tool names and targets. It does not contain raw prompts, raw SDK events, complete child transcripts, or tool arguments.
6. If logging fails or pending writes exceed the 1 MiB buffer limit, the drain disables itself for this invocation without stopping the loop or widget. One warning is shown per invocation (including Git-hygiene warnings); a disabled drain may leave an incomplete log without a terminal record.

**Eat:** While the loop is still working, `tail -F` prints its invocation record followed by progress or activity records; after it settles, it prints one terminal record.
