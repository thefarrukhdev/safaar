# Production Database Architecture

**Status:** verified from the live Yandex Cloud VM on 2026-08-29.

> **Production PostgreSQL runs locally on the Yandex Cloud backend VM at
> `127.0.0.1:5432`. Neon is NOT the production database.**

---

## 1. Where the production database lives

| Property | Value |
|---|---|
| Host VM | Yandex Cloud, instance `fhmmagrf73kmj2dpo808`, public IP `111.88.246.79` |
| Engine | PostgreSQL **14** (`/usr/lib/postgresql/14/bin/postgres`) |
| Data directory | `/var/lib/postgresql/14/main` |
| Listen address | `127.0.0.1:5432` **and** `[::1]:5432` — **localhost only, not exposed to the internet** |
| Database name | `safaar_temp` &nbsp;*(historical name — it **is** the production DB; see note below)* |
| Managed service? | **No.** Self-hosted `apt` package Postgres on the VM disk (`/dev/vda1`, 39 GB). |

> **Naming note:** the database is called `safaar_temp` for historical reasons. It
> is the real, only production database. The backup script's safety gate depends
> on this exact name, so **do not rename it** without updating
> `/home/yc-user/backup-safaar-temp-db.sh` on the VM first.

## 2. How the backend connects to it

- The backend runs as PM2 process **`safaar-backend`** under system user **`yc-user`**;
  app tree at `/home/yc-user/safaar` (a plain copy of the monorepo, no `.git`).
- It reads `DATABASE_URL` from `/home/yc-user/safaar/apps/backend/.env`.
- That `DATABASE_URL` host is **`127.0.0.1:5432`**, database `safaar_temp`
  (verified — it is *not* a `*.neon.tech` URL).
- Connection layer: `apps/backend/src/infrastructure/postgres.service.ts` — a plain
  `pg` `Pool` (`DB_POOL_MAX` default 5). Prisma (`apps/backend/prisma/`) uses the
  same `DATABASE_URL`. Both talk to the local socket.

## 3. Why production uses `127.0.0.1`

The database and the API run on **the same VM**. Postgres listens only on
loopback, so it is unreachable from the public internet — the only client is the
co-located backend. This is deliberate and correct: no DB port is exposed, no
network hop, no TLS termination needed for the DB link.

> `127.0.0.1` on the **VM** is the VM's own Postgres. It is **not** your laptop's
> `127.0.0.1`. Never copy the production `DATABASE_URL` into a local `.env`.

## 4. Local development database

Local development must **not** use the production DB and must **not** use Neon.

Use the bundled Docker stack:

```bash
docker compose -f docker-compose.backend.yml up --build   # Postgres 18 + Redis + API
```

which provides the local `DATABASE_URL` already shipped in
`apps/backend/.env.example:16` — user `safaar`, password `safaar`, host
`localhost:5432`, database `safaar`.

If a developer's local `apps/backend/.env` still contains the old Neon URL
(host `ep-billowing-term-…neon.tech`, database `neondb`), that Neon instance is **dead**
(compute quota exhausted) and should be replaced with the value from
`.env.example` (or a personal local Postgres). `apps/backend/.env` is
git-ignored; each developer manages their own.

## 5. How the production `DATABASE_URL` should be configured

On the VM, `/home/yc-user/safaar/apps/backend/.env` holds a single
`DATABASE_URL` line with these components:

| Component | Value |
|---|---|
| scheme | `postgresql://` |
| user / password | the local Postgres role for `safaar_temp` (kept only in the VM `.env`) |
| host | `127.0.0.1` |
| port | `5432` |
| database | `safaar_temp` |

i.e. the shape `postgresql://…@127.0.0.1:5432/safaar_temp`.

- Host **must** be `127.0.0.1` (or `localhost`), port `5432`, database `safaar_temp`.
- No `sslmode` needed (loopback).
- It must never point at Neon, Railway, or any external host.
- After changing it: `sudo -u yc-user pm2 restart safaar-backend`.

The backend's env validation (`apps/backend/src/config/env.validation.ts`) requires
`DATABASE_URL` to be present in production and will refuse to start without it.

## 6. How to safely verify the production database

All read-only, non-destructive:

```bash
ssh safaar-backend                                   # user: ubuntu (see infra notes)

# service + version + listen address
systemctl status postgresql
ss -ltn | grep 5432

# backend is pointed at local PG (host only, no secret printed)
sudo sed -nE 's#^DATABASE_URL=.*@([^/]+).*#\1#p' /home/yc-user/safaar/apps/backend/.env

# backend process health
sudo -u yc-user pm2 status safaar-backend

# schema sanity (peer auth, no password)
sudo -u postgres psql -d safaar_temp -c '\dt'
sudo -u postgres psql -d safaar_temp -Atc \
  "select count(*) from information_schema.tables where table_schema='public'"
```

From anywhere, an application-level health check:

```bash
curl -s https://111-88-246-79.sslip.io/v1/health          # {"status":"ok"}
curl -s https://111-88-246-79.sslip.io/v1/catalog/cities   # live DB read
```

## 7. Backup strategy

**In place and verified running** (2026-08-29).

| Property | Value |
|---|---|
| Script | `/home/yc-user/backup-safaar-temp-db.sh` (VM-only — **not in the repo**) |
| Trigger | `yc-user` crontab: `0 3 * * *` (daily 03:00 **UTC**) |
| Method | `pg_dump "$DATABASE_URL" \| gzip` → `safaar_temp-<UTC-timestamp>.sql.gz` |
| Safety gate | script aborts unless `DATABASE_URL` matches `127.0.0.1:5432/safaar_temp` |
| Local copy | `/home/yc-user/db-backups/`, retention **7 days** (`find -mtime +7 -delete`) |
| Off-site copy | **Cloudflare R2** via `apps/backend/db-backup-upload.js` (VM-only), prefix `db-backups/`, retention **14 days** |
| Log | `/home/yc-user/db-backups/backup.log` |
| Last verified run | `safaar_temp-20260829-030001.sql.gz` — `pg_dump OK`, `R2 upload OK` |

**Gaps (non-blocking, improvement backlog):**
- No **WAL archiving / PITR** → worst-case RPO is ~24 h (a crash at 02:59 UTC loses
  ~24 h of writes).
- The backup script + R2 uploader are **not version-controlled** — they exist only
  on the VM. If the VM is lost, the tooling must be reconstructed (the R2 dumps
  themselves survive).
- Backup **restore has not been test-verified** (no dedicated non-prod restore
  target). See §9.

## 8. What must NEVER be done to the production database

- `DROP DATABASE` / `DROP SCHEMA` / `TRUNCATE`
- `prisma migrate reset`
- `prisma db push` against production
- `prisma migrate deploy` against production **without baselining first** (see §9 —
  prod has no `_prisma_migrations` table; a blind `deploy` will try to re-create
  existing objects and fail)
- restoring a dump **over** the live `safaar_temp` database
- exposing `5432` beyond `127.0.0.1`
- pointing `DATABASE_URL` at Neon / Railway / any external host

## 9. Migration procedure

**Current state (verified):** the production `safaar_temp` database has **62 tables
in `public`** and **no `_prisma_migrations` table** — the schema was applied by
`prisma db push` or a SQL restore, not by `prisma migrate deploy`. Consequently:

- `prisma migrate status` reports "no migration history" / drift against prod.
- `pnpm run prisma:deploy` (`prisma migrate deploy`) run against prod **will fail**
  (objects already exist).

**Schema drift vs. the 31 migration files in `apps/backend/prisma/migrations/`:
UNVERIFIED** — cannot be diffed here (Prisma engine binaries are unavailable on
this host).

**Recommended path forward (pick one, do it deliberately, back up first):**

1. **Baseline Prisma against prod** (preferred): generate a diff-free baseline, then
   `prisma migrate resolve --applied <name>` for each existing migration so the
   `_prisma_migrations` table reflects reality, after which normal
   `prisma migrate deploy` works. Do this in a maintenance window with a fresh
   backup taken immediately before.
2. **Stay on `db push`**: keep applying schema changes with `prisma db push`
   (schema-only, no history) and document that migrations/ is reference-only.
   Riskier for auditability; acceptable short-term.

Never let CI/CD auto-run `prisma migrate deploy` against prod until option 1 is
done. (Note: the stale root `railway.json` `startCommand` contains
`pnpm prisma migrate deploy` — it is not used, the backend is not on Railway.)

## 10. Disaster recovery

| Scenario | Exposure | Recovery |
|---|---|---|
| Postgres process crash | none (data on disk) | `systemctl restart postgresql`; backend `pg` pool reconnects |
| VM reboot | short downtime | services restart; PM2 `safaar-backend` is `pm2 save`-persisted |
| VM disk corruption / VM lost | **compute + local backups lost**; data recoverable from R2 | provision a new VM, install Postgres 14, `createdb safaar_temp`, `gunzip -c <latest>.sql.gz \| psql -d safaar_temp`, restore backend from `apps/backend` deploy, repoint DNS/`sslip.io` |
| Accidental bad write / bad migration | up to ~24 h of data | restore latest pre-incident dump **into a scratch DB**, extract the affected rows, apply manually — **do not** restore over prod |
| Neon | n/a | Neon is not production; nothing to recover |

- **RPO:** ~24 h (daily dump; no PITR).
- **RTO:** manual, estimate 1–3 h for a full new-VM rebuild (dominated by VM
  provisioning + `psql` restore of an ~18 MB / <1 MB-gzipped DB, i.e. fast).
- **Single point of failure:** the one VM (compute). Data is *not* single-point —
  daily dumps are copied to Cloudflare R2 off the VM.

---

## Neon — historical status (decommissioned)

Neon (host `ep-billowing-term-…neon.tech`, database `neondb`) was
an **earlier** hosted database. It is **no longer used by production** and its
compute quota is exhausted (connections fail).

**Decommission status:** the stale Neon `DATABASE_URL` has been scrubbed from the
tracked-template and local env files in this repo (`apps/backend/.env`,
`apps/backend/.env.production.backup` now use the `.env.example` local value;
`.env.local` remains the authoritative local config). Nothing in code, Prisma,
CI/CD, `scripts/deploy-production.sh`, or the production `backend.env` references
Neon. The Neon **project itself must be deleted manually from the Neon console**,
and the exposed `neondb_owner` credential should be treated as compromised
(rotate/retire it) — it sat in plaintext local env files.

If a developer's local `apps/backend/.env` still points `DATABASE_URL` at Neon,
replace it with the `.env.example` value or a personal local Postgres.

The `.githooks/pre-commit` guard and `.gitignore` `scratch.*` rules exist
because a Neon password was once committed via `scratch.js`; **keep those guards**
(they protect against secret commits in general, not just Neon).
