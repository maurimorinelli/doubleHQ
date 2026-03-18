import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1709700000000 implements MigrationInterface {
  name = 'InitialSchema1709700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "firms" (
        "id" varchar PRIMARY KEY,
        "name" varchar NOT NULL,
        "plan" varchar NOT NULL DEFAULT 'scale',
        "timezone" varchar NOT NULL DEFAULT 'America/New_York',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "team_members" (
        "id" varchar PRIMARY KEY,
        "firmId" varchar NOT NULL REFERENCES "firms"("id"),
        "name" varchar NOT NULL,
        "email" varchar NOT NULL,
        "role" varchar NOT NULL DEFAULT 'preparer',
        "avatarUrl" varchar NOT NULL DEFAULT '',
        "isActive" boolean NOT NULL DEFAULT true
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "clients" (
        "id" varchar PRIMARY KEY,
        "firmId" varchar NOT NULL REFERENCES "firms"("id"),
        "name" varchar NOT NULL,
        "industry" varchar NOT NULL,
        "contactName" varchar NOT NULL,
        "contactEmail" varchar NOT NULL,
        "contactPhone" varchar NOT NULL DEFAULT '',
        "qboConnected" boolean NOT NULL DEFAULT false,
        "xeroConnected" boolean NOT NULL DEFAULT false,
        "monthlyRevenue" decimal(12,2) NOT NULL DEFAULT 0,
        "preparerId" varchar NOT NULL REFERENCES "team_members"("id"),
        "reviewerId" varchar NOT NULL REFERENCES "team_members"("id"),
        "accountType" varchar NOT NULL DEFAULT 'accrual',
        "fiscalYearEnd" int NOT NULL DEFAULT 12,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "notes" text NOT NULL DEFAULT ''
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "close_periods" (
        "id" varchar PRIMARY KEY,
        "clientId" varchar NOT NULL REFERENCES "clients"("id"),
        "period" varchar NOT NULL,
        "status" varchar NOT NULL DEFAULT 'not_started',
        "startDate" date NOT NULL,
        "dueDate" date NOT NULL,
        "completedDate" date,
        "preparerId" varchar NOT NULL REFERENCES "team_members"("id"),
        "reviewerId" varchar NOT NULL REFERENCES "team_members"("id"),
        "totalTasks" int NOT NULL DEFAULT 0,
        "completedTasks" int NOT NULL DEFAULT 0,
        "blockedTasks" int NOT NULL DEFAULT 0,
        "healthScore" int NOT NULL DEFAULT 0,
        "healthStatus" varchar NOT NULL DEFAULT 'not_started',
        "previousCloseTime" int NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "close_tasks" (
        "id" varchar PRIMARY KEY,
        "closePeriodId" varchar NOT NULL REFERENCES "close_periods"("id"),
        "section" varchar NOT NULL,
        "sectionOrder" int NOT NULL DEFAULT 1,
        "title" varchar NOT NULL,
        "description" text NOT NULL DEFAULT '',
        "status" varchar NOT NULL DEFAULT 'not_started',
        "autoCompleteRule" varchar,
        "assigneeId" varchar NOT NULL REFERENCES "team_members"("id"),
        "dueDate" date NOT NULL,
        "completedDate" date,
        "blockedReason" text,
        "order" int NOT NULL DEFAULT 0,
        "targetTab" varchar NOT NULL DEFAULT 'overview',
        "estimatedMinutes" int NOT NULL DEFAULT 30,
        "actualMinutes" int
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "client_questions" (
        "id" varchar PRIMARY KEY,
        "closePeriodId" varchar NOT NULL REFERENCES "close_periods"("id"),
        "clientId" varchar NOT NULL REFERENCES "clients"("id"),
        "question" text NOT NULL,
        "category" varchar NOT NULL DEFAULT 'transaction_clarification',
        "transactionAmount" decimal(12,2) NOT NULL DEFAULT 0,
        "transactionDate" date NOT NULL,
        "transactionVendor" varchar NOT NULL DEFAULT '',
        "sentAt" TIMESTAMP NOT NULL,
        "respondedAt" TIMESTAMP,
        "response" text,
        "status" varchar NOT NULL DEFAULT 'pending',
        "remindersSent" int NOT NULL DEFAULT 0,
        "lastReminderAt" TIMESTAMP
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "transaction_flags" (
        "id" varchar PRIMARY KEY,
        "clientId" varchar NOT NULL REFERENCES "clients"("id"),
        "closePeriodId" varchar NOT NULL REFERENCES "close_periods"("id"),
        "type" varchar NOT NULL,
        "description" text NOT NULL,
        "amount" decimal(12,2) NOT NULL DEFAULT 0,
        "transactionDate" date NOT NULL,
        "vendor" varchar NOT NULL DEFAULT '',
        "accountCoded" varchar,
        "suggestedAccount" varchar,
        "isResolved" boolean NOT NULL DEFAULT false,
        "resolvedAt" TIMESTAMP,
        "resolvedBy" varchar,
        "flaggedAt" TIMESTAMP NOT NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "cached_insights" (
        "id" varchar PRIMARY KEY,
        "firmId" varchar NOT NULL,
        "insights" jsonb NOT NULL,
        "generatedAt" TIMESTAMP NOT NULL,
        "expiresAt" TIMESTAMP NOT NULL,
        "promptHash" varchar NOT NULL DEFAULT '',
        "model" varchar NOT NULL DEFAULT 'gpt-4',
        "tokenCount" int NOT NULL DEFAULT 0
      )
    `);

    // ─── New Tables ─────────────────────────────────────────────

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "imported_transactions" (
        "id" varchar PRIMARY KEY,
        "closePeriodId" varchar NOT NULL REFERENCES "close_periods"("id"),
        "clientId" varchar NOT NULL REFERENCES "clients"("id"),
        "date" date NOT NULL,
        "description" text NOT NULL DEFAULT '',
        "vendor" varchar NOT NULL DEFAULT '',
        "amount" decimal(12,2) NOT NULL DEFAULT 0,
        "type" varchar NOT NULL DEFAULT 'debit',
        "bankAccount" varchar NOT NULL DEFAULT 'checking',
        "importedCategory" varchar,
        "finalCategory" varchar,
        "status" varchar NOT NULL DEFAULT 'uncategorized',
        "aiSuggestedCategory" varchar,
        "aiConfidence" decimal(4,2),
        "reviewedBy" varchar,
        "reviewedAt" TIMESTAMP,
        "isManual" boolean NOT NULL DEFAULT false
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "reconciliations" (
        "id" varchar PRIMARY KEY,
        "closePeriodId" varchar NOT NULL REFERENCES "close_periods"("id"),
        "accountName" varchar NOT NULL,
        "accountNumber" varchar NOT NULL DEFAULT '',
        "bookBalance" decimal(12,2) NOT NULL DEFAULT 0,
        "bankBalance" decimal(12,2),
        "difference" decimal(12,2) NOT NULL DEFAULT 0,
        "status" varchar NOT NULL DEFAULT 'not_started',
        "reconciledBy" varchar,
        "reconciledAt" TIMESTAMP,
        "notes" text
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "journal_entries" (
        "id" varchar PRIMARY KEY,
        "closePeriodId" varchar NOT NULL REFERENCES "close_periods"("id"),
        "date" date NOT NULL,
        "memo" text NOT NULL DEFAULT '',
        "type" varchar NOT NULL DEFAULT 'adjustment',
        "status" varchar NOT NULL DEFAULT 'draft',
        "createdBy" varchar NOT NULL REFERENCES "team_members"("id"),
        "postedAt" TIMESTAMP
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "journal_entry_lines" (
        "id" varchar PRIMARY KEY,
        "journalEntryId" varchar NOT NULL REFERENCES "journal_entries"("id"),
        "accountName" varchar NOT NULL,
        "debit" decimal(12,2),
        "credit" decimal(12,2),
        "description" text
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "close_templates" (
        "id" varchar PRIMARY KEY,
        "firmId" varchar NOT NULL REFERENCES "firms"("id"),
        "name" varchar NOT NULL,
        "isDefault" boolean NOT NULL DEFAULT false
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "template_sections" (
        "id" varchar PRIMARY KEY,
        "templateId" varchar NOT NULL REFERENCES "close_templates"("id"),
        "name" varchar NOT NULL,
        "order" int NOT NULL DEFAULT 0
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "template_tasks" (
        "id" varchar PRIMARY KEY,
        "sectionId" varchar NOT NULL REFERENCES "template_sections"("id"),
        "title" varchar NOT NULL,
        "description" text NOT NULL DEFAULT '',
        "estimatedMinutes" int NOT NULL DEFAULT 30,
        "order" int NOT NULL DEFAULT 0,
        "autoCompleteRule" varchar
      )
    `);

    // Indexes
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_close_periods_client" ON "close_periods"("clientId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_close_periods_period" ON "close_periods"("period")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_close_tasks_period" ON "close_tasks"("closePeriodId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_client_questions_period" ON "client_questions"("closePeriodId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_transaction_flags_period" ON "transaction_flags"("closePeriodId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_imported_txns_period" ON "imported_transactions"("closePeriodId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_reconciliations_period" ON "reconciliations"("closePeriodId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_journal_entries_period" ON "journal_entries"("closePeriodId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_journal_lines_entry" ON "journal_entry_lines"("journalEntryId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "template_tasks"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "template_sections"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "close_templates"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "journal_entry_lines"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "journal_entries"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "reconciliations"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "imported_transactions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "cached_insights"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "transaction_flags"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "client_questions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "close_tasks"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "close_periods"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "clients"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "team_members"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "firms"`);
  }
}
