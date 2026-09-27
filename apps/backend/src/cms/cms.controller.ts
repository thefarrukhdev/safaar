import { Controller, Get, Param } from '@nestjs/common';
import { CmsService } from './cms.service';

@Controller()
export class CmsController {
  constructor(private readonly cmsService: CmsService) {}

  @Get('cms/banners')
  banners() {
    return this.cmsService.collection('banners');
  }

  @Get('cms/offers')
  offers() {
    return this.cmsService.offers();
  }

  @Get('cms/promo-bar')
  promoBar() {
    return this.cmsService.promoBar();
  }

  @Get('cms/news')
  news() {
    return this.cmsService.collection('news');
  }

  @Get('cms/news/:slug')
  newsOne(@Param('slug') slug: string) {
    return this.cmsService.one('news', slug);
  }

  @Get('cms/pages')
  pages() {
    return this.cmsService.collection('pages');
  }

  @Get('cms/pages/:slug')
  page(@Param('slug') slug: string) {
    return this.cmsService.one('pages', slug);
  }

  @Get('cms/faqs')
  faqs() {
    return this.cmsService.collection('faqs');
  }

  @Get('settings/public')
  publicSettings() {
    return this.cmsService.publicSettings();
  }
}
