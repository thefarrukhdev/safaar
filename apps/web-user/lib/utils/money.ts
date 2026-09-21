/**
 * Pul bilan ishlash va Ko'p Valyutali Formatlash (UZS, USD, EUR, RUB).
 */

export type CurrencyCode = "UZS" | "USD" | "EUR" | "RUB";

export const DEFAULT_EXCHANGE_RATES: Record<CurrencyCode, number> = {
  UZS: 1,
  USD: 12650,
  EUR: 13800,
  RUB: 140,
};

export const CURRENCY_INFO: Record<
  CurrencyCode,
  { code: CurrencyCode; symbol: string; flag: string; name: string }
> = {
  UZS: { code: "UZS", symbol: "so'm", flag: "🇺🇿", name: "O'zbek so'mi" },
  USD: { code: "USD", symbol: "$", flag: "🇺🇸", name: "US Dollar" },
  EUR: { code: "EUR", symbol: "€", flag: "🇪🇺", name: "Euro" },
  RUB: { code: "RUB", symbol: "₽", flag: "🇷🇺", name: "Российский рубль" },
};


/**
 * Valyuta bo'yicha narxni konvertatsiya qilish va formatlash.
 */
export function formatMoney(
  amountInSum: number,
  currency: CurrencyCode = "UZS",
  rates: Record<CurrencyCode, number> = DEFAULT_EXCHANGE_RATES,
  locale: string = "uz"
): string {
  const rate = rates[currency] || 1;
  const converted = amountInSum / rate;

  if (currency === "UZS") {
    const formatted = Math.round(converted)
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0");
    const suffix = locale === "ru" ? "сум" : locale === "en" ? "UZS" : "so'm";
    return `${formatted} ${suffix}`;
  }

  if (currency === "USD") {
    const val = converted < 10 ? converted.toFixed(2) : Math.round(converted).toLocaleString("en-US");
    return `$${val}`;
  }

  if (currency === "EUR") {
    const val = converted < 10 ? converted.toFixed(2) : Math.round(converted).toLocaleString("de-DE");
    return `€${val}`;
  }

  if (currency === "RUB") {
    const val = Math.round(converted)
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0");
    const suffix = locale === "ru" ? "руб." : "₽";
    return `${val} ${suffix}`;
  }

  return `${Math.round(converted)} ${currency}`;
}

/** So'm qiymatini matn qilib qaytaradi (backward compatibility). */
export function formatSum(sum: number, locale: string = "uz"): string {
  return formatMoney(sum, "UZS", DEFAULT_EXCHANGE_RATES, locale);
}

