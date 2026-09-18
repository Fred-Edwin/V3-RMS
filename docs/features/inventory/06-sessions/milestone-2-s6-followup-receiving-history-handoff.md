# Handoff — Receiving page redesign (Expected today + History)

Paste everything below the line to the agent running this session.

---

You're picking up mid-session from another Claude Code agent whose Paper MCP
connection dropped and could not be restored in-session. Read this whole
document before touching anything — it has the context you need to continue
without re-deriving it.

## State of the working tree — READ FIRST

**Everything below is uncommitted, sitting in the working tree of this
worktree.** Do not `git stash`, `git checkout .`, or otherwise discard
anything before understanding what's there — run `git status` yourself to
confirm it still matches. A second agent (`v3-rms-3f` in that session's
naming) was concurrently working on `frontend/app/app/manage/shifts/page.tsx`
and `frontend/lib/shift-schedule-xlsx.*` — unrelated files, no overlap, but
don't touch those either without checking they're not still in progress.

Uncommitted work relevant to you (everything else in `git status` is the
other agent's):
- `backend/src/modules/inventory/receiving-{controller,repository,routes,
  service,validators,types}.ts` — three real changes, already tested:
  1. New `GET /inventory/expected-deliveries/:id` endpoint (prefill support).
  2. Signing a Goods Receipt now marks its linked `ExpectedDelivery`
     `FULFILLED` (was a real bug — the enum value existed, nothing ever set
     it).
  3. Both logged as amendments in `docs/API_CONTRACT.md` §22.5.
- `frontend/features/inventory/components/screens/new-goods-receipt-screen.tsx`
  (rewritten), `new-goods-receipt-mobile.tsx` (new), `receipt-line-grid.tsx`
  (scroll + overflow-clip fixes), `receipt-line-add-inline.tsx` (new — replaced
  a modal-based "Add line" with an inline combobox row), `goods-receipt-detail-screen.tsx`
  (new), `desktop-only-notice.tsx` (new), `receipt-line-list-readonly.tsx` (new),
  hooks `use-goods-receipt-{detail,form}.ts` (new) — all part of the S6
  frontend build + a follow-up bugfix pass, all manually verified in a real
  browser already (prefill, price-alert/qty-discrepancy badges, sign flow,
  mobile, inline add-item dropdown, invalid-ISO-date fix). Don't re-verify
  these unless you touch them.
- `frontend/components/app/shell/topbar.tsx` — `Topbar`'s breadcrumb gained
  an optional `sectionHref` (backward compatible, every other screen
  unaffected) so a screen's breadcrumb section can link back.
- `frontend/features/inventory/components/screens/receiving-worklist-screen.tsx`
  — "Receive" buttons wired to navigate to the new entry screen.
- `CLAUDE.md` — updated for the owner's move to Omarchy Linux (PowerShell →
  bash), unrelated to this feature but already done, leave as-is.
- `scripts/*.sh` new, `scripts/*.ps1` deleted — same Omarchy migration.

**Local dev servers**: backend (`pnpm dev`, port 4000) and frontend
(`next dev`, port 3000) were both running against local Postgres/Redis
(`docker compose`) at the end of the prior session. Check they're still up
(`curl http://localhost:4000/api/v1/health`, `curl -o /dev/null -w '%{http_code}' http://localhost:3000/login`)
before assuming so — `tsx watch` has been flaky about picking up file changes
this session; if in doubt, kill and restart both cleanly rather than trusting
hot-reload. A PIN (`1234`) is already set on the seeded `store.manager@wendo.test`
account for testing the sign flow.

## What you're picking up: the Receiving page redesign

The owner asked for the Receiving page (`/app/inventory/receiving`,
`frontend/features/inventory/components/screens/receiving-worklist-screen.tsx`)
to be split into two sections:

1. **Expected today** — the existing worklist, unchanged in substance.
2. **History** — a section on the same page (a preview of recent rows) with
   a link that takes the user to a **dedicated full-screen historical table**
   they can scroll and filter to investigate any past receipt.

### Key discovery from the prior session — don't design this from scratch

**The Purchasing hub already solved this exact problem.** Read these before
designing anything:
- `frontend/features/inventory/components/screens/purchasing-hub-screen.tsx`
  — has its own "Inbound" and "History" preview bands with "View all" links.
- `frontend/features/inventory/components/screens/history-list-screen.tsx`
  — the dedicated full-screen History table this pattern already produces:
  search-by-supplier, cursor-style "load more" pagination, a discriminated-union
  row renderer (`purchasing-history-row.tsx`, `PurchasingHistoryRow` = a
  union of `expectedDelivery` | `goodsReceipt` rows, already pre-formatted
  server-side by `receiving-service.ts`'s `toHistoryRow`).
- `frontend/features/inventory/hooks/use-purchasing-history-list.ts` — the
  data hook this screen uses.
- Backend: `GET /inventory/purchasing/history` (`receiving-routes.ts`,
  `receiving-controller.ts::getPurchasingHistory`,
  `receiving-service.ts::getPurchasingHistory`) already serves this
  discriminated union.

**Receiving's redesign should follow this same pattern** (hub-page preview +
band + "View all" → dedicated full-screen filterable table), not invent a new
one — one shared mental model across Purchasing and Receiving, one shared
component family.

### Gaps to close, not just copy

The existing History pattern is real but incomplete for what a *receiving*
audit log needs. Fix/add these as part of this work, confirmed with the owner
already:

1. **Date-range filter.** `HistoryListScreen` today only has a
   supplier-name search box — no date picker. A receiving history needs one
   (owner's own words: "a proper table with the proper filters and a proper
   date picker as well").
2. **Status filter** (Received / Invoice pending / Paid / Cancelled) — today
   the only narrowing tool is free-text search.
3. **Role scoping — already decided by the owner, this is not open for
   debate:** **Store Attendants must be able to see receiving history**, not
   just Managers/Accountants/Directors. Today `GET /inventory/purchasing/history`
   is `requireRole('STORE_MANAGER', 'ACCOUNTANT', 'DIRECTOR')` only — Attendants
   have zero access, matching the Stage-10 AP-exclusion rule
   (`01-description.md`, Supplier payment). **That AP exclusion is correct
   and must stay** — Attendants still see zero money/AP data. But a
   *goods-receipt-only* history read (no AP/invoice/money fields beyond what
   Attendants already see on the worklist) needs a new Attendant-safe
   endpoint or role addition — do not just add `STORE_ATTENDANT` to the
   existing `purchasing/history` role list, since that endpoint's response
   may carry `expectedDelivery` rows with `estimatedTotal` (money, already
   Attendant-hidden elsewhere per `01-description.md` Stage 1) — check
   `receiving-service.ts`'s existing `canSeeMoney`/serializer pattern (used
   for `ExpectedDeliverySummary`) and apply the same field-omission
   convention here rather than a blanket role change.
4. **Wire up the row actions.** `history-list-screen.tsx`'s
   `toViewRow` comment says action buttons on `goodsReceipt` rows are
   `onClick: () => undefined` — "not wired yet." At minimum, "View" on a
   `goodsReceipt` row should navigate to
   `/app/inventory/receiving/[id]` (the signed detail screen, already built
   this session — `goods-receipt-detail-screen.tsx`).
5. **Real bug, fix while you're in this code:** `history-list-screen.tsx`'s
   **mobile** branch only renders `row.type === 'expectedDelivery'` rows
   (line ~63, `... : null` silently drops `goodsReceipt` rows on mobile). The
   desktop `PurchasingHistoryRowView` in `purchasing-history-row.tsx` handles
   both types correctly — only the mobile branch in this one screen is
   incomplete.

### Explicitly out of scope

**Do not redesign the Purchasing hub itself.** It went through its own
redesign cycle very recently (2026-09-17, checkbox-catalog rework) and is not
broken — you're borrowing its pattern for Receiving, not reworking it. The
only Purchasing-hub-adjacent thing in scope is the shared History
pattern/components you're extending, and bug #5 above (which lives in a
component both pages could eventually use, but is scoped to the History
screen, not the hub itself).

## Process — read `docs/FEATURE_REDO_PLAYBOOK.md` before starting

This is mid-Milestone-Two work (`docs/features/inventory/MILESTONES.md`,
`milestone-2-plan.md`). The project's standing rule
(`CLAUDE.md` → "Project Documents" table) is: **design in Paper first, get
owner approval, then build.** The owner explicitly asked for this ("I would
want us to first design this in paper so that i approve before building").

### Paper file

`https://app.paper.design/file/01M1ZZJ6S3FZGF5C7PPBGTKY89/C-0` — page
"Milestone Two · Receiving & Supplier AP". The existing Receiving worklist
artboards are `UMS-0` (desktop) / `WSO-0` (mobile). The Purchasing hub's
History pattern artboards (`U7V-0` desktop hub, `WUL-0` mobile hub — check
these for the Inbound/History band treatment to match) are on the same page.
There is **no existing artboard for the redesigned Receiving page or its new
History screen** — you're drawing new ones, following the coffee-espresso
design system already established (tokens: `frontend/app/tokens.wds.css`,
`frontend/tailwind.wds.preset.ts`; read `docs/DESIGN_SYSTEM.md` before
drawing anything).

**Before drawing:** confirm the Paper MCP tools are actually reachable in
your session (`ToolSearch` for `paper` / try `get_basic_info`) — the prior
agent's session had the plugin show as connected in `/mcp` status but the
tools never became callable, and a session restart was the suspected fix.
Don't spend time debugging this yourself beyond one check; if it's still
broken, stop and tell the owner rather than trying to fake the design step
with browser automation against the Paper web app (unreliable, risks
corrupting the file).

### What to design

1. **Receiving page** (`UMS-0`'s replacement) — Expected today section
   (existing content) + a History preview band + "View all" link, matching
   the Purchasing hub's `U7V-0` Inbound/History band treatment. Desktop +
   mobile (mobile precedent: `WSO-0`, and the new mobile screen this session
   already built — `new-goods-receipt-mobile.tsx` — for the current visual
   language to match).
2. **Receiving History screen** (new, full-screen) — the filterable table:
   date range, status filter, supplier search, the same discriminated-union
   row shape (or a receiving-specific one if the union proves awkward —
   your call, but check with the owner if you diverge from reusing
   `PurchasingHistoryRow` significantly, since that's shared infrastructure).
   Desktop + mobile (fixing gap #5 above in the mobile design, not just the
   code).

Once designed, post the Paper page link back to the owner and stop — do not
start building until they approve, per the standing process rule.

## Verification once you do build

Same bar as the rest of this milestone: `pnpm build` (backend + frontend,
both must pass — typecheck alone is not sufficient), `pnpm test` (backend),
then manually exercise every screen in a real browser (Playwright/chrome-devtools
MCP) — data loads, filters actually filter, pagination works, "View" actually
navigates, and the Attendant-scoped history endpoint genuinely hides
money/AP fields for that role (test by logging in as
`store.attendant@wendo.test` — check `backend/src/scripts/seed-dev.ts` for
the exact seeded credentials if that's changed).
