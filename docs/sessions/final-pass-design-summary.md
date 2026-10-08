# Final Inventory design pass: summary (8 Oct 2026)

The last two groups of the final Inventory design pass, **Branch day** and **Branch waste**, are drawn in Paper and approved by the owner. This note is for the build sessions. Flows and the design logs are in [branch-day-flow.md](../features/inventory/branch-day-flow.md) and [branch-waste-flow.md](../features/inventory/branch-waste-flow.md); the open Paper-versus-code differences are in [paper-updates-needed.md](../features/inventory/paper-updates-needed.md).

## Where it is in Paper (file "Wendo RMS · Approved designs")

| Group | Page | Contents |
|---|---|---|
| Branch day | Inventory · Counting and closing | Cover, screens index (28 screens, steps B0 to B18), chapters 1 to 4 |
| Branch waste | Inventory · Branch waste | Cover, screens index (9 screens, steps W1 to W9), chapters 1 and 2 |

## Branch day: what the build must do

- Each department head counts their own department **blind** in the evening (**Closing stock**); the Branch Manager counts for a department only when it cannot (on behalf of, with their own PIN). The opening is checked first ("same as last night?"); an overnight difference is recorded and never blocks.
- **Today** shows five department cards, what blocks the close, and what does not. Only an **uncounted department** or an **unconfirmed delivery** blocks the close. An open discrepancy never does.
- The figures are **Opening stock, Received, Waste, Closing stock, Used today, Yesterday, Used value (KES), Closing stock value (KES)**. **No unusual-figure rule**: the system flags nothing; the Branch Manager compares with the Yesterday column. Heads see no costs.
- **Close the day** is a summary and a PIN. It writes one usage entry per item through the stock ledger door, each carrying `DAY-<branch>-nnnn` (for example `DAY-NYR-0044`) as a link back to the day file. There is **no reopen**: **Correct a count** posts one linked entry (one item, a reason from Counted wrongly, Item was missed or Other, and a PIN).
- **History** has a date range (the approved range picker), and a Branch column and filter for the hub roles. The closed **day file** has Items, Documents and Activity tabs; the **day sheet** is an A4 document in the approved LPO template (a corrected sheet is a new document and the earlier one is kept). Printing a document is **not** an audit event.
- **Hub roles** (Director, Accountant, Store Manager, System Admin) read the same Today and History for any branch, with a branch picker and no write buttons. Write buttons are hidden, not greyed, for roles that cannot use them.
- The existing **Audit log** (Procurement group, hub roles) is extended, not replaced: new areas Requisitions, Dispatch, Discrepancies, Branch day and Branch waste, a Branch filter, who with title, and the record link. The Branch Manager needs a branch-scoped Audit log link (not drawn separately).

## Branch waste: what the build must do

- A department head or member logs waste on the phone: pick, amount and reason (Expired, Spoiled, Damaged in store, Prep error), check, then **Confirm and log waste**. **No PIN**: waste is never PIN-signed (owner, 8 Oct 2026). Items are only what a department holds; departments never hold raw ingredients.
- A member reverses **their own entry on the same day**; a wrong entry is reversed with a **linked entry** (reason Logged the wrong item, Wrong quantity or Other), the original stays on record, struck through.
- The **Branch Manager** reads all branch waste with values (by department, reason and value; search and filters first; numbered pager) and may reverse any entry with a reason, **no PIN**. The hub roles read every branch (Branch column, "Branch: All branches"), with no Reverse link. There is no Log waste button on desktop.
- Waste counts toward the day's **Used today** and shows as its own column at the close.

## Decisions the owner made in this pass (also in the design logs)

- No automatic unusual-figure flag; a Yesterday column instead.
- Day has two sub-links, Today and History. Waste is its own row in the Branch group. Hub roles get **Day** and **Waste** under a Branches group; their one Requisitions link stays in the Central Store group.
- Names on the figures: Opening stock, Closing stock (never "counted"), Used today (never "consumption"), Used value, Closing stock value.
- Printing a document is not an audit event.
- Waste reversal is reason only, no PIN.

## What is not drawn (by design)

- Per-screen loading, empty and error states: use the one States kit from Group R and the wording tables (step B18 and step W9).
- The Branch Manager's branch-scoped Audit log view, and the read-only variants of the Branch day file for each hub role beyond Today and History.

## For the next sessions

Build order and code status stay in [docs/PROJECT_STATUS.md](../PROJECT_STATUS.md). Nothing in code has changed for Branch day or Branch waste yet; the old flows still run until each sub-module is rebuilt from these designs.
