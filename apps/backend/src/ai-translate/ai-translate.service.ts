import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import type {
  SupportedLanguage,
  TranslateTextDto,
} from './dto/ai-translate.dto';

const DEFAULT_MODEL = 'gemini-3.6-flash';

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
 * Google Gemini (Generative Language API) orqali tarjima — DEDIKATSIYA
 * qilingan tarjima API (masalan Google Cloud Translation) EMAS, umumiy
 * matn modeliga aniq prompt + `responseSchema` orqali QATTIQ JSON shakl
 * majburlanadi (erkin matn parse qilishdan ko'ra ishonchliroq).
 */
@Injectable()
export class AiTranslateService {
  private readonly logger = new Logger(AiTranslateService.name);

  async translate(dto: TranslateTextDto): Promise<Record<string, string>> {
    const apiKey = process.env.AI_TRANSLATE_API_KEY;
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
