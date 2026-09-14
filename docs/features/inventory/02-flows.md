# Inventory & Procurement — User Flows

**Feature:** Inventory & Procurement (Feature 1 of the redo)
**Step:** 2 of the per-feature pipeline — flows
**Status:** Working draft — owner delegated remaining flow-level decisions to the
agent's [REC] defaults on 2026-09-09; the real review gate is the Paper visual
design per slice (see `02-screens.md` and the slice plan). Flows 1 and 2
(incl. 2a–2e) were walked with the owner and confirmed; the rest run on the
[REC] defaults resolved in "Open points" at the end of this doc.
**Date:** 2026-09-09
**Traces to:** `docs/features/inventory/01-description.md` (the approved Step 1 brief)

> **How to read this.** Every flow is numbered. Each names its **trigger**,
> **primary actor** (role + which org — **hub** = Central Store on the `isHub`
> org, **branch** = a branch org), **preconditions**, **numbered steps** (user
> action → system response, including ledger writes, notifications, signatures,
> prints), **decision branches**, **error / edge paths**, **end state**, and
> **cross-references** to the description sections each step implements.
>
> **Ledger discipline.** Every stock movement names its `InventoryTransaction`
> type — `receive`, `prep_consume`, `prep_produce`, `dispatch_out`, `dispatch_in`,
> `adjustment`, `waste` — and the location it hits. Stock on hand is always
> *derived* by summing the ledger, never a stored counter (§4).
>
> **Signing.** Wherever a document is signed: the actor taps **Sign**, enters
> their **PIN** (a real re-authentication), and their name renders in a stylised
> signature font on screen and on any printout. A signature records **who / what
> / when** and is immutable (§4). **Printing is always optional** — no flow
> blocks on a printer (§4).

---

## Flow index

**Central Store (hub)**
1. Buying — Store Manager records a purchase
2. Goods receipt at Central Store
   - 2a. Receipt with payment terms = Invoice to follow
   - 2b. Receipt with payment terms = Pay now
   - 2c. Edge: damaged goods at receiving
   - 2d. Edge: price-change alert on a line
   - 2e. Edge: over-delivery vs. the invoice
3. Prep run (after-the-fact)
   - 3a. Edge: yield far off the norm
4. Central Store daily count — Attendant counts blind
5. Central Store count verification — Store Manager verifies
   - 5a. Store Manager ad-hoc spot count
6. Central Store waste logging

**Branch (department heads + branch manager)**
7. Requisition — department head fills their section
   - 7a. Edge: department submits nothing this requisition
8. Branch manager approval
   - 8a. Edge: manager edits / deletes / adds a line
   - 8b. Edge: manager off-shift at 6am (the hard-gate wait)
9. Fulfilment & dispatch — Central Store
   - 9a. Edge: short dispatch (store has less than requested)
   - 9b. Edge: substitution (store sends a different item)
10. Branch receiving — department head confirms their own lines
    - 10a. Edge: transit discrepancy (dispatched 20, arrived 18)
    - 10b. Edge: department never confirms by end of day
11. Transit / receiving discrepancy resolution — Store Manager
12. Branch end-of-day count & close — branch manager
    - 12a. Edge: count won't reconcile
    - 12b. Reopen a closed day
    - 12c. Next-morning opening & overnight variance
13. Branch department waste logging

**Supplier payment & AP (Store Manager + Accountant)**
14. Record a supplier invoice against a receipt
15. Record a supplier payment (partial supported)
16. Supplier aging report
17. Accountant reconciles a month-end supplier statement
    - 17a. Edge: statement disputes a specific invoice

**Catalog & par levels (supporting)**
18. Catalog item maintenance — Store Manager
19. Par-level maintenance — owner of the stock

**Cross-cutting**
20. Discrepancy alert fan-out (referenced by 10a, 11, 12a)
21. Negative stock handling (referenced throughout)

---

# Central Store (hub)

## Flow 1 — Buying: Store Manager records a purchase

Implements: §3 Stage 1; §2 (Store Manager); §7 (POs removed).

**Trigger.** Store Manager decides to buy — prompted by a low-stock signal on the
Central Store dashboard, a department requisition they can't fill, or judgement.

**Primary actor.** Store Manager, hub org.

**Preconditions.**
- Supplier exists in the catalog (or is created inline — Flow 18), with a
  **default payment terms** value (*Invoice to follow* / *Pay now*).
- Items being bought exist in the catalog as **raw ingredient** or **stocked
  item** (Flow 18).

**Steps.**
1. Store Manager opens **New Purchase** and picks a supplier.
   - System shows the supplier's default payment terms and last purchase date
     for reference. No approval control appears — the Store Manager buys at any
     value without approval (§3 Stage 1).
2. Store Manager adds lines: item, expected quantity (buy unit), expected unit
   price. Prices pre-fill from the item's last purchase price as a reference.
   There is no PO document generated (§3 Stage 1, §7).
3. Store Manager saves. The purchase is now an **expected delivery** — a
   lightweight record with status `Awaiting delivery`. **No ledger entry is
   written** (nothing has physically arrived).

**Decision branches.**
- **Payment terms = Invoice to follow** → the goods arrive with an invoice;
  receipt is Flow 2a, invoice is Flow 14.
- **Payment terms = Pay now** → the driver returns with goods + a paid receipt;
  handled by Flow 2b, no AP.
- The toggle is set per receipt (defaulted from the supplier), so a normally-
  on-account supplier can be marked *Pay now* for a one-off cash run without
  changing the supplier record.
- Store Manager may skip this flow entirely and go straight to a Goods Receipt
  (Flow 2) — the "expected delivery" is a convenience for tracking what's
  coming, not a prerequisite for receiving.

**Error / edge paths.**
- **Item not in catalog** → Store Manager creates it inline (Flow 18) without
  leaving the purchase.
- **Supplier not in catalog** → created inline (Flow 18).
- **Purchase never arrives** → the expected-delivery record ages; it appears on
  the dashboard as `Overdue` after a set period. Store Manager can cancel it.
  No stock or AP impact (nothing was ever received).

**End state.**
- An expected-delivery record exists with status `Awaiting delivery`.
- No stock change, no AP, no notification.

---

## Flow 2 — Goods receipt at the Central Store

Implements: §3 Stage 2; §4 (Signing, costing); §7 (invoice-first receiving).

**Trigger.** Goods physically arrive at the Central Store with a supplier invoice
or a cash receipt.

**Primary actor.** Store Attendant, hub org (the Store Manager may also do this).

**Preconditions.**
- The receiving user is a `STORE_ATTENDANT` or `STORE_MANAGER` on the hub org.
- Items are in the catalog (or created inline — Flow 18).

### Flow 2a — Receipt with payment terms = Invoice to follow

**Steps.**
1. Attendant opens **New Goods Receipt**, picks the supplier. The **payment-
   terms toggle** on the receipt header defaults from the supplier (here:
   *Invoice to follow*) and can be changed on this receipt.
   - If an expected-delivery record exists for that supplier (Flow 1), the
     Attendant may attach it and its lines pre-fill. Otherwise the receipt
     starts blank — "there is nothing to check against; the receipt *is* the
     record" (§3 Stage 2).
2. Attendant records each line **as it actually arrived**: item, quantity (buy
   unit), unit price from the invoice.
3. **Per line, the system checks the unit price against that item's last
   purchase price.** If it exceeds the last price by more than the configured
   percentage, the line shows a **price-change alert** inline (§6; Flow 2d) —
   non-blocking.
4. Attendant enters the supplier's **invoice / delivery-note number** and the
   invoice date on the receipt header.
5. Attendant taps **Sign**, enters **PIN**. Their name renders in the signature
   font on the receipt. The signature is immutable (§4).
6. On save, for **each line** the system writes a `receive` `InventoryTransaction`
   at the **Central Store location**:
   - quantity in usage units (buy qty × pack conversion — §4 Units),
   - line cost = quantity × unit price,
   - and **sets that item's current cost to this unit price** (latest-price
     costing — §4). The previous cost is retained in price history.
7. The receipt's status becomes `Received — invoice pending`. It appears in the
   Store Manager's **Invoices to record** queue (Flow 14).
8. **Print** is offered (optional) — a hard copy for the store's file.

**Decision branches.**
- Line count / quantities differ from the attached expected delivery → the
  receipt records the actual; the expected-delivery record is closed as
  `Fulfilled` regardless of variance (there is no PO to reconcile — §6
  over-delivery).
- Attendant flips the payment-terms toggle to *Pay now* (cash paid this run) →
  Flow 2b behaviour instead.

**Error / edge paths.**
- **Damaged goods** → Flow 2c.
- **Price-change alert fires** → Flow 2d (still records; alert is a nudge).
- **Invoice number not to hand** → the field can be left blank and the receipt
  still saves as `Received — invoice pending`; the Store Manager fills the
  invoice number when recording the invoice (Flow 14).
- **PIN wrong** → signature not applied; the receipt stays in draft; the
  Attendant retries. After N failed attempts the account is locked per the
  product's existing auth policy and the Attendant must get the Store Manager to
  sign.
- **Offline** → the receipt is held locally as a draft; ledger writes and the
  `Received` status apply only on reconnect. Until then stock on hand does not
  reflect the delivery. (Applies to every signed document in this feature.)

**End state.**
- `receive` ledger entries at the Central Store; stock on hand up; item current
  cost updated to the latest price.
- Signed goods receipt, status `Received — invoice pending`.
- Store Manager notified: an invoice is waiting to be recorded.
- No supplier payment yet; AP is created by Flow 14.

### Flow 2b — Receipt with payment terms = Pay now

**Steps.** As 2a steps 1–6, then:
7. Because the receipt's payment terms are *Pay now*, the header shows **Paid**
   with the amount = receipt total, method = cash, and the driver / payer noted.
8. On save, the same per-line `receive` ledger entries are written. **No AP is
   created**; the receipt is `Received — paid` (§3 Stage 2).
9. Print offered (optional).

**End state.**
- `receive` ledger entries; stock up; current cost updated.
- Signed goods receipt, status `Received — paid`. No supplier balance change.

### Flow 2c — Edge: damaged goods at receiving

Implements: §6 (damaged goods).

1. On a line, the Attendant records **only the good quantity** received.
2. The Attendant adds a **damage note** on that line: damaged quantity + reason.
   This is captured as a **supplier claim** on the receipt, not a stock line.
3. `receive` is written for the good quantity only. **Damaged stock never enters
   the ledger** (§6).
4. The receipt prints (optional) with the damage note visible so the store can
   raise it with the supplier.

**End state.** Stock reflects only sound goods. A supplier-claim note is attached
to the receipt for the Store Manager to pursue against the invoice (Flow 17a).

### Flow 2d — Edge: price-change alert on a line

Implements: §4 (price-change alert), §6.

1. Attendant enters a unit price on a line.
2. System compares against the item's last purchase price. If it exceeds the
   threshold %, the line shows an inline **warning** (dot + label, warning tone)
   — "38% above last price (KSh 250 → KSh 345)".
3. The alert **does not block**. The Attendant can proceed, correct a typo, or
   call the Store Manager.
4. On save, the entered price becomes the item's current cost regardless (§4
   latest-price). The price change is recorded in price history and surfaces on
   the Store Manager's / Accountant's cost reports.

**End state.** Receipt saved at the entered price; a price-change event logged
for reporting.

### Flow 2e — Edge: over-delivery vs. the invoice

Implements: §6 (over-delivery).

1. More arrives than the invoice bills (or the invoice bills more than arrived).
2. The Attendant records **what physically arrived** on the receipt lines.
3. The receipt is the truth. Any difference between the receipt total and the
   invoice total is flagged when the Store Manager records the invoice (Flow 14)
   as a **receipt / invoice mismatch**, to be pursued as a supplier dispute
   (Flow 17a). No PO exists to "violate" (§6).

**End state.** Ledger reflects actual arrival; a mismatch flag rides on the
receipt into the invoice step.

---

## Flow 3 — Prep run (after-the-fact)

Implements: §3 Stage 3; §4 (Signing not required here — see note); D-12 (carried).

**Trigger.** An Attendant has finished a batch of prep (deboned/trimmed/portioned)
and records what was done.

**Primary actor.** Store Attendant, hub org.

**Preconditions.**
- The **output** item exists in the catalog as a **prepped item** (Flow 18).
- The **input** items exist and have stock (negative is allowed — Flow 21).

**Steps.**
1. Attendant opens **New Prep Run** and picks the **output item** being produced
   (e.g. *Grilled chicken portion*).
2. The screen shows a **soft reference** from the rolling average of recent prep
   runs for that output — "Typical: ~6 kg chicken → ~22 portions". It is a
   nudge; it never validates and never blocks (§3 Stage 3).
3. Attendant records the **inputs actually consumed** — item + quantity, as many
   lines as needed.
4. Attendant records the **actual yield** produced (output quantity).
5. Attendant taps **Confirm**.
6. In **one atomic transaction** the system writes:
   - a `prep_consume` `InventoryTransaction` per input line at the **Central
     Store location**, costed at **each input's current cost in force now** (§4);
   - a `prep_produce` `InventoryTransaction` for the output at the Central Store
     location, quantity = actual yield;
   - the output's unit cost = **total input cost ÷ actual yield**, which becomes
     the output item's current cost.
7. **Yield variance** (this run's yield vs. the rolling average) is computed and
   stored for the store's performance report. Not enforced (§3 Stage 3).

**Decision branches.**
- Output produced from prep of an already-prepped item (two-stage prep) is
  allowed — inputs can be prepped or stocked items, not only raw.
- Attendant realises mid-entry the output item doesn't exist → creates it inline
  (Flow 18) and continues.

**Error / edge paths.**
- **Yield far off the norm** → Flow 3a.
- **Input stock goes negative** → allowed, the line saves, the item is flagged
  negative on stock views (Flow 21). Prep is never blocked (§6).
- **Wrong input recorded** → prep runs are immutable once confirmed; the
  Attendant records a correcting `adjustment` (via Flow 5a spot count) or a
  `waste` entry, and notes it. A prep run is not editable after confirm to keep
  the ledger append-only (§4).
- **Offline** → held as a draft; the atomic transaction posts on reconnect.

**End state.**
- `prep_consume` × inputs + `prep_produce` × 1 at the Central Store.
- Output item current cost recalculated.
- Yield-variance figure recorded for reporting.

### Flow 3a — Edge: prep yield far off the norm

Implements: §6 (prep yield far off).

1. Attendant enters a yield that deviates from the rolling average beyond a set
   band.
2. The Confirm screen shows a **yield-variance warning** (dot + label) — "Yield
   62% of typical". Non-blocking.
3. Attendant confirms (or corrects a typo first).
4. The run posts as entered. The variance is flagged on the **store prep
   performance report**; a variance beyond a larger threshold additionally
   notifies the Store Manager for review.

**End state.** Run recorded; variance surfaced, not suppressed.

---

## Flow 4 — Central Store daily count: Attendant counts blind

Implements: §3 Stage 9 (Central Store split); §4 (Signing).

**Trigger.** The daily Central Store count is due (once per day, part of the
store's closing rhythm).

**Primary actor.** Store Attendant, hub org.

**Preconditions.** No open unsubmitted count for today.

**Steps.**
1. Attendant opens **Daily Count**. The system creates a count covering every
   Central Store item (or the configured count scope).
2. For each item the Attendant enters the **counted quantity** in the item's
   usage unit. **The expected quantity is never shown** — not in the field, not
   as a hint, not retrievable. This is **enforced server-side**: the count API
   does not return expected figures to a `STORE_ATTENDANT` (§3 Stage 9). A
   rushed attendant cannot "confirm the number" because there is no number to
   confirm.
3. Attendant taps **Sign**, enters **PIN**. Name renders on the count sheet.
4. On submit, the count goes to the Store Manager's **Counts to verify** queue.
   **No `adjustment` ledger entries are written yet** — the count is an
   observation awaiting adjudication (§3 Stage 9).

**Decision branches.**
- Attendant can save a **partial count** and resume later; it only leaves draft
  on Sign + submit.

**Error / edge paths.**
- **Item physically missing / can't be found** → Attendant enters `0` and adds a
  line note. It becomes a variance the Store Manager adjudicates.
- **PIN wrong** → not submitted; stays draft.
- **Offline** → held as a draft; submits on reconnect.
- **Attendant tries to view expected via the API / another screen** → returns no
  expected data for this role (server-enforced).

**End state.**
- A signed, submitted count with counted quantities only.
- Store Manager notified: a count is waiting to be verified.
- Stock on hand unchanged (no adjustments yet).

---

## Flow 5 — Central Store count verification: Store Manager verifies

Implements: §3 Stage 9; §4 (Signing); §6 (count won't reconcile); Flow 20.

**Trigger.** A submitted daily count is in the Store Manager's verify queue.

**Primary actor.** Store Manager, hub org.

**Preconditions.** A count with status `Submitted — awaiting verification`.

**Steps.**
1. Store Manager opens the count. **Expected quantities are shown** alongside the
   Attendant's counted quantities, with the **variance** per line (qty and
   value). The Store Manager sees expected because they are **adjudicating a
   variance, not producing an observation** (§3 Stage 9).
2. Store Manager reviews each variance line. Per line they can:
   - **Accept** the counted figure → an `adjustment` `InventoryTransaction` will
     be written at the Central Store for (counted − expected), carrying a
     **reason** (required when the variance exceeds the reason-threshold; §6).
   - **Query** the line → send the whole count **back** to the Attendant with a
     note (Flow 4 re-opens for that Attendant).
3. Once satisfied, Store Manager taps **Approve**, then **Sign** + **PIN**.
4. On approval, the system writes an `adjustment` entry per accepted variance
   line at the Central Store location, each with its reason, timestamped, and
   attributed to the Store Manager (the adjudicator) with the Attendant recorded
   as the counter.
5. Any variance beyond the **Director threshold** triggers a discrepancy alert
   (Flow 20) to the Director.
6. **Print** offered (optional) — the verified count sheet with both signatures.

**Decision branches.**
- **Return to Attendant** → no ledger entries; the count re-opens; the cycle
  repeats.
- **Approve with zero variance** → count approved, no `adjustment` entries
  written, day-count marked done.

**Error / edge paths.**
- **Reason missing on an above-threshold line** → Approve is blocked until a
  reason is entered (§6 — never silently absorbed).
- **Negative resulting stock** → allowed and flagged (Flow 21); approval still
  proceeds.
- **PIN wrong** → not approved; stays in verify state.

**End state.**
- `adjustment` ledger entries at the Central Store for accepted variances, each
  with a reason.
- Count status `Verified`; both counter and verifier recorded.
- Director notified if any variance breached the threshold.
- Central Store stock on hand now matches the verified count.

### Flow 5a — Store Manager ad-hoc spot count

Implements: §3 Stage 9 (spot count).

**Trigger.** A number looks wrong outside the daily rhythm.

**Primary actor.** Store Manager, hub org.

1. Store Manager opens **Spot Count**, picks a handful of items.
2. Enters counted quantities. Expected **is shown** (the Store Manager owns the
   store's stock and is adjudicating directly).
3. Signs + PIN.
4. `adjustment` entries written at the Central Store for each corrected item,
   reason required. Above-threshold variance → Director alert (Flow 20).

**End state.** Targeted `adjustment` entries; spot count recorded separately
from the daily count so it doesn't distort the daily-count rhythm reporting.

---

## Flow 6 — Central Store waste logging

Implements: §3 Stage 8 (waste), §6 (damage discovered later).

**Trigger.** Stock at the Central Store is spoiled, expired, damaged after
receipt, or otherwise unusable.

**Primary actor.** Store Attendant or Store Manager, hub org.

**Steps.**
1. Actor opens **Log Waste**, picks item(s), enters quantity and a **reason**
   (spoilage, expiry, damage-in-store, prep error, …). Reason is mandatory.
2. Actor saves. Per line the system writes a `waste` `InventoryTransaction` at
   the Central Store location, costed at the item's current cost in force now
   (§4).
3. Waste value rolls into the store's waste report (Store Manager, Accountant,
   Director).

**Decision branches.**
- Damage found that was actually a supplier fault → the Attendant may still log
  waste and additionally note it against the originating receipt as a supplier
  claim (Flow 17a). Returns to supplier are out of scope for v1; handled as a
  credit note (§6).

**Error / edge paths.**
- **Stock goes negative** → allowed, flagged (Flow 21).
- **Offline** → held as a draft, posts on reconnect.

**End state.** `waste` ledger entries at the Central Store; stock down; waste
value reported. No signature required (waste is not on the signed-documents list
in §4), but who/when is recorded on every ledger row.

---

# Branch (department heads + branch manager)

## Flow 7 — Requisition: department head fills their section

Implements: §3 Stage 4; §4 (par levels, department-scoped items); §5.

**Trigger.** A **requisition** opens for the branch (typically morning /
afternoon / evening, matching the paper sheets — but a requisition is raised whenever
stock is needed; the count is not fixed — §3 Stage 4). A requisition is opened by the
branch manager or by any department head; opening it creates the branch
requisition document with five empty department **sections**.

**Primary actor.** Department Head, branch org — one of Kitchen, Pastry, Barista,
Service, Housekeeping. Each department has its **own** head (§2).

**Preconditions.**
- The department head is assigned to that department on the branch org.
- The department has catalog items scoped to it (Flow 18).

**Steps.**
1. Department head opens the **open requisition** for their branch and sees **only
   their department's section** and **only their department's slice of the
   catalog** — "Barista never sees chicken, Kitchen never sees coffee beans"
   (§3 Stage 4). Items are **prepped** and **stocked** only; **no raw
   ingredients** — enforced at the data level (§4).
2. Each line shows: item, current on-hand (derived from that department's
   ledger), par level, and a **pre-suggested quantity = par − on-hand**,
   floored at zero (§3 Stage 4). The pre-suggestion mirrors the paper sheet's
   "Requisition" column, which today is filled from opening stock vs. what's
   needed.
3. Department head edits quantities freely, adds items from their slice, removes
   lines. Target: under 5 minutes (§3 Stage 4).
4. Department head taps **Submit section**.
   - System marks that section `Submitted`. **No signature at section level** —
     the branch manager's single signature covers the requisition (§3 Stage 5).
   - The branch manager gets an **immediate push + in-app notification** that a
     section is in. Every submitted section notifies the manager the same way —
     there is no priority flag; a section submitted is a section submitted.

**Decision branches.**
- **This department isn't ordering for this requisition** → the head simply doesn't submit
  (Flow 7a). A slow or absent department must never block the others (§3 Stage
  4).
- Head submits, then realises a mistake **before** the branch manager approves →
  the head can **recall** their section back to draft, edit, and re-submit.
  After approval, changes are the branch manager's to make (Flow 8a).

**Error / edge paths.**
- **On-hand figure looks wrong** → the head can still requisition against it;
  the discrepancy surfaces at the branch count (Flow 12). Requisitioning is
  never blocked by a bad number (§4, §6).
- **Item the head needs isn't in their slice** → the head requests it be added
  to the department's catalog scope (Flow 18, Store Manager action); meanwhile
  they can add a **free-text note line** on the section describing what they
  need, which the branch manager can convert to a real line at approval (Flow
  8a).
- **Offline** → the section is held locally; submits on reconnect.

**End state.**
- The department's section is `Submitted` (or left in draft / not started).
- Branch manager notified (push + in-app) of each submitted section.
- No stock movement (a requisition is a request, not a transfer).

### Flow 7a — Edge: department submits nothing this requisition

1. A requisition is open; a department head submits no section (busy, absent, nothing
   needed).
2. At approval (Flow 8), the branch manager sees that section as **Not
   submitted**.
3. The branch manager can (a) send the requisition **without** that section —
   that department simply isn't ordering this requisition — or (b) fill the section
   themselves from par − on-hand and include it (Flow 8a), or (c) hold the requisition
   briefly and nudge the head.
4. The requisition proceeds with whatever sections are in (§3 Stage 4).

**End state.** Requisition sent covering only the submitted (and
manager-filled) sections. The skipped department gets nothing dispatched this
requisition.

---

## Flow 8 — Branch manager approval (hard gate)

Implements: §3 Stage 5; §4 (Signing); §5; §7 (approval gate added).

**Trigger.** One or more department sections are `Submitted` on the open requisition,
and the branch manager opens it for approval. **Nothing reaches the Central
Store unapproved** (§3 Stage 5).

**Primary actor.** Branch Manager, branch org.

**Preconditions.** The branch manager is assigned to that branch org.

**Steps.**
1. Branch manager opens the requisition and sees **all five departments'
   sections in one view** (§3 Stage 5), each showing submitted lines, par,
   on-hand, and pre-suggested quantities. Sections not submitted show as **Not
   submitted**.
2. Branch manager reviews. Per line, in **any** section, they can:
   - **change a quantity**,
   - **delete a line**,
   - **add a line the department head never asked for** (§3 Stage 5).
   Each such change is tracked with before/after (Flow 8a).
3. Branch manager taps **Approve & sign**, enters **PIN**. Their name renders on
   the requisition in the signature font. **One signature covers the whole
   requisition** (§3 Stage 5).
4. On approval:
   - The requisition status becomes `Approved` and it appears in the **Central
     Store dispatch queue** as **one card per branch**, still itemised by
     department (§3 Stage 6).
   - For every line the branch manager **modified, added, or deleted**, the
     **affected department head is notified**, with a diff showing exactly what
     changed (§3 Stage 5).
   - The requisition closes to further section edits.
5. **Print** offered (optional) — the signed requisition for the branch's file
   (mirrors the paper sheet's "Checked By" line).

**Decision branches.**
- **Some sections not submitted** → Flow 7a options apply; the manager can fill
  or omit them before signing.
- **Manager wants a department to redo its section** → the manager can bounce a
  section back to its head instead of editing it, with a note; the requisition stays
  open for that section only.

**Error / edge paths.**
- **Manager off-shift at 6am** → Flow 8b.
- **PIN wrong** → not approved; requisition stays at `Pending approval`; the
  manager retries.
- **Offline** → the manager can review but Approve & sign only completes on
  reconnect; until then the requisition is not in the store's queue.

**End state.**
- Requisition `Approved` and signed, visible in the Central Store dispatch
  queue, itemised by department.
- Affected department heads notified of any changes to their lines.
- No stock movement yet (dispatch is Flow 9).

### Flow 8a — Edge: manager edits / deletes / adds a line

Implements: §3 Stage 5 (notify affected head).

1. In the approval view the branch manager changes a quantity / deletes a line /
   adds a line in some department's section.
2. Each edit is recorded on the requisition line as `requested` (department
   head's figure or "not requested") vs. `approved` (manager's figure), with the
   manager and timestamp.
3. On **Approve & sign**, every affected department head receives a
   notification: "Your Kitchen requisition was changed — Beef patty 20 → 14;
   added: Cooking oil 2 L". The head cannot re-open it (it's approved) but sees
   what's coming.

**End state.** Approved requisition carries a visible edit trail; affected heads
informed.

### Flow 8b — Edge: manager off-shift when sections come in (hard-gate wait)

Implements: §3 Stage 5 (the 6am problem); §8 C1.

1. Sections are submitted before the branch manager is available.
2. The requisition sits at `Pending approval`. **It does not auto-approve on a
   timer** — the gate is hard (§3 Stage 5). There is **no fallback approver** and
   **no Director escalation** — it simply waits for the branch manager.
3. Because the branch manager approves **from anywhere, on their phone** (§8 C1),
   being off-site is not itself a blocker — they open the app and sign. The
   submit-time notification (Flow 7) is what reaches them wherever they are.
4. When the manager signs, Flow 8 completes normally.

**End state.** Requisition approved late but still by signature — never
auto-approved, never approved by anyone else. Watched over the first week of use
(§8 C1).

---

## Flow 9 — Fulfilment & dispatch (Central Store)

Implements: §3 Stage 6; §4 (Signing, costing); §5; §6 (short dispatch,
substitution); §7 (one requisition → five dispatches).

**Trigger.** An `Approved` requisition is in the Central Store dispatch queue.

**Primary actor.** Store Attendant (picks and packs) and/or Store Manager
(confirms and signs), hub org. Dispatch is a **signed** document — the store
signs (§4).

**Preconditions.** Requisition status `Approved`.

**Steps.**
1. The dispatch queue shows **one card per branch**, oldest first, expandable
   into its five department sections (§3 Stage 6).
2. The store opens a branch's requisition. Per line it shows **requested vs.
   available on hand** (Central Store derived stock) and an input for the
   **dispatched quantity**, pre-filled with `min(requested, available)`.
3. The store enters the actual dispatched quantity per line. **Partial
   fulfilment is normal and expected** — "they dispatch whatever they can" (§3
   Stage 6). `requested − dispatched` is the **shortfall**.
4. The system groups the lines **by department** into **one dispatch per
   department** (§3 Stage 6). The store confirms each department's dispatch.
5. On **Confirm** for a department, the store user taps **Sign** + **PIN**; the
   store's name renders on that department's dispatch / delivery note.
6. On signing, for each line the system writes a `dispatch_out`
   `InventoryTransaction` at the **Central Store location**, quantity =
   dispatched qty, **cost = the item's current cost in force now** — this cost
   **travels with the line** and is frozen for this dispatch forever, even if
   the item's price changes later (§4).
7. Each department's dispatch enters status **In Transit**. Stock leaves the
   Central Store ledger now; it does **not** arrive at the branch until the
   department head confirms (Flow 10) — until then it is "in transit and still
   the store's stock" conceptually, but the Central Store `dispatch_out` has
   reduced Central Store on-hand and the branch has no `dispatch_in` yet (§3
   Stage 7).
8. A **delivery note prints** per department for the driver to carry (optional —
   nothing blocks if there's no printer; the driver can also carry a written
   note, and the department confirms on-screen regardless) (§3 Stage 6, §4).
9. One physical run carries all five delivery notes; each is its own document
   (§3 Stage 6, §5).

**Decision branches.**
- **Store has less than requested** → Flow 9a (this is the normal path, not an
  error).
- **Store substitutes a different item** → Flow 9b.
- **A department's section had nothing approved** → no dispatch is created for
  that department this requisition.
- **Store can't fulfil anything for a branch right now** → the requisition stays
  in the queue; the store dispatches later. The queue is **oldest-first** — there
  is no priority flag.

**Error / edge paths.**
- **Available on hand is negative** → allowed; the store can still dispatch; the
  Central Store goes further negative and is flagged (Flow 21).
- **PIN wrong** → that department's dispatch stays unconfirmed; others can still
  be confirmed independently.
- **Offline** → dispatch confirmed locally; `dispatch_out` posts and status
  flips to In Transit on reconnect; delivery note can still print from the local
  draft.

**End state.**
- `dispatch_out` ledger entries at the Central Store; Central Store on-hand
  down; per-line cost frozen.
- Up to five dispatches, each **In Transit**, each signed by the store, each
  with a (printable) delivery note.
- `requested − dispatched` recorded per line as shortfall for the
  chronically-undersupplied report (§3 Stage 6).
- Branch department heads notified: an incoming dispatch is on the way.

### Flow 9a — Edge: short dispatch

Implements: §6 (short dispatch).

1. Requested 30, available 18. The dispatched-qty field pre-fills 18.
2. The store confirms at 18 (or less). No error, no override needed (§6).
3. `dispatch_out` for 18; shortfall = 12 recorded on the line.
4. The branch department head sees requested 30 / dispatched 18 when they
   receive (Flow 10) and confirms against the 18 (or whatever arrived).

**End state.** Partial dispatch In Transit; shortfall logged and reported. No
alert (short dispatch is expected) — distinct from a **transit** discrepancy
(Flow 10a), which does alert.

### Flow 9b — Edge: substitution (store sends a different item)

Implements: §6 (substitution).

1. The store cannot fill *Beef patty* and sends *Beef mince portion* instead.
2. On the dispatch, the store **adds a line** for the substitute item (not on
   the requisition) and **sets the requested line's dispatched qty to zero**
   (§6).
3. `dispatch_out` is written for the substitute line at its own current cost;
   the original line dispatches zero (shortfall = full requested qty, annotated
   "substituted").
4. The delivery note and the branch receiving screen (Flow 10) show **both**
   lines — the zeroed original and the added substitute — so the department head
   confirms what actually arrived.

**End state.** Substitute item In Transit to the department; original line
recorded as a full shortfall with a substitution note.

---

## Flow 10 — Branch receiving: department head confirms their own lines

Implements: §3 Stage 7; §4 (Signing, costing); §5; §6 (transit discrepancy).

**Trigger.** A dispatch for the department is **In Transit** (driver en route or
arrived). The physical hand-off may be to anyone at the branch (§3 Stage 7).

**Primary actor.** Department Head, branch org — **each** department head
separately, on their **phone** (§3 Stage 7). Stock is not a department's until
its own head confirms it.

**Preconditions.** The department has an In-Transit dispatch.

**Steps.**
1. Department head opens **their** incoming dispatch on their phone. Lines show
   the **dispatched quantity, pre-filled** (§3 Stage 7), plus the requested
   quantity for reference, plus any substitution lines (Flow 9b).
2. Department head confirms or **corrects each line to what actually arrived**.
3. Department head taps **Sign** + **PIN**; their name renders on the branch
   receipt confirmation (§4).
4. On signing, for each line the system writes a `dispatch_in`
   `InventoryTransaction` at **that department's location on the branch org**,
   quantity = **confirmed** quantity, **cost = the frozen per-line cost carried
   from the dispatch** (§4). The write is under the **receiving branch's org**,
   by the receiving department head (D-15 / two-org pattern — §4 Tenancy).
5. If the **confirmed quantity differs from the dispatched quantity**, the
   system automatically raises a **transit discrepancy** (Flow 10a → Flow 20):
   notified to **Store Manager, Branch Manager, Directors**; the dispatch stays
   **open** until the Store Manager resolves it (§6, Flow 11).
6. If confirmed = dispatched for **all** the department's lines, this
   department's portion is `Confirmed`.
7. **The whole dispatch closes only when *all* its departments have confirmed**
   (§3 Stage 7). Until then unconfirmed departments' goods remain the store's
   stock (no `dispatch_in` written for them).
8. **Print** offered (optional) — the signed department receipt.

**Decision branches.**
- **Confirmed = dispatched** → clean close for that department; no alert.
- **Confirmed ≠ dispatched** → Flow 10a (transit discrepancy).
- **Substitution present** → the head confirms the substitute line's actual
  arrival and the zeroed original; a substitute that also arrived short is a
  transit discrepancy on the substitute line.
- **Department head not available** → anyone physically receives the goods, but
  **only the department head's signed confirmation writes `dispatch_in`**. Until
  then the goods sit unconfirmed = still the store's stock (§3 Stage 7).

**Error / edge paths.**
- **Department never confirms by end of day** → Flow 10b.
- **PIN wrong** → not confirmed; no `dispatch_in`; retry.
- **Offline** → confirmation held locally; `dispatch_in` posts and any
  discrepancy raises on reconnect.
- **Over-arrival** (confirmed > dispatched) → still a transit discrepancy;
  department confirms the actual higher number; Store Manager resolves (Flow
  11) — e.g. the store under-recorded the dispatch.

**End state.**
- `dispatch_in` at the department's location for each confirmed line, at the
  frozen carried cost; department stock up.
- Department portion `Confirmed`; dispatch `Closed` iff all departments
  confirmed.
- Transit discrepancy raised + alert fan-out (Flow 20) if any line differs;
  dispatch stays open pending Flow 11.

### Flow 10a — Edge: transit discrepancy (dispatched 20, arrived 18)

Implements: §6 (transit discrepancy).

1. Department head confirms **18** against a dispatched **20**.
2. `dispatch_in` writes **18** into the department. The 2-unit gap is **not**
   silently written off and is **not** auto-attributed to anyone (§6).
3. The system raises a **transit discrepancy** on that line and fans out an alert
   (Flow 20) to **Store Manager, Branch Manager, Directors**.
4. The dispatch stays **open** (even if every department has "confirmed") until
   the **Store Manager resolves** it (Flow 11).

**End state.** Department has the actual 18; a discrepancy is open against the
Store Manager; three roles alerted.

### Flow 10b — Edge: department never confirms a dispatch

Implements: §6 (department never confirms).

1. A dispatch is In Transit; by branch end-of-day one or more departments have
   not confirmed.
2. The system flags the unconfirmed dispatch(es) to the **branch manager** at
   day-close (Flow 12).
3. **This blocks that department's day-close** until resolved (§6): the branch
   manager either gets the head to confirm, or (as branch manager) confirms on
   the head's behalf with a note — which still writes `dispatch_in` and records
   who actually signed.
4. Unconfirmed-by-EOD dispatches also appear on the Store Manager's open-dispatch
   list.

**End state.** Day-close is held for that department until the dispatch is
confirmed (or manager-confirmed). Nothing auto-writes `dispatch_in` on a timer.

---

## Flow 11 — Transit / receiving discrepancy resolution (Store Manager)

Implements: §6 (discrepancy resolution).

**Trigger.** A transit discrepancy is open (from Flow 10a / over-arrival /
substitution-short).

**Primary actor.** Store Manager, hub org.

**Preconditions.** An open dispatch with a discrepancy line.

**Steps.**
1. Store Manager opens the discrepancy. It shows: dispatched qty, confirmed qty,
   gap (qty + value at the frozen line cost), which department / branch, who
   confirmed, when.
2. Store Manager records an **outcome**, one of:
   - **Found & re-delivered** — the missing goods are located and sent; this
     spawns a small follow-up dispatch (a new `dispatch_out` → `dispatch_in`
     cycle for the shortfall) which the department confirms (Flow 10).
   - **Transit loss — write off** — the gap is booked as an `adjustment`
     `InventoryTransaction` at the **Central Store location** (the goods left
     the store and never arrived), reason "transit loss", value at the frozen
     line cost. No one is auto-blamed (§6).
   - **Miscount corrected** — the department re-counts and the confirmed figure
     is amended; `dispatch_in` is adjusted via an `adjustment` at the
     **department location** to the corrected quantity, reason "receiving
     miscount".
3. Store Manager taps **Sign** + **PIN** — the resolution is signed (§6).
4. The dispatch closes once the discrepancy is resolved **and** all departments
   have confirmed.
5. Directors and the Branch Manager are notified of the resolution outcome
   (closing the loop opened by Flow 20).

**Decision branches.** The three outcomes above; each writes a different ledger
entry (or a new dispatch cycle).

**Error / edge paths.**
- **Store Manager and Branch Manager disagree** → the discrepancy stays open;
  the Director (already alerted) adjudicates. The system does not force a
  resolution.
- **PIN wrong** → resolution not recorded; discrepancy stays open.

**End state.**
- Discrepancy `Resolved` with a signed outcome and a corresponding ledger entry
  (adjustment at store, adjustment at department, or a follow-up dispatch).
- Dispatch `Closed` if nothing else is outstanding.
- Branch Manager + Directors notified of the outcome.

---

## Flow 12 — Branch end-of-day count & close (branch manager)

Implements: §3 Stage 9; §4 (Signing); §5 (aggregate, per-department breakdown);
§6 (count won't reconcile); Flow 20.

**Trigger.** End of the branch's trading day; the branch manager runs the count
across all five departments (§3 Stage 9). Mirrors the paper "Closing Stock"
column on each department's daily sheet.

**Primary actor.** Branch Manager, branch org.

**Preconditions.**
- The branch day is `Open`.
- No dispatch for the branch is unconfirmed **for a department the manager is
  about to close** (Flow 10b) — unconfirmed dispatches block that department's
  close.

**Steps.**
1. Branch manager opens **Day Close**. The screen lists **all five departments**,
   each expandable, every figure **broken down by department** — never a
   branch-only total (§5).
2. Per department, per item, the system shows **expected** on-hand (derived:
   opening + `dispatch_in` − waste ± adjustments) and an input for the
   **counted** quantity. The branch manager (or the department head assisting)
   enters counts.
3. For each gap the branch manager enters a **reason** (mandatory when the gap
   exceeds the reason-threshold; §6). The gap will post as an `adjustment`
   `InventoryTransaction` at that **department's location**.
4. Branch manager taps **Sign** + **PIN** — signs the count for the whole branch
   (§3 Stage 9).
5. Branch manager taps **Close day**.
6. On close:
   - An `adjustment` entry is written per gap line at the department location,
     each with its reason, attributed to the branch manager.
   - Each department's **closing count becomes tomorrow's opening count**
     automatically (§3 Stage 9; Flow 12c).
   - The branch day status becomes `Closed` — a **soft checkpoint, reopenable**,
     not a lock (§3 Stage 9).
   - Any gap beyond the **Director threshold** fans out a discrepancy alert
     (Flow 20) to the Director (§6).
7. **Print** offered (optional) — the signed branch count sheet, per department.

**Decision branches.**
- **A department has an unconfirmed dispatch** → that department cannot be
  closed; Flow 10b resolves it first. Other departments can still close.
- **Count reconciles exactly** → close proceeds, no `adjustment` entries for
  that department.
- **Gap won't reconcile even after recount** → Flow 12a.

**Error / edge paths.**
- **Reason missing on an above-threshold gap** → Close is blocked until entered
  (§6 — never silently absorbed).
- **Negative resulting stock** → allowed and flagged (Flow 21); close proceeds.
- **PIN wrong** → not signed, not closed; day stays Open.
- **Offline** → counts held locally; adjustments and the `Closed` status apply
  on reconnect.
- **Manager forgets to close** → the day stays Open; tomorrow's opening cannot
  auto-populate from a close that never happened; the branch dashboard flags
  "Yesterday not closed" and the Director sees it.

**End state.**
- `adjustment` ledger entries per department for counted gaps, each with a
  reason.
- Branch day `Closed` (soft); tomorrow's opening pre-filled from tonight's
  close per department.
- Director notified of any above-threshold gap.
- Aggregate close position available to the branch manager and Director, always
  broken down by department (§5).

### Flow 12a — Edge: count won't reconcile

Implements: §6 (count doesn't reconcile).

1. After a recount, a department's figure still doesn't match expected.
2. The branch manager enters the counted figure and a **mandatory reason**
   ("unexplained — investigating", "suspected wastage not logged", etc.).
3. The gap posts as an `adjustment` with that reason — **never silently
   absorbed** (§6).
4. If the gap is beyond the Director threshold, Flow 20 fires to the Director.
5. The day can still close (service is not held hostage to a bookkeeping gap —
   §4, §6); the open question is tracked in the variance report.

**End state.** Day closed with an explicit, reasoned `adjustment`; Director
alerted if material; the unresolved question visible in reporting.

### Flow 12b — Reopen a closed day

Implements: §3 Stage 9 (soft checkpoint, reopenable).

**Primary actor.** Branch Manager, branch org; or Director, company-wide (§2 —
"can reopen a closed day").

1. Actor opens a `Closed` branch day and taps **Reopen**, entering a **reason**.
2. The reopen is recorded — **who, when, why** — immutably. A branch that is
   reopened frequently is visible on the Director's report (§3 Stage 9).
3. The day returns to `Open`; counts can be edited. Re-closing re-runs Flow 12
   step 6 (adjustments are recomputed against the new counts; superseded
   adjustments are reversed with linked entries, keeping the ledger
   append-only).
4. Tomorrow's opening (if already populated) is recomputed from the new close.

**End state.** Day `Open` again; a permanent reopen record exists; downstream
opening figures recomputed on re-close.

### Flow 12c — Next-morning opening & overnight variance

Implements: §3 Stage 9 (closing → opening; overnight variance).

1. Next morning, each department's **opening count is pre-filled** from last
   night's close (§3 Stage 9) — not blank.
2. The department head **may recount** and change the opening figure (§3 Stage
   9).
3. If the morning figure **differs from last night's close**, the system flags
   an **overnight variance** on that item (dot + label) and records it; a
   material overnight variance is included in the branch's variance report and,
   above threshold, alerts the Branch Manager (§3 Stage 9).
4. The accepted morning figure becomes the day's opening; the difference (if
   any) posts as an `adjustment` at the department location with reason
   "overnight variance".

**End state.** Day opens with a department-head-verified opening; any overnight
gap is explicit and reasoned, not hidden.

---

## Flow 13 — Branch department waste logging

Implements: §3 Stage 8 (waste), §2 (department head logs their department's
waste).

**Trigger.** Stock in a department is spoiled, dropped, over-portioned, expired.

**Primary actor.** Department Head, branch org — for **their own** department
only.

**Steps.**
1. Department head opens **Log Waste**, sees **only their department's** items,
   enters item(s), quantity, and a **mandatory reason**.
2. On save, a `waste` `InventoryTransaction` is written at **that department's
   location**, costed at the item's cost carried into the department (the frozen
   dispatch cost / latest cost per §4).
3. Waste value rolls into the branch waste report (Branch Manager, Director) and
   the company waste report (Director, Accountant).

**Error / edge paths.**
- **Stock goes negative** → allowed, flagged (Flow 21).
- **Offline** → held locally, posts on reconnect.

**End state.** `waste` ledger entry at the department; department stock down;
waste reported. No signature (not on the §4 signed-documents list); who/when
recorded on the row.

---

# Supplier payment & AP (Store Manager + Accountant)

## Flow 14 — Record a supplier invoice against a receipt

Implements: §3 Stage 2 & Stage 10; §2 (Accountant boundary); §6 (over-delivery).

**Trigger.** A goods receipt with payment terms *Invoice to follow* is
`Received — invoice pending` (from Flow 2a), and the paper invoice is in hand.

**Primary actor.** Store Manager, hub org. **Store Attendants have zero access
to Supplier AP — not even read-only** (§3 Stage 10, §2).

**Preconditions.** A `Received — invoice pending` receipt exists for the
supplier.

**Steps.**
1. Store Manager opens **Invoices to record** and picks the receipt.
2. The system shows the receipt lines and their recorded total (the "truth" —
   §6).
3. Store Manager enters the **invoice number**, **invoice date**, and **amount
   billed** as stated on the supplier's document.
4. If **amount billed ≠ receipt total**, the system shows a **receipt / invoice
   mismatch** (dot + label, warning) with the difference. The Store Manager can:
   - accept and record the invoice at the billed amount (the difference becomes
     a **supplier dispute** tracked on the invoice — Flow 17a), or
   - hold it and query the supplier first.
5. Store Manager saves. A **supplier invoice** record is created with status
   `UNPAID`, linked to the receipt, adding to the supplier's outstanding
   balance (a running tab per supplier — §3 Stage 10).
6. No ledger entry (stock was already moved by the receipt; this is an AP
   record, not a stock movement).

**Decision branches.**
- **Receipt with payment terms = Pay now** → no invoice is recorded here; it was
  marked paid at receipt (Flow 2b). This flow is for *Invoice to follow*
  receipts only.
- **One invoice covers multiple receipts** → the Store Manager can attach
  several `invoice pending` receipts from the same supplier to one invoice
  record; the billed amount is checked against the combined receipt total.

**Error / edge paths.**
- **Duplicate invoice number for the supplier** → blocked with a warning
  (prevents double-recording AP).
- **Receipt already invoiced** → not shown in the queue; if reached by link, the
  action is disabled.

**End state.**
- A `UNPAID` supplier invoice linked to its receipt(s); supplier outstanding
  balance up.
- Any billed-vs-received mismatch flagged for reconciliation (Flow 17a).
- Appears on the aging report (Flow 16).

---

## Flow 15 — Record a supplier payment (partial supported)

Implements: §3 Stage 10; §2 (shared Store Manager / Accountant).

**Trigger.** A payment is made to a supplier — cash on the spot, or a bank
settlement days/weeks later.

**Primary actor.** **Store Manager** (cash paid on the spot) **or Accountant**
(bank settlement of on-account suppliers) (§3 Stage 10). Both post the same kind of
payment record.

**Preconditions.** At least one `UNPAID` or `PARTIALLY_PAID` invoice for the
supplier.

**Steps.**
1. Actor opens the supplier's AP view, sees outstanding invoices oldest-first
   with amounts outstanding.
2. Actor taps **Record payment**: amount, date, method (cash / bank / M-Pesa),
   reference. They allocate the payment across one or more invoices (default:
   oldest-first) — **partial payments are supported** (§3 Stage 10).
3. Actor saves. Per allocated invoice the system recomputes status from total
   payments recorded:
   - payments = 0 → `UNPAID`
   - 0 < payments < billed → `PARTIALLY_PAID`
   - payments ≥ billed → `PAID`
   (§3 Stage 10).
4. The supplier's outstanding balance and the aging report update.

**Decision branches.**
- **Overpayment** (payment > outstanding) → allowed; the excess sits as a
  supplier credit balance, applied against the next invoice or reconciled by the
  Accountant (Flow 17).
- **Store Manager vs. Accountant** → identical record; the report shows who
  recorded each payment.

**Error / edge paths.**
- **Payment recorded against the wrong invoice** → payments are immutable once
  saved; the actor records a correcting reversal (negative allocation) with a
  reason and re-allocates. Kept append-only for audit (separation of duties —
  §2).
- **Accountant tries to edit a receipt / count / stock** → blocked; the
  Accountant "never changes what the ledger says is on a shelf" (§2).

**End state.**
- A payment record allocated across invoices; invoice statuses recomputed;
  supplier balance down; aging updated.

---

## Flow 16 — Supplier aging report

Implements: §3 Stage 10 (aging report); §2 (Accountant, Director visibility).

**Trigger.** Store Manager, Accountant, or Director opens the aging report.

**Primary actor.** Store Manager or Accountant (transactional context) or
Director (visibility). **Not Store Attendants** (§3 Stage 10).

**Steps.**
1. Actor opens **Supplier Aging**. Per supplier: total invoiced, total paid,
   total outstanding, and each unpaid/partly-paid invoice bucketed by age
   (current / 30 / 60 / 90+ days) (§3 Stage 10).
2. Actor drills into a supplier to see individual invoices, their receipts, and
   payments.
3. Export / print offered (optional).

**Decision branches.** Filter by supplier, age bucket, branch-of-origin (all
receipts originate at the Central Store, so "branch" here means the store),
date range.

**End state.** Read-only view; no state change. This is "our position" for
reconciliation (§6).

---

## Flow 17 — Accountant reconciles a month-end supplier statement

Implements: §3 Stage 10 (reconciliation); §2 (Accountant owns this); §6
(statement disagrees with AP).

**Trigger.** A supplier sends a month-end statement; the Accountant reconciles it
against our AP.

**Primary actor.** Accountant, company-wide.

**Preconditions.** Supplier has recorded invoices and payments in the period.

**Steps.**
1. Accountant opens the supplier's **Reconciliation** view for the period: our
   invoices and payments vs. the statement lines (entered or imported).
2. The system highlights matched lines and unmatched lines on either side.
3. For each genuine difference the Accountant works the cause and records a
   **reconciliation adjustment** on the relevant invoice, with a **mandatory
   reason** (§3 Stage 10, §6) — e.g. "supplier applied KSh 500 credit note for
   damaged goods on receipt GRN-1042" (ties back to Flow 2c).
4. The adjustment changes the invoice's billed / outstanding figure; the aging
   report reflects it. **No stock ledger entry** — the Accountant cannot move
   stock (§2).
5. Accountant marks the statement **Reconciled** for the period, with their name
   recorded.
6. Export / print offered (optional).

**Decision branches.**
- **Statement matches our AP exactly** → mark Reconciled, no adjustments.
- **Statement disputes a specific invoice** → Flow 17a.

**Error / edge paths.**
- **Accountant tries to adjust stock quantities to make money reconcile** →
  impossible by permission (§2 separation of duties). Only the billed/outstanding
  money figure on the invoice is adjustable, always with a reason.

**End state.**
- Invoice figures adjusted where justified, each with a reason and the
  Accountant's name; period marked Reconciled; aging updated.

### Flow 17a — Edge: statement disputes a specific invoice

Implements: §6 (supplier statement disagrees / over-delivery / damaged goods
claim).

1. The statement bills an amount our receipt contradicts (Flow 2e mismatch, or a
   Flow 2c damage claim not credited).
2. The Accountant records the dispute on the invoice: our figure, their figure,
   the reason, and the supporting receipt / claim reference.
3. The invoice shows a **Disputed** marker on the aging report; it still ages
   (it is still outstanding) but is visibly flagged.
4. Resolution: the supplier issues a credit note → the Accountant records it as a
   reconciliation adjustment (Flow 17) reducing the billed amount; or Wendo
   concedes → the dispute is closed at the supplier's figure with a reason.
5. Returns to supplier remain out of scope for v1 — always handled as a credit
   note against the invoice (§6).

**End state.** Invoice `Disputed` then `Reconciled` at an agreed figure with a
reasoned adjustment trail.

---

# Catalog & par levels (supporting)

## Flow 18 — Catalog item maintenance (Store Manager)

Implements: §4 (item types, units, department scoping); §2 (Store Manager owns
catalog); §7 (renames, raw-ingredient enforcement).

**Trigger.** A new item needs to exist, or an existing item's definition
changes.

**Primary actor.** Store Manager, hub org. **Full catalog and supplier control**
(§2). Attendants and branch roles cannot edit the catalog.

**Steps.**
1. Store Manager opens **Catalog** → **New item** (or edits one).
2. Sets: name, **type** — `raw ingredient` | `prepped item` | `stocked item`
   (§4). "Pass-through" is gone; the third type is **stocked item** (§7).
3. Sets **buy unit**, **usage unit**, and the **conversion** between them, plus
   **pack size** where the supplier prices by pack (§4 Units).
4. Sets **where the item may exist**:
   - `raw ingredient` → **Central Store only**; cannot be added to any
     department's scope (enforced at the data level — §4, §7).
   - `prepped` / `stocked` → Central Store, plus the **department(s)** that may
     requisition it. Each department only ever sees its own slice (§4).
5. Optionally sets a **Central Store par level** (Flow 19 covers department pars).
6. Saves. Existing ledger history is untouched (append-only).

**Decision branches.**
- **Retiring an item** → soft-delete (`deleted_at`) — history preserved; it
  stops appearing in new receipts / requisitions but remains in reports (§
  DATA_MODEL soft-delete principle).
- **A portion that differs by use** (chicken for a burger vs. a platter) →
  **two distinct catalog items** with separate stock (§4).
- **Supplier not in catalog** → create supplier inline: name, contact, and
  **default payment terms** (*Invoice to follow* / *Pay now*).

**Error / edge paths.**
- **Trying to scope a raw ingredient to a department** → blocked with an
  explanatory message (§4, §7).
- **Changing an item's type after it has ledger history** → allowed only in
  ways that don't corrupt history (e.g. `stocked` → `prepped`); type changes
  that would strand department stock are blocked.
- **Duplicate item name** → warned; allowed only with a distinguishing
  qualifier.

**End state.** Catalog reflects the new / changed item; department slices and
requisition pre-suggestions update accordingly.

---

## Flow 19 — Par-level maintenance (owner of the stock)

Implements: §4 (par levels set by the person who owns the stock).

**Trigger.** Demand patterns change; par levels need tuning.

**Primary actor.**
- **Department Head**, branch org — for **their own department's** items.
- **Store Manager**, hub org — for **Central Store** items.
(§4 — "par levels are set by the person who owns the stock".)

**Steps.**
1. Actor opens **Par Levels** for their location (department or store) and sees
   only their own items.
2. Actor sets / edits the par quantity (in usage units) per item.
3. Saves. No ledger impact.

**Effect.**
- Department pars drive the **requisition pre-suggestion** = par − on-hand (Flow
  7) and the **department low-stock signal**.
- Store pars drive the **Central Store low-stock signal** that prompts buying
  (Flow 1).

**Error / edge paths.**
- **A department head tries to set a par on another department's item** →
  blocked (their view is department-scoped).
- **Par set to zero / removed** → allowed; that item simply gets no
  pre-suggestion and no low-stock signal.

**End state.** Par levels updated for the actor's own location only.

---

# Cross-cutting

## Flow 20 — Discrepancy alert fan-out

Implements: §6 (transit discrepancy, count won't reconcile); §3 Stage 9; §8 C3.

**Trigger.** One of:
- a **transit discrepancy** (Flow 10a) — confirmed ≠ dispatched on any line;
- a **count variance** at the Central Store (Flow 5) or a branch (Flow 12/12a)
  **beyond the configured threshold**.

**Behaviour.**
1. **Transit discrepancy** → alert **every time** (they are rare and each one
   matters — §8 C3 default). Recipients: **Store Manager, Branch Manager,
   Directors**. The dispatch stays open until the Store Manager resolves it
   (Flow 11).
2. **Count variance** → alert only when the variance exceeds the **value
   threshold** (small count noise is constant — §8 C3 default). Recipients:
   **Director** (branch count) or **Director** (Central Store count); Branch
   Manager already owns the branch count, Store Manager already owns the store
   count.
3. Every alert is **push + in-app**, links straight to the discrepancy /
   variance, and names the item, location, quantities, and value.
4. Thresholds and the "every transit discrepancy" rule are **configurable** and
   meant to be tuned after a week of real data (§8 C3).

**End state.** The right roles are notified; resolution is tracked by Flow 11
(transit) or the variance report (counts). **No one is auto-blamed** (§6).

---

## Flow 21 — Negative stock handling

Implements: §4 (negative stock allowed, flagged, never blocked); §6.

**Behaviour.** Any operation that would drive a location's derived on-hand for an
item below zero — a dispatch, a prep consume, a waste entry, an adjustment —
**proceeds**. The ledger entry is written as normal.

1. The affected item at that location is **flagged negative** (dot + label,
   error tone) on every stock view — Central Store stock, department stock, the
   branch aggregate, and reports.
2. A negative-stock line is included on the relevant variance report so it gets
   investigated at the next count.
3. Negative stock **never blocks** a requisition, dispatch, prep, waste, count,
   or (once it exists) a sale (§4, §6). "Service beats bookkeeping; a wrong
   number is a reporting problem, not a reason to stop work" (§4).

**End state.** Operation completes; the negative position is visible everywhere
that shows that item until a count / adjustment corrects it.

---

## Appendix A — Ledger entry summary

| Flow | Ledger type | Location | Cost basis |
|---|---|---|---|
| 2 Goods receipt | `receive` | Central Store | entered unit price → becomes item current cost (latest-price) |
| 3 Prep run | `prep_consume` (per input) | Central Store | input's current cost now |
| 3 Prep run | `prep_produce` (output) | Central Store | Σ input cost ÷ actual yield → output current cost |
| 5 / 5a Count verify / spot | `adjustment` | Central Store | current cost now |
| 6 Store waste | `waste` | Central Store | current cost now |
| 9 Dispatch | `dispatch_out` | Central Store | item current cost now — **frozen on the line** |
| 10 Branch receive | `dispatch_in` | Department (branch org) | **frozen cost carried from the dispatch line** |
| 11 Resolution — transit loss | `adjustment` | Central Store | frozen line cost |
| 11 Resolution — miscount | `adjustment` | Department | frozen line cost |
| 12 / 12a Branch day-close count | `adjustment` | Department | cost carried into department |
| 12c Overnight variance | `adjustment` | Department | cost carried into department |
| 13 Department waste | `waste` | Department | cost carried into department |

Stock on hand at any location = Σ(all ledger quantities for that item at that
location). Never a stored counter (§4).

## Appendix B — Signed documents (§4)

| Document | Signed by | Flow | Print action |
|---|---|---|---|
| Goods receipt | Receiver (Attendant or Store Manager) | 2 | optional |
| Requisition approval | Branch Manager (once, whole doc) | 8 | optional |
| Dispatch / delivery note | Store (Attendant or Store Manager), per department | 9 | optional |
| Branch receipt confirmation | Department Head, own lines | 10 | optional |
| Discrepancy resolution | Store Manager | 11 | optional |
| Central Store daily count | Attendant (counter) + Store Manager (verifier) | 4 + 5 | optional |
| Branch day-close count | Branch Manager | 12 | optional |

Not signed (ledger row records who/when): prep runs, waste logs, supplier
invoices, supplier payments, catalog / par edits.

## Appendix C — Notifications summary

| Event | Recipients | Flow |
|---|---|---|
| Requisition section submitted | Branch Manager (push + in-app, every section) | 7 |
| Requisition line changed at approval | Affected Department Head(s) | 8a |
| Requisition approved | Central Store (dispatch queue) | 8 |
| Dispatch In Transit | Receiving Department Head(s) | 9 |
| Transit discrepancy raised | Store Manager, Branch Manager, Directors | 10a / 20 |
| Discrepancy resolved | Branch Manager, Directors | 11 |
| Dispatch unconfirmed at branch EOD | Branch Manager | 10b / 12 |
| Goods receipt awaiting invoice | Store Manager | 2 |
| Central Store count submitted | Store Manager | 4 |
| Count variance above threshold | Director | 5 / 12 / 20 |
| Branch day not closed | Director | 12 |
| Overnight variance above threshold | Branch Manager | 12c |
| Prep yield far off norm (large) | Store Manager | 3a |

---

## Resolved points (owner delegation, 2026-09-09)

The owner delegated these flow-level details to the agent's [REC] judgement on
2026-09-09 ("go with your recommendation as the default; I'll correct against the
visual design"). Each is now settled as stated here and reflected in the flows
above. The Paper visual review per slice remains the real correction point.

1. **Who opens a requisition.** The **branch manager or any department
   head** can open the requisition; opening creates the five-section branch
   requisition document. A requisition is opened when stock is needed (typically
   morning / afternoon / evening — not a fixed count). (Flow 7)
2. **Manager-confirms-on-behalf at branch receiving.** The **branch manager may
   confirm a dispatch on behalf of an absent department head**, with the branch
   manager recorded as the actual signer. This prevents a sick or off-shift head
   freezing the branch day-close. `dispatch_in` still writes at the confirmed
   quantity to the department location. (Flow 10b)
3. **Reopen authority.** A closed branch day may be reopened by the **branch
   manager** or a **Director** — no one else. Every reopen records who / when /
   why, immutably. (Flow 12b)
4. **One invoice ↔ many receipts.** The Store Manager **can bundle several
   `invoice pending` receipts from one supplier under a single supplier-invoice
   record**; the billed amount is checked against the combined receipt total.
   This matches the reference invoices (e.g. Samrat INV05121 lists ~25 lines
   under repeated delivery-note numbers). One receipt → one invoice is also
   allowed. (Flow 14)
5. **Prep runs are immutable after confirm.** No "edit prep run" affordance. A
   confirmed prep run cannot be edited; corrections are made via a spot count
   (Flow 5a) or a waste entry (Flow 6), keeping the ledger append-only. (Flow 3)
6. **Expected-delivery record is kept.** Buying (Flow 1) creates a lightweight
   `Awaiting delivery` record — a "what's coming" tracker, not a PO — that a
   goods receipt can pre-fill from. It is optional: the Store Manager may go
   straight to a goods receipt. No "how they bought it" note is captured. (Flow 1)
7. **Discrepancy alert defaults (launch settings).** Alert on **every transit
   discrepancy** (rare, each matters) → Store Manager, Branch Manager,
   Directors. Alert on **count variances only above a configurable value
   threshold** → Director. Both are configurable and to be tuned after a week of
   real data (§8 C3). (Flow 20)
8. **Substitution needs no branch-manager re-approval.** The store may add an
   un-requisitioned substitute line to a dispatch and zero the original; the
   receiving department head "sees both and confirms what arrived". The branch
   manager is not asked to re-approve. (Flow 9b)
