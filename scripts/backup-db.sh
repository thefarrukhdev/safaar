#!/usr/bin/env bash
#
# Safaar — PostgreSQL Avtomatik Backup Skripti
# Ishlash joyi: Production server (safaar-aws) yoki mahalliy muhit
# Vazifasi: `safaar-db` konteyneridagi `safaar_temp` bazasini siqilgan holda (.sql.gz) saqlash,
#           tekshirish va eski nusxalarni tozalash (Retention Policy).
#

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/home/ubuntu/backups/postgres}"
CONTAINER_NAME="${DB_CONTAINER:-safaar-db}"
DB_USER="${DB_USER:-safaar}"
DB_NAME="${DB_NAME:-safaar_temp}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

TIMESTAMP="$(date +'%Y%m%d_%H%M%S')"
BACKUP_FILENAME="safaar_db_${TIMESTAMP}.sql.gz"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_FILENAME}"
TEMP_PATH="${BACKUP_PATH}.tmp"

echo "[backup-db] Baza zaxiralash boshlandi: ${TIMESTAMP}"
echo "[backup-db] Konteyner: ${CONTAINER_NAME}, Baza: ${DB_NAME}"

# 1. Zaxira papkasini yaratish
mkdir -p "${BACKUP_DIR}"

# 2. Konteyner ishlab turganini tekshirish
if ! docker inspect "${CONTAINER_NAME}" >/dev/null 2>&1; then
  echo "[backup-db] XATOLIK: '${CONTAINER_NAME}' konteyneri topilmadi!" >&2
  exit 1
fi

# 3. Bazani dump qilish va gzip bilan siqish (avval vaqtinchalik .tmp faylga)
echo "[backup-db] Ma'lumotlar bazasi ko'chirilmoqda..."
if ! docker exec "${CONTAINER_NAME}" pg_dump -U "${DB_USER}" -d "${DB_NAME}" --no-owner --no-privileges | gzip -9 > "${TEMP_PATH}"; then
  echo "[backup-db] XATOLIK: pg_dump bajarishda xatolik yuz berdi!" >&2
  rm -f "${TEMP_PATH}"
  exit 1
fi

# 4. Fayl yaxlitligini tekshirish (gzip integrity check)
if ! gzip -t "${TEMP_PATH}" 2>/dev/null; then
  echo "[backup-db] XATOLIK: Yaratilgan backup fayli buzilgan (corrupted)!" >&2
  rm -f "${TEMP_PATH}"
  exit 1
fi

# 5. Faylni yakuniy nomga o'tkazish
mv "${TEMP_PATH}" "${BACKUP_PATH}"
chmod 600 "${BACKUP_PATH}"

# 6. Fayl hajmini aniqlash
BACKUP_SIZE="$(du -h "${BACKUP_PATH}" | cut -f1)"
echo "[backup-db] Muvaffaqiyatli saqlandi: ${BACKUP_PATH} (${BACKUP_SIZE})"

# 7. Eski zaxiralarni tozalash (Retention: 14 kundan eski nusxalar o'chiriladi)
echo "[backup-db] ${RETENTION_DAYS} kundan eski zaxira nusxalar tozalanmoqda..."
find "${BACKUP_DIR}" -type f -name "safaar_db_*.sql.gz" -mtime +"${RETENTION_DAYS}" -delete || true

# 8. GitHub Actions uchun natijalarni chiqarish
echo "filename=${BACKUP_FILENAME}"
echo "filepath=${BACKUP_PATH}"
echo "filesize=${BACKUP_SIZE}"
