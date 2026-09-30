# OMP nested-session tool sources

Accessed 2026-09-28. Source snapshot: `can1357/oh-my-pi@33f887a0c3970f17bd8147df25b73fd88a889353` (GitHub search/file reads).

1. [OMP SDK docs](https://github.com/can1357/oh-my-pi/blob/33f887a0c3970f17bd8147df25b73fd88a889353/docs/sdk.md), **Tools and extension integration**:
   - “`toolNames` requests named tools ... by itself it is **not** an allowlist. Set `restrictToolNames: true` to limit the session to the names in `toolNames`.”
   - “Restricted children retain hooks/providers from the parent's `preloadedPreparedExtensions` ... Contributed tools cannot extend or replace the restricted tool set.”
   - “In a restricted session, SDK-supplied `customTools` are excluded unless `allowRestrictedCustomTools: true` and their names also appear in `toolNames`.”
   - Explicit `extensions` or `additionalExtensionPaths` may load with `disableExtensionDiscovery`, but restriction still applies.
2. [OMP custom tools docs](https://github.com/can1357/oh-my-pi/blob/33f887a0c3970f17bd8147df25b73fd88a889353/docs/custom-tools.md), **Integration paths in current code**: SDK-provided `options.customTools` is the supported inclusion path; restricted sessions require `allowRestrictedCustomTools: true` and a name in `toolNames`. Confirms normal extension discovery alone does not expose `sql_memory` to buck-loop children.

Applicability caveat: repository imports `createAgentSession` from `@mariozechner/pi-coding-agent`, while running under the OMP fork; implementation must prove this option against the deployed OMP runtime and its types, not assume Pi's installed declaration matches OMP.
