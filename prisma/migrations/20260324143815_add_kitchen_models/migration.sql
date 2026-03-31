-- CreateEnum
CREATE TYPE "CookCategory" AS ENUM ('PASTRY', 'BREAD', 'HOT_FOOD');

-- CreateEnum
CREATE TYPE "ChefOrderStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'DONE');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "cookCategory" "CookCategory",
ADD COLUMN     "requiresCooking" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "cookCategory" "CookCategory";

-- CreateTable
CREATE TABLE "ChefOrder" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "cookCategory" "CookCategory" NOT NULL,
    "status" "ChefOrderStatus" NOT NULL DEFAULT 'PENDING',
    "acceptedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChefOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChefOrder_cookCategory_status_idx" ON "ChefOrder"("cookCategory", "status");

-- CreateIndex
CREATE INDEX "ChefOrder_orderId_idx" ON "ChefOrder"("orderId");

-- AddForeignKey
ALTER TABLE "ChefOrder" ADD CONSTRAINT "ChefOrder_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChefOrder" ADD CONSTRAINT "ChefOrder_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChefOrder" ADD CONSTRAINT "ChefOrder_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
