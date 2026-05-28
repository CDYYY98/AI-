CREATE TABLE "RechargeCode" (
  "id" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "codePrefix" TEXT NOT NULL,
  "codeSuffix" TEXT NOT NULL,
  "inspirationAmount" INTEGER NOT NULL,
  "quotaAmount" DOUBLE PRECISION NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'unused',
  "batchName" TEXT,
  "note" TEXT,
  "redeemedByUserId" TEXT,
  "redeemedAt" TIMESTAMP(3),
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "RechargeCode_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CreditTransaction" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "inspirationDelta" INTEGER NOT NULL,
  "quotaDelta" DOUBLE PRECISION NOT NULL,
  "beforeQuota" DOUBLE PRECISION NOT NULL,
  "afterQuota" DOUBLE PRECISION NOT NULL,
  "referenceId" TEXT,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CreditTransaction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RechargeCode_codeHash_key" ON "RechargeCode"("codeHash");
CREATE INDEX "RechargeCode_status_idx" ON "RechargeCode"("status");
CREATE INDEX "RechargeCode_batchName_idx" ON "RechargeCode"("batchName");
CREATE INDEX "RechargeCode_redeemedByUserId_idx" ON "RechargeCode"("redeemedByUserId");
CREATE INDEX "CreditTransaction_userId_createdAt_idx" ON "CreditTransaction"("userId", "createdAt");
CREATE INDEX "CreditTransaction_type_idx" ON "CreditTransaction"("type");
CREATE INDEX "CreditTransaction_referenceId_idx" ON "CreditTransaction"("referenceId");

ALTER TABLE "RechargeCode" ADD CONSTRAINT "RechargeCode_redeemedByUserId_fkey" FOREIGN KEY ("redeemedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RechargeCode" ADD CONSTRAINT "RechargeCode_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CreditTransaction" ADD CONSTRAINT "CreditTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
