# Stock, waste and Central Store counting walkthrough: decisions

Design only. Paper page "16 · Stock and counting walkthrough (client)" in the V3-RMS file. Draft, awaiting owner approval. 38 screens in 7 chapters. Branch day close and history, Requisition, Dispatch and the Store Manager's "fulfil a dispatch" screens are other flows and are not redrawn.

## Who does what

| Person | Device | Can do |
|---|---|---|
| Store Attendant (Linnet Wanjiru, Peter Kariuki) | Phone | Do the daily count, blind, in shelf order. Pause and continue later. Review and sign with a PIN. Recount only the lines Isabel queries. Log waste (several items, with a confirm summary). Reverse their own waste entry the same day, with a reason. Never sees expected stock, opening stock, differences or costs. |
| Store Manager (Isabel Njoki) | Desktop | Check a count, accept or query each line, "Accept all within range", give reasons, send back, approve and sign. Log waste with values and reverse any entry. Spot count, including correcting a verified count. Count setup (sections, order, variants). Count settings (reason amount, reminder time). Print the count record and a blank sheet. |
| Director | Alert only | Alerted when one difference reaches KES 5,000. Sets that amount. Not drawn here. |

## Settled by the owner

1. **One count a day, at any time.** The time she signs fixes what the system expected, so a delivery that arrives later counts toward tomorrow.
2. **Sections follow the supplier** (Samrat, Summer), plus two manual sections: Others and Packaging. The Store Manager sets the order once.
3. **Count everything daily.** An unchanged item costs one number, or one tap on "None here" for zero.
4. **One number per item.** The system already records opening, received and dispatched, so Linnet does not type the four columns of her paper sheet. Isabel sees them on Verify.
5. **No count-by-pack.** Linnet types one number in the item's own unit. The earlier pack-and-loose idea was dropped.
6. **Attendants never see stock figures, expected stock or costs.** This includes the waste screens.
7. Agreed from the first brief: Accept all within range, send-back and approve summaries, no partial sign (every line needs a number or "None here"), reverse waste, correct a verified count with a pre-filled spot count, blank count sheet, count settings as a quiet link, "Not counted yet" status (no push), who counted each section.

## How things work

**The count.** Linnet opens Stock & counts and starts the daily count. The phone lists four sections in shelf order with progress. Each row has a big number box, a "None here" button and a number pad whose Next key moves down the list. Variants sit under one heading in Count setup. Counts save to the server as she types ("Saved 07:19"), so she can stop, close the app and continue from any phone. Nothing is visible to Isabel until she signs.

**Review before signing.** Signing is blocked until every line has a number or "None here". The review shows the "None here" items and any line she changed after entering it. Then PIN.

**Verify.** Isabel sees counted against expected, with the sheet's maths under each item: Open + in − out − waste (and the per-branch split of what went out). Lines under the reason amount (KES 500) are grouped as "within range" and accepted with one button. The lines that matter get Accept or Query. Above KES 500 a reason is required; "Other" needs a note. Query sends the line back: a summary says what goes back and Linnet recounts only those lines, still blind.

**Approve.** A summary lists every adjustment, the net value and whether the Director is alerted. Then her PIN. Six adjustments are written, each with an ADJ number, a reason and a link to the ledger. The verified record shows both signatures.

**Waste.** Attendant: pick items, quantity, reason chips (Expired, Spoiled, Damaged in store, Prep error), review, confirm. Stock changes only after confirm. A wrong entry is reversed with a reason; the original stays. Manager: the same, with values, and she can reverse any entry.

**Spot count and corrections.** Spot count shows expected to Isabel, writes adjustments after a confirm summary and PIN. To correct a verified count she opens a spot count pre-filled for that item, linked to the old adjustment.

**Count setup and settings.** Sections, order and variant families (for example Herbal tea) are set by the Store Manager and apply from the next count. Settings: the reason amount, the "not started" reminder time (status only) and the Director amount, read-only.

**Stock ledger (steps 28–29).** One store-wide place to answer "where did it go?", in two views. The *Stock ledger* (step 28) is the landing page: one row per item with opening, in, sent out, Prep use, waste, adjusted and closing, so each row adds up. Filters: date range, section, "Had adjustments" and "Had waste" chips, "Negative stock only", and a search that finds an item or a reference (for example ADJ-3402, CNT-2026-1013). The date control opens a picker with quick picks (Today, Yesterday, Last 7 days, Last 30 days, This month, Last month) and a two-month calendar: click one date for a single day, or two dates for a range; later dates can't be picked. Opening an item shows its *Stock card* (step 29), which uses the same summary view for that one item: an opening-to-closing strip for the period, then one row per day with movement (opening, in, sent out, Prep use, waste, adjusted, closing, value) with the source reference (ADJ, DSP, GRN) on each row, the same date picker, and a "By day" grouping. Opening a day shows its individual entries (not drawn). Quiet periods collapse into one row. A separate all-items Journal was considered and dropped on the owner's decision (1 Oct 2026): the summary answers the question and the Audit log (step 37) already lists every change with who, when and why. Export is available; the footer says "Showing x of y". Managers see values; attendants never reach this page. The ledger itself is never edited: a correction is a new linked entry. Drawn figures are "as of 13 Oct, 16:30, last 30 days": in +KES 214,600, out −KES 239,000, adjustments −KES 3,400 (14), closing KES 482,400 against KES 510,200 on 14 Sep.

**Summary strips.** Hub (items tracked, low or out, negative stock, today's count), Daily count (items counted, differences, above KES 500, net difference) and All items (items tracked, low or out, negative, on-hand value). Cells needing attention carry a coloured top edge and an arrow and are drawn as one-tap filters for the list below (assumption, not yet confirmed).

## Fixing mistakes (nothing is deleted)

| Mistake | Fix |
|---|---|
| Wrong number while counting | Change it before signing. Changed lines are listed on the review. |
| Item skipped or "None here" tapped by mistake | Signing is blocked until every line is filled. Review lists the "None here" items. |
| A doubtful count line | Query it; Linnet recounts only that line, blind. Both counts are kept. |
| Accepted by mistake | Tap again, or Undo. Nothing is written until the approve summary and PIN. |
| Figure wrong after approval | Spot count pre-filled for that item, linked, with a reason. |
| Waste on the wrong item or quantity | Reverse with a reason. Original and reversal both stay. |
| Count started, never signed | Stays open, flagged on both hubs. Next day starts a new count. |
| Wrong PIN | Nothing is written. Try again. |
| Wrong setting | Change again; applies from the next count. Signed counts keep what they were judged against. |
| Item in the wrong section | Move it in Count setup. Logged. |

Every change appears in the Audit log under Stock & counts with who, when and why.

## Running example (Tue 13 Oct 2026)

- 07:05 Linnet starts the count; 07:31 she has done 62 of 142 and pauses; 07:42 she signs CNT-2026-1013 (142 lines).
- Sugar, white: expected 180 kg, counted 164 kg: −16 kg, −KES 2,928 (KES 183 per kg). Reason: Other, bag split for Prep, not logged.
- Honey 1 kg: expected 12, counted 11: −KES 850. Reason: suspected miscount.
- Cooking oil: expected 80 L (opening 100, 20 out to Nyeri Town 10 and Kimathi 10). First count 74 L (−KES 1,560), queried 08:42, recount 79 L (−1 L, −KES 260) signed 08:52.
- Within range: Wheat flour −2 kg (−KES 283), Tomato paste −1 tin (−KES 150), Tissues +2 rolls (+KES 90).
- Differences 6; net −KES 5,681 before the recount and −KES 4,381 after. No Director alert (none reaches KES 5,000). 6 adjustments ADJ-3402 to ADJ-3407, approved 09:05.
- 14:20 Peter logs Marinated chicken 3 kg (expired) and Kachumbari mix 2 kg (spoiled); reverses Kachumbari mix 14:40 ("logged the wrong item"). 14:35 Isabel logs Wheat flour 1 kg and Tomato paste 1 tin (KES 292).
- 15:30 Isabel's spot count SPT-0007: Brown sugar −2 kg (ADJ-3408). 16:20 correction SPT-0008: Honey +1 jar (ADJ-3409) linked to ADJ-3403.
- Restock levels from the Catalog walkthrough decide Low or Out (Cooking oil level 100 L, Sugar, white 180 kg).

## What changed compared with the old design

- Count in shelf order by supplier section, with progress and a Review step (old: category tabs, partial sign allowed).
- "None here" instead of a blank box: no blank-versus-zero doubt.
- Pause and resume is drawn (old: autosave existed but no resume screen).
- Verify: "Accept all within range", the sheet's maths per line, summaries before send-back and approve, per-branch split of what went out (old: Accept or Query on every variance line, approve straight to PIN).
- Waste: several items, confirm summary, Reverse for attendant (own, same day) and manager (any). Costs removed from the attendant waste view (old: single item, no undo, unit cost shown to attendants).
- Correct a verified count with a pre-filled spot count (old: no path).
- Count setup for sections, order and variants; count settings moved out of the hub top bar to a quiet link on Daily count.
- Hub: KPI strips with attention cells; "count waiting" banner with stage tracker (old: KPI on-hand value and Awaiting card).
- Store-wide Stock ledger summary plus a Stock card per item, with filters and export (new; old: only a per-item history).
- Printed count record in the Classic ledger style, in the sheet's own columns; blank count sheet to print (new).

## Open questions for the owner

1. **Unsigned count from a previous day.** Recommendation: it stays open with everything saved, both hubs flag it, and the next day starts a new count. Nothing is deleted.
2. **Count reminder time.** Recommendation: 18:00 default, status only, set by the Store Manager.
3. **Cooking oil, Wheat flour and other items sit under which supplier section?** The paper sheet shows them under Summer while the Catalog story says Samrat sells them. Recommendation: a section is the shelf area, defaulting to the preferred supplier, and the Store Manager can change it.
4. **Miscount-correction ledger effect (Milestone Six, still open).** Not drawn and nothing here depends on it.
5. **Attendant on-hand in dispatch fulfil (Milestone Six, still open).** Not drawn. It conflicts with the blind-count rule, so it needs your decision.
6. **Requisition per branch.** Linnet's paper "Requisition" column is what goes out to branches. This walkthrough only shows the per-branch split on Verify. The per-branch entry belongs to the Requisition and Dispatch walkthroughs.
7. **Accountant and Director views of count adjustments** (values by item, alerts) are not drawn; they wait for their own screens.
8. **Who else sees the Stock ledger?** Drawn for the Store Manager only. Recommendation: the Accountant and Director get the same two views read-only, with Export. Not drawn.
9. **Time of the drawn figures.** The All items screen (step 27) shows the morning figures after approval (Honey 11, Brown sugar 100); the ledger screens are labelled "as of 13 Oct, 16:30". This is deliberate and not a mismatch.
10. **"Who did it" filter and "everything on one day" view.** Dropping the Journal removes the cross-item chronological list. The Audit log covers who and when but not quantities. If Isabel needs "all movements today", add a date-only filter to the Stock card or revisit the Journal.

## What would need to change in the built code (a plan, not done)

- Frontend: new section list and number-pad count screen, "None here", review-before-sign, resume state; verify with within-range group, movement maths and summaries; waste multi-item with confirm and reverse (phone and desktop); correction mode on spot count; Count setup page; hub KPI strip and banner; printed count record and blank sheet.
- Backend: sections, order and variant family on items; "None here" distinct from blank; block signing with untouched lines; waste reversal as a linked entry; multi-line waste request; opening, in, out and waste breakdown (with branch split) on the verifier view; reminder time setting; unsigned-day flag.
- Stock ledger: a per-item opening/in/out/Prep/waste/adjusted/closing aggregate for the summary (filters: date, section, had adjustments/waste, negative stock, item or reference search), a per-item movement query with a running balance for the Stock card, and CSV export. Every query scoped by organizationId on the hub; values only for manager roles.
- Remove: attendant unit-cost hint on waste; Thresholds and Restock levels from the hub top bar.
