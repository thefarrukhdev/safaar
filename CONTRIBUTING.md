# Safaar — Ishlash qoidalari (CONTRIBUTING)

Bu fayl jamoaning yagona ish qo'llanmasi. Har bir dasturchi (va uning AI agenti)
shu qoidalarga amal qiladi.

---

## 1. Kim qayerda ishlaydi (egalik)

Har bir dasturchi **faqat o'z papkasida** ishlaydi. To'liq jadval — `CODEOWNERS`.

| Dasturchi | Papka | Port |
|---|---|---|
| @FarrukhDev-io     | `apps/web-user/`    | 3000 |
| @adhambek7717      | `apps/web-partner/` | 3001 |
| @adhambek7717      | `apps/web-admin/`   | 3002 |
| @Lazizdeveloper    | `apps/backend/` + `packages/types/` | 4000 |

**Chegara qoidasi:**
- O'z papkangda — ✅ bemalol o'qi va yoz.
- `apps/backend/` va `packages/types/` — 📖 faqat **o'qish** (API va turlarni tushunish).
- Boshqa frontend papkalari — ⛔ umuman tegma.
- Yangi tur/endpoint kerak bo'lsa — o'zing qo'shma, **backend dev'dan so'ra**.

---

## 2. Branch modeli va ish oqimi

Ikkita asosiy branch:

| Branch | Maqsad |
|---|---|
| `main` | **Barqaror release** — faqat to'liq ishlaydigan, "zo'r versiya" kod. To'g'ridan-to'g'ri ishlanmaydi. |
| `develop` | **Umumiy ish branch'i** — hamma shu yerda ishlaydi (har kim o'z papkasida). Kundalik ish shu yerda. |

```
hamma  →  develop  (har kim faqat o'z papkasida ishlaydi)
              │
   barqaror, to'liq ishlaydigan "zo'r versiya" bo'lganda
              ▼
            main  (release)
```

### Asosiy qoida
> Kundalik ish **`develop`** branch'ida bo'ladi. Hamma shu branch'ga push qiladi,
> lekin **faqat o'z papkasida**. `develop`'dagi kod barqaror va to'liq ishlaydigan
> "zo'r versiya" bo'lganda — uni **`main`'ga merge** qilinadi (buni admin (thefarrukhdev)/lid qiladi).

### Kundalik qadamlar
```bash
# 1. develop'ga o't
git checkout develop

# 2. Push'dan OLDIN doim boshqalarning ishini ol (rebase = toza tarix)
git pull --rebase origin develop

# 3. O'z papkangda ishla (AI'ni shu papkadan ishga tushir)
cd apps/web-user && claude

# 4. Ish tugagach — faqat ISHLAYDIGAN kodni push qil
git add .
git commit -m "feat(web-user): qidiruv sahifasi"
git pull --rebase origin develop   # yana bir bor — kimdir push qilgan bo'lishi mumkin
git push origin develop
```

### ⚠️ Umumiy branch intizomi (MUHIM)
`develop`'da hamma birga ishlaydi, shuning uchun:
1. **Push'dan oldin DOIM `git pull --rebase origin develop`** — boshqalarning ishini ol.
2. **Faqat ishlaydigan kod push qil** — `develop`'ni buzma (build/lint/test yashil bo'lsin).
3. **O'z papkangdan chiqma** — shunda boshqalar bilan konflikt bo'lmaydi.
4. `main`'ga merge'ni **faqat admin (thefarrukhdev)/lid** qiladi (develop barqaror bo'lganda).

### main'ga qachon merge qilinadi
`develop` to'liq sinovdan o'tib, barqaror "release" versiya bo'lganda — admin (thefarrukhdev)
`develop` → `main` ga merge qiladi. Shu tariqa `main` doim ishlaydigan, toza
release versiya bo'lib qoladi.

---

## 3. Commit xabarlari

Qisqa, aniq, ish tilida. Tavsiya format (Conventional Commits):
```
feat(web-user): bosh sahifa hero bloki
fix(backend): bron statusi xatosi
chore: bog'liqliklarni yangilash
```

---

## 4. Har bir o'zgartirishdan oldin (majburiy)

```bash
npm run build    # o'z app'ingda — xatosiz bo'lsin
npm run lint     # frontend uchun
npm run test     # backend uchun
```
Yashil bo'lmasa — PR ochma, avval tuzat.

---

## 5. `@safaar/types` (shartnoma) bilan ishlash

- API javob turlarini doim `@safaar/types`'dan import qil — qo'lda yozma.
- Bu paketni faqat **backend dev** o'zgartiradi.
- Backend yangi tur qo'shsa: `npm run build:types` (dist yangilanadi), keyin
  frontend'da avtomatik paydo bo'ladi.

---

## 6. Birinchi marta sozlash (har bir dev)

```bash
git clone git@github.com:Startup-loyihalar/agoda_frontend_backend.git
cd agoda_frontend_backend
git checkout develop    # kundalik ish shu branch'da
npm install             # bu git hook'larni ham AVTOMATIK o'rnatadi (pastga qara)
npm run build:types     # MAJBURIY — birinchi shu

npm run dev:user        # yoki dev:partner / dev:admin / dev:backend
```

> `npm install` paytida `prepare` script ishlaydi va `core.hooksPath`ni
> `.githooks`ga sozlaydi — ya'ni pre-push himoyasi o'zi yoqiladi, qo'lda hech
> narsa qilish shart emas.

---

## 7. Avtomatik himoya — `pre-push` hook

Repo'da **lokal git hook** bor (`.githooks/pre-push`): u "o'z papkangdan
tashqariga tegma" qoidasini push paytida avtomatik tekshiradi.

**Qanday ishlaydi:**
- `git push` qilganingizda, **sizning** muallifligingizdagi (merge bo'lmagan)
  commitlar `CODEOWNERS` bilan solishtiriladi.
- Faqat o'z papkangizni o'zgartirgan bo'lsangiz → push jim o'tadi. ✅
- Adashib boshqa papkaga teккan bo'lsangiz → push **to'xtaydi** va qaysi fayl
  ekanini ko'rsatadi. ⛔

**Tekshirilmaydi (ataylab):** integratsiya merge'lari, boshqalarning commitlari,
`package-lock.json` (avto-generatsiya — paket qo'shsangiz o'zi o'zgaradi).

**Zarur bo'lsa chetlab o'tish** (faqat haqiqatan boshqa papkaga tegish kerak
bo'lsa, papka egasi bilan kelishib):
```bash
HOOK_ALLOW_CROSS_FOLDER=1 git push
```

> ⚠️ Bu **lokal** himoya (server emas). Repo private + Free reja bo'lgani uchun
> GitHub branch protection mavjud emas. Hook + `CODEOWNERS` + CI birgalikda
> himoya beradi — lekin u intizomga tayanadi (`--no-verify` bilan chetlab o'tish
> mumkin, undAY qilmang).

---

## 8. To'liq ssenariy — "sahifa qildim, endi nima qilaman?"

Masalan siz `web-partner` dev'siz va yangi rezervatsiya sahifasi qildingiz:

```bash
# 1) Eng so'nggi kodni ol
git checkout develop
git pull --rebase origin develop

# 2) O'z papkangda ishla: apps/web-partner/... (sahifani yoz)

# 3) Ishlaydiganini tekshir
npm run lint -w @safaar/web-partner
npm run build:partner

# 4) Commit qil (faqat o'z fayllaring)
git add apps/web-partner/
git commit -m "feat(web-partner): rezervatsiya sahifasi"

# 5) Push'dan oldin yana rebase (kimdir push qilgan bo'lishi mumkin)
git pull --rebase origin develop

# 6) Push qil
git push origin develop
```

**6-qadamda** `pre-push` hook ishlaydi:
- Faqat `apps/web-partner/` ni o'zgartirgansiz → o'tadi, push muvaffaqiyatli.
- Push'dan keyin GitHub'da **CI** ishga tushadi (`build:types → lint → build`).
  Yashil bo'lsa — tamom. ✅

Agar hook to'xtatsa — ko'rsatilgan ruxsatsiz faylni o'z papkangizdan tashqaridan
olib tashlang (yoki o'z papkangizga ko'chiring), keyin qaytadan push qiling.

---

## Qisqa eslatma

1. O'z papkangda ishla, boshqasiga tegma.
2. Kundalik ish **`develop`**'da; push'dan oldin doim `git pull --rebase origin develop`.
3. Faqat **ishlaydigan** kod push qil (build/lint/test yashil bo'lsin).
4. `develop` barqaror "zo'r versiya" bo'lganda — **admin** uni `main`'ga merge qiladi.
