-- Add branch-level employer KRA PIN for payslip headers.
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "kra_pin" TEXT;
