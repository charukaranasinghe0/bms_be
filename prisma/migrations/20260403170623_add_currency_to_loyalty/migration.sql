-- AlterTable
ALTER TABLE "LoyaltyConfig" ADD COLUMN     "currencyCode" TEXT NOT NULL DEFAULT 'LKR',
ADD COLUMN     "currencySymbol" TEXT NOT NULL DEFAULT 'Rs';
