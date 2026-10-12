# UX walk, Phase 4 (Purchasing), 12 Oct 2026

Branch `feat/ux-phase-4`, lane 6. Walked as Store Attendant (phone, 390 wide) and Store Manager (desktop). Director and Accountant were not walked in the browser; the Attendant's blind rule was checked at the API (an invoiced order returns `invoice: null`, `payments: []`, `money: null`).

**Lane set-up (what was added):** department members `kitchen.member.town` and `barista.member1.town`; every `@wendo.test` user now has the PIN 1234; one carrier "Wendo van KCB 214K" (Vehicle) created on the Carriers screen. Orders: LPO-0018 (Wakubiu Coffee, 13 packet, KES 15,600) was raised by `store.attendant` from the Restock list, approved by `store.manager` with the PIN, marked sent with the carrier as collector. The lane's other orders (awaiting approval, returned, approved, sent, delivered, invoiced, closed, cancelled) were already there. Remind was pressed once on LPO-0004. No draft order exists on the lane (an order is only a draft for a moment before it is sent).

**Taps, low item to order sent.** Home, Build the restock list (1), Add on each item (1 each), Review list (1), Send for approval (1). Then, after the Store Manager approves: Home, Send it (1), choose who is getting it (1), Mark as sent (1). With 3 items: 8 taps for the Attendant plus the Manager's approval (open order, Approve with PIN, four digits). Proposed: an "Add all" link on the Restock list (see Q1 in chat).

| # | Screen | Problem | Fix | Status |
|---|---|---|---|---|
| 1 | Home | An order that needs me showed twice (Needs you now and My orders) | My orders skips orders already above | done |
| 2 | Restock list | "3 suppliers" counted an item with no supplier | Count only real suppliers | done |
| 3 | Review | Card total showed "0" for an unpriced order | Zero money shows "—" (cards and bar) | done |
| 4 | Review | Header said "3 items" while only 1 order would be sent | Header counts what will be sent | done |
| 5 | Review | After a full send the screen flashed "0 items" and grey rows | Calm blank + "Sent for approval" while My orders opens | done |
| 6 | Review | "Not set up to buy from X" gave no way forward | Says a price is missing and names who to ask | done |
| 7 | Sent order | Banner read "Delivery expected —" when no date | "No delivery date was set / Receive it here when it arrives." | done |
| 8 | Waiting order | "Sent for approval at 15:53" had no day; activity mixed days | Day and time on banner; activity shows days | done |
| 9 | Returned order | "sent this back · 15:53" had no day | Day and time | done |
| 10 | Order pages | Activity listed "saved a draft" beside "sent for approval" in the same minute | Draft lines hidden on the phone | done |
| 11 | Waiting order | Remind gave feedback only through the button label | Toast "Grace Wanjiku.Store Manager has been reminded" | done |
| 12 | Approved order | "Mark as sent" disabled with no reason | Hint "Choose who is getting it to mark this as sent." | done |
| 13 | History | "7 orders · Last 30 days: 7" said the same number twice | Second figure only when it differs | done |
| 14 | Manager PIN dialog | Fourth digit did not sign (needed a button tap); error line made the box jump | Fourth digit signs; error line keeps its height. Wrong PIN message ("That PIN is not right.") was already good | done |
| 15 | Notifications | Title "Grace Wanjiku (Store Manager).Store Manager approved it" (role twice) | Server wording helpers drop a trailing bracket, like the phone does | done |
| 16 | Manager approve drawer | "Raised by Store Attendant" with no name | "Raised by Peter Mwangi.Store Attendant" | done |
| 17 | Receive (steps 30, 31) | Opened for the first time since the tracker change: the 16 px tracker reads correctly on both steps | none needed | checked |
| 18 | Receive | Header differs from the other phone pages (chevron, "WENDO CENTRAL KITCHEN" eyebrow, not "WENDO RMS · HUB") | Move to the shared header | done (Purchasing's Receive screen uses the same header as the other phone pages; Branch Manager receiving untouched) |
| 19 | Home, My orders | "since 15:53" for an order from six days ago has no day | Add the day when not today | done (day shown when not today) |
| 20 | Home | Overdue sent order says "call the supplier" but its button is "Receive" | Button is "Call supplier" (Receive stays one tap away on the order page) | done (owner approved Q2) |
| 21 | Restock list | Every item needs its own Add tap | "0 of 3 on your list · Add all" row; skips items with no supplier | done (owner approved Q1) |
| 22 | Restock list | An item with no supplier has a live Add button and is then left out at Review | Shows "Set a supplier first" instead of Add | done (owner approved Q3) |
| 23 | Approve drawer | The Manager cannot set who collects at approval (the API accepts it) | Collector choice in the drawer | done on my recommendation, not drawn in Paper: an optional "Who will collect it?" choice (default "Decide when it is sent", then supplier delivers, carriers, staff). "Someone else" is left to the Attendant at send. Redraw in Paper if you want a different look |
| 24 | Manager desktop Needs restocking | A supplier dropdown on every row, the table scrolls sideways and the Est. total is cut off | Two-column layout (suppliers left, items right) | done (owner approved the Paper board 12 Oct): suppliers in a left list, the chosen supplier's items on the right, "Change supplier" link per item, every orderable line starts ticked, Create order in the supplier header; By item view unchanged (it fits and keeps the supplier dropdown) |
| 25 | Manager desktop lists | "Peter Mwangi (Store Attendant)" uses the bracket form, not Name.Role | One helper across the desktop lists | done for the Purchasing desktop lists, order page and approve drawer |
| 26 | Sent order | No expected date is set when the Attendant sends an order | Pre-fill from the supplier's lead time | later: needs a lead-time field (back end) |
| 27 | Returned order | Per-line "asked for a change" flag; some pushes not on Paper's map | Known, not built (owner ruling) | skipped |
| 28 | Needs restocking (desktop and phone) | Only a supplier's low or out items can be ordered from the list; other items from the same supplier meant starting a New order | "Show full catalog" switch (off by default) with in-pane search on desktop; "More from <Supplier>" row on the phone's By supplier view. Extras start unticked with no quantity; a quantity adds them to the order | done (owner approved Paper boards 2 and 3, 12 Oct); no back-end change; items with no price for that supplier cannot be added |

**Not walked:** Search (28E), Supplier page (28M) and the date-range sheet were walked in Block 6 and not changed; Share PDF and WhatsApp/Call links open other apps; Director and Accountant desktop pages in the browser; "A staff member" picker and "Someone else" were not re-tried this round (the carrier option was).

**Tests:** frontend typecheck clean, `vitest features/inventory/purchasing` 35 passed; backend typecheck clean, `vitest src/modules/inventory/purchasing` 311 passed (32 skipped as before).
