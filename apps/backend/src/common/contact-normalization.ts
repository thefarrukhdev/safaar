export function normalizePhone(phone: unknown): string {
  const digits = String(phone ?? '').replace(/\D/g, '');
  return digits.startsWith('998') ? `+${digits}` : `+998${digits}`;
}

export function isValidUzbekPhone(phone: string): boolean {
  return /^\+998\d{9}$/.test(phone);
}

export function normalizeEmail(email: unknown): string {
  return String(email ?? '')
    .trim()
    .toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
