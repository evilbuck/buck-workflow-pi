---
cluster: upstream-domain
skills_covered: 8
---

## Verdict

- This cluster is the **domain-specific and local-tooling layer** of the `docker-orchestration` agent skill suite — everything an agent needs to operate JazzHR infrastructure (Zuora billing, Kafka Connect, remote logs, GHA deploys) and the local Docker harness (`jz` commands, TLS, worktrees).
- The spine is **`jz` as dispatch surface**: skills either call `helper/scripts/<name>.sh` (kibana, cert, dev commands) or document exact curl/gh/API mechanics with hard-coded JazzHR hosts and repo paths.
- **Safety gates are the distinctive mechanic**: financial mutation (Zuora), production deploy (GHA), and Kafka Connect state changes all require explicit human confirmation; several skills document why agent shell cannot substitute for interactive prompts.
- **`jz-dev-commands` + `jz-cert` anchor local development**; **`jz-deploy` + observability skills anchor remote ops**; **`jz-text-humanizer` is cross-cutting prose polish** invoked by deploy and other human-facing steps.
- **`jz-worktree` is the most portable** skill in the cluster (ported from superpowers, harness-agnostic); the rest are overwhelmingly **PROJECT-BOUND** to JazzHR/Employ internals.

## Skill Table

| Skill | Invocation | Input | Output (exact paths) | Workflow position | Distinctive mechanic |
|---|---|---|---|---|---|
| jz-zuora-invoice-writeoff | `/jz-zuora-invoice-writeoff` or natural-language triggers ("write off this customer's invoices") | JazzHR customer ID (`customer_YYYYMMDDhhmmss_XXXXXXX`) or Zuora customer-account UI URL; optional `--env`, `--ticket`, `--params-file` for prod | Console output from `scripts/zuora_writeoff.py`; plan file at user-specified path (e.g. `/tmp/zuora-plan-$CUSTOMER_ID.json`, chmod 600); mutates Zuora invoices via API | Runs standalone on billing cleanup requests; requires `billing-api` sibling checkout for sandbox creds; **after `plan`, must stop for user chat confirmation before `execute`** | Three-step `resolve → plan → [STOP] → execute` with script-enforced single-AccountId scope, live re-verification against plan file, sandbox-only default, and behavioral (not CLI) human gate |
| jz-kafka-connect-api | `/jz-kafka-connect-api` or triggers ("kafka connect", "restart the connector") | Environment name → `{BASE}` host; connector name; optional Postman MCP for non-curated requests | Curated curl results / connector status JSON; no durable artifact paths | After VPN (`jct`/Netbird) for staging/prod; before/instead of hand-editing `resumator/terraform-configs`; defers connector **create/config/delete** to Terraform | Operation-scope classifier: GET/validate allowed; restart/pause/resume guarded (double-confirm prod); create/config/DELETE forbidden; prod pod fallback is read-only only |
| jz-kibana-search | `/jz-kibana-search` or `jz kibana …` subcommands | Transaction UUID, Lucene query string, time window, index pattern; LDAP creds via env or `~/.secrets/JAZZ_LDAP_BASIC_AUTH` | stdout from `helper/scripts/kibana.sh` (line/json/link/count formats); raw ES JSON if curl fallback | After Netbird VPN; auto-invokes `jz login ldap` on 401; **not** for local container log tailing (`jz logs`) or New Relic alerting | `jz kibana` wrapper owns cred capture, VPN error codes, and `kbn-xsrf` header; mirrors jazzbot ES client query shapes |
| jz-deploy | `/jz-deploy` or release/deploy language ("cut a release", "deploy to staging") | Codebase alias (`app`/`api`/`billing`/…), branch or semver tag, target env (`staging` default, `prod` explicit), optional Slack thread ts | GitHub release tags/notes; ECR image tags (`sha-<short>` or semver); GHA run status via `gh run watch`; cluster verification via kubectl | Chains: optional semver release → `docker-image.yml` build → `argo_deploy.yml` deploy → post-deploy kubectl verify → `jz-e2e.yml`; **human gate before prod** (stage 6); release notes through `jz-text-humanizer` first | GHA-exclusive: agent never hand-edits Helm values or ArgoCD CLI; documents that `webapp_prod` has **no** GitHub Environment protection rules — prod dispatch is immediate |
| jz-dev-commands | `/jz-dev-commands` or triggers ("run the resumator tests", "jz composer …") | Current app clone path under `$JAZZHR_SRC_ROOT`; subcommand args for `jz php`/`composer`/`psalm`/lifecycle | In-container command stdout; sync-status exit codes (0 synced, 1 timeout, 3 infra) | **Before** tests/psalm/cs-fix after host file edits → `jz docker sync-status`; **instead of** host PHP/composer; delegates kibana/deploy/kafka to specialist skills | Hard rule: never host `php`/`composer`/`phpunit`/`psalm`; SHA-256 poll until host/container bytes match |
| jz-cert | `/jz-cert` or `jz cert …` subcommands | Optional `--purge-host` on reset | mkcert leaf at `jazzhr/resources/nginx/ssl.crt/`; CA drop-in at `jazzhr/resources/ca/jazz-local-rootCA.crt` (skip-worktree); container trust via `update-ca-certificates` | Called best-effort by `jazzhr-local-provision` / `jazzhr-local-update` after stack up; standalone on HTTPS trust failures | mkcert host trust + additive container CA drop-in; graceful degradation to committed bootstrap cert if mkcert missing |
| jz-text-humanizer | `/jz-text-humanizer` or `/skill:jz-text-humanizer` (Pi); invoked by `jz-deploy` for release notes | Draft prose (PR title/body, commit message, release notes, review comments) | Structured `{status: humanized, text: …}` or `{status: needs_input, …}` | **Before** shipping human-facing text; called from `jz-deploy` step 0 release notes; not for translation/reformatting/summarizing | 24 Wikipedia-derived AI-writing patterns (significance inflation, AI vocabulary, em dashes, rule of three, etc.) with tone guardrails for formal vs casual |
| jz-worktree | `/jz-worktree` or at start of isolated multi-commit / autonomous arc | User consent (pre-satisfied under orchestrators); branch name `[A-Za-z0-9._-]+` | New worktree directory (default `$REPO_ROOT/.worktrees/$BRANCH_NAME`); optional `.gitignore` append; baseline test report | **Before** any isolated feature/plan/autonomous-development commits; Step 0 detects existing worktree and skips creation | Capability-based: native harness worktree tool preferred → `git worktree add -b` fallback; **ties to branch name, not ticket ID** |

## Detail

### jz-zuora-invoice-writeoff (`/tmp/docker-orchestration/.claude/skills/jz-zuora-invoice-writeoff/SKILL.md`, 184 lines)

- **Procedure**: (1) Read vendored runbook for context. (2) Set `SCRIPT` to `scripts/zuora_writeoff.py`. (3) Run `resolve` to sanity-check customer ID/URL. (4) Run `plan` with `--plan-file` — prints account name, eligible invoices, sum. (5) **Stop** — paste summary to user in chat; wait for explicit go-ahead in a **later message**. (6) Run `execute` with matching `--confirm-account` (AccountNumber from plan, not URL) and same plan file. (7) Clean up plan file (chmod 600, predictable path).
- **Gates/stops**: Hard chat gate before `execute` (cannot chain plan→execute same turn); sandbox-only by default (`_check_env_safety` blocks non-sandbox); prod requires `--env prod`, `--ticket`, explicit `--params-file`; zero/multi account match aborts; plan/live mismatch aborts; 3 consecutive write-off failures aborts (exit 2).
- **Supporting files**: `Zuora-Invoice-Write-Off-Runbook.md` (249 lines, validated sandbox run narrative); `scripts/zuora_writeoff.py` (522 lines, curl-based Zuora client); `scripts/test_zuora_writeoff.py` (mocked unit tests, no pytest).
- **Explicitly does NOT do**: Batch/multi-customer write-offs; skip human confirmation; interactive stdin confirmation (removed — doesn't work in agent shell); use `reason` field on write-off endpoint.

### jz-kafka-connect-api (`/tmp/docker-orchestration/.claude/skills/jz-kafka-connect-api/SKILL.md`, 65 lines)

- **Procedure**: (1) Resolve `{BASE}` from environment table. (2) Smoke-check `curl {BASE}/connectors`. (3) Classify every request by operation-scope rule. (4) Issue curated GETs from `references/endpoints.md` or fetch from Postman MCP. (5) For guarded recovery, state connector + env, confirm (double-confirm prod with status first). (6) If prod LB down, read-only pod exec via `references/pod-debugging.md`; block mutations until LB reachable.
- **Gates/stops**: Forbidden: POST `/connectors`, PUT config, DELETE; unrecognized destructive verbs default forbidden; prod mutations blocked when LB path down; fetched Postman request that changes classification vs expectation → stop and surface divergence; host must match `environments.md` table (fail-closed).
- **Supporting files**: `references/environments.md` (BASE URLs, port caveat, env-94 staleness note); `references/endpoints.md` (curated curls); `references/postman-mcp.md` (workspace/collection IDs, secret handling); `references/pod-debugging.md` (smbprod kubectl `/dev/tcp` read-only probe).
- **Explicitly does NOT do**: Create/rewrite/destroy connectors (Terraform-managed in `resumator/terraform-configs`); state-changing recovery through pod fallback; hard-code secrets (must use Postman MCP → mode-600 `-K` file if ever needed).

### jz-kibana-search (`/tmp/docker-orchestration/.claude/skills/jz-kibana-search/SKILL.md`, 189 lines)

- **Procedure**: (1) Ensure Netbird VPN (`nbr up`). (2) Run `jz login ldap` if creds missing (or let wrapper auto-prompt). (3) `jz kibana auth verify` for reachability. (4) Search via `jz kibana transaction|search|query|count` with flags. (5) Fall back to raw curl against `https://kibana.priv.jazzhr.com/elasticsearch/{index}/_search` only for aggregations/non-modeled shapes.
- **Gates/stops**: VPN down → exit 3 / connection errors (not bad query); 401/403 → re-run `jz login ldap`; refuses to log or hard-code creds; skill explicitly excludes local container log tailing and New Relic alerting.
- **Supporting files**: None in skill dir — implementation lives at repo `helper/scripts/kibana.sh` (`SKILL.md:10`). Query field reference documents jazzbot `ElasticsearchClient` parity (`SKILL.md:8`).
- **Explicitly does NOT do**: Tail local Symfony logs (`jz logs`); production alerting (New Relic MCP); reimplement hubot `transaction` when Slack bot suffices; read local container stdout.

### jz-deploy (`/tmp/docker-orchestration/.claude/skills/jz-deploy/SKILL.md`, 327 lines)

- **Procedure**: (1) Disambiguate "create a release" (tag only) vs "release the changes" (full pipeline). (2) Optional step 0: ask major/minor/patch, `gh release create` on default-branch HEAD (humanize notes via `jz-text-humanizer`). (3) Step 1: check if repo auto-builds on `release:published`; if yes, correlate release-triggered run by HEAD SHA; else dispatch `docker-image.yml` with `dispatch_marker`. (4) Step 2: dispatch `argo_deploy.yml` in `resumator/service-deploy` with validated `imageTag`, `app-name` group selector, env. (5) Post-deploy: kubectl verify image landed + pod health. (6) Dispatch `jz-e2e.yml` in `resumator/jazzhr-e2e`. (7) Full workflow: **stop at human gate** before prod (stage 6); on approval, repeat deploy+e2e for prod.
- **Gates/stops**: Prod requires explicit user authorization before dispatch (no automated GitHub Environment gate on `webapp_prod`); stop entire workflow on any failed stage; dispatch failure → don't report as started; rollback via `rollback` command semantics, not values-file revert PR.
- **Supporting files**: None in skill dir — references workflows in codebase repos and `service-deploy/service-mapping.yaml`.
- **Explicitly does NOT do**: Drive ArgoCD CLI directly; hand-edit Helm values or open deploy-bump PRs; per-env build parameters; rely on Slack Proceed/Abort on this GHA path.

### jz-dev-commands (`/tmp/docker-orchestration/.claude/skills/jz-dev-commands/SKILL.md`, 91 lines)

- **Procedure**: (1) Route all PHP/Composer/test tooling through `jz`, never host binaries. (2) After editing bind-mounted files, run `jz docker sync-status [paths]` until exit 0. (3) Use quick-reference table for build/shell/logs/cache/lifecycle/DB/messaging commands. (4) For kibana/deploy/kafka, invoke specialist skills instead of raw curl.
- **Gates/stops**: sync-status exit 1 → host/container disagree (wait/re-run); exit 3 → no build-shell running; paths outside `$JAZZHR_SRC_ROOT` skipped with warning; `appctl exec` warns but doesn't block on desync.
- **Supporting files**: None in skill dir — all commands implemented under repo `helper/scripts/*.sh` and `bin/appctl`.
- **Explicitly does NOT do**: Run host `php`/`composer`/`phpunit`/`psalm`/`gulp`; assume `/var/www/html` path; reimplement kibana/deploy/kafka flows manually.

### jz-cert (`/tmp/docker-orchestration/.claude/skills/jz-cert/SKILL.md`, 53 lines)

- **Procedure**: (1) `jz cert` runs init→issue→trust idempotently. (2) `init`: require mkcert, `mkcert -install`, write public rootCA to committed drop-in. (3) `issue`: sign leaf into nginx ssl dir, reload nginx. (4) `trust`: fold CA into outbound-edge containers. (5) `status`: read-only trust/leaf report. (6) `reset [--purge-host]`: revert bootstrap cert + remove container CA.
- **Gates/stops**: Aborts on first hard failure in full lifecycle; `trust` refuses placeholder CA (must run `init` first); without mkcert, prints hint and degrades gracefully (provisioning never breaks).
- **Supporting files**: Design/plan referenced at `docs/specs/2026-06-07-jz-cert-tool-design.md` and `docs/plans/2026-06-07-jz-cert-tool.md` (`SKILL.md:12-13`); implementation in repo `helper/scripts/cert.sh` (implied by `jz cert` dispatch).
- **Explicitly does NOT do**: Commit CA private key; replace stock container root set (additive only).

### jz-text-humanizer (`/tmp/docker-orchestration/.claude/skills/jz-text-humanizer/SKILL.md`, 413 lines)

- **Procedure**: (1) Scan input for 24 documented AI-writing patterns. (2) Rewrite problematic sections preserving core message and intended tone. (3) Add "soul" for casual/opinion text (opinions, rhythm variation, appropriate first-person); apply neutral-safe variants only for formal/technical. (4) Return `{status: humanized, text: …}` or `{status: needs_input}` if empty.
- **Gates/stops**: Missing/empty input → `needs_input`; if clarification unavailable, best-effort humanization; does not apply to mechanical translation/reformatting/summarizing.
- **Supporting files**: `README.md` (install via `jz skills install|update|remove|status`); credits blader/humanizer (`SKILL.md:15`).
- **Explicitly does NOT do**: Translation, reformatting, summarizing supplied data; inject first-person into formal/technical inputs unless source already used it.

### jz-worktree (`/tmp/docker-orchestration/.claude/skills/jz-worktree/SKILL.md`, 245 lines)

- **Procedure**: (0) Detect isolation: if `GIT_DIR != GIT_COMMON` and not submodule → skip to Step 2. (1) Ask user consent for worktree unless orchestrator pre-approved or preference declared. (1a) Prefer native harness worktree tool if available. (1b) Fallback: select directory (instructions > existing `.worktrees/` or `worktrees/` > default `.worktrees/`), verify `git check-ignore`, append to `.gitignore` if needed, `git worktree add -b "$BRANCH_NAME" "$LOCATION/$BRANCH_NAME"`, `cd` there. (2) Auto-detect and run project setup (npm/cargo/pip/poetry/go). (3) Run baseline tests; stop if failing. (4) Report "Worktree ready at …".
- **Gates/stops**: Missing required capabilities → compatibility blocker template; user declines consent → work in place; permission error on create → orchestrated runs stop for direction; failing baseline → stop for user direction; never nest worktrees or skip ignore verification.
- **Supporting files**: Attribution to superpowers v6.1.0 (`SKILL.md:245`, `../ATTRIBUTION.md` referenced).
- **Explicitly does NOT do**: Create worktree when already in one; use `git worktree add` when native tool exists; force default-branch commit for ignore setup; proceed past failing baseline.

## Cross-cutting answers

### Q1. What IS the host project (docker-orchestration)?

- **Purpose**: Dev-environment harness for Employ/JazzHR engineers — not application code. It orchestrates the full local JazzHR stack on macOS 14+ (incidental Linux/WSL2) via Docker Desktop (`CLAUDE.md:7-12`).
- **Stack**: Core `jazzhr/docker-compose.yml` runs nginx + PHP app containers (resumator, restumator, billing-api, partner-event-api, platform-api, v1api, docs) plus MySQL, MongoDB, RabbitMQ, Kafka, Elasticsearch, PostgreSQL, Airflow, and Warren autoscaler; sibling app repos bind-mount under `$JAZZHR_SRC_ROOT` (`CLAUDE.md:9-16`, `README.md:62-88`).
- **Toolchain**: `bin/jz` dispatches to `helper/scripts/<name>.sh`; `appctl` wraps docker compose; lifecycle scripts `jazzhr-local-{provision,backup,restore,update}` manage volumes and stack state (`CLAUDE.md:18-24`, `README.md:1-3`).
- **Deployment model**: Local = Docker Compose on laptop; remote = GitHub Actions (`docker-image.yml` build → `argo_deploy.yml` deploy to staging/prod EKS via `resumator/service-deploy`), with Netbird VPN for `*.priv.jazzhr.com` private services (`CLAUDE.md:47-48`, `jz-deploy` skill).

### Q2. PORTABLE vs PROJECT-BOUND (one line each with evidence)

| Skill | Verdict | Evidence |
|---|---|---|
| jz-zuora-invoice-writeoff | **PROJECT-BOUND** | Default params from `billing-api/app/config/parameters.yml`; JazzHR customer ID format; Zuora sandbox/prod URLs (`zuora_writeoff.py:35-36`, `SKILL.md:43-44`, `SKILL.md:79-81`) |
| jz-kafka-connect-api | **PROJECT-BOUND** | Hard-coded `{BASE}` hosts `*.priv.jazzhr.com`, `kafka.jazz.localhost`; Postman workspace/collection IDs; `use smbprod` / `resumator/terraform-configs` paths (`SKILL.md:17-22`, `postman-mcp.md:12-14`, `pod-debugging.md:15`) |
| jz-kibana-search | **PROJECT-BOUND** | `kibana.priv.jazzhr.com` endpoint; JazzHR field names (`jazzhr_transaction_id`, `jazz_app`, `jazz_environment`); `jz kibana` wrapper and LDAP via `jz login ldap` (`SKILL.md:14-15`, `SKILL.md:77`, `SKILL.md:152-160`) |
| jz-deploy | **PROJECT-BOUND** | `resumator/*` repo aliases, `resumator/service-deploy` workflows, `webapp_<env>` GitHub Environments, EKS contexts `smbstaging`/`smbprod` (`SKILL.md:39-41`, `SKILL.md:201-217`, `SKILL.md:250-252`) |
| jz-dev-commands | **PROJECT-BOUND** | Assumes docker-orchestration layout, `$JAZZHR_SRC_ROOT` bind mounts, resumator-org app names, in-container PHP via `jz` (`SKILL.md:8-10`, `SKILL.md:45-53`) |
| jz-cert | **PROJECT-BOUND** | Wildcards `*.jazz.localhost` / legacy `*.jazzhrdev.com`; paths under `jazzhr/resources/nginx/ssl.crt/` and `jazzhr/resources/ca/` (`SKILL.md:8-13`, `SKILL.md:18-22`) |
| jz-text-humanizer | **PORTABLE** | Harness-agnostic capability contract (read + edit text); no company hosts or repo paths in procedure (`SKILL.md:27-39`); Wikipedia pattern catalog is domain-independent |
| jz-worktree | **PORTABLE (pattern) / lightly project-aware** | Capability-based git worktree flow ported from superpowers; optional project setup detects generic manifest files (`SKILL.md:12-28`, `SKILL.md:151-166`, `SKILL.md:245`) — no JazzHR-specific paths or ticket integration |

### Q3. jz-worktree: automation, naming, ticket/branch tie-in

**What it automates**: Isolated multi-commit workspace setup — detecting whether the agent is already in a linked worktree, obtaining consent (waived under approved orchestrators like `jz-autonomous-development`), creating isolation via native harness tool or `git worktree add -b`, ensuring worktree directory is gitignored, running generic dependency install, and verifying a clean test baseline before implementation (`SKILL.md:36-192`).

**Naming convention**: Branch names must match `[A-Za-z0-9._-]+` with **no `/`** — use `-` or `_` as separators (`SKILL.md:34-35`). Worktree path defaults to `.worktrees/$BRANCH_NAME` at repo root (or existing `.worktrees/` / `worktrees/` directory if present) (`SKILL.md:97-105`, `SKILL.md:137-141`).

**Ticket vs branch**: **Ties to a git branch name only, not a ticket ID.** The skill sets `BRANCH_NAME="my-feature"` as a placeholder and expects the agent to substitute the branch being created (`SKILL.md:137-138`). No Jira/ServiceNow ticket field, prefix, or lookup appears anywhere in the skill. Orchestrator kickoff approval satisfies user consent but does not inject ticket metadata (`SKILL.md:69-71`).

**Full procedure (compressed)**: Step 0 detect (`git rev-parse --git-dir` vs `--git-common-dir`, submodule guard) → if already isolated, skip to setup → else ask consent → Step 1a native worktree tool OR 1b manual `git worktree add -b` with ignore verification → Step 2 npm/cargo/pip/poetry/go install if manifests exist → Step 3 run project tests, stop on failure → report ready (`SKILL.md:36-200`).

### Q4. jz-text-humanizer rule set (actual rules, not framing)

The skill enumerates **24 fix patterns** from Wikipedia "Signs of AI writing" (`SKILL.md:95-377`):

**Content (1–6)**: Cut undue significance/legacy language ("pivotal moment", "broader movement"); cut notability/media-coverage padding; replace superficial `-ing` phrase tacked-on analyses; remove promotional ad copy ("nestled", "vibrant", "groundbreaking"); replace vague attributions ("experts believe") with named sources; delete formulaic "Challenges and Future Prospects" sections.

**Language/grammar (7–12)**: Replace overused AI vocabulary (additionally, delve, landscape, tapestry, underscore, pivotal, etc.); prefer simple copulas over "serves as/stands as/boasts"; remove negative parallelisms ("not just X, it's Y"); break forced rule-of-three lists; stop elegant-variation synonym cycling; remove false "from X to Y" ranges.

**Style (13–18)**: Reduce em dash overuse; remove mechanical boldface; collapse inline-header bullet lists (`**Label:** sentence`); use sentence case in headings not Title Case; remove decorative emojis; replace curly quotes with straight quotes.

**Communication (19–21)**: Strip chatbot artifacts ("I hope this helps", "Let me know", "Great question!"); remove knowledge-cutoff disclaimers; remove sycophastic praise.

**Filler (22–24)**: Shorten filler phrases ("in order to" → "to"); reduce excessive hedging stacks; replace generic upbeat conclusions with concrete next facts.

**Voice rules**: For casual/opinion — add opinions, rhythm variation, appropriate "I", acknowledge complexity. For formal/technical — preserve neutral voice, no injected first-person (`SKILL.md:51-57`, `SKILL.md:63-91`).

**Output contract**: `{status: humanized, text: …}` or `{status: needs_input, reason: …, text: ""}` (`SKILL.md:379-393`).

### Q5. Embedded credentials, internal hostnames, company URLs?

**No literal secret values** appear in these skill files; credentials are referenced by **source location** or **env var name**. Embedded/internal identifiers found:

| Kind | Where | Notes |
|---|---|---|
| Zuora API credentials (loaded at runtime) | `billing-api/app/config/parameters.yml` path in `SKILL.md:43-44`, `zuora_writeoff.py:73-78` | Sandbox default; prod requires explicit `--params-file`; auth via in-process Basic header, curl `-K` stdin blob (`SKILL.md:155-158`) |
| Zuora API hostnames | `rest.apisandbox.zuora.com`, `rest.zuora.com` | `zuora_writeoff.py:35-36`; runbook `Zuora-Invoice-Write-Off-Runbook.md:7` |
| Kafka Connect internal hosts | `kafka.jazz.localhost:8083`, `kafka-connect.staging-east.us-east-2.priv.jazzhr.com`, `kafka-connect.env-east-94.us-east-2.priv.jazzhr.com:8083`, `kafka-connect.prod-east.us-east-1.priv.jazzhr.com` | `SKILL.md:19-22`, `references/environments.md:9-12` |
| Postman workspace/collection UUIDs | `references/postman-mcp.md:12-13` | Non-sensitive IDs for MCP lookup |
| Kibana/ES proxy hostname | `kibana.priv.jazzhr.com` | `SKILL.md:14`, `SKILL.md:77`, `SKILL.md:170` |
| LDAP Basic-auth secret | `$JAZZ_LDAP_BASIC_AUTH` or `~/.secrets/JAZZ_LDAP_BASIC_AUTH` | `SKILL.md:15`; captured by `jz login ldap`, never hard-coded |
| GitHub org/repos | `resumator/<repo>`, `resumator/service-deploy`, `resumator/jazzhr-e2e` | Throughout `jz-deploy/SKILL.md` |
| EKS/kube contexts | `smbprod`, `smbstaging`, namespace `kafka` | `pod-debugging.md:15-23`, `jz-deploy/SKILL.md:250-252` |
| ECR registry (from host CLAUDE.md, referenced by dev stack) | `876545689658.dkr.ecr.us-east-1.amazonaws.com/jazzhr/*` | `CLAUDE.md:49-50` — not in skill files but part of same harness |
| Example customer AccountNumber (test data) | `customer_20231211140246_BPUBCTZSFSUQQVAN` | Runbook `Zuora-Invoice-Write-Off-Runbook.md:18` — identifier, not a credential |
| Local dev domains | `*.jazz.localhost`, `*.applytojob.localhost`, legacy `*.jazzhrdev.com` | `jz-cert/SKILL.md:8-10`; `CLAUDE.md:112` |

## Gaps

- **No unified `jct`/VPN skill in this cluster** — kafka-connect, kibana, and deploy verification defer to separate `jct` and `k8s` skills not cataloged here, so agents need sibling skills for Netbird/`oli`/`use` preamble.
- **No local log tailing skill** — `jz-dev-commands` points to `jz logs` but log *search* is only remote (`jz-kibana-search`); no skill covers structured local container debugging beyond sync-status warnings.
- **No database/seed skill** — liquibase and DB ops are mentioned in `jz-dev-commands` and `CLAUDE.md` but lack a dedicated agent skill in this cluster.
- **jz-worktree has no cleanup/teardown procedure** — creates worktrees but does not document removal (`git worktree remove`) or branch push/PR linkage.
- **jz-text-humanizer has no JazzHR-specific tone guide** — portable humanizer lacks connection to company styleguide or PR template conventions beyond deploy's "humanize release notes" hook.

## Open questions

- Q-D1: Is `jz-worktree` intended to integrate with a ticket prefix convention elsewhere (e.g. `jz-autonomous-development` or `jz-ticket-writer`) even though this skill omits ticket IDs?
- Q-D2: Does `zuora_writeoff.py`'s `_check_env_safety` hard block on `--env prod` at runtime contradict the skill body's documented prod override flags (`--env prod --ticket --params-file`), or is prod access always expected to require editing the script's `_SAFE_ENVS` frozenset?
- Q-D3: Are Postman workspace/collection UUIDs in `postman-mcp.md` stable enough for automation, or does the skill's "rediscover on failure" path get exercised frequently?
- Q-D4: Is there a planned skill for local `jz logs` + correlation ID workflow, or is remote kibana search considered sufficient for all agent debugging?
