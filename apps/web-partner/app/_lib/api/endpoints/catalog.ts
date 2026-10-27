import { request } from "../client";

export interface CatalogAmenity {
  id: string;
  code: string;
  name: Record<string, string>;
  icon: string;
  type: string;
  is_active: boolean;
}

type LocalizedName = string | { uz?: string; ru?: string; en?: string } | null | undefined;

function pickName(value: LocalizedName): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value.uz ?? value.ru ?? value.en ?? '';
}

export interface CatalogCity {
  id: string;
  name: string;
}

interface RawCity {
  id: string;
  name: LocalizedName;
}

export function listAmenities(): Promise<CatalogAmenity[]> {
  return request<CatalogAmenity[]>('/catalog/amenities');
}

export function listCities(): Promise<CatalogCity[]> {
  return request<RawCity[]>('/catalog/cities').then((cities) =>
    cities.map((c) => ({ id: c.id, name: pickName(c.name) })),
  );
}

export interface CatalogCancellationPolicy {
  id: string;
  name: Record<string, string> | string;
  rules: Array<{ beforeHours: number; penaltyPercent: number }>;
  refundable_until_hours: number;
}

export function listCancellationPolicies(): Promise<CatalogCancellationPolicy[]> {
  return request<CatalogCancellationPolicy[]>('/catalog/cancellation-policies');
}

