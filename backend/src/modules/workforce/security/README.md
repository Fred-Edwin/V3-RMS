# Workforce security (Segment 6a)

Door: `security/index.ts`. Phones, System Admin alerts, "This wasn't me", the password reset and the Workforce session gate.

## What other modules call
```ts
wasntMe(subject, { idempotencyKey, deviceId?, entryId? }, { deviceLabel?, placeLabel? }): Promise<{ alreadyDone: boolean }>   // back end B's NOT_ME answer
claimAlertWindow(tx, subjectUserId, kind, at): Promise<boolean>        // step 1, inside the entry's transaction
insertAlertForEntry(tx, facts: AlertFacts, auditEntryId): Promise<void> // step 2, from runAudited's afterWrite
tellAdminsOfAlert(facts: AlertFacts): Promise<boolean>                  // step 3, after commit
confirmationOf(userId, deviceId): Promise<boolean>                      // the payslip code reads this
workforceSessionGate                                                    // mounted before every /workforce router
```
Alert kinds: `WASNT_ME`, `UNCONFIRMED_PHONE` (held until "Start alerts"), `WRONG_CODES`, `CHAIN_FAILED`. One alert per person, kind and 15 minutes. No money, code or payslip number in any alert.

## Endpoints (`/workforce/security`)
Phones (`security.phones.own`, own only; another person's id is 404): `GET phones/me`, `POST phones/me/current/seen`, `POST phones/me/current/answer`, `POST phones/me/:id/confirm`, `POST phones/me/:id/remove`.
Alerts (`security.alerts.read`; clear and start need `security.alerts.clear`): `GET alerts`, `GET alerts/counts`, `POST alerts/:id/clear`, `POST alerts/start`.
Session: `POST wasnt-me`, `POST reset-password`, `GET state` (the last two need only a signed-in person).

Error codes: `SESSION_ENDED` 401, `PASSWORD_RESET_REQUIRED` 403, `PHONE_REMOVED` 401, `THIS_PHONE` 409, `PHONE_NOT_FOUND` 404, `ALERT_NOT_FOUND` 404, `ALREADY_CLEARED` 409, `RESET_NOT_REQUIRED` 409.
Start-up: `registerSecurity()` points the payslip code at the phone list and writes the 3rd wrong signing PIN to Activity.
