# Draft commit

## Title
feat(storage): migrate remaining durable consumers onto the storage contract

## Body

Route remaining durable consumers through the configured adapter and preserve
receipt-backed retention. Replace the obsolete repo-files no-op expectation
with manifest and receipt readback; synchronize the canonical bundle.
