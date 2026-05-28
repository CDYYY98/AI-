CREATE TABLE "RechargeCode" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "codeHash" TEXT NOT NULL,
  "codePrefix" TEXT NOT NULL,
  "codeSuffix" TEXT NOT NULL,
  "inspirationAmount" INTEGER NOT NULL,
  "quotaAmount" REAL NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'unused',
  "batchName" TEXT,
  "note" TEXT,
  "redeemedByUserId" TEXT,
  "redeemedAt" DATETIME,
  "createdByAdminId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RechargeCode_redeemedByUserId_fkey" FOREIGN KEY ("redeemedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "RechargeCode_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "CreditTransaction" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "inspirationDelta" INTEGER NOT NULL,
  "quotaDelta" REAL NOT NULL,
  "beforeQuota" REAL NOT NULL,
  "afterQuota" REAL NOT NULL,
  "referenceId" TEXT,
  "note" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CreditTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "RechargeCode_codeHash_key" ON "RechargeCode"("codeHash");
CREATE INDEX "RechargeCode_status_idx" ON "RechargeCode"("status");
CREATE INDEX "RechargeCode_batchName_idx" ON "RechargeCode"("batchName");
CREATE INDEX "RechargeCode_redeemedByUserId_idx" ON "RechargeCode"("redeemedByUserId");
CREATE INDEX "CreditTransaction_userId_createdAt_idx" ON "CreditTransaction"("userId", "createdAt");
CREATE INDEX "CreditTransaction_type_idx" ON "CreditTransaction"("type");
CREATE INDEX "CreditTransaction_referenceId_idx" ON "CreditTransaction"("referenceId");
