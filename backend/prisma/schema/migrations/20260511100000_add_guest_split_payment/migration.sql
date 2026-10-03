-- AddValue
ALTER TYPE "PaymentMethod" ADD VALUE 'GUEST_SPLIT';

-- CreateTable
CREATE TABLE "split_payment_lines" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "mpesa_code" TEXT,
    "paid_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "split_payment_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "split_payment_lines_order_id_idx" ON "split_payment_lines"("order_id");

-- AddForeignKey
ALTER TABLE "split_payment_lines" ADD CONSTRAINT "split_payment_lines_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
