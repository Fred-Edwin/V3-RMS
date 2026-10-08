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
- [x] **Code follows the geometric master (5 Oct 2026).** Checked against `OQP-0` with `get_jsx`: square 5px nodes, square elbow, faint caramel wash plus 2px bar on the active row, chevrons in fixed 16px slots. One known difference: the footer avatar is round in code (owner decision, 15 Sep 2026), square in Paper.
- [ ] **Other roles' view (changed in code, 5 Oct 2026):** every role now has this one sidebar, with its own groups first (for example Branch Manager: Operations, Manage, Other income, Branch) and the Central Store groups after them. There is no "My dashboard" link and no single "Central Store" link any more; each role's own Dashboard is its first row. Phones show the same links in a menu drawer (desktop roles and Store Attendant). Not drawn in Paper yet; the links per role are the rows in `frontend/components/app/shell/nav-table.ts`.

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

## Fake phone status bar (logged 4 Oct 2026)
- [ ] Older Paper phone frames show a status bar (9:41, signal, Wi-Fi, battery). It must not be part of the screens; remove it from each frame, and remove any copy of it from the built front end. Rule: `docs/UI_BUILD_RULES.md` §7a.

## Requisitions group (final design pass, logged 7 to 8 Oct 2026)
- [ ] **Director sidebar** (step 18b): Central Store group open with Requisitions active. Code: the Director has no Requisitions row today. Also **Settings > Manage > Departments** (step 20) is new, and the urgent switch (18), cancel dialog (19) and States kit (21) are new surfaces for the build.
- [ ] **Sidebar rows differ from `nav-table.ts`.** The design has one "Requisitions" link per role; the table has: Branch Manager three rows (Requisitions, Deliveries, Day), Department Heads an old-flow Requisitions row, Store roles only "Dispatch", Director/Accountant/System Admin no Requisitions row. Build session: one Requisitions row for every role (Central Store group for the hub roles, replacing Dispatch), Deliveries folded into the list tabs. Sidebars are drawn in R2 (desktop screens); phone screens use the menu drawer.
- [ ] **Floor-staff heads** (chef, barista, steward, housekeeping) are still on the legacy bottom tabs in code; the head phone screens are drawn with the top bar and back arrow. The build moves these heads onto the shell.
- [ ] **PIN and summary are one sheet** on the head's send (step 5); the code should not add a separate PIN step.
- [ ] **Branch Manager sidebar** (drawn in R2): Operations, Manage, Other income, Branch (open), Central Store and Procurement (collapsed). The code's Branch group should list Requisitions and Day only (Deliveries folded into the list tabs). The brand row shows the branch name ("NYERI TOWN") where the Central Store master shows "HUB".

## Dispatch group (final design pass, logged 8 Oct 2026)
- [ ] **Store Manager sidebar** (drawn in Group D, "Parts · sidebar · Store Manager · Requisitions active"): the Central Store group with one **Requisitions** link (count badge) replacing "Dispatch". Code today has "Dispatch" for store roles.
- [ ] **Carriers** live under Settings in the Procurement group for the Store Manager (new screen, list kept by the Store Manager). The Carriers screen reuses the Requisitions-active sidebar; redraw with Settings active.
- [ ] **One final signature for the whole requisition** (D5): the code signs per department today; the build signs once and still creates one dispatch and one delivery note per department.
- [ ] **Requisitions sub-links** (owner, 8 Oct 2026): every desktop role's Requisitions row becomes a parent with sub-links **Queue, Discrepancies, History** (`nav-table.ts` `subItems`, as Prep and Stock do); badges: Queue = items waiting for that role, Discrepancies = open ones. Closed and Discrepancies leave the list tabs. New screens: Discrepancies list (Group R step 7c) and History (7d). The Branch Manager's Requisitions row sits in the Branch group next to Day.
- [ ] **Delivery notes** are multi-page capable: header and column headings repeat, "Page n of m", signatures and QR on the last page only (print stylesheet rule for the build).

## Also open for design
- Dashboard and Reports for the Central Store (a reports spec exists in `reports-spec.md`).
- Requisitions, Dispatch and Branch day (not approved).
- Phone versions for the desktop roles (deferred until the whole inventory feature is built).
