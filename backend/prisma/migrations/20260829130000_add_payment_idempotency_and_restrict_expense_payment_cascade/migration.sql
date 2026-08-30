-- Add an optional, unique idempotency key to payments so a client-retried or
-- double-submitted payment request can be safely deduped instead of double-applied.
ALTER TABLE "payments"
  ADD COLUMN IF NOT EXISTS "idempotency_key" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payments_idempotency_key_key'
  ) THEN
    ALTER TABLE "payments"
      ADD CONSTRAINT "payments_idempotency_key_key" UNIQUE ("idempotency_key");
  END IF;
END $$;

-- Deleting an Expense must not silently cascade-delete real recorded cash payments
-- against it (financial audit trail). Switch the FK from CASCADE to RESTRICT; the
-- app layer additionally blocks the delete when paidAmount > 0 before reaching here.
ALTER TABLE "expense_payments"
  DROP CONSTRAINT IF EXISTS "expense_payments_expense_id_fkey";

ALTER TABLE "expense_payments"
  ADD CONSTRAINT "expense_payments_expense_id_fkey"
  FOREIGN KEY ("expense_id") REFERENCES "expenses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
