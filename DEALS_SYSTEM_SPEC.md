# 🏷️ Promotions (Chegirmalar) Tizimi — To'liq Texnik Spetsifikatsiya

> **Versiya:** 1.0 | **Sana:** 2026-09-29
> **Maqsad:** Hamkorlar (Partner) o'z xonalariga chegirma belgilaydi → Backend hisoblaydi → Bosh sahifaga avtomatik chiqadi → Mijoz bron qiladi.

---

## Arxitektura: Umumiy Oqim (Data Flow)

```
Partner Panel → POST /api/promotions → Backend DB
                                           ↓
                              Hamkor xonasining narxi ustiga
                              chegirma qo'llanadi
                                           ↓
GET /cms/offers (Bosh sahifa)     GET /hotels/:slug (Detail sahifa)
      ↓                                    ↓
DealsSection                          RoomList (chegirmali narx ko'rsatiladi)
(Top chegirmali xonalar)
```

---

## 🔴 1. BACKEND Developer (NestJS — `apps/backend`)

### 1.1 Yangi `promotions` jadvali (Database Migration)

```sql
CREATE TABLE promotions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  room_type_id  UUID NOT NULL REFERENCES room_types(id) ON DELETE CASCADE,
  hotel_id      UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,

  -- Chegirma turi
  discount_type   VARCHAR(10) NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
  discount_value  INTEGER NOT NULL,  -- % yoki so'm (tiyin EMAS, so'm!)

  -- Amal qilish muddati
  start_date  DATE NOT NULL,
  end_date    DATE NOT NULL,

  -- Holati
  status VARCHAR(10) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'expired')),

  -- CMS bosh sahifada ko'rsatish uchun
  is_featured     BOOLEAN NOT NULL DEFAULT FALSE,
  featured_title  JSONB,   -- {"uz": "Chegirma!", "ru": "Акция!", "en": "Sale!"}
  featured_image  TEXT,    -- S3 URL (optional, bo'lmasa xonaning rasmidan olinadi)

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT valid_dates CHECK (end_date >= start_date),
  CONSTRAINT valid_discount_percent CHECK (
    discount_type != 'percent' OR (discount_value > 0 AND discount_value <= 100)
  )
);

CREATE INDEX idx_promotions_room_type ON promotions(room_type_id);
CREATE INDEX idx_promotions_dates     ON promotions(start_date, end_date);
CREATE INDEX idx_promotions_featured  ON promotions(is_featured) WHERE is_featured = TRUE;
```

### 1.2 Backend API Endpointlari

#### A. Hamkor o'z chegirmalarini boshqarishi

| Method | URL | Kim uchun | Nima qiladi |
|--------|-----|-----------|-------------|
| `GET` | `/partner/promotions` | PARTNER | O'zining barcha chegirmalarini ko'rish |
| `POST` | `/partner/promotions` | PARTNER | Yangi chegirma yaratish |
| `PATCH` | `/partner/promotions/:id` | PARTNER | Chegirmani tahrirlash |
| `DELETE` | `/partner/promotions/:id` | PARTNER | Chegirmani o'chirish (soft-delete) |

**`POST /partner/promotions` — Request Body:**
```json
{
  "roomTypeId": "uuid",
  "discountType": "percent",
  "discountValue": 30,
  "startDate": "2026-10-01",
  "endDate": "2026-10-15"
}
```

**`POST /partner/promotions` — Validatsiya Qoidalari (Backend):**
- `discountType = "percent"` bo'lsa: `discountValue` 1–100 oralig'ida bo'lishi shart.
- `discountType = "fixed"` bo'lsa: `discountValue` xona narxidan oshib ketmasligi shart.
- `startDate` bugundan kechiktirilmasligi shart.
- `endDate >= startDate` bo'lishi shart.
- **Bir xona uchun sanalari bir-biriga to'qnash keladigan ikkinchi aktiv chegirma bo'lmasligi shart** (DB Constraint yoki Service Layer validatsiyasi).

#### B. Hotel API'ga chegirma hisob-kitobi qo'shish (MUHIM!)

`GET /hotels/:slug` response'dagi `room_types` massiviga quyidagi maydonlarni qo'shish kerak:

```json
{
  "rooms": [
    {
      "id": "uuid",
      "name": "Standart",
      "capacity": 2,
      "available": 3,
      "basePriceSum": 400000,
      "discountAmount": 120000,
      "discountPercent": 30,
      "priceSum": 280000,
      "promotionId": "uuid",
      "promotionEndsAt": "2026-10-15"
    }
  ]
}
```

**Hisob-kitob logikasi (Backend Service):**
```
Bugungi sana promotions jadvalida startDate <= today <= endDate va
status = 'active' shartiga to'g'ri keladigan eng katta chegirmani toping.

Agar percent:
  discountAmount = ROUND(basePriceSum * discountValue / 100)
  priceSum = basePriceSum - discountAmount

Agar fixed:
  discountAmount = discountValue
  priceSum = basePriceSum - discountValue

Agar chegirma yo'q:
  discountAmount = 0
  priceSum = basePriceSum
```

#### C. CMS Bosh Sahifa uchun Endpoint (`/cms/offers`) Avtomatlashtirilishi

`/cms/offers` so'rov kelganda backend quyidagilarni bajaradi:
1. `promotions` jadvalidan `is_featured = TRUE` yoki `discount_value >= 20` (threshold sozlanadi) bo'lgan, sanasi hali tugamagan 8 ta eng yaxshi chegirmani oladi.
2. Ularning xona rasmini, narxini hisoblaydi va standart `DealView` formatida qaytaradi.

> [!IMPORTANT]
> `name` maydoniga **xona nomi emas, mehmonxona nomi** kiritilishi shart! Kartochka mehmonxona sahifasiga olib o'tadi.

#### D. Admin Panel uchun (ixtiyoriy, keyinroq)

| Method | URL | Kim uchun | Nima qiladi |
|--------|-----|-----------|-------------|
| `GET` | `/admin/promotions` | ADMIN | Barcha chegirmalar + filtrlar |
| `PATCH` | `/admin/promotions/:id/feature` | ADMIN | Bosh sahifaga chiqarish/yashirish |
| `DELETE` | `/admin/promotions/:id` | ADMIN | Istalganini o'chirish |

---

## 🟡 2. PARTNER PANEL Developer (`apps/web-partner`)

### 2.1 Yangi Sahifalar

```
apps/web-partner/
  app/[lang]/
    promotions/
      page.tsx          ← Chegirmalar ro'yxati jadvali
      new/
        page.tsx        ← Yangi chegirma yaratish formi
      [id]/edit/
        page.tsx        ← Tahrirlash formi
  components/features/promotions/
    PromotionList.tsx
    PromotionForm.tsx
    PromotionStatusBadge.tsx
    PromotionConflictAlert.tsx
```

### 2.2 `PromotionForm` — Forma Maydonlari

| Maydon | UI Element | Validatsiya |
|--------|-----------|-------------|
| **Xona tanlash** | `<Select>` (faqat o'z xonalari) | Required |
| **Chegirma turi** | `<RadioGroup>` (Foiz / Fixed so'm) | Required |
| **Chegirma miqdori** | `<Input type="number">` | 1–100 (foiz), 1–narx (fixed) |
| **Boshlanish sanasi** | `<DatePicker>` | ≥ bugun |
| **Tugash sanasi** | `<DatePicker>` | ≥ boshlanish |
| **Bosh sahifada ko'rsatish** | `<Checkbox>` | Ixtiyoriy |
| **Maxsus rasm** | `<ImageUploader>` | Ixtiyoriy (JPG/PNG, max 2MB) |

**Real-vaqt hisob (UX):** Chegirma foizi o'zgarganda, forma ichida yangi narxni darhol hisoblaydi va ko'rsatadi.

### 2.3 `PromotionList` — Jadval Ko'rinishi

| Xona | Chegirma | Muddat | Holati | Amallar |
|------|---------|--------|--------|---------|
| Standart (2 kishi) | -30% → 280,000 so'm | 01-Oct – 15-Oct | 🟢 Aktiv | Tahrirlash / O'chirish |
| Lux Suite | -50,000 so'm → 350,000 so'm | 20-Oct – 31-Oct | ⏸ To'xtatilgan | Faollashtirish |

### 2.4 UX Qoidalari

- Forma submit bo'lishidan **oldin** sana to'qnashuvi tekshirilsin.
- Agar to'qnashsa — modal ogohlantirish: *"Bu xona uchun bu sanalarda chegirma allaqachon mavjud."*
- `status = paused` ga o'tkazish imkoniyati bo'lishi kerak (o'chirmasdan).

---

## 🟢 3. WEB-USER Developer (`apps/web-user`)

### 3.1 `packages/api-client/src/types.ts` — RoomTypeView yangilash

> [!WARNING]
> Bu fayl faqat Backend endpoint tayyor bo'lgandan keyin yangilanadi. Backend developerdan tayyor ekanini so'rab oling.

```typescript
// YANGI RoomTypeView (hozirgi bilan to'liq mos keladi, yangi maydonlar qo'shiladi):
export interface RoomTypeView {
  id: string;
  name: string;
  capacity: number;
  available: number;

  // Narx (Backend hisoblaydi, Frontend FAQAT ko'rsatadi)
  basePriceSum: number;       // Asl narx (hech qachon o'zgarmaydi)
  discountAmount: number;     // 0 = chegirma yo'q
  discountPercent: number;    // 0 = chegirma yo'q
  priceSum: number;           // To'lanadigan yakuniy narx

  // FOMO UI uchun
  promotionId?: string;
  promotionEndsAt?: string;   // ISO date string
}
```

### 3.2 `RoomList.tsx` — FOMO Badge (Qo'shilishi kerak)

`RoomList.tsx` da chegirma ko'rsatish allaqachon qisman tayyor.
Backend `promotionEndsAt` maydoni qo'shilgandan keyin quyidagi badge qo'shilsin:

```tsx
{room.promotionEndsAt && (
  <span className="inline-flex items-center gap-1 rounded-full border border-orange-200 px-2.5 py-0.5 text-[10px] font-medium text-orange-600">
    <Clock className="size-3" />
    {new Date(room.promotionEndsAt).toLocaleDateString(locale)} gacha
  </span>
)}
```

### 3.3 `DealsSection.tsx` — Bosh sahifa

Bu komponent **allaqachon to'liq tayyor!** Backend `/cms/offers` endpointini yangilasa, avtomatik ishlaydi. Hech qanday o'zgartirish kerak emas.

---

## ✅ Ish Tartibi (Implementation Order)

```
1. Backend: promotions jadvali va migratsiya
2. Backend: CRUD endpointlari (/partner/promotions)
3. Partner panel: Forma va ro'yxat sahifasi
4. Backend: /hotels/:slug xona narxiga chegirmani qo'shish
5. Backend: /cms/offers avtomatlashtirilishi
6. Web-user: RoomTypeView typini yangilash (types.ts)
7. Web-user: FOMO badge qo'shish (promotionEndsAt)
8. QA: Barcha stsenariylarni test qilish
```

---

## 🧪 Test Stsenariylari (QA uchun)

| Stsenariy | Kutilgan Natija |
|-----------|----------------|
| Chegirma sanasi bugun tugaydi | "Bugun tugaydi!" badge ko'rsatilsin |
| 100% chegirma | Backend bloklasin (validation xatosi) |
| Bir xonaga ikki chegirma sanalari to'qnashadi | Partner panelda aniq xato xabar |
| Chegirma muddati o'tgan | `status = expired`, bosh sahifadan avtomatik tushsin |
| Bosh sahifadagi kartochka nomi | Mehmonxona nomi (xona nomi emas!) |
| `fixed` chegirma xona narxidan katta | Backend bloklasin |
