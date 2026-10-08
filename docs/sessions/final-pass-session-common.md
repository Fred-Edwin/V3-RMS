# Final pass: rules every build session repeats

Read first, in this order: `CLAUDE.md`, `docs/FEATURE_REDO_PLAYBOOK.md` (§5 step 6, §9), `docs/CODING_STANDARDS.md`, `docs/UI_BUILD_RULES.md`, `docs/features/inventory/README.md`, `docs/features/inventory/final-pass-build-plan.md`, the block's contract, and the READMEs of the sub-modules you touch. **Paper wins** over any document. Paper file "Wendo RMS · Approved designs" (`01M3TP8J54R83RHC9FJ7RAHGKG`); never show raw node ids; do not edit any Paper page.

## House rules (from CLAUDE.md, restated)
- Edit files with the Edit and Write tools only; a one-line `Why:` before each; keep a task list; end with a short plain-English recap (about 5 lines): what changed, which files, how the owner verifies.
- pnpm only. Run both before you call it done: backend `pnpm build` and `pnpm test`; frontend `pnpm build`.
- No `any`. No `!` non-null assertions. Zod on every input. `authenticate` plus the access table on every route. `siteId` (column `organization_id`) in every repository query. Business rules in services only; Prisma in repositories only (a `$transaction` in a service is allowed). Every stock movement through `postStockMovement`; never `inventoryTransaction.create`.
- Migrations: edit the schema file, `npx prisma migrate dev --name <name>` locally, commit the migration beside the schema folder. Never `migrate dev` or `migrate deploy` against production. Test migrations on a restored production copy before release (the owner does the production steps).
- Do not push or merge without the owner's word. Commit footer: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Work on the branch the prompt names.
- Never invent behaviour. Where the design or contract is silent, stop and ask. If the contract is wrong, stop and report: an amendment needs the owner.

## Structure (the refactor rules)
Back end: `backend/src/modules/inventory/<sub>/` with `README.md`, `<sub>-routes.ts`, `-controller.ts`, `-service.ts`, `-repository.ts`, `-validators.ts`, `<sub>.types.ts`, tests beside the code, the frozen contract in `<sub>/_shared/<sub>-contract.ts` with fixtures and a contract test. Front end: `frontend/features/inventory/<sub>/{components,hooks,lib,services,store,types}`, `_shared/`, public `index.ts`; `app/` pages are thin shells. UI from `components/ui2/` with `wds-` tokens only; never import `components/ui/`. Navigation only through rows in `frontend/components/app/shell/nav-table.ts`. Other features import `features/inventory/index.ts` only. Delete the old files your work replaces in the same PR; do not work around them. Update the sub-module README in the same commit as behaviour. Hook stability rules in CLAUDE.md apply.

## Front-end quality bar
- Open **every screen of your chapters in Paper at full size** first (`get_screenshot` at scale 2 for small text, `get_jsx` and `get_computed_styles` for exact values; never read values from a screenshot) and list anything the contract does not cover; report it before building.
- Match Paper per screen, checked by eye and with `get_computed_styles`, one screen at a time as you build (never an automated pixel diff). Use the States kit (`shell-states.tsx`) and the wording tables; no per-screen state designs.
- Production-level behaviour: real loading (screen-mirroring skeleton), empty, error with Retry; optimistic updates only where safe; idempotency key on every signing write; no layout jumps; sockets where the contract says; page state (page, pageSize, search, filters, dates) in the URL; tables follow UI_BUILD_RULES §4a.
- Accessibility: keyboard use for every action, visible focus, correct roles and labels, dialogs and drawers that trap and restore focus, announced status changes, contrast, 44px touch targets on phones, reduced motion, and a check of the accessibility tree.
- Phone screens at 390 and desktop at 1440 in a real browser (chrome-devtools MCP directly); spot-check 768 and 1024; zero console errors; no fake status bar on phones; test a real error response for every write, not only the happy path.

## Back-end quality bar
Zod on every endpoint; the access table row for every route (never a new `requireRole` list); `siteId` in every query; ledger door for every stock movement; audit events for every write; migrations committed; tests including the opt-in database tests (`*.db.test.ts` pattern); contract test against the fixtures; no direct ledger writes.

## The summary every session brings back
1. What was built, by endpoint or screen number, against the contract. 2. Anything missing or extra (and why). 3. Contract drift or questions. 4. Files created, moved, deleted (folders only). 5. Tests run and results (exact counts). 6. For front end: per-screen Paper check results at 390 and 1440, accessibility checks done, anything not verified. 7. How the owner verifies in the browser with which role. 8. Anything the next session must know.
