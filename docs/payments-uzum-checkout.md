# Uzum Checkout — integratsiya (skeleton + seams)

**Merchant API'dan (`/v1/uzum/webhook/*`) MUTLAQO ALOHIDA.** Merchant flow
(`/check /create /confirm /reverse /status`, `UzumProvider`,
`UzumWebhookController`, `payments.service.ts` `uzum*` metodlari) o'zgartirilmadi.

## ⚠️ Rasmiy spec holati

`https://developer.uzumbank.uz/en/checkout/` — client-side (JS) render qiluvchi
portal; OpenAPI sxemasi runtime'da yuklanadi va oddiy HTTP fetch bilan olib
bo'lmaydi (`web.archive.org` ham bu muhitda bloklangan). Shu sabab Uzum
Checkout'ning **`/payment/register` / callback / `getOrderStatus` /
`getOperationState` / `acquiring/refund` wire-format'i BIZDA TASDIQLANMAGAN**.

**2026-09-11 YANGILANDI**: `register`/`getOrderStatus`/`getOperationState`
ENDI HAQIQIY (sandboxda tasdiqlangan) so'rov yuboradi — pastdagi jadval
YANGI holatni aks ettiradi. Faqat callback autentifikatsiyasi va `refund()`
hamon fail-closed:

| Qism                                                 | Holati                                                                                      | Bloklovchi                                                    |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Callback qabul qilish (`/v1/uzum/checkout/callback`) | ✅ QA E2E'da TASDIQLANDI, production HAMON fail-closed (ATAYLAB, MUDDATSIZ — pastga qarang) | imzo sxemasi RASMAN YO'Q (tasdiqlangan, "hali noma'lum" emas) |
| `register()` seam (`createUzumCheckoutPayment`)      | ✅ HAQIQIY so'rov, productId ENDI deterministik                                             | fiskal env (`UZUM_CHECKOUT_SPIC` va h.k.)                     |
| `getOrderStatus` / `getOperationState`               | ✅ HAQIQIY so'rov (auth env sozlansa)                                                       | —                                                             |
| `refund()`                                           | ✅ HAQIQIY so'rov, sandboxda qisman+to'liq refund bilan TASDIQLANGAN                        | hali SAFAAR business-flow'ga ulanmagan (ongli qaror)          |
| Reconciliation (`reconcileUzumCheckoutPayments`)     | ✅ `@Cron(EVERY_MINUTE)` — PRODUCTIONDA YAGONA PAID-tasdiqlash yo'li                        | —                                                             |
| `PaymentMethod` enum + backend allowlistlar          | ✅ tayyor (migration bilan)                                                                 | —                                                             |

## Route

```
POST  https://api.safaar.uz/v1/uzum/checkout/callback
Content-Type: application/json
```

`UzumCheckoutController` (`@Controller()` + `@Post('uzum/checkout/callback')`,
global prefiks `v1`). `@Res()` (passthrough EMAS) — global envelope/filter
chetlab o'tiladi, status kodlar Uzum retry mantig'i uchun aniq.

Javob (hozircha; Uzum'ning kutgan aniq shakli MA'LUM EMAS):

| Holat                                | HTTP | Body                                                |
| ------------------------------------ | ---- | --------------------------------------------------- |
| A) valid callback qabul qilindi      | 200  | `{ status: "OK", duplicate: false, applied: true }` |
| B) duplicate callback                | 200  | `{ status: "OK", duplicate: true, applied: false }` |
| C) noma'lum orderId                  | 404  | `{ status: "FAILED", code: "unknown_order" }`       |
| D) amount mismatch                   | 422  | `{ status: "FAILED", code: "amount_mismatch" }`     |
| E) currency mismatch                 | 422  | `{ status: "FAILED", code: "currency_mismatch" }`   |
| F) imzo yaroqsiz / sxema sozlanmagan | 401  | `{ status: "FAILED", code: "<...>" }`               |
| G) noto'g'ri/bo'sh JSON              | 400  | `{ status: "FAILED", code: "malformed_body" }`      |

## ⚠️ BLOKER — Uzum Checkout spec YO'Q

Bizda Uzum Checkout'ning **rasmiy callback payload formati, `operationState`
qiymatlari va imzo (signature) algoritmi YO'Q**. Shu sabab skeleton **fail-closed**:

- **Imzo** (`UzumCheckoutProvider.verifyCallback`) — default holatda
  (`UZUM_CHECKOUT_SIGNATURE_SCHEME` unset / `none`) **har qanday callback rad
  etiladi** (401). Faqat `UZUM_CHECKOUT_SIGNATURE_SCHEME=hmac-sha256` +
  `UZUM_CHECKOUT_CALLBACK_SIGN_KEY` sozlanganda JOY-EGALLOVCHI HMAC-SHA256
  sxema ishlaydi — bu Uzum'ning tasdiqlangan algoritmi EMAS.
- **`operationState` -> ichki holat** mapping'i (`STATE_MAP`) **BO'SH** — spec
  kelmaguncha har qanday callback `state = 'UNKNOWN'` bo'ladi va **hech bir
  callback to'lovni PAID qilmaydi**.
- **Payload maydonlari** — `normalizeCheckoutCallback()` faqat "best-effort"
  (keng tarqalgan nomlar: `orderId`/`order_id`, `orderNumber`/`order_number`,
  `merchantOperationId`, `amount`/`total`, `currency`, `operationState`/`state`).
- **Undocumented maydon YO'Q**: `partnerId`, `settlementAccount`,
  `recipientAccount`, `subMerchantId` — o'qilmaydi, yozilmaydi.
- **Summa birligi** (so'm vs tiyin) tasdiqlanmagan — `normalizeCheckoutCallback`
  da `TODO(uzum-checkout-spec)`.

Spec kelganda o'zgaradigan joylar: `STATE_MAP`,
`UzumCheckoutProvider.canonicalPayload()` + `signatureScheme`,
`normalizeCheckoutCallback()` maydon nomlari, summa birligi konversiyasi.

## Register flow (chiquvchi)

```
POST /v1/payments/:bookingId/create   { "provider": "uzum_checkout" }
        │
        ▼
PaymentsService.createPayment()  ──(provider==='uzum_checkout')──►  createUzumCheckoutPayment(booking)
        │
        ├─ mavjud ochiq (pending/processing) payment bo'lsa → o'shani qaytaradi (idempotent)
        │
        ├─ UzumCheckoutProvider.register({ orderNumber, merchantOperationId, amountSom, currency, successUrl, failureUrl })
        │        │
        │        ├─ konfiguratsiya yo'q  → UzumCheckoutError('not_configured')
        │        └─ konfiguratsiya bor   → UzumCheckoutError('spec_required')   ← taxminiy so'rov YUBORILMAYDI
        │
        └─ ikkala holatda ham → 503 { code: 'PAYMENT_PROVIDER_NOT_CONFIGURED' }, HECH QANDAY payments qatori yozilmaydi
```

Spec + credential kelgach `register()` javobi bilan `payments` qatori yoziladi:
`provider='uzum_checkout'`, `status='processing'`, `provider_reference=<orderId>`,
`idempotency_key='uzum_checkout:<orderId>'`, `payment_url=<Uzum checkout URL>`.

`buildCheckoutUrl('uzum_checkout', …)` — sinxron yordamchi (masalan
`bookings.service.createPayment` ishlatadi) ATAYLAB 503 tashlaydi (jim `null`
emas) — Checkout URL faqat async `register()` javobidan keladi.

**Click / Payme / Merchant-Uzum oqimlari tegilmadi** — `createPayment()` ichiga
faqat erta `return` qo'shildi.

## Payment mapping

| SAFAAR                        | Uzum                       | Joy                              |
| ----------------------------- | -------------------------- | -------------------------------- |
| `bookings.booking_number`     | `orderNumber`              | `register()` so'rovida (SPEC)    |
| `payments.id`                 | `merchantOperationId`      | `register()` so'rovida (SPEC)    |
| `payments.provider_reference` | `orderId` (Uzum qaytaradi) | `register()` javobida saqlanadi  |
| `payments.idempotency_key`    | `uzum_checkout:<orderId>`  | `@unique`                        |
| `payments.provider`           | —                          | `uzum_checkout` enum (migration) |

## Reconciliation

`PaymentsService.reconcileUzumCheckoutPayments(olderThanMinutes=15)`:

- `checkout.isConfigured()` FALSE → darhol `{ scanned: 0, updated: 0 }` (no-op, DB so'rovsiz);
- aks holda `pending`/`processing` `uzum_checkout` to'lovlar (>N daqiqa) uchun
  `getOrderStatus()` → `PAID` bo'lsa mavjud `uzumCheckoutCallback()` oqimi,
  `FAILED` bo'lsa `payments.status='failed'`;
- `STATE_MAP` bo'sh ekan har qanday holat `UNKNOWN` → hech narsa o'zgarmaydi.

Ataylab **`@Cron`SIZ** — Uzum status enum'i tasdiqlangach
`@Cron(EVERY_5_MINUTES)` qo'shiladi.

Callback to'lovni topadi: `idempotency_key = 'uzum_checkout:<orderId>'` **yoki**
`provider_reference = <orderId>` **yoki** `payments.id = <merchantOperationId>`
**yoki** `booking_number = <orderNumber>` orqali; keyin `provider='uzum_checkout'`
/ `idempotency_key` prefiksi bilan Checkout to'lovi ekanini tasdiqlaydi
(Merchant `provider='uzum'` bilan aralashmaydi).

## Qayta ishlatilgan mavjud logika (yangi parallel mexanizm YO'Q)

`state === 'PAID'` bo'lganda `PaymentsService.uzumCheckoutCallback()`:

```
processPaymentEvent('uzum_checkout', 'confirm',
  'uzum_checkout:confirm:<orderId>',
  { booking_id, transaction_id: orderId, amount, currency })
```

Bu quyidagilarni beradi (o'zgarishsiz):

- **Idempotentlik** — `payment_events.event_key` UNIQUE + `ON CONFLICT DO NOTHING`
  → duplicate `{ duplicate: true }`, HTTP 200, ledger/booking qayta tegilmaydi.
- **`assertPaymentMatchesPayload`** — amount (`=== payments.amount`, so'm) va
  currency tekshiruvi.
- **Terminal-holat qo'riqchi** (`TERMINAL_PAYMENT_STATUSES`).
- **Booking o'tishi** — `bookings.status = confirmed` (yoki
  `awaiting_partner_confirmation`), `expires_at = NULL`,
  `booking_status_history` yozuvi.
- **Partner ledger** — `creditPartnerLedger()` (`booking_earned`,
  `+partner_payable`) bir marta.

`state !== 'PAID'` — faqat audit uchun `payment_events`
(`uzum_checkout:<orderId>:<state>`) yoziladi, biznes holat TEGILMAYDI.

**Redirect success/failure URL to'lovni PAID QILMAYDI** — faqat imzosi
tasdiqlangan callback + normallashtirilgan `PAID` holati.

## Env (Uzum onboarding'dan; hech biri majburiy emas, secret env orqali)

```
UZUM_CHECKOUT_BASE_URL              # /payment/register bazasi (chiquvchi)
UZUM_CHECKOUT_MERCHANT_ID
UZUM_CHECKOUT_TERMINAL_ID           # nomi rasmiy spec bilan tasdiqlanishi kerak
UZUM_CHECKOUT_API_KEY
UZUM_CHECKOUT_CALLBACK_SIGN_KEY     # callback imzo kaliti (faqat spec tasdiqlasa)
UZUM_CHECKOUT_SIGNATURE_SCHEME      # 'none' (default, fail-closed) | 'hmac-sha256'
UZUM_CHECKOUT_SIGNATURE_HEADER      # default 'x-signature'
UZUM_CHECKOUT_HTTPS_PROXY           # IXTIYORIY chiquvchi forward-proxy (statik IP)
```

`isConfigured()` = `BASE_URL && MERCHANT_ID && API_KEY` (chiquvchi metodlar
uchun). `isCallbackVerificationConfigured()` = `CALLBACK_SIGN_KEY && SCHEME!='none'`.
`.env.example`'da bo'sh qiymatlar bilan hujjatlangan (`backend.env` production
o'zgartirilmadi).

Secret/imzo/Authorization **log qilinmaydi** (faqat `orderId`/state — non-secret
korrelyatsiya).

## Statik chiquvchi IP (`UZUM_CHECKOUT_HTTPS_PROXY`)

Uzum Checkout merchant tomonda chiquvchi so'rovlar uchun **barqaror manba
IP** talab qilishi mumkin (allowlist). SAFAAR production backend'i uy/ofis
ISP'i orqali chiqadi (`188.113.198.155`) — bu IP ISP tomonidan o'zgarishi
mumkin. Yechim: **faqat Uzum Checkout so'rovlarini** `safaar-gateway`
(Yandex Cloud) dagi forward-proxy orqali chiqarish → Yandex statik IP.

**Arxitektura**

```
safaar-backend konteyner (baito hostida)
     │  faqat Uzum Checkout HTTP so'rovlari (register/getOrderStatus/
     │  getOperationState/refund) — dispatcher: outboundDispatcher()
     ▼
Tailscale (backend 100.109.46.108  →  gateway 100.105.86.75)
     ▼
tinyproxy @ safaar-gateway  (100.105.86.75:3128, FAQAT tailscale0'ga bind)
     │  CONNECT :443, faqat Uzum domenlariga (Filter allowlist)
     ▼
eth0 → Yandex Cloud 1:1 NAT → <statik IP>   ← Uzum'ga shu IP beriladi
```

**Backend tomoni (kod)**

- `UzumCheckoutProvider.outboundDispatcher()` — `UZUM_CHECKOUT_HTTPS_PROXY`
  bo'sh bo'lsa `undefined` (so'rov to'g'ridan-to'g'ri), sozlangan bo'lsa
  **keshlangan** undici `ProxyAgent`. Chiquvchi metodlar `fetch(url, {
dispatcher: this.outboundDispatcher(), signal: … })` bilan chaqiradi.
- **`setGlobalDispatcher` ISHLATILMAYDI** — jarayondagi boshqa har qanday
  `fetch()` (SMS, email, CBU kurs, webhook yetkazish, OAuth) va boshqa
  host'dagi Baito trafigi **umuman o'zgarmaydi**.
- Proxy URL yaroqsiz bo'lsa: `env.validation.ts` ilovani ishga tushirmaydi
  (birlamchi), `outboundDispatcher()` `PROXY_MISCONFIGURED` throw qiladi
  (ikkilamchi). Credential logga **userinfo yashirilgan** holda chiqadi
  (`redactProxyUrl` / `outboundProxyUrlForLog`).

**Infra tomoni** (repo'dan tashqarida — sirlar Git'da emas): tinyproxy
konfiguratsiyasi, Tailscale bind, `Allow 100.109.46.108`, `Filter`
allowlist, nft qoidasi va statik-IP tekshiruvi
`docs/infra/uzum-checkout-egress-proxy.md` da (yoki infra runbook'da)
hujjatlashtiriladi. `backend.env` ga faqat `UZUM_CHECKOUT_HTTPS_PROXY=…`
qatori qo'shiladi.

## Uzum Checkout komissiyasi (1.5%) — SAFAAR ICHKI accounting

Biznes kelishuv: Uzum Checkout komissiyasi = to'lov summasining **1.5%i**
(`UZUM_CHECKOUT_COMMISSION_RATE = 0.015`,
`src/payments/providers/uzum-checkout-commission.ts`). Bu **Uzum API
maydoni EMAS** — bizga ma'lum (uchinchi-tomon, rasmiy tasdiqlanmagan)
OpenAPI sxemasida commission/fee degan hech qanday maydon yo'q (na
callback'da, na register so'rovida). Shuning uchun bu hisob-kitob Uzum'ga
HECH NARSA YUBORMAYDI — faqat SAFAAR'ning o'z hisobotlari (admin/export)
uchun `gross` / `commission` / `net` ni ajratib beradi.

```
calculateUzumCheckoutCommission(grossAmountSom) -> {
  grossAmountSom, commissionRate, commissionAmountSom, netSettlementAmountSom
}
```

Butun-tiyin arifmetikasi (`UzumProvider.toTiyin()` bilan bir xil `Math.round`
yaxlitlash siyosati) — suzuvchi nuqta xatosiz. Nol/manfiy/NaN/Infinity ->
`RangeError`.

**`REQUIRES_UZUM_CONFIRMATION`** (`UZUM_CHECKOUT_SETTLEMENT_MODEL`,
kodda taxmin qilinmagan, rasmiy shartnoma/spec kelganda tasdiqlanishi
SHART):

- Uzum settlement'dan 1.5%ni **avtomatik ushlab qoladimi** (bankka NET
  keladi) yoki **to'liq GROSS'ni o'tkazib**, komissiyani alohida
  invoice bilan so'raydimi.
- Refund'da Uzum o'z komissiyasini **qaytaradimi yoki ushlab qoladimi**.
- Uzum'ning o'zi yaxlitlashda qanday qoida ishlatishi (bu yerdagi
  round-half-up — FAQAT SAFAAR'ning ICHKI konventsiyasi).

**DB**: `payments.provider_fee_rate` / `provider_fee_amount` /
`net_settlement_amount` (uchtasi ham NULLABLE, `Payment` modeliga
qo'shildi) — migratsiya **`20260911000000_uzum_checkout_commission_fields`
DIZAYN QILINGAN, LEKIN productionga QO'LLANILMAGAN** (avvalgi Uzum Checkout
migratsiyalari bilan bir xil siyosat — `register()` hali fail-closed stub,
haqiqiy to'lov yo'q, to'ldiriladigan kod yo'q). Ular to'ldirilishi kerak
bo'lgan joy: `register()` spec bilan tasdiqlangach, `createUzumCheckoutPayment()`
ichidagi `payments` INSERT'i `calculateUzumCheckoutCommission(amountSom)`
natijasini shu uchta ustunga yozadi.

**Mijozga ko'rsatish**: hech qanday customer-facing summa/UI
o'zgartirilmadi — `web-user`/`web-partner`da komissiya/fee ko'rsatuvchi
joy avvaldan ham yo'q edi. Komissiyani mijozga qo'shish yoki merchant
o'zi ko'tarishi — BIZNES qaror, tasdiqlanmaguncha kod hech narsani
o'zgartirmaydi.

## TEST muhitidan tasdiqlangan wire-format (2026-09-11)

⚠️ Bu bo'lim uchinchi-tomon spec EMAS — Uzum'ning **haqiqiy TEST
serveridan** (`test-chk-api.uzumcheckout.uz`), sinov so'rovlariga
qaytargan **haqiqiy validatsiya xatolari** orqali tasdiqlangan (kredential
qiymatlari, karta ma'lumotlari va terminal ID HECH QACHON bu faylga
yozilmagan/yozilmaydi).

**MUHIM TUZATISH**: avvalgi taxmin (`${baseUrl}/payment/register`) —
NOTO'G'RI edi. Haqiqiy yo'l prefiksi **`/api/v1/`** talab qiladi:

```
${UZUM_CHECKOUT_BASE_URL}/api/v1/payment/register
${UZUM_CHECKOUT_BASE_URL}/api/v1/payment/getOrderStatus
${UZUM_CHECKOUT_BASE_URL}/api/v1/payment/getOperationState
${UZUM_CHECKOUT_BASE_URL}/api/v1/acquiring/refund
```

Prefikssiz variant (`/payment/register`, va umuman `/api/v1/` bilan
boshlanmagan HAR QANDAY yo'l — `/checkout`, `/pay`, `/session` kabi
taxminiy nomlar ham) nginx darajasida `403`ga tushadi — bu **IP allowlist
EMAS** (avvalgi sessiyaning xulosasi shu qismda noto'g'ri edi): haqiqiy
kredential bilan ham, `/api/v1/` prefiksisiz so'ralgan HAR QANDAY yo'l
xuddi shu 403'ga tushadi, `/api/v1/...` esa kredentialsiz ham ilovaga
yetib boradi (`200` + validatsiya xatosi JSON'i). IP allowlist masalasi
hali ham NOMA'LUM (chunki hozircha faqat `51.250.78.204`dan sinalgan) —
lekin bu 403'larning sababi ENDI aniq: noto'g'ri yo'l, IP emas.

**Tasdiqlangan majburiy sarlavhalar** (`{}` bo'sh body bilan
so'ralganda "Field required" deb qaytgan):

- `X-Terminal-Id` — hamma endpoint uchun
- `X-Api-Key` — yuborilganda hech qachon "missing" deb qaytmadi (talab
  qilinishi mumkin, lekin bu tekshiruv qatlamida alohida qayd etilmagan)
- `Content-Language` — `register`da talab qilinadi (qiymat sifatida
  `en` yuborilganda ham ba'zan hamon "missing" ko'rinishi kuzatildi —
  aniq qabul qilinadigan qiymat/format TASDIQLANMAGAN)
- `X-Operation-Id` — FAQAT `refund`da talab qilinadi

**Tasdiqlangan majburiy body maydonlari** (nomlar — TIPI/semantikasi
HALI HAM NOMA'LUM, taxmin qilinmagan):

- `register` (`OrderPaymentRequest` varianti — bir martalik karta
  to'lovi, ko'rinadi): `viewType`, `clientId`, `currency`, `orderNumber`,
  `sessionTimeoutSecs`, `amount`, `paymentParams`, `merchantParams`.
  (Server bir nechta muqobil sxema — `OrderBindingRequest` (karta
  bog'lash), `OrderMobileTopUpRegisterRequest`, `OrderTechCardRequest`,
  `SBPPaymentRequest`, `OrderMunisTopUpRequest` — bilan ham solishtiradi;
  bularning barchasi BITTA `/api/v1/payment/register` endpoint orqali
  ishlaydi, alohida "registerless" endpoint TOPILMADI.)
- `getOrderStatus`: `orderId` (shu bitta maydon)
- `getOperationState`: `operationId` (shu bitta maydon)
- `refund`: `orderId`, `amount` (+ yuqoridagi `X-Operation-Id` sarlavhasi)

Bularning HAMMASI `{}` (bo'sh) body bilan qaytgan "field required"
xatolaridan yig'ilgan — HAQIQIY qiymat/format/enum HALI HAM
TASDIQLANMAGAN (masalan `viewType`ning mumkin qiymatlari, `paymentParams`/
`merchantParams` ichki shakli, `amount` birligi — so'm yoki tiyin).
Shu sabab `register()`/`getOrderStatus()`/`getOperationState()`/`refund()`
hamon `SPEC_REQUIRED` bilan fail-closed qoladi — bu FAQAT maydon
NOMLARINI tasdiqlaydi, TO'LIQ kontraktni emas.

### 2026-09-11 — real REGISTER urinishi: enumlar tasdiqlandi, AUTOFISCALIZATION bloker

Sandbox terminalga (test kredentiallar bilan, faqat test summasi —
haqiqiy pul YO'Q) ketma-ket 5 ta `POST /api/v1/payment/register`
so'rovi yuborildi, har birida Uzum'ning HAQIQIY validatsiya xatosidan
keyingisi tuzatildi. Yakuniy holat — quyidagilar HAQIQIY, ISHLAYDIGAN
qiymatlar sifatida TASDIQLANDI (kredential/karta qiymatlari YO'Q):

- `Content-Language` sarlavhasi: `'ru-RU'` | `'uz-UZ'` | `'en-EN'`
  (aniq shu formatda — oddiy `'uz'`/`'en'` RAD ETILADI).
- `viewType`: `'WEB_VIEW'` | `'IFRAME'` | `'REDIRECT'`.
  `'REDIRECT'` tanlansa, body'da **`successUrl` va `failureUrl`
  MAJBURIY** (bu bizning ichki domen maydonlarimiz bilan ALLAQACHON
  mos — `RegisterCheckoutInput.successUrl/failureUrl`).
- `currency`: ISO-4217 **RAQAMLI** kod, ALFA KOD EMAS —
  UZS = **`860`** (`'UZS'` string RAD ETILADI). Boshqa ko'rilgan
  qiymatlar: `643`=RUB, `840`=USD, `978`=EUR.
- `paymentParams.payType`: `'ONE_STEP'` | `'TWO_STEP'` (bir/ikki
  bosqichli to'lov — repo'dagi eski terminologiya bilan mos keladi).
- `clientId` (ixtiyoriy client-generated UUID) va `amount` (butun son)
  — HECH QANDAY qo'shimcha validatsiya xatosi bermadi (format/tip
  to'g'ri, lekin bu ularning SEMANTIKASINI — masalan `amount` birligi
  so'mmi yoki tiyinmi — TASDIQLAMAYDI, faqat qabul qilinishini
  ko'rsatadi).

Yuqoridagi HAMMA maydon to'g'ri bo'lgach (5-urinish), javob endi
Pydantic validatsiya xatosi EMAS, balki **biznes-qoida xatosi**:

```
errorCode: 3045
"[AUTOFISCALIZATION] You need to provide a cart with fiscalization
 params for your operation"
```

Ya'ni: **bu test terminal avtofiskalizatsiya YOQILGAN holda
sozlangan** — har bir `register` so'rovi fiskal `cart` (tovar/xizmat
ro'yxati, IKPU/MXIK kodlari, SPIC, QQS stavkasi) talab qiladi. `cart`
maydonini bo'sh `{}` bilan yuborish xatoni O'ZGARTIRMADI (bu
struktura darajasidagi emas, biznes-qoida darajasidagi tekshiruv —
Pydantic kabi "missing field" ro'yxatini bermaydi).

**2026-09-11, qo'shimcha struktura probe'i**: `cart`ni turli
shakllarda yuborish (noto'g'ri tip — string; array + placeholder
element; `{items:[...]}` + placeholder element — hech birida haqiqiy
IKPU/MXIK/narx qiymati YO'Q, faqat `___SAFAAR_PROBE___` markerlar)
BARCHASI bir xil `3045` xatosini qaytardi — hatto `cart` NOTO'G'RI
TIPDA (string) bo'lsa ham Pydantic darajasidagi tip-xatosi
CHIQMADI. Bu shuni ko'rsatadiki: (a) tekshiruv `cart`ning ICHKI
tarkibidan qat'i nazar ishlaydi — ya'ni haqiqiy IKPU/MXIK/narx
qiymatlarisiz HECH QANDAY struktura o'tmaydi, VA/YOKI (b) haqiqiy
maydon nomi/joylashuvi `cart` emas (masalan `paymentParams` ichida
yoki butunlay boshqa nom bo'lishi mumkin) — buni ANIQLASH uchun
haqiqiy IKPU kodi kerak bo'ladi, bu esa `tasnif.soliq.uz`dan
(O'zbekiston rasmiy soliq tasnifi) BIZNES/BUXGALTERIYA tomonidan
tanlanishi kerak bo'lgan real klassifikatsiya — bu yerda O'YLAB
TOPILMAYDI. Qo'shimcha struktura probe'lari shu nuqtada TO'XTATILDI
(keyingi tasodifiy nom taxminlari "cheksiz urinish"ga aylanib
ketardi, foydasi kam).

**2026-09-11 (davomi) — REAL MXIK bilan urinish, hamon aniqlanmagan**:
Biznes tomondan `tasnif.soliq.uz` rasmiy katalogidan haqiqiy
klassifikatsiya olindi:

- MXIK: `10204001010000000` ("Mehmonxona xizmatlari (yashab
  turish uchun)")
- O'lchov birligi kodi: `1504157` ("tunu-kun")

Shu haqiqiy qiymatlar bilan `cart.items[{name, mxik, packageCode,
quantity, price}]` shaklida (VAT/vatPercent ATAYLAB QO'SHILMADI —
haqiqiy stavka noma'lum) yuborilgan so'rov ham AYNAN bir xil `3045`
xatosini qaytardi — maydon nomlari (`mxik`/`packageCode` bo'lishi
mumkin yoki bo'lmasligi mumkin) Pydantic darajasida HECH QACHON
tasdiqlanmadi/rad etilmadi. Xulosa: **cart/fiscalization maydonining
aniq JSON kaliti (nomi va joylashuvi) hamon NOMA'LUM** — buni
faqat rasmiy Uzum Checkout hujjati yoki Uzum texnik yordami orqali
aniqlash mumkin, keyingi tasodifiy kalit-nom taxminlari bilan EMAS.

**BU YERDA TO'XTATILDI — taxminiy IKPU/MXIK kod yoki soxta
`cart` tarkibi O'YLAB TOPILMADI.** Sabab: `docs/payments-uzum-checkout.md`
"Uzum Checkout komissiyasi" bo'limida va oldingi fiskalizatsiya
auditida (2026-09-10) allaqachon qayd etilganidek, **SAFAAR'da
fiskalizatsiya/IKPU/MXIK/cart-line-item infratuzilmasi UMUMAN YO'Q**
— qaysi IKPU kodi mehmonxona bronlash yoki avtobus chiptasiga mos
kelishini BIZNES/BUXGALTERIYA hal qilishi kerak, bu kod tomonidan
taxmin qilinadigan narsa emas. Bu — real, texnik jihatdan aniqlangan
BLOKER, IP yoki credential muammosi EMAS.

**Xulosa**: `register()`ning to'liq WIRE-FORMATI (majburiy
maydonlar+enumlar darajasida) endi katta ishonch bilan MA'LUM.
Yagona qolgan bloker — fiskalizatsiya `cart` tarkibi — BIZNES qarorga
bog'liq. `outboundBlocker()` guard shu sabab hamon OLIB
TASHLANMAYDI.

## Fayllar

- `src/payments/providers/uzum-checkout.provider.ts` — provider: fail-closed imzo
  abstraction, `normalizeCheckoutCallback`, `NormalizedCheckoutCallback`,
  `UzumCheckoutError`, `stableStringify`, hamda chiquvchi seam'lar (`register` /
  `getOrderStatus` / `getOperationState` / `refund` — hammasi `NOT_CONFIGURED` /
  `SPEC_REQUIRED` bilan fail-closed, `@example` mapping bilan). **Statik-IP
  seam**: `outboundDispatcher()` / `isOutboundProxyConfigured()` /
  `outboundProxyUrlForLog()` + `buildUzumCheckoutProxyDispatcher()` /
  `redactProxyUrl()` (`UZUM_CHECKOUT_HTTPS_PROXY`).
- `src/payments/providers/uzum-checkout-commission.ts` — 1.5% komissiya
  hisob-kitobi (`calculateUzumCheckoutCommission`), SAFAAR ICHKI accounting,
  Uzum API'ga bog'liq emas. `UZUM_CHECKOUT_SETTLEMENT_MODEL =
'REQUIRES_UZUM_CONFIRMATION'`.
- `prisma/migrations/20260911000000_uzum_checkout_commission_fields/` —
  `payments.provider_fee_rate/provider_fee_amount/net_settlement_amount`
  (nullable) — **qo'llanilmagan**.
- `src/payments/uzum-checkout.controller.ts` — `POST /v1/uzum/checkout/callback`.
- `src/payments/payments.service.ts` — `uzumCheckoutCallback()` +
  `createUzumCheckoutPayment()` (register seam) + `buildCheckoutUrl` branch +
  `reconcileUzumCheckoutPayments()` + `provider()` allowlist'ga `uzum_checkout`.
- `src/payments/payments.module.ts` — controller + provider ro'yxatga olindi.
- `src/payments/dto/payment.dto.ts` — `CreatePaymentDto` allowlist'ga `uzum_checkout`.
- `src/config/env.validation.ts` + `.env.example` — `UZUM_CHECKOUT_*` (optional,
  `+ UZUM_CHECKOUT_TERMINAL_ID`).
- `prisma/migrations/20260903120000_uzum_checkout_payment_method/migration.sql`
  — `ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'uzum_checkout'`
  (**qo'llanilmagan** — deploy alohida tasdiq talab qiladi).
- Testlar: `providers/uzum-checkout.provider.spec.ts`,
  `payments.service.uzum-checkout.spec.ts`, `uzum-checkout.controller.spec.ts`
  — **ICHKI/abstraction shartnoma ustidan**, Uzum production kontrakti EMAS.

## Keyingi qadamlar (rasmiy Checkout spec + credential kelganda)

1. `providers/uzum-checkout.provider.ts` → `outboundBlocker()` guard'ini olib
   tashlash; `register` / `getOrderStatus` / `getOperationState` / `refund`
   ichiga `@example` bo'yicha real `fetch` yozish (endpoint yo'li, auth
   sarlavhasi, so'rov/javob maydonlari — rasmiy hujjatdan).
2. `STATE_MAP` to'ldirish (Uzum `operationState` -> `PAID`/`FAILED`/`PENDING`).
3. `canonicalPayload()` + `signatureScheme` + header nomini Uzum imzo sxemasiga
   moslash; kerak bo'lsa raw-body baytlarini ushlash (`json({ verify })`).
4. Summa birligini tasdiqlash (so'm/tiyin) — `normalizeCheckoutCallback` va
   `register()` da konversiya.
5. `reconcileUzumCheckoutPayments()` ga `@Cron(EVERY_5_MINUTES)` qo'shish.
6. Frontend to'lov tanlash: `apps/web-user` (`PaymentProvider` /
   `PaymentSelector` / `RetryPaymentForm`) + `bookings.service.paymentMethod()` /
   `bookings/dto/booking.dto.ts` allowlistlari (hozircha `uzum` ham yo'q —
   ikkalasi birga qo'shiladi).
7. SAFAAR refund modulini (`refunds` + admin tasdiq) `checkout.refund()` bilan
   ulash.
8. `UZUM_CHECKOUT_*` credential'larni `backend.env`ga qo'yish + migration'ni
   `develop → production` orqali qo'llash.
9. Real Uzum sandbox bilan round-trip test.

## 2026-09-11 — CART sxemasi RASMIY manbadan (developer.uzumbank.uz) topildi va tasdiqlandi

`developer.uzumbank.uz/en/checkout` sahifasining o'zi JS SPA (render
qilinmagan holda o'qib bo'lmaydi — avvalgi izohlarda qayd etilgan), LEKIN
uning **JS bundle'i** (`https://developer.uzumbank.uz/en/assets/js/main.*.js`)
to'liq OpenAPI spec matnini (tavsiflar, sxemalar, ishlaydigan misollar
bilan) satr-literal sifatida o'zida saqlaydi — bu orqali RASMIY sxema
to'g'ridan-to'g'ri o'qib olindi (fetch/curl bilan, hech qanday
avtorizatsiyasiz — bu HAR KIM ochiq ko'rishi mumkin bo'lgan public bundle).

**Rasmiy `merchantParams.cart` joylashuvi va sxemasi** (`OrderPaymentRequest`
uchun, ishlaydigan rasmiy misoldan):

```
merchantParams: {
  cart: {
    cartId: <uuid>,
    receiptType: "PURCHASE",
    total: <butun summa>,
    items: [
      {
        title: <mahsulot/xizmat nomi>,
        productId: <uuid>,
        quantity: <son>,
        unitPrice: <bir dona narxi>,
        total: <shu qatorning umumiy narxi>,
        receiptParams: {          // = "UZReceiptParams" sxemasi
          spic: <IKPU/MXIK, ANIQ 17 ta belgi>,
          packageCode: <qadoqlash/o'lchov birligi kodi, 1-20 belgi>,
          vatPercent: <QQS foizi, 0-99 oralig'idagi BUTUN son>,   // MAJBURIY
          TIN: <STIR, 1-9 belgi>,      // ixtiyoriy, PINFL bilan birga BO'LMAYDI
          PINFL: <JSHSHIR, 1-14 belgi> // ixtiyoriy, TIN bilan birga BO'LMAYDI
        }
      }
    ]
  }
}
```

(Rasmiy misolda `paymentParams` ichida yana `force3ds: true` va
`phoneNumber` ham ko'rsatilgan — ikkalasi ham `OrderPaymentRequest` uchun
MAJBURIY emas edi, lekin `force3ds` 3DS oqimini sinash uchun foydali.)

**Sandboxda haqiqiy MXIK/unit kod bilan tasdiqlandi** (2026-09-11, real
`/api/v1/payment/register` so'rovi, `vatPercent` ATAYLAB qo'shilmadi):

- `spic: "10204001010000000"` (MXIK — tasnif.soliq.uz'dan, biznes
  tomonidan berilgan) — **HECH QANDAY xato QAYTMADI** (uzunlik/format
  to'g'ri deb qabul qilindi).
- `packageCode: "1504157"` (o'lchov birligi kodi — tasnif.soliq.uz
  "Conditional Unit" bo'limidan, biznes tomonidan berilgan) — **HECH
  QANDAY xato QAYTMADI**.
- Javobda **YAGONA** qolgan xato: `receiptParams.vatPercent` — "Field
  required". Boshqa hech bir maydon (`cartId`, `receiptType`, `total`,
  `title`, `productId`, `quantity`, `unitPrice`, `force3ds`,
  `paymentDetails`) qayd etilmadi — demak ULARNING HAMMASI to'g'ri.

**VAT (`vatPercent`) — rasmiy hujjatda ANIQ ko'rsatilgan qiymat YO'Q.**
Rasmiy misolda `vatPercent: 0` bor, lekin bu boshqa mahsulot ("Almond")
uchun — umumiy/standart stavka sifatida hujjatlashtirilmagan. Docs matni
IKPU/packaging kodini `tasnif.soliq.uz`dan olishni ko'rsatadi, lekin QQS
stavkasini QAYERDAN olish kerakligi haqida HECH NARSA demaydi (bu —
soliq/buxgalteriya masalasi, mahsulot katalogidan emas). Shu sabab
`vatPercent` **BLOCKED** — o'ylab topilmadi, boshqa hech qayerda
tasdiqlangan qiymat yo'q.

**Xulosa**: `register()`ning FISKAL qismi (cart tuzilishi + IKPU/unit
maydon nomlari/joylashuvi) endi 100% RASMIY manbadan TASDIQLANGAN.
Yagona qolgan bloker — `vatPercent` uchun mehmonxona xizmati bo'yicha
haqiqiy QQS stavkasi (0%, 12%, yoki boshqa) — bu BIZNES/BUXGALTERIYA
tasdig'ini talab qiladi.

**2026-09-11 (davomi) — `vatPercent=12` SANDBOX PROBE (biznes stavka EMAS,
faqat sxemani sinash uchun), YANGI bloker topildi**: `12` qiymati (butun
son, 0-99 oralig'ida) hech qanday xatosiz QABUL QILINDI. Bu FAQAT
`vatPercent` maydonining TIP/DIAPAZON cheklovini tasdiqlaydi — **12%ni
SAFAAR'ning haqiqiy QQS stavkasi sifatida ISHLATISH KERAK EMAS**, kodga
ham yozilmadi.

Shundan keyin YANGI, ILGARI KO'RINMAGAN xato chiqdi:

```
Value error: You need pass TIN or PINFL for receiptParams
```

Ya'ni `receiptParams` ichida **`TIN` (STIR) yoki `PINFL` (JSHSHIR)dan
KAMIDA BITTASI MAJBURIY** ekan (`UZReceiptParams` sxemasida ikkalasi ham
ixtiyoriy ko'rinsa-da, amalda BIRI SHART). Bu — **SAFAAR'ning o'z STIR
raqami** (yuridik shaxs sifatida ro'yxatdan o'tgan soliq to'lovchi ID'si)
— mahsulot klassifikatsiyasi EMAS, MERCHANT identifikatori. Bu qiymat:

- reponziyoriyda HECH QAYERDA saqlanmagan (allaqachon tasdiqlangan —
  fiskalizatsiya ma'lumotlari umuman yo'q);
- O'YLAB TOPILMADI — bu SAFAAR'ning haqiqiy yuridik shaxs STIR raqami,
  buni faqat kompaniya buxgalteriyasi/ro'yxatdan o'tish hujjatlaridan
  olish mumkin.

**Yangi aniq bloker**: `receiptParams.TIN` (yoki `PINFL`) — SAFAAR'ning
haqiqiy STIR/JSHSHIR raqami kerak, bu ham BIZNES tomonidan berilishi
kerak (IKPU/unit kod qanday berilgan bo'lsa, xuddi shunday).

**2026-09-11 (davomi) — rasmiy dokumentatsiyadagi PINFL placeholder
ishlatildi, YANGI (chuqurroq) bloker topildi**: Uzum'ning o'z rasmiy JS
bundle hujjatida **ikki alohida joyda** aynan shu placeholder ko'rsatilgan:
`PINFL: "11111111111111"` (ish. misolida `receiptParams` ichida, va
`commission_info` jadvalidagi izohli misolida — "TIN yuridik, PINFL jismoniy
shaxslar uchun"). Bu SAFAAR tomonidan O'YLAB TOPILMAGAN — Uzum'ning O'ZI
docs'da ko'rsatgan namunaviy qiymat, shuning uchun sandbox so'roviga
qo'shildi.

Natija: **Pydantic sxema tekshiruvi TO'LIQ o'tdi** (endi hech qanday
"Field required" xatosi yo'q) — so'rov ENDI ilovaning ICHKI biznes-qatlamiga
yetib bordi va YANGI, ANIQROQ xato qaytardi:

```
errorCode: 3055
{"spics": [{"spic": "10204001010000000",
            "reason": "IKPU code is not found in the catalog",
            "reason_code": 1}]}
```

Ya'ni: **MXIK `10204001010000000` (`tasnif.soliq.uz`dan olingan)
Uzum'ning O'Z ICHKI fiskalizatsiya katalogida TOPILMADI.** Bu endi
IKPU KOD DAN boshqa hech narsaga (VAT, packaging, PINFL — barchasi
qabul qilindi) bog'liq emas — faqat shu bitta MXIK qiymatining
Uzum tomonida tan olinishiga bog'liq.

**BU YERDA TO'XTATILDI** — boshqa MXIK kodi O'YLAB TOPILMADI. Bu —
BIZNES/BUXGALTERIYA uchun aniq, tor vazifa: `10204001010000000`ni
`tasnif.soliq.uz`da QAYTA tekshirish (versiya/format/checksum farqi
bo'lishi mumkin) YOKI Uzum texnik yordamidan ularning ICHKI
katalogidagi "Mehmonxona xizmatlari" uchun TAN OLINGAN aniq MXIK
qiymatini so'rash.

## 2026-09-11 (davomi) — AUTO-FISCALIZATIONSIZ oqim: bir xil terminalda ishlamaydi

Rasmiy docs'da IKKITA alohida bo'lim bor: "Processing a one-step payment
**with** auto-fiscalization" va "Processing a one-step payment **without**
auto-fiscalization" — ikkalasi ham AYNAN BITTA endpoint
(`POST /payment/register`, `payType=\"ONE_STEP\"`). Docs matnida bu
ikkisi orasidagi FARQ **faqat**: "without" holatida "There is no need to
provide information about the items in the cart" — so'rovda hech qanday
qo'shimcha field/flag (masalan `"fiscalization": false`) KO'RSATILMAGAN.

Bu shuni ko'rsatadiki: fiskalizatsiya talab qilinishi **so'rov darajasida
EMAS, balki TERMINAL sozlamasi darajasida** aniqlanadi (Uzum tomonidan
merchant onboarding paytida terminalga biriktiriladi).

**Sandboxda tasdiqlandi**: bizning test terminalimizga (joriy
`UZUM_CHECKOUT_TERMINAL_ID`) rasmiy "without auto-fiscalization" shaklida
(`cart`/`merchantParams.cart` UMUMAN yo'q, boshqa hamma narsa avvalgi
tasdiqlangan sxema bo'yicha) so'rov yuborilganda — natija AYNAN bir xil:

```
errorCode: 3045
"[AUTOFISCALIZATION] You need to provide a cart with fiscalization params for your operation"
```

Ya'ni: **bizning terminalimiz auto-fiscalization YOQILGAN holda
sozlangan, va bu terminal darajasidagi sozlama — so'rov ichida
o'zgartirib bo'lmaydi.** "Without auto-fiscalization" oqimi faqat Uzum
ALOHIDA shunday sozlagan terminal uchun ishlaydi — bizniki bunday emas.
Demak MXIK/cart masalasini chetlab o'tishning yo'li yo'q — yagona yo'l
hamon to'g'ri, katalogda TAN OLINGAN MXIK topish (yuqoridagi bo'limga
qarang).

## 2026-09-11 (davomi) — MUVAFFAQIYAT: SAFAAR'ga xos MXIK bilan register PASS

Biznes SAFAAR'ning Uzum shartnoma hujjatidan **SAFAAR'ga xos**
(mehmonxona emas, umumiy "sayohat/bron xizmati") klassifikatsiyani
berdi:

- SPIC/MXIK: `10703999001000000` ("Safaar (turizm/bron)")
- Package/unit code: `1495084`

Bu qiymatlar bilan (`vatPercent=12` — hamon FAQAT sandbox probe,
`PINFL="11111111111111"` — rasmiy docs placeholder, ilgari tasdiqlangan
`merchantParams.cart` strukturasida) yuborilgan so'rov:

```
errorCode: 0
result: { "orderId": "<uuid>", "paymentRedirectUrl": "https://checkout.ipt-merch.com/?..." }
```

**REGISTER MUVAFFAQIYATLI BO'LDI** — bu butun tekshiruv davomida
BIRINCHI marta. Avvalgi umumiy mehmonxona MXIK'i (`10204001010000000`)
Uzum katalogida topilmagan edi (`3055`); SAFAAR'ga maxsus
`10703999001000000` esa QABUL QILINDI. `receiptType` — faqat
`"PURCHASE"` yoki `"PREPAID"` qiymatlariga ega enum ekanligi rasmiy
sxemadan tasdiqlangan (alohida "SERVICE" qiymati yo'q — shartnomadagi
"Chek turi: Xizmat" MXIK'ning o'z tabiatini bildiradi, alohida field
emas), shuning uchun `"PURCHASE"` ishlatildi.

To'lov sahifasi domeni — `checkout.ipt-merch.com` (Uzum Checkout'ning
hosted to'lov sahifasi provayderi; `uzumbank.uz`/`uzumcheckout.uz`dan
FARQLI domen). Bu domenga SAFAAR backend/proxy hech qachon to'g'ridan-
to'g'ri ulanmaydi — mijozning BROUZERI shu URL'ga redirect qilinadi,
shuning uchun gateway proxy filter'iga qo'shish SHART EMAS.

**MUHIM**: hujjatda so'ralgan `.env.local`dagi maxsus TIN/PINFL
o'zgaruvchisi TOPILMADI (`UZUM_TEST_CARD_*` to'rttasi bor, lekin TIN/
PINFL nomli hech narsa yo'q) — shu sabab ilgari ishlagan RASMIY
Uzum docs placeholder (`PINFL: "11111111111111"`) qayta ishlatildi,
va bu ham muvaffaqiyatli bo'ldi.

## 2026-09-11 (davomi) — haqiqiy checkout sahifasi + TEST HUMO karta: bank RAD ETDI

`paymentRedirectUrl` (`https://checkout.ipt-merch.com/...` — Uzum
Checkout'ning hosted to'lov sahifasi, "Uzumpay" nomi bilan, UzCard/HUMO
qabul qiladi) Playwright (headless Chrome) orqali ochildi va TEST HUMO
karta (`.env.local`) bilan to'liq to'lov oqimi sinaldi:

1. Karta raqami maydoni (`name="pan"`) to'ldirildi → forma avtomatik
   amal qilish muddati maydonini (`name="date"`, `OO/YY` formatida)
   ochdi.
2. Amal qilish muddati to'ldirildi (format mos keldi — 5 belgi, `/`
   bilan, formaning kutgan formatiga ANIQ mos).
3. "To'lash 1,000 so'm" tugmasi bosildi (`1,000 so'm` = bizning
   `amount:100000` — bu ORQALI `amount`ning TIYIN birligida ekani
   YANA bir marta tasdiqlandi: 100000 tiyin = 1000 so'm).

**Natija**: sahifa `https://checkout.ipt-merch.com/error?from=PAYMENT_ERROR&code=3009`
manziliga o'tdi — "**Bank operatsiyani rad etdi**. Karta ma'lumotlarini
tekshiring yoki boshqa to'lov usulidan foydalaning."

**Tasdiqlash — bu formatlash xatosi EMAS**: karta raqami uzunligi va
amal qilish muddati formati (belgilar soni, `/` mavjudligi) forma
kutgan aniq shaklga mos ekanligi TEKSHIRILDI (faqat UZUNLIK, qiymat
EMAS). Shuningdek `getOrderStatus` orqali mustaqil tasdiqlandi:

```
status: "REGISTERED", actionCode: 3009,
amount: 100000, totalAmount: 100000, completedAmount: 0,
operations: [], approvalCode: null
```

`actionCode: 3009` checkout sahifasidagi xato kodi bilan AYNAN mos
keladi — bu Uzum'ning bank/protsessing simulyatoridan HAQIQIY, izchil
rad javobi, UI nosozligi emas.

3DS/OTP bosqichiga UMUMAN yetib borilmadi — karta birinchi urinishdayoq
bank darajasida rad etildi. Sabab NOMA'LUM (bu aniq test kartaning
o'zi ataylab "rad etish" ssenariysi uchun mo'ljallangan bo'lishi
mumkin, yoki muddati o'tgan, yoki boshqa terminal/hisob sozlamasi bilan
bog'liq bo'lishi mumkin) — bu Uzum tomonidan tasdiqlanishi kerak
bo'lgan savol, bu yerda taxmin qilinmaydi.

## 2026-09-11 (davomi) — TO'LIQ MUVAFFAQIYAT: UzCard + 3DS bilan birinchi TO'LIQ E2E

Uzum YANGI test karta berdi — **UzCard** (avvalgi HUMO'dan farqli).
Xuddi shu tasdiqlangan register sxemasi bilan (SAFAAR IKPU
`10703999001000000`, `packageCode 1495084`, `vatPercent=12` — sandbox
probe, `PINFL` — rasmiy docs placeholder) yangi order yaratildi, keyin
haqiqiy checkout sahifasida (Playwright, headless Chrome) UzCard bilan
to'liq oqim ishga tushirildi, BIR BROUZER SESSIYASI ichida uzluksiz:

1. Karta raqami + amal qilish muddati to'ldirildi, "To'lash" bosildi.
2. **3DS OTP challenge chiqdi** — `https://vform.ipt-merch.com/otp?...`
   iframe'i, bitta matn maydoni (`maxLength:6` — bu `.env.local`dagi
   `UZUM_TEST_CARD_3DS`ning aniq uzunligi bilan MOS keldi).
3. OTP kodi to'ldirildi va tasdiqlandi.
4. Sahifa `https://checkout.ipt-merch.com/success` manziliga o'tdi —
   **"Muvaffaqiyatli!"**.

**Rasmiy server tomonidan mustaqil tasdiqlandi** (`getOrderStatus`):

```
status: "COMPLETED", actionCode: 0,
amount: 100000, totalAmount: 100000, completedAmount: 100000,
operations: [{ operationType: "COMPLETE", state: "SUCCESS",
               actionCodeDescription: "Запрос успешно обработан." }],
ips: "UZCARD"
```

Va `getOperationState` (aniq `operationId` bilan — bu maydonning o'zi
ILGARI hech qayerda hujjatlashtirilmagan edi, endi tasdiqlangan: FAQAT
`operationId` kerak, `orderId` EMAS) — bir xil `state: "SUCCESS"`ni
mustaqil tasdiqladi.

**Bu — butun tekshiruv davomida BIRINCHI to'liq muvaffaqiyatli
to'lov**: register → checkout → karta → 3DS/OTP → COMPLETE, uchtala
mustaqil manbadan (checkout sahifasi UI'i, `getOrderStatus`,
`getOperationState`) tasdiqlangan.

**SAFAAR production ma'lumotlar bazasi TEGILMADI** — bu sinov
`UzumCheckoutProvider.register()` orqali EMAS, to'g'ridan-to'g'ri
xom Uzum API so'roviga (gateway orqali) yuborildi; SAFAAR'ning o'z
backend kodi (`createUzumCheckoutPayment`, callback controller) bu
jarayonda umuman ishtirok etmadi. Callback route (`/v1/uzum/checkout/
callback`, production `api.safaar.uz`da) hamon fail-closed (signature
sxemasi sozlanmagan) — hatto Uzum sandbox terminal shu URL'ga real
callback yuborgan taqdirda ham, u imzosiz bo'lgani uchun 401 bilan rad
etiladi va HECH QANDAY `payments` qatori yozilmaydi (bu — ilgari
tasdiqlangan fail-closed dizaynning o'zi, bu safar amalda ishlayotgani
ko'rsatildi).

## 2026-09-11 (davomi 2) — SAFAAR BACKEND ORQALI TO'LIQ E2E (register → checkout → 3DS → callback → DB)

Yuqoridagi sinov Uzum API'ga **to'g'ridan-to'g'ri** (SAFAAR kodini chetlab
o'tib) yuborilgan edi. Bu safar butun oqim **SAFAAR'ning o'z backend
kodi** orqali, boshidan oxirigacha ishga tushirildi — alohida,
production'dan izolyatsiyalangan, bir martalik QA konteynerida
(`safaar-e2e-test`, `safaar-qa-network`, `safaar-qa-db`/`safaar-qa-redis`,
xuddi shu commit va xuddi shu production Dockerfile'dan qurilgan).

**Muhit**: `NODE_ENV=qa-e2e` (hech qachon `production` emas),
`UZUM_CHECKOUT_TEST_MODE=true` (faqat shu konteynerda — signature
sxemasi hali tasdiqlanmagani uchun callback imzo tekshiruvini QA'da
xavfsiz chetlab o'tish uchun), `ENABLE_DEMO_AUTH=true` (faqat shu
konteynerda — real SMS provayder o'rniga OTP kodini javobda
qaytarish, haqiqiy `/auth/user/send-otp` → `/auth/user/verify-otp`
oqimini sinash uchun).

**Autentifikatsiya**: real, mavjud QA test foydalanuvchi
(`a4f48524-b752-47d9-bf7c-a705a7ea3c2e`) uchun haqiqiy telefon-OTP
login oqimi (`POST /v1/auth/user/send-otp` → `dev_code` → `POST
/v1/auth/user/verify-otp`) ishlatildi — JWT qo'lda "mint" qilinmadi,
mavjud `signJwt`/`issueTokens` kodi orqali chiqarildi.

**1) Register — SAFAAR backend orqali**: `POST
/v1/payments/:bookingId/create {"provider":"uzum_checkout"}`
(Bearer bilan) haqiqiy QA bron uchun chaqirildi.
`PaymentsService.createPayment()` → `createUzumCheckoutPayment()` →
`UzumCheckoutProvider.register()` — birinchi marta HAQIQIY foydalanuvchi
so'rovi orqali ishga tushdi (avvalgi sinovlar bevosita provayder/xom
API chaqiruvi edi). Natija: `201`, haqiqiy Uzum `orderId` va
`paymentRedirectUrl` bilan, `payments` jadvaliga `status='processing'`,
`provider_reference=orderId`, `idempotency_key='uzum_checkout:'+orderId`
yozildi — bularning barchasi `psql` bilan to'g'ridan-to'g'ri
tasdiqlandi.

**2) Checkout + 3DS — real Uzum hosted checkout sahifasida**: qaytgan
`paymentRedirectUrl` Playwright (headless Chrome) orqali ochildi,
avvalgi sessiyada tasdiqlangan UzCard test karta + 3DS OTP bilan
to'liq to'landi (`input[name="pan"]`, keyin `Tab` bilan `input[name="date"]`
maydoni ochilishini kutish kerak edi — forma ikki bosqichli ekan;
so'ng bitta 6-belgili OTP maydoni). Sahifa
`https://checkout.ipt-merch.com/success` ga o'tdi.

**3) Uzum tomonidan mustaqil tasdiqlash — SAFAAR'ning o'z provayder
kodi orqali** (xom `curl` EMAS): konteyner ichida `NestFactory
.createApplicationContext(AppModule)` bilan haqiqiy DI-kontekst
ko'tarilib, undan haqiqiy `UzumCheckoutProvider` instance olindi va
uning `getOrderStatus(orderId)` / `getOperationState(orderId,
operationId)` metodlari chaqirildi:

```
getOrderStatus  -> rawStatus=COMPLETED, state=PAID, amountSom=1000
operations      -> [{ operationType: "COMPLETE", state: "SUCCESS" }]
getOperationState -> rawStatus=SUCCESS, state=PAID
```

**4) Callback — real maydon shakli bilan simulyatsiya qilindi**:
Uzum'ning haqiqiy async callback'i ehtimol merchant-hisob darajasidagi
(production `api.safaar.uz`) URL'ga yo'naltirilgan — shu QA
konteyneriga real callback yetib kelishi kafolatlanmaydi. Shu sabab
`POST /v1/uzum/checkout/callback`ga endi TASDIQLANGAN xom maydon
qiymatlari bilan (yuqoridagi (3)-bosqichda haqiqiy Uzum javobidan
olingan `operationType`/`operationState`) qo'lda quyidagi payload
yuborildi:

```json
{
  "orderId": "<haqiqiy Uzum orderId>",
  "orderNumber": "<booking_number>",
  "merchantOperationId": "<payments.id>",
  "operationType": "COMPLETE",
  "operationState": "SUCCESS",
  "amount": 1000,
  "currency": "UZS"
}
```

⚠️ **`amount` birligi hamon TASDIQLANMAGAN** — `normalizeCheckoutCallback()`
`raw.amount`ni to'g'ridan-to'g'ri (hozirgi kod bo'yicha) so'm sifatida
o'qiydi (TIYIN emas); yuqoridagi payload ham shu taxminga mos ravishda
so'm (`1000`) yubordi. Bu Uzum'ning HAQIQIY callback body'sidan hali
mustaqil tasdiqlanmagan — faqat kodning HOZIRGI ichki taxminiga mos
sinov.

`UZUM_CHECKOUT_TEST_MODE=true` orqali imzo tekshiruvi (faqat shu QA
konteynerida) o'tkazib yuborildi — boshqa BARCHA tekshiruvlar (order
qidirish, `state==='PAID'` mapping, `processPaymentEvent()`ning
amount/currency/terminal-holat/idempotentlik tekshiruvlari) TO'LIQ
ishladi.

**Natija — SAFAAR DB'da tasdiqlandi** (`psql`):

| Jadval                   | Callback'dan OLDIN | Callback'dan KEYIN           |
| ------------------------ | ------------------ | ---------------------------- |
| `payments.status`        | `processing`       | `paid`                       |
| `bookings.status`        | `pending`          | `confirmed`                  |
| `bookings.expires_at`    | (bor edi)          | `NULL`                       |
| `booking_status_history` | —                  | 1 ta yozuv (`confirmed`)     |
| `payment_events`         | —                  | 1 ta audit yozuv (`confirm`) |

**5) Edge case'lar — barchasi kutilganidek ishladi**:

- **Duplicate callback** (bir xil payload ikkinchi marta): `200
{"duplicate":true,"applied":false}` — payment holati/summasi
  o'zgarmadi (qayta tekshirildi).
- **Noma'lum order** (mavjud bo'lmagan `orderId`): `404
{"code":"unknown_order"}` — hech qanday `payments`/`bookings`
  yozuvi tegilmadi, faqat audit (`payment_events`) qatori yozildi.
- **Noto'g'ri summa** (hali `pending`/`processing` holatdagi BOSHQA
  test to'lov uchun, real summa `1000` o'rniga `999999` yuborildi):
  `422 {"code":"amount_mismatch"}` — to'lov holati o'zgarmadi
  (`processing`da qoldi, buzilmadi).

**Xulosa**: bu — sessiyadagi birinchi marta butun zanjir (SAFAAR
booking → SAFAAR backend `register()` → Uzum sandbox → real UzCard +
3DS → Uzum `COMPLETED` → SAFAAR callback handler → `payments.status=
paid` → `bookings.status=confirmed`) **SAFAAR'ning o'z ishlab
chiqarish kodi orqali**, xom `curl`/to'g'ridan-to'g'ri API
chaqiruvisiz isbotlandi. Faqat ikkita qism hamon xom Uzum API bilan
mustaqil emas: (a) callback signature sxemasi (shuning uchun QA-only
`UZUM_CHECKOUT_TEST_MODE` bilan simulyatsiya qilindi — Uzum'dan
real callback network orqali yetkazib berish emas), (b) callback
`amount` birligi (so'm/tiyin) — yuqorida qayd etilgan.

## 2026-09-11 (davomi 3) — PRODUCTION READINESS AUDIT: rasmiy manba, refund, amount-qayta-tasdiqlash, reconcile cron

Ushbu audit `developer.uzumbank.uz`ning o'z JS bundle'ida (`main.
<hash>.js`) yashiringan TO'LIQ OpenAPI JSON sxemasini (RU+EN, "Uzum
Checkout") to'g'ridan-to'g'ri o'qib chiqdi (auth'siz, oddiy `curl`;
portal HTML'i client-side render qilgani uchun bo'sh keladi, LEKIN
uni render qiluvchi bundle to'liq spec matnini string literal
sifatida ichida olib yuradi). Bu — ilgari faqat UCHINCHI TOMON
(`github.com/vsevalid/uzum-payments`) orqali "kuchli dalil, rasmiy
tasdiqlanmagan" deb belgilangan hamma narsani RASMAN TASDIQLADI (va
ustiga bir nechta yangi, muhim narsani ochdi).

### 1) Callback signature — RASMAN YO'QLIGI TASDIQLANDI

`acquiring_merchant_callback` operatsiyasining o'z OpenAPI ta'rifida
(`callbacks:` bloki) `parameters` kaliti BUTUNLAY YO'Q — demak hech
qanday sarlavha (imzo, API-key, Authorization) rasman talab
qilinmaydi. Prosaik "# Callbacks" bo'limi ham FAQAT: "server 200 OK
qaytarishi kerak; qaytarmasa, Uzum maksimal 5 marta qayta yuboradi" —
signature/hmac/secret/basic-auth haqida BIR OG'IZ SO'Z YO'Q.

Solishtirish uchun: BUTUNLAY BOSHQA, alohida "Merchant API" spec'i
(`/check /create /confirm /reverse /status`, bizning eski
`UzumProvider`/`UzumWebhookController`) o'zining Webhooks bo'limida
ANIQ HTTP Basic Auth talab qiladi. Demak Uzum umuman webhook-auth
tushunchasisiz emas — Checkout mahsuloti buni ATAYLAB/HALI
qo'llamaydi, xolos.

**Qaror**: `UzumCheckoutProvider.verifyCallback()` production'da
(`UZUM_CHECKOUT_SIGNATURE_SCHEME` sozlanmagan holatda) HAR DOIM rad
etishda davom etadi — bu ATAYLAB O'ZGARTIRILMAYDI ("placeholder"
HMAC'ni productionga qabul qilish YO'Q, aniq ko'rsatma bo'yicha). Bu
degani: production HECH QACHON callback orqali to'g'ridan-to'g'ri
PAID holatiga o'TMAYDI — bu doimiy holat, "hali" emas. Shuning uchun
`reconcileUzumCheckoutPayments()` (bizning o'z, `X-Terminal-Id`/
`X-Api-Key` bilan autentifikatsiyalangan `getOrderStatus()`
chaqiruviga tayanadigan metod) `@Cron(EVERY_MINUTE)` bilan
PRODUCTIONDA YAGONA ishonchli PAID-tasdiqlash yo'liga aylantirildi.
Bu callback signature'ning "zaif o'rnini bosuvchisi" EMAS — aksincha
KUCHLIROQ: hech qanday tasdiqlanmagan tashqi POST body'siga
ISHONILMAYDI. `olderThanMinutes` standart qiymati (`15`dan `2`ga)
tushirildi — aks holda to'lov ~15 daqiqagacha noto'g'ri "pending"
ko'rinardi.

### 2) Callback amount — rasman YO'QLIGI tasdiqlandi (unit emas, maydonning o'zi)

`AcquiringCallbackData` schema: `required: [orderId, operationState,
operationType, orderNumber]`, ixtiyoriy: `cardType`,
`merchantOperationId`, `rrn`. **Amount/currency maydoni UMUMAN YO'Q.**

Bu — avval yashirin bo'lgan HAQIQIY zaiflikni ochdi:
`assertPaymentMatchesPayload()` `body.amount === undefined` bo'lsa
tekshiruvni JIM O'TKAZIB YUBORADI. Demak HAQIQIY Uzum callback'i
(agar kelajakda signature qandaydir tarzda tasdiqlansa ham) amount-
mismatch himoyasini HECH QACHON ishga tushira olmasdi — chunki bu
maydon hech qachon kelmaydi. **Tuzatildi**:
`PaymentsService.uzumCheckoutCallback()` endi callback `state==='PAID'`
bo'lganda avval MUSTAQIL `getOrderStatus(orderId)` chaqiradi va FAQAT
o'sha (bizning autentifikatsiyalangan so'rovimiz orqali) tasdiqlangan
summani `processPaymentEvent()`ga uzatadi — callback body'sidagi
`amountSom` ENDI hech qachon moliyaviy qaror uchun ishlatilmaydi
(faqat orqaga moslik/audit uchun saqlanadi). Agar `getOrderStatus`
PAID qaytarmasa — hech narsa qo'llanilmaydi, faqat audit
(`callback:unverified`) yoziladi; `getOrderStatus`ning o'zi
muvaffaqiyatsiz bo'lsa (tarmoq/konfiguratsiya) — oddiy `Error` throw
qilinadi (500, Uzum qayta urinadi), `UzumCheckoutError` EMAS
(aks holda controller buni signature-rad etish deb noto'g'ri talqin
qilardi).

`getOrderStatus`ning O'ZI (bizning outbound so'rovimiz) esa TIYIN
ishlatishi allaqachon (2026-09-11, oldingi yozuv) mustaqil
tasdiqlangan edi — shu sabab "callback amount unit" savoli endi
BUTUNLAY BOSHQACHA hal qilindi: callback amount'iga UMUMAN
ishonilmaydi, shuning uchun uning birligi (so'm/tiyin) ahamiyatsiz.

### 3) `AcquiringStatus` — to'liq rasmiy enum, `DECLINED` xaritalandi

Rasmiy: `REGISTERED | AUTHORIZED | TOP_UP_COMPLETED | COMPLETED |
REFUNDED | REVERSED | DECLINED`. `ORDER_STATUS_MAP`ga `DECLINED ->
FAILED` qo'shildi (bank/protsessing rad etgan holat — `PAID` bilan
aralashtirib bo'lmaydigan yagona ma'noli xaritalash). `AUTHORIZED`
(SAFAAR `ONE_STEP` ishlatgani uchun amalda kutilmaydi), `REFUNDED`/
`REVERSED` (pul CHIQISHI) va `TOP_UP_COMPLETED` (boshqa mahsulot)
ATAYLAB `UNKNOWN`da qoldi.

### 4) `refund()` — HAQIQIY implementatsiya, sandboxda TASDIQLANGAN

`POST /api/v1/acquiring/refund` (sarlavhalar `X-Operation-Id`
majburiy/UUID/idempotentlik, `X-Terminal-Id` majburiy, `X-Api-Key` —
spec `required:false` deydi, lekin doim yuboriladi). Body:
`orderId`, `amount` (TIYIN), `cart` (ixtiyoriy —
`FiscalizationCartRequest`, "faqat autofiskalizatsiya yoqilganda").

**Sandboxda haqiqiy test** (yangi order, 1000 so'm, UzCard+3DS bilan
COMPLETED qilingach):

1. **Qisman refund (300 so'm)** — birinchi urinish `errorCode 3046
"NOT_FOUND_IN_PURCHASE_RECEIPT"` bilan rad etildi: cart item
   `productId` sifatida tasodifiy `randomUUID()` ishlatilgan edi,
   lekin Uzum bu qiymatni ORIGINAL purchase receipt bilan
   solishtiradi. **Tuzatish**: `register()` endi cart item
   `productId` sifatida `input.merchantOperationId` (=`payments.id`,
   SAFAAR'da allaqachon saqlangan) ishlatadi — tasodifiy emas,
   DETERMINISTIK. Yangi ustun/migratsiya SHART EMAS.
2. Tuzatilgan `productId` bilan qayta urinish `errorCode 3059 "The
cart total is incorrect"` berdi: `cart.total`ga QISMAN refund
   summasini (30000 tiyin) yuborgan edim. **Tuzatish**: `cart.total`
   — buyurtmaning ORIGINAL/completed TO'LIQ summasi
   (`getOrderStatus().completedAmount`) bo'lishi kerak, QISMAN
   summa EMAS — bir nechta qisman refund bo'lsa ham DOIM shu bir xil
   qiymat. `refund()` endi bu qiymatni chaqiruvchidan talab qilish
   O'RNIGA ICHKI `getOrderStatus()` orqali mustaqil oladi.
3. Tuzatilgan cart bilan: `errorCode 0`, `operationId` qaytdi.
   `getOrderStatus` orqali tasdiqlandi: `refundedAmount: 30000`,
   `totalAmount: 70000` (qolgan balans), `completedAmount: 100000`
   (o'zgarmadi), `operations[]`da yangi `{operationType: "REFUND",
state: "SUCCESS"}` yozuvi.
4. **To'liq refund (qolgan 700 so'm)** — xuddi shu naqsh bilan
   (`cart.total` hamon 100000, `amount=70000`): `errorCode 0`.
   `getOrderStatus`: `rawStatus: "REFUNDED"` (rasmiy `AcquiringStatus`
   qiymati!), `refundedAmount: 100000`, `totalAmount: 0`.

**MUHIM CHEKLOV**: `refund()` hali SAFAAR business-flow'ga
(`admin.service.ts`ning `refundApprove()`) ULANMAGAN — u mavjud,
ATAYLAB dizayn bo'yicha ("real tashqi provayder integratsiyasi
yo'q — hech qanday tashqi so'rov yuborilmaydi") tashqi provayder
so'rovisiz qoladi (bu boshqa PROVIDERLAR — click/payme/uzcard/humo —
uchun ham bir xil, umumiy kod). Bu metodni avtomatik ravishda
`refundApprove()`ga ulash — alohida, ongli biznes qaror (bu audit
doirasidan tashqarida, business/ops tomonidan aniq so'ralishi kerak).

### 5) Commission (1.5%) — audit, o'zgarishsiz TASDIQLANDI

`uzum-checkout-commission.ts` allaqachon to'g'ri: butun-tiyin
arifmetikasi (suzuvchi nuqta YO'Q), gross/commission/net aniq
ajratilgan, `UZUM_CHECKOUT_SETTLEMENT_MODEL='REQUIRES_UZUM_CONFIRMATION'`
(hardcoded, env orqali emas — tasdiqlanmaguncha o'zgarmaydi), refund
komissiyasi bo'yicha taxmin YO'Q, customer-facing summaga
TA'SIR QILMAYDI. Hech qanday o'zgartirish kerak emas — bu modul DB
migratsiyasiga (`20260911000000_uzum_checkout_commission_fields`)
hamon ulanmagan, bu ham ATAYLAB (ongli qaror, audit doirasidan
tashqarida).

### 6) Production config audit

- Production konteynerida (`safaar-backend`, `NODE_ENV=production`)
  `UZUM_CHECKOUT_*` muhit o'zgaruvchilarining BIRORTASI ham
  sozlanmagan (nomlar tekshirildi, qiymatlar EMAS) — Uzum Checkout
  productionda HALI UMUMAN FAOLLASHTIRILMAGAN (`isConfigured()` har
  doim `false`, `register()` har doim `NOT_CONFIGURED`/503). Bu —
  kutilgan holat (haqiqiy production credential hali berilmagan),
  xato EMAS.
- `UZUM_CHECKOUT_TEST_MODE=true` production'da `env.validation.ts`
  darajasida QATTIQ rad etiladi (boot-vaqtida throw) — mustaqil
  qayta tasdiqlandi.
- Production callback URL (`https://api.safaar.uz/v1/uzum/checkout/
callback`) tashqi, real `curl` bilan tekshirildi: HTTPS ochiq,
  Cloudflare/gateway ortida javob beradi, imzosiz so'rovga `401`
  qaytaradi (aynan kutilgan fail-closed xulq) — production kodga
  HECH NARSA yozilmadi.
- CORS (`CORS_ORIGINS`) — bu Uzum Checkout callback'iga (server-
  server, brauzer EMAS) aloqasiz; brauzer-yo'naltiruvchi oqimlar
  (checkout redirect) uchun allaqachon mavjud sozlamalar yetarli.
- Static egress proxy (`UZUM_CHECKOUT_HTTPS_PROXY`, safaar-gateway
  `51.250.78.204`) — ilgari tasdiqlangan, ishlaydi, lekin
  PRODUCTIONda hamon sozlanmagan (yuqoridagi bandning bir qismi).

### 7) Test isolation

Barcha sandbox testlar (register/getOrderStatus/refund, bu audit
davomida) `payments.id`ga o'xshash tasodifiy `merchantOperationId`/
`orderNumber='UZB-REFUNDTEST-<timestamp>'` bilan, SAFAAR PRODUCTION
DB'siga HECH QANDAY yozuvsiz amalga oshirildi (to'g'ridan-to'g'ri
provider chaqiruvlari, mahalliy `tsx` skript orqali, production
kodga/bazaga tegmasdan). Yagona DB yozuvlari — oldingi (2026-09-11,
davomi 2) yozuvdagi QA konteyner testlari, ular ham faqat
`safaar-qa-db`da.

### Xulosa

| Ochiq masala (audit boshida) | Holat endi                                                                                                                           |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Callback signature           | ✅ TASDIQLANDI: rasman yo'q. Production fail-closed abadiy qoladi; `reconcileUzumCheckoutPayments` PRODUCTIONDA yagona yo'l          |
| Callback amount unit         | ✅ HAL QILINDI: maydonning o'zi yo'q — callback amount'iga umuman ishonilmaydi, har doim `getOrderStatus()` bilan qayta tasdiqlanadi |
| Refund                       | ✅ HAQIQIY, sandboxda qisman+to'liq tasdiqlangan; SAFAAR business-flow'ga ulanmagan (ongli, alohida qaror)                           |
| Commission                   | ✅ audit qilindi, o'zgarishsiz to'g'ri                                                                                               |
| Production config            | ✅ audit qilindi — Checkout hali productionda FAOLLASHTIRILMAGAN (kutilgan)                                                          |

## 2026-09-11 (davomi 4) — TUZATISHLARDAN KEYIN TO'LIQ QAYTA E2E (SAFAAR backend orqali)

Yuqoridagi barcha tuzatishlardan (getOrderStatus qayta-tasdiqlash,
`register()` deterministik `productId`, `refund()`, `@Cron`
reconciliation) keyin butun zanjir **yana bir marta, yangi commit'dan
qurilgan alohida bir martalik QA konteynerida**, SAFAAR'ning haqiqiy
HTTP yo'li orqali sinaldi (avvalgi (davomi 2) yozuvdagi USUL bilan bir
xil — alohida QA konteyner, `safaar-qa-network`, real OTP login).

**Yo'lda topilgan HAQIQIY (kod bilan bog'liq bo'lmagan) infratuzilma
xatosi**: birinchi urinishlar `503 PAYMENT_PROVIDER_NOT_CONFIGURED`
bilan muvaffaqiyatsiz tugadi — sabab `UzumCheckoutProvider`ning
o'zida EMAS (`isConfigured()`/`isFiscalConfigured()` ikkalasi ham
`true` ekani mustaqil tasdiqlandi), balki QA konteynerining
`WEB_USER_URL` muhit o'zgaruvchisi tasodifan doimiy `safaar-qa-backend`
konteynerining O'Z ICHKI loopback manzilidan (`http://127.0.0.1:4401`)
meros qilib olingan edi — bu qiymat `successUrl`/`failureUrl`
qurilishida ishlatiladi (`PaymentsService.webUserUrl()`), va Uzum bu
haqiqatan ham tashqi/ochiq bo'lmagan URL'ni **`errorCode 2000`** bilan
rad etadi (buni to'g'ridan-to'g'ri provider chaqiruvi bilan, HAQIQIY
booking ma'lumotlari bilan, lekin HTTP-tashqarisida takrorlab
tasdiqlandi — ular muvaffaqiyatli edi, demak muammo faqat `WEB_USER_URL`
qiymatida edi). `WEB_USER_URL=https://web-user-rho.vercel.app`ga
(production'dagi HAQIQIY qiymat) tuzatilgach, HTTP yo'li darhol
ishladi.

**To'liq zanjir, tasdiqlangan**:

1. Real OTP login → `POST /v1/payments/:id/create` → `201`, haqiqiy
   `orderId` (`af39fa46-...`) + `paymentRedirectUrl`.
2. Playwright + UzCard test karta + 3DS OTP → `checkout.ipt-merch.com/
success`.
3. SAFAAR'ning O'Z `getOrderStatus()`/`getOperationState()`si (standalone
   Nest kontekst orqali) → `COMPLETED`/`PAID`, `amountSom:1000`.
4. **Rasmiy schema bo'yicha, AMOUNT MAYDONISIZ** simulyatsiya
   callback (`{orderId, orderNumber, merchantOperationId,
operationType:"COMPLETE", operationState:"SUCCESS"}` — `amount`
   maydoni ATAYLAB YO'Q, chunki rasmiy schema'da yo'q) →
   `POST /v1/uzum/checkout/callback` → `200 {applied:true}`. Bu —
   callback'ning YANGI `getOrderStatus()`-qayta-tasdiqlash mantig'i
   HAQIQIY HTTP orqali TO'G'RI ishlayotganining to'g'ridan-to'g'ri
   isboti (eski kod bu holatda `amountSom=NaN` bilan
   `assertPaymentMatchesPayload`ni jim o'tkazib yuborardi).
5. SAFAAR DB: `payments.status='paid'`, `amount=1000.00` (callback
   body'sida UMUMAN bo'lmagan qiymat — faqat `getOrderStatus()` orqali
   keldi), `bookings.status='confirmed'`.
6. **Duplicate callback** → `200 {duplicate:true, applied:false}`.
7. **Noma'lum order** → `404 unknown_order`.
8. **"Soxta da'vo" testi** (yangi, MUHIM): alohida bron uchun
   `register()` chaqirildi, LEKIN checkout HECH QACHON yakunlanmadi
   (buyurtma Uzum tomonida `REGISTERED`, hech qachon `COMPLETED`
   bo'lmadi). Shu buyurtma uchun `operationState:"SUCCESS"` da'vo
   qiluvchi callback yuborildi — **`200 {applied:false}`**, `payments`
   qatori `processing`da qoldi, `bookings` `pending`da qoldi, faqat
   `payment_events`ga `callback:unverified` audit yozildi. Bu —
   signature'siz callback'ning YANGI xavfsizlik modelining
   TO'G'RIDAN-TO'G'RI, amaliy isboti: soxta/erta/eskirgan "PAID" da'vosi
   HECH QANDAY moliyaviy holatni o'zgartira olmadi, chunki u BIZNING
   o'z `getOrderStatus()` tekshiruvimiz bilan mos kelmadi.
9. **`reconcileUzumCheckoutPaymentsCron()` — jonli, kutilmagan, ijobiy
   dalil**: konteyner ishga tushgach, birinchi `@Cron(EVERY_MINUTE)`
   aylanishining o'ZI (hech qanday qo'lda ishga tushirishsiz) OLDINGI
   (2026-09-11, ertalabki) sessiyadan qolgan, hech qachon callback
   olmagan, `processing` holatida "osilib qolgan" haqiqiy buyurtmani
   (`orderId 1bcc97f2-...`, o'sha safar ham COMPLETED bo'lgan, lekin
   hech qachon SAFAAR'ga xabar berilmagan) topdi, Uzum'dan mustaqil
   `getOrderStatus()` bilan `COMPLETED` ekanini tasdiqladi va — **HECH
   QANDAY inbound callback'siz** — `payments.status='paid'` +
   `bookings.status='confirmed'`ga o'tkazdi (2+ soat "pending" turgan
   bron). Bu — audit'ning markaziy tavsiyasining (callback signature
   yo'qligi sharoitida reconciliation production uchun YAGONA ishonchli
   yo'l) haqiqiy, kutilmagan, ishlab chiqarish sharoitiga o'xshash
   tasdig'i.

**Tozalash**: bir martalik konteyner/image o'chirildi, host'dagi vaqtinchalik
env fayllari tozalandi, production (`safaar-backend`) va doimiy QA
(`safaar-qa-backend`) konteynerlar butun jarayon davomida bir marta ham
qayta ishga tushirilmadi/o'zgartirilmadi.

## 2026-09-12 — QAYTA AUDIT: refund double-ledger-debit tuzatildi, duplicate-refund himoyasi jonli tasdiqlandi

`develop`ga chiqarilgan + qaytadan `temp/save-all-work`ga pull qilingan
o'zgarishlardan keyin (backend kod 0 ta fayl bo'yicha farq qildi —
to'liq sinxron), butun Uzum Checkout implementatsiyasi qaytadan
so'rovnoma qilindi. Kod o'zgarishsiz to'g'ri ekani tasdiqlandi, PLUS
ikkita yangi, real topilma:

### 1) `admin.refundApprove()` — double-ledger-debit BUGI (tuzatildi)

Repo bo'yicha `INSERT INTO refunds` beshta MUSTAQIL joydan chaqiriladi
(`bookings.service.ts` x2, `refunds.service.ts`, `payments.service.ts`
— `autoRefundForLostRace`, `partners.service.ts`) — har biri bir-biridan
bexabar, bitta bookingga bir nechta `refunds` qatorini yaratishi
mumkin (masalan: mijoz so'rovi + tizim avto-refundi bir vaqtda).
`refundApprove()`ning eski versiyasi har bir qatorni MUSTAQIL
tekshirardi (`refund.status IN ('requested','processing')`), lekin
`payments`/`bookings` UPDATE'lari xavfsiz no-op bo'lsa ham
(`WHERE status='paid'` allaqachon mos kelmaydi), hamkor ledgeriga
manfiy yozuv **SHARTSIZ** qo'shilardi — natijada BITTA haqiqiy pul
qaytarishga IKKITA ledger debiti to'g'ri kelib, hamkorning haqiqiy
qarzi noto'g'ri hisoblanardi.

**Tuzatish**: `UPDATE payments ... RETURNING id` orqali haqiqatan
qator o'zgarganini tekshirish qo'shildi; booking bekor qilish va
ledger yozuvi FAQAT shu holatda bajariladi. Regressiya testi qo'shildi
(`admin.service.spec.ts`): ikkinchi (allaqachon boshqa qator orqali
qaytarilgan) refund so'rovini tasdiqlash — `approved` deb belgilanadi
(admin qarori qayd etiladi), lekin booking/ledgerga IKKINCHI marta
tegilmaydi. 34/34 mavjud + yangi test o'tdi, `tsc` toza.

### 2) Duplicate refund himoyasi — Uzum'ning O'Z sandboxida jonli tasdiqlandi

Avvalgi sessiyada to'liq refund qilingan haqiqiy buyurtmaga
(`orderId 2dee4f1a-...`, `rawStatus: REFUNDED`, qolgan balans 0)
nisbatan IKKINCHI marta `refund()` chaqirildi — Uzum'ning o'zi
`errorCode 3000 "Invalid payment status for this operation"` bilan
rad etdi. SAFAAR'ning `refund()` metodi buni to'g'ri `REFUND_FAILED`
xatosiga aylantirdi, hech qanday soxta muvaffaqiyat/ikki karra
qaytarish yuz bermadi. Bu — duplicate-refund himoyasining AUTORITATIV
manba (Uzum) darajasida ishlashining real, sinovdan o'tgan dalili.

### 3) `FAILED -> PAID` reconciliation — ATAYLAB implement qilinmadi (asoslash)

`reconcileUzumCheckoutPaymentsCron()` faqat `pending`/`processing`
holatidagi to'lovlarni ko'rib chiqadi — `failed` holatidagi to'lovlarga
HECH QACHON tegmaydi. Bu ataylab: hozirgi kodda `uzum_checkout` to'lov
FAQAT bitta yo'l bilan `failed` bo'ladi — reconcile'ning o'zi Uzum
`AcquiringStatus=DECLINED` (rasmiy, bank/protsessing rad etgan holat)
ko'rganda. `DECLINED` — Uzum tomonidan AVTORITATIV va YAKUNIY holat;
xuddi shu buyurtma keyinchalik `COMPLETED`ga aylanishi kutilmaydigan
(karta to'lovlarida rad etilgan tranzaksiya qayta jonlanmaydi) real
stsenariy emas. Shu sabab `FAILED -> PAID`ni "rasmiy reconciliation"
sifatida qo'shish — HOZIRCHA hech qanday haqiqiy ehtiyojga javob
bermaydigan, faqat noaniqlik qo'shadigan o'zgarish bo'lardi — ATAYLAB
qilinmadi (talab qilinsa, aniq biznes stsenariysi bilan qayta ko'rib
chiqiladi).

### Qayta tasdiqlangan (regressiya yo'q)

Real sandboxga qarshi: `register()` → yangi `orderId` (`af06bbf6-...`),
`getOrderStatus()` → `REGISTERED`/`PENDING` — ikkalasi ham kod
o'zgarishisiz, `develop`ga chiqarish + qaytadan pull qilishdan keyin
ham to'g'ri ishlayotgani tasdiqlandi. To'liq test to'plami: **695/695**
(694 + yangi regressiya testi), `tsc --noEmit` toza, ESLint 0 xato.
