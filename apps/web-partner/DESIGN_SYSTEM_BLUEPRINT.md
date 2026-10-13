# Safaar Partner PMS & Extranet — Design System & UI/UX Blueprint
**Loyiha:** `@safaar/web-partner` (`partner.safaar.uz`)  
**Muallif:** Staff Product Designer & Principal UI/UX Architect  
**Versiya:** 1.0.0 (Production Master Specification)  
**Texnologik Stack:** Next.js 16 (App Router), React 19, TypeScript 5, Tailwind CSS v4, Zustand v5, TanStack Query v5, Lucide Icons, Sonner.

---

## Mundarija

1. [Executive Product Vision & Design Philosophy](#1-executive-product-vision--design-philosophy)
   - 1.1. Kontekst va O'zbekiston Mehmondo'stlik Bozori
   - 1.2. Front-Desk Psixologiyasi va Ekran Ergonomikasi (8-12 Soatlik Smena)
   - 1.3. "Clean Operational Velocity": Stripe, Linear, Airbnb va Booking Pulse Sintezi
   - 1.4. Nol Ortiqcha Harakat (Zero Wasted Motion) Qoidasi
2. [Design Tokens & Visual Language (Tailwind CSS v4 Mos)](#2-design-tokens--visual-language-tailwind-css-v4-mos)
   - 2.1. Ranglar Palitrasi (Brand, Surface, Border, Semantika)
   - 2.2. Tipografiya Ierarxiyasi va Tabular Numbers (`tabular-nums`)
   - 2.3. Radius, Shadow va Surface Elevation Tizimi
   - 2.4. Tayyor Tailwind v4 `@theme` va CSS O'zgaruvchilari
3. [Layout & Navigation Architecture](#3-layout--navigation-architecture)
   - 3.1. Collapsible Floating Sidebar (240px <-> 64px)
   - 3.2. Command Header & Topbar (Multi-property, Global Search, Socket Health)
   - 3.3. Contextual Quick Drawer (480px O'ng Operatsion Panel)
4. [Asosiy Modullar uchun Batafsil UI/UX Blueprint](#4-asosiy-modullar-uchun-batafsil-uiux-blueprint)
   - 4.1. Front Desk Cockpit (Bosh Sahifa Radari & KPI Spidometri)
   - 4.2. Interactive Timeline Calendar (Xonalar & Sanalar Bo'yicha Grid)
   - 4.3. High-Density Reservations & Guest CRM
   - 4.4. Rooms & Housekeeping Matrix (Xona Plitkalari & Tozalash Oqimi)
   - 4.5. Finance & Revenue Cockpit (Tushum, Komissiya va Yechib Olish)
5. [Multi-Tenant Polimorfizm Dizayni (`getPartnerLabels`)](#5-multi-tenant-polimorfizm-dizayni-getpartnerlabels)
   - 5.1. Dinamik Domen Terminologiyasi va Taqqoslash Matritsasi
   - 5.2. Obyekt Turiga Qarab UI Layout Transformatsiyasi
6. [Micro-interactions, A11y (WCAG 2.1 AA) & Keyboard Shortcuts](#6-micro-interactions-a11y-wcag-21-aa--keyboard-shortcuts)
   - 6.1. Hotkeys Xaritasi (Linear-style Klaviatura Boshqaruvi)
   - 6.2. WCAG 2.1 AA Qoidalari, Kontrast Matritsasi va Focus Ringlar
   - 6.3. Micro-interactions, Toast Bildirishnomalar va Skeleton Holatlar
7. [Bosqichma-bosqich Tadbiq qilish Yo'l xaritasi (Implementation Roadmap)](#7-bosqichma-bosqich-tadbiq-qilish-yol-xaritasi-implementation-roadmap)
   - 7.1. 1-Bosqich: Shell & Navigation (Sidebar, Topbar, Badges, Tokens)
   - 7.2. 2-Bosqich: Front Desk Cockpit & Occupancy Widget
   - 7.3. 3-Bosqich: Reservations Table & Quick Drawer
   - 7.4. 4-Bosqich: Timeline Calendar & Housekeeping Matrix

---

## 1. Executive Product Vision & Design Philosophy

### 1.1. Kontekst va O'zbekiston Mehmondo'stlik Bozori
Safaar Hamkor Kabineti (`partner.safaar.uz`) — shunchaki an'anaviy ma'muriy boshqaruv paneli (CRUD admin dashboard) emas. Bu O'zbekistonning mehmondo'stlik va turizm ekotizimida xizmat ko'rsatuvchi tadbirkorlar uchun **markaziy operatsion tizim (Property Management System & Extranet)** hisoblanadi.

O'zbekiston bozori o'ziga xos xilma-xil sub'ektlardan iborat:
- **Toshkent, Samarqand, Buxoro va Xiva**: 20 dan 300 tagacha xonaga ega zamonaviy biznes mehmonxonalar, butik va an'anaviy milliy mehmon uylari.
- **Sayyohlik markazlaridagi hostellar**: Dormitory xonalar, yotoq (bed) darajasida bron qilinadigan dinamik joylar.
- **Chorvoq, Chimyon, Bo'stonliq dam olish zonalari**: Butun boshli kottej yoki hovli sifatida ijaraga beriladigan xususiy dachalar (dam olish maskanlari).
- **Shahar va viloyat miqyosidagi restoranlar / choyxonalar**: Stol va vaqt-slotlari (time-slots) asosida band qilinadigan gastronomiya maskanlari.
- **Transport va avtomobil ijarasi kompaniyalari**: Mashinalar parki va davlat raqami asosida beriladigan transport vositalari.

Ushbu platforma yuqoridagi barcha xizmat turlarini yagona standartdagi yuqori darajadagi dizayn tili bilan qamrab olishi, ayni paytda har bir biznes domenining o'z tilida gaplashishi shart.

### 1.2. Front-Desk Psixologiyasi va Ekran Ergonomikasi (8-12 Soatlik Smena)
Front-desk ma'murlari (receptionistlar va dispecherlar) bir kunda uzluksiz **8 dan 12 soatgacha** ekran qarshisida o'tiradi. Ularning ish muhiti doimiy kognitiv yuklama bilan kechadi:
- **Tashqi stress omillari**: Kirib kelgan mehmon kutib turishi, jiringlayotgan telefon, kassa va to'lov terminallari bilan ishlash, pasport ma'lumotlarini kiritish.
- **Xatolik qiymati o'ta yuqori**: 1 ta noto'g'ri bosish yoki noaniq belgi **overbooking** (bir xonaga ikki mehmon tushib qolishi) holatini keltirib chiqaradi, bu esa brend obro'siga va daromadiga to'g'ridan-to'g'ri zarba beradi.
- **Ko'z toliqishi va vizual shovqin**: Och oq yoki ortiqcha to'yingan ranglar, yorqin gradientlar, chalkash animatsiyalar 2-3 soatdan so'ng ko'z qizarishi va diqqatning pasayishiga olib keladi.

> [!IMPORTANT]
> **Ergonomik Talab:**
> 1. Fon rangi mutlaq oq (`#FFFFFF`) emas, balki ko'zga mayin `Slate-50` (`#F8FAFC`) qatlamida quriladi.
> 2. Barcha matn va chegara kontrastlari WCAG 2.1 AA darajasidan yuqori (kamida 4.5:1) bo'lishi ta'minlanadi.
> 3. Har bir axborot bloki aniq vizual zanjirga ega: Holat rangi (Status Badge) -> Xona raqami -> Mehmon ismi -> To'lov balansi.

### 1.3. "Clean Operational Velocity": To'rt Global Ekvivalent Sintezi
Biz Safaar Partner interfeysini jahonning eng ilg'or to'rtta mahsulotining kuchli fazilatlarini birlashtirgan holda loyihalashtiramiz:

```
  ┌─────────────────────────────────────────────────────────────┐
  │                 CLEAN OPERATIONAL VELOCITY                  │
  └──────────────────────────────┬──────────────────────────────┘
                                 │
     ┌──────────────────┬────────┴─────────┬──────────────────┐
     ▼                  ▼                  ▼                  ▼
┌──────────┐      ┌──────────┐       ┌───────────┐      ┌───────────┐
│  LINEAR  │      │  STRIPE  │       │  AIRBNB   │      │  BOOKING  │
│ Velocity │      │ Density  │       │   Host    │      │   Pulse   │
├──────────┤      ├──────────┤       ├───────────┤      ├───────────┤
│• 0ms UI  │      │• Tabular │       │• Warmth   │      │• Urgent   │
│• Hotkeys │      │• Subtle  │       │• Guest-   │      │  action   │
│• Command │        borders  │         first     │      │• Realtime │
│  Palette │      │• Clarity │       │• Humans   │      │  radar    │
└──────────┘      └──────────┘       └───────────┘      └───────────┘
```

1. **Linear Velocity**:
   - Klaviaturadan bir zumda buyruqlar berish (`Ctrl + K`, `N`, `C`, `Esc`).
   - Sahifani to'liq qayta yuklamasdan kontekstni saqlab qoluvchi o'ng tomondagi **Quick Drawer** (Right Sheet).
   - Instant optimistic updates — harakat amalga oshirilishi bilan interfeys kutmasdan javob qaytaradi.
2. **Stripe Operational Density**:
   - Pul birliklari, sanalar va qoldiqlar uchun qat'iy `tabular-nums` ustunlari.
   - Ultra-nozik 1px chegaralar (`border-slate-200/80`), ortiqcha bezaklardan xoli toza ma'lumot qatlamlari.
   - Aniqlik va moliyaviy ishonchlilik hissi.
3. **Airbnb Host Simplicity**:
   - Insoniylik va mehmondo'stlik: mehmonga qo'ng'iroq qilish, uning maxsus istaklari (allergiya, sokin xona, transfer) bitta nigohda ko'rinadi.
   - Tushunarli O'zbek tilidagi mikro-matnlar (micro-copy).
4. **Booking.com Pulse Urgency**:
   - Front Desk Cockpit radari: "Bugun 4 ta kelish, 2 ta to'lanmagan ketish, 1 ta kutayotgan bron".
   - Bir bosishda harakat: "Tasdiqlash", "Check-in", "Check-out".

### 1.4. Nol Ortiqcha Harakat (Zero Wasted Motion) Qoidasi
Har qanday muhim operatsiyani amalga oshirishda bosishlar (clicks) soni minimal bo'lishi shart:
- **Mehmonni kutib olish (Check-in)**: 1 bosish (yoki `C` tugmasi) -> Xona kalitini biriktirish -> Tasdiqlash.
- **Yangi bron (Walk-in)**: `N` tugmasi -> Mehmon ismi, telefon, xona tanlash -> `Enter` (3 soniya).
- **Xonani tozalangan deb belgilash**: Xona kartasida tozalash belgisiga 1 bosish.
- **Drawer yopish**: `Esc` tugmasi.

---

## 2. Design Tokens & Visual Language (Tailwind CSS v4 Mos)

Dizayn tizimi Tailwind CSS v4 arxitekturasi talablariga to'liq javob beradi: `@theme` bloklari orqali deklarativ tokenlar va CSS o'zgaruvchilari asosida qatlamlangan ranglar.

### 2.1. Ranglar Palitrasi (Color Tokens)

#### A. Asosiy Brend Rangi (Royal Sapphire Blue)
Safaar brendining ishonchli, xalqaro bank va aviakompaniyalar darajasidagi chuqur ko'k tuslari:
- `brand-50`: `#EFF6FF` — Faol menyu foni, nozik selektorlar
- `brand-100`: `#DBEAFE` — Chip va badge fonlari
- `brand-200`: `#BFDBFE` — Aktivlashtirilgan chegaralar
- `brand-300`: `#93C5FD` — Focus indicator rings
- `brand-400`: `#60A5FA` — Dark mode ikonkalari
- `brand-500`: `#3B82F6` — Interaktiv yordamchi elementlar
- `brand-600`: `#2563EB` — **Asosiy harakat tugmalari (CTA)**, faol havolalar
- `brand-700`: `#1D4ED8` — Tugma hover holati, asosiy indikator kapsulalari
- `brand-800`: `#1E40AF` — Sarlavhalar va diqqat markazlari
- `brand-900`: `#1E3A8A` — Chuqur brend elementlari

#### B. Sirt Qatlamlari (Surface Hierarchy)
Ekran qatlamlari chuqurlik va funksional darajalar bo'yicha ajratilgan:

| Qatlam Nomi | Light Mode HEX | Dark Mode HEX | Vazifasi va Qo'llanilishi |
|---|---|---|---|
| **App Canvas** (`--background`) | `#F8FAFC` (Slate-50) | `#0B0F17` (Deep Obsidian) | Butun ilovaning asosiy foni, ko'z qamashtirmaydi |
| **Card Surface** (`--surface`) | `#FFFFFF` (Pure White) | `#131923` (Layer 1 Surface) | Asosiy kartalar, jadvallar, sidebar |
| **Muted Surface** (`--surface-muted`) | `#F1F5F9` (Slate-100) | `#1A2230` (Layer 2 Surface) | Inputlar foni, jadval sarlavhasi (th), sub-bloklar |
| **Hover Surface** (`--surface-hover`) | `#E2E8F0` / 60% | `#222D3E` | Hover qilingan satrlar, tugmalar |
| **Overlay / Sheet** (`--surface-overlay`) | `#FFFFFF` | `#161E2C` | Quick Drawer, Dialoglar, Popoverlar |
| **Backdrop** | `rgba(15, 23, 42, 0.45)` | `rgba(0, 0, 0, 0.70)` | Modallar orqasidagi `backdrop-blur-sm` foni |

#### C. Chegara Skalasi (Border Tokens)
- `--border`: Light `#E2E8F0` (Slate-200), Dark `#232E3F` — Barcha 1px ajratuvchi chiziqlar.
- `--border-strong`: Light `#CBD5E1` (Slate-300), Dark `#334155` — Input va faol element chegaralari.
- `--border-subtle`: Light `#F1F5F9`, Dark `#1A2230` — Ichki nozik chiziqlar.

#### D. Semantik Status Ranglari (Extranet & PMS Maxsus)
Har bir bron va xona holati o'zining qat'iy standart rangiga ega. Bu ranglar barcha modullarda (bosh sahifa, kalendar, jadval, drawer) 100% bir xil ma'noni anglatadi:

| Holat (Status) | Light Matn / Ikonka | Light Fon | Dark Matn | Dark Fon | Ma'nosi |
|---|---|---|---|---|---|
| **CONFIRMED** | `#059669` (Emerald-600) | `#ECFDF5` (Emerald-50) | `#34D399` | `#064E3B`/40% | Tasdiqlangan, kelishi kutilmoqda |
| **IN_HOUSE** | `#2563EB` (Blue-600) | `#EFF6FF` (Blue-50) | `#60A5FA` | `#1E3A8A`/40% | Mehmon hozir xonada istiqomat qilmoqda |
| **PENDING** | `#D97706` (Amber-600) | `#FFFBEB` (Amber-50) | `#FBBF24` | `#78350F`/40% | Yangi bron, tasdiqlash kutilmoqda |
| **DEPARTED** | `#475569` (Slate-600) | `#F1F5F9` (Slate-100) | `#94A3B8` | `#1E293B`/50% | Chiqib ketgan (Check-out qilingan) |
| **CANCELLED** | `#E11D48` (Rose-600) | `#FFF1F2` (Rose-50) | `#FB7185` | `#881337`/40% | Bekor qilingan yoki kelmagan (No-show) |
| **CLEANING / DIRTY** | `#7C3AED` (Violet-600) | `#F5F3FF` (Violet-50) | `#A78BFA` | `#4C1D95`/40% | Tozalanmoqda yoki tozalash talab etiladi |
| **OUT_OF_SERVICE** | `#DC2626` (Red-600) | `#FEF2F2` (Red-50) | `#F87171` | `#7F1D1D`/40% | Ta'mirda yoki bloklangan (Blackout) |

### 2.2. Tipografiya Ierarxiyasi, Shrift Tanlovi va Tabular Numbers (`tabular-nums`)

Front-desk PMS va Extranet tizimlarida tipografiya shunchaki estetika emas, balki **ma'lumotlarni o'qish tezligi va xatolik darajasini nolga tushirish instrumentidir**.

#### A. Shriftlar Soni va Core Web Vitals Strategiyasi (Nega Maksimal 1-2 ta Font?)
Ko'pgina loyihalarda sarlavha uchun bitta, asosiy matn uchun ikkinchi, sonlar uchun uchinchi, marketing uchun to'rtinchi shrift yuklanishi kuzatiladi. SaaS dashboardlarida bu **qo'pol arxitektura xatosi (Anti-pattern)** hisoblanadi:

1. **Web Vitals va LCP (Largest Contentful Paint)**:
   - Har bir qo'shimcha font oilasi (4 ta og'irlikda) o'rtacha 80–120 KB WOFF2 fayllarini talab qiladi.
   - Front-desk xodimining zaif internet tezligida har bir millisekund qimmatlidir. Ortiqcha shriftlar LCP ko'rsatkichini 2.5 soniyadan oshirib yuboradi.
2. **FOUT (Flash of Unstyled Text) va CLS (Cumulative Layout Shift)**:
   - Shrift kechikib yuklanganda brauzer avval tizim shriftini (Arial/Times), so'ngra yangi shriftni chizadi. Natijada jadvaldagi xona raqamlari va ustunlar sakrab ketadi (`CLS > 0.1`).
   - Front-desk xodimi aynan o'sha soniyada noto'g'ri xonani bosib yuborishi va overbooking keltirib chiqarishi mumkin.
3. **Qat'iy Qoida**:
   - Safaar Partner panelida **faqat 2 ta font oilasi** qo'llaniladi:
     * **Asosiy UI Shrifti (Primary Sans)**: Butun interfeys, sarlavhalar, matnlar, tugmalar va jadvallar uchun.
     * **Monospace Shrifti (Mono)**: Faqat texnik identifikatorlar (API keys, Booking Hash, Tranzaksiya raqamlari).

#### B. Tavsiya Etilgan Shriftlar va O'zbek Tili Gliflari Tahlili

##### 1-Tavsiya (Asosiy): `Geist Sans` (Next.js 16 va Vercel Standarti)
- **Nega tanlandi**: Vercel va Linear dizaynerlari tomonidan aynan zamonaviy axborot-zich B2B interfeyslar uchun yaratilgan.
- **Geometriyasi**: Baland x-height, qat'iy vertikal o'q, ochiq aperturalar (harflar teshiklari). Kichik `11px - 13px` o'lchamlarda ham xiralashmaydi.
- **Next.js 16 integratsiyasi**: `next/font/google` orqali nol-layout-shift bilan avtomatik o'z serverida (self-hosted) saqlanadi va pre-load qilinadi.

##### 2-Tavsiya (Mukammal Muqobil): `Inter` (Rasmus Andersson)
- Dunyodagi eng sinovdan o'tgan, de-fakto B2B SaaS standarti (GitHub, Linear, Stripe tomonidan foydalanilgan).

##### Nega `Plus Jakarta Sans` yoki `Poppins` emas?
- Plus Jakarta Sans va Poppins geometrik, yumaloq va keng (wide horizontal metrics) shriftlar hisoblanadi. Ular marketing landing sahifalarida jozibali ko'rinsa-da, yuqori zichlikdagi PMS jadvallarida 1 satrga kamroq ma'lumot sig'adi va xodim ko'zini ortiqcha toliqtiradi.

##### O'zbek Tili Gliflari va Kirill/Lotin Alifbosi Talablari:
O'zbekistondagi mehmonxonalarda ma'lumotlar ikki xil alifboda kelib tushadi:
- **Lotin yozuvi**: O'zbek tiliga xos bo'lgan `oʻ`, `gʻ`, `sh`, `ch` harflari. Ayniqsa teskari vergul / tutuq belgisi (`ʻ` — U+02BB modifier letter turned comma yoki `’` — U+2018 / U+0027) ko'plab sifatsiz shriftlarda harf ustiga minib qoladi yoki oraliqda katta bo'shliq qoldiradi. Geist Sans va Inter ushbu gliflar kerningini (harflar oralig'ini) 100% to'g'ri ta'minlaydi.
- **Kirill yozuvi**: Ko'plab mehmonlar pasporti va mahalliy hujjatlar kirillda kiritiladi ("Қодиров Алишер", "Ғаниев", "Ҳамидов").
- **Talab**: `layout.tsx`da shrift yuklanayotganda `subsets: ["latin", "latin-ext", "cyrillic"]` parametri majburiy ko'rsatiladi:
```tsx
// apps/web-partner/app/layout.tsx
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "latin-ext", "cyrillic"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});
```

#### C. Raqamlar, Valyuta (UZS) va Sanalar uchun Tabular Numbers (`tabular-nums`)

##### Nega Raqamlar uchun Alohida Shrift Ishlatilmaydi?
Ba'zi dasturchilar raqamlar uchun alohida raqamli shrift yuklashadi. Bu **noto'g'ri**:
- Raqam va matn o'rtasida gorizontal asosiy chiziq (baseline) siljishi paydo bo'ladi.
- "14 kecha" yoki "1,500,000 UZS" yozilganda, raqam va "kecha" so'zi ikki xil uslubda ko'rinib, estetik buzilish keltirib chiqaradi.

##### To'g'ri Yechim: OpenType `tabular-nums` (`tnum`) Xususiyati
Geist Sans va Inter shriftlari o'z ichida to'liq OpenType xususiyatlariga ega.
Proportsional shriftlarda "1" raqami eni bo'yicha "8" yoki "0" dan sezilarli darajada ingichkadir:
- Proportsional: `111,111` torroq, `888,888` esa kengroq joy egallaydi. Natijada vertikal jadvalda o'ngga tekislangan sonlar to'lqinsimon bo'lib qoladi.
- **Tabular (`tnum`)**: Har bir raqam (0 dan 9 gacha) qat'iy bir xil enli blokda turadi. Barcha nuqta, vergul va bo'shliqlar ustun bo'ylab mukammal tekislanadi.

```css
/* Globals CSS qoidasi: Tabular numbers va glif ajratish */
.tabular-nums,
.font-tabular,
td.amount,
td.date-cell,
.metric-value {
  font-variant-numeric: tabular-nums;
  /* Geist/Inter maxsus glif xususiyatlari:
     cv02/cv03: '1' va 'l' (kichik L), 'I' (katta i) ni ajratish
     cv11: '0' (nol) ichiga nuqta/chiziq qo'yish (O harfidan ajratish) */
  font-feature-settings: "cv02" 1, "cv03" 1, "cv04" 1, "cv11" 1, "tnum" 1;
}
```

##### Jadvalda Taqqoslash:
```
Proportsional (XATO):        Tabular Numbers (TO'G'RI - SAFAAR STANDARTI):
1,111,000 UZS                1,111,000 UZS
  888,888 UZS                  888,888 UZS
14,250,000 UZS               14,250,000 UZS
  (Sonlar surilib ketadi)       (Barcha vergul va xonalar tekis!)
```

#### D. Qat'iy 4 ta Font Weight va To'liq Type Scale Matritsasi

Ortiqcha weight'lar (Thin 100, ExtraLight 200, Light 300, ExtraBold 800, Black 900) olib tashlanadi. Ilovada **faqat 4 ta vazn** qo'llaniladi:
- **`400` (Regular)**: Ikkilamchi matnlar, tavsiflar, table cell oddiy qiymatlari.
- **`500` (Medium)**: Jadval asosiy ma'lumotlari, mehmon ismlari, input matnlari, navigatsiya elementlari.
- **`600` (SemiBold)**: Tugma matnlari, kartalar sarlavhasi, status nishonlari, muhim aksentlar.
- **`700` (Bold)**: Katta KPI ko'rsatkichlari, sahifa bosh sarlavhalari, umumiy tushum summasi.

##### To'liq Tipografiya Skalasi Matritsasi:

| Token Nomi | Hajmi (rem / px) | Qator Balandligi (Line-Height) | Harflar Oralig'i (Letter-Spacing) | Ruxsat Etilgan Vazn | PMS / Extranet Kontekstidagi Qo'llanilishi |
|---|---|---|---|---|---|
| **Display Hero** | `1.875rem` (30px) | `2.25rem` (36px) | `-0.025em` (`tracking-tight`) | `Bold (700)` | Asosiy daromad va oylik tushum ko'rsatkichlari |
| **Metric KPI** | `1.5rem` (24px) | `1.75rem` (28px) | `-0.02em` | `Bold (700) + tnum` | Bandlik foizi (`84%`), Bugungi kelishlar soni |
| **Page Title** | `1.25rem` (20px) | `1.625rem` (26px)| `-0.015em` | `SemiBold (600)` | Sahifa asosiy sarlavhasi ("Front Desk Cockpit") |
| **Section Title**| `1.0rem` (16px) | `1.375rem` (22px)| `-0.01em` | `SemiBold (600)` | Karta sarlavhalari, Dialog va Drawer sarlavhalari |
| **Subhead / UI** | `0.875rem` (14px) | `1.25rem` (20px) | `0` | `Medium (500)` | Tugmalar, Dropdown menyular, Form label'lari |
| **Body Regular** | `0.875rem` (14px) | `1.375rem` (22px)| `0` | `Regular (400)` | Tushuntirish matnlari, bildirishnoma tavsiflari |
| **Table Cell** | `0.8125rem` (13px)| `1.125rem` (18px)| `0` | `Regular (400) / Medium (500) + tnum` | Yuqori zichlikdagi bronlar jadvali satrlari |
| **Status / Tag** | `0.6875rem` (11px)| `0.875rem` (14px)| `+0.025em` (`tracking-wider`)| `SemiBold (600) uppercase` | Holat nishonlari (`CONFIRMED`, `IN_HOUSE`), Manba |
| **Monospace ID** | `0.75rem` (12px) | `1.0rem` (16px)  | `0` | `Medium (500) font-mono` | Bron ID (`#BK-9021`), Tranzaksiya raqami |

### 2.3. Radius, Shadow va Surface Elevation Tizimi

- **Border Radius**:
  - `rounded-md` (`6px`): Ikonkalar qutisi, sub-badge'lar.
  - `rounded-lg` (`8px`): Standart Buttonlar, Inputlar, Select komponentlari.
  - `rounded-xl` (`12px`): Kartalar, jadval konteynerlari, KPI bloklari.
  - `rounded-2xl` (`16px`): Quick Drawer, Modallar, Onboarding bannerlari.
  - `rounded-full` (`9999px`): Status pufakchalari, avatarlar, scrollbarlar.
- **Soyalar (Shadow Scale)**:
  - `shadow-2xs`: `0 1px 2px 0 rgba(15, 23, 42, 0.03)` — Oddiy kartalar va satrlar uchun tekis, zamonaviy ko'rinish.
  - `shadow-xs`: `0 1px 3px 0 rgba(15, 23, 42, 0.06)` — Hover qilingan kartalar.
  - `shadow-md`: `0 4px 12px -2px rgba(15, 23, 42, 0.08)` — Popoverlar, dropdown menyular.
  - `shadow-2xl`: `0 25px 50px -12px rgba(15, 23, 42, 0.25)` — 480px Quick Drawer va markaziy dialoglar.

### 2.4. Tayyor Tailwind v4 `@theme` va CSS O'zgaruvchilari

Quyidagi kod bloki `apps/web-partner/app/globals.css` uchun to'liq moslashtirilgan spetsifikatsiyadir:

```css
@import "tailwindcss";

@custom-variant dark (.dark &);

@theme {
  --color-brand-50: #eff6ff;
  --color-brand-100: #dbeafe;
  --color-brand-200: #bfdbfe;
  --color-brand-300: #93c5fd;
  --color-brand-400: #60a5fa;
  --color-brand-500: #3b82f6;
  --color-brand-600: #2563eb;
  --color-brand-700: #1d4ed8;
  --color-brand-800: #1e40af;
  --color-brand-900: #1e3a8a;

  /* Semantik statuslar */
  --color-status-confirmed: #059669;
  --color-status-inhouse: #2563eb;
  --color-status-pending: #d97706;
  --color-status-departed: #475569;
  --color-status-cancelled: #e11d48;
  --color-status-cleaning: #7c3aed;

  /* Radius */
  --radius-button: 0.5rem;
  --radius-card: 0.75rem;
  --radius-modal: 1rem;

  /* Shriftlar */
  --font-sans: var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-mono: var(--font-geist-mono), monospace;
}

:root {
  --background: #f8fafc;
  --foreground: #0f172a;
  --surface: #ffffff;
  --surface-muted: #f1f5f9;
  --surface-hover: #e2e8f0;
  --border: #e2e8f0;
  --border-strong: #cbd5e1;
  --muted-foreground: #64748b;
  --accent-blue: #2563eb;
}

.dark {
  --background: #0b0f17;
  --foreground: #f8fafc;
  --surface: #131923;
  --surface-muted: #1a2230;
  --surface-hover: #222d3e;
  --border: #232e3f;
  --border-strong: #334155;
  --muted-foreground: #94a3b8;
  --accent-blue: #3b82f6;
}
```

---

## 3. Layout & Navigation Architecture

Ilovaning boshqaruv ramkasi (App Shell) 3 ta asosiy koordinatadan iborat:
1. Chapda: **Collapsible Floating Sidebar** (240px kengaytirilgan / 64px ixcham).
2. Yuqorida: **Command Header & Topbar** (56px fiksirlangan, `z-20`).
3. O'ngda: **Quick Drawer (Right Sheet)** (480px, fiksirlangan, `z-50`).

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ TOPBAR (56px)                                                                                          │
│ [Logo] [Property Switcher ▼]       [ 🔍 Ctrl+K Command Palette ]     [● Jonli] [🔔] [Theme] [+ Yangi]  │
├──────────────┬─────────────────────────────────────────────────────────────────────────────────────────┤
│ SIDEBAR      │ MAIN CONTENT AREA (max-w-[1600px] mx-auto)                                              │
│ 240px / 64px │                                                                                         │
│              │ ┌─────────────────────────────────────────────────────────────────────────────────────┐ │
│ • Front Desk │ │ Bosh Sahifa / Kalendar / Jadvallar...                                               │ │
│ • Kalendar   │ │                                                                                     │ │
│ • Bronlar [3]│ │                                                                                     │ │
│ • Xonalar    │ │                                                                                     │ │
│ • Moliya     │ │                                                                                     │ │
│ • Sozlamalar │ └─────────────────────────────────────────────────────────────────────────────────────┘ │
│              │                                                                                         │
│ [v0.1 Safaar]│                                                       [QUICK DRAWER - 480px Context]    │
└──────────────┴─────────────────────────────────────────────────────────────────────────────────────────┘
```

### 3.1. Collapsible Floating Sidebar (240px <-> 64px)

Sidebar foydalanuvchining vizual kenglik talabiga qarab ikki rejimda ishlaydi:
- **Kengaytirilgan rejim (240px)**:
  - Yuqori qismda Safaar logotipi va hamkor roli (masalan: `MEHMONXONA`, `DACHA EGASI`).
  - Menyular guruhlanishi:
    - *OPERATSIYALAR*: Front Desk (Cockpit), Taqvim (Kalendar), Bronlar (jonli hisoblagich bilan).
    - *BOSHQARUV*: Xonalar / Obyektlar, Xizmatlar & E'lon (Listing), Sharhlar.
    - *MOLIYA VA SOZLAMALAR*: Moliya & Hisobotlar, Tashkilot rekvizitlari, Sozlamalar.
  - Faol element indikatori: Chap tomonda 4px enli `bg-brand-600` vertikal kapsula va element fonida `bg-brand-50` / `dark:bg-brand-900/30`.
- **Yig'ilgan rejim (64px Rail)**:
  - Keng monitorlarda yoki planshetlarda ish joyini maksimal darajada bo'shatadi.
  - Matnlar yashiriladi, faqat 20px Lucide piktogrammalari markazlashtiriladi.
  - Sichqoncha piktogrammaga borganda (hover) silliq ochiluvchi `Tooltip` (Label va mavjud bo'lsa hisoblagich ko'rinadi).
- **Jonli Hisoblagichlar (Live Counter Badges)**:
  - Kutilayotgan tasdiqlanmagan bronlar paydo bo'lganda `Bronlar` bo'limi yonida `Amber` yoki `Emerald` rangli jonli animatsiyali pufakcha (`3 ta`) yonib turadi.

### 3.2. Command Header & Topbar

Topbar front-desk xodimining har lahzada nazoratda turishini ta'minlovchi instrumentlar panelidir:
1. **Multi-Property Switcher (Chapda)**:
   - Agar bitta hamkor bir nechta obyektga ega bo'lsa (masalan: "Chorvoq Hills Dacha", "Boutique Hotel Samarkand"), u yuqori chap burchakdagi dropdown orqali sahifani yangilamasdan 1 soniyada boshqa obyektga o'tadi.
2. **Command Palette (`Ctrl + K` / `⌘K`)**:
   - Linear va macOS Spotlight uslubidagi markaziy qidiruv modali.
   - Istalgan joyda klaviaturada `Ctrl + K` yoki `/` bosilganda:
     - "Mehmon ismi (masalan, Akmal)", "Xona raqami (masalan, 304)", "Bron ID (#BK-9182)" kiritiladi va tizim bir zumda natijani ko'rsatadi.
     - Tezkor buyruqlar: `> Yangi bron qo'shish`, `> Tozalash holatiga o'tish`, `> Moliya hisoboti`.
3. **Real-time Socket Health Pill**:
   - WebSocket ulanishining holatini bildiruvchi nozik ko'rsatkich:
     - Yashil miltillovchi nuqta: `● Jonli sinxron` (Server bilan aloqa a'lo, yangi bronlar darhol aks etadi).
     - Qizil/Sariq: `▲ Qayta ulanmoqda...` (Internet uzilganda zudlik bilan ogohlantirish).
4. **Quick Action Button (`+ Yangi Bron`)**:
   - Yuqori o'ng burchakdagi doimiy ko'rinib turuvchi `bg-brand-600` tugmasi.
   - Bosilganda yoki `N` harfi terilganda to'g'ridan-to'g'ri `WalkInDialog` ochiladi.

### 3.3. Contextual Quick Drawer (Right Sheet - 480px)

Front-desk tizimlarida sahifadan sahifaga sakrash (full-page reload yoki router push) xodimning diqqatini buzadi. Shu sababli, Safaar arxitekturasida barcha batafsil ma'lumotlar **Quick Drawer** orqali ochiladi.

- **Kengligi**: Standart desktopda `480px`, noutbuklarda `440px`, mobilda `100vw`.
- **Animatsiya**: O'ngdan chapga 220ms `ease-out` siljish, orqa fonda yumshoq `backdrop-blur-sm`.
- **Tarkibi**:
  - *Header*: Bron raqami (`#BK-8491`), yaratilgan vaqti, `X` yopish tugmasi.
  - *Status Panel*: Holat nishoni (`CONFIRMED`), Manba nishoni (`Safaar ilovasi`, `Booking.com`, `Walk-in`).
  - *Mehmon Kartasi*: Ism, telefon (bitta bosishda qo'ng'iroq qilish `tel:+998...`), Telegram/WhatsApp havolasi.
  - *Turar-joy Parametrlari*: Xona turi, tayinlangan xona raqami, kelish va ketish sanalari, necha kechaligi.
  - *Moliya*: Jami summa, to'langan summa (yashil), qoldiq qarzdorlik (qizil).
  - *Doimiy Fiksirlangan Footer (Sticky Bottom)*:
    - Kutilayotgan bo'lsa: `[Rad etish]` va `[Tasdiqlash]`.
    - Tasdiqlangan bo'lsa: `[Xonani almashtirish]` va `[Kirish (Check-in)]`.
    - Joylashgan bo'lsa: `[Chiqish (Check-out)]`.

---

## 4. Asosiy Modullar uchun Batafsil UI/UX Blueprint

### 4.1. Front Desk Cockpit (Bosh Sahifa)

Bosh sahifa — ertalab soat 08:00 da kelgan ma'mur ish boshlaydigan markaziy radar. Uning vazifasi: "Bugun nimalar bo'ladi va men zudlik bilan nima qilishim kerak?" degan savolga javob berish.

#### ASCII Mockup: Front Desk Cockpit
```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ FRONT DESK COCKPIT                                                         [Kalendar] [+ Yangi Bron]   │
│ ┌─────┐ Seshanba, 14-Oktyabr 2026                                                                      │
│ │ 14  │ Bugungi vazifalar, kelishlar va xonalar bandligi navbati                                       │
│ └─────┘                                                                                                │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ ASOSIY KO'RSATKICHLAR (KPI RADAR)                                                                      │
│ ┌──────────────────────┐ ┌──────────────────────┐ ┌──────────────────────┐ ┌─────────────────────────┐│
│ │ BANDLIK KO'RSATKICHI │ │ BUGUNGI KELISHLAR    │ │ BUGUNGI KETISHLAR    │ │ OYLIK TUSHUM            ││
│ │   [=== 82% ===]      │ │    14 ta mehmon      │ │    9 ta mehmon       │ │   148,500,000 UZS       ││
│ │  41 / 50 xona band   │ │  8 tasi kutib olindi │ │  6 tasi chiqib ketdi │ │  O'tgan oyga nisbatan   ││
│ │  9 xona bo'sh        │ │  6 tasi kutilmoqda   │ │  3 tasi to'lov kutar │ │  +18% o'sish ▲          ││
│ └──────────────────────┘ └──────────────────────┘ └──────────────────────┘ └─────────────────────────┘│
├───────────────────────────────────────────────────────────────────┬────────────────────────────────────┤
│ BUGUNGI VAZIFALAR VA AMALLAR (RADAR)                              │ TEZKOR YORDAMCHI PANEL             │
│ [ Hammasi (12) ] [ Yangi (3) ] [ Kelish (6) ] [ Ketish (3) ]      │ ┌────────────────────────────────┐ │
│ 🔍 Mehmon ismi, telefon yoki xona qidirish...                     │ │ ✦ ENG SHOSHILINCH VAZIFA       │ │
│                                                                   │ │ Dilshod Rahimov (Xona 204)     │ │
│ ┌───────────────────────────────────────────────────────────────┐ │ │ Check-in vaqti yetib keldi     │ │
│ │ [!] YANGI BRON · 10 daqiqa oldin           [Rad etish] [Tasdiq]│ │ │ [Check-in qilish]            │ │
│ │ Jasur Aliyev · +998 90 123 45 67 · Standart Double (2 kecha)  │ └────────────────────────────────┘ │
│ │ Summa: 1,400,000 UZS · Manba: Safaar Mobile                   │ ┌────────────────────────────────┐ │
│ ├───────────────────────────────────────────────────────────────┤ │ ✦ XONALAR HOLATI QISQACHA      │ │
│ │ [→] KELISH (CHECK-IN)                      [Xona: 104] [Kirish]│ │  ● Toza: 38 ta                 │ │
│ │ Elena Smirnova · 2 nafar mehmon · Deluxe King                 │ │  ● Tozalanmoqda: 3 ta          │ │
│ │ To'langan: 800,000 UZS · Qoldiq: 0 UZS (To'liq to'langan ✓)   │ │  ● Kir / Kutmoqda: 7 ta        │ │
│ ├───────────────────────────────────────────────────────────────┤ │  ● Ta'mirda: 2 ta              │ │
│ │ [←] KETISH (CHECK-OUT)                     [Xona: 312] [Chiqish]│ └────────────────────────────────┘ │
│ │ Bobur Mirzayev · Xona topshirilishi kerak                     │ ┌────────────────────────────────┐ │
│ │ Diqqat: Qoldiq qarzdorlik bor: 350,000 UZS [To'lov olish]     │ │ ✦ TEZKOR HAVOLALAR             │ │
│ └───────────────────────────────────────────────────────────────┘ │ │ • Bronlar to'liq jadvali       │ │
│                                                                   │ │ • Tozalash matritsasi          │ │
│                                                                   │ └────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────┴────────────────────────────────────┘
```

### 4.2. Interactive Timeline Calendar (Taqvim)

Taqvim — bu PMS tizimining eng muhim operatsion xaritasi bo'lib, xonalar gorizontal satrlarda, sanalar esa vertikal ustunlarda aks etadi.

#### Interaktiv Funksiyalar:
- **Ko'rish rejimlari (View Modes)**: `7 kun` (sminali rejim), `14 kun` (ikki haftalik), `30 kun` (oylik ko'rinish).
- **Drag-and-Drop bilan xona almashtirish**: Mehmon boshqa xonaga o'tmoqchi bo'lsa, uning blokini ushlab boshqa bo'sh xona qatoriga tashlanadi. Tizim avtomatik narx farqini hisoblab tasdiqlash so'raydi.
- **Bo'sh joyda sichqoncha bilan belgilash (Click-to-create)**: Bo'sh kun katakchasini bosish orqali avtomatik ravishda o'sha xona va sanalar tanlangan yangi bron dialogi ochiladi.
- **Bugungi kun ajratilishi (`TODAY`)**: Joriy kun ustuni nozik ko'k chegara va fonda yoritilib turadi.

#### ASCII Mockup: Timeline Calendar
```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ KALENDAR: XONA BANDLIGI JADVALI                       [Bugun] [<] [Oktyabr 2026] [>]   [ 7K | 14K | 30K]│
├────────────────────┬──────────┬──────────┬──────────┬──────────┬──────────┬──────────┬──────────┬────────┤
│ XONA RAQAMI / TURI │ 13 Du    │ 14 Se    │ 15 Cho   │ 16 Pa    │ 17 Ju    │ 18 Sha   │ 19 Yak   │ NARXI  │
│                    │          │ [BUGUN]  │          │          │          │          │          │        │
├────────────────────┼──────────┴──────────┴──────────┴──────────┼──────────┴──────────┴──────────┼────────┤
│ 101 · Standart     │ [=== Alisher Qodirov (IN_HOUSE) ========] │ [== Malika Z. (CONFIRMED) ===] │ 450k   │
│ 1-qavat · Double   │ To'liq to'langan                          │ Qoldiq: 200k                   │        │
├────────────────────┼─────────────────────┬─────────────────────┼────────────────────────────────┼────────┤
│ 102 · Standart     │ [--- BO'SH --------]│ [--- BO'SH --------]│ [==== Jon Smit (CONFIRMED) ==] │ 450k   │
│ 1-qavat · Twin     │                     │                     │ Safaar Direct                  │        │
├────────────────────┼─────────────────────┴─────────────────────┴────────────────────────────────┼────────┤
│ 103 · Deluxe       │ [XXXXXX TA'MIRDA / BLOKLANGAN (Blackout) XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX] │ 750k   │
│ 1-qavat · King     │ Santexnika ta'miri (13 - 17 Oktyabr)                                       │        │
├────────────────────┼───────────────────────────────────────────┬────────────────────────────────┼────────┤
│ 201 · Suite VIP    │ [=== Farhod Karimov (CONFIRMED) ========] │ [--- BO'SH ------------------] │ 1.2M   │
│ 2-qavat · Panoramic│ 3 kecha · 2 mehmon                        │                                │        │
└────────────────────┴───────────────────────────────────────────┴────────────────────────────────┴────────┘
```

### 4.3. High-Density Reservations & Guest CRM

Jadval sahifasi Stripe Dashboard darajasidagi yuqori axborot zichligi (High Information Density) tamoyili asosida quriladi.

- Har bir satr qisqa, aniq va ma'lumotga boy.
- Barcha pul miqdorlari va telefonlar o'ngga yoki chapga tekislangan.
- Har qanday qator ustiga bosilganda sahifadan chiqmasdan **480px Quick Drawer** ochiladi.

#### ASCII Mockup: High-Density Reservations Table
```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ BARCHA BRONLAR VA MEHMONLAR                                              [Eksport CSV] [+ Yangi Bron]  │
│ Qidiruv: [ 🔍 Mehmon ismi, telefon, xona yoki ID...                 ]   Filtr: [ Barcha Statuslar ▼ ]  │
├──────────┬──────────────────────┬─────────────┬─────────────┬───────────┬──────────────┬────────┬──────────┤
│ BRON ID  │ MEHMON ISMI          │ ALOQA       │ XONA / TUR  │ MUDDAT    │ SUMMA (UZS)  │ HOLAT  │ MANBA    │
├──────────┼──────────────────────┼─────────────┼─────────────┼───────────┼──────────────┼────────┼──────────┤
│ #BK-9021 │ Jamshid Rustamov     │ +9989011122 │ 204 (Dlx)   │ 14-17 Okt │ 2,100,000    │ [CONF] │ Safaar   │
│ #BK-9020 │ Anna Petrova         │ +9989744455 │ 102 (Std)   │ 14-15 Okt │   450,000    │ [IN_H] │ Walk-in  │
│ #BK-9019 │ Sardor Shukurov      │ +9989388899 │ 301 (Suite) │ 15-20 Okt │ 6,000,000    │ [PEND] │ Booking  │
│ #BK-9018 │ Michael Brown        │ +1202555019 │ 105 (Twin)  │ 12-14 Okt │   900,000    │ [DEPT] │ Safaar   │
│ #BK-9017 │ Gulnoza Karimova     │ +9989122233 │ 208 (Std)   │ 13-14 Okt │   450,000    │ [CANC] │ Telefon  │
└──────────┴──────────────────────┴─────────────┴─────────────┴───────────┴──────────────┴────────┴──────────┘
 Ko'rsatilmoqda: 1-5 / Jami 142 ta bron                          [Sahifa: < 1 2 3 4 5 >] [10 / 25 / 50]
```

### 4.4. Rooms & Housekeeping Matrix

Mehmonxona va xizmat ko'rsatish sifatining asosi — xonalarning tozalik holatidir. Front-desk va farroshlar (housekeeping) jamoasi o'rtasida to'liq sinxronlik ta'minlanadi.

#### Xona Kartochkasi Anatomiyasi:
```
┌─────────────────────────┐
│ 204        [● Toza]     │ <-- Xona raqami va tozalik nishoni
│ Deluxe King · 2-qavat   │ <-- Xona toifasi va joylashuvi
│                         │
│ Mehmon: Jasur Aliyev    │ <-- Hozirgi istiqomat qiluvchi (agar band bo'lsa)
│ Ketish sanasi: Ertaga   │
│                         │
│ [Farrosh tayinlash]     │ <-- 1-bosishda vazifa berish tugmasi
└─────────────────────────┘
```

#### ASCII Mockup: Housekeeping Matrix
```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ XONALAR VA TOZALIK MATRITSASI                                              [Qavatlar: Barchasi ▼]      │
│ [● Toza: 32]   [● Tozalanmoqda: 4]   [● Kir / Navbatda: 8]   [● Ta'mirda: 2]       [+ Yangi Xona]      │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 1-QAVAT (12 ta xona)                                                                                   │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ │
│ │ 101   [TOZA] │ │ 102  [KIR]   │ │ 103 [TOZAL]  │ │ 104  [TOZA]  │ │ 105 [TA'MIR] │ │ 106  [TOZA]  │ │
│ │ Standart     │ │ Standart     │ │ Twin         │ │ Standart     │ │ Suite        │ │ Deluxe       │ │
│ │ Bo'sh        │ │ Chiqib ketdi │ │ Farrosh: Oygul│ │ Band: Jon S. │ │ Santexnika   │ │ Bo'sh        │ │
│ └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘ │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 2-QAVAT (14 ta xona)                                                                                   │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ │
│ │ 201   [TOZA] │ │ 202  [TOZA]  │ │ 203  [KIR]   │ │ 204 [TOZAL]  │ │ 205  [TOZA]  │ │ 206  [TOZA]  │ │
│ │ Deluxe King  │ │ Deluxe King  │ │ Standart     │ │ Deluxe       │ │ VIP Suite    │ │ Standart     │ │
│ │ Band: Ali V. │ │ Bo'sh        │ │ Tozalash kutar│ │ Farrosh: Nodir│ │ Bo'sh       │ │ Band: Elena  │ │
│ └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘ │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 4.5. Finance & Revenue Cockpit

Hamkor uchun moliyaviy shaffoflik — Safaar platformasiga bo'lgan ishonch kafolatidir.
Ushbu modulda:
- **Jami tushum (Gross Revenue)**.
- **Safaar komissiyasi (Transparent Platform Fee)**: Hech qanday yashirin to'lovlarsiz har bir bron bo'yicha aniq hisob-kitob.
- **Sof balans (Net Available Balance)**: Hamkor darhol o'z bank hisob raqamiga yechib olishi mumkin bo'lgan mablag'.
- **Yechib olish (Withdrawal) arizasi**: 20 xonali O'zbekiston bank hisob raqamiga bir bosishda so'rov yuborish.

#### ASCII Mockup: Finance Cockpit
```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ MOLIYA VA DAROMAD HISOBOTLARI                                             [Hisobot yuklash (Excel)]    │
├────────────────────────┬────────────────────────┬────────────────────────┬─────────────────────────────┤
│ YECHIB OLISH MUMKIN    │ KUTILAYOTGAN MABLAG'   │ JAMI OYLIK TUSHUM      │ SAFAAR KOMISSIYASI (5%)     │
│  42,800,000 UZS        │   8,400,000 UZS        │  148,500,000 UZS       │   7,425,000 UZS             │
│ [Pulni Yechib Olish]   │ Mehmonlar chiqqach     │ O'tgan oy: 125,000,000 │ Barcha xizmatlar uchun      │
└────────────────────────┴────────────────────────┴────────────────────────┴─────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ TUSHUM VA BRONLAR GRAFIK DINAMIKASI (Oxirgi 30 kun)                                                    │
│  Mln                                                                                                   │
│  6 |                * *                                                                                │
│  4 |    *         *     *   *                                                                          │
│  2 |  *   *     *             *   *                                                                    │
│  0 └──┴───┴─────┴───┴───┴───┴───┴───┴──────────────────────────────────────────────────────────────────│
│    1  4   7    10  13  16  19  22  25  28 Okt                                                          │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ PUL YECHIB OLISH SO'ROVLARI TARIXI                                                                     │
├────────────┬──────────────────┬─────────────────────────────┬──────────────────┬───────────────────────┤
│ SANA       │ SUMMA (UZS)      │ BANK REKVIZITLARI           │ HOLATI           │ TRANZAKSIYA RAQAMI    │
├────────────┼──────────────────┼─────────────────────────────┼──────────────────┼───────────────────────┤
│ 12.10.2026 │ 25,000,000       │ 20208000900123456001 (Kapital)│ [✓ Bajarildi]   │ TR-9821412            │
│ 01.10.2026 │ 30,000,000       │ 20208000900123456001 (Kapital)│ [✓ Bajarildi]   │ TR-9710892            │
│ 14.10.2026 │ 15,000,000       │ 20208000900123456001 (Kapital)│ [⏳ Jarayonda]   │ TR-9890123            │
└────────────┴──────────────────┴─────────────────────────────┴──────────────────┴───────────────────────┘
```

---

## 5. Multi-Tenant Polimorfizm Dizayni (`getPartnerLabels`)

Safaar platformasining eng katta arxitektura yutug'i — bu **polimorfizm**dir. Butun tizim bitta frontend kodi ustida ishlaydi, biroq tizimga kirgan foydalanuvchining roli (`partnerType`) bo'yicha butun interfeys o'z leksikoni, joylashuvi va parametrlarini o'zgartiradi.

### 5.1. Dinamik Domen Terminologiyasi va Taqqoslash Matritsasi

Quyidagi jadval turli biznes turlari bo'yicha qanday terminologik transformatsiya yuz berishini ko'rsatadi:

| Konseptual Maydon | Hotel (Mehmonxona) | Hostel (Koykalar) | Dacha (Dam olish uyi) | Restoran (Stollar) | Rent Car (Mashina) |
|---|---|---|---|---|---|
| **Birlik (Unit singular)** | Xona | Yotoq (joy) | Dacha | Stol | Avtomobil |
| **Birliklar (Plural)** | Xonalar | Yotoqlar (joylar) | Dachalar | Stollar | Avtomobillar |
| **Guruhlash (Group)** | Qavat (Floor) | Xona / Qavat | Sektor / Zona | Zal (Room / Hall) | Klass / Park |
| **Band qilish (Action)** | Bron (Booking) | Band qilish | Band qilish | Bron | Ijara (Rental) |
| **Boshlanish vaqti** | Kirish (Check-in) | Kirish | Kelish sanasi | Ochilish / Slot vaqti | Olib ketish vaqti |
| **Tugash vaqti** | Chiqish (Check-out)| Chiqish | Ketish sanasi | Yopilish vaqti | Qaytarish vaqti |
| **Mijoz (Consumer)** | Mehmon | Mehmon | Mehmon | Mehmon | Mijoz (Haydovchi) |
| **Identifikator** | Xona raqami (101) | Joy raqami (202-A)| Dacha raqami (1) | Stol raqami (12) | Davlat raqami (01A777AA) |
| **Narx o'lchovi** | 1 kechaga | 1 kechaga | 1 kechaga (sutka) | Stol depoziti / soat | 1 kunga (sutka) |
| **Sig'im qo'shimchasi**| kishi | kishi | kishi | kishi | o'rindiq |

### 5.2. Obyekt Turiga Qarab UI Layout Transformatsiyasi

1. **Hotel (Standart PMS)**:
   - To'liq qavatlar xaritasi, xona toifalari (Standart, Deluxe, Suite), xona kalitlari, tozalash matritsasi.
2. **Hostel (Bed Management)**:
   - Xonalar ichidagi yotoqlar matrisi (masalan, 8 kishilik dormitory xonada 8 ta alohida koyka: A1, A2, B1, B2...). Bron bir butun xonaga emas, balki aniq bir koykaga biriktiriladi.
3. **Dacha (Single/Multi-Property Exclusive)**:
   - Dacha odatda bitta yaxlit mulk bo'lgani sababli, unga xonalar xaritasi yoki qavatlar shart emas.
   - Bosh sahifa to'g'ridan-to'g'ri **Dacha Availability Calendar**ga aylanadi (qaysi kunlar band, qaysi kunlar bo'sh).
4. **Restoran (Time-slot Table Reservation)**:
   - Kalendar bir necha kunga emas, balki bir kun ichidagi **vaqt intervallari** (masalan, 12:00-14:00, 18:00-20:00, 20:00-23:00) va zallar (Asosiy zal, Terassa, VIP xonalar) bo'yicha bo'linadi.
5. **Rent-a-Car (Fleet Management)**:
   - Avtomobillar davlat raqami, yoqilg'i darajasi, kunlik kilometraj chegarasi va texnik ko'rik (Moy almashtirish) holati bo'yicha nazorat qilinadi.

---

## 6. Micro-interactions, A11y (WCAG 2.1 AA) & Keyboard Shortcuts

### 6.1. Hotkeys Xaritasi (Linear-style Klaviatura Boshqaruvi)

Haqiqiy operatsion tezlik faqat klaviatura yordamida erishiladi. Xodim sichqonchaga qo'l uzatmasdan quyidagi tugmalarni bosishi mumkin:

| Klaviatura Tugmasi | Harakat Nomi | Funksional Vazifasi |
|---|---|---|
| `Ctrl + K` yoki `⌘K` | **Command Palette** | Global qidiruv va tizim buyruqlari panelini ochish |
| `/` | **Search Focus** | Joriy sahifadagi jadval qidiruv qatoriga darhol fokus berish |
| `N` | **New Booking** | Yangi bron (Walk-in) dialog oynasini ochish |
| `C` | **Check-in Mode** | Bugungi kelgan mehmonlarni kutib olish oynasini ishga tushirish |
| `T` | **Today Jump** | Kalendarda turgan bo'lsa, bir zumda joriy kunga (`TODAY`) qaytish |
| `Esc` | **Close / Dismiss** | Ochiq turgan Quick Drawer, modal yoki popoverni zudlik bilan yopish |
| `1`, `2`, `3` | **Filter Tabs** | Cockpitda "Hammasi", "Kelish", "Ketish" filtrlarini tez almashtirish |
| `J` / `K` | **List Navigation** | Jadval yoki ro'yxat bo'yicha keyingi/oldingi satrga o'tish |

```tsx
// Foydalanish namunasi (use-keyboard-shortcuts.ts):
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (["input", "textarea"].includes((e.target as HTMLElement).tagName.toLowerCase())) return;
    if (e.key === "n" || e.key === "N") {
      e.preventDefault();
      setWalkInOpen(true);
    }
  };
  window.addEventListener("keydown", handleKeyDown);
  return () => window.removeEventListener("keydown", handleKeyDown);
}, []);
```

### 6.2. WCAG 2.1 AA Qoidalari, Kontrast Matritsasi va Focus Ringlar

- **Minimal Kontrast**:
  - Matn va fon kontrasti: Kamida `4.5:1` (Safaar Slate-900 matni Slate-50 fonida `14.2:1` kontrast beradi, ya'ni AAA darajasida).
  - Yordamchi matn (`muted-foreground`): Kamida `4.5:1` (`#64748B` oq fonda `4.6:1`).
  - Chegaralar va interaktiv komponentlar kontrasti: Kamida `3.0:1`.
- **Focus Ring Standarti**:
  - Klaviatura orqali `Tab` bosilganda barcha interaktiv tugma va havolalarda ravshan ko'rinuvchi focus halqasi:
    ```css
    *:focus-visible {
      outline: 2px solid #2563eb;
      outline-offset: 2px;
      border-radius: 6px;
    }
    ```
- **Semantik ARIA atributlari**:
  - Drawer va Modallarda: `role="dialog"`, `aria-modal="true"`, `aria-labelledby="dialog-title"`.
  - Dinamik o'zgaruvchi hisoblagichlarda: `aria-live="polite"`.

### 6.3. Micro-interactions, Toast Bildirishnomalar va Skeleton Holatlar

- **Sonner Toast Bildirishnomalari**:
  - Amallar yakunlanganda pastki o'ng burchakda paydo bo'ladigan toza bildirishnomalar.
  - Masalan: *"Check-in bajarildi: Jasur Aliyev (Xona 204)"*.
  - **Undo (Bekor qilish) imkoniyati**: *"Xona holati o'zgartirildi. [Bekor qilish (Ctrl+Z)]"*.
- **Zero Layout Shift Skeletons (CLS = 0)**:
  - Ma'lumotlar yuklanayotgan paytda sahifa sakrab ketmasligi uchun jadvallar va kartalar aniq o'lchamdagi Shimmer animatsiyali Skeletonlar bilan to'ldiriladi.
- **Optimistic UI**:
  - Ma'mur "Tasdiqlash" tugmasini bosgan soniyaning o'zida status yashil rangga kiradi. Agar server xatolik bersa, orqaga qaytariladi va qizil xabar chiqadi.

---

## 7. Bosqichma-bosqich Tadbiq qilish Yo'l xaritasi (Implementation Roadmap)

Dizayn tizimini amaliyotga joriy qilish 4 ta aniq bosqichga ajratilgan. Har bir bosqich mustaqil tekshiriluvchi natijaga ega:

```
┌───────────────────────────────────────────────────────────────────────────┐
│                      IMPLEMENTATION ROADMAP (4 BOSQICH)                   │
├─────────────────────┬─────────────────────┬─────────────────────┬─────────┤
│ 1-BOSQICH           │ 2-BOSQICH           │ 3-BOSQICH           │ 4-BOSQIC│
│ Shell & Navigation  │ Cockpit & Occupancy │ Table & Drawer      │ Calendar│
├─────────────────────┼─────────────────────┼─────────────────────┼─────────┤
│• globals.css token  │• KPI Cards (4 ta)   │• High-density Table │• Timelin│
│• Sidebar 240/64px   │• Radar (Kel/Ket)    │• 480px Right Drawer │• Drag-Dr│
│• Topbar + Switcher  │• Shoshilinch vazifa │• Advanced Filters   │• Houseke│
│• Badge & Button UI  │• Hotkeys (N, C, /)  │• Batch Actions      │• Matrix │
└─────────────────────┴─────────────────────┴─────────────────────┴─────────┘
```

### 7.1. 1-Bosqich: Shell & Navigation (Arxitektura Poydevori)
- **Maqsad**: Tailwind v4 tokenlarini sozlash, moslashuvchan Sidebar va universal Topbarni to'liq ishchi holatga keltirish.
- **Amallar**:
  1. `app/globals.css` faylida `@theme` blokini to'liq yangilash (yuqoridagi ranglar, border va radius tokenlari).
  2. `Sidebar` komponentini 240px va 64px o'rtasida muammosiz yig'iladigan qilish, jonli badge'larni qo'shish.
  3. `Topbar`da Multi-property switcher va Socket health pill komponentlarini joylashtirish.
  4. Asosiy `Button`, `Badge`, `Card`, `Tooltip` komponentlarini yangi vizual standartga keltirish.
- **Qabul qilish mezoni**: Sidebar silliq ochilib-yopiladi, barcha ranglar va chegaralar aniq standartda, lint va build xatosiz.

### 7.2. 2-Bosqich: Front Desk Cockpit & Occupancy Widget
- **Maqsad**: Bosh sahifani haqiqiy operatsion nazorat markaziga aylantirish.
- **Amallar**:
  1. 4 ta asosiy KPI kartasini yaratish: Bandlik spidometri (Gauge), Bugungi kelishlar, Bugungi ketishlar, Oylik tushum.
  2. Bugungi radar (TaskCard) bloklarini qayta ishlash: ikonka nishoni, mehmon ma'lumoti, to'lov qoldig'i, to'g'ridan-to'g'ri qo'ng'iroq va harakat tugmalari.
  3. Shoshilinch vazifalar o'ng panelini (NextTaskCard) yangilash.
  4. Klaviatura hotkeylarini (`N`, `C`, `Esc`) global darajada ulash.
- **Qabul qilish mezoni**: Ma'mur 1 ta bosishda yangi bron qo'sha oladi, check-in va check-out amallarini bosh sahifaning o'zida bajara oladi.

### 7.3. 3-Bosqich: Reservations Table & Quick Drawer
- **Maqsad**: Bronlar boshqaruvini sahifani yangilamasdan ishlaydigan qilish.
- **Amallar**:
  1. `ReservationsTable`ni yuqori zichlikdagi (high-density) Stripe uslubiga o'tkazish.
  2. Pul va sanalarda majburiy `tabular-nums` klasslarini qo'llash.
  3. `ReservationQuickDrawer` (480px) panelini to'liq boyitish: mehmon profili, to'lov tarkibi, xona parametrlari va fiksirlangan harakat tugmalari.
  4. Status va sanalar bo'yicha tezkor filtrlar paneli (Filter Tabs)ni yangilash.
- **Qabul qilish mezoni**: Jadvaldagi har qanday satr bosilganda zudlik bilan 480px Drawer ochiladi, to'liq ma'lumot ko'rinadi va undan turib status o'zgartiriladi.

### 7.4. 4-Bosqich: Timeline Calendar & Housekeeping Matrix
- **Maqsad**: Xonalar vaqti va tozaligini boshqaruvchi murakkab vizual matritsalarni topshirish.
- **Amallar**:
  1. `CalendarView` komponentida 7/14/30 kunlik ko'rinishlarni optimallashtirish, xona qatorlari va bron bloklari kontrastini yaxshilash.
  2. Bo'sh katakchalarda "Click-to-create" Walk-in bron ochilishini ta'minlash.
  3. `RoomsView`da qavatlar bo'yicha tozalik holati plitkalarini (Housekeeping Matrix) joylashtirish.
  4. Bir bosishda farroshga vazifa biriktirish va tozalanganlik holatini tasdiqlash dialogini integratsiya qilish.
- **Qabul qilish mezoni**: Xonalar tozalik holati va taqvimdagi bandlik real vaqtda bir-biriga mos keladi, overbooking xavfi nolga tenglashtiriladi.

---

## Xulosa

Ushbu **DESIGN_SYSTEM_BLUEPRINT.md** spetsifikatsiyasi Safaar Partner Extranet platformasining vizual, me'moriy va foydalanuvchi tajribasi (UI/UX) bo'yicha asosiy konstitutsiyasidir. U Linear tezkorligi, Stripe zichligi, Airbnb mehmondo'stligi va Booking.com operatsion aniqligini O'zbekiston mehmondo'stlik bozorining real ehtiyojlari bilan birlashtiradi. Har bir ishlab chiquvchi ushbu standartlarga rioya qilgan holda kod yozishi shart.
