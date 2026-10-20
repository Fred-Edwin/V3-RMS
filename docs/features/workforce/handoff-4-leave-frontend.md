# Handoff: 4-leave-frontend (part 1 done, part 2 to do)

**(a)** Worktree `/home/fred/Projects/V3-RMS-lanes/lane-1`, branch `feat/workforce-4-leave-frontend` (from `origin/feat/workforce-backends-4-6`), last commit `7fc06dac`. Ports: front end 3101, API 4101, `http://lane1.localhost:3101`, database `wendo_rms_lane1`.

**(b) Built** (all in `frontend/features/workforce/leave/`, see its README)
- `_shared`: types, services (one per endpoint), dates, copy, idempotency key, LeaveCard, slip buttons.
- `mine/`: Leave home, Request form with unpaid-tail block, History, followed request and endings, cancel, desktop own-leave and Ask drawer.
- `slip/`: Document view. `requests/`: Leave page shell, Requests tab, rota strip, Approve, Decline, Cancel-approved dialogs.
- `balances/`: Balances tab, sites panel, drawer, Adjust a balance. `calendar/`: three-week grid.
- Routes under `app/app/workforce/my-leave/**` and `leave/**`; kit `CircleStepper`, chip tone `asked`; nav rows, route gate, notification copy, Home "Coming up".
- Tests: 4 files (follow steps, rota view, adjust input, calendar layout); `nav-table.test.ts` updated.

**(c) Not yet done**
- [ ] Browser walk of every screen (phone 390, desktop 1440) against Paper, one pair per screen
- [ ] Keyboard run of each main task; hover, focus, disabled on new controls
- [ ] Walk with the switch on for Nyeri Town, set Annual days via Adjust (seeded days are 0), then switch off again
- [ ] Safety proof: switch off, main roles see nothing new
- [ ] One flow end to end with audit entries confirmed
- [ ] Gates: `tsc`, `pnpm lint`, `pnpm test`, `pnpm build`
- [ ] Docs: parity manifest line per screen, `PROJECT_STATUS.md`, Workforce README row, `docs/API_CONTRACT.md` untouched

**(d) Part 2 commands** (background, with a log): stop ports 3101 and 4101 by process id; `cd backend && pnpm exec prisma generate`, start API on 4101; `cd frontend && pnpm exec next dev -p 3101`; confirm `/app/workforce/my-leave` answers (not 404). Logins `password123`: `bm.town@`, `hr@wendo.test`, `director@`, `accountant@`, `store.manager@`, `admin@`.

**(e) Read first:** `docs/features/workforce/decisions-4-leave-frontend.md`; `frontend/features/workforce/leave/README.md`; `docs/features/workforce/specs/4-leave-spec-screens.md`; `docs/sessions/workforce-frontend-common.md` section 3 to 5; `frontend/features/workforce/leave/mine/request/components/request-form.tsx`.

**(f) Gotchas:** `pnpm exec` first ran an install (`pdfjs-dist`) in this worktree; lockfile unchanged. zsh: no `grep --include`. Never `pkill -f`. Lane DB tests need `DATABASE_URL` from `backend/.env`. Date pickers use `sheet` mode. Paper node ids are in the spec section 0.

**(g) Rule slip:** one Bash call ran a no-op `python3` heredoc that only printed a line and edited nothing; all edits used Edit and Write.

**(h) Departures from the spec:** decisions file rows 8 to 17 (History list, no reason in rows, no "from" date on builds, role-only approver, Balances KPIs and no department filter, signed days via chips, calendar arrow-key map not built).
