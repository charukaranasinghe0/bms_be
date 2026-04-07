/*
  Warnings:

  - The `cookCategory` column on the `ChefOrder` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `cookCategory` on the `Product` table. All the data in the column will be lost.
  - The `cookCategory` column on the `User` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "ChefOrder" DROP COLUMN "cookCategory",
ADD COLUMN     "cookCategory" TEXT NOT NULL DEFAULT 'GENERAL';

-- AlterTable
ALTER TABLE "Product" DROP COLUMN "cookCategory",
ADD COLUMN     "categoryId" TEXT;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "cookCategory",
ADD COLUMN     "cookCategory" TEXT;

-- DropEnum
DROP TYPE "CookCategory";

-- CreateTable
CREATE TABLE "ProductCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductCategory_name_key" ON "ProductCategory"("name");

-- CreateIndex
CREATE INDEX "ChefOrder_cookCategory_status_idx" ON "ChefOrder"("cookCategory", "status");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ProductCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
