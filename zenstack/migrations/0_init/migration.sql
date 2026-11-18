-- CreateEnum
CREATE TYPE "ReleaseType" AS ENUM ('SWITCH', 'SWITCH2', 'PS4', 'PS5', 'XBOX');

-- CreateTable
CREATE TABLE "Release" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "type" "ReleaseType" NOT NULL,
    "releaseDate" TIMESTAMP(3) NOT NULL,
    "preOrderCloseDate" TIMESTAMP(3),
    "lastStockPercentage" INTEGER,
    "coverUrl" TEXT,
    "pricePence" INTEGER,
    "title" TEXT,
    "catalogue" TEXT,
    "edition" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "Release_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReleasePollSchedule" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nextPollAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "intervalMinutes" INTEGER NOT NULL DEFAULT 60,
    "lastPolledAt" TIMESTAMP(3),
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "releaseId" UUID NOT NULL,

    CONSTRAINT "ReleasePollSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockCheck" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "percentage" INTEGER NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releaseId" UUID NOT NULL,

    CONSTRAINT "StockCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "clientId" TEXT,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReleaseSubscription" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "thresholdPercentage" INTEGER NOT NULL,
    "notifiedAt" TIMESTAMP(3),
    "notifiedPercentage" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releaseId" UUID NOT NULL,
    "pushSubscriptionId" UUID NOT NULL,

    CONSTRAINT "ReleaseSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Release_key_key" ON "Release"("key");

-- CreateIndex
CREATE UNIQUE INDEX "ReleasePollSchedule_releaseId_key" ON "ReleasePollSchedule"("releaseId");

-- CreateIndex
CREATE INDEX "ReleasePollSchedule_nextPollAt_idx" ON "ReleasePollSchedule"("nextPollAt");

-- CreateIndex
CREATE INDEX "StockCheck_releaseId_checkedAt_idx" ON "StockCheck"("releaseId", "checkedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_clientId_key" ON "PushSubscription"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE UNIQUE INDEX "ReleaseSubscription_releaseId_pushSubscriptionId_key" ON "ReleaseSubscription"("releaseId", "pushSubscriptionId");

-- AddForeignKey
ALTER TABLE "ReleasePollSchedule" ADD CONSTRAINT "ReleasePollSchedule_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "Release"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockCheck" ADD CONSTRAINT "StockCheck_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "Release"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReleaseSubscription" ADD CONSTRAINT "ReleaseSubscription_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "Release"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReleaseSubscription" ADD CONSTRAINT "ReleaseSubscription_pushSubscriptionId_fkey" FOREIGN KEY ("pushSubscriptionId") REFERENCES "PushSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;
