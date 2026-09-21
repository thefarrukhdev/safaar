# Notification Center & Real-Time System (Backend & Frontend Guide)

Safaar platformasi uchun to'liq Notification (Bildirishnoma) tizimini joriy qilish rejasining arxitektura qismi. Ushbu fayl asosan **Backend dasturchi** uchun yo'riqnoma va **Frontend bilan qanday integratsiya qilinishi** haqida ma'lumot beradi.

## 1. Umumiy Arxitektura (Real-time)

Hozirgi vaqtda bron holatlari (tasdiqlangan, bekor qilingan) Websocket (`booking.status_changed`) orqali eshitilyapti (masalan `BookingsListLive` da). Xuddi shu arxitekturani umumiy bildirishnomalar (Notifications) uchun ham kengaytirishimiz kerak.

Backend `Socket.IO` yoki `Redis Pub/Sub` orqali frontendga quyidagi eventni yuborishi kerak:
- **Event Name:** `notification.new`
- **Payload (Data):**
```json
{
  "id": "notif_12345",
  "type": "BOOKING_CONFIRMED", // yoki "PROMO", "PAYMENT_REMINDER", "SYSTEM"
  "title": {
    "uz": "Bron tasdiqlandi",
    "ru": "Бронирование подтверждено",
    "en": "Booking confirmed"
  },
  "message": {
    "uz": "Sizning #1024 broningiz hamkor tomonidan tasdiqlandi.",
    "ru": "Ваше бронирование #1024 подтверждено партнером.",
    "en": "Your booking #1024 has been confirmed by the partner."
  },
  "actionUrl": "/booking/1024",
  "isRead": false,
  "createdAt": "2026-09-21T10:00:00Z"
}
```

## 2. Backend Dasturchi uchun vazifalar

1. **Database Schema (Table):**
   - Foydalanuvchilarning barcha bildirishnomalarini saqlash uchun `notifications` table yaratish (PostgreSQL da).
   - Qatorlar (Columns): `id`, `user_id`, `type`, `title_uz` (yoki JSONB), `message_uz` (yoki JSONB), `action_url`, `is_read` (boolean, default: false), `created_at`.
   
2. **REST API (Endpoints):**
   - `GET /api/users/notifications` — Foydalanuvchining so'nggi bildirishnomalarini (pagination bilan) qaytaruvchi endpoint.
   - `GET /api/users/notifications/unread-count` — O'qilmagan xabarlar sonini (masalan, `count: 3`) qaytaruvchi endpoint (Headerdagi qizil nuqta uchun).
   - `PATCH /api/users/notifications/:id/read` — Xabarni o'qilgan (is_read: true) deb belgilash.
   - `PATCH /api/users/notifications/read-all` — Barcha xabarlarni o'qilgan deb belgilash.

3. **Event Triggers (Backend logic):**
   - Quyidagi holatlar yuz berganda `notifications` tablega yozish va zudlik bilan Websocket orqali `notification.new` yuborish:
     - Hamkor admin-paneldan mijoz bronini tasdiqlasa yoki bekor qilsa.
     - Bron to'lovini amalga oshirish muddati (masalan, 15 daqiqa) tugashiga 5 daqiqa qolganda.
     - Qaytarish (Refund) holati o'zgarganda (tasdiqlandi/bekor qilindi).
     - Marketing / SuperAdmin tomonidan hammaga (yoki ma'lum bir mijozga) yangi promo kod yuborilganda.

## 3. Frontendda Qilinadigan Ishlar (Men qilaman)

Backend API va Websocket eventlari tayyor bo'lishi bilan frontendda quyidagi ishlarni bajaraman:

1. **NotificationBell Komponenti:** 
   - Saytning bosh Header qismiga (Avatar yoniga) `🔔` qo'ng'iroqcha qo'shaman.
   - Sahifa yuklanganda `/api/users/notifications/unread-count` ga so'rov tashlab qizil nuqta sonini (Badge) chiqaraman.
   
2. **Websocket Listener:**
   - `useRealtimeEvent("notification.new", (data) => { ... })` orqali yangi bildirishnoma kelganini eshitaman.
   - Kelgan zahoti qizil nuqtadagi raqamni +1 qilaman va ekranning burchagida darhol **Toast** (`sonner`) chiqarib beraman:
     *Masalan: "🔔 Yangi xabar: Broningiz tasdiqlandi!"*
     
3. **Dropdown Menu:**
   - Qo'ng'iroqchani bosganda kichik oyna (Popover/Dropdown) ochiladi va oxirgi 5 ta bildirishnomani ko'rsatadi. 
   - Bosilganda `actionUrl` ga o'tib ketadi va API orqali uni o'qilgan (`read`) qilib qo'yadi.

## Xulosa
Backend qismidan yuqoridagi **3 ta narsa** (Table, 4 ta Endpoint va Websocket trigger) tayyor bo'lishi bilanoq, uni frontendga ulab beraman.
