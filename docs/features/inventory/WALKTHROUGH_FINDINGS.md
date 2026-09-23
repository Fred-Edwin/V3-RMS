# Inventory & Procurement — Owner Walkthrough Findings

**Source:** owner manual walkthrough of Milestones One through Five, live in a
browser against the local dev stack, 2026-09-23. Two findings (#28-35, #36-45)
come from dedicated interactivity audits (`emil-design-eng` +
`web-design-guidelines` + `vercel-composition-patterns` skills) run against
the Requisitions approval screen and the Dispatch queue + Fulfil screen after
the owner flagged both as feeling static/unclear.

**Status:** not yet fixed. This is the punch list going into a fix pass —
not itself a build plan. Numbering is stable and traces back to the
walkthrough conversation; do not renumber when items are fixed, mark them
done in place instead.

**How this is organized:** by *what kind of fix it needs*, not by which
milestone surfaced it — several findings share a root cause across
milestones (e.g. the two interactivity audits both trace back to screens not
feeding state into the shared `Button`/`Combobox` primitives), so fixing by
theme avoids touching the same shared component twice in separate sessions.

1. §1 Shared component fixes — fix first, other findings depend on these
2. §2 Interactivity / polish pass — the two audits, same category of work
3. §3 Data-entry correctness bugs — functional bugs, not missing polish
4. §4 Navigation / scope gaps — actions that are simply absent
5. §5 Open product decisions — need owner judgment before they can be scoped as fixes

## Execution sessions (2026-09-23)

The §1-5 sections above group findings by *what kind of fix they need* — the
right lens for understanding each item. For actually scheduling and handing
off work, effort/blast-radius is the right lens instead. Each finding below
carries a `Session N` tag for this purpose; §1-5 remain the reference
grouping and are not renumbered.

| Session | Contents | Why grouped this way |
|---|---|---|
| **1 — Quick wins sweep** — ✅ 13/14 fixed 2026-09-23, #8 deferred | #26, #4, #45, #43, #12, #13, #25, #9, #3, #5, #10, #11, #2, #17 (14 items) | Trivial-to-small, no design pass or schema change needed, mostly independent files — safe to batch into one session and one build/test/verify pass. **#8 (Save-draft confirmation) pulled out mid-session**: needs a proper Paper-designed `ui2` toast component, not a reuse of the legacy `components/ui` toast pattern — see §3.5. Backend `pnpm build && pnpm test` (982/982) and frontend `pnpm build` both clean; all 13 verified live. |
| **2 — Requisitions interactivity pass** | #28-#35 (8 items) | One screen, one coordinated pass against `emil-design-eng`/`web-design-guidelines`, re-verify together after. |
| **3 — Dispatch interactivity pass** | #36-#45 minus #43/#45 (already in Session 1) | Same treatment as Session 2, different screen — kept separate since each finding set has its own audit and priority order. |
| **4 — Conversion-factor field redesign** | #1 (+ #? packSize, same finding) | Touches core data-entry UX directly; small file count but deserves its own focused session + live retest, not bundled into Session 1. |
| **5+ — Decided product items, each its own Step-5 scoping + build pass** | #5.1, #5.2, #5.3a, #5.3b, #5.4 | Per `FEATURE_REDO_PLAYBOOK.md`, no feature work starts without its own plan doc — these need scoping before a session number can even be assigned. #5.3a may turn out small enough (frontend-only, backend exists) to fold into a later session once scoped. |
| **Deferred — needs a Paper design pass first** | #7 (Goods Receipt mobile) | Can't be scheduled as a build session until mobile screens are designed and owner-approved, same rule Milestone Six is already blocked on. |

**Status key used below:** ⏳ not started · 🔧 in progress · ✅ fixed (verified
live) — updated in place as each session lands.

---

## §1. Shared component fixes

Fix these first — several other findings in §2-4 depend on the same
underlying primitive and should not be patched per-screen.

### 1.1 — ✅ `Combobox` has no inline "create new" support for Supplier (#12)
Category already supports it (`onCreate` prop, `item-form.tsx:131-135`);
Supplier does not (`item-form.tsx:142-149`). A working inline-create pattern
already exists elsewhere (`use-new-purchase-form.ts`'s
`useCreateSupplierInline`) — reuse it rather than build from scratch.

**Files:** `frontend/features/inventory/components/item-form.tsx`

### 1.2 — ✅ `Combobox` has no clear/remove affordance (#13)
Confirmed at the component level, not per-field — neither Category nor
Supplier can be cleared once set. Fix once in the shared `Combobox`
component; both fields inherit it.

**Files:** `frontend/components/ui2/combobox.tsx`

### 1.3 — ✅ `Topbar` breadcrumb `sectionHref` not wired on Discrepancies (#26)
`Topbar` already supports a clickable breadcrumb via `sectionHref` — the
Discrepancies screen just never passes it, so there is no way back. One-line
fix using an existing prop, not new component work.

**Files:** `frontend/features/dispatch/components/screens/discrepancies-list-screen.tsx`

### 1.4 — ✅ Master-detail divider doesn't stretch to the taller column (#25)
Both columns use `overflow-visible` instead of scrolling internally, so the
hairline border stops at the shorter column's content height instead of
spanning the full row. Confirmed on the Requisitions approval screen;
check the Dispatch and Branch Receiving master-detail screens for the same
pattern while fixing it, since they share the same layout convention.

**Fixed 2026-09-23:** only `requisition-approval-screen.tsx` (lines 534/571)
had the bug — audited all of `frontend/features/` for `overflow-visible` and
confirmed `dispatch-queue-fulfil-screen.tsx`'s equivalent master-detail pair
already used `overflow-y-auto` correctly. Verified live: the divider now
spans the full height of the taller (detail) column.

**Files:** `frontend/features/requisitions/components/screens/requisition-approval-screen.tsx`
(lines ~533-571), plus audit of `features/dispatch/components/screens/*` for
the same `overflow-visible` pattern.

---

## §2. Interactivity / polish pass

Both audits found the same root pattern: custom-built inputs/rows/buttons
not feeding hover, focus-visible, or in-flight state into the shared
`Button` component's existing variants. Treat as one coordinated pass,
re-verified against `emil-design-eng` / `web-design-guidelines` after fixing
rather than fixed blind.

### Requisitions approval screen (Branch Manager, desktop)

- **#28 [Blocking]** — `saveError`/`returningSection` returned by the hook
  but never read by the screen; failed saves/returns give zero feedback.
- **#29** — No in-flight state on "Return section" confirm — only disables
  on empty note, not while the request is in flight (double-submit risk).
- **#30** — Section expand/collapse ("as requested" rows) has no chevron,
  no hover state, no transition — confirmed hard to discover live (#19).
- **#31** — "Fill it myself" / "Nudge head" fire immediately with no
  confirmation and no success feedback afterward.
- **#32** — List rail rows and section status headers have no hover state
  at all — likely the single biggest contributor to the screen "feeling
  static," since the list is the most-clicked element on the page.
- **#33** — "+ Add a line" / "Return this section" are ad hoc styled text
  buttons instead of the shared `Button variant="link"` (which already has
  hover/focus/active built in).
- **#34** — PIN sign sheet's focus-trap/keyboard behavior unverified —
  lives in `sign-sheet.tsx`, needs its own check (highest-consequence
  interaction on the screen).
- **#35 [Low]** — KPI/stat numbers update silently with no visual
  acknowledgment when they change after an approval.

**Files:** `frontend/features/requisitions/components/screens/requisition-approval-screen.tsx`,
`frontend/components/app/shell/sign-sheet.tsx`

### Dispatch queue + Fulfil screen (Store Manager/Attendant, desktop)

- **#36 [Blocking]** — Editable quantity input is visually identical to
  read-only text at rest (`border-transparent` unless already short) — no
  border, background tint, cursor, or hover state. This was the owner's
  original complaint, confirmed directly in code.
- **#37 [Blocking]** — `outline-none` on the input with no
  `focus-visible` replacement anywhere — screen is effectively unusable via
  keyboard.
- **#38 [Blocking]** — Signing a department (moves real stock) has no
  in-flight spinner or label change — looks broken, not busy, during the
  request.
- **#39 [High]** — No success confirmation after a department is signed —
  only signal is the section silently collapsing to its read-only summary.
- **#40 [High]** — Dispatch-error banner renders at the top of the whole
  screen, not scoped to the failing section; no dismiss, no `role="alert"`.
- **#41 [Medium]** — "Sign & dispatch" stays clickable at zero units
  dispatched — no client-side guard before the PIN prompt.
- **#42 [Medium]** — Section collapse-on-sign has no transition — reads as
  a jarring hard swap.
- **#43 [Low]** — ✅ Queue rail rows have hover but no active/pressed state.
  Fixed 2026-09-23: added `active:bg-wds-neutral-200`.
- **#44 [Low]** — Two different "done"-status indicator implementations
  within one feature (desktop plain glyph vs. mobile styled dot) — worth
  unifying into one shared status-dot primitive.
- **#45 [Low]** — ✅ "View note" link has the same missing-focus-state gap as
  #37, lower stakes. Fixed 2026-09-23: added
  `hover:text-wds-primary-hover focus-visible:shadow-wds-ring`.

**Files:** `frontend/features/dispatch/components/screens/dispatch-queue-fulfil-screen.tsx`,
`frontend/features/dispatch/components/screens/dispatch-fulfil-screen-mobile.tsx`

---

## §3. Data-entry correctness bugs

Functional bugs in how data is entered, parsed, or saved — not missing
polish.

### 3.1 — Item form "Conversion" is a free-text sentence, regex-parsed (#1)
`"1 bag = 25 kg"` is placeholder text implying a required sentence format;
the submit handler regex-parses the number out
(`item-form-screen.tsx:108`) and **silently drops the conversion factor to
null** on any format mismatch, with no validation error shown.

**Recommended fix (agreed with owner):** replace with a numeric
`conversionFactor` input plus a computed, non-editable label built from
`buyUnit`/`usageUnit` (`1 {buyUnit} = [___] {usageUnit}`). Apply the same
treatment to `packSize`, which has the same loosely-typed-text problem.

**Files:** `frontend/features/inventory/components/item-form.tsx`,
`frontend/features/inventory/components/screens/item-form-screen.tsx`

### 3.2 — ✅ New Purchase loses all selected line items on navigation away (#2)
No persistence at all — plain `useState`, wiped on unmount. Needs a
`localStorage` autosave or a lightweight server-side draft, matching the
durability pattern Goods Receipt drafts already have.

**Fixed 2026-09-23:** added `localStorage` autosave to
`new-purchase-screen.tsx` (the actual state owner — not
`use-new-purchase-form.ts` as originally filed, which only holds
supplier/option state). Persists on every change, restores on mount, clears
on successful save. Verified live: selected item survived a navigation away
and back.

**Files:** `frontend/features/inventory/components/screens/new-purchase-screen.tsx`

### 3.3 — ✅ Sidebar shows Purchasing/Supplier AP links to Store Attendant (#3)
Backend correctly 403s these routes for `STORE_ATTENDANT`
(`receiving-routes.ts`), but the sidebar's `NAV_GROUPS` has no role
filtering at all, so the Attendant sees and can click links that always
fail. Needs role-based filtering in the nav config.

**Fixed 2026-09-23:** added `navGroupsForRole` in `inventory-shell.tsx`,
filtering out `purchasing`, `suppliers`, `supplier-ap` for `STORE_ATTENDANT`
at all 4 shell export call sites. Verified live logged in as the Attendant —
sidebar shows only Dashboard/Receiving/Prep/Dispatch/Stock & counts under
Central Store and Catalog/Reports under Procurement.

**Files:** `frontend/features/inventory/components/inventory-shell.tsx`

### 3.4 — ✅ Store Attendant dev account has no PIN set (#4)
Data/seed gap, not app code — blocks testing the Attendant's sign flow.
`seed-dev.ts`'s `upsertUser` never sets a PIN for either Store role account.

**Fixed 2026-09-23:** `upsertUser` now accepts an optional `pinHash`;
`seed-dev.ts` hashes a dev PIN (`1234`, matching the existing
`seed-dispatch-dev-fixtures.ts` convention) and passes it for both
`STORE_MANAGER` and `STORE_ATTENDANT`. Existing local dev DB backfilled
directly (the account already existed, so `upsertUser`'s idempotent skip
never re-ran it) — verified `store.attendant@wendo.test` now has a non-null
`pin_hash`.

**Files:** `backend/src/scripts/seed-dev.ts`

### 3.5 — Deferred — "Save draft" gives no visible confirmation (#8)
Verified the save itself works (`GRN-0001` confirmed in DB) — the bug is
purely that `handleSaveDraft` stores the result in state but nothing in the
UI changes afterward (no toast, no "Saved" banner). Looks broken even when
it isn't.

**Deferred 2026-09-23:** the codebase's only existing toast pattern
(`frontend/hooks/useToast.ts` + `ToastContainer.tsx`) is built on the legacy
`components/ui` design system and has never been ported to `ui2`, which this
screen (and the whole inventory feature) is built on. Owner decided this
needs a proper Paper design pass for a new `ui2` notification/toast
component rather than reusing the legacy pattern or an ad hoc inline label —
pulled out of Session 1's no-design-pass scope. Needs its own Paper design
pass + build session.

**Files:** `frontend/features/inventory/components/screens/new-goods-receipt-screen.tsx`

### 3.6 — ✅ Receiving worklist history table header doesn't match its row component (#10)
`receiving-worklist-screen.tsx` declares a 5-column header (`Ref | Supplier
| Age | Status | actions`) but renders rows with `PurchasingHistoryRowView`,
a component built for a different screen whose first column is a single
combined title/subtitle block — no real "Ref" field exists in the row.
Produces the column misalignment the owner saw (Supplier's column appearing
to show an amount).

**Fixed 2026-09-23:** confirmed live this screen's history band can show
both `goodsReceipt` and `expectedDelivery` rows (same merged union endpoint
as the Purchasing hub), so relabeling to a fixed "Ref" column wasn't
accurate for either row type. Renamed the header labels to "Receipt" and
"Detail" to match what `PurchasingHistoryRowView` actually renders for both
row types, rather than inventing a field that doesn't exist on either.
Verified live.

**Files:** `frontend/features/inventory/components/screens/receiving-worklist-screen.tsx`,
`frontend/features/inventory/components/purchasing-history-row.tsx`

### 3.7 — ✅ Quantity input crushed by a long buy-unit label (#11)
`receipt-line-grid.tsx`'s qty+unit cell is fixed at `w-[150px]`; the
buy-unit chip is `shrink-0` (never shrinks) while the numeric `<input>` has
no protected minimum width. A long buy-unit string (e.g. `"ctn (1000pcs
x5g)"`) squeezes the input until the typed quantity becomes invisible.

**Fixed 2026-09-23:** the actual bug was the input's `min-w-0` explicitly
removing any minimum width next to `grow` — changed to `min-w-[36px]`.
Verified live via computed styles (`min-width: 36px` applied).

**Files:** `frontend/features/inventory/components/receipt-line-grid.tsx`

### 3.8 — Print delivery note signature font — needs live re-check (#27)
Code is correct end-to-end (`Alex Brush` registered via `next/font/google`,
wired to `--font-signature`, both signature lines use
`font-['Alex_Brush',cursive]`), but a screenshot showed plain serif in
Chrome's print-preview pane. Likely a print-preview webfont-rendering quirk,
not a code defect. **Before treating as a real bug:** check the actual saved
PDF (not just the preview thumbnail) and the on-screen (non-print) delivery
note view, to isolate whether this is print-specific.

**Files:** `frontend/features/dispatch/components/printable-delivery-note.tsx`

---

## §4. Navigation / scope gaps

Places where an expected action or screen is simply absent, not broken.

### 4.1 — ✅ Expected-delivery "View" button is an intentional no-op (#9)
Self-documented in code: no detail screen exists yet for an
`ExpectedDelivery` row, so the button's `onClick` is `() => undefined`.
Needs either a detail screen built, or the button visibly
disabled/removed so it doesn't look broken.

**Fixed 2026-09-23:** added `disabled`/`title` to `PurchasingRowAction`;
`toReceivingHistoryViewRow`'s `expectedDelivery` branch now marks both
actions disabled with an explanatory title ("Detail view coming soon..."),
matching the "Send without" self-documented-disabled pattern already used
elsewhere in the codebase, instead of a silent no-op. Row renderer dims
disabled actions and drops their hover state.

**Files:** `frontend/features/inventory/components/purchasing-history-row.tsx`

### 4.2 — Goods Receipt detail has no mobile design (#7)
Only screen in Milestone Two behind a "use a larger screen" gate — matches
the milestone plan's own screen table (mobile column marked `—`). A real,
documented product gap: an Attendant working entirely on a phone cannot
view a signed receipt's detail at all. Needs its own mobile design pass
before it can be built (same as Milestone Six's current state).

**Files:** `frontend/features/inventory/components/desktop-only-notice.tsx`,
`frontend/features/inventory/components/screens/goods-receipt-detail-screen.tsx`

### 4.3 — ✅ No way to cancel a started requisition (#17)
`department-landing-screen.tsx` has no cancel action anywhere — once a
Department Head starts (e.g.) an Afternoon requisition, there's no way to
back out and start fresh.

**Fixed 2026-09-23:** confirmed no cancel/delete capability existed at the
API level (`recallSection` only flips a *submitted* section back to draft —
the inverse case). Added new backend surface: `requisitionRepository.cancel`
(hard delete — the one exception to this module's soft-delete convention,
justified because it's only reachable when zero sections have ever been
SUBMITTED, so there's no audit trail to lose), `requisitionService
.cancelRequisition`, and `DELETE /requisitions/:id` (gated to the
requisition's own opener, `requireDepartmentHead`). Frontend adds a "Cancel"
link per not-yet-submitted requisition row with a `ConfirmDialog`. Verified
live end-to-end (create → cancel → confirm → row disappears, DB row
deleted, zero console errors).

**Files:** `backend/src/modules/requisitions/requisitions-repository.ts`,
`requisitions-service.ts`, `requisitions-controller.ts`, `requisitions-routes.ts`,
`frontend/features/requisitions/services/requisitions-api-service.ts`,
`frontend/features/requisitions/components/screens/department-landing-screen.tsx`

### 4.4 — Store Attendant hamburger menu not opening — needs live repro (#22)
Traced the full chain (`MobileHubHeader` → `useMobileNavDrawer` context →
`InventoryMobileNavDrawer` → `Sheet`/Radix Dialog) and found no role-based
gating or obvious break anywhere in the code. Cannot confirm root cause
without a live repro — capture exact screen, whether the sheet element
appears in the DOM but stays invisible, and any console error.

**Files:** `frontend/features/inventory/hooks/use-mobile-nav-drawer.tsx`,
`frontend/features/inventory/components/inventory-shell.tsx`

---

## §5. Decided — ready to scope

All four open product questions were resolved in a follow-up session
(2026-09-23). These are decisions, not yet built — each still needs its own
proper scoping pass (data model, contract, screens) before a build session,
same as any other feature work per `FEATURE_REDO_PLAYBOOK.md` — but the
product question itself is settled.

### 5.1 — Add a standard buying-price field on the catalog item (#5) — DECIDED
**Decision:** yes, add an editable "standard price" field to `InventoryItem`,
independent of `currentCost`. Gives Purchasing a real number to suggest
before an item has ever been received (useful for brand-new items and
budgeting).
**Still needs deciding at scoping time:** how it interacts with
`currentCost` once real receipts exist — overwritten, shown side-by-side, or
used only as an initial seed value before the first receipt.

### 5.2 — Add a lightweight quantity-variance flag on Goods Receipt signing (#6) — DECIDED
**Decision:** yes, but lightweight — not a full discrepancy workflow. Mirror
the existing price-alert pattern: if received qty differs from the linked
estimate by more than a threshold, show a visible flag/note on the line and
require acknowledgment before signing. No separate resolution workflow —
the receipt itself remains the record. Deliberately cheaper than Milestone
Five's full 3-outcome Discrepancy system, appropriate since a Stage-1
estimate is explicitly non-binding (unlike a branch's confirmed dispatch).

### 5.3a — Add department-head assignment UI to the Branch Manager's existing settings page (#16, split) — DECIDED
**Correction to the original framing:** departments are a branch/org
structural concept, not a Central Store one, and don't belong on a Store
Manager page. Confirmed in code: `canManageDepartments`
(`backend/src/routes/department-routes.ts`) explicitly scopes department
management to `MANAGER` (Branch Manager) / `DIRECTOR` / `SYSTEM_ADMIN` —
`STORE_MANAGER` is not included. The backend endpoints already exist
(list departments, list eligible staff, assign/unassign head) but no
frontend screen calls them yet.
**Decision:** build this into the Branch Manager's existing
`frontend/app/app/manage/settings/page.tsx` (currently branch
profile/print-stations, old `components/ui` design system) as a new
section, not a new page.

### 5.3b — New Store Manager settings page, scoped to Central Store concerns (#16, split) — DECIDED
**Decision:** yes, build one, scoped to what the Store Manager actually
owns. Owner-approved contents (2026-09-23), cross-checked against the
existing codebase so this section reflects what's genuinely missing vs.
already partially built:

- **Central Store profile** (name, address, contact) — mirrors what
  `manage/settings` already does for a branch. Net new.
- **Yield-variance thresholds** (currently hardcoded ±15% warn / ±35% notify
  SM, Milestone Three). Net new — no config surface exists.
- **Price-alert threshold** (currently a hardcoded
  `PRICE_ALERT_THRESHOLD_PCT` constant, `receiving-service.ts`). Net new.
- **Central Store-wide default payment terms** (currently only settable
  per-supplier). Net new.
- **PIN management for the Store Manager's own account.** No UI exists
  anywhere for any role to self-service set/change a PIN — net new, affects
  every signing role, but this page is the natural home for "manage my own
  PIN."
- **PIN management for Store Attendant accounts, set by the Store
  Manager.** Owner-requested addition (2026-09-23). **No backend endpoint
  exists for this at all** — `staff-routes.ts` has a `reset-password` route
  but no PIN equivalent, and `reset-password` itself excludes
  `STORE_MANAGER` (`requireRole('MANAGER', 'SYSTEM_ADMIN')` only,
  `staff-routes.ts:62`). This is real backend work, not just a frontend
  screen — a new `PATCH /staff/:id/reset-pin` (or similar) needs
  `STORE_MANAGER` added to its allowed roles, scoped so a Store Manager can
  only reset PINs for staff on the hub org, not any branch's staff.
  Directly closes the gap found during the Milestone Two walkthrough (#4 —
  the Store Attendant dev account has no PIN and nothing could set one).
- **Create Store Attendant accounts.** Owner-requested addition
  (2026-09-23). **Partially exists already** — `POST /staff` already
  accepts `STORE_MANAGER` (`staff-routes.ts:13`), and a staff-creation
  screen already exists at `frontend/app/app/manage/staff/page.tsx` (old
  design system, not yet confirmed whether a Store Manager can actually
  reach this route today or whether it needs its own entry point off the
  new Store Manager settings page). **Needs verifying, not assuming**,
  before scoping: check live whether `store.manager@wendo.test` can open
  `/app/manage/staff` and successfully create a `STORE_ATTENDANT` account
  through the existing screen, before deciding whether this needs new UI
  or just a new entry point/link into the existing one.
- **Notification preferences** — confirm whether the push-notification
  opt-in CLAUDE.md describes ("Profile → Push Notifications") is actually
  reachable from anywhere yet.

### 5.4 — Post-approval correction: full unwind back to PENDING_APPROVAL (#24) — DECIDED
**Decision:** full unwind, not an additive correction record. Approving a
requisition again after correction re-opens all 5 sections for editing and
requires a fresh PIN sign.
**Confirmed before deciding:** `Dispatch.requisitionId` FK exists in the
schema but nothing currently joins through it — so today, unwinding an
approval has no cascade risk into Dispatch. **Flag for scoping time:** if a
later milestone wires that FK up for real (e.g. Dispatch reads which
lines were approved), this decision should be revisited, since unwinding an
approval that Dispatch has already acted on becomes a real consistency
problem a correction-record approach would have avoided.

---

## Not included here (resolved during the walkthrough, no action needed)

For completeness — these were raised as possible issues but turned out to be
correct/intentional behavior on investigation, not bugs:

- Fill screen's missing on-hand column / par-minus-on-hand pre-fill —
  documented, owner-agreed scope deviation (no branch ledger exists yet).
- Kitchen section "missing" line items on the approval screen — data was
  never missing; the section was collapsed by default (see #30 for the
  discoverability fix, which *is* tracked).
- Two-stage prep input picker not showing the current output item — correct
  by design (can't consume the thing you're producing as its own input).
- "Send without" button disabled — self-documented as out of scope this
  milestone, not a bug.
