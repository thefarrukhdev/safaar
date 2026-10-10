import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    dangerouslyAllowLocalIP: process.env.NODE_ENV !== 'production',
    formats: ['image/avif', 'image/webp'],
    qualities: [75, 85, 90],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: '**.safaar.uz',
      },
      {
        protocol: 'https',
        hostname: 'pub-9055e0d28a444107a7df2431aff012ee.r2.dev',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/payment/:path*',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'self' https://uzum.uz https://*.uzum.uz https://uzumbank.uz https://*.uzumbank.uz https://uzumcheckout.uz https://*.uzumcheckout.uz https://ipt-merch.com https://*.ipt-merch.com",
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
      {
        source: '/((?!payment/).*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ];
  },
};

import { withSentryConfig } from '@sentry/nextjs/config';

export default withSentryConfig(nextConfig, {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
});
