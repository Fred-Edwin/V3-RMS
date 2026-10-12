-- A department added in Block 1 has no legacy key (departments.key is null), so its Branch day rows cannot carry one (contract §5.1: "its legacy key when it has one").
-- The unique (branch_day_id, department_tag) stays: Postgres treats nulls as distinct, and the id-link unique added by the expand migration covers every department.
-- AlterTable
ALTER TABLE "public"."branch_day_departments" ALTER COLUMN "department_tag" DROP NOT NULL;

-- AlterTable
ALTER TABLE "public"."department_openings" ALTER COLUMN "department_tag" DROP NOT NULL;
