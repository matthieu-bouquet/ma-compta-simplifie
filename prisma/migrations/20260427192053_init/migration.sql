-- CreateTable
CREATE TABLE "Association" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "siret" TEXT,
    "address" TEXT,
    "postalCode" TEXT,
    "city" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "GlobalChartAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "number" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "FiscalYear" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL,
    "associationId" TEXT NOT NULL,
    CONSTRAINT "FiscalYear_associationId_fkey" FOREIGN KEY ("associationId") REFERENCES "Association" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Journal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "number" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fiscalYearId" TEXT NOT NULL,
    CONSTRAINT "Account_fiscalYearId_fkey" FOREIGN KEY ("fiscalYearId") REFERENCES "FiscalYear" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Entry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "description" TEXT NOT NULL,
    "journalId" TEXT NOT NULL,
    "fiscalYearId" TEXT NOT NULL,
    "referenceNumber" TEXT,
    "referenceSequence" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Entry_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "Journal" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Entry_fiscalYearId_fkey" FOREIGN KEY ("fiscalYearId") REFERENCES "FiscalYear" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EntryLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entryId" TEXT NOT NULL,
    "accountId" TEXT,
    "accountNumber" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "debitCents" INTEGER NOT NULL DEFAULT 0,
    "creditCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EntryLine_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "Entry" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EntryLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "JournalSequence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fiscalYearId" TEXT NOT NULL,
    "journalId" TEXT NOT NULL,
    "nextNumber" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "associationId" TEXT,
    "fiscalYearId" TEXT,
    "actor" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "data" TEXT
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fiscalYearId" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "storedName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT,
    "relativePath" TEXT NOT NULL,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Document_fiscalYearId_fkey" FOREIGN KEY ("fiscalYearId") REFERENCES "FiscalYear" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DocumentEntryLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentId" TEXT NOT NULL,
    "entryLineId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DocumentEntryLine_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DocumentEntryLine_entryLineId_fkey" FOREIGN KEY ("entryLineId") REFERENCES "EntryLine" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Association_siret_key" ON "Association"("siret");

-- CreateIndex
CREATE UNIQUE INDEX "GlobalChartAccount_number_key" ON "GlobalChartAccount"("number");

-- CreateIndex
CREATE UNIQUE INDEX "FiscalYear_associationId_startDate_endDate_key" ON "FiscalYear"("associationId", "startDate", "endDate");

-- CreateIndex
CREATE UNIQUE INDEX "Journal_code_key" ON "Journal"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Account_number_fiscalYearId_key" ON "Account"("number", "fiscalYearId");

-- CreateIndex
CREATE INDEX "Entry_fiscalYearId_journalId_date_idx" ON "Entry"("fiscalYearId", "journalId", "date");

-- CreateIndex
CREATE INDEX "JournalSequence_fiscalYearId_idx" ON "JournalSequence"("fiscalYearId");

-- CreateIndex
CREATE UNIQUE INDEX "JournalSequence_fiscalYearId_journalId_key" ON "JournalSequence"("fiscalYearId", "journalId");

-- CreateIndex
CREATE INDEX "AuditEvent_associationId_createdAt_idx" ON "AuditEvent"("associationId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_fiscalYearId_createdAt_idx" ON "AuditEvent"("fiscalYearId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_entityType_entityId_idx" ON "AuditEvent"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "Document_fiscalYearId_uploadedAt_idx" ON "Document"("fiscalYearId", "uploadedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Document_fiscalYearId_storedName_key" ON "Document"("fiscalYearId", "storedName");

-- CreateIndex
CREATE INDEX "DocumentEntryLine_entryLineId_idx" ON "DocumentEntryLine"("entryLineId");

-- CreateIndex
CREATE INDEX "DocumentEntryLine_documentId_idx" ON "DocumentEntryLine"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentEntryLine_documentId_entryLineId_key" ON "DocumentEntryLine"("documentId", "entryLineId");
