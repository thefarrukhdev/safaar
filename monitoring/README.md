# Safaar Monitoring Stack — Prometheus & Grafana

Ushbu papka Safaar backend xizmatining barcha ko'rsatkichlarini (RPS, Latency, Xatoliklar %, DB Connection Pool, CPU/RAM) vizual kuzatish uchun to'liq avtomatlashtirilgan Prometheus + Grafana stackini o'z ichiga oladi.

---

## ⚡ 1 Daqiqada Ishga Tushirish (Quick Start)

### 1. Ishga tushirish buyrug'i:
```bash
docker compose -f monitoring/docker-compose.yml up -d
```

### 2. Brauzerda ochish:
- **Grafana Dashboard:** [http://localhost:3000](http://localhost:3000)
  - **Login:** `admin`
  - **Parol:** `admin`
- **Prometheus UI:** [http://localhost:9090](http://localhost:9090)

---

## 🎯 Dashboard Nimalarni Ko'rsatadi?

Grafana avtomatik ravishda **"Safaar Backend Overview"** nomli tayyor dashboard bilan ochiladi:
1. **Umumiy Yuklama (RPS)**: Bir soniyada backendga tushayotgan so'rovlar soni.
2. **5xx Xatolar Ulushi (%)**: Backend xatoliklari foizi (5% dan oshsa qizil rangga kiradi).
3. **P95 Latency**: 95% foydalanuvchilar qanchalik tez javob olayotgani (sekundda).
4. **Faol So'rovlar (In-Flight)**: Ayni lahzada ishlanayotgan parallel so'rovlar soni.
5. **Top Route-lar Dinamikasi**: Eng ko'p so'rov tushayotgan API endpointlar.
6. **PostgreSQL DB Pool**: Jami, bo'sh va **navbatda kutayotgan (`waiting`)** ulanishlar soni.
7. **Node.js Xotira Sarfi**: V8 Heap va RSS xotira dinamikasi.

---

## 📱 Telegram Ogohlantirish (Alert) Ulash

Agar server sekinlashsa yoki xatoliklar ko'paysa, Grafana avtomatik Telegram guruhingizga rasm va xabar yuborishi mumkin:

1. Grafanada chap menyudan: **Alerting** -> **Contact points** bo'limiga kiring.
2. **+ Add contact point** tugmasini bosing:
   - **Name:** `Safaar Telegram Alert`
   - **Integration:** `Telegram`
   - **BOT API Token:** O'z Telegram botingiz tokeni (masalan: `123456:ABC-DEF...`)
   - **Chat ID:** Guruhingiz yoki lichkangiz ID si (masalan: `-100123456789`)
3. **Test** tugmasini bosing -> Telegramga test xabar keladi -> **Save contact point**.

---

## 🛑 Konteynerlarni To'xtatish
```bash
docker compose -f monitoring/docker-compose.yml down
```
*(Barcha yig'ilgan metrikalar `safaar_prometheus_data` va `safaar_grafana_data` volume'larida xavfsiz saqlanib qoladi).*
