import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProxyAgent, type Dispatcher } from 'undici';
import { hmacSha256, timingSafeEqualString } from '../../auth/security';

/**
 * Uzum **Checkout** provayderi (Merchant API'dan MUTLAQO ALOHIDA).
 *
 * Merchant flow (`/check /create /confirm /reverse /status`, `UzumProvider`,
 * `UzumWebhookController`) bu yerga umuman aloqador emas va o'zgartirilmaydi.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SPEC HOLATI — 2026-09-11: RASMIY MANBADAN TO'G'RIDAN-TO'G'RI TASDIQLANDI
 * ─────────────────────────────────────────────────────────────────────────────
 * `developer.uzumbank.uz/en/checkout/` sahifasining o'zi client-side (JS)
 * render qiladi va HTML fetch bilan bo'sh keladi — LEKIN uni render qiluvchi
 * `main.<hash>.js` bundle to'liq OpenAPI JSON sxemasini (RU + EN, "Uzum
 * Checkout" nomli, `en_checkout`/`ru_checkout` redocusaurus doc-id'lari
 * ostida) string literal sifatida ICHIDA olib yuradi — oddiy `curl`/fetch
 * bilan (auth'siz, brauzersiz) TO'LIQ o'qib olinadi. Shu bundle'dan
 * TO'G'RIDAN-TO'G'RI, ishonchli darajada tasdiqlangan:
 *
 *   - **Callback (`acquiring_merchant_callback`) uchun rasmiy imzo/
 *     autentifikatsiya mexanizmi UMUMAN YO'Q.** OpenAPI `callbacks:` blokida
 *     bu operatsiyaning o'zida (`{$callback_url}` -> `post`) `parameters`
 *     KALITI BUTUNLAY YO'Q — demak hech qanday sarlavha (imzo, API-key,
 *     Authorization) talab qilinmaydi deb HUJJATLASHTIRILGAN. Prosaik
 *     "# Callbacks" bo'limi ham FAQAT: "server 200 OK qaytarishi kerak;
 *     qaytarmasa, Uzum maksimal 5 marta qayta yuboradi" — boshqa hech
 *     narsa (signature/hmac/secret/basic-auth) YO'Q. Solishtirish uchun:
 *     BUTUNLAY BOSHQA, alohida "Merchant API" spec'i (`/check /create
 *     /confirm /reverse /status`, bizning eski `UzumProvider`/
 *     `UzumWebhookController`) o'zining Webhooks bo'limida ANIQ HTTP Basic
 *     Auth talab qiladi — demak Uzum umuman webhook-auth tushunchasisiz
 *     emas, lekin CHECKOUT o'zi buni ATAYLAB/HALI qo'llamaydi. Bu — ENDI
 *     "hali noma'lum" emas, **"rasmiy ravishda yo'qligi tasdiqlangan"**
 *     xulosa.
 *   - `AcquiringCallbackData` schema (rasmiy, so'zma-so'z):
 *     `required: [orderId, operationState, operationType, orderNumber]`,
 *     ixtiyoriy: `cardType` (1=korporativ,2=shaxsiy), `merchantOperationId`,
 *     `rrn`. **AMOUNT/CURRENCY MAYDONI UMUMAN YO'Q** — bu taxmin emas,
 *     schema'ning required+properties ro'yxatida rasman shunday.
 *   - `CallbackOperationState` enum: rasman FAQAT `SUCCESS` | `FAIL`.
 *   - `PaymentOperationType` enum: rasman `AUTHORIZE | COMPLETE | REFUND |
 *     REVERSE | TOP_UP_COMPLETED` (ilgari uchinchi-tomon manbadan taxmin
 *     qilingan ro'yxat — ENDI so'zma-so'z rasmiy schema bilan mos keladi).
 *   - `AcquiringStatus` (buyurtma darajasidagi status, `getOrderStatus`)
 *     enum: rasman `REGISTERED | AUTHORIZED | TOP_UP_COMPLETED | COMPLETED |
 *     REFUNDED | REVERSED | DECLINED`.
 *   - `/api/v1/acquiring/refund`: sarlavhalar `X-Operation-Id` (majburiy,
 *     UUID, idempotentlik kaliti), `X-Terminal-Id` (majburiy, UUID),
 *     `X-API-Key` (spec'da `required:false`, lekin boshqa hamma endpoint
 *     kabi doim yuboriladi). Body (`RefundRequest`): `orderId` (majburiy),
 *     `amount` (majburiy, TIYIN — `RefundCommand`/`ReverseCommand`dagi
 *     "Amount to refund/reverse in tiyins" tavsifi bilan tasdiqlangan),
 *     `cart` (ixtiyoriy `FiscalizationCartRequest` — "Filled in only when
 *     autofiscalization is enabled"; SAFAAR'ning `register()`'i doim
 *     autofiskalizatsiya bilan ishlagani uchun bu yerda ham yuboriladi).
 *     Javob (`RefundResponse`): faqat `{operationId}` — muvaffaqiyat/summa
 *     tasdiqlanishi UCHUN `getOrderStatus`ning `refundedAmount` maydoni
 *     ishlatilishi kerak (javobning o'zida tasdiqlash yo'q).
 *   - Sandbox/test muhiti (alohida base URL, IP diapazoni, retry siyosati)
 *     haqida hamon HECH NARSA yo'q — spec'da `servers:` bo'limi umuman yo'q
 *     (bizning sandbox `baseUrl`imiz 2026-09-11 haqiqiy so'rovlar bilan
 *     amalda tasdiqlangan, spec orqali emas).
 *
 * Xulosa va NATIJA (signature bo'yicha qaror):
 *   - Callback signature sxemasi productionga HECH QACHON "kelib qolmaydi",
 *     chunki Uzum Checkout uni umuman TAQDIM ETMAYDI — shuning uchun
 *     `verifyCallback()` production'da (`UZUM_CHECKOUT_SIGNATURE_SCHEME`
 *     sozlanmagan holatda) HAR DOIM rad etadi va bu ATAYLAB O'ZGARTIRILMAYDI
 *     ("placeholder HMAC"ni productionga qabul qilish YO'Q). Amaliy natija:
 *     production hech qachon inbound callback orqali PAID holatiga
 *     o'TMAYDI — buning o'rniga `reconcileUzumCheckoutPayments()` (aynan
 *     shu klassning OUTBOUND, X-Terminal-Id/X-Api-Key bilan autentifikatsiya
 *     qilingan `getOrderStatus()` chaqiruviga tayanadigan) `@Cron` orqali
 *     PRODUCTIONdagi YAGONA ishonchli tasdiqlash yo'li bo'lib qoladi —
 *     bu HECH QANDAY yangi "signature o'rniga ishonch" xavfsizlik teshigi
 *     EMAS, aksincha: hech qanday tasdiqlanmagan tashqi POST body'siga
 *     ISHONILMAYDI, faqat BIZNING o'z autentifikatsiyalangan so'rovimizga.
 *   - Shu sababdan `normalizeCheckoutCallback()`ning `amountSom` maydoni
 *     (callback body'sida rasman YO'Q maydondan o'qilgani uchun) ENDI hech
 *     qachon `PaymentsService.uzumCheckoutCallback()` ichida PAID qarori
 *     uchun ISHONCHLI manba sifatida ishlatilmaydi — u yerda summasi
 *     har doim mustaqil `getOrderStatus()` orqali qayta tasdiqlanadi.
 *   - `operationType:operationState` -> ichki holat mapping'i (`STATE_MAP`)
 *     ENDI RASMIY schema bilan bir xil — lekin FAQAT eng ishonchli,
 *     bir ma'noli holatlar (AUTHORIZE/COMPLETE SUCCESS/FAIL) xaritalangan;
 *     REFUND/REVERSE/TOP_UP_COMPLETED ATAYLAB xaritalanmagan qoladi (pul
 *     CHIQISHI yoki mutlaqo boshqa mahsulotni PAID bilan aralashtirmaslik
 *     uchun) — bu qaror o'zgarmadi, faqat manba rasmiylashdi.
 *   - `register()`/`getOrderStatus()`/`getOperationState()` — 2026-09-11
 *     sandboxda HAQIQIY so'rovlar bilan (endi rasmiy schema bilan ham mos)
 *     tasdiqlangan. `refund()` ENDI HAM haqiqiy so'rov yuboradi (rasmiy
 *     `/api/v1/acquiring/refund` kontrakti bo'yicha) — sandboxda haqiqiy
 *     COMPLETED buyurtmaga nisbatan qisman+to'liq refund bilan tasdiqlangan
 *     (`docs/payments-uzum-checkout.md`, 2026-09-11 yozuvi).
 *
 * Barcha sirlar faqat env orqali (`UZUM_CHECKOUT_*`). Kodga hardcode YO'Q,
 * logga chiqarilmaydi.
 */

export const UZUM_CHECKOUT_ERROR = {
  /** Callback imzo sxemasi sozlanmagan (default) — fail-closed. */
  VERIFICATION_NOT_CONFIGURED: 'verification_not_configured',
  SIGNATURE_MISSING: 'signature_missing',
  SIGNATURE_INVALID: 'signature_invalid',
  MALFORMED_BODY: 'malformed_body',
  /** Chiquvchi (register/status/refund) — env sozlanmagan. */
  NOT_CONFIGURED: 'not_configured',
  /**
   * Env sozlangan, LEKIN rasmiy Uzum Checkout wire-format (endpoint yo'li,
   * auth sarlavhasi, so'rov/javob maydonlari) tasdiqlanmagan — taxminiy
   * so'rov yubormaymiz. Rasmiy spec kelgach shu guard olib tashlanadi.
   */
  SPEC_REQUIRED: 'spec_required',
  REGISTER_FAILED: 'register_failed',
  STATUS_FAILED: 'status_failed',
  REFUND_FAILED: 'refund_failed',
  /**
   * `UZUM_CHECKOUT_HTTPS_PROXY` sozlangan, LEKIN URL sifatida yaroqsiz —
   * `outboundDispatcher()` chaqirilganda throw qiladi. (Odatda `env.validation.ts`
   * buni ilova ishga tushishidayoq ushlaydi; bu — ikkinchi himoya qatlami.)
   */
  PROXY_MISCONFIGURED: 'proxy_misconfigured',
} as const;

export type UzumCheckoutErrorCode =
  (typeof UZUM_CHECKOUT_ERROR)[keyof typeof UZUM_CHECKOUT_ERROR];

export class UzumCheckoutError extends Error {
  constructor(
    public readonly code: UzumCheckoutErrorCode,
    message?: string,
  ) {
    super(message ?? `UZUM_CHECKOUT_${code}`);
    this.name = 'UzumCheckoutError';
  }
}

/**
 * SAFAAR ichki, normallashtirilgan callback shakli.
 * `state` — BIZNING ichki enum'imiz, Uzum'ning xom `operationState` qiymati
 * EMAS. Xom -> ichki mapping `STATE_MAP`da (`operationType:operationState`
 * kaliti bilan — pastdagi izohga qarang; manba ENDI RASMIY tasdiqlangan,
 * yuqoridagi fayl izohiga qarang).
 */
export interface NormalizedCheckoutCallback {
  /** Uzum tomonidagi to'lov/operatsiya identifikatori. */
  orderId: string;
  /** Bizning `bookings.booking_number`. */
  orderNumber: string;
  /** Bizning `payments.id` (register paytida yuborilgan). */
  merchantOperationId: string;
  /**
   * MUHIM: rasmiy `AcquiringCallbackData` schema'sida bu maydon UMUMAN
   * YO'Q (faqat `orderId`/`operationState`/`operationType`/`orderNumber`
   * majburiy, `cardType`/`merchantOperationId`/`rrn` ixtiyoriy — amount
   * yo'q). Shuning uchun bu qiymat FAQAT "kelsa" (kelajakda Uzum
   * qo'shsa yoki eski/testli payload'da bo'lsa) audit/debug uchun
   * o'qiladi — `PaymentsService.uzumCheckoutCallback()` PAID qarori uchun
   * BU MAYDONGA HECH QACHON ishonmaydi, har doim mustaqil `getOrderStatus()`
   * orqali qayta tasdiqlaydi. Topilmasa `NaN`.
   */
  amountSom: number;
  /** ISO valyuta kodi, katta harf. Sabab yuqoridagi `amountSom` bilan bir xil. */
  currency: string;
  /** ICHKI normallashtirilgan holat (Uzum'ning xom holati emas). */
  state: 'PAID' | 'FAILED' | 'PENDING' | 'UNKNOWN';
  /**
   * Rasmiy `PaymentOperationType` enum: `AUTHORIZE | COMPLETE | REFUND |
   * REVERSE | TOP_UP_COMPLETED` (tasdiqlangan — yuqoridagi fayl izohiga
   * qarang). Bu yerda hamon `string` (qattiq enum emas) — kelajakda Uzum
   * yangi qiymat qo'shsa runtime buzilmasligi uchun.
   */
  operationType?: string;
  /** Karta operatsiyasi retrieval reference number — faqat audit. */
  rrn?: string;
  /** Saqlangan karta/tokenizatsiya identifikatori — faqat audit (rasmiy callback schema'da yo'q, orqaga moslik uchun saqlangan). */
  bindingId?: string;
  /** Auditga saqlanadigan TO'LIQ xom payload — hech bir maydon tashlab yuborilmaydi. */
  raw: Record<string, unknown>;
}

/**
 * `operationType:operationState` (KATTA harf, ikkalasi ham) -> ICHKI holat.
 *
 * NEGA ikkita maydon birga (faqat `operationState` emas): `operationState`
 * yolg'iz o'zi ikkiyuzlamachi — `SUCCESS` bir xilda muvaffaqiyatli TO'LOV
 * (AUTHORIZE/COMPLETE) yoki muvaffaqiyatli QAYTARISH (REFUND/REVERSE)ni ham
 * anglatishi mumkin. Faqat `operationState`ga qarab xaritalasak, muvaffaqiyatli
 * REFUND callback'i xatolik bilan booking'ni "to'landi" deb belgilab qo'yishi
 * mumkin edi — bu jiddiy xato bo'lardi.
 *
 * Manba: `developer.uzumbank.uz` rasmiy OpenAPI schema (`en_checkout`/
 * `ru_checkout`, `AcquiringCallbackData`/`CallbackOperationState`/
 * `PaymentOperationType`) — 2026-09-11 to'g'ridan-to'g'ri tasdiqlangan
 * (yuqoridagi fayl izohiga qarang). Shu sabab bu yerda FAQAT eng
 * ishonchli, bir ma'noli holatlar xaritalangan:
 *   - AUTHORIZE:SUCCESS / COMPLETE:SUCCESS -> PAID (bir bosqichli to'lovda
 *     AUTHORIZE = pul yechish bilan bir vaqtda sodir bo'ladi, spec matniga
 *     ko'ra)
 *   - AUTHORIZE:FAIL / COMPLETE:FAIL -> FAILED
 * REFUND/REVERSE/TOP_UP_COMPLETED ATAYLAB YO'Q — pul CHIQISHI yoki mutlaqo
 * boshqa mahsulot (mobil balans to'ldirish) hodisalarini hech qachon PAID
 * bilan aralashtirmaslik uchun; ular `UNKNOWN` bo'lib qoladi (audit-only,
 * hech qanday holat o'zgarmaydi).
 */
export const STATE_MAP: Readonly<
  Record<string, NormalizedCheckoutCallback['state']>
> = Object.freeze({
  'AUTHORIZE:SUCCESS': 'PAID',
  'COMPLETE:SUCCESS': 'PAID',
  'AUTHORIZE:FAIL': 'FAILED',
  'COMPLETE:FAIL': 'FAILED',
});

/**
 * SAFAAR -> Uzum `/payment/register` uchun kirish (BIZNING domen maydonlarimiz).
 * Bu maydonlar SAFAAR tomonida — ular "taxmin" emas. Uzum tomondagi aniq
 * maydon nomlariga bog'lash `register()` ichida, rasmiy spec kelgach.
 */
export interface RegisterCheckoutInput {
  /** `bookings.id` — korrelyatsiya/return URL uchun. */
  bookingId: string;
  /** `bookings.booking_number` -> Uzum `orderNumber`. */
  orderNumber: string;
  /** `payments.id` -> Uzum `merchantOperationId`. */
  merchantOperationId: string;
  /** SAFAAR domen summasi (so'm, Decimal(18,2)). Uzum birligi spec'da. */
  amountSom: number;
  /** ISO valyuta kodi (`UZS`). */
  currency: string;
  /** To'lov muvaffaqiyatli tugagach foydalanuvchi qaytadigan URL. */
  successUrl: string;
  /** To'lov bekor/muvaffaqiyatsiz bo'lsa qaytadigan URL. */
  failureUrl: string;
}

export interface RegisterCheckoutResult {
  /** Uzum qaytargan buyurtma identifikatori -> `payments.provider_reference`. */
  orderId: string;
  /** Foydalanuvchi yo'naltiriladigan Uzum Checkout to'lov sahifasi URL'i. */
  paymentUrl: string;
  /** Xom javob (audit uchun). */
  raw: Record<string, unknown>;
}

export interface CheckoutOrderStatus {
  orderId: string;
  /** Uzum qaytargan xom holat qiymati (spec'siz — faqat log/audit uchun). */
  rawStatus: string;
  /** `STATE_MAP` orqali normallashtirilgan holat (spec yo'q -> `UNKNOWN`). */
  state: NormalizedCheckoutCallback['state'];
  amountSom: number | null;
  raw: Record<string, unknown>;
}

export interface RefundCheckoutInput {
  /** Uzum `orderId` (`payments.provider_reference`). */
  orderId: string;
  /** Qaytariladigan summa (so'm). To'liq refund uchun payment summasi. */
  amountSom: number;
  /** SAFAAR ichki refund sababi (audit uchun; secret emas). */
  reason?: string;
  /**
   * `X-Operation-Id` (rasmiy: majburiy, UUID, idempotentlik kaliti).
   * BERILMASA — har chaqiruvda yangi `randomUUID()` generatsiya qilinadi
   * (demak IKKITA chaqiruv, hatto bir xil `orderId`/`amountSom` bilan ham,
   * Uzum tomonida IKKITA MUSTAQIL operatsiya sifatida ko'rilishi mumkin).
   * Chaqiruvchi TOMONIDAN o'z retry/idempotentlik siyosatini ta'minlash
   * uchun BERILISHI TAVSIYA ETILADI (masalan `refunds.id`dan hosil qilingan
   * barqaror UUID) — bu qaror ATAYLAB shu klassdan tashqarida qoldirilgan.
   */
  operationId?: string;
  /**
   * `register()`da qanday `productId`/`title` bilan fiskal item yuborilgan
   * bo'lsa, refund cart'i ham SHUNGA moslashishi kerak bo'lishi mumkin
   * (Uzum buni talab qiladimi — sandboxda TASDIQLANMAGAN, chaqiruvchi
   * bergan bo'lsa ishlatiladi, bermasa yangi `randomUUID()` ishlatiladi).
   */
  originalProductId?: string;
}

export interface RefundCheckoutResult {
  orderId: string;
  /** Uzum qaytargan `operationId` (`RefundResponse.operationId`). */
  refundId: string | null;
  /**
   * Rasmiy `RefundResponse`da summa/holat TASDIQLASH YO'Q — shuning uchun
   * bu maydon doim `'REQUESTED'` (so'rov qabul qilindi, HTTP/errorCode
   * darajasida muvaffaqiyatli). Haqiqiy yakuniy holatni bilish uchun
   * chaqiruvchi keyinroq `getOrderStatus()`ning `refundedAmount`/`status`
   * (`REFUNDED`) maydonlarini TEKSHIRISHI SHART — bu metodning o'zi buni
   * qilmaydi (sinxron emas: Uzum operatsiyani asinxron qayta ishlaydi).
   */
  rawStatus: 'REQUESTED';
  raw: Record<string, unknown>;
}

function str(value: unknown): string {
  return value === undefined || value === null ? '' : String(value).trim();
}

/**
 * Xom Uzum Checkout callback -> `NormalizedCheckoutCallback`.
 *
 * Asosiy maydon nomlari (`orderId`/`orderNumber`/`merchantOperationId`/
 * `operationType`/`operationState`/`rrn`) ENDI rasmiy `AcquiringCallbackData`
 * schema bilan so'zma-so'z mos (2026-09-11, yuqoridagi fayl izohiga qarang).
 * Eski keng-tarqalgan aliaslar (`order_id`/`state`/`status`, ...) orqaga
 * moslik uchun hamon o'qiladi. `amount`/`total`/`sum`/... o'qishga urinish
 * SOF TARIXIY QOLDIQ — rasmiy schema'da bunday maydon YO'Q (yuqoridagi
 * `NormalizedCheckoutCallback.amountSom` izohiga qarang); shuning uchun
 * bu qiymat AMALIYOTDA deyarli har doim `NaN`/topilmagan bo'ladi va
 * chaqiruvchi (`PaymentsService.uzumCheckoutCallback()`) buni HECH QACHON
 * moliyaviy qaror uchun ishlatmaydi — o'qish shunchaki xavfsiz (hech narsani
 * buzmaydi) va kelajakda Uzum bu maydonni qo'shsa ham darhol ishlaydi.
 * Hech qanday undocumented maydon (partnerId, settlementAccount, ...)
 * o'qilmaydi/talab qilinmaydi.
 */
export function normalizeCheckoutCallback(
  raw: Record<string, unknown>,
): NormalizedCheckoutCallback {
  const amountRaw =
    raw.amount ??
    raw.total ??
    raw.sum ??
    raw.paymentAmount ??
    raw.payment_amount;
  const amountSom =
    amountRaw === undefined || amountRaw === null ? NaN : Number(amountRaw);

  // Rasmiy callback maydoni — `operationState`. Eski keng-tarqalgan
  // aliaslar (`state`/`status`) orqaga moslik uchun hamon o'qiladi.
  const rawOperationState = str(
    raw.operationState ?? raw.operation_state ?? raw.state ?? raw.status,
  ).toUpperCase();
  const rawOperationType = str(
    raw.operationType ?? raw.operation_type,
  ).toUpperCase();
  // `operationType` yo'q bo'lsa kalit hech qachon STATE_MAP'ga mos
  // kelmaydi (masalan `":SUCCESS"`) -> xavfsiz `UNKNOWN` default.
  const stateKey = `${rawOperationType}:${rawOperationState}`;

  return {
    orderId: str(
      raw.orderId ?? raw.order_id ?? raw.paymentId ?? raw.payment_id,
    ),
    orderNumber: str(
      raw.orderNumber ??
        raw.order_number ??
        raw.merchantOrderId ??
        raw.merchant_order_id,
    ),
    merchantOperationId: str(
      raw.merchantOperationId ??
        raw.merchant_operation_id ??
        raw.operationId ??
        raw.operation_id,
    ),
    amountSom,
    currency: str(raw.currency ?? 'UZS').toUpperCase() || 'UZS',
    state: STATE_MAP[stateKey] ?? 'UNKNOWN',
    operationType: optionalStr(raw.operationType ?? raw.operation_type),
    rrn: optionalStr(raw.rrn ?? raw.RRN),
    bindingId: optionalStr(raw.bindingId ?? raw.binding_id),
    raw,
  };
}

function optionalStr(value: unknown): string | undefined {
  const s = str(value);
  return s === '' ? undefined : s;
}

/**
 * Callback so'rov sarlavhalaridan FAQAT debug/audit uchun xavfsiz bo'lgan
 * kichik ro'yxatni ajratib oladi. Imzo sarlavhasi (`excludeHeaderNames`
 * orqali beriladi) va `authorization`/`cookie` HECH QACHON qaytarilmaydi —
 * bu himoya ikki marta ta'minlangan: (1) allowlist o'zi tor, (2) yana
 * qo'shimcha aniq istisno ro'yxati.
 */
const DEBUG_SAFE_HEADER_NAMES = [
  'content-type',
  'user-agent',
  'x-request-id',
  'x-forwarded-for',
  'x-real-ip',
] as const;
const ALWAYS_EXCLUDED_HEADER_NAMES = ['authorization', 'cookie'];

export function pickDebugHeaders(
  headers: HeaderMap,
  excludeHeaderNames: readonly string[] = [],
): Record<string, string> {
  const excluded = new Set(
    [...ALWAYS_EXCLUDED_HEADER_NAMES, ...excludeHeaderNames].map((n) =>
      n.toLowerCase(),
    ),
  );
  const picked: Record<string, string> = {};
  for (const name of DEBUG_SAFE_HEADER_NAMES) {
    if (excluded.has(name)) continue;
    const value = firstHeader(headers[name]);
    if (value) picked[name] = value;
  }
  return picked;
}

type HeaderMap = Record<string, string | string[] | undefined>;

/**
 * `http://user:parol@host:port` -> `http://***@host:port` (userinfo yashiriladi).
 * FAQAT debug/audit log uchun — proxy credential HECH QACHON to'liq log qilinmaydi.
 * Yaroqsiz URL bo'lsa `<invalid-proxy-url>` qaytaradi (xom qiymatni chiqarmaydi).
 */
export function redactProxyUrl(proxyUrl: string): string {
  try {
    const u = new URL(proxyUrl);
    if (u.username || u.password) {
      u.username = '***';
      u.password = '';
    }
    return u.toString();
  } catch {
    return '<invalid-proxy-url>';
  }
}

/**
 * Uzum Checkout CHIQUVCHI so'rovlari uchun undici `ProxyAgent` quradi.
 *
 * Bu — `fetch(url, { dispatcher })` uchun PER-REQUEST dispatcher. U
 * `setGlobalDispatcher()` CHAQIRMAYDI — shuning uchun jarayondagi boshqa
 * HECH BIR `fetch()` (SMS/email/CBU kurs/webhook/OAuth/...) ta'sirlanmaydi.
 * Faqat `UzumCheckoutProvider`ning chiquvchi metodlari uni ishlatadi.
 *
 * @throws {UzumCheckoutError} `PROXY_MISCONFIGURED` — `proxyUrl` yaroqsiz bo'lsa.
 */
export function buildUzumCheckoutProxyDispatcher(proxyUrl: string): ProxyAgent {
  let parsed: URL;
  try {
    parsed = new URL(proxyUrl);
  } catch {
    throw new UzumCheckoutError(
      UZUM_CHECKOUT_ERROR.PROXY_MISCONFIGURED,
      `UZUM_CHECKOUT_HTTPS_PROXY yaroqli URL emas: ${redactProxyUrl(proxyUrl)}`,
    );
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new UzumCheckoutError(
      UZUM_CHECKOUT_ERROR.PROXY_MISCONFIGURED,
      `UZUM_CHECKOUT_HTTPS_PROXY faqat http/https bo'lishi mumkin: ${parsed.protocol}`,
    );
  }
  // `token` — proxy'ga yuboriladigan `Proxy-Authorization` sarlavhasi
  // (userinfo'dan). undici URL userinfo'ni avtomatik olmaydi, shuning uchun
  // aniq beramiz. TLS (Uzum sertifikati) tekshiruvi DEFAULT — o'chirilmaydi.
  const token =
    parsed.username || parsed.password
      ? `Basic ${Buffer.from(
          `${decodeURIComponent(parsed.username)}:${decodeURIComponent(
            parsed.password,
          )}`,
        ).toString('base64')}`
      : undefined;
  const uri = `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
  return token ? new ProxyAgent({ uri, token }) : new ProxyAgent({ uri });
}

@Injectable()
export class UzumCheckoutProvider {
  private readonly logger = new Logger(UzumCheckoutProvider.name);
  private readonly baseUrl?: string;
  private readonly merchantId?: string;
  private readonly terminalId?: string;
  private readonly apiKey?: string;
  private readonly callbackSignKey?: string;
  private readonly signatureHeader: string;
  /** 'none' (default, fail-closed) | 'hmac-sha256' (joy-egallovchi sxema). */
  private readonly signatureScheme: string;
  /**
   * QA/test-only. `isTestModeEnabled()` orqali o'qiladi — u yerda
   * `NODE_ENV==='production'` bo'lsa BU MAYDONDAN QAT'I NAZAR har doim
   * `false` qaytariladi (ikkinchi himoya qatlami; birinchisi —
   * `env.validation.ts`'dagi qattiq throw, production'da ilova umuman
   * ishga tushmaydi).
   */
  private readonly testModeRaw: string;
  /**
   * IXTIYORIY chiquvchi forward-proxy URL (`UZUM_CHECKOUT_HTTPS_PROXY`).
   * Sozlangan bo'lsa — Uzum Checkout `register`/`getOrderStatus`/
   * `getOperationState`/`refund` so'rovlari SHU proxy orqali chiqadi
   * (statik chiquvchi IP kafolati uchun). Bo'sh bo'lsa — o'sha so'rovlar
   * ham odatdagi to'g'ridan-to'g'ri marshrut bilan boradi. Boshqa hech bir
   * `fetch()` ta'sirlanmaydi (`setGlobalDispatcher` ISHLATILMAYDI).
   */
  private readonly outboundProxyUrl?: string;
  /** Lazily qurilgan + keshlangan `ProxyAgent` (har chaqiruvda qayta emas). */
  private outboundDispatcherInstance?: Dispatcher;
  /**
   * `register()` fiskal `receiptParams` uchun — 2026-09-11 sandbox orqali
   * tasdiqlangan (`docs/payments-uzum-checkout.md`). BIZNES tomonidan
   * beriladi, kodda hardcode qilinmaydi. `vatPercent` ATAYLAB SANDBOX PROBE
   * sifatida belgilangan — production soliq siyosati sifatida QABUL
   * QILINMAYDI, faqat env orqali (haqiqiy stavka tasdiqlangach) o'zgaradi.
   */
  private readonly receiptSpic?: string;
  private readonly receiptPackageCode?: string;
  private readonly receiptVatPercent?: number;
  private readonly receiptTin?: string;
  private readonly receiptPinfl?: string;
  private readonly contentLanguage: string;

  constructor(config: ConfigService) {
    const baseUrl = (
      config.get<string>('UZUM_CHECKOUT_BASE_URL') || ''
    ).replace(/\/$/, '');
    this.baseUrl = baseUrl || undefined;
    this.merchantId =
      config.get<string>('UZUM_CHECKOUT_MERCHANT_ID') || undefined;
    this.terminalId =
      config.get<string>('UZUM_CHECKOUT_TERMINAL_ID') || undefined;
    this.apiKey = config.get<string>('UZUM_CHECKOUT_API_KEY') || undefined;
    this.callbackSignKey =
      config.get<string>('UZUM_CHECKOUT_CALLBACK_SIGN_KEY') || undefined;
    this.signatureHeader = (
      config.get<string>('UZUM_CHECKOUT_SIGNATURE_HEADER') || 'x-signature'
    )
      .trim()
      .toLowerCase();
    this.signatureScheme = (
      config.get<string>('UZUM_CHECKOUT_SIGNATURE_SCHEME') || 'none'
    )
      .trim()
      .toLowerCase();
    this.testModeRaw = (
      config.get<string>('UZUM_CHECKOUT_TEST_MODE') || 'false'
    )
      .trim()
      .toLowerCase();
    this.outboundProxyUrl =
      (config.get<string>('UZUM_CHECKOUT_HTTPS_PROXY') || '').trim() ||
      undefined;
    this.receiptSpic = config.get<string>('UZUM_CHECKOUT_SPIC') || undefined;
    this.receiptPackageCode =
      config.get<string>('UZUM_CHECKOUT_PACKAGE_CODE') || undefined;
    const vatPercentRaw = config.get<string>('UZUM_CHECKOUT_VAT_PERCENT');
    this.receiptVatPercent =
      vatPercentRaw && vatPercentRaw.trim() !== ''
        ? Number(vatPercentRaw)
        : undefined;
    this.receiptTin =
      config.get<string>('UZUM_CHECKOUT_RECEIPT_TIN') || undefined;
    this.receiptPinfl =
      config.get<string>('UZUM_CHECKOUT_RECEIPT_PINFL') || undefined;
    this.contentLanguage = (
      config.get<string>('UZUM_CHECKOUT_CONTENT_LANGUAGE') || 'uz-UZ'
    ).trim();
  }

  /**
   * `payment/register` (chiquvchi) uchun asosiy (auth) konfiguratsiya
   * to'liqmi. 2026-09-11 sandbox orqali tasdiqlangan: haqiqiy auth
   * sarlavhalari `X-Terminal-Id` + `X-Api-Key` (`merchantId` HECH QANDAY
   * tasdiqlangan so'rovda ishlatilmagan — shu sabab bu yerda talab
   * qilinmaydi, lekin maydon o'zi kelajakda kerak bo'lib qolishi mumkin
   * bo'lgani uchun saqlanadi).
   */
  isConfigured(): boolean {
    return Boolean(this.baseUrl && this.terminalId && this.apiKey);
  }

  /**
   * `register()` uchun fiskal (`receiptParams`) konfiguratsiya to'liqmi —
   * `SPIC` + `packageCode` + `vatPercent` + (TIN YOKI PINFL, ikkalasi
   * birga EMAS). 2026-09-11 sandbox orqali tasdiqlangan majburiy maydonlar
   * ro'yxati (`docs/payments-uzum-checkout.md`).
   */
  isFiscalConfigured(): boolean {
    // Aynan BITTASI kerak — XOR. Ikkalasi ham yo'q YOKI ikkalasi ham bor
    // (Uzum "ikkalasini birga berish mumkin emas" deb rad etadi) —
    // ikkala holatda ham "sozlanmagan" deb hisoblaymiz.
    const hasIdentity = Boolean(this.receiptTin) !== Boolean(this.receiptPinfl);
    return Boolean(
      this.receiptSpic &&
      this.receiptPackageCode &&
      this.receiptVatPercent !== undefined &&
      Number.isFinite(this.receiptVatPercent) &&
      hasIdentity,
    );
  }

  /** Chiquvchi Uzum Checkout so'rovlari uchun forward-proxy sozlanganmi. */
  isOutboundProxyConfigured(): boolean {
    return Boolean(this.outboundProxyUrl);
  }

  /**
   * Sozlangan chiquvchi proxy URL'i — userinfo (credential) YASHIRILGAN
   * holda (faqat debug/audit log uchun). Sozlanmagan bo'lsa `undefined`.
   */
  outboundProxyUrlForLog(): string | undefined {
    return this.outboundProxyUrl
      ? redactProxyUrl(this.outboundProxyUrl)
      : undefined;
  }

  /**
   * Uzum Checkout CHIQUVCHI `fetch()` uchun per-request `dispatcher`.
   *
   *   fetch(url, { dispatcher: this.outboundDispatcher(), signal: ... })
   *
   *  - `UZUM_CHECKOUT_HTTPS_PROXY` BO'SH  -> `undefined` qaytaradi; `fetch`
   *    odatdagi (to'g'ridan-to'g'ri) marshrutdan foydalanadi.
   *  - Sozlangan bo'lsa -> keshlangan `ProxyAgent` (birinchi chaqiruvda
   *    quriladi). Bu dispatcher FAQAT shu yerdan uzatiladi — global
   *    `fetch` xatti-harakati (SMS/email/kurs/webhook/OAuth/...) o'zgarmaydi.
   *
   * @throws {UzumCheckoutError} `PROXY_MISCONFIGURED` — URL yaroqsiz bo'lsa.
   */
  outboundDispatcher(): Dispatcher | undefined {
    if (!this.outboundProxyUrl) return undefined;
    if (!this.outboundDispatcherInstance) {
      this.outboundDispatcherInstance = buildUzumCheckoutProxyDispatcher(
        this.outboundProxyUrl,
      );
    }
    return this.outboundDispatcherInstance;
  }

  /** Callback imzo tekshiruvi ishga tushirilishi mumkinmi. */
  isCallbackVerificationConfigured(): boolean {
    return Boolean(this.callbackSignKey) && this.signatureScheme !== 'none';
  }

  /**
   * QA/test-only signature-bypass yoqilganmi. `NODE_ENV==='production'`
   * bo'lsa har doim `false` — `UZUM_CHECKOUT_TEST_MODE` qiymatidan qat'i
   * nazar (birinchi himoya qatlami — `env.validation.ts`'dagi qattiq throw
   * — allaqachon buni production'da ilova ishga tushmasligi bilan
   * ta'minlaydi; bu YERDAGI tekshiruv shunga QARAMASDAN mustaqil ikkinchi
   * qatlam).
   */
  isTestModeEnabled(): boolean {
    if (process.env.NODE_ENV === 'production') {
      return false;
    }
    return this.testModeRaw === 'true';
  }

  /**
   * Sozlangan imzo sarlavhasi nomi (masalan `x-signature`). Faqat audit/debug
   * log'lardan uni chetlab o'tish uchun ochilgan — hech qanday sir qaytarmaydi.
   */
  signatureHeaderName(): string {
    return this.signatureHeader;
  }

  /**
   * Imzo uchun kanonik matn. JOY-EGALLOVCHI: Uzum'ning haqiqiy kanonizatsiyasi
   * (xom baytlar, maydon konkatenatsiyasi, ...) MA'LUM EMAS. Spec kelganda
   * FAQAT shu metod + header nomi + sxema o'zgaradi.
   */
  canonicalPayload(body: Record<string, unknown>): string {
    return stableStringify(body);
  }

  /**
   * Callback imzosini FAIL-CLOSED tekshiradi.
   *  - sxema sozlanmagan (default) => throw (endpoint xavfsiz "deny-all"),
   *    FAQAT `isTestModeEnabled()` bo'lsa BUNDAN MUSTASNO (QA-only, pastga
   *    qarang — production'da bu yo'l HECH QACHON tanlanmaydi).
   *  - imzo yo'q / noto'g'ri => throw (test mode bunga TA'SIR QILMAYDI —
   *    haqiqiy sxema sozlangan bo'lsa u har doim TO'LIQ ishlaydi).
   *  - hech qachon "o'tdi" deb qaytmaydi, imzo mos kelmasa.
   * Secret / imzo / Authorization LOG QILINMAYDI.
   */
  verifyCallback(body: Record<string, unknown>, headers: HeaderMap): void {
    if (!this.isCallbackVerificationConfigured()) {
      if (this.isTestModeEnabled()) {
        // QA-only: haqiqiy Uzum imzo sxemasi hali sozlanmagan (rasmiy spec
        // yo'q), shuning uchun QA integratsion testlarini bloklamaslik
        // uchun signature bosqichi shu yerda o'tkazib yuboriladi. Boshqa
        // HECH QANDAY himoya (order lookup/amount/currency/idempotency/
        // terminal-holat) bilan ALOQASI YO'Q — ular chaqiruvchida
        // (`PaymentsService.uzumCheckoutCallback`) o'zgarishsiz ishlayveradi.
        return;
      }
      throw new UzumCheckoutError(
        UZUM_CHECKOUT_ERROR.VERIFICATION_NOT_CONFIGURED,
        'Uzum Checkout callback imzo sxemasi sozlanmagan — rasmiy spec ' +
          'kelmaguncha callback fail-closed rad etiladi',
      );
    }
    const provided = firstHeader(headers[this.signatureHeader]);
    if (!provided) {
      throw new UzumCheckoutError(UZUM_CHECKOUT_ERROR.SIGNATURE_MISSING);
    }

    if (this.signatureScheme === 'hmac-sha256') {
      // JOY-EGALLOVCHI sxema — Uzum'ning haqiqiy algoritmi tasdiqlanmagan.
      const expected = hmacSha256(
        this.canonicalPayload(body),
        this.callbackSignKey as string,
      );
      if (!timingSafeEqualString(provided, expected)) {
        throw new UzumCheckoutError(UZUM_CHECKOUT_ERROR.SIGNATURE_INVALID);
      }
      return;
    }

    // Noma'lum sxema nomi — fail-closed.
    throw new UzumCheckoutError(
      UZUM_CHECKOUT_ERROR.VERIFICATION_NOT_CONFIGURED,
      `noma'lum imzo sxemasi: ${this.signatureScheme}`,
    );
  }

  // ==========================================================================
  //  CHIQUVCHI (outbound) — `register` / `getOrderStatus` / `getOperationState`
  //  2026-09-11 SANDBOXDA HAQIQIY so'rovlar bilan TASDIQLANGAN wire-format
  //  (to'liq dalil/tarix: `docs/payments-uzum-checkout.md`). Faqat `refund()`
  //  hamon FAIL-CLOSED qoladi — haqiqiy refund hech qachon sinalmagan
  //  (real pul qaytarish — xato narxi yuqori, ataylab keyinga qoldirilgan).
  //
  //  STATIK CHIQUVCHI IP: agar `UZUM_CHECKOUT_HTTPS_PROXY` sozlangan bo'lsa,
  //  har bir `fetch()` chaqiruvi `dispatcher: this.outboundDispatcher()` bilan
  //  amalga oshirilishi SHART — shunda so'rov safaar-gateway'dagi forward
  //  proxy orqali chiqadi (Yandex Cloud statik IP). Boshqa hech qanday
  //  `fetch()` (bu klassdan tashqarida) o'zgartirilmaydi; `setGlobalDispatcher`
  //  ISHLATILMAYDI. `outboundDispatcher()` proxy sozlanmagan bo'lsa `undefined`
  //  qaytaradi va `fetch` odatdagi marshrutga tushadi.
  // ==========================================================================

  /** Uzum'ning ISO-4217 RAQAMLI valyuta kodlari (sandbox orqali tasdiqlangan). */
  private static readonly CURRENCY_NUMERIC: Readonly<Record<string, number>> =
    Object.freeze({ UZS: 860, USD: 840, EUR: 978, RUB: 643 });

  /**
   * `getOrderStatus`ning `status` maydoni -> ichki holat.
   *
   * Rasmiy `AcquiringStatus` enum (2026-09-11 tasdiqlangan, yuqoridagi fayl
   * izohiga qarang): `REGISTERED | AUTHORIZED | TOP_UP_COMPLETED |
   * COMPLETED | REFUNDED | REVERSED | DECLINED`. Bu yerda FAQAT bir ma'noli
   * xaritalanadigan uchtasi bor:
   *   - `REGISTERED` -> `PENDING` (sandboxda bevosita kuzatilgan);
   *   - `COMPLETED` -> `PAID` (sandboxda bevosita kuzatilgan, real UzCard
   *     +3DS to'lovi orqali);
   *   - `DECLINED` -> `FAILED` (rasmiy enum qiymati — bank/protsessing
   *     rad etgan holat, `PAID` bilan aralashtirib bo'lmaydigan yagona
   *     ma'noli xaritalash).
   * `AUTHORIZED` (ikki bosqichli to'lovning oraliq holati — SAFAAR
   * `ONE_STEP` ishlatadi, shuning uchun amalda kutilmaydi), `REFUNDED`/
   * `REVERSED` (pul CHIQISHI — PAID bilan aralashtirib bo'lmaydi, alohida
   * refund-reconciliation mantig'i kerak, hali qo'shilmagan) va
   * `TOP_UP_COMPLETED` (butunlay boshqa mahsulot — mobil balans) ATAYLAB
   * xaritalanmagan, `UNKNOWN`ga tushadi (audit-only, hech narsa o'zgarmaydi).
   */
  private static readonly ORDER_STATUS_MAP: Readonly<
    Record<string, NormalizedCheckoutCallback['state']>
  > = Object.freeze({
    REGISTERED: 'PENDING',
    COMPLETED: 'PAID',
    DECLINED: 'FAILED',
  });

  /**
   * Chiquvchi metod nima uchun bloklanganini bildiruvchi xato — asosiy
   * (auth) YOKI fiskal konfiguratsiya to'liq bo'lmasa.
   */
  private outboundBlocker(): UzumCheckoutError {
    if (!this.isConfigured()) {
      return new UzumCheckoutError(
        UZUM_CHECKOUT_ERROR.NOT_CONFIGURED,
        'Uzum Checkout chiquvchi integratsiyasi sozlanmagan ' +
          '(UZUM_CHECKOUT_BASE_URL / UZUM_CHECKOUT_TERMINAL_ID / UZUM_CHECKOUT_API_KEY)',
      );
    }
    return new UzumCheckoutError(
      UZUM_CHECKOUT_ERROR.NOT_CONFIGURED,
      'Uzum Checkout fiskal (receiptParams) konfiguratsiyasi to‘liq emas ' +
        '(UZUM_CHECKOUT_SPIC / UZUM_CHECKOUT_PACKAGE_CODE / ' +
        'UZUM_CHECKOUT_VAT_PERCENT / UZUM_CHECKOUT_RECEIPT_TIN yoki ' +
        'UZUM_CHECKOUT_RECEIPT_PINFL — aynan bittasi)',
    );
  }

  private outboundHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Content-Language': this.contentLanguage,
      'X-Terminal-Id': this.terminalId as string,
      'X-Api-Key': this.apiKey as string,
    };
  }

  /** Uzum javobini `{errorCode, message, result}` shaklida parse qiladi. */
  private async parseUzumResponse(
    res: Response,
    failureCode: UzumCheckoutErrorCode,
    methodLabel: string,
  ): Promise<Record<string, unknown>> {
    const json = (await res.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    const errorCode =
      json && typeof json.errorCode === 'number' ? json.errorCode : undefined;
    if (!res.ok || errorCode !== 0 || !json?.result) {
      // Xom javob (`message`/`result`) LOG QILINMAYDI — faqat http/errorCode.
      this.logger.warn(
        `uzum-checkout ${methodLabel} muvaffaqiyatsiz: http=${res.status} errorCode=${errorCode ?? 'n/a'}`,
      );
      throw new UzumCheckoutError(
        failureCode,
        `Uzum ${methodLabel}: HTTP ${res.status}, errorCode=${errorCode ?? 'n/a'}`,
      );
    }
    return json;
  }

  /**
   * `POST {baseUrl}/api/v1/payment/register` — SAFAAR to'lovini Uzum
   * Checkout'da ro'yxatga oladi, `orderId` + to'lov sahifasi URL'ini
   * qaytaradi. Wire-format 2026-09-11 sandboxda haqiqiy so'rovlar bilan
   * tasdiqlangan (`docs/payments-uzum-checkout.md`). `amount` — TIYIN
   * (checkout sahifasida "1 000 so'm" ko'rinishi orqali mustaqil
   * tasdiqlangan). Fiskal `receiptParams` (SPIC/packageCode/vatPercent/
   * TIN-yoki-PINFL) — `UZUM_CHECKOUT_*` orqali, BIZNES beradi, bu yerda
   * hardcode YO'Q.
   */
  async register(
    input: RegisterCheckoutInput,
  ): Promise<RegisterCheckoutResult> {
    if (!this.isConfigured() || !this.isFiscalConfigured()) {
      throw this.outboundBlocker();
    }
    const currencyNumeric =
      UzumCheckoutProvider.CURRENCY_NUMERIC[input.currency.toUpperCase()];
    if (!currencyNumeric) {
      throw new UzumCheckoutError(
        UZUM_CHECKOUT_ERROR.REGISTER_FAILED,
        `qo'llab-quvvatlanmaydigan valyuta: ${input.currency}`,
      );
    }
    const amountTiyin = Math.round(input.amountSom * 100);

    const receiptParams: Record<string, unknown> = {
      spic: this.receiptSpic,
      packageCode: this.receiptPackageCode,
      vatPercent: this.receiptVatPercent,
    };
    if (this.receiptTin) receiptParams.TIN = this.receiptTin;
    else if (this.receiptPinfl) receiptParams.PINFL = this.receiptPinfl;

    const body = {
      orderNumber: input.orderNumber,
      clientId: randomUUID(),
      currency: currencyNumeric,
      amount: amountTiyin,
      paymentDetails: `SAFAAR booking ${input.orderNumber}`,
      sessionTimeoutSecs: 1800,
      viewType: 'REDIRECT',
      successUrl: input.successUrl,
      failureUrl: input.failureUrl,
      paymentParams: { payType: 'ONE_STEP', force3ds: true },
      merchantParams: {
        cart: {
          cartId: randomUUID(),
          receiptType: 'PURCHASE',
          total: amountTiyin,
          items: [
            {
              title: 'SAFAAR xizmat',
              // ATAYLAB `randomUUID()` EMAS — `input.merchantOperationId`
              // (`payments.id`, SAFAAR'da allaqachon saqlangan). SABAB:
              // 2026-09-11 sandboxda haqiqiy refund testi (`docs/payments-
              // uzum-checkout.md`) shuni ko'rsatdi — Uzum refund cart
              // item'ini ORIGINAL purchase receipt bilan `productId`
              // orqali solishtiradi (`errorCode 3046
              // NOT_FOUND_IN_PURCHASE_RECEIPT`, agar mos kelmasa). Agar
              // bu yerda tasodifiy UUID ishlatilsa, keyinroq HECH QANDAY
              // refund shu buyurtma uchun muvaffaqiyatli bo'la olmasdi
              // (qiymat qayerdadur saqlanmagani uchun). `payments.id`
              // ishlatish esa uni DETERMINISTIK qiladi — `refund()`
              // chaqiruvchisi `originalProductId: payment.id` bilan
              // AYNAN SHU qiymatni qayta hosil qila oladi, yangi ustun/
              // migratsiya SHART EMAS.
              productId: input.merchantOperationId,
              quantity: 1,
              unitPrice: amountTiyin,
              total: amountTiyin,
              receiptParams,
            },
          ],
        },
      },
    };

    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/api/v1/payment/register`, {
        method: 'POST',
        signal: AbortSignal.timeout(15_000),
        // STATIK CHIQUVCHI IP: proxy sozlangan bo'lsa so'rov safaar-gateway
        // orqali chiqadi; sozlanmagan bo'lsa `undefined` -> to'g'ridan-to'g'ri.
        dispatcher: this.outboundDispatcher(),
        headers: this.outboundHeaders(),
        body: JSON.stringify(body),
      } as RequestInit);
    } catch (err) {
      this.logger.warn(
        `uzum-checkout register tarmoq xatosi: ${(err as Error).message}`,
      );
      throw new UzumCheckoutError(
        UZUM_CHECKOUT_ERROR.REGISTER_FAILED,
        "tarmoq xatosi (Uzum'ga ulanib bo'lmadi)",
      );
    }

    const json = await this.parseUzumResponse(
      res,
      UZUM_CHECKOUT_ERROR.REGISTER_FAILED,
      'register',
    );
    const result = json.result as Record<string, unknown>;
    const orderId = str(result.orderId);
    const paymentUrl = str(result.paymentRedirectUrl ?? result.paymentUrl);
    if (!orderId || !paymentUrl) {
      throw new UzumCheckoutError(
        UZUM_CHECKOUT_ERROR.REGISTER_FAILED,
        "Uzum javobida orderId/paymentRedirectUrl yo'q",
      );
    }
    return { orderId, paymentUrl, raw: json };
  }

  /**
   * `POST {baseUrl}/api/v1/payment/getOrderStatus` — buyurtma holatini
   * so'raydi (rekonsiliatsiya uchun). Xom `status` `ORDER_STATUS_MAP`
   * orqali normallashtiriladi; faqat sandboxda kuzatilgan qiymatlar
   * xaritalangan — boshqa hech qanday qiymat hech qachon PAID qilmaydi.
   */
  async getOrderStatus(orderId: string): Promise<CheckoutOrderStatus> {
    if (!this.isConfigured()) throw this.outboundBlocker();

    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/api/v1/payment/getOrderStatus`, {
        method: 'POST',
        signal: AbortSignal.timeout(15_000),
        dispatcher: this.outboundDispatcher(),
        headers: this.outboundHeaders(),
        body: JSON.stringify({ orderId }),
      } as RequestInit);
    } catch (err) {
      this.logger.warn(
        `uzum-checkout getOrderStatus tarmoq xatosi: ${(err as Error).message}`,
      );
      throw new UzumCheckoutError(
        UZUM_CHECKOUT_ERROR.STATUS_FAILED,
        "tarmoq xatosi (Uzum'ga ulanib bo'lmadi)",
      );
    }

    const json = await this.parseUzumResponse(
      res,
      UZUM_CHECKOUT_ERROR.STATUS_FAILED,
      'getOrderStatus',
    );
    const result = json.result as Record<string, unknown>;
    const rawStatus = str(result.status);
    const completedAmountTiyin = Number(result.completedAmount ?? 0);
    return {
      orderId: str(result.orderId) || orderId,
      rawStatus,
      state:
        UzumCheckoutProvider.ORDER_STATUS_MAP[rawStatus.toUpperCase()] ??
        'UNKNOWN',
      amountSom:
        Number.isFinite(completedAmountTiyin) && completedAmountTiyin > 0
          ? completedAmountTiyin / 100
          : null,
      raw: json,
    };
  }

  /**
   * `POST {baseUrl}/api/v1/payment/getOperationState` — alohida operatsiya
   * holati. `operationId` MAJBURIY (sandboxda tasdiqlangan — `orderId`
   * yolg'iz yetarli emas, "Field required" xatosi qaytaradi).
   */
  async getOperationState(
    orderId: string,
    operationId: string,
  ): Promise<CheckoutOrderStatus> {
    if (!this.isConfigured()) throw this.outboundBlocker();
    if (!operationId) {
      throw new UzumCheckoutError(
        UZUM_CHECKOUT_ERROR.STATUS_FAILED,
        "operationId shart (Uzum tomonidan talab qilinadi, orderId yolg'iz yetarli emas)",
      );
    }

    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/api/v1/payment/getOperationState`, {
        method: 'POST',
        signal: AbortSignal.timeout(15_000),
        dispatcher: this.outboundDispatcher(),
        headers: this.outboundHeaders(),
        body: JSON.stringify({ orderId, operationId }),
      } as RequestInit);
    } catch (err) {
      this.logger.warn(
        `uzum-checkout getOperationState tarmoq xatosi: ${(err as Error).message}`,
      );
      throw new UzumCheckoutError(
        UZUM_CHECKOUT_ERROR.STATUS_FAILED,
        "tarmoq xatosi (Uzum'ga ulanib bo'lmadi)",
      );
    }

    const json = await this.parseUzumResponse(
      res,
      UZUM_CHECKOUT_ERROR.STATUS_FAILED,
      'getOperationState',
    );
    const result = json.result as Record<string, unknown>;
    const operation = (result.operation ?? {}) as Record<string, unknown>;
    const rawOperationType = str(operation.operationType).toUpperCase();
    const rawState = str(operation.state).toUpperCase();
    const stateKey = `${rawOperationType}:${rawState}`;
    return {
      orderId,
      rawStatus: rawState,
      // `state`/`operationType` maydonlari callback'dagi
      // `operationState`/`operationType` bilan bir xil ma'noda — shu sabab
      // AYNAN shu `STATE_MAP`ning o'zi qayta ishlatiladi (ikkinchi mustaqil
      // xaritalash YO'Q).
      state: STATE_MAP[stateKey] ?? 'UNKNOWN',
      amountSom: null, // getOperationState javobida summa YO'Q (tasdiqlangan)
      raw: json,
    };
  }

  /**
   * `POST {baseUrl}/api/v1/acquiring/refund` — to'lovni (qisman/to'liq)
   * qaytarish. Rasmiy kontrakt: "Full or partial refund of payment. This
   * method can only be used after the transaction has changed to
   * 'COMPLETED' status." SAFAAR refund modulidan (admin tasdig'idan keyin)
   * chaqirilishi kerak — bu metodning o'zi HECH QACHON avtomatik/
   * o'z-o'zidan refund yubormaydi va HECH QANDAY SAFAAR business-flow'ga
   * (`admin.service.ts`ning `refundApprove()`) hali ULANMAGAN — u ATAYLAB
   * tashqi provayder so'rovisiz qoladi (mavjud dizayn, bu commit doirasidan
   * tashqarida). 2026-09-11 sandboxda haqiqiy COMPLETED buyurtmaga nisbatan
   * qisman VA to'liq refund bilan tasdiqlangan (`docs/payments-uzum-checkout.md`).
   *
   * `amount` — TIYIN (rasmiy `RefundCommand`/`ReverseCommand` tavsifi:
   * "Amount to refund/reverse in tiyins"). `cart` — FAQAT fiskal
   * konfiguratsiya bor bo'lsa yuboriladi (autofiskalizatsiya bilan
   * ro'yxatga olingan to'lovlar uchun rasmiy talab: "Filled in only when
   * autofiscalization is enabled").
   */
  async refund(input: RefundCheckoutInput): Promise<RefundCheckoutResult> {
    if (!this.isConfigured()) throw this.outboundBlocker();
    if (!Number.isFinite(input.amountSom) || input.amountSom <= 0) {
      throw new UzumCheckoutError(
        UZUM_CHECKOUT_ERROR.REFUND_FAILED,
        'refund amountSom musbat, chekli son bo‘lishi kerak',
      );
    }
    const amountTiyin = Math.round(input.amountSom * 100);

    const body: Record<string, unknown> = {
      orderId: input.orderId,
      amount: amountTiyin,
    };
    // Faqat fiskal konfiguratsiya TO'LIQ bo'lsa cart qo'shiladi — SAFAAR
    // `register()`i doim autofiskalizatsiya bilan ishlagani uchun bu
    // amalda har doim ishlaydi (fiskal env sozlanmagan bo'lsa ham refund
    // o'zi bloklanmaydi: `cart`siz refund ham rasmiy spec bo'yicha
    // ruxsat etilgan — "filled in ONLY when autofiscalization is enabled").
    if (this.isFiscalConfigured()) {
      // `cart.total` — 2026-09-11 sandboxda HAQIQIY qisman VA to'liq refund
      // bilan tasdiqlangan: bu QISMAN summasi (`amount`) EMAS, balki
      // buyurtmaning ORIGINAL/completed to'liq summasi (Uzum'ning o'zi
      // qaytargan `completedAmount`) — bir necha qisman refund bo'lsa ham
      // DOIM shu qiymat, qolgan balans (`totalAmount`) EMAS. Buni taxmin
      // qilish O'RNIGA har doim `getOrderStatus()` orqali mustaqil
      // so'raladi (chaqiruvchi bermasa ham to'g'ri ishlashi uchun).
      // Xato bo'lgan qiymat bilan Uzum aniq `errorCode 3059
      // "The cart total is incorrect"` qaytaradi (sinovda tasdiqlangan).
      const orderStatus = await this.getOrderStatus(input.orderId);
      const rawResult = orderStatus.raw.result as
        | Record<string, unknown>
        | undefined;
      const completedAmountTiyin = Number(rawResult?.completedAmount ?? 0);
      if (!Number.isFinite(completedAmountTiyin) || completedAmountTiyin <= 0) {
        throw new UzumCheckoutError(
          UZUM_CHECKOUT_ERROR.REFUND_FAILED,
          'cart.total uchun original completedAmount aniqlanmadi (getOrderStatus)',
        );
      }

      // `productId` — ATAYLAB `randomUUID()` EMAS: sinovda tasdiqlangan,
      // Uzum bu qiymatni ORIGINAL purchase receipt bilan solishtiradi
      // (`errorCode 3046 NOT_FOUND_IN_PURCHASE_RECEIPT`, mos kelmasa).
      // Chaqiruvchi bermasa ATAYLAB throw qilinadi (taxminiy productId
      // yubormaslik uchun) — `register()`da ishlatilgan
      // `merchantOperationId` bilan bir xil qiymat berilishi kerak.
      if (!input.originalProductId) {
        throw new UzumCheckoutError(
          UZUM_CHECKOUT_ERROR.REFUND_FAILED,
          'originalProductId shart (register()da ishlatilgan ' +
            "merchantOperationId bilan bir xil bo'lishi kerak) — fiskal " +
            'konfiguratsiya yoqilganda taxminiy productId yuborilmaydi',
        );
      }

      const receiptParams: Record<string, unknown> = {
        spic: this.receiptSpic,
        packageCode: this.receiptPackageCode,
        vatPercent: this.receiptVatPercent,
      };
      if (this.receiptTin) receiptParams.TIN = this.receiptTin;
      else if (this.receiptPinfl) receiptParams.PINFL = this.receiptPinfl;

      body.cart = {
        total: completedAmountTiyin,
        items: [
          {
            productId: input.originalProductId,
            quantity: 1,
            receiptParams,
          },
        ],
      };
    }

    const headers = {
      'Content-Type': 'application/json',
      'X-Operation-Id': input.operationId ?? randomUUID(),
      'X-Terminal-Id': this.terminalId as string,
      'X-Api-Key': this.apiKey as string,
    };

    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/api/v1/acquiring/refund`, {
        method: 'POST',
        signal: AbortSignal.timeout(15_000),
        dispatcher: this.outboundDispatcher(),
        headers,
        body: JSON.stringify(body),
      } as RequestInit);
    } catch (err) {
      this.logger.warn(
        `uzum-checkout refund tarmoq xatosi: ${(err as Error).message}`,
      );
      throw new UzumCheckoutError(
        UZUM_CHECKOUT_ERROR.REFUND_FAILED,
        "tarmoq xatosi (Uzum'ga ulanib bo'lmadi)",
      );
    }

    const json = await this.parseUzumResponse(
      res,
      UZUM_CHECKOUT_ERROR.REFUND_FAILED,
      'refund',
    );
    const result = json.result as Record<string, unknown>;
    const refundId = str(result.operationId) || null;
    return {
      orderId: input.orderId,
      refundId,
      rawStatus: 'REQUESTED',
      raw: json,
    };
  }
}

function firstHeader(value: string | string[] | undefined): string | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  return v && v.trim() ? v.trim() : undefined;
}

/** Kalitlar bo'yicha tartiblangan, deterministik JSON (imzo kanonizatsiyasi uchun). */
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, entry]) => `${JSON.stringify(k)}:${stableStringify(entry)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}
