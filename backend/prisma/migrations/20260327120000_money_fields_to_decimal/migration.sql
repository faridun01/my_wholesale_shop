ALTER TABLE "products"
  ALTER COLUMN "purchase_cost_price" TYPE DECIMAL(12,2) USING ROUND("purchase_cost_price"::numeric, 2),
  ALTER COLUMN "cost_price" TYPE DECIMAL(12,2) USING ROUND("cost_price"::numeric, 2),
  ALTER COLUMN "selling_price" TYPE DECIMAL(12,2) USING ROUND("selling_price"::numeric, 2);

ALTER TABLE "product_packagings"
  ALTER COLUMN "package_selling_price" TYPE DECIMAL(12,2) USING ROUND("package_selling_price"::numeric, 2);

ALTER TABLE "price_history"
  ALTER COLUMN "cost_price" TYPE DECIMAL(12,2) USING ROUND("cost_price"::numeric, 2),
  ALTER COLUMN "selling_price" TYPE DECIMAL(12,2) USING ROUND("selling_price"::numeric, 2);

ALTER TABLE "product_batches"
  ALTER COLUMN "purchase_cost_price" TYPE DECIMAL(12,2) USING ROUND("purchase_cost_price"::numeric, 2),
  ALTER COLUMN "cost_price" TYPE DECIMAL(12,2) USING ROUND("cost_price"::numeric, 2);

ALTER TABLE "purchase_document_items"
  ALTER COLUMN "cost_price_per_base_unit" TYPE DECIMAL(12,2) USING ROUND("cost_price_per_base_unit"::numeric, 2),
  ALTER COLUMN "effective_cost_price_per_base_unit" TYPE DECIMAL(12,2) USING ROUND("effective_cost_price_per_base_unit"::numeric, 2);

ALTER TABLE "invoices"
  ALTER COLUMN "total_amount" TYPE DECIMAL(12,2) USING ROUND("total_amount"::numeric, 2),
  ALTER COLUMN "tax" TYPE DECIMAL(12,2) USING ROUND("tax"::numeric, 2),
  ALTER COLUMN "net_amount" TYPE DECIMAL(12,2) USING ROUND("net_amount"::numeric, 2),
  ALTER COLUMN "paid_amount" TYPE DECIMAL(12,2) USING ROUND("paid_amount"::numeric, 2),
  ALTER COLUMN "returned_amount" TYPE DECIMAL(12,2) USING ROUND("returned_amount"::numeric, 2);

ALTER TABLE "invoice_items"
  ALTER COLUMN "selling_price" TYPE DECIMAL(12,2) USING ROUND("selling_price"::numeric, 2),
  ALTER COLUMN "cost_price" TYPE DECIMAL(12,2) USING ROUND("cost_price"::numeric, 2),
  ALTER COLUMN "total_price" TYPE DECIMAL(12,2) USING ROUND("total_price"::numeric, 2);

ALTER TABLE "payments"
  ALTER COLUMN "amount" TYPE DECIMAL(12,2) USING ROUND("amount"::numeric, 2);

ALTER TABLE "expenses"
  ALTER COLUMN "amount" TYPE DECIMAL(12,2) USING ROUND("amount"::numeric, 2);

ALTER TABLE "returns"
  ALTER COLUMN "total_value" TYPE DECIMAL(12,2) USING ROUND("total_value"::numeric, 2);

ALTER TABLE "inventory_transactions"
  ALTER COLUMN "cost_at_time" TYPE DECIMAL(12,2) USING ROUND("cost_at_time"::numeric, 2),
  ALTER COLUMN "selling_at_time" TYPE DECIMAL(12,2) USING ROUND("selling_at_time"::numeric, 2);
