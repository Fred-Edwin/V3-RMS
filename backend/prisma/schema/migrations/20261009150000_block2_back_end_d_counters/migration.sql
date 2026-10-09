-- Block 2, back end D: state the branch count and the two reminder jobs need (additive, nothing is dropped or rewritten).
-- dispatch_lines.check_count: checks a line has been through (0 not yet, 1 flagged once, 2 final).
-- dispatches.waiting_notified_at: the 2-hour "Waiting for the branch" job's claim, so it tells the Branch Manager once.
-- discrepancies.reminder_sent_at: the 24-hour then daily reminder job's claim, so it never sends twice in a day.

ALTER TABLE "dispatch_lines" ADD COLUMN "check_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "dispatches" ADD COLUMN "waiting_notified_at" TIMESTAMP(3);
ALTER TABLE "discrepancies" ADD COLUMN "reminder_sent_at" TIMESTAMP(3);
