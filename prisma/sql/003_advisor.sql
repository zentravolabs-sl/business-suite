-- CreateEnum
CREATE TYPE "AdvisorRunStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "AdvisorActionStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "AdvisorInsightStatus" AS ENUM ('OPEN', 'RESOLVED', 'DISMISSED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'ADVISOR_REPORT';
ALTER TYPE "NotificationType" ADD VALUE 'ADVISOR_INSIGHT';

-- CreateTable
CREATE TABLE "advisor_preferences" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "dailyReportEnabled" BOOLEAN NOT NULL DEFAULT true,
    "reportFrequency" TEXT NOT NULL DEFAULT 'DAILY',
    "weeklyDay" INTEGER NOT NULL DEFAULT 0,
    "deliveryTime" TEXT NOT NULL DEFAULT '18:00',
    "timezone" TEXT,
    "channels" TEXT[] DEFAULT ARRAY['IN_APP']::TEXT[],
    "emailRecipients" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "smsRecipients" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "whatsappRecipients" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "aiExplanationsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "chatRetentionDays" INTEGER NOT NULL DEFAULT 90,
    "thresholds" JSONB,
    "disabledRules" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "advisor_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "advisor_report_runs" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "reportDate" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'DAILY',
    "status" "AdvisorRunStatus" NOT NULL DEFAULT 'PENDING',
    "trigger" TEXT NOT NULL DEFAULT 'SCHEDULER',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "lockedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "nextRetryAt" TIMESTAMP(3),
    "lastError" TEXT,
    "attemptLog" JSONB,
    "reportId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "advisor_report_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "advisor_daily_reports" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "reportDate" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'DAILY',
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "timezone" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "dataStatus" TEXT NOT NULL DEFAULT 'COMPLETE',
    "data" JSONB NOT NULL,
    "aiNarrative" TEXT,
    "deliveries" JSONB,
    "generatedBy" TEXT NOT NULL DEFAULT 'SCHEDULER',
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "advisor_daily_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "advisor_insights" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "ruleKey" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "params" JSONB NOT NULL,
    "evidence" JSONB,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "impact" JSONB,
    "confidence" TEXT NOT NULL DEFAULT 'MEDIUM',
    "missingData" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "aiExplanation" TEXT,
    "status" "AdvisorInsightStatus" NOT NULL DEFAULT 'OPEN',
    "firstDetectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastDetectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "advisor_insights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "advisor_recommendations" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "insightId" TEXT,
    "ruleKey" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 2,
    "params" JSONB NOT NULL,
    "evidence" JSONB,
    "actionUrl" TEXT,
    "status" "AdvisorActionStatus" NOT NULL DEFAULT 'PENDING',
    "metricKey" TEXT,
    "baselineValue" DECIMAL(16,4),
    "baselineAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "statusChangedAt" TIMESTAMP(3),

    CONSTRAINT "advisor_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "advisor_action_history" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "recommendationId" TEXT NOT NULL,
    "fromStatus" "AdvisorActionStatus",
    "toStatus" "AdvisorActionStatus" NOT NULL,
    "note" TEXT,
    "userId" TEXT,
    "metricKey" TEXT,
    "metricValue" DECIMAL(16,4),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "advisor_action_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "advisor_goals" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "title" TEXT,
    "targetValue" DECIMAL(16,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startsOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsOn" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "advisor_goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "advisor_chat_messages" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "intent" TEXT,
    "usedAi" BOOLEAN NOT NULL DEFAULT false,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "advisor_chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "advisor_preferences_businessId_key" ON "advisor_preferences"("businessId");

-- CreateIndex
CREATE INDEX "advisor_report_runs_status_nextRetryAt_idx" ON "advisor_report_runs"("status", "nextRetryAt");

-- CreateIndex
CREATE INDEX "advisor_report_runs_businessId_createdAt_idx" ON "advisor_report_runs"("businessId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "advisor_report_runs_businessId_reportDate_kind_key" ON "advisor_report_runs"("businessId", "reportDate", "kind");

-- CreateIndex
CREATE INDEX "advisor_daily_reports_businessId_generatedAt_idx" ON "advisor_daily_reports"("businessId", "generatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "advisor_daily_reports_businessId_reportDate_kind_key" ON "advisor_daily_reports"("businessId", "reportDate", "kind");

-- CreateIndex
CREATE INDEX "advisor_insights_businessId_status_severity_idx" ON "advisor_insights"("businessId", "status", "severity");

-- CreateIndex
CREATE INDEX "advisor_insights_businessId_category_idx" ON "advisor_insights"("businessId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "advisor_insights_businessId_fingerprint_key" ON "advisor_insights"("businessId", "fingerprint");

-- CreateIndex
CREATE INDEX "advisor_recommendations_businessId_status_priority_idx" ON "advisor_recommendations"("businessId", "status", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "advisor_recommendations_businessId_fingerprint_key" ON "advisor_recommendations"("businessId", "fingerprint");

-- CreateIndex
CREATE INDEX "advisor_action_history_recommendationId_idx" ON "advisor_action_history"("recommendationId");

-- CreateIndex
CREATE INDEX "advisor_action_history_businessId_createdAt_idx" ON "advisor_action_history"("businessId", "createdAt");

-- CreateIndex
CREATE INDEX "advisor_goals_businessId_isActive_idx" ON "advisor_goals"("businessId", "isActive");

-- CreateIndex
CREATE INDEX "advisor_chat_messages_businessId_userId_createdAt_idx" ON "advisor_chat_messages"("businessId", "userId", "createdAt");

-- AddForeignKey
ALTER TABLE "advisor_action_history" ADD CONSTRAINT "advisor_action_history_recommendationId_fkey" FOREIGN KEY ("recommendationId") REFERENCES "advisor_recommendations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
