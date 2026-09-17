-- Ommaviy Oferta / Terms of Service rozilikni server-side qayd etish.
--
-- To'rtta nullable ustun qo'shiladi (ikkitasi `users`ga, ikkitasi
-- `bookings`ga): hech biriga DEFAULT/NOT NULL qo'yilmagan, shuning uchun
-- bu ADDITIVE va mavjud qatorlarga ta'sir qilmaydi (backward-compatible,
-- xuddi `phone_verified_at`/`email_verified_at` bilan bir xil naqsh).
--
-- Eski (bu migratsiyadan oldingi) foydalanuvchi/bron yozuvlari uchun
-- retroaktiv "rozilik bildirilgan" deb hisoblanmaydi — ular NULL bo'lib
-- qoladi (ataylab, "fake acceptance" yaratmaslik uchun).
--
-- `terms_version`: hozircha CMS-backed versiyalash mexanizmi yo'q (Terms
-- matni `apps/web-user/data/terms/*.html` sifatida statik fayl, DBda
-- emas) — shuning uchun bu ustun backend kodidagi bitta doimiy
-- (`CURRENT_TERMS_VERSION`, apps/backend/src/common/legal.ts) qiymatni
-- saqlaydi. Bu FAQAT texnik marker, real legal versioning/effective-date
-- qoidalari emas — final reportga qarang.

ALTER TABLE "users" ADD COLUMN "terms_accepted_at" TIMESTAMPTZ;
ALTER TABLE "users" ADD COLUMN "terms_version" VARCHAR(64);

ALTER TABLE "bookings" ADD COLUMN "terms_accepted_at" TIMESTAMPTZ;
ALTER TABLE "bookings" ADD COLUMN "terms_version" VARCHAR(64);
