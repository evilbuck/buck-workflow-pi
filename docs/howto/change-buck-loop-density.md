# Change `/buck-loop` activity density

Change the live card without restarting its work.

## Steps

1. Start a run with `/buck-loop <plan-path>` or resume it with `/buck-loop --resume`.
2. Enter `/buck-loop --profile compact` to hide previous visits, activity rows and the ledger.
3. Enter `/buck-loop --profile standard` for the previous visit, three activity rows and known run total, or `/buck-loop --profile verbose` for all retained activity and the visit ledger.
4. **Eat:** The CURRENT box still shows tokens and an animated spinner; changing density changes the surrounding detail without starting another work session.

The profile lasts for this host session. You can set it before starting a run. Unknown tokens mean no usage has been reported yet. Advisory scores never select an action. See [the activity-card contract](../buck-loop.md).
