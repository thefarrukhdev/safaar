/**
 * Karta turi bo'yicha to'lov haqi (fee) va gross-up yakuniy summasini hisoblash.
 * Backend `apps/backend/src/payments/providers/card-scheme-fee.ts` bilan BIR XIL
 * butun tiyin arifmetikasi va stavkalar (Uzcard/Humo: 1.5%, Visa/Mastercard: 3.5%, Cash: 0%).
 */

export type CardScheme = "humo" | "uzcard" | "visa" | "mastercard" | "cash";

export const CARD_SCHEME_FEE_RATES: Readonly<Record<string, number>> = Object.freeze({
  humo: 0.015,
  uzcard: 0.015,
  visa: 0.035,
  mastercard: 0.035,
  cash: 0,
});

export interface PaymentFeeBreakdown {
  method: string;
  baseAmount: number;
  feeRate: number;
  feeAmount: number;
  totalAmount: number;
}

export function calculatePaymentFee(
  baseAmountSom: number,
  method: string,
): PaymentFeeBreakdown {
  const normalizedMethod = (method || "").toLowerCase();
  const rate = CARD_SCHEME_FEE_RATES[normalizedMethod] ?? 0;

  if (rate === 0 || !Number.isFinite(baseAmountSom) || baseAmountSom <= 0) {
    return {
      method: normalizedMethod,
      baseAmount: baseAmountSom,
      feeRate: 0,
      feeAmount: 0,
      totalAmount: baseAmountSom,
    };
  }

  const baseTiyin = Math.round(baseAmountSom * 100);
  const totalTiyin = Math.round(baseTiyin / (1 - rate));
  const feeTiyin = totalTiyin - baseTiyin;

  return {
    method: normalizedMethod,
    baseAmount: baseTiyin / 100,
    feeRate: rate,
    feeAmount: feeTiyin / 100,
    totalAmount: totalTiyin / 100,
  };
}
