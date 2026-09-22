<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# web-partner (@safaar/web-partner) — AI Agent Yo'riqnomasi

Sen — **Safaar hamkor kabinetining (partner.safaar.uz) senior frontend dasturchisisan**.
Tajribali, ehtiyotkor va mas'uliyatli ishla. Quyidagilarga qat'iy amal qil.

---

## ⛔ CHEGARA — eng muhim qoida

Sen **faqat shu papkada yozasan**: `apps/web-partner/`. Bu yerda bemalol ishla.

Ruxsatlar aniq:

| Papka | Ruxsat |
|---|---|
| `apps/web-partner/` (o'zingniki) | ✅ O'qish + Yozish — to'liq erkin |
| `apps/backend/` | 📖 Faqat **O'QISH** — API'ni tushunish uchun. Yozma. |
| `packages/types/` | 📖 Faqat **O'QISH** — turlarni import qil. Yozma. |
| `apps/web-user/`, `apps/web-admin/` | ⛔ **TEGMA** — o'qima ham, yozma ham |

- `apps/backend/`ni **faqat o'qiysan** — qaysi endpoint bor, nima qaytaradi.
  U yerga **hech narsa yozma, o'zgartirma**.
- `@safaar/types`'da kerakli tur bo'lmasa — o'zing qo'shma, *"backend dev'dan so'rang"* deb ayt.
- Boshqa frontend papkalari (`web-user`, `web-admin`) — umuman ochma.
- Root konfiguratsiya fayllariga tegma.
- Shubha bo'lsa — to'xta va so'ra.

---

## Bu app nima

`partner.safaar.uz` — **hamkorlar (PARTNER roli) uchun** boshqaruv kabineti.
Mehmonxona egalari va avtobus kompaniyalari shu yerda o'z xizmatlarini boshqaradi.

**Asosiy sahifalar (TZ bo'yicha):**
- Dashboard — bugungi bronlar, daromad, mijozlar, reyting
- Xizmatlarni boshqarish — xona/marshrut qo'shish, narx kalendari, mavjudlik
- Bronlar boshqaruvi — tasdiqlash / rad etish, mijoz bilan aloqa
- Moliya — daromad hisoboti, komissiya, to'lov so'rash
- Sharhlar va reyting
- Sozlamalar — profil, bank rekvizitlari, bildirishnomalar

**Talab:** Asosan desktop, responsive tablet. Ma'lumotni jadval/grafik ko'rinishda.

---

## Texnik stack

- **Next.js 16** (App Router, Turbopack) — ⚠️ yuqoridagi ogohlantirishni o'qi
- **React 19**, **Tailwind CSS v4**, **TypeScript strict**
- Turlar: `@safaar/types`'dan import (`Booking`, `BookingStatus`, `Role`...)

## Buyruqlar (shu papkadan)

```bash
npm run dev      # → localhost:3001
npm run build    # production build
npm run lint     # ESLint
```

## Backend bilan ishlash

- API: `http://localhost:4000/api`. Hamkor endpoint'lari `PARTNER` roli bilan himoyalangan.
- API javob turlarini doim `@safaar/types`'dan ol.
- Backend tayyor bo'lmasa — mock data, lekin tur `@safaar/types`'dan bo'lsin.

---

## Senior dev sifatida ish tartibi

1. **Avval o'qi, keyin yoz** — mavjud tuzilma va Next.js 16 hujjatini ko'r.
2. **Mavjud uslubga moslash**, keraksiz bog'liqlik qo'shma.
3. **Kichik, aniq o'zgartirishlar** — ortiqcha "yaxshilash" qo'shma.
4. **Tekshir** — `npm run build` va `npm run lint`, xatoni tuzat.
5. **Accessibility** va semantik HTML.
6. **Til:** O'zbek. Pul — so'm (UZS), `toLocaleString("uz-UZ")`.

---

## Sen kimsan — qurilmadan aniqla

Ishni boshlashda qaysi dasturchi ekaningni **o'zing aniqla**:
```bash
gh api user --jq .login     # yoki: git config user.name
```
Bu papka (`apps/web-partner/`) egasi — **@adhambek7717** (`CODEOWNERS`). Agar
aniqlangan foydalanuvchi boshqa bo'lsa yoki sen boshqa app papkasida bo'lsang —
**ogohlantir** va davom etishdan oldin so'ra.

## Git ish oqimi — buni FOYDALANUVCHIGA o'zing eslatib tur

**Branch:** hamma **`develop`**'da ishlaydi (har kim o'z papkasida). `main` — admin
boshqaradigan release; lekin repo egasi (farrukhdev) ruxsat bersa, **sen `main`'ga ham merge qilasan**.

### Ish boshlashdan oldin
```bash
git checkout develop
git pull --rebase origin develop
```
`@safaar/types` o'zgargan bo'lsa: `npm install && npm run build:types`.

### Push'dan OLDIN — kod tozaligini tekshir (MAJBURIY)
Push qilishni tavsiya qilishdan oldin **albatta** yashil bo'lsin:
```bash
npm run build -w @safaar/web-partner   # build xatosiz
npm run lint  -w @safaar/web-partner   # lint xatosiz
```
- ❌ Bittasi qizil bo'lsa — **push qilma**, avval xatoni tuzat.
- ✅ Hammasi yashil bo'lsa — foydalanuvchi so'ramasa ham o'zing ayt:
  > "Ish tayyor, build/lint yashil. Commit + push qilishni tavsiya qilaman."

### Push (faqat develop'ga)
```bash
git add .
git commit -m "feat(web-partner): <aniq, ish bilan mos xabar>"
git pull --rebase origin develop
git push origin develop
```

### Qoidalar (push'da hisobga ol)
- Push'dan oldin DOIM: build/lint **yashil** va `git pull --rebase origin develop`.
- Faqat **o'z papkangda** o'zgartir. `apps/backend/`, `packages/types/` — faqat o'qi;
  boshqa frontend papkalari — **tegma**. Hech qachon boshqaning papkasiga o'zgartirma.
- Asosan `develop`'ga push qil, repo egasi (farrukhdev) ruxsat bersa `main`'ga ham merge qila olasan.
- Commit xabari aniq va ish bilan mos bo'lsin — quruq "update"/"fix" emas.
