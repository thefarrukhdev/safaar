import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { RequestActor } from '../common/actor';
import {
  parsePagination,
  limitOffsetSql,
  type QueryLike,
} from '../common/pagination';
import { PostgresService } from '../infrastructure/postgres.service';
import { JobQueueService } from '../infrastructure/job-queue.service';
import { UploadsService, type UploadedFile } from '../uploads/uploads.service';
import type { SetAvatarDto, UpdateProfileDto } from './dto/user.dto';

type UserRow = Record<string, unknown>;

export interface PublicUserProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  status: string;
  preferred_language: string;
  blocked_reason: string | null;
  phone_verified_at: string | null;
  email_verified_at: string | null;
  last_login_at: string | null;
  avatar_media_id: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  bonus_balance: number;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly pg: PostgresService,
    private readonly jobs: JobQueueService,
    private readonly uploads: UploadsService,
  ) {}

  private requireActor(actor: RequestActor | undefined): RequestActor {
    if (!actor) {
      throw new UnauthorizedException({
        code: 'AUTH_TOKEN_INVALID',
        message: 'Sessiya topilmadi yoki token yaroqsiz',
      });
    }
    return actor;
  }

  async profile(actor: RequestActor | undefined) {
    const currentActor = this.requireActor(actor);
    return this.publicUser(await this.assertUser(currentActor.id));
  }

  async updateProfile(actor: RequestActor | undefined, body: UpdateProfileDto) {
    const currentActor = this.requireActor(actor);
    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (body.first_name !== undefined) {
      sets.push(`first_name = $${idx++}`);
      params.push(String(body.first_name));
    }
    if (body.last_name !== undefined) {
      sets.push(`last_name = $${idx++}`);
      params.push(String(body.last_name));
    }
    if (body.email !== undefined) {
      sets.push(`email = $${idx++}`);
      params.push(String(body.email).toLowerCase());
    }
    sets.push(`updated_at = $${idx++}`);
    params.push(new Date().toISOString());
    params.push(currentActor.id);

    const sql = `
      UPDATE users
      SET ${sets.join(', ')}
      WHERE id = $${idx} AND deleted_at IS NULL
      RETURNING ${publicUserColumns()}
    `;
    const [user] = await this.pg.query(sql, params);

    if (!user) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'User topilmadi',
      });
    }

    return this.publicUser(user);
  }

  async setAvatar(
    actor: RequestActor | undefined,
    body: SetAvatarDto,
    file?: UploadedFile,
  ) {
    const currentActor = this.requireActor(actor);

    // web-user yuboradigan haqiqiy oqim: `POST /me/avatar`ga to'g'ridan-
    // to'g'ri multipart fayl (`FormData`, "file" maydoni) — oldindan
    // `POST /uploads/images` orqali alohida yuklab, natijada olingan
    // `media_id`ni yubormaydi. Bu yerda FileInterceptor bo'lmagani va
    // haqiqiy faylni hech qachon saqlamaganimiz uchun `body.media_id` doim
    // bo'sh bo'lardi va DARHOL "MEDIA_NOT_FOUND" bilan tugardi — fayl
    // hech qachon media_files'ga tushmasdi. Endi haqiqiy fayl bo'lsa,
    // uni `UploadsService`ning bir xil tekshiruv/saqlash yo'li orqali
    // (owner_type/owner_id = joriy actor) yozamiz — alohida "yuklab, keyin
    // biriktirish" ikki bosqichli JSON oqimi (`media_id`) ham, agar
    // kelajakda boshqa client shundan foydalansa, ishlashda davom etadi.
    let mediaId: string;
    if (file) {
      const media = await this.uploads.create(actor, 'image', {}, file);
      mediaId = String((media as { id: string }).id);
    } else {
      mediaId = String(body.media_id ?? body.mediaId ?? '').trim();
      if (!mediaId) {
        throw new NotFoundException({
          code: 'MEDIA_NOT_FOUND',
          message: 'Avatar media fayli topilmadi',
        });
      }

      const [media] = await this.pg.query(
        `SELECT id::text
         FROM media_files
         WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL
         LIMIT 1`,
        [mediaId, currentActor.id],
      );
      if (!media) {
        throw new NotFoundException({
          code: 'MEDIA_NOT_FOUND',
          message: 'Avatar media fayli topilmadi',
        });
      }
    }

    const [user] = await this.pg.query(
      `UPDATE users
       SET avatar_media_id = $1, updated_at = $2
       WHERE id = $3 AND deleted_at IS NULL
       RETURNING ${publicUserColumns()}`,
      [mediaId, new Date().toISOString(), currentActor.id],
    );
    return this.publicUser(user);
  }

  async deleteAvatar(actor: RequestActor | undefined) {
    const currentActor = this.requireActor(actor);
    const [user] = await this.pg.query(
      `UPDATE users
       SET avatar_media_id = NULL, updated_at = $1
       WHERE id = $2 AND deleted_at IS NULL
       RETURNING ${publicUserColumns()}`,
      [new Date().toISOString(), currentActor.id],
    );
    return this.publicUser(user);
  }

  async bookings(actor: RequestActor | undefined, query: QueryLike = {}) {
    const currentActor = this.requireActor(actor);
    const pagination = parsePagination(query, 'public', {
      defaultLimit: 20,
      allowedSortBy: ['created_at', 'updated_at', 'status'],
    });
    const orderDir = pagination.order === 'asc' ? 'ASC' : 'DESC';
    const allowedSort = ['created_at', 'updated_at', 'status'];
    const sortCol = allowedSort.includes(pagination.sortBy)
      ? pagination.sortBy
      : 'created_at';

    const sql = `
      SELECT b.*
      FROM bookings b
      JOIN users u ON u.id = $1 AND u.deleted_at IS NULL
      WHERE b.user_id = $1
         OR (
           b.user_id IS NULL
           AND (
             (
               NULLIF(regexp_replace(COALESCE(u.phone, ''), '[^0-9]', '', 'g'), '') IS NOT NULL
               AND regexp_replace(COALESCE(b.guest_phone, ''), '[^0-9]', '', 'g') =
                   regexp_replace(COALESCE(u.phone, ''), '[^0-9]', '', 'g')
             )
             OR
             (
               NULLIF(lower(btrim(COALESCE(u.email, ''))), '') IS NOT NULL
               AND lower(btrim(COALESCE(b.guest_email, ''))) =
                   lower(btrim(COALESCE(u.email, '')))
             )
           )
         )
      ORDER BY b.${sortCol} ${orderDir}
      ${limitOffsetSql(pagination)}
    `;
    return this.pg.query(sql, [currentActor.id]);
  }

  async booking(actor: RequestActor | undefined, id: string) {
    const currentActor = this.requireActor(actor);
    const [booking] = await this.pg.query(
      `SELECT b.*
       FROM bookings b
       JOIN users u ON u.id = $1 AND u.deleted_at IS NULL
       WHERE b.id = $2
         AND (
           b.user_id = $1
           OR (
             b.user_id IS NULL
             AND (
               (
                 NULLIF(regexp_replace(COALESCE(u.phone, ''), '[^0-9]', '', 'g'), '') IS NOT NULL
                 AND regexp_replace(COALESCE(b.guest_phone, ''), '[^0-9]', '', 'g') =
                     regexp_replace(COALESCE(u.phone, ''), '[^0-9]', '', 'g')
               )
               OR
               (
                 NULLIF(lower(btrim(COALESCE(u.email, ''))), '') IS NOT NULL
                 AND lower(btrim(COALESCE(b.guest_email, ''))) =
                     lower(btrim(COALESCE(u.email, '')))
               )
             )
           )
         )`,
      [currentActor.id, id],
    );

    if (!booking) {
      throw new NotFoundException({
        code: 'BOOKING_EXPIRED',
        message: 'Bron topilmadi',
      });
    }

    return booking;
  }

  async bonuses(actor: RequestActor | undefined) {
    const currentActor = this.requireActor(actor);
    const [user] = await this.pg.query<{ bonus_balance: string | number }>(
      `SELECT bonus_balance::float8
       FROM users
       WHERE id = $1 AND deleted_at IS NULL
       LIMIT 1`,
      [currentActor.id],
    );
    if (!user) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'User topilmadi',
      });
    }

    const ledger = await this.pg.query(
      `SELECT id::text, amount::float8, reason, created_at
       FROM user_bonus_ledger
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 100`,
      [currentActor.id],
    );
    return {
      balance: Number(user.bonus_balance ?? 0),
      currency: 'UZS',
      ledger,
    };
  }

  async favorites(actor: RequestActor | undefined, query: QueryLike = {}) {
    const currentActor = this.requireActor(actor);
    const pagination = parsePagination(query, 'public', {
      defaultLimit: 20,
      allowedSortBy: ['created_at'],
    });
    const orderDir = pagination.order === 'asc' ? 'ASC' : 'DESC';

    const sql = `SELECT * FROM favorites WHERE user_id = $1 ORDER BY created_at ${orderDir} ${limitOffsetSql(pagination)}`;
    return this.pg.query(sql, [currentActor.id]);
  }

  async addFavorite(
    actor: RequestActor | undefined,
    body: Record<string, unknown>,
  ) {
    const currentActor = this.requireActor(actor);
    const id = randomUUID();
    const targetType = String(body.target_type ?? 'hotel');
    const targetId = String(body.target_id ?? body.hotel_id ?? '');
    const createdAt = new Date().toISOString();

    // `(user_id, target_type, target_id)` unique — ikkinchi marta bosish
    // (masalan stale client holati tufayli) avvalgi kod bilan xom 23505
    // unique-violation'ga, demak umumiy 500'ga olib kelardi. Endi
    // idempotent: mavjud qatorni ("no-op" UPDATE) qaytaradi, yangisini
    // yaratmaydi — client doim bitta barqaror favorite id oladi.
    const [favorite] = await this.pg.query<{
      id: string;
      user_id: string;
      target_type: string;
      target_id: string;
      created_at: string;
    }>(
      `INSERT INTO favorites (id, user_id, target_type, target_id, created_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, target_type, target_id) DO UPDATE
         SET target_type = EXCLUDED.target_type
       RETURNING id, user_id, target_type, target_id, created_at`,
      [id, currentActor.id, targetType, targetId, createdAt],
    );

    return favorite;
  }

  async deleteFavorite(actor: RequestActor | undefined, id: string) {
    const currentActor = this.requireActor(actor);
    const rows = await this.pg.query<{ id: string }>(
      'DELETE FROM favorites WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, currentActor.id],
    );
    if (rows.length === 0) {
      throw new NotFoundException({
        code: 'FAVORITE_NOT_FOUND',
        message: 'Sevimli topilmadi',
      });
    }
    return { id, user_id: currentActor.id, deleted: true };
  }

  async notificationPreferences(actor: RequestActor | undefined) {
    const currentActor = this.requireActor(actor);
    const [preferences] = await this.pg.query<Record<string, boolean>>(
      `SELECT sms, email, push, in_app
       FROM user_notification_preferences
       WHERE user_id = $1`,
      [currentActor.id],
    );
    return (
      preferences ?? {
        sms: true,
        email: true,
        push: true,
        in_app: true,
      }
    );
  }

  async updateNotificationPreferences(
    actor: RequestActor | undefined,
    body: Record<string, unknown>,
  ) {
    const currentActor = this.requireActor(actor);
    const preferences = {
      sms: Boolean(body.sms ?? true),
      email: Boolean(body.email ?? true),
      push: Boolean(body.push ?? true),
      in_app: Boolean(body.in_app ?? true),
    };
    const [updated] = await this.pg.query<Record<string, boolean>>(
      `INSERT INTO user_notification_preferences (user_id, sms, email, push, in_app, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id) DO UPDATE
       SET sms = EXCLUDED.sms,
           email = EXCLUDED.email,
           push = EXCLUDED.push,
           in_app = EXCLUDED.in_app,
           updated_at = EXCLUDED.updated_at
       RETURNING sms, email, push, in_app`,
      [
        currentActor.id,
        preferences.sms,
        preferences.email,
        preferences.push,
        preferences.in_app,
        new Date().toISOString(),
      ],
    );
    return updated ?? preferences;
  }

  async dataExport(actor: RequestActor | undefined) {
    const currentActor = this.requireActor(actor);
    const now = new Date().toISOString();
    const job = {
      id: randomUUID(),
      owner_id: currentActor.id,
      type: 'personal-data',
      format: 'json',
      status: 'queued',
      created_at: now,
      updated_at: now,
    };
    // Bir xil foydalanuvchi uchun parallel/takroriy so'rovlar cheksiz
    // "queued" duplikat qator yaratavermasligi uchun — DB'dagi qisman
    // UNIQUE indeks (faqat queued/processing statusiga) ON CONFLICT
    // orqali hurmat qilinadi.
    const inserted = await this.pg.query(
      `INSERT INTO export_jobs
         (id, owner_type, owner_id, type, format, status, created_at, updated_at)
       VALUES ($1, 'user', $2, $3, $4, $5, $6, $7)
       ON CONFLICT (owner_type, owner_id, type, format) WHERE status IN ('queued', 'processing')
       DO NOTHING
       RETURNING id`,
      [
        job.id,
        job.owner_id,
        job.type,
        job.format,
        job.status,
        job.created_at,
        job.updated_at,
      ],
    );
    if (inserted.length === 0) {
      const [existing] = await this.pg.query(
        `SELECT * FROM export_jobs
         WHERE owner_type = 'user' AND owner_id = $1 AND type = $2 AND format = $3
           AND status IN ('queued', 'processing')
         ORDER BY created_at DESC LIMIT 1`,
        [job.owner_id, job.type, job.format],
      );
      return existing;
    }

    await this.jobs.add(
      'user-data-export',
      { export_id: job.id, user_id: currentActor.id },
      { idempotencyKey: `user-data-export:${currentActor.id}` },
    );
    return job;
  }

  async deleteRequest(actor: RequestActor | undefined) {
    const currentActor = this.requireActor(actor);
    const now = new Date().toISOString();
    const [existing] = await this.pg.query(
      `SELECT id::text, user_id::text, status, created_at, resolved_at
       FROM user_deletion_requests
       WHERE user_id = $1 AND status = 'requested'
       ORDER BY created_at DESC
       LIMIT 1`,
      [currentActor.id],
    );
    if (existing) {
      return existing;
    }

    const [request] = await this.pg.query(
      `INSERT INTO user_deletion_requests (id, user_id, status, created_at)
       VALUES ($1, $2, 'requested', $3)
       RETURNING id::text, user_id::text, status, created_at, resolved_at`,
      [randomUUID(), currentActor.id, now],
    );
    return request;
  }

  private async assertUser(id: string) {
    const [user] = await this.pg.query(
      `
        SELECT ${publicUserColumns()}
        FROM users
        WHERE id = $1 AND deleted_at IS NULL
      `,
      [id],
    );

    if (!user) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'User topilmadi',
      });
    }

    return user;
  }

  private publicUser(row: UserRow): PublicUserProfile {
    return {
      id: String(row['id']),
      first_name: nullableString(row['first_name']),
      last_name: nullableString(row['last_name']),
      phone: nullableString(row['phone']),
      email: nullableString(row['email']),
      status: String(row['status']),
      preferred_language: String(row['preferred_language']),
      blocked_reason: nullableString(row['blocked_reason']),
      phone_verified_at: nullableString(row['phone_verified_at']),
      email_verified_at: nullableString(row['email_verified_at']),
      last_login_at: nullableString(row['last_login_at']),
      avatar_media_id: nullableString(row['avatar_media_id']),
      avatar_url: nullableString(row['avatar_url']),
      created_at: String(row['created_at']),
      updated_at: String(row['updated_at']),
      deleted_at: nullableString(row['deleted_at']),
      bonus_balance: Number(row['bonus_balance'] ?? 0),
    };
  }
}

function publicUserColumns(): string {
  return `
    id::text,
    first_name,
    last_name,
    phone,
    email,
    status::text,
    preferred_language::text,
    blocked_reason,
    phone_verified_at,
    email_verified_at,
    last_login_at,
    avatar_media_id::text,
    (SELECT url FROM media_files
       WHERE media_files.id = users.avatar_media_id
         AND media_files.deleted_at IS NULL) AS avatar_url,
    created_at,
    updated_at,
    deleted_at,
    bonus_balance::float8
  `;
}

function nullableString(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value);
}
