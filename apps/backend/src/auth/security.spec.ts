import { Role } from '@safaar/types';
import {
  hashPassword,
  jwtSecurityConfig,
  resetEphemeralJwtSecretsForTests,
  signJwt,
  verifyJwt,
  verifyPassword,
} from './security';

describe('jwtSecurityConfig (regression: CRITICAL — hardcoded fallback secret bypassed its own strength check)', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.JWT_ACCESS_SECRET;
    delete process.env.JWT_REFRESH_SECRET;
    resetEphemeralJwtSecretsForTests();
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('production + missing JWT_ACCESS_SECRET → throws, does not fall back to a hardcoded value', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_REFRESH_SECRET = 'r'.repeat(40);

    expect(() => jwtSecurityConfig()).toThrow(/JWT_ACCESS_SECRET/);
  });

  it('production + missing JWT_REFRESH_SECRET → throws', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_ACCESS_SECRET = 'a'.repeat(40);

    expect(() => jwtSecurityConfig()).toThrow(/JWT_REFRESH_SECRET/);
  });

  it('production + weak secret (short) → throws', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_ACCESS_SECRET = 'too-short';
    process.env.JWT_REFRESH_SECRET = 'r'.repeat(40);

    expect(() => jwtSecurityConfig()).toThrow(/JWT_ACCESS_SECRET/);
  });

  it('production + the exact previous hardcoded fallback string → throws (this is the literal regression)', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_ACCESS_SECRET = 'development-access-secret-change-me-32';
    process.env.JWT_REFRESH_SECRET = 'r'.repeat(40);

    expect(() => jwtSecurityConfig()).toThrow(/JWT_ACCESS_SECRET/);
  });

  it('production + strong secrets for both → succeeds and returns exactly those secrets', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_ACCESS_SECRET = 'a'.repeat(40);
    process.env.JWT_REFRESH_SECRET = 'r'.repeat(40);

    const config = jwtSecurityConfig();
    expect(config.accessSecret).toBe('a'.repeat(40));
    expect(config.refreshSecret).toBe('r'.repeat(40));
  });

  it('development + missing secrets → does not throw, generates a random (not hardcoded) fallback', () => {
    process.env.NODE_ENV = 'development';

    const config = jwtSecurityConfig();

    expect(config.accessSecret).not.toBe(
      'development-access-secret-change-me-32',
    );
    expect(config.refreshSecret).not.toBe(
      'development-refresh-secret-change-me-32',
    );
    expect(config.accessSecret.length).toBeGreaterThanOrEqual(32);
    expect(config.accessSecret).not.toBe(config.refreshSecret);
  });

  it('development + missing secret → the generated fallback is memoized across calls within the same process', () => {
    process.env.NODE_ENV = 'development';

    const first = jwtSecurityConfig();
    const second = jwtSecurityConfig();

    expect(first.accessSecret).toBe(second.accessSecret);
    expect(first.refreshSecret).toBe(second.refreshSecret);
  });

  it('development + missing secret → resetting the ephemeral cache (simulating a fresh process) generates a different fallback', () => {
    process.env.NODE_ENV = 'development';

    const first = jwtSecurityConfig();
    resetEphemeralJwtSecretsForTests();
    const second = jwtSecurityConfig();

    expect(first.accessSecret).not.toBe(second.accessSecret);
  });

  it('development + an explicitly-set secret is honored as-is (not replaced by the random fallback)', () => {
    process.env.NODE_ENV = 'development';
    process.env.JWT_ACCESS_SECRET = 'my-local-dev-secret';

    expect(jwtSecurityConfig().accessSecret).toBe('my-local-dev-secret');
  });

  it('default refreshTtlSeconds is 7 days (604800s) when env is not set', () => {
    delete process.env.JWT_REFRESH_TTL;
    delete process.env.JWT_REFRESH_EXPIRES_IN;
    const config = jwtSecurityConfig();
    expect(config.refreshTtlSeconds).toBe(7 * 86400);
  });

  it('a signed token can be verified with the same (ephemeral or configured) secret end to end', () => {
    process.env.NODE_ENV = 'development';

    const token = signJwt(
      {
        sub: 'user-1',
        role: Role.USER,
        roles: [Role.USER],
        actor_type: 'user',
        session_id: 'sess-1',
        jti: 'jti-1',
      },
      'access',
    );

    const payload = verifyJwt(token, 'access');
    expect(payload?.sub).toBe('user-1');
  });

  describe('hashPassword and verifyPassword', () => {
    it('hashes password with argon2 and verifies successfully', async () => {
      const plain = 'SuperSecret123!';
      const hash = await hashPassword(plain);
      expect(hash).toMatch(/^\$argon2id\$/);

      const valid = await verifyPassword(hash, plain);
      expect(valid).toBe(true);

      const invalid = await verifyPassword(hash, 'WrongPassword!');
      expect(invalid).toBe(false);
    });

    it('verifyPassword safely returns false on invalid/corrupted hash', async () => {
      const valid = await verifyPassword('not-a-valid-argon2-hash', 'password');
      expect(valid).toBe(false);
    });
  });
});
