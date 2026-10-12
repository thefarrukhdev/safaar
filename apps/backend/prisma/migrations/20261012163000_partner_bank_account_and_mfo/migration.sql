-- Add account_number and mfo to partner_organizations
ALTER TABLE "partner_organizations" ADD COLUMN IF NOT EXISTS "account_number" VARCHAR(64);
ALTER TABLE "partner_organizations" ADD COLUMN IF NOT EXISTS "mfo" VARCHAR(16);
