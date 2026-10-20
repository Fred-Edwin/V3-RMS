# Workforce 6a (Shared parts, back end A): decisions

Branch `feat/workforce-6a-shared-backend`, 20 Oct 2026. Back end only. Each row: the question, what was chosen, why, and what changing it takes.

| # | Question | Choice | Why | What changing it takes |
|---|---|---|---|---|
| 1 | Where does the audit entry index live? | A side table `workforce_audit_entry_index`, filled by the audit writer in the same transaction | The audit table is append-only; the index carries title, area, flag and search text for back end B | Change the writer's `insertIndex` call; back end B reads missing rows as unindexed |
| 2 | Payslip code pause vs signing PIN | The pause schedule (2, 4, 8, 16, 30 s, never a lock) is one shared door (`_shared/pin`). The payslip code keeps its own `payslip_code_tries` table (it records device, confirmed, alerted); the signing PIN and later Conduct use `workforce_pin_tries` | Payslip tries already had a table with extra columns | Move the payslip tries onto the shared table and drop the old one in a later migration |
| 3 | PIN store | Pluggable: memory in tests, the database registered at start-up | Unit tests stay fast; production survives restarts | Change `registerPinTries` |
| 4 | Revoking sessions without touching the `User` table | A flags table plus a Workforce session gate: a token issued before "This wasn't me" is refused (`SESSION_ENDED`), a required reset blocks everything but `reset-password`, `state` and `permissions/me` (`PASSWORD_RESET_REQUIRED`), a removed phone is refused (`PHONE_REMOVED`) | The legacy users table and the old sign-in code may not change in this segment | Add one check in the legacy `authenticate` to cover non-Workforce routes too |
| 5 | Gate scope | It covers `/workforce` only; old routes keep working until `authenticate` gets the one check | Same as 4 | Same as 4 |
| 6 | Removing a phone | Per phone (flag on the device), not a wipe of refresh tokens | Removing one phone must not sign the person out of the others | n/a |
| 7 | "Use it just once" | Counts as confirmed for 12 hours (no server session exists) | There is nothing to end it with | Change `ONCE_CONFIRMATION_MS` |
| 8 | Place label | From Cloudflare `cf-ipcity` and `cf-ipcountry` headers; null when absent; no address stored | No IP is kept | n/a |
| 9 | Phone sign-in step | A separate call `POST security/phones/me/current/seen` | Sign-in is the legacy auth and cannot return a phone question | Fold into the auth response when auth is rebuilt |
| 10 | Reset password | Does not mint tokens; the front end signs in again with the new password | Auth is legacy | Same as 9 |
| 11 | Which alert kinds are gated by "Start alerts" | Only the unconfirmed-phone alert (and the person's push); "This wasn't me", 3 wrong codes and the chain check always page | Spec SD13 | Change `tellAdminsOfAlert` |
| 12 | Alert and audit entry | One transaction: `runAudited` gained an `afterWrite(tx, records)` hook so the alert row carries the entry's id; one alert per person, kind and 15 minutes (`claimAlertWindow`) | An alert without its entry, or two alerts for one burst, must be impossible | n/a |
| 13 | "This wasn't me" twice | Idempotent by state: while the flag is up the second press writes nothing and answers `alreadyDone` | Double taps | n/a |
| 14 | Inbox data source | The new own-only endpoints are the data source; no legacy back-end edit | Smaller legacy change than the spec allowed | n/a |
| 15 | Unknown notification kinds | Render as a plain non-pushed row | A missing wording must never lose a notice | Add the kind to the wording table |
| 16 | Delivery from the worker | The worker process cannot reach browser sockets; screens refetch on focus and every 60 s | No cross-process socket bus exists | Add a Redis socket adapter |
| 17 | `PIN_LOCKED` | Removed. `PIN_SLOWED` (429) added; wrong code stays `PIN_INVALID` (403) with `waitSeconds` | Never lock (SD16) | n/a |
| 18 | Needs-you counts | A source without its own `count` is tallied from its `list`, so a badge cannot disagree with the card | Spec N3 demands equality | A source may add a cheaper `count` |
| 19 | Needs-you registry | `registerNeedsYouSource(source)`; an id registered twice replaces the first; the module never imports Leave or Conduct | Spec N5 | n/a |
| 20 | No capability on Needs you | The routes answer 404, not 403 | Spec X: existence is not revealed | n/a |
| 21 | One failing source | Its rows are dropped and `partial: true` is returned; never a wrong count | Spec N1 | n/a |
| 22 | "Shift closed by the system" row | Timesheet days with reason `AUTO_CLOSED` that still need a look, in an unapproved month | There is no separate "to check" table; the row vanishes when the day is decided | A dedicated flag if the wording needs a "checked" step |
| 23 | Clock fix row text | `{Name}, {Role} · {what}, {Day}` by request kind, not the exact clock-out sentence | The request stores no uniform recorded and requested times | Extend the text once the request shape is fixed |
| 24 | Overdue | Each source may return `overdue(ctx)` company-wide; built sources return rows older than 3 days (sites not approved by the 4th, SD37, included). Payroll rows are not part of Overdue | Spec N4 names requests, months and casual sheets | Add `overdue` to a source |
| 25 | Reminder idempotency | One per item per Nairobi day (database unique key); a repeat is `403 REMINDER_ALREADY_SENT`. The `idempotencyKey` is logged, not used to replay | Spec says 403 | Add a key column |
| 26 | Reminder recipients | The source's `remindees`, else the site's managers (HR Manager when the item waits on HR) | Default is enough for built sources | n/a |
| 27 | "Needs your attention" | A separate endpoint `GET needs-you/attention` (finish hiring, probation ends in 14 days, department with no head) | The Home card `workforce.hr-attention` keeps these rows | n/a |
| 28 | Leave and Conduct events | Declared in `events.ts` in a marked block: `leave.requested|decided|moved_up`, `conduct.appeal_sent|decided`; already in the nudge list | Those segments must emit them | n/a |
| 29 | SD4 grants | HR reads rules operating and pay; the Accountant reads pay-run prepare | Spec SD4 | `workforce-access.ts` |
| 30 | GIN trigram index on `search_text` | Left to back end B (needs `pg_trgm`) | It is B's search | One migration |
| 31 | Backfill of old audit entries into the index | Not done; B reads missing rows as unindexed | Not needed to ship A | A script that calls `describeEntry` |
| 32 | Notifications folder size | Wording files moved to `notifications/wording/` to stay at 12 files | House rule | n/a |

## Departures from the spec
- Rows 23 and 24 (clock fix wording, payroll not in Overdue).
- The "Start alerts" gate holds only the unconfirmed-phone alert (row 11, as the spec says); recorded here because it is easy to misread.
- The Needs-you state API has no `lastSeen` per kind; `isNew` is one timestamp per person.
