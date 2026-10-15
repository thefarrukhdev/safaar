import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { AiTranslateService } from '../ai-translate/ai-translate.service';

export type SupportedLocale = 'uz' | 'ru' | 'en';
export const SUPPORTED_LOCALES: SupportedLocale[] = ['uz', 'ru', 'en'];

@Injectable()
export class I18nService implements OnModuleInit {
  private readonly logger = new Logger(I18nService.name);
  // locale -> (namespace -> dictionary)
  private readonly store = new Map<
    SupportedLocale,
    Map<string, Record<string, unknown>>
  >();
  private localesDir = '';

  constructor(private readonly aiTranslate: AiTranslateService) {
    for (const locale of SUPPORTED_LOCALES) {
      this.store.set(locale, new Map());
    }
  }

  onModuleInit(): void {
    this.localesDir = this.resolveLocalesDir();
    this.reloadAll();
  }

  /**
   * Loyihada locales papkasining joylashuvini topadi.
   * 1. apps/backend/locales (ishlab chiqarish yoki backend ichida)
   * 2. ../locales yoki ../../locales (dist/src nisbatan)
   * 3. apps/web-user/locales (monorepo dev fallback)
   */
  private resolveLocalesDir(): string {
    const candidates = [
      resolve(process.cwd(), 'apps/backend/locales'),
      resolve(process.cwd(), 'locales'),
      resolve(__dirname, '../../locales'),
      resolve(__dirname, '../../../locales'),
      resolve(process.cwd(), 'apps/web-user/locales'),
    ];

    for (const dir of candidates) {
      if (existsSync(dir) && existsSync(join(dir, 'uz'))) {
        this.logger.log(`Locales papkasi topildi: ${dir}`);
        return dir;
      }
    }

    this.logger.warn(
      `Hech qanday locales papkasi topilmadi! Nomzodlar: ${candidates.join(', ')}`,
    );
    return '';
  }

  /**
   * Barcha JSON fayllarni xotiraga (RAM) yuklaydi.
   * Natijada barcha API so'rovlar 0ms ichida javob beradi.
   */
  public reloadAll(): void {
    if (!this.localesDir || !existsSync(this.localesDir)) {
      return;
    }

    for (const locale of SUPPORTED_LOCALES) {
      const localePath = join(this.localesDir, locale);
      const dictMap =
        this.store.get(locale) ?? new Map<string, Record<string, unknown>>();

      if (existsSync(localePath)) {
        try {
          const files = readdirSync(localePath);
          for (const file of files) {
            if (file.endsWith('.json')) {
              const namespace = file.replace(/\.json$/, '');
              const fullPath = join(localePath, file);
              const content = readFileSync(fullPath, 'utf8');
              const parsed = JSON.parse(content) as Record<string, unknown>;
              dictMap.set(namespace, parsed);
            }
          }
          this.store.set(locale, dictMap);
          this.logger.log(
            `[${locale}] uchun ${dictMap.size} ta namespace yuklandi`,
          );
        } catch (err) {
          this.logger.error(`[${locale}] yuklashda xato:`, err);
        }
      }
    }
  }

  public getSupportedLocales(): SupportedLocale[] {
    return [...SUPPORTED_LOCALES];
  }

  public getNamespaces(): string[] {
    const uzMap = this.store.get('uz');
    if (!uzMap) return [];
    return Array.from(uzMap.keys()).sort();
  }

  /**
   * Berilgan til va namespace bo'yicha lug'atni qaytaradi.
   * Agar til topilmasa 'uz' tiliga fallback qiladi.
   */
  public getNamespace(
    locale: string,
    namespace: string,
  ): Record<string, unknown> {
    const validLocale = (
      SUPPORTED_LOCALES.includes(locale as SupportedLocale) ? locale : 'uz'
    ) as SupportedLocale;

    const dictMap = this.store.get(validLocale);
    const data = dictMap?.get(namespace);

    if (!data) {
      // Fallback to uz if not found in requested locale
      const fallbackData = this.store.get('uz')?.get(namespace);
      if (fallbackData) {
        return fallbackData;
      }
      throw new NotFoundException({
        code: 'TRANSLATION_NAMESPACE_NOT_FOUND',
        message: `Namespace '${namespace}' topilmadi`,
      });
    }

    return data;
  }

  /**
   * Berilgan til bo'yicha BARCHA namespace'larni bitta obyektda qaytaradi.
   * Masalan: { common: {...}, home: {...}, hotels: {...} }
   */
  public getAllNamespaces(
    locale: string,
  ): Record<string, Record<string, unknown>> {
    const validLocale = (
      SUPPORTED_LOCALES.includes(locale as SupportedLocale) ? locale : 'uz'
    ) as SupportedLocale;

    const dictMap = this.store.get(validLocale);
    const result: Record<string, Record<string, unknown>> = {};

    if (dictMap) {
      for (const [ns, content] of dictMap.entries()) {
        result[ns] = content;
      }
    }

    // Yetishmayotgan namespace'lar bo'lsa 'uz' dan to'ldiramiz
    const uzMap = this.store.get('uz');
    if (uzMap) {
      for (const [ns, content] of uzMap.entries()) {
        if (!result[ns]) {
          result[ns] = content;
        }
      }
    }

    return result;
  }

  /**
   * Dinamik matnni sun'iy intellekt (Gemini) orqali 3 tilda tarjima qilish
   */
  public async translateText(
    text: string,
    sourceLang?: string,
  ): Promise<{ uz: string; ru: string; en: string }> {
    const lang =
      sourceLang === 'uz' || sourceLang === 'ru' || sourceLang === 'en'
        ? sourceLang
        : undefined;
    return this.aiTranslate.autoTranslateMultilingualField(text, lang);
  }
}
