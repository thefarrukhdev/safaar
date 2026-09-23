-- Guest (login qilmagan) foydalanuvchilar support so'rov qoldira olishi uchun
-- `support_tickets`ga ism/telefon ustunlari qo'shiladi. `user_id` allaqachon
-- NULL bo'lishi mumkin va `actor_type` erkin VARCHAR (yangi 'guest' qiymati
-- uchun schema o'zgarishi shart emas) — faqat guest kontaktini saqlash uchun
-- ikkita ustun yetarli. Additive, xavfsiz: mavjud qatorlarga ta'sir qilmaydi.
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS guest_name VARCHAR(200);
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS guest_phone VARCHAR(20);
