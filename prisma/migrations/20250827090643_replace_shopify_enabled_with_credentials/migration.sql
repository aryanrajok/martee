/*
  Warnings:

  - You are about to drop the column `shopifyEnabled` on the `merchants` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."merchants" DROP COLUMN "shopifyEnabled",
ADD COLUMN     "shopifyAccessToken" TEXT,
ADD COLUMN     "shopifyShopDomain" TEXT;
