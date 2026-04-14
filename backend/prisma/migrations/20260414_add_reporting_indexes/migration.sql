CREATE INDEX IF NOT EXISTS "users_active_warehouse_id_idx"
  ON "users" ("active", "warehouse_id");

CREATE INDEX IF NOT EXISTS "users_role_active_idx"
  ON "users" ("role", "active");

CREATE INDEX IF NOT EXISTS "warehouses_active_city_idx"
  ON "warehouses" ("active", "city");

CREATE INDEX IF NOT EXISTS "products_warehouse_active_created_at_idx"
  ON "products" ("warehouse_id", "active", "created_at");

CREATE INDEX IF NOT EXISTS "products_category_warehouse_active_idx"
  ON "products" ("category_id", "warehouse_id", "active");

CREATE INDEX IF NOT EXISTS "product_packagings_product_active_default_idx"
  ON "product_packagings" ("product_id", "active", "is_default");

CREATE INDEX IF NOT EXISTS "product_packagings_warehouse_active_idx"
  ON "product_packagings" ("warehouse_id", "active");

CREATE INDEX IF NOT EXISTS "price_history_product_created_at_idx"
  ON "price_history" ("product_id", "created_at");

CREATE INDEX IF NOT EXISTS "product_batches_warehouse_remaining_idx"
  ON "product_batches" ("warehouse_id", "remaining_quantity");

CREATE INDEX IF NOT EXISTS "product_batches_product_warehouse_idx"
  ON "product_batches" ("product_id", "warehouse_id");

CREATE INDEX IF NOT EXISTS "product_batches_created_at_idx"
  ON "product_batches" ("created_at");

CREATE INDEX IF NOT EXISTS "customers_active_city_created_at_idx"
  ON "customers" ("active", "city", "created_at");

CREATE INDEX IF NOT EXISTS "customers_created_by_user_created_at_idx"
  ON "customers" ("created_by_user_id", "created_at");

CREATE INDEX IF NOT EXISTS "purchase_documents_warehouse_created_at_idx"
  ON "purchase_documents" ("warehouse_id", "created_at");

CREATE INDEX IF NOT EXISTS "purchase_documents_supplier_created_at_idx"
  ON "purchase_documents" ("supplier_id", "created_at");

CREATE INDEX IF NOT EXISTS "purchase_document_items_document_id_idx"
  ON "purchase_document_items" ("purchase_document_id");

CREATE INDEX IF NOT EXISTS "purchase_document_items_matched_product_id_idx"
  ON "purchase_document_items" ("matched_product_id");

CREATE INDEX IF NOT EXISTS "purchase_document_items_name_key_idx"
  ON "purchase_document_items" ("name_key");

CREATE INDEX IF NOT EXISTS "invoices_warehouse_cancelled_created_at_idx"
  ON "invoices" ("warehouse_id", "cancelled", "created_at");

CREATE INDEX IF NOT EXISTS "invoices_cancelled_created_at_idx"
  ON "invoices" ("cancelled", "created_at");

CREATE INDEX IF NOT EXISTS "invoices_customer_created_at_idx"
  ON "invoices" ("customer_id", "created_at");

CREATE INDEX IF NOT EXISTS "invoices_user_created_at_idx"
  ON "invoices" ("user_id", "created_at");

CREATE INDEX IF NOT EXISTS "invoice_items_invoice_id_idx"
  ON "invoice_items" ("invoice_id");

CREATE INDEX IF NOT EXISTS "invoice_items_product_id_idx"
  ON "invoice_items" ("product_id");

CREATE INDEX IF NOT EXISTS "sale_allocations_invoice_item_id_idx"
  ON "sale_allocations" ("invoice_item_id");

CREATE INDEX IF NOT EXISTS "sale_allocations_batch_id_idx"
  ON "sale_allocations" ("batch_id");

CREATE INDEX IF NOT EXISTS "payments_customer_created_at_idx"
  ON "payments" ("customer_id", "created_at");

CREATE INDEX IF NOT EXISTS "payments_invoice_created_at_idx"
  ON "payments" ("invoice_id", "created_at");

CREATE INDEX IF NOT EXISTS "payments_user_created_at_idx"
  ON "payments" ("user_id", "created_at");

CREATE INDEX IF NOT EXISTS "expenses_warehouse_expense_date_idx"
  ON "expenses" ("warehouse_id", "expense_date");

CREATE INDEX IF NOT EXISTS "expenses_user_created_at_idx"
  ON "expenses" ("user_id", "created_at");

CREATE INDEX IF NOT EXISTS "returns_invoice_created_at_idx"
  ON "returns" ("invoice_id", "created_at");

CREATE INDEX IF NOT EXISTS "returns_customer_created_at_idx"
  ON "returns" ("customer_id", "created_at");

CREATE INDEX IF NOT EXISTS "returns_user_created_at_idx"
  ON "returns" ("user_id", "created_at");

CREATE INDEX IF NOT EXISTS "inventory_transactions_type_warehouse_created_at_idx"
  ON "inventory_transactions" ("type", "warehouse_id", "created_at");

CREATE INDEX IF NOT EXISTS "inventory_transactions_warehouse_created_at_idx"
  ON "inventory_transactions" ("warehouse_id", "created_at");

CREATE INDEX IF NOT EXISTS "inventory_transactions_product_created_at_idx"
  ON "inventory_transactions" ("product_id", "created_at");

CREATE INDEX IF NOT EXISTS "inventory_transactions_reference_id_idx"
  ON "inventory_transactions" ("reference_id");

CREATE INDEX IF NOT EXISTS "inventory_transactions_user_created_at_idx"
  ON "inventory_transactions" ("user_id", "created_at");

CREATE INDEX IF NOT EXISTS "reminders_user_completed_due_date_idx"
  ON "reminders" ("user_id", "is_completed", "due_date");

CREATE INDEX IF NOT EXISTS "reminders_due_date_idx"
  ON "reminders" ("due_date");

CREATE INDEX IF NOT EXISTS "reminders_reference_id_idx"
  ON "reminders" ("reference_id");

