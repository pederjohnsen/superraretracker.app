-- AlterTable
ALTER TABLE "Release" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'GBP',
ADD COLUMN     "publisher" TEXT NOT NULL DEFAULT 'super-rare-games';
