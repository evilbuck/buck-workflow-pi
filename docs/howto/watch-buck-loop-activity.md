# Watch `/buck-loop` activity

## Steps

1. Start a plan with `/buck-loop <plan-path>` or resume its saved run with `/buck-loop --resume`.
2. From another terminal in the same repository, run:

   ```bash
   tail -F .context/workflow/buck-loop.log.jsonl
   ```

3. Read one JSON object per line. Each record has `version: 1`, an ISO-8601 UTC `timestamp`, an invocation UUID, and a `type`: `invocation`, `progress`, `activity`, or `terminal`.
4. A fresh start truncates the file and writes a new invocation record. Resume appends a new invocation record. `/buck-loop --status` and `/buck-loop --stop` do not alter the file.
5. Treat the file as a local runtime export: it is added to `.git/info/exclude`. If already tracked, start removes it from the Git index, leaves it on disk, and warns. Fresh start truncates this export, not previously retained revisions: closing the drain retains its current bytes in the configured adapter under the owning checkout's private run. The content can include normalized model text and tool names/targets, but not raw prompts, raw SDK events, complete child transcripts, or tool arguments.
6. If logging fails or pending writes exceed the 1 MiB buffer limit, the drain disables itself for this invocation without stopping the loop or widget. One warning is shown per invocation (including Git-hygiene warnings); a disabled drain may leave an incomplete log without a terminal record.

7. **Eat:** while the loop is working, `tail -F` prints its invocation record followed by progress or activity records; after it settles, it prints one terminal record. A later fresh start begins a new export without deleting the adapter's retained history.
