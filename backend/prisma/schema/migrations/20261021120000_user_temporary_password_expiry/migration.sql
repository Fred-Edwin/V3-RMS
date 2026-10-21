-- AlterTable (additive, guarded: safe to run twice)
ALTER TABLE "public"."users" ADD COLUMN IF NOT EXISTS "temporary_password_expires_at" TIMESTAMP(3);
