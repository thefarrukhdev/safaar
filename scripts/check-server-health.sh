#!/usr/bin/env bash
#
# Safaar — Production Server Health & Container Watchdog
# Ishlash joyi: Production server (safaar-aws)
# Tekshiradi:
#   1. Barcha muhim Docker konteynerlar (safaar-backend, safaar-db, safaar-redis, safaar-telegram-relay)
#   2. Xotira (RAM va Swap) bandligi
#   3. CPU Load Average va Uptime
#   4. Disk bandligi
#

set -euo pipefail

ALERT_RAM_PERCENT=90
ALERT_DISK_PERCENT=85

CONTAINERS=("safaar-backend" "safaar-db" "safaar-redis" "safaar-telegram-relay")
CONTAINER_ERRORS=()
CONTAINER_STATUSES=()

for c in "${CONTAINERS[@]}"; do
  if docker ps --format '{{.Names}}' | grep -q "^${c}$"; then
    HEALTH=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}running{{end}}' "$c" 2>/dev/null || echo "unknown")
    if [[ "$HEALTH" == "healthy" || "$HEALTH" == "running" ]]; then
      CONTAINER_STATUSES+=("✅ <b>${c}:</b> ${HEALTH}")
    else
      CONTAINER_STATUSES+=("⚠️ <b>${c}:</b> ${HEALTH}")
      CONTAINER_ERRORS+=("${c} (${HEALTH})")
    fi
  else
    CONTAINER_STATUSES+=("❌ <b>${c}:</b> TO'XTAB QOLGAN (DOWN)")
    CONTAINER_ERRORS+=("${c} to'xtab qolgan")
  fi
done

# RAM tekshiruvi
MEM_TOTAL=$(free -m | awk '/Mem:/ {print $2}')
MEM_USED=$(free -m | awk '/Mem:/ {print $3}')
MEM_AVAIL=$(free -m | awk '/Mem:/ {print $7}')
RAM_PERCENT=$((MEM_USED * 100 / MEM_TOTAL))

SWAP_TOTAL=$(free -m | awk '/Swap:/ {print $2}')
SWAP_USED=$(free -m | awk '/Swap:/ {print $3}')

# Disk tekshiruvi
DISK_INFO=$(df -h / | awk 'NR==2 {print $2, $3, $4, $5}')
DISK_TOTAL=$(echo "$DISK_INFO" | awk '{print $1}')
DISK_USED=$(echo "$DISK_INFO" | awk '{print $2}')
DISK_AVAIL=$(echo "$DISK_INFO" | awk '{print $3}')
DISK_PERCENT_RAW=$(echo "$DISK_INFO" | awk '{print $4}')
DISK_PERCENT="${DISK_PERCENT_RAW//%/}"

# CPU Load va Uptime
LOAD_AVG=$(uptime | awk -F'load average:' '{print $2}' | xargs)
UPTIME_STR=$(uptime -p 2>/dev/null || uptime | awk -F'up ' '{print $2}' | awk -F',' '{print $1}')

IS_ALERT="false"
ALERT_REASONS=()

if [[ ${#CONTAINER_ERRORS[@]} -gt 0 ]]; then
  IS_ALERT="true"
  ALERT_REASONS+=("Konteynerlar nosozligi: ${CONTAINER_ERRORS[*]}")
fi

if [[ "$RAM_PERCENT" -ge "$ALERT_RAM_PERCENT" ]]; then
  IS_ALERT="true"
  ALERT_REASONS+=("RAM bandligi o'ta yuqori (${RAM_PERCENT}%)")
fi

if [[ "$DISK_PERCENT" -ge "$ALERT_DISK_PERCENT" ]]; then
  IS_ALERT="true"
  ALERT_REASONS+=("Disk bandligi yuqori (${DISK_PERCENT}%)")
fi

CONTAINERS_FORMATTED=""
for item in "${CONTAINER_STATUSES[@]}"; do
  CONTAINERS_FORMATTED+="${item}%0A"
done

ALERTS_FORMATTED=""
for reason in "${ALERT_REASONS[@]}"; do
  ALERTS_FORMATTED+="• ${reason}%0A"
done

echo "=== SERVER HEALTH SUMMARY ==="
echo "IS_ALERT=${IS_ALERT}"
echo "RAM_TOTAL_MB=${MEM_TOTAL}"
echo "RAM_USED_MB=${MEM_USED}"
echo "RAM_AVAIL_MB=${MEM_AVAIL}"
echo "RAM_PERCENT=${RAM_PERCENT}"
echo "SWAP_TOTAL_MB=${SWAP_TOTAL}"
echo "SWAP_USED_MB=${SWAP_USED}"
echo "DISK_TOTAL=${DISK_TOTAL}"
echo "DISK_USED=${DISK_USED}"
echo "DISK_AVAIL=${DISK_AVAIL}"
echo "DISK_PERCENT=${DISK_PERCENT}"
echo "LOAD_AVG=${LOAD_AVG}"
echo "UPTIME_STR=${UPTIME_STR}"
echo "CONTAINERS_STATUS=${CONTAINERS_FORMATTED}"
echo "ALERT_REASONS=${ALERTS_FORMATTED}"
