# Workforce · Public verify page

Status: built and walked in a private browser window and signed in (21 Oct 2026, branch `feat/workforce-6b-shared-frontend`, not pushed). Spec: `6c-documents-and-verify-spec.md` D3. Back end: `backend/src/modules/workforce/verify/` and `documents/`.

## Screen
`/verify/<kind>/<number>?h=<10 characters>`, **no sign-in** (outside the `middleware.ts` matcher; a test pins it). Seven outcomes: genuine ("This copy matches the record"), replaced, voided, unknown, malformed, hash mismatch, rate limited. **Role and date only: never a name, a figure or a head count** (owner decision, 20 Oct 2026; differs from Paper Chapter 17 on purpose). A wrong hash and an unknown number read the same to a stranger.

A signed-in person gets the richer answer (the signer's name, "Open the document") and, on a hash that does not match, **Tell the {role}** (Branch Manager, Accountant, HR or System Admin by document type), which sends one report.

## Endpoints
Public `GET /api/v1/verify/:kind/:number?h=` (30 a minute, never cached); signed-in `GET /workforce/documents/verify/:kind/:number?h=` and `POST .../report { h, idempotencyKey }`.

## Things to know
- The public answer is drawn at once; the page then tries to restore a session and replaces it with the signed-in one (decisions F9).
- Proven in the walk: genuine, replaced and mismatch publicly; genuine upgrade and the report signed in. Voided, rate limited and malformed rely on the unit tests.
