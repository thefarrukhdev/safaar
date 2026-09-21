-- Avtobus/rent-a-car hamkorlari uchun "Umumiy ma'lumotlar" bosqichida
-- kiritiladigan short_description/full_description maydonlari backendda
-- HECH QAYERDA saqlanmas edi — `partners.service.ts`dagi
-- `createBusCompany()`/`updateBusCompany()` faqat `body.name`ni o'qir edi,
-- qolgan ikki maydon esa `bus_companies` jadvalida ustun bo'lmagani sababli
-- jimgina yo'qolardi. Natijada `bus`/`rent_car` hamkorlar frontend'dagi
-- "generalComplete" tekshiruvidan (apps/web-partner listing-overview.tsx)
-- hech qachon o'ta olmas edi, chunki short/full description doim bo'sh
-- qaytardi — e'lonni umuman nashr qila olmasdi.
--
-- ARXITEKTURA QARORI: `hotel_translations` bilan bir xil naqsh qo'llanildi
-- (bitta yordamchi jadval, hamkor+til boshiga bitta qator), YANGI JSONB
-- ustun naqshi (attractions.title/description kabi) emas:
--   1) Bu repoda ko'p tilli matn uchun ikkita aniq naqsh bor:
--      (a) `hotel_translations`/`hotel_room_translations` — PARTNER PATCH
--          orqali ITERATIV, maydon-maydon tahrirlanadigan matn (til
--          bo'yicha alohida qator, mavjud qiymatni PATCH paytida saqlab
--          qolish semantikasi bilan — qarang `updateListingGeneral()`);
--      (b) `attractions.title`/`promotion_banners.title` kabi bitta JSONB
--          ustun — faqat ADMIN CMS orqali BIR MARTA to'liq yoziladigan
--          statik kontent uchun.
--      `bus_companies.short_description`/`full_description` — birinchisi
--      bilan bir xil ish oqimi (partner dashboard, PATCH, partial update,
--      checklist gate) — shuning uchun (a) naqshi tanlandi.
--   2) apps/web-partner'ning adapter qatlami (`BackendBusCompany`)
--      allaqachon `short_description`/`full_description`ni `Localized`
--      (uz/ru/en) obyekt shaklida kutadi — bitta til uchun flat ustun
--      bu shartnomaga mos kelmas edi.
--
-- XAVFSIZLIK / PRODUKTSIYA: butunlay QO'SHIMCHA (additive) — yangi jadval,
-- mavjud `bus_companies` qatorlariga tegilmaydi, hech narsa o'chirilmaydi
-- yoki NOT NULL qilinmaydi. `short_description`/`description` NULLABLE
-- (aynan `hotel_translations.short_description` bilan bir xil — qarang
-- 20260716170000_listing_data_contract), chunki mavjud kompaniyalarning
-- hech biri hali bu maydonlarni to'ldirmagan. Uslub: `IF NOT EXISTS`,
-- ustunlar tartibi va CASCADE FK — 20260823180000_attractions_promotions_
-- dacha_sanatorium_taxi_stops migratsiyasidagi so'nggi uslubga mos.

CREATE TABLE IF NOT EXISTS "bus_company_translations" (
  "id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "language" "Language" NOT NULL,
  "short_description" TEXT,
  "description" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "bus_company_translations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "bus_company_translations_company_id_language_key" UNIQUE ("company_id", "language"),
  CONSTRAINT "bus_company_translations_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "bus_companies"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "bus_company_translations_company_id_idx"
  ON "bus_company_translations"("company_id");
