-- Preserve historical settlement data. New goods returns may reduce debt by
-- less than their value; the remainder is neither a payment nor customer credit.
ALTER TABLE "returns" DROP CONSTRAINT IF EXISTS "returns_financial_values";
ALTER TABLE "returns" ADD CONSTRAINT "returns_financial_values" CHECK (
  total_value >= 0 AND
  (refunded_amount IS NULL OR
   (refunded_amount >= 0 AND debt_reduction >= 0 AND
    (credit_amount IS NULL OR credit_amount >= 0) AND
    refunded_amount + debt_reduction + COALESCE(credit_amount, 0) <= total_value))
) NOT VALID;
