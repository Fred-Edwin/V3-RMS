-- CreateTable: leave_request_acknowledgements
CREATE TABLE "leave_request_acknowledgements" (
    "id" TEXT NOT NULL,
    "leave_request_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "acknowledged_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leave_request_acknowledgements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "leave_request_acknowledgements_leave_request_id_user_id_key" ON "leave_request_acknowledgements"("leave_request_id", "user_id");
CREATE INDEX "leave_request_acknowledgements_user_id_idx" ON "leave_request_acknowledgements"("user_id");

-- AddForeignKey
ALTER TABLE "leave_request_acknowledgements" ADD CONSTRAINT "leave_request_acknowledgements_leave_request_id_fkey" FOREIGN KEY ("leave_request_id") REFERENCES "leave_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "leave_request_acknowledgements" ADD CONSTRAINT "leave_request_acknowledgements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
