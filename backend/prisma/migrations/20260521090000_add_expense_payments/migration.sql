CREATE TABLE IF NOT EXISTS "expense_payments" (
  "id" SERIAL NOT NULL,
  "expense_id" INTEGER NOT NULL,
  "user_id" INTEGER NOT NULL,
  "amount" DECIMAL(12, 2) NOT NULL,
  "method" TEXT NOT NULL DEFAULT 'cash',
  "payment_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "note" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "expense_payments_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'expense_payments_expense_id_fkey'
  ) THEN
    ALTER TABLE "expense_payments"
      ADD CONSTRAINT "expense_payments_expense_id_fkey"
      FOREIGN KEY ("expense_id") REFERENCES "expenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'expense_payments_user_id_fkey'
  ) THEN
    ALTER TABLE "expense_payments"
      ADD CONSTRAINT "expense_payments_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "expense_payments_expense_payment_date_idx"
  ON "expense_payments" ("expense_id", "payment_date");

CREATE INDEX IF NOT EXISTS "expense_payments_user_payment_date_idx"
  ON "expense_payments" ("user_id", "payment_date");

CREATE INDEX IF NOT EXISTS "expense_payments_payment_date_idx"
  ON "expense_payments" ("payment_date");

INSERT INTO "expense_payments" ("expense_id", "user_id", "amount", "method", "payment_date", "created_at")
SELECT "id", "user_id", "paid_amount", 'cash', "expense_date", "created_at"
FROM "expenses"
WHERE "paid_amount" > 0
  AND NOT EXISTS (
    SELECT 1
    FROM "expense_payments"
    WHERE "expense_payments"."expense_id" = "expenses"."id"
  );
