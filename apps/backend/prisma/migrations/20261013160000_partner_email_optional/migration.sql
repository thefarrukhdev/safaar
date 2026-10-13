-- AlterTable: Hamkor ro'yxatdan o'tishida email ixtiyoriy (optional) qilindi
ALTER TABLE "partner_organizations" ALTER COLUMN "email" DROP NOT NULL;

-- AlterTable: Hamkor foydalanuvchisi uchun ham email ixtiyoriy
ALTER TABLE "partner_users" ALTER COLUMN "email" DROP NOT NULL;
