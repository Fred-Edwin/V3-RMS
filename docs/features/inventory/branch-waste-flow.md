# Branch waste: flow and rules (draft defaults, 7 Oct 2026; owner reviews before this group is drawn)

Group W, the last group of the final Inventory design pass. Branch waste is in this pass at the owner's request. It reuses the **approved Central Store waste pattern** (Paper page "Inventory . Stock and Counting", Chapter 5 "Waste during the day", and the newer waste chapters of the Stock, Count and Waste pass). Draw the branch version from those screens; do not invent a new layout. Screens: [final-pass-screen-plan.md](final-pass-screen-plan.md).

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

## Defaults taken here, owner to confirm when reviewing

1. The reason list above (matches the approved Central Store list where it exists; use that list if it differs).
2. A member may reverse their own entry; the Branch Manager may reverse any.
3. No PIN on logging, matching the approved Central Store pattern.
