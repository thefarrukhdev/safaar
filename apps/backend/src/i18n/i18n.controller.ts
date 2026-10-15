import { Body, Controller, Get, Header, Param, Post } from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import { I18nService } from './i18n.service';

export class TranslateTextDto {
  @IsString()
  text!: string;

  @IsOptional()
  @IsString()
  sourceLang?: string;
}

@Controller('translations')
export class I18nController {
  constructor(private readonly i18nService: I18nService) {}

  @Get('namespaces')
  getNamespaces() {
    return this.i18nService.getNamespaces();
  }

  @Get('locales')
  getLocales() {
    return this.i18nService.getSupportedLocales();
  }

  @Get(':locale')
  @Header('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400')
  getAllForLocale(@Param('locale') locale: string) {
    return this.i18nService.getAllNamespaces(locale);
  }

  @Get(':locale/:namespace')
  @Header('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400')
  getNamespace(
    @Param('locale') locale: string,
    @Param('namespace') namespace: string,
  ) {
    return this.i18nService.getNamespace(locale, namespace);
  }

  @Post('translate')
  async translate(@Body() body: TranslateTextDto) {
    return this.i18nService.translateText(body.text, body.sourceLang);
  }
}
