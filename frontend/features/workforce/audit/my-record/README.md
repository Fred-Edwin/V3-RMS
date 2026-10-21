# Workforce · Activity on my record

Status: built and walked in a real browser (21 Oct 2026, branch `feat/workforce-6b-shared-frontend`, not pushed). Spec: `6a-audit-and-security-spec.md` A4 (Paper 14.2). Back end: `backend/src/modules/workforce/audit/my-record/`.

## Screen
`/app/workforce/my-record` (everyone with a login; behind the new-clock switch in the menu). Chips (All, Pay, Time, Leave, File, Conduct, Sign-ins), a date range this month by default, one card per entry (a flagged one has the amber bar), a numbered pager. One entry opens in place with **That was me** and **This wasn't me**.

## Endpoints
`GET /workforce/audit/me`, `GET /me/:id`, `POST /me/:id/answer { answer, idempotencyKey }`.

## Things to know
- "This wasn't me" asks first, stores the answer `NOT_ME`, then shows the Security flow's own `ResetPasswordScreen` (one flow, not rebuilt; exported from `security/index.ts`).
- Chips are toggles, not radios (decisions F4).
- The entry's "When" row comes from the API's wording as `2026-10-21 06:35`, while the list says "Today 06:35". That is back-end wording (`my-record-wording.ts`); not changed here.
