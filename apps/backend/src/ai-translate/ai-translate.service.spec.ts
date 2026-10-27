import 'reflect-metadata';
import { ServiceUnavailableException } from '@nestjs/common';
import {
  AiTranslateService,
  cyrillicToLatinUzbek,
  isEnglish,
  isUzbekCyrillic,
} from './ai-translate.service';

function geminiResponse(translation: string) {
  return {
    ok: true,
    json: () =>
      Promise.resolve({
        candidates: [
          {
            content: {
              parts: [{ text: JSON.stringify({ translation }) }],
            },
          },
        ],
      }),
  };
}

function geminiMultilingualResponse(multi: {
  uz: string;
  ru: string;
  en: string;
}) {
  return {
    ok: true,
    json: () =>
      Promise.resolve({
        candidates: [
          {
            content: {
              parts: [{ text: JSON.stringify(multi) }],
            },
          },
        ],
      }),
  };
}

describe('AiTranslateService', () => {
  const originalApiKey = process.env.AI_TRANSLATE_API_KEY;
  const originalGeminiKey = process.env.GEMINI_API_KEY;
  const originalGoogleKey = process.env.GOOGLE_API_KEY;
  const originalFetch = global.fetch;
  let service: AiTranslateService;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    service = new AiTranslateService();
    fetchMock = jest.fn();
    global.fetch = fetchMock;
  });

  afterEach(() => {
    process.env.AI_TRANSLATE_API_KEY = originalApiKey;
    process.env.GEMINI_API_KEY = originalGeminiKey;
    process.env.GOOGLE_API_KEY = originalGoogleKey;
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('fails closed with AI_TRANSLATE_NOT_CONFIGURED when no API key is set', async () => {
    delete process.env.AI_TRANSLATE_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_API_KEY;

    await expect(
      service.translate({
        text: 'Salom',
        source: 'uz',
        targets: ['ru', 'en'],
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('calls Gemini generateContent per target and excludes the source language', async () => {
    process.env.AI_TRANSLATE_API_KEY = 'test-key';
    fetchMock.mockImplementation((url: string) => {
      expect(url).toContain('generativelanguage.googleapis.com');
      expect(url).toContain('generateContent');
      return Promise.resolve(geminiResponse('translated'));
    });

    const result = await service.translate({
      text: 'Salom',
      source: 'uz',
      targets: ['uz', 'ru', 'en'],
    });

    // source language filtered out of the target list
    expect(Object.keys(result).sort()).toEqual(['en', 'ru']);
    expect(result.ru).toBe('translated');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('sends a structured-output request body (responseSchema) rather than free text', async () => {
    process.env.AI_TRANSLATE_API_KEY = 'test-key';
    fetchMock.mockResolvedValue(geminiResponse('ok'));

    await service.translate({
      text: 'Salom',
      source: 'uz',
      targets: ['ru'],
    });

    const call = fetchMock.mock.calls[0] as [string, { body: string }];
    const body = JSON.parse(call[1].body) as {
      generationConfig: {
        responseMimeType: string;
        responseSchema: { required: string[] };
      };
      contents: Array<{ parts: Array<{ text: string }> }>;
    };
    expect(body.generationConfig.responseMimeType).toBe('application/json');
    expect(body.generationConfig.responseSchema.required).toEqual([
      'translation',
    ]);
    expect(body.contents[0].parts[0].text).toContain('Salom');
  });

  it('raises AI_TRANSLATE_PROVIDER_ERROR when the provider responds with a non-2xx status', async () => {
    process.env.AI_TRANSLATE_API_KEY = 'test-key';
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      text: () => Promise.resolve('bad request'),
    });

    await expect(
      service.translate({
        text: 'Salom',
        source: 'uz',
        targets: ['ru'],
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('raises AI_TRANSLATE_PROVIDER_ERROR when Gemini response text is not valid JSON', async () => {
    process.env.AI_TRANSLATE_API_KEY = 'test-key';
    fetchMock.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          candidates: [{ content: { parts: [{ text: 'not json' }] } }],
        }),
    });

    await expect(
      service.translate({
        text: 'Salom',
        source: 'uz',
        targets: ['ru'],
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  describe('Language detection and transliteration helpers', () => {
    it('isUzbekCyrillic identifies Uzbek text written in Cyrillic', () => {
      expect(isUzbekCyrillic('Меҳмонхона Самарқанд марказида жойлашган')).toBe(
        true,
      );
      expect(isUzbekCyrillic('Қулайликлар ва шинам хоналар')).toBe(true);
      expect(isUzbekCyrillic('Привет, это обычный русский текст')).toBe(false);
    });

    it('isEnglish identifies English text accurately', () => {
      expect(isEnglish('Luxury hotel suite with balcony and pool view')).toBe(
        true,
      );
      expect(isEnglish('Cozy room in city center with breakfast')).toBe(true);
      expect(isEnglish('Toshkent shahar markazidagi mehmonxona')).toBe(false);
      expect(isEnglish('Oromgoh va shinam dacha')).toBe(false);
    });

    it('cyrillicToLatinUzbek converts Uzbek Cyrillic text to Latin script', () => {
      expect(cyrillicToLatinUzbek('Меҳмонхона марказда жойлашган')).toBe(
        'Mehmonxona markazda joylashgan',
      );
      expect(cyrillicToLatinUzbek('Ўзбекистон')).toBe("O'zbekiston");
      expect(cyrillicToLatinUzbek('Қулайликлар')).toBe('Qulayliklar');
    });
  });

  describe('detectLanguage', () => {
    it('detects Russian from standard Russian Cyrillic text', () => {
      expect(service.detectLanguage('Привет, это отличный номер')).toBe('ru');
    });

    it('detects Uzbek when written in Cyrillic', () => {
      expect(service.detectLanguage('Меҳмонхона марказда жойлашган')).toBe(
        'uz',
      );
      expect(service.detectLanguage('Қулай ва шинам хоналар')).toBe('uz');
    });

    it('detects English when written in English', () => {
      expect(
        service.detectLanguage('Luxury room with king bed and city view'),
      ).toBe('en');
    });

    it('defaults to Uzbek for Latin Uzbek text', () => {
      expect(
        service.detectLanguage('Toshkent shahar markazidagi mehmonxona'),
      ).toBe('uz');
    });
  });

  describe('autoTranslateMultilingualField', () => {
    it('returns all 3 languages when input is string and Gemini is available (fallback method)', async () => {
      process.env.AI_TRANSLATE_API_KEY = 'test-key';
      fetchMock.mockImplementation((url: string, opts: { body: string }) => {
        const parsed = JSON.parse(opts.body);
        const prompt = parsed.contents[0].parts[0].text;
        const target = prompt.includes('Russian')
          ? 'Отель Сарой'
          : 'Saroy Hotel';
        return Promise.resolve(geminiResponse(target));
      });

      const result = await service.autoTranslateMultilingualField(
        'Saroy mehmonxonasi',
        'uz',
      );
      expect(result).toEqual({
        uz: 'Saroy mehmonxonasi',
        ru: 'Отель Сарой',
        en: 'Saroy Hotel',
      });
    });

    it('uses callGeminiMultilingual when Gemini returns full multilingual object', async () => {
      process.env.AI_TRANSLATE_API_KEY = 'test-key';
      fetchMock.mockResolvedValue(
        geminiMultilingualResponse({
          uz: 'Shinam mehmonxona',
          ru: 'Уютный отель',
          en: 'Cozy hotel',
        }),
      );

      const result = await service.autoTranslateMultilingualField('Cozy hotel');
      expect(result).toEqual({
        uz: 'Shinam mehmonxona',
        ru: 'Уютный отель',
        en: 'Cozy hotel',
      });
    });

    it('converts Uzbek Cyrillic into Latin in fallback mode when no API key', async () => {
      delete process.env.AI_TRANSLATE_API_KEY;
      delete process.env.GEMINI_API_KEY;
      delete process.env.GOOGLE_API_KEY;

      const result = await service.autoTranslateMultilingualField(
        'Меҳмонхона марказда жойлашган',
      );
      expect(result.uz).toBe('Mehmonxona markazda joylashgan');
    });

    it('gracefully falls back to copying source text if no API key is configured', async () => {
      delete process.env.AI_TRANSLATE_API_KEY;
      delete process.env.GEMINI_API_KEY;
      delete process.env.GOOGLE_API_KEY;

      const result = await service.autoTranslateMultilingualField(
        'Shinam xona',
        'uz',
      );
      expect(result).toEqual({
        uz: 'Shinam xona',
        ru: 'Shinam xona',
        en: 'Shinam xona',
      });
    });

    it('returns empty fields if input is empty', async () => {
      const result = await service.autoTranslateMultilingualField('');
      expect(result).toEqual({ uz: '', ru: '', en: '' });
    });
  });
});
