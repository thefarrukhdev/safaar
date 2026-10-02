import {
  createHmac,
  randomBytes,
  timingSafeEqual,
  type BinaryLike,
} from 'node:crypto';
import * as argon2 from 'argon2';
import { Role, type ActorType } from '@safaar/types';
import { assertStrongSecret } from '../config/secret-strength';

export type TokenType = 'access' | 'refresh';

export interface SignedJwtPayload {
  sub: string;
  role: Role;
  roles: Role[];
  actor_type: ActorType;
  organization_id?: string | null;
  session_id: string;
  token_type: TokenType;
  family_id?: string;
  jti: string;
  iss: string;
  aud: string;
  iat: number;
  exp: number;
}

export interface JwtSecurityConfig {
  accessSecret: string;
  refreshSecret: string;
  issuer: string;
  audience: string;
  accessTtlSeconds: number;
  refreshTtlSeconds: number;
}

const defaultIssuer = 'safaar-api';
const defaultAudience = 'safaar-clients';

export function nodeEnv(): string {
  return String(process.env.NODE_ENV ?? 'development');
}

export function isProduction(): boolean {
  return nodeEnv() === 'production';
}

// Faqat development/test uchun: agar JWT secret .env'da berilmagan bo'lsa,
// har kim o'qiy oladigan hardcoded satr o'rniga jarayon boshlanganda BIR
// marta tasodifiy secret generatsiya qilamiz (keyingi chaqiruvlarda xotirada
// keshlanadi). Bu uchta narsani ta'minlaydi: (1) manba kodda "haqiqiy
// ko'ringan" secret umuman yo'q — leak qiladigan narsa yo'q; (2) har process
// qayta ishga tushganda oldingi token'lar avtomatik yaroqsiz bo'ladi — dev
// uchun mutlaqo qabul qilinadigan narsa; (3) bu qiymat productionga
// "tasodifan to'g'ri kelib qolish" imkoniyati yo'q, chunki u haqiqatan ham
// har safar boshqacha.
let ephemeralAccessSecret: string | undefined;
let ephemeralRefreshSecret: string | undefined;

function resolveJwtSecret(
  envVar: 'JWT_ACCESS_SECRET' | 'JWT_REFRESH_SECRET',
): string {
  const value = process.env[envVar];

  if (isProduction()) {
    // `env.validation.ts` (ConfigModule) bu qiymatni ilova ishga
    // tushishidan OLDIN, kuchliligi bilan birga tekshiradi va zaif/yo'q
    // bo'lsa boot'ni butunlay to'xtatadi — shu sabab bu yerda qayta
    // "kuchlimi" deb tekshirish shart emas (bu takroriy mantiq bo'lardi).
    // Quyidagi chaqiruv faqat ikkinchi mudofaa chizig'i: agar u boot-time
    // tekshiruv negadir chetlab o'tilgan bo'lsa (masalan test muhitida
    // NODE_ENV noto'g'ri sozlangan holda), bu yerda ham qat'iyan rad
    // etiladi — bo'sh/zaif qiymat bilan token imzolashga yo'l qo'yilmaydi.
    assertStrongSecret(envVar, value);
    return value;
  }

  if (value) {
    return value;
  }

  if (envVar === 'JWT_ACCESS_SECRET') {
    ephemeralAccessSecret ??= randomBytes(48).toString('base64url');
    return ephemeralAccessSecret;
  }
  ephemeralRefreshSecret ??= randomBytes(48).toString('base64url');
  return ephemeralRefreshSecret;
}

/**
 * Faqat testlar uchun: process-darajasidagi ephemeral dev-secret keshini
 * tozalaydi, shunda keyingi `jwtSecurityConfig()` chaqiruvi "yangi process"
 * holatini simulyatsiya qilib, qaytadan tasodifiy qiymat generatsiya
 * qiladi. Production kodda hech qachon chaqirilmaydi.
 */
export function resetEphemeralJwtSecretsForTests(): void {
  ephemeralAccessSecret = undefined;
  ephemeralRefreshSecret = undefined;
}

export function jwtSecurityConfig(): JwtSecurityConfig {
  return {
    accessSecret: resolveJwtSecret('JWT_ACCESS_SECRET'),
    refreshSecret: resolveJwtSecret('JWT_REFRESH_SECRET'),
    issuer: process.env.JWT_ISSUER ?? defaultIssuer,
    audience: process.env.JWT_AUDIENCE ?? defaultAudience,
    accessTtlSeconds: parseDurationSeconds(
      process.env.JWT_ACCESS_TTL ?? process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
    ),
    refreshTtlSeconds: parseDurationSeconds(
      process.env.JWT_REFRESH_TTL ??
        process.env.JWT_REFRESH_EXPIRES_IN ??
        '30d',
    ),
  };
}

export function parseDurationSeconds(value: string): number {
  const match = value.trim().match(/^(\d+)([smhd])?$/i);
  if (!match) {
    throw new Error(`Yaroqsiz vaqt formati: ${value}`);
  }

  const amount = Number(match[1]);
  const unit = (match[2] ?? 's').toLowerCase();
  const multipliers: Record<string, number> = {
    s: 1,
    m: 60,
    h: 3600,
    d: 86_400,
  };

  return amount * multipliers[unit];
}

export function signJwt(
  payload: Omit<SignedJwtPayload, 'iat' | 'exp' | 'iss' | 'aud' | 'token_type'>,
  type: TokenType,
): string {
  const config = jwtSecurityConfig();
  const now = Math.floor(Date.now() / 1000);
  const ttlSeconds =
    type === 'access' ? config.accessTtlSeconds : config.refreshTtlSeconds;
  const fullPayload: SignedJwtPayload = {
    ...payload,
    token_type: type,
    iss: config.issuer,
    aud: config.audience,
    iat: now,
    exp: now + ttlSeconds,
  };

  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const signature = hmacSha256(
    `${encodedHeader}.${encodedPayload}`,
    type === 'access' ? config.accessSecret : config.refreshSecret,
  );

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

export function verifyJwt(
  token: string,
  expectedType: TokenType,
): SignedJwtPayload | undefined {
  const [encodedHeader, encodedPayload, signature, extra] = token.split('.');
  if (!encodedHeader || !encodedPayload || !signature || extra) {
    return undefined;
  }

  const header = parseJson<Record<string, unknown>>(
    base64UrlDecode(encodedHeader),
  );
  if (!header || header.alg !== 'HS256' || header.typ !== 'JWT') {
    return undefined;
  }

  const config = jwtSecurityConfig();
  const secret =
    expectedType === 'access' ? config.accessSecret : config.refreshSecret;
  const expectedSignature = hmacSha256(
    `${encodedHeader}.${encodedPayload}`,
    secret,
  );
  if (!timingSafeEqualString(signature, expectedSignature)) {
    return undefined;
  }

  const payload = parseJson<SignedJwtPayload>(base64UrlDecode(encodedPayload));
  if (!payload || payload.token_type !== expectedType) {
    return undefined;
  }

  const now = Math.floor(Date.now() / 1000);
  if (
    payload.iss !== config.issuer ||
    payload.aud !== config.audience ||
    !payload.sub ||
    !payload.session_id ||
    !payload.jti ||
    payload.exp <= now ||
    !Object.values(Role).includes(payload.role)
  ) {
    return undefined;
  }

  return payload;
}

export function hashSecret(value: string, pepper = ''): string {
  return createHmac('sha256', pepper || 'safaar-local-pepper')
    .update(value)
    .digest('hex');
}

export function randomToken(bytes = 32): string {
  return base64UrlEncode(randomBytes(bytes));
}

export function hmacSha256(value: BinaryLike, secret: string): string {
  return createHmac('sha256', secret).update(value).digest('base64url');
}

export function timingSafeEqualString(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
}

export function paymentWebhookSecret(): string | undefined {
  return (
    process.env.PAYMENT_WEBHOOK_SECRET ??
    process.env.PARTNER_WEBHOOK_SIGNING_SECRET ??
    process.env.CLICK_SECRET_KEY ??
    undefined
  );
}

export function partnerApiPepper(): string {
  return process.env.PARTNER_API_KEY_PEPPER ?? 'development-partner-api-pepper';
}

/**
 * Hamkorga chiqadigan (outbound) webhook'larni imzolash uchun ishlatiladi
 * — bu `paymentWebhookSecret()`dan (kiruvchi to'lov webhook'larini
 * tekshirish) mantiqan alohida narsa, hozircha faqat ular tasodifan bir
 * xil env o'zgaruvchini fallback sifatida ishlatishi mumkin.
 */
export function partnerWebhookSigningSecret(): string | undefined {
  return process.env.PARTNER_WEBHOOK_SIGNING_SECRET || undefined;
}

export function base64UrlEncode(value: string | Buffer): string {
  return Buffer.from(value).toString('base64url');
}

export function base64UrlDecode(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function parseJson<T>(value: string): T | undefined {
  try {
    return JSON.parse(value) as T;
  } catch {
    return undefined;
  }
}

/**
 * Foydalanuvchi/hamkor parolini xavfsiz argon2id orqali xeshlaydi.
 */
export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password);
}

/**
 * Parolni xesh bilan solishtiradi (vaqt hujumlaridan himoyalangan).
 */
export async function verifyPassword(
  hash: string,
  plain: string,
): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}
