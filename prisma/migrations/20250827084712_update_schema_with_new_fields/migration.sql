/*
  Warnings:

  - You are about to drop the column `merchantId` on the `orders` table. All the data in the column will be lost.
  - You are about to drop the `Merchant` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Product` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `order_items` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `payments` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `merchantName` to the `orders` table without a default value. This is not possible if the table is not empty.
  - Added the required column `productName` to the `orders` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."OrderType" AS ENUM ('DIRECT', 'SHOPIFY', 'WOOCOMMERCE');

-- AlterEnum
ALTER TYPE "public"."OrderStatus" ADD VALUE 'EXPIRED';

-- DropForeignKey
ALTER TABLE "public"."order_items" DROP CONSTRAINT "order_items_orderId_fkey";

-- DropForeignKey
ALTER TABLE "public"."order_items" DROP CONSTRAINT "order_items_productId_fkey";

-- DropForeignKey
ALTER TABLE "public"."orders" DROP CONSTRAINT "orders_merchantId_fkey";

-- DropForeignKey
ALTER TABLE "public"."payments" DROP CONSTRAINT "payments_orderId_fkey";

-- AlterTable
ALTER TABLE "public"."orders" DROP COLUMN "merchantId",
ADD COLUMN     "adminGraphqlApiId" TEXT,
ADD COLUMN     "approveHash" TEXT,
ADD COLUMN     "blockNumber" INTEGER,
ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "fromAddress" TEXT,
ADD COLUMN     "gasUsed" TEXT,
ADD COLUMN     "merchantName" TEXT NOT NULL,
ADD COLUMN     "merchantWallet" TEXT,
ADD COLUMN     "orderConfirmation" TEXT,
ADD COLUMN     "productName" TEXT NOT NULL,
ADD COLUMN     "refundTransferHash" TEXT,
ADD COLUMN     "refundedAt" TIMESTAMP(3),
ADD COLUMN     "shopDomain" TEXT,
ADD COLUMN     "toAddress" TEXT,
ADD COLUMN     "tokenAddress" TEXT,
ADD COLUMN     "transferHash" TEXT,
ADD COLUMN     "type" "public"."OrderType" NOT NULL DEFAULT 'DIRECT';

-- DropTable
DROP TABLE "public"."Merchant";

-- DropTable
DROP TABLE "public"."Product";

-- DropTable
DROP TABLE "public"."order_items";

-- DropTable
DROP TABLE "public"."payments";

-- DropEnum
DROP TYPE "public"."PaymentStatus";

-- CreateTable
CREATE TABLE "public"."merchants" (
    "id" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Unnamed Merchant',
    "email" TEXT,
    "apiKey" CHAR(16) NOT NULL,
    "wooCommerceEnabled" BOOLEAN NOT NULL DEFAULT false,
    "wooCommerceSiteURL" TEXT,
    "shopifyEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "merchants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "merchants_walletAddress_key" ON "public"."merchants"("walletAddress");

-- CreateIndex
CREATE UNIQUE INDEX "merchants_apiKey_key" ON "public"."merchants"("apiKey");
