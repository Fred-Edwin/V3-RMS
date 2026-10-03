# Paper updates needed (code is ahead of the approved designs)

**For the next agent who works in Paper:** update these in the approved-designs file (`01M3TP8J54R83RHC9FJ7RAHGKG`) **first**, before any new design work, so Paper and the code agree again. Each item was decided with the owner and built; the code is right, Paper is behind. Tick an item off here when Paper is updated.

## The Central Store sidebar (decided 3 Oct 2026, built in PR #67)
Page "Inventory . Stock and Counting", artboards "Parts · sidebars", "Parts · desktop shell", and every desktop screen that embeds the sidebar.

- [ ] **Tree with a spine at group level.** Each group label (CENTRAL STORE, PROCUREMENT) is the root of a spine: a caramel line down the left with a faint tick into every item but the last, and a rounded corner into the last item. Icons stay. Same colours and construction as the Stock & counts rail (`1BI5-0`), one level up.
- [ ] **Chevrons.** A small chevron at the right of each group label and each parent item (Stock & counts) opens and closes its branches. The group and item you are in are open by default. Open/close is a 200 ms slide.
- [ ] **Restock levels** is the sixth and last branch under Stock & counts (after Stock ledger).
- [ ] **Remove Supplier AP** (replaced by Orders to pay in the Purchasing rebuild).
- [ ] **Hide Dashboard and Reports** (no design yet; the links are not shown).
- [ ] **Add Settings** under PROCUREMENT for the Store Manager (Team and My PIN); it is built but not drawn.
- [ ] **Audit log** icon: the clipboard glyph is already in Paper; the code now matches it.
- [ ] **Other roles' view:** the same tree for every role, cut to what the role may open, plus a "My dashboard" link at the top for roles that come from elsewhere (Branch Manager, Accountant, Director, System Admin). In those roles' own (older) sidebar, one link "Central Store".

## Stale status stamps
- [ ] The cover artboards of **Prep** and **Stock, waste and counting** still say "Draft · awaiting owner approval, version 0.1". Both designs are approved; change the stamp.

## Built differently from Paper in Session 7 (update Paper, or tell the owner to choose)
- [ ] **Audit log filters** (step 35): built as one dark chip for all three areas plus a chip per area, and "Who" / "When" menus (Today, Last 7 days, Last 30 days, Any time). Paper draws "All areas", a dark "Catalog, Suppliers, Restock levels" chip, "Who ▾", "Today ▾".
- [ ] **Archive blocked** (step 34): the button "Open Supplier AP" is now "See what we owe" (Supplier AP no longer exists); "Put on hold instead" only shows while the supplier is Active.
- [ ] **Retire item dialog** (step 31): lines say "One open order has a line for it" (no order number) and mention only the Central Store restock level (no per-department list); the data for those two is not available.
- [ ] **Department head phone** (steps 27–29): back arrow instead of the menu icon; the review sheet says "The Store Manager can see every change" (no personal name).
- [ ] **Supplier hold / archive / make-active dialogs** are not drawn; they are built in the style of step 31 and need artboards.
- [ ] **Read-only variants** are not drawn: the item panel, restock levels table and supplier page for roles that can read but not write (no Edit, Retire, Add, Record buttons; no Payment tab for the Branch Manager).

## Also open for design
- Dashboard and Reports for the Central Store (a reports spec exists in `reports-spec.md`).
- Requisitions, Dispatch and Branch day (not approved).
- Phone versions for the desktop roles (deferred until the whole inventory feature is built).
