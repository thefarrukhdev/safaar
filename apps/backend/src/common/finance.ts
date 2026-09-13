import {
  calculateUzumCheckoutCommission,
  UZUM_CHECKOUT_FEE_BEARER,
} from '../payments/providers/uzum-checkout-commission';

/**
 * Komissiya hisob-kitobi butun backend uchun bitta joyda — avval har bir
 * bron yaratish yo'li (mehmonxona/avtobus mijoz oqimi, hamkor walk-in
 * bron) o'zining qattiq yozilgan 12% ulushini ishlatardi, admin panelda
 * hamkor uchun sozlangan `default_commission_rate` esa hech qayerda
 * o'qilmasdi. Endi hammasi shu funksiya orqali, tashkilotning haqiqiy
 * stavkasi bilan hisoblanadi.
 */
export const DEFAULT_COMMISSION_RATE_PERCENT = 12;

export function calculateCommission(
  subtotal: number,
  ratePercent: number | string | null | undefined,
): number {
  const rate = normalizeCommissionRate(ratePercent);
  return Math.round(subtotal * (rate / 100));
}

export function normalizeCommissionRate(
  ratePercent: number | string | null | undefined,
): number {
  const value = Number(ratePercent);
  if (!Number.isFinite(value) || value < 0) {
    return DEFAULT_COMMISSION_RATE_PERCENT;
  }
  return value;
}

/**
 * ─────────────────────────────────────────────────────────────────────
 * SAFAAR HUDUD/TUR ASOSIDAGI KOMISSIYA JADVALI — BUSINESS SOURCE OF TRUTH
 * ─────────────────────────────────────────────────────────────────────
 * 2026-09-13, biznes tomonidan berilgan Excel jadvalidan SO'ZMA-SO'Z
 * ko'chirilgan (foizlar O'ZGARTIRILMAGAN, TAXMIN QILINMAGAN):
 *
 *              4-5 yulduz   Mehmonxona   Guest House   Hostel
 *  Samarqand      12%          10%           8%          7%
 *  Toshkent       14%          12%           8%          8%
 *  Boshqa         10%          10%           8%          7%
 *
 * Bu jadval FAQAT quyidagi `PartnerOrganizationType` qiymatlari uchun
 * amal qiladi: `hotel` (yulduziga qarab 4-5-star YOKI oddiy "Mehmonxona"
 * qatoriga tushadi), `guesthouse`, `hostel`. BOSHQA HAR QANDAY tur
 * (`motel`, `dacha`, `sanatorium`, `resort`, `restaurant`, `mixed`,
 * `bus`) — Excel'da UMUMAN ko'rsatilmagan, shuning uchun bu yerda
 * TAXMIN QILINMAYDI: `resolveAccommodationCommissionRate()` bunday
 * turlar uchun `matched: false` qaytaradi, chaqiruvchi mavjud
 * `partner_organizations.default_commission_rate` (yoki
 * `DEFAULT_COMMISSION_RATE_PERCENT`) mexanizmiga qaytishi SHART.
 *
 * Hudud — `cities.slug` bo'yicha (lokalizatsiya qilingan `name` JSON
 * emas — slug barqaror, ASCII, mavjud konvensiyaga mos). FAQAT
 * `tashkent` va `samarqand` slug'lari alohida qatorga ega; boshqa
 * BARCHA shahar/viloyat (yoki noma'lum/bo'sh slug) "Boshqa" qatoriga
 * tushadi — bu ATAYLAB xavfsiz fallback (Excel "BOSHQA BARCHA VILOYAT
 * VA SHAHARLAR" deb aniq belgilagan).
 *
 * Ustuvorlik (2026-09-13 aniqlashtirildi, biznes tomonidan tasdiqlangan):
 * Excel jadvali HAR DOIM USTUN — hatto shu hamkor
 * `default_commission_rate`da boshqacha (masalan qo'lda o'zgartirilgan)
 * qiymat sozlangan bo'lsa ham. `hotel`/`hostel`/`guesthouse` uchun
 * `default_commission_rate` UMUMAN o'qilmaydi/ishlatilmaydi.
 */
export type SafaarCommissionRegionTier = 'tashkent' | 'samarqand' | 'other';
export type SafaarCommissionPropertyTier =
  | 'star_4_5'
  | 'hotel'
  | 'guesthouse'
  | 'hostel';

const SAFAAR_ACCOMMODATION_COMMISSION_TABLE: Readonly<
  Record<
    SafaarCommissionRegionTier,
    Readonly<Record<SafaarCommissionPropertyTier, number>>
  >
> = Object.freeze({
  samarqand: Object.freeze({
    star_4_5: 12,
    hotel: 10,
    guesthouse: 8,
    hostel: 7,
  }),
  tashkent: Object.freeze({
    star_4_5: 14,
    hotel: 12,
    guesthouse: 8,
    hostel: 8,
  }),
  other: Object.freeze({
    star_4_5: 10,
    hotel: 10,
    guesthouse: 8,
    hostel: 7,
  }),
});

/** `stars >= 4` bo'lgan mehmonxona "4-5 yulduz" qatoriga tushadi (Excel bo'yicha). */
const STAR_4_5_MIN_STARS = 4;

export interface AccommodationCommissionInput {
  /** `cities.slug` — `null`/bo'sh bo'lsa "Boshqa" qatoriga tushadi. */
  citySlug: string | null | undefined;
  /** `partner_organizations.type` (Prisma `PartnerOrganizationType` enum qiymati). */
  partnerOrganizationType: string | null | undefined;
  /** `hotels.stars` — faqat `partnerOrganizationType==='hotel'` bo'lsa ishlatiladi. */
  stars: number | null | undefined;
}

export interface AccommodationCommissionResolution {
  /** `true` — Excel jadvali shu turni qamrab oladi, `ratePercent` ishonchli. */
  matched: boolean;
  /** `matched===true` bo'lsagina mazmunli; aks holda `null`. */
  ratePercent: number | null;
  regionTier: SafaarCommissionRegionTier;
  /** `matched===false` bo'lsa `null` (tur Excel'da yo'q). */
  propertyTier: SafaarCommissionPropertyTier | null;
}

/**
 * Excel jadvali bo'yicha SAFAAR komissiya stavkasini aniqlaydi.
 *
 * `matched: false` qaytarsa — chaqiruvchi HECH QANDAY stavkani
 * TAXMIN QILMASLIGI, aksincha mavjud `default_commission_rate` /
 * `DEFAULT_COMMISSION_RATE_PERCENT` fallback'iga murojaat qilishi SHART
 * (`motel`/`dacha`/`sanatorium`/`resort`/`restaurant`/`mixed`/`bus` va
 * boshqa Excel'da yo'q turlar uchun).
 */
export interface PaymentBreakdownInput {
  /** Bron/to'lovning to'liq (chegirmadan keyingi) summasi, so'm. */
  grossAmountSom: number;
  /** SAFAAR komissiya foizi (masalan `resolveAccommodationCommissionRate()`
   * yoki `partner_organizations.default_commission_rate`dan). */
  safaarCommissionRatePercent: number;
}

export interface PaymentBreakdown {
  grossAmountSom: number;
  safaarCommissionRatePercent: number;
  safaarCommissionAmountSom: number;
  /**
   * Biznes kelishuv bo'yicha doim 1.5% (`UZUM_CHECKOUT_COMMISSION_RATE`).
   * 2026-09-13 TASDIQLANGAN: bu fee'ni MIJOZ/USER to'laydi
   * (`UZUM_CHECKOUT_FEE_BEARER === 'USER'`) — na hamkor, na SAFAAR. Shu
   * sabab bu ikkita maydon FAQAT INFORMATIV/hisobot uchun: `partnerNetAmountSom`
   * hisoblashda ISHTIROK ETMAYDI (pastga qarang).
   */
  uzumUserFeeRatePercent: number;
  uzumUserFeeAmountSom: number;
  /**
   * gross − SAFAAR komissiya (Uzum fee AYIRILMAYDI — uni mijoz alohida
   * to'laydi, `UZUM_CHECKOUT_FEE_BEARER`ga qarang, 2026-09-13 biznes
   * tomonidan tasdiqlangan). Bu qiymat `bookings.partner_payable`/
   * `partner_ledger_entries`dagi HAQIQIY hisob-kitobga MOS KELADI (ikkalasi
   * ham faqat SAFAAR komissiyasini ayiradi) — endi ILLUSTRATIV emas, REAL
   * arxitektura bilan IZCHIL.
   */
  partnerNetAmountSom: number;
  /**
   * gross + Uzum user fee (so'm) — "mijoz KONSEPTUAL jihatdan jami qancha
   * to'laydi" (2026-09-13 tasdiqlangan misol: 400,000 + 6,000 = 406,000).
   *
   * ⚠️ MUHIM: bu Uzum'ning `/payment/register` so'roviga yuboriladigan
   * `amount` EMAS (u hamon FAQAT `grossAmountSom` — `payments.service.ts`
   * o'zgartirilmagan). Uzum bu 1.5%ni texnik jihatdan checkout paytida
   * QANDAY undirishi (SDK/UI ustama, boshqa mexanizm) rasmiy contract'dan
   * TASDIQLANMAGAN — shu sabab bu maydon HECH QANDAY tashqi so'rovga
   * avtomatik ulanmaydi, FAQAT SAFAAR ICHKI hisobot/ko'rsatish uchun.
   */
  customerTotalAmountSom: number;
}

/**
 * SAFAAR komissiyasi + Uzum Checkout 1.5% to'lov haqini bitta joyda
 * hisoblab, to'liq taqsimotni qaytaradi: gross → SAFAAR komissiya →
 * hamkor net (Uzum fee bu ikkalasiga TA'SIR QILMAYDI — mijoz to'laydi,
 * pastga qarang). Mavjud, alohida tasdiqlangan ikkita hisoblagichni
 * (`calculateCommission` — SAFAAR, `calculateUzumCheckoutCommission` —
 * Uzum) QAYTA ISHLATADI, formulani takrorlamaydi.
 *
 * MUHIM (2026-09-13, biznes tomonidan TASDIQLANGAN — `UZUM_CHECKOUT_FEE_BEARER`):
 * Uzum 1.5% komissiyasini MIJOZ/USER to'g'ridan-to'g'ri to'laydi — na
 * hamkor (`partner_payable`), na SAFAAR (`commission_amount`). Shu sabab:
 *   - `partnerNetAmountSom = gross − safaarCommissionAmountSom` (Uzum fee
 *     YO'Q formulaning bu qismida) — bu haqiqiy `bookings.partner_payable`
 *     hisob-kitobiga (`bookings.service.ts`, `partners.service.ts`) MOS.
 *   - `uzumUserFeeRatePercent`/`uzumUserFeeAmountSom` FAQAT informativ —
 *     "mijoz Uzum checkout'da yana shuncha to'laydi" degan REFERENCE raqam.
 *   - `customerTotalAmountSom = gross + uzumUserFeeAmountSom` — "mijoz
 *     KONSEPTUAL jami qancha to'laydi" degan ALOHIDA biznes tushuncha
 *     (2026-09-13 tasdiqlangan). Bu Uzum'ning register so'roviga
 *     yuboriladigan `amount` EMAS — o'sha hamon FAQAT gross
 *     (`payments.service.ts::createUzumCheckoutPayment`, o'zgartirilmagan).
 * Bu — KIM TO'LAYDI (biznes) savoliga javob; Uzum bilan SAFAAR o'rtasidagi
 * bank SETTLEMENT texnik mexanizmi (`UZUM_CHECKOUT_SETTLEMENT_MODEL`) ESA
 * ALOHIDA, hali ochiq savol — bu funksiya u haqida HECH NARSA TAXMIN QILMAYDI.
 */
export function calculatePaymentBreakdown(
  input: PaymentBreakdownInput,
): PaymentBreakdown {
  const safaarCommissionAmountSom = calculateCommission(
    input.grossAmountSom,
    input.safaarCommissionRatePercent,
  );
  const uzum = calculateUzumCheckoutCommission(input.grossAmountSom);

  if (UZUM_CHECKOUT_FEE_BEARER !== 'USER') {
    // Bu funksiya faqat "USER to'laydi" modeli uchun yozilgan (2026-09-13
    // tasdiqlangan). Agar bu konstanta kelajakda o'zgarsa, formula qayta
    // ko'rib chiqilmaguncha noto'g'ri natija berish o'rniga aniq xato beradi.
    throw new Error(
      `calculatePaymentBreakdown: UZUM_CHECKOUT_FEE_BEARER="${UZUM_CHECKOUT_FEE_BEARER}" uchun formula tasdiqlanmagan`,
    );
  }

  return {
    grossAmountSom: input.grossAmountSom,
    safaarCommissionRatePercent: input.safaarCommissionRatePercent,
    safaarCommissionAmountSom,
    uzumUserFeeRatePercent: uzum.commissionRate * 100,
    uzumUserFeeAmountSom: uzum.commissionAmountSom,
    partnerNetAmountSom: input.grossAmountSom - safaarCommissionAmountSom,
    customerTotalAmountSom: uzum.customerTotalAmountSom,
  };
}

export function resolveAccommodationCommissionRate(
  input: AccommodationCommissionInput,
): AccommodationCommissionResolution {
  const regionTier: SafaarCommissionRegionTier =
    input.citySlug === 'tashkent'
      ? 'tashkent'
      : input.citySlug === 'samarqand'
        ? 'samarqand'
        : 'other';

  let propertyTier: SafaarCommissionPropertyTier | null;
  switch (input.partnerOrganizationType) {
    case 'hotel': {
      const stars = Number(input.stars);
      propertyTier =
        Number.isFinite(stars) && stars >= STAR_4_5_MIN_STARS
          ? 'star_4_5'
          : 'hotel';
      break;
    }
    case 'guesthouse':
      propertyTier = 'guesthouse';
      break;
    case 'hostel':
      propertyTier = 'hostel';
      break;
    default:
      // motel/dacha/sanatorium/resort/restaurant/mixed/bus/noma'lum —
      // Excel'da YO'Q, taxmin qilinmaydi.
      propertyTier = null;
  }

  if (propertyTier === null) {
    return {
      matched: false,
      ratePercent: null,
      regionTier,
      propertyTier: null,
    };
  }

  return {
    matched: true,
    ratePercent:
      SAFAAR_ACCOMMODATION_COMMISSION_TABLE[regionTier][propertyTier],
    regionTier,
    propertyTier,
  };
}
