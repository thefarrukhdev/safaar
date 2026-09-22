# web-user — Pending Tasks & Backend Requests

Bu fayl `web-user` frontendidagi qolgan vazifalar va backend devdan so'rovlarni kuzatib boradi.

---

## 🔴 Backend Devdan So'rovlar (Backend TASKS)

Backend dev quyidagi endpoint va maydonlarni qo'shishi kerak.
Frontend tayyor — API qo'shilishi bilan darhol ulanadi.

### 1. Hotels — Amenities (Qulayliklar) Filter
- **Endpoint:** `GET /hotels?amenities=wifi,pool,sauna`
- **Tavsif:** `hotel_amenities` jadvalidan filter qilish
- **Frontend holati:** UI tayyor, API parametri hali yuborilmayapti
- **Prioritet:** 🔴 Yuqori

### 2. Hotels — Payment Type Filter
- **Endpoint:** `GET /hotels?payment_type=online_payment`
- **Qiymatlar:** `online_payment`, `pay_at_property`
- **Tavsif:** `hotels.payment_methods` ustunidan filter
- **Frontend holati:** UI tayyor, API parametri hali yuborilmayapti
- **Prioritet:** 🟡 O'rta

### 3. Hotels — Availability Filter (Bo'sh xonalar)
- **Endpoint:** `GET /hotels?check_in=2025-08-10&check_out=2025-08-12`
- **Tavsif:** Berilgan sana oralig'ida kamida 1 ta bo'sh xonasi bor hotellarni qaytarish
- **Frontend holati:** SearchBar dan `check_in`/`check_out` parametrlari yuborilmoqda, lekin backend filtrlamayapti
- **Prioritet:** 🔴 Yuqori

---

> **Eslatma:** Backend devga yuqoridagi "Backend Devdan So'rovlar" bo'limidagi vazifalarni yetkazing.
> Frontend ular tayyor bo'lishi bilan darhol ulanishga tayyor.
