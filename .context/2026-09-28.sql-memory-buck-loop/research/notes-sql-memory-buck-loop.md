# SQL-memory × buck-loop exploration notes

2026-09-28. Working branch `feat/sql-memory-tool`. Read-only code exploration and plan; preserve pre-existing staged `.context/**/transition-audits/` deletions, unstaged `.gitignore`, `package.json`, `extensions/sql-memory/db.ts`, and untracked `extensions/sql-memory/pg.d.ts`.

### Initial mapping
- `extensions/sql-memory/{index,db,migrations,sql-gate}.ts` exposes the SQL tool and Postgres boundary; `extensions/buck-loop/{loop,run-step,machine,scan,choice,index,types}.ts` owns step orchestration and Jev continuation. Scout slices inspect these independently.
- `skills/b-{build,review,save,save-improved,phase}/SKILL.md` and `docs/sql-memory.md` / recall how-to are existing skill and user-facing surfaces. `.context/2026-09-28.postgres-agent-memory/` already plans the SQL tool/schema/docs; this subject addresses loop integration rather than rebuilding the store.
- Existing loop scanner `extensions/buck-loop/scan.ts` confirms saving via `.context/memory/` changed files; a SQL write alone is not a replacement for portable session memory. `choice.ts` already calls native Jev for ambiguous closed-set continuations. Investigate whether child sessions can see `sql_memory` before prescribing tool calls.

### Schema and policy boundary
- `migrations/001_initial_schema.sql:18-60` defines project identity (`projects.origin_url`), `memories` provenance (`author`, optional project, branch + SHA pair), explicit `seq`, content, category, and `invalid_at`/`superseded_by`; `memories` content/provenance updates are rejected by its trigger (`:92-113`). `users`, tags, ranks, and optional embeddings are separate tables (`:64-90`).
- `docs/sql-memory.md:3-14` claims SQL replaces `.context/memory/` for new memories, with usage-driven writes and no required Jev gate. Existing global/project agent bootstrap mandates a git-portable `.context/memory/` session record, while `scan.ts:458` confirms `saving` only when `.context/memory/` changes. These are distinct commitments currently in conflict; plan must resolve or explicitly preserve a portable checkpoint while SQL stores shared reusable knowledge.
- `docs/howto/recall-project-memories.md:7-27` scopes reads by origin URL and `invalid_at IS NULL`, showing branch as provenance. `docs/sql-memory.md:32-59` uses bounded `LIMIT 50`, SQL-side keyword rank and author value rank; query examples are not a prescribed buck-loop integration.
- `skills/` has no literal `sql_memory` references yet (`grep`); adding the tool to child sessions alone will not produce a reliable fetch/save workflow.
