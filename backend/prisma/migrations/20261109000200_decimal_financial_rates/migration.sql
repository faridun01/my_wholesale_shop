-- Preserve current decimal text representations of existing floating-point
-- rates. No monetary ledger rows are rewritten or removed. Do not apply to
-- the working database until the deployment migration review is complete.
ALTER TABLE "products" ALTER COLUMN "expense_percent" TYPE DECIMAL(65,30) USING "expense_percent"::text::numeric;
ALTER TABLE "product_batches" ALTER COLUMN "expense_percent" TYPE DECIMAL(65,30) USING "expense_percent"::text::numeric;
ALTER TABLE "purchase_document_items" ALTER COLUMN "expense_percent" TYPE DECIMAL(65,30) USING "expense_percent"::text::numeric;
ALTER TABLE "customer_orders" ALTER COLUMN "discount" TYPE DECIMAL(65,30) USING "discount"::text::numeric;
ALTER TABLE "customer_order_items" ALTER COLUMN "discount" TYPE DECIMAL(65,30) USING "discount"::text::numeric;
ALTER TABLE "invoices" ALTER COLUMN "discount" TYPE DECIMAL(65,30) USING "discount"::text::numeric;
ALTER TABLE "invoice_items" ALTER COLUMN "discount" TYPE DECIMAL(65,30) USING "discount"::text::numeric;
ALTER TABLE "return_items" ALTER COLUMN "item_discount" TYPE DECIMAL(65,30) USING "item_discount"::text::numeric;
