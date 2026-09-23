import { rawApi } from "../client";

export interface CurrencyRatesResponse {
  base: "UZS";
  updatedAt: string | null;
  rates: {
    UZS: number;
    USD: number;
    EUR: number;
    RUB: number;
  };
}

export const currencyService = {
  /**
   * `GET /currency/rates` — CBU.uz'dan olingan, keshlangan joriy kurslar
   * (ommaviy, auth talab qilmaydi). Har chaqiriqda keshsiz so'ralmaydi —
   * backend o'zi TTL bo'yicha yangilaydi, shuning uchun bu yerda odatiy
   * fetch keshiga tayanamiz.
   */
  async getRates(): Promise<CurrencyRatesResponse> {
    return rawApi.get<CurrencyRatesResponse>("/currency/rates");
  },
};
