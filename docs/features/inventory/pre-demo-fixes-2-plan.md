# Pre-Demo Fixes, Round 2 — Dry-Run Findings — Build Plan

## Paste this into a fresh Claude Code session

> You are the build agent for Wendo RMS, **Pre-Demo Fixes Round 2**. Your
> brief is `docs/features/inventory/pre-demo-fixes-2-plan.md`. Read it top to
> bottom before touching code, then follow it in order. Decisions marked
> SETTLED are not to be re-opened; the one marked OWNER DECISION must be
> confirmed with the owner in your first message before you build it. If
> something turns out wrong in the code, fix it and record the correction in
> this file's Outcome log — never silently work around it. First check the
> state of PR #40 (`gh pr view 40`) and `main`, then follow "Branches and PRs"
> below. Finish with the End-of-session summary, in chat.

---

## Why this exists

The owner will run client and role user-testing **in production**. Before that,
a full end-to-end dry run of the Inventory feature was done in a real browser
against a scratch database cloned from a production snapshot (details in
"Dry-run environment"). The run passed all ten steps of the flow but found the
defects below. This plan fixes them in three pull requests, in this order:

- **PR A** — small code fixes and copy (fast, low risk).
- **PR B** — the costing fix (backend, with tests).
- **PR C** — phone screens for Goods Receipt detail and Settings (Paper design
  first, owner approval, then build).

Production preparation (provisioning script, accounts, checklist) is **not**
code and is listed at the end for the owner.

Accountant and Director screens are out of scope.

## Read first (only the sections named)

1. `CLAUDE.md` — whole file (non-negotiables, hook-stability rules, MCP tools).
2. `docs/FEATURE_REDO_PLAYBOOK.md` §5, §7–§9.
3. `docs/CODING_STANDARDS.md` §4 (backend) / §9 (frontend).
4. `docs/DATA_MODEL.md` — §4 InventoryItem (~l.1783 "currentCost is written only by receiving") and the goods-receipt-line section (~l.2054–2056).
5. `docs/features/inventory/pre-demo-fixes-plan.md` — Round 1 plan and its Outcome log (PR #40: Settings › Team, Set-PIN step, numeric conversion field).
6. `docs/features/inventory/milestone-6-plan.md` §4 — build gate (hover, focus, in-flight, feedback; states kit; per-screen Paper gate). Applies to PR C.

## Branches and PRs

1. Run `gh pr view 40 --repo Fred-Edwin/V3-RMS`. If it is **not merged**, stop and tell the owner — these fixes build on it. Do not merge it yourself.
2. `git switch main && git pull --ff-only`, then one branch per PR:
   `fix/pre-demo-2a-quick-fixes`, `fix/pre-demo-2b-unit-costing`, `feat/pre-demo-2c-phone-screens`.
3. Commit this plan file first on PR A's branch.
4. Open each PR as a **draft**, never merge. Both `pnpm build` runs (backend and frontend) and `pnpm test` must be clean before each push (CLAUDE.md).
5. Two files in the working tree are untracked and belong to the owner's review: `docs/features/inventory/demo/*.html` (the readiness brief and walkthrough guide) and `backend/src/scripts/seed-demo-inventory.ts` (demo reference-data seed). **Do not commit them unless the owner asks.** Ask once, in your first message, whether to commit the seed script (it is useful for production demo data).

---

## PR A — small code fixes and copy

Verify each by reading the code first; file names below are where the dry run
pointed, not guaranteed line numbers. Grep before editing.

### A1. Requisition status shows "Awaiting approval" after approval
`frontend/features/requisitions/components/screens/department-landing-screen.tsx` maps `row.mySectionStatus` through `STATUS_LABEL` (~l.34–37, l.139). After the Branch Manager approves, the requisition is `APPROVED` in the database but the section stays `SUBMITTED`, so the head is still told "Awaiting approval" (and may still see Recall). Use the requisition's own status when it is approved (label "Approved"), hide Recall once approved, and check the same for other statuses (returned, etc.). Confirm the list endpoint returns the requisition-level status; add it to the type if not. Test it.

### A2. Attendant sees an error on the phone receipt screen
Logged in as `STORE_ATTENDANT`, the New Goods Receipt mobile screen shows a red "1 error" toast and the header says "No supplier yet" even though the delivery has a supplier. Cause: the screen calls `listSuppliers` (`frontend/features/inventory/services/inventory-api-service.ts` ~l.103) and attendants get 403 on suppliers. Also on the catalog landing, attendants trigger 403s on `/inventory/central-store-location` and `/inventory/suppliers` (console noise).
- Do not call role-forbidden endpoints for attendants; take the supplier name from the expected delivery / receipt data already loaded, or from a field the attendant is allowed to read.
- Do not weaken backend permissions (attendants must stay 403 on suppliers).
- Verify as the attendant at 390px: no toast, supplier name shown, no 403s in the network log on catalog and receipt screens.

### A3. Signature font not applied (two causes)
1. **Code:** `features/dispatch/components/printable-delivery-note.tsx` (~l.126, 137) and `features/requisitions/components/printable-requisition.tsx` (~l.85) use `font-['Alex_Brush',cursive]`. `next/font/google` registers a generated family name (e.g. `__Alex_Brush_Fallback_7f734c`), so the literal name never matches. Use the `font-wds-signature` class (which reads `var(--font-signature)`), as `components/app/shell/sign-sheet.tsx` and `printable-count-verification.tsx` already do. Grep for any other literal.
2. **Font download:** the dev log shows "Failed to download `Alex Brush` from Google Fonts. Using fallback font instead" (same for Inter, Cormorant Garamond, Playfair Display) — `next dev` times out fetching fonts and silently falls back. Bundle the signature font with the app (`next/font/local` with the woff2 committed under `frontend/public/fonts/` or `frontend/app/fonts/`, license file included) so signatures never depend on a network fetch, keeping the `--font-signature` variable name. Do the same for the other three only if trivial; otherwise note it as a follow-up. Alex Brush is under the SIL Open Font License.
- Verify: `document.fonts` shows the real face `loaded` (not only `Fallback`), and the delivery note, requisition print and sign sheet all render the script face. Check the print preview and, if you can, the saved PDF (finding #27 in `WALKTHROUGH_FINDINGS.md` was this).

### A4. Copy and label fixes
Each is small; find the source with grep.
- Receiving worklist card says "expected Today ago" — fix the relative-time copy when the date is today.
- Dispatch queue / fulfil says "approved 14:52" — that is the requisition's **opened** time. Show the actual approval time (the field exists on the approved requisition) or reword.
- Mobile header shows "WENDO RMS · HUB" for a branch Department Head — should show the branch (Nyeri Town etc.). Look at `MobileHubHeader` and what it is given on the requisitions screens.
- Delivery note letterhead shows a placeholder phone `+254 712 000 000` and a branch address for the Central Store. Find where these come from (`printable-delivery-note.tsx`, `delivery-note-screen.tsx`, organization fields). Use real organization data or omit the line when absent — never print a placeholder.
- Department Head landing (`department-landing-screen.tsx`) still shows "Opening dispatch — Coming in a later milestone" and "Opening count — Coming in a later milestone". Dispatch has shipped: link "Confirm receipt" to `/app/branch/deliveries`. Leave the opening-count card clearly labelled or hide it — do not invent behaviour.
- Sidebar highlights **Catalog** while on Discrepancies (`inventory-shell.tsx` active key for the discrepancies routes). Highlight Dispatch (discrepancies live under it) or add the right key.
- Delivery confirm stepper buttons (`features/dispatch/components/screens/confirm-receipt-screen-mobile.tsx`) have no accessible name — add `aria-label` ("Decrease quantity for <item>" / "Increase …"), matching the waste screen, which already does this.
- Admin "Add Leadership Account" form (`frontend/app/app/admin/page.tsx`) says "The user will be prompted to change this on first login." No such prompt exists. Remove the sentence (do not build a forced password change in this round).
- `DesktopOnlyNotice` (`features/inventory/components/desktop-only-notice.tsx`) reuses the receipt wording for Settings ("On mobile, use the Receiving worklist to start a receipt"). Make the message accept a screen-specific hint so Settings says something correct (e.g. "Open Settings on a laptop"). PR C replaces both notices with real phone screens; this is only the interim copy fix.

### A5. Tests and verification for PR A
Add or update tests for A1 (status mapping) and any pure helpers. Browser-verify A1–A4 in the dry-run environment (see below). Record before/after in the Outcome log.

---

## PR B — unit costing (OWNER DECISION, then build)

### The defect (reproduced)
Receiving stores the **price per buy unit** as the item's cost, but every consumer multiplies it by a **usage-unit** quantity.
- `backend/src/modules/inventory/receiving-service.ts` ~l.991 writes the ledger row with `quantity: line.quantityUsageUnit` and `unitCost: line.unitPrice`, and ~l.1002 sets `currentCost: line.unitPrice`. `line.unitPrice` is per **buy** unit (line total = buy quantity × unit price).
- Consumers treat `currentCost` as per **usage** unit: `count-service.ts` (~l.466, 601, 662–724 variance × currentCost), `prep-service.ts` (~l.238–265 input cost), waste valuation, dispatch cost (`costAtDispatch`).
- Reproduced in the dry run: 4 bags × 25 kg of coffee at KES 12,000/bag → ledger `100 kg @ 12,000`. The verify screen showed on-hand value **KES 1.26M**, a 1 kg count gap valued at **−KES 12,000** (should be about 480), and a false "Director notified: Yes" (variance value above the KES 5,000 alert threshold).

### OWNER DECISION — confirm first
Recommended and the default: **store cost per usage unit** (`currentCost = unitPrice ÷ conversionFactor`, ledger `unitCost` on RECEIVE the same), because counts, prep, waste and dispatch already work per usage unit and production has **no receipts yet** (0 items, 0 suppliers, 0 ledger rows in the production snapshot and confirmed by the owner), so no data migration is needed. The alternative (keep per buy unit and convert at every consumer) touches far more code. State this recommendation in your first message and proceed with it unless the owner objects.

### Build (if per usage unit)
- Receiving sign: `currentCost` and the RECEIVE ledger `unitCost` = `unitPrice ÷ (conversionFactor ?? 1)`, rounded to the column precision (Decimal 12,4). Use `Prisma.Decimal` throughout; no floats.
- **Price alerts:** the alert compares the entered price with the previous price (`priceAlertPrevPrice`, `receiving-validators.ts` ~l.404). Compare on the **same basis** (per buy unit): convert the item's stored per-usage cost back to per buy unit (× conversionFactor) when computing the previous price, or store the previous price snapshot in buy-unit terms. Do not change what is displayed to the user on the receipt (price per buy unit stays the input).
- **Estimated price pre-fill** (`estimatedUnitPrice` pre-fills from `currentCost`, `DATA_MODEL.md` ~l.1986): the pre-fill is a per-buy-unit price, so convert (× conversionFactor).
- Check every other reader of `currentCost` / RECEIVE `unitCost`: stock value, reports, supplier AP (line totals must stay buy quantity × buy price), catalog "current cost" display (label the unit: "KES 480 / kg"). Grep `currentCost` and `unitCost` across `backend/src` and `frontend/`.
- Update `docs/DATA_MODEL.md` (the two statements at ~l.1783 and ~l.2056) and `docs/API_CONTRACT.md` where cost units are described. State the unit explicitly: "per usage unit".
- No migration needed (empty production); state that in the PR. If a dev database has receipts, note that its old rows are wrong and were not converted.
- Tests: receiving sign writes per-usage `currentCost` and ledger cost (conversion 25, price 12,000 → 480); conversion null → factor 1; price-alert comparison unchanged in behaviour for the same inputs; count variance value uses the corrected cost (1 kg gap → 480, below the Director threshold); AP totals unchanged.

### Verify in the browser
Repeat receipt → prep → dispatch → count in the dry-run environment with a fresh receipt and confirm: item cost shows per kg, on-hand value is sane, the 1 kg coffee gap is about KES 480, no false Director notification.

---

## PR C — phone screens (Paper first)

### Scope
Two screens currently show "Use a larger screen" on a phone (`DesktopOnlyNotice`):
1. **Goods Receipt detail** (`features/inventory/components/screens/goods-receipt-detail-screen.tsx` ~l.43). The Store Attendant lands here right after signing a receipt on a phone. `WALKTHROUGH_FINDINGS.md` §4.2 (#7) records it as a documented gap needing a mobile design.
2. **Settings (Team + My PIN)** (`settings-screen.tsx` ~l.34). The Store Manager may open it on a phone; the attendant never sees it.

### Process
1. **Paper design pass first.** File `01M1ZZJ6S3FZGF5C7PPBGTKY89`. Create a new page `Pre-Demo · Phone screens` and pass its page id on every call (another page in the same file holds the Round 1 artboards — do not touch it). Reuse the desktop artboards for Goods Receipt detail (Milestone Two page `C-0`, node `UVN-0`) and the Round 1 Settings artboards (page `p-H-0`) as the source of truth, and the existing mobile patterns (`drawer-shell`, `sheet`, `confirm-dialog`, `table` → stacked rows, `status-dot`, toast, the States kit). No new visual language. Artboards at 390px: Goods Receipt detail (signed, with signature block and price-alert flags), Settings › Team (stacked rows with row actions in a sheet), Settings › My PIN. **Stop and get the owner's approval of the artboards before building.** Never show raw node ids to the owner.
2. Build against the approved artboards with the milestone-6 §4 build gate (hover/active/focus, in-flight, feedback, loading/empty/error from the States kit). Follow the frontend hook-stability rules in `CLAUDE.md`.
3. Remove `DesktopOnlyNotice` usage from both screens (delete the component if nothing else uses it).
4. Browser-verify at 390px as Store Attendant (receipt detail after signing) and Store Manager (Team actions: add, reset password, reset PIN, deactivate, reactivate; My PIN set and change).

---

## Dry-run environment (how to reproduce the findings and verify)

The dry run used a scratch database and second servers so the owner's dev
data was untouched. Recreate it, or reuse it if it is still up
(`ss -ltnp | grep -E ':(3100|4100)'`; a scratch checkout may exist at `/tmp/claude-1000/dryrun-fe` — it is a `git worktree`, remove it with `git worktree remove --force` when done).

```bash
# 1. Scratch DB = clone of the production snapshot, then newer migrations
docker compose exec -T postgres psql -U wendo_user -d postgres \
  -c "create database wendo_rms_dryrun template wendo_rms_prod_mirror;"
cd backend
export DATABASE_URL="postgresql://wendo_user:<password from backend/.env>@localhost:5433/wendo_rms_dryrun"
npx prisma migrate deploy
npx tsx src/scripts/provision-branch-departments.ts     # 15 department locations
# 2. Demo reference data (needs the demo Store Manager to exist first — create it through the UI)
DEMO_SEED_CONFIRM=YES DEMO_SET_PASSWORDS=YES npx tsx src/scripts/seed-demo-inventory.ts
# 3. Backend on 4100, frontend on 3100 (a separate checkout so .next is not shared)
PORT=4100 FRONTEND_ORIGIN=http://localhost:3100 npx tsx src/server.ts
NEXT_PUBLIC_API_URL=http://localhost:4100/api/v1 NEXT_PUBLIC_SOCKET_URL=http://localhost:4100 npx next dev -p 3100
```
`wendo_rms_prod_mirror` is a production snapshot (about 21 Sep): 4 organisations (Central Store hub + Nyeri Town, King'ong'o, Wendo Nyahururu), all staff roles, **no PINs, no categories, items, suppliers or ledger rows, and no branch department locations**. The scratch System Admin password was set to `DryRun#2026!` in the scratch DB only.

Accounts used (scratch only; all `DryRun#2026!` unless noted): `system.admin@wendo.co.ke`; Kitchen head `kelvin.kings@wendo.co.ke` (Nyeri Town); Barista head `victor.town@wendo.co.ke`; Branch Manager `manager.town@wendo.co.ke`; demo Store Manager `demo.storemanager@wendo.co.ke` / `TempPass#2026` (PIN 9753); demo Attendant `demo.attendant@wendo.co.ke` / `AttPass#2026` (PIN 2468). Created through the UI: the demo Store Manager (Admin › Add Account) and the demo attendant (Settings › Team).

Seeded reference data (all in KES per **usage** unit — which is what the rest of the system expects): categories Meat & Poultry, Dairy & Eggs, Vegetables & Herbs, Dry Goods, Cooking Essentials (+ Coffee made in the UI); suppliers Kagumo Poultry Farm, Karatina Fresh Produce, Nyeri Dairy Cooperative (+ Nyeri Coffee Growers made in the UI); items Chicken breast (raw), Cooking oil, Garlic, Lemons, Wheat flour, Marinated chicken breast (prepped, Kitchen), Fresh milk (stocked, Barista + Kitchen), Eggs (stocked, Kitchen + Pastry); opening stock at the Central Store; restock levels for the Central Store and Nyeri Town departments.

The tested flow (repeat it to verify): attendant prep run → Kitchen head requisition → Branch Manager edit + approve (PIN) → Store Manager dispatch (PIN) → Kitchen head confirm 8 of 9 (PIN) → Store Manager resolve the discrepancy → Kitchen head waste + ledger → attendant blind count (PIN) → Store Manager verify → Team deactivate/reactivate → sign out.

Tips learned: use the Playwright MCP (the chrome-devtools MCP browser was locked); `next dev` shows a splash for several seconds on first compile of a route — wait for text, don't screenshot blindly; screenshots and snapshot files must be written under `/home/fred/Projects/V3-RMS/.playwright-mcp/` (git-ignored); to sign out reliably clear cookies and storage via `page.evaluate`; the mobile stepper buttons had no accessible names until A4.

## Non-negotiables reminder

Strict TS, no `any`; `authenticate` + `requireRole` on every route; `organizationId` in every repository query; business logic in services, queries in repositories; Zod on every endpoint; passwords and PINs never logged or returned; tests for backend changes; pnpm only. Commits end with the attribution line from the session's system reminder.

## Not code — the owner does these (list them in your summary if relevant)

1. Merge PR #40, then A, B, C in order; CI deploys.
2. In production run `provision-branch-departments` on the server (`node dist/scripts/provision-branch-departments.js`) — the production snapshot had no branch department locations; without them requisitions and dispatch fail.
3. Run the pre-meeting checklist queries in the readiness brief, create the demo accounts, set PINs at first signature, and seed demo reference data (decide whether to use the demo seed script).

## Out of scope

Accountant and Director screens; a forced password-change flow; the standard-price field (`WALKTHROUGH_FINDINGS.md` §5.1); branch day close (Milestone 6 Session 3); anything not listed above.

---

## End-of-session summary (paste this back to the tech lead)

Report, in chat: (1) what shipped per PR with commit SHAs and PR links; (2) every deviation from this plan and why; (3) the costing decision as confirmed by the owner; (4) test counts before and after; (5) what you verified in the browser and what you could **not**; (6) any new gaps found; (7) the exact steps the owner must run after deploy.

## Outcome log

### PR A — quick fixes (branch `fix/pre-demo-2a-quick-fixes`)

Owner decision on costing (PR B): recommendation stated in the first message (per usage unit); proceeding unless the owner objects.

- **A1** — new `features/requisitions/lib/requisition-display-status.ts` (+ tests): once `requisition.status === 'APPROVED'` the head sees "Approved"; Recall and Cancel are hidden; approved rows group under "Earlier today". The list endpoint already returned the requisition-level status, so no backend change. Verified in browser as Kitchen head: "Opened 02:52 PM · Approved", only "View my section".
- **A2** — the receipt screen no longer calls `listSuppliers` unless the role is STORE_MANAGER; the supplier name comes from the expected delivery. The catalog only resolves the Central Store location for the Store Manager. The item form options load only when the drawer opens and skip suppliers for non-managers. Verified as attendant at 390px: supplier name shown, no 4xx on catalog or receipt.
- **A3** — signature font bundled with `next/font/local` (`app/fonts/alex-brush/`, latin subset woff2 + OFL.txt), same `--font-signature` variable; the literal `font-['Alex_Brush']` classes replaced with `font-wds-signature`. Verified `document.fonts` loads the real `__alexBrush_*` face from the local file. **Not verified:** the print preview / saved PDF (the print routes redirected to the dashboard for the role I used). **Follow-up:** Inter, Cormorant Garamond and Playfair Display still come from Google at build; a first `pnpm build` in this session failed once with a `next/font` fetch error and passed on retry (flaky network fetch — the same fragility).
- **A4** — deviations and notes:
  - "expected Today ago": `ageLabel` already contains "ago" (backend `formatAgeLabel`), and it is the delivery's age, not its expected date. Now "listed today" / "listed 2 days ago" (four screens).
  - "approved HH:MM" reworded to "opened HH:MM" (no `approvedAt` on the dispatch contract; avoids a backend change).
  - Department Head header now shows the branch (`orgLabel` from `user.organizationName`).
  - Letterhead: placeholder phone/address lines removed from the delivery note (print + screen) and from the count-verification print (which also carried a fake PIN). Real organization address/phone/KRA PIN exist on the Organization model but are not in the note responses — plumbing them through is a follow-up.
  - Department landing: INCOMING DISPATCH now links "Confirm receipt" to `/app/branch/deliveries`; opening-count card kept, labelled "Coming soon".
  - Sidebar: `/app/inventory/discrepancies` highlights Dispatch.
  - **Plan correction:** `confirm-receipt-screen-mobile.tsx` steppers already had `aria-label`s. The unlabelled steppers were in `dispatch-fulfil-screen-mobile.tsx` and `new-goods-receipt-mobile.tsx`; both are now labelled.
  - Admin "prompted to change this on first login" sentence removed.
  - `DesktopOnlyNotice` takes a `hint` prop; Settings says to open it on a laptop.
- **Tests:** frontend 91 passed (was 88; +3 new). Backend 1119 passed (unchanged, no backend change). Both `pnpm build` clean.


### PR B — unit costing (branch `fix/pre-demo-2b-unit-costing`, stacked on PR A's branch)

- **Decision:** per usage unit, as recommended (owner had not objected when the build started).
- New `backend/src/modules/inventory/receiving-cost.ts` (`costPerUsageUnit`, `Prisma.Decimal`, 4dp). `signGoodsReceipt` writes both `InventoryItem.currentCost` and the RECEIVE ledger `unitCost` through it. The factor comes from the line's own saved quantities (`quantityUsageUnit ÷ quantityBuyUnit`), i.e. the factor that produced the ledger quantity, rather than a second item lookup — conversion null → equal quantities → factor 1.
- **Price alerts unchanged:** the alert compares against the previous signed receipt line's buy-unit `unitPrice` (`lastPriceRepository`), not `currentCost`, so no conversion was needed there. Receipt `lineTotal` and supplier AP are untouched (buy quantity × buy price).
- **Frontend pre-fills:** `currentCost` is per usage unit, so New Goods Receipt (add-item) and New Purchase now pre-fill `buyUnitPriceFromCost(currentCost, conversionFactor)` (`features/inventory/lib/buy-unit-price.ts`). The expected-delivery prefill on the receipt uses the delivery's own `estimatedUnitPrice` (already per buy unit) and is unchanged. Stock ledger/table already label cost per usage unit; prep, waste, dispatch, counts and stock value were already usage-unit consumers and needed no change.
- Docs: `DATA_MODEL.md` (currentCost, estimatedUnitPrice, goods-receipt `unitPrice`) and `API_CONTRACT.md` (Goods Receipt behaviour note) now state "per usage unit".
- **No migration** (empty production). The scratch dry-run DB still holds the old GRN-0001 (ledger `100 kg @ 12,000`); it was not converted.
- Tests: new `receiving-cost.test.ts` (4); receiving-service sign tests now assert 12,000/bag × 4 bags of 25 kg → currentCost and ledger `unitCost` 480, and the no-conversion case; `count-calc.test.ts` asserts a 1 kg gap at 480 is valued −480 and does not trigger the Director alert. Backend 1119 → 1125 passed; frontend 91 → 95 passed.
- **Verified against the scratch API/DB:** fresh receipt of 4 bags at 12,000 → line total 48,000, item cost 480, ledger `RECEIVE 100 kg @ 480`. **Not re-run in the browser:** the full prep → dispatch → count flow with a fresh receipt (the count variance value is covered by unit tests only).

### PR C — phone screens (branch `feat/pre-demo-2c-phone-screens`, stacked on PR B)

- **Design:** Paper page "Pre-Demo · Phone screens" (6 artboards: receipt detail, Team, row-actions sheet, Add attendant sheet, My PIN not-set, My PIN set/change). Owner approved before build. Reset/deactivate confirmations reuse the existing `ConfirmDialog`; loading/empty/error reuse the states kit.
- **Built:** `goods-receipt-detail-mobile.tsx` (new); Settings phone layout (hub header + tabs) with `MobileTeamList` + actions bottom sheet in `team-panel.tsx`; `DrawerShell` gained `side="bottom"` for the Add attendant sheet; `SigningPinCard` gained `stacked`. `DesktopOnlyNotice` deleted (no remaining users).
- **Deviations:** the Paper receipt artboard drew the retired supplier-claim note (stale, see the desktop screen's header) — not built; only persisted price alerts and the linked invoice appear under Notes. Line rows show `qty unit · @ unit price` (added over the artboard, since the data is already on the line). Signer role is formatted ("Store Manager") rather than the raw enum.
- **Verified at 390px in a real browser:** Store Manager — Team list, actions sheet, Reset PIN, Reset password (short-password error, then success), Deactivate, Reactivate, Add attendant (email validation error, then created), My PIN change (wrong password error, then success). Store Attendant — signed receipt detail (bundled signature font renders).
- **Not verified:** My PIN *first-time set* on a phone (same `SetPinForm` as desktop, exercised in Round 1); receipt detail with a price-alert line (no such receipt in the scratch DB); loading/error states visually.
- Frontend tests 95 (no new tests: presentation-only components), backend 1125; both builds clean.
