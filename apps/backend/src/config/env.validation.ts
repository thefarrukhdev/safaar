import { isWeakSecret } from './secret-strength';

interface EnvironmentConfig {
  NODE_ENV: string;
  APP_NAME: string;
  WEB_USER_URL: string;
  OAUTH_ALLOWED_ORIGINS?: string;
  PORT: number;
  HOST: string;
  ENABLE_DEMO_AUTH: string;
  // Global ENABLE_DEMO_AUTH'dan MUSTAQIL, tor doiradagi mexanizm: faqat shu
  // yerda ANIQ ro'yxatlangan (vergul bilan ajratilgan) telefon raqamlari
  // uchun OTP `dev_code` sifatida qaytariladi — boshqa HAMMA raqam odatdagi
  // haqiqiy SMS orqali boradi. Bo'sh/unset = hech kim ruxsat etilmagan
  // (fail-closed standart). Qiymatlar Git'ga HECH QACHON commit qilinmaydi.
  DEMO_AUTH_ALLOWED_PHONES?: string;
  SMS_PROVIDER?: string;
  ESKIZ_EMAIL?: string;
  ESKIZ_PASSWORD?: string;
  ESKIZ_FROM?: string;
  TEXTUP_EMAIL?: string;
  TEXTUP_PASSWORD?: string;
  TEXTUP_USER_ID?: string;
  TEXTUP_TEMPLATE_ID?: string;
  TEXTUP_NICKNAME_ID?: string;
  API_PREFIX: string;
  BUSINESS_TIMEZONE: string;
  DATABASE_URL?: string;
  REDIS_URL?: string;
  JWT_ACCESS_SECRET?: string;
  JWT_REFRESH_SECRET?: string;
  JWT_ACCESS_TTL: string;
  JWT_REFRESH_TTL: string;
  JWT_ISSUER: string;
  JWT_AUDIENCE: string;
  TOTP_ENCRYPTION_KEY?: string;
  OTP_PEPPER?: string;
  PARTNER_API_KEY_PEPPER?: string;
  PAYMENT_WEBHOOK_SECRET?: string;
  RECOVERY_CODE_PEPPER?: string;
  PARTNER_WEBHOOK_SIGNING_SECRET?: string;
  CLICK_SERVICE_ID?: string;
  CLICK_MERCHANT_ID?: string;
  CLICK_SECRET_KEY?: string;
  PAYME_MERCHANT_ID?: string;
  PAYME_KEY?: string;
  UZUM_SERVICE_ID?: string;
  UZUM_USERNAME?: string;
  UZUM_PASSWORD?: string;
  // Uzum CHECKOUT (Merchant API'dan alohida). Qiymatlar Uzum Checkout
  // onboarding'dan keladi; hech biri hozircha production'da majburiy emas.
  // `..._SIGNATURE_SCHEME` unset/`none` bo'lsa callback fail-closed rad etiladi.
  UZUM_CHECKOUT_BASE_URL?: string;
  UZUM_CHECKOUT_MERCHANT_ID?: string;
  UZUM_CHECKOUT_TERMINAL_ID?: string;
  UZUM_CHECKOUT_API_KEY?: string;
  UZUM_CHECKOUT_CALLBACK_SIGN_KEY?: string;
  UZUM_CHECKOUT_SIGNATURE_HEADER?: string;
  UZUM_CHECKOUT_SIGNATURE_SCHEME?: string;
  // `register()` chiquvchi fiskal `receiptParams` uchun — 2026-09-11 sandbox
  // orqali tasdiqlangan wire-format (`docs/payments-uzum-checkout.md`).
  // BIZNES/BUXGALTERIYA tomonidan beriladi, KODDA hardcode qilinmaydi.
  // `UZUM_CHECKOUT_SPIC`/`_PACKAGE_CODE` — tasnif.soliq.uz'dan IKPU/o'lchov
  // birligi kodi. `_VAT_PERCENT` — soliq stavkasi (%%); MUHIM: hozircha
  // FAQAT sandbox probe sifatida tasdiqlangan (`12`), bu HAQIQIY production
  // soliq siyosati DEGANI EMAS — real qiymat tasdiqlanmaguncha bu yerga
  // real terminalning haqiqiy stavkasi qo'yilishi kerak. `_RECEIPT_TIN` /
  // `_RECEIPT_PINFL` — kamida BITTASI SHART (ikkalasi birga bo'lmaydi);
  // hech biri yo'q bo'lsa `register()` `NOT_CONFIGURED` bilan fail-closed.
  UZUM_CHECKOUT_SPIC?: string;
  UZUM_CHECKOUT_PACKAGE_CODE?: string;
  UZUM_CHECKOUT_VAT_PERCENT?: string;
  UZUM_CHECKOUT_RECEIPT_TIN?: string;
  UZUM_CHECKOUT_RECEIPT_PINFL?: string;
  // Ixtiyoriy — chiquvchi so'rov `Content-Language` sarlavhasi. Uzum FAQAT
  // `ru-RU`/`uz-UZ`/`en-EN` qabul qiladi (tasdiqlangan); default `uz-UZ`.
  UZUM_CHECKOUT_CONTENT_LANGUAGE?: string;
  // Uzum Checkout CHIQUVCHI (outbound) so'rovlari uchun IXTIYORIY forward-proxy
  // URL (`http://user:pass@host:port`). FAQAT `UzumCheckoutProvider`ning
  // chiquvchi metodlari (`register` / `getOrderStatus` / `getOperationState`
  // / `refund`) shu proxy orqali chiqadi — statik chiquvchi IP kafolati uchun
  // (Uzum merchant allowlist). Bo'sh bo'lsa — Uzum Checkout so'rovlari ham
  // odatdagi to'g'ridan-to'g'ri marshrut bilan boradi. Boshqa HECH BIR
  // `fetch()` (SMS, email, CBU kurs, webhook yetkazish, OAuth, ...) bunga
  // ta'sir qilmaydi — `setGlobalDispatcher` ISHLATILMAYDI.
  UZUM_CHECKOUT_HTTPS_PROXY?: string;
  // QA/test-only: haqiqiy imzo sxemasi sozlanmagan bo'lsa (hozirgi holat —
  // rasmiy spec yo'q) callback signature tekshiruvini o'tkazib yuborishga
  // ruxsat beradi — FAQAT production BO'LMAGANDA (`NODE_ENV==='production'`
  // bo'lsa har doim e'tiborga olinmaydi, qiymatidan qat'i nazar). Boshqa
  // hech qanday himoya (order lookup/amount/currency/idempotency/terminal-
  // holat) bu bilan o'chirilmaydi. `ENABLE_DEMO_AUTH`dan MUSTAQIL — bu OTP
  // emas, to'lov callback'i uchun.
  UZUM_CHECKOUT_TEST_MODE: string;
  DB_CONNECTION_TIMEOUT_MS: number;
  DB_QUERY_TIMEOUT_MS: number;
  DB_QUERY_ATTEMPTS: number;
  DB_POOL_MAX: number;
  DB_IDLE_TIMEOUT_MS: number;
  SLOW_REQUEST_MS: number;
  SLOW_QUERY_MS: number;
  CACHE_ENABLED: string;
  CACHE_DEFAULT_TTL_SECONDS: number;
  STORAGE_ENDPOINT?: string;
  STORAGE_REGION: string;
  STORAGE_BUCKET_PUBLIC?: string;
  STORAGE_BUCKET_PRIVATE?: string;
  STORAGE_ACCESS_KEY_ID?: string;
  STORAGE_SECRET_ACCESS_KEY?: string;
  STORAGE_PUBLIC_BASE_URL?: string;
  STORAGE_FORCE_PATH_STYLE?: string;
  CORS_ORIGINS?: string;
  SWAGGER_ENABLED: string;
  SMTP_HOST?: string;
  SMTP_PORT?: number;
  SMTP_USER?: string;
  SMTP_PASS?: string;
  SMTP_FROM?: string;
  RESEND_API_KEY?: string;
  RESEND_FROM?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GOOGLE_CALLBACK_URL?: string;
  FACEBOOK_APP_ID?: string;
  FACEBOOK_APP_SECRET?: string;
  FACEBOOK_CALLBACK_URL?: string;
}

function toNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * MUHIM: `ConfigModule.forRoot({ validate: validateEnv })` ishlatilganda,
 * NestJS FAQAT shu funksiya qaytargan obyektdagi kalitlarni `process.env`ga
 * yozadi (`@nestjs/config`ning `assignVariablesToProcess` xatti-harakati) —
 * `.env` faylida bor, lekin bu yerda (`EnvironmentConfig`da) qaytarilmagan
 * har qanday o'zgaruvchi butun ilova davomida `process.env.X` orqali doim
 * `undefined` bo'lib qoladi, hatto haqiqiy `.env` faylida to'g'ri qiymati
 * bo'lsa ham. Shu sabab, agar biror joyda yangi `process.env.YANGI_VAR`
 * o'qiladigan bo'lsa, uni albatta shu faylga (interfeys + return obyekti)
 * ham qo'shish kerak — aks holda u productionda "sirli" ravishda hech
 * qachon ishlamaydi (HOST va ENABLE_DEMO_AUTH aynan shu sabab ishlamay
 * qolgan edi).
 */
export function validateEnv(
  config: Record<string, unknown>,
): EnvironmentConfig {
  const nodeEnv = String(config.NODE_ENV ?? 'development');
  const production = nodeEnv === 'production';

  if (production) {
    for (const key of [
      'DATABASE_URL',
      'REDIS_URL',
      'JWT_ACCESS_SECRET',
      'JWT_REFRESH_SECRET',
      'TOTP_ENCRYPTION_KEY',
      'OTP_PEPPER',
      'PARTNER_API_KEY_PEPPER',
      'PAYMENT_WEBHOOK_SECRET',
      'RECOVERY_CODE_PEPPER',
      'PARTNER_WEBHOOK_SIGNING_SECRET',
      'CORS_ORIGINS',
    ]) {
      if (!config[key]) {
        throw new Error(`${key} production muhitida majburiy`);
      }
    }

    for (const key of [
      'JWT_ACCESS_SECRET',
      'JWT_REFRESH_SECRET',
      'TOTP_ENCRYPTION_KEY',
      'OTP_PEPPER',
      'PARTNER_API_KEY_PEPPER',
      'PAYMENT_WEBHOOK_SECRET',
      'RECOVERY_CODE_PEPPER',
      'PARTNER_WEBHOOK_SIGNING_SECRET',
    ]) {
      if (isWeakSecret(config[key] ? String(config[key]) : undefined)) {
        throw new Error(`${key} production uchun kuchli qiymat bo'lishi kerak`);
      }
    }

    if (String(config.CORS_ORIGINS).includes('*')) {
      throw new Error(
        'CORS_ORIGINS production muhitida * bo‘lishi mumkin emas',
      );
    }

    if (
      String(config.UZUM_CHECKOUT_TEST_MODE ?? 'false').toLowerCase() === 'true'
    ) {
      // QATTIQ rad etamiz (ogohlantirish EMAS) — bu ENABLE_DEMO_AUTH'dan
      // farqli, chunki bu yerda gap OTP kodini ochiq qoldirishda emas,
      // to'lov tasdiqlash (payment confirmation)ni signature'siz o'tkazib
      // yuborishda — production'da bunga hech qanday holatda yo'l qo'yib
      // bo'lmaydi. `UzumCheckoutProvider.isTestModeEnabled()` o'zi ham
      // mustaqil ravishda `NODE_ENV==='production'`ni tekshiradi (ikkinchi
      // himoya qatlami), lekin bu yerda ilova UMUMAN ISHGA TUSHMASLIGI
      // kerak — noto'g'ri sozlangan production deploy jim ravishda xavfli
      // rejimda ishga tushib qolmasligi uchun.
      throw new Error(
        'UZUM_CHECKOUT_TEST_MODE=true production muhitida bo‘lishi mumkin emas',
      );
    }

    if (String(config.ENABLE_DEMO_AUTH ?? 'false').toLowerCase() === 'true') {
      // ATAYLAB throw emas — SMS provayder hali ulanmagan davrda vaqtincha
      // ruxsat berilgan (foydalanuvchining ongli qarori). Lekin bu OTP
      // kodlarini API javobida HAR QANDAY telefon raqami uchun ochiq
      // qoldiradi — SMS provayder ulangach DARHOL ENABLE_DEMO_AUTH=false
      // qilinishi shart.
      console.warn(
        '⚠️  XAVFSIZLIK OGOHLANTIRISHI: ENABLE_DEMO_AUTH=true production muhitida yoqilgan — ' +
          'OTP kodlari API javobida HAR QANDAY telefon raqami uchun ochiq. ' +
          'SMS provayder ulangach darhol o‘chiring.',
      );
    }

    if (String(config.SWAGGER_ENABLED ?? '').toLowerCase() === 'true') {
      throw new Error(
        'SWAGGER_ENABLED production muhitida true bo‘lishi mumkin emas — API sxemasi autentifikatsiyasiz ochiq qolib ketadi',
      );
    }
  }

  // Uzum Checkout chiquvchi proxy URL'i (ixtiyoriy) — sozlangan bo'lsa
  // sintaktik jihatdan to'g'ri http/https URL bo'lishi SHART, aks holda
  // ilova ishga tushmaydi (noto'g'ri sozlangan proxy jim ravishda e'tiborsiz
  // qoldirilib, to'lov so'rovlari kutilmagan IP'dan chiqib ketmasligi uchun).
  const uzumCheckoutHttpsProxy = config.UZUM_CHECKOUT_HTTPS_PROXY
    ? String(config.UZUM_CHECKOUT_HTTPS_PROXY).trim()
    : undefined;
  if (uzumCheckoutHttpsProxy) {
    let parsedProxy: URL;
    try {
      parsedProxy = new URL(uzumCheckoutHttpsProxy);
    } catch {
      throw new Error(
        'UZUM_CHECKOUT_HTTPS_PROXY yaroqli URL bo‘lishi kerak ' +
          '(masalan http://user:parol@host:3128)',
      );
    }
    if (parsedProxy.protocol !== 'http:' && parsedProxy.protocol !== 'https:') {
      throw new Error(
        'UZUM_CHECKOUT_HTTPS_PROXY faqat http:// yoki https:// sxemasida bo‘lishi mumkin',
      );
    }
  }

  return {
    NODE_ENV: nodeEnv,
    APP_NAME: String(config.APP_NAME ?? 'safaar-api'),
    WEB_USER_URL: String(config.WEB_USER_URL ?? 'http://localhost:3000'),
    OAUTH_ALLOWED_ORIGINS: config.OAUTH_ALLOWED_ORIGINS
      ? String(config.OAUTH_ALLOWED_ORIGINS)
      : undefined,
    PORT: toNumber(config.PORT, 4000),
    HOST: String(config.HOST ?? '0.0.0.0'),
    ENABLE_DEMO_AUTH: String(config.ENABLE_DEMO_AUTH ?? 'false'),
    DEMO_AUTH_ALLOWED_PHONES: config.DEMO_AUTH_ALLOWED_PHONES
      ? String(config.DEMO_AUTH_ALLOWED_PHONES)
      : undefined,
    SMS_PROVIDER: config.SMS_PROVIDER ? String(config.SMS_PROVIDER) : undefined,
    ESKIZ_EMAIL: config.ESKIZ_EMAIL ? String(config.ESKIZ_EMAIL) : undefined,
    ESKIZ_PASSWORD: config.ESKIZ_PASSWORD
      ? String(config.ESKIZ_PASSWORD)
      : undefined,
    ESKIZ_FROM: config.ESKIZ_FROM ? String(config.ESKIZ_FROM) : undefined,
    TEXTUP_EMAIL: config.TEXTUP_EMAIL ? String(config.TEXTUP_EMAIL) : undefined,
    TEXTUP_PASSWORD: config.TEXTUP_PASSWORD
      ? String(config.TEXTUP_PASSWORD)
      : undefined,
    TEXTUP_USER_ID: config.TEXTUP_USER_ID
      ? String(config.TEXTUP_USER_ID)
      : undefined,
    TEXTUP_TEMPLATE_ID: config.TEXTUP_TEMPLATE_ID
      ? String(config.TEXTUP_TEMPLATE_ID)
      : undefined,
    TEXTUP_NICKNAME_ID: config.TEXTUP_NICKNAME_ID
      ? String(config.TEXTUP_NICKNAME_ID)
      : undefined,
    API_PREFIX: String(config.API_PREFIX ?? 'v1'),
    BUSINESS_TIMEZONE: String(config.BUSINESS_TIMEZONE ?? 'Asia/Tashkent'),
    DATABASE_URL: config.DATABASE_URL ? String(config.DATABASE_URL) : undefined,
    REDIS_URL: config.REDIS_URL ? String(config.REDIS_URL) : undefined,
    JWT_ACCESS_SECRET: config.JWT_ACCESS_SECRET
      ? String(config.JWT_ACCESS_SECRET)
      : undefined,
    JWT_REFRESH_SECRET: config.JWT_REFRESH_SECRET
      ? String(config.JWT_REFRESH_SECRET)
      : undefined,
    JWT_ACCESS_TTL: String(
      config.JWT_ACCESS_TTL ?? config.JWT_ACCESS_EXPIRES_IN ?? '15m',
    ),
    JWT_REFRESH_TTL: String(
      config.JWT_REFRESH_TTL ?? config.JWT_REFRESH_EXPIRES_IN ?? '30d',
    ),
    JWT_ISSUER: String(config.JWT_ISSUER ?? 'safaar-api'),
    JWT_AUDIENCE: String(config.JWT_AUDIENCE ?? 'safaar-clients'),
    TOTP_ENCRYPTION_KEY: config.TOTP_ENCRYPTION_KEY
      ? String(config.TOTP_ENCRYPTION_KEY)
      : undefined,
    OTP_PEPPER: config.OTP_PEPPER ? String(config.OTP_PEPPER) : undefined,
    PARTNER_API_KEY_PEPPER: config.PARTNER_API_KEY_PEPPER
      ? String(config.PARTNER_API_KEY_PEPPER)
      : undefined,
    PAYMENT_WEBHOOK_SECRET: config.PAYMENT_WEBHOOK_SECRET
      ? String(config.PAYMENT_WEBHOOK_SECRET)
      : undefined,
    RECOVERY_CODE_PEPPER: config.RECOVERY_CODE_PEPPER
      ? String(config.RECOVERY_CODE_PEPPER)
      : undefined,
    PARTNER_WEBHOOK_SIGNING_SECRET: config.PARTNER_WEBHOOK_SIGNING_SECRET
      ? String(config.PARTNER_WEBHOOK_SIGNING_SECRET)
      : undefined,
    CLICK_SERVICE_ID: config.CLICK_SERVICE_ID
      ? String(config.CLICK_SERVICE_ID)
      : undefined,
    CLICK_MERCHANT_ID: config.CLICK_MERCHANT_ID
      ? String(config.CLICK_MERCHANT_ID)
      : undefined,
    CLICK_SECRET_KEY: config.CLICK_SECRET_KEY
      ? String(config.CLICK_SECRET_KEY)
      : undefined,
    PAYME_MERCHANT_ID: config.PAYME_MERCHANT_ID
      ? String(config.PAYME_MERCHANT_ID)
      : undefined,
    PAYME_KEY: config.PAYME_KEY ? String(config.PAYME_KEY) : undefined,
    UZUM_SERVICE_ID: config.UZUM_SERVICE_ID
      ? String(config.UZUM_SERVICE_ID)
      : undefined,
    UZUM_USERNAME: config.UZUM_USERNAME
      ? String(config.UZUM_USERNAME)
      : undefined,
    UZUM_PASSWORD: config.UZUM_PASSWORD
      ? String(config.UZUM_PASSWORD)
      : undefined,
    UZUM_CHECKOUT_BASE_URL: config.UZUM_CHECKOUT_BASE_URL
      ? String(config.UZUM_CHECKOUT_BASE_URL)
      : undefined,
    UZUM_CHECKOUT_MERCHANT_ID: config.UZUM_CHECKOUT_MERCHANT_ID
      ? String(config.UZUM_CHECKOUT_MERCHANT_ID)
      : undefined,
    UZUM_CHECKOUT_TERMINAL_ID: config.UZUM_CHECKOUT_TERMINAL_ID
      ? String(config.UZUM_CHECKOUT_TERMINAL_ID)
      : undefined,
    UZUM_CHECKOUT_API_KEY: config.UZUM_CHECKOUT_API_KEY
      ? String(config.UZUM_CHECKOUT_API_KEY)
      : undefined,
    UZUM_CHECKOUT_CALLBACK_SIGN_KEY: config.UZUM_CHECKOUT_CALLBACK_SIGN_KEY
      ? String(config.UZUM_CHECKOUT_CALLBACK_SIGN_KEY)
      : undefined,
    UZUM_CHECKOUT_SIGNATURE_HEADER: config.UZUM_CHECKOUT_SIGNATURE_HEADER
      ? String(config.UZUM_CHECKOUT_SIGNATURE_HEADER)
      : undefined,
    UZUM_CHECKOUT_SIGNATURE_SCHEME: config.UZUM_CHECKOUT_SIGNATURE_SCHEME
      ? String(config.UZUM_CHECKOUT_SIGNATURE_SCHEME)
      : undefined,
    UZUM_CHECKOUT_SPIC: config.UZUM_CHECKOUT_SPIC
      ? String(config.UZUM_CHECKOUT_SPIC)
      : undefined,
    UZUM_CHECKOUT_PACKAGE_CODE: config.UZUM_CHECKOUT_PACKAGE_CODE
      ? String(config.UZUM_CHECKOUT_PACKAGE_CODE)
      : undefined,
    UZUM_CHECKOUT_VAT_PERCENT: config.UZUM_CHECKOUT_VAT_PERCENT
      ? String(config.UZUM_CHECKOUT_VAT_PERCENT)
      : undefined,
    UZUM_CHECKOUT_RECEIPT_TIN: config.UZUM_CHECKOUT_RECEIPT_TIN
      ? String(config.UZUM_CHECKOUT_RECEIPT_TIN)
      : undefined,
    UZUM_CHECKOUT_RECEIPT_PINFL: config.UZUM_CHECKOUT_RECEIPT_PINFL
      ? String(config.UZUM_CHECKOUT_RECEIPT_PINFL)
      : undefined,
    UZUM_CHECKOUT_CONTENT_LANGUAGE: config.UZUM_CHECKOUT_CONTENT_LANGUAGE
      ? String(config.UZUM_CHECKOUT_CONTENT_LANGUAGE)
      : undefined,
    UZUM_CHECKOUT_HTTPS_PROXY: uzumCheckoutHttpsProxy,
    UZUM_CHECKOUT_TEST_MODE: String(config.UZUM_CHECKOUT_TEST_MODE ?? 'false'),
    DB_CONNECTION_TIMEOUT_MS: toNumber(
      config.DB_CONNECTION_TIMEOUT_MS,
      production ? 8000 : 5000,
    ),
    DB_QUERY_TIMEOUT_MS: toNumber(
      config.DB_QUERY_TIMEOUT_MS,
      production ? 8000 : 5000,
    ),
    DB_QUERY_ATTEMPTS: toNumber(config.DB_QUERY_ATTEMPTS, production ? 3 : 1),
    DB_POOL_MAX: toNumber(config.DB_POOL_MAX, 5),
    DB_IDLE_TIMEOUT_MS: toNumber(config.DB_IDLE_TIMEOUT_MS, 10000),
    SLOW_REQUEST_MS: toNumber(config.SLOW_REQUEST_MS, 1000),
    SLOW_QUERY_MS: toNumber(config.SLOW_QUERY_MS, 300),
    CACHE_ENABLED: String(config.CACHE_ENABLED ?? 'true'),
    CACHE_DEFAULT_TTL_SECONDS: toNumber(config.CACHE_DEFAULT_TTL_SECONDS, 300),
    STORAGE_ENDPOINT: config.STORAGE_ENDPOINT
      ? String(config.STORAGE_ENDPOINT)
      : undefined,
    STORAGE_REGION: String(config.STORAGE_REGION ?? 'auto'),
    STORAGE_BUCKET_PUBLIC: config.STORAGE_BUCKET_PUBLIC
      ? String(config.STORAGE_BUCKET_PUBLIC)
      : undefined,
    STORAGE_BUCKET_PRIVATE: config.STORAGE_BUCKET_PRIVATE
      ? String(config.STORAGE_BUCKET_PRIVATE)
      : undefined,
    STORAGE_ACCESS_KEY_ID: config.STORAGE_ACCESS_KEY_ID
      ? String(config.STORAGE_ACCESS_KEY_ID)
      : undefined,
    STORAGE_SECRET_ACCESS_KEY: config.STORAGE_SECRET_ACCESS_KEY
      ? String(config.STORAGE_SECRET_ACCESS_KEY)
      : undefined,
    STORAGE_PUBLIC_BASE_URL: config.STORAGE_PUBLIC_BASE_URL
      ? String(config.STORAGE_PUBLIC_BASE_URL)
      : undefined,
    STORAGE_FORCE_PATH_STYLE: config.STORAGE_FORCE_PATH_STYLE
      ? String(config.STORAGE_FORCE_PATH_STYLE)
      : undefined,
    CORS_ORIGINS: config.CORS_ORIGINS ? String(config.CORS_ORIGINS) : undefined,
    SWAGGER_ENABLED: String(config.SWAGGER_ENABLED ?? !production),
    SMTP_HOST: config.SMTP_HOST ? String(config.SMTP_HOST) : undefined,
    SMTP_PORT: config.SMTP_PORT ? toNumber(config.SMTP_PORT, 587) : undefined,
    SMTP_USER: config.SMTP_USER ? String(config.SMTP_USER) : undefined,
    SMTP_PASS: config.SMTP_PASS ? String(config.SMTP_PASS) : undefined,
    SMTP_FROM: config.SMTP_FROM ? String(config.SMTP_FROM) : undefined,
    RESEND_API_KEY: config.RESEND_API_KEY
      ? String(config.RESEND_API_KEY)
      : undefined,
    RESEND_FROM: config.RESEND_FROM ? String(config.RESEND_FROM) : undefined,
    GOOGLE_CLIENT_ID: config.GOOGLE_CLIENT_ID
      ? String(config.GOOGLE_CLIENT_ID)
      : undefined,
    GOOGLE_CLIENT_SECRET: config.GOOGLE_CLIENT_SECRET
      ? String(config.GOOGLE_CLIENT_SECRET)
      : undefined,
    GOOGLE_CALLBACK_URL: config.GOOGLE_CALLBACK_URL
      ? String(config.GOOGLE_CALLBACK_URL)
      : undefined,
    FACEBOOK_APP_ID: config.FACEBOOK_APP_ID
      ? String(config.FACEBOOK_APP_ID)
      : undefined,
    FACEBOOK_APP_SECRET: config.FACEBOOK_APP_SECRET
      ? String(config.FACEBOOK_APP_SECRET)
      : undefined,
    FACEBOOK_CALLBACK_URL: config.FACEBOOK_CALLBACK_URL
      ? String(config.FACEBOOK_CALLBACK_URL)
      : undefined,
  };
}
