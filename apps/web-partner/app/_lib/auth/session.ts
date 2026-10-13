import type { AuthTokens } from '@safaar/types';
import { Role } from '@safaar/types';
import type { AuthUser } from '../../_stores/auth-store';

function decodeJwtPayload(token: string): Record<string, unknown> {
  const [, payload] = token.split('.');
  if (!payload) return {};
  try {
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(normalized)) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function isAccessTokenExpired(
  token: string | undefined,
  skewMs = 30_000,
): boolean {
  if (!token) return true;
  const payload = decodeJwtPayload(token);
  const exp = payload.exp;
  if (typeof exp !== 'number') return false;
  return Date.now() + skewMs >= exp * 1000;
}

export function buildPartnerSession(
  contact: string,
  tokens: AuthTokens & { requiresCompanyDetails?: boolean },
  partnerType?: string,
  contactType: 'email' | 'phone' = 'email',
): { user: AuthUser; tokens: AuthTokens } {
  const payload = decodeJwtPayload(tokens.accessToken);
  const id = typeof payload.sub === 'string' ? payload.sub : contact;
  const organizationId =
    typeof payload.organization_id === 'string'
      ? payload.organization_id
      : undefined;

  return {
    user: {
      id,
      phone: contactType === 'phone' ? contact : '',
      email: contactType === 'email' ? contact : undefined,
      fullName: 'Hamkor xodimi',
      role: Role.PARTNER,
      organizationId,
      partnerType: partnerType || 'hotel',
      requiresCompanyDetails: Boolean(tokens.requiresCompanyDetails),
    },
    tokens,
  };
}
