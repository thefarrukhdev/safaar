import { Role } from '@safaar/types';
import type { RequestActor } from './actor';
import { Permission, actorHasPermissions } from './permissions';

function admin(role: Role): RequestActor {
  return {
    id: 'admin-1',
    actorType: 'admin',
    role,
    roles: [role],
  };
}

describe('actorHasPermissions (admin RBAC matrix)', () => {
  it('denies CONTENT_ADMIN access to finance (regression: admin-like role collapse bypassed @Permissions)', () => {
    expect(
      actorHasPermissions(admin(Role.CONTENT_ADMIN), [Permission.FinanceRead]),
    ).toBe(false);
  });

  it('allows CONTENT_ADMIN access to CMS', () => {
    expect(
      actorHasPermissions(admin(Role.CONTENT_ADMIN), [Permission.CmsWrite]),
    ).toBe(true);
  });

  it('allows FINANCE_ADMIN access to finance', () => {
    expect(
      actorHasPermissions(admin(Role.FINANCE_ADMIN), [Permission.FinanceRead]),
    ).toBe(true);
    expect(
      actorHasPermissions(admin(Role.FINANCE_ADMIN), [Permission.FinanceWrite]),
    ).toBe(true);
  });

  it('denies MODERATOR access to finance', () => {
    expect(
      actorHasPermissions(admin(Role.MODERATOR), [Permission.FinanceRead]),
    ).toBe(false);
  });

  it('denies SUPPORT_ADMIN access to finance', () => {
    expect(
      actorHasPermissions(admin(Role.SUPPORT_ADMIN), [Permission.FinanceRead]),
    ).toBe(false);
  });

  it('denies plain ADMIN access to audit logs and finance writes (read-only admin tier)', () => {
    expect(
      actorHasPermissions(admin(Role.ADMIN), [Permission.FinanceWrite]),
    ).toBe(false);
    expect(
      actorHasPermissions(admin(Role.ADMIN), [Permission.AuditLogsRead]),
    ).toBe(true);
  });

  it('SUPER_ADMIN bypasses every permission check', () => {
    for (const permission of Object.values(Permission)) {
      expect(actorHasPermissions(admin(Role.SUPER_ADMIN), [permission])).toBe(
        true,
      );
    }
  });
});

describe('actorHasPermissions — granular business-role matrix (2026-09-14 SAFAAR ADMIN, PART 7 majburiy negative testlar)', () => {
  // 1. Finance manager cannot edit SEO
  it('FINANCE_ADMIN (Finance Manager) SEO tahrirlay olmaydi', () => {
    expect(
      actorHasPermissions(admin(Role.FINANCE_ADMIN), [Permission.SeoWrite]),
    ).toBe(false);
  });

  // 2. Content manager cannot refund payment
  it("CONTENT_ADMIN (Content Manager) to'lovni refund qila olmaydi", () => {
    expect(
      actorHasPermissions(admin(Role.CONTENT_ADMIN), [
        Permission.PaymentsRefund,
      ]),
    ).toBe(false);
  });

  // 3. Support manager cannot change partner commission
  it("SUPPORT_ADMIN (Support Manager) partner commissionini o'zgartira olmaydi", () => {
    expect(
      actorHasPermissions(admin(Role.SUPPORT_ADMIN), [Permission.FinanceWrite]),
    ).toBe(false);
  });

  // 4. Partner manager cannot manage admin roles
  it('MODERATOR (Partner Manager) admin rollarini boshqara olmaydi', () => {
    expect(
      actorHasPermissions(admin(Role.MODERATOR), [Permission.RolesManage]),
    ).toBe(false);
    expect(
      actorHasPermissions(admin(Role.MODERATOR), [Permission.AdminsManage]),
    ).toBe(false);
  });

  it('FINANCE_ADMIN moliya domenini to‘liq boshqaradi (payments/settlements)', () => {
    expect(
      actorHasPermissions(admin(Role.FINANCE_ADMIN), [
        Permission.PaymentsRead,
        Permission.PaymentsRefund,
        Permission.SettlementsRead,
      ]),
    ).toBe(true);
  });

  it('CONTENT_ADMIN reviews/translations/seo domenini to‘liq boshqaradi', () => {
    expect(
      actorHasPermissions(admin(Role.CONTENT_ADMIN), [
        Permission.ReviewsRead,
        Permission.ReviewsModerate,
        Permission.TranslationsRead,
        Permission.TranslationsWrite,
        Permission.SeoRead,
        Permission.SeoWrite,
      ]),
    ).toBe(true);
  });

  it('SUPPORT_ADMIN bookings.cancel va customers.read ga ega', () => {
    expect(
      actorHasPermissions(admin(Role.SUPPORT_ADMIN), [
        Permission.BookingsCancel,
        Permission.CustomersRead,
      ]),
    ).toBe(true);
  });

  it('MODERATOR (Partner Manager) availability.read/block ga ega, lekin finance/cms ga ega EMAS', () => {
    expect(
      actorHasPermissions(admin(Role.MODERATOR), [
        Permission.AvailabilityRead,
        Permission.AvailabilityBlock,
        Permission.PartnersEdit,
        Permission.ListingsEdit,
      ]),
    ).toBe(true);
    expect(
      actorHasPermissions(admin(Role.MODERATOR), [Permission.FinanceRead]),
    ).toBe(false);
    expect(
      actorHasPermissions(admin(Role.MODERATOR), [Permission.CmsWrite]),
    ).toBe(false);
  });

  it('hech qanday tor rol admins:read/admins:manage/roles:manage ga ega EMAS (faqat SUPER_ADMIN)', () => {
    for (const role of [
      Role.FINANCE_ADMIN,
      Role.CONTENT_ADMIN,
      Role.SUPPORT_ADMIN,
      Role.MODERATOR,
      Role.ADMIN,
    ]) {
      expect(actorHasPermissions(admin(role), [Permission.AdminsManage])).toBe(
        false,
      );
      expect(actorHasPermissions(admin(role), [Permission.RolesManage])).toBe(
        false,
      );
    }
  });

  // 6. Unauthorized user cannot block availability
  it('FINANCE_ADMIN/CONTENT_ADMIN/SUPPORT_ADMIN availability bloklay olmaydi (faqat MODERATOR/SUPER_ADMIN)', () => {
    for (const role of [
      Role.FINANCE_ADMIN,
      Role.CONTENT_ADMIN,
      Role.SUPPORT_ADMIN,
    ]) {
      expect(
        actorHasPermissions(admin(role), [Permission.AvailabilityBlock]),
      ).toBe(false);
    }
    expect(
      actorHasPermissions(admin(Role.MODERATOR), [
        Permission.AvailabilityBlock,
      ]),
    ).toBe(true);
  });

  // 7. Unauthorized user cannot change commission
  it("CONTENT_ADMIN/SUPPORT_ADMIN/MODERATOR partner commissionini o'zgartira olmaydi (finance:write faqat FINANCE_ADMIN/SUPER_ADMIN)", () => {
    for (const role of [
      Role.CONTENT_ADMIN,
      Role.SUPPORT_ADMIN,
      Role.MODERATOR,
    ]) {
      expect(actorHasPermissions(admin(role), [Permission.FinanceWrite])).toBe(
        false,
      );
    }
    expect(
      actorHasPermissions(admin(Role.FINANCE_ADMIN), [Permission.FinanceWrite]),
    ).toBe(true);
  });
});
