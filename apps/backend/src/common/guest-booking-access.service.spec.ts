import { GuestBookingAccessService } from './guest-booking-access.service';
import type { AppCacheService } from '../infrastructure/cache.service';

describe('GuestBookingAccessService', () => {
  let cache: { get: jest.Mock; set: jest.Mock };
  let service: GuestBookingAccessService;

  beforeEach(() => {
    cache = { get: jest.fn(), set: jest.fn() };
    service = new GuestBookingAccessService(cache as unknown as AppCacheService);
  });

  it('issue() — 30 kunlik TTL bilan, faqat { bookingId } saqlaydi (xom token EMAS)', async () => {
    const token = await service.issue('booking-1');
    expect(token).toEqual(expect.any(String));
    expect(token.length).toBeGreaterThan(30);

    expect(cache.set).toHaveBeenCalledTimes(1);
    const [key, value, ttl] = cache.set.mock.calls[0];
    expect(String(key)).toMatch(/^booking:guest-access:[0-9a-f]{64}$/);
    expect(String(key)).not.toContain(token);
    expect(value).toEqual({ bookingId: 'booking-1' });
    expect(ttl).toBe(30 * 24 * 60 * 60);
  });

  it('resolve() — to‘g‘ri token uchun bookingId qaytaradi', async () => {
    cache.get.mockResolvedValue({ bookingId: 'booking-1' });
    const result = await service.resolve('some-token');
    expect(result).toBe('booking-1');
    expect(cache.get).toHaveBeenCalledWith(
      expect.stringMatching(/^booking:guest-access:[0-9a-f]{64}$/),
    );
  });

  it("resolve() — noto'g'ri/mavjud bo'lmagan token uchun undefined", async () => {
    cache.get.mockResolvedValue(undefined);
    const result = await service.resolve('wrong-token');
    expect(result).toBeUndefined();
  });

  it("resolve() — bo'sh token uchun cache'ga umuman murojaat qilmasdan undefined", async () => {
    const result = await service.resolve('');
    expect(result).toBeUndefined();
    expect(cache.get).not.toHaveBeenCalled();
  });

  it('issue() + resolve() — real SHA-256 xeshlash orqali bir xil token bir xil kalitga tushadi', async () => {
    let stored: unknown;
    cache.set.mockImplementation((_key: string, value: unknown) => {
      stored = value;
      return Promise.resolve();
    });
    const token = await service.issue('booking-42');

    cache.get.mockImplementation(() => Promise.resolve(stored));
    const result = await service.resolve(token);
    expect(result).toBe('booking-42');
  });

  it("boshqa bron uchun berilgan token AYNAN so'ralgan bookingId'ni qaytaradi — boshqa bronga mos kelmaydi (IDOR himoyasi chaqiruvchi tomonda tekshiriladi)", async () => {
    cache.get.mockResolvedValue({ bookingId: 'booking-owned-by-token' });
    const result = await service.resolve('token-for-booking-owned-by-token');
    expect(result).toBe('booking-owned-by-token');
    expect(result).not.toBe('some-other-booking-id');
  });
});
