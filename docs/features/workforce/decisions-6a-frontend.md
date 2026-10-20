# Workforce 6a (Shared parts, front end A): decisions

Branch `feat/workforce-6a-shared-frontend`, 20 Oct 2026. Front end only. Each row: the question, what was chosen, why, and what changing it takes. Part 1 wrote rows 1 to 22; part 2 adds anything the browser walk finds.

| # | Question | Choice | Why | What changing it takes |
|---|---|---|---|---|
| 1 | Where does Needs you sit on Home? | First in the main slot (`order 5`), drawn with the page-title look (28/34 and the grey sub-line) | Spec N2: the card is the Home's headline | `order` in `home/cards/needs-you-cards.tsx` |
| 2 | Phone Home for the desktop roles | A second card, `workforce.needs-you.phone`, draws the same rows as a stack of cards with a 44 px Open link | Paper draws no phone card (owner note, 17 Oct) | Delete the card; the desktop one stays |
| 3 | The old cards | `waiting-for-you.desktop`, `waiting-for-you.phone`, `payrun-steps`, `overdue-approvals` are no longer registered; their data hooks are deleted. The presentational blocks stay for the gallery | SD17 | none |
| 4 | HR's "Needs your attention" | Lost its Report-a-problem rows (they are Needs you rows); still shows finish hiring, probation ends, no head | SD17 | `people-data.ts` |
| 5 | Row links the server guessed | `/app/workforce/casual?sheet=` becomes `/app/workforce/casuals/approve`; `/rules/statutory` becomes `/rules?tab=statutory`; `/payslips/p9` becomes `/my-payslips/p9/<year>` (year read from the row text); `/app/workforce/security` is built here. Leave and Conduct links are used as sent | Verified against `app/app/workforce/**/page.tsx` | `opensFor` in `needs-you-words.ts` |
| 6 | Overdue "Send a reminder" panel | The kit's `WorkforceDrawer` (480 wide) instead of Paper's 430 panel; a Leave row shows Review | One focus-trapping, Escape-closing panel already exists | Swap the drawer |
| 7 | Menu badges | Asked only for the six roles that hold `needs_you.read` (the server answers 404 to the rest). One badge key per link per role: HR's Requests carries Timesheets, the managers' Timesheets, the Director's Head office timesheets. `wf-requests` was split into `wf-requests-hr` and `wf-requests` for this | Nobody sees the same number twice | `nav-table.ts` |
| 8 | The count chip | Reads `99+` above 99 and has hidden text " waiting" for a screen reader, for every sidebar chip (Inventory too) | Spec N3; one component | `CountChip` in `sidebar-nav.tsx` |
| 9 | System Admin | Gets a Home (`wf-home` roles + `/app/workforce` in the route gate) whose one card is Needs you, and a **Security alerts** row in Settings. Route gate: Security alerts for the System Admin only | Spec N2, S1 | `nav-table.ts`, `route-access.ts` |
| 10 | Notifications tab | First of four tabs; the page still opens on Messages; the tab shows the unread count in the tab bar's chip. The shell's Inbox badge adds the unread number from one shared store | Legacy Inbox behaviour untouched | Default tab in `InboxShell.tsx` |
| 11 | A notification row with no link | Shows an outlined **Mark as read**; a row with a link shows **Open** (marks read, then goes) | Nothing stays unread for want of somewhere to go | `notifications-tab.tsx` |
| 12 | `/app/workforce/my-record` (Activity on my record, front end B) | A notification that points there opens My phones until B exists | The two security pushes link to it | `NOT_BUILT_YET` in `notification-words.ts` |
| 13 | The phone question | `SecurityGate` wraps the signed-in app: it draws the app at once, runs the state check and the "seen" call, and replaces the app with the reset page or "Is this your phone?" only when needed. A failed check lets the person through | Never lock anyone out; the server still refuses what it must | `use-security-gate.ts` |
| 14 | Every call sends `x-device-id` | `apiClient` adds it to any path starting `/workforce`; the id lives in `lib/device-id.ts` (the payslips file re-exports it, same storage key) | Spec: every Workforce call | `apiClient.ts` |
| 15 | `SESSION_ENDED` | `apiClient` raises a browser event; the gate signs out and sends the person to `/login?reason=ended` ("Please sign in again.", the page reopens after sign-in). `PHONE_REMOVED` / `PASSWORD_RESET_REQUIRED` re-run the checks | Never for inactivity | `use-security-gate.ts` |
| 16 | "This wasn't me" then the new password | After the server ends every session the old token is refused, and the reset call needs a token issued after. So the page asks for the **current password once** (beyond Paper), signs in, sets the new one, signs in again and reloads Home (the phone is asked again) | Back end: reset returns no tokens (6a back end #10) | If the back end ever mints a reset token, drop the field |
| 17 | The facts card on "Payslip opened" | Not drawn (phone, place, time of the opening): they come from Activity on my record (front end B). The page shows the question card and a generic line | No entry endpoint yet | Add the card with B |
| 18 | Security alerts filters | Status chips with counts, a Kind filter and the numbered pager. Site, date range and search are not built | The list endpoint has them; the first walk is one company with few alerts | Add them to `use-alerts.ts` |
| 19 | Two buttons of the alert panel | **Open the audit entry** (the audit log is front end B) and **Reset the password now** (no endpoint exists) are left out | A button for nothing is worse than none | Add with B / a back-end action |
| 20 | `PIN_SLOWED` words | Added next to `PIN_LOCKED` in the Rules and Payroll refusal tables (the back end no longer sends `PIN_LOCKED`) | SD16: a pause, never a lock | Delete the `PIN_LOCKED` lines when convenient |
| 21 | The message table | `_shared/lib/messages.ts` (`messageFor`, `lineForError`, `failureKind`) and `_shared/components/message-cards.tsx` (three cards). The test checks every code is still declared by the back end. No screen is rewired to use them in this session | Spec M1, M2; later slices call them | n/a |
| 22 | States-kit rows | Changed only the rows M3 lists; added My payslips, Security alerts and Phones. Signed documents and Activity on my record arrive with B | M3 | `states-copy.ts` and its test |

## Departures from the spec
- Rows 17 and 19 (panel buttons and facts card), row 18 (filters), row 6 (drawer width).
- Row 16 adds a field Paper does not draw.
