-- AlterTable
ALTER TABLE "products"
ADD COLUMN "raw_name" TEXT,
ADD COLUMN "brand" TEXT,
ADD COLUMN "name_key" TEXT NOT NULL DEFAULT '',
ADD COLUMN "base_unit_name" TEXT NOT NULL DEFAULT U&'\0448\0442',
ADD COLUMN "purchase_cost_price" DOUBLE PRECISION,
ADD COLUMN "expense_percent" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Backfill name_key/base_unit_name for existing rows
UPDATE "products"
SET
  "name_key" = regexp_replace(
    lower(
      regexp_replace(
        replace(replace("name", U&'\0401', U&'\0415'), U&'\0451', U&'\0435'),
        '[^a-zA-Zа-яА-Я0-9]+',
        '-',
        'g'
      )
    ),
    '(^-+|-+$)',
    '',
    'g'
  ),
  "base_unit_name" = COALESCE(NULLIF("unit", ''), U&'\0448\0442')
WHERE "name_key" = '' OR "base_unit_name" = U&'\0448\0442';

-- CreateTable
CREATE TABLE "product_packagings" (
  "id" SERIAL NOT NULL,
  "product_id" INTEGER NOT NULL,
  "warehouse_id" INTEGER,
  "package_name" TEXT NOT NULL,
  "base_unit_name" TEXT NOT NULL,
  "units_per_package" INTEGER NOT NULL,
  "package_selling_price" DOUBLE PRECISION,
  "barcode" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "is_default" BOOLEAN NOT NULL DEFAULT false,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "product_packagings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_profiles" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "country" TEXT,
  "region" TEXT,
  "city" TEXT,
  "address_line" TEXT,
  "phone" TEXT,
  "note" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "company_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "phone" TEXT,
  "address" TEXT,
  "city" TEXT,
  "notes" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_documents" (
  "id" SERIAL NOT NULL,
  "supplier_id" INTEGER,
  "warehouse_id" INTEGER NOT NULL,
  "source_type" TEXT NOT NULL DEFAULT 'pdf',
  "document_number" TEXT,
  "document_date" TIMESTAMP(3),
  "file_url" TEXT,
  "raw_text" TEXT,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "imported_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "purchase_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_document_items" (
  "id" SERIAL NOT NULL,
  "purchase_document_id" INTEGER NOT NULL,
  "matched_product_id" INTEGER,
  "raw_name" TEXT NOT NULL,
  "clean_name" TEXT NOT NULL,
  "brand" TEXT,
  "name_key" TEXT NOT NULL,
  "package_name" TEXT,
  "base_unit_name" TEXT NOT NULL,
  "units_per_package" INTEGER,
  "package_quantity" DOUBLE PRECISION,
  "extra_unit_quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "total_base_units" DOUBLE PRECISION NOT NULL,
  "expense_percent" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "cost_price_per_base_unit" DOUBLE PRECISION,
  "effective_cost_price_per_base_unit" DOUBLE PRECISION,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "purchase_document_items_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "invoices"
ADD COLUMN "company_name_snapshot" TEXT,
ADD COLUMN "company_country_snapshot" TEXT,
ADD COLUMN "company_region_snapshot" TEXT,
ADD COLUMN "company_city_snapshot" TEXT,
ADD COLUMN "company_address_snapshot" TEXT,
ADD COLUMN "customer_name_snapshot" TEXT,
ADD COLUMN "customer_phone_snapshot" TEXT,
ADD COLUMN "customer_address_snapshot" TEXT;

-- AlterTable
ALTER TABLE "invoice_items"
ADD COLUMN "total_base_units" DOUBLE PRECISION,
ADD COLUMN "package_quantity" DOUBLE PRECISION,
ADD COLUMN "extra_unit_quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "packaging_id" INTEGER,
ADD COLUMN "package_name_snapshot" TEXT,
ADD COLUMN "base_unit_name_snapshot" TEXT,
ADD COLUMN "units_per_package_snapshot" INTEGER,
ADD COLUMN "product_name_snapshot" TEXT,
ADD COLUMN "raw_name_snapshot" TEXT,
ADD COLUMN "brand_snapshot" TEXT;

-- AlterTable
ALTER TABLE "product_batches"
ADD COLUMN "purchase_cost_price" DOUBLE PRECISION,
ADD COLUMN "expense_percent" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Backfill invoice_items
UPDATE "invoice_items"
SET "total_base_units" = "quantity"
WHERE "total_base_units" IS NULL;

-- Indexes
CREATE UNIQUE INDEX "products_warehouse_id_name_key_key" ON "products"("warehouse_id", "name_key");
CREATE UNIQUE INDEX "product_packagings_product_id_package_name_units_per_package_key" ON "product_packagings"("product_id", "package_name", "units_per_package");
CREATE UNIQUE INDEX "product_packagings_barcode_warehouse_id_key" ON "product_packagings"("barcode", "warehouse_id");

-- Foreign Keys
ALTER TABLE "product_packagings"
ADD CONSTRAINT "product_packagings_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "product_packagings"
ADD CONSTRAINT "product_packagings_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "purchase_documents"
ADD CONSTRAINT "purchase_documents_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "purchase_documents"
ADD CONSTRAINT "purchase_documents_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "purchase_document_items"
ADD CONSTRAINT "purchase_document_items_purchase_document_id_fkey" FOREIGN KEY ("purchase_document_id") REFERENCES "purchase_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "purchase_document_items"
ADD CONSTRAINT "purchase_document_items_matched_product_id_fkey" FOREIGN KEY ("matched_product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
