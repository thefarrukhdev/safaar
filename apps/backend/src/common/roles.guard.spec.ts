import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@safaar/types';
import { signJwt } from '../auth/security';
import { PostgresService } from '../infrastructure/postgres.service';
import { RolesGuard } from './roles.guard';

jest.mock('../auth/session-store', () => ({
  authSessionStore: { isActive: jest.fn().mockResolvedValue(true) },
}));

function contextFor(
  headers: Record<string, string> = {},
  overrides: { requiredRoles?: Role[]; requiredPermissions?: string[] } = {},
): {
  context: ExecutionContext;
  request: { user?: unknown; headers: Record<string, string> };
} {
  const request: { user?: unknown; headers: Record<string, string> } = {
    headers,
  };
  const context = {
    getHandler: () => ({ __roles: overrides.requiredRoles }),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { context, request };
}

describe('RolesGuard — optional-auth actor resolution (regression: guest-checkout booking user_id null)', () => {
  let guard: RolesGuard;
  let pg: jest.Mocked<Pick<PostgresService, 'query'>>;
  let reflector: { getAllAndOverride: jest.Mock };

  const userToken = () =>
    signJwt(
      {
        sub: '00000000-0000-0000-0000-000000000001',
        role: Role.USER,
        roles: [Role.USER],
        actor_type: 'user',
        session_id: 'session-1',
        jti: 'jti-1',
      },
      'access',
    );

  beforeEach(() => {
    process.env.JWT_ACCESS_SECRET = 'test-access-secret-with-32-characters';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-with-32-characters';
    pg = { query: jest.fn() };
    reflector = { getAllAndOverride: jest.fn().mockReturnValue(undefined) };
    guard = new RolesGuard(
      reflector as unknown as Reflector,
      pg as unknown as PostgresService,
    );
  });

  it('populates request.user from a valid token even when no @Roles() is required (guest-checkout route)', async () => {
    const token = userToken();
    pg.query.mockResolvedValueOnce([{ status: 'active' }]); // users status check

    const { context, request } = contextFor({
      authorization: `Bearer ${token}`,
    });
    await expect(guard.canActivate(context)).resolves.toBe(true);

    expect(request.user).toMatchObject({
      id: '00000000-0000-0000-0000-000000000001',
      actorType: 'user',
    });
  });

  it('leaves request.user undefined (proceeds as guest) when no token is sent on an optional-auth route', async () => {
    const { context, request } = contextFor({});
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toBeUndefined();
    expect(pg.query).not.toHaveBeenCalled();
  });

  it('rejects a blocked user instead of silently degrading the request to guest on an optional-auth route', async () => {
    const token = userToken();
    pg.query.mockResolvedValueOnce([{ status: 'blocked' }]);

    const { context, request } = contextFor({
      authorization: `Bearer ${token}`,
    });
    await expect(guard.canActivate(context)).rejects.toMatchObject({
      status: 403,
      response: { code: 'USER_BLOCKED' },
    });
    expect(request.user).toBeUndefined();
  });

  it('rejects a presented invalid token instead of treating it as an anonymous request', async () => {
    const { context, request } = contextFor({
      authorization: 'Bearer definitely-not-a-valid-jwt',
    });

    await expect(guard.canActivate(context)).rejects.toMatchObject({
      status: 401,
      response: { code: 'AUTH_TOKEN_INVALID' },
    });
    expect(request.user).toBeUndefined();
  });

  it('still enforces roles/permissions normally when @Roles() IS present (no regression)', async () => {
    reflector.getAllAndOverride
      .mockReturnValueOnce([Role.PARTNER])
      .mockReturnValueOnce(undefined);
    const token = userToken(); // actor is a plain USER, not PARTNER
    pg.query.mockResolvedValueOnce([{ status: 'active' }]);

    const { context } = contextFor({ authorization: `Bearer ${token}` });
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('still rejects a missing token when @Roles() IS required (no regression)', async () => {
    reflector.getAllAndOverride
      .mockReturnValueOnce([Role.USER])
      .mockReturnValueOnce(undefined);
    const { context } = contextFor({});
    await expect(guard.canActivate(context)).rejects.toMatchObject({
      status: 401,
    });
  });
});

describe('RolesGuard — admin RBAC deny-by-default (regression: CRITICAL — CONTENT_ADMIN/MODERATOR could read finance data on any @Roles(ADMIN) route missing @Permissions())', () => {
  let guard: RolesGuard;
  let pg: jest.Mocked<Pick<PostgresService, 'query'>>;
  let reflector: { getAllAndOverride: jest.Mock };

  function adminToken(role: Role) {
    return signJwt(
      {
        sub: '00000000-0000-0000-0000-0000000000aa',
        role,
        roles: [role],
        actor_type: 'admin',
        session_id: 'session-admin',
        jti: 'jti-admin',
      },
      'access',
    );
  }

  beforeEach(() => {
    process.env.JWT_ACCESS_SECRET = 'test-access-secret-with-32-characters';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-with-32-characters';
    pg = { query: jest.fn() };
    reflector = { getAllAndOverride: jest.fn() };
    guard = new RolesGuard(
      reflector as unknown as Reflector,
      pg as unknown as PostgresService,
    );
  });

  // requiredRoles then requiredPermissions — matches the two
  // getAllAndOverride calls in canActivate().
  function mockRoute(requiredPermissions: string[] | undefined) {
    reflector.getAllAndOverride
      .mockReturnValueOnce([Role.ADMIN, Role.SUPER_ADMIN])
      .mockReturnValueOnce(requiredPermissions);
  }

  const NARROW_ROLES = [
    Role.FINANCE_ADMIN,
    Role.CONTENT_ADMIN,
    Role.SUPPORT_ADMIN,
    Role.MODERATOR,
  ];

  for (const role of NARROW_ROLES) {
    it(`denies ${role} on a @Roles(ADMIN) route with NO @Permissions() at all (the exact bug: previously any admin-shaped role passed through)`, async () => {
      mockRoute(undefined);
      const { context } = contextFor({
        authorization: `Bearer ${adminToken(role)}`,
      });
      await expect(guard.canActivate(context)).rejects.toMatchObject({
        response: { code: 'AUTH_PERMISSION_DENIED' },
      });
    });
  }

  it('allows plain Role.ADMIN through a @Roles(ADMIN) route with no @Permissions() (the broad/general admin tier is unaffected)', async () => {
    mockRoute(undefined);
    const { context } = contextFor({
      authorization: `Bearer ${adminToken(Role.ADMIN)}`,
    });
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('allows SUPER_ADMIN through a @Roles(ADMIN) route with no @Permissions()', async () => {
    mockRoute(undefined);
    const { context } = contextFor({
      authorization: `Bearer ${adminToken(Role.SUPER_ADMIN)}`,
    });
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('an explicit empty @Permissions() ([]) is treated as a deliberate opt-out, not "missing" — narrow roles are allowed through (developer explicitly said no specific permission is needed)', async () => {
    mockRoute([]);
    const { context } = contextFor({
      authorization: `Bearer ${adminToken(Role.CONTENT_ADMIN)}`,
    });
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('CONTENT_ADMIN is denied a route requiring Permission.FinanceRead', async () => {
    mockRoute(['finance:read']);
    const { context } = contextFor({
      authorization: `Bearer ${adminToken(Role.CONTENT_ADMIN)}`,
    });
    await expect(guard.canActivate(context)).rejects.toMatchObject({
      response: { code: 'AUTH_PERMISSION_DENIED' },
    });
  });

  it('CONTENT_ADMIN is allowed a route requiring Permission.CmsWrite (their own domain)', async () => {
    mockRoute(['cms:write']);
    const { context } = contextFor({
      authorization: `Bearer ${adminToken(Role.CONTENT_ADMIN)}`,
    });
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('FINANCE_ADMIN is allowed a route requiring Permission.FinanceRead', async () => {
    mockRoute(['finance:read']);
    const { context } = contextFor({
      authorization: `Bearer ${adminToken(Role.FINANCE_ADMIN)}`,
    });
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('FINANCE_ADMIN is denied a CMS-only route', async () => {
    mockRoute(['cms:write']);
    const { context } = contextFor({
      authorization: `Bearer ${adminToken(Role.FINANCE_ADMIN)}`,
    });
    await expect(guard.canActivate(context)).rejects.toMatchObject({
      response: { code: 'AUTH_PERMISSION_DENIED' },
    });
  });

  it('MODERATOR is denied finance access', async () => {
    mockRoute(['finance:read']);
    const { context } = contextFor({
      authorization: `Bearer ${adminToken(Role.MODERATOR)}`,
    });
    await expect(guard.canActivate(context)).rejects.toMatchObject({
      response: { code: 'AUTH_PERMISSION_DENIED' },
    });
  });

  it('an unrecognized/typo permission string denies every non-SUPER_ADMIN role', async () => {
    for (const role of [Role.ADMIN, ...NARROW_ROLES]) {
      mockRoute(['totally:not-a-real-permission']);
      const { context } = contextFor({
        authorization: `Bearer ${adminToken(role)}`,
      });
      await expect(guard.canActivate(context)).rejects.toMatchObject({
        response: { code: 'AUTH_PERMISSION_DENIED' },
      });
    }
  });

  it('SUPER_ADMIN is allowed regardless of which permission is required', async () => {
    mockRoute(['finance:write']);
    const { context } = contextFor({
      authorization: `Bearer ${adminToken(Role.SUPER_ADMIN)}`,
    });
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('a route requiring a non-ADMIN role (e.g. PARTNER-only) is completely unaffected by the admin deny-by-default rule', async () => {
    reflector.getAllAndOverride
      .mockReturnValueOnce([Role.PARTNER])
      .mockReturnValueOnce(undefined);
    const token = signJwt(
      {
        sub: '00000000-0000-0000-0000-0000000000bb',
        role: Role.PARTNER,
        roles: [Role.PARTNER],
        actor_type: 'partner',
        organization_id: '00000000-0000-0000-0000-0000000000cc',
        session_id: 'session-partner',
        jti: 'jti-partner',
      },
      'access',
    );
    pg.query.mockResolvedValueOnce([{ status: 'approved' }]);
    const { context } = contextFor({ authorization: `Bearer ${token}` });
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });
});
