# Context Map

## Contexts

- [Presentation](./CONTEXT.md) — human-readable briefing packages generated from workflow artifacts
- [Durable storage](./docs/storage/CONTEXT.md) — branch-private knowledge and what becomes visible after integration

## Relationships

- **Presentation → Durable storage**: a **Presentation Package** may summarize stored artifacts; it is not a publication authority and does not change an **Integration View**
- **Durable storage → Presentation**: source links may point at artifacts the reader is allowed to see; unmerged private revisions are not presentation inputs
