export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export const TODAY_ISO = todayIso();

/**
 * Extracts normalized YYYY-MM-DD from any ISO timestamp or date string.
 */
export function toDateOnly(iso: string | null | undefined): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Calculates integer difference in days between two ISO dates (a - b).
 * Normalizes input to midnight UTC to prevent DST and timezone drift.
 */
export function dayDiff(a: string, b: string): number {
  const cleanA = toDateOnly(a);
  const cleanB = toDateOnly(b);
  if (!cleanA || !cleanB) return 0;
  const dateA = new Date(`${cleanA}T00:00:00Z`).getTime();
  const dateB = new Date(`${cleanB}T00:00:00Z`).getTime();
  return Math.round((dateA - dateB) / DAY_MS);
}

/**
 * Adds an integer number of days to an ISO date string safely using UTC.
 * Returns YYYY-MM-DD string.
 */
export function addDays(iso: string, days: number): string {
  const clean = toDateOnly(iso);
  if (!clean) return "";
  const d = new Date(`${clean}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
