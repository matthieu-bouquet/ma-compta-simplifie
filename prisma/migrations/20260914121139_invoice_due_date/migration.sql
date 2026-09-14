/*
  Warnings:

  - Added the required column `dueDate` to the `Invoice` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Invoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "associationId" TEXT NOT NULL,
    "fiscalYearId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "number" TEXT NOT NULL,
    "issueDate" DATETIME NOT NULL,
    "dueDate" DATETIME NOT NULL,
    "recipientName" TEXT NOT NULL,
    "recipientAddress" TEXT,
    "recipientPostalCode" TEXT,
    "recipientCity" TEXT,
    "recipientEmail" TEXT,
    "recipientSiret" TEXT,
    "counterpartyId" TEXT,
    "totalCents" INTEGER NOT NULL,
    "entryId" TEXT,
    "pdfDocumentId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Invoice_associationId_fkey" FOREIGN KEY ("associationId") REFERENCES "Association" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Invoice_fiscalYearId_fkey" FOREIGN KEY ("fiscalYearId") REFERENCES "FiscalYear" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Invoice_counterpartyId_fkey" FOREIGN KEY ("counterpartyId") REFERENCES "Counterparty" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Invoice" ("associationId", "counterpartyId", "createdAt", "dueDate", "entryId", "fiscalYearId", "id", "issueDate", "number", "pdfDocumentId", "recipientAddress", "recipientCity", "recipientEmail", "recipientName", "recipientPostalCode", "recipientSiret", "sequence", "totalCents", "updatedAt") SELECT "associationId", "counterpartyId", "createdAt", "issueDate", "entryId", "fiscalYearId", "id", "issueDate", "number", "pdfDocumentId", "recipientAddress", "recipientCity", "recipientEmail", "recipientName", "recipientPostalCode", "recipientSiret", "sequence", "totalCents", "updatedAt" FROM "Invoice";
DROP TABLE "Invoice";
ALTER TABLE "new_Invoice" RENAME TO "Invoice";
CREATE UNIQUE INDEX "Invoice_entryId_key" ON "Invoice"("entryId");
CREATE INDEX "Invoice_associationId_issueDate_idx" ON "Invoice"("associationId", "issueDate");
CREATE INDEX "Invoice_fiscalYearId_issueDate_idx" ON "Invoice"("fiscalYearId", "issueDate");
CREATE UNIQUE INDEX "Invoice_fiscalYearId_sequence_key" ON "Invoice"("fiscalYearId", "sequence");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
