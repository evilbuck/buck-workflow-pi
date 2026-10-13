# Draft commit

## Title
feat(storage): migrate remaining durable consumers onto the storage contract

## Body

Preserve configured-retain failures until an explicit drain observes them, even
when a later queued retain succeeds. Add regression and retain-package CLI
coverage; synchronize the canonical regression files into the release bundle.
