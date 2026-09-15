# Inventory & Procurement — Feature Description

**Feature:** Inventory & Procurement (Feature 1 of the redo)
**Status:** Step 1 draft — owner review pending
**Date:** 2026-09-09
**See `MILESTONES.md`** for how the 10 Stages below map to build milestones
and current progress.
**Supersedes:** `docs/inventory/INVENTORY_FEATURE_PLAN.md` (all phases), and the
Phase 1 + partial Phase 2 implementation currently deployed but never used.

> **Reading note.** Items marked **[REC]** are the agent's recommendation, made
> under the owner's instruction to exercise judgement rather than ask. They are
> defaults to be vetoed, not settled decisions. Items marked **[OWNER]** were
> decided directly by the owner in the Step 1 session.

---

## 0. Starting position (read first)

The inventory feature is **deployed to production but has never been used** —
not one real delivery, prep run, or count. There is no production inventory data
to preserve.

Consequences, which shape everything below:

1. **This is a clean rebuild, not a migration.** The existing tables are dropped
   and recreated. No row-migration plan is needed at Step 5.
2. **Prior decisions are not binding.** The D-decisions in
   `INVENTORY_FEATURE_PLAN.md` were made against a model the client walkthrough
   has since corrected. Where this document contradicts them, this document
   wins. Contradictions are called out explicitly in §7.
3. **The existing code is disposable.** Phase 1 services/pages and the built-but-
   unsurfaced Phase 2 requisition/dispatch backend are all replaced.

The one prior decision carried forward unchanged is **D-15 (hub-org scoping)** —
that is a fact about the product's tenancy model, not an inventory-flow choice.

---

## 1. Purpose

Wendo runs a **single-funnel Central Store model**: every item the company
consumes enters through one Central Store, is prepped and portioned there, and
is dispatched to branch departments on requisition. This feature covers that
entire chain — buying from suppliers, receiving, prepping, requisitioning,
dispatching, receiving at the branch, counting, and paying suppliers.

The goal is that every shilling of stock is traceable from the supplier invoice
to the department that consumed it, with a documented, signed, printable record
at each hand-off — replacing the daily paper stock sheets the branches keep
today, without making anyone's morning slower.

---

## 2. Actors & responsibilities

| Role | Where | What they do in this feature |
|---|---|---|
| **Store Manager** | Central Store (hub org) | Owns purchasing. Buys from suppliers at any value without approval. Records supplier invoices and payments. Approves stock counts. Fulfils and dispatches requisitions. Resolves delivery discrepancies. Full catalog and supplier control. |
| **Store Attendant** | Central Store (hub org) | The hands. Receives deliveries, logs prep runs, picks and packs dispatches, submits stock counts, logs waste. Sees operational costs (unit costs, invoice prices). **No access to Supplier AP** — what is owed and what is paid is walled off entirely. |
| **Department Head** | Branch, per department | Requisitions for their own department only. Confirms receipt of their own lines. Logs their department's waste. Holds day-to-day accountability for their department's stock. |
| **Branch Manager** | Branch | Approval and verification. Approves/edits every requisition before it reaches the store. Performs the end-of-day stock count across all five departments. Receives discrepancy alerts for their branch. |
| **Director** | Company-wide | **Visibility and exceptions only — approves nothing in the routine path.** [REC] Sees all locations, all stock, all supplier balances, all cost and variance reporting. Receives discrepancy alerts. Can reopen a closed day. |
| **Accountant** | Company-wide | **Owns the money side of procurement, not the stock side.** [REC] Records supplier payments and reconciles supplier statements against AP. Sees all costs, invoices, balances, aging, and stock valuation. Cannot requisition, dispatch, count, adjust stock, or change the catalog. |
| **Delivery driver** | In transit | Physically moves goods from store to branches. **Not a system user** [REC] — they carry a printed delivery note; the system tracks the delivery, not the driver's own login. |

### The Accountant

The `ACCOUNTANT` role already exists in the product and is **transactional, not
read-only** — accountants record payments and settle balances in customer credit,
house accounts, and other income today. This feature keeps them consistent with
that. [REC]

**What the accountant does here:**

1. **Records supplier payments.** Shared with the Store Manager rather than taken
   from them — the manager pays a market supplier in cash on the spot, while the
   accountant settles standing suppliers from the bank. Both post the same kind
   of payment record. [REC]
2. **Reconciles supplier statements.** When a supplier's month-end statement
   disagrees with our AP, the accountant is the one who works the difference and
   records the adjustment, with a reason (§6). [REC]
3. **Owns stock valuation reporting.** Closing stock value per location, cost of
   goods, and **the revaluation effect of latest-price costing** (§4) — the
   figure that would otherwise silently distort month-end. This is the reason
   the accountant needs to be in this feature at all, not just adjacent to it.
   [REC]
4. **Sees all cost data across every location** — supplier prices, price history,
   prep costs, dispatch costs, waste value.

**What the accountant cannot do:** anything that moves stock. No requisitions, no
dispatches, no counts, no adjustments, no catalog or supplier edits. They record
and reconcile money; they never change what the ledger says is on a shelf. [REC]

> **Separation of duties.** The person who records what was paid should not also
> be able to alter what was received — otherwise a payment discrepancy can be
> hidden by editing the stock record behind it. This is the one place in the
> feature where a permission boundary exists for control reasons rather than
> convenience. [REC]

### Department structure

Three branches (expanding to ten). Each branch runs **five departments**:
Kitchen, Pastry, Barista, Service, Housekeeping. Each department is its own
stock-holding location with its own head. **A branch itself holds no stock** —
it is a grouping of its five departments.

**Each of the five departments has its own department head** — Kitchen and Pastry
do not share one. [OWNER] Five heads per branch, one head per department.

---

## 3. The procurement lifecycle

### Stage 1 — Buying (Central Store)

There is **no purchase order.** [OWNER] Wendo does not raise formal POs; the
Store Manager buys by phone, WhatsApp, or by sending the driver to the
supermarket or market with cash. Imposing a PO step would be inventing process
that does not exist.

The Store Manager decides what to buy from low-stock signals and judgement, and
buys at **any value without approval**. [OWNER] Directors see everything
purchased but gate nothing.

All suppliers are handled the same way. The only variable is **payment terms**,
and it is one setting, not a taxonomy: each supplier has a **default payment
terms** value — **Invoice to follow** (meat, dairy, dry goods — billed, paid
later on account) or **Pay now** (supermarket, produce market — the driver buys
and returns with a receipt already paid). The goods receipt carries a
per-receipt toggle that defaults from the supplier's setting, so a normally-
on-account supplier paid in cash for one run is a single toggle, not a new
supplier. Nothing else in the flow differs. [OWNER, 2026-09-09]

### Stage 2 — Receiving at the Central Store

Every item entering the company lands here first. **There is no other inbound
path.** [OWNER]

1. Goods arrive with a supplier invoice or receipt.
2. A **Store Attendant** (or the Manager) creates a **Goods Receipt** and records
   what actually arrived, line by line: item, quantity, unit price. There is
   nothing to "check against" — the receipt *is* the record. [REC]
3. Each line writes a `receive` ledger entry at the Central Store, raising stock
   and setting that item's current cost to the received unit price (§4,
   latest-price costing).
4. The receipt is **signed** by whoever received it (§4, Signing).

The receipt's **payment-terms toggle** (defaulted from the supplier, §Stage 1)
decides what happens next. **Invoice to follow** → the receipt is `Received —
invoice pending` and the Store Manager records the **supplier invoice** against
it (Stage 10). **Pay now** → the receipt is marked paid on the spot and no AP is
created. [REC]

### Stage 3 — Prep (Central Store)

Raw ingredients become the **portions** that branches actually order — deboning,
trimming, weighing, portioning.

**Prep is recorded after the fact, never planned in advance.** [OWNER, carried
from D-12 — this one survives] The attendant does not work from a recipe:

1. Pick the output item being produced (e.g. *Grilled chicken portion*).
2. Record the inputs actually consumed — item + quantity, as many lines as needed.
3. Record the actual yield produced.
4. Confirm.

This writes `prep_consume` per input and `prep_produce` for the output, in one
atomic transaction, and computes the output's unit cost as
*total input cost ÷ actual yield*.

The screen shows a **soft reference** from the rolling average of recent prep
runs for that output ("Typical: ~6 kg chicken → ~22 portions"). It is a nudge —
never a validation, never blocking. [REC]

Yield variance (this run vs. the rolling average) is the store's own performance
signal and is reported, not enforced. [REC]

### Stage 4 — Requisition (branch departments → branch manager)

**One requisition document per branch, per cycle, broken down by department.** [OWNER]
The branch — not the department — is the unit of the document that reaches the
Central Store. Each department fills in its own **section**; the branch manager
reviews the whole thing and sends it as one document.

A branch typically raises three requisitions per day (morning, afternoon, evening),
matching their current paper sheets, but the count is not fixed — a requisition is
raised whenever stock is needed. [REC]

1. A requisition opens for the branch. Each department head fills in **their own
   section only**, seeing only their department's slice of the catalog — Barista
   never sees chicken, Kitchen never sees coffee beans. [REC]
2. Quantities are pre-suggested from par level minus current on-hand, and edited
   freely. Target: under 5 minutes per department. [REC]
3. Departments submit their sections → the requisition goes to the **branch
   manager**.

> **A slow department must never block the others.** [REC] The branch manager can
> send the requisition with only some sections filled in; departments that
> submitted nothing simply are not ordering this requisition. Waiting for all five
> would make the morning hostage to the slowest head.

**One requisition in, five dispatches out.** The document that travels is
per-branch; fulfilment, delivery notes, and confirmation are all per-department
(Stages 6–7), because each department head confirms their own lines.

### Stage 5 — Branch manager approval (a hard gate)

**Nothing reaches the Central Store unapproved.** [OWNER]

The branch manager sees **all five departments' sections in one view** [OWNER]
and can **change a quantity, delete a line, or add a line the department head
never asked for** — in any section. [OWNER] Any modification notifies the
affected department head that their request was changed, showing what changed.
[OWNER]

The manager **signs once** for the whole requisition (§4). It then appears in the
Central Store's queue as a single document, still itemised by department.

> **The 6am problem.** [REC] If the manager is not yet on shift, the requisition
> waits — the gate is hard and does not auto-approve on a timer. To keep this
> from blocking service, a department head may mark a requisition **Urgent**,
> which pushes a notification to the branch manager and, if still unapproved
> after a set period, to the Director. Escalation raises visibility; it never
> bypasses the signature. This is the safest reading of "hard gate," but it is
> the rule most likely to cause real-world friction — worth confirming with the
> client after a week of use.

### Stage 6 — Fulfilment & dispatch (Central Store)

1. Approved requisitions land in the dispatch queue as **one card per branch**,
   expandable into its department sections, oldest first.
2. Per line, the store sees **requested vs. available on hand** and enters the
   **dispatched quantity**. Partial fulfilment is normal and expected, not an
   error. [OWNER: "based on availability, they dispatch whatever they can"]
3. Confirm → `dispatch_out` ledger entries, cost travelling per line. The
   dispatch enters **In Transit**.
4. A **delivery note prints** for the driver to carry.

One branch requisition produces **one dispatch per department** [OWNER, from
per-department confirmation]. They travel together on one physical run, but each
is its own document with its own delivery note, so each department head confirms
only what is theirs.

`requested − dispatched` is the **shortfall**: the signal for which departments
are chronically under-supplied.

### Stage 7 — Receiving at the branch

**Each department head separately confirms their own lines.** [OWNER] Stock is
not a department's until its own head confirms it.

1. The driver delivers; the physical hand-off may be to anyone at the branch.
2. Each department head opens their incoming dispatch on their phone. Dispatched
   quantities are pre-filled.
3. They confirm or correct each line to what actually arrived, and **sign**.
4. `dispatch_in` writes stock into that department at the confirmed quantity.

Until a department confirms, its goods are **still In Transit and still the
store's stock** [REC] — this keeps the ledger honest when Kitchen confirms at
7am and Housekeeping not until 11am.

A dispatch is closed only when **all** its departments have confirmed. Anything
unconfirmed by end of day is flagged to the branch manager. [REC]

### Stage 8 — Consumption

For now, department stock is drawn down by **counting** (Stage 9) and **waste
logging**, not by automatic per-sale deduction.

**Automatic deduction on sale is explicitly deferred** [REC] — see §8 Q1. It
requires a usage recipe per menu item, which does not exist yet and is a large
piece of work in its own right. Until then, a department's count gap is
*consumption + loss blended*.

> **Set this expectation with the client explicitly.** Until deduction exists,
> the system cannot separate "sold" from "stolen." It still delivers daily usage
> per item per department — a number they have never had — but claiming more
> than that would destroy trust in the numbers the first time they check.

### Stage 9 — Counting & closing the day

**The branch manager performs the end-of-day count** across all five
departments. [OWNER]

1. The manager counts each department against what the system expects.
2. Gaps post as `adjustment` entries with a reason.
3. The manager **signs** and **closes the day**.

**A closed day is a soft checkpoint, not a lock.** [OWNER] A manager can reopen
it. Every reopen is recorded — who, when, why — so a frequently-reopened branch
is visible. [REC]

**A department's closing count becomes the next morning's opening count
automatically.** [OWNER] The morning figure is pre-filled, not blank — but the
department head **may recount and change it**, and a morning figure that differs
from last night's close is flagged as an overnight variance. [OWNER]

**At the Central Store, counting is daily and split in two** [OWNER + REC] —
one count, one verification, not two counts:

- The **Store Attendant** counts daily and **blind**. The expected quantity is
  never shown to them — enforced server-side, not merely hidden in the UI. [OWNER]
  If they could see the expected number, a rushed attendant would confirm it
  rather than count.
- The **Store Manager verifies** rather than re-counting: they review the
  submitted count against expected, see every variance, and approve or send it
  back. They see expected because they are adjudicating a variance, not
  producing an observation. [OWNER]

This is deliberately the same shape as the branches — the person closest to the
stock produces the number, their manager verifies it. The Store Manager can also
run an ad-hoc **spot count** on a few items when a number looks wrong; that is
outside the daily rhythm. [REC]

### Stage 10 — Supplier payment

A running tab per supplier — the same model as customer credit, pointed the
other way.

1. The Store Manager records the **supplier invoice** against a goods receipt:
   amount billed, invoice/reference number. Status `UNPAID`.
2. Payments are recorded as they happen, days or weeks later, by **either the
   Store Manager or the Accountant** [REC] — the manager for cash paid on the
   spot, the accountant for bank settlement of standing suppliers. Partial
   payments are supported.
3. Status moves `UNPAID` → `PARTIALLY_PAID` → `PAID` from the payments recorded.
4. An **aging report** per supplier shows total invoiced, paid, outstanding, and
   how long each unpaid invoice has been outstanding.
5. The **Accountant reconciles** supplier month-end statements against this
   position and records any adjustment with a reason.

**Store Attendants have zero access to this** — not even read-only. [REC,
carried from D-2/D-13] **Accountants have full access.** [REC]

---

## 4. Key rules & policies

### Signing

The client explicitly asked to sign things. Concretely: **a person taps "Sign",
enters their PIN, and their name is appended to the document rendered in a
stylised signature font**, on screen and on the printout. [OWNER]

- The PIN is a real re-authentication, not decoration — it is what makes the
  signature an attestation rather than an audit line.
- A signature records **who, what, when**, and is immutable.
- Every signed document is **printable** as a hard copy for their files —
  delivery notes, requisitions, goods receipts, count sheets. **Printing is
  always optional, never a required step** in any flow. [OWNER] Nothing blocks
  waiting for a printer.

**Documents that get signed:** goods receipt, requisition approval (branch
manager), dispatch (store), branch receipt confirmation (department head), stock
count / day close (branch manager). [REC]

### Stock, cost, and units

- **Stock on hand is always derived from the ledger**, never a stored counter.
  Every movement is an append-only `InventoryTransaction` with location, item,
  quantity, cost, user, and timestamp.
- **Costing is latest-price, not weighted average.** [OWNER] When a purchase is
  received, that price becomes the item's current cost and stays in force until
  the next purchase replaces it. Buy at 250, cost is 250; buy again at 280, cost
  is 280 from that moment on. This reverses D-8.
  - **Movements are costed at the cost in force when they happened.** [REC] A
    dispatch that left on Tuesday keeps Tuesday's cost forever, even after
    Thursday's price rise. Without this, a price change would silently rewrite
    the cost of past dispatches and no historical report would ever hold still.
  - **Known trade-off — stock revaluation.** Latest-price costing revalues stock
    already on hand. Holding 40 portions bought at 250 and receiving 10 more at
    280 values all 50 at 280 — a stock-value increase no purchase created.
    Weighted average exists to prevent this. It is accepted here because Wendo's
    stock turns over in days, so the distortion is small and short-lived — but it
    is **the accountant's problem, not the store's**, and the accountant's
    reporting must show it explicitly (§2, Accountant). [REC]
- **Units:** every item has a **buy unit** and a **usage unit** with a conversion
  (buy milk in litres, use in ml; buy a 10 kg box of margarine, use in grams).
  The supplier invoices in the reference photos price by pack, so pack size is
  part of the item definition. [REC, carried from D-7]
- **Negative stock is allowed and flagged, never blocked.** [REC] Service beats
  bookkeeping; a wrong number is a reporting problem, not a reason to stop work.
- **Par levels are set by the person who owns the stock** [OWNER]: the
  **department head** for their own department, the **Store Manager** for the
  Central Store. They drive requisition pre-suggestions and low-stock signals.

### Item types and where they may exist

| Type | Example | May exist at |
|---|---|---|
| **Raw ingredient** | Whole chicken, flour, oil | **Central Store only** |
| **Prepped item** | Grilled chicken portion, beef patty | Central Store → any department |
| **Stocked item** | Milk, coffee beans, sodas, tissue | Central Store → any department |

> **Naming.** The third category was previously called "pass-through" — warehouse
> jargon describing what the *store* does with the item, not what the item *is*,
> and meaningless to a barista. It is now a **stocked item**: something held and
> issued exactly as it was bought. [OWNER]

**Branch departments never hold raw ingredients.** [OWNER, from Q5] The Kitchen
requisitions "20 × grilled chicken portions", never "5 kg chicken". This is
enforced at the data level, not by convention.

**Portions are catalog items in their own right.** [REC] If chicken is portioned
differently for a burger and for a grilled platter, those are two distinct items
with separate stock. This is what makes "the branch never sees raw weight"
actually work.

**Items are department-scoped.** [REC] Every item declares which department(s)
requisition it; each department only ever sees its own slice.

### Tenancy (unchanged)

**D-15 stands.** The Central Store and all `STORE_MANAGER` / `STORE_ATTENDANT`
accounts live on the **hub organization** (`isHub`) — a company-level unit, never
a branch, never a point of sale. Requisitions are owned by the branch org;
dispatches by the hub org with an explicit `toOrganizationId` — the two-org
`StaffTransfer` pattern. Sessions never span orgs. Full rule:
`docs/inventory/CENTRAL_STORE_SCOPING_DESIGN.md`.

---

## 5. Central Store → Branch Departments

Covered inline in Stages 4–7 above, since it is no longer a separate phase but
the core of the feature. The essential shape:

```
  Kitchen    ┐
  Pastry     │
  Barista    ├── sections ──▶  BRANCH MANAGER  ── one approved, signed ──▶  CENTRAL STORE
  Service    │                 (edits any line)      requisition                  │
  Housekeep. ┘                                                                    │
                                                                    fulfil per department
                                                                     (partial is normal)
                                                                                  │
                                                                          [ IN TRANSIT ]
                                                                                  │
                                                              5 dispatches, 1 delivery run
                                                                                  │
  Kitchen ◀─┐                                                                     │
  Pastry  ◀─┤                                                                     │
  Barista ◀─┼── each head confirms + signs their OWN lines ◀──────────────────────┘
  Service ◀─┤
  Housek. ◀─┘
```

**One requisition in, five dispatches out.** The branch is the unit of the
request; the department is the unit of fulfilment, confirmation, and stock.

**One inbound path per department.** A department's stock rises only via a
confirmed dispatch from the Central Store. No market runs, no cross-department
transfers, no cross-branch transfers. [OWNER] This is what makes department
variance clean: there is exactly one way stock can arrive.

**What a branch manager sees:** an aggregate view across all five of their
departments — live stock, every department's requisition sections in one place,
incoming and unconfirmed dispatches, discrepancies, and the branch's daily
open/close position. [OWNER] Aggregate figures are always **broken down by
department** — a branch-level total with no department breakdown is never the
only view offered, because no one acts on a branch-level number. [REC]

A department head sees **only their own department**. Neither sees the store's
purchasing, supplier costs, or other branches. [REC]

---

## 6. Edge cases & exceptions

| Case | Intended handling |
|---|---|
| **Short dispatch** (store has less than requested) | Normal, not an error. Dispatch what's available; `requested − dispatched` is recorded as shortfall and reported. [OWNER] |
| **Transit discrepancy** (dispatched 20, arrived 18) | Department confirms the **actual 18**. The gap automatically raises a discrepancy notified to the **Store Manager, Branch Manager, and Directors**. [OWNER] The dispatch stays open until the Store Manager resolves it. No one is auto-blamed. [REC] |
| **Discrepancy resolution** | Store Manager records an outcome: found and re-delivered, written off as transit loss, or miscount corrected. The resolution is signed. [REC] |
| **Over-delivery from a supplier** | Record what actually arrived. There is no PO to violate. If the invoice disagrees with what was received, the receipt is the truth and the invoice difference is a supplier dispute. [REC] |
| **Price changed since last purchase** | Recorded silently as the new cost; weighted average absorbs it. A **price-change alert** flags any line more than a set % above that item's last price, so the manager notices at the moment of receiving. [REC] |
| **Damaged goods at receiving** | Do not receive them. Record only the good quantity; note the damaged amount on the receipt as a supplier claim. Damaged stock never enters the ledger. [REC] |
| **Damage discovered later** | Log as **waste** with a reason. [REC] |
| **Returns to supplier** | Out of scope for v1. Handle as a credit note against the supplier invoice. [REC] |
| **Returns from a branch to the store** | **Not supported.** [REC, carried from prior scope] A department that over-ordered logs waste or carries the stock. Adding a reverse path doubles the ledger's complexity for a rare event. |
| **Substitution** (store sends a different item) | The store may **add a line** to the dispatch that was not requisitioned, and reduce the requested one to zero. The department sees both and confirms what arrived. [REC] |
| **Count doesn't reconcile** | The gap posts as an `adjustment` with a mandatory reason. It is never silently absorbed. A gap beyond a threshold notifies the Director. [REC] |
| **Negative stock** | Allowed, flagged, reported. Never blocks a requisition, dispatch, or sale. [REC] |
| **Prep yield far off the norm** | Recorded as entered; flagged as yield variance on the store's report. Never blocked. [REC] |
| **Department never confirms a dispatch** | Flagged to the branch manager at end of day; blocks that department's day-close until resolved. [REC] |
| **Requisition never approved** | Stays pending; urgent ones escalate to the Director. Never auto-approves. [REC] |
| **Supplier statement disagrees with our AP** | The aging report is our position. Reconciliation is manual; the manager can adjust an invoice with a reason, recorded. [REC] |

---

## 7. What's changing from today

The live implementation is being **replaced wholesale**. The substantive changes
of *behaviour* — the ones that matter for Step 2:

- **Purchase orders are removed entirely.** Receiving becomes invoice-first via a
  **Goods Receipt**. The built `PurchaseOrder` model, service, and screens go.
  Supplier AP hangs off receipts instead. **[Biggest deletion — check this first]**
- **Direct market purchase is removed** (reverses D-11). No `market_receive`, no
  `MarketPurchase` at branch departments. Market/supermarket buying becomes an
  ordinary Central Store supplier receipt. Single inbound funnel.
- **Branch manager approval is added as a hard gate** on every requisition, with
  full line-level edit rights. Not in the prior model at all.
- **The requisition becomes per-branch, not per-department** — one document with
  five department sections, one manager signature, fanning out to five dispatches.
  The prior model had five independent requisitions.
- **Receipt confirmation becomes per-department**, not per-delivery — five
  confirmations against one physical run.
- **Signing with PIN + stylised name is added**, plus printable hard copies of
  every signed document. Not in the prior model at all.
- **Day open/close is added** — soft-lock, reopenable, with closing counts
  carrying into the next morning's opening.
- **Discrepancy alerting is added**, fanning out to Store Manager, Branch
  Manager, and Directors.
- **The Director role is defined** as visibility + exceptions, gating nothing.
- **The Accountant is brought into the feature** — supplier payments, statement
  reconciliation, and stock valuation, with no ability to move stock. Absent from
  the prior model entirely.
- **Costing changes from weighted average to latest price** (reverses D-8), with
  movements costed at the cost in force at the time.
- **"Pass-through" is renamed "stocked item."**
- **Departments hold prepped and stocked items only** — raw ingredients are
  enforced Central-Store-only.
- **Automatic sale deduction is deferred**, and the "count gap = consumption +
  loss" limitation is stated to the client up front.
- **Central Store counting becomes daily**, with the blind-count/verify split
  made explicit (Attendant counts, Manager verifies — not two counts).
- **eTIMS is ruled out entirely**, not deferred. [OWNER]
- The phased Phase 1 / 2 / 3 split is dropped; this is one feature.

---

## 8. Open questions

All Step 1 questions were resolved by the owner on 2026-09-09. What remains is
listed below — items to confirm with the **client** (not the owner), plus the
judgement calls left standing as defaults.

### To confirm with the client

**C1 — The hard approval gate in practice.**
Resolved in principle: the branch manager approves from anywhere, on their phone,
so being off-site is not a blocker. [OWNER] Still worth watching in the first
week — if approvals routinely lag the 6am requisition, the pressure valve is
urgent-escalation (§3 Stage 5), not auto-approval.

**C2 — Deferred sale deduction must be stated plainly to the client.**
Until deduction exists, a department's count gap is consumption and loss
blended; the system cannot separate sales from theft. Say this before they start
using it, not after they question a number.

**C3 — Discrepancy alert threshold.** (was Q7)
Transit and count gaps notify the Store Manager, Branch Manager, and Directors.
Every gap, or only gaps above a quantity/value? **Default [REC]:** alert on every
transit discrepancy (they are rare and each one matters), but only on count
variances above a value threshold, since small count noise is constant. Tune
after a week of real data.

### Standing defaults (vetoable, not blocking)

- **requisitions are unfixed** — typically three a day, but a branch raises
  one whenever stock is needed. [REC]
- **A slow department never blocks the others** — the manager can send a
  requisition with only some sections filled. [REC]
- **Unconfirmed goods remain the store's stock** until the receiving department
  head confirms. [REC]
- **Returns from branch to store are unsupported** — over-ordered stock is held
  or wasted, not sent back. [REC]
- **Supplier returns** are handled as a credit note against the invoice. [REC]
- **Price-change alerts** fire when a received line exceeds the item's last price
  by a set percentage. [REC]
- **Spot counts** are available to the Store Manager outside the daily rhythm. [REC]

### Closed

- **Automatic deduction on sale** — deferred, confirmed acceptable for v1. [OWNER]
- **Kitchen + Pastry** — separate heads, one per department. [OWNER]
- **Central Store counting** — daily; Attendant counts blind, Store Manager
  verifies. [OWNER]
- **Par levels** — department heads for departments, Store Manager for the
  store. [OWNER]
- **Delivery driver** — not a system user; carries a printed note. [OWNER]
- **Printing** — every document printable, printing always optional. [OWNER]
- **Branch manager aggregate view** — yes, across all five departments, always
  broken down per department. [OWNER]
- **eTIMS / KRA** — **out of scope. No eTIMS feature, no KRA involvement.** [OWNER]
