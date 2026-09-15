import { Role } from '@safaar/types';
import type { RequestActor } from './actor';

export const Permission = {
  UsersRead: 'users:read',
  UsersWrite: 'users:write',
  PartnersRead: 'partners:read',
  PartnersWrite: 'partners:write',
  BookingsRead: 'bookings:read',
  BookingsWrite: 'bookings:write',
  FinanceRead: 'finance:read',
  FinanceWrite: 'finance:write',
  CmsRead: 'cms:read',
  CmsWrite: 'cms:write',
  SupportRead: 'support:read',
  SupportWrite: 'support:write',
  SettingsWrite: 'settings:write',
  AdminUsersWrite: 'admin-users:write',
  AuditLogsRead: 'audit-logs:read',
  // 2026-09-14 (SAFAAR ADMIN — 3 ta business logic gap) qo'shildi: mavjud
  // domen darajasidagi (`finance:*`, `cms:*`, ...) ruxsatlar YETARLI
  // GRANULAR EMAS edi — masalan CONTENT_ADMIN'ning `cms:write`i orqali
  // "reviews moderate qilish" va "SEO tahrirlash" ORASIDA HECH QANDAY
  // farq yo'q edi. Quyidagilar YANGI, TORROQ ruxsatlar — mavjud
  // `Permission`/`rolePermissions` MODELIGA mos (parallel tizim EMAS).
  PaymentsRead: 'payments:read',
  PaymentsRefund: 'payments:refund',
  SettlementsRead: 'settlements:read',
  BookingsCancel: 'bookings:cancel',
  CustomersRead: 'customers:read',
  ReviewsRead: 'reviews:read',
  ReviewsModerate: 'reviews:moderate',
  TranslationsRead: 'translations:read',
  TranslationsWrite: 'translations:write',
  SeoRead: 'seo:read',
  SeoWrite: 'seo:write',
  PartnersEdit: 'partners:edit',
  ListingsEdit: 'listings:edit',
  AvailabilityRead: 'availability:read',
  AvailabilityBlock: 'availability:block',
  AdminsRead: 'admins:read',
  AdminsManage: 'admins:manage',
  RolesManage: 'roles:manage',
} as const;

export type PermissionValue = (typeof Permission)[keyof typeof Permission];

const adminPermissions: PermissionValue[] = [
  Permission.UsersRead,
  Permission.PartnersRead,
  Permission.BookingsRead,
  Permission.FinanceRead,
  Permission.CmsRead,
  Permission.SupportRead,
  Permission.AuditLogsRead,
  Permission.AvailabilityRead,
  Permission.ReviewsRead,
  Permission.TranslationsRead,
  Permission.SeoRead,
];

/**
 * Biznes rol -> texnik `Role` enum moslashuvi (2026-09-14):
 *   FINANCE_MANAGER  -> Role.FINANCE_ADMIN
 *   SUPPORT_MANAGER  -> Role.SUPPORT_ADMIN
 *   CONTENT_MANAGER  -> Role.CONTENT_ADMIN
 *   PARTNER_MANAGER  -> Role.MODERATOR (mavjud yagona rol, allaqachon
 *     partners:read/partners:write/bookings:read ga ega — vazifa
 *     "yangi parallel auth tizim yaratma, mavjud modelga moslashtir"
 *     deb aniq talab qilgani uchun `Role` enum'iga YANGI qiymat
 *     QO'SHILMADI; buning o'rniga MODERATOR'ning ruxsatlar ro'yxati
 *     "partner manager" domenigacha kengaytirildi. Bu ataylab qilingan
 *     tanlov — agar kelajakda MODERATOR va PARTNER_MANAGER semantik
 *     jihatdan aniq ajratilishi kerak bo'lsa, `packages/types` dagi
 *     `Role` enum'iga yangi qiymat qo'shish + shared migratsiya kerak
 *     bo'ladi (bu commit doirasidan tashqarida).
 *   SUPER_ADMIN      -> Role.SUPER_ADMIN (o'zgarishsiz, cheksiz)
 */
export const rolePermissions: Record<Role, PermissionValue[]> = {
  [Role.USER]: [],
  [Role.PARTNER]: [
    Permission.BookingsRead,
    Permission.BookingsWrite,
    Permission.FinanceRead,
  ],
  [Role.ADMIN]: adminPermissions,
  [Role.FINANCE_ADMIN]: [
    Permission.FinanceRead,
    Permission.FinanceWrite,
    Permission.BookingsRead,
    Permission.PaymentsRead,
    Permission.PaymentsRefund,
    Permission.SettlementsRead,
  ],
  [Role.CONTENT_ADMIN]: [
    Permission.CmsRead,
    Permission.CmsWrite,
    Permission.ReviewsRead,
    Permission.ReviewsModerate,
    Permission.TranslationsRead,
    Permission.TranslationsWrite,
    Permission.SeoRead,
    Permission.SeoWrite,
  ],
  [Role.SUPPORT_ADMIN]: [
    Permission.SupportRead,
    Permission.SupportWrite,
    Permission.UsersRead,
    Permission.BookingsRead,
    Permission.BookingsCancel,
    Permission.CustomersRead,
  ],
  [Role.MODERATOR]: [
    // "PARTNER_MANAGER" domeni — izohga qarang.
    Permission.UsersRead,
    Permission.PartnersRead,
    Permission.PartnersWrite,
    Permission.PartnersEdit,
    Permission.ListingsEdit,
    Permission.BookingsRead,
    Permission.AvailabilityRead,
    Permission.AvailabilityBlock,
  ],
  [Role.SUPER_ADMIN]: Object.values(Permission),
};

export function actorHasPermissions(
  actor: RequestActor,
  requiredPermissions: string[],
): boolean {
  if (!requiredPermissions.length || actor.role === Role.SUPER_ADMIN) {
    return true;
  }

  const granted = new Set<PermissionValue>();
  for (const role of actor.roles.length ? actor.roles : [actor.role]) {
    for (const permission of rolePermissions[role] ?? []) {
      granted.add(permission);
    }
  }

  return requiredPermissions.every((permission) =>
    granted.has(permission as PermissionValue),
  );
}
