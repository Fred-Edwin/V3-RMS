# Workforce · Security (phones, "This wasn't me", Security alerts)

Status: built and walked in a real browser (21 Oct 2026, branch `feat/workforce-6a-shared-frontend`, not pushed). Specs: `6a-audit-and-security-spec.md` (phones, "This wasn't me", alerts only). Back end: `backend/src/modules/workforce/security/`. Decisions: `decisions-6a-frontend.md` (16 to 19) and the three fixes found in the walk (below).

## Screens
| Screen | Where | Who |
|---|---|---|
| **Is this your phone?** (Yes, this is my phone / Use it just once; "once" counts for 12 hours) | `SecurityGate`, wraps the signed-in app in `app/app/layout.tsx` | every login except the two kitchen displays |
| **My phones** (list, confirm, remove with a dialog, five-phone warning) | `/app/workforce/my-phones` | everyone with a login |
| **This wasn't me** and the new password | `/app/workforce/wasnt-me` | the person who opened the link; asks for the current password once if no sign-in is live |
| **Security alerts** (Open / Cleared / All, Kind filter, panel, clear with a one-line note, Start alerts) | `/app/workforce/security` | System Admin only |

The UI never explains how a phone is recognised. A wrong code pauses; nothing here ever locks a person out. If the phone check cannot run (no signal) the person goes through: the server still refuses what it must.

## Public API (`index.ts`)
`SecurityGate`, `MyPhonesScreen`, `WasntMePage`, `AlertsScreen`.

## Endpoints
`GET /workforce/security/phones/me`, `POST .../phones/me/current/seen`, `POST .../current/answer`, `POST .../phones/me/:id/confirm`, `POST .../phones/me/:id/remove`, `GET /workforce/security/state`, `POST .../wasnt-me`, `POST .../reset-password`, `GET .../alerts`, `GET .../alerts/counts`, `POST .../alerts/:id/clear`, `POST .../alerts/start`. Every Workforce call sends `x-device-id` (`lib/device-id.ts`, in `lib/apiClient.ts`).

## How the gate behaves (`hooks/use-security-gate.ts`)
`checking` then `reset` (a new password first), `phone` (the question) or `clear`. One check runs at a time. `SESSION_ENDED` signs out; `PASSWORD_RESET_REQUIRED` asks the state; `PHONE_REMOVED` goes straight to the phone check (the state route refuses a removed phone too, so asking it would loop).

## Found and fixed in the browser walk (21 Oct 2026)
1. First sighting of a phone returned 500 when two calls arrived together (a unique-key error aborted the transaction). Back end now inserts with `ON CONFLICT DO NOTHING`.
2. The reset after "This wasn't me" was refused (`PHONE_REMOVED`) because the press removes this phone too. The back-end gate now leaves the reset open to a person who must reset.
3. The front-end gate looped on `PHONE_REMOVED` (it re-read the state, which was refused, which raised the event again). Fixed in the hook; the question now shows.
4. The alert list printed the stored role code (`HR_MANAGER`); the back end now words it ("HR Manager").

## Tests
`components/security-components.test.ts`, `lib/security-words.test.ts`; back end `security-db.test.ts` (phones, wasn't me, the gate, the first-sighting race).
