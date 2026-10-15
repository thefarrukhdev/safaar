# 📋 Frontend Task: Mehmonxona Kartochkalaridagi Qulayliklarni (Amenities) Dinamik Qilish va "Spa" Hardcode'ini Bartaraf Etish

**Mas'ul:** Frontend dasturchi (`apps/web-user dev`)  
**Muallif:** Backend jamoasi  
**Sana:** 2026-10-15  
**Muhimlik darajasi:** 🔴 Yuqori (High / Bug Fix)  
**Holat:** 📝 Ishga tayyor (Ready for Implementation)  

---

## 1. Muammo bayoni (Problem Summary)

Foydalanuvchilar va hamkasblar platformadagi **deyarli barcha mehmonxonalar kartochkalarida qulayliklar orasida avtomatik ravishda "Spa" chiqib qolayotganini** aniqlashdi (masalan, Samarqanddagi oddiy *"Нур оилавий мехмонхона"* da ham `Wi-Fi`, `Nonushta`, `Spa` ko'rinmoqda).

### Tekshiruv natijasi (Forensic Root Cause):
Bu **backend yoki baza xatosi emas**. Muammoning ildizi `apps/web-user` dagi mehmonxona kartochkasi komponentida vaqtinchalik yozilgan shartli **hardcode (mock)** bilan bog'liq.

📍 **Fayl:** [`apps/web-user/components/features/accommodation/AccommodationCard.tsx:109-114`](file:///home/laziz/safaar/apps/web-user/components/features/accommodation/AccommodationCard.tsx#L109-L114)
```tsx
const trans = {
  uz: { breakfast: "Nonushta", parking: "Parking", restaurant: "Restoran", spa: "Spa" },
  ru: { breakfast: "Завтрак", parking: "Парковка", restaurant: "Ресторан", spa: "Спа" },
  en: { breakfast: "Breakfast", parking: "Parking", restaurant: "Restaurant", spa: "Spa" },
}[locale] || { breakfast: "Breakfast", parking: "Parking", restaurant: "Restaurant", spa: "Spa" };

// ⚠️ HARDCODE:
const amenityPills = hotel.name.toLowerCase().includes("chimgan")
  ? ["Wi-Fi", trans.breakfast, trans.parking]
  : hotel.name.toLowerCase().includes("buxoro")
  ? ["Wi-Fi", trans.breakfast, trans.restaurant]
  : ["Wi-Fi", trans.breakfast, trans.spa]; // <--- Barcha boshqa mehmonxonalarga avtomatik SPA qo'shilmoqda!
```

### Oqibat:
Mehmonxona nomida "chimgan" yoki "buxoro" so'zlari bo'lmasa, dastur uchinchi shartga tushadi va mehmonxonada spa bo'lmasa ham, foydalanuvchiga **"Spa"** belgisini ko'rsatib, chalg'itmoqda.

---

## 2. Backend API Holati

Backend tomonida barcha ma'lumotlar allaqachon tayyor va to'g'ri ishlamoqda:
* **Endpoint:** `GET /v1/hotels` (Public Catalog / Search)
* **Qaytadigan maydon:** Har bir mehmonxona obyekti ichida `amenities` massivi mavjud:
  ```json
  {
    "id": "e8386f68-7c85-4543-a65c-619f6a70e7e1",
    "name": "Нур оилавий мехмонхона",
    "amenities": ["wifi", "breakfast"],
    "min_price": 450000,
    ...
  }
  ```
Backend bazadagi `hotel_amenities` va `amenities` jadvallariga qarab, mehmonxona egasi kiritgan haqiqiy kodlarni qaytaradi.

---

## 3. Frontendda Qilinishi Kerak Bo'lgan Ishlar (Action Items)

Ushbu vazifani to'g'rilash uchun quyidagi 3 ta qadamni bajarish kerak:

### 1-qadam: `HotelListItem` turiga `amenities` maydonini qo'shish
📍 **Fayl:** `packages/api-client/src/types.ts`
```typescript
export interface HotelListItem {
  id: string;
  slug: string;
  name: string;
  cityName: string;
  stars: number;
  rating: number;
  reviewsCount: number;
  minPriceSum: number;
  baseMinPriceSum?: number;
  discountAmount?: number;
  imageUrl?: string;
  latitude?: number;
  longitude?: number;
  amenities?: string[]; // <--- QO'SHILADI
}
```

### 2-qadam: API Adapter'da `amenities` ni o'tkazish
📍 **Fayl:** `packages/api-client/src/adapters.ts` (`toHotelBase` funksiyasida)
```typescript
function toHotelBase(raw: RawHotel, locale: Locale): HotelListItem {
  const baseMinPriceSum = raw.base_min_price ?? raw.baseMinPrice;
  const minPriceSum = Number(raw.min_price ?? raw.minPrice ?? 0);
  const discountAmount = raw.discount_amount ?? raw.discountAmount ?? (baseMinPriceSum ? baseMinPriceSum - minPriceSum : 0);

  return {
    id: raw.id,
    slug: raw.slug,
    name: pickLocale(raw.name, locale),
    cityName: pickLocale(raw.city?.name, locale),
    stars: raw.stars ?? 0,
    rating: raw.ratingAverage ?? 0,
    reviewsCount: raw.reviewsCount ?? 0,
    minPriceSum,
    ...(baseMinPriceSum && discountAmount > 0 && { baseMinPriceSum, discountAmount }),
    imageUrl: raw.images?.[0],
    latitude: raw.latitude,
    longitude: raw.longitude,
    amenities: raw.amenities ?? [], // <--- QO'SHILADI
  };
}
```

### 3-qadam: `AccommodationCard.tsx` da haqiqiy qulayliklarni ko'rsatish
📍 **Fayl:** `apps/web-user/components/features/accommodation/AccommodationCard.tsx`

1. Hardcode shartni olib tashlash:
```tsx
// ❌ O'CHIRILADI:
// const amenityPills = hotel.name.toLowerCase().includes("chimgan")
//   ? ["Wi-Fi", trans.breakfast, trans.parking]
//   : hotel.name.toLowerCase().includes("buxoro")
//   ? ["Wi-Fi", trans.breakfast, trans.restaurant]
//   : ["Wi-Fi", trans.breakfast, trans.spa];
```

2. O'rniga `hotel.amenities` kodlarini chiroyli label'larga xaritalash:
```tsx
const AMENITY_LABELS: Record<Locale, Record<string, string>> = {
  uz: {
    wifi: "Wi-Fi",
    breakfast: "Nonushta",
    parking: "Parking",
    pool: "Hovuz",
    spa: "Spa",
    gym: "Sport zal",
    restaurant: "Restoran",
    ac: "Konditsioner",
    bar: "Bar",
  },
  ru: {
    wifi: "Wi-Fi",
    breakfast: "Завтрак",
    parking: "Парковка",
    pool: "Бассейн",
    spa: "Спа",
    gym: "Тренажерный зал",
    restaurant: "Ресторан",
    ac: "Кондиционер",
    bar: "Бар",
  },
  en: {
    wifi: "Wi-Fi",
    breakfast: "Breakfast",
    parking: "Parking",
    pool: "Pool",
    spa: "Spa",
    gym: "Gym",
    restaurant: "Restaurant",
    ac: "AC",
    bar: "Bar",
  },
};

// Haqiqiy qulayliklardan ko'pi bilan 3 tasini olish:
const labelsMap = AMENITY_LABELS[locale] || AMENITY_LABELS.uz;
const amenityPills = (hotel.amenities || [])
  .map((code) => labelsMap[code.toLowerCase()] || code)
  .slice(0, 3);

// Agar mehmonxonada qulayliklar kiritilmagan bo'lsa — bo'sh qolishi yoki faqat default Wi-Fi ko'rsatilishi mumkin:
const tags = amenityPills.length > 0 ? amenityPills : ["Wi-Fi"];
```

3. `UniversalCard` ga `tags={tags}` tarzida uzatish:
```tsx
<UniversalCard
  ...
  tags={tags}
  ...
/>
```

---

## 4. Qabul Qilish Mezonlari (Acceptance Criteria)

- [ ] Mehmonxona nomi bo'yicha `"chimgan"` / `"buxoro"` deb yozilgan shartli kod butunlay o'chirilgan.
- [ ] Bosh sahifa va qidiruv natijalaridagi barcha mehmonxona kartochkalarida faqat mehmonxonaning o'zida mavjud bo'lgan qulayliklar ko'rsatiladi.
- [ ] Spa xizmati bo'lmagan mehmonxonalarda (masalan, oilaviy mehmonxonalar, mini-mehmonxonalar) "Spa" tegi ko'rinmaydi.
- [ ] Tillar o'zgarganda (UZ/RU/EN) teglar mos tilda tarjima qilinadi.
- [ ] Kartochka dizayni buzilmasligi uchun ko'pi bilan 3 ta teg ko'rsatiladi.
- [ ] `pnpm build` va tegishli testlar yashil o'tadi.
