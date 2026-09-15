FROM node:22-bookworm-slim AS deps
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/types/package.json packages/types/package.json
COPY apps/backend/package.json apps/backend/package.json
RUN npm ci --workspace=@safaar/backend --include-workspace-root

FROM node:22-bookworm-slim AS build
WORKDIR /app
# `node:*-bookworm-slim` OpenSSL'ni o'z ichiga olmaydi, lekin Prisma'ning
# schema/query-engine binarylari uni talab qiladi (aks holda platformani
# aniqlay olmay, noto'g'ri/mos kelmaydigan engine yuklab olishga urinadi) —
# bu Prisma + slim image kombinatsiyasi uchun keng tarqalgan, hujjatlashtirilgan
# muammo.
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY packages/types packages/types
COPY apps/backend apps/backend
# `prisma.config.ts` build-vaqtida DATABASE_URL'ni talab qiladi (schema
# parse/generate uchun) — `prisma generate` haqiqiy DB'ga ulanmaydi, shuning
# uchun bu yerda faqat sintaktik jihatdan to'g'ri placeholder yetarli.
# Runtime'da bu qiymat haqiqiy sir bilan almashtiriladi (env_file/`-e`).
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
# `npm run build:types`/`build:backend` (root) `turbo`ni chaqiradi — turbo
# esa filtrlashdan OLDIN BUTUN monorepo workspace grafini o'qishga urinadi
# (root package.json'dagi "workspaces": ["packages/*","apps/*"] bo'yicha),
# lekin Docker build kontekstida FAQAT packages/types va apps/backend bor
# (apps/web-user, apps/web-partner, apps/web-admin, packages/api-client
# ataylab yo'q — image'ni yengil saqlash uchun). Shu sabab turbo xato
# berardi. Shuning uchun bu yerda turbo'ni chetlab o'tib, har bir
# workspace'ning O'Z build skriptini to'g'ridan-to'g'ri chaqiramiz.
RUN npm run prisma:generate -w @safaar/backend
RUN npm run build -w @safaar/types
RUN npm run build -w @safaar/backend

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

# Runtime'da ham query engine binarysi ishlashi uchun OpenSSL kerak (qarang
# yuqoridagi "build" bosqichidagi izoh).
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/types ./packages/types
COPY --from=build /app/apps/backend ./apps/backend

RUN groupadd --system --gid 1001 safaar \
  && useradd --system --uid 1001 --gid safaar --home-dir /app safaar \
  && mkdir -p /app/uploads \
  && chown -R safaar:safaar /app

USER safaar

EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD node -e 'const port=process.env.PORT||4000; const prefix=process.env.API_PREFIX||"v1"; fetch(`http://127.0.0.1:${port}/${prefix}/health`).then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1));'
CMD ["npm", "run", "start:prod", "-w", "@safaar/backend"]
