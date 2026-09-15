-- Uzum Checkout 1.5% komissiya — SAFAAR ICHKI accounting maydonlari.
--
-- Uch nullable ustun qo'shiladi: hech biriga DEFAULT/NOT NULL qo'yilmagan,
-- shuning uchun bu ADDITIVE va mavjud `payments` qatorlariga ta'sir
-- qilmaydi (backward-compatible — precedent: 20260901000000_uzum_payment_method,
-- 20260903120000_uzum_checkout_payment_method).
--
-- Bu ustunlar HECH QANDAY Uzum API maydoni EMAS — faqat SAFAAR'ning o'z
-- hisobotlari (admin/export/moliya) uchun. To'ldirilish qoidasi va
-- yaxlitlash siyosati: apps/backend/src/payments/providers/
-- uzum-checkout-commission.ts.
--
-- ⚠️ E'TIBOR: bu migratsiya boshqa Uzum Checkout migratsiyalari kabi
-- QO'LLANILMAGAN (ishlab turgan production DB'ga hali `prisma migrate
-- deploy` bilan tegilmagan) — Uzum Checkout chiquvchi API hali fail-closed
-- stub (`register()` hech qachon haqiqiy to'lov yaratmaydi), shuning uchun
-- bu ustunlarni to'ldiradigan kod yo'q. Real deploy qarori Uzum Checkout
-- wire-format + settlement mexanizmi tasdiqlanganda, alohida, ongli ravishda
-- qabul qilinadi (`docs/payments-uzum-checkout.md`ga qarang).

ALTER TABLE "payments" ADD COLUMN "provider_fee_rate" DECIMAL(6, 4);
ALTER TABLE "payments" ADD COLUMN "provider_fee_amount" DECIMAL(18, 2);
ALTER TABLE "payments" ADD COLUMN "net_settlement_amount" DECIMAL(18, 2);
