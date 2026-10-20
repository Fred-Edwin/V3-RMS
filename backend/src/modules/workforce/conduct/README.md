# Workforce · Conduct (Segment 5, back end)

Warning notices on three fixed levels (verbal note, written warning, final written warning), issued by a manager or HR, signed by the person with their code, appealed once within 7 days, decided by HR (the Director for notices HR issued). Spec: `docs/features/workforce/specs/5-conduct-spec.md`. Choices and departures: `docs/features/workforce/decisions-5-conduct-backend.md`. Status: back end built; the front end is a later session.

## Sub-modules
| Folder | What it holds |
|---|---|
| `_shared/` | Status machine (`nextStatus`), ladder (`suggestLevel`), dates (end date, appeal deadline, record-from), scope (404 vs 403), the notices and people repositories, snapshots, codes, http helpers |
| `letters/` | Letter wording constants (**placeholder, a lawyer must replace**), `buildLetter`, facts selection from the timesheets |
| `notices/` | Issue, sign, not-signed with a witness, witness answer, detail, desk list, my list, draft lookups, employee-file tab, stepper, the nightly sweep |
| `appeals/` | Appeal, decision (keep, reduce, withdraw, replacement notice), preview, named dates |
| `documents/` | The A4 PDF (`WRN-nnnn`, QR, decision page, Withdrawn watermark, DRAFT preview) and `registerConductDocuments` |
| `needs-you/` | The Needs-you source and the badge count |
| `rollout/` | The guard the old HR screen asks, and the read of old records ("Before the new system") |

## Endpoints (`/api/v1/workforce/conduct`, all `authenticate` + `attachWorkforceSubject` + `requireCapability`)
`GET /me` · `GET /badge` · `GET /` · `GET /people` · `GET /draft` · `POST /draft/preview` · `POST /` · `GET /:id` · `GET /:id/document?version=&inline=` · `POST /:id/sign|appeal|not-signed|witness|decision` · `POST /:id/decision/preview` · `GET /:id/witness-options` · `GET /:id/witness` · and `GET /workforce/people/:id/conduct` (the employee-file tab).

## Rules that must not drift
- Access is the one table (`_shared/workforce-access.ts`): `discipline.read_own|read|issue|decide`. No `requireRole`.
- Every change is audited in the same transaction (`runAudited`); the audit entry is the last write. Never the PIN, the own line or a code in an entry.
- A status change is a compare-and-set (`conductNoticesRepository.transition`); the loser gets 409. Nothing is deleted: the repository has no delete, and a test says so.
- A push or lock-screen text never carries the reason, facts or own line.
- Time maths goes through the Nairobi helpers. The old `disciplinary_records` table is never altered.
- A site is on Conduct the day its Attendance switch is on; before that the old HR screen runs.

## Tests
Unit: ladder, status, dates, letters, issue rules, decision rules, named dates, steps, my list, registration. Database flow (lane database only): `conduct-flow-db.test.ts`.
