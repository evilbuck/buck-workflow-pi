# Rolling Notes — z.ai Discount Windows

## GLM-5.3-Flash Usage Campaign (docs.z.ai/devpack/notice/event-glm-5.3-flash)

- Campaign period: **2026-09-03 → 2026-09-20** (hard end date; "limited time").
- Daily window: **23:00 → 09:00 next day, Singapore Time (UTC+8)** — applies every day incl. weekends/holidays.
- Applies to **GLM-5.3-Flash only**; GLM-5.3 consumes standard quota.
- Paid plan users; effective automatically, no activation.
- Benefit: zero quota consumption via ZCode; doubled quota via other agents (OMP counts as "other agents").
- Confidence: high — official primary source, fetched 2026-09-09.

## Off-Peak Discount (docs.z.ai/devpack/overview)

- "During off-peak hours, model usage is charged at **50% of the standard credit rate**."
- Peak hours (the complement of off-peak): **Mon–Fri 14:00–18:00 SGT (UTC+8)** only.
- So off-peak = everything outside Mon–Fri 14:00–18:00 UTC+8 — a recurring weekly schedule, not a limited event.
- Applies to model usage generally (GLM-5.3 and GLM-5.3-Flash), per the credit-multiplier table context.
- The campaign window (23:00–09:00) is a strict subset of off-peak.
- Confidence: high — official primary source, fetched 2026-09-09.

## Implications for banner design

1. Two distinct conditions:
   - **Campaign** (bounded date range, Flash only): within 2026-09-03..2026-09-20 AND daily 23:00–09:00 SGT.
   - **Off-peak** (recurring, both models): NOT (Mon–Fri 14:00–18:00 SGT). Note: "off-peak" spans most of the week — a banner showing ~most of the time would be noise; consider whether the user really wants off-peak bannered, or only campaign windows. Open question for user.
2. All times in Asia/Singapore timezone — computation must convert local time → SGT (use `Intl.DateTimeFormat` with `timeZone: 'Asia/Singapore'` or equivalent offset math; UTC+8 has no DST).
3. Campaign end date (2026-09-20) means the feature needs a data table of events, not hard-coded logic — the next campaign will have different dates.
