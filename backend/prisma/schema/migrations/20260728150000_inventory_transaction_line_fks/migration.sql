-- AddForeignKey
ALTER TABLE "public"."inventory_transactions" ADD CONSTRAINT "inventory_transactions_purchase_order_line_id_fkey" FOREIGN KEY ("purchase_order_line_id") REFERENCES "public"."purchase_order_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."inventory_transactions" ADD CONSTRAINT "inventory_transactions_stock_count_line_id_fkey" FOREIGN KEY ("stock_count_line_id") REFERENCES "public"."stock_count_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;
