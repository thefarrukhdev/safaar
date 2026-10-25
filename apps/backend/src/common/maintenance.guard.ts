import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Role } from '@safaar/types';
import { AppCacheService } from '../infrastructure/cache.service';
import { PostgresService } from '../infrastructure/postgres.service';
import { buildActorFromHeaders, type RequestWithActor } from './actor';

type RequestLike = RequestWithActor & {
  method?: string;
  originalUrl?: string;
  url?: string;
  path?: string;
};

const alwaysAllowedPrefixes = [
  '/health',
  '/metrics',
  '/docs',
  '/settings/public',
  '/admin',
  '/auth/admin',
  // Ro'yxatdan o'tish va kirish (OTP, parol, complete-profile, social login)
  // texnik xizmat rejimida ham ishlashi kerak.
  '/auth/user',
  '/auth/oauth',
  '/webhooks',
];

const adminRoles = new Set<Role>([
  Role.ADMIN,
  Role.FINANCE_ADMIN,
  Role.CONTENT_ADMIN,
  Role.SUPPORT_ADMIN,
  Role.MODERATOR,
  Role.SUPER_ADMIN,
]);

const readOnlyMethods = new Set(['GET', 'HEAD']);

@Injectable()
export class MaintenanceGuard implements CanActivate {
  constructor(
    private readonly cache: AppCacheService,
    private readonly pg: PostgresService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') {
      // Chat kabi WebSocket oqimlari texnik xizmat rejimida ham ishlashi
      // kerak; ruxsat tekshiruvi ChatGateway/ChatService darajasida
      // bajariladi, HTTP-ga xos bu guard ularga taalluqli emas.
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestLike>();
    const method = (request.method ?? 'GET').toUpperCase();

    if (method === 'OPTIONS' || readOnlyMethods.has(method)) {
      // Texnik xizmat rejimida ham foydalanuvchilar/hamkorlar saytni
      // faqat ko'rishi (GET/HEAD) mumkin bo'lishi kerak — bloklanadigan
      // narsa faqat amallar (yozish so'rovlari).
      return true;
    }

    const path = normalizePath(
      request.originalUrl ?? request.url ?? request.path ?? '/',
    );

    if (isAlwaysAllowed(path) || isAdminActor(request)) {
      return true;
    }

    const maintenanceMode = await this.isMaintenanceMode();
    if (!maintenanceMode) {
      return true;
    }

    throw new ServiceUnavailableException({
      code: 'MAINTENANCE_MODE',
      message: 'Platformada texnik xizmat ishlari olib borilmoqda',
      maintenance_mode: true,
    });
  }

  private async isMaintenanceMode(): Promise<boolean> {
    return this.cache.getOrSet('admin:maintenance-mode', 30, async () => {
      try {
        const rows = await this.pg.query<{ maintenance_mode?: boolean }>(
          `
            select coalesce((value ->> 'maintenance_mode')::boolean, false) as maintenance_mode
            from admin_settings
            where group_key = 'general'
            limit 1
          `,
        );
        return Boolean(rows[0]?.maintenance_mode);
      } catch {
        return false;
      }
    });
  }
}

function isAdminActor(request: RequestLike): boolean {
  const actor = request.user ?? buildActorFromHeaders(request.headers);

  return Boolean(actor?.roles?.some((role) => adminRoles.has(role)));
}

function isAlwaysAllowed(path: string): boolean {
  return alwaysAllowedPrefixes.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

function normalizePath(value: string): string {
  const pathname = `/${value.split('?')[0].replace(/^\/+/, '')}`;
  const withoutLegacyPrefix = pathname.replace(/^\/api(?=\/|$)/, '');
  const withoutVersionPrefix = withoutLegacyPrefix.replace(
    /^\/v\d+(?=\/|$)/,
    '',
  );
  return withoutVersionPrefix || '/';
}
