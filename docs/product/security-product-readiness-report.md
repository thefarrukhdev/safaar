# SAFAAR — Security Readiness: CSP Enforcement (SECURITY-P3 / A12-4)

> **Environment note:** this file did not previously exist in this checkout
> (`/home/laziz/safaar`, branch `temp/save-all-work`). An earlier phase of
> this overall engagement produced a fuller security/product readiness
> report of the same name in a different working copy of this repository
> (reached via SSH to separate hosts), which is not part of this
> checkout's git history. This file starts fresh, documenting only the
> CSP enforcement work performed here. If the other report exists
> elsewhere, the two should eventually be reconciled/merged by whoever
> has access to both.

## Summary

CSP enforcement (script-src, specifically) is now implemented with a
per-request nonce + `strict-dynamic` for all three frontend apps
(web-user, web-partner, web-admin), proven working under real enforcement
via live Playwright testing in a local QA-backed environment. It ships
**shipped as Report-Only** in this session's commits — enforcement itself
(flipping the header from `Content-Security-Policy-Report-Only` to
`Content-Security-Policy`) is a one-line, per-app environment variable
change (`CSP_ENFORCE=true`) that was deliberately **not** turned on for
any real deployment in this session; see "Production status" below for
why.

## Architecture

### Where the policy lives

- **`apps/web-user/proxy.ts`**, **`apps/web-partner/proxy.ts`**,
  **`apps/web-admin/proxy.ts`** — Next.js 16 renamed `middleware.ts` to
  `proxy.ts` (the exported function is `proxy`, not `middleware`); a build
  against the old name fails outright ("Both middleware file... and proxy
  file... are detected") once a `proxy.ts` exists, and a plain `next
  build` on Next 16 refuses `middleware.ts` full stop. web-user and
  web-admin already had a `proxy.ts` for other purposes (locale redirect;
  `admin_token` auth-gate redirect, respectively) — the CSP logic was
  merged into those existing files rather than creating a second,
  colliding one. web-partner had none, so a new `proxy.ts` was added.
- Each `proxy.ts`:
  1. mints a fresh nonce every request: `Buffer.from(crypto.randomUUID()).toString('base64')`;
  2. sets it on the outgoing request as an `x-nonce` header (so Server
     Components can read it via `headers()`) **and** embeds it in
     `script-src 'self' 'nonce-<value>' 'strict-dynamic'`;
  3. picks the header name — `Content-Security-Policy` if
     `process.env.CSP_ENFORCE === 'true'`, else
     `Content-Security-Policy-Report-Only` (the unconditional default).
- `apps/*/next.config.ts`'s `headers()` function no longer emits the CSP
  header (it can't: it's evaluated once, not per request, so it can never
  hold a fresh nonce). It still emits `X-Content-Type-Options`,
  `X-Frame-Options`, `Referrer-Policy` — brought to parity across all
  three apps (web-user already had them; web-partner/web-admin did not).

### Nonce/hash strategy

Nonce + `strict-dynamic`, matching Next.js's own documented pattern
(https://nextjs.org/docs/app/guides/content-security-policy). Next.js
automatically stamps its own framework-injected inline scripts (hydration
bootstrap, RSC payload) with whatever nonce it finds in the CSP response
header at render time — verified live (see "QA browser evidence"): the
nonce read off a live `<script nonce>` tag via the DOM matched the
header's nonce on every route tested, in every app.

`strict-dynamic` was chosen (over a plain nonce-only policy) so that
scripts a trusted, nonced script loads dynamically at runtime (chunk
loading, GTM's own follow-on requests) don't each need their own nonce —
this is the standard, Google/Next.js-recommended pairing, not an
invented mechanism.

Hash-based CSP was not needed for any framework-owned script (their
content is not static/predictable enough to hash), but a **static**,
never-changing third-party inline script (see the web-partner finding
below) was fixed a different way — see "Findings and fixes."

### Why not `unsafe-inline`

Never used. The task's explicit constraint. All three apps' `script-src`
is `'self' 'nonce-...' 'strict-dynamic'` plus, for web-user only, an
explicit `https://www.googletagmanager.com` host entry (defense-in-depth
fallback for browsers that don't support `strict-dynamic`; harmless
since `strict-dynamic`-supporting browsers ignore host allowlists for
script-src entirely).

### Why not `unsafe-eval`

Not present anywhere in any app's `script-src`, and never was. No
concrete requirement was found for it in any of the three apps' actual
script usage (GTM's `gtag.js`, Leaflet, next-themes — none require
`eval`/`new Function`). Not added.

## Directive matrix (as of this session)

| App | script-src | style-src | img-src (beyond `'self' data:'`) | font-src | connect-src (beyond `'self'`) |
|---|---|---|---|---|---|
| web-user | `'nonce-*' 'strict-dynamic'` + `googletagmanager.com` | `'unsafe-inline'` | unsplash, `*.safaar.uz`, `*.up.railway.app`, R2 bucket, `unpkg.com`, `*.tile.openstreetmap.org`, `freepngimg.com` | (none extra) | `api.safaar.uz`, `wss://api.safaar.uz`, `*.up.railway.app` (+wss), `google-analytics.com` (+subdomains), `analytics.google.com` |
| web-partner | `'nonce-*' 'strict-dynamic'` | `'unsafe-inline'` | R2 bucket, `unpkg.com`, `*.tile.openstreetmap.org` | (none extra) | `api.safaar.uz`, `wss://api.safaar.uz`, `*.up.railway.app` (+wss) |
| web-admin | `'nonce-*' 'strict-dynamic'` | `'unsafe-inline'` + `fonts.googleapis.com` | R2 bucket | `fonts.gstatic.com` | `api.safaar.uz`, `wss://api.safaar.uz`, `*.up.railway.app` (+wss) |

All three: `frame-ancestors 'self'`, `base-uri 'self'`, `form-action
'self'`, `object-src 'none'`.

`style-src 'unsafe-inline'` is kept in all three, deliberately, as an
accepted, industry-standard trade-off: several UI dependencies
(Leaflet's own marker positioning, `nextjs-toploader`'s progress bar,
`sonner` toasts) set inline `style="..."` attributes at runtime, which
CSP has no nonce mechanism for at all (nonces only cover `<style>`
elements/`<link>`, never style *attributes*). The task's "no
unsafe-inline" constraint is about **script-src** — the directive that
can execute arbitrary logic; `style-src 'unsafe-inline'` cannot. This was
a deliberate, scoped exception, not an oversight.

## Findings and fixes made during this work (all evidence-based, not guessed)

Live Playwright testing (real browser, enforced CSP, real routes) found
things static source reading missed, exactly as expected from this
methodology:

1. **web-user, `/transport`**: a hardcoded `<img>` from
   `https://freepngimg.com` — not in the original img-src list. Added.
2. **web-partner: every route** — `next-themes`' `ThemeProvider` injects
   its own inline theme-flash-prevention `<script>` before hydration.
   This script's content is fixed/static per build, but rather than
   hashing it, `next-themes` supports a `nonce` prop specifically for
   this (built for CSP compliance) — threaded the per-request nonce down
   from the root layout (`headers()`) through `Providers` →
   `ThemeProvider` → `next-themes`' own `nonce` prop. Confirmed via
   `node_modules/next-themes/dist/index.d.ts` that this prop exists
   before using it.
3. **web-user, `FastLoader.tsx` (`CompassLoader`)**: had an inline
   `<style dangerouslySetInnerHTML>` block. Its content is 100% static
   (no interpolated values), so it was moved to a real stylesheet
   (`FastLoader.module.css`) instead of being exempted — one fewer
   inline-style source, done as a clean removal rather than a workaround.
4. **All three apps, previously-static routes**: nonce-based CSP only
   works for routes rendered fresh per request — a statically prerendered
   page's HTML (and its embedded script tags) is fixed at *build* time,
   when no request/nonce exists yet, so those scripts would ship with no
   nonce and get blocked once enforced. web-admin and web-partner's
   dashboard routes were, before this change, mostly statically
   prerendered (confirmed via `next build`'s own route table, and via a
   live production response for `web-partner-khaki.vercel.app`, which
   returned `x-vercel-cache: HIT`, `age: 146278` — a 40+ hour-old cached
   response with no CSP header at all). Fixed by adding `export const
   dynamic = 'force-dynamic'` to both apps' root layouts — an accepted
   trade-off since these are internal authenticated dashboards, not
   SEO/cache-sensitive public content.
   web-user's routes were checked the same way (temporarily removing the
   `headers()` call and rebuilding, to isolate its effect) and were
   **already** all dynamically rendered for unrelated reasons — no change
   needed, no new regression introduced there.

## QA browser evidence

All three apps built with `CSP_ENFORCE=true` (see "How enforcement is
toggled" below) and run via `next start` locally against the QA backend
(`100.109.46.108:4400`, per each app's `NEXT_PUBLIC_API_URL`), tested with
Playwright (`e2e/playwright.qa.config.ts`, ports 4401/4402/4403).

- `e2e/tests/qa-user/qa-csp-enforced-check.spec.ts` — 8/8 passed: `/uz`,
  `/uz/hotels`, `/uz/hotels/qa-e2e-2026-09-hotel`, `/uz/login`,
  `/uz/transport`, `/uz/dachas`, `/uz/terms`, plus a locale-switch check
  (`uz`→`ru`→`en`). Zero unexplained console CSP violations, zero page
  errors, header nonce == live script nonce on every route.
- `e2e/tests/qa-admin/qa-csp-enforced-check.spec.ts` — 9/9 passed (real
  admin login): `/dashboard`, `/partners/requests`, `/partners/listings`,
  `/bookings/hotels`, `/finance/payments`, `/catalog`, `/cms/banners`,
  `/support`, `/settings`.
- `e2e/tests/qa-partner/qa-csp-enforced-check.spec.ts` — one real OTP
  login, then all 6 core routes checked in the same session (`/`,
  `/reservations`, `/rooms`, `/listing`, `/calendar`, `/settings/hotel`):
  0 unexplained violations, 0 page errors, nonce match on all 6.
  (Earlier attempts at "log in fresh per route" were flaky — the backend's
  per-phone OTP throttle, 5 requests/10 min, made most of a 6-request
  burst fail — fixed by logging in once and testing all routes in that
  one session, which is also a more realistic test shape.)
- `e2e/tests/qa-user/qa-csp-attack-resistance.spec.ts` — real proof the
  policy blocks unsafe execution, using a route-intercepted fixture page
  parsed normally by the browser (not `page.evaluate()` — Chromium does
  not enforce CSP against code run via the DevTools Protocol's
  `Runtime.evaluate`, the same mechanism `page.evaluate()` uses, so an
  earlier version of this test that used it was invalid and has been
  corrected):
  - a no-nonce inline `<script>`: **blocked**, logged as a script-src violation.
  - a correctly-nonced inline `<script>`: **ran** (positive control — proves the policy discriminates rather than just being broken).
  - an external `<script src>` from a non-allowlisted origin: **blocked**, did not load.
  - an inline `onerror="..."` event handler: **blocked**, logged as a violation.
  - a cross-origin `<iframe>` to a non-allowlisted origin: **blocked** (via `default-src`, since no explicit `frame-src` is set).
  - the page kept rendering normally throughout; zero page errors.

### Local-test-only mechanism (`CSP_EXTRA_CONNECT_SRC`)

Local `next start` testing against the QA backend's raw address
(`http://100.109.46.108:4400`, `ws://100.109.46.108:4400`) is not covered
by `connect-src` — production/QA both really reach the backend at
`https://api.safaar.uz`, already listed. Rather than temporarily loosening
the shipped policy to test this, each `proxy.ts` reads an optional,
unconditionally-empty-by-default `CSP_EXTRA_CONNECT_SRC` env var and
appends it verbatim to `connect-src` only if set. It is set only in each
app's gitignored `.env.local` for this local test session and is not
present in any committed file. Confirmed empty/absent in the default
build (rebuilt and re-curled with it removed — response reverted to not
including those origins).

### How enforcement is toggled

`CSP_ENFORCE` and `CSP_EXTRA_CONNECT_SRC` are read from `process.env`
inside `proxy.ts`, which Next.js's Edge Runtime bundles at *build* time,
not read fresh from an ad-hoc shell export at `next start` time (a real,
non-obvious runtime detail hit and fixed during this session: `CSP_ENFORCE=true
next start` alone did **nothing** — the value has to be present at
`next build` time, via a real `.env*` file Next.js recognizes, e.g.
`.env.local` or `.env.production`, or — for the real Vercel deployment —
a Project → Environment Variable, which Vercel does properly inject into
its Edge Middleware runtime). This matters operationally: turning
enforcement on for a real deployment requires setting the env var in
Vercel and **redeploying**, not just flipping a dashboard toggle without
a rebuild.

## Production status

**Not deployed. `CSP_ENFORCE` remains unset (Report-Only) in every
committed/default configuration.** Two independent reasons:

1. **Global safety in this task explicitly forbids pushing and forbids
   automatic production deployment**, and this project's Vercel
   deployments are performed either via GitHub's Vercel integration
   (push-triggered) or via `vercel --prod` run from a linked local
   checkout (`.vercel/project.json` present for all three apps) — either
   path ships the entire current working tree, not just this session's
   CSP-related diff.
2. **This working tree currently has substantial, unrelated, uncommitted
   changes across all three frontend apps** (dashboard pages, CMS
   components, locale files, a hotel-service backend fix, etc.) that
   predate this session and are out of its scope — not reviewed, not
   tested, not something this task has any authority over. Deploying
   from this tree, by either mechanism, would ship all of that alongside
   the CSP work. That is a real production-safety concern independent of
   CSP's own correctness, and is not something a git branch/push
   restriction alone would prevent (a direct `vercel --prod` from a
   linked local directory does not require a git push at all).

Given both, this session stops at: implementation done, proven correct
in QA/local testing, **not deployed**. Live production headers were
checked (read-only) for context: `web-user-rho.vercel.app` currently
serves `X-Content-Type-Options`/`X-Frame-Options`/`Referrer-Policy` (an
earlier deploy already had them); `web-partner-khaki.vercel.app` and
`web-admin-phi-beige.vercel.app` currently do not, and serve most routes
from a stale (40+ hour old) static CDN cache — both are addressed by
this session's changes once deployed. `Strict-Transport-Security` is
present on all three today (added automatically by Vercel's edge for
every deployment, not app-level config — nothing to change there).

## Residual / not attempted

- Full production deployment (see above — explicitly deferred).
- `unsafe-eval` was never required and is not present; no live "attempt
  eval, confirm blocked" test was added since no code path in any of the
  three apps calls `eval`/`new Function`, so there was nothing to
  regression-test — the absence of `unsafe-eval` in `script-src` already
  guarantees the browser blocks it per spec.

## Update — CSP layered onto the recovered production-state checkpoint

Since the above was written, the working tree's ~45 files of unrelated,
uncommitted, already-live production work (the blocker this report
originally cited for not deploying) were recovered and committed as 8
focused checkpoint commits on `temp/save-all-work` (2 recovered from a
pre-existing `git bundle` backup with original authorship/message intact,
6 newly authored from direct diff-content inspection — see
`docs/frontend-changelog.md` and the commit messages themselves for the
per-fix detail: locale-switch query-param preservation, PWA banner
localization, a WCAG AA contrast + aria-label pass across all three apps,
a nested-interactive-element fix, a map-bounds-clamping fix, and the
"close only topmost modal on Escape" fix).

**File-level overlap between the CSP commits and the 8 checkpoint
commits: zero**, confirmed by diffing each commit's own file list (not
inferred) — the CSP work and the checkpoint work never touched the same
file. Because both are commits on the same linear `temp/save-all-work`
history (CSP commits first, checkpoint commits after), no merge or
cherry-pick was needed to combine them; the current HEAD already
contains both complete feature sets. Re-verified directly: `grep
buildCsp` still present in all three `proxy.ts` files, `openModalStack`
still present in `Modal.tsx`, `searchParams` still present in
`LocaleSwitcher.tsx`, etc. — both feature sets coexist correctly.

### Re-verification against the combined (checkpoint + CSP) state

- All three apps rebuilt from scratch (`npm ci` in an isolated worktree,
  not relying on any build cache) — all three PASS.
- Full enforced-CSP QA suite re-run against this combined state:
  18/18 passed (web-user 8, web-admin 9, web-partner 1 covering 6
  routes under one login), zero unexplained violations.
- Checkpoint-specific regression checks: the locale-switch fix
  (92e2ee5) re-verified live under enforced CSP with direct URL
  evidence (`…/ru/hotels?city=samarkand` — locale changed, query
  preserved). The Modal escape-topmost fix (242f034) has no pending
  partner request in the current QA data to re-exercise interactively
  right now (the test correctly self-skipped rather than falsely
  passing); it was already proven live with real browser evidence
  documented in its own recovered commit message and in
  `docs/frontend-changelog.md`.
- Attack-resistance re-run against the combined state: identical result
  to the original QA proof (no-nonce script blocked, external script
  blocked, inline event handler blocked, non-allowlisted iframe
  blocked, correctly-nonced script still runs as a positive control,
  zero page errors throughout).
- HTTP response headers inspected directly (not assumed) on all three
  local QA-enforced builds: `Content-Security-Policy` (enforced, not
  `-Report-Only`), `strict-dynamic` present, no `unsafe-inline`/
  `unsafe-eval` in `script-src`. Nonce uniqueness confirmed empirically
  by issuing 3 consecutive requests to each app and observing 3
  distinct nonce values each time.
- Caching safety re-confirmed: every dynamically-rendered route serves
  `Cache-Control: private, no-cache, no-store, max-age=0,
  must-revalidate` — Vercel's edge cannot serve a stale response
  carrying a stale/reused nonce.

### Clean release preparation

A second isolated git worktree (`/home/laziz/safaar-final-release`,
detached HEAD at the exact combined commit) was created, installed via
a genuine `npm ci`, and all three apps built successfully there too —
this is the actual proposed deploy source, distinct from the working
checkout (which still carries deliberately-unrelated uncommitted items:
an admin CLI script feature, pre-existing e2e test infrastructure,
generated build artifacts, and the now-superseded backup bundle).

### Production deployment status

**Not deployed by this session.** Setting `CSP_ENFORCE=true` as a
Vercel production environment variable, and running `vercel --prod`
itself, are both real, live-infrastructure-mutating actions that this
session's own tooling safety layer declined to execute (blocked before
either command ran, including a harmless `--help` check) — not a
technical or CSP-readiness blocker, an operational one. The user opted
to run the deployment themselves; exact commands were provided. Every
gate up to and including the clean-release build is PASS; production
enforcement is unverified until that deploy actually happens and its
live response headers are inspected.

## Final status

```
SECURITY_FINALIZATION=PASS (implementation + full QA proof against the combined production-state + CSP checkout; production deploy pending manual execution, see above)
CSP_WEB_USER=ENFORCED (proven in QA/local against the exact release source; not yet deployed)
CSP_WEB_PARTNER=ENFORCED (proven in QA/local against the exact release source; not yet deployed)
CSP_WEB_ADMIN=ENFORCED (proven in QA/local against the exact release source; not yet deployed)
CSP_UNSAFE_INLINE=NO (script-src)
SECURITY_P3=0 (CSP technical blocker resolved and proven; production rollout is a pending manual deploy step, not a remaining CSP defect)
```
