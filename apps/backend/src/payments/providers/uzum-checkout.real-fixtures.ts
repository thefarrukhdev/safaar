/**
 * Uzum Checkout REAL callback fixture'lari.
 *
 * MUHIM — MANBA VA ISHONCH DARAJASI (2026-09-11 YANGILANDI):
 * Quyidagi shakl ENDI Uzum'ning O'Z RASMIY portalidan (`developer.uzumbank.uz`)
 * TO'G'RIDAN-TO'G'RI tasdiqlangan. Portal sahifasining o'zi client-side JS
 * render qiladi (oddiy HTML fetch bo'sh keladi), LEKIN uni render qiluvchi
 * `main.<hash>.js` bundle to'liq OpenAPI JSON sxemasini (RU+EN, "Uzum
 * Checkout") string literal sifatida o'z ichida olib yuradi — bu bundle
 * oddiy `curl`/fetch bilan (auth'siz) to'liq o'qib olinadi va undan
 * `AcquiringCallbackData`/`CallbackOperationState`/`PaymentOperationType`
 * so'zma-so'z chiqarib olindi (avval UCHINCHI TOMON — `github.com/vsevalid/
 * uzum-payments` — orqali TAXMIN qilingan bir xil shakl, endi rasmiy manba
 * bilan mustaqil TASDIQLANDI, batafsili: `uzum-checkout.provider.ts` fayl
 * boshidagi izoh).
 *
 * Callback yo'nalishi uchun rasmiy OpenAPI `callbacks:` blokida (aynan shu
 * `acquiring_merchant_callback` operatsiyasining o'zida) HECH QANDAY
 * sarlavha/imzo talabi YO'Q — bu ENDI "topilmadi" emas, "rasmiy schema
 * bo'yicha talab qilinmasligi TASDIQLANDI" degani. Shu sababdan production'da
 * signature tekshiruvi hamon FAIL-CLOSED qoladi (Uzum umuman signature
 * taklif qilmagani uchun — "placeholder" emas, chunki qabul qiladigan
 * HAQIQIY sxema yo'q); bu fayl esa PARSER/QA-mode fixture'lari uchun.
 *
 * Schema (`AcquiringCallbackData`, majburiy: orderId, operationState,
 * operationType, orderNumber):
 *   orderId              string  — Uzum tomonidagi buyurtma identifikatori
 *   operationState        enum   — FAQAT "SUCCESS" | "FAIL"
 *   operationType          enum   — "AUTHORIZE" | "COMPLETE" | "REFUND" |
 *                                   "REVERSE" | "TOP_UP_COMPLETED"
 *   orderNumber           string  — merchant tomonidagi buyurtma identifikatori
 *   merchantOperationId?  string  — merchant tomonidagi operatsiya ID (ixtiyoriy)
 *   rrn?                  string  — bank operatsiyasining noyob identifikatori
 *   bindingId?             string  — saqlangan karta bog'lanishi identifikatori
 * AMOUNT/CURRENCY YO'Q — bu spec bo'yicha callback'ning o'zida yo'q, faqat
 * `/payment/getOrderStatus` javobida bor (va u yerda "minimal birlikda",
 * ya'ni tiyin).
 */

/** Bir bosqichli (one-step) to'lov muvaffaqiyatli o'tdi — real shakl bo'yicha. */
export const REAL_UZUM_CHECKOUT_SUCCESS_FIXTURE: Record<string, unknown> = {
  orderId: 'b6f1c2a4-3e1a-4c2b-9f0d-7a2e5c9d1234',
  operationState: 'SUCCESS',
  operationType: 'AUTHORIZE',
  orderNumber: 'UZB-QAFIXTURE01',
  merchantOperationId: 'payment-qa-fixture-01',
  rrn: '123456789012',
};

/** Bir bosqichli to'lov muvaffaqiyatsiz (declined) — real shakl bo'yicha. */
export const REAL_UZUM_CHECKOUT_FAIL_FIXTURE: Record<string, unknown> = {
  orderId: 'c7a2d3b5-4f2b-5d3c-a01e-8b3f6d0e2345',
  operationState: 'FAIL',
  operationType: 'AUTHORIZE',
  orderNumber: 'UZB-QAFIXTURE02',
  merchantOperationId: 'payment-qa-fixture-02',
};

/**
 * Muvaffaqiyatli REFUND — ATAYLAB "PAID" bilan aralashtirilmaydi (pul
 * CHIQISHI). `STATE_MAP`da yo'q, shuning uchun `state` doim `UNKNOWN` bo'lib
 * qoladi va hech qanday payment/booking holati o'zgarmaydi.
 */
export const REAL_UZUM_CHECKOUT_REFUND_FIXTURE: Record<string, unknown> = {
  orderId: 'd8b3e4c6-5a3c-6e4d-b12f-9c4a7e1f3456',
  operationState: 'SUCCESS',
  operationType: 'REFUND',
  orderNumber: 'UZB-QAFIXTURE03',
  merchantOperationId: 'payment-qa-fixture-03',
};

/** Ikki bosqichli to'lovning tasdiqlash (COMPLETE) bosqichi muvaffaqiyatli. */
export const REAL_UZUM_CHECKOUT_COMPLETE_SUCCESS_FIXTURE: Record<
  string,
  unknown
> = {
  orderId: 'e9c4f5d7-6b4d-7f5e-c23a-0d5b8f2a4567',
  operationState: 'SUCCESS',
  operationType: 'COMPLETE',
  orderNumber: 'UZB-QAFIXTURE04',
  merchantOperationId: 'payment-qa-fixture-04',
  bindingId: 'binding-qa-fixture-04',
};
