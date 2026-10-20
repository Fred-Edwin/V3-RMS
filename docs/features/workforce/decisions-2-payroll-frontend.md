# Workforce Segment 2 (Payroll front end): decisions

Written 20 Oct 2026 on branch `feat/workforce-2-payroll-frontend` (cut from `feat/workforce-segment-3`, not pushed). Each row is a question the spec or the brief left open (or a place the build adds to Paper), what was built, why, and what changing it takes. Code: `frontend/features/workforce/payroll/`. Specs: `specs/2-payroll-spec.md`, `specs/2-payroll-engine-and-rollout.md`. Back-end decisions: [2a](decisions-2a-payroll-backend.md), [2b](decisions-2b-payroll-backend.md).

| # | Question | Choice | Why | What changing it takes |
|---|---|---|---|---|
| F1 | The browser could not read `X-Bank-File-Hash`, `X-Document-Number` or `X-Revision` (the app and the API are on different origins). Mark as paid needs the hash. | Back-end fix `fix(workforce-payroll)`: both download controllers send `Access-Control-Expose-Headers`; test `bank/bank-headers.test.ts`. | Without it the hash is invisible to the page and Mark as paid can never be sent. | Nothing; remove the header and the page loses the hash. |
| F2 | `capabilities.ts` and the Home cards still named `payrun.*`. | The union now lists the ten `payroll.*` rights. The Home cards that used `payrun.approve` use `payroll.approve`; the ones that used `payrun.reopen` (a Director marker) use `payroll.approve_site_late`, which only the Director holds. | One access table; `payrun.reopen` no longer exists. | Edit the five `anyCapability` lines in `home/cards/payrun-cards.tsx` and `hr-cards.tsx`. |
