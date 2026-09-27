## Title
feat(buck-loop): stream activity to local JSONL

## Body
Add a tail-able, locally ignored activity drain alongside the existing widget.
Document start, resume, and local-data retention semantics.
Bound pending writes, share one warning budget across drain failures, and record
supervisor exceptions as blocked. Verify live visibility before settlement and
terminal flush with burst and failure regressions.
