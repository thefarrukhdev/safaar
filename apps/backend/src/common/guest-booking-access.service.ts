import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { AppCacheService } from '../infrastructure/cache.service';

/**
 * Guest (login qilmagan) mijoz o'z broniga — va shu bron uchun to'lovga —
 * keyinroq (masalan tasdiqlash sahifasini qayta yuklash, to'lov holatini
 * tekshirish, qayta urinish) murojaat qilishi uchun opaque, cache-backed
 * ruxsat tokeni.
 *
 * ASLIDA `bookings.service.ts`da yaratilgan (`GET /bookings/:id` uchun,
 * `issueGuestBookingAccessToken`/`resolveGuestBookingAccessTokenBookingId`)
 * — bu yerga O'ZGARISHSIZ (bir xil cache-kalit prefiksi, TTL, xeshlash)
 * ko'chirildi, faqat `PaymentsService` ham xavfsiz qayta ishlatishi uchun
 * (guest to'lov yaratish/holatni tekshirish — `PaymentsController`).
 * MUHIM: cache-kalit prefiksi (`booking:guest-access:`) ATAYLAB
 * O'ZGARTIRILMADI — aks holda deploy paytida productionda ALLAQACHON
 * chiqarilgan, hali muddati tugamagan tokenlar birdan yaroqsiz bo'lib
 * qolardi.
 *
 * Xavfsizlik xususiyatlari (mahsulot talabi bo'yicha tasdiqlangan):
 *   - **unguessable**: `randomBytes(32)` (256 bit) — brute-force qilib
 *     bo'lmaydi;
 *   - **booking-specific**: token FAQAT `issue()`da berilgan aynan shu
 *     `bookingId`ga bog'lanadi (`resolve()` shu ID'ni qaytaradi — boshqa
 *     bronni ochish uchun ishlatib bo'lmaydi, IDOR'ga qarshi);
 *   - **expiring**: 30 kun (`ACCESS_TTL_SECONDS`) — cache TTL orqali,
 *     muddati o'tgach `resolve()` avtomatik `undefined` qaytaradi;
 *   - **xom token hech qachon saqlanmaydi**: faqat SHA-256 xeshi cache
 *     kaliti sifatida ishlatiladi (parol-tiklash tokeni bilan bir xil
 *     naqsh) — cache/log orqali oqib chiqsa ham xom tokenni tiklab
 *     bo'lmaydi;
 *   - **boshqa user/session ma'lumotiga access bermaydi**: `resolve()`
 *     FAQAT `{ bookingId }` qaytaradi — na actor, na rol, na boshqa
 *     bron/foydalanuvchi ma'lumoti. Chaqiruvchi (masalan
 *     `PaymentsService.assertBookingVisible()`) bu bookingId'ni haqiqiy
 *     bron bilan (va uning `user_id IS NULL` ekanini) MUSTAQIL tekshiradi
 *     — token o'zi hech qanday keng vakolat bermaydi.
 */
@Injectable()
export class GuestBookingAccessService {
  /**
   * Guest bron tasdiqlash/to'lov sahifasi bir necha kun davomida qayta
   * ochilishi (to'lov holatini tekshirish, kvitansiyani qayta ko'rish,
   * qayta to'lash urinishi) mumkin bo'lgani uchun bir martalik emas —
   * `JWT_REFRESH_TTL`ning standart qiymati (30 kun) bilan bir xil.
   */
  private readonly ACCESS_TTL_SECONDS = 30 * 24 * 60 * 60;

  constructor(private readonly cache: AppCacheService) {}

  private key(token: string): string {
    return `booking:guest-access:${createHash('sha256').update(token).digest('hex')}`;
  }

  /** Yangi bron uchun opaque guest-access tokenini yaratadi va saqlaydi. */
  async issue(bookingId: string): Promise<string> {
    const token = randomBytes(32).toString('base64url');
    await this.cache.set(this.key(token), { bookingId }, this.ACCESS_TTL_SECONDS);
    return token;
  }

  /**
   * Peek — NOT consumed (guest bir nechta martalik shu bir tokendan
   * foydalanishi kerak: sahifani qayta yuklash, keyinroq qaytib kelish,
   * to'lovni qayta urinish). Token yaroqsiz/muddati tugagan bo'lsa
   * `undefined`.
   */
  async resolve(token: string): Promise<string | undefined> {
    if (!token) {
      return undefined;
    }
    const context = await this.cache.get<{ bookingId: string }>(
      this.key(token),
    );
    return context?.bookingId;
  }
}
