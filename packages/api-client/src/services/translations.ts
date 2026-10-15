import { rawApi } from "../client";

export interface TranslationsService {
  getLocales(): Promise<string[]>;
  getNamespaces(): Promise<string[]>;
  getAllForLocale(locale: string): Promise<Record<string, Record<string, unknown>>>;
  getNamespace(locale: string, namespace: string): Promise<Record<string, unknown>>;
  translateText(text: string, sourceLang?: string): Promise<{ uz: string; ru: string; en: string }>;
}

export const translationsService = {
  /**
   * `GET /translations/locales` — qo'llab-quvvatlanadigan tillar ro'yxati (['uz', 'ru', 'en'])
   */
  async getLocales(): Promise<string[]> {
    return rawApi.get<string[]>("/translations/locales");
  },

  /**
   * `GET /translations/namespaces` — mavjud barcha namespace'lar ro'yxati
   */
  async getNamespaces(): Promise<string[]> {
    return rawApi.get<string[]>("/translations/namespaces");
  },

  /**
   * `GET /translations/:locale` — tanlangan til bo'yicha barcha namespace'lar lug'ati
   */
  async getAllForLocale(locale: string): Promise<Record<string, Record<string, unknown>>> {
    return rawApi.get<Record<string, Record<string, unknown>>>(
      `/translations/${encodeURIComponent(locale)}`,
    );
  },

  /**
   * `GET /translations/:locale/:namespace` — aniq bir namespace lug'ati
   */
  async getNamespace(locale: string, namespace: string): Promise<Record<string, unknown>> {
    return rawApi.get<Record<string, unknown>>(
      `/translations/${encodeURIComponent(locale)}/${encodeURIComponent(namespace)}`,
    );
  },

  /**
   * `POST /translations/translate` — Gemini AI orqali matnni 3 tilda tarjima qilish
   */
  async translateText(
    text: string,
    sourceLang?: string,
  ): Promise<{ uz: string; ru: string; en: string }> {
    return rawApi.post<{ uz: string; ru: string; en: string }>("/translations/translate", {
      text,
      sourceLang,
    });
  },
};
