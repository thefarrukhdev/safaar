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

## 🟡 Frontend Tasks (Web-User)

### 1. HotelFilters — Amenities va Payment qaytarish
- Amenities (Basseyn, Wi-Fi, Sauna, Nonushta...) va To'lov turi filterlarini qaytarib qo'shish
- Backend `amenities` va `payment_type` parametrlarini qo'shgandan so'ng ulash
- **Bog'liq:** Backend Task #1 va #2
- **Prioritet:** 🟡 Backend tayyor bo'lganda

### 2. Hotel Detail — Xarita (Map) qo'shish
- Hotel batafsil sahifasida Google Maps yoki OpenStreetMap orqali joylashuvni ko'rsatish
- Hotel koordinatlari (`latitude`, `longitude`) allaqachon API dan kelmoqda
- **Prioritet:** 🟡 O'rta

### 3. Booking — Special Requests maydoni
- Checkout formasiga "Maxsus so'rovlar" (textarea) qo'shish
- **Prioritet:** 🟡 O'rta

### 4. Booking — Promokod maydoni
- Checkout formasiga promokod kiritish maydoni qo'shish
- **Prioritet:** 🟢 Past

### 5. Account — Profilni to'liq boshqarish (Avatar, Parol, Bildirishnomalar, Ma'lumot)
- **Avatar yuklash**: Profil rasmini o'zgartirish (`POST /me/avatar` & `DELETE /me/avatar`) APIsi tayyor.
- **Parol o'zgartirish**: Backend'da tayyor bo'lgach qo'shish kerak.
- **Bildirishnomalar (Notifications)**: SMS/Email/Push xabarlarni sozlash (`GET /me/notifications/preferences` APIsi tayyor).
- **Hisobni o'chirish/Ma'lumot eksporti**: Privacy qismi uchun (`POST /me/data-export` & `POST /me/delete-request` APIsi tayyor).
- **Prioritet:** 🟡 O'rta

### 6. Booking — Bronni bekor qilish va Chat
- **Bekor qilish (Cancel)**: Foydalanuvchi "Mening bronlarim" yoki "Bron detali" orqali bronini bekor qilishi, qaytariladigan pul (refund preview) haqida ko'rishi kerak (`POST /bookings/:id/cancel-preview` API tayyor).
- **Chat**: Bron qilingan mehmonxona bilan yozishish uchun Chat UI qo'shilishi kerak (`GET /bookings/:id/messages` API tayyor).
- **Prioritet:** 🔴 Yuqori

### 7. Hotels — Sharh yozish (Leave a Review)
- Tasdiqlangan mehmonlar uchun sharh qoldirish va rasm yuklash formasi qo'shilishi kerak.
- **API**: `POST /reviews` va `POST /reviews/photos` backend'da tayyor.
- **Prioritet:** 🔴 Yuqori

### 8. Map — Dinamik Xarita Filtri
- `AccommodationListWithMap.tsx` xaritasida xarita ko'rinishi o'zgarganda (zoom/pan) avtomat shu hududdagi mehmonxonalarni yuklash.
- **API**: `GET /hotels` da `ne_lat`, `ne_lng`, `sw_lat`, `sw_lng` parametrlari orqali ishlaydi.
- **Prioritet:** 🟡 O'rta


---

## ✅ Bajarilgan Vazifalar

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
