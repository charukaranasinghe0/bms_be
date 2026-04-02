-- AlterTable: add new optional/defaulted columns to Product
ALTER TABLE "Product"
  ADD COLUMN "description" TEXT,
  ADD COLUMN "sku" TEXT,
  ADD COLUMN "unit" TEXT NOT NULL DEFAULT 'piece',
  ADD COLUMN "stockQty" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lowStockThreshold" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();

-- CreateIndex: sku is optional but unique when set
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");
