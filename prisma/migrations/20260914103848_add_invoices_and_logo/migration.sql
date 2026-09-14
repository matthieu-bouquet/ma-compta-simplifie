-- AlterTable
ALTER TABLE "Association" ADD COLUMN "logoMimeType" TEXT;
ALTER TABLE "Association" ADD COLUMN "logoRelativePath" TEXT;
ALTER TABLE "Association" ADD COLUMN "logoSizeBytes" INTEGER;

-- CreateTable
CREATE TABLE "InvoiceSequence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fiscalYearId" TEXT NOT NULL,
    "nextNumber" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InvoiceSequence_fiscalYearId_fkey" FOREIGN KEY ("fiscalYearId") REFERENCES "FiscalYear" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "associationId" TEXT NOT NULL,
    "fiscalYearId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "number" TEXT NOT NULL,
    "issueDate" DATETIME NOT NULL,
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

-- CreateTable
CREATE TABLE "InvoiceLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoiceId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "quantityMilliUnits" INTEGER,
    "unitPriceCents" INTEGER,
    "amountCents" INTEGER NOT NULL,
    "accountId" TEXT,
    "accountNumber" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceSequence_fiscalYearId_key" ON "InvoiceSequence"("fiscalYearId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_entryId_key" ON "Invoice"("entryId");

-- CreateIndex
CREATE INDEX "Invoice_associationId_issueDate_idx" ON "Invoice"("associationId", "issueDate");

-- CreateIndex
CREATE INDEX "Invoice_fiscalYearId_issueDate_idx" ON "Invoice"("fiscalYearId", "issueDate");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_fiscalYearId_sequence_key" ON "Invoice"("fiscalYearId", "sequence");

-- CreateIndex
CREATE INDEX "InvoiceLine_invoiceId_sortOrder_idx" ON "InvoiceLine"("invoiceId", "sortOrder");
