-- CreateEnum
CREATE TYPE "LoyaltyTxType" AS ENUM ('EARNED', 'REDEEMED', 'ADJUSTED');

-- AlterTable
ALTER TABLE "customer" ADD COLUMN     "current_points" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lifetime_points" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "tier_name" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "loyalty_tiers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "min_points" INTEGER NOT NULL,
    "max_points" INTEGER,
    "point_multiplier" DECIMAL(5,2) NOT NULL,
    "perks_config" JSONB NOT NULL DEFAULT '{}',
    "sort_order" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loyalty_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_settings" (
    "id" TEXT NOT NULL,
    "points_per_currency_unit" DECIMAL(5,2) NOT NULL,
    "redemption_threshold" INTEGER NOT NULL,
    "redemption_value" DECIMAL(10,2) NOT NULL,
    "currency_code" TEXT NOT NULL DEFAULT 'USD',
    "currency_symbol" TEXT NOT NULL DEFAULT '$',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loyalty_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_point_transactions" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "type" "LoyaltyTxType" NOT NULL,
    "points" INTEGER NOT NULL,
    "order_id" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loyalty_point_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "loyalty_tiers_name_key" ON "loyalty_tiers"("name");

-- CreateIndex
CREATE INDEX "loyalty_tiers_min_points_idx" ON "loyalty_tiers"("min_points");

-- CreateIndex
CREATE INDEX "loyalty_point_transactions_customer_id_idx" ON "loyalty_point_transactions"("customer_id");

-- CreateIndex
CREATE INDEX "loyalty_point_transactions_order_id_idx" ON "loyalty_point_transactions"("order_id");

-- AddForeignKey
ALTER TABLE "loyalty_point_transactions" ADD CONSTRAINT "loyalty_point_transactions_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
