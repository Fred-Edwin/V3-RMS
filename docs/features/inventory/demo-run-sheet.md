# Inventory — Production Demo Run Sheet

For the client demo in production, with the client's real catalog seeded. Rehearsed
locally on 2026-09-30 (see `milestone-6-plan.md` §8, "Integration pass"). The day is
walked live through the UI so every ledger row is real — do not seed transactions.

Rehearsal used one person per role, password `password123`, signing PIN `1234`. In
production, use the real accounts and each person's own PIN. Every signing step below
asks for the PIN.

## Before the demo (owner, once)

1. Confirm reference data is in place: Central Store, both branches with the five
   department locations, the catalog, suppliers (one PAY_NOW, one 14-day, one 30-day),
   restock levels, opening stock, and counting thresholds.
2. Confirm every demo person has a signing PIN set (Store Manager, Store Attendant,
   Branch Manager, Department Heads, Accountant).
3. Set thresholds low enough that a demo variance crosses them (Store Manager:
   Stock & counts → Thresholds; Branch Manager: Day → Thresholds).
4. Push notifications need a real phone with notifications enabled — test separately.

## The day, in order

Roles log in as needed. Reuse sessions; repeated logins trip the API rate limiter.

### 00 · Set up — Store Manager
- **Catalog** → show categories (Prep Kitchen Items > Chicken/Beef/Pork/Fish, Market, Dry…),
  a bought-by-tray / used-by-kg item, and the three supplier terms.
- Expect: items grouped by category; buy unit → usage unit shown (e.g. tray (5kg) → kg).

### 01 · Buy, receive, pay
1. **Store Manager → Receiving → New goods receipt.** Pick the 14-day supplier, add an item,
   raise the unit price ~35–40% above standard.
   Expect: an amber "N% above last" badge and a "Confirm the price on this line" checkbox
   that must be ticked before signing. Sign with PIN → status "Received — invoice pending".
2. **Store Attendant → Receiving.** Receive a delivery from the PAY_NOW supplier (several lines).
   Expect: status "Received — paid". Stock rises at the Central Store.
3. **Store Manager → Supplier AP.** Record the supplier's invoice for the first receipt with a
   billed amount higher than the receipt total and a dispute note.
   Expect: invoice UNPAID with an open dispute, due date = invoice date + payment days.
4. **Accountant → Supplier AP.** Record a part payment (Mpesa/bank).
   Expect: invoice PARTIALLY_PAID, outstanding reduced.

### 02 · Prep — Store Attendant
- **Prep → New prep run.** Make a normal batch (e.g. 10 kg chicken breast + garlic → 9.5 kg
  marinated). Then a second batch with a poor yield (10 kg → 6 kg).
  Expect: first run "normal" (no average yet); second flagged "low yield", Prep list KPI
  "Yield flags 1", Store Manager notified. Output unit cost = input cost ÷ yield.

### 03 · Count the Central Store
1. **Store Attendant → Daily count.** Count every item (blind — no expected figures on screen).
   Make 3–4 differences from the true stock. Sign & submit with PIN.
2. **Store Manager → Stock & counts → Daily count.** Review variances. Query one line
   ("please recount") and send the count back.
3. **Store Attendant.** Only the queried line comes back, still blind. Recount, resubmit.
4. **Store Manager.** Accept variances (a reason is required above the threshold — try
   approving without one to show the block), then approve with PIN.
   Expect: one ADJ-#### adjustment per non-zero variance; matched lines write nothing;
   a variance over the Director alert threshold flags the Director.
5. **Spot count** (Store Manager → Spot count) on one item; **Log waste** at the store as the Attendant.
   Expect: Stock ledger shows every movement; Attendant screens never show on-hand or cost of stock.

### 04 · Request and approve
1. **Kitchen head and Barista head → Requisitions.** Open a morning requisition, add lines, submit.
   One department (e.g. Pastry) deliberately does nothing.
2. **Branch Manager → Requisitions.** Open it: change one quantity (with a reason), delete one
   line, add one line. Approve with PIN.
   Expect: approved even though a department skipped.

### 05 · Dispatch and receive
1. **Store Attendant → Dispatch.** Fulfil Kitchen: send one line short (less than on hand or
   requested). Fulfil Barista: leave one line at 0 and add a substitute line with a note. Sign each with PIN.
   Expect: stock leaves the Central Store immediately (DISPATCH_OUT); both dispatches IN_TRANSIT.
2. **Kitchen head → Deliveries → Confirm.** Confirm one line with a smaller quantity than sent.
   Expect: stock lands in the Kitchen only for confirmed quantities; a discrepancy is raised.
3. **Leave the Barista dispatch IN_TRANSIT** — it blocks the Barista count on the next step.
4. **Store Manager → Dispatch → Discrepancies.** Resolve the Kitchen gap as **Transit loss**.
   Expect: a write-off adjustment at the Central Store (ADJ-#### reference, reason "Transit loss")
   and the dispatch closes.
   > Do not demo "Miscount corrected" until the decision in `milestone-6-plan.md` §8 (F1) is made.

### 06 · Close the branch day — Branch Manager
1. **Day.** Barista shows BLOCKED by the unconfirmed dispatch. **Deliveries → confirm on behalf**
   of the Barista head (Branch Manager confirms). Barista unblocks.
2. Count every department (Branch Manager enters the counts). Make 1–2 gaps, one above the
   threshold. Try **Sign & close day** first: it must refuse until the gap has a reason.
3. Add the reason, sign & close with PIN. Expect: one adjustment per gap; net adjustment shown.
4. **Reopen** the day with a reason, change a count, re-close. Expect: the old adjustments are
   reversed (linked reversal rows) and fresh ones written; History shows "Reopened once".

### 07 · Next morning — Department Head
- **Requisitions → Opening.** The opening figures are prefilled from what was signed at close.
  Accept with one or two different figures (overnight variance).
  Expect: an ADJ-#### row per variance; Branch Manager alerted if over the overnight threshold.
- **Waste** at the branch (Department Head) and, optionally, a deliberate over-waste to show
  negative stock: it proceeds and is flagged red everywhere it appears (Flow 21).

## What to say if something looks off

- A "Waiting" dispatch row that says "2 of 2 out" is a fully dispatched branch still listed — cosmetic.
- Attendant sees on-hand on the dispatch fulfil screen only (needed to spot a short line) — open owner decision.

## Not covered by this run sheet

Director and Accountant dashboards/reports (designed, built after go-live), push
notifications (needs a phone), and print documents (spot-check in the browser).
