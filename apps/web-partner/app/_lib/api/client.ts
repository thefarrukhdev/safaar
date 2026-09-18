import type { AuthTokens, ApiError } from '@safaar/types';
import { isAccessTokenExpired } from '../auth/session';
import { useAuthStore } from '../../_stores/auth-store';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? '/api/backend';

interface ApiEnvelope<T> {
  success: true;
  data: T;
  meta?: {
    request_id?: string;
  };
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public payload?: ApiError,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

type UnauthorizedHandler = (error: HttpError) => void;

let unauthorizedHandler: UnauthorizedHandler | null = null;

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null) {
  unauthorizedHandler = handler;
}

function handleUnauthorized(error: HttpError, token?: string | null) {
  if (error.status === 401 && token) {
    unauthorizedHandler?.(error);
  }
}

/**
 * `POST /auth/partner/refresh`ga to'g'ridan-to'g'ri (bu modulning o'z
 * `request()`i orqali EMAS) murojaat qiladi — aks holda
 * `endpoints/auth.ts`dan import qilish `client.ts` <-> `endpoints/auth.ts`
 * aylanma bog'liqlik (circular import) hosil qilardi (u ham `request()`ni
 * shu fayldan oladi). Bir vaqtda bir nechta so'rov token muddati
 * tugaganini aniqlasa ham, faqat BITTA haqiqiy refresh so'rovi ketishi
 * uchun `refreshPromise` orqali ulashiladi (race condition oldini olish).
 */
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const current = useAuthStore.getState().tokens;
    if (!current?.refreshToken) return null;

    try {
      const response = await fetch(buildUrl('/auth/partner/refresh'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ refreshToken: current.refreshToken }),
      });
      if (!response.ok) return null;

      const payload = (await response.json().catch(() => null)) as
        | { data?: Partial<AuthTokens> }
        | Partial<AuthTokens>
        | null;
      const data = (payload && 'data' in payload ? payload.data : payload) as
        | Partial<AuthTokens>
        | undefined;
      if (!data?.accessToken) return null;

      // Backend refresh tokenni ROTATSIYA qiladi (session-store.ts::rotate) —
      // eskisi bir martalik, keyingi refresh uchun YANGISI saqlanishi shart,
      // aks holda ikkinchi refresh urinishi "AUTH_REFRESH_REUSED" bilan
      // butun sessiyani bekor qiladi.
      useAuthStore.setState((state) =>
        state.tokens
          ? {
              tokens: {
                ...state.tokens,
                accessToken: data.accessToken!,
                refreshToken: data.refreshToken ?? state.tokens.refreshToken,
              },
            }
          : state,
      );

      return data.accessToken;
    } catch {
      return null;
    }
  })().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}



interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  token?: string | null;
  organizationId?: string;
  searchParams?: Record<string, string | number | boolean | undefined>;
}

function buildUrl(
  path: string,
  searchParams?: RequestOptions['searchParams'],
): string {
  const rawUrl = path.startsWith('http')
    ? path
    : `${API_BASE_URL.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
  const isAbsolute = /^https?:\/\//i.test(rawUrl);
  const base =
    typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
  const url = isAbsolute ? new URL(rawUrl) : new URL(rawUrl, base);

  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      if (value === undefined) continue;
      url.searchParams.set(key, String(value));
    }
  }

  return isAbsolute
    ? url.toString()
    : `${url.pathname}${url.search}${url.hash}`;
}

function storedOrganizationId(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const auth = JSON.parse(
      localStorage.getItem('uzbron-partner-auth') || '{}',
    );
    if (auth?.state?.user?.organizationId) {
      return auth.state.user.organizationId;
    }
  } catch {}
  return undefined;
}

async function parseErrorPayload(response: Response): Promise<ApiError> {
  let payload:
    | {
        error?: {
          message?: string;
          fields?: ApiError['fields'];
          code?: string;
        };
        message?: string;
        fields?: ApiError['fields'];
        code?: string;
      }
    | undefined;
  try {
    payload = await response.json();
  } catch {
    // ignore
  }

  return {
    message: payload?.error?.message ?? payload?.message ?? response.statusText,
    fields: payload?.error?.fields ?? payload?.fields,
    code: payload?.error?.code ?? payload?.code,
    statusCode: response.status,
  };
}

/**
 * Backend uchun universal HTTP wrapper.
 *
 * - JSON serialization/deserialization avtomatik
 * - `Authorization: Bearer <token>` qo'yiladi (token mavjud bo'lsa)
 * - Xato bo'lsa `HttpError` tashlaydi (status, payload bilan)
 *
 * @example
 *   const data = await request<Hotel[]>("/hotels");
 */
function buildInit(
  body: unknown,
  token: string | null | undefined,
  organizationId: string | undefined,
  headers: RequestOptions['headers'],
  rest: Omit<RequestOptions, 'body' | 'token' | 'organizationId' | 'searchParams' | 'headers'>,
): RequestInit {
  return {
    ...rest,
    headers: {
      Accept: 'application/json',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(organizationId ? { 'x-organization-id': organizationId } : {}),
      ...headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  };
}

async function performFetch(
  path: string,
  searchParams: RequestOptions['searchParams'],
  init: RequestInit,
): Promise<Response> {
  try {
    return await fetch(buildUrl(path, searchParams), init);
  } catch (cause) {
    // fetch'ning o'zi otgan xato: tarmoq yo'q, CORS, backend offline va h.k.
    throw new HttpError(
      0,
      "Backend bilan bog'lana olmadi. Internet va server holatini tekshiring.",
      {
        statusCode: 0,
        message: cause instanceof Error ? cause.message : 'Network error',
      },
    );
  }
}

export async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const {
    body,
    token,
    organizationId = storedOrganizationId(),
    searchParams,
    headers,
    ...rest
  } = options;

  // Access token'lar qisqa umr ko'radi (JWT_ACCESS_TTL=15m) — muddati
  // o'tgani oldindan ko'rinsa, so'rov yuborishdan OLDIN yangilaymiz
  // (kafolatlangan 401'dan qochish uchun). `refreshAccessToken()` ichki
  // `refreshPromise` orqali bir vaqtdagi bir nechta so'rovni bitta haqiqiy
  // refresh chaqiruviga birlashtiradi.
  let activeToken = token ?? undefined;
  if (activeToken && isAccessTokenExpired(activeToken)) {
    activeToken = (await refreshAccessToken()) ?? activeToken;
  }

  let response = await performFetch(
    path,
    searchParams,
    buildInit(body, activeToken, organizationId, headers, rest),
  );

  // Oldindan tekshiruv token allaqachon serverda bekor qilingan (masalan
  // boshqa qurilmada logout qilingan) holatni ushlay olmaydi — shu sabab
  // 401 kelsa ham BIR MARTA refresh+retry qilinadi. Muvaffaqiyatsiz bo'lsa
  // (yoki token umuman berilmagan bo'lsa) pastdagi oddiy xato yo'liga
  // tushadi — cheksiz tsikl xavfi yo'q, chunki bu yerda faqat BITTA qayta
  // urinish bor.
  if (response.status === 401 && activeToken) {
    const refreshed = await refreshAccessToken();
    if (refreshed && refreshed !== activeToken) {
      activeToken = refreshed;
      response = await performFetch(
        path,
        searchParams,
        buildInit(body, activeToken, organizationId, headers, rest),
      );
    }
  }

  if (!response.ok) {
    const apiError = await parseErrorPayload(response);
    const error = new HttpError(response.status, apiError.message, apiError);

    handleUnauthorized(error, activeToken);
    throw error;
  }

  // 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  const payload = (await response.json()) as any;
  if (
    typeof payload === 'object' &&
    payload !== null &&
    'success' in payload &&
    'data' in payload
  ) {
    return payload.data as T;
  }

  return payload as T;
}

function buildFormDataInit(
  formData: FormData,
  token: string | null | undefined,
  organizationId: string | undefined,
  headers: RequestOptions['headers'],
  rest: Omit<RequestOptions, 'body' | 'token' | 'organizationId' | 'searchParams' | 'headers'>,
): RequestInit {
  return {
    ...rest,
    method: rest.method ?? 'POST',
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(organizationId ? { 'x-organization-id': organizationId } : {}),
      ...headers,
    },
    body: formData,
  };
}

export async function requestFormData<T>(
  path: string,
  formData: FormData,
  options: Omit<RequestOptions, 'body'> = {},
): Promise<T> {
  const {
    token,
    organizationId = storedOrganizationId(),
    searchParams,
    headers,
    ...rest
  } = options;

  let activeToken = token ?? undefined;
  if (activeToken && isAccessTokenExpired(activeToken)) {
    activeToken = (await refreshAccessToken()) ?? activeToken;
  }

  let response = await performFetch(
    path,
    searchParams,
    buildFormDataInit(formData, activeToken, organizationId, headers, rest),
  );

  if (response.status === 401 && activeToken) {
    const refreshed = await refreshAccessToken();
    if (refreshed && refreshed !== activeToken) {
      activeToken = refreshed;
      response = await performFetch(
        path,
        searchParams,
        buildFormDataInit(formData, activeToken, organizationId, headers, rest),
      );
    }
  }

  if (!response.ok) {
    const apiError = await parseErrorPayload(response);
    const error = new HttpError(response.status, apiError.message, apiError);

    handleUnauthorized(error, activeToken);
    throw error;
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const payload = (await response.json()) as T | ApiEnvelope<T>;
  if (
    typeof payload === 'object' &&
    payload !== null &&
    'success' in payload &&
    'data' in payload
  ) {
    return (payload as ApiEnvelope<T>).data;
  }

  return payload as T;
}
