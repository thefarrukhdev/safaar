import type { ApiError, ApiResponse } from "@safaar/types";

let currentBaseUrl =
  typeof process !== "undefined" && process.env?.NEXT_PUBLIC_API_URL
    ? process.env.NEXT_PUBLIC_API_URL
    : "http://localhost:4000/v1";

export const apiConfig = {
  setBaseUrl(url: string) {
    currentBaseUrl = url;
  },
  getBaseUrl() {
    return currentBaseUrl;
  },
};

export class ApiRequestError extends Error {
  readonly statusCode?: number;
  readonly code?: string;
  readonly fields?: unknown;
  readonly requestId?: string;

  constructor(error: ApiError, fallbackStatus?: number) {
    super(error.message || "So'rov bajarilmadi");
    this.name = "ApiRequestError";
    this.statusCode = error.statusCode ?? fallbackStatus;
    this.code = error.code;
    this.fields = error.fields;
    this.requestId = error.meta?.request_id;
  }
}

type QueryValue = string | number | boolean | undefined | null;

export interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  token?: string;
  query?: Record<string, QueryValue>;
  next?: {
    revalidate?: number | false;
    tags?: string[];
  };
}

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const base = currentBaseUrl.endsWith("/") ? currentBaseUrl : `${currentBaseUrl}/`;
  // If path is full URL, return it
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  const url = new URL(path.replace(/^\//, ""), base);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

function isApiError(payload: unknown): payload is ApiError {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "success" in payload &&
    (payload as { success?: unknown }).success === false
  );
}

/**
 * Backend xatolarni ikki xil shaklda qaytaradi:
 *  - `/v1/*`:  { success:false, error: { code, message, fields }, meta }
 *  - `/api/*` (legacy): { statusCode, code, message, fields, meta }
 * `ApiError` turi tekis (flat) shaklga mos — shuning uchun ichma-ich
 * `error.error.*`ni ham tekshirib, tekis obyektga o'tkazamiz.
 */
function extractApiError(payload: unknown, response: Response): ApiError {
  const record =
    typeof payload === "object" && payload !== null
      ? (payload as Record<string, unknown>)
      : {};
  const nested =
    typeof record.error === "object" && record.error !== null
      ? (record.error as Record<string, unknown>)
      : undefined;

  return {
    success: false,
    message:
      (nested?.message as string | undefined) ||
      (record.message as string | undefined) ||
      response.statusText ||
      "Server xatosi",
    code:
      (nested?.code as string | undefined) ??
      (record.code as string | undefined),
    fields: nested?.fields ?? record.fields,
    statusCode: response.status,
    meta: record.meta as ApiError["meta"],
  };
}

export async function apiFetch<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { body, token, query, headers, ...init } = options;

  const response = await fetch(buildUrl(path, query), {
    ...init,
    headers: {
      Accept: "application/json",
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const payload = (await response
    .json()
    .catch(() => null)) as ApiResponse<T> | null;

  if (!response.ok || payload === null || isApiError(payload)) {
    throw new ApiRequestError(extractApiError(payload, response), response.status);
  }

  if ("data" in payload) {
    return payload.data;
  }

  return payload as unknown as T;
}

export const rawApi = {
  get: <T>(path: string, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: "GET" }),

  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: "POST", body }),

  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: "PATCH", body }),

  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: "PUT", body }),

  delete: <T>(path: string, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: "DELETE" }),
};
