# CMS Hero Fon Rasmlari (Hero Backgrounds) — Frontend Integratsiya Qo'llanmasi

Ushbu qo'llanma **`web-admin`** va **`web-user`** frontend dasturchilari uchun tayyorlangan. Unda backendda yaratilgan **Hero Backgrounds CMS** tizimidan foydalanib, foydalanuvchilar saytidagi barcha sahifalar (Bosh sahifa, Mehmonxonalar, Restoranlar, Transport, Ko'ngilochar joylar) fon rasmlari va sarlavhalarini admin paneldan dinamik boshqarish yo'riqnomasi bayon etilgan.

---

## 1. Muammo va Yechim arxitekturasi

### Hozirgi holat (Muammo):
User panelida (`apps/web-user`) sahifalar tepasidagi katta fon rasmlari (Hero Banner) va ularning sarlavhalari statik (hardcoded) yozilgan:
- **Transport sahifasi:** `apps/web-user/components/features/transport/TransportView.tsx:122` da `/images/heroes/transport_hero.jpg` qattiq kodlangan.
- **Restoranlar sahifasi:** `apps/web-user/components/features/restaurants/RestaurantsView.tsx:117` da `/images/heroes/hero.png` qattiq kodlangan.
- **Turar joylar (Hotels) sahifasi:** `apps/web-user/components/accommodation/AccommodationPage.tsx:170` da `/images/heroes/hotels_hero.jpg` qattiq kodlangan.
- **Bosh sahifa:** `apps/web-user/components/features/home/Hero.tsx:10` da `/registon-blue-sky.jpeg` qattiq kodlangan.

Admin paneldan ushbu rasmlarni, sarlavha va tavsiflarni o'zgartirish imkoni yo'q edi.

### Backend yechimi:
Backendda to'liq `hero-backgrounds` moduli yaratildi (`apps/backend/src/hero-backgrounds/`):
1. **Admin panel uchun:** Barcha sahifalar uchun fon rasmlarini yuklash, ko'p tilli (UZ, RU, EN) sarlavha va matn kiritish, faollashtirish/yashirish (`publish`/`unpublish`), saralash va o'chirish CRUD API lari.
2. **User panel uchun:** Barcha sahifalarning faol fon rasmlarini bitta tezkor so'rovda (`GET /hero-backgrounds/map`) yoki sahifa bo'yicha (`GET /hero-backgrounds/:page`) oluvchi keshlanuvchi (high-performance) Public API lari.

---

## 2. Backend API Spetsifikatsiyasi

Backend bazaviy URL: `https://api.safaar.uz/v1` (yoki mahalliy muhitda `http://localhost:4000/v1`).

### A. Public API (User Panel — `apps/web-user` uchun)
Hech qanday token yoki autentifikatsiya talab qilinmaydi. Kesh bilan ishlaydi.

| Metod | Endpoint | Tavsif | Query parametrlar |
|---|---|---|---|
| `GET` | `/hero-backgrounds/map` | **(Tavsiya etiladi)** Barcha sahifalarning joriy faol hero ma'lumotlarini bitta lug'at (Record) qilib qaytaradi. | Yo'q |
| `GET` | `/hero-backgrounds/:page` | Muayyan sahifa uchun eng asosiy faol fon ma'lumotlarini qaytaradi. | `:page` = `home`, `hotels`, `restaurants`, `transport`, `attractions` |
| `GET` | `/hero-backgrounds` | Faol fon rasmlari ro'yxatini massiv (Array) ko'rinishida qaytaradi. | `?page={page}` (ixtiyoriy) |

#### `GET /hero-backgrounds/map` javob namunasi (Response 200 OK):
```json
{
  "home": {
    "id": "00000000-0000-7010-0000-000000000001",
    "page": "home",
    "imageUrl": "/registon-blue-sky.jpeg",
    "image_url": "/registon-blue-sky.jpeg",
    "title": {
      "uz": "Orzuyingizdagi mehmonxonani bugun toping",
      "ru": "Найдите отель вашей мечты сегодня",
      "en": "Find your dream hotel today"
    },
    "title_text": "Orzuyingizdagi mehmonxonani bugun toping",
    "subtitle": {
      "uz": "O'zbekiston bo'ylab mehmonxonalarni kafolatlangan eng arzon narxlarda kashf eting.",
      "ru": "Откройте для себя отели по всему Узбекистану по лучшим ценам.",
      "en": "Discover hotels across Uzbekistan with guaranteed best prices."
    },
    "subtitle_text": "O'zbekiston bo'ylab mehmonxonalarni kafolatlangan eng arzon narxlarda kashf eting.",
    "isActive": true,
    "is_active": true,
    "sortOrder": 1,
    "sort_order": 1
  },
  "transport": {
    "id": "00000000-0000-7010-0000-000000000004",
    "page": "transport",
    "imageUrl": "/images/heroes/transport_hero.jpg",
    "image_url": "/images/heroes/transport_hero.jpg",
    "title": {
      "uz": "Avto Ijarasi va Transfer Xizmatlari",
      "ru": "Аренда авто и трансфер",
      "en": "Car Rental and Transfer Services"
    },
    "title_text": "Avto Ijarasi va Transfer Xizmatlari",
    "subtitle": {
      "uz": "O'zbekiston bo'ylab qulay sayohat qilish uchun avtomobil ijarasi, VIP taksi va aeroport transferlari.",
      "ru": "Аренда автомобилей, VIP такси и трансферы из аэропорта.",
      "en": "Car rental, VIP taxi, and airport transfers."
    },
    "subtitle_text": "O'zbekiston bo'ylab qulay sayohat qilish uchun avtomobil ijarasi, VIP taksi va aeroport transferlari.",
    "isActive": true,
    "is_active": true,
    "sortOrder": 4,
    "sort_order": 4
  },
  "restaurants": { ... },
  "hotels": { ... }
}
```

> **Eslatma:** DTO da frontend qulayligi uchun bir vaqtning o'zida ham camelCase (`imageUrl`, `isActive`, `sortOrder`), ham snake_case (`image_url`, `is_active`, `sort_order`) maydonlari qaytariladi. Shuningdek, `title_text` va `subtitle_text` orqali matnli tezkor fallback mavjud.

---

### B. Admin API (Admin Panel — `apps/web-admin` uchun)
Admin tokeni (`Authorization: Bearer <token>`) talab qilinadi.
Ruxsat etilgan rollar: `ADMIN`, `SUPER_ADMIN`, `CONTENT_ADMIN`.
Talab qilinadigan ruxsatlar: `CmsRead`, `CmsWrite`.

| Metod | Endpoint | Tavsif | Request Body / Parametrlar |
|---|---|---|---|
| `GET` | `/admin/hero-backgrounds` | Barcha fon rasmlari ro'yxati | Query: `?page=transport`, `?is_active=true`, `?search=...`, `?limit=50` |
| `GET` | `/admin/hero-backgrounds/:id` | Bitta yozuv tafsilotlari | `:id` (UUID) |
| `POST` | `/admin/hero-backgrounds` | Yangi hero rasm qo'shish | JSON Body (pastga qarang) |
| `PATCH` | `/admin/hero-backgrounds/:id` | Qisman tahrirlash | JSON Body |
| `DELETE` | `/admin/hero-backgrounds/:id` | O'chirish | `:id` (UUID) |
| `POST` | `/admin/hero-backgrounds/:id/toggle-active` | Faollikni yoqish / o'chirish | `{ "isActive": boolean }` (yoki bo'sh) |
| `POST` | `/admin/hero-backgrounds/:id/publish` | Faollashtirish (`is_active = true`) | Bo'sh body |
| `POST` | `/admin/hero-backgrounds/:id/unpublish` | Nofaol qilish (`is_active = false`) | Bo'sh body |
| `POST` | `/admin/hero-backgrounds/reorder` | Tartibni (sortOrder) yangilash | `{ "orderedIds": ["uuid1", "uuid2"] }` |

#### `POST /admin/hero-backgrounds` Body namunasi:
```json
{
  "page": "transport",
  "imageUrl": "https://storage.safaar.uz/uploads/heroes/transport_summer.jpg",
  "title": {
    "uz": "Avto Ijarasi va VIP Transferlar",
    "ru": "Аренда авто и VIP трансферы",
    "en": "Car Rental and VIP Transfers"
  },
  "subtitle": {
    "uz": "O'zbekiston bo'ylab eng yaxshi narxlardagi avtomobillar",
    "ru": "Автомобили по лучшим ценам по всему Узбекистану",
    "en": "Best price car rentals across Uzbekistan"
  },
  "isActive": true,
  "sortOrder": 1
}
```

---

## 3. Sahifa kodlari (Standart Page Keys)

Tizimda quyidagi standart sahifa kalitlari ishlatiladi:

| `page` kodi | Qaysi bo'lim uchun | Default Fon rasmi (Fallback) |
|---|---|---|
| `home` | Asosiy bosh sahifa (`/`) | `/registon-blue-sky.jpeg` |
| `hotels` | Mehmonxonalar / Turar joylar (`/hotels`, `/dachas`) | `/images/heroes/hotels_hero.jpg` |
| `restaurants` | Restoranlar va milliy taomlar (`/restaurants`) | `/images/heroes/hero.png` |
| `transport` | Transport va avto ijarasi (`/transport`) | `/images/heroes/transport_hero.jpg` |
| `attractions` | Ko'ngilochar joylar va ekskursiyalar | `/images/heroes/hero.png` |

---

## 4. `web-user` Dasturchilari uchun Integratsiya Bosqichlari

`web-user` da hardcoded rasmlarni dinamik CMS ma'lumotlariga o'tkazish kerak. Agar serverdan ma'lumot kelmasa yoki rasm yuklanmagan bo'lsa, **mavjud statik rasmlarga xavfsiz fallback** bo'lishi shart!

### 1-qadam: API mijoziga helper qo'shish (yoki to'g'ridan-to'g'ri fetch)
`packages/api-client/src/services/cms.ts` fayliga (yoki `web-user` ichidagi API qatlamiga):

```typescript
import { rawApi } from "../client";
import { camelizeKeys } from "../case";
import type { HeroBackground } from "@safaar/types";

export const heroBackgroundsApi = {
  /** Barcha sahifalar uchun faol hero fon rasmlari xaritasini olish (ISR 60s kesh bilan) */
  async getHeroMap(): Promise<Record<string, HeroBackground>> {
    try {
      const raw = await rawApi.get<Record<string, unknown>>("/hero-backgrounds/map", {
        next: { revalidate: 60, tags: ["cms", "hero-backgrounds"] },
      });
      return camelizeKeys<Record<string, HeroBackground>>(raw) ?? {};
    } catch (e) {
      console.warn("Failed to fetch hero backgrounds map, using fallbacks:", e);
      return {};
    }
  },

  /** Muayyan bitta sahifa uchun olish */
  async getByPage(page: string): Promise<HeroBackground | null> {
    try {
      const raw = await rawApi.get<unknown>(`/hero-backgrounds/${encodeURIComponent(page)}`, {
        next: { revalidate: 60, tags: ["cms", `hero-${page}`] },
      });
      return camelizeKeys<HeroBackground>(raw) ?? null;
    } catch {
      return null;
    }
  },
};
```

---

### 2-qadam: Sahifalarda qo'llash

#### A. Transport sahifasi (`apps/web-user/components/features/transport/TransportView.tsx`)
Hozirgi kod:
```tsx
// 122-qator (eski hardcoded):
<Image
  src="/images/heroes/transport_hero.jpg"
  alt="Transport"
  fill
  priority
  className="object-cover object-center"
/>
```

Dinamik kodi:
```tsx
// Komponentga heroBg propini uzatish (Server Componentdan)
interface TransportViewProps {
  dict: TransportDict;
  items: TransportItem[];
  locale: Locale;
  heroBg?: {
    imageUrl?: string;
    title?: string;
    subtitle?: string;
  };
}

// JSX ichida (fallback bilan):
<Image
  src={heroBg?.imageUrl || "/images/heroes/transport_hero.jpg"}
  alt="Transport"
  fill
  priority
  className="object-cover object-center"
/>
<div className="relative z-10 w-full sm:max-w-[70%] lg:max-w-[55%]">
  <h1 className="mb-2 text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-white leading-tight">
    {heroBg?.title || dict.title}
  </h1>
  <p className="text-sm sm:text-base font-medium leading-relaxed text-white/90 max-w-lg">
    {heroBg?.subtitle || dict.subtitle}
  </p>
</div>
```

Server Component sahifasida (`app/[lang]/(main)/transport/page.tsx`):
```tsx
import { heroBackgroundsApi } from "@/lib/api/cms"; // yoki packages/api-client

export default async function TransportPage({ params: { lang } }: Props) {
  const [dict, items, heroMap] = await Promise.all([
    getDictionary(lang, "transport"),
    getTransportItems(lang),
    heroBackgroundsApi.getHeroMap(),
  ]);

  const transportHero = heroMap["transport"];
  const heroBg = transportHero ? {
    imageUrl: transportHero.imageUrl,
    title: typeof transportHero.title === "object" ? transportHero.title?.[lang] : transportHero.titleText,
    subtitle: typeof transportHero.subtitle === "object" ? transportHero.subtitle?.[lang] : transportHero.subtitleText,
  } : undefined;

  return <TransportView dict={dict} items={items} locale={lang} heroBg={heroBg} />;
}
```

#### B. Restoranlar sahifasi (`apps/web-user/components/features/restaurants/RestaurantsView.tsx`)
Xuddi shu tarzda:
```tsx
<Image
  src={heroBg?.imageUrl || "/images/heroes/hero.png"}
  alt="Restaurants"
  fill
  priority
  className="object-cover object-center"
/>
```

#### C. Mehmonxonalar sahifasi (`apps/web-user/components/accommodation/AccommodationPage.tsx`)
```tsx
<Image
  src={heroBg?.imageUrl || "/images/heroes/hotels_hero.jpg"}
  alt="Hotels"
  fill
  priority
  className="object-cover object-center"
/>
```

---

## 5. `web-admin` Dasturchilari uchun Integratsiya Bosqichlari

Admin panelda (`apps/web-admin`) administratorlar ushbu fon rasmlarini boshqarishi uchun qulay UI yaratish zarur.

### 1-qadam: Sidebar navigatsiyasiga qo'shish
`apps/web-admin/components/layout/Sidebar.tsx` yoki CMS menyusiga:
```tsx
{
  title: "Hero Fon Rasmlari",
  href: "/cms/hero-backgrounds",
  icon: ImageIcon,
}
```

### 2-qadam: Sahifa yaratish (`apps/web-admin/app/(dashboard)/cms/hero-backgrounds/page.tsx`)
Ushbu sahifada quyidagi komponentlar bo'lishi lozim:
1. **Tabs / Filtrlar:** Barcha sahifalar (`home`, `hotels`, `restaurants`, `transport`, `attractions`) bo'yicha filter qilish.
2. **Jadval yoki Kartochkalar (Cards):**
   - Miniatyura (rasm preview);
   - Sahifa kodi (`page`);
   - Sarlavha (Title) va Tavsif (Subtitle);
   - Status (Faol / Nofaol toggle switch);
   - Amallar: Tahrirlash (Edit), O'chirish (Delete), E'lon qilish/Yashirish.
3. **"Yangi fon rasmi qo'shish" modali:**
   - **Sahifani tanlash:** Dropdown (`home`, `hotels`, `restaurants`, `transport`, `attractions`);
   - **Rasm yuklash (File Upload):** Kompyuterdan rasm tanlaganda, uni mavjud `/v1/uploads` API orqali serverga yuklab, qaytgan URL'ni `imageUrl` maydoniga avtomatik qo'yish;
   - **Sarlavha (Title):** 3 ta tilda input (O'zbekcha, Ruscha, Inglizcha);
   - **Tavsif (Subtitle):** 3 ta tilda textarea;
   - **Holati:** Faol (Check/Toggle).

#### Oddiy API chaqiruv funksiyalari (Admin Panel uchun):
```typescript
// apps/web-admin/lib/api/hero-backgrounds.ts
import { adminApi } from "./client";

export interface HeroBackgroundAdminItem {
  id: string;
  page: string;
  imageUrl: string;
  title: { uz?: string; ru?: string; en?: string } | null;
  subtitle: { uz?: string; ru?: string; en?: string } | null;
  isActive: boolean;
  sortOrder: number;
}

export const adminHeroBgApi = {
  list: (params?: { page?: string; is_active?: boolean }) =>
    adminApi.get<HeroBackgroundAdminItem[]>("/admin/hero-backgrounds", { params }),

  create: (data: Partial<HeroBackgroundAdminItem>) =>
    adminApi.post<HeroBackgroundAdminItem>("/admin/hero-backgrounds", data),

  update: (id: string, data: Partial<HeroBackgroundAdminItem>) =>
    adminApi.patch<HeroBackgroundAdminItem>(`/admin/hero-backgrounds/${id}`, data),

  delete: (id: string) =>
    adminApi.delete(`/admin/hero-backgrounds/${id}`),

  toggleActive: (id: string, isActive?: boolean) =>
    adminApi.post(`/admin/hero-backgrounds/${id}/toggle-active`, { isActive }),
};
```

---

## 6. Sifat va Ishonchlilik talablari (Checklist)

1. **Doimiy Fallback:** User panelida tarmoq xatosi yoki 404 bo'lgan taqdirda ham foydalanuvchiga bo'sh joy yoki siniq rasm ko'rinmasin — zaxira rasmlar (`/images/heroes/*`) doim tayyor tursin.
2. **Rasm o'lchamlari va optimallashtirish:** Hero fon rasmlari uchun tavsiya etilgan o'lcham: **1920x600 px** yoki **2560x800 px**, format: WebP yoki sifatli JPEG (hajmi 500 KB dan oshmasligi tavsiya etiladi). Next.js `<Image priority sizes="100vw" fill />` xususiyatlari saqlansin.
3. **Kesh yangilanishi:** Yangi rasm yuklanganda Next.js keshini tozalash uchun backendda `revalidateTag("hero-backgrounds")` mexanizmi mavjud, frontendlarda `next: { revalidate: 60 }` yetarli.
