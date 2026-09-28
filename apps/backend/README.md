# safaar Backend

NestJS API for the safaar platform. The API serves user, partner, and admin
clients from one modular backend.

## Run

```bash
pnpm run dev:backend
```

Default local API prefix:

```text
http://localhost:4000/v1
```

Override with:

```bash
API_PREFIX=v1 PORT=4000 pnpm run start:dev -w @safaar/backend
```

## Auth And Security

Protected endpoints now expect real Bearer JWT access tokens issued by
`/v1/auth/*` endpoints. Refresh tokens are rotated; replaying an old refresh
token revokes the session family.

Development-only demo auth can be enabled with:

```text
ENABLE_DEMO_AUTH=true
ENABLE_IN_MEMORY_DATA=true
ENABLE_MOCK_PAYMENTS=true
```

Production must keep those flags false and must provide strong values for:

```text
JWT_ACCESS_SECRET
JWT_REFRESH_SECRET
OTP_PEPPER
TOTP_ENCRYPTION_KEY
PARTNER_API_KEY_PEPPER
PAYMENT_WEBHOOK_SECRET
```

Admin and partner passwords are verified with Argon2id hashes. To generate a
new hash:

```bash
pnpm run security:hash-password -w @safaar/backend -- "new-password"
```

Payment webhooks in local/mock mode require
`x-safaar-mock-signature = HMAC_SHA256(provider.event.eventKey.payload, PAYMENT_WEBHOOK_SECRET)`.
Real provider integrations intentionally fail closed until the official provider
signature algorithms are implemented.

## Main Endpoint Groups

- `POST /v1/auth/user/send-otp`
- `POST /v1/auth/user/verify-otp`
- `GET /v1/catalog/regions`
- `GET /v1/hotels`
- `POST /v1/hotels/:id/quote`
- `GET /v1/bus-trips`
- `POST /v1/bookings/hotel`
- `POST /v1/bookings/bus`
- `POST /v1/payments/:bookingId/create`
- `POST /v1/refunds`
- `POST /v1/support/tickets`
- `GET /v1/partner/profile`
- `GET /v1/admin/dashboard/overview`
- `GET /v1/exports/:id`
- `POST /v1/uploads/presign`

## Checks

```bash
pnpm run build:types
pnpm run prisma:validate -w @safaar/backend
pnpm run lint -w @safaar/backend
pnpm run build:backend
pnpm run test:backend
pnpm run test:e2e -w @safaar/backend
```

`test:e2e` opens a local test port; in restricted sandboxes it may need elevated
permission.

## Swagger

When `SWAGGER_ENABLED=true`, API docs are available at:

```text
http://localhost:4000/v1/docs
```

## Database

Prisma 7 schema lives in:

```text
apps/backend/prisma/schema.prisma
```

Useful commands:

```bash
pnpm run prisma:validate -w @safaar/backend
pnpm run prisma:generate -w @safaar/backend
pnpm run prisma:migrate -w @safaar/backend
pnpm run prisma:deploy -w @safaar/backend
```

## Docker

Backend-only local stack:

```bash
docker compose -f docker-compose.backend.yml up --build
```

This starts API, PostgreSQL, and Redis. Object storage uses the Cloudflare R2
credentials from `apps/backend/.env`; Docker Compose does not define storage
credentials directly.

Required R2 storage environment:

```text
STORAGE_ENDPOINT
STORAGE_REGION
STORAGE_BUCKET_PUBLIC
STORAGE_BUCKET_PRIVATE
STORAGE_ACCESS_KEY_ID
STORAGE_SECRET_ACCESS_KEY
STORAGE_PUBLIC_BASE_URL
STORAGE_FORCE_PATH_STYLE
```

For Cloudflare R2, `STORAGE_REGION` is usually `auto` and
`STORAGE_FORCE_PATH_STYLE=true` is recommended. The backend validates both
configured buckets during startup and logs bucket-access success or sanitized
Cloudflare R2 errors.

## Current Implementation Notes

The code now has the TZ API surface, DTO validation, Swagger setup, security
headers, rate limiting, Prisma schema, Docker Compose, CI, Cloudflare R2 object
storage, and provider adapter contracts. The remaining production work is to
replace the current in-memory services with Prisma repositories and connect real
external credentials for Click, Payme, Uzcard, Humo, SMS, email, and push.
