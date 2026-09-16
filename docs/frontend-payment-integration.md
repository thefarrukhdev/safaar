# Frontend uchun to'lov (payment) integratsiyasi — texnik spec

> **Maqsad:** `apps/web-user` frontend devlari uchun — SAFAAR backendida
> HOZIR HAQIQATDA mavjud bo'lgan to'lov tizimiga qanday ulanish kerakligini
> aniq ko'rsatish. Bu hujjat backend kodini QAYTA YOZISHNI tavsiya qilmaydi —
> faqat frontend nima qilishi kerakligini yozadi.
>
> **Manba:** `apps/backend/src/payments/*`, `apps/backend/src/refunds/*`,
> `apps/backend/src/bookings/bookings.service.ts`,
> `apps/backend/src/common/{legal,finance}.ts`, va real ishlatilayotgan
> `apps/web-user` kodi (`lib/services/booking/actions.ts`,
> `lib/services/payments/*`, `components/features/checkout/PaymentSelector.tsx`,
> `app/[lang]/(main)/booking/[id]/page.tsx`). Hamma fakt shu fayllardan
> to'g'ridan-to'g'ri o'qib tasdiqlangan — taxmin/standart Uzum
> dokumentatsiyasiga tayanilmagan.
>
> **Repo holati:** `temp/save-all-work` branch, 2026-09-16.
> API global prefiksi: **`/v1`** (`API_PREFIX` env, default `v1`). Pastdagi
> barcha endpoint yo'llari shu prefiksdan KEYIN yoziladi (masalan
> `POST /payments/:bookingId/create` haqiqatda
> `POST https://api.safaar.uz/v1/payments/:bookingId/create`).
>
> Barcha muvaffaqiyatli javoblar `{ success: true, data: <payload>, meta }`
> ko'rinishida keladi (`ApiResponseInterceptor`), xatolar esa
> `{ success: false, error: { code, message, fields }, meta }`
> ko'rinishida (`HttpErrorFilter`). Pastdagi "Response body" ustunlarida
> faqat `data` ichidagi shaklni yozamiz.

---

## 1. Backend payment arxitekturasi

To'lov bilan bog'liq **3 ta alohida controller** bor — bir-biridan mutlaqo
mustaqil, marshrutlari kesishmaydi:

| Controller | Fayl | Vazifasi |
|---|---|---|
| `PaymentsController` | `payments/payments.controller.ts` | Frontend ishlatadigan 2 ta autentifikatsiyalangan endpoint + provayder webhooklari |
| `UzumWebhookController` | `payments/uzum-webhook.controller.ts` | Uzum **Merchant API** rasmiy contract'i (`/uzum/webhook/{check,create,confirm,reverse,status}`) — Uzum tomonidan chaqiriladi, frontend BILAN ALOQASI YO'Q |
| `UzumCheckoutController` | `payments/uzum-checkout.controller.ts` | Uzum **Checkout** callback qabul qiluvchi (`/uzum/checkout/callback`) — Uzum tomonidan chaqiriladi, frontend BILAN ALOQASI YO'Q |

**Frontend faqat quyidagi 2 ta endpoint bilan ishlaydi:**

### `POST /payments/:bookingId/create`

- **Vazifasi:** Berilgan bron uchun to'lov sessiyasi yaratadi (yoki mavjudini qaytaradi) va (agar mumkin bo'lsa) to'lov sahifasiga redirect URL beradi.
- **Auth:** MAJBURIY. `@Roles(Role.USER, Role.ADMIN, Role.SUPER_ADMIN)` — `Authorization: Bearer <accessToken>` header shart. Guest (tokensiz) chaqiruv **401** bilan rad etiladi.
- **Request body** (`CreatePaymentDto`):
  ```json
  { "provider": "click" }
  ```
  `provider` — MAJBURIY, faqat quyidagi 7 qiymatdan biri bo'lishi shart (`@IsIn`, global `ValidationPipe({forbidNonWhitelisted: true})` boshqa har qanday qiymatni 400 bilan rad etadi):
  `"click" | "payme" | "uzcard" | "humo" | "cash" | "uzum" | "uzum_checkout"`
- **Response body** (`data`):
  ```json
  {
    "id": "uuid",
    "booking_id": "uuid",
    "provider": "click",
    "status": "pending",
    "payment_url": "https://my.click.uz/services/pay?...",
    "amount": 500000,
    "currency": "UZS",
    "created_at": "...",
    "updated_at": "..."
  }
  ```
- **Frontend qaysi maydonlardan foydalanadi:** `payment_url` (browser'ni shu yerga redirect qilish uchun), `status` (agar `"processing"`/`"pending"` bo'lsa va `payment_url` bo'sh bo'lsa — "hozircha to'lash imkoni yo'q" holatini ko'rsatish uchun), `id`/`booking_id` — diagnostika uchun.
- **MUHIM:** `payment_url` HAR DOIM kelavermaydi — pastga, 4-bo'limga qarang.

### `GET /payments/:bookingId`

- **Vazifasi:** Shu bronning ENG OXIRGI to'lov qatorini qaytaradi (holatni tekshirish uchun).
- **Auth:** MAJBURIY, xuddi yuqoridagi kabi (`Role.USER/ADMIN/SUPER_ADMIN`).
- **Request body:** yo'q.
- **Response body:** yuqoridagi `payment` obyekti bilan bir xil shakl (`payments` jadvalining bitta qatori).
- **404** — agar bronga umuman payment qatori yaratilmagan bo'lsa (amalda deyarli bo'lmaydi — har bir bron yaratilishi bilan payment qatori HAM avtomatik yaratiladi, pastga qarang).

Qolgan barcha marshrutlar (`/webhooks/*`, `/uzum/webhook/*`, `/uzum/checkout/callback`) — **provayderlar (Click/Payme/Uzcard/Humo/Uzum) tomonidan server-to-server chaqiriladi**. Frontend bularni HECH QACHON chaqirmasligi, va ularga imzo/token yubormasligi kerak (12-bo'limga qarang).

---

## 2. Foydalanuvchi checkout oqimi (haqiqiy, kod bo'yicha)

Haqiqiy oqim `CheckoutForm.tsx` + `lib/services/booking/actions.ts`dagi
`createBookingAction()`ga asoslangan:

```
1. Bron formasi (CheckoutForm.tsx)
   — mehmon/foydalanuvchi ma'lumotlari, sana, PaymentSelector orqali
     to'lov usuli, "Ommaviy Oferta"ga rozilik checkboxi.
   [FRONTEND]

2. Submit -> createBookingAction() (server action)
   a) agreeTerms tekshiriladi (client-side tezkor tekshiruv)      [FRONTEND]
   b) api.bookings.createHotelBooking(...) chaqiriladi             [FRONTEND -> BACKEND]
      -> backend: bron yaratiladi + SHU TRANZAKSIYADA payment qatori
         ham avtomatik yaratiladi (status='pending' yoki
         'awaiting_cash'), checkout URL yaratishga URINIB KO'RILADI
         (muvaffaqiyatsiz bo'lsa jim null)                          [BACKEND]
   c) agar provider === "cash" -> to'g'ridan-to'g'ri booking detail
      sahifasiga redirect, to'lov sessiyasi UMUMAN so'ralmaydi       [FRONTEND]
   d) aks holda: api.payments.createPaymentSession(bookingId,
      provider) chaqiriladi -> POST /payments/:bookingId/create      [FRONTEND -> BACKEND]
   e) agar payment_url qaytsa -> browser shu URL'ga to'liq
      (full-page) redirect qilinadi                                 [FRONTEND]
   f) agar payment_url bo'lmasa (xato yoki null) -> booking detail
      sahifasiga ?payment=pending bilan redirect                    [FRONTEND]

3. Uzum/Click/Payme checkout sahifasi — foydalanuvchi karta
   ma'lumotlarini kiritadi, 3D-Secure, tasdiqlaydi                  [PROVAYDER, brauzerda]

4. Provayder foydalanuvchini booking detail sahifasiga qaytaradi
   (success/failure URL orqali, provayderga bog'liq)                [BROWSER REDIRECT]

5. Parallel ravishda (foydalanuvchi redirectidan MUSTAQIL) —
   provayder backendga server-to-server webhook yuboradi ->
   payment.status = 'paid' -> booking.status = 'confirmed'/
   'awaiting_partner_confirmation'                                  [PROVAYDER -> BACKEND]

6. Booking detail sahifasi (GET /bookings/:id) qayta yuklanadi,
   ENG OXIRGI payment qatorini ko'rsatadi                           [FRONTEND <- BACKEND]
```

**Muhim arxitektura fakti:** bron yaratilgan zahoti backend ICHKI ravishda
ham `payments` qatorini yaratadi (`bookings.service.ts`dagi private
`createPayment()` helper, booking bilan BIR XIL DB tranzaksiyasida). Bu —
`PaymentsService.createPayment()` (endpoint orqali chaqiriladigan) bilan
MUSTAQIL, lekin BIR XIL "mavjud pending/processing payment bo'lsa — o'shani
qaytar" qoidasiga amal qiladi. Amaliy natija: `POST
/payments/:bookingId/create` chaqirilganda deyarli har doim booking
yaratilishida ALLAQACHON yaratilgan qatorni qaytaradi, yangisini emas.
Bu 3-bo'limda batafsil.

---

## 3. Payment create — real ishlash tartibi

**Qachon yuboriladi:** `createBookingAction()` ichida, bron muvaffaqiyatli
yaratilgandan KEYIN, faqat `provider !== "cash"` bo'lsa. Shuningdek
`RetryPaymentForm.tsx` orqali — mavjud bronga qayta urinishda.

**Qaysi bronga bog'liq:** URL path parametri `:bookingId` orqali — bitta
so'rov bitta bronga tegishli.

### Idempotentlik / ikki marta bosishdan himoya (REAL mexanizm)

Frontendda **hech qanday idempotency-key header yoki parametr YO'Q** — `CreatePaymentDto`da faqat `provider` maydoni bor. Himoya to'liq **backend tomonda**:

```
SELECT * FROM payments
WHERE booking_id = $1 AND status IN ('pending', 'processing')
ORDER BY created_at DESC LIMIT 1
```

Agar shunday qator topilsa — **o'sha AYNAN SHU qator** (o'zgarishsiz)
qaytariladi, yangi qator yaratilmaydi. Demak: bir xil bronga bir necha marta
`POST /payments/:bookingId/create` yuborilsa (masalan tugma ikki marta
bosilsa, yoki tarmoq sekinligidan foydalanuvchi qayta bossa) — bir xil
natija qaytadi, xavfli dublikat yo'q.

**MUHIM, kodda tasdiqlangan nozik holat (frontend buni bilishi shart):**
Bu "mavjud bo'lsa — o'shani qaytar" tekshiruvi `buildCheckoutUrl()`dan
**OLDIN** ishlaydi. Ya'ni agar booking yaratilishida ICHKI yaratilgan
birinchi payment qatorida `payment_url` biror sababdan `null` bo'lib
qolgan bo'lsa (masalan o'sha payt provayder sozlanmagan edi) — keyinchalik
`POST /payments/:bookingId/create` ni qayta chaqirish **checkout URL'ni
qayta generatsiya QILMAYDI**, faqat o'sha eski, `payment_url: null` qatorni
qaytaraveradi (HTTP 200, xatosiz). **Frontend buni alohida holat sifatida
ushlashi kerak:** `status === 200` VA `payment_url` bo'sh — bu ham "to'lov
hozircha mumkin emas" degani, faqat "so'rov muvaffaqiyatsiz" (network xato)
bilan bir xil emas. Pastga, 14-bo'limga qarang.

**Loading/disable:** Real kodda bu React `useActionState`'ning o'zi
boshqaradigan `pending` flag orqali — `Button`ga `loading={pending}` uzatiladi,
bu esa tugmani vizual va real ravishda o'chirib qo'yadi (`CheckoutForm.tsx`,
`RetryPaymentForm.tsx`). Qo'shimcha frontend logikasi (debounce, disable
ref va h.k.) kod bazasida YO'Q — backend'ning yuqoridagi dedup mexanizmi
YAGONA haqiqiy himoya, frontend `pending` esa faqat UX (bosishni fizik
qiyinlashtirish).

**Xatolik bo'lsa:** `createBookingAction()`da `createPaymentSession()`
chaqiruvi **`try/catch` bilan JIM yutiladi** — xato bo'lsa foydalanuvchiga
HECH QANDAY xabar ko'rsatilmaydi, shunchaki `?payment=pending` bilan
booking sahifasiga qaytariladi. `RetryPaymentForm.tsx` oqimida esa xato
ko'rsatiladi (`state.error` -> "To'lovni amalga oshirishda xatolik yuz
berdi"). Bu ikkalasining xulq-atvori BIR XIL EMAS — 9 va 17-bo'limlarda
batafsil.

---

## 4. To'lov usullari va komissiya (fee) hisob-kitobi

> ⚠️ **Bu bo'lim topshiriqdagi misoldan (HUMO/UZCARD 1.5%, VISA/MASTERCARD
> 3.5%) FARQ QILADI.** Repo kodi to'liq o'qib chiqildi — quyida REAL holat,
> taxmin emas.

### Real frontend to'lov usullari (PaymentSelector.tsx)

Hozirgi UI'da (`components/features/checkout/PaymentSelector.tsx`) foydalanuvchiga
aynan **4 ta** variant ko'rsatiladi:

| UI id | Nomi (UI matni) | Backend `provider` qiymati |
|---|---|---|
| `click` | Click Pass / Evolution | `click` |
| `payme` | Payme | `payme` |
| `uzcard` | **"Uzcard / Humo (Plastik karta)"** — ikkalasi BITTA variantga birlashtirilgan | `uzcard` |
| `cash` | Joyida to'lash (Naqd / Terminal) | `cash` |

**`humo` alohida tanlanadigan variant sifatida UI'da YO'Q** — backend enum'ida
bor (`humo` ham `CreatePaymentDto.provider`ning qonuniy qiymati), lekin
frontend uni hech qachon yubormaydi (UI "Uzcard / Humo" tugmasi bosilganda
har doim `"uzcard"` yuboradi). **VISA va MASTERCARD degan alohida
to'lov-usuli tanlovi backend enumida ham, frontend UI'da ham UMUMAN YO'Q.**

### Komissiya/fee — real kod holati

Butun repoda (backend + frontend, `apps/backend/src`, `apps/web-user`,
`apps/web-partner`) `"3.5"`, `"VISA"`, `"MASTERCARD"` kabi fee bilan bog'liq
hech qanday kod topilmadi (grep bilan tasdiqlangan — VISA/MASTERCARD faqat
marketing matnlarida, masalan `SiteFooter.tsx`dagi logotip ro'yxatida, ko'rinadi).

Kodda topilgan **YAGONA** haqiqiy fee mantig'i:

```ts
// apps/backend/src/payments/providers/uzum-checkout-commission.ts
export const UZUM_CHECKOUT_COMMISSION_RATE = 0.015; // 1.5%, FLAT
export const UZUM_CHECKOUT_FEE_BEARER: 'USER' | 'PARTNER' | 'SAFAAR' = 'USER';
```

Fakt bo'yicha:

1. **1.5% stavka faqat `uzum_checkout` provayderiga tegishli** — karta
   turiga (Humo/Uzcard/Visa/Mastercard) qarab FARQLANMAYDI. Uzum
   Checkout'ning o'zi ichida foydalanuvchi qaysi kartani kiritishidan
   qat'i nazar, backend kodida stavka BIR XIL — 1.5%.
2. **Click/Payme/Uzcard/Humo (standalone provayderlar sifatida) uchun
   HECH QANDAY fee/komissiya logikasi kodda YO'Q** — na foiz, na summa.
3. **2026-09-13 biznes tomonidan tasdiqlangan qaror** (kod izohida
   qayd etilgan): bu 1.5%ni **mijoz/user to'laydi**, na hamkor
   (`partner_payable`), na SAFAAR (`commission_amount`) bu summani
   ko'tarmaydi.
4. **ENG MUHIMI — bu hisob-kitob HALI REAL OQIMGA ULANMAGAN:**
   - `calculateUzumCheckoutCommission()` va uni ishlatuvchi
     `calculatePaymentBreakdown()` (`common/finance.ts`) — repo bo'ylab
     grep qilinganda, ular FAQAT o'zlarining `.spec.ts` fayllarida
     chaqiriladi. Hech qaysi controller, service yoki real so'rov
     yo'lida ISHLATILMAYDI.
   - `createUzumCheckoutPayment()` (`payments.service.ts`) Uzum'ning
     `/payment/register` so'roviga **faqat `booking.total_amount`ni
     (gross, hech qanday fee qo'shilmagan holda)** yuboradi. Buni
     kodning o'zidagi izoh ham tasdiqlaydi: *"bu maydon HECH QANDAY
     tashqi so'rovga avtomatik ulanmaydi — FAQAT SAFAAR ICHKI
     hisobot/ko'rsatish uchun"*.
   - `payments` jadvalidagi `amount` ustuni ham har doim gross
     summaga teng — fee alohida qo'shilmaydi.
   - Migratsiya (`provider_fee_rate`/`provider_fee_amount`/
     `net_settlement_amount` ustunlari uchun,
     `20260911000000_uzum_checkout_commission_fields`) **DIZAYN
     QILINGAN, lekin ATAYLAB productionga qo'llanilmagan** —
     kodning o'zidagi `TODO(uzum-checkout-commission)` izohi buni
     aniq deydi.

### Frontendga bu nimani anglatadi

- **Hozircha backend hech qaysi real API javobida fee/komissiya
  maydonini QAYTARMAYDI** — na `POST /payments/:bookingId/create`
  javobida, na `GET /payments/:bookingId`da. `amount` maydoni har doim
  bron summasining O'ZI (gross), fee qo'shilmagan.
- Shuning uchun frontend **hozircha checkout'da "to'lov haqi" qatorini
  ko'rsata OLMAYDI** — chunki ko'rsatadigan RASMIY raqam backend'dan
  kelmaydi. Buni mustaqil hisoblab chiqarish (masalan "agar uzum_checkout
  bo'lsa +1.5%" degan frontend-side formula yozish) **QATIYAN TAVSIYA
  ETILMAYDI** — bu backend to'laydigan/undiradigan real summadan farq
  qilishi va foydalanuvchini chalg'itishi mumkin (backend hali bu summani
  hech qanday real so'rovga qo'shmayapti).
- Agar/qachon backend bu maydonlarni ulasa (masalan
  `POST /payments/:bookingId/create` javobiga
  `provider_fee_amount`/`customer_total_amount` qo'shsa) — frontend O'SHA
  paytda backend qaytargan tayyor summani ko'rsatishi kerak, o'zi
  hisoblamasligi kerak. Bu backend allaqachon qabul qilgan arxitektura
  yo'nalishi (`calculatePaymentBreakdown()` funksiyasi aynan shu maqsadda
  tayyorlangan, faqat hali chaqirilmayapti).

### Topshiriqdagi 500,000 so'm misoli haqida — aniq taqqoslash

| | Topshiriqda so'ralgan (tasdiqlanmagan taxmin) | Repo'dagi REAL holat |
|---|---|---|
| Humo/Uzcard stavkasi | 1.5% | Bunday ALOHIDA stavka yo'q (Humo/Uzcard standalone provayder sifatida fee'siz, lekin checkout URL ham yaratilmaydi — pastga, 18-bo'limga qarang) |
| Visa/Mastercard stavkasi | 3.5% | Kodda VISA/MASTERCARD tushunchasi UMUMAN yo'q |
| Kim to'laydi | Foydalanuvchi | Faqat `uzum_checkout` uchun — ha, foydalanuvchi (2026-09-13 tasdiqlangan), lekin bu HALI hech qanday real summaga ta'sir qilmaydi |
| 500,000 so'm -> 507,500 (Humo/Uzcard) | Kutilgan | Hozir: backend HAR DOIM 500,000 so'mni qaytaradi, fee qo'shilmaydi |
| 500,000 so'm -> 517,500 (Visa/MC) | Kutilgan | Mos keluvchi kod yo'q |
| Yagona real formula (agar `uzum_checkout` tanlansa, GELAJAKDA ulansa) | — | `commissionAmountSom = round(gross * 0.015)`, `customerTotal = gross + commissionAmountSom` — 500,000 so'm uchun **507,500 so'm** (bu, tasodifan, so'ralgan Humo/Uzcard misoliga miqdor jihatdan mos keladi, chunki ikkalasi ham 1.5%; farq shundaki bu stavka karta turiga emas, `uzum_checkout` provayderining O'ZIGA tegishli va hali ishlatilmayapti) |

### SAFAAR komissiyasi vs. to'lov-provayder fee — ikki ALOHIDA tushuncha

Kodda ikkalasi aniq ajratilgan (`common/finance.ts`):

- **SAFAAR komissiyasi** (`safaarCommissionAmountSom`) — hamkor (partner)
  bilan SAFAAR o'rtasidagi biznes shartnoma bo'yicha, `partner_payable`dan
  ayriladi. Foydalanuvchining to'lagan summasiga TA'SIR QILMAYDI — bu
  butunlay backend/moliya ichki hisob-kitobi, frontendga umuman
  ko'rsatilmaydi va ko'rsatilmasligi ham kerak.
- **Uzum Checkout fee (1.5%, hozircha faqat reference)** — yuqorida
  tasvirlangan, foydalanuvchi to'laydi (agar/qachon ulansa), hamkorga
  ham, SAFAAR komissiyasiga ham aloqasi yo'q.

Bu ikkalasini frontendda ARALASHTIRMASLIK kerak — SAFAAR komissiyasi
umuman frontendga tegishli emas (API javoblarida ham chiqmaydi).

---

## 5. Uzum Checkout redirect

`uzum_checkout` provayderi tanlansa, oqim boshqa provayderlardan (click/payme)
**tubdan farq qiladi**:

- Click/Payme uchun: `payment_url` **lokal ravishda, sinxron** quriladi
  (`ClickProvider.buildCheckoutUrl()` / `PaymeProvider.buildCheckoutUrl()`)
  — hech qanday tashqi API chaqirilmaydi.
- `uzum_checkout` uchun: backend Uzum'ning **haqiqiy** `/payment/register`
  API'siga chiquvchi (outbound) so'rov yuboradi (`UzumCheckoutProvider.register()`,
  2026-09-11dan rasmiy wire-format bilan tasdiqlangan) va javobdagi
  `orderId` + `paymentUrl`ni saqlaydi. Ya'ni `payment_url` Uzum'ning O'ZI
  qaytargan haqiqiy checkout sahifasi manzili.

**Frontend uchun amaliy oqim ikkala holatda ham BIR XIL:**
1. `POST /payments/:bookingId/create` javobidagi `payment_url`ni oling.
2. Browserni **to'liq sahifa redirecti** bilan (`window.location.href =`
   yoki server action'dagi `redirect()`) shu URL'ga yuboring — SPA/AJAX
   ichida iframe/modal orqali EMAS (checkout sahifasi Uzum/Click domenida
   ochiladi, cross-origin).
3. Uzum/Click **hech qanday holatda** frontendga alohida credential/kalit
   bermaydi va frontend Uzum bilan to'g'ridan-to'g'ri gaplashmaydi — butun
   muloqot backend orqali.

**Frontend Uzum credentiallaridan FOYDALANMAYDI** — `UZUM_CHECKOUT_*`
(terminal ID, API key, fiskal SPIC/packageCode/TIN/PINFL) barchasi faqat
backend `ConfigService` orqali, faqat backendda. Frontend faqat tayyor
`payment_url`ni oladi.

**Muhim cheklov (hozirgi holat):** `createUzumCheckoutPayment()` faqat
backend TO'LIQ sozlangan bo'lsagina (auth: `baseUrl`+`terminalId`+`apiKey`,
VA fiskal: `SPIC`+`packageCode`+`vatPercent`+TIN-yoki-PINFL) ishlaydi;
aks holda `POST /payments/:bookingId/create` **HTTP 503**
(`code: "PAYMENT_PROVIDER_NOT_CONFIGURED"`) qaytaradi. Frontend bu holatni
alohida ushlab, foydalanuvchiga tushunarli xabar ko'rsatishi kerak (masalan
"Bu to'lov usuli hozircha mavjud emas, boshqasini tanlang") — generik
"server xatosi" emas.

---

## 6. Payment status — real qiymatlar

`payments.status` ustunida haqiqatda ishlatiladigan qiymatlar (kod bo'yicha
tasdiqlangan, DB enum emas — erkin `varchar`, lekin kod FAQAT shu
qiymatlarni yozadi):

| Status | Ma'nosi | Yakuniymi? |
|---|---|---|
| `pending` | To'lov yaratildi, hali hech narsa qilinmadi | Yo'q |
| `processing` | Provayder tomonidan "prepare"/"create" bosqichi o'tdi (masalan Click prepare, Uzum Merchant `/create`, yoki Uzum Checkout `register()` muvaffaqiyatli) | Yo'q |
| `awaiting_cash` | Foydalanuvchi "joyida to'lash"ni tanladi | Yo'q (booking odatda darhol `confirmed`/`awaiting_partner_confirmation` bo'lib qoladi) |
| `paid` | To'lov tasdiqlandi (webhook orqali) | **Ha** |
| `reversed` | Bank/Uzum tomonidan bekor qilindi (`/reverse`) | **Ha** |
| `refunded` | Qaytarildi | **Ha** |
| `failed` | Muvaffaqiyatsiz (masalan Uzum Merchant oqimida 30 daqiqada `/confirm` kelmasa, cron avtomatik `failed`ga o'tkazadi) | **Ha** |

Bog'liq `bookings.status` qiymatlari (to'lov ta'sir qiladigan): `pending`,
`awaiting_payment`, `awaiting_partner_confirmation`, `confirmed`,
`cancelled`, `completed`, `expired`.

### Frontend qaysi endpoint orqali tekshiradi

- **`GET /payments/:bookingId`** — to'lovning o'zi uchun.
- Amalda haqiqiy sahifa (`booking/[id]/page.tsx`) bu endpointni ALOHIDA
  chaqirmaydi — buning o'rniga **`GET /bookings/:id`** javobidagi
  o'rnatilgan `payment` maydonidan foydalanadi (backend har safar ENG
  OXIRGI payment qatorini `ORDER BY created_at DESC LIMIT 1` bilan qo'shib
  qaytaradi). Ikkalasi ham xohlagan payt to'g'ri, yangilangan qiymat
  beradi — frontend komponentlari uchun amalda **booking endpointi
  qulayroq** (bitta so'rovda ham bron, ham to'lov holati).

### Qachon tekshiriladi

- Provayderdan qaytgach (`success`/`failure` URL'lardagi query parametr
  bilan BIRGA) — booking detail sahifasi **server-side** qayta render
  qilinadi va DB'dan ENG YANGI holatni oladi.
- **Avtomatik polling/qayta so'rov YO'Q** — sahifa `"use client"` emas,
  async server komponent, faqat bir marta yuklanadi. Agar webhook hali
  yetib kelmagan bo'lsa (masalan tarmoq kechikishi), foydalanuvchi
  sahifani **qo'lda yangilashi (refresh)** kerak bo'lishi mumkin.
  Bu 16-bo'limda UX talab sifatida qayd etiladi.

### "Redirect'ga ishonmaslik" printsipi — kodda qanday amalga oshgan

Bu backendning o'z arxitekturasi — frontend buni O'ZGARTIRMAYDI, faqat
BILISHI kerak: `?payment=success` yoki Uzum'ning `successUrl`siga qaytish
**hech qachon o'zi bilan to'lovni "paid" qilmaydi**. Buni real kod isbotlaydi:

- `booking/[id]/page.tsx`dagi `isConfirmed` state **HAM** query
  parametrga (`paymentQuery === "success"`), **HAM** haqiqiy DB holatiga
  (`payment?.status === "paid"`) qaraydi — ammo DB holati backend'da
  MUSTAQIL ravishda (webhook orqali) yoziladi, query parametr FAQAT UI
  matnini tezroq/optimistik ko'rsatish uchun ishlatiladi.
- Uzum Checkout tomonida bu yanada qattiqroq: hatto callback (webhook)
  o'zi ham YETARLI EMAS — backend callback body'sidagi summaga
  ishonmaydi, buning o'rniga **o'zining alohida, autentifikatsiyalangan**
  `getOrderStatus()` so'rovi bilan qayta tasdiqlaydi (`payments.service.ts`
  `uzumCheckoutCallback()`), va productionda callback imzosi hali
  sozlanmagani uchun **haqiqiy tasdiqlash asosan cron orqali** (pastga
  qarang) amalga oshadi.

**Frontend uchun xulosa:** redirect query parametrlarini FAQAT UI matnini
tezroq ko'rsatish uchun ishlating ("to'lov tekshirilmoqda..."), lekin
"haqiqatan to'landi" degan yakuniy holatni FAQAT `payment.status === "paid"`
(backend javobi) asosida ko'rsating.

---

## 7. Success / Failure UI — real holat bo'yicha

Real logika `booking/[id]/page.tsx`da. 3 ta asosiy holat mavjud (bir-birini
inkor etuvchi, tepadan pastga tekshiriladi):

| Holat | Shart (kod) | Sarlavha (real matn) | Qayta urinish? |
|---|---|---|---|
| **Tasdiqlangan** | `statusQuery==="confirmed" \|\| paymentQuery==="success" \|\| booking.status==="CONFIRMED" \|\| payment?.status==="paid"` | "Broningiz muvaffaqiyatli tasdiqlandi!" | Yo'q, kerak emas |
| **Muvaffaqiyatsiz** | `paymentQuery==="failed" \|\| payment?.status==="failed"` | "To'lov tranzaksiyasi amalga oshmadi" | **Ha** — pastda `RetryPaymentForm` ko'rsatiladi |
| **Joyida to'lash** | `paymentQuery==="cash" \|\| payment?.status==="awaiting_cash"` | "Joyida to'lash usuli tanlandi" | Yo'q, kerak emas |
| *(default)* | Yuqoridagilarning hech biri emas (masalan `pending`/`processing`) | Umumiy sahifa sarlavhasi (`dict.title`) | **Ha** |

To'lov usuli qayta tanlash bloki (`RetryPaymentForm` bilan) quyidagi
shartda ko'rinadi: `(!isConfirmed && !isAwaitingCash) || isFailed` — ya'ni
"tasdiqlanmagan VA joyida to'lash emas" YOKI "muvaffaqiyatsiz" bo'lsa.

Bron holati alohida qatorda har doim ko'rsatiladi (`Row label={dict.payment}`):
`PROVIDER · status` (masalan `"CLICK · pending"`), status matni
`dict.paymentStatuses` lug'atidan olinadi (agar tarjima bo'lmasa — xom
`payment.status` qiymati ko'rsatiladi).

---

## 8. Autentifikatsiyalangan foydalanuvchi to'lov oqimi

Bu — **standart, to'liq ishlaydigan** yo'l:

1. Foydalanuvchi login qilgan (`session.accessToken` mavjud).
2. `createBookingAction()` bronni `token: session.accessToken` bilan
   yaratadi (`api.bookings.createHotelBooking`).
3. `POST /payments/:bookingId/create` **HAM** shu token bilan yuboriladi.
4. Backend `assertBookingVisible()` orqali: `actor.actorType === 'user' &&
   booking.user_id === actor.id` tekshiradi — mos kelsa ruxsat beriladi.
5. To'lov muvaffaqiyatli/muvaffaqiyatsiz bo'lgandan keyin ham,
   `RetryPaymentForm` orqali istalgancha qayta urinish mumkin — chunki
   foydalanuvchi doim o'z tokeni bilan kiradi va `assertBookingVisible`
   doim o'tadi (agar bron o'ziniki bo'lsa).
6. `GET /bookings/:id` va `GET /payments/:bookingId` ham xuddi shu token
   bilan — o'z bronlarini istalgan payt ko'ra oladi.

Bu yo'lda hech qanday arxitektura muammosi yo'q — 9-bo'limdagi cheklov
FAQAT guest (login qilmagan) foydalanuvchiga tegishli.

---

## 9. Guest (mehmon) to'lov — MUHIM, TASDIQLANGAN CHEKLOV

**Qisqa xulosa: hozirgi backendda guest (login qilmagan) foydalanuvchi
ONLAYN to'lovni HECH QACHON yakunlay olmaydi — na birinchi urinishda, na
qayta urinishda.** Bu taxmin emas — kod orqali to'liq tasdiqlangan:

### Nega

1. **`POST /payments/:bookingId/create` va `GET /payments/:bookingId`
   ikkalasi ham `@Roles(Role.USER, Role.ADMIN, Role.SUPER_ADMIN)`** — guest
   token (`guestAccessToken`) uchun HECH QANDAY qabul qilish yo'li yo'q.
   `PaymentsController` umuman `guestAccessToken` parametrini bilmaydi.
2. `PaymentsService.assertBookingVisible()`ning birinchi tekshiruvi:
   ```ts
   if (!actor) {
     throw new UnauthorizedException({ code: 'AUTH_TOKEN_INVALID', ... });
   }
   ```
   — token yo'q bo'lsa, bron egasi kim bo'lishidan qat'i nazar, darhol 401.
3. Guest bron yaratganda `bookings.user_id = null` qilib yoziladi
   (`const userId = actor?.id ?? null;`, `bookings.service.ts`). Buni
   FAQAT keyinchalik olingan `guestAccessToken` orqali (`GET /bookings/:id`
   ichida) ko'rish mumkin — lekin bu token `PaymentsController` tomonidan
   TANILMAYDI.
4. Hatto guest keyinroq ro'yxatdan o'tib/login qilib **haqiqiy USER
   akkauntga ega bo'lsa ham** — `assertBookingVisible()`dagi tekshiruv
   `booking.user_id === actor.id` bo'lib qoladi, `booking.user_id` esa
   ABADIY `null` (booking yaratilgandan keyin hech qayerda
   yangilanmaydi/"claim" qilinmaydi) — demak login qilingandan keyin ham
   `ForbiddenException (BOOKING_FORBIDDEN)` chiqadi. Guest bron bilan
   yangi USER akkauntni "bog'lash" mexanizmi kodda YO'Q.

### Frontendda bu qanday ko'rinadi (real, kuzatilgan xatti-harakat)

- **Birinchi checkout paytida** (`createBookingAction`): guest uchun
  `session` yo'q, shuning uchun `token: session?.accessToken` ===
  `undefined`. `api.payments.createPaymentSession(...)` 401 bilan
  qaytadi, lekin bu **`try/catch` ichida jim yutiladi** — foydalanuvchiga
  hech qanday xato ko'rsatilmaydi, shunchaki `?payment=pending` bilan
  booking sahifasiga o'tkaziladi. Guest hech narsa tushunmay
  "to'lov kutilmoqda" holatida qolib ketadi.
- **Qayta urinishda** (`RetryPaymentForm` -> `createPaymentSessionAction`):
  bu action **aniq** `if (!session) redirect(login...)` qiladi — ya'ni
  guestni to'g'ridan-to'g'ri login sahifasiga yuboradi. Lekin yuqorida
  ko'rsatilganidek, login qilgandan keyin ham bron `BOOKING_FORBIDDEN`
  bilan rad etiladi (chunki `user_id` mos kelmaydi) — bu login-redirect
  muammoni HAQIQATDA HAL QILMAYDI.
- **Yagona ishlaydigan guest yo'li: `cash`** ("joyida to'lash"). Bunda
  `/payments/*` endpointlariga umuman murojaat qilinmaydi — bron yaratish
  endpointining o'zi `confirmCashBookingIfNeeded()` orqali bronni darhol
  tasdiqlaydi/`awaiting_partner_confirmation`ga o'tkazadi. Bu guest uchun
  100% ishlaydi.

### Frontendga aniq ko'rsatma

- Guest checkout oqimida, agar foydalanuvchi `cash`dan boshqa to'lov
  usulini tanlasa — buni ochiq-oydin cheklash (masalan online usullarni
  guest uchun disable qilib, "Onlayn to'lov uchun avval ro'yxatdan o'ting
  yoki kiring" degan xabar bilan) frontend darajasida qo'shish **kerak
  bo'lishi mumkin** — lekin bu backend o'zgarishi emas, balki mavjud
  cheklovni UI'da TO'G'RI aks ettirish masalasi.
- Bu — backend cheklovi, frontend uni "tuzatolmaydi" (guest uchun
  `/payments/*`ga kirish yo'q). Frontend faqat buni foydalanuvchiga
  tushunarli qilib ko'rsatishi mumkin.
- Bu masala 18-bo'limda ("Backend cheklovlari/bloklovchilar") ham qayd
  etilgan — bu joyda **backendni o'zgartirish tavsiya etilmaydi**, faqat
  frontend buni bilib UI qarorini shunga moslashi kerak.

---

## 10. Refund (qaytarish)

Refund uchun **alohida, ishlaydigan modul mavjud** (`apps/backend/src/refunds/*`)
— to'lovlar moduli bilan bevosita bog'liq emas, lekin `booking_id` orqali
bog'lanadi.

### Frontend (web-user) chaqira oladigan endpointlar

| Endpoint | Method | Auth | Vazifasi |
|---|---|---|---|
| `/refunds` | `POST` | `Role.USER` (yoki ADMIN) | O'z broni uchun qaytarish **so'rovi** ochish |
| `/refunds/:id` | `GET` | `Role.USER` (faqat o'ziniki) | Bitta refund holatini ko'rish |
| `/me/refunds` | `GET` | `Role.USER` | O'zining barcha refundlari ro'yxati |

**`POST /refunds` request body:** `{ "booking_id": "uuid", "reason": "..." }`

**Real hisob-kitob (kod bo'yicha, qattiq belgilangan):**
```
requested_amount = round(booking.total_amount * 0.8)   // 80%, ya'ni 20% ushlab qolinadi
status = "requested"
```
Bu — **so'rov yaratish**, pul HALI KO'CHIRILMAYDI. Agar bronga allaqachon
`status != 'rejected'` bo'lgan refund mavjud bo'lsa — backend YANGISINI
yaratmaydi, **mavjudini qaytaradi** (idempotent, xuddi to'lov yaratishga
o'xshash naqsh).

### Frontend NIMA QILMASLIGI kerak

- **`POST /admin/refunds/:id/approve` / `/reject` / `/retry` — bular ADMIN
  panel endpointlari, `web-user`dan HECH QACHON chaqirilmasligi kerak.**
  Real pulni qaytarish/tasdiqlash faqat shu admin endpointlar orqali
  (`AdminController`, tegishli `Permission.FinanceWrite` talab qiladi)
  amalga oshadi — bu web-user frontendining zimmasida emas.
- Frontend refund summasini o'zi hisoblamasligi kerak (80% qoidasi
  backendda qattiq yozilgan — o'zgarishi mumkin, frontend faqat
  backend qaytargan `requested_amount`ni ko'rsatishi kerak).
- Refund holatlari (`requested` va admin tomonidan o'zgartiriladigan
  keyingi holatlar) — frontend faqat `GET /me/refunds` /
  `GET /refunds/:id` orqali READ-ONLY ko'rsatishi kerak.

### Hozircha frontendda refund UI YO'Q

Web-userda bu endpointlarni chaqiradigan hech qanday komponent/action
topilmadi (`lib/services/*` ichida `refund` so'zi umuman uchramaydi) —
ya'ni bu **butunlay frontend TODO** (17-bo'limga qarang), backend tomon
tayyor.

---

## 11. Xavfsizlik — frontend NIMA QILMASLIGI KERAK

Bular kodning haqiqiy arxitekturasidan kelib chiqadigan, majburiy qoidalar:

1. **Uzum/Click/Payme credentiallarini frontendga chiqarmang.**
   `UZUM_CHECKOUT_*`, `CLICK_SECRET_KEY`, `PAYME_MERCHANT_ID`,
   `PAYMENT_WEBHOOK_SECRET` — barchasi faqat backend `ConfigService`da.
   Frontend build'iga (`NEXT_PUBLIC_*`) bularning hech biri
   CHIQARILMASLIGI kerak.
2. **Webhook endpointlarini (`/webhooks/*`, `/uzum/webhook/*`,
   `/uzum/checkout/callback`) frontenddan HECH QACHON chaqirmang.** Bular
   imzo (`X-Safaar-Signature`/`X-Signature`, HMAC-SHA256, backend
   sirlashtirilgan `PAYMENT_WEBHOOK_SECRET`) yoki Basic Auth
   (`Authorization`, Uzum Merchant) talab qiladi — bu ma'lumotlar
   frontendda BO'LMASLIGI ham, ishlatilmasligi ham kerak.
3. **To'lov holatini client tomonda "paid" deb qo'lda o'rnatmang.**
   Yagona haqiqat manbai — backend DB (`payments.status`), va u FAQAT
   webhook/cron orqali (provayder tomonidan) yoziladi. Redirect query
   parametri (`?payment=success`) faqat UI tezkorligi uchun, u holatni
   YOZMAYDI (6-bo'limga qarang).
4. **`localStorage`/`sessionStorage`ni to'lov holati uchun "haqiqat manbai"
   sifatida ishlatmang.** Sahifa yangilanganda/qayta ochilganda har doim
   `GET /bookings/:id` (yoki `GET /payments/:bookingId`) orqali serverdan
   qayta so'rang — kesh emas.
5. **Soxta muvaffaqiyat holatini simulyatsiya qilmang** (masalan test/dev
   uchun ham) — production kodda bunga umuman yo'l yo'q, va bu odat
   xavfli naqshni kodga singdiradi.
6. **Fee/komissiyani frontendda mustaqil hisoblab, uni "backend
   qiymati" sifatida ko'rsatmang** (4-bo'limga qarang) — backend hali
   bu summani hech qanday real so'rovga ulamagan, frontend-side
   hisoblangan raqam chalg'ituvchi bo'lishi mumkin.
7. **`provider` maydonini frontendda whitelist qilingan 7 ta qiymatdan
   tashqari yubormang** — global `ValidationPipe({forbidNonWhitelisted:
   true})` baribir har qanday qo'shimcha maydonni rad etadi, lekin
   noto'g'ri `provider` qiymati foydali xato o'rniga umumiy 400 beradi.
8. **`Authorization` headerini (foydalanuvchi accessToken) faqat
   `/payments/*` va boshqa autentifikatsiyalangan API so'rovlariga
   qo'shing — hech qachon Uzum/Click checkout URL'iga (browser
   redirect) qo'shmang.** Checkout URL'lar backend allaqachon to'liq,
   o'zida kerakli parametrlarni saqlagan holda tayyorlaydi.

---

## 12. Frontend API contract (yagona jadval)

| Frontend harakati | Method | Endpoint | Auth | Request | Response (`data`) | Frontendda ishlatilishi |
|---|---|---|---|---|---|---|
| To'lov sessiyasi yaratish/olish | `POST` | `/payments/:bookingId/create` | Bearer (USER/ADMIN/SUPER_ADMIN) | `{ provider }` | `{ id, booking_id, provider, status, payment_url, amount, currency, created_at, updated_at }` | `payment_url`ga redirect |
| To'lov holatini tekshirish | `GET` | `/payments/:bookingId` | Bearer (USER/ADMIN/SUPER_ADMIN) | — | yuqoridagi bilan bir xil shakl | Status ko'rsatish |
| Bron + to'lov holatini birga olish | `GET` | `/bookings/:id` | Bearer YOKI `guestAccessToken` (query) | — | `{ ...booking, payment: {...} | null }` | Booking detail sahifasi (real ishlatiladigan yo'l) |
| Refund so'rash | `POST` | `/refunds` | Bearer (USER) | `{ booking_id, reason }` | `{ id, booking_id, user_id, status: "requested", requested_amount, reason, ... }` | Hozircha UI YO'Q — TODO |
| O'z refundlarini ko'rish | `GET` | `/me/refunds` | Bearer (USER) | — | `refunds[]` | Hozircha UI YO'Q — TODO |
| Bitta refundni ko'rish | `GET` | `/refunds/:id` | Bearer (USER, faqat o'ziniki) | — | `refund` obyekti | Hozircha UI YO'Q — TODO |

Frontenddan **hech qachon** chaqirilmasligi kerak bo'lgan endpointlar
(to'liqlik uchun sanab o'tilgan, kontraktga kirmaydi):
`POST /webhooks/click/{prepare,complete}`, `POST /webhooks/{payme,uzcard,humo}`,
`POST /webhooks/payment/:provider`, `POST /uzum/webhook/:operation`,
`POST /uzum/checkout/callback`, `POST /admin/refunds/:id/{approve,reject,retry}`.

---

## 13. Frontend komponent/sahifalar (real nomlar)

| Nom (fayl) | Vazifasi |
|---|---|
| `app/[lang]/(main)/booking/_components/CheckoutForm.tsx` | Bron + to'lov usuli tanlash formasi (birinchi checkout) |
| `app/[lang]/(main)/booking/[id]/_components/RetryPaymentForm.tsx` | Mavjud bronga qayta to'lov urinishi |
| `app/[lang]/(main)/booking/[id]/page.tsx` | Booking detail — success/failed/awaiting_cash holatlarini ko'rsatuvchi, `RetryPaymentForm`ni shartli render qiluvchi asosiy sahifa |
| `components/features/checkout/PaymentSelector.tsx` | To'lov usuli tanlash UI (radio-karta ko'rinishida), `PaymentMethodId` type shu yerda e'lon qilingan |
| `lib/services/booking/actions.ts` (public alias: `lib/booking/actions.ts`) | `createBookingAction()` — bron + birinchi to'lov yaratish server action |
| `lib/services/payments/actions.ts` (public alias: `lib/payments/actions.ts`) | `createPaymentSessionAction()` — qayta to'lov server action |
| `lib/services/payments/payments.ts` | `paymentsService` — `POST /payments/:bookingId/create` va `GET /payments/:bookingId` uchun haqiqiy HTTP wrapper, `PaymentProvider`/`PaymentResult` tiplari shu yerda |
| `packages/api-client/src/services/bookings.ts` | `api.bookings.createHotelBooking()` — `agree_terms` maydonini backendga jo'natadigan joy |

**Diqqat:** `lib/services/booking/actions.ts` va `lib/booking/actions.ts`
— IKKALASI ham mavjud, lekin ikkinchisi faqat `export * from
"../services/booking/actions"` qiladi (public alias). Xuddi shunday
`lib/payments/actions.ts` ham `lib/services/payments/actions.ts`ning
alias'i. **Haqiqiy logika har doim `lib/services/*` ichida** — yangi
o'zgarish kiritilganda shu yerga kiritilishi kerak, alias fayllarga emas.

---

## 14. Xatoliklarni boshqarish

Backend xato javob shakli (barcha endpointlar uchun bir xil,
`HttpErrorFilter`):
```json
{
  "success": false,
  "error": { "code": "TERMS_NOT_ACCEPTED", "message": "...", "fields": null },
  "meta": { "request_id": "..." }
}
```

| Holat | HTTP | `error.code` | Frontend nima qilishi kerak |
|---|---|---|---|
| Validatsiya xatosi (masalan noto'g'ri `provider`) | 400 | `REQUEST_ERROR` (class-validator xabari `message`da) | Formani qayta tekshirish, foydalanuvchiga aniq maydon xatosini ko'rsatish |
| Token yo'q/yaroqsiz | 401 | `AUTH_TOKEN_INVALID` | Login sahifasiga yo'naltirish (`redirectToLoginIfSessionExpired` naqshi allaqachon `booking/actions.ts`da bor — shu naqshni boshqa joylarda ham ishlating) |
| Bron boshqa foydalanuvchiniki | 403 | `BOOKING_FORBIDDEN` | "Bu bron sizga tegishli emas" — qayta urinish tugmasi ko'rsatmang |
| Bron topilmadi/muddati tugagan | 404 | `BOOKING_EXPIRED` | "Bron topilmadi" xabari, bosh sahifaga qaytarish |
| To'lov topilmadi | 404 | `PAYMENT_PROVIDER_ERROR` | Kamdan-kam holat — booking hali payment qatorisiz bo'lganda |
| Provayder sozlanmagan (click/payme/uzcard/humo/uzum_checkout) | 503 | `PAYMENT_PROVIDER_NOT_CONFIGURED` | "Bu to'lov usuli hozircha mavjud emas" — boshqa usul tanlashni taklif qiling, umumiy "server xatosi" ko'rsatmang |
| Webhook summasi/valyutasi mos kelmadi (backend ichki) | 422 | `PAYMENT_AMOUNT_MISMATCH` / `PAYMENT_CURRENCY_MISMATCH` | Frontendga bevosita ta'sir qilmaydi (server-to-server), lekin natijada payment holati o'zgarmay qolishi mumkin — "pending" holatini kutish kerak |
| Muvaffaqiyatli, lekin `payment_url` bo'sh | 200 | — (`payment_url: null`) | 3-bo'limdagi kabi alohida ushlang — "hozircha to'lash imkoni yo'q" |

**Timeout:** kodda frontend uchun maxsus timeout siyosati yo'q — oddiy
`fetch()` ishlatiladi (`lib/services/payments/payments.ts`), brauzer/Next.js
standart timeout'i qo'llanadi. Uzum Checkout uchun backendning o'z
tarafida `register()`/`getOrderStatus()` chaqiruvlari muvaffaqiyatsiz
bo'lsa, bu **backend xatosi sifatida** frontendga 503/500 ko'rinishida
qaytadi — frontend buni oddiy "provayder mavjud emas" xatosi kabi
ko'rsatishi kifoya.

**Pending holat:** `payment.status === "pending"` yoki `"processing"` —
xato EMAS, kutish holati. Frontend buni xato sifatida emas, "to'lov
tasdiqlanishi kutilmoqda" ko'rinishida ko'rsatishi kerak (booking detail
sahifasidagi default holat aynan shu).

---

## 15. To'lov UX mezonlari

- **Ikki marta bosish:** himoya backend darajasida (3-bo'lim) — frontend
  qo'shimcha ravishda `pending` holatida tugmani `loading`/`disabled`
  qilishni davom ettirishi kerak (mavjud `Button loading={pending}` naqshi
  to'g'ri, saqlansin).
- **Loading:** `useActionState`'ning `pending` qiymati — mavjud, saqlansin.
- **Redirect:** faqat `payment_url` mavjud bo'lganda, **to'liq sahifa**
  redirecti bilan (yangi tab/iframe EMAS — checkout ba'zan 3D-Secure kabi
  qo'shimcha qadamlar talab qiladi, bular iframe ichida ishlamasligi
  mumkin).
- **Qaytish (return):** provayderdan qaytgach sahifa **server-side qayta
  render** bo'ladi — bu holatni to'g'ri ko'rsatish uchun YETARLI, qo'shimcha
  client-side ishlov kerak emas, FAQAT agar webhook hali kelmagan bo'lsa.
- **Refresh:** webhook redirect'dan sekinroq kelishi mumkin (tarmoq/provayder
  tomonidan) — bu holda foydalanuvchi hali "pending" ko'radi. **Tavsiya
  (frontend TODO, 17-bo'limga qarang):** foydalanuvchiga "holatni
  yangilash" tugmasi yoki qisqa avtomatik polling qo'shish, chunki hozirgi
  kodda buning hech biri yo'q.
- **Browser back:** checkout provayder sahifasidan "orqaga" qaytilsa,
  foydalanuvchi booking detail sahifasida (odatiy holat, `?payment=pending`
  query bilan) qoladi — bu allaqachon to'g'ri ishlaydi, chunki har bir
  sahifa yuklanishi DB'dan yangi holatni oladi.
- **Pending to'lov:** `RetryPaymentForm` har doim ko'rsatiladi (agar
  `isConfirmed`/`isAwaitingCash` bo'lmasa) — foydalanuvchi boshqa usul bilan
  qayta urinishi mumkin.
- **Muvaffaqiyatsiz to'lov:** xuddi shu forma, aniq "muvaffaqiyatsiz"
  xabari bilan (7-bo'lim).
- **Qayta urinish:** `PaymentSelector` har safar qaytadan ko'rsatiladi —
  foydalanuvchi boshqa provayder tanlashi mumkin (masalan Click
  ishlamasa, Payme'ga o'tish).

---

## 16. End-to-end frontend test ssenariylari

Quyidagilar backend REAL imkoniyatlariga asoslangan (hammasi yuqorida
tasdiqlangan xatti-harakatlarga mos):

1. **Muvaffaqiyatli to'lov (login qilgan foydalanuvchi, Click):** bron
   yaratish -> `payment_url`ga redirect -> Click checkout -> qaytish ->
   `payment.status === "paid"` -> "tasdiqlandi" UI.
2. **Muvaffaqiyatsiz to'lov:** Click checkout'da bekor qilish -> qaytish
   `?payment=failed` bilan -> "muvaffaqiyatsiz" UI + qayta urinish formasi.
3. **Pending/kutish holati:** webhook hali kelmagan holatda qaytish —
   default UI (na confirmed, na failed) ko'rsatilishi, `RetryPaymentForm`
   mavjudligi.
4. **Ikki marta bosish (duplicate click):** "To'lash" tugmasini tez-tez
   bosish — bitta payment qatori yaratilishi, ikkinchi so'rov xuddi
   birinchisi kabi javob qaytarishi (yangi qator YO'Q).
5. **Muddati tugagan bron:** eski/muddati o'tgan `bookingId` bilan
   `POST /payments/:bookingId/create` — `404 BOOKING_EXPIRED`.
6. **Avtorizatsiyasiz (unauthorized):** tokensiz
   `POST /payments/:bookingId/create` — `401 AUTH_TOKEN_INVALID`.
7. **Boshqa foydalanuvchi broni:** boshqa userga tegishli bron uchun
   to'lov yaratish — `403 BOOKING_FORBIDDEN`.
8. **Shartlar (terms) belgilanmagan:** `agreeTerms` checkbox
   belgilanmasdan submit — frontend client-side `TERMS_NOT_ACCEPTED`
   bilan to'xtatadi (backend so'ralmaydi ham); agar frontend
   tekshiruvi chetlab o'tilsa (masalan dasturiy submit) — backend
   `400 TERMS_NOT_ACCEPTED` bilan rad etadi.
9. **Shartlar belgilangan:** normal oqim, bron muvaffaqiyatli yaratiladi.
10. **Uzum'dan qaytish:** `uzum_checkout` provayderi bilan to'lov ->
    Uzum checkout sahifasi -> `successUrl`/`failureUrl`ga qaytish ->
    holatni **faqat** `GET /bookings/:id` orqali tasdiqlash (redirect
    query'ga ishonmaslik, 6-bo'lim).
11. **To'lovdan keyin refresh:** muvaffaqiyatli to'lovdan keyin sahifani
    qo'lda yangilash — holat o'zgarmasligi (`paid` bo'lib qolishi) kerak.
12. **Qayta urinish (retry):** `failed` holatidagi bronda boshqa
    provayder tanlab qayta urinish — yangi `payment_url` olinishi.
13. **Guest oqimi (cheklangan!):** guest sifatida `cash` bilan bron —
    to'liq ishlashi kerak (booking darhol tasdiqlanadi). Guest sifatida
    `click`/`payme`/`uzcard` bilan bron — **hozirgi backendda muvaffaqiyatli
    yakunlanmasligini** test qilib tasdiqlash (9-bo'limdagi cheklovni
    regression sifatida kuzatish uchun foydali test — "guest onlayn to'lay
    olmasligi kerak" emas, balki "guest onlayn to'lay OLMAYDI, va bu
    UI'da tushunarli ko'rsatilishi kerak" degan ma'noda).

---

## 17. Frontend TODO (faqat frontend qilishi kerak bo'lgan ishlar)

Bular — backend ALLAQACHON qo'llab-quvvatlaydigan, lekin frontendda hali
ulanmagan/ko'rsatilmagan narsalar:

1. **Guest uchun onlayn to'lov tanlovini UI darajasida cheklash** —
   hozir `CheckoutForm.tsx` guestga `click`/`payme`/`uzcard`ni erkin
   tanlashga ruxsat beradi, natija esa jim muvaffaqiyatsizlik (9-bo'lim).
   Kamida: guest holatida bu variantlarni yashirish/disable qilish, yoki
   aniq "Onlayn to'lov uchun ro'yxatdan o'ting" xabari ko'rsatish.
2. **`RetryPaymentForm`da xato holatini aniqroq ajratish** — hozir barcha
   xatolar bitta umumiy matn bilan ko'rsatiladi ("To'lovni amalga
   oshirishda xatolik yuz berdi"); backend `error.code` (masalan
   `PAYMENT_PROVIDER_NOT_CONFIGURED`) allaqachon farqli xabar berish
   imkonini beradi — frontend buni ishlatmayapti.
3. **`payment_url: null` (lekin HTTP 200) holatini alohida ushlash** —
   hozir bu holat oddiy "muvaffaqiyat" kabi ko'rinib, foydalanuvchi
   hech narsa tushunmay qolishi mumkin (3-bo'lim).
4. **Refund UI** — backend `POST /refunds`, `GET /me/refunds`,
   `GET /refunds/:id` tayyor, lekin web-userda hech qanday komponent/
   action bu bilan ishlamaydi (10-bo'lim). Kerak bo'lsa: "Bekor qilish /
   pulni qaytarish so'rash" tugmasi + o'z refundlari ro'yxati sahifasi.
5. **To'lov holatini yangilash uchun UX** — webhook kechikishi holatlarida
   foydalanuvchiga "holatni tekshirish" tugmasi yoki qisqa muddatli
   client-side polling qo'shish (hozir faqat qo'lda `F5` orqali ishlaydi).
6. **`createBookingAction()`dagi jim yutilgan xatoni ko'rinadigan qilish**
   — hozir `catch { /* fallback */ }` hech qanday signal bermaydi;
   kamida analytics/log yuborish, imkon bo'lsa foydalanuvchiga ham xabar.
7. **Fee/komissiya UI — HOZIRCHA QO'SHMASLIK** (4-bo'lim) — backend tayyor
   bo'lgach (agar `calculatePaymentBreakdown()` real oqimga ulansa va
   API javobiga `provider_fee_amount`/`customer_total_amount` kabi
   maydonlar qo'shilsa), frontend O'SHA maydonlarni ko'rsatadigan UI
   qo'shishi kerak bo'ladi — hozircha bu backend o'zgarishini kutadi.

---

## 18. Backend cheklovlari / bloklovchilar (frontend to'liq bajara olmaydigan sabablar)

1. **Guest onlayn to'lov — arxitektura darajasidagi cheklov** (9-bo'lim).
   Frontend buni "tuzatolmaydi" — `PaymentsController` guest tokenlarini
   umuman qabul qilmaydi, va guest bron `user_id=null` bo'lgani uchun
   keyinchalik login qilish ham yordam bermaydi. Bu **backend o'zgarishi**
   talab qiladi (masalan guest-token qo'llab-quvvatlash yoki
   booking->user "claim" mexanizmi) — frontend faqat cheklovni UI'da
   to'g'ri aks ettira oladi, hal qila olmaydi.
2. **`uzcard`/`humo` standalone provayder sifatida checkout URL YARATA
   OLMAYDI.** `buildCheckoutUrl()` bu ikkalasi uchun har doim `503
   PAYMENT_PROVIDER_NOT_CONFIGURED` tashlaydi (kod izohi: "hozircha
   checkout URL generatsiyasi qo'shilmagan"). Amaliy natija: hozirgi
   `PaymentSelector`dagi "Uzcard / Humo" varianti tanlansa, foydalanuvchi
   HAR DOIM to'lay olmaydi (agar backend buni implement qilmagunicha).
   Frontend buni backend implement qilgunicha UI'dan olib tashlashi yoki
   "tez orada" belgisi bilan cheklashi mumkin — lekin buni ISHLATIB
   BO'LMAYDI.
3. **`uzum_checkout` to'liq ishlashi uchun backend ENV to'liq
   sozlanishi shart** (auth + fiskal parametrlar) — sozlanmagan bo'lsa
   har doim 503. Bu — infratuzilma/konfiguratsiya masalasi, frontend
   kod bilan hal qilinmaydi.
4. **Uzum Checkout callback productionda HAR DOIM rad etiladi (401)** —
   rasmiy signature sxemasi hali yo'qligi sababli, ataylab shunday
   qilingan (kod izohi: *"placeholder" imzo sxemasini productionga
   qabul qilish YO'Q*). Haqiqiy tasdiqlash faqat
   `reconcileUzumCheckoutPaymentsCron` (har daqiqada, backend'ning o'z
   `getOrderStatus()` so'rovi orqali) ishlaydi — ya'ni `uzum_checkout`
   orqali to'lagan foydalanuvchi holati **kamida bir necha daqiqa
   kechikishi mumkin** (callback emas, cron orqali tasdiqlanadi). Frontend
   buni "webhook darhol keladi" deb TAXMIN QILMASLIGI kerak — refresh/
   polling UX (17-bo'lim, band 5) ayni shu sabab muhim.
5. **Payme webhook hali to'liq ishlamaydi** — `PaymeProvider`dagi
   kod izohi bo'yicha: *"PaymentsController'dagi `webhooks/payme` route
   hozircha eski umumiy yo'l bilan ishlaydi va Payme bilan hali real
   ishlamaydi"*. Ya'ni checkout URL yaratilishi mumkin (agar
   `PAYME_MERCHANT_ID` sozlangan bo'lsa), lekin to'lov tasdiqlanishi
   (webhook orqali `paid` bo'lish) ishonchli emas.
6. **Fee/komissiya real oqimga ulanmagan** (4-bo'lim) — frontend
   backend'dan hech qanday fee ma'lumotini olmaydi, chunki backend
   hali buni qaytarmaydi.
7. **Click/Payme muhitga bog'liq (`CLICK_SERVICE_ID`/`CLICK_MERCHANT_ID`/
   `CLICK_SECRET_KEY`, `PAYME_MERCHANT_ID`)** — sozlanmagan muhitda
   (masalan lokal/QA) bu provayderlar ham 503 beradi. Frontend buni
   muhitga qarab kutilgan xatti-harakat sifatida hisobga olishi kerak
   (bu xato emas, konfiguratsiya holati).

---

## 19. Yakuniy oqim diagrammasi

```
┌──────────┐        ┌───────────────┐        ┌──────────────────┐        ┌───────────────┐
│   USER   │        │   web-user    │        │  SAFAAR backend   │        │ Uzum/Click/   │
│ (browser)│        │  (Next.js)    │        │     (NestJS)       │        │ Payme (provayder) │
└────┬─────┘        └───────┬───────┘        └─────────┬─────────┘        └───────┬───────┘
     │  1. Checkout formani  │                          │                          │
     │     to'ldiradi        │                          │                          │
     │───────────────────────>                          │                          │
     │  [BROWSER]             │  2. POST bron yaratish   │                          │
     │                        │────────────────────────>│                          │
     │                        │  [FRONTEND -> BACKEND]   │  3. bron + payment       │
     │                        │                          │     qatori (DB, 1 tx)   │
     │                        │                          │  [BACKEND]               │
     │                        │<────────────────────────│                          │
     │                        │  4. (agar cash bo'lmasa)│                          │
     │                        │  POST /payments/:id/create                         │
     │                        │────────────────────────>│                          │
     │                        │  [FRONTEND -> BACKEND]   │                          │
     │                        │                          │  5. payment_url          │
     │                        │                          │     (mavjud bo'lsa       │
     │                        │                          │     qaytariladi, aks     │
     │                        │                          │     holda click/payme    │
     │                        │                          │     lokal quradi, yoki   │
     │                        │                          │     Uzum /register       │
     │                        │                          │     chaqiradi)  [BACKEND]│
     │                        │<────────────────────────│                          │
     │  6. Full-page redirect │                          │                          │
     │<───────────────────────│                          │                          │
     │  [BROWSER]              │                          │                          │
     │                                                    │                          │
     │  7. Checkout sahifasida karta ma'lumotlari, 3DS    │                          │
     │─────────────────────────────────────────────────────────────────────────────>│
     │  [BROWSER <-> PROVAYDER, backend ishtirokisiz]     │                          │
     │                                                    │                          │
     │                                                    │  8. Webhook (server-    │
     │                                                    │     to-server, imzo     │
     │                                                    │     bilan tasdiqlangan) │
     │                                                    │<─────────────────────────│
     │                                                    │  [PROVAYDER -> BACKEND] │
     │                                                    │  payment.status='paid'  │
     │                                                    │  booking.status=        │
     │                                                    │  'confirmed'/'awaiting_ │
     │                                                    │  partner_confirmation'  │
     │                                                    │  [BACKEND, MUSTAQIL]    │
     │                                                    │                          │
     │  9. Provayder foydalanuvchini qaytaradi             │                          │
     │<─────────────────────────────────────────────────────────────────────────────│
     │  [BROWSER redirect, provayderdan]                  │                          │
     │                        │  10. GET /bookings/:id   │                          │
     │                        │  (server-side render)    │                          │
     │                        │────────────────────────>│                          │
     │                        │  [FRONTEND -> BACKEND]   │                          │
     │                        │  11. booking + ENG YANGI │                          │
     │                        │      payment holati      │                          │
     │                        │<────────────────────────│                          │
     │  12. Success/Failed/   │                          │                          │
     │      Pending UI        │                          │                          │
     │<───────────────────────│                          │                          │
     │  [BROWSER]              │                          │                          │

Eslatma (uzum_checkout uchun MAXSUS): 8-qadam productionda callback orqali
EMAS, balki backend'ning o'z ichki `reconcileUzumCheckoutPaymentsCron()`
(har daqiqada) orqali, Uzum'ning `getOrderStatus()` API'sini backend
O'ZI so'rab tasdiqlaydi — bu ham [BACKEND, MUSTAQIL], frontend/browser
ishtirokisiz, va foydalanuvchi qaytishidan (9-qadam) KEYINGI daqiqalarda
ham davom etishi mumkin.
```

**Legenda:** `[BROWSER]` — foydalanuvchi brauzerida sodir bo'ladi (frontend
kod yoki provayder sahifasi); `[FRONTEND -> BACKEND]` / `[BACKEND ->
FRONTEND]` — Next.js server action/komponent orqali SAFAAR API'ga so'rov;
`[BACKEND]` / `[BACKEND, MUSTAQIL]` — foydalanuvchi so'rovisiz, backend
ichida yoki backend<->provayder orasida sodir bo'ladi, frontend bunga
umuman ta'sir qilolmaydi va kuzata olmaydi (faqat natijasini keyingi
`GET /bookings/:id` orqali ko'radi).
