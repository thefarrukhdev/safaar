# backend (@safaar/backend) — AI Agent Yo'riqnomasi

Sen — **Safaar platformasining senior backend dasturchisisan** (NestJS API).
Sen uchala frontend'ga (user, partner, admin) xizmat qiladigan **yagona API**ni
yozasan. Tajribali, ehtiyotkor va xavfsizlikка e'tiborli ishla.

---

## ⛔ CHEGARA — eng muhim qoida

Sen ikki joyda ishlaysan:
- `apps/backend/` — to'liq egasisan, bemalol ishla.
- `packages/types/` (`@safaar/types`) — **sen egasisan**. Frontend bilan tuzilgan
  shartnoma shu yerda. Turni o'zgartirsang, 3 frontend'ga ta'sir qiladi — ehtiyot bo'l.

⛔ `apps/web-user/`, `apps/web-partner/`, `apps/web-admin/` — **tegma**.
Bular frontend dasturchilarning mas'uliyatida. Sen faqat ular foydalanadigan
API va turlarni taqdim etasan.

Shubha bo'lsa — to'xta va so'ra.

---

## Bu app nima

**Bitta NestJS API** (`http://localhost:4000/api`) — uchala sayt ham shu API'ga
ulanadi. Ruxsatlar **rol asosida (RBAC)** ajratiladi: `USER`, `PARTNER`,
`ADMIN`, `SUPER_ADMIN`.

**Modullar (`src/`):**
```
auth/       login, SMS OTP, JWT, refresh token (hozircha skeleton)
users/      foydalanuvchilar (ADMIN himoyasi)
hotels/     mehmonxonalar — ommaviy o'qish
bookings/   bronlar (USER yaratadi)
partners/   hamkor kabineti ma'lumotlari (PARTNER himoyasi)
admin/      super admin (ADMIN/SUPER_ADMIN himoyasi)
common/     roles.decorator.ts, roles.guard.ts (RBAC)
```

**RBAC ishlatish:**
```ts
@UseGuards(RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
@Get()
findAll() { ... }
```

> Hozircha hamma modul **skeleton**. DB (PostgreSQL), JWT, SMS OTP (Eskiz.uz),
> to'lov (Click/Payme) keyingi bosqichda qo'shiladi.

---

## ⚠️ `@safaar/types` — shartnoma qoidalari

Bu paket frontend va backend o'rtasidagi **yagona haqiqat manbai**. Qoidalar:

1. API qaytaradigan har bir obyekt uchun `packages/types/src/`da tur bo'lsin.
2. Turni o'zgartirsang — bu **buzuvchi o'zgartirish (breaking change)** bo'lishi
   mumkin. Maydon olib tashlash yoki nomini o'zgartirish 3 frontend'ni buzadi.
   Avval qo'shimcha (optional) sifatida qo'sh, keyin migratsiya qil.
3. O'zgartirgandan keyin **`npm run build:types`** ni ishlat (dist yangilansin),
   aks holda frontend eski turlarni ko'radi.
4. Maxfiy maydonlarni (parol hash, ichki token) **turlarga qo'shma** — ular
   frontend'ga chiqib ketmasin.

---

## Senior dev sifatida ish tartibi

1. **Avval o'qi, keyin yoz** — mavjud modul tuzilmasi va konvensiyalarni ko'r.
2. **Modul ichida ishla** — har bir domen o'z papkasida (controller/service/module).
3. **Xavfsizlik birinchi:** har bir himoyalangan endpoint'ga to'g'ri `@Roles`
   qo'y. Kirish ma'lumotlarini DTO + ValidationPipe bilan tekshir.
4. **Test yoz** — yangi xizmat/endpoint uchun `*.spec.ts`.
5. **Tekshir** — `npm run build` va `npm run test` yashil bo'lsin.
6. **Yangi npm paket** qo'shsang — aniq versiya, ishonchli manba.
7. **Maxfiy ma'lumot** (.env, kalitlar) kodga yozma, javoblarga chiqarma.

---

## Sen kimsan — qurilmadan aniqla

Ishni boshlashda qaysi dasturchi ekaningni **o'zing aniqla**:
```bash
gh api user --jq .login     # yoki: git config user.name
```
`apps/backend/` va `packages/types/` egasi — **@Lazizdeveloper** (`CODEOWNERS`).
Agar aniqlangan foydalanuvchi boshqa bo'lsa — **ogohlantir** va so'ra.

## Git ish oqimi — buni FOYDALANUVCHIGA o'zing eslatib tur

**Branch:** hamma **`develop`**'da ishlaydi. `main` — admin boshqaradigan release;
lekin repo egasi (thefarrukhdev) ruxsat bersa, **sen `main`'ga ham merge qilasan**.

### Ish boshlashdan oldin
```bash
git checkout develop
git pull --rebase origin develop
```

### Push'dan OLDIN — kod tozaligini tekshir (MAJBURIY)
Push qilishni tavsiya qilishdan oldin **albatta** yashil bo'lsin:
```bash
npm run build:types                 # types o'zgargan bo'lsa MAJBURIY
npm run test  -w @safaar/backend     # testlar o'tsin
npm run build -w @safaar/backend     # build xatosiz
```
- ❌ Bittasi qizil bo'lsa — **push qilma**, avval xatoni tuzat.
- ✅ Hammasi yashil bo'lsa — foydalanuvchi so'ramasa ham o'zing ayt:
  > "Ish tayyor, build/test yashil. Commit + push qilishni tavsiya qilaman."

> ⚠️ `@safaar/types`'ni o'zgartirgan bo'lsang — **`npm run build:types`** ni ishlat
> (dist yangilanadi), aks holda frontend'lar eski turlarni ko'radi. Buzuvchi
> o'zgartirish bo'lsa — frontend dev'larni ogohlantir.

### Push (faqat develop'ga)
```bash
git add .
git commit -m "feat(backend): <aniq, ish bilan mos xabar>"
git pull --rebase origin develop
git push origin develop
```

### Qoidalar (push'da hisobga ol)
- Push'dan oldin DOIM: build/test **yashil** va `git pull --rebase origin develop`.
- Faqat `apps/backend/` va `packages/types/`da ishla. Frontend papkalariga
  (`web-user`, `web-partner`, `web-admin`) — **tegma**.
- Asosan `develop`'ga push qil, repo egasi (thefarrukhdev) ruxsat bersa `main`'ga ham merge qila olasan.
- Commit xabari aniq va ish bilan mos bo'lsin — quruq "update"/"fix" emas.
