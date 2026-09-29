# Milestone Six — Session 1 — Frontend handoff (continue from here)

## Paste this into a fresh Claude Code session

> You are the build agent for Wendo RMS, Milestone Six, **Session 1 — Stock
> position & waste**, continuing a session that was paused mid-frontend. Read
> `docs/features/inventory/milestone-6-sessions/session-1-frontend-handoff.md`
> top to bottom first, then `session-1-plan.md` (the brief — its decisions
> are settled) and its "Outcome log" checkpoint. Work on branch
> `feat/m6-s1-stock-waste`. Pick up at "Next step" below and follow the
> per-screen gate for every remaining screen/state. Don't redo finished
> work; don't re-open settled decisions. If something here turns out wrong
> in the code, fix it and record the correction in the outcome log.

---

## 1. Where things stand (2026-09-29)

**Backend — done, committed** (`ea82101` on `feat/m6-s1-stock-waste`, not
pushed). Endpoints, migration, 35 new tests (1,031 total green), docs
backfill (`API_CONTRACT.md` §25 + §26.1, `DATA_MODEL.md` §4.66–4.69) and the
gate seed. Full details, example responses and every deviation from plan
§2.1 are in `session-1-plan.md` → Outcome log → "Checkpoint handoff —
backend". **Read that section; it is the API reference for the frontend.**

**Frontend — about half built, uncommitted** (all files are in the working
tree on the branch; see §4 for the file map).

| # | Screen / state | Status |
|---|---|---|
| 10 | Sidebar sub-link rail (`1BI5-0`) | **done**, gate passed (Daily/Spot count disabled with hint; no horizontal scrollbar — owner-reported, fixed) |
| 11 | Top-bar action set (`1B18-0`) | **done**, gate passed |
| 1 | Hub · SM desktop (`1AYW-0`) + loading (`1FG7-0`) + error | **done**, gate passed (eyeball, interactions, guidelines audit) |
| 2 | Hub · SM mobile (**`1J43-0`** — drawn by the owner 2026-09-25, replaces decision 2's "hidden REMOVED (A1) layers" instruction) | built, eyeballed after fixes; **finish** interaction audit (restock mobile opens, rows → ledger once ledger exists) |
| 2 | Hub · Attendant mobile (`188X-0`, empty `1G39-0`) | built, **not yet checked** — this is where the session stopped |
| 8 | Log waste · CS drawer (`18VZ-0`, submit error `1I1M-0`) | **done**, gate passed (validation, server search picker, submit, error banner, in-flight "Logging…", double-submit guard, dirty guard, focus in/out, toast, hub refresh + Postgres check) |
| 8 | Log waste · CS mobile (`1BX0-0`) | built, eyeballed after an overflow fix; **finish** attendant cost-only hint check |
| 3 | All items (`1B5U-0` / `1BRS-0`) | **not started** |
| 4 | Stock ledger · item selected (`197U-0` SM desktop / `1BPY-0` DH mobile) | **not started** |
| 5 | Stock ledger · no item (`1F7B-0` / `1FDY-0`) | **not started** |
| 6 | Restock levels · CS drawer (`18ZV-0`) / mobile (`1BV6-0`) | existing `RestockLevelsDrawer` is wired into the hub; **upgrade not done** (see §3) |
| 7 | Restock levels · Department (`1AEE-0`) | parity check only — not done |
| 9 | Log waste · Department (`1ACM-0`) at `/app/branch/waste/new` + DH landing wiring | **not started** (form/mobile screen already exist — just the route, export and wiring) |

Nothing in the frontend has been committed; nothing has been pushed.

## 2. Next step

1. Start the servers (§6) and sign in.
2. Finish the **attendant** check on the hub (`store.attendant@wendo.test`,
   mobile 390×844): three buttons as `188X-0` (Daily count disabled "Coming
   with counting", Log waste live, Restock levels disabled "Set by the Store
   Manager"), Today's count card, waste list — **no quantities anywhere**.
   Open Log waste: the item hint must read cost only. Confirm in the Network
   panel that `/inventory/stock/summary` and `/inventory/waste/items` carry
   no `onHand`.
3. Then continue the screens in demo order: All items → ledger
   (item-selected, then no-item) → restock (drawer + mobile, DH parity) →
   DH Log waste page + landing wiring.
4. `pnpm build` in `frontend/` (runs `check-wds-tokens`) → commit (frontend).
5. End-of-session: functional pass (SM, Attendant, DH demo from the plan's
   "Context"), Postgres checks (plan "Definition of done"), outcome log
   entries (one line per gate + summary), `milestone-6-plan.md` §8,
   `MILESTONES.md` Session 1 status.

## 3. Remaining screens — what each needs

Get values with `get_jsx` / `get_computed_styles` on the node IDs (file
`01M1ZZJ6S3FZGF5C7PPBGTKY89`, page `p-G-0`). Copy for loading/empty/error is
in `milestone-6-plan.md` §0.1. Interaction checklist per screen is in
`session-1-plan.md` ("Interaction checklist").

- **All items** — route `/app/inventory/stock/items` (thin shell in
  `app/app/inventory/(shell)/stock/items/page.tsx`). Uses `useStockList`
  (`hooks/use-stock.ts`) with `page`/`pageSize` 8 ("Page 1 of 18" with the
  seed), search debounced 250ms (`useDebouncedValue`) with clear button,
  type + category chips (top-level categories via the existing categories
  service), `belowRestock` / `negative` toggles. **Filters must live in the
  URL** (`?search=&type=&categoryId=&belowRestock=true&negative=true&page=`)
  — the hub KPI cards and the top-bar search already link here with
  `?belowRestock=true`, `?negative=true`, `?search=`. Reuse
  `StockTableRow` / `StockTableHeader` exported from
  `screens/stock-hub-screen.tsx` (move them to `components/stock/` if you
  prefer — they're shared). Empty = "No items match these filters" +
  **Clear filters**. Rows link to the ledger. Mobile `1BRS-0` uses the
  mobile list row pattern from the hub's `MobileOnHandCard`.
- **Stock ledger · item selected** — routes
  `/app/inventory/stock/ledger/[itemId]` (SM) and
  `/app/branch/ledger/[itemId]` (DH; the branch app has its own shell under
  `app/app/branch/(shell)/`). `useStockLedger(itemId, query)`. KPI strip
  (On hand now + "below restock level (N)", Current cost + "latest-price,
  set {currentCostSince}", Stock value, Location + category). Date-range
  toggle group (7 / 30 / 90 days / All time / Custom range…) → `from`/`to`
  on the API; type select → `type`. Running on-hand comes from the API — do
  not compute it in JS. Rows oldest-first as drawn. `?highlight=<txId>` row
  gets a one-time caramel fade + scrolls into view (use the transaction id;
  ADJ references are S2). Pagination. Empty range = "No movements in the
  last {range}" / "…since {lastMovementAt}…" + **Show 30 days**. With the
  seed, compare `197U-0` using the **30 days** toggle (coffee-bean rows are
  dated 8–12 days ago on purpose). DH mobile `1BPY-0` = Kitchen, Nyeri Town,
  Grilled chicken portion (in +14, adjustment −5 → 9 pcs). MANAGER is also
  allowed on this endpoint but must pass `locationId` — no MANAGER screen
  this session.
- **Stock ledger · no item** — `/app/inventory/stock/ledger` and
  `/app/branch/ledger`. Search focused on load; results from
  `listStock({search})` (SM) or the existing `listItems({departmentTag})`
  (DH — "Search 22 Kitchen items…"); "Recently viewed" is a per-viewer
  convenience in `localStorage` (wrap reads/writes in try/catch; write it
  when a ledger page opens).
- **Restock levels** — the hub opens the existing `RestockLevelsDrawer`
  (`screens/restock-levels-screen.tsx`). The grid (`restock-level-grid.tsx`)
  is **not** to be rewritten. The wrapper needs the §4.3 behaviours it lacks
  today: changed rows marked, live "flags it low right away" note, Save
  disabled until dirty (desktop already), **dirty-guard on close**,
  in-flight "Saving…", save error as the kit `FormErrorBanner` with edits
  kept, the §0.1 empty/error copy, 250ms drawer motion
  (`STOCK_DRAWER_MOTION`), focus return (`useReturnFocus`). Compare to
  `18ZV-0` / `1BV6-0`; `1AEE-0` (department) is a parity check of the
  existing `DepartmentRestockLevelsScreen`.
- **Log waste · Department** — route `/app/branch/waste/new` rendering
  `LogWasteMobile` with `asOverlay={false}` and `locationLabel` =
  "{Department}, {Branch}" (e.g. "Kitchen, Nyeri Town"; the user's
  `organizationName` + `departmentTag`). Export it from
  `features/inventory/index.ts`; wire the disabled "Log waste" placeholder
  in `features/requisitions/components/screens/department-landing-screen.tsx`
  (~L176–207) through that index only (no deep imports). Unit cost is the
  department's carried-in cost — the server already resolves it.

## 4. File map (frontend, this session)

- `features/inventory/types/stock.ts`, `types/waste.ts` — contract mirror.
- `features/inventory/services/stock-api-service.ts` — all six calls.
- `features/inventory/hooks/use-stock.ts` — `useResource` (keeps data on
  refetch → no skeleton flash), `useStockSummary`, `useStockList`,
  `useStockLedger`, `useWasteList`, `useWasteItemOptions`,
  `useDebouncedValue`.
- `features/inventory/components/stock/`
  - `stock-states.tsx` — the States kit pieces (`1I6L-0`): row skeletons,
    `KpiValueSkeleton` (`static` for error), `SkeletonRows`,
    `StockEmptyCard`, `StockErrorCard`, `FormErrorBanner`. **Use these for
    every state.**
  - `stock-format.ts` — U+2212 minus, KES formats, type/transaction/reason
    labels and tones.
  - `stock-topbar.tsx` — `StockTopbar` (breadcrumb, ⌘K search → All items,
    Thresholds/Spot count disabled) and `ComingSoonButton`.
  - `log-waste-form.tsx`, `log-waste-drawer.tsx` — form + desktop drawer +
    mobile screen, `useReturnFocus`, `STOCK_DRAWER_MOTION`.
  - `stock-mobile-header.tsx` — one-row mobile sub-screen header (ledger,
    waste).
  - `highlight-on-change.tsx` — number flash after mutations.
- `features/inventory/components/screens/stock-hub-screen.tsx` — hub (SM
  desktop, SM mobile, attendant mobile/desktop).
- Shared shell changes: `components/app/shell/sidebar-nav.tsx` (sub-link
  rail, `subItems`, `activeSubKey`, `overflow-x-hidden`),
  `components/app/shell/hint-tooltip.tsx` (new), `components/app/shell/topbar.tsx`
  (`searchRef`), `components/ui2/button.tsx` (press scale 0.98, §4.2 baseline),
  `features/inventory/components/inventory-shell.tsx` (Stock & counts live +
  sub-items, attendant filter), `app/app/inventory/(shell)/layout.tsx`
  (active sub-key), `hooks/use-central-store-location.ts` (`enabled` flag —
  the attendant must not call that SM-only endpoint).

## 5. Rules and lessons from the first half (follow these)

**Process (plan §4.4, binding):** for every screen *and* its loading / empty
/ error states, before starting the next: implement from `get_jsx` /
`get_computed_styles` → screenshot Paper → screenshot live at the same
viewport with seeded data → **eyeball** side by side (no pixel-diff tools —
banned) → walk §4.2 + the screen's checklist in the browser (hover, tab,
press, error, in-flight via throttling, open/close) → run
`web-design-guidelines` on the files → fix → re-check → one line in the
outcome log. Load `emil-design-eng` at the start.

**Things that cost time last session — avoid them:**
- **Type tokens don't map by name.** Paper `text-label` = 11px/14px/0.04em
  = code **`text-wds-field-label`**, *not* `text-wds-label` (that's
  13px/500). Paper `text-section` = 15px regular, but `text-wds-section`
  carries weight 600 — add `font-normal` where Paper is regular. Always
  compare against `get_tokens` / `get_computed_styles`.
- **Tailwind is v3.** `h-13`, `w-27.5`, `w-30` etc. don't exist — use
  arbitrary values (`h-[52px]`). `pnpm build` runs `check-wds-tokens`, which
  catches unknown `wds-` tokens but not these.
- **Flex children in scrolling columns shrink.** Mobile `<main>` needs
  `[&>*]:shrink-0`, and grow/basis-0 columns containing inputs need
  `min-w-0`, or cards squash / fields overflow.
- **Radix Dialog only returns focus to a `Dialog.Trigger`.** Every drawer
  opened from a plain button needs `useReturnFocus` (capture in
  `onOpenAutoFocus`, restore in `onCloseAutoFocus`) and should focus its
  first field on open.
- **Disabled-but-drawn controls** (decision 1): `aria-disabled` +
  `HintTooltip`, no dimming (owner: "exactly as in Paper"), never native
  `disabled` (kills hover/focus so the hint never shows). Tooltips inside
  the sidebar go `side="top"` — a right-side tooltip caused the horizontal
  scrollbar the owner reported.
- **Don't show on-hand to the attendant, even indirectly.** The attendant's
  "Restock levels" button is disabled ("Set by the Store Manager") because
  the restock endpoint is SM/DH-only *and* returns on-hand. Log this as a
  correction to `188X-0` in the outcome log.

**Recorded deviations still to write into the outcome log:** SM mobile hub
built from `1J43-0` (owner-drawn), not the hidden layers; attendant Restock
levels disabled (above); coming-soon controls undimmed; Today's-count
mobile copy "No count yet today — daily counting arrives with the next
update." instead of §0.1's "tap Daily count to start" (Daily count is
disabled in S1); hub attention-table order is data-driven (negative first,
then on-hand ÷ restock), so it differs from Paper's row order; hub mobile
uses the shared `MobileHubHeader` for consistency with other hubs (Paper's
`1J43-0` header differs slightly); `Topbar` search stays 300px (existing
shared component) vs Paper's 420px.

## 6. Environment

- `docker compose up -d postgres redis` (already healthy last check).
- Backend: `cd backend && pnpm dev` (port 4000).
- Frontend: `cd frontend && npx next dev -p 3001` — **port 3001, not
  3000**: `backend/.env` `FRONTEND_ORIGIN` is `http://localhost:3001`, so
  3000 fails CORS.
- Logins (password `password123`, PIN 1234): SM `store.manager@wendo.test`
  (Joseph Mwangi), Attendant `store.attendant@wendo.test` (Sarah Achieng),
  DH Kitchen Nyeri Town `chef1.nyeritown@dev.test`, BM
  `manager1.nyeritown@dev.test`.
- Seed for the gate: `cd backend && npx tsx src/scripts/seed-stock-waste-dev-fixtures.ts`
  (idempotent). Two real test waste entries (Tomatoes 3 kg, Rice 1 kg) were
  logged during the first half, so the 7-day waste total reads KES 2,555,
  not Paper's 2,140; the on-hand KPI reads ~KES 1.68M (earlier dev
  receipts). Both are real derived data — don't fudge them.
- Browser (chrome-devtools MCP): the owner's Chrome window was at **67%
  zoom**. For desktop, emulate `960x654x1` to get a true 1440×981 CSS
  viewport (check `window.innerWidth`); for mobile, emulate
  `390x844x1,mobile,touch` (zoom doesn't apply in mobile emulation). Wait
  for hydration before clicking (a click before hydration silently does
  nothing). Changing emulation reloads the page. To force API errors, use
  `navigate_page` with an `initScript` that rejects `fetch` for the target
  URL. The login endpoint is rate-limited — don't script repeated logins.
- `prisma migrate dev` refuses non-interactive shells; if a migration is
  ever needed, generate with `prisma migrate diff --from-schema-datasource
  prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script`
  into a timestamped folder and apply with `migrate deploy` (none expected
  this session).
- Commit per the plan (frontend commit, attribution line from the session's
  system reminder). Don't push unless the owner asks.
