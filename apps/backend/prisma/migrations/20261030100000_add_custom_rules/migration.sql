-- AlterTable: hotels va bus_companies jadvallariga custom_rules JSONB ustunini qo'shish
ALTER TABLE "hotels" ADD COLUMN IF NOT EXISTS "custom_rules" JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE "bus_companies" ADD COLUMN IF NOT EXISTS "custom_rules" JSONB NOT NULL DEFAULT '[]'::jsonb;
