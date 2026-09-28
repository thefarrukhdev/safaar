<div align="center">
  <h1>🏨 SAFAAR.uz Platform</h1>
  <p><b>O'zbekiston milliy turar joy va bron qilish ekotizimi (Monorepo)</b></p>

  <!-- Badges -->
  <a href="https://github.com/FarrukhDev-io/safaar"><img src="https://img.shields.io/badge/Monorepo-Turborepo-EF4444?style=for-the-badge&logo=vercel" alt="Turborepo" /></a>
  <a href="https://nextjs.org/"><img src="https://img.shields.io/badge/Next.js-15-000000?style=for-the-badge&logo=next.js" alt="Next.js" /></a>
  <a href="https://nestjs.com/"><img src="https://img.shields.io/badge/NestJS-E0234E?style=for-the-badge&logo=nestjs&logoColor=white" alt="NestJS" /></a>
  <a href="https://www.postgresql.org/"><img src="https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL" /></a>
  
  <br>
  <br>
  🚀 **Live (Foydalanuvchi sayti):** <a href="https://safaar-uz.vercel.app">https://safaar-uz.vercel.app</a>
</div>

<br>

**SAFAAR.uz** — O'zbekistonning shahar mehmonxonalaridan tortib tog' bag'ridagi eng chekka oromgohlargacha bo'lgan barcha dam olish joylarini bitta platformada birlashtiruvchi milliy bron ekotizimi.

## ✨ Imkoniyatlar (Features)
- **🏨 Mehmonxonalar & 🏡 Dachalar** (Keng qamrovli qidiruv va filtrlash)
- **🚌 Avtobus & Transport chiptalari**
- **🔐 Rollarga asoslangan tizim:** (Mijoz, Hamkor, Admin, Super Admin)
- **💳 Onlayn to'lovlar integratsiyasi:** (Click, Payme, Uzcard, Humo)
- **⚡ Real-time xabarnomalar va SMS OTP**

---

## 🏗️ Arxitektura (Turborepo)

Loyiha to'liq **Monorepo** uslubida yozilgan va quyidagi qismlardan iborat:

```text
safaar/
├── apps/
│   ├── backend/      (NestJS API)                → :4000
│   ├── web-user/     (Mijozlar sayti - Next.js)  → :3000
│   ├── web-partner/  (Hamkor kabineti - Next.js) → :3001
│   └── web-admin/    (Super Admin - Next.js)     → :3002
├── packages/
│   └── types/        (Umumiy TypeScript turlari)
```

## 🛠️ Texnologiyalar (Tech Stack)

| Qatlam | Texnologiyalar |
|---|---|
| **Frontend** | `Next.js 15`, `React 19`, `Tailwind CSS v4`, `TypeScript (strict)` |
| **Backend** | `NestJS`, `PostgreSQL 14`, `Prisma ORM`, `Redis` |
| **Infratuzilma** | `Docker`, `Yandex Cloud VM`, `Cloudflare R2` (Storage), `GitHub Actions` |
| **Xavfsizlik** | `JWT`, `Refresh Tokens`, `Rate Limiting`, `RBAC` |

---

## 🚀 Ishga tushirish (Getting Started)

Loyiha kompyuteringizda ishlashi uchun `Node.js` (v20+) va `Docker` o'rnatilgan bo'lishi kerak.

**1. Kutubxonalarni o'rnatish:**
```bash
pnpm install
```

**2. Tiplarni (Types) generatsiya qilish:**
```bash
pnpm run build:types
```

**3. Ilovalarni ishga tushirish:**
Siz o'zingizga kerakli qismni alohida yoki hammasini bittada yurgizishingiz mumkin:
```bash
pnpm run dev:user      # Faqat Mijozlar sayti (localhost:3000)
pnpm run dev:partner   # Faqat Hamkorlar kabineti (localhost:3001)
pnpm run dev:admin     # Faqat Admin panel (localhost:3002)
pnpm run dev:backend   # Faqat Backend API (localhost:4000)
```

**4. Backend Infra (Docker):**
Ma'lumotlar bazasi (PostgreSQL) va Redis'ni ko'tarish uchun:
```bash
docker compose -f docker-compose.backend.yml up -d
```

---

*© 2026 SAFAAR Development Team — Barcha huquqlar himoyalangan.*

