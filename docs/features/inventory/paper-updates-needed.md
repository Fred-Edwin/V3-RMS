# Paper updates needed (code is ahead of the approved designs)

**For the next agent who works in Paper:** update these in the approved-designs file (`01M3TP8J54R83RHC9FJ7RAHGKG`) **first**, before any new design work, so Paper and the code agree again. Each item was decided with the owner and built; the code is right, Paper is behind. Tick an item off here when Paper is updated.

## The Central Store sidebar (decided 3 Oct 2026, built in PR #67)
Page "Inventory . Stock and Counting", artboard "Parts · sidebars".

**Decision (owner, 3 Oct 2026): the new sidebar is drawn once, as the master, and carried by every design from now on.** The roughly 80 older screens that embed the previous sidebar are NOT being edited one by one: the sidebar component in the codebase is already the source of truth, and each screen picks up the new sidebar when it is rebuilt or redrawn. Four screens (Purchasing step 01 and three more Purchasing screens) were swapped before this decision and already show it; leave them. The master is **"Sidebar · Store Manager · Stock & counts active"** in "Parts · sidebars". Eleven ready-made nav states (one per active item, for cloning into new screens) are in the working artboard **"Parts · sidebar nav states"** on the same page.

The master follows the owner's chosen "geometric" draft (design-system page, "DRAFT · Sidebar navigation"), which refines the PR #67 construction: square 5px nodes on the spine and a square elbow into the last item instead of a rounded corner; the active row has a faint caramel tint and a 2px caramel bar on the rail edge; chevrons sit in fixed 16px slots. The real logo is used. If the code differs in these details (rounded corner, no node squares), the code should follow the master.

- [x] **Tree with a spine at group level.** Each group label (CENTRAL STORE, PROCUREMENT) is the root of a spine: a caramel line down the left with a square node and a short tick into every item. Icons stay. Same colours as the Stock & counts rail (`1BI5-0`), one level up. (Master only; see decision above.)
- [x] **Chevrons.** A small chevron at the right of each group label and each parent item (Stock & counts) opens and closes its branches. The group and item you are in are open by default. Open/close is a 200 ms slide. (Open state drawn; a collapsed parent shows the chevron pointing right.)
- [x] **Restock levels** is the sixth and last branch under Stock & counts (after Stock ledger).
- [x] **Remove Supplier AP** (replaced by Orders to pay in the Purchasing rebuild).
- [x] **Hide Dashboard and Reports** (no design yet; the links are not shown).
- [x] **Add Settings** under PROCUREMENT for the Store Manager (Team and My PIN).
- [x] **Audit log** icon: the clipboard glyph is already in Paper; the code now matches it.
- [ ] **Other roles' view:** the same tree for every role, cut to what the role may open, plus a "My dashboard" link at the top for roles that come from elsewhere (Branch Manager, Accountant, Director, System Admin). In those roles' own (older) sidebar, one link "Central Store". Not drawn yet.

## Stale status stamps
- [x] The cover artboards of **Prep** and **Stock, waste and counting** said "Draft · awaiting owner approval". Both now say "Approved by the owner" (green stamp). The "version 0.1" line beside the stamp was left alone.
- [x] The cover of **Catalog, suppliers and restock levels** carried the same "Draft · awaiting owner approval" stamp. The owner confirmed on 4 Oct 2026 that it is approved; it now reads "Approved by the owner".

## Built differently from Paper in Session 7 (update Paper, or tell the owner to choose)
**Done on 4 Oct 2026, following the recommendations the owner accepted:** Paper was updated to match the code for items 1–4, the three missing dialogs were drawn (item 5, steps 34b, 34c, 34d under step 34), and the screens index lists them. Read-only variants (item 6) wait until the client has approved the role names. Where a Paper screen still shows the old sidebar or the words "Supplier AP" in its background (for example the stat caption "open Supplier AP for the detail" on the Suppliers list), it is left as is: such screens are redrawn when they are next worked on.
- [x] **Audit log filters** (step 35): built as one dark chip for all three areas plus a chip per area, and "Who" / "When" menus (Today, Last 7 days, Last 30 days, Any time). Paper draws "All areas", a dark "Catalog, Suppliers, Restock levels" chip, "Who ▾", "Today ▾".
- [x] **Archive blocked** (step 34): the button "Open Supplier AP" is now "See what we owe" (Supplier AP no longer exists); "Put on hold instead" only shows while the supplier is Active.
- [x] **Retire item dialog** (step 31): lines say "One open order has a line for it" (no order number) and mention only the Central Store restock level (no per-department list); the data for those two is not available.
- [x] **Department head phone** (steps 27–29): back arrow instead of the menu icon; the review sheet says "The Store Manager can see every change" (no personal name).
- [x] **Supplier hold / archive / make-active dialogs** are now drawn as steps 34b (hold), 34c (archive) and 34d (make active), in the style of step 31.
- [ ] **Read-only variants** are not drawn: the item panel, restock levels table and supplier page for roles that can read but not write (no Edit, Retire, Add, Record buttons; no Payment tab for the Branch Manager).

## Also open for design
- Dashboard and Reports for the Central Store (a reports spec exists in `reports-spec.md`).
- Requisitions, Dispatch and Branch day (not approved).
- Phone versions for the desktop roles (deferred until the whole inventory feature is built).
