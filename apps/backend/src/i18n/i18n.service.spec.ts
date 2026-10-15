import { NotFoundException } from '@nestjs/common';
import { I18nService } from './i18n.service';
import { AiTranslateService } from '../ai-translate/ai-translate.service';

describe('I18nService', () => {
  let service: I18nService;
  let aiTranslate: { autoTranslateMultilingualField: jest.Mock };

  beforeEach(() => {
    aiTranslate = {
      autoTranslateMultilingualField: jest.fn().mockResolvedValue({
        uz: 'Salom',
        ru: 'Привет',
        en: 'Hello',
      }),
    };

    service = new I18nService(aiTranslate as unknown as AiTranslateService);
    service.onModuleInit();
  });

  it('returns supported locales', () => {
    expect(service.getSupportedLocales()).toEqual(['uz', 'ru', 'en']);
  });

  it('loads namespaces from backend locales', () => {
    const namespaces = service.getNamespaces();
    expect(namespaces).toContain('common');
    expect(namespaces).toContain('hotels');
    expect(namespaces).toContain('auth');
  });

  it('returns common namespace for uz', () => {
    const commonUz = service.getNamespace('uz', 'common');
    expect(commonUz).toBeDefined();
    expect(commonUz.brand).toBe('Safaar');
  });

  it('returns common namespace for ru', () => {
    const commonRu = service.getNamespace('ru', 'common');
    expect(commonRu).toBeDefined();
    expect(commonRu.brand).toBe('Safaar');
  });

  it('falls back to uz if unknown locale is provided', () => {
    const fallback = service.getNamespace('fr', 'common');
    expect(fallback).toBeDefined();
    expect(fallback.brand).toBe('Safaar');
  });

  it('throws NotFoundException for non-existent namespace', () => {
    expect(() => service.getNamespace('uz', 'non_existent_ns_12345')).toThrow(
      NotFoundException,
    );
  });

  it('returns all namespaces for uz', () => {
    const all = service.getAllNamespaces('uz');
    expect(all.common).toBeDefined();
    expect(all.hotels).toBeDefined();
  });

  it('translates dynamic text via aiTranslate service', async () => {
    const res = await service.translateText('Salom dunyo');
    expect(res).toEqual({
      uz: 'Salom',
      ru: 'Привет',
      en: 'Hello',
    });
    expect(aiTranslate.autoTranslateMultilingualField).toHaveBeenCalledWith(
      'Salom dunyo',
      undefined,
    );
  });
});
