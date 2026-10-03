# Central Store — Session 6 log (Part C, Session C: Suppliers and the Purchasing changes)

Date: 2026-10-03 · Branch: `feat/central-store-suppliers-ui` (from `main` @ `d84732f`; PR #59 and #60 confirmed merged) · Design: Approved designs file, chapters 4 and 5 (steps 14 to 23), read with the Paper MCP by artboard name.
**Frontend plus three owner-approved, small, additive backend changes** (below). Nothing else under `backend/` changed.

## What was built
| Step | What | Where |
|---|---|---|
| Foundation | Types mirrored by hand (list row, detail, contact, pay method, change history, catalog line, timeline, summaries), service, hooks that keep stable references and let only the latest request write state (`useLoader`, `useAction`), pure logic with 20 unit tests (profile checklist, pack label, price per unit, alert wording, cheque number, documents filters, late sentence, pay-method rows) | `types/supplier.ts`, `services/supplier-api-service.ts`, `hooks/use-async.ts`, `use-suppliers-list.ts`, `use-supplier-page.ts`, `use-similar-suppliers.ts`, `lib/supplier-logic.ts`, `supplier-pay.ts`, `supplier-labels.ts` (+ tests) |
| 14 | Suppliers list: four-number strip (Active, On hold and Profile not finished are filters), search, Status / Type / Category menus, Profile not finished chip, table with profile and owed on every row | `screens/suppliers-list-screen.tsx`, `suppliers/suppliers-table.tsx`, `supplier-ui.tsx` |
| 15 | New supplier drawer (category optional, no map link, duplicate hint while typing, server 409 turns the button into "Create anyway"); Edit supplier is the same form plus trading name, KRA PIN, credit limit, notes | `suppliers/supplier-form-view.tsx` |
| 16 | The new supplier's page: header, tabs, "Profile · 4 of 7" checklist with Add on each open point, "Nothing bought yet" | `screens/supplier-page-screen.tsx`, `suppliers/supplier-page-header.tsx`, `overview-tab.tsx` |
| 17 | Overview: six-number strip, details cards, What we owe | `overview-tab.tsx` |
| 18 | Payment tab: methods (account number hidden until Show, fetched only then), "Who changed these, and when" from the audit log | `suppliers/payment-tab.tsx` |
| 19 (Change) | Change payment details drawer: NOW / AFTER table, reason chips, note | `suppliers/pay-method-views.tsx` |
| 19 (second artboard) | **Add a payment method** (the second artboard named "19 · Change bank account" is this screen with a wrong caption: its title is "Add a payment method" and Cheque is selected). Kinds: bank transfer, Paybill, Till, Send Money, Cheque | same file |
| 20 | Catalog tab: strip, their name and code, pack, price, per kg/L, last update (hand or receipt number), alert tag, preferred / "Preferred · confirm", History; "Pack not on file" notice | `suppliers/catalog-tab.tsx` |
| 21 | Add several items (search the catalog, tick, price per pack, one PUT per item on the line key); Add one = item picker then the existing "Add who sells it" form with the supplier fixed | `suppliers/add-items-view.tsx`, `add-one-view.tsx`, `catalog/add-seller-view.tsx` (new `fixedSupplier` prop) |
| 22 | Contacts tab; Add / Edit contact drawer; Make primary | `suppliers/contacts-tab.tsx`, `contact-view.tsx` |
| 23 | Documents tab: search, date range, Added by, All / Uploaded / Automatic, sort, type chips with counts, "Showing n of m"; Upload drawer; Open for uploads (signed link) and for receipts | `suppliers/documents-tab.tsx`, `upload-view.tsx` |
| E | Cheque in Record payment (Cheque number, required, duplicate warning before and after saving); their name and code under ours on the signed receipt's lines, with a "Pack not on file" tag | `screens/record-supplier-payment-drawer.tsx`, `receipt-line-list-readonly.tsx`, `types/receiving.ts` |
| F | Old supplier screens, hooks, skeletons, unused API calls and types deleted; Supplier AP sidebar item removed; the Attendant no longer reaches the supplier routes | see Files |

## Questions asked and answers (owner, in session)
1. **Where do the old Supplier AP money jobs go?** Paper's Overview "What we owe" has "Open statement" and "Orders", which lead to Purchasing screens that are not built. **Owner: keep Record invoice and Record payment on the box** until Purchasing is rebuilt (Store Manager records invoices; Store Manager and Accountant record payments). Only those two buttons differ from Paper.
2. **List needs profile and owed per row, and a "profile not finished" filter.** **Owner: small backend change, yes.** `profileDone` and `owedAmount` on each row; `profileNotFinished=true` filter (contract §30.9).
3. **Reason, Accountant notice and history for payment details.** Backend only did this for a cheque add. **Owner: yes to all three** (§30.10): reason required on add and on change (kept in the audit row, never on the method); the Accountant is told on every add and change (new socket event `supplier:pay-method-changed` + push; cheque add keeps its own event); `GET …/payment-methods/history` returns plain-word sentences with no account number in them.
4. **Catalog rows lack the usage unit, the receipt behind a price and the alert.** **Owner: yes** (§30.11): `itemUsageUnit`, `itemConversionFactor`, `lastReceipt`, `priceAlert` (newest alert on that pack in the last 90 days, with the date it compares against).
5. **Part E assumed screens that do not exist** (LPO, WhatsApp, payment advice are part of the Purchasing redesign, not today's New purchase flow). **Owner: do the small version.** Cheque in Record payment plus their names on today's receipt lines. The LPO, WhatsApp text and payment advice wait for the Purchasing rebuild (backend `GET /expected-deliveries/:id/supplier-document` is ready for it).

## Decisions I took (say if you want any changed)
- **Put on hold / Archive buttons are not on the page.** They open the retire and restore dialogs that Session 7 builds; a dead button would be a half-built screen. Edit supplier is the only header action.
- **Map link left out of Overview** (Paper still draws "Open in maps ↗"; the decisions doc says the address has no map link).
- **Suppliers list copy:** the subtitle and the Owed cell no longer say "stays on Supplier AP" (Supplier AP is gone): "…how we pay them and what we owe." and "owed to N suppliers". The Owed cell has no arrow (nothing for it to open).
- **Owed turns red on a supplier that is on hold** (Paper shows that one row red; I applied it to that case only).
- **Profile checklist** keeps Paper's seven rows (name and type joined, "How we pay them" always done). The count is the same as the backend's seven checks.
- **Spend · 90 days** on Overview and the Catalog tab comes from the catalog summary; the Catalog strip's sub-line says "on signed receipts" because the receipt count in 90 days is not exposed (Paper: "across 14 receipts").
- **"Other" as a reason needs a note** (Paper has the note optional). An "Other" with no words in the audit log helps nobody.
- **Change payment details** also lets the bank, branch and account name be edited under the new-number field (Paper draws the account number only); only fields that differ are sent.
- **Accountant text:** the info box says "The Accountant is told…" (Paper names Margaret; we do not know the name).
- **Add a payment method** offers the five kinds Paper draws; Cash is left out (no details; Record payment always offers it).
- **Documents:** payments and disputes count under "Other" (Paper has no chip for them). The "Added by" for automatic entries is "Automatic" (Paper adds "signed by Sarah Achieng"; the timeline does not carry who).
- **Contacts tab count** includes the business-named contact that New supplier creates from its phone (Paper shows 0 for a new supplier). The profile still counts "Contact person" as missing.
- **Not drawn, built in the same style:** Edit supplier extra fields, Add / Edit contact, Upload file, Remove payment method (a small confirm), the Pack-not-on-file notice, the Add one item picker.
- **No phone layout** for the Store Manager (none drawn); the pages scroll sideways below 1020 px.
- **"Make default"** for a payment method is not drawn and not built (a second method does not take over as default).

## Parity (values from Paper's `get_jsx`; live values from `getComputedStyle`, Chrome DevTools MCP)
| Screen | Tier | Checked | Result |
|---|---|---|---|
| 14 Suppliers list | A | title 24/30 600 −0.01em; sub 13/18; strip = the shared `CatalogKpiStrip` (verified in Sessions 4 and 5); search 280×30 pad 12; chips 30 high 13/16; header 34 high, mono 10/12 +0.06em, ink rule; rows 54; columns 130 / grow / 100 / 100 / 140 / 90 / 100 | Match. "New supplier" button padding was 16, Paper 14: fixed |
| 15 New supplier drawer | A | built on the Session 4/5 `DrawerFrame` (460, header pt 20 pb 16 px 24); name field 40 high with 1.5px selected edge; chips 32 high; days box 48×32; note box neutral-50 | Match by values and by eye |
| 16 New supplier page | A | by eye against the artboard: "Profile · 4 of 7", 6px bar at 57%, 14px dots, "Add" in espresso-700, dashed "Nothing bought yet" | Match |
| 17 Overview | A | h1 28/34 −0.02em; meta 13/18; tabs 14/18, gap 28, pb 10, 2px underline; strip cell pad 14/16, gap 6, value 20/24 500; card header pad 12/18 14/18 600; owed card pad 16/20 gap 24 | Match |
| 18 Payment, 19 Change, 19 Add method | A | rows 72, header 34, columns 180 / grow / 100 / 140; history rows 44; NOW/AFTER rows 42; chip and field heights from the shared drawer parts | Match by values transcribed from `get_jsx`; checked by eye in the browser |
| 20 Catalog | A | columns grow / 130 / 110 / 110 / 270 / 150 / 70, rows 56, alert tag 11/14 warning; strip is the shared one | Match by eye; their name / code line, pack, per-unit and last-update text verified with live data |
| 21 Add several | A | rows 56, checkbox column 34, price box 100×34 with 1.5px edge when ticked, selected row espresso-50 | Match by eye |
| 22 Contacts, 23 Documents | A | rows 54, header 34, columns from Paper; chips 30 high with mono counts | Match by eye |
Known, not chased: Paper draws square corners, the system uses 2px (unchanged from Sessions 4 and 5); the shared Topbar differs slightly from Paper (left as is). The Playwright note from Session 5 does not apply: this session used the Chrome DevTools MCP (innerWidth 1405).

## Browser verification (real backend, Store Manager unless stated)
- **List:** 7 suppliers, profile "n of 7" per row, strip (7 active, 0 on hold, 7 not finished, owed KES 0 then updated).
- **Create:** typing "Samrat Supermarket" shows "Looks like Samrat Supermarket Ltd (SUPPLIER-0001)"; "S6 Test Kagumo Poultry Farm" created as SUPPLIER-0008 and opens on "Profile · 4 of 7" with the dashed "Nothing bought yet".
- **Add several:** Chicken, cut 480; Cooking oil 5,200 (shows "260 / L"); Eggs "abc" is refused in the field, then 450 saved. Catalog tab shows three lines "set by hand by Grace" and "3 price lines".
- **Payment:** Show reveals and Hide hides the number (the full number is fetched only on Show). Added a cheque (reason "Supplier asked for it"): audit row `PAY_METHOD_CREATED` with `reason` and `summary: "cheque method added"`. Changed Samrat's account number (reason "Supplier changed bank"): audit row `PAY_METHOD_UPDATED`, numbers masked (`••••7321` → `••••7702`), reason on the row; the page's history lists both in words.
- **Catalog alert and pack check:** two signed receipts for Samrat via the API (GRN-0001 Maize flour 10 at 215, +20.1% over 179; GRN-0002 a 25 kg bag line). The tab shows "▲ 20.1%", "Maize flour is up 20.1%", "03 Oct · from receipt GRN-0001", "Last receipt 03 Oct GRN-0001", spend KES 3,950, and the warning "Pack not on file. GRN-0002: Maize flour in a 25 bag at KES 900. Their price was not updated." with "Add this pack".
- **Money:** Record invoice from the new page (S6-INV-001, 2,150), then Cheque 000412 for 1,000 (required-number message first), then the same cheque number again for 500: inline warning while typing, payment recorded, warning kept in the drawer with Done. `supplier_payments`: two CHEQUE rows, reference 000412. Owed 2,150 → 1,150 → 650 on the page.
- **Documents:** uploaded a PDF ("S6 Test price list.pdf", type Price list): appears as "Grace … · uploaded". Filters: All 6, Uploaded 1, Automatic 5, search "GRN-0001" 1; "Showing 1 of 6".
- **Contacts:** added "S6 Test Mary Wairimu" (Accounts); the bad email was refused first.
- **Set preferred:** one tap, flash "Chilli sauce sachets is preferred from this supplier."
- **Roles (API and browser):** the Attendant gets 403 on every supplier endpoint except the stripped list (`id, code, name, type, primaryPhone`, no money keys), is bounced to Catalog in the browser and has no Suppliers link. The Accountant reads everything, may add and change payment methods and upload (the contacts / items POSTs are 403), and the page shows only Record payment, payment-method buttons and Upload. The Director reads and changes nothing (payment-method POST 403).
- **Console:** no errors in the flows (one pre-existing `apple-mobile-web-app-capable` warning).

## Commands run
`git checkout main && git pull` (log shows #59, #60) · `git checkout -b feat/central-store-suppliers-ui` · `docker compose up -d postgres redis`; backend and frontend from source (`pnpm exec tsx watch src/server.ts`, `pnpm dev`) · `npx prisma migrate status` (up to date) · `npx vitest run src/modules/inventory/supplier` · `cd backend && pnpm build && pnpm test` · `cd frontend && npx tsc --noEmit`, `npx eslint` (touched files), `npx vitest run`, `pnpm build`.
**Results:** backend build OK, **1534 tests pass** (was 1512; +22); frontend **161 tests pass** (was 141; +20); lint clean on every file I touched; `pnpm build` passes (see the end of this file for the final numbers).

## Files
- **Backend (owner-approved, three commits' worth):** `supplier-repository.ts`, `supplier-service.ts`, `supplier-validators.ts`, `supplier-serializers.ts`, `supplier-summary.ts`, `supplier-controller.ts`, `inventory-routes.ts`, `receiving-repository.ts`; new `supplier-pay-history.ts`, `supplier-catalog-extras.ts` (+ tests); `sockets/socket-service.ts`, `services/fcm-service.ts` (generic pay-method notice); tests `supplier-service.test.ts`, `supplier-contract.test.ts`, `supplier-test-fixtures.ts`, `tests/inventory-suppliers.test.ts`. Docs: `API_CONTRACT.md` §30.9, §30.10, §30.11 and §27/§28.1 edits.
- **Frontend new:** `types/supplier.ts`; `services/supplier-api-service.ts`; `hooks/use-async.ts`, `use-suppliers-list.ts`, `use-supplier-page.ts`, `use-similar-suppliers.ts`; `lib/supplier-logic.ts`, `supplier-labels.ts`, `supplier-pay.ts` (+ tests); `components/screens/suppliers-list-screen.tsx`, `supplier-page-screen.tsx`; `components/suppliers/*` (18 files); two route pages rewritten.
- **Frontend edited:** `catalog/add-seller-view.tsx` (`fixedSupplier`), `item-catalog-screen.tsx` (opens `?item=` from the Catalog tab's History link), `record-supplier-payment-drawer.tsx`, `receipt-line-list-readonly.tsx`, `types/receiving.ts`, `types/index.ts`, `services/*`, `index.ts`, `inventory-shell.tsx`, `skeletons.tsx`, `middleware.ts`.
- **Deleted:** `screens/suppliers-ap-screen.tsx`, `supplier-detail-screen.tsx`, `supplier-form-screen.tsx`; hooks `use-suppliers`, `use-supplier-form`, `use-supplier-ap-list`, `use-supplier-ap-detail`; the supplier skeletons; `getSupplier`, `updateSupplier`, `retireSupplier`, `restoreSupplier`, `getApSummary`, `listSupplierAp` and the `UpdateSupplierInput`, `ApSummary`, `ListSupplierApQuery` types; the Supplier AP sidebar item (it was a dead `#` link).
- **Kept on purpose:** `components/supplier-form.tsx` and `aging-bucket-*.tsx` (the dev galleries `app/dev/wds*` still import them); `listSuppliers`, `createSupplier`, `CreateSupplierInput`, `Supplier` (the item drawers' supplier picker and New purchase's quick-add still use them); `receiving-api-service` AP detail / invoice / payment calls (the new page uses them).

## For Session 7 (every old thing still waiting)
- Deprecated supplier keys `contactName`, `phone`, `email`, `location`, `retiredAt` and the legacy `DELETE /suppliers/:id` and `POST …/restore` aliases are **still in the API**. Frontend users of them: `types/index.ts` `Supplier` (read by `add-seller-view`, `use-new-purchase-form`, `useSupplierOptions`) and `createSupplier` with `CreateSupplierInput` (New purchase's quick-add sends the legacy `contactName / phone / location` keys). Move those two to `types/supplier.ts` shapes (`contacts: [...]`, `address`) before the keys go.
- Put on hold / Archive for the supplier page header (chapter 8 dialogs, duplicate warning, archive blocked, Audit log). `PATCH …/status` is ready; `changeSupplierStatus` is already in the service.
- Dev galleries `app/dev/wds`, `app/dev/wds-diff` import `supplier-form.tsx` and `aging-bucket-*`; delete with the old galleries.
- Receiving is untouched. Its supplier picker still reads the old `Supplier` type.

## Deferred / not done
- LPO print, WhatsApp text, payment advice (cheque): wait for the Purchasing rebuild (see question 5).
- Supplier statement, Orders tab, Orders to pay: Purchasing chapters 8 and 7.
- "Signed by / recorded by" names on automatic document rows: the timeline does not carry the actor. Backend session: add `actor` to receipt / invoice / payment timeline entries.
- Receipt count in the last 90 days for the Catalog strip sub-line (needs a number in `catalog-summary`).

## Surprising
- Running dev servers keep a stale reference to a file after it is deleted ("Failed to read source code … No such file"): stop the dev server, remove `.next`, start it again. Also `tsx watch` did not pick up backend edits made while it was running from a background shell; I restarted it.
- `pnpm build` writes to the same `.next` as `pnpm dev`: restart the dev server after a build.
- A bank "branch" and "account name" are not in the audit sentence unless they change, and the sentence never contains a digit of an account number (a test asserts it).
- The record-payment drawer still adds money with floating point (pre-existing code, reused as the owner asked); the cheque change is the only edit.
