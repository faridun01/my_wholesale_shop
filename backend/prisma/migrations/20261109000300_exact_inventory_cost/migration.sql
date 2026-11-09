-- Preserve exact FIFO write-off cost; historical rows remain unchanged.
ALTER TABLE "inventory_transactions"
  ADD COLUMN "total_cost" DECIMAL(18,2),
  ADD COLUMN "cost_allocations" JSONB;
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_total_cost_nonnegative"
  CHECK (total_cost IS NULL OR total_cost >= 0) NOT VALID;
