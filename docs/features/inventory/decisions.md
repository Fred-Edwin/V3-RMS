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
- **Branch day (rewritten 7 Oct 2026, full rules in [branch-day-flow.md](branch-day-flow.md)):** each Department Head counts their own department **blind on their phone**; the Branch Manager reviews all five and closes with a PIN. The result is shown as **Used today** (opening + received − waste − closing), a plain figure, not a "gap"; only an unusual figure asks for a reason. **No reopen**: a mistake is fixed with **Correct a count** (one item, reason, PIN, a linked entry) until the next opening is accepted, or by the next morning's opening recount. The closing count is the next morning's opening (pre-filled; any active department member or the Branch Manager accepts or recounts; a difference is an overnight variance; never blocks). Close needs every department counted and no unconfirmed delivery; an open discrepancy does not block. This replaces the old rules (Branch Manager enters counts, reopen with a reason, KES 1,000 reason threshold, `CONSUMPTION` reason).
- Automatic stock deduction on sale is **deferred**: until it exists a branch count gap is consumption plus loss blended. Say so to the client.

## Requisition and dispatch (original rules; the walkthrough is being designed, see [requisitions-flow.md](requisitions-flow.md))

- One requisition per branch per cycle, with a section per department; Department Heads see only their own department's slice of the catalog.
- **Branch Manager approval is a hard gate** with line-level edit rights (change, delete, add); the affected head is told what changed. A slow department never blocks the others. Urgent escalation raises visibility, never bypasses the signature.
- One requisition in, **one dispatch per department** out; each head confirms and signs only their own lines. Unconfirmed goods remain the store's stock; an unconfirmed dispatch blocks that department's day close.
- Short dispatch is normal. Substitution: the store may add a line and set the requested one to zero.
- **Discrepancies (rewritten 7 Oct 2026, full rules in [discrepancies.md](discrepancies.md)):** the branch counts blind (no pre-fill), a mismatch flags and is recounted, the signed gap is held as unaccounted, and the Store Manager records one finding (packed short / lost or damaged on the way / branch counted wrong / can't tell) that moves the stock and records the loss against the right party. No tolerance, no escalation, no "send the rest". Any active member of the receiving department may confirm (Branch Manager as fallback); the dispatch records who packed, signed and carried it. The old "found and re-delivered" outcome and Director adjudication are gone; F1's `correctedQty` rule is superseded with them.
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
- The **Store Attendant** (changed 6 Oct 2026) sees **item costs and prices** and gets desktop screens as well as phone ones. They stay blind to **stock figures** (on-hand, expected stock, restock levels) and **financial data** (what we owe, invoices, payments, supplier balances and payment details, reports): no `payables.*`, no `suppliers.read`, no `suppliers.read_payment_details`, no `restock.read`, no audit log. They hold `catalog.see_costs` and `orders.read`. One helper, `_shared/blind-rule.ts`, applies this to responses. Counting stays blind to expected stock. **Department heads** hold nothing from the table; their item list carries no costs. Item history has its own capability, `catalog.read_history`, because it carries restock settings.
- **PIN-signed actions** done by the System Admin are signed with the admin's own PIN, so the audit log names them.
- The **audit log** shows everyone who did what; it is read by every desktop role and edited by nobody.
- All of it lives in **one table**, `backend/src/modules/inventory/_shared/central-store-access.ts` (role by capability). Route guards, the page gate and the sidebar read it (the screens through `GET /inventory/permissions/me`). A client change to who can do what is an edit to that table. Screens still on the old flow keep their old role lists until their own rebuild moves them onto it.
- Phone versions for the desktop roles wait until the rest of the inventory feature is built.

## One screen set, mock first (owner decisions, 4 Oct 2026)

Applies to every Central Store feature (Purchasing and Receiving, Prep, Stock, Dispatch and the rest). Decided once so no rebuild re-opens it.

- **One screen set per feature.** Each screen is built once. Every desktop role gets the **Central Store** group in its sidebar (collapsible groups with the connector rail, as in the approved Workforce sidebar) and can open every screen. Write buttons appear only for the role that does the job; for everyone else the same screen shows with those buttons **hidden** (not greyed out). Read-only variants are **not** drawn in Paper. Phone-first roles (Store Attendant, department heads) keep their own phone screens as designed.
- **Access is one table.** A rebuild adds its capability rows to `central-store-access.ts` and nothing else; a client change to who can do what is a row edit. Never a new `requireRole(...)` list.
- **Mock first.** A flow the client has not approved gets a front-end built to the approved Paper design on **mock data** first. The owner demos it to the client and each role, feedback is applied to the screens, and only then are the back-end and migrations built and the mock removed. The mock lives at the real routes (nothing in Inventory is in production use yet) and shows a visible "Demo data" banner. Mock screens never call the real API and never write to the database. The mock follows the API shapes written down in `docs/API_CONTRACT.md` first, so wiring the real back-end swaps the data source and not the screens.
- **Demo role switcher.** For the demo, the System Admin logs in once with their own account and a demo bar lets them view the Central Store as any role (and the phone view for the Attendant). It changes what the mock screens show; it does not log in as anyone, and no real account is reachable without its password. A reset button restores the mock data.
- **Delete before rebuild.** Old code for a feature being rebuilt is deleted, not worked around, so agents build clean. Back-end code that other sub-modules still depend on is replaced in the back-end session.
- **Purchasing and Receiving roles.** Store Manager and Store Attendant raise orders (the Attendant sends an order request; the Store Manager approves with a PIN). The **Accountant does not raise orders**; the Accountant writes deposits, invoices and payments. Branch Manager and Director are read-only. System Admin reads and writes everything, signing with their own PIN. The Attendant follows the approved phone design. The client has not approved these mappings, so the demo exists to test them.
- Catalog, restock levels and suppliers were rebuilt before this rule and already follow it (they sit on the permissions table).

## Process and tenancy

- Every signed document is printable; printing is never a required step. Signature = PIN re-authentication, name in the signature font.
- eTIMS/KRA integration: **out of scope**.
- Central Store hub scoping (D-15): see `docs/inventory/CENTRAL_STORE_SCOPING_DESIGN.md`. **Exception (3 Oct 2026):** a role holding `central_store.read_any_org` (Branch Manager, and the other desktop roles) may **read** hub data from outside the hub organization, through one shared guard (`requireHubReader`). Every write still needs the hub organization (`requireHubActor`), except the System Admin, who belongs to no organization and may write to the hub.

## Owner decisions (settled 3 Oct 2026, unless marked open)

| # | Question | Decision |
|---|---|---|
| F1 | `MISCOUNT_CORRECTED` writes the gap at the branch although the note says everything arrived | **Settled.** Require a `correctedQty` and write `correctedQty − confirmedQty`. Build it with the Dispatch/branch flow; do not demo this outcome until it is built |
| F4 | `GET /dispatch/:id/fulfil` returns on-hand to the Store Attendant | **Settled (7 Oct 2026): the Attendant sees quantities, including on-hand, while packing a dispatch.** Money stays hidden and the rest of the blind rule stands (no expected stock on counts, no supplier money) |
| Q1 | Suggested restock level: formula and who sets days of cover per item | **Settled.** The Store Manager sets days of cover per item (built). Default 15 days; 5 days for perishables when an item is marked perishable |
| Q2 | Can an attendant-added item be ordered before the Store Manager finishes setup? | **Settled: no.** It can be received, not ordered, until setup is finished |
| Q3 | Supplier document upload | **Settled.** Store Manager, Accountant and System Admin (the permissions table) |
| Q4 | Retire an item with open orders | **Settled.** Existing order lines stay; new orders cannot use the item |
| Q5 | Prep: run numbers, manager's drawer, target yield | **Settled.** Number every run PREP-nnnn; keep the manager's own "New prep run" drawer; the manager sets the target yield |
| Q6 | Phone "Check the goods" screen: item name | **Settled.** Our name large, the supplier's name small beneath it when it differs. No money is shown |
| N1 | Names in the phone notes ("the Store Manager", "the Accountant") | **Settled.** Keep role names; no name field |
| N2 | Dashboard and Reports sidebar links (no design) | **Settled.** Hidden until they are designed |

## Superseded — do not revive

- Purchase orders do not exist in the original description; the approved Purchasing flow uses an **LPO** raised from need and approved by the Store Manager. The LPO flow wins.
- "Par level" → **Restock level**. "Pass-through" → **Stocked item**. "Round" → **requisition**.
- Damaged goods are sorted at the door; the receipt records only what is kept (2026-09-15). Damage found later is waste.
- Direct market purchase at branches, department-level raw stock, weighted-average costing, and Phase 1/2/3 framing are retired.
