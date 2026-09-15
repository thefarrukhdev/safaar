import { registrationVerificationStore } from './registration-verification-store';

/**
 * 2026-09-15 — "SAFAAR — MAKE PARTNER REGISTRATION PHONE VERIFICATION REAL".
 * Low-level unit tests for the store directly, independent of
 * AuthService/PartnersService — the higher-level integration is already
 * covered in auth.service.spec.ts (issuing) and partners.service.spec.ts
 * (redeeming inside submitPublicPartnerRequest).
 */
describe('registrationVerificationStore', () => {
  beforeEach(() => {
    registrationVerificationStore.resetForTests();
  });

  it('a freshly issued proof redeems successfully for the exact phone it was issued for', () => {
    const { token } = registrationVerificationStore.issue('+998901234567');
    expect(() =>
      registrationVerificationStore.redeem(token, '+998901234567'),
    ).not.toThrow();
  });

  it('one-time use: redeeming the same proof twice fails on the second attempt', () => {
    const { token } = registrationVerificationStore.issue('+998901234567');
    registrationVerificationStore.redeem(token, '+998901234567');

    expect(() =>
      registrationVerificationStore.redeem(token, '+998901234567'),
    ).toThrow('PHONE_VERIFICATION_INVALID');
  });

  it('rejects a proof presented for a DIFFERENT phone than it was issued for', () => {
    const { token } = registrationVerificationStore.issue('+998901234567');
    expect(() =>
      registrationVerificationStore.redeem(token, '+998907654321'),
    ).toThrow('PHONE_VERIFICATION_INVALID');
  });

  it('a cross-phone redeem attempt burns the proof (fails closed): the legitimate phone can no longer use it either afterward', () => {
    const { token } = registrationVerificationStore.issue('+998901234567');
    expect(() =>
      registrationVerificationStore.redeem(token, '+998907654321'),
    ).toThrow();

    expect(() =>
      registrationVerificationStore.redeem(token, '+998901234567'),
    ).toThrow('PHONE_VERIFICATION_INVALID');
  });

  it('rejects an unknown/never-issued token', () => {
    expect(() =>
      registrationVerificationStore.redeem('not-a-real-token', '+998901234567'),
    ).toThrow('PHONE_VERIFICATION_INVALID');
  });

  it('rejects an empty/missing token', () => {
    expect(() =>
      registrationVerificationStore.redeem('', '+998901234567'),
    ).toThrow('PHONE_VERIFICATION_INVALID');
  });

  it('rejects an expired proof (TTL elapsed)', () => {
    const nowSpy = jest.spyOn(Date, 'now');
    let currentTime = 1_000_000;
    nowSpy.mockImplementation(() => currentTime);

    const { token } = registrationVerificationStore.issue('+998901234567');

    currentTime += 10 * 60_000 + 1; // 10 daqiqa TTL'dan 1ms o'tdi
    expect(() =>
      registrationVerificationStore.redeem(token, '+998901234567'),
    ).toThrow('PHONE_VERIFICATION_EXPIRED');

    nowSpy.mockRestore();
  });

  it('two different phones get independent, non-interchangeable proofs', () => {
    const first = registrationVerificationStore.issue('+998901234567');
    const second = registrationVerificationStore.issue('+998907654321');

    // Each redeems successfully only for its own phone — issuing one
    // proof never interferes with the other's own, independent record.
    expect(() =>
      registrationVerificationStore.redeem(first.token, '+998901234567'),
    ).not.toThrow();
    expect(() =>
      registrationVerificationStore.redeem(second.token, '+998907654321'),
    ).not.toThrow();
  });
});
