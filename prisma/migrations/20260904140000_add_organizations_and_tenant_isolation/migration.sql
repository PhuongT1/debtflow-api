-- Introduce explicit SaaS tenant ownership before constraining business data.
CREATE TYPE "SystemRole" AS ENUM ('USER', 'PLATFORM_OWNER', 'PLATFORM_SUPPORT');
CREATE TYPE "OrganizationKind" AS ENUM ('PERSONAL', 'BUSINESS');
CREATE TYPE "OrganizationStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'CLOSED');
CREATE TYPE "OrganizationRole" AS ENUM ('OWNER', 'ADMIN', 'ACCOUNTANT', 'VIEWER');
CREATE TYPE "OrganizationMembershipStatus" AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED');

CREATE TABLE "Organization" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "kind" "OrganizationKind" NOT NULL,
  "status" "OrganizationStatus" NOT NULL DEFAULT 'ACTIVE',
  "taxCode" TEXT,
  "address" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");
CREATE INDEX "Organization_status_idx" ON "Organization"("status");
CREATE INDEX "Organization_kind_idx" ON "Organization"("kind");

CREATE TABLE "OrganizationMembership" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "OrganizationRole" NOT NULL DEFAULT 'VIEWER',
  "status" "OrganizationMembershipStatus" NOT NULL DEFAULT 'INVITED',
  "invitedAt" TIMESTAMP(3),
  "joinedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrganizationMembership_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OrganizationMembership_organizationId_userId_key" ON "OrganizationMembership"("organizationId", "userId");
CREATE INDEX "OrganizationMembership_userId_status_idx" ON "OrganizationMembership"("userId", "status");
CREATE INDEX "OrganizationMembership_organizationId_role_status_idx" ON "OrganizationMembership"("organizationId", "role", "status");

ALTER TABLE "User" ADD COLUMN "systemRole" "SystemRole" NOT NULL DEFAULT 'USER';
UPDATE "User" SET "systemRole" = 'PLATFORM_OWNER' WHERE "role" = 'ADMIN';
ALTER TABLE "User" DROP COLUMN "role";
DROP TYPE "UserRole";

-- Existing single-tenant data is deliberately preserved inside one legacy workspace.
INSERT INTO "Organization" ("id", "name", "slug", "kind", "status", "createdAt", "updatedAt")
VALUES ('org_legacy_debtflow', 'Debt Flow Legacy Workspace', 'debtflow-legacy', 'BUSINESS', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO "OrganizationMembership" ("id", "organizationId", "userId", "role", "status", "joinedAt", "createdAt", "updatedAt")
SELECT
  'membership_legacy_' || "id",
  'org_legacy_debtflow',
  "id",
  CASE WHEN "systemRole" = 'PLATFORM_OWNER' THEN 'OWNER'::"OrganizationRole" ELSE 'VIEWER'::"OrganizationRole" END,
  'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "User";

ALTER TABLE "Party" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "Debt" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "Payment" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "Category" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "Brand" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "Product" ADD COLUMN "organizationId" TEXT;

UPDATE "Party" SET "organizationId" = 'org_legacy_debtflow';
UPDATE "Debt" SET "organizationId" = 'org_legacy_debtflow';
UPDATE "Payment" SET "organizationId" = 'org_legacy_debtflow';
UPDATE "AuditLog" SET "organizationId" = 'org_legacy_debtflow';
UPDATE "Category" SET "organizationId" = 'org_legacy_debtflow';
UPDATE "Brand" SET "organizationId" = 'org_legacy_debtflow';
UPDATE "Product" SET "organizationId" = 'org_legacy_debtflow';

ALTER TABLE "Party" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Debt" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Payment" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "AuditLog" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Category" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Brand" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Product" ALTER COLUMN "organizationId" SET NOT NULL;

DROP INDEX "Party_code_key";
DROP INDEX "Debt_code_key";
DROP INDEX "Category_code_key";
DROP INDEX "Brand_code_key";
DROP INDEX "Product_code_key";
CREATE UNIQUE INDEX "Party_organizationId_code_key" ON "Party"("organizationId", "code");
CREATE UNIQUE INDEX "Debt_organizationId_code_key" ON "Debt"("organizationId", "code");
CREATE UNIQUE INDEX "Category_organizationId_code_key" ON "Category"("organizationId", "code");
CREATE UNIQUE INDEX "Brand_organizationId_code_key" ON "Brand"("organizationId", "code");
CREATE UNIQUE INDEX "Product_organizationId_code_key" ON "Product"("organizationId", "code");
CREATE INDEX "Party_organizationId_name_idx" ON "Party"("organizationId", "name");
CREATE INDEX "Debt_organizationId_type_status_idx" ON "Debt"("organizationId", "type", "status");
CREATE INDEX "Payment_organizationId_partyId_type_paidAt_idx" ON "Payment"("organizationId", "partyId", "type", "paidAt");
CREATE INDEX "AuditLog_organizationId_entityType_entityId_idx" ON "AuditLog"("organizationId", "entityType", "entityId");
CREATE INDEX "Category_organizationId_isActive_sortOrder_idx" ON "Category"("organizationId", "isActive", "sortOrder");
CREATE INDEX "Brand_organizationId_isActive_idx" ON "Brand"("organizationId", "isActive");
CREATE INDEX "Product_organizationId_categoryId_idx" ON "Product"("organizationId", "categoryId");

ALTER TABLE "Organization" ADD CONSTRAINT "Organization_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Party" ADD CONSTRAINT "Party_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Debt" ADD CONSTRAINT "Debt_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Category" ADD CONSTRAINT "Category_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Brand" ADD CONSTRAINT "Brand_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Product" ADD CONSTRAINT "Product_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
