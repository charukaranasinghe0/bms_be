/*
  Warnings:

  - You are about to drop the column `customerType` on the `customer` table. All the data in the column will be lost.
  - You are about to drop the column `loyaltyPoints` on the `customer` table. All the data in the column will be lost.
  - You are about to drop the `LoyaltyConfig` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "category_id" TEXT;

-- AlterTable
ALTER TABLE "customer" DROP COLUMN "customerType",
DROP COLUMN "loyaltyPoints";

-- DropTable
DROP TABLE "LoyaltyConfig";

-- CreateTable
CREATE TABLE "product_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "product_categories_name_key" ON "product_categories"("name");

-- CreateIndex
CREATE INDEX "Product_category_id_idx" ON "Product"("category_id");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "product_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
