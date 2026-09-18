-- Mahsulot talabi (2026-09-16): HUMO/UZCARD/VISA/MASTERCARD — to'rttala
-- karta turi endi backendda aniq, alohida to'lov usuli sifatida tan
-- olinadi (fee stavkasi karta turiga qarab farqlanadi, qarang
-- apps/backend/src/payments/providers/card-scheme-fee.ts). HUMO va UZCARD
-- allaqachon mavjud (`20260901000000`dan oldin qo'shilgan) — shu ikkitasi
-- YO'Q edi: VISA va MASTERCARD.
--
-- `PaymentMethod` pg enum'iga ikkita qiymat qo'shamiz. `payments.provider`
-- va `bookings.payment_method` shu enum'ni ishlatadi.
--
-- `ALTER TYPE ... ADD VALUE IF NOT EXISTS` — mavjud production ma'lumotlarini
-- buzmaydi, backward-compatible, additive. Precedent:
--   20260725124500_extended_partner_types,
--   20260804060000_restaurant_booking_type,
--   20260901000000_uzum_payment_method,
--   20260903120000_uzum_checkout_payment_method.
--
-- ATAYLAB alohida migratsiya (keyingi `20260916150100`dan OLDIN): Postgres
-- yangi qo'shilgan enum qiymatini o'sha AYNAN SHU tranzaksiyada (masalan
-- yangi ustun DEFAULT/CHECK sifatida) ishlatishga ruxsat bermasligi mumkin
-- — shu sabab bu loyihada ilgari ham enum-qo'shish va enum-ishlatish har
-- doim ALOHIDA migratsiya fayllarida bo'lgan (yuqoridagi precedentlarga
-- qarang).

ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'visa';
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'mastercard';
