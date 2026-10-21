# Workforce · Signed documents index

Status: built and walked in a real browser (21 Oct 2026, branch `feat/workforce-6b-shared-frontend`, not pushed). Spec: `6c-documents-and-verify-spec.md` D1, D2. Back end: `backend/src/modules/workforce/documents/`.

## Screen
A tab of the Audit log (`?tab=documents`, no own menu row). Search, Type, Site (only for a reader who reads some type across the company), dates, sort, numbered pager (25/50/100 only; anything else is a 400). A row opens a panel (number, signer, approved by, signed with, site, retention note) with **Open document** and **Copy link**. A replaced version says "Version 2 replaces version 1"; the old one is marked REPLACED.

## Endpoints
`GET /workforce/documents`, `GET /workforce/documents/:number?v=`, `POST /workforce/documents/:number/open?v=`.

## Things to know
- **Wire names:** the list answer carries `organizations` (the Site filter) and each row `organizationName`.
- Open: records the opening, then fetches the file by the method its type wants (POST for payroll, timesheet and P9; GET otherwise) into a PDF drawer. **Not proven against a real file**: the lane has no issued documents, and the proof rows used a dummy address. Timesheet open sends no `site` (decisions F13).
- Leave slips and conduct notices may not be indexed yet (the door wiring is a separate session).
