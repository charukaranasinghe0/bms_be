-- Add product categories table and link to Product
-- Note: customerType, loyaltyPoints, LoyaltyConfig already dropped in previous migration

-- AlterTable
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "category_id" TEXT;

-- DropTable (safe — already dropped in restore migration)
DROP TABLE IF EXISTS "LoyaltyConfig";

-- CreateTable
CREATE TABLE IF NOT EXISTS "product_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "product_categories_name_key" ON "product_categories"("name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Product_category_id_idx" ON "Product"("category_id");

-- AddForeignKey (safe — only add if not exists)
DO $$ BEGIN
  ALTER TABLE "Product" ADD CONSTRAINT "Product_category_id_fkey"
    FOREIGN KEY ("category_id") REFERENCES "product_categories"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
