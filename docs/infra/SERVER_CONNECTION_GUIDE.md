# Safaar Serverlariga Ulanish va Infratuzilma Yo'riqnomasi

Ushbu yo'riqnoma Safaar platformasining production serverlari, Yandex Cloud statik gateway va Uzum Checkout integratsiyasiga qayta ulanish hamda xizmat ko'rsatish bo'yicha to'liq qo'llanmadir.

---

## 1. Asosiy Backend Server (`scarygun` / Production Host)

Backend API va ma'lumotlar bazasi joylashgan asosiy production server.

- **Ichki IP (Tailscale):** `100.109.46.108`
- **Foydalanuvchi:** `scarygun`
- **SSH Paroli:** `5317`
- **Superuser (Root) huquqiga o'tish:**
  ```bash
  su -
  # Parol: 5317
  ```

### Serverga ulanish buyrug'i:
```bash
ssh scarygun@100.109.46.108
# yoki sshpass yordamida:
sshpass -p '5317' ssh scarygun@100.109.46.108
```

### Muhim kataloglar va fayllar:
- **Stack katalogi:** `/home/scarygun/safaar-stack/`
- **Asosiy muhit fayli:** `/home/scarygun/safaar-stack/backend.env`
- **Compose fayli:** `/home/scarygun/safaar-stack/docker-compose.safaar.yml`

### Backend konteynerini boshqarish buyruqlari:
```bash
# Holatni tekshirish
docker ps --filter name=safaar-backend

# Loglarni jonli kuzatish
docker logs --tail 50 -f safaar-backend

# Yangi backend.env bilan konteynerni qayta ko'tarish (Recreate):
docker stop safaar-backend && docker rm safaar-backend && \
docker run -d \
  --name safaar-backend \
  --network safaar-network \
  -p 100.109.46.108:4100:4000 \
  --env-file /home/scarygun/safaar-stack/backend.env \
  -e HOST=0.0.0.0 \
  -e NODE_OPTIONS="--max-old-space-size=1024" \
  --restart unless-stopped \
  --memory=1536m --memory-reservation=768m --cpus=1.5 --cpu-shares=1024 \
  --health-cmd="node -e \"require('http').get('http://127.0.0.1:4000/v1/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))\"" \
  --health-interval=15s --health-timeout=5s --health-retries=5 --health-start-period=180s \
  safaar-backend:915ce8ac79d9cabc303e49b45b8083c4164d272a
```

---

## 2. Yandex Cloud Statik IP Gateway (`safaar-gateway`)

Uzum Checkout uchun talab qilingan barqaror tashqi statik IP manzilni ta'minlovchi Yandex Cloud virtual mashinasi.

- **Tashqi Statik IP (Uzum allowlist):** `51.250.78.204`
- **Ichki IP (Tailscale):** `100.105.86.75`
- **Yandex Cloud Folder ID:** `b1ganpgh57a48ma726lh`
- **Virtual Machine ID:** `fhmt89g9qknf7h17m8pq`

### Tinyproxy (Chiquvchi Egress Proxy) parametrlari:
- **Proxy Port:** `3128`
- **Login (BasicAuth):** `safaar-uzum`
- **Parol:** `11c47437ee52f23e109cc34099c9eb430c9c0770f35060e5`
- **To'liq Proxy URL:**
  ```text
  http://safaar-uzum:11c47437ee52f23e109cc34099c9eb430c9c0770f35060e5@100.105.86.75:3128
  ```

---

## 3. Uzum Checkout Rasmiy Konfiguratsiyasi

Serverdagi `/home/scarygun/safaar-stack/backend.env` ga kiritilgan parametrlar:

```env
# Uzum Checkout Production API
UZUM_CHECKOUT_BASE_URL=https://checkout-key.uzumcheckout.uz
UZUM_CHECKOUT_TERMINAL_ID=7680088a-4154-4e95-8a06-e1f854579b0d
UZUM_CHECKOUT_API_KEY=299ff14d01fbd8bf935c6111cfa7b9365857780fd6d079bcfc77a8b85f0be730

# Fiskal parametrlar («INTELLEX» MCHJ):
UZUM_CHECKOUT_RECEIPT_TIN=312932219
UZUM_CHECKOUT_SPIC=10703999001000000
UZUM_CHECKOUT_PACKAGE_CODE=1495084
UZUM_CHECKOUT_VAT_PERCENT=12

# Statik IP orqali chiquvchi proxy:
UZUM_CHECKOUT_HTTPS_PROXY=http://safaar-uzum:11c47437ee52f23e109cc34099c9eb430c9c0770f35060e5@100.105.86.75:3128
```

---

## 4. Muhim Texnik Eslatmalar (Known Gotchas)

1. **Yandex Cloud SSH kalit formati:**
   `yc compute instance create --ssh-key` bayrog'i fayl ichidagi matnga avtomatik `yc-user:` prefiksini ulab qo'yadi. Agar fayl ichida allaqachon `ubuntu:ssh-ed25519...` formati bo'lsa, natija `yc-user:ubuntu:...` bo'lib buziladi va tizimga kirib bo'lmaydi.
   *To'g'ri usul:* Har doim `--metadata ssh-keys="ubuntu:ssh-ed25519..."` bayrog'idan foydalaning.

2. **Docker muhit o'zgaruvchilari:**
   Oddiy `docker restart <container>` buyrug'i konteynerning `run` paytidagi env o'zgaruvchilarini yangilamaydi. `.env` faylga yangi kalitlar qo'shilganda konteynerni to'xtatib (`stop`), o'chirib (`rm`) va `--env-file` bilan qayta `run` qilish shart.
