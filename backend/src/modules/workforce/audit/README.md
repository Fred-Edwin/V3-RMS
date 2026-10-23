# Workforce audit read side (Segment 6b)

Door: `audit/index.ts`. Reads only; the writer, wording and hash stay in `_shared/audit/`. Spec: `docs/features/workforce/specs/6a-audit-and-security-spec.md` A1 to A9. Decisions: `decisions-6b-backend.md`.

## Endpoints (`/workforce/audit`)
`GET entries` (list, filters area, event, siteId, actorId, subjectUserId, from, to, flagged, q, sort, page, pageSize), `GET entries/:id`, `GET facets`, `GET actors?q=`, `GET export` (CSV, 50,000 cap), `POST chain/check {fromSeq,toSeq}` (`audit.verify_chain`, 1 a minute), `GET me`, `GET me/:id`, `POST me/:id/answer` (`audit.read_own`).
What a reader sees is `auditReadScopeOf` per category; no category = 404; out-of-scope filters give an empty list.

## Files
`audit-visibility` (events, scope), `audit-read-repository` (all SQL), `list-service`, `export-service`, `csv`, `chain-service`, `log-views`, `index-backfill`, `my-record/`. Nightly job: `src/jobs/workforce-audit-job.ts`.

Status: back end built and tested; no screens.
