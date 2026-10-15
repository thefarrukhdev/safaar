import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import type {
  SupportedLanguage,
  TranslateTextDto,
} from './dto/ai-translate.dto';

const DEFAULT_MODEL = 'gemini-3.8-flash';

const LANGUAGE_NAMES: Record<SupportedLanguage, string> = {
  uz: 'Uzbek',
  ru: 'Russian',
  en: 'English',
};

interface GeminiGenerateContentResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
}

/**
 * Matn krill alifbosidagi o'zbek tili ekanligini aniqlash.
 * O'zbek krill alifbosining o'ziga xos harflari: ў, қ, ғ, ҳ yoki keng tarqalgan so'zlar.
 */
export function isUzbekCyrillic(text: string): boolean {
  if (/[\u045E\u049B\u0493\u04B3\u040E\u049A\u0492\u04B2]/i.test(text)) {
    return true;
  }
  const uzCyrillicWords =
    /\b(меҳмонхона|хоналар|хона|шаҳар|билан|учун|жойлашган|нарх|кунлик|катта|яхши|боғ|оила|овқат|мулойим|эга|бор|йўқ|шароит|сифатли|арзон|шинам|марказ)\b/i;
  return uzCyrillicWords.test(text);
}

/**
 * Matn ingliz tilida ekanligini aniqlash.
 */
export function isEnglish(text: string): boolean {
  const words = text.toLowerCase().match(/[a-z]+/g) || [];
  if (words.length === 0) return false;

  const englishKeywords = new Set([
    'the',
    'and',
    'is',
    'in',
    'with',
    'for',
    'hotel',
    'room',
    'luxury',
    'breakfast',
    'deluxe',
    'suite',
    'bed',
    'view',
    'free',
    'wifi',
    'shower',
    'balcony',
    'located',
    'center',
    'city',
    'stay',
    'great',
    'clean',
    'comfortable',
    'welcome',
    'guest',
    'house',
    'price',
    'night',
    'per',
    'available',
    'check',
    'out',
    'pool',
    'spa',
    'quiet',
    'modern',
    'private',
    'all',
    'amenities',
    'from',
    'airport',
    'restaurant',
    'bar',
  ]);

  const uzbekKeywords = new Set([
    'mehmonxona',
    'xona',
    'xonalar',
    'shahar',
    'joylashgan',
    'qulaylik',
    'bilan',
    'uchun',
    'katta',
    'yaxshi',
    'nonushta',
    'narx',
    'bepul',
    'oromgoh',
    'dacha',
    'sanatoriy',
    'shinam',
    'markazida',
    'mavjud',
    'sharoit',
    'kunlik',
    'ijara',
  ]);

  let enCount = 0;
  let uzCount = 0;
  for (const w of words) {
    if (englishKeywords.has(w)) enCount++;
    if (uzbekKeywords.has(w)) uzCount++;
  }

  // O'zbek lotin harflari (o', g') bo'lsa yoki o'zbek so'zlari ko'p bo'lsa
  if (/[oOgG]['`ʻ’]/.test(text) || uzCount > enCount) {
    return false;
  }

  return enCount > 0 && enCount >= uzCount;
}

/**
 * Krillcha o'zbekcha matnni Lotin alifbosiga transliteratsiya qilish (offline fallback).
 */
export function cyrillicToLatinUzbek(text: string): string {
  const map: Record<string, string> = {
    Ў: "O'",
    ў: "o'",
    Қ: 'Q',
    қ: 'q',
    Ғ: "G'",
    ғ: "g'",
    Ҳ: 'H',
    ҳ: 'h',
    Х: 'X',
    х: 'x',
    Ч: 'Ch',
    ч: 'ch',
    Ш: 'Sh',
    ш: 'sh',
    Ю: 'Yu',
    ю: 'yu',
    Я: 'Ya',
    я: 'ya',
    Ё: 'Yo',
    ё: 'yo',
    Ц: 'Ts',
    ц: 'ts',
    Ж: 'J',
    ж: 'j',
    А: 'A',
    а: 'a',
    Б: 'B',
    б: 'b',
    В: 'V',
    в: 'v',
    Г: 'G',
    г: 'g',
    Д: 'D',
    д: 'd',
    Е: 'E',
    е: 'e',
    Э: 'E',
    э: 'e',
    З: 'Z',
    з: 'z',
    И: 'I',
    и: 'i',
    Й: 'Y',
    й: 'y',
    К: 'K',
    к: 'k',
    Л: 'L',
    л: 'l',
    М: 'M',
    м: 'm',
    Н: 'N',
    н: 'n',
    О: 'O',
    о: 'o',
    П: 'P',
    п: 'p',
    Р: 'R',
    р: 'r',
    С: 'S',
    с: 's',
    Т: 'T',
    т: 't',
    У: 'U',
    у: 'u',
    Ф: 'F',
    ф: 'f',
    Ъ: "'",
    ъ: "'",
    Ь: '',
    ь: '',
    Ы: 'I',
    ы: 'i',
    Щ: 'Sh',
    щ: 'sh',
  };

  return text
    .replace(/(^|[\s.,!?;:()"-])Е/g, '$1Ye')
    .replace(/(^|[\s.,!?;:()"-])е/g, '$1ye')
    .replace(/[А-Яа-яЎўҚқҒғҲҳЁё]/g, (ch) => map[ch] ?? ch);
}

@Injectable()
export class AiTranslateService {
  private readonly logger = new Logger(AiTranslateService.name);

  getApiKey(): string | undefined {
    return (
      process.env.AI_TRANSLATE_API_KEY ||
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY
    );
  }

  detectLanguage(text: string): SupportedLanguage {
    const trimmed = text.trim();
    if (!trimmed) return 'uz';

    // Krillcha o'zbekcha bo'lsa
    if (isUzbekCyrillic(trimmed)) {
      return 'uz';
    }

    const cyrillicMatch = trimmed.match(/[\u0400-\u04FF]/g);
    const cyrillicCount = cyrillicMatch ? cyrillicMatch.length : 0;
    const latinMatch = trimmed.match(/[a-zA-Z]/g);
    const latinCount = latinMatch ? latinMatch.length : 0;

    if (cyrillicCount > latinCount && cyrillicCount >= 3) {
      return 'ru';
    }

    if (isEnglish(trimmed)) {
      return 'en';
    }

    return 'uz';
  }

  async autoTranslateMultilingualField(
    input:
      | { uz?: string | null; ru?: string | null; en?: string | null }
      | string
      | undefined
      | null,
    fallbackSource?: SupportedLanguage,
  ): Promise<{ uz: string; ru: string; en: string }> {
    let uz = '';
    let ru = '';
    let en = '';
    let isCyrillicUz = false;

    if (typeof input === 'string') {
      const text = input.trim();
      if (!text) {
        return { uz: '', ru: '', en: '' };
      }
      isCyrillicUz = isUzbekCyrillic(text);
      const detected = fallbackSource || this.detectLanguage(text);

      if (isCyrillicUz) {
        uz = cyrillicToLatinUzbek(text);
      } else if (detected === 'ru') {
        ru = text;
      } else if (detected === 'en') {
        en = text;
      } else {
        uz = text;
      }
    } else if (input && typeof input === 'object') {
      uz = (input.uz ?? '').trim();
      ru = (input.ru ?? '').trim();
      en = (input.en ?? '').trim();
      if (uz && isUzbekCyrillic(uz)) {
        isCyrillicUz = true;
        uz = cyrillicToLatinUzbek(uz);
      }
    }

    const available = [
      { lang: 'uz' as const, text: uz },
      { lang: 'ru' as const, text: ru },
      { lang: 'en' as const, text: en },
    ].filter((item) => Boolean(item.text));

    if (available.length === 0) {
      return { uz: '', ru: '', en: '' };
    }

    if (uz && ru && en && uz !== ru && ru !== en) {
      return { uz, ru, en };
    }

    const primary =
      available.find((item) =>
        fallbackSource ? item.lang === fallbackSource : true,
      ) || available[0];

    const sourceLang = primary.lang;
    const sourceText = typeof input === 'string' ? input.trim() : primary.text;
    const apiKey = this.getApiKey();

    const result = {
      uz: uz || (isCyrillicUz ? cyrillicToLatinUzbek(sourceText) : sourceText),
      ru: ru || sourceText,
      en: en || sourceText,
    };

    if (!apiKey) {
      return result;
    }

    // 1-qadam: Gemini Multilingual orqali bitta tezkor so'rovda 3 tilda olish
    try {
      const multi = await this.callGeminiMultilingual(sourceText, apiKey);
      if (multi.uz) result.uz = multi.uz;
      if (multi.ru) result.ru = multi.ru;
      if (multi.en) result.en = multi.en;
      return result;
    } catch (error) {
      this.logger.warn(
        `Gemini multilingual chaqiruvi muvaffaqiyatsiz bo'ldi, alohida translate rejimiga o'tiladi: ${(error as Error)?.message}`,
      );
    }

    // 2-qadam: Fallback sifatida alohida tilma-til tarjima qilish
    const targets: SupportedLanguage[] = [];
    if (!uz || (uz === sourceText && sourceLang !== 'uz')) targets.push('uz');
    if (!ru || (ru === sourceText && sourceLang !== 'ru')) targets.push('ru');
    if (!en || (en === sourceText && sourceLang !== 'en')) targets.push('en');

    if (targets.length === 0) {
      return result;
    }

    try {
      const translated = await this.translate({
        text: sourceText,
        source: sourceLang,
        targets,
      });
      if (translated.uz) result.uz = translated.uz;
      if (translated.ru) result.ru = translated.ru;
      if (translated.en) result.en = translated.en;
    } catch (error) {
      this.logger.warn(
        `autoTranslateMultilingualField tarjima o'tkazib yuborildi: ${(error as Error)?.message}`,
      );
    }

    return result;
  }

  /**
   * Gemini'ga bitta so'rov yuborib, matn qaysi tilda (o'zbekcha lotin, o'zbekcha krill,
   * ruscha yoki inglizcha) kiritilishidan qat'i nazar, barcha 3 ta tilda tarjima oladi.
   */
  async callGeminiMultilingual(
    text: string,
    apiKey: string,
  ): Promise<{ uz: string; ru: string; en: string }> {
    const model = process.env.AI_TRANSLATE_MODEL || DEFAULT_MODEL;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const prompt =
      `You are a professional multilingual translator for the Safaar travel and hotel platform.\n` +
      `The input text can be in:\n` +
      `- Uzbek (Latin script)\n` +
      `- Uzbek (Cyrillic script)\n` +
      `- Russian\n` +
      `- English\n\n` +
      `Task:\n` +
      `1. Accurately identify the source language and meaning.\n` +
      `2. Translate into all three target languages:\n` +
      `   - "uz": Uzbek strictly in Latin script (O'zbekcha lotin alifbosida). If the source was Uzbek Cyrillic, transliterate and correct it into standard Uzbek Latin.\n` +
      `   - "ru": Russian language (Русский язык).\n` +
      `   - "en": English language.\n\n` +
      `Rules:\n` +
      `- Preserve hotel/travel terminology, addresses, phone numbers, and polite tone.\n` +
      `- Return ONLY a JSON object matching the schema.\n\n` +
      `Input text:\n${text}`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'OBJECT',
              properties: {
                uz: { type: 'STRING' },
                ru: { type: 'STRING' },
                en: { type: 'STRING' },
              },
              required: ['uz', 'ru', 'en'],
            },
          },
        }),
      });
    } catch (error) {
      this.logger.error(
        `Gemini multilingual network xatosi: ${(error as Error)?.message}`,
      );
      throw new ServiceUnavailableException({
        code: 'AI_TRANSLATE_PROVIDER_ERROR',
        message: 'Tarjima xizmatiga ulanib bo‘lmadi',
      });
    }

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      this.logger.error(
        `Gemini multilingual xato javob: ${response.status} ${errorBody}`,
      );
      throw new ServiceUnavailableException({
        code: 'AI_TRANSLATE_PROVIDER_ERROR',
        message: 'Tarjima xizmati xato qaytardi',
      });
    }

    const body = (await response.json()) as GeminiGenerateContentResponse;
    const rawText = body?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      throw new ServiceUnavailableException({
        code: 'AI_TRANSLATE_PROVIDER_ERROR',
        message: 'Tarjima xizmati bo‘sh javob qaytardi',
      });
    }

    try {
      const parsed = JSON.parse(rawText) as {
        uz?: string;
        ru?: string;
        en?: string;
      };
      if (!parsed.uz && !parsed.ru && !parsed.en) {
        throw new Error('No multilingual fields found in response');
      }
      return {
        uz: (parsed.uz ?? '').trim(),
        ru: (parsed.ru ?? '').trim(),
        en: (parsed.en ?? '').trim(),
      };
    } catch {
      throw new ServiceUnavailableException({
        code: 'AI_TRANSLATE_PROVIDER_ERROR',
        message: 'Tarjima xizmati javobini o‘qib bo‘lmadi',
      });
    }
  }

  async translate(dto: TranslateTextDto): Promise<Record<string, string>> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new ServiceUnavailableException({
        code: 'AI_TRANSLATE_NOT_CONFIGURED',
        message:
          'AI tarjima xizmati sozlanmagan (AI_TRANSLATE_API_KEY o‘rnatilmagan)',
      });
    }

    const targets = [...new Set(dto.targets)].filter(
      (target) => target !== dto.source,
    );

    const entries = await Promise.all(
      targets.map(async (target) => {
        const translatedText = await this.callGemini(
          dto.text,
          dto.source,
          target,
          apiKey,
        );
        return [target, translatedText] as const;
      }),
    );

    return Object.fromEntries(entries);
  }

  private async callGemini(
    text: string,
    source: SupportedLanguage,
    target: SupportedLanguage,
    apiKey: string,
  ): Promise<string> {
    const model = process.env.AI_TRANSLATE_MODEL || DEFAULT_MODEL;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const prompt =
      `Translate the following text from ${LANGUAGE_NAMES[source]} to ${LANGUAGE_NAMES[target]}. ` +
      'Preserve tone and meaning. Do not add commentary, quotes, or explanation — ' +
      'return only the translation itself.\n\nText:\n' +
      text;

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'OBJECT',
              properties: { translation: { type: 'STRING' } },
              required: ['translation'],
            },
          },
        }),
      });
    } catch (error) {
      this.logger.error(
        `Gemini so'rovi network xatosi: ${(error as Error)?.message}`,
      );
      throw new ServiceUnavailableException({
        code: 'AI_TRANSLATE_PROVIDER_ERROR',
        message: 'Tarjima xizmatiga ulanib bo‘lmadi',
      });
    }

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      this.logger.error(`Gemini xato javob: ${response.status} ${errorBody}`);
      throw new ServiceUnavailableException({
        code: 'AI_TRANSLATE_PROVIDER_ERROR',
        message: 'Tarjima xizmati xato qaytardi',
      });
    }

    const body = (await response.json()) as GeminiGenerateContentResponse;
    const rawText = body?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      this.logger.error('Gemini javobida matn topilmadi');
      throw new ServiceUnavailableException({
        code: 'AI_TRANSLATE_PROVIDER_ERROR',
        message: 'Tarjima xizmati bo‘sh javob qaytardi',
      });
    }

    try {
      const parsed = JSON.parse(rawText) as { translation?: string };
      return parsed.translation ?? '';
    } catch {
      this.logger.error('Gemini javobini JSON sifatida o‘qib bo‘lmadi');
      throw new ServiceUnavailableException({
        code: 'AI_TRANSLATE_PROVIDER_ERROR',
        message: 'Tarjima xizmati javobini o‘qib bo‘lmadi',
      });
    }
  }
}
