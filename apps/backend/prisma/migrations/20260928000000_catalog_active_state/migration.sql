-- Real persistent active/inactive state for the regions and amenities
-- catalogs. Existing rows default to TRUE (NOT NULL DEFAULT) so current
-- public visibility is unchanged the moment this migration applies —
-- nothing is hidden until an admin explicitly deactivates it.
-- No partial index is added: both tables are small, hand-curated admin
-- catalogs (tens of rows), so a WHERE is_active = true index would add
-- write/maintenance overhead with no measurable read benefit.

-- AlterTable
ALTER TABLE "regions" ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "amenities" ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;
