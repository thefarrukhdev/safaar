import {
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import type {
  PostgresService,
  PostgresTransaction,
} from '../infrastructure/postgres.service';
import type { JobQueueService } from '../infrastructure/job-queue.service';
import type { EmailService } from '../infrastructure/email.service';
import type { SmsService } from '../infrastructure/sms.service';
import type { AppCacheService } from '../infrastructure/cache.service';
import type { EmailMessage } from '../integrations/email/email-provider.interface';
import { authSessionStore } from './session-store';
import { otpStore } from './otp-store';
import * as totp from './totp';
import * as argon2 from 'argon2';

jest.mock('argon2');

type QueryCall = [sql: string, params?: readonly unknown[]];
const queryCallsOf = (obj: { query: unknown }): QueryCall[] =>
  (obj.query as jest.Mock).mock.calls as QueryCall[];

describe('AuthService email and OAuth', () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;
  const pg = {
    query: jest.fn(),
    transaction: jest.fn(),
  };
  const jobs = { add: jest.fn() };
  const sentMessages: EmailMessage[] = [];
  const email = { send: jest.fn() };
  const sms = { send: jest.fn() };
  const cache = {
    get: jest.fn(),
    set: jest.fn(),
    take: jest.fn(),
  };
  let service: AuthService;

  beforeEach(() => {
    otpStore.resetForTests();
    jest.restoreAllMocks();
    jest.clearAllMocks();
    process.env.GOOGLE_CLIENT_ID = 'google-client';
    process.env.GOOGLE_CLIENT_SECRET = 'google-secret';
    process.env.GOOGLE_CALLBACK_URL =
      'http://localhost:4000/v1/auth/google/callback';
    delete process.env.FACEBOOK_APP_ID;
    delete process.env.FACEBOOK_APP_SECRET;
    process.env.FACEBOOK_CALLBACK_URL =
      'http://localhost:4000/v1/auth/facebook/callback';
    delete process.env.WEB_USER_URL;
    delete process.env.OAUTH_ALLOWED_ORIGINS;
    sentMessages.length = 0;
    email.send.mockImplementation((message: EmailMessage) => {
      sentMessages.push(message);
      return Promise.resolve({ accepted: true });
    });
    sms.send.mockResolvedValue({ accepted: true, providerMessageId: '' });
    jobs.add.mockResolvedValue(undefined);
    cache.set.mockResolvedValue(undefined);
    service = new AuthService(
      pg as unknown as PostgresService,
      jobs as unknown as JobQueueService,
      email as unknown as EmailService,
      sms as unknown as SmsService,
      cache as unknown as AppCacheService,
    );
  });

  afterAll(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
  });

  it('does not issue partner tokens through phone login without OTP', async () => {
    const createSession = jest
      .spyOn(authSessionStore, 'create')
      .mockResolvedValue({} as never);

    await expect(
      service.partnerPhoneLogin({ phone: '+998901112201' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(pg.query).not.toHaveBeenCalled();
    expect(createSession).not.toHaveBeenCalled();
  });

  it('advertises only fully configured OAuth providers', () => {
    expect(service.oauthProviders()).toEqual({
      google: true,
      facebook: false,
    });
  });

  it('creates a state-bound Google authorization redirect', async () => {
    const result = await service.oauthRedirect('google', {
      locale: 'ru',
      next: '/ru/account',
    });
    const redirect = new URL(result.redirectUrl);

    expect(redirect.origin).toBe('https://accounts.google.com');
    expect(redirect.searchParams.get('state')).toBe(result.state);
    expect(redirect.searchParams.get('redirect_uri')).toBe(
      process.env.GOOGLE_CALLBACK_URL,
    );
    expect(cache.set).toHaveBeenCalledWith(
      expect.stringContaining('auth:oauth:state:'),
      {
        provider: 'google',
        locale: 'ru',
        next: '/ru/account',
        origin: 'http://localhost:3000',
      },
      600,
    );
  });

  describe('multi-frontend OAuth return origin (open-redirect prevention)', () => {
    it('accepts and stores a requested origin that is in OAUTH_ALLOWED_ORIGINS', async () => {
      process.env.OAUTH_ALLOWED_ORIGINS =
        'https://web-user-rho.vercel.app,https://safaar-uz.vercel.app';

      const result = await service.oauthRedirect('google', {
        locale: 'uz',
        origin: 'https://safaar-uz.vercel.app',
      });

      expect(result.origin).toBe('https://safaar-uz.vercel.app');
      expect(cache.set).toHaveBeenCalledWith(
        expect.stringContaining('auth:oauth:state:'),
        expect.objectContaining({ origin: 'https://safaar-uz.vercel.app' }),
        600,
      );
    });

    it('refuses an arbitrary/unlisted origin and falls back to the primary allowed origin instead of trusting it', async () => {
      process.env.OAUTH_ALLOWED_ORIGINS =
        'https://web-user-rho.vercel.app,https://safaar-uz.vercel.app';

      const result = await service.oauthRedirect('google', {
        locale: 'uz',
        origin: 'https://evil-attacker.example.com',
      });

      expect(result.origin).toBe('https://web-user-rho.vercel.app');
      expect(cache.set).toHaveBeenCalledWith(
        expect.stringContaining('auth:oauth:state:'),
        expect.objectContaining({ origin: 'https://web-user-rho.vercel.app' }),
        600,
      );
    });

    it('round-trips the validated origin end-to-end: redirect with the second allow-listed frontend -> callback returns that same origin', async () => {
      process.env.OAUTH_ALLOWED_ORIGINS =
        'https://web-user-rho.vercel.app,https://safaar-uz.vercel.app';
      cache.take.mockResolvedValueOnce({
        provider: 'google',
        locale: 'uz',
        next: '',
        origin: 'https://safaar-uz.vercel.app',
      });
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ access_token: 'provider-token' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              sub: 'google-second-frontend-user',
              email: 'second-frontend@example.com',
              email_verified: true,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        );
      const transaction = {
        query: jest.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([]),
      } as unknown as PostgresTransaction;
      pg.transaction.mockImplementation(
        (operation: (value: PostgresTransaction) => Promise<unknown>) =>
          operation(transaction),
      );

      const result = await service.oauthCallback(
        'google',
        { state: 'valid-state', code: 'provider-code' },
        'valid-state',
      );

      expect(result.origin).toBe('https://safaar-uz.vercel.app');
    });

    it('when OAUTH_ALLOWED_ORIGINS is not configured, only WEB_USER_URL is accepted (backward-compatible single-frontend behavior)', async () => {
      delete process.env.OAUTH_ALLOWED_ORIGINS;

      const result = await service.oauthRedirect('google', {
        locale: 'uz',
        origin: 'https://safaar-uz.vercel.app', // not the configured WEB_USER_URL
      });

      expect(result.origin).toBe('http://localhost:3000');
    });
  });

  it('rejects an OAuth callback with a mismatched state cookie', async () => {
    await expect(
      service.oauthCallback(
        'google',
        { state: 'request-state', code: 'provider-code' },
        'other-state',
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(cache.take).not.toHaveBeenCalled();
  });

  it('verifies a Google callback and creates a one-time exchange code', async () => {
    cache.take.mockResolvedValueOnce({
      provider: 'google',
      locale: 'uz',
      next: '/uz/account',
    });
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: 'provider-token' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            sub: 'google-user',
            email: 'user@example.com',
            email_verified: true,
            given_name: 'Test',
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      );
    const transaction = {
      query: jest
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            id: '00000000-0000-4000-8000-000000000001',
            status: 'active',
          },
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]),
    } as unknown as PostgresTransaction;
    pg.transaction.mockImplementation(
      (operation: (value: PostgresTransaction) => Promise<unknown>) =>
        operation(transaction),
    );

    const result = await service.oauthCallback(
      'google',
      { state: 'valid-state', code: 'provider-code' },
      'valid-state',
    );

    expect(typeof result.code).toBe('string');
    expect(result.locale).toBe('uz');
    expect(result.next).toBe('/uz/account');
    expect(cache.set).toHaveBeenLastCalledWith(
      expect.stringContaining('auth:oauth:exchange:'),
      { userId: '00000000-0000-4000-8000-000000000001' },
      60,
    );
  });

  it('issues a registration exchange code (not an error) when no Safaar user matches the Google account', async () => {
    cache.take.mockResolvedValueOnce({
      provider: 'google',
      locale: 'uz',
      next: '',
    });
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: 'provider-token' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            sub: 'google-new-user',
            email: 'new-user@example.com',
            email_verified: true,
            given_name: 'Test',
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      );
    const transaction = {
      query: jest.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([]),
    } as unknown as PostgresTransaction;
    pg.transaction.mockImplementation(
      (operation: (value: PostgresTransaction) => Promise<unknown>) =>
        operation(transaction),
    );

    const result = await service.oauthCallback(
      'google',
      { state: 'valid-state', code: 'provider-code' },
      'valid-state',
    );

    expect(typeof result.code).toBe('string');
    expect(cache.set).toHaveBeenLastCalledWith(
      expect.stringContaining('auth:oauth:exchange:'),
      {
        provider: 'google',
        profile: {
          providerUserId: 'google-new-user',
          email: 'new-user@example.com',
          emailVerified: true,
          firstName: 'Test',
          lastName: undefined,
        },
      },
      60,
    );
  });

  it('upsertOAuthUser defensively refuses to auto-link an active account when the profile email is unverified', async () => {
    // Both current providers' fetchOAuthProfile() already guarantee
    // emailVerified===true upstream (Google rejects unverified emails
    // outright, Facebook hardcodes true), so this exercises the private
    // upsertOAuthUser() gate directly as a defense-in-depth backstop for
    // any future provider that does not make the same guarantee.
    const transaction = {
      // 1) linked-by-provider lookup -> none, 2) email match -> active user found
      query: jest
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          { id: '00000000-0000-4000-8000-000000000009', status: 'active' },
        ]),
    } as unknown as PostgresTransaction;
    pg.transaction.mockImplementation(
      (operation: (value: PostgresTransaction) => Promise<unknown>) =>
        operation(transaction),
    );

    const result = await (
      service as unknown as {
        upsertOAuthUser: (
          provider: string,
          profile: {
            providerUserId: string;
            email: string;
            emailVerified: boolean;
          },
        ) => Promise<{ kind: string }>;
      }
    ).upsertOAuthUser('google', {
      providerUserId: 'google-unverified',
      email: 'existing-active@example.com',
      emailVerified: false,
    });

    // Registration branch (no login), and the matched active account was
    // never touched (only the 2 lookup queries ran, no UPDATE/INSERT).
    expect(result).toEqual({
      kind: 'register',
      profile: expect.objectContaining({ emailVerified: false }) as {
        emailVerified: boolean;
      },
    });
    expect(queryCallsOf(transaction).length).toBe(2);
  });

  it('still blocks a non-active user matched by email regardless of emailVerified', async () => {
    cache.take.mockResolvedValueOnce({
      provider: 'google',
      locale: 'uz',
      next: '',
    });
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: 'provider-token' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            sub: 'google-blocked',
            email: 'blocked@example.com',
            email_verified: true,
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      );
    const transaction = {
      query: jest
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          { id: '00000000-0000-4000-8000-000000000010', status: 'blocked' },
        ]),
    } as unknown as PostgresTransaction;
    pg.transaction.mockImplementation(
      (operation: (value: PostgresTransaction) => Promise<unknown>) =>
        operation(transaction),
    );

    await expect(
      service.oauthCallback(
        'google',
        { state: 'valid-state', code: 'provider-code' },
        'valid-state',
      ),
    ).rejects.toMatchObject({ response: { code: 'USER_NOT_ACTIVE' } });
    expect(cache.set).not.toHaveBeenCalled();
  });

  it('oauthExchange mints a one-time registration token when the exchange context has no matched user', async () => {
    cache.take.mockResolvedValueOnce({
      provider: 'google',
      profile: {
        providerUserId: 'google-new-user',
        email: 'new-user@example.com',
        emailVerified: true,
        firstName: 'Test',
      },
    });

    const result = await service.oauthExchange('some-code');

    expect(result).toMatchObject({
      requiresRegistration: true,
      provider: 'google',
      email: 'new-user@example.com',
      firstName: 'Test',
    });
    expect((result as { registrationToken: string }).registrationToken).toEqual(
      expect.any(String),
    );
    expect(cache.set).toHaveBeenCalledWith(
      expect.stringContaining('auth:oauth:registration:'),
      expect.objectContaining({
        provider: 'google',
        providerUserId: 'google-new-user',
        email: 'new-user@example.com',
        emailVerified: true,
      }),
      30 * 60,
    );
  });

  it('completeOAuthRegistration creates/links the user via phone OTP without ever touching password_hash', async () => {
    const registrationContext = {
      provider: 'google',
      providerUserId: 'google-new-user',
      email: 'new-user@example.com',
      emailVerified: true,
      firstName: 'Test',
    };
    cache.get.mockResolvedValueOnce(registrationContext);
    cache.take.mockResolvedValueOnce(registrationContext);
    // verifyUserOtp: SELECT user by phone -> not found, INSERT new user
    pg.query
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      // final refetch after enrichment
      .mockResolvedValueOnce([
        {
          id: '00000000-0000-4000-8000-000000000099',
          phone: '+998901234567',
          status: 'active',
          email: 'new-user@example.com',
          first_name: 'Test',
          last_name: null,
        },
      ]);
    jest.spyOn(authSessionStore, 'create').mockResolvedValue({} as never);

    const linkTransaction = {
      query: jest
        .fn()
        .mockResolvedValueOnce([]) // conflict check -> none
        .mockResolvedValueOnce([]) // existing link check -> none
        .mockResolvedValueOnce([]) // insert user_social_accounts
        .mockResolvedValueOnce([]), // update users
    } as unknown as PostgresTransaction;
    pg.transaction.mockImplementation(
      (operation: (value: PostgresTransaction) => Promise<unknown>) =>
        operation(linkTransaction),
    );

    otpStore.resetForTests();
    const challenge = otpStore.create('+998901234567', 'user_login');
    const code = otpStore.getDeliveryCode(challenge.id)!;

    const result = await service.completeOAuthRegistration({
      provider: 'google',
      registration_token: 'reg-token',
      phone: '+998901234567',
      code,
      challenge_id: challenge.id,
    });

    expect(result.accessToken).toEqual(expect.any(String));
    expect(result.refreshToken).toEqual(expect.any(String));
    expect((result.user as { email: string }).email).toBe(
      'new-user@example.com',
    );
    const insertCall = queryCallsOf(linkTransaction)[2];
    expect(insertCall[0]).toContain('INSERT INTO user_social_accounts');
    expect(insertCall[1]).toEqual(
      expect.arrayContaining([
        'google',
        'google-new-user',
        'new-user@example.com',
        true,
      ]),
    );
    const updateCall = queryCallsOf(linkTransaction)[3];
    expect(updateCall[0]).not.toMatch(/password_hash/i);
  });

  it('completeOAuthRegistration rejects an expired/invalid registration token', async () => {
    cache.get.mockResolvedValueOnce(undefined);

    await expect(
      service.completeOAuthRegistration({
        provider: 'google',
        registration_token: 'bad-token',
        phone: '+998901234567',
        code: '000000',
      }),
    ).rejects.toMatchObject({
      response: { code: 'OAUTH_REGISTRATION_EXPIRED' },
    });
  });

  it('a mistyped OTP code does not burn the one-time registration token (only peeked, not consumed)', async () => {
    cache.get.mockResolvedValueOnce({
      provider: 'google',
      providerUserId: 'google-new-user',
      email: 'new-user@example.com',
      emailVerified: true,
    });

    otpStore.resetForTests();
    otpStore.create('+998901234567', 'user_login');

    await expect(
      service.completeOAuthRegistration({
        provider: 'google',
        registration_token: 'reg-token',
        phone: '+998901234567',
        code: '000000', // wrong code
      }),
    ).rejects.toMatchObject({ response: { code: 'OTP_INVALID' } });

    // The registration token was only peeked (cache.get), never consumed
    // (cache.take) — the user can retry the code without redoing Google OAuth.
    expect(cache.take).not.toHaveBeenCalled();
  });

  it('completeOAuthRegistration rejects when the Google identity got linked to a different user meanwhile', async () => {
    const registrationContext = {
      provider: 'google',
      providerUserId: 'google-new-user',
      email: 'new-user@example.com',
      emailVerified: true,
    };
    cache.get.mockResolvedValueOnce(registrationContext);
    cache.take.mockResolvedValueOnce(registrationContext);
    pg.query.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    jest.spyOn(authSessionStore, 'create').mockResolvedValue({} as never);

    const conflictTransaction = {
      query: jest.fn().mockResolvedValueOnce([{ '?column?': 1 }]), // conflict check -> already linked elsewhere
    } as unknown as PostgresTransaction;
    pg.transaction.mockImplementation(
      (operation: (value: PostgresTransaction) => Promise<unknown>) =>
        operation(conflictTransaction),
    );

    otpStore.resetForTests();
    const challenge = otpStore.create('+998901234568', 'user_login');
    const code = otpStore.getDeliveryCode(challenge.id)!;

    await expect(
      service.completeOAuthRegistration({
        provider: 'google',
        registration_token: 'reg-token',
        phone: '+998901234568',
        code,
        challenge_id: challenge.id,
      }),
    ).rejects.toMatchObject({
      response: { code: 'OAUTH_ACCOUNT_ALREADY_LINKED' },
    });
  });

  it('a second login for the same Google-registered account is instant (no phone/OTP re-prompt)', async () => {
    cache.take.mockResolvedValueOnce({
      provider: 'google',
      locale: 'uz',
      next: '/uz/account',
    });
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: 'provider-token' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            sub: 'google-new-user',
            email: 'new-user@example.com',
            email_verified: true,
            given_name: 'Test',
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      );
    const transaction = {
      // Already linked from a prior completeOAuthRegistration -> active user found immediately.
      query: jest.fn().mockResolvedValueOnce([
        {
          user_id: '00000000-0000-4000-8000-000000000099',
          status: 'active',
        },
      ]),
    } as unknown as PostgresTransaction;
    pg.transaction.mockImplementation(
      (operation: (value: PostgresTransaction) => Promise<unknown>) =>
        operation(transaction),
    );

    const result = await service.oauthCallback(
      'google',
      { state: 'valid-state', code: 'provider-code' },
      'valid-state',
    );

    expect(typeof result.code).toBe('string');
    expect(cache.set).toHaveBeenLastCalledWith(
      expect.stringContaining('auth:oauth:exchange:'),
      { userId: '00000000-0000-4000-8000-000000000099' },
      60,
    );
    // Only the linked-account lookup ran — no email-match/registration
    // queries, confirming this is a single-step instant login.
    expect((transaction.query as jest.Mock).mock.calls.length).toBe(3);
  });

  // Facebook OAuth reuses the exact same provider-parameterized functions as
  // Google (oauthCallback/oauthExchange/completeOAuthRegistration/
  // upsertOAuthUser) — these tests exist mainly to exercise the
  // Facebook-specific branch of fetchOAuthProfile() (different token/profile
  // response shapes than Google) that the Google tests above never touch,
  // and to prove the shared login-or-registration architecture actually
  // behaves identically for provider='facebook'.
  function mockFacebookFetch(profile: Record<string, unknown>) {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: 'fb-provider-token' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(profile), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
  }

  it('creates a state-bound Facebook authorization redirect', async () => {
    process.env.FACEBOOK_APP_ID = 'facebook-app';
    process.env.FACEBOOK_APP_SECRET = 'facebook-secret';

    const result = await service.oauthRedirect('facebook', {
      locale: 'uz',
      next: '/uz/account',
    });
    const redirect = new URL(result.redirectUrl);

    expect(redirect.origin).toBe('https://www.facebook.com');
    expect(redirect.searchParams.get('scope')).toBe('email,public_profile');
    expect(redirect.searchParams.get('redirect_uri')).toBe(
      process.env.FACEBOOK_CALLBACK_URL,
    );
    expect(cache.set).toHaveBeenCalledWith(
      expect.stringContaining('auth:oauth:state:'),
      {
        provider: 'facebook',
        locale: 'uz',
        next: '/uz/account',
        origin: 'http://localhost:3000',
      },
      600,
    );
  });

  it('[1] existing active Facebook-linked user gets an instant login (no registration form)', async () => {
    process.env.FACEBOOK_APP_ID = 'facebook-app';
    process.env.FACEBOOK_APP_SECRET = 'facebook-secret';
    cache.take.mockResolvedValueOnce({
      provider: 'facebook',
      locale: 'uz',
      next: '/uz/account',
    });
    mockFacebookFetch({
      id: 'fb-existing-user',
      email: 'fb-user@example.com',
      first_name: 'Aziz',
      last_name: 'Karimov',
    });
    const transaction = {
      // linked-by-provider lookup finds an active user immediately.
      query: jest
        .fn()
        .mockResolvedValueOnce([
          { user_id: '00000000-0000-4000-8000-000000000201', status: 'active' },
        ]),
    } as unknown as PostgresTransaction;
    pg.transaction.mockImplementation(
      (operation: (value: PostgresTransaction) => Promise<unknown>) =>
        operation(transaction),
    );

    const result = await service.oauthCallback(
      'facebook',
      { state: 'valid-state', code: 'provider-code' },
      'valid-state',
    );

    expect(typeof result.code).toBe('string');
    expect(cache.set).toHaveBeenLastCalledWith(
      expect.stringContaining('auth:oauth:exchange:'),
      { userId: '00000000-0000-4000-8000-000000000201' },
      60,
    );
    // No phone/OTP registration path was taken — single lookup, no
    // registration-token minting.
    expect((transaction.query as jest.Mock).mock.calls.length).toBe(3);
  });

  it('[2] brand-new Facebook identity is routed to registration, not an error and not a silent login', async () => {
    process.env.FACEBOOK_APP_ID = 'facebook-app';
    process.env.FACEBOOK_APP_SECRET = 'facebook-secret';
    cache.take.mockResolvedValueOnce({
      provider: 'facebook',
      locale: 'uz',
      next: '',
    });
    mockFacebookFetch({
      id: 'fb-new-user',
      email: 'fb-new@example.com',
      first_name: 'Malika',
      last_name: 'Yusupova',
    });
    const transaction = {
      query: jest.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([]),
    } as unknown as PostgresTransaction;
    pg.transaction.mockImplementation(
      (operation: (value: PostgresTransaction) => Promise<unknown>) =>
        operation(transaction),
    );

    const result = await service.oauthCallback(
      'facebook',
      { state: 'valid-state', code: 'provider-code' },
      'valid-state',
    );

    expect(typeof result.code).toBe('string');
    expect(cache.set).toHaveBeenLastCalledWith(
      expect.stringContaining('auth:oauth:exchange:'),
      {
        provider: 'facebook',
        profile: {
          providerUserId: 'fb-new-user',
          email: 'fb-new@example.com',
          emailVerified: true,
          firstName: 'Malika',
          lastName: 'Yusupova',
        },
      },
      60,
    );

    const exchangeResult = await (() => {
      cache.take.mockResolvedValueOnce({
        provider: 'facebook',
        profile: {
          providerUserId: 'fb-new-user',
          email: 'fb-new@example.com',
          emailVerified: true,
          firstName: 'Malika',
          lastName: 'Yusupova',
        },
      });
      return service.oauthExchange('some-code');
    })();
    expect(exchangeResult).toMatchObject({
      requiresRegistration: true,
      provider: 'facebook',
      email: 'fb-new@example.com',
      firstName: 'Malika',
      lastName: 'Yusupova',
    });
  });

  it('[3] Facebook registration (phone + OTP) creates the user, links the Facebook identity, and issues a session — password_hash is never touched', async () => {
    const registrationContext = {
      provider: 'facebook',
      providerUserId: 'fb-new-user',
      email: 'fb-new@example.com',
      emailVerified: true,
      firstName: 'Malika',
      lastName: 'Yusupova',
    };
    cache.get.mockResolvedValueOnce(registrationContext);
    cache.take.mockResolvedValueOnce(registrationContext);
    pg.query
      .mockResolvedValueOnce([]) // verifyUserOtp: SELECT user by phone -> not found
      .mockResolvedValueOnce([]) // INSERT new user
      .mockResolvedValueOnce([
        {
          id: '00000000-0000-4000-8000-000000000202',
          phone: '+998907654321',
          status: 'active',
          email: 'fb-new@example.com',
          first_name: 'Malika',
          last_name: 'Yusupova',
        },
      ]);
    jest.spyOn(authSessionStore, 'create').mockResolvedValue({} as never);

    const linkTransaction = {
      query: jest
        .fn()
        .mockResolvedValueOnce([]) // conflict check -> none
        .mockResolvedValueOnce([]) // existing link check -> none
        .mockResolvedValueOnce([]) // insert user_social_accounts
        .mockResolvedValueOnce([]), // update users
    } as unknown as PostgresTransaction;
    pg.transaction.mockImplementation(
      (operation: (value: PostgresTransaction) => Promise<unknown>) =>
        operation(linkTransaction),
    );

    otpStore.resetForTests();
    const challenge = otpStore.create('+998907654321', 'user_login');
    const code = otpStore.getDeliveryCode(challenge.id)!;

    const result = await service.completeOAuthRegistration({
      provider: 'facebook',
      registration_token: 'reg-token',
      phone: '+998907654321',
      code,
      challenge_id: challenge.id,
    });

    expect(result.accessToken).toEqual(expect.any(String));
    expect(result.refreshToken).toEqual(expect.any(String));
    expect((result.user as { email: string }).email).toBe('fb-new@example.com');
    const insertCall = queryCallsOf(linkTransaction)[2];
    expect(insertCall[0]).toContain('INSERT INTO user_social_accounts');
    expect(insertCall[1]).toEqual(
      expect.arrayContaining([
        'facebook',
        'fb-new-user',
        'fb-new@example.com',
        true,
      ]),
    );
    const updateCall = queryCallsOf(linkTransaction)[3];
    expect(updateCall[0]).not.toMatch(/password_hash/i);
  });

  it('[4] a second Facebook login for the same registered account is instant (no phone/OTP re-prompt)', async () => {
    process.env.FACEBOOK_APP_ID = 'facebook-app';
    process.env.FACEBOOK_APP_SECRET = 'facebook-secret';
    cache.take.mockResolvedValueOnce({
      provider: 'facebook',
      locale: 'uz',
      next: '/uz/account',
    });
    mockFacebookFetch({
      id: 'fb-new-user',
      email: 'fb-new@example.com',
      first_name: 'Malika',
    });
    const transaction = {
      query: jest.fn().mockResolvedValueOnce([
        {
          user_id: '00000000-0000-4000-8000-000000000202',
          status: 'active',
        },
      ]),
    } as unknown as PostgresTransaction;
    pg.transaction.mockImplementation(
      (operation: (value: PostgresTransaction) => Promise<unknown>) =>
        operation(transaction),
    );

    const result = await service.oauthCallback(
      'facebook',
      { state: 'valid-state', code: 'provider-code' },
      'valid-state',
    );

    expect(typeof result.code).toBe('string');
    expect(cache.set).toHaveBeenLastCalledWith(
      expect.stringContaining('auth:oauth:exchange:'),
      { userId: '00000000-0000-4000-8000-000000000202' },
      60,
    );
  });

  it('[5] a non-active Facebook-linked user is rejected with USER_NOT_ACTIVE (not logged in, not re-registered)', async () => {
    process.env.FACEBOOK_APP_ID = 'facebook-app';
    process.env.FACEBOOK_APP_SECRET = 'facebook-secret';
    cache.take.mockResolvedValueOnce({
      provider: 'facebook',
      locale: 'uz',
      next: '',
    });
    mockFacebookFetch({
      id: 'fb-blocked-user',
      email: 'fb-blocked@example.com',
    });
    const transaction = {
      // linked-by-provider lookup finds the user, but status is not active.
      query: jest.fn().mockResolvedValueOnce([
        {
          user_id: '00000000-0000-4000-8000-000000000203',
          status: 'blocked',
        },
      ]),
    } as unknown as PostgresTransaction;
    pg.transaction.mockImplementation(
      (operation: (value: PostgresTransaction) => Promise<unknown>) =>
        operation(transaction),
    );

    await expect(
      service.oauthCallback(
        'facebook',
        { state: 'valid-state', code: 'provider-code' },
        'valid-state',
      ),
    ).rejects.toMatchObject({ response: { code: 'USER_NOT_ACTIVE' } });
    expect(cache.set).not.toHaveBeenCalled();
    // Only the read happened — no UPDATE to user_social_accounts/users.
    expect((transaction.query as jest.Mock).mock.calls.length).toBe(1);
  });

  it('[6] completing Facebook registration when the identity got linked to a different user meanwhile fails with a clean OAUTH_ACCOUNT_ALREADY_LINKED error', async () => {
    const registrationContext = {
      provider: 'facebook',
      providerUserId: 'fb-new-user',
      email: 'fb-new@example.com',
      emailVerified: true,
    };
    cache.get.mockResolvedValueOnce(registrationContext);
    cache.take.mockResolvedValueOnce(registrationContext);
    pg.query.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    jest.spyOn(authSessionStore, 'create').mockResolvedValue({} as never);

    const conflictTransaction = {
      query: jest.fn().mockResolvedValueOnce([{ '?column?': 1 }]), // conflict check -> already linked elsewhere
    } as unknown as PostgresTransaction;
    pg.transaction.mockImplementation(
      (operation: (value: PostgresTransaction) => Promise<unknown>) =>
        operation(conflictTransaction),
    );

    otpStore.resetForTests();
    const challenge = otpStore.create('+998907654322', 'user_login');
    const code = otpStore.getDeliveryCode(challenge.id)!;

    await expect(
      service.completeOAuthRegistration({
        provider: 'facebook',
        registration_token: 'reg-token',
        phone: '+998907654322',
        code,
        challenge_id: challenge.id,
      }),
    ).rejects.toMatchObject({
      response: { code: 'OAUTH_ACCOUNT_ALREADY_LINKED' },
    });
  });

  it('[7,8] an expired or invalid Facebook registration token is rejected with OAUTH_REGISTRATION_EXPIRED (401)', async () => {
    cache.get.mockResolvedValueOnce(undefined);

    await expect(
      service.completeOAuthRegistration({
        provider: 'facebook',
        registration_token: 'expired-or-bogus-token',
        phone: '+998907654323',
        code: '000000',
      }),
    ).rejects.toMatchObject({
      status: 401,
      response: { code: 'OAUTH_REGISTRATION_EXPIRED' },
    });
  });

  it('[9] a mistyped OTP during Facebook registration does not burn the one-time registration token', async () => {
    cache.get.mockResolvedValueOnce({
      provider: 'facebook',
      providerUserId: 'fb-new-user',
      email: 'fb-new@example.com',
      emailVerified: true,
    });
    otpStore.resetForTests();
    otpStore.create('+998907654324', 'user_login');

    await expect(
      service.completeOAuthRegistration({
        provider: 'facebook',
        registration_token: 'reg-token',
        phone: '+998907654324',
        code: '000000', // wrong code
      }),
    ).rejects.toMatchObject({ response: { code: 'OTP_INVALID' } });

    expect(cache.take).not.toHaveBeenCalled();
  });

  it('[10] a Facebook profile with no email is rejected safely (OAUTH_EMAIL_REQUIRED) — no account is created and no exchange code is issued', async () => {
    process.env.FACEBOOK_APP_ID = 'facebook-app';
    process.env.FACEBOOK_APP_SECRET = 'facebook-secret';
    cache.take.mockResolvedValueOnce({
      provider: 'facebook',
      locale: 'uz',
      next: '',
    });
    // Facebook's Graph API omits `email` entirely when the user declines the
    // email permission — fetchOAuthProfile() must refuse, not fall back to
    // some placeholder identity.
    mockFacebookFetch({ id: 'fb-no-email-user', first_name: 'NoEmail' });

    await expect(
      service.oauthCallback(
        'facebook',
        { state: 'valid-state', code: 'provider-code' },
        'valid-state',
      ),
    ).rejects.toMatchObject({ response: { code: 'OAUTH_EMAIL_REQUIRED' } });
    expect(pg.transaction).not.toHaveBeenCalled();
    expect(cache.set).not.toHaveBeenCalled();
  });

  it("[11] Facebook emails are always treated as verified, matching Google's verified-email auto-link policy — an existing active Safaar user matched only by email (never linked before) gets logged in, not re-registered", async () => {
    process.env.FACEBOOK_APP_ID = 'facebook-app';
    process.env.FACEBOOK_APP_SECRET = 'facebook-secret';
    cache.take.mockResolvedValueOnce({
      provider: 'facebook',
      locale: 'uz',
      next: '',
    });
    mockFacebookFetch({
      id: 'fb-first-link',
      email: 'already-safaar-user@example.com',
      first_name: 'Existing',
    });
    const transaction = {
      query: jest
        .fn()
        // 1) linked-by-provider lookup -> none yet
        .mockResolvedValueOnce([])
        // 2) email match -> an existing active Safaar account
        .mockResolvedValueOnce([
          { id: '00000000-0000-4000-8000-000000000204', status: 'active' },
        ])
        // 3) provider-already-linked-to-this-user check -> none
        .mockResolvedValueOnce([])
        // 4) INSERT user_social_accounts
        .mockResolvedValueOnce([])
        // 5) UPDATE users
        .mockResolvedValueOnce([]),
    } as unknown as PostgresTransaction;
    pg.transaction.mockImplementation(
      (operation: (value: PostgresTransaction) => Promise<unknown>) =>
        operation(transaction),
    );

    const result = await service.oauthCallback(
      'facebook',
      { state: 'valid-state', code: 'provider-code' },
      'valid-state',
    );

    expect(typeof result.code).toBe('string');
    expect(cache.set).toHaveBeenLastCalledWith(
      expect.stringContaining('auth:oauth:exchange:'),
      { userId: '00000000-0000-4000-8000-000000000204' },
      60,
    );
    // Auto-linked via the INSERT — no phone/OTP registration was required.
    const insertCall = queryCallsOf(transaction)[3];
    expect(insertCall[0]).toContain('INSERT INTO user_social_accounts');
    expect(insertCall[1]).toEqual(
      expect.arrayContaining(['facebook', 'fb-first-link']),
    );
  });
});

describe('AuthService admin 2FA (regression: BUG-05 recovery_code_hashes column does not exist)', () => {
  const pg = { query: jest.fn(), transaction: jest.fn() };
  const jobs = { add: jest.fn() };
  const email = { send: jest.fn() };
  const sms = { send: jest.fn() };
  const cache = { get: jest.fn(), set: jest.fn(), take: jest.fn() };
  let service: AuthService;
  const adminActor = {
    id: 'admin-1',
    actorType: 'admin' as const,
    role: 'SUPER_ADMIN' as never,
    roles: [] as never[],
    sessionId: 'session-1',
  };

  beforeEach(() => {
    otpStore.resetForTests();
    jest.clearAllMocks();
    pg.query.mockResolvedValue([{ id: 'admin-1', email: 'admin@safaar.uz' }]);
    pg.transaction.mockImplementation(
      (operation: (tx: PostgresTransaction) => unknown) =>
        operation({ query: pg.query }),
    );
    jest.spyOn(authSessionStore, 'revokeActor').mockResolvedValue(1);
    service = new AuthService(
      pg as unknown as PostgresService,
      jobs as unknown as JobQueueService,
      email as unknown as EmailService,
      sms as unknown as SmsService,
      cache as unknown as AppCacheService,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('admin2faSetup does not query the non-existent recovery_code_hashes column', async () => {
    const result = await service.admin2faSetup(adminActor);

    expect(result.setup_id).toBeDefined();
    expect(result.recovery_codes).toHaveLength(8);
    const [sql] = queryCallsOf(pg)[0];
    expect(sql).not.toContain('recovery_code_hashes');
  });

  it('admin2faConfirm writes totp_secret to admin_users and recovery codes to admin_recovery_codes (not a nonexistent column)', async () => {
    jest.spyOn(totp, 'verifyTotpCode').mockReturnValue(true);

    const setup = await service.admin2faSetup(adminActor);
    pg.query.mockClear();

    const result = await service.admin2faConfirm(adminActor, {
      setup_id: setup.setup_id,
      code: '123456',
    });

    expect(result).toEqual({ enabled: true });
    expect(pg.transaction).toHaveBeenCalledTimes(1);

    const calls = queryCallsOf(pg);
    // calls[0] = pre-check SELECT; calls[1..3] = tranzaksiya ichidagi so'rovlar.
    expect(calls[1][0]).toContain('UPDATE admin_users');
    expect(calls[1][0]).not.toContain('recovery_code_hashes');
    expect(calls[2][0]).toContain('DELETE FROM admin_recovery_codes');
    expect(calls[3][0]).toContain('INSERT INTO admin_recovery_codes');
    // 8 ta recovery kod, har biri (admin_id, code_hash) — 16 ta parametr.
    expect((calls[3][1] as unknown[]).length).toBe(16);
  });

  it('admin2faConfirm rejects an invalid TOTP code and writes nothing', async () => {
    jest.spyOn(totp, 'verifyTotpCode').mockReturnValue(false);

    const setup = await service.admin2faSetup(adminActor);
    pg.query.mockClear();

    await expect(
      service.admin2faConfirm(adminActor, {
        setup_id: setup.setup_id,
        code: '000000',
      }),
    ).rejects.toMatchObject({ status: 401 });
    expect(pg.transaction).not.toHaveBeenCalled();
  });

  it('admin2faDisable clears totp_secret and deletes recovery codes (not a nonexistent column)', async () => {
    const result = await service.admin2faDisable(adminActor);

    expect(result).toEqual({ disabled: true, sessions_revoked: true });
    const calls = queryCallsOf(pg);
    expect(calls[1][0]).toContain('UPDATE admin_users');
    expect(calls[1][0]).not.toContain('recovery_code_hashes');
    expect(calls[2][0]).toContain('DELETE FROM admin_recovery_codes');
  });
});

describe('AuthService login lockout (HIGH: no minimum password length / no login throttle / no account lockout)', () => {
  const pg = { query: jest.fn(), transaction: jest.fn() };
  const jobs = { add: jest.fn() };
  const email = { send: jest.fn() };
  const sms = { send: jest.fn() };
  let store: Map<string, { value: unknown; expiresAt: number }>;
  const cache = {
    get: jest.fn((key: string) => {
      const entry = store.get(key);
      if (!entry || entry.expiresAt < Date.now()) {
        return Promise.resolve(undefined);
      }
      return Promise.resolve(entry.value);
    }),
    set: jest.fn((key: string, value: unknown, ttlSeconds: number) => {
      store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
      return Promise.resolve(undefined);
    }),
    del: jest.fn((key: string) => {
      store.delete(key);
      return Promise.resolve(undefined);
    }),
  };
  let service: AuthService;

  beforeEach(() => {
    otpStore.resetForTests();
    jest.clearAllMocks();
    (argon2.verify as jest.Mock).mockReset();
    store = new Map();
    pg.transaction.mockImplementation(
      (operation: (tx: PostgresTransaction) => unknown) =>
        operation({ query: pg.query }),
    );
    jest.spyOn(authSessionStore, 'create').mockResolvedValue({} as never);
    service = new AuthService(
      pg as unknown as PostgresService,
      jobs as unknown as JobQueueService,
      email as unknown as EmailService,
      sms as unknown as SmsService,
      cache as unknown as AppCacheService,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('locks out user login after 5 failed attempts for the same email', async () => {
    pg.query.mockResolvedValue([]);

    for (let i = 0; i < 5; i += 1) {
      await expect(
        service.userLogin({ email: 'victim@safaar.uz', password: 'wrong' }),
      ).rejects.toMatchObject({
        status: 401,
        response: expect.objectContaining({
          code: 'AUTH_INVALID_CREDENTIALS',
        }) as { code: string },
      });
    }

    await expect(
      service.userLogin({ email: 'victim@safaar.uz', password: 'wrong' }),
    ).rejects.toMatchObject({
      status: 401,
      response: expect.objectContaining({ code: 'AUTH_ACCOUNT_LOCKED' }) as {
        code: string;
      },
    });
  });

  it('does not lock out a different email after another one fails repeatedly', async () => {
    pg.query.mockResolvedValue([]);
    for (let i = 0; i < 5; i += 1) {
      await expect(
        service.userLogin({ email: 'victim@safaar.uz', password: 'wrong' }),
      ).rejects.toMatchObject({ status: 401 });
    }

    pg.query.mockResolvedValueOnce([
      {
        id: 'u1',
        email: 'other@safaar.uz',
        status: 'active',
        password_hash: 'hash',
      },
    ]);
    (argon2.verify as jest.Mock).mockResolvedValue(true);
    pg.query.mockResolvedValueOnce([]);

    await expect(
      service.userLogin({ email: 'other@safaar.uz', password: 'correct' }),
    ).resolves.toBeDefined();
  });

  it('resets the failed-attempt counter on a successful user login', async () => {
    pg.query.mockResolvedValue([]);
    for (let i = 0; i < 4; i += 1) {
      await expect(
        service.userLogin({ email: 'user@safaar.uz', password: 'wrong' }),
      ).rejects.toMatchObject({ status: 401 });
    }

    pg.query.mockResolvedValueOnce([
      {
        id: 'u1',
        email: 'user@safaar.uz',
        status: 'active',
        password_hash: 'hash',
      },
    ]);
    (argon2.verify as jest.Mock).mockResolvedValueOnce(true);
    pg.query.mockResolvedValueOnce([]);

    await expect(
      service.userLogin({ email: 'user@safaar.uz', password: 'correct' }),
    ).resolves.toBeDefined();

    pg.query.mockResolvedValue([]);
    for (let i = 0; i < 4; i += 1) {
      await expect(
        service.userLogin({ email: 'user@safaar.uz', password: 'wrong' }),
      ).rejects.toMatchObject({
        status: 401,
        response: expect.objectContaining({
          code: 'AUTH_INVALID_CREDENTIALS',
        }) as { code: string },
      });
    }
  });

  it('locks out partner login after 5 failed attempts for the same email', async () => {
    pg.query.mockResolvedValue([]);

    for (let i = 0; i < 5; i += 1) {
      await expect(
        service.partnerLogin({ email: 'partner@safaar.uz', password: 'wrong' }),
      ).rejects.toMatchObject({ status: 401 });
    }

    await expect(
      service.partnerLogin({ email: 'partner@safaar.uz', password: 'wrong' }),
    ).rejects.toMatchObject({
      status: 401,
      response: expect.objectContaining({ code: 'AUTH_ACCOUNT_LOCKED' }) as {
        code: string;
      },
    });
  });

  it('locks out admin login after 5 failed attempts for the same identifier', async () => {
    pg.query.mockResolvedValue([]);

    for (let i = 0; i < 5; i += 1) {
      await expect(
        service.adminLogin({ username: 'admin', password: 'wrong' }),
      ).rejects.toMatchObject({ status: 401 });
    }

    await expect(
      service.adminLogin({ username: 'admin', password: 'wrong' }),
    ).rejects.toMatchObject({
      status: 401,
      response: expect.objectContaining({ code: 'AUTH_ACCOUNT_LOCKED' }) as {
        code: string;
      },
    });
  });

  it('keeps user- and partner-login lockout counters independent for the same email', async () => {
    pg.query.mockResolvedValue([]);
    for (let i = 0; i < 5; i += 1) {
      await expect(
        service.userLogin({ email: 'shared@safaar.uz', password: 'wrong' }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: 'AUTH_INVALID_CREDENTIALS',
        }) as { code: string },
      });
    }

    await expect(
      service.partnerLogin({ email: 'shared@safaar.uz', password: 'wrong' }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'AUTH_INVALID_CREDENTIALS',
      }) as { code: string },
    });
  });
});

describe('AuthService demo-mode OTP (ENABLE_DEMO_AUTH — SMS/email provider unconfigured in tests)', () => {
  const originalEnv = { ...process.env };
  const pg = { query: jest.fn(), transaction: jest.fn() };
  const jobs = { add: jest.fn() };
  const email = { send: jest.fn() };
  const sms = { send: jest.fn() };
  const cache = { get: jest.fn(), set: jest.fn(), take: jest.fn() };
  let service: AuthService;

  beforeEach(() => {
    otpStore.resetForTests();
    jest.clearAllMocks();
    delete process.env.NODE_ENV;
    delete process.env.ENABLE_DEMO_AUTH;
    jobs.add.mockResolvedValue(undefined);
    sms.send.mockRejectedValue(
      new ServiceUnavailableException({
        code: 'SMS_PROVIDER_NOT_CONFIGURED',
        message: 'SMS provayder ulanmagan',
      }),
    );
    service = new AuthService(
      pg as unknown as PostgresService,
      jobs as unknown as JobQueueService,
      email as unknown as EmailService,
      sms as unknown as SmsService,
      cache as unknown as AppCacheService,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('sendUserOtp still fails cleanly when demo mode is off (default)', async () => {
    await expect(service.sendUserOtp('+998901234567')).rejects.toMatchObject({
      response: { code: 'SMS_PROVIDER_NOT_CONFIGURED' },
    });
  });

  it('sendUserOtp sends a real SMS when demo mode is off and the provider is configured', async () => {
    sms.send.mockResolvedValueOnce({
      accepted: true,
      providerMessageId: 'sms-1',
    });

    const result = (await service.sendUserOtp('+998901234567')) as {
      sent: boolean;
      dev_code?: string;
    };

    expect(sms.send).toHaveBeenCalledWith(
      expect.objectContaining({ phone: '+998901234567' }),
    );
    expect(result.sent).toBe(true);
    expect(result).not.toHaveProperty('dev_code');
  });

  it('rejects a second OTP request for the same phone within the resend cooldown (regression: resend was never enforced)', async () => {
    sms.send.mockResolvedValue({ accepted: true, providerMessageId: 'sms-1' });

    await service.sendUserOtp('+998901234567');

    await expect(service.sendUserOtp('+998901234567')).rejects.toMatchObject({
      response: { code: 'OTP_RESEND_TOO_SOON' },
    });
    expect(sms.send).toHaveBeenCalledTimes(1);
  });

  it('sendUserOtp returns a real, usable dev_code when ENABLE_DEMO_AUTH=true', async () => {
    process.env.ENABLE_DEMO_AUTH = 'true';

    const result = (await service.sendUserOtp('+998901234567')) as {
      sent: boolean;
      challenge_id: string;
      dev_code?: string;
    };

    expect(result.sent).toBe(true);
    expect(result.dev_code).toMatch(/^\d{6}$/);
    expect(sms.send).not.toHaveBeenCalled();

    // dev_code haqiqiy OTP kod bo'lishi kerak — u bilan verify qilish
    // ishlashi kerak (frontend uni ko'rsatib, user shu kod bilan davom
    // etadi).
    pg.query.mockResolvedValueOnce([]); // SELECT user by phone -> not found
    pg.query.mockResolvedValueOnce([]); // INSERT new user
    jest.spyOn(authSessionStore, 'create').mockResolvedValue({} as never);

    await expect(
      service.verifyUserOtp({
        phone: '+998901234567',
        code: result.dev_code!,
        challenge_id: result.challenge_id,
      }),
    ).resolves.toBeDefined();
  });

  it('sendPartnerOtp behaves the same way (fails off, dev_code on)', async () => {
    process.env.ENABLE_DEMO_AUTH = 'true';

    const result = (await service.sendPartnerOtp('+998901234567')) as {
      dev_code?: string;
    };
    expect(result.dev_code).toMatch(/^\d{6}$/);
  });

  it('demo mode also works in production when ENABLE_DEMO_AUTH=true (temporary, conscious tradeoff while no SMS provider is configured yet)', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ENABLE_DEMO_AUTH = 'true';

    const result = (await service.sendUserOtp('+998901234567')) as {
      dev_code?: string;
    };
    expect(result.dev_code).toMatch(/^\d{6}$/);
    expect(sms.send).not.toHaveBeenCalled();
  });
});

describe('AuthService scoped demo OTP allowlist (DEMO_AUTH_ALLOWED_PHONES -- narrow production alternative to global ENABLE_DEMO_AUTH)', () => {
  const originalEnv = { ...process.env };
  const pg = { query: jest.fn(), transaction: jest.fn() };
  const jobs = { add: jest.fn() };
  const email = { send: jest.fn() };
  const sms = { send: jest.fn() };
  const cache = { get: jest.fn(), set: jest.fn(), take: jest.fn() };
  let service: AuthService;

  beforeEach(() => {
    otpStore.resetForTests();
    jest.clearAllMocks();
    delete process.env.NODE_ENV;
    delete process.env.ENABLE_DEMO_AUTH;
    delete process.env.DEMO_AUTH_ALLOWED_PHONES;
    jobs.add.mockResolvedValue(undefined);
    sms.send.mockRejectedValue(
      new ServiceUnavailableException({
        code: 'SMS_PROVIDER_NOT_CONFIGURED',
        message: 'SMS provayder ulanmagan',
      }),
    );
    service = new AuthService(
      pg as unknown as PostgresService,
      jobs as unknown as JobQueueService,
      email as unknown as EmailService,
      sms as unknown as SmsService,
      cache as unknown as AppCacheService,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('an allowlisted phone gets dev_code even in production with global ENABLE_DEMO_AUTH=false', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ENABLE_DEMO_AUTH = 'false';
    process.env.DEMO_AUTH_ALLOWED_PHONES = '+998901234567';

    const result = (await service.sendUserOtp('+998901234567')) as {
      dev_code?: string;
    };

    expect(result.dev_code).toMatch(/^\d{6}$/);
    expect(sms.send).not.toHaveBeenCalled();
  });

  it('a non-allowlisted phone still uses the real SMS path in production, even with an allowlist configured for other numbers', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ENABLE_DEMO_AUTH = 'false';
    process.env.DEMO_AUTH_ALLOWED_PHONES = '+998901234567,+998907654321';
    sms.send.mockResolvedValueOnce({
      accepted: true,
      providerMessageId: 'sms-1',
    });

    const result = (await service.sendUserOtp('+998909999999')) as {
      sent: boolean;
      dev_code?: string;
    };

    expect(sms.send).toHaveBeenCalledWith(
      expect.objectContaining({ phone: '+998909999999' }),
    );
    expect(result).not.toHaveProperty('dev_code');
  });

  it('an unset allowlist grants no one production demo access (fail-closed default)', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ENABLE_DEMO_AUTH = 'false';
    // DEMO_AUTH_ALLOWED_PHONES intentionally left unset.

    await expect(service.sendUserOtp('+998901234567')).rejects.toMatchObject({
      response: { code: 'SMS_PROVIDER_NOT_CONFIGURED' },
    });
  });

  it('an empty-string allowlist grants no one production demo access', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ENABLE_DEMO_AUTH = 'false';
    process.env.DEMO_AUTH_ALLOWED_PHONES = '';

    await expect(service.sendUserOtp('+998901234567')).rejects.toMatchObject({
      response: { code: 'SMS_PROVIDER_NOT_CONFIGURED' },
    });
  });

  it('malformed allowlist entries (blank, too short, garbage) are safely ignored rather than matching everything', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ENABLE_DEMO_AUTH = 'false';
    process.env.DEMO_AUTH_ALLOWED_PHONES =
      ' , notaphone, +99890, +998901234567,,  ';
    sms.send.mockResolvedValueOnce({
      accepted: true,
      providerMessageId: 'sms-1',
    });

    // The one well-formed entry still works.
    const allowed = (await service.sendUserOtp('+998901234567')) as {
      dev_code?: string;
    };
    expect(allowed.dev_code).toMatch(/^\d{6}$/);

    // A phone number NOT in the list is unaffected by the malformed noise
    // around it -- it must not accidentally match anything.
    otpStore.resetForTests();
    const notAllowed = (await service.sendUserOtp('+998909999999')) as {
      sent: boolean;
      dev_code?: string;
    };
    expect(notAllowed).not.toHaveProperty('dev_code');
    expect(sms.send).toHaveBeenCalledWith(
      expect.objectContaining({ phone: '+998909999999' }),
    );
  });

  it('allowlist entries are normalized the same way as incoming phone numbers, so alternate formats still match', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ENABLE_DEMO_AUTH = 'false';
    // Local (no country code, with spaces/dashes) formatting of the same
    // number that sendUserOtp will normalize to +998901234567.
    process.env.DEMO_AUTH_ALLOWED_PHONES = '90 123-45-67';

    const result = (await service.sendUserOtp('901234567')) as {
      dev_code?: string;
    };

    expect(result.dev_code).toMatch(/^\d{6}$/);
    expect(sms.send).not.toHaveBeenCalled();
  });

  it('sendPartnerOtp respects the same scoped allowlist', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ENABLE_DEMO_AUTH = 'false';
    process.env.DEMO_AUTH_ALLOWED_PHONES = '+998901234567';

    const result = (await service.sendPartnerOtp('+998901234567')) as {
      dev_code?: string;
    };
    expect(result.dev_code).toMatch(/^\d{6}$/);
  });

  it('the allowlist does NOT globally enable demo auth -- a second, non-allowlisted phone in the same request cycle still requires real SMS', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ENABLE_DEMO_AUTH = 'false';
    process.env.DEMO_AUTH_ALLOWED_PHONES = '+998901234567';
    sms.send.mockResolvedValue({ accepted: true, providerMessageId: 'sms-1' });

    await service.sendUserOtp('+998901234567');
    otpStore.resetForTests();
    const result = (await service.sendUserOtp('+998900000000')) as {
      dev_code?: string;
    };

    expect(result).not.toHaveProperty('dev_code');
    expect(sms.send).toHaveBeenCalledTimes(1);
  });

  afterAll(() => {
    process.env = originalEnv;
  });
});

describe('AuthService password reset via SMS (regression: user/reset-password wrote to a non-existent users.password_hash-by-email query; partner reset was a fake no-op stub)', () => {
  const pg = { query: jest.fn(), transaction: jest.fn() };
  const jobs = { add: jest.fn() };
  const email = { send: jest.fn() };
  const sms = { send: jest.fn() };
  const cache = {
    get: jest.fn(),
    set: jest.fn(),
    take: jest.fn(),
    del: jest.fn(),
  };
  let service: AuthService;

  beforeEach(() => {
    otpStore.resetForTests();
    // resetAllMocks (not clearAllMocks): these tests chain multiple
    // sequential pg.query mocks across request/verify/reset steps, and a
    // test that throws partway through can leave a mockResolvedValueOnce
    // unconsumed — clearAllMocks would let it leak into the next test.
    jest.resetAllMocks();
    delete process.env.ENABLE_DEMO_AUTH;
    jobs.add.mockResolvedValue(undefined);
    sms.send.mockResolvedValue({ accepted: true, providerMessageId: 'sms-1' });
    cache.set.mockResolvedValue(undefined);
    service = new AuthService(
      pg as unknown as PostgresService,
      jobs as unknown as JobQueueService,
      email as unknown as EmailService,
      sms as unknown as SmsService,
      cache as unknown as AppCacheService,
    );
  });

  it('userForgotPassword sends a real SMS when the phone belongs to an active user', async () => {
    pg.query.mockResolvedValueOnce([
      { id: '00000000-0000-4000-8000-000000000001' },
    ]);

    const result = await service.userForgotPassword('+998901234567');

    expect(sms.send).toHaveBeenCalledWith(
      expect.objectContaining({ phone: '+998901234567' }),
    );
    expect(result.sent).toBe(true);
  });

  it('userForgotPassword does not reveal whether the phone is registered', async () => {
    pg.query.mockResolvedValueOnce([]);

    const result = await service.userForgotPassword('+998901234567');

    expect(sms.send).not.toHaveBeenCalled();
    expect(result.sent).toBe(true);
  });

  it('completes the full user reset flow: request -> verify -> reset_token -> new password_hash written by phone, and revokes existing sessions (PHASE 14G security fix)', async () => {
    pg.query.mockResolvedValueOnce([
      { id: '00000000-0000-4000-8000-000000000001' },
    ]);
    process.env.ENABLE_DEMO_AUTH = 'true';
    const revokeActorSpy = jest
      .spyOn(authSessionStore, 'revokeActor')
      .mockResolvedValue(1);
    const requested = (await service.userForgotPassword('+998901234567')) as {
      challenge_id: string;
      dev_code?: string;
    };

    const verified = await service.userVerifyPasswordResetCode({
      phone: '+998901234567',
      code: requested.dev_code!,
      challenge_id: requested.challenge_id,
    });

    // `cache` is a plain mock, not a real store — feed back exactly what
    // userVerifyPasswordResetCode's cache.set() call stored, so the
    // subsequent cache.take() inside userResetPassword sees it.
    const setCalls = cache.set.mock.calls as unknown as unknown[][];
    const storedContext = setCalls[setCalls.length - 1][1] as {
      phone: string;
      actorType: 'user' | 'partner';
    };
    cache.take.mockResolvedValueOnce(storedContext);

    // Haqiqiy DB'da `UPDATE ... RETURNING id::text` yangilangan qatorni
    // qaytaradi — bo'sh massiv emas (bo'sh massiv `revokeActor()`
    // chaqirilishini niqoblab qo'yardi, PHASE 14G test-review'da topildi).
    pg.query.mockResolvedValueOnce([
      { id: '00000000-0000-4000-8000-000000000001' },
    ]);
    await service.userResetPassword({
      phone: '+998901234567',
      reset_token: verified.reset_token,
      password: 'N3wP@ssw0rd!',
    });

    expect(pg.query).toHaveBeenLastCalledWith(
      expect.stringContaining('UPDATE users'),
      expect.arrayContaining(['+998901234567']),
    );
    // PHASE 14G (HIGH fix): parol tiklangandan keyin foydalanuvchining
    // mavjud sessiyalari (eski access/refresh tokenlari) bekor qilinishi
    // SHART.
    expect(revokeActorSpy).toHaveBeenCalledWith(
      '00000000-0000-4000-8000-000000000001',
    );
  });

  it('rejects userResetPassword when the reset_token was issued for a different actor type', async () => {
    cache.take.mockResolvedValueOnce({
      phone: '+998901234567',
      actorType: 'partner',
    });

    await expect(
      service.userResetPassword({
        phone: '+998901234567',
        reset_token: 'some-token',
        password: 'N3wP@ssw0rd!',
      }),
    ).rejects.toMatchObject({
      response: { code: 'PASSWORD_RESET_TOKEN_INVALID' },
    });
  });

  it('passwordResetRequest (partner) sends a real SMS when the phone belongs to an org with a partner user', async () => {
    pg.query.mockResolvedValueOnce([
      { user_id: '00000000-0000-4000-8000-000000000010' },
    ]);

    const result = (await service.passwordResetRequest('partner', {
      phone: '+998901112201',
    })) as { sent?: boolean; challenge_id?: string };

    expect(sms.send).toHaveBeenCalledWith(
      expect.objectContaining({ phone: '+998901112201' }),
    );
    expect(result.challenge_id).toBeDefined();
  });

  it('passwordResetRequest (partner) does not reveal whether the org/user exists', async () => {
    pg.query.mockResolvedValueOnce([{ user_id: null }]);

    const result = (await service.passwordResetRequest('partner', {
      phone: '+998901112201',
    })) as { sent?: boolean };

    expect(sms.send).not.toHaveBeenCalled();
    expect(result.sent).toBe(true);
  });

  it('passwordResetConfirm (partner) rejects an invalid code without touching the database', async () => {
    await expect(
      service.passwordResetConfirm('partner', {
        phone: '+998901112201',
        code: '000000',
        challenge_id: 'nonexistent',
        password: 'N3wP@ssw0rd!',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(pg.query).not.toHaveBeenCalled();
  });

  it('completes the full partner reset flow: request -> confirm -> new password_hash written on partner_users, and revokes existing sessions (PHASE 14G security fix)', async () => {
    process.env.ENABLE_DEMO_AUTH = 'true';
    const revokeActorSpy = jest
      .spyOn(authSessionStore, 'revokeActor')
      .mockResolvedValue(1);
    pg.query.mockResolvedValueOnce([
      { user_id: '00000000-0000-4000-8000-000000000010' },
    ]);
    const requested = (await service.passwordResetRequest('partner', {
      phone: '+998901112201',
    })) as { challenge_id: string; dev_code?: string };

    pg.query.mockResolvedValueOnce([
      { user_id: '00000000-0000-4000-8000-000000000010' },
    ]);
    pg.query.mockResolvedValueOnce([]);
    await service.passwordResetConfirm('partner', {
      phone: '+998901112201',
      code: requested.dev_code,
      challenge_id: requested.challenge_id,
      password: 'N3wP@ssw0rd!',
    });

    expect(pg.query).toHaveBeenLastCalledWith(
      expect.stringContaining('update partner_users'),
      expect.arrayContaining(['00000000-0000-4000-8000-000000000010']),
    );
    // PHASE 14G (HIGH fix): parol tiklangandan keyin shu hamkor xodimining
    // mavjud sessiyalari (eski access/refresh tokenlari) bekor qilinishi
    // SHART — aks holda parol tiklashdan oldin tokenni o'g'irlagan
    // hujumchi tiklashdan keyin ham ishlashda davom etardi.
    expect(revokeActorSpy).toHaveBeenCalledWith(
      '00000000-0000-4000-8000-000000000010',
    );
  });

  it('passwordResetConfirm (partner) throws PARTNER_NOT_ACTIVE if the org disappeared between request and confirm', async () => {
    process.env.ENABLE_DEMO_AUTH = 'true';
    pg.query.mockResolvedValueOnce([
      { user_id: '00000000-0000-4000-8000-000000000010' },
    ]);
    const requested = (await service.passwordResetRequest('partner', {
      phone: '+998901112201',
    })) as { challenge_id: string; dev_code?: string };

    pg.query.mockResolvedValueOnce([{ user_id: null }]);
    await expect(
      service.passwordResetConfirm('partner', {
        phone: '+998901112201',
        code: requested.dev_code,
        challenge_id: requested.challenge_id,
        password: 'N3wP@ssw0rd!',
      }),
    ).rejects.toMatchObject({ response: { code: 'PARTNER_NOT_ACTIVE' } });
  });
});
