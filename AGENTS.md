# Safaar Monorepo — AI Agent Yo'riqnomasi

Bu fayl monorepo **root**ida. Agar AI agent shu darajadan ishlayotgan bo'lsa,
quyidagi tuzilma va chegaralarga **qat'iy** rioya qilsin.

> ⚠️ Eng to'g'ri ish uslubi: AI'ni root'dan emas, **o'z app papkasidan** ishga
> tushiring (`cd apps/web-user && claude`). Shunda agent faqat o'z app'ini ko'radi.

---

## Loyiha haqida

**Safaar** — O'zbekiston bo'ylab mehmonxonalarni bron qilish platformasi
(Agoda'ga o'xshash). Bitta npm workspace monorepo: 3 ta mustaqil frontend +
1 ta backend API + umumiy turlar paketi.

```
apps/
├── backend/      @safaar/backend      NestJS API        → :4000
├── web-user/     @safaar/web-user     safaar.uz         → :3000   (mijozlar)
├── web-partner/  @safaar/web-partner  partner.safaar.uz → :3001   (hamkorlar)
└── web-admin/    @safaar/web-admin    admin.safaar.uz   → :3002   (super admin)
packages/
└── types/        @safaar/types        API shartnomasi (umumiy TS turlari)
```

Uchala sayt ham **bitta backend API**'ga ulanadi; ruxsatlar rol asosida (RBAC):
`USER`, `PARTNER`, `ADMIN`, `SUPER_ADMIN`.

---

## ⛔ ENG MUHIM CHEGARA QOIDASI

Har bir papkaning **bitta egasi** bor (`CODEOWNERS` fayliga qarang). AI agent
**faqat o'ziga topshirilgan papkada** ishlaydi:

| Papka | Egasi | Boshqalar uchun |
|---|---|---|
| `apps/web-user/` | web-user dev | ⛔ tegmang (o'qima ham) |
| `apps/web-partner/` | web-partner dev | ⛔ tegmang (o'qima ham) |
| `apps/web-admin/` | web-admin dev | ⛔ tegmang (o'qima ham) |
| `apps/backend/` | backend dev | 📖 faqat O'QING (API'ni tushunish uchun), o'zgartirmang |
| `packages/types/` | backend dev | 📖 faqat O'QING (import), o'zgartirmang |

**Soddа qoida (har bir frontend dev uchun):**
- O'z app papkangda — ✅ bemalol o'qi va yoz.
- `apps/backend/` va `packages/types/` — 📖 faqat **o'qi** (API va turlarni
  tushunish uchun), hech narsa **o'zgartirma**.
- Boshqa frontend papkalari — ⛔ umuman **ochma**.

**Qoidalar:**
1. O'z app papkangizda to'liq ishlaysiz. **Boshqa frontend papkalarига**
   (`web-user`/`web-partner`/`web-admin`) tegish — o'qish ham, yozish ham —
   **taqiqlanadi**.
2. `apps/backend/` va `packages/types/` — faqat **o'qish** (API'ni tushunish va
   turlarni import qilish uchun). Ularni faqat backend dev o'zgartiradi. Agar
   yangi tur/endpoint kerak bo'lsa — o'zingiz qo'shmang, "buni backend dev'dan
   so'rang" deb ayting.
3. Root konfiguratsiya (`package.json`, `tsconfig`, `CODEOWNERS`) — faqat
   foydalanuvchi aniq so'rasa tegiladi.
4. Shubha bo'lsa — to'xtang va foydalanuvchidan so'rang.

---

## Umumiy buyruqlar (root'dan)

```bash
npm install            # barcha workspace'larni o'rnatish
npm run build:types    # @safaar/types ni birinchi build qilish (MAJBURIY birinchi)
npm run dev:user       # web-user    → :3000
npm run dev:partner    # web-partner → :3001
npm run dev:admin      # web-admin   → :3002
npm run dev:backend    # backend     → :4000
npm run build          # types + barcha applar
npm run test           # barcha testlar
```

## Konvensiyalar (butun monorepo)

- TypeScript **strict** rejimida. `any` dan qoching.
- Format: Prettier (`.prettierrc`). Lint: har app'da ESLint.
- O'zgartirishdan keyin **build va testni ishga tushiring**, yashil bo'lsin.
- Commit'lar aniq va kichik bo'lsin. Kundalik ish **`develop`** branch'ida bo'ladi
  (hamma shu yerda, faqat o'z papkasida). Push'dan oldin doim
  `git pull --rebase origin develop`. Repozitoriya egasi (thefarrukhdev) ruxsat bersa,
  AI agent to'g'ridan-to'g'ri `main` branchiga ham merge qila oladi. Batafsil — `CONTRIBUTING.md`.
- Til: UI matnlari O'zbek tilida (kerak bo'lsa Rus/Ingliz). Pul birligi — so'm (UZS).

## AI protokoli (har bir agent uchun, majburiy)

1. **Kimligingni aniqla:** ishni boshlashda `gh api user --jq .login`
   (yoki `git config user.name`). `CODEOWNERS` bilan qaysi papka egasi ekaningni
   tekshir — **o'sha papkadan tashqariga chiqma**.
2. **Push'dan OLDIN** o'z app'ingda build/lint (backend uchun test) **yashil**
   bo'lsin. Qizil bo'lsa — push qilma, avval xatoni tuzat.
3. Asosan **`develop`**'ga push qil; lekin repo egasi (thefarrukhdev) ruxsat bersa, `main` branchiga ham merge qila olasan.
4. **Boshqaning papkasiga o'zgartirma.** `apps/backend/` va `packages/types/` —
   faqat o'qish (egasi backend dev).

Tafsilotlar uchun har bir app'ning o'z `AGENTS.md` fayliga qarang.

---

## Graphify + Verifikatsiya kontrakti (barcha agentlar uchun majburiy)

Bu bo'lim `.claude/agents/*.md`dagi 12 ta specialist va `safaar-engineering-lead`
orkestratori uchun **umumiy, yagona** qatlam. Har bir agent buni allaqachon
"Start of every task: 1. Read the root `AGENTS.md`" qadami orqali o'qiydi —
shuning uchun bu qoidalar 13 ta faylning hech birini alohida tahrirlamasdan
avtomatik kuchga kiradi.

### Graphify nima va chegarasi

`graphify-out/graph.json` — kod bo'yicha AST-asoslangan bilim grafigi
(node/edge, community-cluster, god-nodes). U **faqat navigatsiya/qidiruv
yordamchisi**: qaysi fayl/funksiya qayerga bog'langanini tezroq topish uchun.
U **hech qachon** haqiqat manbai emas va quyidagilarni **hech qachon**
qila olmaydi:
- Kodni o'zgartirish yoki generatsiya qilish (faqat `graphify update`/`add`
  orqali o'z-o'zini AST darajasida yangilaydi — bu ham READ-ONLY, kod
  fayllariga tegmaydi, faqat gitignored `graphify-out/`ni yozadi).
- Test natijasi yoki production holatini bildirish.
- Hozirgi joriy kod holatini kafolatlash (quyida — nega).

**Qamrov:** `.graphify_root = .` (butun monorepo — backend + barcha 3
frontend + packages). Kanonik joy: repo root'dagi **yagona** `graphify-out/`.

**2026-09-25 tuzatilgan arxitektura muammosi:** Ilgari ikkita mustaqil,
bir-biridan farqli graph instance mavjud edi — `graphify-out/` (repo root) va
`apps/backend/graphify-out/` (nested) — chunki `.githooks/post-commit` va
`.githooks/post-checkout` detached rebuild'ni `cwd=os.getcwd()` bilan
ishga tushirar edi, ya'ni `git commit`/`git checkout` qaysi papkadan
chaqirilgan bo'lsa, relative `graphify-out/` o'sha yerda yaratilar edi.
Tuzatildi: har ikkala hook endi `git rev-parse --show-toplevel`ni hisoblab,
detached rebuild jarayonini har doim repo root'dan ishga tushiradi
(`GRAPHIFY_REPO_ROOT` orqali) — natijada invocation `cwd`dan qat'i nazar
har doim bitta, bir xil kanonik grafik yangilanadi. Eskirgan nested
`apps/backend/graphify-out/` (gitignored, regenerable) o'chirildi.

### Majburiy dalil zanjiri (evidence chain)

Har qanday "bu ishlaydi" yoki "bu mavjud" da'vosi quyidagi zanjirdan o'tishi
kerak — bosqichlar **avtomatik ravishda PASS'ga olib kelmaydi**, har biri
alohida dalil:

1. **Graphify discovery** — `graphify query/path/explain` bilan orientatsiya
   (qaysi fayl/funksiya tegishli ekanini tezroq topish uchun).
2. **Source verification** — Graphify ko'rsatgan joyni **haqiqiy faylni
   o'qib** tasdiqlash. Bu bosqich **hech qachon** o'tkazib yuborilmaydi.
3. **Test verification** — tegishli mavjud testlarni ishga tushirish (yoki
   yangi minimal test yozib ishga tushirish), natijani real terminal
   chiqishi bilan ko'rsatish.
4. **Runtime verification** — faqat kerak bo'lsa va xavfsiz bo'lsa (masalan
   production'da allaqachon tasdiqlangan holatni qayta tekshirish); yangi
   production yozuvlar yoki o'ylab topilgan credential bilan HECH QACHON.
5. **Final status** — pastdagi 5 holatdan biri, aniq sabab bilan.

### 8 ta qat'iy qoida

1. Graphify natijasi **yolg'iz o'zi hech qachon PASS'ni oqlay olmaydi**.
2. Manba (source) va Graphify orasida ziddiyat topilsa — **manbaga ishoning**,
   grafikni "eskirgan bo'lishi mumkin" deb belgilang (`GRAPH_STALE = TRUE`),
   jim o'tib ketmang.
3. "Dalil yo'q" = "PASS yo'q". Hech qanday holatda taxmin bilan PASS berilmaydi.
4. Graphify "topilmadi" degani "kodda yo'q" degani emas — ayniqsa frontend
   uchun (qamrov tashqarisida bo'lishi mumkin).
5. Har bir PASS/PARTIAL/FAIL da'vosi kamida bitta real fayl:qator yoki real
   test/terminal chiqishiga bog'langan bo'lishi kerak.
6. Grafik holati (`built_at_commit`) joriy `git rev-parse HEAD`dan orqada
   qolgan bo'lsa (`git merge-base --is-ancestor <built_at_commit> HEAD`),
   va farq oralig'ida (`git log <built_at_commit>..HEAD --name-only`) siz
   tekshirayotgan sohaga tegishli fayllar o'zgargan bo'lsa — bu aniq
   `GRAPH_STALE = TRUE` holati, buni report'da ochiq yozing.
7. `graphify update`dan boshqa hech qanday Graphify buyrug'i kod fayllariga
   yozmaydi/o'zgartirmaydi — bu qat'iy READ-ONLY qatlam.
8. 12 ta agent uchun 12 ta alohida/raqobatdosh graph instance yaratmang —
   yagona umumiy `graphify-out/` (repo root) dan foydalaning.

### Dalil ierarxiyasi (avtomatik cascade EMAS)

Eng ishonchlidan kamroq ishonchliga: **Production runtime tekshiruvi >
mavjud test natijasi (yangi ishga tushirilgan) > to'g'ridan-to'g'ri source
o'qish > Graphify query natijasi**. Yuqori daraja past darajani
**almashtirmaydi** — masalan test o'tgani source'ni o'qimaslik uchun bahona
emas, Graphify orientatsiyasi source o'qishni almashtirmaydi. Bu shunchaki
qaysi dalil ziddiyat holatida ustunroq ekanini ko'rsatadi (qoida 2).

### Status ta'riflari

- **PASS** — to'liq dalil zanjiri (kamida source + test) tasdiqlagan, hech
  qanday ziddiyat yo'q.
- **PARTIAL** — bir qismi tasdiqlangan (masalan backend to'liq ishlaydi va
  tekshirilgan), lekin boshqa qismi (masalan frontend UI) yo'q/tugallanmagan
  — bu FAIL emas, chunki mavjud qism haqiqatan ishlaydi, lekin to'liq PASS
  ham emas.
- **UNVERIFIED** — kod mavjud ko'rinadi, lekin dalil zanjirini to'liq
  yurita olmadingiz (masalan test yo'q, ishga tushirib bo'lmadi, runtime
  tekshiruvi xavfli/ruxsatsiz bo'lgani uchun o'tkazilmadi). "Balki ishlaydi"
  degani emas — "hali bilmayman" degani.
- **BLOCKED** — tekshiruvni davom ettirish uchun ruxsat/credential/muhit
  yetishmayapti (masalan production yozuv huquqi kerak, lekin berilmagan).
- **FAIL** — dalil aniq ziddiyatni yoki ishlamaslikni ko'rsatdi.

### Report format (har bir agent report'ida majburiy sub-bo'lim)

```
## VERIFICATION
- Graphify discovery: <query/path/explain qilingan savol va topilgan joy, yoki "N/A — qamrovdan tashqarida">
- GRAPH_STALE: <TRUE/FALSE — built_at_commit vs HEAD taqqoslash natijasi>
- Source verification: <fayl:qator, real o'qilgan tasdiq>
- Test verification: <qaysi test, natija (pass/fail soni), yoki "N/A — sabab">
- Runtime verification: <bajarildimi, natija, yoki "N/A — sabab">
- Status: <PASS|PARTIAL|UNVERIFIED|BLOCKED|FAIL>
```
