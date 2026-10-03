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

  const origins = Array.from(
    new Set([
      ...value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
      'https://partner.safaar.uz',
      'https://safaar-partner-ten.vercel.app',
      'https://safaar.uz',
      'https://admin.safaar.uz',
      ...(!production
        ? [
            'http://localhost:3000',
            'http://localhost:3001',
            'http://localhost:3002',
          ]
        : []),
    ]),
  );

  if (production && origins.length === 0) {
    throw new Error(
      'CORS_ORIGINS production muhitida bo‘sh bo‘lishi mumkin emas',
    );
  }

  return origins;
}
