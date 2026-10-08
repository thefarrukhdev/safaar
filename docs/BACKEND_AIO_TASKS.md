# Backend AI Optimization (AIO) Tasks

Ushbu hujjatda Safaar platformasini sun'iy intellekt (ChatGPT, Google Gemini, va hokazo) tizimlari tomonidan oson o'qilishi va topilishi (AIO - AI Optimization) uchun Backend'da qilinishi kerak bo'lgan ishlar ro'yxati keltirilgan. 

Frontend jamoasi (biz) hozirda barcha sahifalarga (Mehmonxonalar va Restoranlar) `JSON-LD` (Schema.org) tuzilmalarini qo'shib chiqmoqdamiz. Lekin AI biznesni to'g'ri tushunishi uchun API'dan quyidagi ma'lumotlar ham to'liq va tartibli ravishda kelishi kerak.

## 1. Restoranlar API'sini kengaytirish
**API Endpoint:** `GET /catalog/restaurants/:id` (yoki shunga o'xshash restoran detallari)

AI (va foydalanuvchilar) restoran haqida ko'proq ma'lumotga ega bo'lishi uchun quyidagi maydonlarni bazaga va API javobiga qo'shish tavsiya etiladi:
- `opening_hours` (string yoki object) - Masalan: "09:00 - 23:00". AI so'rovlarda ish vaqtini bilishi juda muhim.
- `price_range` (string) - Masalan: "100 000 - 300 000 UZS" yoki "$$". Restoranning narxlar darajasi.
- `menu_url` (string) - Restoran menyusiga havola (PDF yoki alohida sahifa). AI menyularni o'qib javob berishi mumkin.
- `cuisine` (array of strings) - Masalan: `["Milliy", "Yevropa", "Fast food"]`. AI qidiruvlarida oshxonaga ko'ra saralash uchun.

## 2. Mehmonxonalar API'sini yaxshilash
**API Endpoint:** `GET /hotels/:slug`

Mehmonxonalar API'si hozirda ancha yaxshi holatda (`min_price_sum`, `amenities`, `address` mavjud). Lekin quyidagilarni ham aniq qo'shish AIO uchun foydali:
- `contact_phone` (string) - Mehmonxona bilan bog'lanish uchun telefon raqami. (Hozirgi paytda faqat restoranlarda `phone` maydoni mavjud).
- `check_in_time` & `check_out_time` (string) - Ba'zi joylarda mavjud, lekin hamma mehmonxonalar uchun majburiy (yoki kafolatlangan default) qilib qo'yish kerak.
- `policies` (object) - Bolalar, hayvonlar va chekish bo'yicha qoidalar (Hozirgi `allowPets`, `allowSmoking` boolean maydonlarini to'ldirib borish).

## 3. SEO va AIO meta ma'lumotlari
Katalog API'larida har bir obyekt uchun `meta_description` va `meta_keywords` (ixtiyoriy) maydonlarini kiritish imkonini yaratish. AI botlar qisqacha ta'riflarni aynan shunday meta maydonlardan tezroq o'qiydi.

---
**Eslatma:** Ushbu o'zgarishlar qilingach, Frontend jamoasi `packages/types` dagi interfeyslarni yangilab, JSON-LD ichiga ulab qo'yadi.
