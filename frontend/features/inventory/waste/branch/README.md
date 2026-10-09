# Waste · Branch (phone) — front end

Branch waste for a **department head or member**, on the phone column (a centred 390 to 480 px column at every width, no status bar, no bottom tabs). Paper: page "Inventory · Branch waste" W1 to W5 and step 55 on "Inventory · Counting redesign (Oct 7)". Spec: `docs/features/inventory/branch-waste-paper-spec.md` (with the owner's rulings); contract: `docs/features/inventory/branch-waste-contract.md`. **No money and no stock figure is ever shown here**, and no PIN.

| Screen | Route | File | Endpoint |
|---|---|---|---|
| W1 Pick what was wasted, W3 Check and log | `/app/waste/new` | `components/log-waste-flow.tsx` | BW1 `GET /items`, BW2 `POST /` |
| W2 How much, and why (sheet) | over W1 and W3 | `components/amount-sheet.tsx` | none |
| Step 55 Department waste, today and earlier (replaces W4) | `/app/waste` | `components/department-waste-screen.tsx` | BW3 `GET /mine` |
| W5 Reverse a wrong entry (sheet), reversed entry sheet | over step 55 | `components/reverse-sheet.tsx` | BW7 `POST /:id/reverse` |

Routes are thin shells in `app/app/waste/`. Nav rows: `department-waste` (head) and `member-waste` (member) in `components/app/shell/nav-table.ts`; `lib/route-access.ts` opens `/app/waste` to a head and the floor roles (the department rule itself is the API's).

**Status: on the real API** (BW1, BW2, BW3, BW7 at `/inventory/branch-waste`, `_shared/services/branch-waste-api.ts`, shared with the desktop; name and quantity wording in `_shared/lib/branch-waste-people.ts`). The mock and its flag are deleted. The old Log waste drawer, form and `/inventory/waste` calls are deleted too; the Stock topbar's "Log waste" now links to the Central Store drawer (`/stock/waste?drawer=log`).

Behaviour worth knowing
- The reason starts unchosen and is required (W2, W5); Add waits for a quantity above zero and a reason. "Other, add a note" needs a note on the reversal sheet.
- One idempotency key per open form (`hooks/use-branch-waste-cart.ts`); a failed log keeps every line and says so at the top.
- "you" marks the caller's rows (`loggedBy.id` against the signed-in user); Reverse shows only where the server says `can.reverse`. A reversed row is struck through; its "Reversed 09:12" chip opens a small sheet with the reason.
- The success banner shows once after logging (`?logged=1`, removed from the URL on arrival) and clears on refresh. Date range and page live in the URL (`from`, `to`, `page`), fifty entries a page.
- The department name in the header comes from BW3 (one small call, cached): the contract has no other endpoint that carries it.
- Kit options added for these screens (defaults unchanged): `Keypad look="paper"`, `ScwPhoneHeader place`, `PHONE_PRIMARY_BUTTON_TOKEN`, and `BottomSheet` now returns focus to what opened it.

Gaps from the spec (section 6) built in the same style: G1 empty Review, G2 plural and the discard dialog, G3 validation, G5 edit and remove a line, G6 saving and error, G8 states, G9 reversed-entry sheet, G13 reverse pending and errors, G14 "Other" note, G19 growing note, G20 sticky foot, G22 search results. Not applicable on the phone: G4 (a head or member is blind to stock, so no "below zero" chip). Items carry no category in the contract, so the search results are not grouped by category.

Tests: `lib/branch-waste-format.test.ts`, `lib/route-access.waste.test.ts`, nav rows in `nav-table.test.ts`; the contract mirror and fixtures are tested in `_shared/types/waste-contract.test.ts`.
