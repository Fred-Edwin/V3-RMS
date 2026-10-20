# Signed documents index and verify (Segment 6b)

Spec: `specs/6c-documents-and-verify-spec.md` D1 to D4. Decisions: `decisions-6b-backend.md`.

## The door (for Leave and Conduct)
From `modules/workforce` index, inside your own signing transaction, after the document is signed and numbered (never a draft):
```ts
registerDocument(tx, { companyId, siteId, kind: 'LVE' | 'WRN' | ..., number: 'LVE-0030', version?: 1, title?, about: 'Mon 19 Oct', subjectUserId?, signedBy: {id,name,role}, reviewedBy?, signedAt, hash: <sha256 hex, 64>, openHref })
withdrawDocument(tx, { companyId, number, byRole, at, replacedByNumber? })
```
Version 2 of the same number marks version 1 REPLACED. The QR must carry the first 10 characters of `hash` (`hashPrefixOf`). No figure in `title` or `about`.

## Endpoints
`GET /workforce/documents` (q, type, siteId, from, to, sort, page, pageSize), `GET /workforce/documents/:number?v=`, `POST /workforce/documents/:number/open` (writes `document.opened`).
Verify: PUBLIC `GET /api/v1/verify/:kind/:number?h=` (role and date only, never cached), signed in `GET /workforce/documents/verify/:kind/:number?h=`, `POST .../report {h, idempotencyKey}`.

Built issuers are indexed by sources (`sources/`, `payslips/documents/issued-documents.ts`) through `reconcileDocuments` (nightly, before an index read, on a verify miss).
Status: back end built and tested; no screens.
