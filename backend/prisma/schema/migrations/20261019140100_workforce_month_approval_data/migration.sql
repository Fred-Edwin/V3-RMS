-- Workforce Segment 1A, data only: map the old period states onto the new ones without losing a day, item or request.
--   CLOSED (signed or not) -> APPROVED, with the signer (or closer) and time, a document number and a note that it predates
--   the change. CLOSING (a close that was claimed and never finished) -> OPEN. OPEN stays OPEN.
-- Repeatable: after one run no period is CLOSED or CLOSING, so a second run changes nothing.

UPDATE "public"."timesheet_periods"
SET "state" = 'OPEN'
WHERE "state" = 'CLOSING';

WITH numbered AS (
  SELECT "id", nextval('public.timesheet_document_seq') AS "n"
  FROM (
    SELECT "id" FROM "public"."timesheet_periods"
    WHERE "state" = 'CLOSED' AND "document_number" IS NULL
    ORDER BY "start_date", "id"
  ) AS ordered
)
UPDATE "public"."timesheet_periods" AS p
SET "state" = 'APPROVED',
    "approved_at" = COALESCE(p."signed_at", p."closed_at", p."updated_at"),
    "approved_by_id" = COALESCE(p."signed_by_id", p."closed_by_id"),
    "document_number" = numbered."n",
    "approval_note" = 'Closed before month approval existed' ||
      CASE WHEN p."signed_at" IS NOT NULL THEN ' (signed with a PIN)' ELSE ' (not signed)' END ||
      '. Approved by that close; nothing was changed.'
FROM numbered
WHERE p."id" = numbered."id";
