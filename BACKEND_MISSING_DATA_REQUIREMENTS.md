# Backend API Talablari: Yangi Admin Modullari

Admin panel (`web-admin`) uchun 5 ta yangi modul ishlab chiqildi. Biroq, ularning to'liq ishlashi uchun backend (API) da quyidagi endpointlar yaratilishi zarur. Barcha modullar hozirgi kunda Mock (ulangan) rejimida ishlamoqda.

---

## 1. Mashhur takliflar (Featured Hotels)
Admin panelidan mehmonxonalarning `featured` holatini o'zgartirish.

- **Method:** `PATCH`
- **URL:** `/v1/admin/hotels/:id/featured`
- **Payload:** `{ "featured": true }`

---

## 2. Fikr-mulohazalar moderatsiyasi (Reviews)
Foydalanuvchilar tomonidan qoldirilgan izohlarni ko'rish, spam deb belgilash, o'chirish.

- **Method:** `GET`
- **URL:** `/v1/admin/reviews`
- **Response:**
  ```json
  [
    { "id": "1", "hotelId": "1", "hotelName": "X", "userId": "1", "userName": "Y", "rating": 5, "comment": "...", "status": "published|hidden|spam", "createdAt": "..." }
  ]
  ```

- **Method:** `PATCH`
- **URL:** `/v1/admin/reviews/:id/status`
- **Payload:** `{ "status": "published" | "spam" | "hidden" }`

- **Method:** `DELETE`
- **URL:** `/v1/admin/reviews/:id`

---

## 3. Hamkorlar e'lonini tahrirlash (Edit Listing)
Admin tomonidan hamkorlarning e'lonlari (mehmonxonalar) ma'lumotlarini bevosita to'g'rilash (God Mode).

- **Method:** `PATCH` (yoki `PUT`)
- **URL:** `/v1/admin/hotels/:id`
- **Payload:**
  ```json
  {
    "hotelName": "Yangi nom",
    "city": "Toshkent",
    "address": "Yangi manzil",
    "stars": 4
  }
  ```
> **Izoh:** Ushbu endpoint orqali e'lonning istalgan maydonini o'zgartirish imkoni bo'lishi kerak.

---

## 4. Statik Tarjimalar CMS (Dictionary)
Frontendda (`web-user`) qattiq yozilgan tarjimalarni (`locales/*.json`) ma'lumotlar bazasiga o'tkazish. 

- **Method:** `GET`
- **URL:** `/v1/admin/translations`

- **Method:** `POST`
- **URL:** `/v1/admin/translations`
- **Payload:** `{ "key": "auth.login", "uz": "Kirish", "ru": "Вход", "en": "Login" }`

- **Method:** `PUT`
- **URL:** `/v1/admin/translations/:id`
- **Payload:** `{ "uz": "Tizimga kirish" }`

- **Method:** `DELETE`
- **URL:** `/v1/admin/translations/:id`

---

## 5. SEO va Meta Teglar CMS
Ilova sahifalari uchun SEO ma'lumotlarini bazadan dinamik yuklash tizimi.

- **Method:** `GET`
- **URL:** `/v1/admin/seo`
- **Response:**
  ```json
  [
    { "id": "1", "path": "/", "title": "...", "description": "...", "keywords": "...", "updatedAt": "..." }
  ]
  ```

- **Method:** `PUT`
- **URL:** `/v1/admin/seo/:id`
- **Payload:** `{ "title": "Yangi Sarlavha", "description": "Yangi tavsif", "keywords": "yangi, kalit, so'zlar" }`

---

## 6. Bannerlar va Asosiy Rasmlar CMS (Banners)
Asosiy sahifadagi fon rasmlari va slayderlarni boshqarish uchun backend endpointlari.

- **Method:** `GET`
- **URL:** `/v1/admin/banners`
- **Response:**
  ```json
  [
    { "id": "1", "title": "...", "imageUrl": "https://...", "isActive": true, "createdAt": "..." }
  ]
  ```

- **Method:** `POST`
- **URL:** `/v1/admin/banners`
- **Payload:** `{ "title": "Yangi Banner", "imageUrl": "https://...", "isActive": true }`

- **Method:** `PUT`
- **URL:** `/v1/admin/banners/:id`
- **Payload:** `{ "title": "...", "imageUrl": "...", "isActive": false }`

- **Method:** `DELETE`
- **URL:** `/v1/admin/banners/:id`

---

## 7. Hamkorning Individual Komissiyasi (Dynamic Commission)
Hamkor uchun alohida komissiya foizini belgilash imkoniyati.

- **Method:** `PATCH`
- **URL:** `/v1/admin/partners/:id/commission`
- **Payload:** `{ "commissionPercent": 10 }`

---

## 8. Sanalarni majburiy bloklash (Block Dates / Availability)
God Mode doirasida admin tomonidan mehmonxona/xona sanalarini sotuvdan majburiy bloklash (overbooking holatlarini zudlik bilan oldini olish uchun).

- **Method:** `POST`
- **URL:** `/v1/admin/hotels/:id/blocked-dates`
- **Payload:** 
  ```json
  { 
    "startDate": "2026-09-15", 
    "endDate": "2026-09-20", 
    "reason": "Overbooking qilingan" 
  }
  ```

---

## 9. Mashhur yo'nalishlar (Destinations)
Bosh sahifadagi "Mashhur yo'nalishlar" blokidagi shaharlar va ularning rasmlarini boshqarish.

- **Method:** `GET`
- **URL:** `/v1/admin/cms/destinations`
- **Response:**
  ```json
  [
    { "id": "1", "city": "Toshkent", "imageUrl": "/images/destinations/tashkent.jpg", "sortOrder": 1, "isActive": true }
  ]
  ```

- **Method:** `POST`
- **URL:** `/v1/admin/cms/destinations`
- **Payload:** `{ "city": "Samarqand", "imageUrl": "/images/destinations/samarkand.jpg", "sortOrder": 2, "isActive": true }`

- **Method:** `PATCH`
- **URL:** `/v1/admin/cms/destinations/:id`
- **Payload:** `{ "isActive": false }`

- **Method:** `DELETE`
- **URL:** `/v1/admin/cms/destinations/:id`

## 10. Fayl va Rasmlarni Yuklash (File Upload)
Admin panel (CMS) va boshqa qismlardan rasmlarni to'g'ridan-to'g'ri serverga yuklash uchun umumiy endpoint.

- **Method:** `POST`
- **URL:** `/v1/admin/upload`
- **Headers:** `Content-Type: multipart/form-data`
- **Payload:** `file` form-data (masalan rasm)
- **Response:**
  ```json
  {
    "url": "/images/uploads/random-name.jpg",
    "success": true
  }
  ```

---

## 11. Hamkor (Partner) Tizimiga Kirish (Auth)
Hamkorlar uchun parol orqali kirish va parolni o'rnatish tizimi.

- **Method:** `POST`
- **URL:** `/v1/auth/partner/password-login`
- **Payload:** `{ "phone": "+998901234567", "password": "yangi_parol" }`
- **Response:** `PartnerPhoneLoginResponse` (accessToken, refreshToken va h.k)

- **Method:** `POST`
- **URL:** `/v1/auth/partner/set-password`
- **Payload:** `{ "phone": "+998901234567", "code": "123456", "challenge_id": "...", "password": "yangi_parol" }`
- **Response:** `PartnerPhoneLoginResponse`

---

Ushbu endpointlar backend jamoasi tomonidan taqdim etilgandan so'ng, `apps/web-admin/lib/api/admin-api.ts` va `apps/web-partner/app/_lib/api/endpoints/auth.ts` fayllaridagi **Mock** funksiyalar API so'rovlariga o'zgartirilishi kerak.
