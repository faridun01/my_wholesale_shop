-- Staff cash: a staff member hands the cash they received to an administrator, who
-- confirms receiving it. Additive only; client payments are untouched.
ALTER TABLE "users" ADD COLUMN "can_accept_payments" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "cash_handovers" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "amount" DECIMAL(12,2) NOT NULL,
    "confirmed_by_id" INTEGER,
    "confirmed_at" TIMESTAMP(3),
    "idempotency_key" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cash_handovers_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "cash_handovers_values" CHECK (
      amount > 0
      AND ((status = 'pending' AND confirmed_at IS NULL AND confirmed_by_id IS NULL)
        OR (status = 'confirmed' AND confirmed_at IS NOT NULL)))
);

CREATE TABLE "cash_handover_items" (
    "id" SERIAL NOT NULL,
    "handover_id" INTEGER NOT NULL,
    "payment_id" INTEGER NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    CONSTRAINT "cash_handover_items_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "cash_handover_items_amount" CHECK (amount > 0)
);

CREATE UNIQUE INDEX "cash_handovers_idempotency_key_key" ON "cash_handovers"("idempotency_key");
CREATE INDEX "cash_handovers_user_id_created_at_idx" ON "cash_handovers"("user_id", "created_at");
CREATE INDEX "cash_handovers_status_created_at_idx" ON "cash_handovers"("status", "created_at");
CREATE INDEX "cash_handover_items_handover_id_idx" ON "cash_handover_items"("handover_id");
-- A payment's cash is handed over once.
CREATE UNIQUE INDEX "cash_handover_items_payment_id_key" ON "cash_handover_items"("payment_id");

ALTER TABLE "cash_handovers" ADD CONSTRAINT "cash_handovers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cash_handovers" ADD CONSTRAINT "cash_handovers_confirmed_by_id_fkey" FOREIGN KEY ("confirmed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "cash_handover_items" ADD CONSTRAINT "cash_handover_items_handover_id_fkey" FOREIGN KEY ("handover_id") REFERENCES "cash_handovers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cash_handover_items" ADD CONSTRAINT "cash_handover_items_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- The contents of a sent handover never change; it can only be confirmed, once.
CREATE TRIGGER cash_handover_items_immutable BEFORE UPDATE OR DELETE ON cash_handover_items FOR EACH ROW EXECUTE FUNCTION protect_immutable_financial_event();

CREATE FUNCTION protect_cash_handover() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Cash handovers cannot be deleted'; END IF;
  IF OLD.status <> 'pending' OR NEW.status <> 'confirmed'
     OR NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.amount IS DISTINCT FROM OLD.amount
     OR NEW.created_at IS DISTINCT FROM OLD.created_at OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key
     OR NEW.request_hash IS DISTINCT FROM OLD.request_hash
  THEN RAISE EXCEPTION 'A cash handover can only be confirmed, once'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER cash_handovers_protected BEFORE UPDATE OR DELETE ON cash_handovers FOR EACH ROW EXECUTE FUNCTION protect_cash_handover();
