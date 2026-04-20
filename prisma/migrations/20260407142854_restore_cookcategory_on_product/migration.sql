-- Restore correct types after bad migration

-- 1. Recreate the CookCategory enum (was dropped in previous migration)
DO $$ BEGIN
  CREATE TYPE "CookCategory" AS ENUM ('PASTRY', 'BREAD', 'HOT_FOOD');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Cast ChefOrder.cookCategory from TEXT to CookCategory enum
ALTER TABLE "ChefOrder" ALTER COLUMN "cookCategory" DROP DEFAULT;
ALTER TABLE "ChefOrder" ALTER COLUMN "cookCategory" TYPE "CookCategory"
  USING (
    CASE
      WHEN "cookCategory" IN ('PASTRY','BREAD','HOT_FOOD') THEN "cookCategory"::"CookCategory"
      ELSE 'PASTRY'::"CookCategory"
    END
  );

-- 3. Cast User.cookCategory from TEXT to CookCategory enum (nullable)
ALTER TABLE "User" ALTER COLUMN "cookCategory" TYPE "CookCategory"
  USING (
    CASE
      WHEN "cookCategory" IN ('PASTRY','BREAD','HOT_FOOD') THEN "cookCategory"::"CookCategory"
      ELSE NULL
    END
  );

-- 4. Drop old loyalty/product category columns and tables
ALTER TABLE "customer" DROP COLUMN IF EXISTS "customerType";
ALTER TABLE "customer" DROP COLUMN IF EXISTS "loyaltyPoints";
DROP TABLE IF EXISTS "LoyaltyConfig";
DROP TABLE IF EXISTS "ProductCategory";

-- 5. Recreate index (drop first in case it exists with wrong type)
DROP INDEX IF EXISTS "ChefOrder_cookCategory_status_idx";
CREATE INDEX "ChefOrder_cookCategory_status_idx" ON "ChefOrder"("cookCategory", "status");
