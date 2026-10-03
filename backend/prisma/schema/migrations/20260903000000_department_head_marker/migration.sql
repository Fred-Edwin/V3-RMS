-- "Department head" becomes a marker on the base role, not a replacement role.
-- See docs/context/DEPARTMENT_HEAD_MODEL_REFACTOR.md.

-- AlterTable
ALTER TABLE "users" ADD COLUMN "is_department_head" BOOLEAN NOT NULL DEFAULT false;

-- Data migration: restore every existing DEPARTMENT_HEAD to their real (base)
-- role and set the marker instead. department_tag is kept — it now means
-- "which department this person heads". previous_role stops being written
-- (the column itself is left in place; dropping it is a separate cleanup).
UPDATE "users"
SET "role" = "previous_role",
    "is_department_head" = true,
    "previous_role" = NULL
WHERE "role" = 'DEPARTMENT_HEAD'
  AND "previous_role" IS NOT NULL;

-- Defensive: a DEPARTMENT_HEAD row with no previous_role (should not exist in
-- local or production data) falls back to WAITER so nothing is left stranded
-- on the now-dormant enum value.
UPDATE "users"
SET "role" = 'WAITER',
    "is_department_head" = true,
    "previous_role" = NULL
WHERE "role" = 'DEPARTMENT_HEAD';

-- Note: the 'DEPARTMENT_HEAD' value stays in the "UserRole" enum. PostgreSQL
-- cannot remove an enum value; it is harmless and dormant — nothing assigns it
-- after this migration.
