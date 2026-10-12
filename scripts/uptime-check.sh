#!/usr/bin/env bash
#
# Safaar — Uptime & Health Monitor Skripti
# Vazifasi: safaar.uz, staff.safaar.uz, partner.safaar.uz va api.safaar.uz/v1/health/ready
#           xizmatlarini tekshirish, javob vaqtini o'lchash va muammolarni aniqlash.
#

set -euo pipefail

# Tekshiriladigan xizmatlar ro'yxati (Nomi | URL | Kutilayotgan status)
ENDPOINTS=(
  "Mijozlar Sayti|https://www.safaar.uz/uz|200"
  "Admin Panel|https://staff.safaar.uz/login|200"
  "Hamkor Kabineti|https://partner.safaar.uz/login|200"
  "Backend API & DB|https://api.safaar.uz/v1/health/ready|200"
)

TOTAL_COUNT=${#ENDPOINTS[@]}
FAILED_COUNT=0
REPORT_BODY=""
ERROR_DETAILS=""

echo "=== Safaar Uptime & Health Check ==="
echo "Tekshiruv vaqti: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

for item in "${ENDPOINTS[@]}"; do
  IFS='|' read -r NAME URL EXPECTED_CODE <<< "$item"
  
  # curl bilan HTTP status va javob vaqtini olish (timeout 10 soniya)
  RESPONSE=$(curl -s -o /dev/null -w "%{http_code} %{time_total}" --max-time 10 "$URL" 2>/dev/null || echo "000 0.000")
  HTTP_CODE=$(echo "$RESPONSE" | awk '{print $1}')
  TIME_TOTAL=$(echo "$RESPONSE" | awk '{print $2}')
  TIME_MS=$(awk "BEGIN {print int($TIME_TOTAL * 1000)}")

  if [[ "$HTTP_CODE" == "200" || "$HTTP_CODE" == "307" || "$HTTP_CODE" == "308" ]]; then
    STATUS_ICON="✅"
    echo "[$STATUS_ICON] $NAME: HTTP $HTTP_CODE (${TIME_MS}ms) - $URL"
    REPORT_BODY+="${STATUS_ICON} <b>${NAME}:</b> HTTP ${HTTP_CODE} (${TIME_MS}ms)%0A"
  else
    STATUS_ICON="❌"
    FAILED_COUNT=$((FAILED_COUNT + 1))
    echo "[$STATUS_ICON] $NAME: XATOLIK HTTP $HTTP_CODE (${TIME_MS}ms) - $URL"
    REPORT_BODY+="${STATUS_ICON} <b>${NAME}:</b> XATOLIK HTTP ${HTTP_CODE}%0A"
    ERROR_DETAILS+="• <b>${NAME}</b>: HTTP ${HTTP_CODE} (${URL})%0A"
  fi
done

echo ""
echo "Jami: $TOTAL_COUNT ta xizmatdan $FAILED_COUNT tasida xatolik aniqlandi."

# GitHub Actions muhiti uchun outputlar
echo "failed_count=${FAILED_COUNT}" >> "${GITHUB_OUTPUT:-/dev/null}" || true
echo "report_body=${REPORT_BODY}" >> "${GITHUB_OUTPUT:-/dev/null}" || true
echo "error_details=${ERROR_DETAILS}" >> "${GITHUB_OUTPUT:-/dev/null}" || true

# Agar xatolik bo'lsa, chiqish kodi 1 bo'ladi
if [[ "$FAILED_COUNT" -gt 0 ]]; then
  exit 1
fi

exit 0
