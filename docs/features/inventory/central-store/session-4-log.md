# Central Store catalog — Session 4 log (Part C, Session A: catalog and item screens)

Date: 2026-10-03 · Branch: `feat/central-store-catalog-ui-1` (from `main` @ `2ed9fc7`, PR #54 merged) · Frontend only.
Chapters built: 0 (type labels), 1 (catalog, Add item, similar-name warning, Item added, 1b search match), 2 (item page, Add who sells it, Edit item, Review the change incl. 9b no-history, Manage categories). Out of scope and not built: restock levels page, suppliers, Purchasing, phones.

## Questions asked and answers (owner, in session)
1. **Reason on risky changes and history panel.** `PATCH /inventory/items/:id` takes no reason and no item-change history exists. Owner: **do not include the reason.** Built: the review step with no reason field and no history panel; the "Saved in the Audit log … with this reason" box is not drawn (nothing writes that line today).
2. **Gaps between the design and the list/create API.** Owner: **hide until the backend adds them**, and a small backend session follows, then the skipped frontend pieces are built in the same Part C run. Hidden: Suppliers column, counts on the type chips. **Usual price** omitted from Add item.
3. **On hand and "added by an attendant".** Item page "On hand" comes from `GET …/change-review` (all locations); the Added-this-week cell says "in the last 7 days".
4. **How to run locally.** `docker compose up api` needs a ghcr login, so the backend ran from source (`pnpm dev` in `backend/` against the Docker Postgres/Redis) and the frontend with `pnpm dev`.
5. Owner also asked that the `run-frontend-browser` skill not be used; the chrome-devtools MCP drove the browser.

## Deferred to the backend session (everything the frontend skipped)
| # | Needed from the backend | Frontend piece waiting |
|---|---|---|
| 1 | `supplierCount` on each list row | Suppliers column (step 01) |
| 2 | Per-type counts in list `meta` (`typeCounts`) | Counts on All / Stocked / Raw ingredient / Prepped chips |
| 3 | Count of items added by an attendant (e.g. `meta.addedByAttendant`) | "1 added by an attendant" under Added this week |
| 4 | `currentCost` (usual price) accepted on `POST /inventory/items` | "Usual price … = KES 178 per kg" in Add item (step 02) |
| 5 | A hand-set price on a supplier line (`POST/PUT …/suppliers/:id/items`, logged with who and when) | "Their price" in Add who sells it (step 06); "Price set by Isabel Njoki on 12 Oct" on the item page |
| 6 | `supplierItemName` inside `matchedOn` | "Their name: Zesta Chilli Sauce 15G" under a code match (step 1b) |
| 7 | Reason on `PATCH` and an item-change history read endpoint | "Why is it changing?" and the History panel (steps 05, 07, 09) |
| 8 | A list sort (newest first) | Today a new item is found by narrowing the list to its name |
| 9 | A `lowOrOut=true` list filter | The Low or out strip cell filters the catalog (today it opens the old Restock levels drawer) |
| 10 | Central Store on-hand per item on `GET /items/:id` | Item page "On hand" is the all-locations figure from change-review |
| 11 | Audit entries for item create / edit / retire | "Logged for Isabel Njoki" in the Item added bar |

## Open decisions for the owner (not decided silently)
- **Paper draws square corners** on chips, cards, tables and inputs; the primitives and tokens use 2px (`rounded-wds-sm`). Built with the system's 2px everywhere and not changed. Confirm 2px stays.
- **Shared Topbar:** Paper draws the catalog search as a plain 380px box; the shell search has a magnifier, `⌘K` hint, `border` (not `border-strong`) and is 12px breadcrumb (Paper 13px). Width set to 380px on this page only; the rest left, since the shell is shared by every screen.
- **"Same pack as usual" copy (step 06) contradicts itself**: the label says "Same pack as usual" but the helper says "Tick only if Samrat sells a different pack". Built the checkbox as drawn, **ticked by default**, with the helper reworded to "Untick only if …". Confirm.
- **Needs setup meaning.** The strip says "no supplier or category yet" in Paper; the backend's definition is placeholder units (§29.3). The cell reads "pack or units not set yet". The item page banner lists what is actually missing (pack and units, who sells it, category).
- **Paper `--color-primary` (#B0610F)** is the selected-chip / focused-field edge in these screens; the wds `primary` is espresso-700 (#693C1B). Added one alias token `--wds-selected-edge` (= `--wds-primary-btn-start`, same hex) rather than hard-coding the hex.
- **Restock levels link** on the item page and the Low or out cell open the existing Restock levels drawer until Session 5 replaces it.
- **Close button** is 20px muted as Paper draws; the shared `Sheet` close is 16px, so the catalog drawers use their own shell (`DrawerHost`/`DrawerFrame`) and are 460px (Paper) not 500px.

## What changed
- **Chapter 0:** one label map `lib/item-labels.ts` (Stocked / Raw ingredient, "Raw" on phone / Prepped; dot colours; explainers; unit and department lists).
- **Catalog** (`components/catalog/`): `CatalogKpiStrip` (cells are one-tap filters: Items tracked clears filters, Needs setup toggles `?needsSetup=true`, Low or out opens Restock levels; `lowOrOut: null` removes that cell for attendants), `CatalogFilters`, `CatalogTable` (supplier-match line from `matchedOn`, retired rows faint, restock column hidden for attendants), `ItemAddedBar`. Search is debounced; only the latest response writes state.
- **Drawers** (one Radix dialog so item page → edit → review swaps content): Add / Edit item with the type chips and explainers, fields that change with the type, "One holds" feeding both conversion and pack, similar-name warning (last word of the typed name, debounced), Item page, Add who sells it (their name and code, a different pack gets its own line, 409 `PACK_LINE_EXISTS` inline, preferred switch), Review the change (edit and retire, no-history wording from `hasHistory`), Manage categories (add, rename inline, retire, restore).
- **Pure logic with tests:** `lib/item-form-model.ts` (values, validation, create and edit payloads, what counts as a risky change), `lib/item-review.ts` (sentences from the change-review counts), `lib/item-format.ts`. 29 new unit tests.
- **Types** mirror §28–29: `ItemCatalogMeta` (+`needsSetup`, `lowOrOut`, `addedThisWeek`), `ItemMatchedOn`, `InventoryItemListRow`, `ItemSupplierLine`, `InventoryItemDetail`, `ItemChangeReview`, `AddSupplierLineInput`. The attendant omits four money fields at runtime; `InventoryItem` still declares them for the manager paths (documented on the type).
- **Combobox** gained `chevron` (a closed-select look, no clear button) and `name`.
- **Behaviour decisions:** a same-unit item saved without a pack states a conversion of 1 (this takes it out of Needs setup); an item stored with conversion 1 for the same unit reads back as "no pack", so an unrelated edit is not a pack change (found in the browser, test added). A Prepped item gets no "New · add a supplier" tag and its bar action is "Open item →". After Create the list narrows to the new item's name so the tinted row is visible (the list sorts by name).

## Retired in this session
`item-catalog-table.tsx`, `item-form.tsx`, `item-form-validation.ts` (+ its test), `category-manager-list.tsx`, `item-type-icon.tsx`, `screens/item-form-screen.tsx`, `screens/category-manager-screen.tsx`, the catalog skeletons in `skeletons.tsx`, and the unused `inventory-mock-service.ts` and `mock-data.ts` (nothing imported them). The three dev-gallery specimens of the deleted components were removed from `app/dev/wds` and `app/dev/wds-diff`. Not touched (Session 7): deprecated supplier keys and aliases, supplier screens, `types/index.ts` supplier types.

## Follow-up after owner feedback (3 Oct 2026)
- **The phone catalog did not scroll.** The inventory shell wraps pages in `h-screen overflow-hidden`; the phone branch had no scroll container of its own. It now follows the pattern of the other phone screens: fixed header, a search box and category pills pinned above a list that scrolls inside `<main>`, and the Categories / New item buttons pinned at the bottom. The list also had no way past the first 20 items on a phone, so Previous / Next sit under the list; the list returns to the top on any filter or page change.
- **Category pills (phone):** `All` plus one pill per live category with its item count, scrolling sideways; tapping a pill filters the list, tapping it again clears it. Squared (2px) like the other chips, as the owner asked. This is an addition to the drawn phone layout (not in Paper); the phone redesign in Session 7 should keep or redraw it.
- Verified at 390px emulated: the list scrolls, pills filter (Beverages → 21 items, first "Coffee beans"), paging works (Page 2 of 11), no page-level horizontal scroll.

## Parity notes (by eye plus measured computed styles)
| Screen | Tier | Anchors measured | Result |
|---|---|---|---|
| Catalog (01) | A | title 24/30/600 −0.01em, KPI label mono 10/12 +0.06em, value 30/34/600 −0.025em, sub 12/16, chips 30px, header row 34px, rows 46px, mono 12px "How we buy", footer 12/16 | All match Paper. Topbar search/breadcrumb differ (shell, see open decisions). |
| Search match (1b) | B | MATCHED line mono 10 warning, supplier name 12 muted, code mono 12 ink; screenshot pair | Match, except "Their name: …" line (backend gap 6). |
| Add item (02, 03) | A | drawer 460px, header 20/16/24, eyebrow mono 10 +0.08em, title 20/26/600, name field 40px with 1.5px selected edge, type chips 36px gap 8 (selected espresso-50, 600), explainer 12/16, unit fields 38px, dept chips 30px, footer 16/24 | Match. Footer button padding was 16 (primitive) vs Paper 18 / 22: fixed. Usual price absent (gap 4). Similar-item box matches step 03. |
| Item added (04) | B | dark bar, 8px green dot, caramel link; tinted row and tag | Match; "Logged for …" omitted (gap 11). |
| Item page (05, 07) | A | title 22/28/600, section labels, fact rows 9px, restock card 12/14, supplier rows 12px, tag 11px, footer | Match. History panel omitted (gap 7); price line says "From a signed receipt" instead of a setter name (gap 5). |
| Add who sells it (06) | A | by eye against the artboard | Layout matches; Their price omitted (gap 5). |
| Edit item (08) | B | same form filled in, "was 25" marker, amber pack note, "Review change" | Match. |
| Review (09, 09b) | A/B | table header 32px, rows 44px, bullets with dots (green / amber) | Match; the reason chips and the audit-log box are not drawn (owner decision). |
| Manage categories (10) | A | list header 32px, rows 46px, inline rename row full-bleed espresso-50, Retired block | Match. Wording uses Retire / Restore as drawn (was Archive). |

## Browser verification (Store Manager `store.manager@wendo.test`, Store Attendant `store.attendant@wendo.test`)
- Added one item of each type: Stocked (Brown sugar, 1 bag = 50 kg, Kitchen + Barista, level 100 → `{"conversionFactor":"50","packSize":"50",…}` confirmed in the request), Raw ingredient (hides Used by), Prepped (hides the buying fields). The similar-name warning appears inside the drawer.
- Search by a supplier's code (`190021`) → one row, "MATCHED Demka Dairy code 190021". Needs setup filter → `needsSetup=true`, oldest first (145 items).
- Add who sells it with two pack lines for the same supplier (50 kg bag and 2 kg packet); a repeat of the same pack → the 409 message shown inline ("Demka Dairy already has this pack: … (their code 190021)").
- Edit with review: pack 50 → 48 kg shows the review with the no-history wording; confirmed. Retire → review → confirm; the item leaves the list; Restore from the item page brings it back.
- Manage categories: add, rename, retire, restore.
- All requests 2xx; zero console errors (one pre-existing meta warning).
- **Attendant:** the catalog shows no restock level column, no Low or out cell, no New item, no Manage categories; `GET /inventory/items` and `/:id` carry none of `currentCost`, `centralStoreRestockLevel`, `preferredSupplier`, `lastPrice`; `meta.lowOrOut` is null. The receiving screen loads with no errors; there are no expected deliveries locally, so the receiving item picker itself was not exercised.
- Phone width (390px emulated): the catalog list and the drawers fit without horizontal scroll; the drawer footer clipped "Create item" and was fixed. The phone layout is the previous one and is Session 7's.

## Commands run
`git checkout main && git pull` · `git checkout -b feat/central-store-catalog-ui-1` · `npx prisma migrate status` (up to date) · `pnpm dev` (backend and frontend) · `npx tsc --noEmit` · `npx eslint …` · `pnpm test` (frontend) · `pnpm build` (frontend) · `cd backend && pnpm build && pnpm test`.
**Results:** frontend `pnpm build` passes (wds-token check clean); frontend tests 13 files / 103 tests; backend `pnpm build` clean, `pnpm test` 102 files / 1455 tests (unchanged). `pnpm lint` is clean for every file touched; 11 errors remain in files this session did not touch (`stock-counts-screen`, `stock-hub-screen`, `department-restock-levels-screen`, `new-prep-run-screen`, `prep-runs-list-screen`, `new-goods-receipt-mobile`, `use-count-verification`, `use-goods-receipt-form`).

## Files touched
New: `frontend/features/inventory/components/catalog/` (`catalog-filters`, `catalog-kpi-strip`, `catalog-table`, `catalog-toast`, `drawer-parts`, `item-drawers`, `item-form-view`, `item-detail-view`, `item-review-view`, `add-seller-view`, `category-view`), `lib/item-labels.ts`, `lib/item-format.ts`, `lib/item-form-model.ts`, `lib/item-review.ts` (+ three test files), this log.
Edited: `item-catalog-screen.tsx`, `use-item-catalog.ts`, `use-item-form.ts`, `use-categories.ts`, `inventory-api-service.ts`, `services/index.ts`, `types/index.ts`, `skeletons.tsx`, `ui2/combobox.tsx`, `app/tokens.wds.css`, `tailwind.wds.preset.ts`, `app/dev/wds/page.tsx`, `app/dev/wds-diff/page.tsx`. Nothing in `backend/`.

## Surprising / for the next session
- The seeded dev logins in the skill (`manager1.centralstore@dev.test`) do not exist in this database; the real ones are `store.manager@wendo.test` and `store.attendant@wendo.test` (password `password123`).
- The local Docker `api` image cannot be pulled without a ghcr login; run the backend with `pnpm dev`.
- Restock levels (Session 5) must replace `RestockLevelsDrawer`, which the item page link, the Low or out cell, and the Stock screens still open.
- The list has 20 per page and 218+ items, so a small page bar sits in the footer line (not in Paper).
- Test rows named "S4 Test …" remain in the local database (items cannot be deleted; they are live or retired).
