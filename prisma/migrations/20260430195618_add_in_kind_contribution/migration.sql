-- CreateTable
CREATE TABLE "InKindContribution" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "associationId" TEXT NOT NULL,
    "fiscalYearId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "description" TEXT NOT NULL,
    "contributorName" TEXT,
    "quantityMilliUnits" INTEGER NOT NULL,
    "unit" TEXT NOT NULL,
    "unitValueCents" INTEGER,
    "totalValueCents" INTEGER NOT NULL,
    "valuationMethod" TEXT NOT NULL,
    "meetsAnc2112Essential" BOOLEAN NOT NULL,
    "meetsAnc2112Measurable" BOOLEAN NOT NULL,
    "isRecorded" BOOLEAN NOT NULL,
    "entryId" TEXT,
    "documentId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InKindContribution_fiscalYearId_fkey" FOREIGN KEY ("fiscalYearId") REFERENCES "FiscalYear" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InKindContribution_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "InKindContribution_associationId_fiscalYearId_kind_date_idx" ON "InKindContribution"("associationId", "fiscalYearId", "kind", "date");

-- CreateIndex
CREATE INDEX "InKindContribution_fiscalYearId_date_idx" ON "InKindContribution"("fiscalYearId", "date");

-- CreateIndex
CREATE INDEX "InKindContribution_entryId_idx" ON "InKindContribution"("entryId");

-- CreateIndex
CREATE INDEX "InKindContribution_documentId_idx" ON "InKindContribution"("documentId");
