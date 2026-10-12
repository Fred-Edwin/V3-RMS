# End-to-end walk — 12 Oct 2026 (branch feat/e2e-walk, lane 5)

Front end http://lane5.localhost:3105, API http://localhost:4105. Test walk only, no product code edited.

## Setup notes

- Seeds: `seed-rehearsal-reference.ts` needed `REHEARSAL_SEED_CONFIRM=YES`; the other two ran as written. All 13 @wendo.test users already existed with PINs, nothing added.
- chrome-devtools MCP could not attach at first (another Chrome held the lane-5 profile; not killed). Step 1a was driven with the Playwright MCP; from step 1b on, everything uses chrome-devtools in one visible Chrome, one isolated context per role.
- The lane-5 API was restarted once with `TZ=UTC` (see problem 16). The menu was imported with `import-menu.ts`, a shift for today was added for the Town floor staff, and a carrier was added in the app. All lane-5 data only.

## Problems

| # | What | Role | Step | Error | Severity |
|---|------|------|------|-------|----------|
| 1 | Restock list: 14 of 25 items say "No supplier yet", so the Attendant cannot add them (seed data, not a code fault) | Store Attendant | 1 | none | minor |
| 2 | Leftover open orders (LPO-0004 Washan, LPO-0006 Summer Limited) block a new order to the same supplier; the review screen explains it clearly | Store Attendant | 1 | none | minor (data) |

| 3 | Walk script says the Store Manager approves the requisition; the app has no such step. The Branch Manager's PIN signature (Approve and sign) sends it straight to the Central Store "To pack" queue | Store Manager | 3 | none | minor (script vs product) |
| 4 | Walk script says the Branch Manager "opens the day"; there is no Open button, the day (DAY-NYR-0004) exists already and Closing needs all 5 departments (incl. Pastry and Housekeeping, which have no head) to count | Branch Manager | 2 | none | minor (note) |
| 5 | No carrier exists after the three seeds, so the Attendant cannot sign a dispatch ("No carrier is set up. Ask the Store Manager to add one in Settings"). Store Manager added one under Carriers. The message says Settings, the menu item is Carriers (it also sits under a Settings breadcrumb) | Store Attendant | 3 | none | minor (seed gap) |
| 6 | The carrier name is stored with a "··" prefix ("··Wendo van KCB 214K") and shows that way on every screen; typed name had no prefix. Cause not found in code, to confirm | Store Manager | 3 | none | minor (to confirm) |
| 7 | Discrepancy finding drawer: "The 1 return to store stock" should read "returns" | Store Manager | 4 | none | minor (wording) |
| 8 | Leftover test row REQ-NYR-0001 (Extra, 0 lines, Approved, 16 days old) sits in the Central Store "To pack" queue | Store Manager | 3 | none | minor (data) |
| 9 | `/app` on its own is a bare 404 (no redirect to the role's home) | Kitchen head | 2 | none | minor |
| 10 | Prices missing on several lines (Aluminium foil, Eggs, Rice) so the requisition value shows "—" | Branch Manager | 2 | none | minor (seed data) |
| 11 | The lane-5 database had no menu at all, so the waiter's New Order showed an empty menu. Fixed with the existing `import-menu.ts` (21 categories, 152 items) and `clear-menu-cache.ts`. The empty-menu screen shows no message (search box and an empty page) | Waiter member | 5 | none | minor (seed gap, missing empty state) |
| 12 | The bottom bar is hidden on the New Order screen on purpose (`hideBar: true` on the `staff-new-order` row, asserted in `nav-table.test.ts`). Owner asked about it: it is not a missing update, branch has #144. Decide if a waiter should keep the bar while ordering | Waiter member | 5 | none | note (design) |
| 13 | A cook cannot claim a ticket without a shift today AND a clock-in. No shifts were seeded, so the dashboard said "You're off today". Added a shift for the Town floor staff by SQL in lane 5 only | Chef | 5 | 400 VALIDATION_ERROR | minor (seed gap) |
| 14 | The claim error shows the raw field name to the cook: "claimedById must be on shift and valid for this station" | Chef | 5 | 400 on PATCH /prep-tickets/:id/claim | minor (wording) |
| 15 | Clock-in needs the phone to be within 50 m of the branch ("You are approximately 4109.1 km away"). Worked once the browser location was set to the Town coordinates. Expected behaviour, noted for anyone testing | Chef | 5 | 403 on clock-in | note |
| 16 | **To confirm before release:** the "on shift today" check (`staff-repository.ts` `getTodayRange`) builds today from the server's local midnight. On a server whose timezone is not UTC (this machine is Africa/Nairobi) Prisma cuts those times to dates and the window becomes yesterday-only, so a shift dated today never matches and every claim fails. Worked after restarting the lane-5 API with `TZ=UTC`. Production containers are probably UTC so it likely works there, but the production timezone should be checked | Chef | 5 | 400, same message as #14 | blocker on non-UTC servers, minor if production is UTC |
| 17 | Waiter Orders list: the ticket rows under an order overlap ("· KitchenKevin Member…", the barista row's label is clipped) at 390 wide | Waiter member | 5 | none | minor (layout) |
| 18 | Chef and barista dashboards redirect to Daily count on first load after login, then stay on the dashboard on the next visit | Chef, Barista | 5 | none | minor (to confirm) |
| 19 | Accountant dashboard KPI cards wrap the amount onto two lines at 1280 wide ("KES / 400.00") | Accountant | 7 | none | minor (layout) |
| 20 | Closing the day shows "Used today" of KES 681,968. This is not a calculation fault: the branch had seeded stock and the closing count entered 0 for nearly every item, so almost all stock counts as used. Real counts would give real figures | Branch Manager | 6-7 | none | note |
| 21 | Closing needs all five departments, incl. Pastry and Housekeeping (no head set). The Branch Manager had to count five departments of 130 + 40 + 23 + 26 + 13 items on their behalf | Branch Manager | 6 | none | note |

## Product change made during the walk (owner asked for it)

Not part of the walk script. On the owner's request ("everyone should be transitioned to this new shell") the department gate was removed: the five floor roles (waiter, chef, barista, steward, housekeeping) are now in `SHELL_ROLES` in `frontend/components/app/shell/nav-table.ts`, so they get the new shell whether or not they belong to a department. `nav-table.test.ts` was updated to match (192 shell tests pass, `tsc --noEmit` clean). Checked live: waiter.plain now gets the hamburger menu and the bar (New Order, Orders, Inbox, Menu). Not committed, not pushed.

## Cross-check (step 7)

| Where | Revenue | Orders | Other |
|---|---|---|---|
| Director dashboard | KES 400 | 1 (Nyeri Town) | 2 staff clocked in; Americano (Double) and Samosa with Few Chips sold; allocation lines add to 400 |
| Accountant dashboard | KES 400.00 (cash) | 1 | 0 unaccounted, credit 0 |
| Admin | n/a | n/a | 2 active branches (3 with the hub), 1 Director, 1 Accountant, 2 Managers |
| Stock ledger (2 h) | n/a | n/a | RECEIVE 13 (LPO-0018), DISPATCH_OUT 4 lines (-20), WASTE -2, 233 ADJUSTMENT (232 day-close usage + the 1 egg finding) |

Console errors: none on any screen walked, except the one expected 403 (clock-in too far from the branch) before the location was set.

## Step log

- Step 1a PASS: Attendant (phone) raised an order for Wakubiu Coffee, 13 packets of coffee beans, KES 15,600, sent to the Store Manager.
- Step 1b PASS: Store Manager (desktop) approved LPO-0018 with PIN; the Attendant marked it sent, received 13 of 13 with a delivery note and photo, signed with PIN. GRN-0011 issued; ledger shows RECEIVE 13. Console clean.
- Step 2 PASS: Branch Manager (Town) saw the day DAY-NYR-0004. Kitchen head accepted the opening ("same as last night"), started REQ-NYR-0002 (4 lines x 5) and sent it with a PIN. Branch Manager used "Approve with Kitchen only" then "Approve and sign" with PIN. Console clean.
- Step 3 PASS (after adding a carrier): Attendant packed 4 of 4 with "Pack as asked", final review, signed with PIN, DSP-NYR-0002 on the way.
- Step 4 PASS: Kitchen head counted blind (Eggs 4 of 5), app asked for a recount, then a reason (Not in the box), signed with PIN. Discrepancy DSC-NYR-0001 opened. Store Manager recorded "Packed short at the store" with PIN: +1 Eggs back in Central Store, ledger entry written. The member did not also receive: one counter per delivery.
- Step 5 PASS (after menu import, shifts, UTC restart): waiter member placed Order #1 (Americano Double + Samosa with Few Chips, Table 4, KES 400). Kitchen member (clocked in) claimed and readied the kitchen ticket, barista member the barista ticket; order went READY; waiter paid cash and the order closed. waiter.plain still shows the old tabs (Dashboard, New Order, Orders, Inbox, More). The waiter member's Dashboard/Orders show the new bar (New Order, Orders, Deliveries, Inbox, Menu).
- Step 6 PASS: kitchen member logged 2 Eggs as Spoiled (shows in the department list, ledger WASTE -2). The Branch Manager counted all five departments on their behalf (blind count, PIN) and the day showed "Ready to close".
- Step 7 PASS: Branch Manager closed DAY-NYR-0004 with PIN (232 usage entries). Director, Accountant and Admin dashboards open with no console errors and agree with each other (see below).
- From step 1c on the walk uses the chrome-devtools MCP (it attached once the stale Chrome was gone).
