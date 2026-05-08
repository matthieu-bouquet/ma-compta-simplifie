-- Add chart templates and scope associations to a template.
-- Data migration: move existing GlobalChartAccount rows into the default ASSOCIATION template.

PRAGMA foreign_keys=OFF;

-- 1) Create templates tables
CREATE TABLE IF NOT EXISTS "ChartTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "ChartTemplate_code_key" ON "ChartTemplate"("code");

CREATE TABLE IF NOT EXISTS "ChartTemplateAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "chartTemplateId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ChartTemplateAccount_chartTemplateId_fkey" FOREIGN KEY ("chartTemplateId") REFERENCES "ChartTemplate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "ChartTemplateAccount_chartTemplateId_number_key"
  ON "ChartTemplateAccount"("chartTemplateId", "number");

CREATE INDEX IF NOT EXISTS "ChartTemplateAccount_chartTemplateId_number_idx"
  ON "ChartTemplateAccount"("chartTemplateId", "number");

-- 2) Seed default templates (deterministic ids)
INSERT OR IGNORE INTO "ChartTemplate" ("id", "code", "name", "createdAt", "updatedAt")
VALUES
  ('00000000-0000-0000-0000-000000000001', 'ASSOCIATION', 'Association (modèle)', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('00000000-0000-0000-0000-000000000002', 'TPE', 'Entreprise / TPE (modèle)', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- 3) Add Association.chartTemplateId (via table redefine to keep SQLite happy)
CREATE TABLE "new_Association" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "siret" TEXT,
    "address" TEXT,
    "postalCode" TEXT,
    "city" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "legalFormCode" TEXT,
    "legalFormOther" TEXT,
    "chartTemplateId" TEXT,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Association_chartTemplateId_fkey" FOREIGN KEY ("chartTemplateId") REFERENCES "ChartTemplate" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_Association" (
  "id",
  "name",
  "siret",
  "address",
  "postalCode",
  "city",
  "email",
  "phone",
  "legalFormCode",
  "legalFormOther",
  "chartTemplateId",
  "isClosed",
  "createdAt",
  "updatedAt"
)
SELECT
  "id",
  "name",
  "siret",
  "address",
  "postalCode",
  "city",
  "email",
  "phone",
  "legalFormCode",
  "legalFormOther",
  CASE
    WHEN "legalFormCode" = 'ASSOCIATION' THEN '00000000-0000-0000-0000-000000000001'
    WHEN "legalFormCode" IS NULL THEN '00000000-0000-0000-0000-000000000001'
    ELSE '00000000-0000-0000-0000-000000000002'
  END,
  "isClosed",
  "createdAt",
  "updatedAt"
FROM "Association";

DROP TABLE "Association";
ALTER TABLE "new_Association" RENAME TO "Association";
CREATE UNIQUE INDEX "Association_siret_key" ON "Association"("siret");

-- 4) Migrate GlobalChartAccount -> ChartTemplateAccount (ASSOCIATION template)
INSERT OR IGNORE INTO "ChartTemplateAccount" ("id", "chartTemplateId", "number", "name", "createdAt", "updatedAt")
SELECT
  lower(hex(randomblob(16))) AS "id",
  '00000000-0000-0000-0000-000000000001' AS "chartTemplateId",
  "number",
  "name",
  "createdAt",
  "updatedAt"
FROM "GlobalChartAccount";

-- 5) Drop legacy global chart table
DROP INDEX IF EXISTS "GlobalChartAccount_number_key";
DROP TABLE IF EXISTS "GlobalChartAccount";

PRAGMA foreign_keys=ON;

