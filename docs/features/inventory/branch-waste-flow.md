# Branch waste: flow and rules (design approved 8 Oct 2026; where the table below says a PIN for the Branch Manager's reverse, the design log wins: reason only, no PIN)

Group W, the last group of the final Inventory design pass. Branch waste is in this pass at the owner's request. It reuses the **approved Central Store waste pattern** (Paper page "Inventory · Counting redesign (Oct 7)", chapter 4 and chapter 11 step 55; the older chapter on the "Stock and Counting" page was deleted on 8 Oct 2026). Draw the branch version from those screens; do not invent a new layout. Screens: [final-pass-screen-plan.md](final-pass-screen-plan.md).

## In one paragraph

A department member logs what was thrown away, spoiled or broken, with a reason, in a few taps on their phone. A wrong entry is reversed with a linked entry, never deleted. Waste reduces the department's stock through the ledger door and feeds **Used today** at the branch close. The Branch Manager sees all branch waste by department, reason and value.

## Who does what

| Role | Does |
|---|---|
| Department member or head | Logs waste for their own department, sees their own entries for today, reverses their own wrong entry |
| Branch Manager | Reads all branch waste with values; may reverse any entry with a reason and a PIN |
| Director, Accountant, Store Manager, System Admin | Read every branch's waste; System Admin can act with their own PIN |

Heads and members see item names and units but **no costs**. The Branch Manager and the desktop roles see values.

## The journey (phone first, 3 taps for one item)

1. **Log waste.** Pick the item (search, grouped by category), the quantity, a reason (**Spoiled, Expired, Dropped or broken, Prepared too much, Other**) and an optional photo. Several items can be added before sending.
2. **Check before it is logged.** A short summary of the lines and the effect on stock ("−3 kg Tomatoes"), then **Log it**. Waste is a stock movement, so it needs the summary; a PIN is used only where the owner asked for one (kept as in the approved Central Store waste screens).
3. **My waste today.** The member's entries, newest first, each with **Reverse**.
4. **Reverse a wrong entry.** A short sheet: reason, then confirm. The reversal is a new linked entry; the original stays visible.

## Desktop, Branch Manager (read by all desktop roles)

- **Branch waste**: a table by department, reason and value, with search and filters first, a numbered pager, and a date range (table convention, `UI_BUILD_RULES` §4a).
- **Reverse any entry**, with a required reason and the Branch Manager's PIN.
- Each entry opens to show who logged it, when, reason, photo and its ledger entry.

## Rules

- Waste goes through the stock ledger door as a new entry; nothing is edited or deleted.
- A department can only log items it holds; departments never hold raw ingredients.
- **Negative stock is allowed and flagged**, never blocked, as everywhere else in Inventory.
- Branch waste counts toward the day's **Used today**; the close summary shows it as its own column ([branch-day-flow.md](branch-day-flow.md)).
- Alerts: none by default; large entries are visible in the Branch Manager's table.

## Reference screens

The group uses the one **States kit** drawn in Group R and has its own wording table.

## Design log

### Batch W1, "Log it" (8 Oct 2026): approved
Paper page "Inventory · Branch waste", chapter 1. Five phone screens cloned from the approved Central Store waste screens (page "Inventory · Counting redesign (Oct 7)", steps 16 to 20, not the older chapter with the fake status bar) and re-worded for a department: **W1** pick what was wasted, **W2** how much and why (number pad, reason chips Expired, Spoiled, Damaged in store, Prep error), **W3** check, then log (no PIN), **W4** Kitchen waste today (the department's entries, Reverse on each), **W5** reverse a wrong entry (reason Logged the wrong item, Wrong quantity or Other; the entry stays, marked reversed). Changes from the Central Store version: the header says the branch and the department, the avatar is the Kitchen head's, the note asks "Anything the Branch Manager should know?", and the usual items are things a department holds (Beef stew and Pilau replace Tomatoes and Wheat flour, because departments never hold raw ingredients). Each step caption says who it is for and how many taps.
- The reason list is the approved Central Store list (Expired, Spoiled, Damaged in store, Prep error), not the earlier draft list in "The journey" above.
- Waste is never PIN-signed (owner, 8 Oct 2026), so the Branch Manager's reverse on desktop (batch W2) is a reason only, not a reason and a PIN as the table above says.

### Group W complete (8 Oct 2026): W1 and W2 approved by the owner
Added after the W2 review: **W8** Waste for any branch, read only (Director, Accountant, Store Manager, System Admin: Branch column, "Branch: All branches" picker, no Reverse link, sidebar with Waste under Branches) and **W9** the wording table (the words, buttons and messages, who does what). The cover and screens index (9 screens) are at the top of the page. W1 is also approved.

### Batch W2, "See it" (8 Oct 2026): approved
Chapter 2 on the same page. **W6** Branch waste (Branch Manager, desktop; read by all desktop roles): Branch / Waste, four figures (Today, Last 7 days, Most wasted, Reversed), search and filters first (Department, Reason, Status, Date), a table by time, item, quantity, department, reason, logged by and value (KES), a Reverse link on every active entry, reversed entries struck through with a "Reversed 09:12 · wrong item" chip, and the numbered pager with rows per page. The sidebar has Waste active under Branch. **W7** Reverse any entry: the approved Central Store dialog (entry, logged by, value, the effect on stock and the waste total, a required reason: Logged the wrong item, Wrong quantity, Other), **no PIN** (owner, 8 Oct 2026: waste is never PIN-signed). No Log waste button on desktop: logging is a phone job for the department.

## Defaults taken here, owner to confirm when reviewing

1. The reason list above (matches the approved Central Store list where it exists; use that list if it differs).
2. A member may reverse their own entry; the Branch Manager may reverse any.
3. No PIN on logging, matching the approved Central Store pattern.
