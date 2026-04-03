-- AlterTable
ALTER TABLE "customer" ADD COLUMN     "customerType" TEXT NOT NULL DEFAULT 'NEW',
ADD COLUMN     "loyaltyPoints" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "LoyaltyConfig" (
    "id" TEXT NOT NULL,
    "pointsPerAmount" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "amountPerPoints" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "redeemThreshold" INTEGER NOT NULL DEFAULT 100,
    "redeemDiscount" DOUBLE PRECISION NOT NULL DEFAULT 20,
    "regularThreshold" INTEGER NOT NULL DEFAULT 50,
    "loyalThreshold" INTEGER NOT NULL DEFAULT 200,
    "vipThreshold" INTEGER NOT NULL DEFAULT 500,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "LoyaltyConfig_pkey" PRIMARY KEY ("id")
);
