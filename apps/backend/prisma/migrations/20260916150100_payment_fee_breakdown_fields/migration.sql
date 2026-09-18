-- Foydalanuvchi to'lov haqi (fee) — Humo/Uzcard/Visa/Mastercard, mahsulot
-- talabi (2026-09-16). Barcha ustunlar NULLABLE, DEFAULT'siz — mavjud
-- `payments`/`refunds` qatorlariga TA'SIR QILMAYDI (additive, backward-
-- compatible; precedent: 20260911000000_uzum_checkout_commission_fields).
--
-- `payments.card_scheme` — foydalanuvchi ANIQ tanlagan karta turi
-- (humo/uzcard/visa/mastercard), mavjud `payments.provider` ustuni bilan
-- BIR XIL `PaymentMethod` enum'ini qayta ishlatadi (yangi enum turi
-- yaratilmadi). MUHIM: `provider` ustuni bu to'rttala usul uchun ham
-- doim 'uzum_checkout' bo'lib qoladi (texnik transport/rail — mavjud
-- Uzum Checkout callback/reconciliation/cron mantig'i O'ZGARMAYDI,
-- `provider = 'uzum_checkout'` bo'yicha ishlashda davom etadi); aynan
-- QAYSI karta turi tanlangani va fee necha ekani shu YANGI ustunlarda
-- saqlanadi. Boshqa provayderlar (click/payme/cash/uzum) uchun
-- `card_scheme` har doim NULL.
--
-- `payments.base_amount` — bron gross summasi (fee qo'shilmasdan oldin).
-- `payments.fee_amount`  — foydalanuvchi to'laydigan qo'shimcha summa.
-- `payments.fee_rate`    — qo'llanilgan stavka (masalan 0.0150 = 1.5%).
-- `payments.amount` (mavjud ustun) — O'ZGARMAYDI, ma'nosi ENDI HAM
-- "haqiqatan to'lanadigan/Uzum'ga yuboriladigan yakuniy summa" (fee
-- qo'llanadigan usullar uchun = base_amount + fee_amount; boshqa barcha
-- usullar uchun avvalgidek base_amount bilan bir xil, fee_amount=0).
--
-- `refunds.provider_refund_reference` — tashqi provayder (Uzum Checkout
-- `/acquiring/refund`) qaytargan `operationId`, faqat audit uchun.
-- ESLATMA: bu `payments.provider_fee_rate/provider_fee_amount/
-- net_settlement_amount` (20260911000000) BILAN ARALASHTIRILMASIN — o'sha
-- ustunlar Uzum-SAFAAR bank SETTLEMENT (hali tasdiqlanmagan, texnik)
-- kontseptsiyasini ifodalaydi; bu yerdagi ustunlar esa foydalanuvchiga
-- ANIQ ko'rsatiladigan/undiriladigan fee (tasdiqlangan, mahsulot talabi).
-- Ikkalasi mustaqil, bir-birining o'rnini bosmaydi.

ALTER TABLE "payments" ADD COLUMN "card_scheme" "PaymentMethod";
ALTER TABLE "payments" ADD COLUMN "base_amount" DECIMAL(18, 2);
ALTER TABLE "payments" ADD COLUMN "fee_rate" DECIMAL(6, 4);
ALTER TABLE "payments" ADD COLUMN "fee_amount" DECIMAL(18, 2);

ALTER TABLE "refunds" ADD COLUMN "provider_refund_reference" VARCHAR(255);
