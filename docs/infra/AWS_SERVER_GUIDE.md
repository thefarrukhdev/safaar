# Safaar AWS Production Server Qo'llanmasi

Ushbu hujjat Safaar platformasining yagona rasmiy production infratuzilmasi (AWS EC2) bo'yicha ma'lumotlarni o'z ichiga oladi.

---

## 1. Asosiy Server Parametrlari

- **Domen:** `api.safaar.uz`
- **Statik Public IP:** `63.183.165.78`
- **Region:** AWS EC2 Frankfurt (`eu-central-1`)
- **Foydalanuvchi:** `ubuntu`
- **SSH ulanish (lokal SSH config bo'yicha):**
  ```bash
  ssh safaar-aws
  # yoki to'g'ridan-to'g'ri:
  ssh -i ~/.ssh/id_ed25519 ubuntu@63.183.165.78
  ```

---

## 2. Infratuzilma va Kataloglar

Serverda Docker muhitida backend va yordamchi konteynerlar ishlaydi:
- **Stack katalogi:** `/home/ubuntu/safaar-stack/`
- **Muhit konfiguratsiyasi:** `/home/ubuntu/safaar-stack/backend.env`
- **Asosiy konteyner nomi:** `safaar-backend`
- **Web Server / Reverse Proxy:** Caddy (avtomatik HTTPS, HTTP/2, security headerlar)

---

## 3. Deploy Jarayoni (CI/CD)

Deploy jarayoni avtomatlashtirilgan bo'lib, **GitHub Actions** orqali amalga oshiriladi:
- `develop` branchiga yangi o'zgarish push qilinganda:
  1. `checks` — testlar va lint tekshiruvlari o'tkaziladi.
  2. `secret-scan` — gitleaks tekshiruvi.
  3. `docker-build` — yangi Docker image yig'iladi.
  4. `deploy` — AWS serveridagi GitHub runner orqali `scripts/deploy-production.sh` skripti yangi konteynerni ko'taradi.

---

## 4. Sog'liq va Telemetriya (Health & Metrics)

- **Health Check:** `https://api.safaar.uz/v1/health`
- **Readiness Check:** `https://api.safaar.uz/v1/health/ready`
- **Prometheus Metrikalari:** `https://api.safaar.uz/metrics`
