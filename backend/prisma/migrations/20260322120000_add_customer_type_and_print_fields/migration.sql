ALTER TABLE "customers"
ADD COLUMN "customer_type" TEXT NOT NULL DEFAULT 'individual',
ADD COLUMN "company_name" TEXT,
ADD COLUMN "contact_name" TEXT,
ADD COLUMN "country" TEXT,
ADD COLUMN "region" TEXT;
