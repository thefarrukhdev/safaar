-- Hamkor (partner) taklif qiladigan vaqtinchalik chegirmalar (xona yoki
-- mashina narxiga) uchun HAQIQIY saqlash. Ilgari bu butunlay frontend mock
-- edi: `web-partner/promotions.ts`da `let mockPromotions = []` (faqat
-- brauzer xotirasida, sahifa yangilansa yo'qoladi), `web-admin/admin-api.ts`
-- esa 2 ta qattiq yozilgan (hardcoded) soxta yozuv qaytarardi — ikkalasi
-- bir-biriga umuman ulanmagan edi. Backendda `promotion` bo'yicha hech
-- qanday kod (controller/service/DTO/model) yo'q edi.
--
-- Butunlay QO'SHIMCHA (additive): yangi jadval, mavjud hech qaysi jadvalga
-- tegilmaydi.

-- CreateEnum
CREATE TYPE "PromotionStatus" AS ENUM ('pending_review', 'published', 'rejected');

-- CreateTable
CREATE TABLE "promotions" (
    "id" UUID NOT NULL,
    "partner_organization_id" UUID NOT NULL,
    "entity_type" VARCHAR(32) NOT NULL,
    "entity_id" UUID NOT NULL,
    "entity_name" VARCHAR(255) NOT NULL,
    "old_price_sum" DECIMAL(18,2) NOT NULL,
    "new_price_sum" DECIMAL(18,2) NOT NULL,
    "discount_percent" INTEGER NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "status" "PromotionStatus" NOT NULL DEFAULT 'pending_review',
    "reviewed_at" TIMESTAMPTZ,
    "reviewed_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "promotions_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_partner_organization_id_fkey"
    FOREIGN KEY ("partner_organization_id") REFERENCES "partner_organizations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "promotions_partner_organization_id_status_idx" ON "promotions"("partner_organization_id", "status");

-- CreateIndex
CREATE INDEX "promotions_status_created_at_idx" ON "promotions"("status", "created_at");
