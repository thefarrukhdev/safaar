import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { BookingStatus } from '@safaar/types';
import type { RequestActor } from '../common/actor';
import {
  calculateCommission,
  resolveAccommodationCommissionRate,
} from '../common/finance';
import {
  limitOffsetSql,
  paginateArray,
  parsePagination,
  type QueryLike,
} from '../common/pagination';
import {
  PostgresService,
  type PostgresTransaction,
} from '../infrastructure/postgres.service';
import { AppCacheService } from '../infrastructure/cache.service';
import { JobQueueService } from '../infrastructure/job-queue.service';
import { hashSecret, partnerApiPepper, randomToken } from '../auth/security';
import { registrationVerificationStore } from '../auth/registration-verification-store';
import { assertPublicHttpUrl } from '../common/ssrf-guard';
import { isSlotWithinOperatingHours } from '../common/operating-hours';
import { randomUUID } from 'node:crypto';
import { EventsService } from '../realtime/events.service';

type HotelListingStatus = 'draft' | 'pending_review' | 'published' | 'hidden';
type PublicPartnerStatus =
  | 'not_found'
  | 'new'
  | 'reviewing'
  | 'approved'
  | 'rejected'
  | 'blocked'
  | 'suspended';

/**
 * `bus_companies`dan `RETURNING`/`SELECT` orqali qaytadigan ustunlar —
 * aniq tur beriladi, chunki `PostgresService.query<T>()` T berilmasa
 * `QueryResultRow`ga (indeks-imzosiz, deyarli bo'sh interfeys) tushadi va
 * keyinchalik `{ ...company, short_description: ... }` kabi spread qilinsa
 * `company`dan kelgan maydonlar (masalan `name`) natija turida ko'rinmay
 * qoladi.
 */
type BusCompanyRow = {
  id: string;
  partner_organization_id: string;
  name: string;
  status: string;
  rating_average: number;
  reviews_count: number;
  created_at: string;
  updated_at: string;
};

/**
 * `hotels` jadvali "yashash joyi" turlari VA restoran uchun umumiy e'lon
 * yozuvi sifatida ishlatiladi — faqat sof `bus` turidagi hamkor bunday
 * yozuv yarata olmasligi kerak (u o'rniga `bus_companies`/`vehicles`/
 * `trips`dan foydalanadi).
 */
const LODGING_LIKE_TYPES = new Set([
  'hotel',
  'hostel',
  'guesthouse',
  'motel',
  'dacha',
  'restaurant',
  'mixed',
]);

function localizedText(body: Record<string, unknown>, key: string) {
  const rawValue = body[key] ?? body.name ?? body[`${key}_uz`] ?? '';
  if (rawValue !== null && typeof rawValue === 'object') {
    throw new BadRequestException({
      code: 'ROOM_TYPE_NAME_INVALID',
      message: `"${key}" maydoni matn (string) bo'lishi kerak, obyekt emas`,
    });
  }
  const value = String(rawValue).trim();
  if (!value) {
    throw new BadRequestException({
      code: 'ROOM_TYPE_NAME_REQUIRED',
      message: 'Xona turi nomi kiritilishi kerak',
    });
  }
  return {
    uz: String(body[`${key}_uz`] ?? body.name_uz ?? value).trim(),
    ru: String(body[`${key}_ru`] ?? body.name_ru ?? value).trim(),
    en: String(body[`${key}_en`] ?? body.name_en ?? value).trim(),
  };
}

function listingStatus(value: unknown): HotelListingStatus {
  const status = String(value ?? 'pending_review').toLowerCase();
  if (status === 'published') {
    return 'published';
  }
  if (status === 'hidden') {
    return 'hidden';
  }
  if (status === 'draft') {
    return 'draft';
  }
  if (status === 'under_review' || status === 'pending_review') {
    return 'pending_review';
  }
  return 'pending_review';
}

/**
 * Hamkor (mehmonxona/avtobus kompaniyasi) kabineti xizmati.
 * partner.safaar.uz uchun: xonalar, bronlar, moliya boshqaruvi.
 */
@Injectable()
export class PartnersService {
  constructor(
    private readonly pg: PostgresService,
    private readonly jobs: JobQueueService,
    @Optional() private readonly events?: EventsService,
    @Optional() private readonly cache?: AppCacheService,
  ) {}

  /**
   * `catalog:transports` (GET /catalog/transports — public Transport
   * sahifasining ma'lumot manbai) 1 soatlik TTL bilan keshlanadi va hech
   * qayerda avtomatik tozalanmaydi edi: hamkor yangi transport qo'shsa ham,
   * u ko'pi bilan 1 soatgacha `/transport`da ko'rinmasdi — bu aynan
   * "tasdiqlangan e'lon Transport sahifasida ko'rinmayapti" shikoyatining
   * bir qismi edi.
   */
  private invalidatePublicTransportCache() {
    void this.cache?.del('catalog:transports');
  }

  // ---------------------------------------------------------------------------
  // Dashboard
  // ---------------------------------------------------------------------------

  async dashboard(actor: RequestActor | undefined) {
    const organizationId = this.organizationId(actor);
    const today = new Date().toISOString().slice(0, 10);
    const firstDay = today.slice(0, 7) + '-01';

    const [todayResult, revenueResult, customersResult, ratingResult] =
      await Promise.all([
        this.pg.query<{ count: string }>(
          `SELECT COUNT(*)::text as count FROM bookings WHERE partner_organization_id = $1 AND created_at::text LIKE $2 || '%'`,
          [organizationId, today],
        ),
        this.pg.query<{ sum: string | null }>(
          `SELECT COALESCE(SUM(partner_payable), 0)::text as sum FROM bookings WHERE partner_organization_id = $1 AND created_at::text LIKE $2 || '%'`,
          [organizationId, firstDay],
        ),
        this.pg.query<{ count: string }>(
          `SELECT COUNT(DISTINCT user_id)::text as count FROM bookings WHERE partner_organization_id = $1`,
          [organizationId],
        ),
        this.pg.query<{ avg: string | null }>(
          `SELECT AVG(rating_average)::text as avg FROM hotels WHERE partner_organization_id = $1 AND rating_average IS NOT NULL`,
          [organizationId],
        ),
      ]);

    return {
      todayBookings: Number(todayResult[0]?.count ?? 0),
      monthRevenue: Number(revenueResult[0]?.sum ?? 0),
      totalCustomers: Number(customersResult[0]?.count ?? 0),
      rating: ratingResult[0]?.avg
        ? Number(Number(ratingResult[0].avg).toFixed(1))
        : 0,
    };
  }

  // ---------------------------------------------------------------------------
  // Profile
  // ---------------------------------------------------------------------------

  async profile(actor: RequestActor | undefined) {
    const organizationId = this.organizationId(actor);
    return this.assertOrganization(organizationId);
  }

  async updateProfile(
    actor: RequestActor | undefined,
    body: Record<string, unknown>,
  ) {
    const organization = (await this.profile(actor)) as Record<string, unknown>;
    const now = new Date().toISOString();
    const brandName = body.brand_name
      ? String(body.brand_name)
      : String(organization['brand_name'] ?? '');
    const phone = body.phone
      ? String(body.phone)
      : String(organization['phone'] ?? '');
    const email = body.email
      ? String(body.email).toLowerCase()
      : String(organization['email'] ?? '');
    const address = body.address
      ? String(body.address)
      : String(organization['address'] ?? '');
    const taxId = body.tax_id ?? body.taxId ?? organization['tax_id'];

    const result = await this.pg.query(
      `UPDATE partner_organizations SET brand_name = $1, phone = $2, email = $3, address = $4, tax_id = $5, updated_at = $6 WHERE id = $7 RETURNING *`,
      [brandName, phone, email, address, taxId, now, organization['id']],
    );
    return result[0];
  }

  // ---------------------------------------------------------------------------
  // Team members
  // ---------------------------------------------------------------------------

  async team(actor: RequestActor | undefined) {
    const organizationId = this.organizationId(actor);
    return this.pg.query(
      `SELECT id::text, organization_id::text, email, full_name, role, status,
              created_at, updated_at
       FROM partner_users
       WHERE organization_id = $1 AND deleted_at IS NULL
       ORDER BY created_at DESC`,
      [organizationId],
    );
  }

  async inviteTeamMember(
    actor: RequestActor | undefined,
    body: Record<string, unknown>,
  ) {
    const email = String(body.email ?? '')
      .trim()
      .toLowerCase();
    if (!email) {
      throw new BadRequestException({
        code: 'EMAIL_REQUIRED',
        message: 'Email kiritilishi kerak',
      });
    }

    const now = new Date().toISOString();
    const [member] = await this.pg.query(
      `INSERT INTO partner_users
         (id, organization_id, email, password_hash, full_name, role, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'invited', $7, $8)
       ON CONFLICT (organization_id, email) DO UPDATE
       SET role = EXCLUDED.role,
           status = 'invited',
           deleted_at = NULL,
           updated_at = EXCLUDED.updated_at
       RETURNING id::text, organization_id::text, email, full_name, role, status, created_at, updated_at`,
      [
        randomUUID(),
        this.organizationId(actor),
        email,
        hashSecret(randomToken(32), partnerApiPepper()),
        body.full_name ? String(body.full_name) : null,
        String(body.role ?? 'operator'),
        now,
        now,
      ],
    );
    return member;
  }

  async updateTeamMember(
    actor: RequestActor | undefined,
    id: string,
    body: Record<string, unknown>,
  ) {
    const organizationId = this.organizationId(actor);
    const [member] = await this.pg.query(
      `UPDATE partner_users
       SET role = COALESCE($1, role),
           status = COALESCE($2, status),
           full_name = COALESCE($3, full_name),
           updated_at = $4
       WHERE id = $5 AND organization_id = $6 AND deleted_at IS NULL
       RETURNING id::text, organization_id::text, email, full_name, role, status, created_at, updated_at`,
      [
        body.role !== undefined ? String(body.role) : null,
        body.status !== undefined ? String(body.status) : null,
        body.full_name !== undefined ? String(body.full_name) : null,
        new Date().toISOString(),
        id,
        organizationId,
      ],
    );
    if (!member) {
      throw new NotFoundException({
        code: 'TEAM_MEMBER_NOT_FOUND',
        message: 'Jamoa aʼzosi topilmadi',
      });
    }
    return member;
  }

  async deleteTeamMember(actor: RequestActor | undefined, id: string) {
    const organizationId = this.organizationId(actor);
    const [member] = await this.pg.query(
      `UPDATE partner_users
       SET deleted_at = $1, status = 'deleted', updated_at = $1
       WHERE id = $2 AND organization_id = $3 AND deleted_at IS NULL
       RETURNING id::text`,
      [new Date().toISOString(), id, organizationId],
    );
    if (!member) {
      throw new NotFoundException({
        code: 'TEAM_MEMBER_NOT_FOUND',
        message: 'Jamoa aʼzosi topilmadi',
      });
    }
    return { id, deleted: true };
  }

  // ---------------------------------------------------------------------------
  // Documents
  // ---------------------------------------------------------------------------

  async documents(actor: RequestActor | undefined) {
    const organizationId = this.organizationId(actor);
    return this.pg.query(
      `SELECT pd.id::text, pd.organization_id::text, pd.type, pd.file_id::text,
              pd.status, pd.created_at, pd.updated_at,
              mf.url AS file_url, mf.caption AS file_name
       FROM partner_documents pd
       LEFT JOIN media_files mf ON mf.id = pd.file_id
       WHERE pd.organization_id = $1
       ORDER BY pd.created_at DESC`,
      [organizationId],
    );
  }

  async addDocument(
    actor: RequestActor | undefined,
    body: Record<string, unknown>,
  ) {
    const fileId = String(body.file_id ?? body.fileId ?? '').trim();
    if (!fileId) {
      throw new BadRequestException({
        code: 'DOCUMENT_FILE_REQUIRED',
        message: 'Hujjat fayli talab qilinadi',
      });
    }

    const now = new Date().toISOString();
    const [document] = await this.pg.query(
      `INSERT INTO partner_documents
         (id, organization_id, type, file_id, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'uploaded', $5, $6)
       RETURNING id::text, organization_id::text, type, file_id::text, status, created_at, updated_at`,
      [
        randomUUID(),
        this.organizationId(actor),
        String(body.type ?? 'license'),
        fileId,
        now,
        now,
      ],
    );
    return document;
  }

  // ---------------------------------------------------------------------------
  // Application
  // ---------------------------------------------------------------------------

  async submitApplication(actor: RequestActor | undefined) {
    const now = new Date().toISOString();
    const organizationId = this.organizationId(actor);
    const result = await this.pg.query(
      `UPDATE partner_organizations SET status = 'submitted', updated_at = $1 WHERE id = $2 RETURNING *`,
      [now, organizationId],
    );
    return result[0];
  }

  async applicationStatus(actor: RequestActor | undefined) {
    const organization = (await this.profile(actor)) as Record<string, unknown>;
    return {
      organization_id: String(organization['id'] ?? ''),
      status: String(organization['status'] ?? ''),
      history: [],
    };
  }

  /**
   * Faqat "rad etilgan" yoki "qo'shimcha ma'lumot so'ralgan" arizani
   * qayta topshirish mumkin. Avval bu yerda hech qanday holat tekshiruvi
   * yo'q edi — ALLAQACHON `approved` bo'lgan, to'liq ishlab turgan hamkor
   * ham shu endpointni chaqirib, o'z tashkilotini `submitted`ga
   * "tushirib qo'yishi" mumkin edi — bu esa `isPartnerLoginStatusAllowed`
   * ro'yxatida yo'q, ya'ni o'zini (va butun jamoasini) keyingi kirishda
   * qulflab qo'yardi.
   */
  async resubmitApplication(actor: RequestActor | undefined) {
    const now = new Date().toISOString();
    const organizationId = this.organizationId(actor);
    const result = await this.pg.query(
      `UPDATE partner_organizations
       SET status = 'submitted', updated_at = $1
       WHERE id = $2 AND status IN ('rejected', 'more_information_required')
       RETURNING *`,
      [now, organizationId],
    );
    if (!result[0]) {
      const [current] = await this.pg.query<{ status: string }>(
        `SELECT status FROM partner_organizations WHERE id = $1`,
        [organizationId],
      );
      throw new ConflictException({
        code: 'APPLICATION_RESUBMIT_INVALID',
        message: current
          ? `Arizani "${current.status}" holatidan qayta topshirib bo'lmaydi`
          : 'Tashkilot topilmadi',
      });
    }
    return result[0];
  }

  async submitPublicPartnerRequest(body: Record<string, unknown>) {
    const phone = this.normalizePhone(body.phone);
    const email = String(body.email ?? '')
      .trim()
      .toLowerCase();
    const brandName = String(
      body.companyName ?? body.brandName ?? body.company_name ?? '',
    ).trim();
    const legalName = String(
      body.legalName ?? body.legal_name ?? brandName,
    ).trim();
    const contactPerson = this.optionalString(
      body.contactPerson ?? body.contact_person,
    );
    const taxId = this.normalizeTaxId(body.taxId ?? body.tax_id);
    const fieldErrors: Record<string, string> = {};

    if (!brandName) {
      fieldErrors.companyName = 'Obyekt yoki kompaniya nomini kiriting';
    }
    if (!legalName) {
      fieldErrors.companyName = 'Yuridik nomni kiriting';
    }
    if (!phone) {
      fieldErrors.phone = 'Telefon raqamni kiriting';
    } else if (!this.isValidUzPhone(phone)) {
      fieldErrors.phone = "Telefon noto'g'ri formatda";
    }
    if (!email) {
      fieldErrors.email = 'Email kiriting';
    } else if (!this.isValidEmail(email)) {
      fieldErrors.email = "Email noto'g'ri formatda";
    }
    if (!taxId) {
      fieldErrors.taxId = 'STIR raqamini kiriting';
    } else if (!/^\d{9}$/.test(taxId)) {
      fieldErrors.taxId = "STIR 9 ta raqamdan iborat bo'lishi kerak";
    }

    if (Object.keys(fieldErrors).length > 0) {
      throw new BadRequestException({
        code: 'PARTNER_REQUEST_INVALID',
        message: "Hamkor arizasi ma'lumotlarini tekshiring",
        fields: fieldErrors,
      });
    }

    // Client "men bu telefonni tasdiqladim" deb claim qilsa ham, backend
    // buni SOURCE OF TRUTH sifatida qabul qilmaydi — faqat
    // `partnerRegistrationOtpVerify` (auth.service.ts) chiqargan, haqiqiy
    // server-side proof qabul qilinadi. Proof bir martalik: bu chaqiruv
    // uni muvaffaqiyatli/muvaffaqiyatsiz bo'lishidan qat'iy nazar "yeydi"
    // (RegistrationVerificationStore.redeem izohiga qarang).
    const phoneVerificationToken = String(
      body.phoneVerificationToken ?? body.phone_verification_token ?? '',
    ).trim();
    try {
      registrationVerificationStore.redeem(phoneVerificationToken, phone);
    } catch {
      throw new UnauthorizedException({
        code: 'PARTNER_PHONE_NOT_VERIFIED',
        message: 'Telefon raqami tasdiqlanmagan. Avval SMS orqali tasdiqlang.',
      });
    }

    const duplicates = await this.pg.query(
      `
        select id::text,
               regexp_replace(phone, '\\D', '', 'g') = regexp_replace($1, '\\D', '', 'g') as phone_match,
               lower(email) = lower($2) as email_match,
               tax_id = $3 as tax_id_match
        from partner_organizations
        where regexp_replace(phone, '\\D', '', 'g') = regexp_replace($1, '\\D', '', 'g')
           or lower(email) = lower($2)
           or tax_id = $3
        order by created_at desc
        limit 10
      `,
      [phone, email, taxId],
    );

    const duplicateErrors: Record<string, string> = {};
    for (const duplicate of duplicates) {
      if (duplicate['phone_match']) {
        duplicateErrors.phone =
          'Bu telefon raqam bilan ariza yoki hamkor mavjud';
      }
      if (duplicate['email_match']) {
        duplicateErrors.email = 'Bu email bilan ariza yoki hamkor mavjud';
      }
      if (duplicate['tax_id_match']) {
        duplicateErrors.taxId = 'Bu STIR bilan ariza yoki hamkor mavjud';
      }
    }

    if (Object.keys(duplicateErrors).length > 0) {
      throw new BadRequestException({
        code: 'PARTNER_REQUEST_DUPLICATE',
        message: "Bu ma'lumotlar bilan ariza yoki hamkor allaqachon mavjud",
        fields: duplicateErrors,
      });
    }

    const now = new Date().toISOString();
    const cityInput = String(body.city ?? body.city_id ?? '').trim();
    const note = this.optionalString(body.note);
    const cityId = await this.resolvePublicCityId(cityInput, [
      String(body.address ?? ''),
      note ?? '',
    ]);
    const partnerType = this.partnerType(body.type);
    const address = [this.optionalString(body.address), note && `Izoh: ${note}`]
      .filter(Boolean)
      .join('\n');

    const id = randomUUID();
    const inserted = await this.pg.query(
      `
        insert into partner_organizations (
          id, type, legal_name, brand_name, contact_person, tax_id, phone,
          email, city_id, address, status, default_commission_rate,
          created_at, updated_at
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9::uuid, $10, 'submitted', 12.00, $11, $11)
        returning id::text, type::text, legal_name, brand_name, contact_person,
                  tax_id, phone, email, city_id::text, address, status::text,
                  rejection_reason, created_at, updated_at
      `,
      [
        id,
        partnerType,
        legalName,
        brandName,
        contactPerson,
        taxId,
        phone,
        email,
        cityId,
        address,
        now,
      ],
    );

    return { item: this.publicPartnerRequestDto(inserted[0]) };
  }

  async publicPartnerRequestStatus(phone?: string, email?: string) {
    const normalizedPhone = this.normalizePhone(phone);
    const normalizedEmail = String(email ?? '')
      .trim()
      .toLowerCase();

    if (!normalizedPhone && !normalizedEmail) {
      return {
        found: false,
        status: 'not_found' satisfies PublicPartnerStatus,
        request: null,
      };
    }

    const rows = await this.pg.query(
      `
        select id::text, type::text, legal_name, brand_name, contact_person,
               tax_id, phone, email, city_id::text, address, status::text,
               rejection_reason, created_at, updated_at
        from partner_organizations
        where ($1::text <> '' and regexp_replace(phone, '\\D', '', 'g') = regexp_replace($1, '\\D', '', 'g'))
           or ($2::text <> '' and lower(email) = lower($2))
        order by created_at desc
        limit 1
      `,
      [normalizedPhone, normalizedEmail],
    );

    if (!rows[0]) {
      return {
        found: false,
        status: 'not_found' satisfies PublicPartnerStatus,
        request: null,
      };
    }

    const request = this.publicPartnerRequestDto(rows[0]);
    return {
      found: true,
      status: request.status,
      request,
    };
  }

  // ---------------------------------------------------------------------------
  // Hotels
  // ---------------------------------------------------------------------------

  async hotels(actor: RequestActor | undefined, query: QueryLike = {}) {
    const organizationId = this.organizationId(actor);
    const pagination = parsePagination(query, 'partner', {
      defaultLimit: 50,
      allowedSortBy: ['created_at', 'updated_at', 'status', 'stars'],
    });

    const sortColumn = pagination.sortBy === 'stars' ? 'stars' : 'created_at';
    const orderDir = pagination.order === 'asc' ? 'ASC' : 'DESC';

    // "Asosiy" e'lonni aniqlash tartibi: nashr qilingan (jonli, bron
    // qilinadigan) e'lon har doim birinchi — u tasdiqlangach avtomatik
    // tayyorlanadigan bo'sh "keyingi loyiha" qoralamasi asosiy bo'lib
    // ko'rinmasligi kerak. Ammo draft hali ham rad etilgan (rejected)
    // eski urinishdan ustun turadi — hamkor rad etilgandan keyin yangi
    // qoralamasini ko'rishi kerak, o'lik "rejected" yozuvni emas.
    const rows = await this.pg.query(
      `SELECT * FROM hotels
       WHERE partner_organization_id = $1
         AND deleted_at IS NULL
       ORDER BY CASE status
                  WHEN 'published' THEN 0
                  WHEN 'pending_review' THEN 1
                  WHEN 'hidden' THEN 2
                  WHEN 'draft' THEN 3
                  WHEN 'rejected' THEN 4
                  ELSE 5
                END,
                ${sortColumn} ${orderDir}
       LIMIT $2 OFFSET $3`,
      [organizationId, pagination.limit, pagination.offset],
    );
    return this.hydratePartnerHotels(rows);
  }

  async createHotel(
    actor: RequestActor | undefined,
    body: Record<string, unknown>,
  ) {
    const organizationId = this.organizationId(actor);
    const now = new Date().toISOString();
    const hotelId = randomUUID();

    // `city_id`/`address` bo'sh bo'lsa (masalan avtomatik "birinchi obyekt"
    // yaratilganda) hamkor arizasidagi ma'lumotlar bilan to'ldiramiz —
    // aks holda `hotels.city_id`/`address` NOT NULL cheklovi buziladi.
    const [organization] = await this.pg.query<{
      type: string;
      brand_name: string | null;
      legal_name: string | null;
      address: string | null;
      city_id: string | null;
    }>(
      `select type::text, brand_name, legal_name, address, city_id::text
       from partner_organizations where id = $1::uuid`,
      [organizationId],
    );

    // Biznes turi doimiy (ariza topshirilganda tanlanadi, o'zgartirib
    // bo'lmaydi) — shuning uchun uni haqiqiy qobiliyat cheklovi sifatida
    // hurmat qilamiz: sof "bus" turidagi hamkor mehmonxona/restoran e'loni
    // yarata olmasligi kerak. Avval bu yerda hech qanday tekshiruv yo'q
    // edi — har qanday tasdiqlangan hamkor turi cheklanmagan holda
    // istalgan turdagi e'lon yarata olardi.
    if (organization && !LODGING_LIKE_TYPES.has(organization.type)) {
      throw new ForbiddenException({
        code: 'HOTEL_TYPE_FORBIDDEN',
        message:
          "Bu hamkor turi uchun mehmonxona/restoran e'loni yaratish mumkin emas",
      });
    }

    const nameUzInput = this.optionalString(
      body.name_uz ??
        body.name ??
        organization?.brand_name ??
        organization?.legal_name,
    );
    if (!nameUzInput) {
      throw new BadRequestException({
        code: 'HOTEL_NAME_REQUIRED',
        message: 'Obyekt nomini kiriting',
      });
    }
    const nameUz = nameUzInput;
    const nameRu = this.optionalString(body.name_ru ?? body.name) ?? nameUz;
    const nameEn = this.optionalString(body.name_en ?? body.name) ?? nameUz;
    // Slug global miqyosda unique (`hotels_slug_key`). Agar chaqiruvchi
    // aniq slug bermasa (masalan avtomatik "Yangi obyekt" yaratilganda),
    // nomdan hosil qilingan slug BARCHA hamkorlar uchun bir xil chiqadi —
    // shu sabab hotelId bilan tuzlab, to'qnashuvni oldindan yo'q qilamiz.
    const slug = body.slug
      ? String(body.slug)
      : `${this.slugify(nameUz)}-${hotelId.slice(0, 8)}`;
    const cityId = String(body.city_id ?? organization?.city_id ?? '');
    const address = String(body.address ?? organization?.address ?? '');

    if (!cityId) {
      throw new BadRequestException({
        code: 'PARTNER_CITY_REQUIRED',
        message:
          "Hamkor arizasida shahar topilmadi. Avval profil ma'lumotlarini to'ldiring.",
      });
    }
    if (!address) {
      throw new BadRequestException({
        code: 'PARTNER_ADDRESS_REQUIRED',
        message:
          "Hamkor arizasida manzil topilmadi. Avval profil ma'lumotlarini to'ldiring.",
      });
    }
    const latitude =
      body.latitude === undefined || body.latitude === null
        ? null
        : Number(body.latitude);
    const longitude =
      body.longitude === undefined || body.longitude === null
        ? null
        : Number(body.longitude);
    const stars = Number(body.stars ?? 0);
    const checkInTime = this.optionalString(
      body.check_in_time ?? body.checkInTime,
    );
    const checkOutTime = this.optionalString(
      body.check_out_time ?? body.checkOutTime,
    );

    await this.pg.query(
      `INSERT INTO hotels (id, partner_organization_id, slug, city_id, address, latitude, longitude, stars, rating_average, reviews_count, status, check_in_time, check_out_time, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, 0, 'draft', $9, $10, $11, $12)`,
      [
        hotelId,
        organizationId,
        slug,
        cityId,
        address,
        latitude,
        longitude,
        stars,
        checkInTime,
        checkOutTime,
        now,
        now,
      ],
    );

    await this.pg.query(
      `INSERT INTO hotel_translations (hotel_id, language, name, description, created_at, updated_at) VALUES
       ($1, 'uz', $2, '', $3, $4),
       ($1, 'ru', $5, '', $3, $4),
       ($1, 'en', $6, '', $3, $4)`,
      [hotelId, nameUz, now, now, nameRu, nameEn],
    );

    // Return the created hotel
    const hotels = await this.pg.query(`SELECT * FROM hotels WHERE id = $1`, [
      hotelId,
    ]);
    return {
      ...hotels[0],
      name: { uz: nameUz, ru: nameRu, en: nameEn },
      description: { uz: '', ru: '', en: '' },
      amenities: [],
      images: [],
      image_ids: [],
    };
  }

  async hotel(actor: RequestActor | undefined, id: string) {
    const hotel = await this.assertHotel(id, actor);
    const [hydrated] = await this.hydratePartnerHotels([hotel]);
    return hydrated;
  }

  async updateHotel(
    actor: RequestActor | undefined,
    id: string,
    body: Record<string, unknown>,
  ) {
    await this.assertHotel(id, actor);
    const now = new Date().toISOString();
    const sets: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (body.address !== undefined) {
      sets.push(`address = $${paramIndex++}`);
      params.push(String(body.address));
    }
    if (body.stars !== undefined) {
      sets.push(`stars = $${paramIndex++}`);
      params.push(Number(body.stars));
    }
    if (body.status !== undefined) {
      sets.push(`status = $${paramIndex++}`);
      params.push(String(body.status));
    }
    if (body.latitude !== undefined) {
      sets.push(`latitude = $${paramIndex++}`);
      params.push(Number(body.latitude));
    }
    if (body.longitude !== undefined) {
      sets.push(`longitude = $${paramIndex++}`);
      params.push(Number(body.longitude));
    }
    if (body.check_in_time !== undefined) {
      sets.push(`check_in_time = $${paramIndex++}`);
      params.push(String(body.check_in_time));
    }
    if (body.check_out_time !== undefined) {
      sets.push(`check_out_time = $${paramIndex++}`);
      params.push(String(body.check_out_time));
    }
    // Dacha uchun
    if (body.land_area_sotix !== undefined) {
      sets.push(`land_area_sotix = $${paramIndex++}`);
      params.push(
        body.land_area_sotix === null ? null : Number(body.land_area_sotix),
      );
    }
    if (body.has_outdoor_pool !== undefined) {
      sets.push(`has_outdoor_pool = $${paramIndex++}`);
      params.push(Boolean(body.has_outdoor_pool));
    }
    if (body.has_indoor_pool !== undefined) {
      sets.push(`has_indoor_pool = $${paramIndex++}`);
      params.push(Boolean(body.has_indoor_pool));
    }
    if (body.has_sauna !== undefined) {
      sets.push(`has_sauna = $${paramIndex++}`);
      params.push(Boolean(body.has_sauna));
    }
    if (body.has_playstation !== undefined) {
      sets.push(`has_playstation = $${paramIndex++}`);
      params.push(Boolean(body.has_playstation));
    }
    if (body.has_billiards !== undefined) {
      sets.push(`has_billiards = $${paramIndex++}`);
      params.push(Boolean(body.has_billiards));
    }
    if (body.capacity_people !== undefined) {
      sets.push(`capacity_people = $${paramIndex++}`);
      params.push(
        body.capacity_people === null ? null : Number(body.capacity_people),
      );
    }
    // Sanatoriy uchun
    if (body.medical_profiles !== undefined) {
      sets.push(`medical_profiles = $${paramIndex++}::jsonb`);
      params.push(JSON.stringify(body.medical_profiles));
    }
    if (body.included_treatments !== undefined) {
      sets.push(`included_treatments = $${paramIndex++}::jsonb`);
      params.push(JSON.stringify(body.included_treatments));
    }
    if (body.meal_plan_type !== undefined) {
      sets.push(`meal_plan_type = $${paramIndex++}`);
      params.push(
        body.meal_plan_type === null ? null : String(body.meal_plan_type),
      );
    }

    if (sets.length === 0) {
      return this.assertHotel(id, actor);
    }

    sets.push(`updated_at = $${paramIndex++}`);
    params.push(now);
    params.push(id);

    const result = await this.pg.query(
      `UPDATE hotels SET ${sets.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params,
    );
    return result[0];
  }

  /**
   * Hamkor o'z e'lonini butunlay tozalab, boshidan to'ldirishni xohlasa
   * ishlatiladi — nashr qilingan bo'lsa ham darhol yashiriladi (status:
   * 'draft'), barcha rasm/qulaylik/xona ma'lumotlari o'chiriladi.
   * Qaytarib bo'lmaydi, shuning uchun frontend albatta tasdiqlash so'raydi.
   */
  async resetHotel(actor: RequestActor | undefined, id: string) {
    await this.assertHotel(id, actor);
    const now = new Date().toISOString();

    await this.pg.query(
      `delete from hotel_amenities where hotel_id = $1::uuid`,
      [id],
    );
    await this.pg.query(
      `update media_files
       set deleted_at = $2, is_cover = false
       where owner_type = 'hotel'
         and owner_id = $1::uuid
         and deleted_at is null`,
      [id, now],
    );
    await this.pg.query(`delete from hotel_rooms where hotel_id = $1::uuid`, [
      id,
    ]);
    // `room_types` mehmonxona ustuniga ega emas — bu hotelga tegishli
    // yozuvlar faqat `code` ichida hotelId borligi orqali aniqlanadi (qarang
    // `roomTypes()` va `assertRoomTypeOwnedByHotel`). Yuqoridagi
    // `hotel_rooms` o'chirilgandan keyin bu turlarni tozalamasak, ular
    // "hech kimga bog'lanmagan" holatda saqlanib qolib, keyingi
    // `roomTypes()` chaqiruvida `code LIKE '%hotelId%'` orqali qayta
    // qaytariladi — reset qilingan e'londa eski narx/sig'im "arvoh" bo'lib
    // yana ko'rinib qoladi (customer preview'da ham).
    await this.pg.query(
      `delete from room_types
       where code like '%' || $1::text || '%'
         and not exists (
           select 1 from hotel_rooms
           where hotel_rooms.room_type_id = room_types.id
             and hotel_rooms.hotel_id <> $1::uuid
         )`,
      [id],
    );
    await this.pg.query(
      `update hotel_translations
       set name = '', short_description = '', description = '', updated_at = $2
       where hotel_id = $1::uuid`,
      [id, now],
    );
    const updatedRows = await this.pg.query(
      `update hotels
       set address = '', latitude = null, longitude = null, stars = 0,
           status = 'draft', featured = false,
           check_in_time = null, check_out_time = null,
           cancellation_policy_id = null, cancellation_policy_code = 'MODERATE',
           smoking_allowed = false, pets_allowed = false, children_allowed = true,
           extra_fees = '[]'::jsonb, rules_completed_at = null,
           submitted_at = null, submitted_by = null,
           reviewed_at = null, reviewed_by = null, rejection_reason = null,
           next_draft_prepared_at = null,
           updated_at = $2
       where id = $1::uuid
       returning *`,
      [id, now],
    );

    this.notifyListingChanged(updatedRows[0], actor, 'updated', [
      'general',
      'photos',
      'amenities',
      'rooms',
      'rules',
      'location',
    ]);

    return this.hotel(actor, id);
  }

  async submitHotelReview(actor: RequestActor | undefined, id: string) {
    await this.assertListingSubmissionReady(actor, id);
    const now = new Date().toISOString();
    const submittedBy = this.submissionActorId(actor);
    const result = await this.pg.query(
      `UPDATE hotels
       SET status = 'pending_review',
            submitted_at = $1,
            submitted_by = $2::uuid,
            reviewed_at = null,
            reviewed_by = null,
            rejection_reason = null,
            updated_at = $1
        WHERE id = $3
        RETURNING *`,
      [now, submittedBy, id],
    );
    const updated = result[0];
    this.notifyListingChanged(updated, actor, 'submitted', ['status']);
    return updated;
  }

  async addHotelImage(
    actor: RequestActor | undefined,
    id: string,
    body: Record<string, unknown>,
  ) {
    await this.assertHotel(id, actor);
    const uploadedFileId = this.optionalString(body.file_id ?? body.fileId);

    if (uploadedFileId) {
      if (!actor?.id) {
        throw new ForbiddenException({
          code: 'IMAGE_OWNER_REQUIRED',
          message: 'Rasm egasi aniqlanmadi',
        });
      }

      const [uploaded] = await this.pg.query<{
        id: string;
        url: string | null;
      }>(
        `SELECT id::text, url
         FROM media_files
         WHERE id = $1::uuid
           AND owner_id = $2::uuid
           AND deleted_at IS NULL`,
        [uploadedFileId, actor.id],
      );
      if (!uploaded?.url) {
        throw new BadRequestException({
          code: 'IMAGE_UPLOAD_NOT_FOUND',
          message: 'Yuklangan rasm topilmadi yoki sizga tegishli emas',
        });
      }

      const [order] = await this.pg.query<{
        next_order: number;
        image_count: number;
      }>(
        `SELECT coalesce(max(sort_order) + 1, 0)::int as next_order,
                count(*)::int as image_count
         FROM media_files
         WHERE owner_type = 'hotel' AND owner_id = $1::uuid AND deleted_at IS NULL`,
        [id],
      );

      await this.pg.query(
        `UPDATE media_files
         SET owner_type = 'hotel', owner_id = $1::uuid, bucket = 'image',
             visibility = 'public',
             caption = nullif($3, ''),
             category = nullif($4, ''),
             sort_order = $5,
             is_cover = $6
         WHERE id = $2::uuid AND deleted_at IS NULL`,
        [
          id,
          uploaded.id,
          String(body.caption ?? ''),
          String(body.category ?? ''),
          order?.next_order ?? 0,
          (order?.image_count ?? 0) === 0,
        ],
      );
      await this.touchHotel(id, new Date().toISOString());
      this.notifyListingChanged(
        { id, partner_organization_id: actor.organizationId },
        actor,
        'updated',
        ['media'],
      );
      return { hotel_id: id, image_id: uploaded.id, image_url: uploaded.url };
    }

    throw new BadRequestException({
      code: 'IMAGE_UPLOAD_REQUIRED',
      message: 'Rasmni avval serverga yuklash kerak',
    });
  }

  async deleteHotelImage(
    actor: RequestActor | undefined,
    id: string,
    imageId: string,
  ) {
    await this.assertHotel(id, actor);
    const now = new Date().toISOString();
    const result = await this.pg.query<{ id: string }>(
      `UPDATE media_files
       SET deleted_at = $1
       WHERE owner_type = 'hotel'
         AND owner_id = $2::uuid
         AND deleted_at IS NULL
         AND (id::text = $3 OR url = $3)
       RETURNING id::text`,
      [now, id, imageId],
    );
    await this.touchHotel(id, now);
    this.notifyListingChanged(
      { id, partner_organization_id: actor?.organizationId },
      actor,
      'updated',
      ['media'],
    );
    return {
      hotel_id: id,
      image_id: result[0]?.id ?? imageId,
      deleted: result.length > 0,
    };
  }

  async updateHotelImage(
    actor: RequestActor | undefined,
    id: string,
    imageId: string,
    body: Record<string, unknown>,
  ) {
    await this.assertHotel(id, actor);
    const now = new Date().toISOString();
    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (body.caption !== undefined) {
      sets.push(`caption = nullif($${idx++}, '')`);
      params.push(String(body.caption));
    }
    if (body.category !== undefined) {
      sets.push(`category = nullif($${idx++}, '')`);
      params.push(String(body.category));
    }
    if (body.sortOrder !== undefined || body.sort_order !== undefined) {
      sets.push(`sort_order = $${idx++}`);
      params.push(Number(body.sortOrder ?? body.sort_order));
    }
    if (body.isCover !== undefined || body.is_cover !== undefined) {
      const isCover = Boolean(body.isCover ?? body.is_cover);
      if (isCover) {
        await this.pg.query(
          `UPDATE media_files
           SET is_cover = false
           WHERE owner_type = 'hotel'
             AND owner_id = $1::uuid
             AND deleted_at IS NULL`,
          [id],
        );
      }
      sets.push(`is_cover = $${idx++}`);
      params.push(isCover);
    }

    if (sets.length === 0) {
      const [image] = await this.pg.query(
        `SELECT id::text, owner_id::text, url, caption, category, sort_order, is_cover
         FROM media_files
         WHERE owner_type = 'hotel'
           AND owner_id = $1::uuid
           AND id = $2::uuid
           AND deleted_at IS NULL`,
        [id, imageId],
      );
      if (!image) {
        throw new NotFoundException({
          code: 'IMAGE_NOT_FOUND',
          message: 'Rasm topilmadi',
        });
      }
      return image;
    }

    params.push(id);
    params.push(imageId);
    const [image] = await this.pg.query(
      `UPDATE media_files
       SET ${sets.join(', ')}
       WHERE owner_type = 'hotel'
         AND owner_id = $${idx++}::uuid
         AND id = $${idx}::uuid
         AND deleted_at IS NULL
       RETURNING id::text, owner_id::text, url, caption, category, sort_order, is_cover`,
      params,
    );
    if (!image) {
      throw new NotFoundException({
        code: 'IMAGE_NOT_FOUND',
        message: 'Rasm topilmadi',
      });
    }
    await this.touchHotel(id, now);
    this.notifyListingChanged(
      { id, partner_organization_id: actor?.organizationId },
      actor,
      'updated',
      ['media'],
    );
    return image;
  }

  // ---------------------------------------------------------------------------
  // Rooms
  // ---------------------------------------------------------------------------

  async rooms(actor: RequestActor | undefined, id: string) {
    await this.assertHotel(id, actor);
    return this.pg.query(
      `SELECT * FROM hotel_rooms WHERE hotel_id = $1 ORDER BY code ASC`,
      [id],
    );
  }

  async roomTypes(actor: RequestActor | undefined, id: string) {
    await this.assertHotel(id, actor);
    return this.pg.query(
      `SELECT rt.id::text, rt.code, rt.name, rt.description, rt.image_url,
        rt.bed_type, rt.size_sqm, rt.amenities, rt.created_at, rt.updated_at,
        COALESCE(rt.base_price::float8, MIN(hr.base_price)::float8) as base_price,
        COALESCE(rt.capacity, MAX(hr.max_adults), MAX(hr.base_occupancy)) as capacity,
        COALESCE(rt.capacity, MAX(hr.max_adults), MAX(hr.base_occupancy)) as max_adults,
        COALESCE(rt.capacity, MAX(hr.base_occupancy), MAX(hr.max_adults)) as base_occupancy
       FROM room_types rt
       LEFT JOIN hotel_rooms hr ON hr.room_type_id = rt.id AND hr.hotel_id = $1
       GROUP BY rt.id, rt.code, rt.name, rt.description, rt.image_url,
         rt.bed_type, rt.size_sqm, rt.base_price, rt.capacity, rt.amenities,
         rt.created_at, rt.updated_at
       HAVING COUNT(hr.id) > 0 OR rt.code LIKE '%' || $1::text || '%'
       ORDER BY rt.name ->> 'uz' ASC`,
      [id],
    );
  }

  async createRoomType(
    actor: RequestActor | undefined,
    id: string,
    body: Record<string, unknown>,
  ) {
    await this.assertHotel(id, actor);
    const roomTypeId = randomUUID();
    const now = new Date().toISOString();
    const name = localizedText(body, 'name');
    const code = this.slugify(String(body.code ?? `${name.uz}-${id}`));
    const basePrice = this.requiredNonNegativeNumber(
      body.base_price ?? body.basePrice,
      'ROOM_TYPE_PRICE_REQUIRED',
      'Xona turi narxi kiritilishi kerak',
    );
    const capacity = this.requiredPositiveInteger(
      body.capacity ?? body.max_adults ?? body.base_occupancy,
      'ROOM_TYPE_CAPACITY_REQUIRED',
      "Xona turi sig'imi kiritilishi kerak",
    );
    const amenities = Array.isArray(body.amenities)
      ? body.amenities.map(String).filter(Boolean)
      : [];

    // `room_types.code` butun platformada global UNIQUE, lekin xona turi
    // narxi/sig'imi/rasmi kabi maydonlari mehmonxonaga xos bo'lishi kerak.
    // `hotel_rooms` orqali ALLAQACHON boshqa mehmonxonaga bog'langan
    // kodni qayta yozishga (ON CONFLICT DO UPDATE orqali) urinish o'sha
    // boshqa hamkorning ma'lumotini jimgina buzib qo'yardi — bu yerda
    // oldindan tekshirib, aniq xato bilan rad etamiz.
    const [conflictingOwner] = await this.pg.query<{ hotel_id: string }>(
      `SELECT DISTINCT hr.hotel_id::text
       FROM hotel_rooms hr
       JOIN room_types rt ON rt.id = hr.room_type_id
       WHERE rt.code = $1 AND hr.hotel_id <> $2::uuid
       LIMIT 1`,
      [code, id],
    );
    if (conflictingOwner) {
      throw new ConflictException({
        code: 'ROOM_TYPE_CODE_TAKEN',
        message:
          'Bu kod bilan xona turi boshqa mehmonxonada allaqachon mavjud. Boshqa kod tanlang.',
      });
    }

    const [roomType] = await this.pg.query(
      `INSERT INTO room_types
         (id, code, name, description, image_url, bed_type, size_sqm,
          base_price, capacity, amenities, created_at, updated_at)
       VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $11)
       ON CONFLICT (code) DO UPDATE
       SET name = EXCLUDED.name,
           description = EXCLUDED.description,
           image_url = EXCLUDED.image_url,
           bed_type = EXCLUDED.bed_type,
           size_sqm = EXCLUDED.size_sqm,
           base_price = EXCLUDED.base_price,
           capacity = EXCLUDED.capacity,
           amenities = EXCLUDED.amenities,
           updated_at = EXCLUDED.updated_at
       RETURNING id::text, code, name, description, image_url, bed_type,
         size_sqm, base_price::float8, capacity, capacity as max_adults,
         capacity as base_occupancy, amenities, created_at, updated_at`,
      [
        roomTypeId,
        code,
        JSON.stringify(name),
        this.optionalString(body.description),
        this.optionalString(body.image_url ?? body.imageUrl),
        this.optionalString(body.bed_type ?? body.bedType),
        this.optionalInteger(body.size_sqm ?? body.sizeSqm),
        basePrice,
        capacity,
        JSON.stringify(amenities),
        now,
      ],
    );
    return roomType;
  }

  /**
   * `room_types` mehmonxona/tashkilot ustuniga ega emas (global,
   * kod-kalitli jadval) — shuning uchun xona turini haqiqatan kim
   * "egallagani" faqat `hotel_rooms` orqali bilinadi. Agar bu turdan
   * hali hech qanday xona foydalanmagan bo'lsa (masalan yangi yaratilgan,
   * xonalar hali qo'shilmagan), uni har qanday hamkor tahrirlashi/
   * o'chirishi mumkin bo'lib qolar edi — shu holatni ham yopish uchun
   * "hech kimga bog'lanmagan" holat ham "meniki" deb hisoblanadi.
   *
   * MUHIM: bir xil `room_type` (masalan seed'dagi "standard"/"deluxe")
   * BIR NECHTA mehmonxona tomonidan qonuniy ravishda baham ko'rilishi
   * mumkin (`hotel_rooms` orqali). Ilgari bu yerda "agar BOSHQA mehmonxona
   * ham shu turdan foydalansa — rad et" deb tekshirilardi — bu esa
   * xuddi shu turdan foydalanayotgan HAMMA hamkorlarni (jumladan joriy
   * hamkorning o'zini ham!) "begona" deb hisoblab, tahrirlash/o'chirishni
   * butunlay bloklab qo'yardi (real production QA orqali topilgan —
   * `403 Forbidden` xatosi, "Bu xona turi boshqa mehmonxonaga tegishli").
   * Endi to'g'ri mantiq: joriy mehmonxonaning O'ZI shu turdan foydalansa —
   * ruxsat (boshqalar ham foydalanishi muhim emas). Faqat joriy mehmonxona
   * UMUMAN foydalanmagan VA bu tur FAQAT boshqa (begona) mehmonxona(lar)ga
   * bog'langan bo'lsagina — rad etiladi.
   */
  private async assertRoomTypeOwnedByHotel(
    hotelId: string,
    roomTypeId: string,
  ) {
    const [row] = await this.pg.query<{
      owned_by_self: boolean;
      used_by_other: boolean;
    }>(
      `SELECT
         EXISTS (
           SELECT 1 FROM hotel_rooms
           WHERE room_type_id = $1::uuid AND hotel_id = $2::uuid
         ) AS owned_by_self,
         EXISTS (
           SELECT 1 FROM hotel_rooms
           WHERE room_type_id = $1::uuid AND hotel_id <> $2::uuid
         ) AS used_by_other`,
      [roomTypeId, hotelId],
    );
    if (!row?.owned_by_self && row?.used_by_other) {
      throw new ForbiddenException({
        code: 'ROOM_TYPE_FORBIDDEN',
        message: 'Bu xona turi boshqa mehmonxonaga tegishli',
      });
    }
  }

  async updateRoomType(
    actor: RequestActor | undefined,
    id: string,
    roomTypeId: string,
    body: Record<string, unknown>,
  ) {
    await this.assertHotel(id, actor);
    await this.assertRoomTypeOwnedByHotel(id, roomTypeId);
    const now = new Date().toISOString();
    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;
    if (
      body.name !== undefined ||
      body.name_uz !== undefined ||
      body.name_ru !== undefined ||
      body.name_en !== undefined
    ) {
      sets.push(`name = $${idx++}::jsonb`);
      params.push(JSON.stringify(localizedText(body, 'name')));
    }
    if (body.description !== undefined) {
      sets.push(`description = $${idx++}`);
      params.push(this.optionalString(body.description));
    }
    if (body.image_url !== undefined || body.imageUrl !== undefined) {
      sets.push(`image_url = $${idx++}`);
      params.push(this.optionalString(body.image_url ?? body.imageUrl));
    }
    if (body.bed_type !== undefined || body.bedType !== undefined) {
      sets.push(`bed_type = $${idx++}`);
      params.push(this.optionalString(body.bed_type ?? body.bedType));
    }
    if (body.size_sqm !== undefined || body.sizeSqm !== undefined) {
      sets.push(`size_sqm = $${idx++}`);
      params.push(this.optionalInteger(body.size_sqm ?? body.sizeSqm));
    }
    if (body.base_price !== undefined || body.basePrice !== undefined) {
      sets.push(`base_price = $${idx++}`);
      params.push(
        this.requiredNonNegativeNumber(
          body.base_price ?? body.basePrice,
          'ROOM_TYPE_PRICE_REQUIRED',
          'Xona turi narxi kiritilishi kerak',
        ),
      );
    }
    if (
      body.capacity !== undefined ||
      body.max_adults !== undefined ||
      body.base_occupancy !== undefined
    ) {
      sets.push(`capacity = $${idx++}`);
      params.push(
        this.requiredPositiveInteger(
          body.capacity ?? body.max_adults ?? body.base_occupancy,
          'ROOM_TYPE_CAPACITY_REQUIRED',
          "Xona turi sig'imi kiritilishi kerak",
        ),
      );
    }
    if (Array.isArray(body.amenities)) {
      sets.push(`amenities = $${idx++}::jsonb`);
      params.push(JSON.stringify(body.amenities.map(String).filter(Boolean)));
    }

    if (sets.length === 0) {
      const rows = await this.pg.query(
        `SELECT id::text, code, name, description, image_url, bed_type,
          size_sqm, base_price::float8, capacity, capacity as max_adults,
          capacity as base_occupancy, amenities, created_at, updated_at
         FROM room_types WHERE id = $1::uuid`,
        [roomTypeId],
      );
      if (!rows[0]) {
        throw new NotFoundException({
          code: 'ROOM_TYPE_NOT_FOUND',
          message: 'Xona turi topilmadi',
        });
      }
      return rows[0];
    }

    sets.push(`updated_at = $${idx++}`);
    params.push(now);
    params.push(roomTypeId);
    const rows = await this.pg.query(
      `UPDATE room_types
       SET ${sets.join(', ')}
       WHERE id = $${idx}::uuid
       RETURNING id::text, code, name, description, image_url, bed_type,
         size_sqm, base_price::float8, capacity, capacity as max_adults,
         capacity as base_occupancy, amenities, created_at, updated_at`,
      params,
    );
    if (!rows[0]) {
      throw new NotFoundException({
        code: 'ROOM_TYPE_NOT_FOUND',
        message: 'Xona turi topilmadi',
      });
    }
    return rows[0];
  }

  async deleteRoomType(
    actor: RequestActor | undefined,
    id: string,
    roomTypeId: string,
  ) {
    await this.assertHotel(id, actor);
    await this.assertRoomTypeOwnedByHotel(id, roomTypeId);
    const rooms = await this.pg.query(
      `SELECT id::text FROM hotel_rooms WHERE hotel_id = $1 AND room_type_id = $2 LIMIT 1`,
      [id, roomTypeId],
    );
    if (rooms[0]) {
      return {
        ok: false,
        reason:
          "Bu turdan foydalanayotgan xonalar bor. Avval ularni boshqa turga o'tkazing.",
      };
    }

    await this.pg.query(
      `DELETE FROM room_types WHERE id = $1::uuid AND NOT EXISTS (
        SELECT 1 FROM hotel_rooms WHERE room_type_id = $1::uuid
      )`,
      [roomTypeId],
    );
    return { ok: true, room_type_id: roomTypeId, deleted: true };
  }

  async createRoom(
    actor: RequestActor | undefined,
    id: string,
    body: Record<string, unknown>,
  ) {
    await this.assertHotel(id, actor);
    const now = new Date().toISOString();
    const roomId = randomUUID();
    const code = this.requiredString(
      body.code ?? body.number ?? body.room_number,
      'ROOM_CODE_REQUIRED',
      'Xona raqami kiritilishi kerak',
    );
    const roomTypeId = String(
      body.room_type_id ?? body.roomTypeId ?? body.room_type ?? '',
    ).trim();
    const roomType = await this.assertRoomType(roomTypeId);
    const capacity = this.requiredPositiveInteger(
      body.capacity ??
        body.max_adults ??
        body.base_occupancy ??
        roomType.capacity,
      'ROOM_CAPACITY_REQUIRED',
      "Xona sig'imi kiritilishi kerak",
    );
    const baseOccupancy =
      this.optionalPositiveInteger(body.base_occupancy) ?? capacity;
    const maxAdults = this.optionalPositiveInteger(body.max_adults) ?? capacity;
    const maxChildren = this.optionalInteger(body.max_children) ?? 0;
    const totalInventory = Number(body.total_inventory ?? body.inventory ?? 1);
    const basePrice = this.requiredNonNegativeNumber(
      body.base_price ??
        body.basePrice ??
        body.nightlyPrice ??
        roomType.base_price,
      'ROOM_PRICE_REQUIRED',
      'Xona narxi kiritilishi kerak',
    );
    const floor = this.optionalInteger(body.floor);
    const housekeepingStatus = this.roomHousekeepingStatus(body.status);
    const isListed =
      body.isListed !== undefined ? Boolean(body.isListed) : true;

    await this.pg.query(
      `INSERT INTO hotel_rooms
         (id, hotel_id, room_type_id, code, floor, base_occupancy, max_adults,
          max_children, total_inventory, base_price, status, housekeeping_status,
          is_listed, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
         $11::"RoomStatus", $12, $13, $14, $15)`,
      [
        roomId,
        id,
        roomTypeId,
        code,
        floor,
        baseOccupancy,
        maxAdults,
        maxChildren,
        totalInventory,
        basePrice,
        isListed ? 'active' : 'inactive',
        housekeepingStatus,
        isListed,
        now,
        now,
      ],
    );

    const rooms = await this.pg.query(
      `SELECT * FROM hotel_rooms WHERE id = $1`,
      [roomId],
    );
    return rooms[0];
  }

  async updateRoom(
    actor: RequestActor | undefined,
    id: string,
    roomId: string,
    body: Record<string, unknown>,
  ) {
    await this.assertHotel(id, actor);
    const now = new Date().toISOString();

    const sets: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (body.code !== undefined || body.number !== undefined) {
      sets.push(`code = $${paramIndex++}`);
      params.push(
        this.requiredString(
          body.code ?? body.number,
          'ROOM_CODE_REQUIRED',
          'Xona raqami kiritilishi kerak',
        ),
      );
    }
    if (body.room_type_id !== undefined || body.roomTypeId !== undefined) {
      await this.assertRoomType(String(body.room_type_id ?? body.roomTypeId));
      sets.push(`room_type_id = $${paramIndex++}`);
      params.push(String(body.room_type_id ?? body.roomTypeId));
    }
    if (body.floor !== undefined) {
      sets.push(`floor = $${paramIndex++}`);
      params.push(this.optionalInteger(body.floor));
    }
    if (body.base_price !== undefined) {
      sets.push(`base_price = $${paramIndex++}`);
      params.push(
        this.requiredNonNegativeNumber(
          body.base_price,
          'ROOM_PRICE_REQUIRED',
          'Xona narxi kiritilishi kerak',
        ),
      );
    } else if (body.basePrice !== undefined) {
      sets.push(`base_price = $${paramIndex++}`);
      params.push(
        this.requiredNonNegativeNumber(
          body.basePrice,
          'ROOM_PRICE_REQUIRED',
          'Xona narxi kiritilishi kerak',
        ),
      );
    } else if (body.nightlyPrice !== undefined) {
      sets.push(`base_price = $${paramIndex++}`);
      params.push(
        this.requiredNonNegativeNumber(
          body.nightlyPrice,
          'ROOM_PRICE_REQUIRED',
          'Xona narxi kiritilishi kerak',
        ),
      );
    }
    if (body.total_inventory !== undefined) {
      sets.push(`total_inventory = $${paramIndex++}`);
      params.push(Number(body.total_inventory));
    } else if (body.inventory !== undefined) {
      sets.push(`total_inventory = $${paramIndex++}`);
      params.push(Number(body.inventory));
    }
    if (body.base_occupancy !== undefined) {
      sets.push(`base_occupancy = $${paramIndex++}`);
      params.push(Number(body.base_occupancy));
    } else if (body.capacity !== undefined) {
      sets.push(`base_occupancy = $${paramIndex++}`);
      params.push(Number(body.capacity));
    }
    if (body.max_adults !== undefined) {
      sets.push(`max_adults = $${paramIndex++}`);
      params.push(Number(body.max_adults));
    } else if (body.capacity !== undefined) {
      sets.push(`max_adults = $${paramIndex++}`);
      params.push(Number(body.capacity));
    }
    if (body.status !== undefined) {
      sets.push(`housekeeping_status = $${paramIndex++}`);
      params.push(this.roomHousekeepingStatus(body.status));
    }
    if (body.isListed !== undefined) {
      const isListed = Boolean(body.isListed);
      sets.push(`is_listed = $${paramIndex++}`);
      params.push(isListed);
      sets.push(`status = $${paramIndex++}::"RoomStatus"`);
      params.push(isListed ? 'active' : 'inactive');
    }

    if (sets.length === 0) {
      const rooms = await this.pg.query(
        `SELECT * FROM hotel_rooms WHERE id = $1 AND hotel_id = $2`,
        [roomId, id],
      );
      if (!rooms[0]) {
        throw new NotFoundException({
          code: 'ROOM_NOT_AVAILABLE',
          message: 'Xona topilmadi',
        });
      }
      return rooms[0];
    }

    sets.push(`updated_at = $${paramIndex++}`);
    params.push(now);
    params.push(roomId);
    params.push(id);

    const result = await this.pg.query(
      `UPDATE hotel_rooms SET ${sets.join(', ')} WHERE id = $${paramIndex++} AND hotel_id = $${paramIndex} RETURNING *`,
      params,
    );

    if (!result[0]) {
      throw new NotFoundException({
        code: 'ROOM_NOT_AVAILABLE',
        message: 'Xona topilmadi',
      });
    }
    return result[0];
  }

  async createRoomsBulk(
    actor: RequestActor | undefined,
    id: string,
    body: Record<string, unknown>,
  ) {
    await this.assertHotel(id, actor);
    const startNumber = this.requiredPositiveInteger(
      body.startNumber ?? body.start_number,
      'ROOM_START_NUMBER_REQUIRED',
      'Boshlanish raqami kiritilishi kerak',
    );
    const count = this.requiredPositiveInteger(
      body.count,
      'ROOM_COUNT_REQUIRED',
      'Xonalar soni kiritilishi kerak',
    );
    if (count > 200) {
      throw new BadRequestException({
        code: 'ROOM_COUNT_TOO_LARGE',
        message: 'Xonalar soni 200 tadan oshmasligi kerak',
      });
    }
    const roomTypeId = String(
      body.roomTypeId ?? body.room_type_id ?? body.room_type ?? '',
    ).trim();
    const roomType = await this.assertRoomType(roomTypeId);
    const floor = this.optionalInteger(body.floor);
    const capacity =
      this.optionalPositiveInteger(body.capacity) ?? roomType.capacity;
    const baseOccupancy =
      this.optionalPositiveInteger(body.base_occupancy) ?? capacity;
    const maxAdults = this.optionalPositiveInteger(body.max_adults) ?? capacity;
    const maxChildren = this.optionalInteger(body.max_children) ?? 0;
    const totalInventory =
      this.optionalPositiveInteger(body.total_inventory ?? body.inventory) ?? 1;
    const basePrice = this.requiredNonNegativeNumber(
      body.base_price ?? body.basePrice ?? roomType.base_price,
      'ROOM_PRICE_REQUIRED',
      'Xona narxi kiritilishi kerak',
    );

    // Get existing codes
    const existing = await this.pg.query(
      `SELECT code FROM hotel_rooms WHERE hotel_id = $1`,
      [id],
    );
    const existingCodes = new Set(existing.map((r) => String(r['code'])));

    const created: Array<Record<string, unknown>> = [];
    const now = new Date().toISOString();

    for (let index = 0; index < count; index += 1) {
      const code = String(startNumber + index);
      if (existingCodes.has(code)) {
        continue;
      }
      existingCodes.add(code);

      const roomId = randomUUID();

      await this.pg.query(
        `INSERT INTO hotel_rooms
           (id, hotel_id, room_type_id, code, floor, base_occupancy, max_adults,
            max_children, total_inventory, base_price, status,
            housekeeping_status, is_listed, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
           'active', 'VACANT_CLEAN', true, $11, $12)`,
        [
          roomId,
          id,
          roomTypeId,
          code,
          floor,
          baseOccupancy,
          maxAdults,
          maxChildren,
          totalInventory,
          basePrice,
          now,
          now,
        ],
      );

      created.push({
        id: roomId,
        code,
        hotel_id: id,
        room_type_id: roomTypeId,
        floor,
        base_price: basePrice,
        housekeeping_status: 'VACANT_CLEAN',
        is_listed: true,
      });
    }

    return {
      ok: created.length === count,
      added: created.length,
      rooms: created,
      reason:
        created.length === count
          ? undefined
          : "Ba'zi xona raqamlari oldindan mavjud bo'lgani uchun o'tkazib yuborildi.",
    };
  }

  async deleteRoom(
    actor: RequestActor | undefined,
    id: string,
    roomId: string,
  ) {
    await this.assertHotel(id, actor);
    const now = new Date().toISOString();
    await this.pg.query(
      `UPDATE hotel_rooms
       SET status = 'inactive', is_listed = false, updated_at = $1
       WHERE id = $2 AND hotel_id = $3`,
      [now, roomId, id],
    );
    return { hotel_id: id, room_id: roomId, deleted: true };
  }

  async beds(actor: RequestActor | undefined, id: string) {
    await this.assertHotel(id, actor);
    return this.pg.query(
      `SELECT rb.id::text, rb.room_id::text, rb.label, rb.status,
              rb.is_listed, rb.nightly_price::float8, rb.created_at, rb.updated_at
       FROM room_beds rb
       JOIN hotel_rooms hr ON hr.id = rb.room_id
       WHERE hr.hotel_id = $1
       ORDER BY hr.code ASC, rb.label ASC`,
      [id],
    );
  }

  async roomBeds(actor: RequestActor | undefined, id: string, roomId: string) {
    await this.assertRoomForHotel(actor, id, roomId);
    return this.pg.query(
      `SELECT id::text, room_id::text, label, status, is_listed,
              nightly_price::float8, created_at, updated_at
       FROM room_beds
       WHERE room_id = $1
       ORDER BY label ASC`,
      [roomId],
    );
  }

  async createBed(
    actor: RequestActor | undefined,
    id: string,
    roomId: string,
    body: Record<string, unknown>,
  ) {
    await this.assertRoomForHotel(actor, id, roomId);
    const now = new Date().toISOString();
    const [bed] = await this.pg.query<{ id: string }>(
      `INSERT INTO room_beds
         (id, room_id, label, status, is_listed, nightly_price, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
       RETURNING id::text, room_id::text, label, status, is_listed,
         nightly_price::float8, created_at, updated_at`,
      [
        randomUUID(),
        roomId,
        this.requiredString(
          body.label,
          'BED_LABEL_REQUIRED',
          'Yotoq nomi kiritilishi kerak',
        ),
        this.roomHousekeepingStatus(body.status),
        body.isListed !== undefined ? Boolean(body.isListed) : true,
        this.optionalNonNegativeNumber(body.nightlyPrice ?? body.nightly_price),
        now,
      ],
    );
    return bed;
  }

  async updateBed(
    actor: RequestActor | undefined,
    id: string,
    bedId: string,
    body: Record<string, unknown>,
  ) {
    await this.assertHotel(id, actor);
    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;
    if (body.label !== undefined) {
      sets.push(`label = $${idx++}`);
      params.push(
        this.requiredString(
          body.label,
          'BED_LABEL_REQUIRED',
          'Yotoq nomi kiritilishi kerak',
        ),
      );
    }
    if (body.status !== undefined) {
      sets.push(`status = $${idx++}`);
      params.push(this.roomHousekeepingStatus(body.status));
    }
    if (body.isListed !== undefined) {
      sets.push(`is_listed = $${idx++}`);
      params.push(Boolean(body.isListed));
    }
    if (body.nightlyPrice !== undefined || body.nightly_price !== undefined) {
      sets.push(`nightly_price = $${idx++}`);
      params.push(
        this.optionalNonNegativeNumber(body.nightlyPrice ?? body.nightly_price),
      );
    }
    if (sets.length === 0) {
      const [bed] = await this.pg.query(
        `SELECT rb.id::text, rb.room_id::text, rb.label, rb.status,
                rb.is_listed, rb.nightly_price::float8, rb.created_at, rb.updated_at
         FROM room_beds rb
         JOIN hotel_rooms hr ON hr.id = rb.room_id
         WHERE rb.id = $1::uuid AND hr.hotel_id = $2`,
        [bedId, id],
      );
      if (!bed) {
        throw new NotFoundException({
          code: 'BED_NOT_FOUND',
          message: 'Yotoq topilmadi',
        });
      }
      return bed;
    }
    sets.push(`updated_at = $${idx++}`);
    params.push(new Date().toISOString());
    params.push(bedId);
    params.push(id);
    const [bed] = await this.pg.query(
      `UPDATE room_beds rb
       SET ${sets.join(', ')}
       FROM hotel_rooms hr
       WHERE rb.id = $${idx++}::uuid
         AND rb.room_id = hr.id
         AND hr.hotel_id = $${idx}
       RETURNING rb.id::text, rb.room_id::text, rb.label, rb.status,
         rb.is_listed, rb.nightly_price::float8, rb.created_at, rb.updated_at`,
      params,
    );
    if (!bed) {
      throw new NotFoundException({
        code: 'BED_NOT_FOUND',
        message: 'Yotoq topilmadi',
      });
    }
    return bed;
  }

  async deleteBed(actor: RequestActor | undefined, id: string, bedId: string) {
    await this.assertHotel(id, actor);
    const [bed] = await this.pg.query<{ id: string }>(
      `DELETE FROM room_beds rb
       USING hotel_rooms hr
       WHERE rb.id = $1::uuid
         AND rb.room_id = hr.id
         AND hr.hotel_id = $2
       RETURNING rb.id::text`,
      [bedId, id],
    );
    return { hotel_id: id, bed_id: bed?.id ?? bedId, deleted: Boolean(bed) };
  }

  async generateBeds(
    actor: RequestActor | undefined,
    id: string,
    roomId: string,
    body: Record<string, unknown>,
  ) {
    await this.assertRoomForHotel(actor, id, roomId);
    const count = this.requiredPositiveInteger(
      body.count,
      'BED_COUNT_REQUIRED',
      'Yotoqlar soni kiritilishi kerak',
    );
    if (count > 200) {
      throw new BadRequestException({
        code: 'BED_COUNT_TOO_LARGE',
        message: 'Yotoqlar soni 200 tadan oshmasligi kerak',
      });
    }
    const existing = await this.pg.query<{ label: string }>(
      `SELECT label FROM room_beds WHERE room_id = $1`,
      [roomId],
    );
    const labels = new Set(existing.map((row) => row.label));
    const now = new Date().toISOString();
    const created: Array<Record<string, unknown>> = [];
    for (let index = 1; index <= count; index += 1) {
      const label = `${index}-o'rin`;
      if (labels.has(label)) continue;
      const [bed] = await this.pg.query(
        `INSERT INTO room_beds
           (id, room_id, label, status, is_listed, created_at, updated_at)
         VALUES ($1, $2, $3, 'VACANT_CLEAN', true, $4, $4)
         RETURNING id::text, room_id::text, label, status, is_listed,
           nightly_price::float8, created_at, updated_at`,
        [randomUUID(), roomId, label, now],
      );
      created.push(bed);
    }
    return { ok: true, added: created.length, beds: created };
  }

  // ---------------------------------------------------------------------------
  // Inventory
  // ---------------------------------------------------------------------------

  /**
   * Kelgusi 90 kun uchun xona inventarini qaytaradi — `room_inventory`da
   * aniq yozuv (masalan blackout yoki maxsus sig'im) bo'lsa o'sha
   * qatordan, bo'lmasa xonaning standart `total_inventory`sidan.
   */
  async inventory(actor: RequestActor | undefined, id: string) {
    await this.assertHotel(id, actor);
    const rows = await this.pg.query<{
      room_id: string;
      total_inventory: number;
      date: string | null;
      total_count: number | null;
      held_count: number | null;
      booked_count: number | null;
      closed: boolean | null;
    }>(
      `SELECT hr.id::text AS room_id, hr.total_inventory,
              ri.date, ri.total_count, ri.held_count, ri.booked_count, ri.closed
       FROM hotel_rooms hr
       LEFT JOIN room_inventory ri
         ON ri.room_id = hr.id
         AND ri.date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days'
       WHERE hr.hotel_id = $1 AND hr.status = 'active'
       ORDER BY hr.id, ri.date`,
      [id],
    );
    return rows.map((row) => ({
      room_id: row.room_id,
      date: row.date ?? new Date().toISOString().slice(0, 10),
      total_count: row.total_count ?? row.total_inventory,
      held_count: row.held_count ?? 0,
      booked_count: row.booked_count ?? 0,
      closed: row.closed ?? false,
    }));
  }

  /**
   * Avval bu metod hech qanday SQL bajarmasdan, so'ralgan `body.items`ni
   * o'zgartirmasdan qaytarib yuborardi — frontend "saqlandi" deb ko'rsatib,
   * hech narsa bazaga yozilmas edi. Endi `room_inventory`ga haqiqatan
   * UPSERT qiladi, va har bir xona `id` mehmonxonaga tegishli ekanligini
   * tekshiradi (boshqa hamkorning xonasi id'sini yubormasin).
   */
  async updateInventory(
    actor: RequestActor | undefined,
    id: string,
    body: Record<string, unknown>,
  ) {
    await this.assertHotel(id, actor);
    const items = Array.isArray(body.items) ? body.items : [];
    const saved: unknown[] = [];

    for (const raw of items) {
      const item = (raw ?? {}) as Record<string, unknown>;
      const roomId = String(item.room_id ?? item.roomId ?? '');
      const date = String(item.date ?? '');
      if (!roomId || !Number.isFinite(Date.parse(date))) {
        throw new BadRequestException({
          code: 'INVENTORY_ITEM_INVALID',
          message: 'Har bir item uchun room_id va date kerak',
        });
      }

      const [room] = await this.pg.query<{ total_inventory: number }>(
        `SELECT total_inventory FROM hotel_rooms WHERE id = $1::uuid AND hotel_id = $2::uuid`,
        [roomId, id],
      );
      if (!room) {
        throw new NotFoundException({
          code: 'ROOM_NOT_AVAILABLE',
          message: `Xona topilmadi: ${roomId}`,
        });
      }

      const totalCount =
        this.optionalNonNegativeNumber(item.total_count ?? item.totalCount) ??
        room.total_inventory;
      const closed = Boolean(item.closed ?? false);

      const [savedRow] = await this.pg.query(
        `INSERT INTO room_inventory (id, room_id, date, total_count, closed)
         VALUES ($1, $2::uuid, $3::date, $4, $5)
         ON CONFLICT (room_id, date) DO UPDATE
           SET total_count = EXCLUDED.total_count,
               closed = EXCLUDED.closed,
               version = room_inventory.version + 1
         RETURNING room_id::text, date, total_count, held_count, booked_count, closed`,
        [randomUUID(), roomId, date, totalCount, closed],
      );
      saved.push(savedRow);
    }

    return { hotel_id: id, updated: true, items: saved };
  }

  /**
   * Bir yoki bir nechta sanani xona(lar) uchun "yopiq" deb belgilaydi —
   * avval hech narsa saqlamasdan `{closed:true}` qaytarib, xonani
   * haqiqatan mavjud bo'lmagan qilib qo'ymasdi.
   */
  async blackoutDates(
    actor: RequestActor | undefined,
    id: string,
    body: Record<string, unknown>,
  ) {
    await this.assertHotel(id, actor);
    const dates = Array.isArray(body.dates)
      ? body.dates.map(String).filter((d) => Number.isFinite(Date.parse(d)))
      : [];
    if (dates.length === 0) {
      throw new BadRequestException({
        code: 'BLACKOUT_DATES_REQUIRED',
        message: 'Kamida bitta to‘g‘ri sana kerak',
      });
    }
    const roomIdFilter = this.optionalString(body.room_id ?? body.roomId);

    const rooms = await this.pg.query<{ id: string; total_inventory: number }>(
      roomIdFilter
        ? `SELECT id::text, total_inventory FROM hotel_rooms
           WHERE id = $1::uuid AND hotel_id = $2::uuid AND status = 'active'`
        : `SELECT id::text, total_inventory FROM hotel_rooms
           WHERE hotel_id = $2::uuid AND status = 'active'`,
      [roomIdFilter ?? null, id],
    );
    if (roomIdFilter && rooms.length === 0) {
      throw new NotFoundException({
        code: 'ROOM_NOT_AVAILABLE',
        message: 'Xona topilmadi',
      });
    }

    for (const room of rooms) {
      for (const date of dates) {
        await this.pg.query(
          `INSERT INTO room_inventory (id, room_id, date, total_count, closed)
           VALUES ($1, $2::uuid, $3::date, $4, true)
           ON CONFLICT (room_id, date) DO UPDATE
             SET closed = true, version = room_inventory.version + 1`,
          [randomUUID(), room.id, date, room.total_inventory],
        );
      }
    }

    return { hotel_id: id, room_id: roomIdFilter ?? null, dates, closed: true };
  }

  // ---------------------------------------------------------------------------
  // Listing helpers
  // ---------------------------------------------------------------------------

  async updateListingGeneral(
    actor: RequestActor | undefined,
    id: string,
    body: Record<string, unknown>,
  ) {
    await this.assertHotel(id, actor);
    const now = new Date().toISOString();

    const existing = await this.pg.query<{
      language: string;
      name: string;
      short_description: string | null;
      description: string | null;
    }>(
      `SELECT language::text, name, short_description, description
       FROM hotel_translations WHERE hotel_id = $1::uuid`,
      [id],
    );
    const current = new Map(existing.map((row) => [row.language, row]));
    const value = (
      language: string,
      field: string,
      fallbackField: string,
      fallback = '',
    ) => {
      const localized = body[`${field}_${language}`];
      if (localized !== undefined) return String(localized);
      const generic = body[field] ?? body[fallbackField];
      if (generic !== undefined) return String(generic);
      return String(
        current.get(language)?.[field as 'name' | 'description'] ?? fallback,
      );
    };
    const shortValue = (language: string) => {
      const localized =
        body[`short_description_${language}`] ??
        body[`shortDescription_${language}`];
      if (localized !== undefined) return String(localized);
      const generic = body.short_description ?? body.shortDescription;
      if (generic !== undefined) return String(generic);
      return String(current.get(language)?.short_description ?? '');
    };
    const nameUz = value('uz', 'name', 'name_uz');
    const nameRu = value('ru', 'name', 'name_ru');
    const nameEn = value('en', 'name', 'name_en');
    const descUz = value('uz', 'description', 'fullDescription');
    const descRu = value('ru', 'description', 'fullDescription');
    const descEn = value('en', 'description', 'fullDescription');
    const shortUz = shortValue('uz');
    const shortRu = shortValue('ru');
    const shortEn = shortValue('en');
    const stars = body.stars !== undefined ? Number(body.stars) : undefined;

    // Update translations
    if (nameUz || descUz || shortUz) {
      await this.pg.query(
        `INSERT INTO hotel_translations
           (id, hotel_id, language, name, short_description, description, created_at, updated_at)
         VALUES ($1, $2, 'uz', $3, $4, $5, $6, $6)
         ON CONFLICT (hotel_id, language) DO UPDATE SET
           name = EXCLUDED.name,
           short_description = EXCLUDED.short_description,
           description = EXCLUDED.description,
           updated_at = EXCLUDED.updated_at`,
        [randomUUID(), id, nameUz, shortUz, descUz, now],
      );
    }
    if (nameRu || descRu || shortRu) {
      await this.pg.query(
        `INSERT INTO hotel_translations
           (id, hotel_id, language, name, short_description, description, created_at, updated_at)
         VALUES ($1, $2, 'ru', $3, $4, $5, $6, $6)
         ON CONFLICT (hotel_id, language) DO UPDATE SET
           name = EXCLUDED.name,
           short_description = EXCLUDED.short_description,
           description = EXCLUDED.description,
           updated_at = EXCLUDED.updated_at`,
        [randomUUID(), id, nameRu, shortRu, descRu, now],
      );
    }
    if (nameEn || descEn || shortEn) {
      await this.pg.query(
        `INSERT INTO hotel_translations
           (id, hotel_id, language, name, short_description, description, created_at, updated_at)
         VALUES ($1, $2, 'en', $3, $4, $5, $6, $6)
         ON CONFLICT (hotel_id, language) DO UPDATE SET
           name = EXCLUDED.name,
           short_description = EXCLUDED.short_description,
           description = EXCLUDED.description,
           updated_at = EXCLUDED.updated_at`,
        [randomUUID(), id, nameEn, shortEn, descEn, now],
      );
    }

    // Update stars on hotel
    if (stars !== undefined) {
      await this.pg.query(
        `UPDATE hotels SET stars = $1, updated_at = $2 WHERE id = $3`,
        [stars, now, id],
      );
    }

    await this.touchHotel(id, now);

    const hotel = await this.assertHotel(id, actor);
    this.notifyListingChanged(hotel, actor, 'updated', ['general']);
    const [hydrated] = await this.hydratePartnerHotels([hotel]);
    return hydrated;
  }

  async updateListingLocation(
    actor: RequestActor | undefined,
    id: string,
    body: Record<string, unknown>,
  ) {
    await this.assertHotel(id, actor);
    const now = new Date().toISOString();
    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (body.city_id !== undefined || body.city !== undefined) {
      const resolvedCityId = await this.resolveCityId(
        body.city_id ?? body.city,
      );
      sets.push(`city_id = $${idx++}`);
      params.push(resolvedCityId);
    }
    if (body.address !== undefined) {
      sets.push(`address = $${idx++}`);
      params.push(String(body.address));
    }
    if (body.latitude !== undefined) {
      sets.push(`latitude = $${idx++}`);
      params.push(Number(body.latitude));
    }
    if (body.longitude !== undefined) {
      sets.push(`longitude = $${idx++}`);
      params.push(Number(body.longitude));
    }
    if (Array.isArray(body.nearbyPlaces) || Array.isArray(body.nearby_places)) {
      sets.push(`nearby_places = $${idx++}::jsonb`);
      params.push(JSON.stringify(body.nearbyPlaces ?? body.nearby_places));
    }

    if (sets.length > 0) {
      sets.push(`updated_at = $${idx++}`);
      params.push(now);
      params.push(id);
      await this.pg.query(
        `UPDATE hotels SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
        params,
      );
      await this.touchHotel(id, now);
    }

    const hotel = await this.assertHotel(id, actor);
    this.notifyListingChanged(hotel, actor, 'updated', ['location']);
    const [hydrated] = await this.hydratePartnerHotels([hotel]);
    return hydrated;
  }

  async updateListingRules(
    actor: RequestActor | undefined,
    id: string,
    body: Record<string, unknown>,
  ) {
    const existing = await this.assertHotel(id, actor);
    const now = new Date().toISOString();
    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    const checkInTime = body.checkInTime ?? body.check_in_time ?? undefined;
    const checkOutTime = body.checkOutTime ?? body.check_out_time ?? undefined;
    const cancellationPolicy =
      body.cancellationPolicy ?? body.cancellation_policy ?? undefined;
    const smokingAllowed = body.smokingAllowed ?? body.smoking_allowed;
    const petsAllowed = body.petsAllowed ?? body.pets_allowed;
    const childrenAllowed = body.childrenAllowed ?? body.children_allowed;
    const extraFees = body.extraFees ?? body.extra_fees;

    if (checkInTime !== undefined) {
      sets.push(`check_in_time = $${idx++}`);
      params.push(String(checkInTime));
    }
    if (checkOutTime !== undefined) {
      sets.push(`check_out_time = $${idx++}`);
      params.push(String(checkOutTime));
    }
    if (cancellationPolicy !== undefined) {
      sets.push(`cancellation_policy_code = $${idx++}`);
      params.push(String(cancellationPolicy).toUpperCase());
    }
    if (typeof smokingAllowed === 'boolean') {
      sets.push(`smoking_allowed = $${idx++}`);
      params.push(smokingAllowed);
    }
    if (typeof petsAllowed === 'boolean') {
      sets.push(`pets_allowed = $${idx++}`);
      params.push(petsAllowed);
    }
    if (typeof childrenAllowed === 'boolean') {
      sets.push(`children_allowed = $${idx++}`);
      params.push(childrenAllowed);
    }
    if (Array.isArray(extraFees)) {
      sets.push(`extra_fees = $${idx++}::jsonb`);
      params.push(JSON.stringify(extraFees));
    }
    if (checkInTime !== undefined || checkOutTime !== undefined) {
      const existingTyped = existing as Record<string, unknown>;
      const effectiveCheckIn = checkInTime ?? existingTyped['check_in_time'];
      const effectiveCheckOut = checkOutTime ?? existingTyped['check_out_time'];
      const rulesComplete =
        Boolean(effectiveCheckIn && String(effectiveCheckIn).trim()) &&
        Boolean(effectiveCheckOut && String(effectiveCheckOut).trim());
      sets.push(`rules_completed_at = $${idx++}`);
      params.push(rulesComplete ? now : null);
    }

    if (sets.length > 0) {
      sets.push(`updated_at = $${idx++}`);
      params.push(now);
      await this.pg.query(
        `UPDATE hotels SET ${sets.join(', ')},
           status = CASE WHEN status = 'published' THEN 'pending_review'::"HotelStatus" ELSE status END,
           submitted_at = CASE WHEN status = 'published' THEN $${idx} ELSE submitted_at END
         WHERE id = $${idx + 1}`,
        [...params, now, id],
      );
    }

    const hotel = await this.assertHotel(id, actor);
    this.notifyListingChanged(hotel, actor, 'updated', ['rules']);
    const [hydrated] = await this.hydratePartnerHotels([hotel]);
    return hydrated;
  }

  async updateListingAmenities(
    actor: RequestActor | undefined,
    id: string,
    body: Record<string, unknown>,
  ) {
    await this.assertHotel(id, actor);
    const now = new Date().toISOString();
    if (Array.isArray(body.amenities)) {
      const codes = [
        ...new Set(
          body.amenities
            .map(String)
            .map((code) => code.trim())
            .filter(Boolean),
        ),
      ];

      // Resolve codes → UUIDs from the amenities table
      let resolved = await this.pg.query<{ code: string; id: string }>(
        `SELECT code, id::text FROM amenities WHERE code = ANY($1::text[])`,
        [codes],
      );
      let codeToId = new Map(resolved.map((r) => [r.code, r.id]));
      const unknownCodes = codes.filter((code) => !codeToId.has(code));

      if (unknownCodes.length > 0) {
        for (const code of unknownCodes) {
          const id = randomUUID();
          const now = new Date().toISOString();
          const name = code
            .replace(/_/g, ' ')
            .replace(/\b\w/g, (c) => c.toUpperCase());
          await this.pg.query(
            `INSERT INTO amenities (id, code, name, created_at, updated_at)
             VALUES ($1::uuid, $2, ($3)::jsonb, $4, $5)
             ON CONFLICT (code) DO NOTHING`,
            [
              id,
              code,
              JSON.stringify({ uz: name, ru: name, en: name }),
              now,
              now,
            ],
          );
        }
        resolved = await this.pg.query<{ code: string; id: string }>(
          `SELECT code, id::text FROM amenities WHERE code = ANY($1::text[])`,
          [codes],
        );
        codeToId = new Map(resolved.map((r) => [r.code, r.id]));
      }

      await this.pg.query(`DELETE FROM hotel_amenities WHERE hotel_id = $1`, [
        id,
      ]);
      for (const code of codes) {
        const amenityId = codeToId.get(code);
        if (!amenityId) continue;
        await this.pg.query(
          `INSERT INTO hotel_amenities (hotel_id, amenity_id)
           VALUES ($1::uuid, $2::uuid)
           ON CONFLICT (hotel_id, amenity_id) DO NOTHING`,
          [id, amenityId],
        );
      }
      await this.pg.query(
        `UPDATE hotels SET updated_at = $1,
           status = CASE WHEN status = 'published' THEN 'pending_review'::"HotelStatus" ELSE status END,
           submitted_at = CASE WHEN status = 'published' THEN $1 ELSE submitted_at END
         WHERE id = $2`,
        [now, id],
      );
    }
    const hotel = await this.hotel(actor, id);
    this.notifyListingChanged(hotel, actor, 'updated', ['amenities']);
    return hotel;
  }

  async updateListingStatus(
    actor: RequestActor | undefined,
    id: string,
    body: Record<string, unknown>,
  ) {
    const now = new Date().toISOString();
    const status = listingStatus(body.status);
    const submittedBy = this.submissionActorId(actor);
    if (status === 'published') {
      throw new ForbiddenException({
        code: 'LISTING_REVIEW_REQUIRED',
        message: "Hamkor e'lonni to'g'ridan-to'g'ri nashr qila olmaydi",
      });
    }
    if (status === 'pending_review') {
      await this.assertListingSubmissionReady(actor, id);
    } else {
      await this.assertHotel(id, actor);
    }
    const result = await this.pg.query(
      `UPDATE hotels SET status = $1::"HotelStatus", updated_at = $2,
         submitted_at = CASE WHEN $1::"HotelStatus" = 'pending_review'::"HotelStatus" THEN $2 ELSE submitted_at END,
         submitted_by = CASE WHEN $1::"HotelStatus" = 'pending_review'::"HotelStatus" THEN $3::uuid ELSE submitted_by END,
         reviewed_at = CASE WHEN $1::"HotelStatus" = 'pending_review'::"HotelStatus" THEN null ELSE reviewed_at END,
         reviewed_by = CASE WHEN $1::"HotelStatus" = 'pending_review'::"HotelStatus" THEN null ELSE reviewed_by END,
         rejection_reason = CASE WHEN $1::"HotelStatus" = 'pending_review'::"HotelStatus" THEN null ELSE rejection_reason END
       WHERE id = $4 RETURNING *`,
      [status, now, submittedBy, id],
    );
    const updated = result[0];
    this.notifyListingChanged(
      updated,
      actor,
      status === 'pending_review' ? 'submitted' : 'updated',
      ['status'],
    );
    return updated;
  }

  async publishListing(actor: RequestActor | undefined, id: string) {
    return this.submitHotelReview(actor, id);
  }

  // ---------------------------------------------------------------------------
  // Bus company (transport hamkorining "e'lon"iga teng — vehicles/routes/
  // trips shu yozuvga bog'lanadi)
  // ---------------------------------------------------------------------------

  /**
   * `bus`/`mixed` turida tasdiqlangan hamkor uchun `bus_companies` yozuvini
   * yaratadi. Avval bu yozuvni yaratadigan HECH QANDAY jonli kod yo'li
   * yo'q edi (faqat admin.service.ts ichidagi chaqirilmaydigan "dead"
   * yordamchi funksiyada) — natijada `createVehicle`/`createTrip` doim
   * `BUS_COMPANY_NOT_FOUND` bilan yiqilardi va butun transport hamkor
   * yo'nalishi ishlamas edi. Idempotent: mavjud kompaniya bo'lsa o'shani
   * qaytaradi (qayta-qayta chaqirilsa ham duplikat yaratmaydi).
   */
  async createBusCompany(
    actor: RequestActor | undefined,
    body: Record<string, unknown>,
  ) {
    const organizationId = this.organizationId(actor);
    const [organization] = await this.pg.query<{
      type: string;
      brand_name: string | null;
      legal_name: string | null;
    }>(
      `SELECT type::text, brand_name, legal_name FROM partner_organizations WHERE id = $1`,
      [organizationId],
    );
    if (!organization) {
      throw new NotFoundException({
        code: 'PARTNER_NOT_ACTIVE',
        message: 'Tashkilot topilmadi',
      });
    }
    if (!['bus', 'mixed'].includes(organization.type)) {
      throw new ForbiddenException({
        code: 'BUS_COMPANY_TYPE_FORBIDDEN',
        message:
          "Avtobus kompaniyasini faqat 'bus' yoki 'mixed' turidagi hamkor yaratishi mumkin",
      });
    }

    const [existing] = await this.pg.query<{ id: string }>(
      `SELECT id::text FROM bus_companies
       WHERE partner_organization_id = $1
       ORDER BY created_at ASC LIMIT 1`,
      [organizationId],
    );
    if (existing) {
      const [company] = await this.pg.query<BusCompanyRow>(
        `SELECT id::text, partner_organization_id::text, name, status,
              rating_average::float8, reviews_count, created_at, updated_at
         FROM bus_companies WHERE id = $1`,
        [existing.id],
      );
      return {
        ...company,
        ...(await this.hydrateBusCompanyDescriptions(existing.id)),
      };
    }

    const name =
      this.optionalString(body.name) ??
      organization.brand_name ??
      organization.legal_name ??
      'Avtobus kompaniyasi';
    const now = new Date().toISOString();
    const [company] = await this.pg.query<BusCompanyRow>(
      `INSERT INTO bus_companies (id, partner_organization_id, name, status, created_at, updated_at)
       VALUES ($1, $2, $3, 'active', $4, $4)
       RETURNING id::text, partner_organization_id::text, name, status,
                 rating_average::float8, reviews_count, created_at, updated_at`,
      [randomUUID(), organizationId, name, now],
    );
    const descriptions = await this.upsertBusCompanyTranslations(
      company.id,
      body,
      new Map(),
      now,
    );
    this.invalidatePublicTransportCache();
    return {
      ...company,
      short_description: localizedTextFromMap(descriptions.short_description, ''),
      full_description: localizedTextFromMap(descriptions.full_description, ''),
    };
  }

  /**
   * `null` qaytaradi (404 emas) agar hali kompaniya yaratilmagan bo'lsa —
   * frontend "Kompaniya e'lonini yarating" bo'sh holatini shu orqali
   * ko'rsatadi, xatolik sifatida emas.
   */
  async busCompany(actor: RequestActor | undefined) {
    const organizationId = this.organizationId(actor);
    const [company] = await this.pg.query<BusCompanyRow>(
      `SELECT id::text, partner_organization_id::text, name, status,
              rating_average::float8, reviews_count, created_at, updated_at
       FROM bus_companies
       WHERE partner_organization_id = $1
       ORDER BY created_at ASC LIMIT 1`,
      [organizationId],
    );
    if (!company) {
      return null;
    }
    return {
      ...company,
      ...(await this.hydrateBusCompanyDescriptions(company.id)),
    };
  }

  async updateBusCompany(
    actor: RequestActor | undefined,
    body: Record<string, unknown>,
  ) {
    const companyId = await this.busCompanyId(actor);
    const name = this.optionalString(body.name);
    if (!name) {
      throw new BadRequestException({
        code: 'BUS_COMPANY_NAME_REQUIRED',
        message: 'Kompaniya nomini kiriting',
      });
    }
    const now = new Date().toISOString();

    const existingTranslations = await this.pg.query<{
      language: string;
      short_description: string | null;
      description: string | null;
    }>(
      `SELECT language::text, short_description, description
       FROM bus_company_translations WHERE company_id = $1::uuid`,
      [companyId],
    );
    const current = new Map(
      existingTranslations.map((row) => [row.language, row]),
    );
    const descriptions = await this.upsertBusCompanyTranslations(
      companyId,
      body,
      current,
      now,
    );

    const [company] = await this.pg.query<BusCompanyRow>(
      `UPDATE bus_companies SET name = $1, updated_at = $2 WHERE id = $3
       RETURNING id::text, partner_organization_id::text, name, status,
                 rating_average::float8, reviews_count, created_at, updated_at`,
      [name, now, companyId],
    );
    this.invalidatePublicTransportCache();
    return {
      ...company,
      short_description: localizedTextFromMap(descriptions.short_description, ''),
      full_description: localizedTextFromMap(descriptions.full_description, ''),
    };
  }

  /**
   * `bus_company_translations`dan joriy (til bo'yicha) qiymatlarni o'qib,
   * `Localized` ({uz, ru, en}) shaklida qaytaradi — `busCompany()` (GET)
   * va `createBusCompany()`ning idempotent shoxobchasi shu orqali o'qiydi.
   * `hydratePartnerHotels()`dagi bir xil naqsh (qarang `localizedTextFromMap`).
   */
  private async hydrateBusCompanyDescriptions(companyId: string) {
    const rows = await this.pg.query<{
      language: string;
      short_description: string | null;
      description: string | null;
    }>(
      `SELECT language::text, short_description, description
       FROM bus_company_translations WHERE company_id = $1::uuid`,
      [companyId],
    );
    const shortDescriptions: Record<string, string> = {};
    const fullDescriptions: Record<string, string> = {};
    for (const row of rows) {
      if (row.short_description) {
        shortDescriptions[row.language] = row.short_description;
      }
      if (row.description) {
        fullDescriptions[row.language] = row.description;
      }
    }
    return {
      short_description: localizedTextFromMap(shortDescriptions, ''),
      full_description: localizedTextFromMap(fullDescriptions, ''),
    };
  }

  /**
   * `updateListingGeneral()`dagi (hotel_translations uchun) bir xil PATCH
   * semantikasi: har bir til uchun avval `<field>_<language>` (masalan
   * `short_description_uz`), keyin generic `<field>`/camelCase alias
   * (`shortDescription`/`fullDescription`), toping bo'lmasa MAVJUD saqlangan
   * qiymat (partial update — berilmagan maydon o'zgarmaydi), aks holda ''
   * ishlatiladi. Har bir til uchun `ON CONFLICT (company_id, language) DO
   * UPDATE` bilan upsert qilinadi (yangi kompaniya uchun ham xavfsiz —
   * `current` bo'sh Map bo'lsa, hammasi '' bo'ladi yoki body'dan olinadi).
   */
  private async upsertBusCompanyTranslations(
    companyId: string,
    body: Record<string, unknown>,
    current: Map<
      string,
      { short_description: string | null; description: string | null }
    >,
    now: string,
  ): Promise<{
    short_description: Record<string, string>;
    full_description: Record<string, string>;
  }> {
    const translationValue = (
      language: string,
      field: 'short_description' | 'description',
      aliases: string[],
    ): string => {
      const localized = body[`${field}_${language}`];
      if (localized !== undefined) return String(localized);
      for (const alias of aliases) {
        const localizedAlias = body[`${alias}_${language}`];
        if (localizedAlias !== undefined) return String(localizedAlias);
      }
      if (body[field] !== undefined) return String(body[field]);
      for (const alias of aliases) {
        if (body[alias] !== undefined) return String(body[alias]);
      }
      return String(current.get(language)?.[field] ?? '');
    };

    const shortDescriptions: Record<string, string> = {};
    const fullDescriptions: Record<string, string> = {};
    for (const language of ['uz', 'ru', 'en'] as const) {
      const shortDescription = translationValue(
        language,
        'short_description',
        ['shortDescription'],
      );
      const fullDescription = translationValue(language, 'description', [
        'fullDescription',
        'full_description',
      ]);
      shortDescriptions[language] = shortDescription;
      fullDescriptions[language] = fullDescription;
      await this.pg.query(
        `INSERT INTO bus_company_translations
           (id, company_id, language, short_description, description, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $6)
         ON CONFLICT (company_id, language) DO UPDATE SET
           short_description = EXCLUDED.short_description,
           description = EXCLUDED.description,
           updated_at = EXCLUDED.updated_at`,
        [randomUUID(), companyId, language, shortDescription, fullDescription, now],
      );
    }
    return {
      short_description: shortDescriptions,
      full_description: fullDescriptions,
    };
  }

  // ---------------------------------------------------------------------------
  // Vehicles
  // ---------------------------------------------------------------------------

  async vehicles(actor: RequestActor | undefined) {
    const organizationId = this.organizationId(actor);
    return this.pg.query(
      `SELECT v.id::text, v.company_id::text, v.name, v.plate_number,
              v.seats_count, v.price_per_day::float8, v.seat_layout, v.status,
              v.created_at, v.updated_at
       FROM vehicles v
       JOIN bus_companies bc ON bc.id = v.company_id
       WHERE bc.partner_organization_id = $1
       ORDER BY v.created_at DESC`,
      [organizationId],
    );
  }

  /**
   * O'rindiqlar soni va kunlik narx uchun yuqori chegaralar — aniq son
   * mahsulot qarori (BUSINESS DECISION), lekin hech qanday chegara
   * yo'qligi 999999 o'rindiq yoki 999 mlrd so'm/kun kabi jismonan
   * imkonsiz qiymatlarni backend orqali qabul qilishga imkon berardi
   * (audit paytida real production so'rovi bilan tasdiqlangan).
   */
  private static readonly MAX_VEHICLE_SEATS = 30;
  private static readonly MAX_VEHICLE_PRICE_PER_DAY = 50_000_000;
  private static readonly VEHICLE_STATUS_VALUES = new Set([
    'active',
    'inactive',
  ]);

  private validateVehicleSeats(seatsCount: number): void {
    if (
      !Number.isInteger(seatsCount) ||
      seatsCount <= 0 ||
      seatsCount > PartnersService.MAX_VEHICLE_SEATS
    ) {
      throw new BadRequestException({
        code: 'VEHICLE_SEATS_INVALID',
        message: "O'rindiqlar soni butun son va 1 dan 30 gacha bo'lishi kerak",
      });
    }
  }

  private validateVehiclePrice(pricePerDay: number): void {
    if (
      !Number.isFinite(pricePerDay) ||
      pricePerDay < 0 ||
      pricePerDay > PartnersService.MAX_VEHICLE_PRICE_PER_DAY
    ) {
      throw new BadRequestException({
        code: 'VEHICLE_PRICE_INVALID',
        message: "Kunlik narx to'g'ri kiritilishi kerak",
      });
    }
  }

  /**
   * O'zbekiston davlat raqami uchun aniq format (masalan `01 A 123 BC`)
   * repository/UI/hujjatlarda hech qayerda belgilanmagan — shuning uchun
   * qat'iy regex O'YLAB TOPILMAYDI (BUSINESS DECISION REQUIRED: aniq format
   * mahsulot jamoasi tomonidan belgilanishi kerak). Lekin bu tekshiruvsiz
   * ixtiyoriy (arbitrary) satrni qabul qilish ham noto'g'ri (audit paytida
   * "asdfghjkl" qiymati bilan tasdiqlangan) — shuning uchun faqat asosiy
   * jismoniy sanity chegarasi qo'llanadi: bo'sh joy-only emas, 4-16 belgi.
   */
  private validateVehiclePlate(plateNumber: string | null): void {
    if (plateNumber === null) return;
    if (plateNumber.length < 4 || plateNumber.length > 16) {
      throw new BadRequestException({
        code: 'VEHICLE_PLATE_INVALID',
        message: "Davlat raqami noto'g'ri formatda",
      });
    }
  }

  private normalizeVehiclePlate(value: unknown): string | null {
    if (value === undefined || value === null) return null;
    const trimmed = String(value).trim();
    return trimmed || null;
  }

  async createVehicle(
    actor: RequestActor | undefined,
    body: Record<string, unknown>,
  ) {
    const companyId = await this.busCompanyId(actor);
    const name = String(body.name ?? '').trim();
    const seatsCount = Number(body.seats_count ?? body.seatsCount);
    const pricePerDay = Number(body.price_per_day ?? body.pricePerDay ?? 0);
    const plateNumber = this.normalizeVehiclePlate(body.plate_number);
    if (!name) {
      throw new BadRequestException({
        code: 'VEHICLE_INVALID',
        message: 'Transport nomi talab qilinadi',
      });
    }
    this.validateVehicleSeats(seatsCount);
    this.validateVehiclePrice(pricePerDay);
    this.validateVehiclePlate(plateNumber);

    const now = new Date().toISOString();
    const [vehicle] = await this.pg.query(
      `INSERT INTO vehicles
         (id, company_id, name, plate_number, seats_count, price_per_day, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'active', $7, $7)
       RETURNING id::text, company_id::text, name, plate_number, seats_count,
                 price_per_day::float8, seat_layout, status, created_at, updated_at`,
      [
        randomUUID(),
        companyId,
        name,
        plateNumber,
        seatsCount,
        pricePerDay,
        now,
      ],
    );
    this.invalidatePublicTransportCache();
    return vehicle;
  }

  async updateVehicle(
    actor: RequestActor | undefined,
    id: string,
    body: Record<string, unknown>,
  ) {
    await this.assertVehicle(actor, id);
    const now = new Date().toISOString();
    const priceInput = body.price_per_day ?? body.pricePerDay;
    const seatsInput =
      body.seats_count !== undefined ? Number(body.seats_count) : null;
    const priceValue = priceInput !== undefined ? Number(priceInput) : null;
    const plateNumber =
      body.plate_number !== undefined
        ? this.normalizeVehiclePlate(body.plate_number)
        : undefined;
    const statusValue = body.status !== undefined ? String(body.status) : null;

    if (seatsInput !== null) this.validateVehicleSeats(seatsInput);
    if (priceValue !== null) this.validateVehiclePrice(priceValue);
    if (plateNumber !== undefined) this.validateVehiclePlate(plateNumber);
    if (
      statusValue !== null &&
      !PartnersService.VEHICLE_STATUS_VALUES.has(statusValue)
    ) {
      throw new BadRequestException({
        code: 'VEHICLE_STATUS_INVALID',
        message: "Transport holati noto'g'ri",
      });
    }

    const [vehicle] = await this.pg.query(
      `UPDATE vehicles
       SET name = COALESCE($1, name),
           plate_number = CASE WHEN $8 THEN $2 ELSE plate_number END,
           seats_count = COALESCE($3, seats_count),
           price_per_day = COALESCE($4, price_per_day),
           status = COALESCE($5, status),
           updated_at = $6
       WHERE id = $7
       RETURNING id::text, company_id::text, name, plate_number, seats_count,
                 price_per_day::float8, seat_layout, status, created_at, updated_at`,
      [
        body.name !== undefined ? String(body.name) : null,
        plateNumber ?? null,
        seatsInput,
        priceValue,
        statusValue,
        now,
        id,
        plateNumber !== undefined,
      ],
    );
    this.invalidatePublicTransportCache();
    return vehicle;
  }

  async seatLayout(
    actor: RequestActor | undefined,
    id: string,
    body: Record<string, unknown>,
  ) {
    await this.assertVehicle(actor, id);
    const [vehicle] = await this.pg.query(
      `UPDATE vehicles
       SET seat_layout = $1::jsonb, updated_at = $2
       WHERE id = $3
       RETURNING id::text as vehicle_id, seat_layout as layout, updated_at`,
      [JSON.stringify(body.layout ?? []), new Date().toISOString(), id],
    );
    return vehicle;
  }

  // ---------------------------------------------------------------------------
  // Routes
  // ---------------------------------------------------------------------------

  async routes(actor: RequestActor | undefined) {
    this.organizationId(actor);
    return this.pg.query('SELECT * FROM routes ORDER BY created_at DESC');
  }

  async createRoute(
    actor: RequestActor | undefined,
    body: Record<string, unknown>,
  ) {
    this.organizationId(actor);
    const fromCityId = String(
      body.from_city_id ?? body.fromCityId ?? '',
    ).trim();
    const toCityId = String(body.to_city_id ?? body.toCityId ?? '').trim();
    const durationMinutes = Number(
      body.duration_minutes ?? body.durationMinutes,
    );
    if (
      !fromCityId ||
      !toCityId ||
      !Number.isFinite(durationMinutes) ||
      durationMinutes <= 0
    ) {
      throw new BadRequestException({
        code: 'ROUTE_INVALID',
        message: 'Yo‘nalish shaharlari va davomiyligi talab qilinadi',
      });
    }

    const now = new Date().toISOString();
    const [route] = await this.pg.query(
      `INSERT INTO routes
         (id, from_city_id, to_city_id, duration_minutes, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [randomUUID(), fromCityId, toCityId, durationMinutes, now, now],
    );
    return route;
  }

  async updateRoute(
    actor: RequestActor | undefined,
    id: string,
    body: Record<string, unknown>,
  ) {
    const organizationId = this.organizationId(actor);

    // `routes` jadvali kompaniya ustuniga ega emas — bir nechta avtobus
    // kompaniyasi bir xil shahar-juftligi yo'nalishidan foydalanishi
    // mumkin (masalan "Toshkent -> Samarqand"). Shuning uchun HAR QANDAY
    // hamkor HAR QANDAY yo'nalishni o'zgartira olardi, hattoki boshqa
    // kompaniyaning jonli reyslari shu yo'nalishga bog'langan bo'lsa ham.
    // Bu yerda "egalik" `trips` orqali tekshiriladi — agar bu yo'nalishga
    // bog'langan har qanday reys BOSHQA kompaniyaga tegishli bo'lsa, rad
    // etiladi; hali hech kim ishlatmagan yoki faqat o'zi ishlatayotgan
    // yo'nalishni o'zgartirish ruxsat etiladi.
    const [foreignUsage] = await this.pg.query<{ id: string }>(
      `SELECT t.id::text FROM trips t
       JOIN bus_companies bc ON bc.id = t.company_id
       WHERE t.route_id = $1::uuid AND bc.partner_organization_id <> $2::uuid
       LIMIT 1`,
      [id, organizationId],
    );
    if (foreignUsage) {
      throw new ForbiddenException({
        code: 'ROUTE_FORBIDDEN',
        message: 'Bu yo‘nalishdan boshqa hamkor reyslari foydalanmoqda',
      });
    }

    const [route] = await this.pg.query(
      `UPDATE routes
       SET from_city_id = COALESCE($1, from_city_id),
           to_city_id = COALESCE($2, to_city_id),
           duration_minutes = COALESCE($3, duration_minutes),
           updated_at = $4
       WHERE id = $5
       RETURNING *`,
      [
        body.from_city_id !== undefined ? String(body.from_city_id) : null,
        body.to_city_id !== undefined ? String(body.to_city_id) : null,
        body.duration_minutes !== undefined
          ? Number(body.duration_minutes)
          : null,
        new Date().toISOString(),
        id,
      ],
    );
    if (!route) {
      throw new NotFoundException({
        code: 'ROUTE_NOT_FOUND',
        message: 'Yo‘nalish topilmadi',
      });
    }
    return route;
  }

  // ---------------------------------------------------------------------------
  // Trips
  // ---------------------------------------------------------------------------

  async trips(actor: RequestActor | undefined, query: QueryLike = {}) {
    const organizationId = this.organizationId(actor);
    const pagination = parsePagination(query, 'partner', {
      defaultLimit: 50,
      allowedSortBy: ['departure_at', 'created_at', 'status', 'base_price'],
    });
    const sortColumn = [
      'departure_at',
      'created_at',
      'status',
      'base_price',
    ].includes(pagination.sortBy)
      ? pagination.sortBy
      : 'departure_at';
    const orderDir = pagination.order === 'asc' ? 'ASC' : 'DESC';
    return this.pg.query(
      `SELECT t.*
       FROM trips t
       JOIN bus_companies bc ON bc.id = t.company_id
       WHERE bc.partner_organization_id = $1
       ORDER BY t.${sortColumn} ${orderDir}
       ${limitOffsetSql(pagination)}`,
      [organizationId],
    );
  }

  async createTrip(
    actor: RequestActor | undefined,
    body: Record<string, unknown>,
  ) {
    const companyId = await this.busCompanyId(actor);
    const routeId = String(body.route_id ?? body.routeId ?? '').trim();
    const [route] = await this.pg.query<{
      id: string;
      from_city_id: string;
      to_city_id: string;
      duration_minutes: number;
    }>('SELECT * FROM routes WHERE id = $1', [routeId]);
    if (!route) {
      throw new NotFoundException({
        code: 'ROUTE_NOT_FOUND',
        message: 'Yo‘nalish topilmadi',
      });
    }
    const vehicleId = body.vehicle_id ? String(body.vehicle_id) : null;
    if (vehicleId) {
      await this.assertVehicle(actor, vehicleId);
    }

    const departureAt = String(body.departure_at ?? body.departureAt ?? '');
    const departureMs = Date.parse(departureAt);
    const basePrice = Number(body.base_price ?? body.basePrice);
    if (
      !departureAt ||
      Number.isNaN(departureMs) ||
      !Number.isFinite(basePrice)
    ) {
      throw new BadRequestException({
        code: 'TRIP_INVALID',
        message: 'Reys vaqti va narxi talab qilinadi',
      });
    }

    const arrivalAt = body.arrival_at
      ? String(body.arrival_at)
      : new Date(
          departureMs + Number(route.duration_minutes) * 60_000,
        ).toISOString();
    const now = new Date().toISOString();
    const [trip] = await this.pg.query(
      `INSERT INTO trips
         (id, route_id, company_id, vehicle_id, from_city_id, to_city_id,
          departure_at, arrival_at, status, base_price, policy_snapshot,
          created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'scheduled', $9, $10::jsonb, $11, $12)
       RETURNING *`,
      [
        randomUUID(),
        route.id,
        companyId,
        vehicleId,
        route.from_city_id,
        route.to_city_id,
        departureAt,
        arrivalAt,
        basePrice,
        JSON.stringify(body.policy_snapshot ?? null),
        now,
        now,
      ],
    );
    return trip;
  }

  async updateTrip(
    actor: RequestActor | undefined,
    id: string,
    body: Record<string, unknown>,
  ) {
    await this.assertTrip(actor, id);
    const [trip] = await this.pg.query(
      `UPDATE trips
       SET vehicle_id = COALESCE($1, vehicle_id),
           departure_at = COALESCE($2, departure_at),
           arrival_at = COALESCE($3, arrival_at),
           base_price = COALESCE($4, base_price),
           status = COALESCE($5::"TripStatus", status),
           updated_at = $6
       WHERE id = $7
       RETURNING *`,
      [
        body.vehicle_id !== undefined ? String(body.vehicle_id) : null,
        body.departure_at !== undefined ? String(body.departure_at) : null,
        body.arrival_at !== undefined ? String(body.arrival_at) : null,
        body.base_price !== undefined ? Number(body.base_price) : null,
        body.status !== undefined ? String(body.status) : null,
        new Date().toISOString(),
        id,
      ],
    );
    return trip;
  }

  /**
   * Reys bekor qilinganda faqat `trips.status`ni o'zgartirish yetarli
   * emas edi — unga bog'langan o'rindiqlar "held" holida abadiy qolib
   * ketardi (boshqa hech qachon sotib bo'lmaydigan), va reysga bog'liq
   * TASDIQLANGAN/kutilayotgan bronlar esa hamon "amal qilayotgandek"
   * ko'rinardi, garchi ularning reysi endi yo'q bo'lsa ham. Endi bitta
   * tranzaksiyada: reys bekor qilinadi, unga tegishli barcha bo'sh
   * bo'lmagan o'rindiqlar bo'shatiladi, va reysga bog'langan hali
   * yakunlanmagan bronlar ham bekor qilinib, to'langan bo'lsa avtomatik
   * qaytarish so'rovi ochiladi (xuddi to'lov-muddat poygasida qanday
   * ishlashi kerak bo'lsa xuddi shunday — pul hech qachon jim
   * "yo'qolmaydi").
   */
  async cancelTrip(actor: RequestActor | undefined, id: string) {
    await this.assertTrip(actor, id);
    const now = new Date().toISOString();

    const trip = await this.pg.transaction(async (tx) => {
      const [updatedTrip] = await tx.query(
        `UPDATE trips SET status = 'cancelled', updated_at = $1 WHERE id = $2 RETURNING *`,
        [now, id],
      );

      await tx.query(
        `UPDATE trip_seats
         SET status = 'available', held_by_booking_id = NULL, held_until = NULL
         WHERE trip_id = $1`,
        [id],
      );

      const affectedBookings = await tx.query<{
        id: string;
        user_id: string | null;
        currency: string;
      }>(
        `UPDATE bookings
         SET status = 'cancelled', cancelled_at = $2,
             cancel_reason_text = 'Reys hamkor tomonidan bekor qilindi', updated_at = $2
         WHERE trip_id = $1 AND status NOT IN ('cancelled', 'expired', 'completed')
         RETURNING id::text, user_id::text, currency`,
        [id, now],
      );

      for (const booking of affectedBookings) {
        const [payment] = await tx.query<{
          amount: number | string;
          currency: string;
        }>(
          `SELECT amount, currency FROM payments
           WHERE booking_id = $1 AND status = 'paid'
           ORDER BY created_at DESC LIMIT 1`,
          [booking.id],
        );
        if (payment) {
          await tx.query(
            `INSERT INTO refunds (id, booking_id, user_id, status, currency, requested_amount, reason, created_at, updated_at)
             VALUES ($1, $2, $3, 'requested', $4, $5, $6, $7, $7)`,
            [
              randomUUID(),
              booking.id,
              booking.user_id,
              payment.currency,
              Number(payment.amount),
              'Reys hamkor tomonidan bekor qilindi — avtomatik qaytarish so‘rovi',
              now,
            ],
          );
        }
      }

      return updatedTrip;
    });

    return trip;
  }

  async tripSeats(actor: RequestActor | undefined, id: string) {
    await this.assertTrip(actor, id);
    return this.pg.query(
      `SELECT * FROM trip_seats WHERE trip_id = $1 ORDER BY seat_code ASC`,
      [id],
    );
  }

  // ---------------------------------------------------------------------------
  // Bookings
  // ---------------------------------------------------------------------------

  async bookings(actor: RequestActor | undefined, query: QueryLike = {}) {
    const organizationId = this.organizationId(actor);
    const pagination = parsePagination(query, 'partner', {
      defaultLimit: 50,
      allowedSortBy: ['created_at', 'updated_at', 'status', 'total_amount'],
    });

    const sortColumn =
      pagination.sortBy === 'total_amount'
        ? 'total_amount'
        : pagination.sortBy === 'status'
          ? 'status'
          : 'created_at';
    const orderDir = pagination.order === 'asc' ? 'ASC' : 'DESC';

    return this.pg.query(
      `SELECT b.*,
              COALESCE(b.check_in, (b.price_snapshot ->> 'check_in')::date, (b.policy_snapshot ->> 'check_in')::date) AS check_in,
              COALESCE(b.check_out, (b.price_snapshot ->> 'check_out')::date, (b.policy_snapshot ->> 'check_out')::date) AS check_out,
              COALESCE(b.slot_time, (b.price_snapshot ->> 'slot_time')::time, (b.policy_snapshot ->> 'slot_time')::time) AS slot_time,
              COALESCE(b.price_snapshot ->> 'room_type_id', hr.room_type_id::text) AS room_type_id,
              COALESCE(b.price_snapshot ->> 'room_number', hr.code) AS room_number,
              COALESCE(rt.name ->> 'uz', rt.name ->> 'ru', rt.name ->> 'en') AS room_type_name,
              v2.name AS vehicle_name,
              v2.plate_number AS vehicle_plate_number,
              COALESCE((
                SELECT SUM(p.amount)::float8
                FROM payments p
                WHERE p.booking_id = b.id AND p.status = 'paid'
              ), 0) AS paid_amount,
              jsonb_build_object(
                'check_in', COALESCE(b.check_in, (b.price_snapshot ->> 'check_in')::date, (b.policy_snapshot ->> 'check_in')::date),
                'check_out', COALESCE(b.check_out, (b.price_snapshot ->> 'check_out')::date, (b.policy_snapshot ->> 'check_out')::date),
                'slot_time', COALESCE(b.slot_time, (b.price_snapshot ->> 'slot_time')::time, (b.policy_snapshot ->> 'slot_time')::time),
                'nights', COALESCE(
                  NULLIF(b.price_snapshot ->> 'nights', '')::int,
                  NULLIF(b.policy_snapshot ->> 'nights', '')::int
                ),
                'adults', COALESCE(
                  NULLIF(b.price_snapshot ->> 'adults', '')::int,
                  NULLIF(b.policy_snapshot ->> 'adults', '')::int
                ),
                'children', COALESCE(
                  NULLIF(b.price_snapshot ->> 'children', '')::int,
                  NULLIF(b.policy_snapshot ->> 'children', '')::int
                )
              ) AS item,
              u.first_name AS user_first_name,
              u.last_name  AS user_last_name,
              u.email      AS user_email,
              u.phone      AS user_phone
       FROM bookings b
       LEFT JOIN users u ON u.id = b.user_id
       LEFT JOIN hotel_rooms hr
         ON hr.id = COALESCE(b.room_id, NULLIF(b.price_snapshot ->> 'room_id', '')::uuid)
       LEFT JOIN room_types rt
         ON rt.id = COALESCE(
           NULLIF(b.price_snapshot ->> 'room_type_id', '')::uuid,
           hr.room_type_id
         )
       LEFT JOIN vehicles v2 ON v2.id = b.vehicle_id
       WHERE b.partner_organization_id = $1
       ORDER BY ${sortColumn} ${orderDir}
       LIMIT $2 OFFSET $3`,
      [organizationId, pagination.limit, pagination.offset],
    );
  }

  async createBooking(
    actor: RequestActor | undefined,
    body: Record<string, unknown>,
  ) {
    const organizationId = this.organizationId(actor);
    const now = new Date().toISOString();
    const bookingId = randomUUID();
    const bookingNumber = `B-${randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()}`;
    const hotelId = this.requiredString(
      body.hotel_id ?? body.hotelId,
      'HOTEL_REQUIRED',
      'Hotel tanlanishi kerak',
    );
    const roomTypeId = this.requiredString(
      body.roomTypeId ?? body.room_type_id,
      'ROOM_TYPE_REQUIRED',
      'Xona turi tanlanishi kerak',
    );

    // Validate hotel + hamkor turini aniqlash (restoranmi yoki yo'q)
    const [hotel] = await this.pg.query<{
      id: string;
      check_in_time: string | null;
      check_out_time: string | null;
      partner_type: string;
      commission_rate: number;
      stars: number | null;
      city_slug: string | null;
    }>(
      `SELECT h.id::text, h.check_in_time, h.check_out_time, po.type::text AS partner_type,
              po.default_commission_rate::float8 AS commission_rate,
              h.stars, c.slug AS city_slug
       FROM hotels h
       JOIN partner_organizations po ON po.id = h.partner_organization_id
       JOIN cities c ON c.id = h.city_id
       WHERE h.id = $1 AND h.partner_organization_id = $2`,
      [hotelId, organizationId],
    );
    if (!hotel) {
      throw new NotFoundException({
        code: 'ROOM_NOT_AVAILABLE',
        message: "Tanlangan hotel uchun ma'lumot topilmadi",
      });
    }
    const isRestaurant = hotel.partner_type === 'restaurant';
    // SAFAAR komissiya stavkasi — `bookings.service.ts createHotelInternal()`
    // bilan BIR XIL Excel-asosli qoida (2026-09-13 audit, batafsili o'sha
    // faylning izohiga qarang): hamkor walk-in bron ham xuddi shu haqiqiy
    // komissiya stavkasidan foydalanishi SHART, aks holda bitta hotel uchun
    // ikkita HAR XIL komissiya mantig'i ishlab qolardi.
    const accommodationRate = resolveAccommodationCommissionRate({
      citySlug: hotel.city_slug,
      partnerOrganizationType: hotel.partner_type,
      stars: hotel.stars,
    });
    const resolvedCommissionRatePercent = accommodationRate.matched
      ? (accommodationRate.ratePercent as number)
      : hotel.commission_rate;

    const [roomType] = await this.pg.query<{
      id: string;
      name: Record<string, string>;
      base_price: number | null;
      capacity: number | null;
    }>(
      `SELECT rt.id::text, rt.name, rt.base_price::float8, rt.capacity
       FROM room_types rt
       WHERE rt.id = $1::uuid
         AND EXISTS (
           SELECT 1
           FROM hotel_rooms hr
           WHERE hr.hotel_id = $2::uuid
             AND hr.room_type_id = rt.id
             AND hr.status = 'active'
         )`,
      [roomTypeId, hotelId],
    );
    if (!roomType) {
      throw new NotFoundException({
        code: 'ROOM_TYPE_NOT_AVAILABLE',
        message: 'Tanlangan xona turi bu hotelda mavjud emas',
      });
    }

    let roomNumber = this.optionalString(body.roomNumber ?? body.room_number);
    type BookingRoomRow = {
      id: string;
      room_type_id: string;
      code: string;
      base_price: number;
    };
    let room: BookingRoomRow | null = null;

    if (roomNumber) {
      const [selectedRoom] = await this.pg.query<BookingRoomRow>(
        `SELECT id::text, room_type_id::text, code, base_price::float8
         FROM hotel_rooms
         WHERE hotel_id = $1::uuid
           AND room_type_id = $2::uuid
           AND code = $3
           AND status = 'active'
         LIMIT 1`,
        [hotelId, roomTypeId, roomNumber],
      );
      if (!selectedRoom) {
        throw new NotFoundException({
          code: 'ROOM_NOT_AVAILABLE',
          message: 'Tanlangan xona topilmadi',
        });
      }
      room = selectedRoom;
    }

    const bedId = this.optionalString(body.bedId ?? body.bed_id);
    if (bedId) {
      const [bed] = await this.pg.query<{
        id: string;
        room_id: string;
        room_number: string;
        room_type_id: string;
      }>(
        `SELECT rb.id::text, rb.room_id::text, hr.code AS room_number, hr.room_type_id::text
         FROM room_beds rb
         JOIN hotel_rooms hr ON hr.id = rb.room_id
         WHERE rb.id = $1::uuid
           AND hr.hotel_id = $2::uuid
           AND hr.room_type_id = $3::uuid
           AND rb.is_listed = true
           AND rb.status <> 'OUT_OF_SERVICE'
           AND hr.status = 'active'
         LIMIT 1`,
        [bedId, hotelId, roomTypeId],
      );
      if (!bed) {
        throw new NotFoundException({
          code: 'BED_NOT_AVAILABLE',
          message: 'Tanlangan yotoq topilmadi',
        });
      }
      if (room && bed.room_id !== room.id) {
        throw new BadRequestException({
          code: 'BED_ROOM_MISMATCH',
          message: 'Yotoq tanlangan xonaga tegishli emas',
        });
      }
      if (!room) {
        const [bedRoom] = await this.pg.query<BookingRoomRow>(
          `SELECT id::text, room_type_id::text, code, base_price::float8
           FROM hotel_rooms
           WHERE id = $1::uuid
           LIMIT 1`,
          [bed.room_id],
        );
        room = bedRoom ?? null;
        roomNumber = bed.room_number;
      }
    }

    const checkIn = this.requiredString(
      body.checkIn ?? body.check_in,
      'CHECK_IN_REQUIRED',
      'Kelish sanasi kiritilishi kerak',
    );

    let slotTime: string | null = null;
    if (isRestaurant) {
      slotTime = this.requiredString(
        body.slotTime ?? body.slot_time,
        'SLOT_TIME_REQUIRED',
        'Vaqtni tanlang',
      );
      // Yarim tundan keyin yopiladigan restoran (masalan 07:01 -> 01:53)
      // uchun eski bir kunlik solishtiruv HAR QANDAY vaqtni rad etardi —
      // `common/operating-hours.ts` ga qarang.
      if (
        !isSlotWithinOperatingHours(
          slotTime,
          hotel.check_in_time,
          hotel.check_out_time,
        )
      ) {
        throw new BadRequestException({
          code: 'SLOT_OUTSIDE_HOURS',
          message: 'Tanlangan vaqt ish vaqtidan tashqarida',
        });
      }
    }
    const checkOut = isRestaurant
      ? checkIn
      : this.requiredString(
          body.checkOut ?? body.check_out,
          'CHECK_OUT_REQUIRED',
          'Ketish sanasi kiritilishi kerak',
        );
    const nights = isRestaurant
      ? 1
      : this.requiredPositiveInteger(
          body.nights,
          'NIGHTS_REQUIRED',
          'Kechalar soni kiritilishi kerak',
        );
    const totalAmount = this.requiredNonNegativeNumber(
      body.totalPrice ?? body.total_amount,
      'TOTAL_AMOUNT_REQUIRED',
      'Bron summasi kiritilishi kerak',
    );
    const adults = this.requiredPositiveInteger(
      body.adults,
      'ADULTS_REQUIRED',
      'Mehmonlar soni kiritilishi kerak',
    );
    const children = this.optionalNonNegativeNumber(body.children) ?? 0;
    const source = this.requiredString(
      body.source,
      'BOOKING_SOURCE_REQUIRED',
      'Bron manbasi kiritilishi kerak',
    );
    const commissionAmount = calculateCommission(
      totalAmount,
      resolvedCommissionRatePercent,
    );
    const guestName = String(body.fullName ?? body.full_name ?? '').trim();
    const guestPhone = String(body.phone ?? '').trim();
    const guestEmail = body.email ? String(body.email).toLowerCase() : null;
    if (!guestName && !guestPhone) {
      throw new BadRequestException({
        code: 'GUEST_REQUIRED',
        message: 'Mehmon ismi yoki telefoni talab qilinadi',
      });
    }

    const policySnapshot = {
      source,
      check_in: checkIn,
      check_out: checkOut,
      nights,
      adults,
      children,
      ...(slotTime ? { slot_time: slotTime } : {}),
    };
    const priceSnapshot = {
      hotel_id: hotelId,
      room_id: room?.id ?? null,
      room_type_id: roomType.id,
      room_number: roomNumber,
      bed_id: bedId,
      slot_time: slotTime,
      check_in: checkIn,
      check_out: checkOut,
      nights,
      adults,
      children,
      base_price: Number(room?.base_price ?? roomType.base_price ?? 0),
      total_amount: totalAmount,
    };
    const paymentId = randomUUID();

    // Xona/stol tanlangan bo'lsa — tranzaksiya ichida qatorni qulflab,
    // ziddiyatni (bir xil xona/stol + bir xil sana/vaqt oralig'i) tekshiramiz.
    // Bu — `SELECT ... FOR UPDATE`ni haqiqiy tranzaksiya ichida qilish orqali
    // ikki xodim bir vaqtda bitta xona/stolni band qilishining oldini oladi
    // (avval bunday himoya umuman yo'q edi).
    await this.pg.transaction(async (tx) => {
      if (room) {
        const locked = await tx.query(
          `SELECT id FROM hotel_rooms WHERE id = $1::uuid FOR UPDATE`,
          [room.id],
        );
        if (!locked[0]) {
          throw new NotFoundException({
            code: 'ROOM_NOT_AVAILABLE',
            message: 'Tanlangan xona topilmadi',
          });
        }

        const activeStatuses = [
          BookingStatus.CANCELLED.toLowerCase(),
          BookingStatus.EXPIRED.toLowerCase(),
          BookingStatus.COMPLETED.toLowerCase(),
        ];
        const conflicts = isRestaurant
          ? await tx.query(
              `SELECT id FROM bookings
               WHERE room_id = $1::uuid
                 AND status NOT IN ($2, $3, $4)
                 AND check_in = $5::date
                 AND slot_time IS NOT NULL
                 AND slot_time < ($6::time + interval '90 minutes')
                 AND $6::time < (slot_time + interval '90 minutes')
               LIMIT 1`,
              [room.id, ...activeStatuses, checkIn, slotTime],
            )
          : await tx.query(
              `SELECT id FROM bookings
               WHERE room_id = $1::uuid
                 AND status NOT IN ($2, $3, $4)
                 AND check_in < $5::date
                 AND $6::date < check_out
               LIMIT 1`,
              [room.id, ...activeStatuses, checkOut, checkIn],
            );
        if (conflicts[0]) {
          throw new ConflictException({
            code: isRestaurant ? 'TABLE_ALREADY_BOOKED' : 'ROOM_ALREADY_BOOKED',
            message: isRestaurant
              ? 'Bu stol tanlangan vaqtda band'
              : 'Bu xona tanlangan sanalarda band',
          });
        }

        // `room_inventory.closed` — xuddi shu tekshiruv mijoz oqimida
        // (`bookings.service.ts::createHotelInternal`) ham qo'shilgan;
        // hamkor walk-in/naqd bron oqimi ham bloklangan sanalarga bron
        // yaratmasligi kerak (masalan admin overbooking tufayli bloklagan
        // bo'lsa, hamkorning o'zi ham o'sha sanaga yangi bron qo'sha
        // olmasligi shart).
        const [{ blocked_count: blockedCountRaw }] = isRestaurant
          ? await tx.query<{ blocked_count: string | number }>(
              `SELECT COUNT(*) AS blocked_count
               FROM room_inventory
               WHERE room_id = $1::uuid AND date = $2::date AND closed = true`,
              [room.id, checkIn],
            )
          : await tx.query<{ blocked_count: string | number }>(
              `SELECT COUNT(*) AS blocked_count
               FROM room_inventory
               WHERE room_id = $1::uuid
                 AND date >= $2::date AND date < $3::date
                 AND closed = true`,
              [room.id, checkIn, checkOut],
            );
        if (Number(blockedCountRaw) > 0) {
          throw new ConflictException({
            code: 'ROOM_DATES_BLOCKED',
            message:
              'Tanlangan sanalarning bir qismi vaqtincha sotuvdan bloklangan',
          });
        }
      }

      await tx.query(
        `INSERT INTO bookings (
           id, booking_number, user_id, partner_organization_id, type,
           confirmation_mode, payment_method, status, currency, total_amount,
           subtotal, discount_amount, bonus_amount, service_fee,
           commission_amount, partner_payable, hotel_id, trip_id,
           room_id, check_in, check_out, slot_time,
           policy_snapshot, price_snapshot, guest_name, guest_email, guest_phone,
           created_at, updated_at
         )
         VALUES (
           $1, $2, $3, $4, $5,
           $6, $7, $8, $9, $10,
           $11, $12, $13, $14,
           $15, $16, $17, $18,
           $19, $20::date, $21::date, $22::time,
           $23::jsonb, $24::jsonb, $25, $26, $27,
           $28, $29
         )`,
        [
          bookingId,
          bookingNumber,
          null,
          organizationId,
          isRestaurant ? 'restaurant' : 'hotel',
          'instant_confirmation',
          'cash',
          BookingStatus.CONFIRMED.toLowerCase(),
          'UZS',
          totalAmount,
          totalAmount,
          0,
          0,
          0,
          commissionAmount,
          totalAmount - commissionAmount,
          hotelId,
          null,
          room?.id ?? null,
          checkIn,
          checkOut,
          slotTime,
          JSON.stringify(policySnapshot),
          JSON.stringify(priceSnapshot),
          guestName || null,
          guestEmail,
          guestPhone || null,
          now,
          now,
        ],
      );

      await tx.query(
        `INSERT INTO payments (id, booking_id, provider, status, amount, currency, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [paymentId, bookingId, 'cash', 'paid', totalAmount, 'UZS', now, now],
      );

      // Naqd pul walk-in bron darhol "confirmed" + "paid" holatida
      // yaratiladi (mijoz hamkorning o'zi oldida to'laydi) — shuning uchun
      // daromad ham darhol hamkorning haqiqiy hisobiga (ledger) yoziladi,
      // xuddi onlayn to'lov webhook orqali tasdiqlangandagi kabi.
      await tx.query(
        `INSERT INTO partner_ledger_entries (id, organization_id, booking_id, type, amount, currency, created_at)
         VALUES ($1, $2, $3, 'booking_earned', $4, $5, $6)`,
        [
          randomUUID(),
          organizationId,
          bookingId,
          totalAmount - commissionAmount,
          'UZS',
          now,
        ],
      );
    });

    return this.booking(actor, bookingId);
  }

  async booking(actor: RequestActor | undefined, id: string) {
    const organizationId = this.organizationId(actor);
    const bookings = await this.pg.query(
      `SELECT b.*,
              COALESCE(b.check_in, (b.price_snapshot ->> 'check_in')::date, (b.policy_snapshot ->> 'check_in')::date) AS check_in,
              COALESCE(b.check_out, (b.price_snapshot ->> 'check_out')::date, (b.policy_snapshot ->> 'check_out')::date) AS check_out,
              COALESCE(b.slot_time, (b.price_snapshot ->> 'slot_time')::time, (b.policy_snapshot ->> 'slot_time')::time) AS slot_time,
              COALESCE(b.price_snapshot ->> 'room_type_id', hr.room_type_id::text) AS room_type_id,
              COALESCE(b.price_snapshot ->> 'room_number', hr.code) AS room_number,
              COALESCE(rt.name ->> 'uz', rt.name ->> 'ru', rt.name ->> 'en') AS room_type_name,
              v2.name AS vehicle_name,
              v2.plate_number AS vehicle_plate_number,
              COALESCE((
                SELECT SUM(p.amount)::float8
                FROM payments p
                WHERE p.booking_id = b.id AND p.status = 'paid'
              ), 0) AS paid_amount,
              jsonb_build_object(
                'check_in', COALESCE(b.check_in, (b.price_snapshot ->> 'check_in')::date, (b.policy_snapshot ->> 'check_in')::date),
                'check_out', COALESCE(b.check_out, (b.price_snapshot ->> 'check_out')::date, (b.policy_snapshot ->> 'check_out')::date),
                'slot_time', COALESCE(b.slot_time, (b.price_snapshot ->> 'slot_time')::time, (b.policy_snapshot ->> 'slot_time')::time),
                'nights', COALESCE(
                  NULLIF(b.price_snapshot ->> 'nights', '')::int,
                  NULLIF(b.policy_snapshot ->> 'nights', '')::int
                ),
                'adults', COALESCE(
                  NULLIF(b.price_snapshot ->> 'adults', '')::int,
                  NULLIF(b.policy_snapshot ->> 'adults', '')::int
                ),
                'children', COALESCE(
                  NULLIF(b.price_snapshot ->> 'children', '')::int,
                  NULLIF(b.policy_snapshot ->> 'children', '')::int
                )
              ) AS item
       FROM bookings b
       LEFT JOIN hotel_rooms hr
         ON hr.id = COALESCE(b.room_id, NULLIF(b.price_snapshot ->> 'room_id', '')::uuid)
       LEFT JOIN room_types rt
         ON rt.id = COALESCE(
           NULLIF(b.price_snapshot ->> 'room_type_id', '')::uuid,
           hr.room_type_id
         )
       LEFT JOIN vehicles v2 ON v2.id = b.vehicle_id
       WHERE b.id = $1`,
      [id],
    );
    if (!bookings[0]) {
      throw new NotFoundException({
        code: 'BOOKING_EXPIRED',
        message: 'Bron topilmadi',
      });
    }
    if (bookings[0]['partner_organization_id'] !== organizationId) {
      throw new ForbiddenException({
        code: 'BOOKING_FORBIDDEN',
        message: 'Bu bron sizning tashkilotingizga tegishli emas',
      });
    }
    return bookings[0];
  }

  async assignRoom(
    actor: RequestActor | undefined,
    id: string,
    body: Record<string, unknown>,
  ) {
    const booking = (await this.booking(actor, id)) as Record<string, unknown>;
    const now = new Date().toISOString();
    const hotelId = this.requiredString(
      booking['hotel_id'],
      'HOTEL_REQUIRED',
      'Bron hotelga bogʻlanmagan',
    );
    const roomNumber = this.requiredString(
      body.roomNumber ?? body.room_number,
      'ROOM_NUMBER_REQUIRED',
      'Xona raqami kiritilishi kerak',
    );
    const bedId = this.optionalString(body.bedId ?? body.bed_id);
    const [room] = await this.pg.query<{
      id: string;
      room_type_id: string;
      code: string;
    }>(
      `SELECT id::text, room_type_id::text, code
       FROM hotel_rooms
       WHERE hotel_id = $1::uuid
         AND code = $2
         AND status = 'active'
       LIMIT 1`,
      [hotelId, roomNumber],
    );
    if (!room) {
      throw new NotFoundException({
        code: 'ROOM_NOT_AVAILABLE',
        message: 'Tanlangan xona topilmadi',
      });
    }

    const patch = {
      room_id: room.id,
      room_type_id: room.room_type_id,
      room_number: roomNumber,
      ...(bedId ? { bed_id: bedId } : {}),
    };

    if (bedId) {
      const [bed] = await this.pg.query<{ id: string }>(
        `SELECT rb.id::text
         FROM room_beds rb
         WHERE rb.id = $1::uuid
           AND rb.room_id = $2::uuid
           AND rb.is_listed = true
           AND rb.status <> 'OUT_OF_SERVICE'
         LIMIT 1`,
        [bedId, room.id],
      );
      if (!bed) {
        throw new NotFoundException({
          code: 'BED_NOT_AVAILABLE',
          message: 'Tanlangan yotoq topilmadi',
        });
      }
    }

    const result = await this.pg.query(
      `UPDATE bookings
       SET price_snapshot = COALESCE(price_snapshot, '{}'::jsonb) || $1::jsonb,
           updated_at = $2
       WHERE id = $3 RETURNING *`,
      [JSON.stringify(patch), now, id],
    );
    return result[0];
  }

  async bookingStatus(
    actor: RequestActor | undefined,
    id: string,
    status: string,
  ) {
    const booking = (await this.booking(actor, id)) as Record<string, unknown>;
    const now = new Date().toISOString();
    const sets: string[] = ['updated_at = $1'];
    const params: unknown[] = [now];

    let paramIdx = 2;

    if (status === 'confirmed') {
      sets.push(`status = $${paramIdx++}`, `confirmed_at = $1`);
      params.push(BookingStatus.CONFIRMED.toLowerCase());
    } else if (status === 'checked_in') {
      sets.push(`status = $${paramIdx++}`);
      params.push(BookingStatus.CONFIRMED.toLowerCase());
      // Store operational timestamps in the booking policy snapshot.
      await this.pg.query(
        `UPDATE bookings SET policy_snapshot = jsonb_set(COALESCE(policy_snapshot, '{}'::jsonb), '{checked_in_at}', to_jsonb($1::text)), updated_at = $1 WHERE id = $2`,
        [now, id],
      );
      await this.updateBookingInventoryStatus(booking, 'OCCUPIED', now);
    } else if (status === 'boarded') {
      await this.pg.query(
        `UPDATE bookings SET policy_snapshot = jsonb_set(COALESCE(policy_snapshot, '{}'::jsonb), '{boarded_at}', to_jsonb($1::text)), updated_at = $1 WHERE id = $2`,
        [now, id],
      );
    } else if (status === 'completed') {
      sets.push(`status = $${paramIdx++}`);
      params.push(BookingStatus.COMPLETED.toLowerCase());
      await this.pg.query(
        `UPDATE bookings SET policy_snapshot = jsonb_set(COALESCE(policy_snapshot, '{}'::jsonb), '{checked_out_at}', to_jsonb($1::text)), updated_at = $1 WHERE id = $2`,
        [now, id],
      );
      await this.updateBookingInventoryStatus(booking, 'VACANT_DIRTY', now);
    }

    if (paramIdx > 2) {
      params.push(id);
      await this.pg.query(
        `UPDATE bookings SET ${sets.join(', ')} WHERE id = $${paramIdx}`,
        params,
      );
    }

    const updated = await this.pg.query(
      `SELECT * FROM bookings WHERE id = $1`,
      [id],
    );
    return updated[0];
  }

  async rejectBooking(
    actor: RequestActor | undefined,
    id: string,
    body: Record<string, unknown>,
  ) {
    await this.booking(actor, id); // validate ownership
    const now = new Date().toISOString();
    const reason = String(body.reason ?? 'Partner rad etdi');

    return this.pg.transaction(async (tx) => {
      const [updated] = await tx.query(
        `UPDATE bookings SET status = $1, cancel_reason_text = $2, cancelled_at = $3, updated_at = $3 WHERE id = $4 RETURNING *`,
        [BookingStatus.CANCELLED.toLowerCase(), reason, now, id],
      );

      // Hamkor avtobus bronini rad etsa ham (masalan mijoz kelmadi),
      // o'rindiq bo'shatilishi kerak — aks holda "held" holida abadiy
      // qolib, boshqa hech kimga sotilmaydi.
      await tx.query(
        `UPDATE trip_seats
         SET status = 'available', held_by_booking_id = NULL, held_until = NULL
         WHERE held_by_booking_id = $1::uuid`,
        [id],
      );

      return updated;
    });
  }

  async cashStatus(
    actor: RequestActor | undefined,
    id: string,
    status: 'collected' | 'reversed',
  ) {
    await this.booking(actor, id); // validate ownership
    const now = new Date().toISOString();

    const payments = await this.pg.query(
      `SELECT * FROM payments WHERE booking_id = $1 LIMIT 1`,
      [id],
    );

    if (payments[0]) {
      const paymentStatus = status === 'collected' ? 'paid' : 'awaiting_cash';
      await this.pg.query(
        `UPDATE payments SET status = $1, updated_at = $2 WHERE id = $3`,
        [paymentStatus, now, payments[0]['id']],
      );
      const updatedPayments = await this.pg.query(
        `SELECT * FROM payments WHERE id = $1`,
        [payments[0]['id']],
      );
      return {
        booking_id: id,
        cash_status: status,
        payment: updatedPayments[0],
      };
    }

    return { booking_id: id, cash_status: status, payment: undefined };
  }

  // ---------------------------------------------------------------------------
  // Finance
  // ---------------------------------------------------------------------------

  /**
   * Hamkor balansining YAGONA haqiqat manbai — `partner_ledger_entries`.
   * Avval balans to'g'ridan-to'g'ri `bookings.total_amount`dan, bron
   * holatidan (bekor qilingan/qaytarilgan/hali to'lanmagan) qat'iy nazar
   * hisoblanardi, va `* 0.7`/`* 0.88` kabi haqiqiy komissiyaga aloqasi
   * yo'q qattiq yozilgan koeffitsientlar ishlatilardi. Endi ledger'ga
   * faqat haqiqatan "topilgan" (to'lov tasdiqlangan) summalar ijobiy, va
   * qaytarishlar manfiy yozuv sifatida kiradi — shu bilan bron holati va
   * qaytarishlar avtomatik hisobga olinadi.
   */
  private async ledgerBalance(
    db: Pick<PostgresService, 'query'> | PostgresTransaction,
    organizationId: string,
  ): Promise<number> {
    const [row] = await db.query<{ sum: string | null }>(
      `SELECT COALESCE(SUM(amount), 0)::text as sum FROM partner_ledger_entries WHERE organization_id = $1`,
      [organizationId],
    );
    return Number(row?.sum ?? 0);
  }

  private async committedWithdrawals(
    db: Pick<PostgresService, 'query'> | PostgresTransaction,
    organizationId: string,
  ): Promise<number> {
    const [row] = await db.query<{ sum: string | null }>(
      `SELECT COALESCE(SUM(amount), 0)::text as sum
       FROM withdrawal_requests
       WHERE organization_id = $1 AND status IN ('requested', 'approved', 'paid')`,
      [organizationId],
    );
    return Number(row?.sum ?? 0);
  }

  async financeOverview(actor: RequestActor | undefined) {
    const organizationId = this.organizationId(actor);
    const [ledgerTotal, committed] = await Promise.all([
      this.ledgerBalance(this.pg, organizationId),
      this.committedWithdrawals(this.pg, organizationId),
    ]);
    return {
      // Sof balans — komissiya va qaytarishlardan keyin, hali yechilgan
      // mablag' ayirilmasdan.
      pending_balance: ledgerTotal,
      // Haqiqatan hozir yechish mumkin bo'lgan summa.
      available_balance: Math.max(0, ledgerTotal - committed),
      currency: 'UZS',
    };
  }

  async ledger(actor: RequestActor | undefined, query: QueryLike = {}) {
    const organizationId = this.organizationId(actor);
    const pagination = parsePagination(query, 'partner', {
      defaultLimit: 50,
      allowedSortBy: ['created_at', 'amount'],
    });
    const sortColumn = ['created_at', 'amount'].includes(pagination.sortBy)
      ? pagination.sortBy
      : 'created_at';
    const orderDir = pagination.order === 'asc' ? 'ASC' : 'DESC';

    return this.pg.query(
      `SELECT id::text, organization_id::text as partner_id, booking_id::text,
              type, amount::float8, currency, created_at
       FROM partner_ledger_entries
       WHERE organization_id = $1
       ORDER BY ${sortColumn} ${orderDir}
       ${limitOffsetSql(pagination)}`,
      [organizationId],
    );
  }

  async financeChart(actor: RequestActor | undefined) {
    const overview = await this.financeOverview(actor);
    return [
      {
        date: new Date().toISOString().slice(0, 10),
        amount: overview.pending_balance,
      },
    ];
  }

  // ---------------------------------------------------------------------------
  // Withdrawals
  // ---------------------------------------------------------------------------

  async withdrawal(
    actor: RequestActor | undefined,
    body: Record<string, unknown>,
  ) {
    const organizationId = this.organizationId(actor);
    const amount = Number(body.amount ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException({
        code: 'WITHDRAWAL_AMOUNT_INVALID',
        message: 'Yechim summasi noto‘g‘ri',
      });
    }

    const bankAccount = String(
      body.bankAccount ?? body.bank_account ?? '',
    ).trim();
    if (!bankAccount) {
      throw new BadRequestException({
        code: 'WITHDRAWAL_BANK_ACCOUNT_REQUIRED',
        message: 'Bank hisob raqami kiritilishi kerak',
      });
    }

    const now = new Date().toISOString();
    return this.pg.transaction(async (tx: PostgresTransaction) => {
      // Tashkilot qatorini qulflab, shu tashkilot uchun parallel keladigan
      // pul yechish so'rovlarini ketma-ket ishlashga majburlaymiz — aks
      // holda ikkita so'rov bir vaqtda mavjud balansdan ortiq summani
      // "ko'rib", ikkalasi ham muvaffaqiyatli yaratilishi mumkin edi.
      await tx.query(
        `SELECT id FROM partner_organizations WHERE id = $1 FOR UPDATE`,
        [organizationId],
      );

      const ledgerTotal = await this.ledgerBalance(tx, organizationId);
      const alreadyCommitted = await this.committedWithdrawals(
        tx,
        organizationId,
      );
      const remaining = ledgerTotal - alreadyCommitted;

      if (amount > remaining) {
        throw new BadRequestException({
          code: 'WITHDRAWAL_EXCEEDS_BALANCE',
          message: `Mavjud balans yetarli emas. Yechish mumkin: ${Math.max(remaining, 0)} UZS`,
        });
      }

      const [request] = await tx.query(
        `INSERT INTO withdrawal_requests
           (id, organization_id, amount, currency, status, bank_account, created_at, updated_at)
         VALUES ($1, $2, $3, 'UZS', 'requested', $4, $5, $6)
         RETURNING *`,
        [randomUUID(), organizationId, amount, bankAccount, now, now],
      );
      return request;
    });
  }

  async withdrawals(actor: RequestActor | undefined, query: QueryLike = {}) {
    const organizationId = this.organizationId(actor);
    const pagination = parsePagination(query, 'partner', {
      defaultLimit: 50,
      allowedSortBy: ['created_at', 'updated_at', 'status', 'amount'],
    });
    const sortColumn = [
      'created_at',
      'updated_at',
      'status',
      'amount',
    ].includes(pagination.sortBy)
      ? pagination.sortBy
      : 'created_at';
    const orderDir = pagination.order === 'asc' ? 'ASC' : 'DESC';
    return this.pg.query(
      `SELECT *
       FROM withdrawal_requests
       WHERE organization_id = $1
       ORDER BY ${sortColumn} ${orderDir}
       ${limitOffsetSql(pagination)}`,
      [organizationId],
    );
  }

  // ---------------------------------------------------------------------------
  // Export
  // ---------------------------------------------------------------------------

  async createExport(
    actor: RequestActor | undefined,
    type: string,
    body: Record<string, unknown>,
  ) {
    this.requireActor(actor);
    const organizationId = this.organizationId(actor);
    const now = new Date().toISOString();
    const format = ['csv', 'xlsx', 'pdf'].includes(String(body.format))
      ? (String(body.format) as 'csv' | 'xlsx' | 'pdf')
      : 'csv';

    const jobId = randomUUID();
    // Bir xil (tashkilot, type, format) uchun parallel/takroriy so'rovlar
    // cheksiz "queued" duplikat qator yaratavermasligi uchun — DB'dagi
    // qisman UNIQUE indeks (faqat queued/processing statusiga) ON
    // CONFLICT orqali hurmat qilinadi.
    const inserted = await this.pg.query(
      `INSERT INTO export_jobs (id, owner_type, owner_id, type, format, status, created_at, updated_at)
       VALUES ($1, 'partner', $2, $3, $4, 'queued', $5, $6)
       ON CONFLICT (owner_type, owner_id, type, format) WHERE status IN ('queued', 'processing')
       DO NOTHING
       RETURNING id`,
      [jobId, organizationId, type, format, now, now],
    );

    if (inserted.length === 0) {
      const [existing] = await this.pg.query(
        `SELECT * FROM export_jobs
         WHERE owner_type = 'partner' AND owner_id = $1 AND type = $2 AND format = $3
           AND status IN ('queued', 'processing')
         ORDER BY created_at DESC LIMIT 1`,
        [organizationId, type, format],
      );
      return existing;
    }

    await this.jobs.add(
      'partner-export',
      {
        export_id: jobId,
        owner_id: organizationId,
        type,
        format,
      },
      {
        idempotencyKey: `partner-export:${organizationId}:${type}:${format}`,
      },
    );

    const [job] = await this.pg.query(
      `SELECT * FROM export_jobs WHERE id = $1`,
      [jobId],
    );
    return job;
  }

  // ---------------------------------------------------------------------------
  // Finance Documents
  // ---------------------------------------------------------------------------

  async financeDocuments(actor: RequestActor | undefined) {
    const organizationId = this.organizationId(actor);
    return this.pg.query(
      `SELECT id::text, owner_id::text as organization_id, type, format, status,
              download_key, created_at, updated_at, expires_at
       FROM export_jobs
       WHERE owner_type = 'partner' AND owner_id = $1 AND type = 'partner-finance'
       ORDER BY created_at DESC`,
      [organizationId],
    );
  }

  async financeDocumentDownload(actor: RequestActor | undefined, id: string) {
    const organizationId = this.organizationId(actor);
    const [document] = await this.pg.query<{ download_key?: string | null }>(
      `SELECT download_key
       FROM export_jobs
       WHERE id = $1 AND owner_type = 'partner' AND owner_id = $2 AND type = 'partner-finance'
       LIMIT 1`,
      [id, organizationId],
    );
    if (!document) {
      throw new NotFoundException({
        code: 'EXPORT_NOT_FOUND',
        message: 'Moliya hujjati topilmadi',
      });
    }
    if (!document.download_key) {
      throw new BadRequestException({
        code: 'EXPORT_NOT_READY',
        message: 'Moliya hujjati hali tayyor emas',
      });
    }
    return {
      id,
      download_url: document.download_key.startsWith('http')
        ? document.download_key
        : `${this.publicOrigin()}/${document.download_key.replace(/^\//, '')}`,
    };
  }

  // ---------------------------------------------------------------------------
  // API Keys
  // ---------------------------------------------------------------------------

  async apiKeys(actor: RequestActor | undefined) {
    const organizationId = this.organizationId(actor);
    const keys = await this.pg.query(
      `SELECT * FROM partner_api_keys WHERE organization_id = $1 ORDER BY created_at DESC`,
      [organizationId],
    );
    return keys.map((key) => this.publicApiKey(key));
  }

  async createApiKey(
    actor: RequestActor | undefined,
    body: Record<string, unknown>,
  ) {
    const now = new Date().toISOString();
    const prefix = `uzb_live_${randomToken(5)}`;
    const fullKey = `${prefix}_${randomToken(24)}`;
    const keyId = randomUUID();

    const apiKey = {
      id: keyId,
      organization_id: this.organizationId(actor),
      name: String(body.name ?? 'Default API key'),
      key_prefix: prefix,
      scopes: Array.isArray(body.scopes)
        ? body.scopes.map((scope) => String(scope))
        : ['bookings:read'],
      status: 'active',
      created_at: now,
      updated_at: now,
    };

    await this.pg.query(
      `INSERT INTO partner_api_keys
         (id, organization_id, name, key_prefix, secret_hash, scopes, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'active', $7, $8)`,
      [
        keyId,
        apiKey.organization_id,
        apiKey.name,
        prefix,
        hashSecret(fullKey, partnerApiPepper()),
        apiKey.scopes,
        now,
        now,
      ],
    );

    return { ...this.publicApiKey(apiKey), api_key: fullKey };
  }

  async revokeApiKey(actor: RequestActor | undefined, id: string) {
    const now = new Date().toISOString();
    const organizationId = this.organizationId(actor);

    const result = await this.pg.query(
      `UPDATE partner_api_keys SET status = 'revoked', revoked_at = $1, updated_at = $1 WHERE id = $2 AND organization_id = $3 RETURNING *`,
      [now, id, organizationId],
    );

    if (!result[0]) {
      throw new NotFoundException({
        code: 'API_KEY_INVALID',
        message: 'API key topilmadi',
      });
    }

    return this.publicApiKey(result[0]);
  }

  // ---------------------------------------------------------------------------
  // Webhooks
  // ---------------------------------------------------------------------------

  async webhooks(actor: RequestActor | undefined) {
    const organizationId = this.organizationId(actor);
    return this.pg.query(
      `SELECT * FROM partner_webhook_endpoints WHERE organization_id = $1 ORDER BY created_at DESC`,
      [organizationId],
    );
  }

  async createWebhook(
    actor: RequestActor | undefined,
    body: Record<string, unknown>,
  ) {
    const now = new Date().toISOString();
    const webhookId = randomUUID();
    const organizationId = this.organizationId(actor);
    const url = await assertPublicHttpUrl(String(body.url ?? ''));

    await this.pg.query(
      `INSERT INTO partner_webhook_endpoints (id, organization_id, url, events, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'active', $5, $6)`,
      [
        webhookId,
        organizationId,
        url.toString(),
        Array.isArray(body.events)
          ? body.events.map((event) => String(event))
          : ['booking.created'],
        now,
        now,
      ],
    );

    const webhooks = await this.pg.query(
      `SELECT * FROM partner_webhook_endpoints WHERE id = $1`,
      [webhookId],
    );
    return webhooks[0];
  }

  async updateWebhook(
    actor: RequestActor | undefined,
    id: string,
    body: Record<string, unknown>,
  ) {
    const organizationId = this.organizationId(actor);
    const now = new Date().toISOString();

    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (body.url !== undefined) {
      const url = await assertPublicHttpUrl(String(body.url));
      sets.push(`url = $${idx++}`);
      params.push(url.toString());
    }
    if (body.events !== undefined) {
      sets.push(`events = $${idx++}`);
      params.push(
        Array.isArray(body.events)
          ? body.events.map((event) => String(event))
          : ['booking.created'],
      );
    }
    if (
      body.status !== undefined ||
      body.is_active !== undefined ||
      body.isActive !== undefined
    ) {
      const enabled =
        body.status !== undefined
          ? String(body.status) === 'active'
          : Boolean(body.is_active ?? body.isActive);
      sets.push(`status = $${idx++}`);
      params.push(enabled ? 'active' : 'disabled');
    }

    if (sets.length > 0) {
      sets.push(`updated_at = $${idx++}`);
      params.push(now);
      params.push(id);
      params.push(organizationId);
      const result = await this.pg.query(
        `UPDATE partner_webhook_endpoints SET ${sets.join(', ')} WHERE id = $${idx++} AND organization_id = $${idx} RETURNING *`,
        params,
      );
      if (!result[0]) {
        throw new NotFoundException({
          code: 'WEBHOOK_NOT_FOUND',
          message: 'Webhook topilmadi',
        });
      }
      return result[0];
    }

    const webhooks = await this.pg.query(
      `SELECT * FROM partner_webhook_endpoints WHERE id = $1 AND organization_id = $2`,
      [id, organizationId],
    );
    if (!webhooks[0]) {
      throw new NotFoundException({
        code: 'WEBHOOK_NOT_FOUND',
        message: 'Webhook topilmadi',
      });
    }
    return webhooks[0];
  }

  async deleteWebhook(actor: RequestActor | undefined, id: string) {
    const organizationId = this.organizationId(actor);
    const now = new Date().toISOString();

    await this.pg.query(
      `UPDATE partner_webhook_endpoints SET status = 'deleted', updated_at = $1 WHERE id = $2 AND organization_id = $3`,
      [now, id, organizationId],
    );
    return { id, deleted: true };
  }

  async testWebhook(actor: RequestActor | undefined, id: string) {
    await this.assertWebhook(actor, id);
    const now = new Date().toISOString();
    const deliveryId = randomUUID();
    const [delivery] = await this.pg.query(
      `INSERT INTO partner_webhook_deliveries
         (id, endpoint_id, event_type, status, payload, created_at, updated_at)
       VALUES ($1, $2, 'webhook.test', 'queued', $3::jsonb, $4, $5)
       RETURNING id::text, endpoint_id::text as webhook_id, event_type, status,
                 payload, created_at, updated_at`,
      [
        deliveryId,
        id,
        JSON.stringify({ source: 'partner-test', requested_at: now }),
        now,
        now,
      ],
    );
    await this.jobs.add(
      'partner-webhook-delivery',
      { delivery_id: deliveryId },
      { idempotencyKey: `partner-webhook-delivery:${deliveryId}` },
    );
    return delivery;
  }

  async webhookDeliveries(actor: RequestActor | undefined, id: string) {
    await this.assertWebhook(actor, id);
    return this.pg.query(
      `SELECT id::text, endpoint_id::text as webhook_id, event_type, status,
              payload, response_status, response_body, attempted_at,
              created_at, updated_at
       FROM partner_webhook_deliveries
       WHERE endpoint_id = $1
       ORDER BY created_at DESC`,
      [id],
    );
  }

  async retryWebhookDelivery(
    actor: RequestActor | undefined,
    deliveryId: string,
  ) {
    const organizationId = this.organizationId(actor);
    const now = new Date().toISOString();
    const [delivery] = await this.pg.query(
      `UPDATE partner_webhook_deliveries d
       SET status = 'queued',
           updated_at = $1
       FROM partner_webhook_endpoints e
       WHERE d.id = $2
         AND d.endpoint_id = e.id
         AND e.organization_id = $3
       RETURNING d.id::text, d.endpoint_id::text as webhook_id, d.status`,
      [now, deliveryId, organizationId],
    );
    if (!delivery) {
      throw new NotFoundException({
        code: 'WEBHOOK_DELIVERY_NOT_FOUND',
        message: 'Webhook yetkazish yozuvi topilmadi',
      });
    }
    await this.jobs.add(
      'partner-webhook-delivery',
      { delivery_id: deliveryId },
      { idempotencyKey: `partner-webhook-delivery:${deliveryId}:${now}` },
    );
    return delivery;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private organizationId(actor: RequestActor | undefined): string {
    if (!actor?.organizationId) {
      throw new UnauthorizedException({
        code: 'PARTNER_ORGANIZATION_REQUIRED',
        message: 'Partner tashkiloti aniqlanmadi',
      });
    }
    return actor.organizationId;
  }

  private requireActor(actor: RequestActor | undefined): RequestActor {
    if (!actor) {
      throw new UnauthorizedException({
        code: 'AUTH_TOKEN_INVALID',
        message: 'Sessiya topilmadi yoki token yaroqsiz',
      });
    }
    return actor;
  }

  private async busCompanyId(actor: RequestActor | undefined): Promise<string> {
    const organizationId = this.organizationId(actor);
    const [company] = await this.pg.query<{ id: string }>(
      `SELECT id::text
       FROM bus_companies
       WHERE partner_organization_id = $1 AND status = 'active'
       ORDER BY created_at ASC
       LIMIT 1`,
      [organizationId],
    );
    if (!company) {
      throw new NotFoundException({
        code: 'BUS_COMPANY_NOT_FOUND',
        message: 'Avtobus kompaniyasi topilmadi',
      });
    }
    return company.id;
  }

  private async assertVehicle(actor: RequestActor | undefined, id: string) {
    const organizationId = this.organizationId(actor);
    const [vehicle] = await this.pg.query(
      `SELECT v.*
       FROM vehicles v
       JOIN bus_companies bc ON bc.id = v.company_id
       WHERE v.id = $1 AND bc.partner_organization_id = $2`,
      [id, organizationId],
    );
    if (!vehicle) {
      throw new NotFoundException({
        code: 'VEHICLE_NOT_FOUND',
        message: 'Transport topilmadi',
      });
    }
    return vehicle;
  }

  private async assertTrip(actor: RequestActor | undefined, id: string) {
    const organizationId = this.organizationId(actor);
    const [trip] = await this.pg.query(
      `SELECT t.*
       FROM trips t
       JOIN bus_companies bc ON bc.id = t.company_id
       WHERE t.id = $1 AND bc.partner_organization_id = $2`,
      [id, organizationId],
    );
    if (!trip) {
      throw new NotFoundException({
        code: 'TRIP_NOT_FOUND',
        message: 'Reys topilmadi',
      });
    }
    return trip;
  }

  private publicOrigin(): string {
    return (
      process.env.PUBLIC_API_ORIGIN ??
      process.env.NEXT_PUBLIC_API_URL ??
      `http://localhost:${process.env.PORT ?? 4000}/v1`
    ).replace(/\/$/, '');
  }

  private submissionActorId(actor: RequestActor | undefined): string {
    const actorId = String(actor?.id ?? '');
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      actorId,
    )
      ? actorId
      : this.organizationId(actor);
  }

  private normalizePhone(value: unknown): string {
    const raw = String(value ?? '').trim();
    if (!raw) {
      return '';
    }

    const digits = raw.replace(/\D/g, '');
    if (digits.startsWith('998')) {
      return `+${digits}`;
    }
    if (digits.length === 9) {
      return `+998${digits}`;
    }
    return raw.startsWith('+') ? `+${digits}` : raw;
  }

  private isValidUzPhone(value: string): boolean {
    return /^\+998\d{9}$/.test(value);
  }

  private isValidEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  private normalizeTaxId(value: unknown): string {
    return String(value ?? '').replace(/\D/g, '');
  }

  private optionalString(value: unknown): string | null {
    const text = String(value ?? '').trim();
    return text.length > 0 ? text : null;
  }

  private requiredString(
    value: unknown,
    code: string,
    message: string,
  ): string {
    const text = String(value ?? '').trim();
    if (!text) {
      throw new BadRequestException({ code, message });
    }
    return text;
  }

  private optionalInteger(value: unknown): number | null {
    if (value === undefined || value === null || value === '') return null;
    const number = Number(value);
    return Number.isInteger(number) ? number : null;
  }

  private optionalPositiveInteger(value: unknown): number | null {
    const number = this.optionalInteger(value);
    return number !== null && number > 0 ? number : null;
  }

  private requiredPositiveInteger(
    value: unknown,
    code: string,
    message: string,
  ): number {
    const number = Number(value);
    if (!Number.isInteger(number) || number <= 0) {
      throw new BadRequestException({ code, message });
    }
    return number;
  }

  private optionalNonNegativeNumber(value: unknown): number | null {
    if (value === undefined || value === null || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number : null;
  }

  private requiredNonNegativeNumber(
    value: unknown,
    code: string,
    message: string,
  ): number {
    const number = this.optionalNonNegativeNumber(value);
    if (number === null) {
      throw new BadRequestException({ code, message });
    }
    return number;
  }

  private roomHousekeepingStatus(value: unknown): string {
    const status = String(value ?? 'VACANT_CLEAN').toUpperCase();
    const allowed = new Set([
      'VACANT_CLEAN',
      'VACANT_DIRTY',
      'OCCUPIED',
      'OUT_OF_SERVICE',
      'BLOCKED',
    ]);
    if (!allowed.has(status)) {
      throw new BadRequestException({
        code: 'ROOM_STATUS_INVALID',
        message: "Xona holati noto'g'ri",
      });
    }
    return status;
  }

  private async assertRoomType(roomTypeId: string) {
    if (!/^[0-9a-f-]{36}$/i.test(roomTypeId)) {
      throw new BadRequestException({
        code: 'ROOM_TYPE_REQUIRED',
        message: 'Xona turi tanlanishi kerak',
      });
    }
    const [roomType] = await this.pg.query<{
      id: string;
      base_price: number | null;
      capacity: number | null;
    }>(
      `SELECT id::text, base_price::float8, capacity
       FROM room_types
       WHERE id = $1::uuid`,
      [roomTypeId],
    );
    if (!roomType) {
      throw new NotFoundException({
        code: 'ROOM_TYPE_NOT_FOUND',
        message: 'Xona turi topilmadi',
      });
    }
    return roomType;
  }

  private async assertRoomForHotel(
    actor: RequestActor | undefined,
    hotelId: string,
    roomId: string,
  ) {
    await this.assertHotel(hotelId, actor);
    const [room] = await this.pg.query(
      `SELECT * FROM hotel_rooms WHERE id = $1 AND hotel_id = $2`,
      [roomId, hotelId],
    );
    if (!room) {
      throw new NotFoundException({
        code: 'ROOM_NOT_AVAILABLE',
        message: 'Xona topilmadi',
      });
    }
    return room;
  }

  private async updateBookingInventoryStatus(
    booking: Record<string, unknown>,
    status: 'OCCUPIED' | 'VACANT_DIRTY',
    now: string,
  ) {
    const snapshot =
      booking['price_snapshot'] &&
      typeof booking['price_snapshot'] === 'object' &&
      !Array.isArray(booking['price_snapshot'])
        ? (booking['price_snapshot'] as Record<string, unknown>)
        : {};
    const bedId = this.optionalString(snapshot['bed_id']);
    if (bedId) {
      await this.pg.query(
        `UPDATE room_beds SET status = $1, updated_at = $2 WHERE id = $3::uuid`,
        [status, now, bedId],
      );
      return;
    }

    const roomId = this.optionalString(snapshot['room_id']);
    if (roomId) {
      await this.pg.query(
        `UPDATE hotel_rooms
         SET housekeeping_status = $1, updated_at = $2
         WHERE id = $3::uuid`,
        [status, now, roomId],
      );
      return;
    }

    const hotelId = this.optionalString(booking['hotel_id']);
    const roomNumber = this.optionalString(
      snapshot['room_number'] ?? booking['room_number'],
    );
    if (hotelId && roomNumber) {
      await this.pg.query(
        `UPDATE hotel_rooms
         SET housekeeping_status = $1, updated_at = $2
         WHERE hotel_id = $3::uuid AND code = $4`,
        [status, now, hotelId, roomNumber],
      );
    }
  }

  private partnerType(
    value: unknown,
  ):
    | 'hotel'
    | 'bus'
    | 'hostel'
    | 'guesthouse'
    | 'motel'
    | 'dacha'
    | 'restaurant'
    | 'mixed' {
    const type = String(value ?? 'hotel').toLowerCase();
    if (
      type === 'hotel' ||
      type === 'bus' ||
      type === 'hostel' ||
      type === 'guesthouse' ||
      type === 'motel' ||
      type === 'dacha' ||
      type === 'restaurant' ||
      type === 'mixed'
    ) {
      return type;
    }
    return 'hotel';
  }

  private slugify(value: string): string {
    const slug = value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    if (!slug) {
      throw new BadRequestException({
        code: 'ROOM_TYPE_CODE_REQUIRED',
        message: 'Xona turi kodi hosil qilinmadi',
      });
    }
    return slug;
  }

  private publicStatus(value: unknown): PublicPartnerStatus {
    const status = String(value ?? '').toLowerCase();
    if (status === 'approved') {
      return 'approved';
    }
    if (status === 'rejected') {
      return 'rejected';
    }
    if (status === 'blocked') {
      return 'blocked';
    }
    if (status === 'suspended') {
      return 'suspended';
    }
    if (status === 'under_review' || status === 'submitted') {
      return 'reviewing';
    }
    return 'new';
  }

  private publicPartnerRequestDto(row: Record<string, unknown>) {
    return {
      id: String(row['id']),
      organizationId: String(row['id']),
      companyName: String(row['brand_name'] ?? row['legal_name'] ?? 'Hamkor'),
      contactPerson: String(
        row['contact_person'] ??
          row['legal_name'] ??
          row['brand_name'] ??
          'Masul shaxs',
      ),
      phone: String(row['phone'] ?? ''),
      email: String(row['email'] ?? ''),
      city: String(row['city'] ?? row['city_id'] ?? ''),
      address: String(row['address'] ?? ''),
      taxId: row['tax_id'] ? String(row['tax_id']) : undefined,
      type: String(row['type'] ?? 'hotel'),
      status: this.publicStatus(row['status']),
      rejectionReason: row['rejection_reason']
        ? String(row['rejection_reason'])
        : undefined,
      createdAt: String(row['created_at'] ?? ''),
      updatedAt: String(row['updated_at'] ?? ''),
    };
  }

  private async hydratePartnerHotels(rows: Array<Record<string, unknown>>) {
    if (rows.length === 0) {
      return [];
    }

    const ids = rows.map((row) => String(row['id']));
    const cityIds = [
      ...new Set(
        rows.map((row) => String(row['city_id'] ?? '').trim()).filter(Boolean),
      ),
    ];
    const [translations, images, amenities, cities] = await Promise.all([
      this.pg.query<{
        hotel_id: string;
        language: string;
        name: string | null;
        short_description: string | null;
        description: string | null;
      }>(
        `SELECT hotel_id::text, language::text, name, short_description, description
         FROM hotel_translations
         WHERE hotel_id = ANY($1::uuid[])`,
        [ids],
      ),
      this.pg.query<{
        id: string;
        owner_id: string;
        url: string;
        caption: string | null;
        category: string | null;
        sort_order: number;
        is_cover: boolean;
      }>(
        `SELECT id::text, owner_id::text, url, caption, category, sort_order, is_cover
         FROM media_files
         WHERE owner_type = 'hotel'
           AND owner_id = ANY($1::uuid[])
           AND deleted_at IS NULL
           AND url IS NOT NULL
         ORDER BY sort_order ASC, created_at ASC`,
        [ids],
      ),
      this.pg.query<{ hotel_id: string; code: string }>(
        `SELECT ha.hotel_id::text, a.code
         FROM hotel_amenities ha
         JOIN amenities a ON a.id = ha.amenity_id
         WHERE ha.hotel_id = ANY($1::uuid[])`,
        [ids],
      ),
      cityIds.length > 0
        ? this.pg.query<{ id: string; name: Record<string, string> }>(
            `SELECT id::text, name
             FROM cities
             WHERE id = ANY($1::uuid[])`,
            [cityIds],
          )
        : Promise.resolve([]),
    ]);

    const nameMap = new Map<string, Record<string, string>>();
    const shortDescriptionMap = new Map<string, Record<string, string>>();
    const descriptionMap = new Map<string, Record<string, string>>();
    const imageUrlMap = new Map<string, string[]>();
    const imageIdMap = new Map<string, string[]>();
    const amenityMap = new Map<string, string[]>();
    const cityMap = new Map<string, Record<string, string>>();

    for (const row of translations) {
      const names = nameMap.get(row.hotel_id) ?? {};
      const shortDescriptions = shortDescriptionMap.get(row.hotel_id) ?? {};
      const descriptions = descriptionMap.get(row.hotel_id) ?? {};
      if (row.name) names[row.language] = row.name;
      if (row.short_description) {
        shortDescriptions[row.language] = row.short_description;
      }
      if (row.description) descriptions[row.language] = row.description;
      nameMap.set(row.hotel_id, names);
      shortDescriptionMap.set(row.hotel_id, shortDescriptions);
      descriptionMap.set(row.hotel_id, descriptions);
    }

    for (const row of images) {
      const urls = imageUrlMap.get(row.owner_id) ?? [];
      const imageIds = imageIdMap.get(row.owner_id) ?? [];
      urls.push(row.url);
      imageIds.push(row.id);
      imageUrlMap.set(row.owner_id, urls);
      imageIdMap.set(row.owner_id, imageIds);
    }

    for (const row of amenities) {
      const codesForHotel = amenityMap.get(row.hotel_id) ?? [];
      codesForHotel.push(row.code);
      amenityMap.set(row.hotel_id, codesForHotel);
    }

    for (const row of cities) {
      cityMap.set(row.id, row.name);
    }

    return rows.map((row) => {
      const id = String(row['id']);
      const cityId = String(row['city_id'] ?? '');
      const cityName = localizedTextFromMap(cityMap.get(cityId), '');
      return {
        ...row,
        id,
        partner_organization_id: String(row['partner_organization_id'] ?? ''),
        city_id: cityId,
        city: cityName,
        latitude:
          row['latitude'] === null || row['latitude'] === undefined
            ? null
            : Number(row['latitude']),
        longitude:
          row['longitude'] === null || row['longitude'] === undefined
            ? null
            : Number(row['longitude']),
        stars: Number(row['stars'] ?? 0),
        rating_average: Number(row['rating_average'] ?? 0),
        reviews_count: Number(row['reviews_count'] ?? 0),
        name: localizedTextFromMap(
          nameMap.get(id),
          row['status'] === 'draft' ? '' : String(row['slug'] ?? 'Mehmonxona'),
        ),
        description: localizedTextFromMap(descriptionMap.get(id), ''),
        short_description: localizedTextFromMap(
          shortDescriptionMap.get(id),
          '',
        ),
        amenities: amenityMap.get(id) ?? [],
        images: imageUrlMap.get(id) ?? [],
        image_ids: imageIdMap.get(id) ?? [],
        rules_completed_at: row['rules_completed_at'] ?? null,
        cancellation_policy_code: String(
          row['cancellation_policy_code'] ?? 'MODERATE',
        ),
        smoking_allowed: Boolean(row['smoking_allowed'] ?? false),
        pets_allowed: Boolean(row['pets_allowed'] ?? false),
        children_allowed: Boolean(row['children_allowed'] ?? true),
        extra_fees: row['extra_fees'] ?? [],
        nearby_places: row['nearby_places'] ?? [],
      };
    });
  }

  private async touchHotel(id: string, date = new Date().toISOString()) {
    await this.pg.query(
      `UPDATE hotels SET
         updated_at = $1,
         status = CASE WHEN status = 'published' THEN 'pending_review'::"HotelStatus" ELSE status END,
         submitted_at = CASE WHEN status = 'published' THEN $1 ELSE submitted_at END
       WHERE id = $2`,
      [date, id],
    );
  }

  private notifyListingChanged(
    hotel: Record<string, unknown>,
    actor: RequestActor | undefined,
    action: 'updated' | 'submitted',
    sections: string[],
  ) {
    const hotelId = String(hotel['id'] ?? '');
    if (!hotelId || !this.events) return;
    const partnerId = hotel['partner_organization_id'] ?? actor?.organizationId;
    this.events.hotelListingChanged({
      hotelId,
      partnerId: partnerId ? String(partnerId) : null,
      status: String(hotel['status'] ?? 'pending_review'),
      action,
      sections,
    });
    if (action === 'submitted') {
      this.events.adminDashboardUpdated();
    }
  }

  private async resolveCityId(value: unknown): Promise<string> {
    const city = String(value ?? '').trim();
    if (!city) {
      throw new BadRequestException({
        code: 'CITY_REQUIRED',
        message: 'Shahar tanlanishi kerak',
      });
    }

    const rows = await this.pg.query<{ id: string }>(
      `
        select id::text
        from cities
        where id::text = $1
           or lower(name ->> 'uz') = lower($1)
           or lower(name ->> 'ru') = lower($1)
           or lower(name ->> 'en') = lower($1)
           or lower(name::text) like '%' || lower($1) || '%'
        order by created_at asc
        limit 1
      `,
      [city],
    );

    if (!rows[0]) {
      throw new BadRequestException({
        code: 'CITY_NOT_FOUND',
        message: 'Shahar topilmadi',
      });
    }

    return rows[0].id;
  }

  private async resolvePublicCityId(
    value: unknown,
    context: string[] = [],
  ): Promise<string> {
    try {
      return await this.resolveCityId(value);
    } catch (error) {
      const city = String(value ?? '').trim();
      if (!city || !isCityNotFound(error)) {
        throw error;
      }
      return this.createPublicCity(city, context);
    }
  }

  private async createPublicCity(
    city: string,
    context: string[],
  ): Promise<string> {
    const now = new Date().toISOString();
    const regionId = await this.resolveRegionIdForPublicCity(city, context);
    const id = randomUUID();
    const slug = `${slugifyLoose(city)}-${id.slice(0, 8)}`;
    const name = localizedTextFromMap({ uz: city, ru: city, en: city }, city);
    const [created] = await this.pg.query<{ id: string }>(
      `INSERT INTO cities (id, region_id, name, slug, image_url, sort_order, created_at, updated_at)
       VALUES ($1, $2, $3::jsonb, $4, NULL, 9999, $5, $5)
       RETURNING id::text`,
      [id, regionId, JSON.stringify(name), slug, now],
    );
    return created.id;
  }

  private async resolveRegionIdForPublicCity(
    city: string,
    context: string[],
  ): Promise<string> {
    const probe = [city, ...context].join(' ').trim();
    const matchingRegions = await this.pg.query<{ id: string }>(
      `SELECT id::text
       FROM regions
       WHERE lower($1) LIKE '%' || lower(name ->> 'uz') || '%'
          OR lower($1) LIKE '%' || lower(name ->> 'ru') || '%'
          OR lower($1) LIKE '%' || lower(name ->> 'en') || '%'
          OR lower(name::text) LIKE '%' || lower($1) || '%'
       ORDER BY created_at ASC
       LIMIT 1`,
      [probe],
    );
    if (matchingRegions[0]) {
      return matchingRegions[0].id;
    }

    const fallbackRegions = await this.pg.query<{ id: string }>(
      `SELECT id::text FROM regions ORDER BY created_at ASC LIMIT 1`,
    );
    if (fallbackRegions[0]) {
      return fallbackRegions[0].id;
    }

    throw new BadRequestException({
      code: 'REGION_NOT_FOUND',
      message: 'Region topilmadi',
    });
  }

  private async assertOrganization(id: string) {
    const organizations = await this.pg.query(
      `SELECT * FROM partner_organizations WHERE id = $1`,
      [id],
    );
    if (!organizations[0]) {
      throw new NotFoundException({
        code: 'PARTNER_NOT_ACTIVE',
        message: 'Partner topilmadi',
      });
    }
    return organizations[0];
  }

  private async assertListingSubmissionReady(
    actor: RequestActor | undefined,
    id: string,
  ) {
    const hotel = await this.assertHotel(id, actor);
    const [translations, media, amenities, rooms, partnerRows] =
      await Promise.all([
        this.pg.query<{
          name: string | null;
          short_description: string | null;
          description: string | null;
        }>(
          `SELECT name, short_description, description
           FROM hotel_translations
           WHERE hotel_id = $1::uuid`,
          [id],
        ),
        this.pg.query<{ count: number }>(
          `SELECT count(*)::int AS count
           FROM media_files
           WHERE owner_type = 'hotel'
             AND owner_id = $1::uuid
             AND deleted_at IS NULL
             AND url IS NOT NULL`,
          [id],
        ),
        this.pg.query<{ count: number }>(
          `SELECT count(*)::int AS count
           FROM hotel_amenities
           WHERE hotel_id = $1::uuid`,
          [id],
        ),
        this.pg.query<{ count: number }>(
          `SELECT count(*)::int AS count
           FROM hotel_rooms
           WHERE hotel_id = $1::uuid
             AND status = 'active'`,
          [id],
        ),
        this.pg.query<{ type: string }>(
          `SELECT type::text
           FROM partner_organizations
           WHERE id = $1::uuid`,
          [String(hotel['partner_organization_id'])],
        ),
      ]);
    const isRestaurant =
      String(partnerRows[0]?.type ?? '').toLowerCase() === 'restaurant';

    const hasName = translations.some(
      (row) => (row.name ?? '').trim().length >= 3,
    );
    const hasShortDescription = translations.some(
      (row) => (row.short_description ?? '').trim().length >= 20,
    );
    const hasFullDescription = translations.some(
      (row) => (row.description ?? '').trim().length >= 100,
    );
    const hasLocation =
      String(hotel['address'] ?? '').trim().length > 0 &&
      hotel['latitude'] !== null &&
      hotel['latitude'] !== undefined &&
      hotel['longitude'] !== null &&
      hotel['longitude'] !== undefined;
    const hasRules = Boolean(
      hotel['rules_completed_at'] &&
      hotel['check_in_time'] &&
      hotel['check_out_time'],
    );

    const sections: Record<string, boolean> = {
      general: hasName && hasShortDescription && hasFullDescription,
      location: hasLocation,
      media: Number(media[0]?.count ?? 0) >= 3,
      amenities: Number(amenities[0]?.count ?? 0) >= 3,
      rules: hasRules,
    };
    if (!isRestaurant) {
      sections.rooms = Number(rooms[0]?.count ?? 0) > 0;
    }
    const missing = Object.entries(sections)
      .filter(([, complete]) => !complete)
      .map(([section]) => section);

    if (missing.length > 0) {
      throw new BadRequestException({
        code: 'HOTEL_INCOMPLETE',
        message: "E'lon to'liq to'ldirilmagan",
        fields: missing,
      });
    }

    return hotel;
  }

  private async assertHotel(id: string, actor?: RequestActor) {
    const hotels = await this.pg.query(`SELECT * FROM hotels WHERE id = $1`, [
      id,
    ]);
    if (!hotels[0]) {
      throw new NotFoundException({
        code: 'HOTEL_NOT_FOUND',
        message: 'Hotel topilmadi',
      });
    }

    if (
      actor &&
      hotels[0]['partner_organization_id'] !== this.organizationId(actor)
    ) {
      throw new ForbiddenException({
        code: 'HOTEL_FORBIDDEN',
        message: 'Bu hotel sizning tashkilotingizga tegishli emas',
      });
    }

    return hotels[0];
  }

  private async assertWebhook(actor: RequestActor | undefined, id: string) {
    const organizationId = this.organizationId(actor);
    const webhooks = await this.pg.query(
      `SELECT * FROM partner_webhook_endpoints WHERE id = $1 AND organization_id = $2`,
      [id, organizationId],
    );
    if (!webhooks[0]) {
      throw new NotFoundException({
        code: 'WEBHOOK_NOT_FOUND',
        message: 'Webhook topilmadi',
      });
    }
    return webhooks[0];
  }

  private paginatePartner<T extends object>(
    items: readonly T[],
    query: QueryLike,
  ) {
    const pagination = parsePagination(query, 'partner', {
      defaultLimit: 50,
      allowedSortBy: ['created_at', 'updated_at', 'status', 'total_amount'],
    });
    return paginateArray(items, pagination, {
      created_at: (item) => field(item, 'created_at'),
      updated_at: (item) => field(item, 'updated_at'),
      status: (item) => field(item, 'status'),
      total_amount: (item) => field(item, 'total_amount'),
    });
  }

  private publicApiKey(apiKey: Record<string, unknown>) {
    return {
      id: apiKey['id'],
      organization_id: apiKey['organization_id'],
      name: apiKey['name'],
      key_prefix: apiKey['key_prefix'],
      scopes: apiKey['scopes'],
      status: apiKey['status'],
      created_at: apiKey['created_at'],
      updated_at: apiKey['updated_at'],
      revoked_at: apiKey['revoked_at'],
    };
  }
}

function field(item: object, key: string): unknown {
  return (item as Record<string, unknown>)[key];
}

function localizedTextFromMap(
  value: Record<string, string> | undefined,
  fallback: string,
) {
  return {
    uz: value?.uz ?? fallback,
    ru: value?.ru ?? value?.uz ?? fallback,
    en: value?.en ?? value?.uz ?? fallback,
  };
}

function isCityNotFound(error: unknown): boolean {
  if (!(error instanceof BadRequestException)) {
    return false;
  }

  const response = error.getResponse();
  if (!response || typeof response !== 'object') {
    return false;
  }

  return (response as { code?: unknown }).code === 'CITY_NOT_FOUND';
}

function slugifyLoose(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'city';
}
