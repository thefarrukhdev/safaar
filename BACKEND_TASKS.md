# Safaar — Backend Vazifalari va Yo'l Xaritasi (Backend Tasks & Roadmap)

Ushbu hujjat frontend arxitekturasi tahlili, analitika talablari va ishlab chiqish davomida aniqlangan backend optimizatsiyalari asosida tuzilgan.

---

## 📌 1. Analitika va Server-Side Kuzatuv (Analytics & Event Tracking)

Foydalanuvchilarning saytdagi xatti-harakatlarini to'liq tahlil qilish va Admin panelida real vaqt rejimida ko'rsatish uchun backendda quyidagi imkoniyatlar kerak:

### 1.1. Asosiy biznes voqealarini yozish (Business Event Logger)
Foydalanuvchi quyidagi amallarni bajarganda ma'lumotlar bazasiga yoki analitika jadvaliga (`analytics_events`) yozilishi:
- **`search.performed`**: Qidiruv so'rovlari (qaysi shahar, qaysi sanalar oralig'i, nechta mehmon). *Bu talab yuqori bo'lgan yo'nalishlarni aniqlashga yordam beradi.*
- **`hotel.viewed` / `item.viewed`**: Foydalanuvchi qaysi mehmonxona, restoran yoki transport sahifasini ko'rdi.
- **`user.registered`**: Yangi ro'yxatdan o'tgan foydalanuvchi manbasi (organik, referral, promo).
- **`booking.created`**: Yangi bron yaratilishi (bron summasi, turi, xona/transport ID).
- **`payment.initiated` va `payment.success` / `payment.failed`**: To'lov konversiyasi.

### 1.2. Admin Paneli uchun Analitika API'lari (`/v1/admin/analytics`)
Super Admin va menejerlar uchun umumiy dashboard ma'lumotlari:
- `GET /v1/admin/analytics/overview`:
  - Bugungi / haftalik faol foydalanuvchilar soni (Active Users).
  - Bugungi yaratilgan va to'langan bronlar soni.
  - Kunlik jami aylanma (Gross Revenue) va sof komissiya.
- `GET /v1/admin/analytics/funnel`:
  - Qidiruv ➔ Ko'rish ➔ Bron qilish ➔ To'lov bosqichlari konversiyasi (%).
- `GET /v1/admin/analytics/top-destinations`:
  - Eng ko'p qidirilgan va eng ko'p bron qilingan TOP-10 shaharlar hamda mehmonxonalar.

---

## 📌 2. Baza Ma'lumotlarini Normallashtirish (Hero Backgrounds & Static Assets)

### 2.1. Mutlaq (Absolute) URL'larni Nisbiy (Relative) Yo'llarga O'tkazish
Hozirda `hero_backgrounds` jadvalida va seed fayllarda rasm manzillari qattiq `https://www.safaar.uz/...` va eskirgan kengaytmalar bilan saqlangan:
- **`home` sahifasi**: `https://www.safaar.uz/registon-blue-sky.jpeg` ➔ **`/registon-blue-sky.webp`**
- **`restaurants` sahifasi**: `https://www.safaar.uz/images/heroes/hero.png` ➔ **`/images/heroes/hero.webp`**

**Tavsiya:**
Bazada barcha ichki statik resurslar uchun to'liq domen nomini yozmasdan, faqat `/` bilan boshlanuvchi nisbiy yo'l saqlansin (masalan: `/registon-blue-sky.webp`). Bu mahalliy (local), test (staging) va jonli (production) muhitlarda rasmlarning 404 bo'lmasdan to'g'ri yuklanishini ta'minlaydi.

---

## 📌 3. Tarmoq va CORS Sozlamalari (Network & CORS)

### 3.1. Reverse Proxy (Caddy / Nginx) Headerlari
Frontend mijozlarning haqiqiy IP-manzili va davlatini aniqlashi uchun web-serverda quyidagi headerlar uzatilishi tekshirilsin:
- `X-Forwarded-For`
- `X-Real-IP`
- Agar Cloudflare ishlatilsa: `CF-IPCountry` va `CF-Connecting-IP`

### 3.2. Staging / Dev CORS Allowlist
Lokal muhitda backend bilan ishlashda qulaylik uchun `apps/backend/src/config/cors.ts` da `NODE_ENV !== 'production'` bo'lganda `localhost:3000`, `localhost:3001`, `localhost:3002` doimiy ochiq bo'lishi ta'minlangan bo'lishi kerak.

---

## 📋 4. Loyiha Egasidan (thefarrukhdev) Kerak Bo'ladigan Ma'lumotlar (Checklist)

Frontendda analitika tizimi to'liq o'rnatildi va ulandi. Quyidagi xizmatlar kerak bo'lsa, ularning ID raqamlari kerak bo'ladi:

| Xizmat | Kerakli parametr | Holati | Izoh |
|---|---|---|---|
| **Vercel Analytics** | — | ✅ **Tayyor** | Avtomatik ishlaydi, qo'shimcha kalit talab etilmaydi. |
| **Vercel Speed Insights** | — | ✅ **Tayyor** | Sayt tezligi (Core Web Vitals) avtomatik o'lchanadi. |
| **Google Analytics 4** | `NEXT_PUBLIC_GA_ID` | ⚪ *Ixtiyoriy* | Agar mavjud bo'lsa (masalan: `G-XXXXXXXXXX`). |
| **Yandex Metrika** | `NEXT_PUBLIC_YM_ID` | ⚪ *Tavsiya etiladi* | WebVisor bilan odamlar harakatini ko'rish uchun (masalan: `98765432`). |
| **PostHog Analytics** | `NEXT_PUBLIC_POSTHOG_KEY` | ⚪ *Ixtiyoriy* | Chuqur mahsulot analitikasi uchun. |

> 💡 **Eslatma:** Hozirgi holatda Vercel Web Analytics va Speed Insights to'liq ishlab turibdi. Agar Google Analytics yoki Yandex Metrika ishlatmoqchi bo'lsangiz, ulardan olingan ID raqamni bersangiz, darhol ulab beraman.
