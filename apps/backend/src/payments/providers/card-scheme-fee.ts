/**
 * Karta turi (Humo/Uzcard/Visa/Mastercard) bo'yicha foydalanuvchi to'lov
 * haqi (fee) — SAFAAR mahsulot talabi bo'yicha (2026-09-16 tasdiqlangan).
 *
 * Bu to'rttala "to'lov usuli" (`PaymentMethod` enum'idagi `humo`/`uzcard`/
 * `visa`/`mastercard`) BITTA texnik yo'l — Uzum Checkout (`provider =
 * 'uzum_checkout'`) — orqali ishlaydi (qarang `payments.service.ts`
 * `createUzumCheckoutPayment()`); bu fayl faqat FOYDALANUVCHIGA qaysi
 * qiymat qo'shimcha yozilishi (fee) kerakligini hisoblaydi, checkout
 * so'rovining o'zini QURMAYDI.
 *
 * MUHIM — bu `uzum-checkout-commission.ts`dagi `UZUM_CHECKOUT_COMMISSION_RATE`
 * (1.5%, flat) bilan ATAYLAB ALOHIDA modul:
 *   - o'sha fayl "Uzum'ning o'zi qancha undiradi (hali tasdiqlanmagan bank
 *     settlement)" degan OCHIQ savolni hujjatlashtiradi;
 *   - bu fayl esa SAFAAR mahsulot jamoasi tomonidan ANIQ TASDIQLANGAN,
 *     karta turiga qarab FARQLANGAN foydalanuvchi-fee jadvalini ifodalaydi
 *     (Humo/Uzcard = 1.5%, Visa/Mastercard = 3.5% — xalqaro sxemalar
 *     odatda yuqoriroq processing xarajatiga ega).
 *   Ikkalasi HAM "fee'ni USER to'laydi" degan bir xil biznes qarorga mos
 *   (`UZUM_CHECKOUT_FEE_BEARER === 'USER'`), lekin bir-birining o'rnini
 *   bosmaydi — ataylab ikkita mustaqil fayl, chalkash "bitta stavkani
 *   ikkinchisiga moslash" xatosidan qochish uchun.
 *
 * KIM TO'LAYDI: foydalanuvchi/mijoz — na hamkor (`partner_payable`), na
 * SAFAAR (`commission_amount`) bu summani ko'tarmaydi/undan ayirmaydi.
 * Hamkor to'lovi (`bookings.partner_payable`) FAQAT bron gross summasi va
 * SAFAAR komissiyasidan hisoblanadi (`common/finance.ts`) — bu modul unga
 * HECH QANDAY ta'sir qilmaydi.
 */

export type CardScheme = 'humo' | 'uzcard' | 'visa' | 'mastercard';

/** Mahsulot talabi (2026-09-16): Humo/Uzcard = 1.5%, Visa/Mastercard = 3.5%. */
export const CARD_SCHEME_FEE_RATES: Readonly<Record<CardScheme, number>> =
  Object.freeze({
    humo: 0.015,
    uzcard: 0.015,
    visa: 0.035,
    mastercard: 0.035,
  });

/** Fee'ni kim to'laydi — USER (mahsulot talabi bilan bir xil, tasdiqlangan). */
export const CARD_SCHEME_FEE_BEARER = 'USER' as const;

const CARD_SCHEMES = Object.keys(CARD_SCHEME_FEE_RATES) as CardScheme[];

export function isCardScheme(value: unknown): value is CardScheme {
  return (
    typeof value === 'string' &&
    (CARD_SCHEMES as string[]).includes(value)
  );
}

export interface CardSchemeFeeBreakdown {
  scheme: CardScheme;
  /** Bron/booking gross summasi (so'm) — fee qo'shilmagan, o'zgarmaydi. */
  baseAmountSom: number;
  /** Qo'llanilgan stavka (masalan 0.015 = 1.5%). */
  feeRate: number;
  /** base × rate, tiyin darajasida yaxlitlangan (so'm). Foydalanuvchi to'laydi. */
  feeAmountSom: number;
  /** base + fee (so'm) — foydalanuvchi HAQIQATDA to'laydigan, Uzum Checkout
   *  `/payment/register`ga yuboriladigan yakuniy summa. */
  totalPayableAmountSom: number;
}

/**
 * Berilgan karta turi uchun gross summadan fee taqsimotini hisoblaydi.
 *
 * `uzum-checkout-commission.ts::calculateUzumCheckoutCommission()` bilan
 * BIR XIL yaxlitlash konventsiyasi (butun TIYIN arifmetikasi, `Math.round`
 * — "round half away from zero") — ICHKI izchillik uchun, suzuvchi nuqta
 * xatosiga (`0.1 + 0.2 !== 0.3`) yo'l qo'ymaslik uchun.
 *
 * @throws {RangeError} `baseAmountSom` chekli musbat son bo'lmasa.
 */
export function calculateCardSchemeFee(
  baseAmountSom: number | string,
  scheme: CardScheme,
): CardSchemeFeeBreakdown {
  const base = Number(baseAmountSom);
  if (!Number.isFinite(base) || base <= 0) {
    throw new RangeError(
      `calculateCardSchemeFee: baseAmountSom musbat, chekli son bo'lishi ` +
        `kerak (olindi: ${JSON.stringify(baseAmountSom)})`,
    );
  }

  const rate = CARD_SCHEME_FEE_RATES[scheme];
  const baseTiyin = Math.round(base * 100);
  // Stavkani ham butun sonlarda ushlaymiz (150 = 1.5% bazis nuqtasi/10000,
  // 350 = 3.5%) — `base * rate` to'g'ridan-to'g'ri ko'paytirilsa suzuvchi
  // nuqta xatosi yig'ilib qolishi mumkin edi.
  const rateBasisPoints = Math.round(rate * 10_000);
  const feeTiyin = Math.round((baseTiyin * rateBasisPoints) / 10_000);
  const totalTiyin = baseTiyin + feeTiyin;

  return {
    scheme,
    baseAmountSom: baseTiyin / 100,
    feeRate: rate,
    feeAmountSom: feeTiyin / 100,
    totalPayableAmountSom: totalTiyin / 100,
  };
}
