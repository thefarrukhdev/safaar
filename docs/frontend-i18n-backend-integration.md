# 🌐 Frontend UI Tarjimalarini Backenddan Olish — Integratsiya Qo'llanmasi

**Kim uchun:** Frontend jamoasi (`apps/web-user`, `apps/web-partner`, `apps/web-admin`)  
**Mas'ul:** Backend jamoasi  
**Sana:** 2026-10-15  
**Holat:** 🚀 Backend tayyor (Production Ready)

---

## 1. Umumiy Maqsad (Goal)

Avvallari frontendda barcha UI matnlari (`common`, `hotels`, `booking`, `auth` va h.k.) statik JSON fayllarda saqlanar edi. 
Endi **barcha UI tarjimalari Backendda markazlashtirildi**. Frontend har qanday matnni bevosita backend API orqali oladi.

### Asosiy afzalliklari:
1. **Frontendda tarjima fayllarini qo'lda saqlash va build qilish shart emas:** Yangi kalit yoki matn qo'shilganda frontendni qayta deploy qilish shart bo'lmaydi.
2. **Bir xil lug'at:** `web-user`, `web-partner` va `web-admin` bir xil umumiy backend tarjimalaridan foydalanadi.
3. **Kesh va tezlik:** Backend javoblarida `Cache-Control: public, max-age=3600, stale-while-revalidate=86400` sarlavhalari sozlangan, Next.js serverida esa `fetch(..., { next: { revalidate: 3600 } })` bilan keshlanadi.

---

## 2. Backend API Endpointlari

Barcha endpointlar `https://api.safaar.uz/v1` (yoki mahalliy muhitda `http://localhost:4000/v1`) ostida mavjud:

| Metod | Endpoint | Tavsif | Misol |
| :--- | :--- | :--- | :--- |
| `GET` | `/v1/translations/locales` | Qo'llab-quvvatlanadigan tillar ro'yxati | `['uz', 'ru', 'en']` |
| `GET` | `/v1/translations/namespaces` | Mavjud barcha namespace'lar ro'yxati | `['account', 'common', 'hotels', ...]` |
| `GET` | `/v1/translations/:locale/:namespace` | Aniq bir namespace lug'atini olish | `GET /v1/translations/uz/common` |
| `GET` | `/v1/translations/:locale` | Tanlangan til bo'yicha BARCHA namespace'larni olish | `GET /v1/translations/uz` |
| `POST` | `/v1/translations/translate` | Matnni Gemini AI orqali 3 tilda tarjima qilish | `{"text": "Yangi e'lon", "sourceLang": "uz"}` |

---

## 3. Mavjud Namespace'lar Ro'yxati

Backend quyidagi 16 ta namespace bo'yicha to'liq `uz`, `ru` va `en` lug'atlarini o'z ichiga oladi:
- `account` — Shaxsiy profil va sozlamalar
- `attractions` — Ko'ngilochar joylar va attraksionlar
- `auth` — Ro'yxatdan o'tish, kirish, SMS OTP
- `booking` — Bron qilish jarayoni va qadamlari
- `catalog` — Qidiruv va filtrlar
- `checkout` — To'lov va buyurtmani tasdiqlash
- `common` — Header, Footer, navigatsiya, tugmalar, modal oynalar
- `errors` — Tizim va forma xatolik matnlari
- `favorites` — Saqlangan e'lonlar
- `home` — Bosh sahifa bannerlari, bo'limlari
- `hotelDetail` — Mehmonxona sahifasi, xonalar ro'yxati
- `hotels` — Mehmonxonalar katalogi va kartochkalari
- `restaurants` — Restoranlar bo'limi
- `reviews` — Fikr va sharhlar
- `static` — Ommaviy oferta, maxfiylik siyosati, yordam sahifalari
- `transport` — Avto ijara, transfer, taksi bo'limi

---

## 4. Frontendda Integratsiya Qilish (Misol)

### A. Next.js App Router (`apps/web-user/i18n/dictionaries.ts`)

Ilgari statik import qilingan loaderlarni backend API'ga ulaymiz:

```typescript
import "server-only";
import type { Locale } from "./config";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://api.safaar.uz";

export async function getDictionary(locale: Locale, namespace: string) {
  try {
    const res = await fetch(`${API_BASE}/v1/translations/${locale}/${namespace}`, {
      // 1 soat davomida Next.js keshida saqlanadi, so'ng fonda yangilanadi
      next: { revalidate: 3600, tags: [`i18n-${locale}-${namespace}`] },
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch dictionary: ${res.statusText}`);
    }

    const json = await res.json();
    // ApiResponseInterceptor { success: true, data: { ... } } formatida qaytaradi
    return json.data ?? json;
  } catch (err) {
    console.error(`[i18n] Error loading ${locale}/${namespace}:`, err);
    // Xatolikda lokal zaxira fallback'ga o'tish mumkin:
    return import(`@/locales/${locale}/${namespace}.json`).catch(() => ({}));
  }
}
```

### B. Komponentlarda foydalanish:

```tsx
// Server Component
export default async function Page({ params }: { params: { lang: 'uz' | 'ru' | 'en' } }) {
  const dict = await getDictionary(params.lang, "common");

  return (
    <div>
      <h1>{dict.brand}</h1>
      <button>{dict.actions.search}</button>
    </div>
  );
}
```

---

## 5. Yangi Matnni Backend orqali Tarjima Qilish (`POST /v1/translations/translate`)

Agar foydalanuvchi yoki hamkor biror matn kiritsa va uni 3 tilda ko'rsatish kerak bo'lsa:

```bash
curl -X POST https://api.safaar.uz/v1/translations/translate \
  -H "Content-Type: application/json" \
  -d '{"text": "Bosh sahifaga qaytish", "sourceLang": "uz"}'
```

Javob:
```json
{
  "success": true,
  "data": {
    "uz": "Bosh sahifaga qaytish",
    "ru": "Вернуться на главную страницу",
    "en": "Return to the main page"
  }
}
```
