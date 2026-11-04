-- Tenant-scoped Party filtering/default order and per-party debt aggregates.
-- Keep existing indexes until production query plans justify removing any overlap.
CREATE INDEX "Party_organizationId_isActive_name_id_idx"
ON "Party" ("organizationId", "isActive", "name", "id");

CREATE INDEX "Debt_organizationId_partyId_status_type_idx"
ON "Debt" ("organizationId", "partyId", "status", "type");

-- B-tree searchText indexes cannot accelerate the existing contains (%term%) search.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX "Party_searchText_trgm_idx"
ON "Party" USING GIN ("searchText" gin_trgm_ops);
