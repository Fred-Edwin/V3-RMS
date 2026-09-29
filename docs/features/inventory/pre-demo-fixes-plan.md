# Pre-Demo Fixes — Accounts, PINs, Conversion Field — Build Plan

## Paste this into a fresh Claude Code session

> You are the build agent for Wendo RMS, **Pre-Demo Fixes**. Your brief is
> `docs/features/inventory/pre-demo-fixes-plan.md`. Read it top to bottom
> before touching code and follow it in order. The decisions in it are
> settled — don't re-open them. If something turns out wrong in the code or
> in Paper, fix it and record the correction in this file's Outcome log —
> never silently work around it. `main` already contains Milestone Six
> Session 2 (PR #39). Start with:
> `git switch main && git pull --ff-only && git switch -c fix/pre-demo-gaps`.
> (This plan file may be untracked on another branch — copy it over and
> commit it as the first commit.) Finish with the End-of-session summary
> below, in chat, so the tech lead can carry on in another session.

---

## Why this exists

The owner will run client + role user-testing **in production**: setting up
the item catalog live with the client, then walking Store Manager, Store
Attendant, Department Head and Branch Manager through the flows. Three gaps
block or embarrass that session. Accountant and Director are out of scope
for the demo and for this plan.

## Read first (only the sections named)

1. `CLAUDE.md` — whole file (non-negotiables, hook-stability rules, MCP tools).
2. `docs/FEATURE_REDO_PLAYBOOK.md` §5, §7–§9.
3. `docs/CODING_STANDARDS.md` §4 (backend) / §9 (frontend); `docs/DESIGN_SYSTEM.md` sections you touch.
4. `docs/features/inventory/WALKTHROUGH_FINDINGS.md` — §3.1 (conversion field), §3.4, §5.3b (Store Manager settings page — owner-approved 2026-09-23; this plan builds the **Team + My PIN slice** of it only).
5. `docs/features/inventory/milestone-6-plan.md` §4 (build gate — binding: hover/focus/in-flight/feedback on every interactive element, loading/empty/error from the States kit, per-screen Paper gate).
6. `docs/API_CONTRACT.md` staff + auth sections (whichever exist).
7. Central Store scoping: `docs/inventory/CENTRAL_STORE_SCOPING_DESIGN.md` (D-15) — store roles live on the hub org only.

## The three fixes

### Fix 1 — Account creation for store roles

Facts verified 2026-09-29:
- Backend `POST /staff` already allows `STORE_MANAGER` as actor (`backend/src/routes/staff-routes.ts`), and `staff-service.ts` forces store roles onto the hub org and limits a Store Manager to creating `STORE_ATTENDANT`.
- The **System Admin page already offers Store Manager / Store Attendant** (`frontend/app/app/admin/page.tsx` ~l.883) — verify it works end to end in a browser; this is how the Store Manager is created.
- The old Branch Manager staff page (`frontend/app/app/manage/staff/page.tsx`) offers only branch roles. **Leave it alone** (legacy design system, branch staff only).
- The store sidebar (`features/inventory/components/inventory-shell.tsx`) has no Settings/Team entry, so a Store Manager has no way to create attendants.
- Check how a temporary password is handled at creation (`validators/staff-schemas.ts`, `createStaff`) — I did not confirm whether the API accepts one or generates it. Follow whatever the existing admin/staff flow does; do not invent a second mechanism.
- `PATCH /staff/:id/reset-password` and `deactivate`/`reactivate` are `MANAGER`/`SYSTEM_ADMIN` only — a Store Manager cannot use them today.

Build:
- Backend: allow `STORE_MANAGER` on reset-password, deactivate, reactivate, and staff list/get — **scoped in the service to hub-org `STORE_ATTENDANT` accounts only** (a Store Manager must never touch branch staff or other store managers). Tests for allowed + every denied case.
- Frontend: the **Store Manager Settings page** (below), Team section.

### Fix 2 — PIN setup

Facts verified 2026-09-29:
- `POST /users/me/pin` exists (`auth-routes.ts:73`, `authService.setPin`), 4-digit, no current-PIN check; **no frontend calls it**. Nothing anywhere lets a user set a PIN, and `createStaff` never sets one. Every signing service (`requisitions`, `dispatch`, `receiving`, `count`, `discrepancy`) 4xx's when `pinHash` is null.
- No endpoint lets a Store Manager reset an attendant's PIN.

Build:
- **Sign sheet "Set your PIN" step** (`frontend/components/app/shell/sign-sheet.tsx`, shared by every signing site): if the signer has no PIN, show a set-PIN step (enter + confirm) before signing, then continue. Needs the auth user payload / a `hasPin` flag exposed safely (never return the hash). One shared fix — all existing call sites inherit it; verify at least Requisitions, Dispatch, Goods Receipt, Daily count.
- **Change my PIN**: a small "Signing PIN" card on the existing Profile page for every role, plus a My PIN section on the Store Manager Settings page. Changing an existing PIN should require the current password or current PIN — decide the simplest safe option, record it.
- **Reset attendant PIN (Store Manager)**: new endpoint (e.g. `PATCH /staff/:id/reset-pin`) that **clears** the attendant's PIN so they set a new one at next signing. The Store Manager never sees or chooses a PIN. Hub-org attendants only. Zod schema, `authenticate` + `requireRole`, tests.
- Team table shows a **PIN status** (Set / Not set) — expose a boolean, never the hash.

### Fix 3 — Conversion-factor / pack-size field (WALKTHROUGH §3.1, finding #1)

Today the item form's "Conversion" is a free-text sentence (`"1 bag = 25 kg"`) regex-parsed in `item-form-screen.tsx` (~l.108) and **silently saved as null** on any format mismatch. `packSize` has the same problem.

Build (design already agreed with the owner): a **numeric `conversionFactor` input** plus a computed, non-editable label `1 {buyUnit} = [___] {usageUnit}`; same treatment for `packSize`; real validation errors, never a silent null. Files: `frontend/features/inventory/components/item-form.tsx`, `.../screens/item-form-screen.tsx`. Check the backend schema/validator already accepts a numeric factor; migrate existing free-text handling only if needed. Verify with **items already in the catalog** (edit an existing item; nothing may be corrupted) and with a brand-new item.

## Store Manager Settings page (new UI)

Owner-approved approach:
- New route inside the store shell, e.g. `frontend/app/app/inventory/(shell)/settings/page.tsx` (thin shell) → `frontend/features/inventory/…` screen. New sidebar item **"Settings"**, `STORE_MANAGER` only (extend `navGroupsForRole`). Hidden from attendants; the route must also be backend-enforced.
- **Team** section: table of hub staff — name, role, **PIN status**, Active. "Add attendant" button → side drawer (name, email, temporary password per the existing mechanism; **no role picker**). Row actions: Reset password, Reset PIN, Deactivate/Reactivate, each with a confirm dialog and a success toast (`useWdsToast`).
- **My PIN** section: set / change own PIN.
- Desktop-primary (Store Manager is desktop-first, per O-SM1). Attendants get no account management; they only see the sign-sheet Set-PIN step on mobile.
- Do **not** build the other 5.3b items (profile, price/yield thresholds, default payment terms, notification prefs) — out of scope.

## Process — in this order

1. **Paper design pass first (small).** File `01M1ZZJ6S3FZGF5C7PPBGTKY89`; load the Paper guide once; create a new page `Pre-Demo · Team & PIN`. Artboards (desktop unless noted): Team table (populated), Team table empty/loading/error per the States kit, Add attendant drawer (+ validation error), confirm dialogs (reset password, reset PIN, deactivate), My PIN section (set + change), sign sheet "Set your PIN" step (desktop **and mobile**), Profile "Signing PIN" card, conversion-factor field states (empty, valid computed label, invalid). Reuse existing ui2 patterns (`drawer-shell`, `table`, `confirm-dialog`, `sheet`, `input-otp`, `status-dot`, toast) and `wds-` tokens — no new visual language. **Stop and get the owner's approval of the artboards before any build.** Never show raw node IDs to the owner.
2. **Backend** (Fix 1 + 2): service/repo/controller/routes/validators/tests; `pnpm build && pnpm test` green.
3. **Frontend**: Fix 3, sign-sheet PIN step, Profile card, Settings page. Per-screen visual gate against Paper as you build (by eye + `get_computed_styles`; no automated pixel-diff). Follow the frontend hook-stability rules in `CLAUDE.md`.
4. **Real-browser verification** (chrome-devtools MCP, `run-frontend-browser` skill), acting as: System Admin creates a Store Manager → Store Manager logs in, creates an attendant, resets their PIN/password → attendant logs in on mobile width, hits a signing action, sets a PIN, signs → Branch Manager / Department Head with no PIN sign a requisition through the new step. Catalog: create a new item and edit an existing one with the new conversion field. Check console + network for errors; confirm `pin_hash` states in Postgres MCP (local DB only).
5. Both builds before push: `cd backend && pnpm build && pnpm test`; `cd frontend && pnpm build`. Open a PR (draft) — **do not merge**; the owner merges and CI/CD deploys.

## Non-negotiables reminder

Strict TS, no `any`; `authenticate` + `requireRole` on every route; `organizationId` in every repository query; business logic in services only; Zod on every endpoint; passwords/PINs never logged or returned; tests for every new endpoint; pnpm only. Commits end with the attribution line from the session's system reminder.

## Out of scope

Accountant and Director screens/accounts; Store Manager settings beyond Team + My PIN; any redesign of the legacy staff page; anything in milestone 6 Session 3+.

---

## End-of-session summary (paste this back to the tech lead)

Report, in chat: (1) what shipped per fix with commit SHAs + PR link; (2) every deviation from this plan and why; (3) how the temporary-password question was resolved; (4) the PIN-change security decision; (5) test counts before/after; (6) what you verified in the browser, and what you could **not** verify; (7) any new gaps found; (8) exact steps the owner must run after deploy (migrations? seed? first-login order for the demo accounts).

## Outcome log

**2026-09-29 — Paper design pass approved by the owner** (page "Pre-Demo · Team & PIN", file `01M1ZZJ6S3FZGF5C7PPBGTKY89`).

**Backend (Fix 1 + Fix 2) — built, `pnpm build` clean, tests 1079 → 1119 (+40).**
- **Temporary-password question resolved:** `POST /staff` already takes `temporaryPassword` (min 8) and `createStaff` hashes it; `PATCH /staff/:id/reset-password` takes the same field. The Team UI follows that — no second mechanism.
- **PIN-change security decision:** changing an *existing* PIN requires the caller's **current account password** (`POST /users/me/pin` `currentPassword`, checked with bcrypt compare, wrong/missing → 400). First-time set needs no password. Chosen over current-PIN because a user who forgot their PIN can still recover; the endpoint previously overwrote unconditionally, so a stolen session token could take over signing.
- **`hasPin` exposure:** new `GET /users/me/pin-status` → `{ hasPin }` (fresher than caching a flag on the login payload — a Store Manager reset takes effect without re-login). Team rows carry `hasPin` via `staffRepository.findTeamWithPinStatus`, which maps `pinHash` to a boolean inside the repository so the hash never leaves it.
- **Scoping:** one `resolveScope(actor)` helper in `staff-service.ts` drives list/get/reset-password/deactivate/reactivate/reset-pin; `STORE_MANAGER` → own org + `['STORE_ATTENDANT']`, enforced in repository `where` clauses (`organizationId` + `role in`). `setActive`/`updatePassword` gained an optional `allowedRoles`.
- **Deviation (small):** the Store Manager's own row in the Team table is *not* returned by `GET /staff` (plan says attendants only). The frontend builds that row from the auth user + `pin-status`.
- **Deviation (small):** `reset-pin` is `SYSTEM_ADMIN` + `STORE_MANAGER` only (branch Managers not added — no demo need).


**Frontend (Fix 1 UI, Fix 2 UI, Fix 3) — built; `pnpm build` clean; frontend tests 65 → 88 (+23, item-form validation).**
- **Settings page** (`/app/inventory/settings`, STORE_MANAGER only — sidebar item, middleware gate, backend routes all enforce): Team table (PIN status, Add attendant drawer, Reset password / Reset PIN / Deactivate / Reactivate each behind a confirm + toast) and My PIN tab.
- **Shared PIN layer:** `usePinStatus`, `SetPinForm`, `SigningPinCard` (Profile + My PIN). Both signing surfaces — `SignSheetDialog` (used by Requisitions, Dispatch, Goods Receipt, Discrepancy) and the mobile `PinSheet` (Daily/Spot count) — swap to a "Set your signing PIN" step when `pin-status` says no PIN, then sign with the PIN just set.
- **Fix 3:** numeric `conversion` / `packSize` inputs, computed non-editable labels, `validateOptionalPositiveDecimal` mirrors the backend's `positiveDecimalSchema`; invalid input blocks save with an inline message (no silent null). API values are normalised for display (`25.0000` → `25`) and round-trip unchanged.

**Corrections to the approved Paper (recorded, not worked around):**
1. *Pack size is not "whole number only".* Paper artboard 7 drew "Pack size must be a whole number" — wrong: `packSize` is a decimal quantity of the **usage unit** per pack (the catalog table already renders it as "12 kg"). Validation is positive decimal (≤ 4 dp), same as the conversion factor.
2. *Pack-size computed label reads `1 pack = 12 kg`* (Paper's "1 Case = 6 tins" mixed up buy unit and pack).
3. Invalid-format copy is "Enter a number like 25 or 12.5 (up to 4 decimal places)." for non-numeric input; "Enter a number greater than 0." for zero/negative (Paper showed only the latter).
4. The Profile "Signing PIN" card follows the approved Paper (2px radius, flat) and so sits slightly differently from the legacy rounded cards around it on that page.

**Real bugs found and fixed during browser verification:**
- Skeleton rows rendered `<div>`/`<span>` directly inside `<tbody>` (React invalid-nesting/hydration warning) → wrapped in a single `<tr><td>`.
- Row action labels wrapped onto two lines at narrower widths → `whitespace-nowrap`.
- (Environment) the long-running local `tsx watch` backend was serving pre-change code (`/users/me/pin-status` 404 and an unscoped `/staff` list); restarting it fixed that. Not a code defect, but worth knowing if the owner sees the same locally.

**Browser verification (chrome-devtools, local DB, real backend):** Store Manager: Settings scoped to 2 people; Add attendant (validation errors + success + toast); Reset PIN (DB `pin_hash` → null, table flips to "Not set"); Reset password (short-password validation, in-flight state, then the attendant logged in with the new password); Set-PIN step on the desktop dialog (mismatch error, then set + sign a spot count in one go, 201) and on the mobile sheet at 390px (same flow, "Spot count saved"); My PIN change (wrong password → "That password isn't right.", correct → "PIN updated"); Profile card renders. Attendant: no Settings nav link, direct `/app/inventory/settings` bounces to the catalog, `GET /staff` and `PATCH …/reset-pin` return 403. Branch Manager without a PIN: "Approve & sign" on a requisition opens the Set-PIN step (cancelled, not completed). Catalog: an existing item (24 / 12) hydrates, the old sentence format is rejected with an error, saving with unchanged numbers leaves DB `24.0000` / `12.0000`; a new item saved `25` / `25`.

**Not verified:** System Admin creating a Store Manager (existing admin page, untouched); Dispatch / Goods Receipt / Discrepancy sign sites individually (same `SignSheetDialog` I exercised via Requisitions and Spot count); an attendant hitting a signing action with no PIN on a phone (today's daily count was already submitted in local data, so the Store Manager used the same mobile `PinSheet`); Deactivate / Reactivate through the UI (same confirm path as Reset PIN, not clicked); the Team table's loading and error states (Skeleton nesting fix is untested visually).

**Local data touched:** two spot counts dated 29 Sep were created by the verification; the Store Manager / Nyeri Town manager / store attendant PINs were reset to the seed value `1234` and the attendant password to `password123`; the test attendant and test catalog item were deleted.
