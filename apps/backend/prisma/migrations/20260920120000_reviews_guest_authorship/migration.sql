-- Sharhlar (reviews): mehmon (guest) mualliflik + moderatsiya uchun indekslar.
--
-- MAHSULOT SABABI: mehmonxona/restoran broni login talab qilmaydi (guest
-- checkout), shuning uchun sharh qoldirish ham login talab qilmasligi kerak
-- (mahsulot qarori). Login qilmagan mijozning `user_id`si yo'q, shuning uchun
-- `reviews.user_id` endi majburiy emas; muallif turi `author_type` ustunida
-- ANIQ saqlanadi ('USER' | 'GUEST'), ko'rsatiladigan ism esa `guest_name`da.
-- Boshqa hech qanday mehmon PII (email/telefon/IP) saqlanmaydi — sharhni
-- ko'rsatish uchun faqat ism yetarli.
--
-- QO'SHIMCHA (additive) va ORQAGA MOS (backward-compatible):
--   * `user_id` NOT NULL olib tashlanadi — mavjud yozuvlar o'zgarmaydi.
--   * `author_type` DEFAULT 'USER' — barcha mavjud sharhlar avtomatik
--     to'g'ri qiymat oladi, backfill kerak emas.
--   * `guest_name` NULLABLE, default yo'q.
--   * Indekslar faqat qo'shiladi (IF NOT EXISTS), hech biri o'chirilmaydi.
--   * Mavjud `reviews_user_id_fkey` (ON DELETE CASCADE) ATAYLAB
--     o'zgartirilmaydi: PostgreSQL MATCH SIMPLE semantikasida NULL
--     `user_id` FK tekshiruvidan umuman o'tmaydi, shuning uchun
--     nullable qilish uchun FK'ga tegish shart emas.
--   * `verified` ustuni ATAYLAB qo'shilmaydi: `booking_id IS NOT NULL`
--     serverda tasdiqlangan yagona ishonchli signal, ikkinchi manba
--     yaratish kerak emas.
--   * UNIQUE cheklov ATAYLAB qo'shilmaydi: produktsiyadagi mavjud
--     dublikat holati tekshirilmagan, UNIQUE esa bir tomonlama eshik.
--     Dublikat qoidasi (bitta (user_id, booking_id) uchun bitta sharh)
--     ilova qatlamida, INSERT'dan oldin tekshiriladi
--     (apps/backend/src/reviews/reviews.service.ts).
--
-- PRETSEDENT: 20260812090000_refunds_user_id_nullable — aynan shu narsani
-- (guest checkout uchun `user_id` DROP NOT NULL) `refunds` jadvalida qilgan.
-- Ustun qo'shish uslubi: 20260727102000_backend_integration_tasks
-- (`ALTER TABLE "reviews" ... ADD COLUMN IF NOT EXISTS ...`).
-- Mehmon ismini VARCHAR(200) sifatida saqlash uslubi: `bookings.guest_name`
-- (20260627140937_init) bilan bir xil.
--
-- ⚠️ PRODUKTSIYAGA QO'LDA QO'LLANADI: `scripts/deploy-production.sh`
-- (STEP 10, 224-237-qatorlar) startup'da migratsiya ishlashini ATAYLAB
-- rad etadi — image CMD'da `migrate`/`db push`/`seed` bo'lsa deploy
-- to'xtatiladi. Shuning uchun bu migratsiya prod DB'ga alohida, qo'lda
-- qo'llanishi shart.

ALTER TABLE "reviews"
  ALTER COLUMN "user_id" DROP NOT NULL;

ALTER TABLE "reviews"
  ADD COLUMN IF NOT EXISTS "author_type" VARCHAR(32) NOT NULL DEFAULT 'USER',
  ADD COLUMN IF NOT EXISTS "guest_name" VARCHAR(200);

-- Admin moderatsiya ro'yxati (status bo'yicha filtr + created_at bo'yicha
-- tartib) — `pending_review` navbati endi haqiqatan to'ladi.
CREATE INDEX IF NOT EXISTS "reviews_status_created_at_idx"
  ON "reviews"("status", "created_at");

-- "Mening sharhlarim" va dublikat tekshiruvi uchun.
CREATE INDEX IF NOT EXISTS "reviews_user_id_created_at_idx"
  ON "reviews"("user_id", "created_at");

-- Bron bo'yicha sharh qidirish (dublikat tekshiruvi, partner javobi).
CREATE INDEX IF NOT EXISTS "reviews_booking_id_idx"
  ON "reviews"("booking_id");
