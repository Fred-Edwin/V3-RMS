# Checklist: 4-leave-frontend

| # | Screen | Built | Verified | Note |
|---|---|---|---|---|
| 1 | Staff Leave home and Request | yes | yes | `mine/home`, `mine/request`; phone 390 walked as Victor Maina (Nyeri Town): home, waiting banner, request with preview, send, followed request; keyboard run (arrows, Enter, Tab) done |
| 2 | History and a followed request | yes | yes | `mine/history`, `mine/follow`; tabs, counts, pager; header figures fixed (were dark on dark) |
| 3 | Endings (approved, declined) and the slip Document view | yes | yes | follow-up covers endings; `slip/`; both endings and the slip on a phone and on a desktop; cancelled (VOID) slip not walked |
| 4 | Branch Manager Leave page with the rota | yes | yes | `requests/`; list columns follow Paper (found wrapping dates); 7-day strip scrolls sideways by design |
| 5 | Approve and decline dialogs | yes | yes | plus cancel-approved dialog (opened and closed with Escape; the send itself not run); approve run with the keyboard only; wrong-PIN message fixed and re-checked |
| 6 | Own leave on a desktop | yes | yes | `mine/desktop`; Branch Manager at 1440 |
| 7 | HR Balances and adjust a balance | yes | yes | `balances/`; found the page crash and the missing kinds (both fixed); 21 days granted, drawer and KPIs agree |
| 8 | Calendar | yes | yes | `calendar/`; empty state and a real leave bar; arrow-key map not built (decision 17) |
| 9 | Navigation rows, Home wiring and permissions | yes | yes | nav-table, route-access, Coming up, notification copy; switch off: Branch Manager, Director, Accountant, Store Manager and HR see only the old rows; Accountant refused at the new URL; a signed-in staff member can still open the URL with the switch off (decision 29) |
| 10 | Services, hooks and tests | yes | yes | front end: `tsc`, `pnpm lint`, `pnpm test` (153 files, 1419 tests), `pnpm check:imports` (0 errors), `pnpm build`; back end: `pnpm build`, ESLint on the Leave module, Leave module tests (5 files, 138 tests); the full back-end suite still has the old database-flow failures (see the report) |
