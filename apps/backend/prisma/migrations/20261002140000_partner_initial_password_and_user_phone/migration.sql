-- Add initial_password_hash to partner_organizations
ALTER TABLE "partner_organizations" ADD COLUMN IF NOT EXISTS "initial_password_hash" VARCHAR(255);

-- Add phone to partner_users
ALTER TABLE "partner_users" ADD COLUMN IF NOT EXISTS "phone" VARCHAR(20);
