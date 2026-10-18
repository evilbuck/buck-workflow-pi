---
status: completed
date: 2026-10-16
subject: 2026-10-10.durable-storage-adapters
related: [phase-8-proof-docs-package.md, research-phase-8-guarded-repair.md, implementation-notes-phase-8.md]
---
# Phase 8 live OMP workflow evidence

The initial probe below is historical and is not credited as complete producer-workflow proof. The later canonical skill workflow section records the completed saves and fresh-process readback. Parent loop state and transition authority remain unchanged.

## Invocation

Every proof process used the current checkout extension, not the installed mainline extension:

```
omp -p --no-session --no-extensions \
  -e /home/buckleyrobinson/projects/development_tools/storage-adapter.wt/extensions/index.ts \
  --thinking=off --auto-approve --approval-mode=yolo \
  --tools=workflow_state|bash
```

Isolated env, not the operator config:

- `BUCK_WORKFLOW_CONFIG=/tmp/phase8-omp/live/<adapter>.yaml`
- `XDG_CONFIG_HOME=/tmp/phase8-omp/live/xdg-<adapter>`
- `SQL_MEMORY_URL=configured-save-mode` (save-mode gate only; not a database URL and not the selected store)

Clones stayed the existing `/tmp/phase8-omp/clone-<adapter>` trees. Subject written was `2026-10-16.live-proof`, not the parent phase file. Transcripts: `/tmp/phase8-omp/live/transcripts/<adapter>/`.

The prior SQLite `/buck-loop` completion remains invalid. Selected phase `472a4cdf-1293-471b-adf3-94e00aa3c9ca` was still `pending` before this run. This run did not treat that filesystem `done` projection as adapter proof.

## What ran

For repo-files, external-files, and sqlite, separate OMP processes called native `workflow_state` `write` for brainstorm, research, plan, phase, review, iterate, subject index, retained pass audit, import cursor, attribution, checkpoint, hook-memory logical name, and presentation attachment. A later OMP process ran canonical save as a child: `prepareSaveAttempt` + `saveSqlFacts` from `extensions/buck-loop/sql-save.ts`, then `skills/b-save-improved/scripts/save-preflight.ts` and `save-apply.ts`. A new OMP process then called `read` / `read-receipt`. After that, another OMP process wrote the phase again with `expectedRevision` set to the pending revision, and a further process read it back as `completed`.

`operation=correct` was rejected: `correct is not permitted for the write role`. Phase completion used `write` + `expectedRevision`, which the write role allows.

This is not a `/buck-loop` skill session and not `/b-brainstorm` model drafting. It is real OMP loading this extension and using its `workflow_state` tool plus the canonical save CLI. Direct `bun` outside OMP is not claimed as the proof; the save transcript is `15-canonical-save.txt` from an OMP bash tool.

## Readback after restart

Restart read is `16-restart-readback.txt` plus `17-receipt.txt`. Phase completion reread is `20-phase-reread.txt`. Receipt status on all three is `complete`, kind `rows`, duties `save-metadata` and `readback`. The receipt's `artifactRevisions` is the memory fact id, not the later completed-phase revision. `save-apply` reported lifecycle `not-verified` because the phase was still pending at save time (`phase-1-live.md: phase is not completed`). A local receipt file also has `completed: true`; the adapter `read-receipt` is the authority.

Plan revisions below are the post-save revisions (save-apply added `sql_memory_ids`). Write-time plan ids are in `03-plan.txt`.

### repo-files

- config: `/tmp/phase8-omp/live/repo-files.yaml` (`adapter: repo-files`)
- project: `workspace-2a83cb16770da3165551ac09571390946c635e4fe8b1157018b62a3a630d70fa`
- branch: `branch-3ecf37fb-bdfc-4836-8012-21a0d9062a90`
- worktree: `worktree-33c7c7ac-1b2a-49f7-8925-10ab237db40e`
- receipt attempt `f77db875-5e05-483a-9d14-0e2a14bd89b6`, run `run-7f19c5fc-9067-4c48-8b60-b057c2ae4240`, fact `e20393e7-0edf-4ab6-9073-abe1bc17627b`
- local receipt: `/tmp/phase8-omp/clone-repo-files/.context/2026-10-16.live-proof/sql-memory-receipts/f77db875-5e05-483a-9d14-0e2a14bd89b6.json`
- brainstorm `18349b55-19d6-411b-b73b-8451bec39d88` `8e44a0162eb15776baf0148eab6a6680d7c5fcba431224c345996e9d8d0fbb9f`
- research `f57f70e2-05b0-4021-9cc3-bf4397c3568c` `f4164c9a32a4e00892ec620a79f4a5d5d3606ac8d6429c3ac8625a254172954e`
- plan after save `bf298cb3-1288-42de-9368-e5b19514e1f7` `f99f47ffcef187c700035cb3b9fcbd74d2cb8d3d04f7a8d7a705259e320871f1`
- phase pending at save `4e81bdb1-b60e-4d70-a17c-118b405d4e44`; completed reread `ed03abc2-6954-4441-928d-6bbce260dac5` `042f160debdfefa8070ed39f9d8b1a63182ddb11389199c62f0cb0988ee843c8`
- review `3297c896-827d-4eb0-85ff-a0e6931d979c` `b556727c04a652c82d7c87facb4d624045c45ab9fc6dd6fcd0bd8e3a0265360f`
- iterate `e7afb390-258d-418e-8e67-52ed68b28065` `e263ad68b09e8d6ec9f0b3c2137188360cf646c15e9d02515cbbe2a56d97204a`
- pass audit `926c7b13-d18e-47b0-99a2-d1f0276ea98f` `780a35dc221e007b9379a49f4b82eefda17c5d6f0d8f48ed5cfe8ecd7d7630b3` (`code-review` / `passes/01/review.json`)
- import cursor `b1f54bd0-6e4f-4fd2-acd3-1e64a38734f9` `e1d85a2521e65d176694e13bbe21a70504a96c64ef147b9f96778e7589fc864e` (`memory-import` / `manifest.json`)
- attribution `b74a0f57-69b3-400b-94ef-93b164d92579` `15245bf2c72cde94b2a9c9dfa6af3c639b1140cbbdb0b583be803d2b2277c457`
- checkpoint `b60146c9-93a7-4742-9c95-7b1f42676dda` `0d524923421cf1bfea01d77adb05b18db8e0c36f799e94261df6325ec3444983`
- hook-memory name `8c21e9fd-46b8-407a-8268-97f9e30187db` `744d13781412cdf8d567b70c4e915c3a1ac312349cce6b17c0cdcd4327902757`
- attachment `5556de74-fb63-44a6-adcd-3b3af3e98db7` `c414cd0e204de974f73753c7e28d7638e7b3691bb8b1a2bab6b25bb7fed7ce77`

### external-files

- config root: `/tmp/phase8-omp/live/external-root`
- project: `workspace-e775cd7af1cb6d43202e1c4c4280d9a457a23a2081ce252f6fb532be7e26507a`
- branch: `branch-be7c75b6-0e22-464b-a934-87e0896c444d`
- worktree: `worktree-8b1f2ca4-21c1-4469-af5a-376bb7448e8b`
- receipt attempt `3d364322-8c99-4688-b70a-da5578a82c4e`, run `run-638f66ab-52e8-4413-a117-38f2b396e910`, fact `2e315f1b-7e1f-44f4-968f-da1da221610e`
- brainstorm `dc0371ca-ee77-4042-ad7f-99a69478df79` `8e44a0162eb15776baf0148eab6a6680d7c5fcba431224c345996e9d8d0fbb9f`
- research `e89ccebd-2c1a-4853-bf45-a578e34db66b` `f2a485420be4cd7ff17c69da8ccd5ae8aeb476c4049c06b0b077449d23b7ab8e`
- plan after save `25060a68-4921-458f-8816-3bf2acdd0efb` `578941c77f55204c0e4d63f09d3b5cceb3682bdccbf4934af9a1160597006248`
- phase pending at save `65da7d2a-c6cc-409a-aa39-8bcc3ae0c5d4`; completed reread `bce628cd-1eaa-4c61-9e71-a96c849ec8fb` `2b2f34f6143680fc07a5631f061cf63a693f687ab05bcf9937eb9519054748b9`
- review `f8a28364-0e6d-45df-ab9a-9fa8f7be6779` `b556727c04a652c82d7c87facb4d624045c45ab9fc6dd6fcd0bd8e3a0265360f`
- iterate `ae2d5f05-56f3-4f94-b4b7-c079513db40a` `e263ad68b09e8d6ec9f0b3c2137188360cf646c15e9d02515cbbe2a56d97204a`
- pass audit `0695f317-edfc-4228-9834-26416b14bcf8` `780a35dc221e007b9379a49f4b82eefda17c5d6f0d8f48ed5cfe8ecd7d7630b3`
- import cursor `981f4879-1138-4a70-93b9-bb95d04d752a` `e1d85a2521e65d176694e13bbe21a70504a96c64ef147b9f96778e7589fc864e`
- attribution `95361c81-ed5c-406f-9b16-54d362ecc951` `15245bf2c72cde94b2a9c9dfa6af3c639b1140cbbdb0b583be803d2b2277c457`
- checkpoint `7b1f682f-0bdb-4ba2-9012-fd5b0a7caffa` `0d524923421cf1bfea01d77adb05b18db8e0c36f799e94261df6325ec3444983`
- hook-memory name `a1dbf74d-d7a4-483f-854a-d22fa4881fc5` `744d13781412cdf8d567b70c4e915c3a1ac312349cce6b17c0cdcd4327902757`
- attachment `0488d06c-ec29-4b59-897a-7588d3bc4a1e` `c414cd0e204de974f73753c7e28d7638e7b3691bb8b1a2bab6b25bb7fed7ce77`

### sqlite

- database: `/tmp/phase8-omp/clone-sqlite-state.sqlite` (same file as the failed loop)
- project: `workspace-3d877d93bd4fb1cbb93467941cbecc0ad6f3f21d5c0b818ec2096f4b53c291ed`
- branch: `branch-7cd3d816-ce7a-4c92-96b4-d54875ec83e8`
- worktree: `worktree-ac336cf6-ae2c-4ad5-b033-9a428b3eafe9`
- receipt attempt `568f0eb7-467f-44a0-b546-b1935e78a059`, run `run-40aaa3ac-1e8f-4e10-a02a-1435e60f4d25`, fact `5fc275bb-34c6-48e0-b3ca-0f0a677cb559`
- brainstorm `a56b3268-e863-4a15-96ff-51f7a3403052` `8e44a0162eb15776baf0148eab6a6680d7c5fcba431224c345996e9d8d0fbb9f`
- research `fab468fb-4e4e-44ef-9df1-cb722b845d52` `f4164c9a32a4e00892ec620a79f4a5d5d3606ac8d6429c3ac8625a254172954e`
- plan after save `0c871105-5bca-4a40-aa50-2af7c1e7e552` `bc1dd1d979f474d4783d798a8c25cfd3747b291be1ab1c854980aafbc6a57387`
- phase pending at save `2e40c803-149f-4a62-b00a-04df2c095fcc`; completed reread `8e35b9c2-00ad-4afe-86ae-915f1027ed2b` `2b2f34f6143680fc07a5631f061cf63a693f687ab05bcf9937eb9519054748b9`
- review `c99bc8f3-51dc-4661-b51b-065285fce265` `61fc10f4430ffdb0f23c4a93618255976da609c371802fd342f83132a7f0d65e`
- iterate `29430c67-ebdc-4b0f-8c12-7bc2bf458038` `e263ad68b09e8d6ec9f0b3c2137188360cf646c15e9d02515cbbe2a56d97204a`
- pass audit `6abfde4f-f638-44b9-8efc-b41adea69b2c` `780a35dc221e007b9379a49f4b82eefda17c5d6f0d8f48ed5cfe8ecd7d7630b3`
- import cursor `639f1ef9-e6e1-4653-9c9f-0675c857d92b` `e1d85a2521e65d176694e13bbe21a70504a96c64ef147b9f96778e7589fc864e`
- attribution `090f3202-b174-49b1-93f5-5c041577e659` `15245bf2c72cde94b2a9c9dfa6af3c639b1140cbbdb0b583be803d2b2277c457`
- checkpoint `44370b8d-51ae-453c-a6c4-99075ceac15e` `0d524923421cf1bfea01d77adb05b18db8e0c36f799e94261df6325ec3444983`
- hook-memory name `8391bbc6-2226-4bac-9fc7-85225d2a60dc` `744d13781412cdf8d567b70c4e915c3a1ac312349cce6b17c0cdcd4327902757`
- attachment `db4eea44-a1d0-4dd1-8ad6-14dd858e27e0` `c414cd0e204de974f73753c7e28d7638e7b3691bb8b1a2bab6b25bb7fed7ce77`
- save also rewrote subject-index to `cedf34d6-7dc4-40c1-b685-189287287a88` `a0063a4f7831fce22047d9283ac1c6e725e9903c488767c038fbf692a506d453`

## PostgreSQL — initial blocked probe, superseded

At the initial probe, disposable container `phase8-pg` on `127.0.0.1:54329` was PostgreSQL 16 without pgvector. Its private connection environment was not copied here. The subsequent supported PostgreSQL 18 + pgvector proof uses a separate disposable container on loopback port 54339; the operator's original container was not reconfigured.

OMP with `connection_env: PHASE8_POSTGRES_URL` reached the adapter and failed every write and read:

`extension "vector" is not available` (`vector.control` absent; `apk` has no `postgresql16-pgvector`).

No revision, no receipt. Transcripts: `/tmp/phase8-omp/live/transcripts/postgres/`. `facts.json` is empty. `save-apply.out` was not produced.

## Honest limits

- Edge kinds were focused `workflow_state` writes inside OMP, not a generated `b-present` package, not a code-review-iteration pass, not an import-cursor advance, and not an `agent_end` turn-memory hook (that hook waits for three turns plus a judge). The attachment bytes are a 1x1 PNG (`c414cd0e…`), read back as PNG, not HTML.
- `proof.txt` containing `ok` was written in each working clone by the OMP save child. That file is clone-local, not an adapter revision.
- Parent plan acceptance boxes were not rechecked or updated. Packaging, guardrails, and docs were out of this repair's scope.
- No shipped source, phase status, or commit was changed.

## Actual canonical skill workflows — completed saves and restart

All four backends subsequently ran real OMP sessions that read the current canonical brainstorm, research, plan, phase, build, review and iterate skills, produced the seven retained skill kinds, exercised the disposable `proof.txt` change, and completed the existing fixture phase before canonical save. Subject: `2026-10-16.skill-proof`. Stage transcripts are `skill-*.txt` under each private adapter transcript directory. These are not the initial generic kind-write probes.

Canonical save uses the actual attempt/facts/preflight/apply entrypoints from OMP's Bash tool. Lifecycle readback verified the completed fixture subject, and fresh OMP processes read the same exact phase/plan revisions and pinned complete save receipt. Non-repo subject export directories, including local receipt flags, were removed before restart. Repo-files narrative authority was not removed. `restart-readback.ts` derives runtime scope, checks all seven artifact kinds, hashes every retained artifact and requires the exact original attempt/run/fact and metadata duties.

| Backend | Completed phase revision | Phase SHA-256 | Completed save attempt | Receipt run | Fact revision |
|---|---|---|---|---|---|
| repo-files | `e61c2440-0e43-49b3-86a9-fb05403c6254` | `44c1e9ecdc873d57241a601c382fd811028e101f2001a8286e9cd53f31d45fc9` | `2bc445cb-8e82-4b50-b1f4-27e957d0f9dd` | `run-ecd26eb4-72da-4ca3-84b1-3dc5dff1e994` | `9ae24a23-f069-42fb-831b-9e145dbf71c6` |
| external-files | `3e35e69f-02d3-4943-a3de-9ac0d5330a9a` | `4dd67759da9ba4342e7de5d128948cb170d4bbca9480a47279d16e300ea3ada4` | `ffc1f09d-fc43-4b5f-9a39-5c90414442b6` | `run-f4731f85-168d-4da9-a796-e119d8d546c0` | `3835e894-4052-404f-ab3e-d52137bbd494` |
| sqlite | `1788b9ab-ce3f-421f-a75a-61dd4050ef91` | `75dd9a139c0bbab2f4634c911c6810ed3fbe0c4a93ff8b0abec68602cfc19bb0` | `c5a5b1d1-2f72-4783-b882-b949516f1dc3` | `run-36aefeef-9729-4097-b155-af416e7c791d` | `c08c1b28-6f44-4812-9ac8-0bead4676e72` |
| postgres | `eb33ade3-1a8a-49d6-8c44-9378ed2f0110` | `2370834e10ee874dd6acf55e00ec57c005e9585aee0985ef963a2722514ea452` | `c01a65cc-279c-4746-83d9-312862e929eb` | `run-7d506ac4-009e-4bbd-87be-6b316e0f5aef` | `fae8c405-c21d-420d-acb8-d5ed5d836b8c` |

All four receipts are `complete`, kind `rows`, duties `save-metadata` and `readback`. Private exact inventories: `<adapter>/skill-restart-exact.json`. Native plan revisions: repo-files `a74c13af-cbf5-4a78-b249-5ef784a5f87e`; external-files `19e8afc3-d815-4275-8621-0e6b641f7de6`; sqlite `779e7a03-e4bd-45fc-904e-f2bac080a4c2`; postgres `6340a6c0-3473-475a-bbac-3568d21e4edc`.

The PostgreSQL metadata save initially rejected a genuinely typed nested research source. [The narrow identity repair](research-phase-8-save-identity.md) resumed that same attempt without rebuilding a stage or replacing its fact. Repo-files/PostgreSQL overview artifacts that the fixture model misaddressed as `phase` were reconciled to canonical `plan` identity only after proving identical bytes; wrong typed pointers were retired with history preserved. The fixture scanners then confirmed. Native Jev accepted the remaining repo-files/PostgreSQL revision-readback criterion at 0.94 after receiving actual operation/tool-call/result provenance; earlier unlabelled response pairs were ambiguous and were not treated as acceptance.

## Genuine focused producer scenarios

Separate disposable projects with local bare Git origins use the same four machine configurations. Actual `/code-review --base master --reviewer-model openai-codex/gpt-6.1-sol:off --max-passes 1` reviewed a real tracked README change in isolated Reviewer worktrees, retained pass JSON/Markdown and terminal state, and produced pre-review plus report checkpoint commits. All four runs were clean with no findings/errors. These are real producer audits, not the initial generic writes.

The actual `retainPresentationPackage` producer retained generated HTML, source Markdown, manifest and a Chromium-rendered 1280×900 PNG for each backend. Every byte/hash was read back before removing the optional package export. The actual importer `saveManifest` initialized a missing cursor through CAS; its empty `files` map is truthful initialization, not a claimed remote import or invented imported-at timestamp. The optional cursor export and review runtime exports were also removed. New processes then loaded the retained clean review state/pass and read every exact attachment/cursor/audit revision and hash without recreating exports.

| Backend | Actual review run | Pass JSON revision | PNG revision | Import cursor revision |
|---|---|---|---|---|
| repo-files | `20261016T152723-cychxu` | `32076284-56a5-4044-ae15-52a66ef87dde` | `dc07a421-4657-4dba-ac44-533400bed4ab` | `70c6fa9f-c539-482f-becb-50561c45ee84` |
| external-files | `20261016T152723-ggvlpf` | `00d0ab86-db6c-4c48-8165-349972ca11aa` | `d54ec9ff-237f-4454-920e-b85f1eea7021` | `14b3f9c0-b9a9-4587-97d3-ed7ced4ffa0e` |
| sqlite | `20261016T152723-s4puwf` | `5fd70be4-73f8-4fe4-b443-26bb75119cda` | `be796a84-2e8d-4266-8e41-93237d259308` | `55c18106-4ab4-4e08-b3ca-e46f45a631d0` |
| postgres | `20261016T152723-egvk1d` | `5f672444-178f-4691-8fe2-4c8f0eb775c1` | `b3091c90-9d09-4b6e-9d05-c60160c0159e` | `2b8e3c72-1fc2-4f75-b9c6-c9aad4a4521d` |

Private full metadata/hashes: `<adapter>/edge-producers.json` and `edge-restart-exact.json`. Package receipts remain the producer's actual `attempted` package receipts; they are not mislabelled complete saves. The completed save receipts are the separately pinned rows in the preceding table.

Fresh native OMP edge-restart sessions also ran the exact verifier and read the presentation HTML with matching revision/hash on every backend. Ordinary `workflow_state` audit reads returned null: its knowledge query does not include worktree/run-private rows. The owning review/import domain readers, invoked in the same runtime through the verifier, bound the actual workspace scope and read those exact private audits after export removal. No native query scope was widened to make a proof pass.

Automatic attribution delivered real usage from the OMP stage sessions: 121 repo-files, 118 external-files, 116 sqlite and 133 PostgreSQL deliveries at the recorded readback. Every retained record was matched against its actual JSONL assistant delivery, provider/model and input/output/cache/total usage. Provider message timestamps can differ from JSONL append timestamps; the verifier accepts only those observed delivery timestamps, not an invented match. Three malformed manual `rows/live-proof.json` fixtures from the initial generic probes were retired by their exact recorded revision/hash, with private quarantine evidence and correction history retained. Production validation still rejects malformed rows.

## Real live hook completion

Print-mode processes consumed the three-turn windows but exited before asynchronous capture finished. A temporary source trace reached window selection but never logged a judge completion; standalone native Jev returned 0.86–0.88 in 153–183ms, and the unchanged native extractor returned a valid fact in 4096ms. Missing credentials or non-durable input were not established blockers. All temporary trace/probe code was removed; the production hook is unchanged.

The proof then used actual long-lived OMP RPC sessions, with the same selected backend and the original judge/extractor/remember deadlines. Each session ran three real user/assistant turns, stayed alive until the actual hook emitted its saved-revision UI notification, then ran the selected-store verifier in a fourth turn. No custom tick, consumed marker, memory fact or receipt was manufactured or cleared. All four retained memories and their exact window-bound **complete** receipts were read back from the configured store. Each receipt has kind `rows`, duty `readback`, and lists the memory plus its real dedupe revision.

| Backend | Hook memory revision | SHA-256 | Complete hook receipt run |
|---|---|---|---|
| repo-files | `87afe9cc-4ddf-4e01-b975-a3f460dd4f4e` | `6f9d594b744b0abe68e0d81937ef377dc45e47e72facf8c2d7dd0d725ac9b751` | `run-edb0ecab-3b70-4fdd-ae64-a762eb27acd2` |
| external-files | `eae5a4c6-f267-4057-b8e7-0ac9939bae3b` | `b8c8b6a2e43f7270579cced6f707559cd43ff75a413e231d9909d96dcaf18e02` | `run-87ec4a61-20a3-45be-8ee6-c2a56190844a` |
| sqlite | `14aaa4f5-a886-4b5a-8a5a-046ae74f2a8c` | `85acaa0eca328be83d9b60bd98bf38bc223cc3064e487f9c6819be5ffec52980` | `run-91175da8-3df3-4de3-bf9b-67ba6c05dfd3` |
| postgres | `44a13ec0-a03a-42a2-8876-91d73a0536bf` | `6912bd5433c52c9b314011b67ab1968587edb9c28a19d18b9bccb36140f6a33c` | `run-25922620-1458-4952-b836-9c58dd0a5ddc` |

Private runtime transcripts: `<adapter>/live-hook-rpc.jsonl`; actual notification metadata: `live-hook-rpc-result.json`; selected-store memory/receipt and real-session usage readback: `automatic-producers.json`. At this later readback the verified automatic attribution counts were 132/128/125/153 for repo-files/external-files/sqlite/PostgreSQL. These are real session deliveries, not fabricated token rows.


