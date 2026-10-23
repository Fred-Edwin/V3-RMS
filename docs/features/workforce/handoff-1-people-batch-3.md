# Handoff: People batch 3, part 1 to part 2

**(a) Where.** Worktree `/home/fred/Projects/V3-RMS-lanes/lane-2`, branch `fix/workforce-1-people-batch-3` (from `origin/feat/workforce-stack-complete`; `origin/walk/workforce-1-people` was already inside it). Commits: `d374a7ee` group 1, `e8580ae0` group 2, `b8013c20` group 3 (plus the docs commit after). Ports: front end 3102, API 4102, `http://lane2.localhost:3102`, DB `wendo_rms_lane2`, Redis 6402 (a container `wendo-redis-lane2` I started). Demo seed loaded; logins `<name>@demo.wendo.test`, `WendoDemo#2026`, PIN `4321`. The seed needs the API up: `API=http://localhost:4102 pnpm demo:seed --reset`.

**(b) Built.** Sidebar spine, bottom menu, open/closed memory; audit box removed; My team (card, menu, report link, reports due); System Admin (no People items, no My file, no Payroll, two links); not-found screen; Home leaves out unreachable cards; pay-change and probation filters; one rule each for no head, active, kinds, dates, ages; names in notices; hire correction note; report readers; Today board link; phone wording; bottom bar; clock answer kept per tab.

**(c) Not done.**
- [ ] Gates once: `pnpm build` both sides, back-end suite (re-run the known failing DB files at the end only), `pnpm check:imports`, ESLint, front-end tests
- [ ] Browser walk of only what changed, as the roles concerned (one chrome-devtools page, one screenshot per changed screen, console clean); set PINs with a helper; leave the attendance switch off
- [ ] Browser checks the checklist marks "no": spine (W row 2), W3 duplicate phone, W15, W37 menu on reload, W44 photo
- [ ] Docs: API_CONTRACT (`/viewers` removed, team `canReport`, `correctUntil`, filters, summary pay counts, `reportsToNobody`), module READMEs (audit, people, home), `DATA_MODEL` untouched (no migration), Workforce README row, `PROJECT_STATUS`
- [ ] Tick `verified` in `checklist-1-people-batch-3.md`

**(d) Commands.** `cd backend && pnpm build && export DATABASE_URL=$(grep '^DATABASE_URL=' .env | cut -d= -f2-) && pnpm exec vitest run` (background, log); `cd frontend && pnpm exec tsc --noEmit && pnpm lint && pnpm test && pnpm build`; `pnpm check:imports`. Fresh servers: API `pnpm dev` in `backend` (port 4102), `pnpm exec next dev -p 3102` in `frontend`; call `GET /api/v1/workforce/people/team` (new field `canReport`) to prove the API is fresh.

**(e) Read first.** `docs/features/workforce/checklist-1-people-batch-3.md`; `docs/features/workforce/final-pass/1-people-walk-feedback.md`; `frontend/components/app/shell/menu/sidebar-menu.tsx`; `backend/src/modules/workforce/home/home-kpis.ts`; `backend/src/modules/workforce/needs-you/sources/attention-repository.ts`.

**(f) Gotchas.** Lane Redis was missing (container started above). `home-db.test.ts` fails here because it looks for `director@wendo.test` style logins that the demo seed replaced (not from this work). zsh: no `grep --include`. Never overwrite a PIN backup; attendance switch stays off. Legacy `app/app/admin/page.tsx` is far over 350 lines already (I added a small `?view=` filter).

**(g) Rule slips.** A few empty no-op shell calls (touched nothing); two zsh `--include` greps that errored. No file was edited with shell tools. Files I touched that were already over 350 lines before: `employees-service.ts`, `employees-repository.ts`, `pay-service.ts`, `route-access.ts`, `app/app/admin/page.tsx`.

**(h) Departures.** Acting head counts as "has a head" (Organisation already did). "Reports due" = people on open probation with no head report yet (not by end date). `/app/admin?view=users|branches`: the highlight follows the page path only, so Users lights for both. The System Admin is also refused the My team page. W12 left on purpose.
