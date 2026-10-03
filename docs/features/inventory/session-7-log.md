# Central Store — Session 7 log (Part C, Session D: phones, "when things go wrong", cross-role pass, cleanup)

Branch `feat/central-store-phones-and-cleanup`. Paper source: *Wendo RMS · Approved designs*, page *Catalog, suppliers and restock levels*, chapters 6, 7 and 8.

## What was built
- **A. Chapter 6, the attendant adds a missing item** (steps 24–26). Opens from "+ Add item not on the delivery" on the phone receipt screen: search → "No item called …" → short form (name, Stocked or Raw ingredient, "It comes in a tin / one holds 400 g", live "1 tin = 400 g") → "added, now count it" → back to the delivery with the count. No prices, no stock. Posts to `POST /inventory/items` (§29.4); the item lands under Needs setup. Files: `catalog/components/phone/add-missing-item-flow.tsx`, `catalog/lib/missing-item.ts`.
- **B. Chapter 7, the department head sets their levels** (steps 27–29). `department-restock-levels-screen.tsx` replaced in place: big −/+ steppers, "Suggested 14 · applied. You use about 7 kg a day.", "Review changes" sheet ("Still Low · 9 kg on hand"), saved state with "Your recent changes" and Put back. Same endpoints as the Store Manager page.
- **C. Chapter 8.**
  - Retire item dialog (step 31) and the retired item page with Restore (step 32).
  - Supplier **Put on hold / Archive / Make active** on the supplier page header; **archive blocked** dialog (step 34, from the page's unpaid invoices, or from the server's 409); **duplicate-supplier** dialog (step 33, replaces the inline "Create anyway").
  - **Audit log** (step 35) with a new read endpoint `GET /inventory/audit-log` (§30.12) and a sidebar link.
  - Step 30 and 36 (reference tables) are copy only: the loading, empty and error wording already follows the kit; the audit log uses Paper's wording for its own states.
- **D. Owner answers, implemented:** actor on the Documents timeline (see below).
- **F. Cleanup:** deprecated supplier keys and the two legacy aliases removed; dead frontend files deleted.

## Questions asked and answers (owner, in session)
1. **Audit log endpoint?** Yes, add a small read-only endpoint (SM, ACC, DIR). Built: no schema change.
2. **Show who signed/recorded automatic Documents rows?** Yes. `actor{id,name}|null` added to each timeline entry; the row reads "Automatic · signed by …" / "recorded by …".
3. **Square corners (Paper) vs 2px (system), Topbar differences?** Keep the system 2px. Not changed; buttons and fields built from the shared primitives keep the system radius.
4. **Accountant's real name in "The Accountant is told"?** Defer, keep the role label.
5. **Restart the API on :4000?** The `tsx watch` that was running did not reload new files even after touching a watched file. Owner said yes; I stopped it and started my own, which is still running (background, log in the scratchpad). It also needs a restart after each backend edit here.

## Decisions I took (say if you want any changed)
- **Chapter 6 lives inside the old phone receipt screen.** Receiving is rebuilt later; I did not touch its routes. The flow is an overlay opened by the existing "+ Add item not on the delivery" button, and the receipt screen's `handleAddItem` now takes an optional quantity. The old receipt row still shows a KES price box to the attendant (see "Surprising").
- **Retire reason and replacement are one sentence** ("Added twice. Replaced by Brown sugar.") in the existing history `reason` (≤ 200). The backend has no separate replacement field; I did not add one. "Other" needs a few words.
- **Retire dialog "What this touches"** uses the change-review counts (stock on hand, open orders) and whether the item has a Central Store level. Paper also names the open order (LPO-0216) and the Kitchen's restock list; the counts have no order number and no per-department list, so the lines say "One open order has a line for it" and mention only the Central Store level.
- **Retire is a dialog over the item panel**, replacing the older "Review change" drawer view for retire only (edits still use the review view). `retireReviewBullets` and its test were removed.
- **Supplier hold/archive dialogs are not drawn** (only the blocked one is). Built in the same style: Hold has an optional note; Archive needs a reason (Closed down / We stopped using them / Other); Make active is a plain confirm. Archive and hold reasons are saved in the supplier audit row.
- **Archive blocked buttons:** Paper's "Open Supplier AP" is now "See what we owe" (Supplier AP no longer exists; it switches to the Overview tab with the money box). "Put on hold instead" is offered only while the supplier is Active.
- **Duplicate dialog** shows the first match's phone, address and created date (read from the supplier). The server's 409 gives only id, code and name.
- **Department head stepper:** step 1; with no level yet, + starts from the suggestion (or 1), − does nothing. Housekeeping/Kitchen/etc. only differ by the label.
- **Review sheet** says "The Store Manager can see every change" (Paper names Isabel Njoki; the name is not available to the phone). Same class as the Accountant's name.
- **Header on the phone screens:** a back arrow instead of Paper's menu icon on step 27 and 29, because the shell has no menu to open there.
- **Audit log filters:** Paper draws "All areas", a dark "Catalog, Suppliers, Restock levels" chip, "Who ▾", "Today ▾". I built the dark chip as "all three", plus one chip per area, Who and When menus (Today default, Last 7/30 days, Any time). Pages of 50.
- **New purchase's quick-add** now sends `address: "—"` (the repo's "unknown" value) instead of `phone: null`.
- Fixed on the way: the sidebar showed Accountant and Director as "Store Manager"; `roleLabel` now names them.

## Surprising / findings
- **Director cannot open any `/app/inventory/*` page.** The app guard sends the Director to `/app/director`, although the API allows them to read suppliers and the audit log. Not changed (a product decision). The Accountant reaches everything as designed.
- **Attendant money:** the API is blind (suppliers and items lists and detail carry no cost, price or balance; the audit log is 403). The **old phone receipt row still shows a KES price box and "KES 0.00" subtotal** to the attendant. That is the old Receiving screen; it goes with the Receiving rebuild.
- **Kitchen head's item list carries `currentCost`.** Department heads are not attendants, so §29.4 does not strip it. Worth a decision with the Receiving/Prep work.
- No Housekeeping head exists in the local database (heads: kitchen town, kitchen highway, barista town). The Housekeeping head was checked as the Barista head's restock rows through the API; the screens are department-agnostic and `Housekeeping` has its label.
- `tsx watch` and the dev server interplay: see question 5. Do not edit a page while testing it in the browser; Fast Refresh resets the screen's state (this cost one confusing test).

## Parity (values from Paper `get_jsx`; live checked by eye and with DOM text in the browser)
- Step 24 / 25 / 26: header (status bar, back, mono org line, avatar, 22px title, 13px #B5AEA5 subtitle), dashed not-found box, 48/46px inputs with 1.5px primary focus border, 52px primary buttons, radios with 5px ring, "1 tin = 400 g" box, 64×56 steppers with 26px count. Matches; the search "x" and datalist arrow were removed to match.
- Step 27 / 28 / 29: card (12/14 padding, 1px border; changed = espresso-50 + espresso-200), 52×44 steppers, 1.5px primary level box with "12 →", sheet with grab handle, 20px title, ITEM/LEVEL head with ink rule, Back 110px + primary, saved note, recent changes with "Put back 12". Matches.
- Step 31 / 32 / 33 / 34: 600px dialog, 20px title with optional dot, mono labels with "required/optional", chips 32px, red Retire button, retired banner and primary Restore; the blocked card is red-bordered with the amount in mono. Matches.
- Step 35: columns 110 / 140 / 120 / grow / 230, 34px head with ink rule, 44px rows; matches. Differences: the sidebar item is in PROCUREMENT after Reports; the scroll area keeps the topbar from the shared component.
- Known small differences (kept): dialog and field corners follow the shared primitives; Paper's status bar uses `sidebar-top` and so does the header here.

## Browser verification (real backend; Playwright MCP, because chrome-devtools could not attach: its profile was held by another running Chrome)
- Store Attendant (phone 390×844): New Goods Receipt → add "S7 test tomato paste" (Stocked, tin, 400 g) → count 2 → line on the delivery. DB: item created by Peter Mwangi, no category, cost 0. 
- Kitchen head (phone): raised two levels, review sheet, save, "2 levels saved" and recent changes. DB: two `restock_level_changes` rows with the head as `changed_by`.
- Store Manager (desktop): retire with a reason, retired page with banner, restore, "Add who sells it" with a supplier, Edit item (category; "Needs setup" cleared); new supplier "S7 Test Supplier": hold with note, archive with reason, make active (DB: both `STATUS_CHANGED` rows with reason, actor, time); duplicate dialog (name close to "S6 Test Kagumo Poultry Farm"); archive blocked on Samrat (one unpaid invoice, KES 650); Audit log with all rows; Documents shows who signed or recorded.
- Accountant: sees the Audit log link and the supplier page without Put on hold, Archive or Edit; Documents names the people. Director: redirected (see above). Attendant: no Suppliers or Audit log link; `/suppliers` redirects to the catalog; no KES on the catalog.
- Console: errors only from requests that were meant to fail (the 409 for a duplicate supplier, and pages opened by a role that is refused). I did not capture the console on every screen; the ones I read were clean.
- Postgres: every audit row has a user and a time; restock rows carry the location's organization (hub or branch); the audit endpoint reads only the hub and its active branches.

## Commands run
`pnpm exec vitest run` (frontend 186 tests, backend 1547); `pnpm build` backend; `next build` of a copy of `frontend/` in the scratchpad (a real `pnpm build` would have replaced the `.next` that the dev server on :3000, which is not mine, was using); `pnpm check-wds-tokens`; `tsc --noEmit` both sides; ESLint on every file changed on the branch (clean).

## Files
- **Added:** `backend/src/modules/inventory/audit-log/*` (service, repository, describer, validators, controller, routes, tests, README); `frontend/features/inventory/audit-log/*`; `_shared/components/phone-parts.tsx`, `decision-dialog.tsx`; `catalog/components/phone/add-missing-item-flow.tsx`, `retire-item-dialog.tsx`, `catalog/lib/missing-item.ts`, `retire-item.ts`; `restock/components/phone/*`, `restock/lib/department-levels.ts`; `suppliers/components/supplier-status-dialogs.tsx`, `duplicate-supplier-dialog.tsx`, `suppliers/lib/supplier-status.ts`; the audit-log route page.
- **Deleted:** `app/dev/wds`, `app/dev/wds-diff`, `supplier-form.tsx`, `aging-bucket-{cell,panel,table}.tsx`, `restock-level-grid.tsx`, `use-central-store-location.ts`, `retireReviewBullets`. Kept: `app/dev/components` and `app/dev/inventory-preview` (nothing imports what was removed).
- **Removed from the API:** `contactName`, `phone`, `email`, `location`, `retiredAt` on supplier reads; the same keys as write aliases; `DELETE /suppliers/:id`; `POST /suppliers/:id/restore`. `docs/API_CONTRACT.md` §27 updated, §30.12 added.
- Touched: supplier timeline (actor), `roleLabel`, the mobile receipt screen (optional quantity), `retireItem` (reason), `useRestockLevels` (`savedRows`, `revert`).

## Deferred
- Accountant's and Store Manager's real names in the phone notes ("The Accountant is told", "can see every change"): needs a backend field (owner: defer).
- Retire dialog: the open order's number and the departments' restock lists (needs two additions to the change-review read).
- Chapter 6 inside the rebuilt Receiving (the "Add to delivery" header "Samrat Supermarket Ltd · 12 Oct" is the rebuilt screen; today's overlay reads "This delivery · 3 Oct" when no supplier is picked yet).
- Director access to the inventory pages (decision).
- Attendant-blind receipt row (Receiving rebuild).
- Purchasing rebuild (LPO print, WhatsApp text, payment advice, statement, orders), Receiving, Prep, production demo: not started, as planned.
