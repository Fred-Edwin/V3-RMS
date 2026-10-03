# Inventory — decisions in force

Cross-cutting decisions that still apply. Sub-module specific rules live in each sub-module's README. Newer owner decisions replace older ones; superseded ones are listed at the end so nobody revives them.

## Money, cost and units

- **Costing is latest-price**, not weighted average. A received price becomes the item's current cost; movements keep the cost in force when they happened. Stock revaluation is the Accountant's concern and must be shown in valuation reporting.
- Every item has a **buy unit** and a **usage unit** with a conversion; stock is held in the usage unit. Changing pack/unit later needs a summary and a reason; old receipts keep their numbers.
- **Negative stock is allowed and flagged**, never blocked (Flow 21): it proceeds and shows red wherever it appears.
- A **price-change alert** flags a received line more than a set % above the item's last price; the line must be confirmed before signing.
- One purchase = one **purchase file** holding every document. One invoice per order. Anything not supplied on delivery is dropped but stays on record. Advance payments are allowed after approval and applied to the invoice automatically.
- Supplier payment terms: **Pay now** or **Invoice to follow** (+ days), defaulted per supplier, overridable per receipt. Archiving a supplier is blocked while invoices are unpaid; put it on hold instead.
- Changing supplier payment details needs a reason, is logged, and tells the Accountant. No PIN, since no money moves.

## Counting and thresholds

- Central Store: **one count a day, any time**; the sign time fixes what was expected. The Attendant counts blind; the Store Manager verifies (accept/query each line), then approves with PIN. Queried lines come back to the Attendant **only** for those lines, still blind.
- Count reason threshold (Store Manager): default KES 500; above it a reason is required (preset list + "Other (describe)"). Director alert amount: KES 5,000 per difference, set by the Director.
- Branch day: the **Branch Manager** enters department counts; a closed day is a soft checkpoint, reopenable with a reason; the closing count becomes the next morning's opening (Department Head may recount; a difference is an overnight variance). Branch reason threshold defaults to KES 1,000 and `CONSUMPTION` is a reason, because branch gaps blend consumption and loss. Close needs all 5 departments counted, none blocked by an unconfirmed dispatch, and every above-threshold gap explained.
- Automatic stock deduction on sale is **deferred**: until it exists a branch count gap is consumption plus loss blended. Say so to the client.

## Requisition and dispatch (original rules, awaiting their walkthrough)

- One requisition per branch per cycle, with a section per department; Department Heads see only their own department's slice of the catalog.
- **Branch Manager approval is a hard gate** with line-level edit rights (change, delete, add); the affected head is told what changed. A slow department never blocks the others. Urgent escalation raises visibility, never bypasses the signature.
- One requisition in, **one dispatch per department** out; each head confirms and signs only their own lines. Unconfirmed goods remain the store's stock; an unconfirmed dispatch blocks that department's day close.
- Short dispatch is normal. Substitution: the store may add a line and set the requested one to zero.
- Transit discrepancy: the department confirms the actual quantity; the Store Manager resolves with a signed outcome (found and re-delivered / transit loss write-off / miscount corrected). Alerts go to Store Manager, Branch Manager and Directors.
- Departments never hold raw ingredients; one inbound path per department (a confirmed dispatch). No returns from branch to store.
- Category-grouped requisition lines: `Category.parentCategoryId`, one level deep (Kitchen: "Prep Kitchen Items" > Chicken/Beef/Pork/Fish, plus "Market Items", "Dry Items"). Market items are a category, not a separate requisition.
- Prep ticket and order logic elsewhere in the product is unrelated to this feature.

## Catalog and suppliers

- One catalog item is one thing the store counts and issues, under **our name**. Each supplier that sells it has its own **line** (their name, their code, their pack, their price); lines are rows, and one supplier can have several lines with different packs. Items are separate only if no department would use them interchangeably.
- Attendants can add an item directly (no approval); it appears under **Needs setup** for the Store Manager.
- Duplicate items: retire the duplicate and note what replaced it. No merge.
- Supplier-facing documents (LPO, WhatsApp text) show the supplier's name and code first; internal screens show ours first.
- Cheque is a supported payment method (payable to, bank, optional note), and "Cash" is offered when adding a payment method.
- Out of scope: non-stock purchases (paint, equipment, repairs). Counted in the store and issued to a department = stock.
- Restock level suggestion: average daily use over recent days × days of cover; new items show "Needs 14 days of use first". Department Heads change their own levels any time; every change is logged and can be put back.

## Access (owner decision, 3 Oct 2026)

The client has **not** approved the role names or the role-to-screen mapping drawn in Paper, so access is not taken from the design's chapter labels. The rule:

- The **desktop roles** (Store Manager, Accountant, Director, Branch Manager, System Admin) can **read every Central Store screen**. Each has a "Central Store" section in their sidebar.
- **Write belongs to whoever does that job**: Store Manager and System Admin write the catalog, restock levels, suppliers and orders; the **Accountant** writes supplier invoices, payments, payment methods and supplier documents; the **Director** and **Branch Manager** write nothing here. The System Admin reads and writes everything.
- **Supplier payment details** (the Payment tab: bank/M-Pesa/cheque details, "Show" account number, change history) are hidden from the **Branch Manager**. Everything else on a supplier, including what we owe, they can read.
- The **Store Attendant** and **department heads** stay narrow and phone-first: no prices, no suppliers, no audit log. A department head's item list carries no costs.
- **PIN-signed actions** done by the System Admin are signed with the admin's own PIN, so the audit log names them.
- The **audit log** shows everyone who did what; it is read by every desktop role and edited by nobody.
- All of it lives in **one table**, `backend/src/modules/inventory/_shared/central-store-access.ts` (role by capability). Route guards, the page gate and the sidebar read it (the screens through `GET /inventory/permissions/me`). A client change to who can do what is an edit to that table. Screens still on the old flow keep their old role lists until their own rebuild moves them onto it.
- Phone versions for the desktop roles wait until the rest of the inventory feature is built.

## Process and tenancy

- Every signed document is printable; printing is never a required step. Signature = PIN re-authentication, name in the signature font.
- eTIMS/KRA integration: **out of scope**.
- Central Store hub scoping (D-15): see `docs/inventory/CENTRAL_STORE_SCOPING_DESIGN.md`. **Exception (3 Oct 2026):** a role holding `central_store.read_any_org` (Branch Manager, and the other desktop roles) may **read** hub data from outside the hub organization, through one shared guard (`requireHubReader`). Every write still needs the hub organization (`requireHubActor`), except the System Admin, who belongs to no organization and may write to the hub.

## Open owner decisions

| # | Question | Notes |
|---|---|---|
| F1 | `MISCOUNT_CORRECTED` writes the gap at the branch although the note says everything arrived | Recommend a required `correctedQty` and writing `correctedQty − confirmedQty`. Do not demo this outcome until decided |
| F4 | `GET /dispatch/:id/fulfil` returns on-hand to the Store Attendant | Either accept as a documented exception (fulfil screen needs shortages) or send only an "insufficient stock" flag |
| Q1 | Suggested restock level: formula and who sets days of cover per item | Default ~15 days dry goods, ~5 days perishables |
| Q2 | Can an attendant-added item be ordered before the Store Manager finishes setup? | Drawn: usable for receiving, not for ordering |
| Q3 | Supplier document upload limited to Store Manager and Accountant | Confirm |
| Q4 | Retire an item with open orders: existing lines stay, new ones blocked | Confirm |
| Q5 | Prep: run numbers PREP-nnnn on every run; manager's own "New prep run" drawer kept as is; target yield set by manager | Confirm |
| Q6 | Phone "Check the goods" screen shows our item name only | Settle with owner |

## Superseded — do not revive

- Purchase orders do not exist in the original description; the approved Purchasing flow uses an **LPO** raised from need and approved by the Store Manager. The LPO flow wins.
- "Par level" → **Restock level**. "Pass-through" → **Stocked item**. "Round" → **requisition**.
- Damaged goods are sorted at the door; the receipt records only what is kept (2026-09-15). Damage found later is waste.
- Direct market purchase at branches, department-level raw stock, weighted-average costing, and Phase 1/2/3 framing are retired.
