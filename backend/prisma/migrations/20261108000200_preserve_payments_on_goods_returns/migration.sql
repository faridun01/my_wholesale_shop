-- Goods returns reduce the invoice total; they do not automatically disburse cash.
-- Keep any excess return value as customer credit and allow paid invoices to become
-- overpaid after a return without rewriting payment history.
ALTER TABLE "returns"
  ADD COLUMN "credit_amount" DECIMAL(12,2);

ALTER TABLE "invoices"
  DROP CONSTRAINT IF EXISTS "invoices_financial_balances";

ALTER TABLE "invoices"
  ADD CONSTRAINT "invoices_financial_balances"
  CHECK (net_amount >= 0 AND paid_amount >= 0 AND returned_amount >= 0 AND discount BETWEEN 0 AND 100)
  NOT VALID;

ALTER TABLE "returns"
  DROP CONSTRAINT IF EXISTS "returns_financial_values";

ALTER TABLE "returns"
  ADD CONSTRAINT "returns_financial_values"
  CHECK (
    total_value >= 0
    AND (
      refunded_amount IS NULL
      OR (
        refunded_amount >= 0
        AND debt_reduction >= 0
        AND (credit_amount IS NULL OR credit_amount >= 0)
        AND refunded_amount + debt_reduction + COALESCE(credit_amount, 0) = total_value
      )
    )
  )
  NOT VALID;
