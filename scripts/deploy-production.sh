#!/usr/bin/env bash
#
# PHASE 14T — Safe, deterministic production deploy for the real Docker
# runtime (`safaar-backend` on `safaar-backend-new`).
#
# Runs ON the production host, invoked over SSH by the self-hosted
# GitHub Actions runner (which lives on this same host). Intended to be
# called from a checked-out copy of the repository at exactly the
# commit being deployed — see .github/workflows/backend-deploy.yml.
#
# Usage:
#   scripts/deploy-production.sh <full-40-char-commit-sha>
#
# Design principles (do not weaken these without re-reading PHASE 14O-14S):
#   - Never touch the running container until a new image has been
#     built AND verified.
#   - Never fetch/pull from a remote during deploy — the commit must
#     already be present locally (this script only reads git history
#     that's already there).
#   - Never let this script write/generate backend.env — it only
#     verifies the pre-existing file.
#   - Never invoke `docker compose` against the stale
#     /home/scarygun/safaar-src build context — that would silently
#     rebuild old (pre-14E) code and regress production.
#   - Any failure past the point of touching the running container
#     triggers automatic rollback to the previously-running image.
#   - Never run prisma migrate/db push/db seed. Ever.

set -euo pipefail

# ---------------------------------------------------------------------------
# 0. Arguments & constants
# ---------------------------------------------------------------------------

TARGET_SHA="${1:-}"

if [[ ! "$TARGET_SHA" =~ ^[0-9a-f]{40}$ ]]; then
  echo "FATAL: argument must be a full 40-character commit SHA (got: '${TARGET_SHA}')." >&2
  echo "       Branch names, 'latest', 'HEAD', and short SHAs are refused on purpose." >&2
  exit 1
fi

readonly TARGET_SHA
readonly EXPECTED_TAILSCALE_IP="100.109.46.108"
readonly CONTAINER_NAME="safaar-backend"
readonly IMAGE_REPO="safaar-backend"
readonly NEW_IMAGE="${IMAGE_REPO}:${TARGET_SHA}"
readonly NETWORK_NAME="safaar-network"
readonly HOST_PORT="4100"
readonly CONTAINER_PORT="4000"
readonly COMPOSE_DIR="/home/scarygun/safaar-stack"
readonly ENV_FILE="${COMPOSE_DIR}/backend.env"
readonly SRC_DIR="/home/scarygun/safaar-src-${TARGET_SHA}"
readonly DOCKERFILE_REL="apps/backend/Dockerfile"
readonly HEALTH_TIMEOUT_SECONDS=240   # bounded; compose's own start_period is 180s
readonly HEALTH_POLL_INTERVAL=5

log() { echo "[deploy-production] $*"; }
fail() { echo "[deploy-production] FATAL: $*" >&2; exit 1; }

# ---------------------------------------------------------------------------
# STEP 6 — PRODUCTION GUARDRAILS (must all pass before ANY destructive action)
# ---------------------------------------------------------------------------

guardrails() {
  log "Running pre-flight guardrails..."

  # Host identity: refuse to run anywhere except the known production host.
  local tailscale_ip
  tailscale_ip="$(ip -4 addr show 2>/dev/null | grep -oE '100\.109\.46\.108' | head -n1 || true)"
  if [[ "$tailscale_ip" != "$EXPECTED_TAILSCALE_IP" ]]; then
    fail "This host does not have the expected production Tailscale IP ${EXPECTED_TAILSCALE_IP}. Refusing to deploy."
  fi

  # Compose file / env file must exist (we only ever read them).
  [[ -f "${COMPOSE_DIR}/docker-compose.safaar.yml" ]] || fail "Expected compose file not found at ${COMPOSE_DIR}/docker-compose.safaar.yml."
  [[ -r "$ENV_FILE" ]] || fail "Production env file ${ENV_FILE} is missing or not readable."

  # backend.env DATABASE_URL sanity — value NEVER printed, only grep -q booleans.
  if ! grep -q '^DATABASE_URL=.*@safaar-db:5432/safaar_temp' "$ENV_FILE"; then
    fail "backend.env DATABASE_URL does not point at safaar-db:5432/safaar_temp as expected (value withheld)."
  fi
  if grep -q '^DATABASE_URL=.*127\.0\.0\.1' "$ENV_FILE"; then
    fail "backend.env DATABASE_URL references 127.0.0.1 — this matches the known shadow/Baito misconfiguration. Refusing to deploy."
  fi
  if grep -q '^DATABASE_URL=.*safaar_prod' "$ENV_FILE"; then
    fail "backend.env DATABASE_URL references safaar_prod — this is NOT the real production database. Refusing to deploy."
  fi

  # Network must exist and be named exactly as expected.
  docker network inspect "$NETWORK_NAME" >/dev/null 2>&1 \
    || fail "Expected Docker network '${NETWORK_NAME}' does not exist."

  # If a safaar-backend container already exists, it must be the one we
  # expect to manage (correct name, correct network, correct port map).
  if docker inspect "$CONTAINER_NAME" >/dev/null 2>&1; then
    local actual_network actual_port
    actual_network="$(docker inspect "$CONTAINER_NAME" --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}{{end}}')"
    actual_port="$(docker inspect "$CONTAINER_NAME" --format '{{range $p,$b := .HostConfig.PortBindings}}{{$p}}->{{(index $b 0).HostPort}}{{end}}')"

    [[ "$actual_network" == "$NETWORK_NAME" ]] \
      || fail "Existing '${CONTAINER_NAME}' container is on network '${actual_network}', expected '${NETWORK_NAME}'. Refusing to touch it."
    [[ "$actual_port" == "${CONTAINER_PORT}/tcp->${HOST_PORT}" ]] \
      || fail "Existing '${CONTAINER_NAME}' container port mapping is '${actual_port}', expected '${CONTAINER_PORT}/tcp->${HOST_PORT}'. Refusing to touch it."
  else
    log "No existing '${CONTAINER_NAME}' container found — this will be a first-time start, not a replacement."
  fi

  log "Guardrails passed."
}

# ---------------------------------------------------------------------------
# STEP 4 — SOURCE ACQUISITION (no fetch/pull; must already be local)
# ---------------------------------------------------------------------------
#
# NOTE ON DESIGN: this script runs as `scarygun` over SSH, on the same
# physical host as the self-hosted runner but NOT inside the runner's
# own container/filesystem (the runner has no Docker socket or host
# filesystem access — that's precisely why deployment goes through SSH
# to a real host user at all). So this script cannot itself do
# `git archive` from "the repo it's running in" — there isn't one.
#
# Instead, the calling workflow (which DOES have the exact commit via
# `actions/checkout`) is responsible for producing the isolated source
# tree at $SRC_DIR via `git archive ${TARGET_SHA} | ssh ... tar -x`
# BEFORE invoking this script — exactly the mechanism proven in
# PHASE 14R, just automated. This script's job here is to verify that
# handoff happened correctly and matches the requested SHA, not to
# perform network/git operations of its own (per the "no fetch/pull
# during deploy" rule).

acquire_source() {
  log "Verifying pre-staged source at ${SRC_DIR} for commit ${TARGET_SHA}..."

  [[ -d "$SRC_DIR" ]] \
    || fail "${SRC_DIR} does not exist. The calling workflow must populate it via 'git archive ${TARGET_SHA} | ssh ... tar -x -C ${SRC_DIR}' before invoking this script."

  [[ -f "${SRC_DIR}/.deploy-source-sha" ]] \
    || fail "${SRC_DIR}/.deploy-source-sha marker is missing — cannot verify the staged source matches ${TARGET_SHA}. Refusing to build from unverified source."

  local staged_sha
  staged_sha="$(cat "${SRC_DIR}/.deploy-source-sha")"
  [[ "$staged_sha" == "$TARGET_SHA" ]] \
    || fail "${SRC_DIR}/.deploy-source-sha contains '${staged_sha}', expected '${TARGET_SHA}'. Refusing to build from mismatched source."

  [[ -f "${SRC_DIR}/${DOCKERFILE_REL}" ]] \
    || fail "Staged source is missing ${DOCKERFILE_REL} — refusing to build."

  log "Staged source verified: matches ${TARGET_SHA}, Dockerfile present."
}

# ---------------------------------------------------------------------------
# STEP 11 — RECORD ROLLBACK STATE (before anything destructive)
# ---------------------------------------------------------------------------

OLD_IMAGE=""
OLD_IMAGE_ID=""
OLD_CONTAINER_EXISTS="false"

record_rollback_state() {
  if docker inspect "$CONTAINER_NAME" >/dev/null 2>&1; then
    OLD_CONTAINER_EXISTS="true"
    OLD_IMAGE="$(docker inspect "$CONTAINER_NAME" --format '{{.Config.Image}}')"
    OLD_IMAGE_ID="$(docker inspect "$CONTAINER_NAME" --format '{{.Image}}')"
    log "Recorded rollback target: image='${OLD_IMAGE}' image_id='${OLD_IMAGE_ID}'"

    docker image inspect "$OLD_IMAGE" >/dev/null 2>&1 \
      || fail "Old image '${OLD_IMAGE}' referenced by the running container is no longer present locally — refusing to proceed without a valid rollback target."
  else
    log "No existing container to record a rollback target from (first-time deploy)."
  fi
}

# ---------------------------------------------------------------------------
# STEP 8 — DOCKER BUILD (must complete before touching the running container)
# ---------------------------------------------------------------------------

build_image() {
  log "Building ${NEW_IMAGE} from ${SRC_DIR} (this does not touch the running container)..."
  docker build \
    -t "$NEW_IMAGE" \
    -f "${SRC_DIR}/${DOCKERFILE_REL}" \
    "$SRC_DIR"

  docker image inspect "$NEW_IMAGE" >/dev/null 2>&1 \
    || fail "Build reported success but image ${NEW_IMAGE} is not present — aborting."

  log "Image ${NEW_IMAGE} built and verified present."
}

# ---------------------------------------------------------------------------
# STEP 9 — VERIFY SECURITY FIXES ARE PRESENT IN THE BUILT IMAGE
# ---------------------------------------------------------------------------

verify_security_fixes() {
  log "Verifying 14E-14I security fixes are present in ${NEW_IMAGE}..."

  local base="apps/backend/dist/src"
  local checks=(
    "common/phone-throttle.guard.js:normalizePhone"
    "auth/auth.controller.js:Throttle"
    "partner-api/partner-api.service.js:partner_organization_id"
    "uploads/uploads.service.js:resolveOwnR2Object"
    "auth/auth.service.js:revokeActor"
    "chat/chat.service.js:isAdminOperator"
    "bookings/bookings.service.js:withIdempotency"
  )

  local entry file pattern
  for entry in "${checks[@]}"; do
    file="${entry%%:*}"
    pattern="${entry##*:}"
    docker run --rm "$NEW_IMAGE" sh -c "grep -q '${pattern}' '${base}/${file}'" \
      || fail "Expected security fix marker '${pattern}' not found in ${file} inside ${NEW_IMAGE}. Refusing to deploy — production must never regress a known fix."
  done

  log "All expected security fix markers present."
}

# ---------------------------------------------------------------------------
# STEP 10 — VERIFY STARTUP DOES NOT AUTO-MIGRATE
# ---------------------------------------------------------------------------

verify_no_auto_migration() {
  log "Verifying the image's startup command does not run migrations..."

  local cmd
  cmd="$(docker inspect "$NEW_IMAGE" --format '{{json .Config.Cmd}}')"
  case "$cmd" in
    *migrate*|*"db push"*|*"db-push"*|*"db_push"*|*seed*)
      fail "Image CMD looks like it may invoke a migration/seed step (${cmd}). Refusing to deploy." ;;
  esac
  # The container must start via `pnpm --filter @safaar/backend run start:prod`
  # (see apps/backend/Dockerfile CMD) — not a hand-rolled command that could
  # bypass the start:prod script we verify below.
  case "$cmd" in
    *@safaar/backend*start:prod*|*start:prod*@safaar/backend*) : ;;
    *) fail "Image CMD is ${cmd}, expected a 'pnpm --filter @safaar/backend run start:prod' start. Refusing to deploy." ;;
  esac

  # `pnpm --filter @safaar/backend run start:prod` resolves the script from the
  # BACKEND workspace manifest — the repo-root package.json has no start:prod.
  docker run --rm "$NEW_IMAGE" sh -c "grep -q '\"start:prod\"' apps/backend/package.json" \
    || fail "Could not confirm the @safaar/backend start:prod script exists as expected."
  docker run --rm "$NEW_IMAGE" sh -c "grep -q '\"start:prod\": \"[^\"]*node dist/src/main.js\"' apps/backend/package.json" \
    || fail "start:prod does not resolve to a plain 'node dist/src/main.js' invocation — refusing to deploy without manual review."

  log "Startup command confirmed to be a plain application start, no migration invocation."
}

# ---------------------------------------------------------------------------
# STEP 12 — DEPLOY NEW CONTAINER (only after every prior check passed)
# ---------------------------------------------------------------------------

deploy_new_container() {
  if [[ "$OLD_CONTAINER_EXISTS" == "true" ]]; then
    log "Stopping and removing the previous '${CONTAINER_NAME}' container (image ${OLD_IMAGE})..."
    docker stop "$CONTAINER_NAME" >/dev/null
    docker rm "$CONTAINER_NAME" >/dev/null
  fi

  log "Starting new '${CONTAINER_NAME}' container with production settings (image ${NEW_IMAGE})..."
  docker run -d \
    --name "$CONTAINER_NAME" \
    --network "$NETWORK_NAME" \
    -p "${EXPECTED_TAILSCALE_IP}:${HOST_PORT}:${CONTAINER_PORT}" \
    --env-file "$ENV_FILE" \
    -e HOST=0.0.0.0 \
    -e NODE_OPTIONS="--max-old-space-size=1024" \
    --restart unless-stopped \
    --memory=1536m --memory-reservation=768m --cpus=1.5 --cpu-shares=1024 \
    --health-cmd="node -e \"require('http').get('http://127.0.0.1:${CONTAINER_PORT}/v1/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))\"" \
    --health-interval=15s --health-timeout=5s --health-retries=5 --health-start-period=180s \
    "$NEW_IMAGE" >/dev/null

  log "New container started."
}

# ---------------------------------------------------------------------------
# STEP 13 — HEALTH CHECK (bounded wait)
# ---------------------------------------------------------------------------

wait_for_health() {
  log "Waiting for Docker healthcheck to report healthy (timeout ${HEALTH_TIMEOUT_SECONDS}s)..."
  local waited=0
  local status
  while (( waited < HEALTH_TIMEOUT_SECONDS )); do
    status="$(docker inspect "$CONTAINER_NAME" --format '{{.State.Health.Status}}' 2>/dev/null || echo unknown)"
    if [[ "$status" == "healthy" ]]; then
      log "Container reports healthy after ${waited}s."
      return 0
    fi
    if [[ "$status" == "unhealthy" ]]; then
      log "Container reports UNHEALTHY after ${waited}s."
      return 1
    fi
    sleep "$HEALTH_POLL_INTERVAL"
    (( waited += HEALTH_POLL_INTERVAL ))
  done

  log "Timed out after ${HEALTH_TIMEOUT_SECONDS}s waiting for healthy status (last status: ${status})."
  return 1
}

verify_container_stable() {
  local restart_count image
  restart_count="$(docker inspect "$CONTAINER_NAME" --format '{{.RestartCount}}')"
  image="$(docker inspect "$CONTAINER_NAME" --format '{{.Config.Image}}')"

  if [[ "$restart_count" != "0" ]]; then
    log "Container RestartCount is ${restart_count}, expected 0 — crash-loop suspected."
    return 1
  fi
  if [[ "$image" != "$NEW_IMAGE" ]]; then
    log "Running container image is '${image}', expected '${NEW_IMAGE}'."
    return 1
  fi
  return 0
}

# ---------------------------------------------------------------------------
# STEP 14 — PUBLIC SMOKE TEST (read-only GETs only)
# ---------------------------------------------------------------------------

smoke_test() {
  log "Running public smoke test..."
  local url
  for url in \
    "https://api.safaar.uz/v1/health" \
    "https://api.safaar.uz/v1/auth/providers" \
    "https://api.safaar.uz/v1/hotels"
  do
    if ! curl -fsS --max-time 10 "$url" >/dev/null; then
      log "Smoke test FAILED for ${url}"
      return 1
    fi
    log "Smoke test OK: ${url}"
  done
  return 0
}

# ---------------------------------------------------------------------------
# STEP 15 — AUTOMATIC ROLLBACK
# ---------------------------------------------------------------------------

rollback() {
  log "=== ROLLING BACK ==="

  if docker inspect "$CONTAINER_NAME" >/dev/null 2>&1; then
    docker stop "$CONTAINER_NAME" >/dev/null 2>&1 || true
    docker rm "$CONTAINER_NAME" >/dev/null 2>&1 || true
  fi

  if [[ "$OLD_CONTAINER_EXISTS" != "true" || -z "$OLD_IMAGE" ]]; then
    log "No previous container/image was recorded — nothing to roll back to. Manual intervention required."
    return 1
  fi

  log "Recreating previous container from image ${OLD_IMAGE}..."
  docker run -d \
    --name "$CONTAINER_NAME" \
    --network "$NETWORK_NAME" \
    -p "${EXPECTED_TAILSCALE_IP}:${HOST_PORT}:${CONTAINER_PORT}" \
    --env-file "$ENV_FILE" \
    -e HOST=0.0.0.0 \
    -e NODE_OPTIONS="--max-old-space-size=1024" \
    --restart unless-stopped \
    --memory=1536m --memory-reservation=768m --cpus=1.5 --cpu-shares=1024 \
    --health-cmd="node -e \"require('http').get('http://127.0.0.1:${CONTAINER_PORT}/v1/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))\"" \
    --health-interval=15s --health-timeout=5s --health-retries=5 --health-start-period=180s \
    "$OLD_IMAGE" >/dev/null

  if wait_for_health; then
    log "Rollback successful — previous image ${OLD_IMAGE} is running and healthy."
    return 0
  fi

  log "Rollback container did not become healthy — this requires immediate manual attention."
  return 1
}

# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------

main() {
  guardrails
  acquire_source
  record_rollback_state
  build_image
  verify_security_fixes
  verify_no_auto_migration

  deploy_new_container

  if wait_for_health && verify_container_stable && smoke_test; then
    log "=== DEPLOY SUCCESSFUL: ${NEW_IMAGE} is live and healthy. ==="
    log "Previous image ${OLD_IMAGE:-<none>} was left in place (not deleted) for manual rollback if ever needed."
    exit 0
  fi

  log "=== DEPLOY VERIFICATION FAILED — initiating automatic rollback. ==="
  if rollback; then
    log "=== ROLLBACK SUCCESSFUL. Production restored to ${OLD_IMAGE}. Deploy of ${TARGET_SHA} was NOT applied. ==="
    exit 1
  else
    log "=== ROLLBACK FAILED. PRODUCTION MAY BE DOWN. MANUAL INTERVENTION REQUIRED IMMEDIATELY. ==="
    exit 2
  fi
}

main "$@"
