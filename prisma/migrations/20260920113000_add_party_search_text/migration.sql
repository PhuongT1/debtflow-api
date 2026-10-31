CREATE EXTENSION IF NOT EXISTS unaccent;

ALTER TABLE "Party" ADD COLUMN "searchText" TEXT NOT NULL DEFAULT '';

UPDATE "Party"
SET "searchText" = lower(
  translate(
    unaccent(concat_ws(' ', "name", "code", "phone", "taxCode")),
    'Đđ',
    'Dd'
  )
);

CREATE INDEX "Party_organizationId_searchText_idx" ON "Party"("organizationId", "searchText");
