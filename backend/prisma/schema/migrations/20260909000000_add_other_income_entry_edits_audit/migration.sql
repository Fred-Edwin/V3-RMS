-- Audit trail for corrections made to an other_income_entries row after it was
-- recorded. One row per edit action; `changes` is a JSON array of
-- { field, from, to } objects. Deleting the entry cascades its edit history.

-- CreateTable
CREATE TABLE "public"."other_income_entry_edits" (
    "id" TEXT NOT NULL,
    "entry_id" TEXT NOT NULL,
    "edited_by_id" TEXT NOT NULL,
    "changes" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "other_income_entry_edits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "other_income_entry_edits_entry_id_idx" ON "public"."other_income_entry_edits"("entry_id");

-- AddForeignKey
ALTER TABLE "public"."other_income_entry_edits" ADD CONSTRAINT "other_income_entry_edits_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "public"."other_income_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."other_income_entry_edits" ADD CONSTRAINT "other_income_entry_edits_edited_by_id_fkey" FOREIGN KEY ("edited_by_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
