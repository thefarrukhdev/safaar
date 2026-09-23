import 'reflect-metadata';
import { ServiceUnavailableException } from '@nestjs/common';
import { AiTranslateService } from './ai-translate.service';

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

describe('AiTranslateService', () => {
  const originalApiKey = process.env.AI_TRANSLATE_API_KEY;
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
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('fails closed with AI_TRANSLATE_NOT_CONFIGURED when no API key is set', async () => {
    delete process.env.AI_TRANSLATE_API_KEY;

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
});
