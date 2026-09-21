import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/**
 * UUID shakli — uy uslubi (admin.service.ts:106 `isUuid`,
 * auth.service.ts:47 `isUuidLike`) bilan bir xil.
 *
 * ATAYLAB `@IsUUID()` EMAS: class-validator RFC-4122 versiya/variant
 * nibble'larini ham talab qiladi, PostgreSQL'ning `uuid` turi esa
 * ixtiyoriy 32 hex belgini qabul qiladi. Loyihaning O'Z demo/QA
 * ma'lumotlari (`prisma/admin-demo-seed.sql`, masalan hotel
 * `00000000-0000-4001-0000-000000000002`) variant nibble'i '0' bo'lgani
 * uchun `@IsUUID()`da RAD ETILADI — ya'ni qonuniy obyektga sharh
 * qoldirib bo'lmas edi. Qiymat baribir HAR DOIM bog'langan parametr
 * sifatida uzatiladi, shuning uchun qat'iyroq tekshiruv xavfsizlik
 * bermaydi, faqat soxta rad javoblarini keltiradi.
 */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Sharh qoldirish mumkin bo'lgan obyekt turlari.
 *
 * ATAYLAB faqat ikkita qiymat: kod bazasida `reviews.target_type` (va
 * `favorites.target_type`) uchun REAL dalil faqat shu ikkisida bor
 * (hotels.service.ts:383, buses.service.ts:245, admin.service.ts:1823-1824).
 * Restoran ALOHIDA jadval emas — u `hotels` jadvalidagi yozuv; CMS'ga
 * asoslangan ro'yxatlar (attraction/dacha/sanatorium) esa `cms_entries`da
 * yashaydi va ular uchun sharh mahsulot qarori talab qiladi — shuning uchun
 * bu yerga qo'shilmaydi.
 */
export const REVIEW_TARGET_TYPES = ['hotel', 'bus_company'] as const;
export type ReviewTargetType = (typeof REVIEW_TARGET_TYPES)[number];

/** Muallif turi — `reviews.author_type` ustuni (VARCHAR(32), PG enum emas). */
export const REVIEW_AUTHOR_TYPES = ['USER', 'GUEST'] as const;
export type ReviewAuthorType = (typeof REVIEW_AUTHOR_TYPES)[number];

/**
 * C0/C1 boshqaruv belgilarini olib tashlaydi (\n va \t saqlanadi) va
 * chetlarini qirqadi.
 *
 * MUHIM: bu yerda LOTIN-ONLY allowlist regex YO'Q. O'zbek tilidagi
 * `oʻ`/`gʻ` (U+02BB MODIFIER LETTER TURNED COMMA), `ʼ` (U+02BC) va
 * kirill harflari buzilmasligi SHART. HTML ham olib tashlanmaydi
 * (frontend React — matn sifatida render qiladi), so'kinish lug'ati ham
 * yo'q (moderatsiya admin panelida).
 */
export function sanitizeReviewText(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  return (
    value
      // `no-control-regex` ATAYLAB o'chirilgan: bu regexning BUTUN maqsadi —
      // boshqaruv belgilarini topib olib tashlash. \n (000A) va \t (0009)
      // oraliqdan tashqarida qoldirilgan, ya'ni ular saqlanadi.
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '')
      .trim()
  );
}

export class CreateReviewDto {
  /**
   * ORQAGA MOSLIK: ilgari `target_type` yuborilmasa xizmat 'hotel' deb
   * hisoblardi (reviews.service.ts). Shu xatti-harakat saqlanadi —
   * shuning uchun maydon ixtiyoriy, lekin yuborilganda allowlist'dan
   * tashqari qiymat 400 beradi.
   */
  @ApiPropertyOptional({ enum: REVIEW_TARGET_TYPES, default: 'hotel' })
  @IsOptional()
  @IsIn(REVIEW_TARGET_TYPES)
  target_type?: ReviewTargetType;

  /** ORQAGA MOSLIK: camelCase alias (uslub: `CreateMediaDto.mimeType`). */
  @ApiPropertyOptional({ enum: REVIEW_TARGET_TYPES })
  @IsOptional()
  @IsIn(REVIEW_TARGET_TYPES)
  targetType?: ReviewTargetType;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @Matches(UUID_PATTERN, { message: 'UUID formati notoʻgʻri' })
  target_id?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @Matches(UUID_PATTERN, { message: 'UUID formati notoʻgʻri' })
  targetId?: string;

  /** ORQAGA MOSLIK: eski klientlar `hotel_id` yuborishi mumkin edi. */
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @Matches(UUID_PATTERN, { message: 'UUID formati notoʻgʻri' })
  hotel_id?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @Matches(UUID_PATTERN, { message: 'UUID formati notoʻgʻri' })
  hotelId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @Matches(UUID_PATTERN, { message: 'UUID formati notoʻgʻri' })
  booking_id?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @Matches(UUID_PATTERN, { message: 'UUID formati notoʻgʻri' })
  bookingId?: string;

  /**
   * `@IsNumber` sukut bo'yicha NaN va Infinity'ni RAD ETADI, `@Type`
   * majburlash ataylab qo'yilmagan — shuning uchun `"5"`, `true`, `null`
   * kabi raqam bo'lmagan qiymatlar ham 400 beradi.
   */
  @ApiProperty({ minimum: 1, maximum: 5, example: 5 })
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(1)
  @Max(5)
  rating!: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 5 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(1)
  @Max(5)
  cleanliness?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 5 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(1)
  @Max(5)
  staff?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 5 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(1)
  @Max(5)
  location?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 5 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(1)
  @Max(5)
  value_for_money?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 5 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(1)
  @Max(5)
  valueForMoney?: number;

  /**
   * `@Transform` global `ValidationPipe`ning `transform: true` rejimida
   * validatsiyadan OLDIN ishlaydi — shuning uchun faqat bo'sh joy/
   * boshqaruv belgilaridan iborat matn `@MinLength(1)`da 400 beradi.
   */
  @ApiProperty({ example: 'Xona toza, xodimlar juda samimiy edi.' })
  @Transform(({ value }) => sanitizeReviewText(value))
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  body!: string;

  @ApiPropertyOptional({ type: [String], maxItems: 5 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsString({ each: true })
  @MaxLength(1000, { each: true })
  photos?: string[];

  /**
   * Login qilmagan (guest) mijozning ko'rsatiladigan ismi. Bu YAGONA
   * saqlanadigan guest PII — email/telefon/IP ATAYLAB so'ralmaydi.
   * Login qilgan foydalanuvchida e'tiborsiz qoldiriladi (ism `users`dan
   * olinadi).
   */
  @ApiPropertyOptional({ maxLength: 200, example: 'Dilnoza' })
  @IsOptional()
  @Transform(({ value }) => sanitizeReviewText(value))
  @IsString()
  @MaxLength(200)
  guest_name?: string;
}
