/**
 * Uzum Checkout — 1.5% komissiya hisob-kitobi (SAFAAR ICHKI accounting).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * MUHIM — BU FAYL HECH QANDAY UZUM API MAYDONI EMAS
 * ─────────────────────────────────────────────────────────────────────────────
 * 1.5% stavka — SAFAAR va Uzum o'rtasidagi BIZNES kelishuvi (bu koddan
 * TASDIQLANMAGAN, tashqaridan berilgan fakt sifatida qabul qilingan).
 *
 * Uzum Checkout'ning bizga MA'LUM (uchinchi-tomon, rasmiy tasdiqlanmagan)
 * OpenAPI sxemasida (`checkout_openapi.yaml`, qarang
 * `uzum-checkout.real-fixtures.ts`) HECH QANDAY commission/fee/merchant_fee
 * maydoni yo'q — na `AcquiringCallbackData`da (callback), na registratsiya
 * so'rovi field nomlari haqidagi mavjud izohlarda. Shuning uchun bu modul
 * Uzum API'ga HECH NARSA YUBORMAYDI — faqat SAFAAR'ning o'z hisobotlari
 * (admin/export/moliya) uchun GROSS/KOMISSIYA/NET ni hisoblab beradi.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * KIM TO'LAYDI (BIZNES, TASDIQLANGAN) vs QANDAY SETTLEMENT BO'LADI (TEXNIK, OCHIQ)
 * ─────────────────────────────────────────────────────────────────────────────
 * Bu ikkita savol MUSTAQIL, bir-biriga bog'liq EMAS:
 *
 *  (A) KIM IQTISODIY JIHATDAN KO'TARADI — 2026-09-13, biznes tomonidan
 *      TASDIQLANGAN: `UZUM_CHECKOUT_FEE_BEARER = 'USER'`. Uzum Checkout 1.5%
 *      komissiyasini TO'G'RIDAN-TO'G'RI MIJOZ/USER to'laydi — na hamkor
 *      (`partner_payable`dan AYRILMAYDI), na SAFAAR (`commission_amount`ga
 *      TA'SIR QILMAYDI). Shu sabab `partner_ledger_entries`/`bookings.partner_payable`
 *      FAQAT SAFAAR komissiyasini ayiradi — bu ALLAQACHON to'g'ri (o'zgarishsiz).
 *
 *  (B) UZUM QANDAY TEXNIK SETTLEMENT QILADI — HALI TASDIQLANMAGAN, taxmin
 *      qilinmaydi. (A) bandi "kim to'laydi"ga javob bersa-da, bu SAFAAR'ning
 *      Uzum bilan bo'lgan BANK hisob-kitobiga (necha pul kelishi kerakligiga)
 *      to'g'ridan-to'g'ri javob bermaydi — masalan, mijoz checkout paytida
 *      qo'shimcha 1.5% ustama sifatida alohida to'lashi mumkin (bu holda
 *      SAFAAR'ning bank hisobiga booking summasi TO'LIQ keladi, Uzum fee
 *      hech qachon SAFAAR pulini "kesib" o'tmaydi), YOKI Uzum o'z ichki
 *      protsessingida boshqacha yo'l tutishi mumkin. `UZUM_CHECKOUT_SETTLEMENT_MODEL`
 *      FAQAT shu (B) texnik savolni ifodalaydi — (A) band bilan
 *      ARALASHTIRILMASLIGI SHART:
 *   1. SETTLEMENT MEXANIZMI: Uzum 1.5%ni settlement'dan AVTOMATIK ushlab
 *     qoladimi (SAFAAR faqat NET oladi), yoki to'liq GROSS'ni o'tkazib,
 *     alohida invoice/hisob-faktura bilan komissiyani so'raydimi? Bu ikkala
 *     holat ham buxgalteriya yozuvlarida TUBDAN farq qiladi (birinchisida
 *     bank ko'chirmasi allaqachon NET keladi; ikkinchisida GROSS keladi va
 *     komissiya ALOHIDA chiqim sifatida yoziladi). Rasmiy Uzum Checkout
 *     shartnomasi/spec'i BIZDA YO'Q — shuning uchun bu modul faqat
 *     REFERENCE/hisobot uchun uchala raqamni (gross/commission/net) alohida
 *     qaytaradi, lekin qaysi banki ko'chirma qaysi raqamga mos kelishini
 *     TAXMIN QILMAYDI. `UZUM_CHECKOUT_SETTLEMENT_MODEL` shu holatni belgilaydi.
 *  2. REFUND'DAGI KOMISSIYA: to'lov qaytarilganda Uzum o'zining 1.5%ni ham
 *     qaytaradimi yoki ushlab qoladimi — NOMA'LUM. `calculateUzumCheckoutCommission`
 *     refund summasiga ham qo'llanilishi mumkin (bir xil formula), lekin bu
 *     FAQAT SAFAAR'ning "agar simmetrik bo'lsa" degan ICHKI taxminiy hisobi —
 *     Uzum'ning haqiqiy siyosati tasdiqlanmaguncha moliyaviy qaror sifatida
 *     ishlatilmasligi kerak. MUHIM: (A) band tufayli bu — hatto tasdiqlansa
 *     ham — hamkor ledgeriga HECH QACHON tegmaydi (fee hamkordan olinmagan,
 *     demak qaytarishda ham hamkorga tegishli emas).
 *  3. YAXLITLASH QOIDASI: Uzum o'z tomonida komissiyani qanday yaxlitlaydi
 *     (round-half-up / banker's rounding / kesish) — NOMA'LUM. Bu yerda
 *     SAFAAR'ning boshqa joylaridagi mavjud konventsiya (`UzumProvider.toTiyin()`
 *     — `Math.round`, ya'ni "round half away from zero") ATAYLAB qayta
 *     ishlatilgan — ICHKI IZCHILLIK uchun, Uzum'ning haqiqiy yaxlitlashi
 *     sifatida EMAS.
 *  4. MIJOZGA KO'RSATISH/UNDIRISH OQIMI: (A) band bo'yicha USER to'laydi
 *     degan biznes qaror TASDIQLANGAN, lekin buning TEXNIK amalga oshirilishi
 *     (checkout summasiga alohida ustama sifatida qo'shiladimi, yoki boshqa
 *     mexanizm bilanmi) — Uzum'ning rasmiy checkout/registratsiya
 *     contract'idan TASDIQLANMAGUNCHA taxmin qilinmaydi. Bu fayl HECH QANDAY
 *     customer-facing (checkout so'rovi) summani o'zgartirmaydi/oshirmaydi.
 *
 * Rasmiy Uzum Checkout shartnomasi/spec'i kelganda: shu fayldagi
 * `UZUM_CHECKOUT_SETTLEMENT_MODEL` va yaxlitlash qoidasi bank ko'chirmalari
 * bilan solishtirib TASDIQLANISHI SHART.
 */

/** Biznes kelishuv bo'yicha: Uzum Checkout komissiyasi = gross summaning 1.5%i. */
export const UZUM_CHECKOUT_COMMISSION_RATE = 0.015;

/**
 * KIM IQTISODIY JIHATDAN 1.5% Uzum Checkout komissiyasini KO'TARADI —
 * 2026-09-13, BIZNES TOMONIDAN TASDIQLANGAN (taxmin EMAS): mijoz/user
 * to'g'ridan-to'g'ri o'zi to'laydi. Na hamkor (`partner_payable`), na SAFAAR
 * (`commission_amount`) bu summani ko'tarmaydi/undan ayirmaydi.
 *
 * MUHIM: bu (A) — "kim to'laydi" — degan BIZNES savolga javob; Uzum bilan
 * SAFAAR o'rtasidagi bank SETTLEMENT texnik mexanizmi (B, quyida
 * `UZUM_CHECKOUT_SETTLEMENT_MODEL`) BUTUNLAY ALOHIDA, hali ochiq savol —
 * bittasi tasdiqlanishi ikkinchisini AVTOMATIK hal qilmaydi.
 */
export type UzumCheckoutFeeBearer = 'USER' | 'PARTNER' | 'SAFAAR';
export const UZUM_CHECKOUT_FEE_BEARER: UzumCheckoutFeeBearer = 'USER';

/**
 * Uzum'ning HAQIQIY (SAFAAR bilan Uzum o'rtasidagi bank) settlement
 * mexanizmi TASDIQLANMAGAN — taxmin qilinmaydi. `UZUM_CHECKOUT_FEE_BEARER`
 * bilan ARALASHTIRILMASIN: "kim to'laydi" allaqachon tasdiqlangan (USER),
 * lekin bu shuni ANGLATMAYDIKI, SAFAAR'ning Uzum'dan oladigan bank
 * ko'chirmasi avtomatik ravishda "to'liq gross" bo'ladi — bu ALOHIDA,
 * texnik, hali rasmiy tasdiqlanmagan savol. `'REQUIRES_UZUM_CONFIRMATION'`
 * bo'lib qolaveradi toki quyidagilardan biri rasmiy ravishda
 * tasdiqlanmaguncha:
 *   'NET_SETTLEMENT'      — Uzum 1.5%ni avtomatik ushlab qoladi, bankka NET keladi
 *   'GROSS_WITH_INVOICE'  — Uzum to'liq GROSS'ni o'tkazadi, komissiya alohida so'raladi
 */
export type UzumCheckoutSettlementModel =
  | 'REQUIRES_UZUM_CONFIRMATION'
  | 'NET_SETTLEMENT'
  | 'GROSS_WITH_INVOICE';

export const UZUM_CHECKOUT_SETTLEMENT_MODEL: UzumCheckoutSettlementModel =
  'REQUIRES_UZUM_CONFIRMATION';

export interface UzumCheckoutCommissionBreakdown {
  /** Mijoz to'lagan/to'lashi kerak bo'lgan to'liq summa (so'm). O'ZGARTIRILMAYDI. */
  grossAmountSom: number;
  /** Qo'llanilgan stavka (masalan 0.015 = 1.5%). */
  commissionRate: number;
  /** gross × rate, tiyin darajasida yaxlitlangan (so'm). USER to'laydi (`UZUM_CHECKOUT_FEE_BEARER`). */
  commissionAmountSom: number;
  /**
   * gross − commission (so'm). MUHIM: bu Uzum bilan SAFAAR o'rtasidagi bank
   * SETTLEMENT haqidagi ICHKI/REFERENCE hisob-kitob — `UZUM_CHECKOUT_FEE_BEARER`
   * ("kim to'laydi") bilan ARALASHTIRILMASIN. Bu summa `partner_payable`ga
   * HECH QACHON YOZILMAYDI (hamkor ledgeri faqat SAFAAR komissiyasini biladi);
   * Uzum'ning haqiqiy bank ko'chirmasi shu summaga teng bo'lishi ILGARIDAN
   * KAFOLATLANMAYDI (`UZUM_CHECKOUT_SETTLEMENT_MODEL`ga qarang).
   */
  netSettlementAmountSom: number;
}

/**
 * Gross so'm summasidan Uzum Checkout komissiya taqsimotini hisoblaydi.
 *
 * Suzuvchi nuqta (`0.1 + 0.2 !== 0.3` muammosi) xatosiga yo'l qo'ymaslik
 * uchun BUTUN TIYIN arifmetikasida ishlaydi (`UzumProvider.toTiyin()` bilan
 * bir xil `Math.round` yaxlitlash siyosati — loyihada ALLAQACHON mavjud
 * konventsiya, shu yerda ham ishlatiladi, ICHKI izchillik uchun).
 *
 * @throws {RangeError} `grossAmountSom` chekli musbat son bo'lmasa (nol,
 *   manfiy, NaN, Infinity — barchasi rad etiladi: komissiyasiz to'lov
 *   yo'q, "nol to'lov"ning "nol komissiyasi" ma'nosiz).
 */
export function calculateUzumCheckoutCommission(
  grossAmountSom: number | string,
): UzumCheckoutCommissionBreakdown {
  const gross = Number(grossAmountSom);
  if (!Number.isFinite(gross) || gross <= 0) {
    throw new RangeError(
      `calculateUzumCheckoutCommission: grossAmountSom musbat, chekli son ` +
        `bo'lishi kerak (olindi: ${JSON.stringify(grossAmountSom)})`,
    );
  }

  const grossTiyin = Math.round(gross * 100);
  // Stavkani ham butun sonlarda ushlaymiz (150 = 1.5% bazis nuqtasi/10000)
  // — `gross * rate` to'g'ridan-to'g'ri ko'paytirilsa, keyinroq qo'shiladigan
  // stavkalar uchun suzuvchi nuqta xatosi yig'ilib qolishi mumkin edi.
  const rateBasisPoints = Math.round(UZUM_CHECKOUT_COMMISSION_RATE * 10_000);
  const commissionTiyin = Math.round((grossTiyin * rateBasisPoints) / 10_000);
  const netTiyin = grossTiyin - commissionTiyin;

  return {
    grossAmountSom: grossTiyin / 100,
    commissionRate: UZUM_CHECKOUT_COMMISSION_RATE,
    commissionAmountSom: commissionTiyin / 100,
    netSettlementAmountSom: netTiyin / 100,
  };
}
