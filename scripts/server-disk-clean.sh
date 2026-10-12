#!/usr/bin/env bash
#
# Safaar — Production Server Disk Tozalash va Nazorati
# Ishlash joyi: Production server (safaar-aws)
# Vazifasi:
#   1. Eski docker keshlar va ishlatilmayotgan eskirgan tasvirlarni tozalash (48 soatdan eski);
#   2. Eski journalctl loglari va /tmp vaqtinchalik fayllarni tozalash;
#   3. Disk sig'imini o'lchash va 85% dan oshsa ogohlantirish berish.
#

set -euo pipefail

ALERT_THRESHOLD=85

echo "=== Safaar Server Disk Maintenance ==="
echo "Boshlanish vaqti: $(date '+%Y-%m-%d %H:%M:%S')"

# 1. Tozalashdan oldingi holat
USED_BEFORE=$(df -k / | awk 'NR==2 {print $3}')

# 2. Xavfsiz tozalashlar
echo "[disk-clean] Docker eskirgan tasvirlar tozalanmoqda (48h+)..."
docker image prune -a --filter "until=48h" -f >/dev/null 2>&1 || true

echo "[disk-clean] Docker build keshlar tozalanmoqda (72h+)..."
docker builder prune -a --filter "until=72h" -f >/dev/null 2>&1 || true

echo "[disk-clean] Eski journalctl loglar tozalanmoqda (7d+)..."
sudo journalctl --vacuum-time=7d >/dev/null 2>&1 || journalctl --vacuum-time=7d >/dev/null 2>&1 || true

echo "[disk-clean] /tmp eski skriptlar tozalanmoqda (7d+)..."
find /tmp -maxdepth 1 -type f -name "*.sh" -mtime +7 -delete 2>/dev/null || true

# 3. Tozalashdan keyingi holat
DISK_INFO=$(df -h / | awk 'NR==2 {print $2, $3, $4, $5}')
TOTAL_SIZE=$(echo "$DISK_INFO" | awk '{print $1}')
USED_SIZE=$(echo "$DISK_INFO" | awk '{print $2}')
AVAIL_SIZE=$(echo "$DISK_INFO" | awk '{print $3}')
USE_PERCENT_RAW=$(echo "$DISK_INFO" | awk '{print $4}')
USE_PERCENT="${USE_PERCENT_RAW//%/}"

USED_AFTER=$(df -k / | awk 'NR==2 {print $3}')
FREED_KB=$((USED_BEFORE - USED_AFTER))
if [[ "$FREED_KB" -gt 0 ]]; then
  FREED_MB=$((FREED_KB / 1024))
  FREED_STR="${FREED_MB} MB"
else
  FREED_STR="0 MB"
fi

echo ""
echo "[disk-clean] Jami disk: ${TOTAL_SIZE}"
echo "[disk-clean] Ishlatilgan: ${USED_SIZE} (${USE_PERCENT}%)"
echo "[disk-clean] Bo'sh joy: ${AVAIL_SIZE}"
echo "[disk-clean] Bo'shatilgan hajm: ${FREED_STR}"

IS_ALERT="false"
if [[ "$USE_PERCENT" -ge "$ALERT_THRESHOLD" ]]; then
  IS_ALERT="true"
  echo "[disk-clean] OGOHLANTIRISH: Disk bandligi ${USE_PERCENT}% (chegara: ${ALERT_THRESHOLD}%)!"
else
  echo "[disk-clean] Holat: Normal (${USE_PERCENT}% < ${ALERT_THRESHOLD}%)"
fi

# GitHub Actions uchun chiqish
echo "total_size=${TOTAL_SIZE}" >> "${GITHUB_OUTPUT:-/dev/null}" || true
echo "used_size=${USED_SIZE}" >> "${GITHUB_OUTPUT:-/dev/null}" || true
echo "avail_size=${AVAIL_SIZE}" >> "${GITHUB_OUTPUT:-/dev/null}" || true
echo "use_percent=${USE_PERCENT}" >> "${GITHUB_OUTPUT:-/dev/null}" || true
echo "freed_str=${FREED_STR}" >> "${GITHUB_OUTPUT:-/dev/null}" || true
echo "is_alert=${IS_ALERT}" >> "${GITHUB_OUTPUT:-/dev/null}" || true
