import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@safaar/types';
import { PostgresService } from '../infrastructure/postgres.service';
import { authSessionStore } from '../auth/session-store';
import { PERMISSIONS_KEY } from './permissions.decorator';
import { actorHasPermissions } from './permissions';
import { ROLES_KEY } from './roles.decorator';
import {
  buildActorFromHeaders,
  type RequestActor,
  type RequestWithActor,
} from './actor';

type HttpRequestWithActor = RequestWithActor & {
  method?: string;
  originalUrl?: string;
  url?: string;
};

const LIMITED_PARTNER_STATUSES = new Set(['blocked', 'suspended']);

/**
 * Ixtisoslashgan admin sub-rollari — har biri `rolePermissions`da faqat
 * o'z tor doirasiga mos ruxsatlarga ega (masalan CONTENT_ADMIN faqat
 * CMS'ga). `Role.ADMIN` va `Role.SUPER_ADMIN` bunga kirmaydi — ular
 * tizimda "keng/to'liq" tasdiqlangan darajalar (`Role.ADMIN`ning o'zi
 * `rolePermissions`da ko'plab keng o'qish huquqiga ega).
 */
const NARROW_ADMIN_ROLES: readonly Role[] = [
  Role.FINANCE_ADMIN,
  Role.CONTENT_ADMIN,
  Role.SUPPORT_ADMIN,
  Role.MODERATOR,
];

/**
 * Rol asosidagi himoya (RBAC).
 *
 * Rol va permission asosidagi himoya (RBAC).
 * Real JWT access token asosiy manba.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly pg: PostgresService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    const authRequired =
      Boolean(requiredRoles?.length) || Boolean(requiredPermissions?.length);

    const request = context.switchToHttp().getRequest<HttpRequestWithActor>();
    const authorizationHeader = Array.isArray(request.headers.authorization)
      ? request.headers.authorization[0]
      : request.headers.authorization;
    const presentedAuthorization = Boolean(authorizationHeader?.trim());
    const resolved = request.user ?? buildActorFromHeaders(request.headers);

    if (!authRequired) {
      // Auth ixtiyoriy marshrut (masalan guest checkout — @Roles() qo'yilmagan
      // POST /bookings/hotel). Avval bunday marshrutlarda `request.user`
      // UMUMAN to'ldirilmas edi, chunki shu yerdan darhol `true` bilan
      // qaytilardi — natijada login qilgan mijoz ham bron yaratganda
      // `CurrentActor()` doim `undefined` ko'rar, bron `user_id`si NULL
      // yozilardi. Endi token bo'lsa (va yaroqli/faol bo'lsa) actor
      // baribir aniqlanadi va `request.user`ga biriktiriladi — lekin bu
      // marshrutda auth SHART emasligi sababli token YO'QLIGI guest sifatida
      // davom etadi. Lekin client Authorization header yuborgan bo'lsa, uni
      // jim tashlab guestga aylantirish mumkin emas: revoked/bloklangan token
      // bilan yuborilgan authenticated niyat boshqa user_id ostida bron
      // yaratib qo'yishi mumkin.
      if (resolved) {
        await this.assertSessionActive(resolved);
        await this.assertActorAllowed(resolved, request);
        request.user = resolved;
      } else if (presentedAuthorization) {
        throw new UnauthorizedException({
          code: 'AUTH_TOKEN_INVALID',
          message: 'Sessiya topilmadi yoki token yaroqsiz',
        });
      }
      return true;
    }

    if (!resolved) {
      throw new UnauthorizedException({
        code: 'AUTH_TOKEN_INVALID',
        message: 'Sessiya topilmadi yoki token yaroqsiz',
      });
    }

    request.user = resolved;

    await this.assertSessionActive(resolved);
    await this.assertActorAllowed(resolved, request);

    if (requiredRoles?.length && !hasRole(resolved, requiredRoles)) {
      throw new ForbiddenException('Bu amal uchun ruxsatingiz yoq.');
    }

    // DENY-BY-DEFAULT (root cause fix): `hasRole()` yuqorida `Role.ADMIN`
    // talab qilingan marshrutlarga har qanday admin-sub-rolini ("admin-
    // like role collapse") o'tkazib yuboradi — bu ataylab keng, chunki
    // ko'p marshrut shundan keyin `@Permissions()` orqali torayadi. Lekin
    // agar marshrutda `@Permissions()` UMUMAN bo'lmasa (`undefined` —
    // bo'sh massiv `[]`dan farqli, developer ataylab "hech qanday maxsus
    // ruxsat kerak emas" deb belgilashi mumkin), bu ilgari "hamma admin-
    // sub-role kira oladi" degani edi — xuddi shu bug tufayli CONTENT_ADMIN
    // moliya ma'lumotini ko'ra olardi. Endi bunday holatda ixtisoslashgan
    // sub-rollar avtomatik rad etiladi; faqat `Role.ADMIN`/`SUPER_ADMIN`
    // (tizimning "keng" darajalari) o'tadi. Marshrut biror sub-rolga
    // ataylab ochiq bo'lishi kerak bo'lsa — buni ANIQ `@Permissions()`
    // orqali belgilash kerak, sukut bo'yicha emas.
    if (
      requiredRoles?.length &&
      requiredRoles.includes(Role.ADMIN) &&
      requiredPermissions === undefined &&
      NARROW_ADMIN_ROLES.includes(resolved.role)
    ) {
      throw new ForbiddenException({
        code: 'AUTH_PERMISSION_DENIED',
        message: 'Bu amal uchun permission yetarli emas.',
      });
    }

    if (
      requiredPermissions?.length &&
      !actorHasPermissions(resolved, requiredPermissions)
    ) {
      throw new ForbiddenException({
        code: 'AUTH_PERMISSION_DENIED',
        message: 'Bu amal uchun permission yetarli emas.',
      });
    }

    return true;
  }

  private async assertSessionActive(actor: RequestActor) {
    if (!actor.sessionId) {
      return;
    }

    if (!(await authSessionStore.isActive(actor.sessionId))) {
      throw new UnauthorizedException({
        code: 'AUTH_SESSION_REVOKED',
        message: 'Sessiya bekor qilingan yoki muddati tugagan',
      });
    }
  }

  private async assertActorAllowed(
    actor: RequestActor,
    request: HttpRequestWithActor,
  ): Promise<void> {
    if (actor.actorType === 'user') {
      const rows = await this.pg.query<{ status: string }>(
        `SELECT status FROM users WHERE id = $1 LIMIT 1`,
        [actor.id],
      );

      if (rows.length > 0 && ['blocked', 'deleted'].includes(rows[0].status)) {
        throw new ForbiddenException({
          code: 'USER_BLOCKED',
          message: 'Foydalanuvchi bloklangan',
        });
      }
    }

    if (actor.actorType === 'partner') {
      if (!actor.organizationId) {
        throw new ForbiddenException({
          code: 'PARTNER_ORGANIZATION_REQUIRED',
          message: 'Partner tashkiloti aniqlanmadi',
        });
      }

      const rows = await this.pg.query<{ status: string }>(
        `SELECT status FROM partner_organizations WHERE id = $1 LIMIT 1`,
        [actor.organizationId],
      );

      const status = rows[0]?.status;
      if (!status || status === 'approved') {
        return;
      }

      if (
        LIMITED_PARTNER_STATUSES.has(status) &&
        this.isLimitedPartnerRouteAllowed(request)
      ) {
        return;
      }

      if (status === 'blocked') {
        throw new ForbiddenException({
          code: 'PARTNER_BLOCKED',
          message:
            'Hamkor access bloklangan. Faqat profil va yordam chatidan foydalanish mumkin.',
        });
      }

      if (status === 'suspended') {
        throw new ForbiddenException({
          code: 'PARTNER_SUSPENDED',
          message:
            "Hamkor access vaqtincha to'xtatilgan. Faqat profil va yordam chatidan foydalanish mumkin.",
        });
      }

      throw new ForbiddenException({
        code: 'PARTNER_NOT_ACTIVE',
        message: 'Hamkor tashkilot faol emas',
      });
    }
  }

  private isLimitedPartnerRouteAllowed(request: HttpRequestWithActor): boolean {
    const rawPath = String(request.originalUrl ?? request.url ?? '');
    const path = rawPath
      .split('?')[0]
      .replace(/^\/api\/backend/i, '')
      .replace(/^\/v\d+(?=\/)/i, '');

    return (
      path === '/partners/profile' ||
      path === '/partner/profile' ||
      path === '/partners/application/status' ||
      path === '/partner/application/status' ||
      path.startsWith('/support/tickets') ||
      path === '/auth/logout' ||
      path === '/auth/partner/logout' ||
      path === '/auth/sessions'
    );
  }
}

function hasRole(actor: RequestActor, requiredRoles: Role[]): boolean {
  if (actor.role === Role.SUPER_ADMIN) {
    return true;
  }

  if (requiredRoles.includes(actor.role)) {
    return true;
  }

  const adminLikeRoles = [
    Role.ADMIN,
    Role.FINANCE_ADMIN,
    Role.CONTENT_ADMIN,
    Role.SUPPORT_ADMIN,
    Role.MODERATOR,
  ];

  if (
    adminLikeRoles.includes(actor.role) &&
    requiredRoles.includes(Role.ADMIN)
  ) {
    return true;
  }

  return actor.roles.some((role) => requiredRoles.includes(role));
}
