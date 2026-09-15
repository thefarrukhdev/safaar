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

## ✅ Bajarilgan Vazifalar

- [x] HotelFilters — Amenities va Payment filterlarini qaytarish
- [x] Hotel Detail — Xarita (Map) qo'shish
- [x] Booking — Special Requests maydoni qo'shish
- [x] Booking — Promokod maydoni qo'shish
- [x] Account — Profilni to'liq boshqarish
- [x] Booking — Bronni bekor qilish va Chat
- [x] Hotels — Sharh yozish (Leave a Review)
- [x] Map — Dinamik Xarita Filtri
- [x] Hotels sahifasi — `city_id` UUID validatsiyasi (backend crash fix)
- [x] Hotel Detail sahifasi — Gallery Modal + Carousel (rasm ko'rish)
- [x] Hotel Detail sahifasi — Premium dizayn (header, sidebar glassmorphism)
- [x] Hotel Detail sahifasi — BackButton joylashuvi to'g'rilandi
- [x] HotelFilters — Keraksiz (backend'da ishlamaydigan) filterlar olib tashlandi
- [x] Global UI — `Carousel.tsx` komponenti yaratildi
- [x] Global UI — `Modal.tsx` komponenti yaratildi
- [x] Checkout — Guest va DatePicker integratsiyasi
- [x] Restaurant — Hardcoded fetch xatosi tuzatildi (api-client ga o'tkazildi)

---

> **Eslatma:** Backend devga yuqoridagi "Backend Devdan So'rovlar" bo'limidagi vazifalarni yetkazing.
> Frontend ular tayyor bo'lishi bilan darhol ulanishga tayyor.
