import { rawApi, type RequestOptions } from "../client";

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
   * (ommaviy, auth talab qilmaydi). Next.js muhitida 1 soatlik ISR kesh bilan
   * olinadi (har bir sahifa yuklanishida takroran tarmoq so'rovi qilinmaydi).
   */
  async getRates(options?: RequestOptions): Promise<CurrencyRatesResponse> {
    return rawApi.get<CurrencyRatesResponse>("/currency/rates", {
      next: { revalidate: 3600, tags: ["currency"] },
      ...options,
    });
  },
};
