ALTER TABLE "warehouses"
ADD COLUMN "is_default" BOOLEAN NOT NULL DEFAULT false;

WITH first_active_warehouse AS (
  SELECT id
  FROM "warehouses"
  WHERE "active" = true
  ORDER BY "created_at" ASC
  LIMIT 1
)
UPDATE "warehouses"
SET "is_default" = true
WHERE id IN (SELECT id FROM first_active_warehouse);
