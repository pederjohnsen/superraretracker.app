-- CreateEnum
CREATE TYPE "AlertKind" AS ENUM ('STOCK', 'RESTOCK');

-- CreateTable
CREATE TABLE "Alert" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "kind" "AlertKind" NOT NULL,
    "percentage" INTEGER NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "seenAt" TIMESTAMP(3),
    "releaseId" UUID NOT NULL,
    "pushSubscriptionId" UUID NOT NULL,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Alert_pushSubscriptionId_seenAt_idx" ON "Alert"("pushSubscriptionId", "seenAt");

-- CreateIndex
CREATE INDEX "Alert_sentAt_idx" ON "Alert"("sentAt");

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "Release"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_pushSubscriptionId_fkey" FOREIGN KEY ("pushSubscriptionId") REFERENCES "PushSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;
