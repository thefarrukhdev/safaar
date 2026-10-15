import { I18nController } from './i18n.controller';
import { I18nService } from './i18n.service';

describe('I18nController', () => {
  let controller: I18nController;
  let service: {
    getNamespaces: jest.Mock;
    getSupportedLocales: jest.Mock;
    getAllNamespaces: jest.Mock;
    getNamespace: jest.Mock;
    translateText: jest.Mock;
  };

  beforeEach(() => {
    service = {
      getNamespaces: jest.fn().mockReturnValue(['common', 'hotels']),
      getSupportedLocales: jest.fn().mockReturnValue(['uz', 'ru', 'en']),
      getAllNamespaces: jest
        .fn()
        .mockReturnValue({ common: { brand: 'Safaar' } }),
      getNamespace: jest.fn().mockReturnValue({ brand: 'Safaar' }),
      translateText: jest.fn().mockResolvedValue({
        uz: 'Salom',
        ru: 'Привет',
        en: 'Hello',
      }),
    };

    controller = new I18nController(service as unknown as I18nService);
  });

  it('getNamespaces delegates to service', () => {
    expect(controller.getNamespaces()).toEqual(['common', 'hotels']);
    expect(service.getNamespaces).toHaveBeenCalled();
  });

  it('getLocales delegates to service', () => {
    expect(controller.getLocales()).toEqual(['uz', 'ru', 'en']);
    expect(service.getSupportedLocales).toHaveBeenCalled();
  });

  it('getAllForLocale delegates to service', () => {
    expect(controller.getAllForLocale('uz')).toEqual({
      common: { brand: 'Safaar' },
    });
    expect(service.getAllNamespaces).toHaveBeenCalledWith('uz');
  });

  it('getNamespace delegates to service', () => {
    expect(controller.getNamespace('uz', 'common')).toEqual({
      brand: 'Safaar',
    });
    expect(service.getNamespace).toHaveBeenCalledWith('uz', 'common');
  });

  it('translate delegates to service', async () => {
    const res = await controller.translate({ text: 'Salom', sourceLang: 'uz' });
    expect(res).toEqual({
      uz: 'Salom',
      ru: 'Привет',
      en: 'Hello',
    });
    expect(service.translateText).toHaveBeenCalledWith('Salom', 'uz');
  });
});
