# Publication is a versioned integration view, not a merge flag

Ordinary knowledge is the current branch overlay plus revisions whose sealed checkpoint is proven against the project's configured local integration ref. A seal freezes that snapshot's exact revision ids and hashes. The loop binds the seal only after Git verifies the resulting commit; a failed bind stays private and does not invent a commit. Proof is local ancestry of the bound commit, not creation HEAD. Exit 1 means not an ancestor; any other Git failure cannot prove. Nothing fetches. Squash and rebase stay private until an explicit mapping names that checkpoint, its full hashes, a reachable target, and evidence other than patch-id. Rewritten or missing evidence drops visibility. Reverting code does not delete a still-reachable published revision. Independent publications of one logical artifact keep both candidates and the last unambiguous baseline until an operator selects one candidate from that exact set. Supersession follows artifact correction ancestry, not Git ancestry. Branch deletion, rename, and same-name recreation never publish or destroy state; export or rebind happens only after one scope is selected. Run projections, receipts, import cursors, pass audits, and attribution stay private after merge.

## Considered Options

- Immediate project-wide visibility: rejected. Unmerged work would leak across branches.
- A tracked repository manifest as publication authority: rejected. The chosen authority is a central adapter ledger, not tracked bodies.
- An irreversible `merged=true` flag: rejected. Rewrites and revocation need a reconcilable view.
- Patch-id or creation HEAD as proof: rejected. Either can authorize the wrong bytes.

## Consequences

- No `integration_ref` means no automatic publication. There is no implicit integration branch.
- Restricted stages cannot call `publication-view`, `map-checkpoint`, `revoke-mapping`, `resolve-publication`, or `recover`.
- Operator sequences live in [the how-to index](../howto/README.md), not here.
