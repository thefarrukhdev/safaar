import { ApiRequestError } from "@safaar/api-client";
import { config } from "@/lib/config/config";

export interface CreateRefundInput {
  booking_id: string;
  reason: string;
}

export interface RefundResult {
  id: string;
  booking_id: string;
  user_id: string;
  reason: string;
  status: "pending" | "approved" | "rejected" | "completed";
  amount?: number;
  created_at: string;
  updated_at: string;
}

interface RequestOptions {
  token?: string;
}

function extractErrorFields(
  payload: Record<string, unknown> | null,
  res: Response,
): { message: string; code: string | undefined; fields: unknown } {
  const nested =
    payload && typeof payload.error === "object" && payload.error !== null
      ? (payload.error as Record<string, unknown>)
      : undefined;
  return {
    message:
      (nested?.message as string | undefined) ??
      (payload?.message as string | undefined) ??
      res.statusText ??
      "Server error",
    code:
      (nested?.code as string | undefined) ??
      (payload?.code as string | undefined),
    fields: nested?.fields ?? payload?.fields,
  };
}

async function rawPost<T>(path: string, body: unknown, options?: RequestOptions): Promise<T> {
  const base = config.apiUrl.endsWith("/") ? config.apiUrl : `${config.apiUrl}/`;
  const url = new URL(path.replace(/^\//, ""), base).toString();
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(options?.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  const payload = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok || !payload) {
    const extracted = extractErrorFields(payload, res);
    throw new ApiRequestError(
      { success: false, ...extracted },
      res.status
    );
  }
  return (payload.data ?? payload) as T;
}

async function rawGet<T>(path: string, options?: RequestOptions): Promise<T> {
  const base = config.apiUrl.endsWith("/") ? config.apiUrl : `${config.apiUrl}/`;
  const url = new URL(path.replace(/^\//, ""), base).toString();
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      ...(options?.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
  });

  const payload = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok || !payload) {
    const extracted = extractErrorFields(payload, res);
    throw new ApiRequestError(
      { success: false, ...extracted },
      res.status
    );
  }
  return (payload.data ?? payload) as T;
}

export const refundsService = {
  async createRefund(input: CreateRefundInput, options?: RequestOptions): Promise<RefundResult> {
    const raw = await rawPost<any>("/refunds", input, options);
    return raw as RefundResult;
  },

  async getMyRefunds(options?: RequestOptions): Promise<RefundResult[]> {
    const raw = await rawGet<any>("/me/refunds", options);
    return raw as RefundResult[];
  },

  async getRefund(id: string, options?: RequestOptions): Promise<RefundResult> {
    const raw = await rawGet<any>(`/refunds/${encodeURIComponent(id)}`, options);
    return raw as RefundResult;
  },
};
