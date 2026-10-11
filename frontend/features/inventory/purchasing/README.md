# purchasing (front-end, live API)

**Status (6 Oct 2026, Step 4 of the Central Store go-live):** the screens run on the real back-end at `/inventory/purchasing` (built in Step 3). The in-browser mock, its scenarios, the System Admin demo bar, the "Demo data" banners and the demo "view as a role" are deleted. Built to the approved Paper designs; **the owner approves screen by screen** (see "Awaiting approval" below).

Design: Paper "Inventory · Purchasing" (`p-3-0`). Rules: `docs/features/inventory/purchasing-mock/backend-rules.md`. Wire shapes: `docs/API_CONTRACT.md` §31 and §31.9 (where the live API differs from the first design). Back-end: `backend/src/modules/inventory/purchasing/`.

## Routes (under `/app/inventory/`)
| Route | Screen |
|---|---|
| `purchasing?tab=needs\|approval\|receive\|invoice\|pay\|closed` | Purchasing, six stage tabs. Whoever can `orders.request` but not `orders.approve` (the Store Attendant in the access table) gets the phone Home and the routes listed under "Store Attendant phone" below instead |
| `purchasing/new` (`?supplier=&lines=`, `?edit=`) | New order; also edits a draft or a returned order |
| `purchasing/[orderId]` | The purchase file in every state; the invoice, payment, void, reverse, settle and add-document drawers open over it. Closed: Documents first and the audit log on the right |
| `purchasing-print/[orderId]` | Printed LPO (standalone, A4; no prices, total or amount in words) |
| `purchasing-print/payment/[paymentId]` | Printed payment advice (A4) |
| `purchasing-print/statement/[supplierId]?from=&to=` | Printed supplier statement (A4) |
| `receiving` | redirects to the To receive tab |
| `receiving/[orderId]` | Receive a delivery, two steps (phone first): quantities and the price on the delivery note, then the note number, its photo and your PIN |
| `suppliers/[id]` (existing page) | Orders tab, Statement tab and the "What we owe" card read `GET /suppliers/:id/orders` and `/statement` by the supplier's real id |
| `audit-log` (existing page) | "Purchasing and payments" view reads `GET /inventory/audit-log?area=PURCHASING\|PAYMENTS`; each row links to its purchase file; `?q=LPO-0044` opens it searching |

## How it is built
- `services/purchasing-service.ts` is the one interface the screens use. `services/purchasing-api-service.ts` implements it over HTTP (the shared `apiClient`, plus `fetch` for the multipart upload and the 204 discard). `hooks/use-purchasing.ts` supplies it and bumps a version counter after every write (done or refused), so every open list and file reloads.
- Screens never import the API client or the HTTP service; `service-boundary.test.ts` fails if one does, or if the mock, demo bar or demo role come back.
- **Access is the server's table**, read with `usePermissions()` and each order's own `can`; no role names. Two separate rules for money: item prices and order totals follow `catalog.see_costs` (the Store Attendant has it); invoices, payments, due labels, the money strip and the supplier statement follow `payables.read` and are never sent to the Attendant. Stock figures (`onHand`, `level`) are left out for a caller without `restock.read`; the types mark them optional.
- Refusals arrive as `ApiError` with the server's plain message and a `code`; use `isPurchasingError(e, code)` and `errorDetails(e)` from `types/` (`SUPPLIER_ORDER_OPEN` links to the open order, `DUPLICATE_INVOICE_NUMBER` offers "it is a different invoice", `PAYMENT_EXCEEDS_BALANCE` resends with `confirmOverpay`, `INVALID_PIN` shows under the PIN boxes).
- Receive: each line sends `{lineId, receivedQty, deliveredPrice, priceConfirmed}`. A price typed that differs from the order's must be confirmed before Next; receiving nothing at all is blocked ("cancel the order instead"); the PIN is 4 digits.
- Uploads go to `POST /uploads`; the upload problem states of Paper `35` are in `components/photo-slot.tsx`. "View" on a document or the delivery-note photo asks `GET /uploads/:id/url` for a short-lived link (local dev storage is in memory and returns a `memory://` link that a browser cannot open; production storage returns a real one).

## Tests
`services/purchasing-service.contract.test.ts` (every operation of the HTTP service against mocked `fetch` answers shaped like §31 and §31.9, plus refusals), `components/screens/next-step.test.ts` (each next-step button follows the order's `can`), `service-boundary.test.ts` (the boundary above; the old payables code stays deleted). The contract test also covers the 16 Attendant calls (paths, bodies, the 204 mark-read, the new refusal codes); `components/app/shell/nav-table.test.ts` covers the Attendant's sub-links and badges. The business rules are tested in the back-end module.

## Gaps logged for the back-end (not built)
- "Download all documents" on a closed file (the button is removed): needs an endpoint that zips the purchase file.
- The receive and payment screens keep their client-side checks as well as the server's.

## Store Attendant phone (built 11 Oct 2026, Block 6, awaiting owner review)
Paper chapter 9, steps 28A to 28Q (30 and 31, Receive, unchanged). The old tabbed Restock / To receive / My orders screen is deleted. Code is in `components/phone/`, wired to the real API (`purchasing-attendant-api.md`); values and wording: `docs/features/inventory/block-6-paper-spec.md`; what was built beyond Paper and the defaults used: `docs/features/inventory/block-6-undrawn-review.md`.

| Route (under `/app/inventory/purchasing/`) | Screen | File |
|---|---|---|
| `` | 28A Home (the Attendant only; every desktop role keeps the six tabs) | `home-screen.tsx` |
| `restock` | 28B Restock list (suggested amounts, stepper, sticky total) | `restock-list-screen.tsx` |
| `restock/review` | 28C Review and send for approval | `review-screen.tsx` |
| `my-orders` | 28F My orders | `my-orders-screen.tsx` |
| `history` | 28G History and 28G2 date sheet | `history-screen.tsx` |
| `search` | 28E Search | `search-screen.tsx` |
| `notifications` | 28N Notifications | `notifications-screen.tsx` |
| `levels` | 28P Restock levels | `levels-screen.tsx` |
| `suppliers/[id]` | 28M Supplier | `supplier-screen.tsx` |
| `[orderId]` | The Attendant gets the phone page for the order's state (28D approved, 28H returned, 28J sent, 28K waiting, 28L closed); every desktop role keeps the purchase file | `order-route.tsx`, `order-page.tsx`, `order-approved.tsx`, `order-returned.tsx` |

- **Shared parts:** `phone/phone-kit.tsx` (chips, bars, buttons, States kit 28Q, Name.Role words, Nairobi dates), `phone/order-cards.tsx`, `phone/order-parts.tsx`, `phone/gate.tsx` (`AttendantOnly` sends a desktop role back to the desktop Purchasing; page state lives in the URL). The header is `B2Header` (new `bell`, `action` and search slots), the pager is `PagerBar bar`, the date sheet is `DateRangePicker sheet`, the tracker is `CompactTracker` in two forms (`labelled`, `dots`).
- **The restock list** has no server draft: `store/restock-list-store.ts` keeps it per signed-in person in the browser and empties it after a fully successful send.
- **Navigation:** the Attendant's Purchasing row in `nav-table.ts` has the five sub-links; counts come from `GET /attendant/badges` through `hooks/use-purchasing-badges.ts` (also on Receiving).
- **Types:** `types/attendant.ts` mirrors the new endpoints; `Order` gained `collectedBy`, `can.withdraw / remind / setCollectedBy` and `supplier.phone`.
- **People are written Name.Role** ("Grace Wanjiku.Store Manager"): `withRole` in `phone-kit.tsx`.
- **Rules kept:** the Attendant never sees an invoice, a payment or a balance; no phone status bar; loading, empty and error-with-retry on every list; a refused write shows the server's words (inline, or a toast where the screen can change under the person).

## Awaiting approval (owner, screen by screen)
Purchasing six tabs; New order; the purchase file (every state); Receive (the new typed-price field is not in Paper: it sits under each quantity stepper); the Attendant's Restock / To receive / My orders (now shows item prices and order totals); invoice, payment, reverse, void and settle drawers; the three prints; supplier Orders and Statement tabs; audit log view.

## Paper parity pass (6 Oct 2026, local seeded data, real browser at the artboard width)
Compared by eye plus Paper `get_computed_styles` against live `getComputedStyle`, per artboard. No pixel diff. Paper file `01M3TP8J54R83RHC9FJ7RAHGKG`, page `p-3-0`.

| Screen (Paper artboard) | Live route / order that reaches it | Verdict |
|---|---|---|
| 01 Needs restocking, by supplier (`C-0`) | `purchasing?tab=needs` | Corrected: title block 32px from the top bar; "Create order" outlined until something in that group is ticked; the Group / List toggle is 12px with primary text when selected. Not built: Receiving count badge in the sidebar |
| 03 New order (`JJ-0`) | `purchasing/new?supplier=` | Corrected: Discard is a plain muted action; the item count is a dark round badge; the summary drops under the catalog below 1280px. **Needs owner decision:** Paper pre-ticks low items and has a catalog dropdown and category filter (live ticks nothing, search plus All / Low / Selected only); the date field is the browser's native one (US order in an en-US browser) where Paper draws a custom picker |
| 15 File, awaiting invoice (`2HU-0`) | `purchasing/<LPO-0011>` | Corrected: Next step card is the espresso tint with tan border; money strip 17px figures, 14px padding, label no longer wraps; the items table scrolls inside its own box (min 640px) instead of squeezing the name; the right rail drops under the file below 1280px; page title 32px from the top bar |
| 12 and 13 Receive (`294-0`, `2CB-0`) | `receiving/<LPO-0007>` at 390px, Attendant | Corrected: the fake phone status bar (9:41, signal, battery) is gone from the shared phone header (UI rule 7a; this also removes it from the catalog and restock phone screens); a short line gets Paper's red box and a price change its tan border; step 2 header reads "Delivery note"; the photo slot is Paper's icon-beside-text row. **Needs owner decision:** the typed-price field under each stepper (not in Paper); Paper shows a plain number box where live has minus / plus buttons |
| 17 Add invoice drawer (`2VE-0`) | file of LPO-0011, Add invoice | Matches except: native date field (as above); disabled Save is tan where Paper's is grey |
| 28 Ask for restock, Attendant (`53A-0`) | `purchasing` as Attendant at 390px | Matches in structure. **Needs owner decision:** Paper's own subtitle says "what we have paid", which the Attendant rule (no payment wording) forbids; the supplier chooser is the browser's native select, Paper draws a small caret |
| Item prices and totals for the Attendant | Restock, Receive | Built, not in Paper. **Needs owner decision** (`Ordered 2 kg at KES 1,200`, `KES 6,380 per bag`) |

**Not compared in this pass (still open):** steps 02, 04 to 11, 16, 18 to 27, 29 to 40, the three prints, supplier Orders and Statement tabs, the audit log view, and the live-data stress cases (30+ lines beyond the 31-line order, millions, no contact, throttled and lost connection). The Accountant pass is a separate owner decision. Also open: the breadcrumb on a file reads "Awaiting invoice / LPO-0011" as one crumb where Paper has three, the file's "Order total" row is not in Paper, and "Download all documents" stays removed.

**Interactivity found and fixed:** closing a sheet with Escape dropped focus on the page body (no trigger to return to); `components/ui2/sheet.tsx` now returns focus to what opened it. Checked and fine: the Receive screen's icon buttons and inputs are named; the Next button stays off until each price change is confirmed and says why; no console errors on the screens above.

## Coupling
Reads `_shared` (shell, states kit, permissions, phone parts) and `components/ui2`. The supplier page (`suppliers/components/supplier-purchasing-tabs.tsx`, `supplier-page-screen.tsx`) and the audit log screen import from here.

## Decisions
Q-01 to Q-13 answered 4 Oct 2026; Q-14 and Q-15 on 5 Oct 2026 (payments need no approval; a voided invoice stays on the statement, struck through). Paying more than is owed is blocked on screen as Paper draws it; the API keeps `confirmOverpay` (Q-16, the client decides).
