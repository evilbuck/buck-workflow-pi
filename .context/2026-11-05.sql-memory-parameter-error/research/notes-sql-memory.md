# SQL memory parameter investigation

### Initial trace
- `skills/_shared/recall-project-memories.md` requires two bound parameters but does not specify the tool argument name.
- `extensions/sql-memory/index.ts:14-19,112-131` defines `values` and passes it to `client.query(statement, values)`; the rendered `xd://sql_memory` schema omits both `statement` and `values` for SQL mode.
- Live shared-recall query succeeded with `op: sql`, `statement`, and `values: [origin, search text]` and returned 8 rows. Prior memories asserting positional parameters are unsupported are incorrect.
- The user's actual failed call is not captured yet; missing or misnamed `values` is a mechanism consistent with the symptom, not proven as that call's cause.
