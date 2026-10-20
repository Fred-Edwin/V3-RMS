# Payslips · mine (the phone)

**Spec:** `docs/features/workforce/specs/3-payslips-spec.md`, Paper "Workforce · D. Pay" Chapter 12 steps 30 to 36. **Status:** built and walked in a browser at 390 and 320 wide, tablet 768 checked (20 Oct 2026), awaiting owner review. **API:** `docs/API_CONTRACT.md` §42. **Decisions:** `docs/features/workforce/decisions-3-payslips-frontend.md`.

Routes (thin shells under `app/app/workforce/my-payslips/`): home, `history`, `[id]` (`?v=` for a version), `[id]/document`, `p9/[year]`. A section layout wraps all of them in `PayslipGate`.

**Safety:** pay is never in the page until the code is right (`x-payslip-unlock` plus `x-device-id` on every read); amounts are hidden by default per device and person, and hidden amounts are not in the DOM; the unlock lives in memory only and is dropped after 60 s in the background, on leaving, and on `UNLOCK_REQUIRED`. A person on a branch not yet on the new payslips sees one card linking to the old screen (`/app/payslips`, still live). The System Admin sees "Page not found".

## Parity manifest (one line per screen)

| Screen | Paper | Built | Notes |
|---|---|---|---|
| Code (locked list, wrong, slowed, first code) | step 30 | `unlock/` | Wrong and slowed states are beyond Paper, in words. One brown button. |
| Home (hero net, year bar, recent) | step 31 | `home/` | Hidden dots, eye, "Corrected" badge. |
| Detail (this month, year to date, workings) | steps 32, 35 | `detail/` | Version 1 shows "Replaced" with a link to the current. |
| History and P9 card | step 33 | `history/` | Download P9 disabled with its reason in text. |
| Document view | step 34, Ch 1 and 10 | `document/` | pdfjs canvas, pinch, double tap, zoom buttons, "Read as text". |
| Old-payslip card | step 36 | `_shared/components/old-payslips-card.tsx` | Links to `/app/payslips`. |

Token substitutions and browns are unchanged from the spec's section 0; nothing was added with a second brown button on one screen.

## Shared-file changes (line level, for the orchestrator's merge)

- `components/app/shell/nav-table.ts`: removed `notBuilt` from `wf-my-payslips`, `wf-staff-my-payslips` (roles now `[...SHIFT_STAFF, STORE_ATTENDANT]`) and `wf-head-casuals`; added row `wf-casual-approve`; deleted legacy row `staff-payslips`. `nav-table.test.ts` follows.
- `lib/route-access.ts`: two blocks (`my-payslips`, `casuals`) before "Home of the floor staff". Tests: `lib/route-access.payslips.test.ts`.
- `features/workforce/_shared/lib/capabilities.ts` (new capabilities, `headOfDepartmentIds`, `organizationId`), `hooks/use-workforce-permissions.ts` (`siteId`, `headOfDepartmentIds`), `lib/notification-copy.ts` (40 to 44 rows), `lib/kit-logic.test.ts`, `index.ts`.
- `_shared/components/phone-screen.tsx` moved here from `timesheets/mine/`; `pdf-viewer.tsx`, `lib/pinch-zoom.ts`, `lib/role-words.ts` added; `PhoneDarkHeader` gained `figureSize`, `aside` and a node figure.
- `frontend/package.json`, `pnpm-lock.yaml`: `pdfjs-dist`.

**Coupling:** the shared Workforce kit, the nav table, `route-access`. The Casual sub-module links here only through the kit.
