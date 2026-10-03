FROM node:22-bookworm-slim AS deps
WORKDIR /app

# pnpm'ni corepack orqali faollashtirish
RUN corepack enable && corepack prepare pnpm@10.12.2 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages/types/package.json packages/types/package.json
COPY apps/backend/package.json apps/backend/package.json
RUN pnpm install --frozen-lockfile --filter @safaar/backend...

FROM node:22-bookworm-slim AS build
WORKDIR /app
# pnpm'ni bu bosqichda ham faollashtirish
RUN corepack enable && corepack prepare pnpm@10.12.2 --activate
# `node:*-bookworm-slim` OpenSSL'ni o'z ichiga olmaydi, lekin Prisma'ning
# schema/query-engine binarylari uni talab qiladi (aks holda platformani
# aniqlay olmay, noto'g'ri/mos kelmaydigan engine yuklab olishga urinadi) —
# bu Prisma + slim image kombinatsiyasi uchun keng tarqalgan, hujjatlashtirilgan
# muammo.
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/backend/node_modules ./apps/backend/node_modules
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages/types packages/types
COPY apps/backend apps/backend
# `prisma.config.ts` build-vaqtida DATABASE_URL'ni talab qiladi (schema
# parse/generate uchun) — `prisma generate` haqiqiy DB'ga ulanmaydi, shuning
# uchun bu yerda faqat sintaktik jihatdan to'g'ri placeholder yetarli.
# Runtime'da bu qiymat haqiqiy sir bilan almashtiriladi (env_file/`-e`).
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
# turbo'ni chetlab o'tib, har bir workspace'ning O'Z build skriptini
# to'g'ridan-to'g'ri chaqiramiz (Docker kontekstida faqat types + backend bor).
RUN pnpm --filter @safaar/backend run prisma:generate
RUN pnpm --filter @safaar/types run build
RUN pnpm --filter @safaar/backend run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV COREPACK_HOME=/usr/local/share/corepack

# Runtime'da ham query engine binarysi ishlashi uchun OpenSSL kerak (qarang
# yuqoridagi "build" bosqichidagi izoh).
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

# pnpm'ni runner bosqichida ham faollashtirish (CMD uchun kerak)
RUN groupadd --system --gid 1001 safaar \
  && useradd --system --uid 1001 --gid safaar --home-dir /app safaar \
  && mkdir -p /app/uploads /app/.cache /usr/local/share/corepack \
  && corepack enable \
  && corepack prepare pnpm@10.12.2 --activate \
  && chown -R safaar:safaar /app/uploads /app/.cache /usr/local/share/corepack \
  && chown safaar:safaar /app

COPY --chown=safaar:safaar --from=build /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml /app/.npmrc ./
COPY --chown=safaar:safaar --from=build /app/node_modules ./node_modules
COPY --chown=safaar:safaar --from=build /app/packages/types ./packages/types
COPY --chown=safaar:safaar --from=build /app/apps/backend ./apps/backend

USER safaar

EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD node -e 'const port=process.env.PORT||4000; const prefix=process.env.API_PREFIX||"v1"; fetch(`http://127.0.0.1:${port}/${prefix}/health`).then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1));'
CMD ["pnpm", "--filter", "@safaar/backend", "run", "start:prod"]
