-- Additive constraints: NOT VALID preserves existing rows, while future writes
-- must satisfy the invariants. Historical exceptions require explicit review.
ALTER TABLE invoices ADD CONSTRAINT invoices_financial_balances CHECK
  (net_amount >= 0 AND paid_amount >= 0 AND paid_amount <= net_amount AND returned_amount >= 0 AND discount BETWEEN 0 AND 100) NOT VALID;
ALTER TABLE invoice_items ADD CONSTRAINT invoice_items_financial_quantities CHECK
  (quantity > 0 AND quantity = trunc(quantity) AND returned_qty >= 0 AND returned_qty = trunc(returned_qty) AND returned_qty <= quantity AND discount BETWEEN 0 AND 100) NOT VALID;
ALTER TABLE return_items ADD CONSTRAINT return_items_financial_values CHECK
  (quantity > 0 AND total_value >= 0 AND tax_amount >= 0 AND tax_amount <= total_value AND allocated_order_discount >= 0 AND item_discount BETWEEN 0 AND 100);
ALTER TABLE returns ADD CONSTRAINT returns_financial_values CHECK
  (total_value >= 0 AND (refunded_amount IS NULL OR (refunded_amount >= 0 AND debt_reduction >= 0 AND refunded_amount + debt_reduction = total_value))) NOT VALID;
ALTER TABLE expense_refunds ADD CONSTRAINT expense_refunds_financial_values CHECK
  (amount > 0 AND refunded_amount >= 0 AND debt_reduction >= 0 AND amount = refunded_amount + debt_reduction);

CREATE FUNCTION protect_immutable_financial_event() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Financial events are immutable; record an explicit reversal or adjustment';
END $$;
CREATE TRIGGER return_items_immutable BEFORE UPDATE OR DELETE ON return_items FOR EACH ROW EXECUTE FUNCTION protect_immutable_financial_event();
CREATE TRIGGER expense_refunds_immutable BEFORE UPDATE OR DELETE ON expense_refunds FOR EACH ROW EXECUTE FUNCTION protect_immutable_financial_event();
CREATE TRIGGER invoice_revisions_immutable BEFORE UPDATE OR DELETE ON invoice_revisions FOR EACH ROW EXECUTE FUNCTION protect_immutable_financial_event();

CREATE FUNCTION protect_financial_ledger() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Financial ledger entries cannot be deleted'; END IF;
  -- Customer merges/reassignment remain possible. Financial event identity,
  -- amounts, methods, timestamps and actor are never rewritten.
  IF TG_TABLE_NAME = 'payments' AND
    (to_jsonb(NEW) - 'customer_id') IS DISTINCT FROM (to_jsonb(OLD) - 'customer_id')
    THEN RAISE EXCEPTION 'Payment entries are immutable'; END IF;
  IF TG_TABLE_NAME = 'expense_payments' AND to_jsonb(NEW) IS DISTINCT FROM to_jsonb(OLD)
    THEN RAISE EXCEPTION 'Expense payment entries are immutable'; END IF;
  IF TG_TABLE_NAME = 'returns' AND
    (to_jsonb(NEW) - 'customer_id') IS DISTINCT FROM (to_jsonb(OLD) - 'customer_id')
    THEN RAISE EXCEPTION 'Return events are immutable'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER payments_immutable BEFORE UPDATE OR DELETE ON payments FOR EACH ROW EXECUTE FUNCTION protect_financial_ledger();
CREATE TRIGGER expense_payments_immutable BEFORE UPDATE OR DELETE ON expense_payments FOR EACH ROW EXECUTE FUNCTION protect_financial_ledger();
CREATE TRIGGER returns_immutable BEFORE UPDATE OR DELETE ON returns FOR EACH ROW EXECUTE FUNCTION protect_financial_ledger();
