export function corsOriginsFromEnv(value: string | undefined) {
  const production = process.env.NODE_ENV === 'production';

  if (!value || value.trim() === '*') {
    if (production) {
      throw new Error(
        'CORS_ORIGINS production muhitida aniq allowlist bo‘lsin',
      );
    }
    return true;
  }

  const origins = value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  origins.push('https://partner.safaar.uz');
  origins.push('https://safaar-partner-ten.vercel.app');

  if (production && origins.length === 0) {
    throw new Error(
      'CORS_ORIGINS production muhitida bo‘sh bo‘lishi mumkin emas',
    );
  }

  return origins;
}
