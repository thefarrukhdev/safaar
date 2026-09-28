import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@safaar/types';
import { signJwt } from '../auth/security';
import { PERMISSIONS_KEY } from '../common/permissions.decorator';
import { Permission } from '../common/permissions';
import { ROLES_KEY } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { PostgresService } from '../infrastructure/postgres.service';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

jest.mock('../auth/session-store', () => ({
  authSessionStore: { isActive: jest.fn().mockResolvedValue(true) },
}));

/**
 * `DELETE /admin/promotions/:id` himoyasi MAVJUD
 * `POST /admin/promotions/:id/approve|reject` bilan AYNAN bir xil bo'lishi
 * shart (kuchliroq bo'lsa mayli, kuchsizroq — hech qachon). Bu yerda
 * dekorator metadata'si HAQIQIY controller'dan o'qiladi va HAQIQIY
 * `RolesGuard` aynan shu metadata bilan ishga tushiriladi.
 */
type RouteHandler = (...args: never[]) => unknown;

function handlerOf(name: string): RouteHandler {
  const descriptor = Object.getOwnPropertyDescriptor(
    AdminController.prototype,
    name,
  );
  if (!descriptor) {
    throw new Error(`AdminController.${name} route handler is missing`);
  }
  return descriptor.value as RouteHandler;
}

describe('AdminController — DELETE /admin/promotions/:id authorization', () => {
  const reflector = new Reflector();

  const rolesOf = (name: string) =>
    reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      handlerOf(name),
      AdminController,
    ]);

  const permissionsOf = (name: string) =>
    reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      handlerOf(name),
      AdminController,
    ]);

  it('carries exactly the same @Roles/@Permissions as approvePromotion and rejectPromotion', () => {
    expect(rolesOf('deletePromotion')).toEqual([Role.ADMIN, Role.SUPER_ADMIN]);
    expect(permissionsOf('deletePromotion')).toEqual([
      Permission.PartnersWrite,
    ]);
    expect(permissionsOf('deletePromotion')).toEqual(
      permissionsOf('approvePromotion'),
    );
    expect(permissionsOf('deletePromotion')).toEqual(
      permissionsOf('rejectPromotion'),
    );
  });

  it('delegates to AdminService.deletePromotion with the request actor and the :id param', async () => {
    const deletePromotion = jest
      .fn()
      .mockResolvedValue({ id: 'p-1', deleted: true });
    const controller = new AdminController({
      deletePromotion,
    } as unknown as AdminService);
    const actor = {
      id: '00000000-0000-0000-0000-000000000001',
      actorType: 'admin' as const,
      role: Role.SUPER_ADMIN,
      roles: [Role.SUPER_ADMIN],
    };

    await expect(controller.deletePromotion(actor, 'p-1')).resolves.toEqual({
      id: 'p-1',
      deleted: true,
    });
    expect(deletePromotion.mock.calls[0]).toEqual([actor, 'p-1']);
  });

  describe('RolesGuard against the real route metadata', () => {
    let guard: RolesGuard;
    let pg: { query: jest.Mock };

    const contextFor = (headers: Record<string, string>) =>
      ({
        getHandler: () => handlerOf('deletePromotion'),
        getClass: () => AdminController,
        switchToHttp: () => ({ getRequest: () => ({ headers }) }),
      }) as unknown as ExecutionContext;

    const tokenFor = (
      role: Role,
      actorType: 'user' | 'partner' | 'admin',
      organizationId?: string,
    ) =>
      signJwt(
        {
          sub: '00000000-0000-0000-0000-000000000009',
          role,
          roles: [role],
          actor_type: actorType,
          organization_id: organizationId,
          session_id: 'session-1',
          jti: 'jti-1',
        },
        'access',
      );

    const authHeaders = (
      role: Role,
      actorType: 'user' | 'partner' | 'admin',
      organizationId?: string,
    ) => ({
      authorization: `Bearer ${tokenFor(role, actorType, organizationId)}`,
    });

    beforeEach(() => {
      process.env.JWT_ACCESS_SECRET = 'test-access-secret-with-32-characters';
      process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-with-32-characters';
      pg = { query: jest.fn().mockResolvedValue([{ status: 'approved' }]) };
      guard = new RolesGuard(reflector, pg as unknown as PostgresService);
    });

    it('rejects an anonymous request with 401', async () => {
      await expect(guard.canActivate(contextFor({}))).rejects.toMatchObject({
        status: 401,
      });
    });

    it('rejects a USER with 403', async () => {
      pg.query.mockResolvedValue([{ status: 'active' }]);
      await expect(
        guard.canActivate(contextFor(authHeaders(Role.USER, 'user'))),
      ).rejects.toMatchObject({ status: 403 });
    });

    it('rejects a PARTNER with 403', async () => {
      await expect(
        guard.canActivate(
          contextFor(
            authHeaders(
              Role.PARTNER,
              'partner',
              '00000000-0000-0000-0000-0000000000aa',
            ),
          ),
        ),
      ).rejects.toMatchObject({ status: 403 });
    });

    it('rejects a plain Role.ADMIN with 403 — Role.ADMIN has no partners:write, exactly like approve/reject', async () => {
      await expect(
        guard.canActivate(contextFor(authHeaders(Role.ADMIN, 'admin'))),
      ).rejects.toMatchObject({ status: 403 });
    });

    it('allows SUPER_ADMIN', async () => {
      await expect(
        guard.canActivate(contextFor(authHeaders(Role.SUPER_ADMIN, 'admin'))),
      ).resolves.toBe(true);
    });
  });
});
