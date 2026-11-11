-- A cash handover can be returned to the staff member: by the staff member while it is
-- still waiting, or by an administrator at any time, with a reason. Its payments go back
-- on hand and can be sent again; the returned handover stays in the history.
ALTER TABLE "cash_handovers"
  ADD COLUMN "returned_by_id" INTEGER,
  ADD COLUMN "returned_at" TIMESTAMP(3),
  ADD COLUMN "return_reason" TEXT;

ALTER TABLE "cash_handovers" ADD CONSTRAINT "cash_handovers_returned_by_id_fkey"
  FOREIGN KEY ("returned_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "cash_handovers" DROP CONSTRAINT "cash_handovers_values";
ALTER TABLE "cash_handovers" ADD CONSTRAINT "cash_handovers_values" CHECK (
  amount > 0 AND (
    (status = 'pending' AND confirmed_at IS NULL AND confirmed_by_id IS NULL AND returned_at IS NULL)
    OR (status = 'confirmed' AND confirmed_at IS NOT NULL AND returned_at IS NULL)
    OR (status = 'returned' AND returned_at IS NOT NULL AND length(trim(return_reason)) > 0)));

-- A payment is in at most one handover that was not returned.
ALTER TABLE "cash_handover_items" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;
DROP INDEX "cash_handover_items_payment_id_key";
CREATE INDEX "cash_handover_items_payment_id_idx" ON "cash_handover_items"("payment_id");
CREATE UNIQUE INDEX "cash_handover_items_one_active_per_payment" ON "cash_handover_items"("payment_id") WHERE active;

-- Contents never change; a line is only released when its handover is returned.
DROP TRIGGER "cash_handover_items_immutable" ON "cash_handover_items";
CREATE FUNCTION protect_cash_handover_item() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Cash handover items cannot be deleted'; END IF;
  IF NEW.handover_id IS DISTINCT FROM OLD.handover_id OR NEW.payment_id IS DISTINCT FROM OLD.payment_id
     OR NEW.amount IS DISTINCT FROM OLD.amount OR NEW.active OR NOT OLD.active
  THEN RAISE EXCEPTION 'A cash handover item can only be released'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "cash_handover_items_protected" BEFORE UPDATE OR DELETE ON "cash_handover_items" FOR EACH ROW EXECUTE FUNCTION protect_cash_handover_item();

-- Allowed: waiting -> confirmed, waiting -> returned, confirmed -> returned. Nothing else.
CREATE OR REPLACE FUNCTION protect_cash_handover() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Cash handovers cannot be deleted'; END IF;
  IF NOT ((OLD.status = 'pending' AND NEW.status IN ('confirmed', 'returned')) OR (OLD.status = 'confirmed' AND NEW.status = 'returned'))
     OR NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.amount IS DISTINCT FROM OLD.amount
     OR NEW.created_at IS DISTINCT FROM OLD.created_at OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key
     OR NEW.request_hash IS DISTINCT FROM OLD.request_hash
     OR (OLD.status = 'confirmed' AND (NEW.confirmed_at IS DISTINCT FROM OLD.confirmed_at OR NEW.confirmed_by_id IS DISTINCT FROM OLD.confirmed_by_id))
  THEN RAISE EXCEPTION 'A cash handover can only be confirmed or returned'; END IF;
  RETURN NEW;
END $$;
