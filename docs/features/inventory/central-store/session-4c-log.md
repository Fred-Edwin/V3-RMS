# Central Store catalog — Session 4c log (frontend follow-up: the pieces Session 4 hid)

Date: 2026-10-03 · Branch: `feat/central-store-catalog-ui-2` (from `main` @ `0113d1a`, PRs #55 and #56 merged) · Frontend only. Backend: Session 4b (`session-4b-log.md`, API_CONTRACT.md §30).

## What was built (against the Session 4 "deferred" table)
| # | Was hidden | Now |
|---|---|---|
| 1 | Suppliers column | `SUPPLIERS` column (90px, right-aligned, mono): the count, "—" when none, blank on a retired row |
| 2 | Counts on the type chips | Counts on Stocked / Raw ingredient / Prepped (from `meta.typeCounts`) |
| 3 | "1 added by an attendant" | The Added-this-week cell reads "N added by an attendant" when N > 0, else "in the last 7 days" |
| 4 | Usual price | **Usual price** (optional) in Add item, after the pack preview: `KES [8,900] per bag = KES 178 per kg`. Add only; hidden for Prepped. Sent as `usualPrice` per buy unit, commas stripped |
| 5 | Their price | **Their price** (optional) in Add who sells it, between their name/code and "How they sell it": `per 50 kg bag = KES 178 per kg`, for the item's own pack or the different pack chosen. Sent as `price`. The item page shows "Price set by {name} on {date}. Updates from signed receipts." (or "Price from a signed receipt on …") |
| 6 | "Their name:" under a code match | Third line under "MATCHED Samrat code 190099" |
| 7 | History panel | **HISTORY** on the item page: time (mono, 92px) and "{who} {what}" ("Created by …" for creation); a stored reason shows as "Reason: …". "Nothing recorded yet" for items made before history existed |
| 8 | Newest first | After Create the list shows newest first so the new row is on top and tinted (replaces the search-by-name workaround). Any filter the user then changes ends it |
| 9 | Low or out filter | The Low-or-out cell is now a real filter (`lowOrOut=true`, Store Manager). It no longer opens the old Restock levels drawer (the item page link still does until Session 5). The "All" chip clears it |
| 10 | On hand | Item page "On hand" is now the Central Store figure (`centralStoreOnHand`), not the all-locations total |
| 11 | "Logged for …" | The Item added bar reads "S4 Test Price sugar added. Logged for {your name}." |

Also: types and the history service mirrored for §30 (`supplierCount`, `matchedOn.supplierItemName`, `typeCounts`, `addedByAttendant`, `centralStoreOnHand`, `lastPriceSetBy`, `ItemHistoryEntry`, `usualPrice`, `price`, `lowOrOut`, `sort`). The empty-state card is now centred (it sat at the left). The restock-level history and put-back types are **not** mirrored: Session 5 builds the screens that use them.

## Decisions I took (small; say if you want any changed)
- **Their price** carries "optional" beside the label (Paper does not): the backend accepts a line with no price, and the item page already shows "first receipt sets it" for that case. Usual price is "optional" in Paper.
- The reason field stays out (owner decision, Session 4); the backend takes one, so adding it later is a frontend-only change.
- The "newest first" order after Create is not drawn in Paper; Paper shows the new row at the top, which this reproduces.
- The Low-or-out cell, once on, shows the same "active" tint as Needs setup.

## Parity (by eye plus measured computed styles)
| Element | Tier | Measured vs Paper | Result |
|---|---|---|---|
| Catalog with Suppliers column and chip counts (01) | A | column 90px right-aligned, header mono 10, cells mono 13, chip counts mono 11 muted | Match |
| Search match with their name (1b) | B | MATCHED line, supplier name 12 muted, code mono 12, "Their name:" 12/16 faint; screenshot pair | Match |
| Usual price (02) | B | box 190×38, padding 12, gap 8, "KES" mono 12 muted, number mono 14/18, "per bag" 12 muted, "= KES 178 per kg" mono 13/16 ink, label mono 10 +0.06em, "optional" 12/16 | Match |
| Their price (06) | B | same field at 210px; per-unit text for the item's pack ("per 50 kg bag") | Match |
| Item page: price note and History (07) | A | note 12/16; history row padding 9, gap 14, time mono 11 / 92px, text 13/18; label mono 10 | Match (Paper's last history row is 13/16, the first 13/18; built at 18 throughout) |
| Item added bar (04) | B | new row on top, tinted, tag; bar text with "Logged for" | Match |

## Browser verification (Store Manager and Store Attendant, real backend)
- Add item: typed `8,900` per bag, 50 kg → "= KES 178 per kg"; `abc` → "Enter an amount like 8,900 or 380.50."; the POST carried `"usualPrice":"8900"`.
- Create → the new item is the first row, tinted with "New · add a supplier", and the bar says "Logged for {name}". The strip, chip counts and Suppliers column update.
- Add who sells it: Samrat, their name and code, `8,900` per bag → POST carried `"price":"8900","isPreferred":true`; the item page shows "Price set by … on 03 Oct", "KES 8,900 / bag" and "KES 178 / kg", and History lists "added Samrat Supermarket Ltd (bag of 50 kg) at KES 8,900 per bag, preferred" above "Created by …".
- Low or out cell → 1 row, only that cell tinted, "All" inactive; All → clears it. Search `190099` → one row "MATCHED Samrat Supermarket Ltd code 190099 / Their name: Sugar Brown 50KG", Suppliers 1.
- Attendant: no restock column and no Low-or-out cell, Suppliers column and chip counts shown; the list and item responses carry no cost or restock keys; `lowOrOut=true` and the history call are refused (403); `meta.lowOrOut` is null.
- Zero console errors in the flows; all requests 2xx apart from the expected attendant refusals.

## Commands run
`git checkout -b feat/central-store-catalog-ui-2` · `npx tsc --noEmit` · `npx eslint` (touched files) · `pnpm test` · `pnpm build` (frontend; wds-token check clean).
**Result:** frontend tests 14 files / 115 tests (was 103; +12); `pnpm build` passes; lint clean for every touched file. Backend untouched.

## Files
New: `components/catalog/price-field.tsx`, `lib/item-price.ts` (+ test). Edited: `catalog-table.tsx`, `catalog-filters.tsx`, `item-detail-view.tsx`, `item-form-view.tsx`, `add-seller-view.tsx`, `item-drawers.tsx`, `item-catalog-screen.tsx`, `use-item-catalog.ts`, `use-item-form.ts`, `inventory-api-service.ts`, `types/index.ts`, `lib/item-form-model.ts` (+ test).

## For the next session (Session 5 — restock levels)
- Backend is ready: `GET /restock-levels/history` and `POST /restock-levels/changes/:id/put-back` (§30.5), the strip and the suggestions (§29).
- `RestockLevelsDrawer` is still opened from the item page's "Restock levels →" link and from the Stock screens; Session 5 replaces it and should repoint this link.
- Still open from the Session 4 log, unchanged: square corners vs 2px, the shared topbar differences, the "Same pack as usual" copy, and receipts' price moves not appearing in an item's history.
