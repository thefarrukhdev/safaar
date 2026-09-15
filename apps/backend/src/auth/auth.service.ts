import {
  BadRequestException,
  HttpException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import * as argon2 from 'argon2';
import {
  Role,
  type ActorType,
  type VerifyOtpDto,
  type AuthTokens,
  type OAuthExchangeResult,
  type OAuthProvider,
  type OAuthProviderAvailability,
} from '@safaar/types';
import type { RequestActor } from '../common/actor';
import {
  PostgresService,
  type PostgresTransaction,
} from '../infrastructure/postgres.service';
import { JobQueueService } from '../infrastructure/job-queue.service';
import { EmailService } from '../infrastructure/email.service';
import { SmsService } from '../infrastructure/sms.service';
import { AppCacheService } from '../infrastructure/cache.service';
import { otpStore, type OtpPurpose } from './otp-store';
import { authSessionStore } from './session-store';
import { signJwt, verifyJwt } from './security';
import { createTotpSetup, verifyTotpCode, type TotpSetup } from './totp';

type DbRow = Record<string, unknown>;

function isUniqueViolation(error: unknown, constraintName: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: string }).code === '23505' &&
    (error as { constraint?: string }).constraint === constraintName
  );
}

interface AdminUserRecord {
  id: string;
  email: string;
  username: string;
  password_hash: string;
  full_name?: string;
  role: Role;
  roles: Role[];
  status: string;
  totp_secret?: string;
  created_at: string;
  updated_at: string;
}

interface PartnerUserRecord {
  id: string;
  organization_id: string;
  email: string;
  password_hash: string;
  full_name?: string;
  status: string;
  role: string;
  created_at: string;
  updated_at: string;
}

interface IssueTokenInput {
  actorId: string;
  actorType: ActorType;
  role: Role;
  roles?: Role[];
  organizationId?: string | null;
}

interface TwoFactorChallenge {
  id: string;
  admin: AdminUserRecord;
  expiresAt: number;
}

interface OAuthStateContext {
  provider: OAuthProvider;
  locale: 'uz' | 'ru' | 'en';
  next: string;
  origin: string;
}

interface OAuthExchangeLoginContext {
  userId: string;
}

interface OAuthExchangeRegisterContext {
  provider: OAuthProvider;
  profile: OAuthProfile;
}

type OAuthExchangeContext =
  | OAuthExchangeLoginContext
  | OAuthExchangeRegisterContext;

function isOAuthExchangeRegisterContext(
  context: OAuthExchangeContext,
): context is OAuthExchangeRegisterContext {
  return 'profile' in context;
}

interface OAuthRegistrationContext {
  provider: OAuthProvider;
  providerUserId: string;
  email: string;
  emailVerified: boolean;
  firstName?: string;
  lastName?: string;
}

type OAuthUpsertResult =
  | { kind: 'login'; userId: string }
  | { kind: 'register'; profile: OAuthProfile };

interface PasswordResetContext {
  phone: string;
  actorType: 'user' | 'partner';
}

interface OAuthProfile {
  providerUserId: string;
  email: string;
  emailVerified: boolean;
  firstName?: string;
  lastName?: string;
}

export interface OAuthRegistrationRequiredResult {
  requiresRegistration: true;
  registrationToken: string;
  provider: OAuthProvider;
  email: string;
  firstName?: string;
  lastName?: string;
}

interface CompleteOAuthRegistrationInput {
  provider: string;
  registration_token: string;
  phone: string;
  code: string;
  challenge_id?: string;
  first_name?: string;
  last_name?: string;
}

@Injectable()
export class AuthService {
  private readonly twoFactorChallenges = new Map<string, TwoFactorChallenge>();
  private readonly pendingTotpSetups = new Map<
    string,
    { adminId: string; setup: TotpSetup; expiresAt: number }
  >();

  constructor(
    private readonly pg: PostgresService,
    private readonly jobs: JobQueueService,
    private readonly emailService: EmailService,
    private readonly smsService: SmsService,
    private readonly cache: AppCacheService,
  ) {}

  sendUserOtp(phone: string) {
    return this.sendOtpDemoOrFail(this.normalizePhone(phone), 'user_login');
  }

  sendPartnerOtp(phone: string) {
    return this.sendOtpDemoOrFail(this.normalizePhone(phone), 'partner_login');
  }

  async verifyUserOtp(
    dto: VerifyOtpDto,
  ): Promise<AuthTokens & { user: unknown }> {
    const phone = this.normalizePhone(dto.phone);
    this.consumeOtp({
      challengeId: dto.challenge_id,
      phone,
      purpose: 'user_login',
      code: dto.code,
    });

    const rows = await this.pg.query<DbRow>(
      `SELECT id::text, phone, status, preferred_language, bonus_balance,
              first_name, last_name, email, phone_verified_at, last_login_at,
              created_at, updated_at
       FROM users
       WHERE phone = $1
       LIMIT 1`,
      [phone],
    );

    let user: DbRow;
    if (rows.length === 0) {
      const id = randomUUID();
      const now = new Date().toISOString();
      await this.pg.query(
        `INSERT INTO users (id, phone, status, preferred_language, bonus_balance, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [id, phone, 'active', 'uz', 0, now, now],
      );
      user = {
        id,
        phone,
        status: 'active',
        preferred_language: 'uz',
        bonus_balance: 0,
        first_name: null,
        last_name: null,
        email: null,
        phone_verified_at: null,
        last_login_at: null,
        created_at: now,
        updated_at: now,
      };
    } else {
      user = rows[0];
    }

    return {
      ...(await this.issueTokens({
        actorId: String(user['id']),
        actorType: 'user',
        role: Role.USER,
      })),
      user,
    };
  }

  async verifyPartnerOtp(dto: VerifyOtpDto): Promise<AuthTokens> {
    const phone = this.normalizePhone(dto.phone);
    this.consumeOtp({
      challengeId: dto.challenge_id,
      phone,
      purpose: 'partner_login',
      code: dto.code,
    });

    return this.issuePartnerTokensByPhone(phone);
  }

  async completeProfile(
    actor: RequestActor | undefined,
    body: Record<string, unknown>,
  ) {
    const currentActor = this.requireActor(actor, 'user');

    const rows = await this.pg.query<DbRow>(
      `SELECT id::text, phone, status, preferred_language, bonus_balance,
              first_name, last_name, email, password_hash, created_at, updated_at
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [currentActor.id],
    );

    if (rows.length === 0) {
      throw new UnauthorizedException({
        code: 'AUTH_INVALID_CREDENTIALS',
        message: 'User topilmadi',
      });
    }

    const firstName = String(
      body.first_name ?? body.firstName ?? rows[0]['first_name'] ?? '',
    );
    const lastName = String(
      body.last_name ?? body.lastName ?? rows[0]['last_name'] ?? '',
    );
    const phoneInput = body.phone ?? body.phone_number ?? body.phoneNumber;
    const phoneDigits = String(phoneInput ?? '').replace(/\D/g, '');
    const phone = phoneDigits
      ? this.normalizePhone(String(phoneInput))
      : rows[0]['phone'];
    const email = body.email
      ? String(body.email).toLowerCase()
      : rows[0]['email'];
    const preferredLanguage = ['uz', 'ru', 'en'].includes(
      String(body.preferred_language),
    )
      ? String(body.preferred_language)
      : rows[0]['preferred_language'];
    const passwordHash = body.password
      ? await argon2.hash(String(body.password))
      : rows[0]['password_hash'];
    const now = new Date().toISOString();

    if (
      phoneDigits &&
      !(
        phoneDigits.length === 9 ||
        (phoneDigits.startsWith('998') && phoneDigits.length === 12)
      )
    ) {
      throw new BadRequestException({
        code: 'PHONE_INVALID',
        message: "To'g'ri telefon raqam kiriting",
      });
    }

    if (phone) {
      const existingPhone = await this.pg.query<DbRow>(
        `SELECT id::text
         FROM users
         WHERE phone = $1 AND id <> $2
         LIMIT 1`,
        [phone, currentActor.id],
      );
      if (existingPhone.length > 0) {
        throw new BadRequestException({
          code: 'PHONE_ALREADY_EXISTS',
          message: 'Bu telefon raqami boshqa foydalanuvchiga biriktirilgan',
        });
      }
    }

    await this.pg.query(
      `UPDATE users
       SET first_name = $1, last_name = $2, phone = $3, email = $4,
           preferred_language = $5, password_hash = $6, updated_at = $7
       WHERE id = $8`,
      [
        firstName,
        lastName,
        phone,
        email,
        preferredLanguage,
        passwordHash,
        now,
        currentActor.id,
      ],
    );

    return {
      ...rows[0],
      first_name: firstName,
      last_name: lastName,
      phone,
      email,
      preferred_language: preferredLanguage,
      updated_at: now,
    };
  }

  oauthProviders(): OAuthProviderAvailability {
    return {
      google: this.oauthConfigured('google'),
      facebook: this.oauthConfigured('facebook'),
    };
  }

  async oauthRedirect(
    provider: OAuthProvider,
    input: { locale?: unknown; next?: unknown; origin?: unknown },
  ) {
    const config = this.oauthConfig(provider);
    const state = randomBytes(32).toString('base64url');
    const origin = this.oauthOrigin(input.origin);
    const context: OAuthStateContext = {
      provider,
      locale: this.oauthLocale(input.locale),
      next: this.safeNext(input.next),
      origin,
    };
    await this.cache.set(this.oauthStateKey(state), context, 10 * 60);

    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.callbackUrl,
      response_type: 'code',
      state,
    });
    if (provider === 'google') {
      params.set('scope', 'openid email profile');
      params.set('prompt', 'select_account');
    } else {
      params.set('scope', 'email,public_profile');
    }

    return {
      state,
      origin,
      redirectUrl:
        provider === 'google'
          ? `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
          : `https://www.facebook.com/v22.0/dialog/oauth?${params.toString()}`,
    };
  }

  /**
   * OAuth callback muvaffaqiyatli/muvaffaqiyatsiz bo'lganda foydalanuvchi
   * qaysi frontend'ga qaytarilishi kerakligini aniqlaydi — faqat
   * `OAUTH_ALLOWED_ORIGINS` (yoki yagona `WEB_USER_URL`) ro'yxatidagi aniq
   * origin'lar qabul qilinadi. Noma'lum/soxta qiymat hech qachon
   * ishlatilmaydi (open redirect oldini olish) — ro'yxatdagi birinchi
   * (asosiy) origin'ga qaytariladi.
   */
  private allowedOAuthOrigins(): string[] {
    const primary = (
      process.env.WEB_USER_URL ?? 'http://localhost:3000'
    ).replace(/\/$/, '');
    const raw = process.env.OAUTH_ALLOWED_ORIGINS;
    if (!raw) return [primary];
    const origins = raw
      .split(',')
      .map((origin) => origin.trim().replace(/\/$/, ''))
      .filter(Boolean);
    return origins.length > 0 ? origins : [primary];
  }

  private oauthOrigin(value: unknown): string {
    const allowed = this.allowedOAuthOrigins();
    const candidate = String(value ?? '')
      .trim()
      .replace(/\/$/, '');
    return allowed.includes(candidate) ? candidate : allowed[0];
  }

  async oauthCallback(
    provider: OAuthProvider,
    input: {
      code?: unknown;
      state?: unknown;
      error?: unknown;
    },
    cookieState: string | undefined,
  ): Promise<{ code: string; locale: string; next: string; origin: string }> {
    const state = String(input.state ?? '');
    const providerError = String(input.error ?? '');
    if (providerError || !state || !cookieState || state !== cookieState) {
      throw new UnauthorizedException({
        code: providerError ? 'OAUTH_CANCELLED' : 'OAUTH_STATE_INVALID',
        message: providerError
          ? 'Ijtimoiy tarmoq orqali kirish bekor qilindi'
          : 'OAuth state yaroqsiz',
      });
    }

    const context = await this.cache.take<OAuthStateContext>(
      this.oauthStateKey(state),
    );
    if (!context || context.provider !== provider) {
      throw new UnauthorizedException({
        code: 'OAUTH_STATE_EXPIRED',
        message: 'OAuth so\u2018rovi muddati tugagan',
      });
    }

    const authorizationCode = String(input.code ?? '');
    if (!authorizationCode) {
      throw new UnauthorizedException({
        code: 'OAUTH_CODE_MISSING',
        message: 'OAuth tasdiqlash kodi topilmadi',
      });
    }

    const profile = await this.fetchOAuthProfile(provider, authorizationCode);

    const upsertResult = await this.upsertOAuthUser(provider, profile);

    const exchangeCode = randomBytes(32).toString('base64url');
    await this.cache.set<OAuthExchangeContext>(
      this.oauthExchangeKey(exchangeCode),
      upsertResult.kind === 'login'
        ? { userId: upsertResult.userId }
        : { provider, profile: upsertResult.profile },
      60,
    );

    return {
      code: exchangeCode,
      locale: context.locale,
      next: context.next,
      origin: context.origin,
    };
  }

  async oauthExchange(
    code: string,
  ): Promise<OAuthExchangeResult | OAuthRegistrationRequiredResult> {
    const normalizedCode = code.trim();
    const context = normalizedCode
      ? await this.cache.take<OAuthExchangeContext>(
          this.oauthExchangeKey(normalizedCode),
        )
      : undefined;
    if (!context) {
      throw new UnauthorizedException({
        code: 'OAUTH_EXCHANGE_INVALID',
        message: 'OAuth kirish kodi yaroqsiz yoki ishlatilgan',
      });
    }

    if (isOAuthExchangeRegisterContext(context)) {
      const registrationToken = randomBytes(32).toString('base64url');
      await this.cache.set<OAuthRegistrationContext>(
        this.oauthRegistrationKey(registrationToken),
        {
          provider: context.provider,
          providerUserId: context.profile.providerUserId,
          email: context.profile.email,
          emailVerified: context.profile.emailVerified,
          firstName: context.profile.firstName,
          lastName: context.profile.lastName,
        },
        30 * 60,
      );
      return {
        requiresRegistration: true,
        registrationToken,
        provider: context.provider,
        email: context.profile.email,
        firstName: context.profile.firstName,
        lastName: context.profile.lastName,
      };
    }

    const rows = await this.pg.query<DbRow>(
      `SELECT id::text, email, first_name, last_name
       FROM users
       WHERE id = $1::uuid AND deleted_at IS NULL AND status = 'active'
       LIMIT 1`,
      [context.userId],
    );
    const user = this.oauthUser(rows[0]);

    return {
      ...(await this.issueTokens({
        actorId: user.id,
        actorType: 'user',
        role: Role.USER,
      })),
      user,
    };
  }

  async completeOAuthRegistration(
    dto: CompleteOAuthRegistrationInput,
  ): Promise<AuthTokens & { user: unknown }> {
    const provider = dto.provider as OAuthProvider;
    const registrationKey = this.oauthRegistrationKey(dto.registration_token);

    // Avval faqat "peek" qilamiz (o'chirmasdan) — noto'g'ri/eskirgan OTP
    // kod kiritilsa ham bir martalik registration token bekor bo'lib
    // qolmasin (aks holda foydalanuvchi shunchaki kodni xato kiritgani
    // uchun butun Google OAuth jarayonini boshidan qaytarishga majbur
    // bo'lardi). Token faqat OTP muvaffaqiyatli tasdiqlangandan keyin,
    // haqiqatan ishlatilayotganda `.take()` bilan iste'mol qilinadi.
    const peekedContext =
      await this.cache.get<OAuthRegistrationContext>(registrationKey);
    if (!peekedContext || peekedContext.provider !== provider) {
      throw new UnauthorizedException({
        code: 'OAUTH_REGISTRATION_EXPIRED',
        message: "Ro'yxatdan o'tish sessiyasi muddati tugagan",
      });
    }

    const verified = await this.verifyUserOtp({
      phone: dto.phone,
      code: dto.code,
      challenge_id: dto.challenge_id,
    });

    const registrationContext =
      await this.cache.take<OAuthRegistrationContext>(registrationKey);
    if (!registrationContext || registrationContext.provider !== provider) {
      throw new UnauthorizedException({
        code: 'OAUTH_REGISTRATION_EXPIRED',
        message: "Ro'yxatdan o'tish sessiyasi muddati tugagan",
      });
    }

    const userId = String((verified.user as DbRow)['id']);
    const now = new Date().toISOString();
    const firstName =
      dto.first_name?.trim() || registrationContext.firstName || null;
    const lastName =
      dto.last_name?.trim() || registrationContext.lastName || null;
    const email = registrationContext.emailVerified
      ? registrationContext.email
      : null;

    try {
      await this.pg.transaction(async (transaction) => {
        const conflictRows = await transaction.query<DbRow>(
          `SELECT 1 FROM user_social_accounts
           WHERE provider = $1 AND provider_user_id = $2 AND user_id <> $3::uuid
           LIMIT 1`,
          [provider, registrationContext.providerUserId, userId],
        );
        if (conflictRows.length > 0) {
          throw new BadRequestException({
            code: 'OAUTH_ACCOUNT_ALREADY_LINKED',
            message: 'Bu hisob boshqa foydalanuvchiga ulangan',
          });
        }

        const existingLinkRows = await transaction.query<DbRow>(
          `SELECT provider_user_id FROM user_social_accounts
           WHERE user_id = $1::uuid AND provider = $2
           LIMIT 1`,
          [userId, provider],
        );
        if (!existingLinkRows[0]) {
          await transaction.query(
            `INSERT INTO user_social_accounts
               (id, user_id, provider, provider_user_id, provider_email,
                email_verified, created_at, updated_at)
             VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $7)`,
            [
              randomUUID(),
              userId,
              provider,
              registrationContext.providerUserId,
              registrationContext.email,
              registrationContext.emailVerified,
              now,
            ],
          );
        }

        await transaction.query(
          `UPDATE users
           SET email = coalesce(email, $2),
               email_verified_at = CASE WHEN $2 IS NOT NULL THEN coalesce(email_verified_at, $3) ELSE email_verified_at END,
               first_name = coalesce(first_name, $4),
               last_name = coalesce(last_name, $5),
               updated_at = $3
           WHERE id = $1::uuid`,
          [userId, email, now, firstName, lastName],
        );
      });
    } catch (error) {
      if (isUniqueViolation(error, 'users_email_key')) {
        throw new BadRequestException({
          code: 'EMAIL_ALREADY_EXISTS',
          message: 'Bu email boshqa foydalanuvchiga tegishli',
        });
      }
      throw error;
    }

    const refreshedRows = await this.pg.query<DbRow>(
      `SELECT id::text, phone, status, preferred_language, bonus_balance,
              first_name, last_name, email, phone_verified_at, last_login_at,
              created_at, updated_at
       FROM users
       WHERE id = $1::uuid
       LIMIT 1`,
      [userId],
    );

    return {
      accessToken: verified.accessToken,
      refreshToken: verified.refreshToken,
      user: refreshedRows[0] ?? verified.user,
    };
  }

  oauthToken(provider: OAuthProvider, body: Record<string, unknown>) {
    void body;
    throw new ServiceUnavailableException({
      code: 'OAUTH_PROVIDER_NOT_CONFIGURED',
      message: `${provider} OAuth provider rasmiy token verifikatsiyasi ulanmagan`,
    });
  }

  async socialAccounts(actor: RequestActor | undefined) {
    const currentActor = this.requireActor(actor, 'user');
    return this.pg.query<DbRow>(
      `SELECT id::text, user_id::text, provider, provider_user_id,
              provider_email, email_verified, created_at, updated_at
       FROM user_social_accounts
       WHERE user_id = $1::uuid
       ORDER BY created_at DESC`,
      [currentActor.id],
    );
  }

  async unlinkSocialAccount(actor: RequestActor | undefined, id: string) {
    const currentActor = this.requireActor(actor, 'user');
    const rows = await this.pg.query<DbRow>(
      `DELETE FROM user_social_accounts
       WHERE id = $1::uuid AND user_id = $2::uuid
       RETURNING id::text, provider`,
      [id, currentActor.id],
    );
    return rows[0] ?? { id, deleted: true };
  }

  async partnerLogin(body: Record<string, unknown>) {
    const email = String(body.email ?? '')
      .trim()
      .toLowerCase();
    const password = String(body.password ?? '');
    const lockoutKey = await this.assertNotLockedOut('partner', email);
    const partnerUser = await this.findPartnerUser(email);

    if (
      !partnerUser ||
      partnerUser.status !== 'active' ||
      !(await this.verifyPassword(partnerUser.password_hash, password))
    ) {
      await this.recordFailedLogin(lockoutKey);
      throw this.invalidCredentials();
    }
    await this.resetLoginAttempts(lockoutKey);

    const orgRows = await this.pg.query<DbRow>(
      `SELECT id::text, status
       FROM partner_organizations
       WHERE id = $1
       LIMIT 1`,
      [partnerUser.organization_id],
    );
    const organization = orgRows[0];

    const organizationStatus = String(organization?.['status'] ?? '');
    if (!this.isPartnerLoginStatusAllowed(organizationStatus)) {
      throw new UnauthorizedException({
        code: 'PARTNER_NOT_ACTIVE',
        message: 'Hamkor tashkilot faol emas',
      });
    }

    return {
      ...(await this.issueTokens({
        actorId: partnerUser.id,
        actorType: 'partner',
        role: Role.PARTNER,
        organizationId: partnerUser.organization_id,
      })),
      organization_id: partnerUser.organization_id,
      organizationId: partnerUser.organization_id,
      organization_status: organizationStatus,
      organizationStatus,
      partner_role: partnerUser.role,
    };
  }

  async userLogin(body: Record<string, unknown>) {
    const email = this.normalizeEmail(body.email);
    const password = String(body.password ?? '');

    if (!this.isValidEmail(email) || !password) {
      throw this.invalidCredentials();
    }

    const lockoutKey = await this.assertNotLockedOut('user', email);

    const rows = await this.pg.query<DbRow>(
      `SELECT id::text, email, first_name, last_name, status::text, password_hash
       FROM users
       WHERE lower(email) = lower($1) AND deleted_at IS NULL
       LIMIT 1`,
      [email],
    );
    const user = rows[0];

    if (!user || user['status'] !== 'active') {
      await this.recordFailedLogin(lockoutKey);
      throw this.invalidCredentials();
    }

    if (!user['password_hash']) {
      throw new UnauthorizedException({
        code: 'USER_NO_PASSWORD',
        message: "Parol o'rnatilmagan. Ro'yxatdan o'ting.",
      });
    }

    if (!(await this.verifyPassword(String(user['password_hash']), password))) {
      await this.recordFailedLogin(lockoutKey);
      throw this.invalidCredentials();
    }
    await this.resetLoginAttempts(lockoutKey);

    await this.pg.query(
      `UPDATE users SET last_login_at = $2, updated_at = $2
       WHERE id = $1::uuid`,
      [user['id'], new Date().toISOString()],
    );

    return {
      ...(await this.issueTokens({
        actorId: String(user['id']),
        actorType: 'user',
        role: Role.USER,
      })),
      user: {
        id: String(user['id']),
        email: this.normalizeEmail(user['email']),
        firstName: this.optionalText(user['first_name']) ?? null,
        lastName: this.optionalText(user['last_name']) ?? null,
      },
    };
  }

  async userForgotPassword(phone: string) {
    const normalizedPhone = this.normalizePhone(phone);

    const rows = await this.pg.query<DbRow>(
      `SELECT id::text FROM users
       WHERE phone = $1 AND deleted_at IS NULL AND status = 'active'
       LIMIT 1`,
      [normalizedPhone],
    );
    if (!rows[0]) {
      // Hisob mavjud emasligini oshkor qilmaymiz — baribir "sent" qaytaramiz.
      return { sent: true };
    }

    return this.sendOtpDemoOrFail(normalizedPhone, 'password_reset');
  }

  async userResetPassword(body: {
    phone: string;
    code?: string;
    challenge_id?: string;
    reset_token?: string;
    password: string;
  }) {
    const phone = body.reset_token
      ? (await this.consumePasswordResetToken(body.reset_token, 'user')).phone
      : this.normalizePhone(body.phone);

    if (!body.reset_token) {
      this.consumeOtp({
        challengeId: body.challenge_id,
        phone,
        purpose: 'password_reset',
        code: String(body.code ?? ''),
      });
    }

    const hash = await argon2.hash(String(body.password));
    const now = new Date().toISOString();

    const rows = await this.pg.query<{ id: string }>(
      `UPDATE users
       SET password_hash = $2, updated_at = $3
       WHERE phone = $1 AND deleted_at IS NULL
       RETURNING id::text`,
      [phone, hash, now],
    );

    // Parol muvaffaqiyatli tiklangandan keyin — aynan SHU hisobning
    // mavjud sessiyalarini (access/refresh) bekor qilamiz. Bu — "hisobim
    // buzilgan bo'lishi mumkin" deb parolni tiklagan foydalanuvchi uchun
    // eng muhim himoya: parol tiklashdan OLDIN kimdir tokenni o'g'irlagan
    // bo'lsa, u eski token bilan ishlashda davom eta olmasligi kerak
    // (xuddi `admin2faDisable()`da qo'llanilgan naqsh — PHASE 14G, avval
    // aniqlangan HIGH topilma). Yangi login'ga hech qanday to'sqinlik
    // qilmaydi — `revokeActor` faqat MAVJUD sessiyalarni yopadi, keyingi
    // `userLogin()` chaqiruvi har doim yangi sessiya yaratadi.
    if (rows[0]?.id) {
      await authSessionStore.revokeActor(rows[0].id);
    }

    return { reset: true };
  }

  async userVerifyPasswordResetCode(body: {
    phone: string;
    code: string;
    challenge_id?: string;
  }) {
    const phone = this.normalizePhone(body.phone);

    this.consumeOtp({
      challengeId: body.challenge_id,
      phone,
      purpose: 'password_reset',
      code: body.code,
    });

    const resetToken = randomBytes(32).toString('base64url');
    await this.cache.set<PasswordResetContext>(
      this.passwordResetKey(resetToken),
      { phone, actorType: 'user' },
      10 * 60,
    );

    return {
      verified: true,
      reset_token: resetToken,
      expires_in_seconds: 10 * 60,
    };
  }

  async partnerPhoneLogin(body: Record<string, unknown>) {
    const phone = this.normalizePhone(String(body.phone ?? ''));
    const code = String(body.code ?? '').trim();
    const challengeId = String(
      body.challenge_id ?? body.chalenge_id ?? '',
    ).trim();

    if (!phone || !/^\d{6}$/.test(code)) {
      throw this.invalidCredentials();
    }

    this.consumeOtp({
      challengeId,
      phone,
      purpose: 'partner_login',
      code,
    });

    return this.issuePartnerTokensByPhone(phone);
  }

  async adminLogin(body: Record<string, unknown>) {
    const login = String(body.username ?? body.email ?? '')
      .trim()
      .toLowerCase();
    const password = String(body.password ?? '');
    const lockoutKey = await this.assertNotLockedOut('admin', login);
    const admin = await this.findAdminUser(login);

    if (
      !admin ||
      admin.status !== 'active' ||
      !(await this.verifyPassword(admin.password_hash, password))
    ) {
      await this.recordFailedLogin(lockoutKey);
      throw this.invalidCredentials();
    }
    await this.resetLoginAttempts(lockoutKey);

    if (!admin.totp_secret) {
      return {
        ...(await this.issueTokens({
          actorId: admin.id,
          actorType: 'admin',
          role: admin.role,
          roles: admin.roles,
        })),
        admin: this.publicAdmin(admin),
      };
    }

    const challengeId = randomUUID();
    this.twoFactorChallenges.set(challengeId, {
      id: challengeId,
      admin,
      expiresAt: Date.now() + 5 * 60_000,
    });

    return {
      challenge_id: challengeId,
      requires_2fa: true,
      expires_in_seconds: 300,
    };
  }

  async adminVerify2fa(body: Record<string, unknown>) {
    const challengeId = String(body.challenge_id ?? body.chalenge_id ?? '');
    const code = String(body.code ?? '');
    const challenge = this.twoFactorChallenges.get(challengeId);

    if (!challenge || challenge.expiresAt <= Date.now()) {
      throw new UnauthorizedException({
        code: 'AUTH_2FA_EXPIRED',
        message: '2FA challenge muddati tugagan',
      });
    }

    if (
      !challenge.admin.totp_secret ||
      !verifyTotpCode(challenge.admin.totp_secret, code)
    ) {
      throw new UnauthorizedException({
        code: 'AUTH_2FA_INVALID',
        message: '2FA kod noto\u2018g\u2018ri',
      });
    }

    this.twoFactorChallenges.delete(challengeId);
    return {
      ...(await this.issueTokens({
        actorId: challenge.admin.id,
        actorType: 'admin',
        role: challenge.admin.role,
        roles: challenge.admin.roles,
      })),
      admin: this.publicAdmin(challenge.admin),
    };
  }

  async admin2faSetup(actor: RequestActor | undefined) {
    const currentActor = this.requireActor(actor, 'admin');

    const rows = await this.pg.query<DbRow>(
      `SELECT id::text, email
       FROM admin_users
       WHERE id = $1
       LIMIT 1`,
      [currentActor.id],
    );

    if (rows.length === 0) {
      throw this.invalidCredentials();
    }

    const admin = rows[0];
    const email = String(admin['email']);
    const setup = createTotpSetup(email);
    const setupId = randomUUID();
    this.pendingTotpSetups.set(setupId, {
      adminId: currentActor.id,
      setup,
      expiresAt: Date.now() + 10 * 60_000,
    });

    return {
      setup_id: setupId,
      otpauth_url: setup.otpauthUrl,
      secret: setup.secret,
      recovery_codes: setup.recoveryCodes,
      expires_in_seconds: 600,
    };
  }

  async admin2faConfirm(
    actor: RequestActor | undefined,
    body: Record<string, unknown>,
  ) {
    const currentActor = this.requireActor(actor, 'admin');
    const setupId = String(body.setup_id ?? '');
    const code = String(body.code ?? '');
    const pending = this.pendingTotpSetups.get(setupId);

    if (
      !pending ||
      pending.adminId !== currentActor.id ||
      pending.expiresAt <= Date.now()
    ) {
      throw new UnauthorizedException({
        code: 'AUTH_2FA_EXPIRED',
        message: '2FA setup muddati tugagan',
      });
    }

    if (!verifyTotpCode(pending.setup.encryptedSecret, code)) {
      throw new UnauthorizedException({
        code: 'AUTH_2FA_INVALID',
        message: '2FA kod noto\u2018g\u2018ri',
      });
    }

    const rows = await this.pg.query<DbRow>(
      `SELECT id::text
       FROM admin_users
       WHERE id = $1
       LIMIT 1`,
      [currentActor.id],
    );

    if (rows.length === 0) {
      throw this.invalidCredentials();
    }

    const now = new Date().toISOString();
    await this.pg.transaction(async (tx) => {
      await tx.query(
        `UPDATE admin_users
         SET totp_secret = $1, updated_at = $2
         WHERE id = $3`,
        [pending.setup.encryptedSecret, now, currentActor.id],
      );
      // Qayta yoqilganda (avval o'chirilgan bo'lsa) eski, allaqachon
      // ishlatilgan/eskirgan recovery kodlar qolib ketmasin.
      await tx.query(`DELETE FROM admin_recovery_codes WHERE admin_id = $1`, [
        currentActor.id,
      ]);
      await this.insertRecoveryCodes(
        tx,
        currentActor.id,
        pending.setup.recoveryCodeHashes,
      );
    });

    this.pendingTotpSetups.delete(setupId);
    return { enabled: true };
  }

  private async insertRecoveryCodes(
    tx: PostgresTransaction,
    adminId: string,
    hashes: string[],
  ): Promise<void> {
    if (hashes.length === 0) {
      return;
    }

    const values: string[] = [];
    const params: unknown[] = [];
    hashes.forEach((hash, index) => {
      const base = index * 2;
      values.push(`($${base + 1}, $${base + 2})`);
      params.push(adminId, hash);
    });

    await tx.query(
      `INSERT INTO admin_recovery_codes (admin_id, code_hash) VALUES ${values.join(', ')}`,
      params,
    );
  }

  async admin2faDisable(actor: RequestActor | undefined) {
    const currentActor = this.requireActor(actor, 'admin');

    const rows = await this.pg.query<DbRow>(
      `SELECT id::text
       FROM admin_users
       WHERE id = $1
       LIMIT 1`,
      [currentActor.id],
    );

    if (rows.length === 0) {
      throw this.invalidCredentials();
    }

    const now = new Date().toISOString();
    await this.pg.transaction(async (tx) => {
      await tx.query(
        `UPDATE admin_users
         SET totp_secret = NULL, updated_at = $1
         WHERE id = $2`,
        [now, currentActor.id],
      );
      await tx.query(`DELETE FROM admin_recovery_codes WHERE admin_id = $1`, [
        currentActor.id,
      ]);
    });

    await authSessionStore.revokeActor(currentActor.id);
    return { disabled: true, sessions_revoked: true };
  }

  async passwordResetRequest(
    actorType: 'partner',
    body: Record<string, unknown>,
  ) {
    const phone = this.normalizePhone(String(body.phone ?? ''));

    const rows = await this.pg.query<DbRow>(
      `select pu.id::text as user_id
       from partner_organizations po
       left join partner_users pu
         on pu.organization_id = po.id
        and pu.deleted_at is null
       where regexp_replace(po.phone, '\\D', '', 'g') = regexp_replace($1, '\\D', '', 'g')
       order by pu.created_at asc nulls last
       limit 1`,
      [phone],
    );

    if (!rows[0]?.['user_id']) {
      // Hisob mavjud emasligini oshkor qilmaymiz — baribir "sent" qaytaramiz.
      return { actor_type: actorType, sent: true };
    }

    const response = await this.sendOtpDemoOrFail(phone, 'password_reset');
    return { actor_type: actorType, ...response };
  }

  async passwordResetConfirm(
    actorType: 'partner',
    body: Record<string, unknown>,
  ) {
    const phone = this.normalizePhone(String(body.phone ?? ''));
    const code = String(body.code ?? '');
    const challengeId = String(body.challenge_id ?? '').trim();

    this.consumeOtp({
      challengeId,
      phone,
      purpose: 'password_reset',
      code,
    });

    const rows = await this.pg.query<DbRow>(
      `select pu.id::text as user_id
       from partner_organizations po
       left join partner_users pu
         on pu.organization_id = po.id
        and pu.deleted_at is null
       where regexp_replace(po.phone, '\\D', '', 'g') = regexp_replace($1, '\\D', '', 'g')
       order by pu.created_at asc nulls last
       limit 1`,
      [phone],
    );
    const userId = rows[0]?.['user_id'];
    if (!userId) {
      throw new UnauthorizedException({
        code: 'PARTNER_NOT_ACTIVE',
        message: 'Hamkor tashkilot faol emas',
      });
    }

    const hash = await argon2.hash(String(body.password ?? ''));
    await this.pg.query(
      `update partner_users set password_hash = $2, updated_at = $3 where id = $1`,
      [userId, hash, new Date().toISOString()],
    );

    // `userResetPassword()`dagi bilan bir xil sabab: parol tiklangandan
    // keyin shu hamkor xodimining eski sessiyalari bekor qilinadi (PHASE 14G).
    await authSessionStore.revokeActor(String(userId));

    return { actor_type: actorType, reset: true };
  }

  async refresh(body: Record<string, unknown>) {
    const refreshToken = String(body.refreshToken ?? body.refresh_token ?? '');
    const payload = verifyJwt(refreshToken, 'refresh');

    if (!payload) {
      throw new UnauthorizedException({
        code: 'AUTH_REFRESH_INVALID',
        message: 'Refresh token yaroqsiz',
      });
    }

    const nextRefreshJti = randomUUID();
    const nextTokens = this.signTokenPair(
      {
        actorId: payload.sub,
        actorType: payload.actor_type,
        role: payload.role,
        roles: payload.roles,
        organizationId: payload.organization_id,
      },
      payload.session_id,
      payload.family_id ?? randomUUID(),
      nextRefreshJti,
    );

    try {
      await authSessionStore.rotate(
        payload.session_id,
        refreshToken,
        payload.jti,
        nextTokens.refreshToken,
        nextRefreshJti,
      );
    } catch (error) {
      const code =
        error instanceof Error && error.message === 'AUTH_REFRESH_REUSED'
          ? 'AUTH_REFRESH_REUSED'
          : 'AUTH_SESSION_REVOKED';
      throw new UnauthorizedException({
        code,
        message: 'Sessiya topilmadi yoki bekor qilingan',
      });
    }

    return nextTokens;
  }

  async logout(actor: RequestActor | undefined) {
    const currentActor = this.requireActor(actor);
    if (currentActor.sessionId) {
      await authSessionStore.revokeSession(currentActor.sessionId);
    }
    return { actor_id: currentActor.id, logged_out: true };
  }

  async logoutAll(actor: RequestActor | undefined) {
    const currentActor = this.requireActor(actor);
    const revoked = await authSessionStore.revokeActor(currentActor.id);
    return { actor_id: currentActor.id, revoked_sessions: revoked };
  }

  async sessions(actor: RequestActor | undefined) {
    const currentActor = this.requireActor(actor);
    const sessionList = await authSessionStore.listForActor(currentActor.id);
    return sessionList.map((session) => ({
      id: session.id,
      actor_id: session.actorId,
      role: session.role,
      user_agent: session.userAgent,
      ip_address: session.ipAddress,
      created_at: session.createdAt,
      expires_at: new Date(session.refreshExpiresAt).toISOString(),
      revoked_at: session.revokedAt,
      current: session.id === currentActor.sessionId,
    }));
  }

  async revokeSession(actor: RequestActor | undefined, id: string) {
    const currentActor = this.requireActor(actor);
    const session = await authSessionStore.get(id);

    if (!session || session.actorId !== currentActor.id) {
      throw new UnauthorizedException({
        code: 'AUTH_SESSION_REVOKED',
        message: 'Sessiya topilmadi',
      });
    }

    await authSessionStore.revokeSession(id);
    return { id, actor_id: currentActor.id, revoked: true };
  }

  private createOtpChallenge(identifier: string, purpose: OtpPurpose) {
    try {
      const challenge = otpStore.create(identifier, purpose);
      const response: {
        sent: boolean;
        challenge_id: string;
        expires_in_seconds: number;
        resend_after_seconds: number;
      } = {
        sent: true,
        challenge_id: challenge.id,
        expires_in_seconds: Math.round(
          (challenge.expiresAt - Date.now()) / 1000,
        ),
        resend_after_seconds: Math.round(
          (challenge.resendAfter - Date.now()) / 1000,
        ),
      };

      return response;
    } catch (error) {
      if (error instanceof Error && error.message === 'OTP_RATE_LIMITED') {
        throw new BadRequestException({
          code: 'OTP_RATE_LIMITED',
          message: 'OTP so\u2018rovlar limiti oshdi',
        });
      }
      if (error instanceof Error && error.message === 'OTP_RESEND_TOO_SOON') {
        throw new BadRequestException({
          code: 'OTP_RESEND_TOO_SOON',
          message: 'Kodni qayta so\u2018rashdan oldin biroz kuting',
        });
      }
      throw error;
    }
  }

  private requireActor(
    actor: RequestActor | undefined,
    actorType?: RequestActor['actorType'],
  ): RequestActor {
    if (!actor || (actorType && actor.actorType !== actorType)) {
      throw new UnauthorizedException({
        code: 'AUTH_TOKEN_INVALID',
        message: 'Sessiya topilmadi yoki token yaroqsiz',
      });
    }
    return actor;
  }

  private consumeOtp(input: {
    challengeId?: string;
    phone: string;
    purpose: OtpPurpose;
    code: string;
  }): void {
    try {
      otpStore.consume(input);
    } catch (error) {
      const code =
        error instanceof Error && error.message === 'OTP_EXPIRED'
          ? 'OTP_EXPIRED'
          : 'OTP_INVALID';
      throw new UnauthorizedException({
        code,
        message:
          code === 'OTP_EXPIRED'
            ? 'OTP muddati tugagan'
            : 'OTP noto\u2018g\u2018ri',
      });
    }
  }

  private async issueTokens(input: IssueTokenInput): Promise<AuthTokens> {
    const sessionId = randomUUID();
    const familyId = randomUUID();
    const refreshJti = randomUUID();
    const tokens = this.signTokenPair(input, sessionId, familyId, refreshJti);

    await authSessionStore.create({
      sessionId,
      familyId,
      actorId: input.actorId,
      actorType: input.actorType,
      role: input.role,
      roles: input.roles?.length ? input.roles : [input.role],
      organizationId: input.organizationId,
      refreshToken: tokens.refreshToken,
      refreshJti,
      userAgent: 'api',
      ipAddress: '0.0.0.0',
    });

    return tokens;
  }

  private signTokenPair(
    input: IssueTokenInput,
    sessionId: string,
    familyId: string,
    refreshJti: string,
  ): AuthTokens {
    const roles = input.roles?.length ? input.roles : [input.role];
    const basePayload = {
      sub: input.actorId,
      role: input.role,
      roles,
      actor_type: input.actorType,
      organization_id: input.organizationId ?? null,
      session_id: sessionId,
      family_id: familyId,
    };

    return {
      accessToken: signJwt({ ...basePayload, jti: randomUUID() }, 'access'),
      refreshToken: signJwt({ ...basePayload, jti: refreshJti }, 'refresh'),
    };
  }

  private async findPartnerUser(
    email: string,
  ): Promise<PartnerUserRecord | undefined> {
    const rows = await this.pg.query<DbRow>(
      `
        select pu.id::text, pu.organization_id::text, pu.email, pu.password_hash,
               pu.full_name, pu.role, pu.status, pu.created_at, pu.updated_at
        from partner_users pu
        where lower(pu.email) = lower($1)
        order by pu.created_at asc
        limit 1
      `,
      // Email faqat (organization_id, email) juftligida unique — bir xil
      // email bir nechta tashkilotda a'zo bo'lishi mumkin. Avval bu yerda
      // ORDER BY yo'q edi, ya'ni Postgres qaysi tashkilotni qaytarishi
      // NOANIQ edi (so'rovdan-so'rovga o'zgarishi mumkin edi) — OTP-email
      // orqali kirish esa allaqachon eng birinchi yaratilgan a'zolikni
      // deterministik tanlaydi; parol orqali kirish ham xuddi shunga mos
      // qilib qat'iylashtirildi.
      [email],
    );

    if (rows?.[0]) {
      return {
        id: String(rows[0]['id']),
        organization_id: String(rows[0]['organization_id']),
        email: String(rows[0]['email']),
        password_hash: String(rows[0]['password_hash']),
        full_name: rows[0]['full_name']
          ? String(rows[0]['full_name'])
          : undefined,
        status: String(rows[0]['status']),
        role: String(rows[0]['role'] ?? 'owner'),
        created_at: String(rows[0]['created_at']),
        updated_at: String(rows[0]['updated_at']),
      };
    }

    return undefined;
  }

  private async issuePartnerTokensByPhone(phone: string): Promise<
    AuthTokens & {
      organization_id: string;
      organizationId: string;
      organization_status: string;
      organizationStatus: string;
      partner_role: string;
    }
  > {
    const rows = await this.pg.query<DbRow>(
      `
        select
          po.id::text as organization_id,
          po.status::text as organization_status,
          pu.id::text as user_id,
          pu.status::text as user_status,
          COALESCE(pu.role, 'owner')::text as partner_role
        from partner_organizations po
        left join partner_users pu
          on pu.organization_id = po.id
         and pu.deleted_at is null
        where regexp_replace(po.phone, '\\D', '', 'g') = regexp_replace($1, '\\D', '', 'g')
        order by pu.created_at asc nulls last, po.created_at desc
        limit 1
      `,
      [phone],
    );
    const row = rows[0];

    if (!row || !this.isPartnerLoginStatusAllowed(row['organization_status'])) {
      throw new UnauthorizedException({
        code: 'PARTNER_NOT_ACTIVE',
        message: 'Hamkor tashkilot faol emas',
      });
    }
    const organizationStatus = String(row['organization_status'] ?? '');

    if (row['user_status'] && row['user_status'] !== 'active') {
      throw this.invalidCredentials();
    }

    const organizationId = String(row['organization_id']);
    const actorId = row['user_id'] ? String(row['user_id']) : organizationId;

    return {
      ...(await this.issueTokens({
        actorId,
        actorType: 'partner',
        role: Role.PARTNER,
        organizationId,
      })),
      organization_id: organizationId,
      organizationId,
      organization_status: organizationStatus,
      organizationStatus,
      partner_role: String(row['partner_role'] ?? 'owner'),
    };
  }

  private isPartnerLoginStatusAllowed(status: unknown): boolean {
    return ['approved', 'blocked', 'suspended'].includes(
      String(status ?? '').toLowerCase(),
    );
  }

  private async findAdminUser(
    login: string,
  ): Promise<AdminUserRecord | undefined> {
    const email = login === 'admin' ? 'admin@safaar.uz' : login;
    const rows = await this.pg.query<DbRow>(
      `
        select id::text, email, password_hash, full_name, role, status,
               totp_secret, created_at, updated_at
        from admin_users
        where lower(email) = lower($1)
        limit 1
      `,
      [email],
    );

    if (rows?.[0]) {
      const role = this.normalizeAdminRole(rows[0]['role']);
      return {
        id: String(rows[0]['id']),
        email: String(rows[0]['email']),
        username: String(rows[0]['email']).split('@')[0],
        password_hash: String(rows[0]['password_hash']),
        full_name: rows[0]['full_name']
          ? String(rows[0]['full_name'])
          : undefined,
        role,
        roles: [role],
        status: String(rows[0]['status']),
        totp_secret: rows[0]['totp_secret']
          ? String(rows[0]['totp_secret'])
          : undefined,
        created_at: String(rows[0]['created_at']),
        updated_at: String(rows[0]['updated_at']),
      };
    }

    return undefined;
  }

  private normalizeAdminRole(value: unknown): Role {
    const role = String(value ?? Role.ADMIN)
      .trim()
      .toUpperCase()
      .replace(/-/g, '_');
    const aliases: Record<string, Role> = {
      SUPER_ADMIN: Role.SUPER_ADMIN,
      ADMIN: Role.ADMIN,
      FINANCE_ADMIN: Role.FINANCE_ADMIN,
      CONTENT_ADMIN: Role.CONTENT_ADMIN,
      SUPPORT_ADMIN: Role.SUPPORT_ADMIN,
      MODERATOR: Role.MODERATOR,
    };
    return aliases[role] ?? Role.ADMIN;
  }

  private publicAdmin(admin: AdminUserRecord) {
    return {
      id: admin.id,
      email: admin.email,
      full_name: admin.full_name,
      role: admin.role,
      status: admin.status,
      has_2fa: Boolean(admin.totp_secret),
    };
  }

  private async verifyPassword(
    hash: string,
    password: string,
  ): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  }

  private oauthConfigured(provider: OAuthProvider): boolean {
    const config = this.oauthConfigValues(provider);
    return Boolean(
      this.oauthValueConfigured(config.clientId) &&
      this.oauthValueConfigured(config.clientSecret) &&
      config.callbackUrl,
    );
  }

  private oauthValueConfigured(value: string | undefined): boolean {
    const normalized = String(value ?? '')
      .trim()
      .toLowerCase();
    return Boolean(
      normalized &&
      !normalized.includes('change_me') &&
      !normalized.startsWith('your_'),
    );
  }

  private oauthConfig(provider: OAuthProvider) {
    const config = this.oauthConfigValues(provider);
    if (
      !this.oauthValueConfigured(config.clientId) ||
      !this.oauthValueConfigured(config.clientSecret) ||
      !config.callbackUrl
    ) {
      throw new ServiceUnavailableException({
        code: 'OAUTH_PROVIDER_NOT_CONFIGURED',
        message: `${provider} OAuth sozlanmagan`,
      });
    }
    return config as {
      clientId: string;
      clientSecret: string;
      callbackUrl: string;
    };
  }

  private oauthConfigValues(provider: OAuthProvider) {
    return provider === 'google'
      ? {
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          callbackUrl: process.env.GOOGLE_CALLBACK_URL,
        }
      : {
          clientId: process.env.FACEBOOK_APP_ID,
          clientSecret: process.env.FACEBOOK_APP_SECRET,
          callbackUrl: process.env.FACEBOOK_CALLBACK_URL,
        };
  }

  private async fetchOAuthProfile(
    provider: OAuthProvider,
    code: string,
  ): Promise<OAuthProfile> {
    const config = this.oauthConfig(provider);
    if (provider === 'google') {
      const token = await this.oauthFetch(
        'https://oauth2.googleapis.com/token',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: config.clientId,
            client_secret: config.clientSecret,
            redirect_uri: config.callbackUrl,
            grant_type: 'authorization_code',
            code,
          }),
        },
      );
      const accessToken = String(token['access_token'] ?? '');
      if (!accessToken) throw this.oauthProviderError();
      const profile = await this.oauthFetch(
        'https://openidconnect.googleapis.com/v1/userinfo',
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      const email = this.normalizeEmail(profile['email']);
      const emailVerified = profile['email_verified'] === true;
      if (!profile['sub'] || !this.isValidEmail(email) || !emailVerified) {
        throw new UnauthorizedException({
          code: 'OAUTH_EMAIL_REQUIRED',
          message: 'Google tasdiqlagan email manzil talab qilinadi',
        });
      }
      return {
        providerUserId: String(profile['sub']),
        email,
        emailVerified,
        firstName: this.optionalText(profile['given_name']),
        lastName: this.optionalText(profile['family_name']),
      };
    }

    const tokenUrl = new URL(
      'https://graph.facebook.com/v22.0/oauth/access_token',
    );
    tokenUrl.search = new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.callbackUrl,
      code,
    }).toString();
    const token = await this.oauthFetch(tokenUrl.toString());
    const accessToken = String(token['access_token'] ?? '');
    if (!accessToken) throw this.oauthProviderError();
    const profileUrl = new URL('https://graph.facebook.com/v22.0/me');
    profileUrl.search = new URLSearchParams({
      fields: 'id,first_name,last_name,email',
      access_token: accessToken,
    }).toString();
    const profile = await this.oauthFetch(profileUrl.toString());
    const email = this.normalizeEmail(profile['email']);
    if (!profile['id'] || !this.isValidEmail(email)) {
      throw new UnauthorizedException({
        code: 'OAUTH_EMAIL_REQUIRED',
        message: 'Facebook profilingizda email ruxsati talab qilinadi',
      });
    }
    return {
      providerUserId: String(profile['id']),
      email,
      emailVerified: true,
      firstName: this.optionalText(profile['first_name']),
      lastName: this.optionalText(profile['last_name']),
    };
  }

  private async oauthFetch(
    url: string,
    init: RequestInit = {},
  ): Promise<Record<string, unknown>> {
    let response: Response;
    try {
      response = await fetch(url, {
        ...init,
        headers: { Accept: 'application/json', ...init.headers },
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new ServiceUnavailableException({
        code: 'OAUTH_PROVIDER_UNAVAILABLE',
        message: 'OAuth provider bilan bog\u2018lanib bo\u2018lmadi',
      });
    }
    const payload = (await response.json().catch(() => null)) as unknown;
    if (!response.ok || !payload || typeof payload !== 'object') {
      throw this.oauthProviderError();
    }
    return payload as Record<string, unknown>;
  }

  private oauthProviderError() {
    return new UnauthorizedException({
      code: 'OAUTH_PROVIDER_REJECTED',
      message: 'OAuth provider so\u2018rovni tasdiqlamadi',
    });
  }

  private async findExistingOAuthUser(
    provider: OAuthProvider,
    providerUserId: string,
    email: string,
  ): Promise<string | null> {
    const linked = await this.pg.query<DbRow>(
      `SELECT usa.user_id::text
       FROM user_social_accounts usa
       JOIN users u ON u.id = usa.user_id
       WHERE usa.provider = $1 AND usa.provider_user_id = $2
         AND u.deleted_at IS NULL AND u.status = 'active'
       LIMIT 1`,
      [provider, providerUserId],
    );
    if (linked?.[0]) {
      return String(linked[0]['user_id']);
    }

    const userRows = await this.pg.query<DbRow>(
      `SELECT id::text
       FROM users
       WHERE lower(email) = lower($1) AND deleted_at IS NULL AND status = 'active'
       LIMIT 1`,
      [email],
    );
    return userRows?.[0] ? String(userRows[0]['id']) : null;
  }

  private async upsertOAuthUser(
    provider: OAuthProvider,
    profile: OAuthProfile,
  ): Promise<OAuthUpsertResult> {
    const now = new Date().toISOString();
    return this.pg.transaction(async (transaction) => {
      const linkedRows = await transaction.query<DbRow>(
        `SELECT usa.user_id::text, u.status::text
         FROM user_social_accounts usa
         JOIN users u ON u.id = usa.user_id
         WHERE usa.provider = $1 AND usa.provider_user_id = $2
         LIMIT 1`,
        [provider, profile.providerUserId],
      );
      if (linkedRows[0]) {
        if (linkedRows[0]['status'] !== 'active') {
          throw new UnauthorizedException({
            code: 'USER_NOT_ACTIVE',
            message: 'Foydalanuvchi hisobi faol emas',
          });
        }
        const userId = String(linkedRows[0]['user_id']);
        await transaction.query(
          `UPDATE user_social_accounts
           SET provider_email = $3, email_verified = $4, updated_at = $5
           WHERE provider = $1 AND provider_user_id = $2`,
          [provider, profile.providerUserId, profile.email, true, now],
        );
        await transaction.query(
          `UPDATE users SET last_login_at = $2, updated_at = $2
           WHERE id = $1::uuid`,
          [userId, now],
        );
        return { kind: 'login', userId };
      }

      // Email orqali moslashtirish faqat provayder email'ni tasdiqlagan
      // (`emailVerified: true`) hollarda avtomatik ulanadi/kirishga ruxsat
      // beradi — aks holda tasdiqlanmagan email orqali begona faol
      // hisobga stixiyali kirib qolish xavfi tug'iladi (hozircha Google va
      // Facebook uchun fetchOAuthProfile() buni allaqachon kafolatlaydi —
      // bu qo'shimcha himoya qatlami). Status tekshiruvi esa (USER_NOT_ACTIVE)
      // email tasdiqlanganligidan qat'i nazar har doim ishlaydi — nofaol
      // hisob bloklanishi hech qachon zaiflashmaydi.
      const userRows = await transaction.query<DbRow>(
        `SELECT id::text, status::text
         FROM users
         WHERE lower(email) = lower($1) AND deleted_at IS NULL
         LIMIT 1`,
        [profile.email],
      );
      if (userRows[0]) {
        if (userRows[0]['status'] !== 'active') {
          throw new UnauthorizedException({
            code: 'USER_NOT_ACTIVE',
            message: 'Foydalanuvchi hisobi faol emas',
          });
        }

        if (profile.emailVerified) {
          const userId = String(userRows[0]['id']);

          const providerRows = await transaction.query<DbRow>(
            `SELECT provider_user_id
             FROM user_social_accounts
             WHERE user_id = $1::uuid AND provider = $2
             LIMIT 1`,
            [userId, provider],
          );
          if (
            providerRows[0] &&
            providerRows[0]['provider_user_id'] !== profile.providerUserId
          ) {
            throw new BadRequestException({
              code: 'OAUTH_ACCOUNT_ALREADY_LINKED',
              message: 'Bu hisob boshqa ijtimoiy profilga ulangan',
            });
          }

          if (!providerRows[0]) {
            await transaction.query(
              `INSERT INTO user_social_accounts
                 (id, user_id, provider, provider_user_id, provider_email,
                  email_verified, created_at, updated_at)
               VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $7)`,
              [
                randomUUID(),
                userId,
                provider,
                profile.providerUserId,
                profile.email,
                profile.emailVerified,
                now,
              ],
            );
          }

          await transaction.query(
            `UPDATE users
             SET email_verified_at = coalesce(email_verified_at, $2),
                 first_name = coalesce(first_name, $3),
                 last_name = coalesce(last_name, $4),
                 last_login_at = $2,
                 updated_at = $2
             WHERE id = $1::uuid`,
            [userId, now, profile.firstName ?? null, profile.lastName ?? null],
          );
          return { kind: 'login', userId };
        }
      }

      return { kind: 'register', profile };
    });
  }

  private oauthUser(row: DbRow | undefined) {
    const id = String(row?.['id'] ?? '');
    const email = this.normalizeEmail(row?.['email']);
    if (!id || !this.isValidEmail(email)) {
      throw new UnauthorizedException({
        code: 'OAUTH_USER_NOT_FOUND',
        message: 'OAuth foydalanuvchi topilmadi',
      });
    }
    return {
      id,
      email,
      firstName: this.optionalText(row?.['first_name']) ?? null,
      lastName: this.optionalText(row?.['last_name']) ?? null,
    };
  }

  private oauthLocale(value: unknown): 'uz' | 'ru' | 'en' {
    const locale = String(value ?? 'uz');
    return locale === 'ru' || locale === 'en' ? locale : 'uz';
  }

  private safeNext(value: unknown): string {
    const next = String(value ?? '');
    return next.startsWith('/') && !next.startsWith('//') ? next : '';
  }

  private optionalText(value: unknown): string | undefined {
    const text = String(value ?? '').trim();
    return text || undefined;
  }

  private oauthStateKey(state: string): string {
    return `auth:oauth:state:${this.opaqueCodeHash(state)}`;
  }

  private oauthExchangeKey(code: string): string {
    return `auth:oauth:exchange:${this.opaqueCodeHash(code)}`;
  }

  private oauthRegistrationKey(token: string): string {
    return `auth:oauth:registration:${this.opaqueCodeHash(token)}`;
  }

  private passwordResetKey(token: string): string {
    return `auth:password-reset:${this.opaqueCodeHash(token)}`;
  }

  private async consumePasswordResetToken(
    token: string,
    expectedActorType: PasswordResetContext['actorType'],
  ): Promise<PasswordResetContext> {
    const context = token
      ? await this.cache.take<PasswordResetContext>(
          this.passwordResetKey(token),
        )
      : undefined;
    if (!context?.phone || context.actorType !== expectedActorType) {
      throw new UnauthorizedException({
        code: 'PASSWORD_RESET_TOKEN_INVALID',
        message: 'Parol tiklash sessiyasi yaroqsiz yoki muddati tugagan',
      });
    }
    return context;
  }

  private opaqueCodeHash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  /**
   * `smsService.send()` xato tashlasa (masalan Eskiz tokeni yaroqsiz/vaqt
   * tugagan), buni ushlab, controller darajasida kutilgan
   * `SMS_DELIVERY_FAILED` (503) xatosiga aylantiradi — aks holda bu
   * tipsiz xato umumiy 500 sifatida chiqib ketardi.
   */
  private async sendSmsOrFail(
    message: Parameters<SmsService['send']>[0],
  ): ReturnType<SmsService['send']> {
    try {
      return await this.smsService.send(message);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new ServiceUnavailableException({
        code: 'SMS_DELIVERY_FAILED',
        message: 'Tasdiqlash kodini SMS orqali yuborib bo‘lmadi',
      });
    }
  }

  /**
   * `ENABLE_DEMO_AUTH=true` bo'lsa, OTP kodi haqiqiy SMS/email o'rniga
   * to'g'ridan-to'g'ri javobda (`dev_code`) qaytariladi.
   *
   * MUHIM (xavfsizlik): bu ATAYLAB production'da ham ishlaydi hozircha —
   * SMS provayder (Eskiz) hali ulanmagan, foydalanuvchining ongli va
   * vaqtinchalik qarori bilan yoqilgan (2026-08-23). Bu HAR QANDAY
   * telefon raqami uchun OTP kodini API javobida ochiq qoldiradi — SMS
   * provayder ulangach `ENABLE_DEMO_AUTH` env o'zgaruvchisi DARHOL
   * `false`ga o'zgartirilishi shart. `env.validation.ts` bu holatda
   * boot vaqtida ogohlantirish log yozadi (lekin ishga tushishni
   * to'xtatmaydi).
   */
  private isDemoAuthEnabled(): boolean {
    return String(process.env.ENABLE_DEMO_AUTH ?? '').toLowerCase() === 'true';
  }

  /**
   * `ENABLE_DEMO_AUTH`dan MUSTAQIL, tor doiradagi mexanizm: production'da
   * `ENABLE_DEMO_AUTH=false` qolgan holda ham, faqat `DEMO_AUTH_ALLOWED_PHONES`
   * (vergul bilan ajratilgan) ro'yxatida ANIQ ko'rsatilgan raqamlar uchun
   * OTP `dev_code` sifatida qaytariladi — universal bypass EMAS. Ro'yxatdagi
   * har bir yozuv xuddi kiruvchi raqam kabi `normalizePhone()` orqali
   * normallashtiriladi (turlicha formatda yozilishiga chidamli bo'lish
   * uchun), so'ng haqiqiy O'zbekiston mobil raqam shakliga (`isValidUzPhone`
   * bilan bir xil qoida — `partners.service.ts`dagi mavjud konventsiya)
   * mos kelmagan yozuvlar xavfsiz tashlab yuboriladi (hech qachon "hamma
   * bilan mos keladigan" holga tushmaydi). Ro'yxat bo'sh/unset bo'lsa —
   * hech kim ruxsat etilmagan (fail-closed).
   */
  private isPhoneAllowedForDemoAuth(phone: string): boolean {
    const raw = process.env.DEMO_AUTH_ALLOWED_PHONES;
    if (!raw) return false;

    const allowed = raw
      .split(',')
      .map((entry) => this.normalizePhone(entry.trim()))
      .filter((entry) => /^\+998\d{9}$/.test(entry));

    return allowed.includes(phone);
  }

  private async sendOtpDemoOrFail(phone: string, purpose: OtpPurpose) {
    const response = this.createOtpChallenge(phone, purpose);
    const code = otpStore.getDeliveryCode(response.challenge_id);

    if (this.isDemoAuthEnabled() || this.isPhoneAllowedForDemoAuth(phone)) {
      return { ...response, dev_code: code };
    }

    const delivery = await this.sendSmsOrFail({
      phone,
      // TextUp'da tasdiqlangan "Safaar" shabloni aynan shu matn shakliga
      // (%w+ wildcard orqali) moslanadi — matnni o'zgartirsangiz, shablonni
      // TextUp'da qayta tasdiqlatish kerak bo'ladi.
      text: `Safaar ilovasiga uchun tasdiqlash kodi: ${code ?? '******'}`,
    });
    if (!delivery.accepted) {
      throw new ServiceUnavailableException({
        code: 'SMS_DELIVERY_FAILED',
        message: 'Tasdiqlash kodini SMS orqali yuborib bo‘lmadi',
      });
    }

    return {
      sent: response.sent,
      challenge_id: response.challenge_id,
      expires_in_seconds: response.expires_in_seconds,
      resend_after_seconds: response.resend_after_seconds,
    };
  }

  private invalidCredentials() {
    return new UnauthorizedException({
      code: 'AUTH_INVALID_CREDENTIALS',
      message: 'Login/parol noto\u2018g\u2018ri',
    });
  }

  private static readonly MAX_LOGIN_ATTEMPTS = 5;
  private static readonly LOGIN_LOCKOUT_TTL_SECONDS = 15 * 60;

  private loginAttemptsKey(actorType: string, identifier: string): string {
    return `login_attempts:${actorType}:${identifier.trim().toLowerCase()}`;
  }

  private async assertNotLockedOut(
    actorType: string,
    identifier: string,
  ): Promise<string> {
    const key = this.loginAttemptsKey(actorType, identifier);
    const attempts = (await this.cache.get<number>(key)) ?? 0;
    if (attempts >= AuthService.MAX_LOGIN_ATTEMPTS) {
      throw new UnauthorizedException({
        code: 'AUTH_ACCOUNT_LOCKED',
        message: `Juda ko\u2018p muvaffaqiyatsiz urinish. ${Math.ceil(
          AuthService.LOGIN_LOCKOUT_TTL_SECONDS / 60,
        )} daqiqadan so\u2018ng qayta urinib ko\u2018ring`,
      });
    }
    return key;
  }

  private async recordFailedLogin(key: string): Promise<void> {
    const attempts = (await this.cache.get<number>(key)) ?? 0;
    await this.cache.set(
      key,
      attempts + 1,
      AuthService.LOGIN_LOCKOUT_TTL_SECONDS,
    );
  }

  private async resetLoginAttempts(key: string): Promise<void> {
    await this.cache.del(key);
  }

  private normalizePhone(phone: string): string {
    const digits = String(phone ?? '').replace(/\D/g, '');
    return digits.startsWith('998') ? `+${digits}` : `+998${digits}`;
  }

  private normalizeEmail(email: unknown): string {
    return String(email ?? '')
      .trim()
      .toLowerCase();
  }

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
}
