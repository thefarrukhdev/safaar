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
> **Repo holati:** `temp/save-all-work` branch, 2026-09-17 (v2 — 2026-09-16
> product talabi bo'yicha backend'ga HUMO/UZCARD/VISA/MASTERCARD fee,
> guest to'lov va Uzum Checkout refund integratsiyasi qo'shilgandan
> keyingi holat).
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
>
> ### v1 dan v2 ga nima o'zgardi (frontend uchun MUHIM)
>
> 1. **HUMO/UZCARD/VISA/MASTERCARD endi HAQIQATAN ISHLAYDI** — barchasi
>    Uzum Checkout orqali, backend fee'ni hisoblab, Uzum'ga yuboriladigan
>    summaga QO'SHADI. Avval `uzcard`/`humo` har doim 503 berardi,
>    `visa`/`mastercard` umuman mavjud emas edi (4-bo'lim).
> 2. **Guest (login qilmagan) to'lov endi ISHLAYDI** — mavjud
>    `guestAccessToken` (booking yaratishda qaytariladigan) endi
>    `/payments/*` so'rovlariga `?guestToken=` query parametri sifatida
>    qo'shilishi mumkin (9-bo'lim). Avval bu HAR DOIM 401 berardi.
> 3. **"Boshqa to'lov usulini tanlash" bugi tuzatildi** — avval, agar
>    bronda allaqachon ochiq (pending/processing) payment qatori bo'lsa,
>    `POST /payments/:bookingId/create`ga yuborilgan `provider` HECH QANDAY
>    ta'sir qilmasdi (eski qator har doim qaytardi). Endi boshqa usul
>    so'ralsa va eski qator hali hech qanday tashqi provayderga tegmagan
>    bo'lsa — xavfsiz almashtiriladi (3-bo'lim).
> 4. **Refund endi Uzum Checkout bilan HAQIQIY integratsiyalangan** — admin
>    `uzum_checkout` orqali to'langan bronni tasdiqlasa, backend haqiqiy
>    `/acquiring/refund` so'rovini yuboradi (10-bo'lim). Bu web-user
>    frontendiga bevosita ta'sir qilmaydi (refund admin panel ishi), lekin
>    "refund ishlaydimi" degan savolga endi aniq javob bor.

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

Agar shunday qator topilsa VA **so'ralgan usul mavjud qatornikiga mos
kelsa** — **o'sha AYNAN SHU qator** (o'zgarishsiz) qaytariladi, yangi qator
yaratilmaydi. Demak: bir xil bronga, bir xil usul bilan bir necha marta
`POST /payments/:bookingId/create` yuborilsa (masalan tugma ikki marta
bosilsa, yoki tarmoq sekinligidan foydalanuvchi qayta bossa) — bir xil
natija qaytadi, xavfli dublikat yo'q.

**v2'da TUZATILGAN bug (frontend eski hujjatga tayanmasin):** Ilgari bu
tekshiruv `provider`ni o'qishdan OLDIN ishlar edi — ya'ni bronda ALLAQACHON
ochiq qator bo'lsa (masalan booking yaratilishida avtomatik yaratilgan),
`POST /payments/:bookingId/create`ga yuborilgan `provider` **umuman
e'tiborga olinmasdi**, har doim eski qator qaytardi. **Endi tuzatildi:**
- Agar so'ralgan usul mavjud qatorning usuli bilan **mos kelsa** — o'sha
  qator qaytadi (yuqoridagi kabi, idempotent).
- Agar **boshqa** usul so'ralsa VA mavjud qator hali **hech qanday tashqi
  provayderga tegmagan** bo'lsa (`status='pending'`, `provider_reference`
  yo'q — masalan booking yaratilishida ichki yaratilgan, checkout URL'i
  hali yo'q qator) — backend uni **xavfsiz almashtiradi**, yangi so'ralgan
  usul bilan.
- Agar boshqa usul so'ralsa, lekin mavjud qator **allaqachon haqiqiy tashqi
  sessiyaga ega** (`status='processing'` yoki `provider_reference` bor —
  masalan Uzum Checkout'da haqiqiy `orderId` bilan ro'yxatdan o'tgan) —
  backend uni ALMASHTIRMAYDI, o'sha (eski) qatorni qaytaradi. **Frontend
  buni bilishi kerak:** agar foydalanuvchi hali natijasi noma'lum (pending/
  processing) to'lovda boshqa usul tanlasa, javobdagi `provider` so'ralgan
  bilan mos kelmasligi mumkin — bu XATO EMAS, backend eski, hali yakunlanishi
  mumkin bo'lgan to'lovni tasodifan bekor qilib qo'ymaslik uchun ataylab
  shunday. Foydalanuvchiga eski usul bo'yicha checkout'ni yakunlashni yoki
  kutishni taklif qiling.

**`payment_url` bo'sh qaytishi mumkin bo'lgan holat (hamon amal qiladi):**
Agar tanlangan provayder (masalan `click`/`payme`) sozlanmagan bo'lsa,
backend endi **aniq 503 xato** qaytaradi (`PAYMENT_PROVIDER_NOT_CONFIGURED`)
— jim `payment_url: null` bilan HTTP 200 QAYTARMAYDI. Bundan mustasno: agar
mavjud qator boshqa usul uchun ALLAQACHON `payment_url: null` bilan
yaratilgan bo'lsa (yuqoridagi "tashqi sessiyaga ega emas" holatidan farqli
o'laroq, masalan eski, hali chaqirilmagan holatlar) — bu kamdan-kam va
frontend uni alohida "hozircha to'lash imkoni yo'q" holati sifatida ushlashi
tavsiya etiladi. Pastga, 14-bo'limga qarang.

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

> ✅ **v2 (2026-09-16/17): HUMO/UZCARD/VISA/MASTERCARD endi HAQIQATAN
> ISHLAYDI, fee real oqimga ulangan.** Quyida real, testlar bilan
> tasdiqlangan holat.

### Real provider capability (nega arxitektura shunday)

Uzum Checkout — bitta hosted checkout sahifasi orqali Humo/Uzcard/Visa/
Mastercard kartalarining barchasini avtomatik qabul qiladigan YAGONA real
karta-integratsiyasi (`UzumCheckoutProvider.register()`, rasmiy wire-format
2026-09-11dan tasdiqlangan). Shu sabab backend arxitekturasi **alohida 4 ta
provayder EMAS**, balki:

- **Transport (`payments.provider` ustuni) — har doim `uzum_checkout`**
  bo'lib qoladi (mavjud callback/reconciliation/cron mantig'i
  o'zgarishsiz ishlashi uchun).
- **Foydalanuvchi tanlagan karta turi — YANGI `payments.card_scheme`
  ustunida** saqlanadi (`humo`/`uzcard`/`visa`/`mastercard`), fee
  stavkasini belgilaydi.
- Frontend uchun bu FARQ ko'rinmaydi — `provider` so'rov maydoniga
  to'g'ridan-to'g'ri `"humo"`/`"uzcard"`/`"visa"`/`"mastercard"` yuboriladi
  (`CreatePaymentDto` shu 4 qiymatni ham qabul qiladi), va javobdagi
  `provider` maydonida ham AYNAN shu qiymat qaytadi (ichki `uzum_checkout`
  transport YASHIRILADI).

### Real fee stavkalari (kod: `payments/providers/card-scheme-fee.ts`)

```ts
export const CARD_SCHEME_FEE_RATES = {
  humo: 0.015,       // 1.5%
  uzcard: 0.015,      // 1.5%
  visa: 0.035,        // 3.5%
  mastercard: 0.035,  // 3.5%
};
export const CARD_SCHEME_FEE_BEARER = 'USER'; // foydalanuvchi to'laydi
```

Bu — mahsulot talabi (2026-09-16) bilan **aynan mos** (topshiriqdagi
misoldan endi FARQ qilmaydi). 500,000 so'm uchun (testlar bilan
tasdiqlangan, `payments.service.card-scheme.spec.ts`):

| Karta turi | Fee | Yakuniy (backend Uzum'ga yuboradigan) summa |
|---|---|---|
| HUMO | 7,500 so'm (1.5%) | **507,500 so'm** |
| UZCARD | 7,500 so'm (1.5%) | **507,500 so'm** |
| VISA | 17,500 so'm (3.5%) | **517,500 so'm** |
| MASTERCARD | 17,500 so'm (3.5%) | **517,500 so'm** |

**Muhim, real amaliyot cheklovi (Uzum Checkout kontraktidan kelib
chiqadi):** Uzum Checkout'ning rasmiy `/payment/register` so'rovi karta
turini OLDINDAN bilishni talab qilmaydi va OLDINDAN so'ramaydi — fee
foydalanuvchi SAFAAR UI'da qaysi tugmani bosishiga (Humo/Uzcard/Visa/
Mastercard) qarab, checkout'ga o'tishdan OLDIN hisoblanadi va Uzum'ga
yuboriladigan summaga QO'SHILADI. Uzum'ning rasmiy `AcquiringCallbackData`
callback schema'sida karta tarmog'ini (Humo/Uzcard/Visa/Mastercard)
qaytaradigan maydon YO'Q (faqat `cardType`: 1=korporativ/2=shaxsiy — bu
karta TARMOG'I EMAS) — ya'ni backend foydalanuvchi checkout sahifasida
HAQIQATDA qaysi kartani kiritganini keyinchalik tekshira olmaydi. Bu —
Uzum Checkout'ning o'zi qo'yadigan cheklov, SAFAAR arxitekturasi
o'zgartira olmaydigan holat; frontend UI'da foydalanuvchiga tanlagan karta
turi bilan checkout'da kiritadigan karta BIR XIL bo'lishi kerakligini aniq
ko'rsatishi tavsiya etiladi.

### Backend qanday hisoblaydi va qaytaradi (`POST /payments/:bookingId/create`)

`provider` sifatida `humo`/`uzcard`/`visa`/`mastercard` yuborilganda,
javob endi to'liq fee taqsimotini o'z ichiga oladi:

```json
{
  "id": "uuid",
  "booking_id": "uuid",
  "provider": "visa",
  "status": "processing",
  "payment_url": "https://checkout.uzum.uz/pay/...",
  "amount": 517500,
  "base_amount": 500000,
  "fee_rate": 0.035,
  "fee_amount": 17500,
  "currency": "UZS",
  "created_at": "...",
  "updated_at": "..."
}
```

- **`amount`** — Uzum'ga HAQIQATDA yuborilgan/checkout sahifasida
  foydalanuvchi ko'radigan yakuniy summa (fee QO'SHILGAN holda). Bu —
  **backend'ning yagona haqiqat manbai**; frontend bu qiymatni
  o'zgartirmasdan, boshqa hisob-kitobsiz ishlatishi kerak.
- **`base_amount`** — bron gross summasi (fee qo'shilmasdan oldin).
- **`fee_rate`** / **`fee_amount`** — qo'llangan stavka va summa, faqat
  ko'rsatish/tushuntirish uchun (masalan "shu jumladan X so'm karta
  to'lov haqi" degan matn checkout'da).
- Click/Payme/Cash/Uzum (merchant)/schemasiz `uzum_checkout` uchun —
  `fee_rate`/`fee_amount` = `0`, `base_amount` = `amount` (fee yo'q,
  o'zgarmagan).

**Frontend fee'ni MUSTAQIL HISOBLAMASLIGI SHART** — checkout'da "to'lov
usuli" tanlanganda, yakuniy summani ko'rsatish uchun ENG TO'G'RI yo'l:
`POST /payments/:bookingId/create` chaqirib (yoki kelajakda alohida
"quote" endpoint qo'shilsa, o'shani chaqirib — hozircha bunday alohida
preview endpoint YO'Q, real yaratish so'rovining o'zi darhol yakuniy
summani qaytaradi), backend qaytargan `amount`/`fee_amount`ni ko'rsatish.
`PaymentSelector` UI'da usul almashtirilganda YANGI `POST
.../create` so'rovi yuborish kerak bo'ladi (3-bo'limdagi "boshqa usul
so'ralsa xavfsiz almashtiriladi" qoidasi tufayli bu endi TO'G'RI ishlaydi).

### Real frontend PaymentSelector — YANGILANISHI KERAK (hozircha ESKI holatda)

`components/features/checkout/PaymentSelector.tsx` **HALI HAM** faqat 4 ta
eski variant ko'rsatadi (`click`, `payme`, birlashtirilgan `"Uzcard /
Humo"`, `cash`) — VISA/MASTERCARD uchun UI hali YO'Q, va "Uzcard/Humo"
tugmasi hamon faqat `"uzcard"` yuboradi (`"humo"`ni alohida tanlash
imkoni yo'q). Bu backend o'zgarishi bilan **avtomatik yangilanmaydi** —
frontend TODO (17-bo'lim).

### SAFAAR komissiyasi vs. to'lov-provayder fee — ikki ALOHIDA tushuncha (o'zgarishsiz)

- **SAFAAR komissiyasi** (`partner_payable` hisoblashda) — hamkor bilan
  SAFAAR o'rtasidagi shartnoma bo'yicha, foydalanuvchi to'lagan summaga
  TA'SIR QILMAYDI, frontendga umuman ko'rsatilmaydi.
- **Karta turi fee'si** (yuqorida, `card-scheme-fee.ts`) — foydalanuvchi
  to'laydi, hamkor to'lovi (`partner_payable`)dan **ayirilmaydi** (bu
  testlar bilan tasdiqlangan: partner ledger krediti booking'ning gross
  summasidan hisoblanadi, `payments.amount`dagi fee'dan MUSTAQIL).

Ikkalasi bir-biriga ARALASHTIRILMAYDI — kod darajasida ham (ikkita
alohida modul: `common/finance.ts` va `providers/card-scheme-fee.ts`),
ham DB darajasida (`bookings.partner_payable` fee ustunlariga bog'liq
emas).

---

## 5. Uzum Checkout redirect

`uzum_checkout` **YOKI** `humo`/`uzcard`/`visa`/`mastercard` (barchasi bir
xil texnik transport, 4-bo'lim) tanlansa, oqim boshqa provayderlardan
(click/payme) **tubdan farq qiladi**:

- Click/Payme uchun: `payment_url` **lokal ravishda, sinxron** quriladi
  (`ClickProvider.buildCheckoutUrl()` / `PaymeProvider.buildCheckoutUrl()`)
  — hech qanday tashqi API chaqirilmaydi.
- `uzum_checkout`/karta turlari uchun: backend Uzum'ning **haqiqiy**
  `/payment/register` API'siga chiquvchi (outbound) so'rov yuboradi
  (`UzumCheckoutProvider.register()`, 2026-09-11dan rasmiy wire-format
  bilan tasdiqlangan) va javobdagi `orderId` + `paymentUrl`ni saqlaydi.
  Ya'ni `payment_url` Uzum'ning O'ZI qaytargan haqiqiy checkout sahifasi
  manzili. Karta turi tanlangan bo'lsa, `register()`ga yuboriladigan
  `amount` allaqachon fee QO'SHILGAN holda (4-bo'lim) — checkout
  sahifasida foydalanuvchi darhol yakuniy (fee-inclusive) summani ko'radi.

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

## 9. Guest (mehmon) to'lov — v2: ENDI ISHLAYDI (`guestToken` orqali)

> ✅ **v1 hujjatida bu bo'lim "guest onlayn to'lay olmaydi" deb tasdiqlangan
> edi — bu HAQIQIY, tasdiqlangan bug edi. v2'da backend tuzatildi.**
> Frontend HALI BU YANGI YO'LNI ISHLATMAYDI — bu sof frontend TODO
> (17-bo'lim).

### Qanday ishlaydi (real, testlar bilan tasdiqlangan)

Guest bron yaratilganda backend ALLAQACHON (o'zgarishsiz) opaque,
xavfsiz `guestAccessToken` qaytaradi (`common/guest-booking-access.service.ts`
— avval `bookings.service.ts` ichida edi, endi `PaymentsService` bilan
BO'LISHILGAN umumiy servis, cache-kalit/TTL/xeshlash BIR XIL saqlangan):

- **unguessable**: `randomBytes(32)` (256 bit), brute-force qilib
  bo'lmaydi;
- **booking-specific**: token FAQAT o'zi yaratilgan bookingId uchun
  ishlaydi — boshqa bronni ochish uchun ishlatib bo'lmaydi (IDOR himoyasi,
  testlar bilan tasdiqlangan);
- **expiring**: 30 kun (cache TTL) — muddati o'tgach avtomatik yaroqsiz;
- **xom token hech qachon saqlanmaydi** — faqat SHA-256 xeshi cache
  kaliti sifatida;
- **boshqa user/session ma'lumotiga access bermaydi** — token FAQAT
  `{ bookingId }`ni "ochadi", boshqa hech narsani emas.

**Endi `/payments/:bookingId` va `/payments/:bookingId/create` ikkalasi
ham bu tokenni `?guestToken=<token>` query parametri orqali qabul
qiladi:**

```
GET  /payments/:bookingId?guestToken=<guestAccessToken>
POST /payments/:bookingId/create?guestToken=<guestAccessToken>
Body: { "provider": "click" }   (yoki humo/uzcard/visa/mastercard/cash)
```

**Ruxsat mantig'i (`PaymentsService.assertBookingVisible()`):**
1. Agar `Authorization: Bearer` bilan haqiqiy login qilingan foydalanuvchi/
   admin/partner bo'lsa — **avvalgidek**, guest tokendan MUSTAQIL (8-bo'lim,
   o'zgarishsiz).
2. Agar token yo'q bo'lsa (guest): `guestToken` berilgan VA bron
   `user_id IS NULL` (hali haqiqiy foydalanuvchiga tegishli emas) VA token
   AYNAN shu bookingId uchun chiqarilgan bo'lsa — ruxsat beriladi.
3. Aks holda (token yo'q, noto'g'ri, boshqa bookingga tegishli, yoki
   bron allaqachon haqiqiy foydalanuvchiga tegishli) — **401
   `AUTH_TOKEN_INVALID`** (авvalgidek).

**Controller darajasida:** `PaymentsController`dagi ikkala endpointdan
`@Roles(...)` ATAYLAB olib tashlandi (`bookings.controller.ts`dagi
guest-checkout marshrutlari bilan BIR XIL naqsh — auth ixtiyoriy,
`RolesGuard` token bo'lsa uni to'ldiradi, bo'lmasa anonim/guest sifatida
o'tkazadi). Haqiqiy ruxsat qarori 100% servis darajasida — guard
darajasida hech narsa "zaiflashtirilmagan", faqat qo'shimcha, aniq
belgilangan guest-yo'l qo'shilgan.

### Frontend uchun aniq ko'rsatma (hali BAJARILMAGAN — 17-bo'lim)

- Guest checkout (`createBookingAction`) allaqachon `booking.guestAccessToken`ni
  oladi (mavjud kod). Endi shu tokenni `api.payments.createPaymentSession(...)`
  chaqiruviga (va keyinchalik `RetryPaymentForm`/booking detail sahifasidagi
  holat tekshiruviga) **query parametr sifatida qo'shish kerak** — hozircha
  bu ULANMAGAN (frontend hali eski, faqat `token: session?.accessToken`
  yuboradigan yo'lni ishlatadi, guest uchun bu `undefined` bo'lib, 401ga olib
  keladi — xuddi v1'dagidek, chunki FRONTEND hali yangilanmagan).
- **`cash`** — avvalgidek, `/payments/*`ga umuman murojaat qilmaydi,
  guest uchun 100% ishlaydi (o'zgarmadi).

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

### v2: admin tasdiqlashi endi Uzum Checkout bilan HAQIQIY integratsiyalangan

Bu **web-user frontendiga bevosita ta'sir qilmaydi** (quyidagi
"Frontend NIMA QILMASLIGI kerak" bandiga ko'ra bu har doim admin panel
ishi bo'lib qoladi), lekin savolga aniq javob uchun: `POST
/admin/refunds/:id/approve` endi, agar tegishli to'lov `uzum_checkout`
orqali qilingan bo'lsa (shu jumladan humo/uzcard/visa/mastercard —
barchasi shu transport), HAQIQIY Uzum Checkout `/acquiring/refund`
so'rovini yuboradi (`UzumCheckoutProvider.refund()`, sandboxda
qisman+to'liq refund bilan tasdiqlangan). Agar bu so'rov muvaffaqiyatsiz
bo'lsa — **hech qanday ichki holat (refund/payment/booking/ledger)
o'zgarmaydi**, admin aniq xato ko'radi va qayta urinishi mumkin
(tranzaksiya butunlay rollback bo'ladi). Click/Payme/Cash/Uzum (merchant)
uchun real refund API integratsiyasi hamon yo'q — faqat ICHKI holat
yoziladi (avvalgidek).

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
| To'lov sessiyasi yaratish/olish | `POST` | `/payments/:bookingId/create?guestToken=` (guest uchun ixtiyoriy) | Bearer (USER/ADMIN/SUPER_ADMIN) **YOKI** `guestToken` (guest, faqat o'z bronida) | `{ provider }` — `click`\|`payme`\|`uzcard`\|`humo`\|`visa`\|`mastercard`\|`cash`\|`uzum`\|`uzum_checkout` | `{ id, booking_id, provider, status, payment_url, amount, base_amount, fee_rate, fee_amount, currency, created_at, updated_at }` | `payment_url`ga redirect; `amount`ni ko'rsatish (fee-inclusive) |
| To'lov holatini tekshirish | `GET` | `/payments/:bookingId?guestToken=` (guest uchun ixtiyoriy) | Bearer (USER/ADMIN/SUPER_ADMIN) **YOKI** `guestToken` | — | yuqoridagi bilan bir xil shakl | Status ko'rsatish |
| Bron + to'lov holatini birga olish | `GET` | `/bookings/:id` | Bearer YOKI `guestAccessToken` (query) | — | `{ ...booking, payment: {...} | null }` | Booking detail sahifasi (real ishlatiladigan yo'l) |
| Refund so'rash | `POST` | `/refunds` | Bearer (USER) | `{ booking_id, reason }` | `{ id, booking_id, user_id, status: "requested", requested_amount, reason, ... }` | Hozircha UI YO'Q — TODO |
| O'z refundlarini ko'rish | `GET` | `/me/refunds` | Bearer (USER) | — | `refunds[]` | Hozircha UI YO'Q — TODO |
| Bitta refundni ko'rish | `GET` | `/refunds/:id` | Bearer (USER, faqat o'ziniki) | — | `refund` obyekti | Hozircha UI YO'Q — TODO |

**v2 eslatma:** `guestToken` — `POST /bookings/hotel` (va boshqa guest
checkout endpointlari) javobidagi `guestAccessToken` maydonining O'ZI,
faqat endi `/payments/*`ga ham query parametr sifatida qo'shilishi mumkin
(9-bo'lim). Faqat `booking.user_id IS NULL` bo'lgan bronlar uchun ishlaydi.

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
| Provayder sozlanmagan (click/payme/yoki Uzum Checkout ENV to'liq emas — humo/uzcard/visa/mastercard shu orqali ishlaydi) | 503 | `PAYMENT_PROVIDER_NOT_CONFIGURED` | "Bu to'lov usuli hozircha mavjud emas" — boshqa usul tanlashni taklif qiling, umumiy "server xatosi" ko'rsatmang |
| Webhook summasi/valyutasi mos kelmadi (backend ichki) | 422 | `PAYMENT_AMOUNT_MISMATCH` / `PAYMENT_CURRENCY_MISMATCH` | Frontendga bevosita ta'sir qilmaydi (server-to-server), lekin natijada payment holati o'zgarmay qolishi mumkin — "pending" holatini kutish kerak |
| Muvaffaqiyatli, lekin `payment_url` bo'sh | 200 | — (`payment_url: null`) | 3-bo'limdagi kabi alohida ushlang — "hozircha to'lash imkoni yo'q" |
| (Admin panel, web-user'ga bevosita tegishli emas) Refund provider so'rovi muvaffaqiyatsiz | 503 | `REFUND_PROVIDER_ERROR` | web-user chaqirmaydi (10-bo'lim) — faqat to'liqlik uchun |

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
13. **Guest oqimi — endi backend tomon ISHLAYDI (frontend TODO
    qolganidan keyin to'liq test qilinsin):** guest sifatida `cash` bilan
    bron — avvalgidek to'liq ishlaydi. Guest sifatida `humo`/`visa` bilan
    bron + `POST /payments/:bookingId/create?guestToken=<token>` —
    frontend `guestToken`ni ulagandan keyin (17-bo'lim, band 3) bu ham
    ishlashi kerak. Token YO'Q yoki NOTO'G'RI bo'lsa — `401
    AUTH_TOKEN_INVALID` (9-bo'lim).
14. **HUMO/UZCARD/VISA/MASTERCARD fee:** har birini alohida tanlab
    `POST /payments/:bookingId/create` chaqirish — javobdagi
    `amount`/`base_amount`/`fee_rate`/`fee_amount` mahsulot talabidagi
    misolga mos kelishini tekshirish (4-bo'lim: 500,000 so'm ->
    Humo/Uzcard 507,500; Visa/Mastercard 517,500).
15. **Usul almashtirish (v2, tuzatilgan bug):** `click` bilan to'lov
    boshlab (hali `pending`, checkout ochilmagan), keyin `humo` bilan
    qayta so'rash — yangi, `humo` uchun fee-aware qator qaytishi kerak
    (3-bo'lim). Keyin, agar birinchi urinish `uzum_checkout` orqali
    haqiqiy `orderId` bilan "processing"ga o'tgan bo'lsa, boshqa usul
    so'ralganda ESKI qator qaytishini tekshirish (almashtirilmasligi).

---

## 17. Frontend TODO (faqat frontend qilishi kerak bo'lgan ishlar)

Bular — backend **v2'da ALLAQACHON qo'llab-quvvatlaydigan**, lekin
frontendda hali ulanmagan/ko'rsatilmagan narsalar. Eng yuqori ustuvorlik —
1 va 2 (yangi mahsulot talabi shularga bog'liq):

1. **`PaymentSelector`ga VISA/MASTERCARD qo'shish va HUMO/UZCARD'ni
   ALOHIDA tugmalarga ajratish** — hozir UI faqat 4 ta variant
   ko'rsatadi, "Uzcard/Humo" bitta tugmaga birlashtirilgan, VISA/
   MASTERCARD umuman yo'q. Backend endi `provider: "humo"|"uzcard"|
   "visa"|"mastercard"` qiymatlarining barchasini alohida qabul qiladi
   va ishlaydi (4-bo'lim) — UI shunga mos kengaytirilishi kerak.
2. **Fee/yakuniy summani checkout'da ko'rsatish** — backend endi
   `POST /payments/:bookingId/create` javobida `base_amount`/`fee_rate`/
   `fee_amount`/`amount` (fee-inclusive) qaytaradi (4-bo'lim). Frontend
   usul tanlanganda shu chaqiruvni qilib (yoki usul o'zgarganda qayta
   chaqirib — 3-bo'limdagi tuzatilgan "xavfsiz almashtirish" qoidasi
   buni endi to'g'ri qo'llab-quvvatlaydi), yakuniy summani foydalanuvchiga
   ANIQ ko'rsatishi kerak ("Jami: 517,500 so'm, shundan 17,500 so'm —
   karta to'lov haqi" kabi). Fee'ni MUSTAQIL hisoblamang — backend
   qiymatini ishlating.
3. **Guest to'lov uchun `guestAccessToken`ni `/payments/*` so'rovlariga
   ulash** — backend endi `?guestToken=` query parametrini qabul qiladi
   (9-bo'lim), lekin `lib/services/payments/payments.ts`/`actions.ts`
   hali buni yubormaydi. Kerak: `paymentsService.createPaymentSession()`/
   `getPaymentStatus()`ga ixtiyoriy `guestToken` parametri qo'shish, va
   `createBookingAction()`/`RetryPaymentForm` oqimlarida (guest holatida)
   `booking.guestAccessToken`ni shu yerga uzatish. Bu qilinmaguncha
   guest onlayn to'lov FRONTEND darajasida hamon ishlamaydi (backend
   tayyor bo'lsa ham).
4. **`RetryPaymentForm`da xato holatini aniqroq ajratish** — hozir barcha
   xatolar bitta umumiy matn bilan ko'rsatiladi ("To'lovni amalga
   oshirishda xatolik yuz berdi"); backend `error.code` (masalan
   `PAYMENT_PROVIDER_NOT_CONFIGURED`) allaqachon farqli xabar berish
   imkonini beradi — frontend buni ishlatmayapti.
5. **"Boshqa usul so'ralganda eski (hali natijasi noma'lum) to'lov
   qatori qaytishi mumkinligi" holatini UI'da ko'rsatish** (3-bo'lim,
   v2'da tuzatilgan bug) — agar javobdagi `provider` foydalanuvchi
   so'ragan bilan mos kelmasa (masalan `visa` so'ralgan, lekin eski
   `click` to'lovi hali "processing"da), frontend buni tushunarli
   ko'rsatishi kerak ("Avvalgi to'lovni yakunlang yoki biroz kuting").
6. **Refund UI** — backend `POST /refunds`, `GET /me/refunds`,
   `GET /refunds/:id` tayyor, lekin web-userda hech qanday komponent/
   action bu bilan ishlamaydi (10-bo'lim). Kerak bo'lsa: "Bekor qilish /
   pulni qaytarish so'rash" tugmasi + o'z refundlari ro'yxati sahifasi.
7. **To'lov holatini yangilash uchun UX** — webhook/cron kechikishi
   holatlarida foydalanuvchiga "holatni tekshirish" tugmasi yoki qisqa
   muddatli client-side polling qo'shish (hozir faqat qo'lda `F5` orqali
   ishlaydi).
8. **`createBookingAction()`dagi jim yutilgan xatoni ko'rinadigan qilish**
   — hozir `catch { /* fallback */ }` hech qanday signal bermaydi;
   kamida analytics/log yuborish, imkon bo'lsa foydalanuvchiga ham xabar.

---

## 18. Backend cheklovlari / bloklovchilar (frontend to'liq bajara olmaydigan sabablar)

**v2'da RESOLVED (endi bloklovchi EMAS):** guest onlayn to'lov (backend
tomon — 9-bo'lim), `uzcard`/`humo`/`visa`/`mastercard` checkout yaratish
(4-bo'lim), fee real oqimga ulanmaganligi (4-bo'lim), "boshqa usul
so'ralsa e'tiborga olinmasligi" bugi (3-bo'lim), refund'ning provider
bilan integratsiyalanmaganligi (10-bo'lim). Quyidagilar HALI OCHIQ:

1. **`uzum_checkout` (demak humo/uzcard/visa/mastercard HAM) to'liq
   ishlashi uchun backend ENV to'liq sozlanishi SHART** (auth:
   `UZUM_CHECKOUT_BASE_URL`/`TERMINAL_ID`/`API_KEY` + fiskal:
   `SPIC`/`PACKAGE_CODE`/`VAT_PERCENT`/TIN-yoki-PINFL) — sozlanmagan
   muhitda (masalan hali sozlanmagan production yoki lokal/QA) HAR DOIM
   503 `PAYMENT_PROVIDER_NOT_CONFIGURED` qaytadi. Bu — infratuzilma/
   konfiguratsiya masalasi, kod bilan hal qilinmaydi; frontend buni
   kutilgan (muhitga bog'liq) xatti-harakat sifatida hisobga olishi
   kerak, umumiy "backend buzilgan" deb talqin qilmasligi kerak.
2. **Uzum Checkout callback productionda HAR DOIM rad etiladi (401)** —
   rasmiy signature sxemasi hali yo'qligi sababli, ataylab shunday
   qilingan. Haqiqiy tasdiqlash faqat `reconcileUzumCheckoutPaymentsCron`
   (har daqiqada, backend'ning o'z `getOrderStatus()` so'rovi orqali)
   ishlaydi — ya'ni `humo`/`uzcard`/`visa`/`mastercard` orqali to'lagan
   foydalanuvchi holati **kamida bir necha daqiqa kechikishi mumkin**
   (callback emas, cron orqali tasdiqlanadi). Frontend buni "webhook
   darhol keladi" deb TAXMIN QILMASLIGI kerak — refresh/polling UX
   (17-bo'lim, band 7) ayni shu sabab muhim.
3. **Payme webhook hali to'liq ishlamaydi** — `PaymeProvider`dagi
   kod izohi bo'yicha: *"PaymentsController'dagi `webhooks/payme` route
   hozircha eski umumiy yo'l bilan ishlaydi va Payme bilan hali real
   ishlamaydi"*. Ya'ni checkout URL yaratilishi mumkin (agar
   `PAYME_MERCHANT_ID` sozlangan bo'lsa), lekin to'lov tasdiqlanishi
   (webhook orqali `paid` bo'lish) ishonchli emas.
4. **Click/Payme muhitga bog'liq (`CLICK_SERVICE_ID`/`CLICK_MERCHANT_ID`/
   `CLICK_SECRET_KEY`, `PAYME_MERCHANT_ID`)** — sozlanmagan muhitda
   (masalan lokal/QA) bu provayderlar ham 503 beradi. Frontend buni
   muhitga qarab kutilgan xatti-harakat sifatida hisobga olishi kerak
   (bu xato emas, konfiguratsiya holati).
5. **Fee'ning haqiqiy karta turi bilan mos kelishini backend TEKSHIRA
   OLMAYDI** (4-bo'lim) — Uzum Checkout'ning rasmiy callback/status
   API'sida karta TARMOG'ini (Humo/Uzcard/Visa/Mastercard) qaytaradigan
   maydon yo'q. Bu Uzum'ning o'zi qo'yadigan cheklov — na backend, na
   frontend o'zgartira oladi; UI orqali foydalanuvchini to'g'ri
   yo'naltirish (tanlangan usul bilan bir xil kartani kiritish) yagona
   amaliy yumshatish.
6. **Uzum Checkout refund'ning ASINXRON yakuniy tasdiqlanishi
   kuzatilmaydi** (10-bo'lim) — `refundApprove()` Uzum'ga refund so'rovi
   yuboradi va operationId'ni saqlaydi, lekin Uzum buni asinxron qayta
   ishlaydi (`RefundResponse`da yakuniy tasdiqlash yo'q, faqat
   `getOrderStatus().refundedAmount` orqali keyinroq tekshirish mumkin).
   Hozircha bunga alohida reconciliation cron YO'Q (kelajakdagi ish,
   bu safargi ish doirasidan tashqarida — web-user frontendiga bevosita
   ta'sir qilmaydi, chunki refund UI umuman yo'q, 17-bo'lim).

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
