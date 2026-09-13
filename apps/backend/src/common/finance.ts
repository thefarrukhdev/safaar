import { calculateUzumCheckoutCommission } from '../payments/providers/uzum-checkout-commission';

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
  /** Biznes kelishuv bo'yicha doim 1.5% (`UZUM_CHECKOUT_COMMISSION_RATE`). */
  uzumFeeRatePercent: number;
  uzumFeeAmountSom: number;
  /**
   * gross − SAFAAR komissiya − Uzum fee. MUHIM: bu FAQAT REFERENCE/hisobot
   * uchun — hamkorga HAQIQATAN to'lanadigan summa (`bookings.partner_payable`,
   * `partner_ledger_entries`) BU QIYMATGA TENGLASHTIRILMAGAN, chunki Uzum
   * 1.5%ni kim (SAFAAR yoki hamkor) haqiqatan ko'tarishi TASDIQLANMAGAN
   * (`UZUM_CHECKOUT_SETTLEMENT_MODEL`ga qarang). Shu sabab `partnerNetAmountSom`
   * — "agar Uzum fee hamkordan ushlab qolinsa, taxminan shuncha qolar edi"
   * degan ILLUSTRATIV raqam, HALI HAQIQIY moliyaviy yozuv EMAS.
   */
  partnerNetAmountSom: number;
}

/**
 * SAFAAR komissiyasi + Uzum Checkout 1.5% to'lov haqini bitta joyda
 * hisoblab, to'liq taqsimotni qaytaradi (gross → SAFAAR komissiya → Uzum
 * fee → hamkor net). Mavjud, alohida tasdiqlangan ikkita hisoblagichni
 * (`calculateCommission` — SAFAAR, `calculateUzumCheckoutCommission` —
 * Uzum) QAYTA ISHLATADI, formulani takrorlamaydi.
 *
 * MUHIM (2026-09-13 audit): bu funksiya FAQAT hisobot/ko'rsatish uchun —
 * `partnerNetAmountSom`ni `bookings.partner_payable`ga YOZMAYDI/ALMASHTIRMAYDI.
 * Hozirgi haqiqiy `partner_payable` hisob-kitobi (`bookings.service.ts`,
 * `partners.service.ts`) FAQAT SAFAAR komissiyasini ayiradi — Uzum fee
 * hamkordan ushlab qolinishi HALI TASDIQLANMAGAN (yuqoridagi izohga
 * qarang), shuning uchun bu ATAYLAB o'zgartirilmagan.
 */
export function calculatePaymentBreakdown(
  input: PaymentBreakdownInput,
): PaymentBreakdown {
  const safaarCommissionAmountSom = calculateCommission(
    input.grossAmountSom,
    input.safaarCommissionRatePercent,
  );
  const uzum = calculateUzumCheckoutCommission(input.grossAmountSom);

  return {
    grossAmountSom: input.grossAmountSom,
    safaarCommissionRatePercent: input.safaarCommissionRatePercent,
    safaarCommissionAmountSom,
    uzumFeeRatePercent: uzum.commissionRate * 100,
    uzumFeeAmountSom: uzum.commissionAmountSom,
    partnerNetAmountSom:
      input.grossAmountSom -
      safaarCommissionAmountSom -
      uzum.commissionAmountSom,
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
