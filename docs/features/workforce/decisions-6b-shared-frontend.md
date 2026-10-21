# Workforce segment 6, front end B: decisions (21 Oct 2026)

Built in part 1. Specs: `specs/6a-...` (A1 to A9), `specs/6c-...` (D1 to D3). Back end: `decisions-6b-backend.md`.

| # | Question | Choice | Why | What changing it takes |
|---|---|---|---|---|
| F1 | Where do Signed documents live? | A tab of the Audit log page (`?tab=documents`); no separate menu row. Tabs show only to a person whose access table allows them; one tab alone is drawn without tabs. | Spec 6c D2. | `log-tabs.tsx`. |
| F2 | Who sees the Audit log row and the Activity on my record rows? | Behind the new-clock switch (`needsAttendance`), like the other new rows; routes are open to the desktop roles (audit) and everyone (my record). The API still decides what is in them. | The brief: a site with the switch off sees nothing new. | Drop `needsAttendance` on `wf-audit-log`, `wf-my-record`, `wf-staff-my-record`. |
| F3 | System Admin and the Audit log | Row and route added for the System Admin (spec A7: security and rules categories). | Spec A7. | `nav-table.ts`, `route-access.ts`. |
| F4 | Chips on Activity on my record | Toggle chips (kit `FilterChip`, `aria-pressed`) instead of radios with arrow keys. | The kit chip is Paper's look; a roving radio chip does not exist in the kit. | A radio variant of `FilterChip`. |
| F5 | "This wasn't me" on Activity on my record | Confirm dialog, then the record answer `NOT_ME` (the server runs the Security flow and stores the answer), then the Security flow's own `ResetPasswordScreen` (now exported from `security/index.ts`). | One flow, and the answer is stored on the record. The Security route `wasnt-me?entry=` does not store the answer. | None. |
| F6 | Open document | Records the opening (`POST .../open`), then fetches the file from `openHref` by the method its type wants (POST with a body for payroll, timesheet and P9; GET otherwise) and draws it in a drawer with the kit `PdfViewer`. Payroll opens as the SUMMARY PDF, a timesheet as the month PDF. | Spec D2 and the back-end note that `openHref` is a POST route for some types. | `openRequest` in `documents-services.ts`. |
| F7 | Site filter of the documents index | Back-end fix (`fix(workforce)`): the list answer gains `sites` (every company site to a reader who reads some type across the company; none to a one-site reader). | The index API had no list of sites. | Remove `sites`. |
| F8 | Public verify page and the middleware | `/verify/*` is outside `middleware.ts` `matcher` (`/login`, `/app/*`), so it needs no sign-in and no change to `PUBLIC_PATHS`. Adding it there would bounce signed-in people to Home. A test pins this. | Correct and smallest. | None. |
| F9 | Signed-in detection on the verify page | The public answer is drawn at once; the page also tries to restore a session (refresh cookie). If one exists it replaces the answer with the signed-in one. | Never blocks a stranger on a sign-in. | `use-verify.ts`. |
| F10 | "Tell the {role}" | Shown only to a signed-in person on NOT_VERIFIED with a valid 10-character hash; the role comes from the type (Accountant for pay, payslip, P9; Branch Manager for casual, timesheet, leave; HR for conduct and contracts; System Admin otherwise). | Spec D3. | `issuerRoleOf`. |
| F11 | New entries pill ("3 new entries") | Not built. | No push for the audit log; the page reads again on any filter change. | A poll on page 1 and a pill. |
| F12 | Keyboard: arrow keys across rows | Not built; each row's title is a button (tab stop per row), `/` focuses the search. | Time; spec asks for a grid. | A roving grid in `audit-table.tsx`. |
| F13 | Timesheet document open | Sends no `site`. A Director reading a branch's timesheet report may need it. Unproven (the lane has no issued documents). | Cannot test. | Add the document's site id to the panel and pass `site`. |
| F14 | Payslip-opens digest | Home side card, last 7 days, newest first; the whole row links to the log on that opener and day (`event=payslips&actor=&from=&to=`). | Spec A9. | `audit-cards.tsx`. |

| F15 | Site fields in answers (found in the browser walk, 21 Oct 2026) | The types use the API's wire names: `facets.organizations`, `organizationId`, `organizationName`, and the documents list's `organizations`. | The page read `sites` and crashed ("Cannot read properties of undefined"). `wire-names.ts` turns every `site*` field into `organization*` on the way out. | None. (F7's back-end `sites` field reaches the wire as `organizations`.) |

## Parity (one line per screen, walked in Chrome 21 Oct 2026 as the Director; **not compared to a Paper frame: the Paper MCP server timed out on three calls in a row, so no Paper screenshot was taken**)
- Audit log: loads, 3 real entries, Area/Event/Site/dates/sort present; the filter row wraps to a second line at 1440 wide (Area, Event, Site sit under the search): compare with Paper 14.1 `1O17-0` when Paper answers.
- Entry drawer: Before/After and Proof read right; Check the chain ran once: "Chain intact from entry 1 to 2".
- Signed documents: three rows, the replaced version marked, panel with Open document and Copy link; Site filter lists the three sites.
- Activity on my record: chips, cards, one entry, "That was me" stored ("Thank you. Noted."). The headline reads "N entries / done to your file this month" over two lines: check against Paper 14.2 `1OBD-0`. The entry's When row shows `2026-10-21 06:35` (back-end wording).
- Payslip openings card: not drawn on an empty week (by design); not seen with data.
- Public verify: genuine, replaced and mismatch in a private window with no sign-in; unknown reads like mismatch. Signed in: signer named, Open the document; wrong hash shows Tell the Branch Manager and one tap sends "The Branch Manager has been told."
- Second pass (owner: fix by eye, use Paper only where needed): the Audit log's filters and search now sit on one row at 1440 (search 260, dropdowns 130 to 160 wide); the second "Showing ..." line on the three lists is hidden visually (still read aloud) unless the count is over 50,000, where it tells how to narrow it; Activity on my record at 390 wide shows Paper's dark band; the verify page at 390 wide reads well. Keyboard run of the Audit log: `/` to search, a row opens the drawer with focus inside, Escape returns focus to the row. Paper 14.1 matched on filters; Paper 14.2 is the phone frame, so the desktop plain header is the kit's choice.
- Skipped on purpose (owner agreed, 21 Oct 2026): opening a real PDF (needs a payroll run; documents-wiring session), the payslip-opens card with data (no payslips; unit tests cover it), "This wasn't me" (signs the Director out; the Security flow is covered). Earlier note, partly closed above: keyboard-only run of each screen, narrow widths and phone frames (17.1 `1PSD-0`, 17.2 `1Q3D-0`), opening a real PDF, the other roles in a browser (checked by API only: Branch Manager, Accountant, Store Manager and System Admin read the log and index; only the Director reads payslip opens; System Admin has no Activity on my record). With the switch off, the Director's menu showed none of the new rows.

## Shared-file line changes
- `frontend/components/app/shell/nav-table.ts`: `wf-audit-log` (built, System Admin added, needsAttendance, match), new `wf-my-record` and `wf-staff-my-record`.
- `frontend/components/app/shell/nav-table.test.ts`: expectations for the new rows; the notBuilt example row is now `wf-payslips`.
- `frontend/lib/route-access.ts`: `/app/workforce/my-record` (everyone) and `/app/workforce/audit-log` (six roles).
- `frontend/features/workforce/_shared/lib/capabilities.ts`: 12 `audit.read.*` names.
- `frontend/features/workforce/security/index.ts`: exports `ResetPasswordScreen`.
- `frontend/features/workforce/home/cards/index.ts`: registers `payslipOpensCard`.
- Back end: `documents/documents-service.ts`, `document-view.ts` (+ test): `sites` in the index answer.
