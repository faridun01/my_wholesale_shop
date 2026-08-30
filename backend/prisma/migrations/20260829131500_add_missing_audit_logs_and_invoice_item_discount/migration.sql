-- Reconciles migration history with schema.prisma. `invoice_items.discount` and the
-- entire `audit_logs` table are used by application code (invoice.service.ts return
-- refund calculation; audit.service.ts, called from invoices.routes.ts) but were never
-- created by any committed migration — existing databases only have them because they
-- were patched out-of-band. A fresh `prisma migrate deploy` (e.g. a new Docker Compose
-- environment) would otherwise start missing both, and every invoice write/return or
-- audit-logged action would fail with "column/relation does not exist".

ALTER TABLE "invoice_items"
  ADD COLUMN IF NOT EXISTS "discount" DOUBLE PRECISION NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "audit_logs" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" INTEGER,
    "details" TEXT,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "audit_logs_user_id_created_at_idx" ON "audit_logs"("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "audit_logs_action_created_at_idx" ON "audit_logs"("action", "created_at");
CREATE INDEX IF NOT EXISTS "audit_logs_entity_entity_id_idx" ON "audit_logs"("entity", "entity_id");

-- Minor pre-existing drift cleanup: this index was superseded by a composite index
-- added in 20260614090000_add_performance_indexes, and updated_at no longer needs a
-- DB-level default since Prisma's @updatedAt manages it application-side.
DROP INDEX IF EXISTS "expenses_user_id_idx";

ALTER TABLE "expenses" ALTER COLUMN "updated_at" DROP DEFAULT;
