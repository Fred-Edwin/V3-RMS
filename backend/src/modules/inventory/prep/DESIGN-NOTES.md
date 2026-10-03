# Prep walkthrough: decisions

Design only. Paper page "14 · Prep walkthrough (client)" in the V3-RMS file. Draft, awaiting owner approval. Manager phone screens come after the build.

## Who does what

| Person | Device | Can do |
|---|---|---|
| Store Attendant | Phone | Record a prep run. Correct or cancel their own runs for 24 hours. |
| Store Manager | Desktop (phone later) | See and review everything. Correct or cancel any run, any age. |

- Attendants never see stock figures, expected stock, or costs. Only the Store Manager does. This is the check against gaps, mistakes and theft.
- Prep has no PIN or signature. The record shows who and when.

## How a run works

1. The Attendant opens Prep. The top shows **Prep again** for the 3 most-made outputs. Tapping **Prep** opens the run filled in as last time. "Something else" lets them pick any prepped item.
2. They change what is different with − / + steppers. The yield is checked against the usual figure as they type. It is a nudge and never blocks.
3. A confirm sheet shows what was made and used. If the yield is off, they can pick an optional reason (Trimmed more, Spillage, Burnt, Other).
4. Recorded: one entry, inputs down, output up, output cost set to total input cost ÷ yield.

## Flags and review

- Yield more than 15% off usual: warning on the Attendant's phone and a flag for the manager.
- More than 35% off: also counts as notify (kept from the old plan).
- Input used is more than the system expected in stock: flagged silently to the manager only. The Attendant sees nothing and the run still saves.
- A flagged run shows in **Needs a look** on the Dashboard (band), at the top of Prep, and in the Audit log. **Mark reviewed** is one tap, no PIN.
- A corrected run also goes to Needs a look.

## Fixing mistakes (rule: nothing is deleted)

| | Attendant | Store Manager |
|---|---|---|
| Window | Own runs, 24 hours | Any run, any age |
| Correct | Change figures, pick a reason (Typo, Wrong item, Wrong quantity, Other), confirm summary | Same |
| Cancel | Reason (Entered twice, Never made, Wrong item, Other), confirm summary | Same, plus a stock warning if it takes stock below zero |

- A correction reverses the old run and posts a new one, linked. The old run stays on record as "Corrected" or "Cancelled".
- Output cost updates only if the corrected run is the latest run of that item. Otherwise it stays.
- A corrected run counts in "typical yield" with its new figures. A cancelled run does not.
- Cancelling can push stock below zero. This is allowed and marked negative on stock screens.
- After 24 hours the Attendant sees the run locked, with "Ask the Store Manager".
- Warnings before mistakes: "Looks like a repeat" (same items within a short time), and a typo check on yield (for example 380 instead of 38).
- Every record, review, correction and cancel is in the Audit log under area "Prep".

## Running example

- Today: Mon 12 Oct 2026. Attendant: Sarah Achieng (SA). Other attendant: Peter Kariuki (PK). Manager: Joseph Mwangi.
- **Marinated chicken** PREP-0130, 07:20: chicken, cut 10 kg + garlic-ginger paste 1 kg → 38 portions (usual 38). Cost KES 4,580 ÷ 38 = KES 121 per portion.
- Corrected 13:15 to PREP-0132: chicken 9 kg, reason Wrong quantity. Cost KES 4,160 ÷ 38 = KES 109 per portion.
- **Samosa filling** PREP-0131, 10:05: beef mince 6 kg + onions 2 kg → 5 kg (usual 7 kg, 2 kg under). Cost KES 4,140 ÷ 5 = KES 828 per kg. Beef mince used 6 kg vs 4.5 kg expected. Sarah said "Spillage". Reviewed by Joseph 12:34.
- **Chapati dough** PREP-0127 and PREP-0126 on 10 Oct at 08:02 and 08:00: wheat flour 10 kg, cooking oil 1 L, water 3 L → 14 kg each. PREP-0126 cancelled by Joseph on 12 Oct 14:20 as "Entered twice"; stock would show −8 kg.
- Earlier runs: PREP-0129 marinated chicken 36 portions (Peter, 11 Oct 15:10), PREP-0128 kachumbari mix 8 kg (Sarah, 11 Oct 06:40).

## What changed compared with the old design

- "Prep again" tiles and pre-filled runs (new).
- Steppers and a live yield check on the phone (new).
- Optional reason on a flagged run (new).
- Costs removed from the Attendant phone list (they were shown before).
- Needs a look queue, Mark reviewed, and a Dashboard band (new).
- Correct and Cancel with 24-hour window for Attendants (replaces "immutable").
- Run numbers PREP-nnnn (new; the old plan had none).
- Table headers in the current style (no fill).

## Open questions for the owner

1. **Run numbers.** Is a PREP-0131 style number on every run OK? The old plan had none. I used them in the drawer, history and Audit log.
2. **Dashboard.** I drew only the Needs a look band and three tiles. The rest of the Store Manager dashboard is not redesigned here. Is that OK?
3. **Manager's own run.** The manager's "New prep run" drawer from the old design is kept as it was and not redrawn. Confirm it should stay.
4. **Typical yield.** Still computed from the last 10 runs or 30 days. Should a Store Manager be able to set a target instead (deferred in the old plan)?
