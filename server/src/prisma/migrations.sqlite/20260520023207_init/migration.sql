-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'user',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "apiToken" TEXT,
    "apiTokenName" TEXT,
    "apiQuota" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_DirectorRuntimeCommand" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runtimeId" TEXT NOT NULL,
    "workflowTaskId" TEXT,
    "novelId" TEXT,
    "legacyCommandId" TEXT,
    "commandType" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "priority" INTEGER NOT NULL DEFAULT 50,
    "runAfter" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseOwner" TEXT,
    "leaseExpiresAt" DATETIME,
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "payloadJson" TEXT,
    "errorMessage" TEXT,
    "startedAt" DATETIME,
    "finishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DirectorRuntimeCommand_runtimeId_fkey" FOREIGN KEY ("runtimeId") REFERENCES "DirectorRuntimeInstance" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_DirectorRuntimeCommand" ("attempt", "commandType", "createdAt", "errorMessage", "finishedAt", "id", "idempotencyKey", "leaseExpiresAt", "leaseOwner", "legacyCommandId", "novelId", "payloadJson", "priority", "runAfter", "runtimeId", "startedAt", "status", "updatedAt", "workflowTaskId") SELECT "attempt", "commandType", "createdAt", "errorMessage", "finishedAt", "id", "idempotencyKey", "leaseExpiresAt", "leaseOwner", "legacyCommandId", "novelId", "payloadJson", "priority", "runAfter", "runtimeId", "startedAt", "status", "updatedAt", "workflowTaskId" FROM "DirectorRuntimeCommand";
DROP TABLE "DirectorRuntimeCommand";
ALTER TABLE "new_DirectorRuntimeCommand" RENAME TO "DirectorRuntimeCommand";
CREATE UNIQUE INDEX "DirectorRuntimeCommand_legacyCommandId_key" ON "DirectorRuntimeCommand"("legacyCommandId");
CREATE INDEX "DirectorRuntimeCommand_runtimeId_status_updatedAt_idx" ON "DirectorRuntimeCommand"("runtimeId", "status", "updatedAt");
CREATE INDEX "DirectorRuntimeCommand_status_priority_runAfter_createdAt_idx" ON "DirectorRuntimeCommand"("status", "priority", "runAfter", "createdAt");
CREATE INDEX "DirectorRuntimeCommand_workflowTaskId_status_updatedAt_idx" ON "DirectorRuntimeCommand"("workflowTaskId", "status", "updatedAt");
CREATE INDEX "DirectorRuntimeCommand_novelId_status_updatedAt_idx" ON "DirectorRuntimeCommand"("novelId", "status", "updatedAt");
CREATE INDEX "DirectorRuntimeCommand_leaseOwner_leaseExpiresAt_idx" ON "DirectorRuntimeCommand"("leaseOwner", "leaseExpiresAt");
CREATE UNIQUE INDEX "DirectorRuntimeCommand_runtimeId_commandType_idempotencyKey_key" ON "DirectorRuntimeCommand"("runtimeId", "commandType", "idempotencyKey");
CREATE TABLE "new_DirectorRuntimeEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runtimeId" TEXT NOT NULL,
    "commandId" TEXT,
    "executionId" TEXT,
    "workflowTaskId" TEXT,
    "novelId" TEXT,
    "type" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "severity" TEXT,
    "metadataJson" TEXT,
    "occurredAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DirectorRuntimeEvent_runtimeId_fkey" FOREIGN KEY ("runtimeId") REFERENCES "DirectorRuntimeInstance" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DirectorRuntimeEvent_commandId_fkey" FOREIGN KEY ("commandId") REFERENCES "DirectorRuntimeCommand" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "DirectorRuntimeEvent_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "DirectorRuntimeExecution" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_DirectorRuntimeEvent" ("commandId", "createdAt", "executionId", "id", "metadataJson", "novelId", "occurredAt", "runtimeId", "severity", "summary", "type", "workflowTaskId") SELECT "commandId", "createdAt", "executionId", "id", "metadataJson", "novelId", "occurredAt", "runtimeId", "severity", "summary", "type", "workflowTaskId" FROM "DirectorRuntimeEvent";
DROP TABLE "DirectorRuntimeEvent";
ALTER TABLE "new_DirectorRuntimeEvent" RENAME TO "DirectorRuntimeEvent";
CREATE INDEX "DirectorRuntimeEvent_runtimeId_occurredAt_idx" ON "DirectorRuntimeEvent"("runtimeId", "occurredAt");
CREATE INDEX "DirectorRuntimeEvent_commandId_occurredAt_idx" ON "DirectorRuntimeEvent"("commandId", "occurredAt");
CREATE INDEX "DirectorRuntimeEvent_executionId_occurredAt_idx" ON "DirectorRuntimeEvent"("executionId", "occurredAt");
CREATE INDEX "DirectorRuntimeEvent_workflowTaskId_occurredAt_idx" ON "DirectorRuntimeEvent"("workflowTaskId", "occurredAt");
CREATE INDEX "DirectorRuntimeEvent_novelId_occurredAt_idx" ON "DirectorRuntimeEvent"("novelId", "occurredAt");
CREATE INDEX "DirectorRuntimeEvent_type_occurredAt_idx" ON "DirectorRuntimeEvent"("type", "occurredAt");
CREATE TABLE "new_DirectorRuntimeExecution" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runtimeId" TEXT NOT NULL,
    "commandId" TEXT,
    "workflowTaskId" TEXT,
    "novelId" TEXT,
    "legacyCommandId" TEXT,
    "activeLockKey" TEXT,
    "workerId" TEXT,
    "slotId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'leased',
    "stepType" TEXT NOT NULL,
    "resourceClass" TEXT,
    "leaseExpiresAt" DATETIME,
    "heartbeatAt" DATETIME,
    "startedAt" DATETIME,
    "finishedAt" DATETIME,
    "errorClass" TEXT,
    "errorMessage" TEXT,
    "inputHash" TEXT,
    "checkpointVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DirectorRuntimeExecution_runtimeId_fkey" FOREIGN KEY ("runtimeId") REFERENCES "DirectorRuntimeInstance" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DirectorRuntimeExecution_commandId_fkey" FOREIGN KEY ("commandId") REFERENCES "DirectorRuntimeCommand" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_DirectorRuntimeExecution" ("activeLockKey", "checkpointVersion", "commandId", "createdAt", "errorClass", "errorMessage", "finishedAt", "heartbeatAt", "id", "inputHash", "leaseExpiresAt", "legacyCommandId", "novelId", "resourceClass", "runtimeId", "slotId", "startedAt", "status", "stepType", "updatedAt", "workerId", "workflowTaskId") SELECT "activeLockKey", "checkpointVersion", "commandId", "createdAt", "errorClass", "errorMessage", "finishedAt", "heartbeatAt", "id", "inputHash", "leaseExpiresAt", "legacyCommandId", "novelId", "resourceClass", "runtimeId", "slotId", "startedAt", "status", "stepType", "updatedAt", "workerId", "workflowTaskId" FROM "DirectorRuntimeExecution";
DROP TABLE "DirectorRuntimeExecution";
ALTER TABLE "new_DirectorRuntimeExecution" RENAME TO "DirectorRuntimeExecution";
CREATE UNIQUE INDEX "DirectorRuntimeExecution_activeLockKey_key" ON "DirectorRuntimeExecution"("activeLockKey");
CREATE INDEX "DirectorRuntimeExecution_runtimeId_status_updatedAt_idx" ON "DirectorRuntimeExecution"("runtimeId", "status", "updatedAt");
CREATE INDEX "DirectorRuntimeExecution_status_leaseExpiresAt_idx" ON "DirectorRuntimeExecution"("status", "leaseExpiresAt");
CREATE INDEX "DirectorRuntimeExecution_workflowTaskId_status_updatedAt_idx" ON "DirectorRuntimeExecution"("workflowTaskId", "status", "updatedAt");
CREATE INDEX "DirectorRuntimeExecution_novelId_status_updatedAt_idx" ON "DirectorRuntimeExecution"("novelId", "status", "updatedAt");
CREATE INDEX "DirectorRuntimeExecution_workerId_status_updatedAt_idx" ON "DirectorRuntimeExecution"("workerId", "status", "updatedAt");
CREATE TABLE "new_DirectorRuntimeInstance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "novelId" TEXT,
    "workflowTaskId" TEXT,
    "runId" TEXT,
    "runMode" TEXT,
    "status" TEXT NOT NULL DEFAULT 'waiting_worker',
    "currentStep" TEXT,
    "currentChapterId" TEXT,
    "checkpointVersion" INTEGER NOT NULL DEFAULT 0,
    "cancelRequestedAt" DATETIME,
    "lastHeartbeatAt" DATETIME,
    "lastErrorClass" TEXT,
    "lastErrorMessage" TEXT,
    "workerMessage" TEXT,
    "metadataJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_DirectorRuntimeInstance" ("cancelRequestedAt", "checkpointVersion", "createdAt", "currentChapterId", "currentStep", "id", "lastErrorClass", "lastErrorMessage", "lastHeartbeatAt", "metadataJson", "novelId", "runId", "runMode", "status", "updatedAt", "workerMessage", "workflowTaskId") SELECT "cancelRequestedAt", "checkpointVersion", "createdAt", "currentChapterId", "currentStep", "id", "lastErrorClass", "lastErrorMessage", "lastHeartbeatAt", "metadataJson", "novelId", "runId", "runMode", "status", "updatedAt", "workerMessage", "workflowTaskId" FROM "DirectorRuntimeInstance";
DROP TABLE "DirectorRuntimeInstance";
ALTER TABLE "new_DirectorRuntimeInstance" RENAME TO "DirectorRuntimeInstance";
CREATE INDEX "DirectorRuntimeInstance_novelId_status_updatedAt_idx" ON "DirectorRuntimeInstance"("novelId", "status", "updatedAt");
CREATE INDEX "DirectorRuntimeInstance_workflowTaskId_idx" ON "DirectorRuntimeInstance"("workflowTaskId");
CREATE INDEX "DirectorRuntimeInstance_runId_idx" ON "DirectorRuntimeInstance"("runId");
CREATE INDEX "DirectorRuntimeInstance_status_updatedAt_idx" ON "DirectorRuntimeInstance"("status", "updatedAt");
CREATE TABLE "new_Novel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "userId" TEXT,
    "description" TEXT,
    "targetAudience" TEXT,
    "bookSellingPoint" TEXT,
    "competingFeel" TEXT,
    "first30ChapterPromise" TEXT,
    "commercialTagsJson" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "writingMode" TEXT NOT NULL DEFAULT 'original',
    "projectMode" TEXT,
    "narrativePov" TEXT,
    "pacePreference" TEXT,
    "styleTone" TEXT,
    "emotionIntensity" TEXT,
    "aiFreedom" TEXT,
    "postGenerationStyleReviewEnabled" BOOLEAN NOT NULL DEFAULT true,
    "defaultChapterLength" INTEGER,
    "estimatedChapterCount" INTEGER,
    "projectStatus" TEXT DEFAULT 'not_started',
    "storylineStatus" TEXT DEFAULT 'not_started',
    "outlineStatus" TEXT DEFAULT 'not_started',
    "resourceReadyScore" INTEGER,
    "sourceNovelId" TEXT,
    "sourceKnowledgeDocumentId" TEXT,
    "continuationBookAnalysisId" TEXT,
    "continuationBookAnalysisSections" TEXT,
    "outline" TEXT,
    "structuredOutline" TEXT,
    "storyWorldSliceJson" TEXT,
    "storyWorldSliceOverridesJson" TEXT,
    "storyWorldSliceSchemaVersion" INTEGER NOT NULL DEFAULT 1,
    "genreId" TEXT,
    "primaryStoryModeId" TEXT,
    "secondaryStoryModeId" TEXT,
    "worldId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Novel_genreId_fkey" FOREIGN KEY ("genreId") REFERENCES "NovelGenre" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Novel_primaryStoryModeId_fkey" FOREIGN KEY ("primaryStoryModeId") REFERENCES "NovelStoryMode" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Novel_secondaryStoryModeId_fkey" FOREIGN KEY ("secondaryStoryModeId") REFERENCES "NovelStoryMode" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Novel_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "World" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Novel_sourceNovelId_fkey" FOREIGN KEY ("sourceNovelId") REFERENCES "Novel" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Novel_sourceKnowledgeDocumentId_fkey" FOREIGN KEY ("sourceKnowledgeDocumentId") REFERENCES "KnowledgeDocument" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Novel_continuationBookAnalysisId_fkey" FOREIGN KEY ("continuationBookAnalysisId") REFERENCES "BookAnalysis" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Novel" ("aiFreedom", "bookSellingPoint", "commercialTagsJson", "competingFeel", "continuationBookAnalysisId", "continuationBookAnalysisSections", "createdAt", "defaultChapterLength", "description", "emotionIntensity", "estimatedChapterCount", "first30ChapterPromise", "genreId", "id", "narrativePov", "outline", "outlineStatus", "pacePreference", "postGenerationStyleReviewEnabled", "primaryStoryModeId", "projectMode", "projectStatus", "resourceReadyScore", "secondaryStoryModeId", "sourceKnowledgeDocumentId", "sourceNovelId", "status", "storyWorldSliceJson", "storyWorldSliceOverridesJson", "storyWorldSliceSchemaVersion", "storylineStatus", "structuredOutline", "styleTone", "targetAudience", "title", "updatedAt", "worldId", "writingMode") SELECT "aiFreedom", "bookSellingPoint", "commercialTagsJson", "competingFeel", "continuationBookAnalysisId", "continuationBookAnalysisSections", "createdAt", "defaultChapterLength", "description", "emotionIntensity", "estimatedChapterCount", "first30ChapterPromise", "genreId", "id", "narrativePov", "outline", "outlineStatus", "pacePreference", "postGenerationStyleReviewEnabled", "primaryStoryModeId", "projectMode", "projectStatus", "resourceReadyScore", "secondaryStoryModeId", "sourceKnowledgeDocumentId", "sourceNovelId", "status", "storyWorldSliceJson", "storyWorldSliceOverridesJson", "storyWorldSliceSchemaVersion", "storylineStatus", "structuredOutline", "styleTone", "targetAudience", "title", "updatedAt", "worldId", "writingMode" FROM "Novel";
DROP TABLE "Novel";
ALTER TABLE "new_Novel" RENAME TO "Novel";
CREATE INDEX "Novel_genreId_idx" ON "Novel"("genreId");
CREATE INDEX "Novel_primaryStoryModeId_idx" ON "Novel"("primaryStoryModeId");
CREATE INDEX "Novel_secondaryStoryModeId_idx" ON "Novel"("secondaryStoryModeId");
CREATE INDEX "Novel_worldId_idx" ON "Novel"("worldId");
CREATE INDEX "Novel_writingMode_idx" ON "Novel"("writingMode");
CREATE INDEX "Novel_sourceNovelId_idx" ON "Novel"("sourceNovelId");
CREATE INDEX "Novel_sourceKnowledgeDocumentId_idx" ON "Novel"("sourceKnowledgeDocumentId");
CREATE INDEX "Novel_continuationBookAnalysisId_idx" ON "Novel"("continuationBookAnalysisId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
