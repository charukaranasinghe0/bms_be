-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT');

-- CreateEnum
CREATE TYPE "PromotionScope" AS ENUM ('ORDER', 'PRODUCT', 'CATEGORY');

-- CreateTable
CREATE TABLE "Promotion" (
    "id"            TEXT NOT NULL,
    "name"          TEXT NOT NULL,
    "description"   TEXT,
    "discountType"  "DiscountType" NOT NULL,
    "discountValue" DOUBLE PRECISION NOT NULL,
    "scope"         "PromotionScope" NOT NULL DEFAULT 'ORDER',
    "productIds"    TEXT[] DEFAULT ARRAY[]::TEXT[],
    "category"      TEXT,
    "startsAt"      TIMESTAMP(3) NOT NULL,
    "endsAt"        TIMESTAMP(3) NOT NULL,
    "isActive"      BOOLEAN NOT NULL DEFAULT true,
    "minOrderAmount" DOUBLE PRECISION,
    "createdBy"     TEXT,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Promotion_pkey" PRIMARY KEY ("id")
);
