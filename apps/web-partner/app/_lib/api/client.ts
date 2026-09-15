import type { ApiError } from '@safaar/types';

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
  // Demo token bilan 401 bo'lsa logout qilmaymiz
  // removed demo token bypass logic
  if (error.status === 401 && token) {
    unauthorizedHandler?.(error);
  }
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
// Demo rejim uchun vaqtinchalik "baza"
const mockDb = new Map<string, any[]>();

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

  const init: RequestInit = {
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

  try {
    // ── Hamma uchun vaqtincha Demo rejim (Backend ulanmagan) ───────────────
    const method = init.method || 'GET';
    const basePath = path.split('?')[0];
    
    // Qaysi ro'yxat bilan ishlashni aniqlash
    let entityType = 'general';
    if (basePath.includes('vehicle') || basePath.includes('bus')) entityType = 'vehicles';
    if (basePath.includes('hotel') || basePath.includes('listing')) entityType = 'hotels';
    if (basePath.includes('booking')) entityType = 'bookings';

    // Block dates (Blackout) mock
    if (method === 'POST' && basePath.endsWith('/blackout')) {
      const bBody = body as any;
      const reservations = mockDb.get('bookings') || [];
      const newBooking = {
        id: `blk-${Date.now()}`,
        status: 'completed', // completed looks grayed out on calendar
        check_in: bBody.startDate,
        check_out: bBody.endDate,
        guest_name: `🔒 Bloklangan: ${bBody.reason || "Inventar yopilgan"}`,
        room_number: bBody.roomNumber,
        created_at: new Date().toISOString(),
        policy_snapshot: { source: 'WALK_IN' },
        item: { 
          nights: Math.max(1, Math.round((new Date(bBody.endDate).getTime() - new Date(bBody.startDate).getTime()) / (1000 * 3600 * 24)))
        }
      };
      mockDb.set('bookings', [...reservations, newBooking]);
      return { ok: true, success: true } as any;
    }

    // Yaratish yoki Yangilash (POST / PUT / PATCH)
    if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
      const items = mockDb.get(entityType) || [];
      const newItem = { id: String(Date.now()), createdAt: new Date().toISOString(), ...(body as any || {}) };
      mockDb.set(entityType, [...items, newItem]);
      return Object.assign({}, newItem, { success: true }) as any;
    }
    
    // O'chirish (DELETE)
    if (method === 'DELETE') {
      return { success: true } as any;
    }
    
    // Ro'yxatni olish (GET)
    if (method === 'GET') {
      const items = mockDb.get(entityType) || [];
      return Object.assign([...items], { 
        items, 
        meta: { total: items.length, page: 1, limit: 10 }, 
        data: items,
        id: 'demo-id',
        status: 'active',
        success: true,
        url: '/placeholder.jpg'
      }) as any;
    }
    
    // Boshqa barcha so'rovlar uchun standart bo'sh obyekt
    return Object.assign([], { 
      items: [], 
      meta: { total: 0, page: 1, limit: 10 }, 
      data: [],
      id: 'demo-id',
      status: 'active',
      success: true,
      url: '/placeholder.jpg'
    }) as any;
    // ────────────────────────────────────────────────────────────────────────
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

  // ── Hamma uchun vaqtincha Demo rejim (Backend ulanmagan) ───────────────
  // Dasturchi vaqtincha backendni to'liq o'chirib qo'yishni so'radi
  return Object.assign([], { 
    items: [], 
    meta: { total: 0, page: 1, limit: 10 }, 
    data: [],
    id: 'demo-id',
    status: 'active',
    success: true,
    url: '/placeholder.jpg'
  }) as any;
  // ────────────────────────────────────────────────────────────────────────

  // const response = await fetch(buildUrl(path, searchParams), {
  //   ...rest,
  //   method: rest.method ?? 'POST',
  //   headers: {
  //     Accept: 'application/json',
  //     ...(token ? { Authorization: `Bearer ${token}` } : {}),
  //     ...(organizationId ? { 'x-organization-id': organizationId } : {}),
  //     ...headers,
  //   },
  //   body: formData,
  // });

  // if (!response.ok) {
  //   const apiError = await parseErrorPayload(response);
  //   const error = new HttpError(response.status, apiError.message, apiError);

  //   handleUnauthorized(error, token);
  //   throw error;
  // }

  // const payload = (await response.json()) as T | ApiEnvelope<T>;
  // if (
  //   typeof payload === 'object' &&
  //   payload !== null &&
  //   'success' in payload &&
  //   'data' in payload
  // ) {
  //   return (payload as ApiEnvelope<T>).data;
  // }

  // return payload as T;
}
