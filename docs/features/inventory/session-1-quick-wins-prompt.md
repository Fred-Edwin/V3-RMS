# Session 1 — Quick Wins Sweep — Handoff Prompt

Paste this whole file as your opening prompt.

---

You are fixing a batch of 14 small, independent bugs found during an owner
walkthrough of the Inventory & Procurement feature (Milestones One through
Five). **Read `docs/features/inventory/WALKTHROUGH_FINDINGS.md` in full
first** — it has the complete context, file references, and reasoning for
every item below; this prompt only summarizes it. Also read
`CLAUDE.md` (project root) before starting any work — it has non-negotiable
rules (TypeScript strict, no `any`, `organizationId` scoping, pnpm only,
etc.) and the mandatory pre-push checks.

This is "Session 1" of a 5-session fix plan. All 14 items below are
classified trivial-to-small: no design pass needed, no schema change, no
cross-milestone dependency. They're batched together because they're safe
to land in one `pnpm build && pnpm test` + browser-verify pass. Do not pull
in any other finding from `WALKTHROUGH_FINDINGS.md` — items tagged Session
2+ need their own focused pass or a design/scoping step first.

## Working method

1. Read `WALKTHROUGH_FINDINGS.md` fully before touching code.
2. Use a todo list (TodoWrite) with all 14 items — mark each done as you
   finish it, not batched at the end, per CLAUDE.md's task-tracking rule.
3. Fix items roughly in the order listed — items 1-4 are single-line/no-file
   changes, do those first to build momentum and confidence in the loop.
4. For each item, verify the fix live in a real browser
   (`run-frontend-browser` skill or chrome-devtools MCP) before moving to
   the next — don't batch verification to the end.
5. After all 14 are fixed and individually verified: `cd backend && pnpm
   build && pnpm test`, `cd frontend && pnpm build` — both must be clean,
   per CLAUDE.md's mandatory pre-push checks.
6. Update `WALKTHROUGH_FINDINGS.md` — mark each of the 14 items' status as
   ✅ fixed (verified live) in place, do not renumber or delete findings.

## The 14 items

### 1. Topbar breadcrumb has no way back on Discrepancies (#26)
`Topbar` already supports a clickable breadcrumb section via `sectionHref`,
but `discrepancies-list-screen.tsx` never passes it, so there's no way to
navigate back. Add `sectionHref: isStoreManager ? '/app/inventory/dispatch'
: '/app/branch/deliveries'` to both `breadcrumb={{...}}` call sites (lines
~123, ~133).

**File:** `frontend/features/dispatch/components/screens/discrepancies-list-screen.tsx`

### 2. Store Attendant dev account has no PIN set (#4)
Data gap, not code — `store.attendant@wendo.test` has `pin_hash IS NULL` in
the local DB, blocking any testing of the Attendant's sign flow. Set it to
match every other dev account's PIN (`1234`) via a direct SQL update against
the local Postgres (use the Postgres MCP, or `docker compose exec postgres
psql`), or add it properly into `seed-dev.ts`'s `upsertUser` call for the
Attendant so it's not a one-off manual fix that disappears on a DB reset.
Prefer fixing `seed-dev.ts` — more durable.

**File:** `backend/src/scripts/seed-dev.ts`

### 3. "View note" link has no hover/focus state (#45)
Already has `underline`, but no `hover:text-wds-primary-fg` (or similar
darken) and no `focus-visible:shadow-wds-ring`. Same focus-visibility
pattern needed elsewhere in this batch (see item 4).

**File:** `frontend/features/dispatch/components/screens/dispatch-queue-fulfil-screen.tsx`
(the "View note" link, ~line 144-151)

### 4. Queue rail rows have hover but no active/pressed state (#43)
Rail links get `hover:bg-wds-neutral-100` but no `:active` press feedback.
Add `active:bg-wds-neutral-200` or similar, consistent with the shared
`Button` component's own active states (`components/ui2/button.tsx`).

**File:** `frontend/features/dispatch/components/screens/dispatch-queue-fulfil-screen.tsx`
(queue rail rows, ~line 314-317)

### 5. `Combobox` has no inline "create new" support for Supplier (#12)
Category already supports it via the `onCreate` prop
(`item-form.tsx:131-135`); Supplier does not (`item-form.tsx:142-149`). A
working inline-create pattern already exists in
`use-new-purchase-form.ts`'s `useCreateSupplierInline` — reuse that pattern
rather than building new supplier-creation logic.

**File:** `frontend/features/inventory/components/item-form.tsx`

### 6. `Combobox` has no clear/remove affordance (#13)
Confirmed at the component level — neither Category nor Supplier fields can
be cleared once set, because the shared `Combobox` itself has no clear
action. Fix once here; both fields inherit it automatically.

**File:** `frontend/components/ui2/combobox.tsx`

### 7. Master-detail divider doesn't stretch to the taller column (#25)
Both the list column and detail pane use `overflow-visible` instead of
scrolling internally (`requisition-approval-screen.tsx` lines ~534, ~571),
so when the detail pane's content is taller than the list column's, the
`border-r` hairline stops at the shorter column's height instead of
spanning the full row. Fix: change the list column (line ~534) to
`overflow-y-auto` so it scrolls within a fixed height instead of both
columns free-growing together — matches the pattern already used elsewhere
in the same file (lines ~486, ~508).

**Also check** `frontend/features/dispatch/components/screens/dispatch-queue-fulfil-screen.tsx`
and any other master-detail screen for the same `overflow-visible` pattern
on paired columns — fix any you find, same root cause.

**File:** `frontend/features/requisitions/components/screens/requisition-approval-screen.tsx`

### 8. Expected-delivery "View" button is a silent no-op (#9)
`purchasing-history-row.tsx`'s `toReceivingHistoryViewRow` wires
`expectedDelivery` row actions to `onClick: () => undefined` — clicking
"View" on an "Awaiting delivery" row does nothing, with no indication why.
No detail screen exists yet for expected deliveries (that's a separate,
bigger piece of work — do not build one in this session). For now: either
disable the button with a `title` explaining why (matching the pattern
already used for "Send without" elsewhere in this codebase — self-
documenting disabled state, not silent), or remove it from
`expectedDelivery` rows entirely until a detail screen exists.

**File:** `frontend/features/inventory/components/purchasing-history-row.tsx`

### 9. Sidebar shows Purchasing/Supplier AP links to Store Attendant (#3)
Backend correctly 403s these routes for `STORE_ATTENDANT`
(`receiving-routes.ts`'s own comment: "STORE_ATTENDANT has zero access —
not even read"), but the sidebar's `NAV_GROUPS` in `inventory-shell.tsx` has
no role filtering at all — every user sees every link. Filter `NAV_GROUPS`
(or the render of it) by `user.role`, hiding "Purchasing" and "Supplier AP"
entirely when the logged-in role is `STORE_ATTENDANT`.

**File:** `frontend/features/inventory/components/inventory-shell.tsx`

### 10. "Save draft" on Goods Receipt gives no visible confirmation (#8)
Verified live in a prior session that the save itself actually works (a
real `DRAFT` row was created in the DB) — the bug is purely that
`handleSaveDraft` (`new-goods-receipt-screen.tsx:218-222`) stores the result
in state but nothing in the UI acknowledges it. Add a visible confirmation
after a successful save — a toast, or a brief "Saved" label/timestamp near
the button. Check what toast/notification pattern already exists elsewhere
in this codebase (e.g. `useToast` if present) before inventing a new one.

**File:** `frontend/features/inventory/components/screens/new-goods-receipt-screen.tsx`

### 11. Receiving worklist history table header doesn't match its row component (#10)
`receiving-worklist-screen.tsx` (lines ~268-274) declares a 5-column header:
`Ref | Supplier | Age | Status | (actions)`. But it renders each row with
`PurchasingHistoryRowView` (from `purchasing-history-row.tsx`), a component
built for a *different* screen (Purchasing hub) whose actual first column is
a single combined title/subtitle block — there is no real "Ref" field
rendered anywhere. This produces a visible column misalignment. Fix by
either: (a) giving this screen its own row renderer that actually has 5
columns matching its header, or (b) changing the header to match what
`PurchasingHistoryRowView` really renders (4 columns, not 5). Prefer (a) if
"Ref" (the goods receipt reference number) is genuinely meant to be shown
here — check `ServerHistoryRow`'s shape in `types/receiving.ts` to see if a
reference/ref field even exists on a `goodsReceipt`-type row before
deciding.

**Files:** `frontend/features/inventory/components/screens/receiving-worklist-screen.tsx`,
`frontend/features/inventory/components/purchasing-history-row.tsx`

### 12. Quantity input crushed by a long buy-unit label (#11)
`receipt-line-grid.tsx`'s qty+unit cell (~line 107-121) is fixed at
`w-[150px]`; the buy-unit chip (~line 114-119) is `shrink-0` (never
shrinks) while the numeric `<input>` (~line 109-113) has no protected
minimum width. A long buy-unit string (e.g. `"ctn (1000pcs x5g)"`) squeezes
the input until the typed quantity becomes invisible — confirmed live.
Fix: add `min-w-[36px]` (or similar) to the input, and/or widen the overall
cell if needed to fit both comfortably.

**File:** `frontend/features/inventory/components/receipt-line-grid.tsx`

### 13. New Purchase loses all selected line items on navigation away (#2)
`use-new-purchase-form.ts` holds selected lines in plain `useState` with no
persistence — navigate away and everything is lost. Add `localStorage`
autosave: persist the in-progress line selection keyed by something stable
(e.g. a draft key), restore on mount, clear on successful save. Keep this
simple — a full server-side draft (like Goods Receipt already has) is
explicitly out of scope for this session; `localStorage` is sufficient and
matches the "safe to batch" sizing of this session.

**File:** `frontend/features/inventory/hooks/use-new-purchase-form.ts`

### 14. No way to cancel a started requisition (#17)
`department-landing-screen.tsx` has no cancel action anywhere — once a
Department Head starts (e.g.) an Afternoon requisition, there's no way to
back out and start fresh. Add a cancel action. Check the requisition
service (`backend/src/modules/requisitions/requisitions-service.ts`) for
whether a cancel/delete path already exists at the API level before
assuming new backend work is needed — a requisition with zero submitted
sections may already be safely deletable via an existing endpoint.

**File:** `frontend/features/requisitions/components/screens/department-landing-screen.tsx`

## Definition of done

- [ ] All 14 items fixed
- [ ] Each verified live in a real browser (not just typecheck/build)
- [ ] `backend`: `pnpm build && pnpm test` clean
- [ ] `frontend`: `pnpm build` clean
- [ ] `WALKTHROUGH_FINDINGS.md` updated — each of the 14 items marked ✅
      fixed in place
- [ ] Do not touch any Session 2+ item — if you notice something related
      while in a file, note it, don't fix it here
