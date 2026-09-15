import { corsOriginsFromEnv } from './cors';

describe('corsOriginsFromEnv', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('production: throws when unset (no implicit wildcard)', () => {
    process.env.NODE_ENV = 'production';
    expect(() => corsOriginsFromEnv(undefined)).toThrow(/CORS_ORIGINS/);
  });

  it('production: throws on wildcard "*"', () => {
    process.env.NODE_ENV = 'production';
    expect(() => corsOriginsFromEnv('*')).toThrow(/CORS_ORIGINS/);
  });

  it('non-production: allows all origins (true) when unset', () => {
    process.env.NODE_ENV = 'development';
    expect(corsOriginsFromEnv(undefined)).toBe(true);
  });

  it('parses a comma-separated allowlist, trimming whitespace and dropping empties', () => {
    process.env.NODE_ENV = 'production';
    const result = corsOriginsFromEnv(
      ' https://a.example , https://b.example,,https://c.example ',
    );
    expect(result).toEqual([
      'https://a.example',
      'https://b.example',
      'https://c.example',
    ]);
  });

  it('regression: production custom-domain fix (temp/save-all-work, Uzum onboarding prep) — the exact CORS_ORIGINS value now configured on backend.env must accept both www.safaar.uz and safaar.uz while preserving the pre-existing Vercel origins', () => {
    process.env.NODE_ENV = 'production';
    const result = corsOriginsFromEnv(
      'https://web-admin-phi-beige.vercel.app,https://web-partner-khaki.vercel.app,https://web-user-rho.vercel.app,https://www.safaar.uz,https://safaar.uz',
    );
    expect(result).toEqual([
      'https://web-admin-phi-beige.vercel.app',
      'https://web-partner-khaki.vercel.app',
      'https://web-user-rho.vercel.app',
      'https://www.safaar.uz',
      'https://safaar.uz',
    ]);
    // The exact origin values a real browser request from the custom domain
    // would send (no trailing slash) must be present verbatim.
    expect(result).toContain('https://www.safaar.uz');
    expect(result).toContain('https://safaar.uz');
    // my.safaar.uz was verified NOT live in the Uzum onboarding investigation
    // and must never be silently trusted just because it shares the apex.
    expect(result).not.toContain('https://my.safaar.uz');
  });
});
