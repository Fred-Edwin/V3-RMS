# Central Store — Session 5 log (Part C, Session B: Restock levels page)

Date: 2026-10-03 · Branch: `feat/central-store-restock-ui` (from `main` @ `d42708a`; PR #57 confirmed merged) · Design: Approved designs file, chapter 3 (steps 11, 12, 13), read with the Paper MCP.
**Frontend, plus one small owner-approved backend endpoint** (see "Questions asked"). Nothing else under `backend/` changed.

## What was built
| Step | What | Where |
|---|---|---|
| Foundation | Types for the "whose levels" query, row status/suggestion, save input (scope, branchId, reason), summary, history entry, branch option. Services: summary, history, put back, branches. Hooks: page data and edits, history with put back, branches, unsaved-changes guard. Pure logic with 23 unit tests. | `types/index.ts`, `services/inventory-api-service.ts`, `hooks/use-restock-levels-page.ts`, `use-restock-history.ts`, `use-restock-branches.ts`, `use-unsaved-changes-guard.ts`, `lib/restock-logic.ts` (+ test) |
| 11 | Page `/app/inventory/stock/restock-levels`: breadcrumb and "Change history"; title and subtitle; "Whose levels" switch with a branch select; four-number strip (cells filter the rows); tabs and search; table with level inputs, old value "150 →", suggestions; unsaved bar | `screens/store-restock-levels-screen.tsx`, `restock/whose-levels-switch.tsx`, `restock/restock-table.tsx`, `restock/unsaved-bar.tsx` |
| 12 | Review dialog: Item / Now / After / Effect, warning box, optional note (sent as `reason`, 200 max), Back, "Save N changes"; one PUT with only the changed levels; an error stays in the dialog and keeps the note | `restock/review-dialog.tsx` |
| 13 | Level history drawer (one item, or the recent changes across items from the header button), "Put back N" on every row that replaced an earlier level; 409 and 400 shown inline | `restock/history-drawer.tsx` (built on the Session 4 `DrawerHost`/`DrawerFrame`) |
| E | Every use of the old drawer replaced by navigation; old drawer file deleted | see Files |

### Page behaviour worth knowing
- Edits are the text typed in each field. What changed is worked out from them, so typing the saved level back is "no change". Only changed levels are sent. Empty clears a level. A value that is not a number gets a red field and blocks Review ("1 level needs fixing first").
- Search is server-side (debounced 250 ms), only the latest request writes state. Edits for rows outside the current search are kept, and the review dialog still names them (rows seen are remembered).
- Tabs: **Low and Out first** = items that have a level, Out then Low then OK, by name · **All items** = everything by name · **No level set**. A strip cell replaces the tab as the filter (Out, Low, No level set, Suggestions differ); tap again to clear.
- Suggestion cell: "{S} {unit}" is a button that fills the level. Verdict word: **applied** (typed = suggestion and it changed), **matches** (typed = suggestion = saved), **close** (within 20 %), **you chose higher** (more than 20 % above), **you chose lower** (my addition, more than 20 % below). No suggestion: "Needs 14 days of use first" (`NEEDS_HISTORY`) or "No use recorded yet".
- Switching "whose levels" with unsaved edits asks first ("Discard unsaved changes?").

## Questions asked and answers
1. **Review-dialog warning copy.** The Purchasing page does not suggest Low items: its new-purchase catalog only marks them with an amber dot and has an optional "Low stock only" filter, and no "Needs restocking" list exists. I asked. **Owner: keep it as drawn** ("the Needs restocking list comes in later sessions"). Shipped as drawn in both the review dialog and the page subtitle.
2. **Branch list.** `GET /branches` is Director/Admin/Accountant/HR only (Store Manager gets 403, checked live), so decision 1 (branch select) could not work. I asked. **Owner: small backend change now.** Added `GET /inventory/restock-levels/branches` (SM, hub-scoped) → `[{id, name}]`, active non-hub branches. Contract test added, `API_CONTRACT.md` §30.6 written. This is the only backend change.
3. **"Search bar"** (owner message mid-session): the page already has "Search items" in the tab row, as drawn. I had hidden the shared top-bar search because Paper's step 11 topbar has none. Left as drawn; the owner can say if they want the top-bar one restored too.

## Decisions I took (say if you want any changed)
- **Leaving with unsaved edits** (the "small decision for you"): `beforeunload` for closing/reloading the tab, plus a "Leave without saving?" dialog when a link inside the app is followed (sidebar, breadcrumb, buttons that are links), plus the scope-switch confirm. The browser **Back button is not guarded** (App Router has no hook for it).
- "Low and Out first" leaves out items with no level (the 219 no-level items would bury the list; they have their own tab).
- Review "Effect" wording beyond the four drawn: Stays Out, Stays OK, Level set (first level, still OK), Level cleared.
- Put back is **one tap, no review step**. The Paper note under the list says "adds a new entry after a review"; I wrote "adds a new entry" because nothing reviews it. The decisions doc says "Put back in one tap" for Department Heads. **Open: should the Store Manager's put back have a review?**
- Review dialog "Effect" column is 240 px, not 210: "Becomes Low · 15 kg on hand" wraps at 210.
- The branch select reads "AT [Nyeri Town ▾]" beside the chips and the note under the switch names the department and branch. Not drawn in Paper (decision 1).
- Subtitle for a department: "How much to keep in the Kitchen at Nyeri Town. Below the level an item shows as Low and is suggested for the next order." (Paper only draws the Central Store one.)
- No phone layout for the Store Manager (none drawn). The page scrolls horizontally under 1020 px.
- Shared components touched, minimally: `Topbar` gets `hideSearch`; `CatalogKpiStrip` cells get `error` (red top edge and value) and `arrow` (arrow on a cell that is not toned) because Paper draws all four arrows and a red Out cell.

## Parity (Tier A: page, review dialog, drawer; measured with `getComputedStyle` against Paper `get_jsx`)
| Element | Paper | Live | Result |
|---|---|---|---|
| Title | 24/30 600, -0.01em, ink | 24/30 600 | Match |
| Strip value / label | 30/34 600 / mono 10/12 +0.06em, muted | same | Match |
| Table header | mono 10/12 +0.06em ink, ink rule | same | Match |
| Row | 54 high, name 14/18 500, unit 12/16 faint, tint `espresso-50` on a changed row | 54, same, tint resolves to the same colour | Match |
| Level input | 84×32, mono 13, changed: 1.5 px primary edge, 600 | 84×32, same | Match |
| Chips | 30 high, 13/16, active ink fill | same | Match |
| Unsaved bar | border-strong box, py 12 px 16, 8 px dot, "Review changes" lg | same | Match |
| Review dialog | 600 wide, 20/26 title, 32 high header row, 48 high rows, warning box, note field 38 high | same except Effect column 240 | Match, 1 deviation (above) |
| History drawer | 460 wide, header 20/26, WHEN 100 / CHANGE / 110 column, "Put back N" 110×30 | same | Match |

By eye (screenshots of Paper and the live page, same state): spacing rhythm, hairlines, lanes line up. Paper inconsistencies, not copied: "55 portions · close" is ink while the other "close" lines are faint (I used faint for all but "applied"); Paper's Cooking oil row shows OK with 80 on hand and a 60 → 100 change (consistent with "Becomes Low"). The shared topbar differs slightly from Paper (known, left). The Playwright window reports a 1920×1200 CSS viewport at 0.75 scale and ignores resize, so layout width differs from Paper's 1440; computed values (font, padding, heights) are unaffected.

## Browser verification (real backend; Store Manager, Store Attendant, Kitchen head)
- **Store Manager, Central Store.** Set levels on Sugar, white (150) and Sugar, brown (80), reviewed, saved. `restock_level_changes`: one row per changed level, `old_level` null → new, `changed_by` the manager. A second save (Sugar, white → 270, Icing sugar → 40) with the note "S5 Test: weekend market orders" stored that text as `reason` on both rows; Sugar, brown (unchanged) wrote nothing. The review named Sugar, white although the search showed only Icing sugar.
- Statuses and effects: Icing sugar (15 on hand, level 40) "Becomes Low · 15 kg on hand"; new levels on items with 0 on hand "Becomes Out"; Sugar, white "Stays Low · 42 kg on hand".
- Strip: Out 1, Low 2, No level set 216, Suggestions differ 1 (counts moved after each save). Suggestions differ → 1 row (Sugar, white "269.98 kg · you chose lower, 18 kg a day, 15 days of cover"). Tapping the figure filled 270 and read "applied". Tabs and search work.
- **History.** Item name opens the item's drawer (when, who, "150 → 270 kg", reason, "First level for this item"). "Put back 150" added a new entry "270 → 150 kg · Put back" and the page's status/strip refreshed. Putting back an older entry whose value was already current → 409, shown inline: "The level is already 150 kg". The 400 ("Nothing to put back: this was the first level set for the item") is only reachable from the API, since the first entry has no Put back button; confirmed with curl and the UI renders any message in the same banner. Header "Change history" shows recent changes across items with item names.
- **Department scope.** Kitchen → branch select (Nyeri Town default, 131 items); switched to Nyeri Highway, set Aluminium foil = 12, saved: the row landed on location "Nyeri Highway — Kitchen" (`scope=KITCHEN`, `branchId`).
- **Guard / Discard.** Edit then Central Store chip → "Discard unsaved changes?" → Keep editing keeps the edit. Edit then sidebar "Receiving" → "Leave without saving?" (URL unchanged) → Stay here. Discard clears the edit and removes the bar.
- **Entry points.** Stock hub "Restock levels" and the catalog item page's "Restock levels →" both land on the new page (the other stock screens share `StockTopbar`, whose button is now a link).
- **Store Attendant.** The page shows "Not available for your role" with no restock request made; `GET restock-levels`, `/summary`, `/history`, `/branches` all 403 by curl. No restock link in the attendant's views.
- **Kitchen head** on `/app/inventory/restock-levels`: the old phone screen loads its Kitchen rows and works; the new row fields did not break it.
- Console: zero errors in the flows, except the two lines for the intentional 409 (browser network error plus the shared apiClient's `console.error`). All other calls 2xx.
- Seed used for suggestions: 7 `inventory_transactions` rows reasoned "S5 Test seed" on Sugar, white / brown / Icing sugar at the Central Store (local database only).

## Commands run
`git checkout main && git pull` (log shows #57) · `git checkout -b feat/central-store-restock-ui` · `docker compose up -d postgres redis` · `npx prisma migrate status` (up to date) · `pnpm dev` (backend, frontend) · `npx vitest run` (restock-logic, backend contract) · `npx tsc --noEmit` (frontend, backend) · `npx eslint` (touched files) · `cd backend && pnpm build && pnpm test` · `cd frontend && pnpm test && pnpm build`.
**Results:** backend build OK, **1508 tests pass** (104 files). Frontend **138 tests pass** (was 115; +23), `pnpm build` passes (wds-token check clean). Lint: every file I wrote is clean; 11 errors remain in files that had them at HEAD (e.g. unused `Reveal`, `shortName`, `COUNTS_HREF` in `stock-counts-screen.tsx`, `KpiValueSkeleton` in `stock-hub-screen.tsx`, and others in files I did not touch) — verified against `git show HEAD:`.

## Files
- **New (frontend):** `app/app/inventory/(shell)/stock/restock-levels/page.tsx`; `features/inventory/components/screens/store-restock-levels-screen.tsx`; `components/restock/{whose-levels-switch,restock-table,unsaved-bar,review-dialog,history-drawer}.tsx`; `hooks/{use-restock-levels-page,use-restock-history,use-restock-branches,use-unsaved-changes-guard}.ts`; `lib/restock-logic.ts` + `.test.ts`.
- **Edited (frontend):** `types/index.ts`, `services/inventory-api-service.ts`, `index.ts` (export), `components/app/shell/topbar.tsx` (`hideSearch`), `catalog/catalog-kpi-strip.tsx` (`error`, `arrow`), `stock/stock-topbar.tsx` (button is a link; `onRestockLevels`/`restockTriggerRef` props removed), `item-catalog-screen.tsx` (pushes to the page), `stock-hub-screen.tsx` (mobile button is a link; drawers removed), `stock-items-screen.tsx`, `stock-counts-screen.tsx`, `spot-count-screen.tsx`, `stock-ledger-screen.tsx` (drawer, its state and the unused Central Store id lookups removed).
- **Deleted:** `features/inventory/components/screens/restock-levels-screen.tsx` (the drawer; `git grep` finds nothing else importing it).
- **Kept on purpose:** `restock-level-grid.tsx`, `use-restock-levels.ts`, `department-restock-levels-screen.tsx` (Department Head phone screen, dev gallery pages), `use-central-store-location.ts` (still used by other screens).
- **Backend (owner-approved):** `inventory-routes.ts`, `-controller.ts`, `-service.ts` (`listRestockBranches`), `-validators.ts` (`RestockBranchOptionSchema`), `inventory.types.ts`, `repositories/branch-repository.ts` (`findActiveBranchOptions`), `inventory-contract.test.ts` (+2 tests). **Docs:** `API_CONTRACT.md` §30.6.

## Deferred to the backend session
Both items were done in the follow-up below (branch `feat/restock-backend-batch`). Only meal services ("at lunch") remain, by decision: the page says "{n} a day".

## Follow-up: the small backend batch (3 Oct 2026, after #59 merged)
| What | Detail |
|---|---|
| Item type on the restock row | `itemType` on every row (§30.7). The page writes "kg · Prepped" under the unit for Prepped items. |
| Days of cover per item | Owner answers: an **optional field on the item**; drop "at lunch". Migration `add_item_days_of_cover` (one nullable `Decimal(6,2)` column). Item create/update take `daysOfCover` (Store Manager only; omitted from attendant responses; an attendant sending it gets 403). The suggestion uses the item's cover, else 15. Each restock row returns the cover it used. The history logs set / changed / cleared. Contract §30.8, `DATA_MODEL.md` updated. |
| Frontend | "Days of cover" field in the Add/Edit item drawer (after the restock level; optional; "days" suffix; 1 to 365, 2 decimals), a "suggestions cover N days" note on the item page, the suggestion line "{n} a day, {cover} days of cover". |
| Not in Paper | The Days of cover field in the item drawer is not drawn (the owner chose to set it there); needs a design pass or sign-off. |
| Checked | Backend 1512 tests pass (+4). Frontend 141 pass (+3). In the browser: set 5 days on Sugar, white → history "set the days of cover to 5" → Restock levels reads "17.98 kg a day, 5 days of cover", suggestion 89.9; Prepped rows show "portion · Prepped"; attendant's item response has no `daysOfCover`. |

## Surprising / for the next session
- **Two Next dev servers on one `.next` corrupt it** (static chunks 404, login does nothing). One was already running on port 3000 before the session started; I stopped both and started one. Worth remembering when a "can't log in" happens locally.
- **chrome-devtools MCP could not start:** a Chrome (pid 1207610) started before the session already held its profile. I did not kill it; verification ran on the Playwright MCP instead (CLAUDE.md allows either). Close that Chrome to get chrome-devtools back.
- The shared success toast sits on top of the topbar's right edge, covering "Change history" for a few seconds after a save, and it overlays the drawer's title when the drawer is open. Shared component, not changed.
- Session 6 (suppliers and Purchasing): the shared `CatalogKpiStrip` now takes `error` and `arrow` per cell; the shared `Topbar` takes `hideSearch`; `DrawerHost`/`DrawerFrame` carry the history drawer unchanged, a good fit for supplier drawers too. The page title says Low items are "suggested for the next order" on Purchasing: the owner expects the Needs restocking list there.
