# Uzum Checkout — static outbound IP (application-scoped egress proxy)

**Status:** proxy live on `safaar-gateway`, verified. Backend env var NOT yet
set (waiting on the official Uzum Checkout wire-format + a code deploy that
actually issues outbound calls — today the `register/getOrderStatus/
getOperationState/refund` methods are fail-closed stubs).

**No secrets in this repo.** The proxy credential lives only in
`safaar-gateway:/etc/tinyproxy/tinyproxy.conf` (mode 0640, root-owned) and
in `backend.env` on the production host (`UZUM_CHECKOUT_HTTPS_PROXY`). A
reference copy of the full URL is at `safaar-gateway:/root/uzum-checkout-proxy-url.txt`
(mode 0600).

---

## Problem

Only **SAFAAR backend → Uzum Checkout** traffic must leave from a guaranteed
stable public IP (Uzum merchant allowlist). The production backend host
(`Scarygun99` / Tailscale `baito` / `100.109.46.108`) egresses through a
home/office ISP: `188.113.198.155`, which is not guaranteed stable and is
**shared with unrelated Baito production containers** on the same host.

Constraints: do **not** route the whole host through a Tailscale exit node
(would move Baito's egress too); do **not** build a general-purpose proxy.

## Design (option B — application-scoped forward proxy)

```
safaar-backend container  (baito host, docker network "safaar-network")
      │   ONLY Uzum Checkout requests — fetch(url,{ dispatcher: outboundDispatcher() })
      │   (undici ProxyAgent; NO setGlobalDispatcher — nothing else is affected)
      ▼   Tailscale  100.109.46.108 → 100.105.86.75
tinyproxy @ safaar-gateway   listen 100.105.86.75:3128  (tailscale0 ONLY)
      │   BasicAuth + Allow 100.109.46.108 + Filter *.uzumbank.uz + CONNECT :443 only
      ▼
eth0 (10.128.0.12) → Yandex Cloud 1:1 NAT → 51.250.78.204 → Uzum
```

Alternatives rejected: **A** host-wide Tailscale exit node (breaks Baito
isolation; also currently non-functional — the gateway advertises `0.0.0.0/0`
but tailnet→tailnet forwarding is dropped and exit-node is not enabled);
**C** dedicated egress VM (more infra/cost/maintenance for no isolation gain
over B); **D** no existing Yandex NAT gateway / Cloud NAT resource exists in
the folder.

## safaar-gateway (Yandex Cloud, `fhmt89g9qknf7h17m8pq`, folder `b1ganpgh57a48ma726lh`)

| Item | Value |
| --- | --- |
| Private IP (eth0) | `10.128.0.12/24`, network `e9bogjn4olp6qb4k4gh6` |
| External IP | `51.250.78.204`, accessConfig type `ONE_TO_ONE_NAT` (from instance metadata) |
| Reserved / static? | **VERIFY in Yandex console / `yc vpc address list` — see below.** Metadata does not distinguish reserved from ephemeral. |
| Also runs | Caddy (`api.safaar.uz` → `100.109.46.108:4100` over Tailscale), `uptime-kuma` (127.0.0.1:3001). **Unchanged.** |

### Static-IP verification (do before giving the IP to Uzum)

```
yc vpc address list --folder-id b1ganpgh57a48ma726lh --format json
# entry with external_ipv4_address.address == "51.250.78.204":
#   "reserved": true   → static, survives stop/start  ✅ safe to hand to Uzum
#   "reserved": false / absent → ephemeral: RESERVE IT FIRST
#     yc vpc address create --external-ipv4 address=51.250.78.204 --name safaar-uzum-egress
#     (or reserve a fresh static IP and attach it to safaar-gateway, then re-verify egress)
```
Console: VPC → IP addresses (folder `b1ganpgh57a48ma726lh`) → `51.250.78.204`
→ Type must read **Static** (not Ephemeral/Dynamic), attached to
`safaar-gateway`.

## tinyproxy config (`/etc/tinyproxy/tinyproxy.conf`)

```
Port 3128
Listen 100.105.86.75          # tailscale0 address ONLY (public IP has no listener)
Allow 100.109.46.108          # SAFAAR backend Tailscale IP
Allow 127.0.0.1               # on-box ops checks only
BasicAuth safaar-uzum <generated 48-hex>
ConnectPort 443               # HTTPS CONNECT only
FilterDefaultDeny Yes
Filter "/etc/tinyproxy/filter"   #  (^|\.)uzumbank\.uz$ / (^|\.)uzum\.uz$ / (^|\.)uzumcheckout\.uz$
FilterExtended On
FilterCaseSensitive Off
DisableViaHeader Yes
LogLevel Connect              # logs "CONNECT host:443" + client IP only — no
                             # URL path, headers, body, Authorization, card data
```
`systemctl enable --now tinyproxy` (enabled + active).

**2026-09-11 update**: the real Uzum Checkout TEST host was confirmed as
`test-chk-api.uzumcheckout.uz` — a **different second-level domain from
`uzumbank.uz`** (Checkout lives on `uzumcheckout.uz`; Merchant API/portal
on `uzumbank.uz`). `(^|\.)uzumcheckout\.uz$` was added to the filter and
verified end-to-end: `safaar-backend` container → proxy → `test-chk-api.
uzumcheckout.uz/health` → `200 "Hello"`, egressing via `51.250.78.204`.
The exact production Checkout host is still unconfirmed — likely a sibling
of `uzumcheckout.uz` (e.g. `chk-api.uzumcheckout.uz`), add it here once
known rather than guessing.

**Separately discovered, unresolved blocker**: `test-chk-api.uzumcheckout.uz`
returns HTTP 403 (generic nginx) for every path/method/header combination
tried except the literal `GET /health` — identically from this proxy's
egress IP (`51.250.78.204`) and from an unrelated IP, with or without
placeholder auth headers. This is consistent with an **IP allowlist at
Uzum's edge that neither IP is on yet** — likely needs `51.250.78.204` to
be registered with Uzum during onboarding before any authenticated call
(even with valid credentials) can succeed. Not something fixable from this
side; needs confirmation from Uzum.

### Defense-in-depth firewall

`/usr/local/sbin/safaar-uzum-proxy-fw.sh` + `safaar-uzum-proxy-fw.service`
(enabled, oneshot, `RemainAfterExit`): independent nftables table
`inet safaar_uzum_proxy`, hook input priority `-150` —
`iif lo accept; iifname tailscale0 accept; tcp dport 3128 drop`.
So even if `Listen` were widened by mistake, 3128 stays unreachable off
`tailscale0`. Separate table → unaffected by Docker/Tailscale rule reloads.

## Backend wiring (in this repo)

`UZUM_CHECKOUT_HTTPS_PROXY=http://safaar-uzum:<pass>@100.105.86.75:3128`
in `backend.env` (only). Consumed by
`UzumCheckoutProvider.outboundDispatcher()` →
`buildUzumCheckoutProxyDispatcher()` (undici `ProxyAgent({ uri, token })`,
cached). Passed per-request as `fetch(url, { dispatcher })` by the outbound
Checkout methods only. Empty/unset → `undefined` → direct route (today's
behaviour). Malformed → app refuses to boot (`env.validation.ts`) /
`PROXY_MISCONFIGURED` (provider). Credential is redacted in logs
(`redactProxyUrl` / `outboundProxyUrlForLog`). `setGlobalDispatcher` is
never called — SMS/email/CBU-rate/webhook/OAuth and Baito traffic are
untouched.

## Verification performed (2026-09-09/10, from the running `safaar-backend` container netns)

| Check | Result |
| --- | --- |
| baseline `fetch()` (no dispatcher) | `188.113.198.155` (unchanged) |
| pure-Node `CONNECT` via proxy → ipify / checkip.amazonaws.com | `51.250.78.204` |
| **undici `ProxyAgent` + `fetch({dispatcher})`** → ipify | HTTP 200, `51.250.78.204` |
| global dispatcher after building ProxyAgent | unchanged (`===`) |
| CONNECT `www.google.com` via proxy | `403` (filtered) |
| proxy without credentials | `407` |
| public Internet → `51.250.78.204:3128` | timeout (nft drop) |
| other Tailscale node + valid creds → `:3128` | `403` (not in Allow) |
| `api.safaar.uz/v1/health` | `200` |
| Baito containers + Baito egress IP | unchanged (`188.113.198.155`, 0 restarts) |
| `safaar-backend` container | healthy, `RestartCount=0`, not restarted |

## Rollback

1. **Backend:** remove `UZUM_CHECKOUT_HTTPS_PROXY` from `backend.env`,
   redeploy (or restart the container). Outbound Checkout calls revert to
   the direct route. Nothing else changes.
2. **Proxy (optional):** `systemctl disable --now tinyproxy safaar-uzum-proxy-fw`
   then `apt-get purge -y tinyproxy` and
   `rm /usr/local/sbin/safaar-uzum-proxy-fw.sh /etc/systemd/system/safaar-uzum-proxy-fw.service /root/uzum-checkout-proxy-url.txt`.
   Caddy / `api.safaar.uz` / Tailscale / Baito are independent of all of the
   above and are unaffected either way.
3. Rotating the credential: edit `BasicAuth` in `tinyproxy.conf`,
   `systemctl reload tinyproxy`, update `backend.env`, redeploy.
