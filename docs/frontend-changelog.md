# Frontend Changelog (web-user)

Ushbu fayl faqat `apps/web-user` frontendidagi o'zgarishlarni hujjatlashtiradi.
Har bir frontend task tugagach yangi entry tepaga qo'shiladi — eski entrylar
o'chirilmaydi yoki o'zgartirilmaydi.

> Eslatma: 2026-09-04 dan boshlab bu faylga `web-admin` QA-fix entrylari ham
> `(web-admin)` belgisi bilan qo'shiladi (alohida duplicate doc yaratilmadi).

---

# 2026-09-06 — (web-admin) P3: Escape reject tasdiqlash oynasini emas, butun ariza drawerini yopardi

## Manba
QA regressiya testi (Playwright + Chromium, izolyatsiya qilingan QA muhiti)
paytida topilgan: `/partners/requests` sahifasida "Rad etish" tugmasi
bosilib tasdiqlash oynasi ochilgach, `Escape` tugmasi bosilsa — kutilganidek
faqat o'sha tasdiqlash oynasi emas, balki uning ORQASIDAGI ariza detali
drawer'i HAM birga yopilib ketardi. Mutatsiya sodir bo'lmasdi (xavfsizlik
nuqtai nazaridan zararsiz), lekin admin arizani ko'rib turgan joyini
yo'qotib qo'yardi.

## Root cause (isbotlangan)
`components/ui/Modal.tsx` har bir instansiyasi o'zining `Escape` tugmasini
kuzatuvchi listenerini to'g'ridan-to'g'ri `document`ga ulardi:

```ts
useEffect(() => {
  function handleEscape(e) { if (e.key === "Escape") onClose(); }
  if (open) document.addEventListener("keydown", handleEscape);
  return () => document.removeEventListener("keydown", handleEscape);
}, [open, onClose]);
```

`/partners/requests` sahifasida IKKITA `<Modal>` bir vaqtning o'zida DOM'da
ochiq turadi — ariza detali drawer'i (`open={!!selectedRequest}`) va uning
USTIDA "Rad etish"/"Tasdiqlash" tasdiqlash oynasi (`open={confirmKind !==
null}`). Ikkalasi ham `document`ga mustaqil ravishda o'zining listenerini
ulagani uchun, bitta `Escape` bosilganda IKKALASI HAM o'z `onClose()`ini
chaqirardi — natijada drawer ham, tasdiqlash oynasi ham birga yopilib
ketardi.

## Fix
`Modal.tsx`ga modul darajasidagi umumiy `openModalStack` (hozir ochiq
turgan Modal instansiyalari, ochilish tartibida) qo'shildi. Har bir
instansiya `useId()` orqali o'z barqaror identifikatorini oladi va ochilganda
shu stackka qo'shiladi (yopilganda/unmount bo'lganda olib tashlanadi — bu
alohida `useEffect`da, `onClose` identifikatori har render'da o'zgarishi
sababli stackning tasodifan qayta tuzilib ketmasligi uchun). `Escape`
handler endi `onClose()`ni FAQAT shu instansiya stackning ENG TEPASIDA
(eng oxirgi ochilgan, ya'ni eng ustki) bo'lsagina chaqiradi — aks holda
hech narsa qilmaydi. Bitta Modal ochiq bo'lgan oddiy holatda xatti-harakat
o'zgarmaydi (stackda faqat bitta element — u doim "eng tepada").

## Fayllar
| Fayl | O'zgarish |
|---|---|
| `apps/web-admin/components/ui/Modal.tsx` | umumiy `openModalStack` + `useId()` — `Escape` faqat eng ustki (oxirgi ochilgan) Modal instansiyasida ishlaydi. |

## Test
- `tsc --noEmit` (`apps/web-admin`): PASS.
- `eslint` (`Modal.tsx`): 0 error.
- REAL BROWSER regression (Chromium + Playwright, izolyatsiya qilingan QA
  muhiti, fresh locatorlar bilan): "Rad etish" → tasdiqlash oynasi ochiladi
  → `Escape` → FAQAT tasdiqlash oynasi yopiladi, ariza detali drawer'i OCHIQ
  qoladi, 0 ta mutatsiya; qayta ochib "Bekor qilish" → 0 ta mutatsiya, drawer
  ochiq qoladi; qayta ochib sabab kiritib "Rad etish" (tasdiqlash) → aynan 1
  ta `POST /reject`, ariza holati `rejected`ga o'tadi, `rejection_reason`
  yozib qo'yiladi.
- Boshqa Modal ishlatuvchi sahifalar (`users`, `bookings/[id]`, `catalog`,
  `promos`, `partners/[id]`, `users/[id]`, `cms/banners`,
  `cms/_components/cms-article-manager`) — bitta-Modal holatida xatti-harakat
  o'zgarmaydi (umumiy komponentga tuzatish, boshqa fayllarga tegilmadi).

## Deploy
- **LOKAL** — o'zgarishlar `temp/save-all-work` branchida commit qilinishi
  kutilmoqda (hali commit qilinmagan, faqat QA'da tekshirilgan).
- Production deploy'i kutilmoqda — alohida tasdiqlash talab qilinadi.

## Git
- Branch: `temp/save-all-work`
- Frontend `develop`ga CHIQARILMAYDI (loyiha qoidasi: frontend fayllar
  `develop`ga push qilinmaydi).

---

# 2026-09-04 — (web-admin) Production login tuzatildi: Server Action → backend `fetch failed`

## Manba
Real Browser Production QA (Playwright + Chromium, `web-admin-phi-beige.vercel.app`)
paytida topilgan CRITICAL muammo: `/login` sahifasidagi "Boshqaruv Paneliga
Kirish" tugmasi bosilганда "fetch failed" chiqardi va panelga kirib bo'lmasdi.

## Muammo (kuzatilgan)
- Brauzer login formasi → `adminLoginAction()` (Next.js Server Action) →
  `fetch("https://api.safaar.uz/v1/auth/admin/login")` → **`fetch failed`**
  (~10–12 s socket timeout dan keyin).
- **Intermittent**: bir "warm" oynada 9/9 urinish fail; keyin (funksiya "cold"
  bo'lgach) yana ishlaydi. `44adad94` (oldingi frontend fix) BILAN BOG'LIQ EMAS —
  `lib/auth/actions.ts` o'sha commitда o'zgармаган.
- Bir vaqtning o'zida:
  - `/api/proxy/auth/admin/login` (Route Handler, SHU backend endpoint) → 8/8 PASS
  - `curl https://api.safaar.uz/v1/auth/admin/login` (to'g'ridан) → 6/6 PASS
  - backend `/v1/health` → 200, sog'lom.

## Root cause (isbotlangan)
Node'ning global `fetch`i (undici) HTTP keep-alive ulanишларини **pool** qiladi.
`/login` Server Action past-trafikli serverless funksiyada ishlaydi: funksiya
"warm" tursa ham, backendga boradigan **tunnel orqali o'tган yo'l** (Vercel →
YC Caddy → Tailscale tunnel → uy NAT → konteйner) uzoq turган idle TCP
ulanишни jimgina yopadi. Keyingi login o'sha **o'lик socket**ни pool'dan olib
so'rov yozadi, javob kelmaydi va `fetch` ~socket-timeout dan keyin bare
`TypeError: fetch failed` bilan rad etадi.

Yuqori-trafikli `/api/proxy` Route Handler funksiyasi bu holatga tushmaydi —
uning pool'i uzлуксиз ishlатилиб turadi (har 30 s notification polling +
har bir admin API chaqiruvи), o'лик socketlar tez almashtiriladi.

Belgилар: (a) intermittent, idle vaqtga bog'liq; (b) cold/fresh invocation'da
ishlaydi; (c) warm holатда ketма-ket fail; (d) bir xil chaqiruvни qilган Route
Handler hech qачон fail bo'lмайди; (e) ~12 s = socket-timeout imzosi (DNS bo'lса
darhol, conn-refused bo'lса darhol RST).

## Eski behavior
`backendPost()` bir marta `fetch` qiladi, timeout yo'q, retry yo'q. O'лик
pooled socket = doimiy "fetch failed", foydalanuvchi panelga kira olmaydi.

## Yangi behavior
`apps/web-admin/lib/auth/actions.ts` → `backendPost()`:
- **Faqat transport xatосида** (HTTP javob umuman kelмаса) 3 martagacha retry.
  undici birinchi urinишда o'лик socketни pool'dан chiqаради → 2-urinиш yangi
  ulanишга tushади. Backoff 300/600 ms.
- Har urinишга `AbortSignal.timeout(8000)` — o'лик socket 8 s'да tashlanади
  (undici default'ига umид qilmaймиз).
- **HTTP javob kelса (401 va boshqалар) — retry YO'Q**: noto'g'ri parol
  `AUTH_INVALID_CREDENTIALS` bo'либ o'згаришсиз o'тади, lockout counter'га
  ta'sir qilмайди.
- Yakuniy transport xato bo'лса, o'ша xato o'згаришсиз throw qилинади (UI
  avvалгидек generic xabar ko'рсатади).
- Har transport-fail Vercel runtime log'ига `console.error` bo'либ yozилади
  (`cause` kodи bilan) — kelajакда diagnostика uchun. Sirlar yo'q, host public.
- `adminVerify2FAAction` ham shu `backendPost`ni ishlатади → avtоmatик foyda.

Arxитектура o'zгармаган: login hali ham Server Action, httpOnly `admin_token`
cookie hali ham serverда yozилади, JWT brauzерга chiqмайди, `/api/proxy` oqими
teginилмаган.

## Fayllar
| Fayl | O'zgarиш |
|---|---|
| `apps/web-admin/lib/auth/actions.ts` | `backendPost()` — transport-only retry (3×) + `AbortSignal.timeout(8s)` + diagnostic `console.error`. `adminLoginAction`/`adminVerify2FAAction`/cookie/response-mapping — o'zgармаган. |

## Security
- Parol hech qаерда log qилинмади (retry faqat `path` + xato nomини logлайди).
- JWT/refresh token brauzерга chiqмайди — avvалгидек httpOnly cookie.
- Cookie flag'лари o'zгармаган (`httpOnly`, `sameSite=lax`, `secure` prod'да).
- Generic invalid-credential xatти-harакати saqlanди (retry qилинмайди).
- CORS/session semantикаси o'zгармаган.

## Test
- `tsc --noEmit` = PASS, `eslint` = PASS, `next build` = PASS.
- Production deploy + real Chromium `web-admin-phi-beige.vercel.app`:
  UI login ×N ketма-кет PASS, dashboard yuklanди, negative login = generic,
  logout/session = PASS, BUG-B01 / BUG-B02 regressiya = PASS.
- Vercel runtime log'да `[adminAuth] ... transport failure ... (cause ...)` —
  root-cause tasдиqи.

---

# 2026-09-04 — (web-admin) Real Browser QA fix: Approve/Reject confirmation + mobil layout + P3

## Manba
So'nggi REAL BROWSER Production QA reporti (Playwright + Chromium,
`web-admin-phi-beige.vercel.app`).

## BUG-B01 (P2) — Hamkor arizasini Approve/Reject tasdiqsiz bajarilardi

### Asl bug
`Hamkorlar → Arizalar` → ariza detali modalidagi **"Tasdiqlash"** va
**"Rad etish"** tugmalari bosilishi bilanoq API chaqiruvini bajarardi —
hech qanday tasdiqlash oynasi yo'q, "Rad etish" uchun sabab kiritish
imkoniyati yo'q. Tasodifiy bir marta bosish real hamkor arizasini
qaytarib bo'lmaydigan holatga o'tkazardi (QA vaqtida 2 ta QA arizasi
shu tarzda tasodifan mutatsiyaga uchradi va tiklandi).

### Root cause
`apps/web-admin/app/(dashboard)/partners/requests/page.tsx` —
"Tasdiqlash"/"Rad etish" tugmalari to'g'ridan-to'g'ri
`handleDecision(id, 'approve'|'reject')` → `AdminApi.approvePartner` /
`AdminApi.rejectPartner` ni chaqirardi. `rejectPartner(id, reason?)` allaqachon
sababni qabul qiladi, lekin sahifa uni hech qachon yig'ib bermas edi.

### Eski behavior
Bir marta bosish = darhol mutatsiya. Tasdiqlash yo'q. Sabab yo'q.

### Yangi behavior
- "Tasdiqlash"/"Rad etish" tugmalari faqat `confirmKind` state'ini o'rnatadi
  (mutatsiya YO'Q).
- Alohida tasdiqlash `Modal`i ochiladi:
  - Approve: aniq matn + "Bekor qilish" / "Tasdiqlash".
  - Reject: **majburiy sabab `textarea`si** + "Bekor qilish" / "Rad etish".
    Tasdiq tugmasi sabab bo'sh bo'lsa `disabled`.
- "Bekor qilish", overlay bosish, Escape — API chaqirilmaydi, holat
  o'zgarmaydi.
- Yuborilayotganda tasdiq tugmasi `loading` + `disabled` (double-click
  himoyasi), submit paytida modal yopilmaydi.
- Muvaffaqiyat/xato `toast` bilan ko'rsatiladi (avvalgidek).

### Fayllar
| Fayl | O'zgarish |
|---|---|
| `apps/web-admin/app/(dashboard)/partners/requests/page.tsx` | `confirmKind` + `rejectReason` state; tugmalar endi tasdiqlash modalini ochadi; yangi tasdiqlash `Modal`i; `handleDecision(id, decision, reason?)` → `rejectPartner`ga sabab uzatiladi. |

## BUG-B02 (P2) — Mobil (390px) layout gorizontal overflow

### Asl bug
390×844 da har bir sahifada gorizontal skroll (`scrollWidth` ~547–593 vs
390). Sidebar telefon kengligiga moslashmagan, hamburger tugmasi yo'q.

### Root cause
- `apps/web-admin/app/(dashboard)/layout.tsx` — asosiy kontent `div`i
  BARCHA ekranlarda qattiq `ml-[var(--sidebar-width)]` (280px) ishlatardi.
- `Sidebar.tsx` — `fixed w-280px`, doim ko'rinadi, mobil holat yo'q.
- `TopBar.tsx` — hamburger/mobil menyu tugmasi yo'q.

### Yangi behavior
- Asosiy kontent: `ml-0`, faqat `lg:` da `lg:ml-[var(--sidebar-width)]` /
  `lg:ml-[var(--sidebar-collapsed)]`. `min-w-0 overflow-x-hidden`.
- `Sidebar`: `< lg` da off-canvas drawer (`-translate-x-full` →
  `translate-x-0` ochilganda), backdrop bilan; `lg:translate-x-0` doim
  ko'rinadi. `mobileOpen` / `onMobileClose` propslari. Drawer ichida biror
  linkni bosganda mobil holatida yopiladi.
- `TopBar`: `< lg` da hamburger tugmasi (`aria-label="Menyuni ochish"`) →
  drawer ochiladi. Sarlavha `truncate`, tavsif `sm:` da ko'rinadi.

### Fayllar
| Fayl | O'zgarish |
|---|---|
| `apps/web-admin/app/(dashboard)/layout.tsx` | `mobileOpen` state; responsive `ml`; `min-w-0 overflow-x-hidden`; propslar uzatildi. |
| `apps/web-admin/components/layout/Sidebar.tsx` | off-canvas drawer + backdrop + `mobileOpen`/`onMobileClose` propslari. |
| `apps/web-admin/components/layout/TopBar.tsx` | hamburger tugmasi (`< lg`), `onMenuClick` prop, responsive padding/typografiya. |

## P3 — Login form accessibility

### Asl bug
Login inputlarida `id`/`<label for>` bog'lanishi yo'q; `autocomplete` yo'q
(screen-reader label ↔ input bog'lay olmaydi).

### Yangi behavior
`#admin-username` + `#admin-password` idlari, `<label htmlFor>`,
`aria-label`, `autoComplete="username"` / `"current-password"` qo'shildi.
(Bo'sh maydon validatsiyasi — "Login va parolni kiriting" — allaqachon
bor edi; QA reportidagi B03 shu jihatdan false-positive edi.)

### Fayllar
| Fayl | O'zgarish |
|---|---|
| `apps/web-admin/app/(auth)/login/page.tsx` | inputlarga `id`/`name`/`autoComplete`/`aria-label`, labellarga `htmlFor`. |

## Build unblock (P2, bu bug emas — deploy blokerini olib tashlash)

`apps/web-admin/app/(dashboard)/promos/page.tsx` da `discountType` uchun
lokal Zod sxemasi `"percentage"` ishlatardi, ammo ilovaning kanonik turi
(`types/admin.ts`, `admin-api.ts` `PromoCode`) `"percent"`. Bu drift
`next build` type-check bosqichini **buzardi** (mening o'zgarishlarimdan
oldin, `origin/develop` da ham bor edi). `promos/page.tsx` dagi 7 ta
`"percentage"` → `"percent"` ga tekislandi (API client allaqachon
`'percent'` → wire `'percentage'` konvertatsiyasini qiladi). Boshqa
promos mantig'i o'zgarmadi.

## API / Backend
- Backend o'zgardimi: **NO**
- Yangi API kerak bo'ldimi: **NO**
- Mavjud API: `POST /admin/partners/:id/approve`, `POST /admin/partners/:id/reject`
  (`{ reason }` — backend allaqachon qo'llab-quvvatlaydi).

## Test
- `tsc --noEmit` (`apps/web-admin`): **PASS** — 0 xato (promos fix bilan;
  fix'dan oldin 4 ta pre-existing xato bor edi).
- `eslint` (o'zgartirilgan 6 fayl): **0 error** (3 warning — hammasi
  pre-existing: `catch (error: any)`, `form.watch()` incompatible-library).
- `next build` (`apps/web-admin`): **PASS** — exit 0, barcha 30 route.
- REAL BROWSER regression (Chromium + Playwright, lokal `next dev` build →
  **haqiqiy production API** `https://api.safaar.uz/v1`):
  - **BUG-B01**: "Rad etish" → tasdiq oynasi chiqadi, confirm'gacha 0 ta
    API mutatsiyasi; sabab bo'sh bo'lsa confirm `disabled`; "Bekor qilish"
    → 0 mutatsiya, holat o'zgarmaydi; sabab bilan confirm → aynan 1 ta
    `POST /reject`, ariza `rejected`. "Tasdiqlash" → tasdiq oynasi;
    "Bekor qilish" → 0 mutatsiya; confirm → aynan 1 ta `POST /approve`,
    ariza `approved`. QA arizasi har safar `submitted` ga tiklandi.
  - **BUG-B02**: 1440/1280/1024/768/390 — barcha viewportda
    `scrollWidth <= innerWidth` (390 da endi aynan 390, avval 547–593);
    `< lg` da hamburger ko'rinadi; bosilganda drawer ochiladi
    (`transform: none` = `translate-x-0`).
  - **A11y**: `#admin-username` / `#admin-password` + `label[for]` mos;
    login ishlaydi.
- Muhim regressionlar: topilmadi. Boshqa sahifalar (dashboard, catalog,
  promos, finance, cms, users, audit, settings, developer) 0
  console/pageerror bilan yuklandi.

## Deploy
- **LOKAL** — o'zgarishlar `temp/save-all-work` branchida commit qilindi.
- Vercel `web-admin` production deploy'i **BLOKLANGAN**: bu ish muhitida
  `web-admin` Vercel project link/credential mavjud emas (`.vercel` root
  `web-partner` ga bog'langan). Deploy `web-admin` Vercel loyihasiga
  kirish huquqi bo'lgan kishi tomonidan qilinishi kerak
  (`npx vercel --prod` yoki git-connected branch). Fixlar haqiqiy
  production API'ga qarab real brauzerda tasdiqlangan; faqat
  Vercel-hosted URL verifikatsiyasi deploy'dan keyin qoladi.

## Git
- Branch: `temp/save-all-work`
- Frontend `develop` ga CHIQARILMADI (loyiha qoidasi: frontend fayllar
  `develop` ga push qilinmaydi).

## Muhim eslatmalar
- QA-fix vaqtida QA arizalari `39e682d2` (QA TEST PARTNER 2026-09-04) va
  `6923851e` (QA TEST PARTNER 2026-09-03) test mutatsiyalariga uchradi —
  ikkalasi ham `submitted` holatiga tiklandi. Real hamkor/hotel/user/pul
  ma'lumotlari o'zgartirilmadi.
- Qolgan BLOCKED test hududlari (Hotels/Rooms CRUD, deep form validation,
  money-action modal UX, `/cms/*` chuqur test) — ular alohida QA taskda.

# 2026-08-29 — `/uz/dachas`, `/uz/resorts`, `/uz/sanatoriums` kategoriya filtri (P2 bug)

## Asl bug
`/uz/dachas`, `/uz/resorts`, `/uz/sanatoriums` uchala sahifasi ham **umumiy
`/uz/hotels` ro'yxatini** ko'rsatardi — faqat sahifa sarlavhasi ("Dachalar" /
"Oromgohlar" / "Sanatoriylar") farq qilardi, kartalar esa hammasi
`/uz/hotels/<slug>`ga bog'lanardi. Foydalanuvchi dacha bo'limiga kirsa ham
mehmonxonalarni ko'rardi.

## Root cause
- `apps/web-user/components/accommodation/AccommodationPage.tsx` (hotels /
  dachas / resorts / sanatoriums — hammasi shu bitta komponentdan render
  bo'ladi) `api.hotels.getHotels(...)`ni **hech qanday tur/kategoriya filtri
  bermasdan** chaqirardi.
- Backend `GET /v1/hotels` (`HotelsService.findAllFresh`) `partner_organizations.type`
  bo'yicha faqat **qattiq yozilgan** `IN ('hotel','hostel','guesthouse','motel','dacha','mixed')`
  ishlatardi — `?type=` parametri yo'q edi. Bundan tashqari bu ro'yxatda
  `sanatorium`/`resort` umuman yo'q edi (garchi `PartnerOrganizationType`
  enum'ida ular bor).

## Kategoriya = qaysi maydon
Mavjud maydon: **`partner_organizations.type`** (`PartnerOrganizationType` enum:
`hotel, hostel, guesthouse, motel, dacha, sanatorium, resort, restaurant, mixed`).
Yangi maydon/jadval qo'shilmadi. `Hotel` modelida allaqachon `// Dacha uchun`
(`land_area_sotix`, `has_outdoor_pool`, …) va `// Sanatoriy uchun`
(`medical_profiles`, `included_treatments`, …) maydonlari bor.

## O'zgartirildi
| Fayl | O'zgarish |
|---|---|
| `apps/backend/src/hotels/hotels.service.ts` | `findAllFresh`: yangi `?type=` filtri — yaroqli yashash-joyi turi berilsa `po.type = $N`, aks holda avvalgi standart `IN (...)` ro'yxati (`/hotels` **o'zgarmaydi**). `findOne` (detal sahifa) `IN (...)` ro'yxatiga `sanatorium`, `resort` qo'shildi — aks holda ularning detal sahifasi 404 berardi. `map()` avtomatik `findAll`dan meros oladi. `cacheKey` `type`ni avtomatik hisobga oladi. |
| `packages/api-client/src/services/hotels.ts` | `HotelListParams`ga `type?: string` + `getHotels` query'siga `type` uzatildi. |
| `apps/web-user/components/features/accommodation/renderAccommodationRoute.tsx` | Route kaliti → tur xaritasi: `dachas→dacha`, `resorts→resort`, `sanatoriums→sanatorium`, `hotels→undefined`. `AccommodationPage`ga `accommodationType` prop'i uzatiladi. |
| `apps/web-user/components/accommodation/AccommodationPage.tsx` | Yangi `accommodationType?` prop → `getHotels`ga `type` sifatida uzatiladi. |
| `apps/backend/src/hotels/hotels.service.spec.ts` | Yangi testlar: `?type=dacha/resort/sanatorium` → `po.type = $1`; case/whitespace normalizatsiyasi; noma'lum/`bus`/`restaurant` `type` → standart katalog; `findOne` sanatorium/resort'ga ruxsat beradi. Mavjud testlar zaiflashtirilmadi. |

Vizual dizayn takrorlanmadi — bir xil `AccommodationPage` + `AccommodationListWithMap`
+ `AccommodationCategoryTabs` ishlatiladi, faqat `type` filtri qo'shildi.

## Production ma'lumot holati (2026-08-29, prod DB tekshiruvi)
- `resort` (published + approved): **2** → `/uz/resorts` ularni ko'rsatadi.
- `sanatorium`: **1** → `/uz/sanatoriums` uni ko'rsatadi.
- `dacha`: **0 published** (2 ta approved dacha *hamkori* bor, lekin ularning
  `hotels` yozuvi hali `published` emas: 2 draft + 1 pending_review) →
  `/uz/dachas` **bo'sh holat** ko'rsatadi. Bu **filtr xatosi emas** —
  FILTR ISHLAYDI, shu KATEGORIYA UCHUN PUBLISHED PROD MA'LUMOT YO'Q.

## Qanday test qilish
- `GET /v1/hotels?type=resort` → faqat `resort` turidagi published+approved
  e'lonlar. `GET /v1/hotels` (parametrsiz) → avvalgidek.
- `/uz/resorts` DevTools Network'da `.../v1/hotels?type=resort` so'rovi ketishi
  kerak; `/uz/hotels` da `type` yo'q.
- `/uz/hotels` regressiyasi bo'lmasligi kerak (bir xil ro'yxat).
- Backend: `npx jest src/hotels` (11 test).

## Qaytadan kiritmaslik uchun
Yangi accommodation kategoriya route qo'shsangiz: `renderAccommodationRoute.tsx`
dagi `ACCOMMODATION_TYPE_BY_KEY` xaritasiga qo'shing va `hotels.service.ts` dagi
`ACCOMMODATION_TYPES` set'ida tur borligiga ishonch hosil qiling. Backend
`findAllFresh` va `findOne` ikkalasi ham yangi turni qo'llab-quvvatlashi shart
(list ko'rinsa-yu detal 404 bersa — yarim ishlaydi).

## Deploy
Ikki tomonlama: backend (`HotelsService` o'zgarishi) **va** web-user (`?type=`
uzatish). Web-user'ni yolg'iz deploy qilish yetarli emas — hozirgi prod backend
noma'lum `?type=` ni e'tiborsiz qoldiradi. Bu yozuv yozilганда: **lokal fixed,
deploy kutilmoqda** (backend deploy alohida, boshqa sessiyaning davom etayotgan
backend ishi bilan muvofiqlashtirilishi kerak).

## Git
- Branch: `temp/save-all-work` (yangi branch/merge/push yo'q).

# 2026-08-29 — Ikki production bug: (F1) NotificationsBell header'ga ulanmagan edi, (F2) `/sw.js` MIME xatosi

QA (production'ga qarshi Playwright) ikkita haqiqiy frontend/deploy nosozligini
aniqladi. Ikkalasi ham `apps/web-user`da, ikkalasi ham tuzatildi.

---

## F1 — NotificationsBell header'ga ulanmagan edi

### Asl bug
`components/layout/NotificationsBell.tsx` — to'liq yozilgan komponent (bildirishnoma
`list`, `markRead`, `markAllRead`, dropdown UI, 30s polling, `notification.created`
real-time event). Lekin **hech qayerda import/render qilinmagan** edi. Kirgan
foydalanuvchi bildirishnomalarni ko'ra olmasdi — web-user'da boshqa bildirishnoma
UI'si umuman yo'q (`grep -r notification app/` — bo'sh).

### Root cause / nega yuz bergan
`SiteHeader.tsx` faqat `authed: boolean` propini olardi, `token`ni emas.
`NotificationsBell` esa `token` (access JWT) talab qiladi — usiz `null` qaytaradi.
Komponent yozilgan, lekin header'ni yig'ish bosqichida hech kim uni `SiteHeader`
ичiga qo'ymagan va token'ni unga uzatmagan. Klassik "yarim yetkazilgan feature".

### Nima o'zgardi
1. `app/[lang]/(main)/layout.tsx` — `<SiteHeader ... token={session?.accessToken} />`
   (session allaqachon shu yerda `getSession()` orqali olinardi; `accessToken`
   xuddi shu joydagi `<RealtimeProvider accessToken=...>`ga ham beriladi, ya'ni
   token'ni client'ga ochish **yangi xavf emas** — mavjud pattern).
2. `components/layout/SiteHeader.tsx` — yangi ixtiyoriy `token?: string` propi;
   `const notifications = authed && token ? <NotificationsBell locale={locale}
   token={token} /> : null;` — ikki bosqichli tekshiruv (prop + komponentning
   o'z `if (!token) return null`).
3. `components/layout/ScrollNav.tsx` — yangi ixtiyoriy `notifications?: ReactNode`
   propi. Desktop navbar'ning o'ng blokida (`actions`dan oldin) VA mobil top-bar'da
   (hamburger tugmasi yonida) render qilinadi.

### To'g'ri arxitektura / integratsiya nuqtasi
- Token manbasi: **faqat** `app/[lang]/(main)/layout.tsx` server component'ida
  `getSession()` (httpOnly `safaar_session` cookie). Boshqa joydan token olmang.
- Ulanish nuqtasi: `(main)/layout.tsx` → `SiteHeader` (`token` prop) → `ScrollNav`
  (`notifications` prop) → `NotificationsBell`. `SiteHeader`/`(main)/layout` server
  component; `NotificationsBell`/`ScrollNav` client — server client'ni prop sifatida
  uzatishi to'g'ri pattern.
- `NotificationsBell` `useRealtimeEvent`dan foydalanadi → **`RealtimeProvider`
  ichida bo'lishi shart**. `(main)/layout.tsx` allaqachon butun daraxtni
  `<RealtimeProvider>`ga o'raydi, shu sabab shu layout'dan tashqarida ishlatib
  bo'lmaydi.
- Responsив: `AuthButtons` bilan bir xil — qo'ng'iroq **ikki marta** render
  qilinadi (desktop nav + mobil header, CSS bilan almashtiriladi). Natijada DOM'da
  2 nusxa bo'ladi (faqat bittasi ko'rinadi). Tegishli tradeoff: 2 ta 30s polling
  (har biri 1 `GET /notifications`). Yengil; agar keyinchalik muammo bo'lsa —
  fetch'ni umumiy context/hook'ga ko'tarish kerak.

### Qayta kiritmaslik uchun
- `SiteHeader`ga yangi "kirgan-foydalanuvchi" element qo'shsangiz, token'ni
  `(main)/layout.tsx`dan prop orqali bering — `SiteHeader` ichida `getSession()`
  chaqirmang (u client emas, lekin arxitekturani buzadi va boshqa layout'larda
  sinadi).
- `NotificationsBell`ni faqat `(main)` route-group ichida ishlating (`RealtimeProvider`
  + `getSession` shu yerda).
- Qo'ng'iroqni `authed && token` bilan gate qiling — `authed` bo'lib token
  bo'lmasligi mumkin (muddati o'tgan sessiya `getSession`da `null` qaytaradi, lekin
  himoya sifatida ikki tekshiruv qoldiriladi).

### Qanday tekshirish (verify)
Lokal production build + real backend:
```
cd apps/web-user
NEXT_PUBLIC_API_URL=https://111-88-246-79.sslip.io/v1 \
NEXT_PUBLIC_SITE_URL=http://localhost:3100 \
npx next build && npx next start -p 3100
```
Keyin:
- Kirmagan holatda `/uz/hotels` → `button[aria-label="Bildirishnomalar"]` = **0 ta**.
- Telefon+OTP orqali ro'yxatdan o'ting (dev kod real backend javobida) → header'da
  qo'ng'iroq **ko'rinadi**; bosilганда dropdown ochiladi (`role="menu"` ичida
  "Bildirishnomalar" sarlavhasi); `GET /notifications` so'rovi ketadi.
- Desktop (≥768px) → qo'ng'iroq navbar'da; mobil (<768px) → top-bar'da hamburger
  yonida.
- E2E: `e2e/tests/user/critical-flow.spec.ts` (18-qadam) shu qo'ng'iroqni tekshiradi.
  **DIQQAT:** bu spec default'da **production**ga qarshi ishlaydi. `localhost`ga
  qarshi ishlatilsa, qo'ng'iroqning `GET /notifications` so'rovi **CORS**dan
  o'tmaydi (backend `Access-Control-Allow-Origin` ro'yxatida faqat
  `web-user-rho.vercel.app` / `safaar.vercel.app` bor, `localhost` yo'q) — bu
  lokal-cross-origin cheklovi, regressiya emas.

E2E test o'zgarishi (asosli): `critical-flow.spec.ts`da qo'ng'iroq lokatori
`getByLabel('Bildirishnomalar')` → `locator('button[aria-label="Bildirishnomalar"]:visible').first()`
qilindi, chunki responsив ikki-render tufayli `getByLabel` endi 2 element topib
Playwright strict-mode xatosi berardi. Bu `favorites-qa.spec.ts`dagi `heartButton`
helper'i (`button[aria-label="Sevimli"]:visible`) bilan bir xil andoza.

---

## F2 — Production konsolida `The script has an unsupported MIME type ('text/html')`

### Asl bug
Production'da **har bir sahifa** brauzer konsolida quyidagi xatoni chiqarardi:
```
The script has an unsupported MIME type ('text/html').
```
Lokal dev'da yo'q edi — faqat production'da.

### Root cause (aniq)
`components/pwa/ServiceWorkerRegister.tsx`:
```js
if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}
```
- `NODE_ENV === "production"` sharti → **faqat production'da** ishga tushadi (shu
  sabab lokal dev'da xato yo'q).
- Ammo `apps/web-user/public/sw.js` **umuman mavjud emas edi** — na fayl, na uni
  generatsiya qiladigan vosita (`next-pwa`/`serwist`/`workbox` — yo'q; `package.json`
  toza).
- Vercel'da `/sw.js` uchun statik fayl topilmagach, so'rov Next.js ilovasiga
  tushib, javob sifatida ilovaning HTML app-shell/404 sahifasi qaytarilardi:
  ```
  GET https://web-user-rho.vercel.app/sw.js
  → HTTP 200
  → Content-Type: text/html; charset=utf-8
  → body: <meta name="robots" ...><script src="/_next/static/chunks/...">...
  ```
- `next.config.ts`dagi `X-Content-Type-Options: nosniff` header MIME tekshiruvni
  qat'iy qiladi → brauzer `text/html`ni skript sifatida ishlatishdan bosh tortadi
  va registratsiyani rad etadi, konsolga yuqoridagi xatoni yozadi.
- `.catch(() => {})` faqat **promise rejection**ni yutadi; brauzerning o'z konsol
  xatosini yashira olmaydi (u register() rad etilishidan oldin chiqadi).

### Nega yuz bergan
Ilovada PWA niyati bor edi — `manifest.webmanifest`, `appleWebApp`, `themeColor`,
`PwaInstallBanner` (mount qilingan), `PushSubscriptionManager` (mount qilinmagan),
`/[lang]/offline` route, va `ServiceWorkerRegister`. Lekin **service worker faylining
o'zi hech qachon yozilmagan** — registratsiya kodi "kelajakdagi" faylga tayanardi.

### Nima o'zgardi
`apps/web-user/public/sw.js` **qo'shildi** — ataylab MINIMAL service worker:
- `install` → `skipWaiting()`, `activate` → `clients.claim()` (yangilanish tez
  tarqaladi).
- Bo'sh `fetch` listener — `respondWith` chaqirmaydi, demak **tarmoq xatti-harakati
  o'zgarmaydi** (brauzer odatdagidek yuklaydi). Bu PWA "installable" evristikasi
  uchun kifoya.
- **Hech narsani kesh qilmaydi** → eskirgan-kontent xavfi yo'q (bu sayt ilgari
  hech qachon SW ishlatmagan, shuning uchun konservativ yondashuv).

`ServiceWorkerRegister.tsx` **o'zgartirilmadi** — fayl mavjud bo'lgach, u to'g'ri
ishlaydi. Console xatosi manbasida yo'qoladi (suppress qilinmaydi).

Qo'shimcha ta'sir: `PwaInstallBanner` endi ishlashi mumkin — Chrome
`beforeinstallprompt`ni faqat SW ro'yxatdan o'tgan bo'lsa yuboradi (ilgari SW yo'q
edi → banner hech qachon chiqmasdi).

### Production MIME/skript xatosini qanday diagnostika qilish (kelajak uchun)
1. Brauzer DevTools → Console'da xato matnini o'qing. `text/html` bo'lsa — bir
   skript **HTML** qaytaryapti (odatda 404 → app-shell).
2. **Aniq URL'ni toping.** Chrome console matnida URL bo'lmaydi. Vositalar:
   - DevTools → Network → "JS" filtri → `text/html` `Content-Type`li yoki 4xx
     status'li skript so'rovini qidiring.
   - `resourceType === 'script'` odatiy `<script>`larni qamrab oladi, lekin
     **service worker** / `<link rel=modulepreload>` / preload'lar `'other'` bo'ladi
     — Playwright/Puppeteer probe'da `page.on('response')`ни FILTRSIZ yozib,
     `content-type` va `status`ни tekshiring.
   - To'g'ridan-to'g'ri: `curl -sI https://<host>/<shubhali-yo'l>` → `Content-Type`.
3. Manbani aniqlang: application kodi (`navigator.serviceWorker.register`,
   `<Script src>`, dinamik `import()`), analytics (`/_vercel/insights/script.js` —
   Web Analytics yoqilmagan bo'lsa 404), framework config, deployment rewrite, yoki
   **yo'q asset** (bu holatda — `public/sw.js`).
4. Tuzatish: yetishmayotgan asset'ni qo'shing YOKI xato skript-yo'lini to'g'rilang
   YOKI (agar funksiya kerak bo'lmasa) registratsiya/`<Script>`ni olib tashlang.
   **Console'ni suppress qilib yashirmang.**
5. Production deploy'da tekshiring: `curl -sI https://<host>/sw.js` →
   `content-type: application/javascript`; brauzer konsolida xato yo'q;
   `navigator.serviceWorker.getRegistration()` → registratsiya bor.

### Kelajakda offline/kesh kerak bo'lsa
`public/sw.js`ни to'ldiring yoki `next-pwa`/`serwist` qo'shing. `/[lang]/offline`
route allaqachon bor — offline fallback uchun ishlatish mumkin.
`PushSubscriptionManager.tsx` (hozir mount qilinmagan) web-push uchun shu SW'ga
`push`/`notificationclick` handlerlari qo'shilishini talab qiladi.

---

## Tekshirilgan (verification)

| Nima | Natija |
|---|---|
| `npm run build:types && build -w @safaar/api-client && build -w @safaar/web-user` | ✅ PASS |
| `tsc --noEmit` (`apps/web-user`) | ✅ PASS |
| `eslint` (o'zgargan fayllar) | ✅ PASS |
| F2: lokal prod `curl /sw.js` | ✅ `200`, `content-type: application/javascript` |
| F2: brauzer — SW ro'yxatdan o'tdi, `active: true`, **0 ta MIME console error** | ✅ |
| F1: kirmagan holat — qo'ng'iroq DOM'da yo'q | ✅ `0` |
| F1: kirgan holat — qo'ng'iroq desktop navbar + mobil top-bar'da ko'rinadi | ✅ |
| F1: qo'ng'iroq bosilганда dropdown ochiladi ("Bildirishnomalar" sarlavha) | ✅ |
| F1: backend CORS `web-user-rho.vercel.app` origin uchun `/notifications`ga ruxsat beradi | ✅ (`204`, `Access-Control-Allow-Origin` mos) |

**E2E:** `favorites-qa.spec.ts` + `critical-flow.spec.ts` — default target **production**.
Deploy'dan keyin `web-user-rho.vercel.app`ga qarshi qayta ishga tushirilishi kerak
(lokal `localhost`ga qarshi — qo'ng'iroqning `/notifications` so'rovi CORS shovqini
beradi, chunki backend allowlist'ida `localhost` yo'q).

## O'zgargan fayllar
- `apps/web-user/app/[lang]/(main)/layout.tsx` — `token` prop
- `apps/web-user/components/layout/SiteHeader.tsx` — `token` prop + `NotificationsBell`
- `apps/web-user/components/layout/ScrollNav.tsx` — `notifications` slot (desktop + mobil)
- `apps/web-user/public/sw.js` — **yangi** minimal service worker
- `e2e/tests/user/critical-flow.spec.ts` — qo'ng'iroq lokatori `:visible` bilan (test-side, asosli)

## Deploy
Bu yozuv yozilганда — **hali deploy qilinmagan** (foydalanuvchi tasdig'i kutilmoqda).
web-user deploy workflow'i: `cd apps/web-user && npx vercel --prod` (Vercel loyihasi
`web-user`, prod URL `https://web-user-rho.vercel.app`; git auto-deploy yo'q, manual CLI).

## Git
- Branch: `temp/save-all-work` (foydalanuvchi ko'rsatmasi bilan alohida branch
  yaratilmadi; commit qilinmadi).

# 2026-08-27 — Login sahifasidagi social xato xabarlari provider-specific qilindi (Facebook/Google)

## Nima o'zgardi
Login sahifasida Google yoki Facebook orqali kirish muvaffaqiyatsiz
bo'lganda, xato xabari endi **aynan qaysi provider bilan urinilgan bo'lsa**
o'shani ko'rsatadi:
- Facebook muvaffaqiyatsiz → "Facebook orqali kirishda xatolik yuz berdi. Qayta urinib ko'ring."
- Google muvaffaqiyatsiz → "Google orqali kirishda xatolik yuz berdi. Qayta urinib ko'ring."

Avval ikkalasi uchun ham bitta umumiy "Ijtimoiy tarmoq orqali kirishda
xatolik yuz berdi" matni ko'rsatilardi (avvalroq esa hattoki Facebook
xatosida ham noto'g'ri "Google orqali..." matni chiqib qolardi).

## Nima uchun
Foydalanuvchi aynan qaysi provider bilan muammo yuz berganini aniq
bilishi kerak — ayniqsa endi ikkalasi ham (Google va Facebook) faol
ishlayotgan bo'lsa.

## Qanday ishlaydi (arxitektura)
Backend OAuth callback xato bo'lganda `/login?socialError=<kod>` ga
qaytaradi, lekin qaysi provider bilan boshlangani bu query
parametrida yo'q (bu OAuth xavfsizlik logikasiga aloqasi yo'q — sof
frontend masalasi, shu sabab **backend o'zgartirilmadi**). Buning
o'rniga: foydalanuvchi Google/Facebook tugmasini bosgan zahoti (sahifadan
chiqishdan oldin) shu tab'ga xos `sessionStorage`ga yozib qo'yiladi;
`/login`ga qaytilganda shu qiymat o'qilib, mos xabar ko'rsatiladi. Agar
biror sababdan (masalan to'g'ridan-to'g'ri havola/bookmark orqali kirilgan
bo'lsa) provider noma'lum bo'lsa, avvalgi umumiy matn zaxira sifatida
qoladi.

## O'zgargan fayllar
- `apps/web-user/app/[lang]/(auth)/_components/LoginForm.tsx` — yangi
  `rememberOAuthProvider()` (tugma bosilganda sessionStorage'ga yozadi),
  yangi `useEffect` (xato bo'lsa sessionStorage'dan o'qiydi),
  `socialErrorMessageFor()` endi `provider` argumentini ham qabul qiladi
  va shunga qarab `dict.googleLoginError`/`dict.facebookLoginError`/
  (noma'lum bo'lsa) `dict.socialLoginError`ni tanlaydi.
- `apps/web-user/locales/{uz,ru,en}/auth.json` — yangi ikkita kalit:
  `googleLoginError`, `facebookLoginError` (uchala tilda ham).

## UI/UX
Google/Facebook tugmasi bosilib, OAuth muvaffaqiyatsiz bo'lsa, login
sahifasiga qaytganda endi aniq qaysi provider bilan muammo bo'lganini
ko'rsatadigan xabar chiqadi. Muvaffaqiyatli login/registratsiya oqimiga
hech qanday ta'sir yo'q.

## API / Backend
- Backend o'zgardimi: NO — bu ataylab shunday, chunki masala sof
  frontend-error-message masalasi edi.
- DB: NO.

## Test
- Typecheck: PASS (`apps/web-user`).
- Build: PASS (`apps/web-user`).
- Relevant testlar: bu component uchun unit test mavjud emas (loyihada
  React component'lar uchun unit test infratuzilmasi yo'q, testing
  backend Jest + Playwright e2e orqali qilinadi) — shu sabab lokal
  brauzer orqali qo'lda tekshirildi:
  - Facebook tugmasi bosilib, xato holatida → aynan "Facebook orqali
    kirishda xatolik yuz berdi..." matni chiqishi tasdiqlandi.
  - Google tugmasi bosilib, xato holatida → aynan "Google orqali
    kirishda xatolik yuz berdi..." matni chiqishi tasdiqlandi.
  - Provider noma'lum (yangi brauzer context, sessionStorage yo'q) →
    avvalgi umumiy matn zaxira sifatida to'g'ri ishlashi tasdiqlandi.
  - Google/Facebook tugmalarining `href`lari (OAuth so'rovi, `origin`
    parametri bilan) o'zgarishsiz qolgani tasdiqlandi — regression yo'q.

## Deploy
Local only — hali production'ga chiqarilmadi (foydalanuvchi tasdig'ini
kutmoqda).

## Git
- Branch: `temp/save-all-work`
- Commit: `29f3b10f`

## Muhim eslatmalar
- `sessionStorage` faqat SHU brauzer tab'iga xos — agar user ikki tab'da
  bir vaqtda Google va Facebook bilan urinsa, har biri o'z tab'ida to'g'ri
  ishlaydi (aralashmaydi).
- Bu o'zgarish faqat `LoginForm.tsx`ga tegishli — `RegisterForm.tsx`dagi
  ijtimoiy-registratsiya xato matnlari (avvalgi audit'da allaqachon
  provider-neytral qilib tuzatilgan) ga tegilmadi, chunki bu safar so'rov
  aniq "Login sahifasi" bilan chegaralangan edi.

---

# 2026-08-27 — OAuth login ikkita production frontend'ni qo'llab-quvvatlaydi (allow-list, open-redirect himoyasi bilan)

## Nima o'zgardi
`https://web-user-rho.vercel.app` va `https://safaar-uz.vercel.app` — ikkalasi
ham endi Google/Facebook OAuth login-registration flow'ini to'liq qo'llab-
quvvatlaydi. Avval backend OAuth callback'dan keyin foydalanuvchini doim
BITTA qattiq yozilgan (`WEB_USER_URL`) manzilga qaytarardi — ikkinchi domen
orqali kirilsa ham, OAuth tugagach foydalanuvchi noto'g'ri (birinchi)
domenga tashlab qo'yilardi.

`LoginForm.tsx`dagi Google/Facebook tugmalari endi hozirgi sahifa qaysi
domenda ochilgan bo'lsa (`window.location.origin`), o'sha qiymatni OAuth
so'roviga qo'shib yuboradi — backend esa buni faqat oldindan tasdiqlangan
(`OAUTH_ALLOWED_ORIGINS`) ro'yxat bilan solishtirib, mos kelsagina
ishlatadi. Ro'yxatda yo'q/soxta qiymat hech qachon ishonilmaydi — bunday
holda backend eng birinchi (asosiy) manzilga qaytaradi. Bu **open redirect**
zaifligining oldini oladi.

## Nima uchun
Ikkala production domen ham haqiqiy foydalanuvchilar tomonidan ishlatiladi
va ikkalasida ham OAuth login/ro'yxatdan o'tish bir xil tarzda, to'g'ri
domenga qaytarish bilan ishlashi kerak edi.

## O'zgargan fayllar
- `apps/web-user/app/[lang]/(auth)/_components/LoginForm.tsx` — Google/
  Facebook tugmalarining OAuth so'roviga `origin=<joriy sahifa domeni>`
  qo'shildi. `useEffect` + `useState` orqali (render paytida `typeof
  window` emas) — aks holda server/client render mos kelmay, React
  hydration mismatch berardi va href browser'da hech qachon
  to'g'irlanmasdi ("this won't be patched up" — bu real xato sifatida
  topildi va shu yerda tuzatildi, tekshiruv paytida).

## Kod o'zgarmagan (frontend, boshqa joylar)
`RegisterForm.tsx`, `social-callback/route.ts` — bularga tegilmadi, ular
allaqachon backend qaytargan `locale`/`next` bilan ishlaydi, domenga
bog'liq emas.

## UI/UX
Ko'zga ko'rinadigan o'zgarish yo'q — foydalanuvchi Google/Facebook
tugmasini bosganda, avvalgidek Google/Facebook login sahifasiga
yo'naltiriladi, farqi shundaki endi OAuth tugagach **aynan o'sha domenga**
qaytariladi (ilgari har doim bitta domenga qaytarilardi).

## API / Backend
- Backend o'zgardimi: HA — `apps/backend/src/auth/auth.controller.ts`,
  `apps/backend/src/auth/auth.service.ts`, `apps/backend/src/config/
  env.validation.ts`. Yangi env: `OAUTH_ALLOWED_ORIGINS` (ixtiyoriy,
  vergul bilan ajratilgan ro'yxat; berilmasa avvalgidek yagona
  `WEB_USER_URL`ga qaytadi — orqaga moslik saqlangan).
- Yangi API endpoint kerak bo'ldimi: NO — mavjud `/auth/google`,
  `/auth/facebook`, `/auth/*/callback` endpointlariga faqat ixtiyoriy
  `origin` query parametri qo'shildi.
- DB migration: NO.

## Test
- Backend: 410/410 (4 ta yangi maxsus test — allow-list'dagi origin
  qabul qilinishi, ro'yxatda yo'q/soxta origin rad etilib asosiy
  manzilga qaytarilishi (open-redirect himoyasi), ikkinchi frontend
  bilan to'liq redirect→callback aylanishi, `OAUTH_ALLOWED_ORIGINS`
  sozlanmaganda orqaga moslik).
- Typecheck: PASS (`apps/backend`, `apps/web-user`).
- Build: PASS (ikkalasi).
- Browser QA (lokal): login sahifasida Google/Facebook href'lari `origin`
  parametri bilan to'g'ri shakllanishi, **hydration xatosi yo'qligi**
  (avval buglik edi, tuzatildi) tekshirildi.

## Deploy
Local only — hali production'ga chiqarilmadi (foydalanuvchi tasdig'ini
kutmoqda; bu safar backend uchun haqiqiy kod deploy — dist qayta
qurish/almashtirish — kerak bo'ladi, faqat env emas).

## Git
- Branch: `temp/save-all-work`
- Commit: `99071669`

## Muhim eslatmalar
- Production `.env`ga `OAUTH_ALLOWED_ORIGINS=https://web-user-rho.vercel.app,https://safaar-uz.vercel.app`
  qo'shilishi kerak — bu deploy tasdiqlangach bajariladi.
- `safaar-uz.vercel.app` audit paytida topildi: bu `web-user`dan **boshqa**
  Vercel loyihasi ("safaar" nomli, Root Directory `.`, umumiy build
  buyrug'i) — hozircha bir xil kontent ko'rsatayotgandek ko'rinadi, lekin
  `apps/web-user` bilan avtomatik sinxron emas. Backend allow-list bu
  farqdan qat'i nazar xavfsiz ishlaydi (faqat ruxsat berilgan manzilga
  qaytaradi), lekin agar `safaar-uz.vercel.app` alohida qo'lda deploy
  qilinmasa, u yerda bu `origin` o'zgarishi (va umuman oxirgi frontend
  kodi) ko'rinmasligi mumkin.

---

# 2026-08-27 — Facebook OAuth — Google bilan bir xil login-or-registration audit va matn tuzatishi

## Nima o'zgardi
Facebook orqali kirish/ro'yxatdan o'tish Google OAuth bilan bir xil
"login-or-registration" flow'ga mos ekanligi to'liq audit qilindi.
**Auditda aniqlandiki, backend va frontend logikasi allaqachon to'liq
provider-agnostic edi** (Google ishi paytida shared/umumiy funksiyalar
sifatida yozilgan) — Facebook uchun yangi endpoint, yangi component yoki
duplicate logika yozishga hojat bo'lmadi.

Audit paytida topilgan yagona real kamchilik: ro'yxatdan o'tish
sahifasidagi bir nechta xabar matni (subtitle, xato xabarlari) doim
"Google orqali..." deb qattiq yozilgan edi — Facebook orqali kelgan
foydalanuvchi ham xuddi shu (noto'g'ri) "Google" so'zini ko'rar edi. Bu
matnlar endi provayderga bog'liq bo'lmagan (generic) qilib to'g'irlandi.

## Nima uchun
Facebook login Google bilan bir xil professional va xavfsiz darajada
ishlashi kerak edi. Audit shuni ko'rsatdiki, bu allaqachon shunday —
faqat foydalanuvchiga ko'rinadigan matnlarda provayder nomi noto'g'ri
qattiq yozilgan joylar bor edi.

## O'zgargan fayllar
- `apps/web-user/locales/{uz,ru,en}/auth.json` — 4 ta kalit
  (`socialRegisterSubtitle`, `socialAccountNotRegistered`,
  `socialLoginError`, `socialRegistrationExpired`) "Google" so'zisiz,
  har qanday ijtimoiy provayder uchun to'g'ri bo'ladigan matnga
  o'zgartirildi. Masalan (uz): "Google orqali kirish uchun telefon
  raqamingizni tasdiqlang." → "Kirishni yakunlash uchun telefon
  raqamingizni tasdiqlang."
- `apps/backend/src/auth/auth.service.spec.ts` — Facebook uchun 12 ta
  yangi test qo'shildi (mavjud Google testlari bilan bir xil uslubda):
  state-bound redirect, mavjud faol Facebook user → instant login, yangi
  Facebook identity → registration (xato emas), to'liq registration
  (telefon+OTP → user yaratish → link → session, password_hash
  tegilmaydi), ikkinchi login instant, nofaol linked user →
  USER_NOT_ACTIVE, provider_user_id duplicate → OAUTH_ACCOUNT_ALREADY_LINKED,
  eskirgan/yaroqsiz registration token → 401, xato OTP token'ni
  "yemaydi", Facebook javobida email yo'q → OAUTH_EMAIL_REQUIRED (xavfsiz
  rad etish), Facebook email har doim tasdiqlangan deb hisoblanishi
  (Google'ning verified-email siyosatiga mos).

## Kod o'zgarmagan (auditda tasdiqlangan, kodga tegilmadi)
- `apps/backend/src/auth/auth.controller.ts` — `startOAuth`/`finishOAuth`
  allaqachon `provider: 'google'|'facebook'` orqali umumiy.
- `apps/backend/src/auth/auth.service.ts` — `oauthCallback`,
  `oauthExchange`, `completeOAuthRegistration`, `upsertOAuthUser`,
  `fetchOAuthProfile` — barchasi provider-parametrlangan, Facebook uchun
  alohida yozilishi shart emas edi.
- `apps/web-user/app/[lang]/(auth)/_components/LoginForm.tsx` — Facebook
  tugmasi (`/auth/facebook?...`) allaqachon mavjud va Google bilan bir xil
  pattern.
- `apps/web-user/app/[lang]/(auth)/_components/RegisterForm.tsx` —
  `socialProvider`/`oauthProvider` allaqachon umumiy string sifatida
  o'qiladi, "google"ga qattiq bog'lanmagan.
- `apps/web-user/app/[lang]/(auth)/auth/social-callback/route.ts` —
  `result.provider`ni backend qanday qaytarsa, o'shani ishlatadi.
- `apps/backend/src/config/env.validation.ts` — `FACEBOOK_APP_ID`,
  `FACEBOOK_APP_SECRET`, `FACEBOOK_CALLBACK_URL` allaqachon deklaratsiya
  qilingan va validatsiyadan o'tadi.
- `prisma/schema.prisma` / `user_social_accounts` jadvali — `provider`
  ustuni erkin VARCHAR(32), `UNIQUE(provider, provider_user_id)` va
  `UNIQUE(user_id, provider)` constraintlari allaqachon Facebook uchun
  ham to'g'ri ishlaydi — **migration kerak bo'lmadi**.

## UI/UX
Ro'yxatdan o'tish sahifasidagi subtitle va xato xabarlari endi "Google"
so'zini o'z ichiga olmaydi — Facebook (yoki kelajakda boshqa provayder)
orqali kelgan foydalanuvchiga ham to'g'ri ko'rinadi. Boshqa hech narsa
vizual jihatdan o'zgarmadi.

## API / Backend
- Backend o'zgardimi: FAQAT test fayli (`auth.service.spec.ts`) — ishlab
  chiqarish kodi (production logic) o'zgarmadi.
- Yangi API kerak bo'ldimi: NO
- Mavjud API ishlatilgan: `/auth/facebook`, `/auth/facebook/callback`,
  `/auth/oauth/exchange`, `/auth/oauth/register` — barchasi
  allaqachon mavjud, faqat test bilan tasdiqlandi.

## Test
- Backend tests: 406/406 (11 ta yangi Facebook testi qo'shildi, 395 ta
  eski test o'zgarishsiz o'tdi).
- Typecheck: PASS (`apps/backend`, `apps/web-user`).
- Build: PASS (`apps/web-user`).
- Browser QA (lokal): login sahifasida Facebook tugmasi to'g'ri href
  bilan ko'rinadi (`/auth/facebook?locale=uz`, Google tugmasi bilan bir
  xil pattern), konsolda xato yo'q. Ro'yxatdan o'tish sahifasi
  `?social=facebook&registrationToken=...&email=...&firstName=...`
  bilan tekshirildi: email prefilled+readonly, ism/familiya
  prefilled+tahrirlanadigan, parol maydoni ko'rsatilmaydi, yashirin
  `oauthProvider=facebook` va `registrationToken` maydonlari to'g'ri.
  Haqiqiy Facebook OAuth uchun App ID/Secret hali berilmagani sabab
  to'liq end-to-end login/registration browser orqali sinalmadi (kutilgan
  holat).

## Deploy
Local only — hali production'ga chiqarilmadi (foydalanuvchi tasdig'ini
kutmoqda).

## Git
- Branch: `temp/save-all-work`
- Commit: `fa0b966`

## Muhim eslatmalar
- Facebook App ID/Secret hali berilmagan (`FACEBOOK_APP_ID`/
  `FACEBOOK_APP_SECRET` lokal `.env`da yo'q) — `GET /auth/providers`
  hozircha `facebook: false` qaytaradi, bu kutilgan holat. Haqiqiy
  kredensiallar berilgach, hech qanday kod o'zgarishisiz ishlab ketishi
  kerak (arxitektura allaqachon tayyor).
- Production `.env`ga hech narsa yozilmadi, hech qanday secret
  terminalga/logga chiqarilmadi.
- Haqiqiy Facebook access token yoki boshqa maxfiy token hech qachon
  frontend URL'iga chiqmaydi — faqat bir martalik `code` (exchange) va
  `registrationToken` ishlatiladi, bu Google bilan bir xil arxitektura
  (kodni audit qilish orqali tasdiqlandi, chunki bu funksiyalar Google va
  Facebook uchun bir xil).

---

# 2026-08-27 — Favorite o'zgarishi Vercel production'ga deploy qilindi

## Nima o'zgardi
Pastdagi "Katalog ❤️ Favorite tugmasini haqiqiy backendga ulash" entrysida
tasvirlangan o'zgarishlar (commit `1a17ce6b`) `web-user` Vercel production
muhitiga chiqarildi.

## Nima uchun
Favorite funksiyasi haqiqiy foydalanuvchilarga yetkazilishi kerak edi.

## O'zgargan fayllar
Kod o'zgarishi yo'q — faqat deploy. Fayllar ro'yxati uchun quyidagi
entryga qarang.

## UI/UX
Production'dagi barcha foydalanuvchilar uchun ❤️ endi haqiqiy saqlanadi
(pastdagi entryda tasvirlangani kabi).

## API / Backend
- Backend o'zgardimi: NO
- Yangi API kerak bo'ldimi: NO
- Backend deploy qilinmadi (o'zgarmagan)

## Test
- Pre-deploy: branch/HEAD/git status tekshirildi, kutilmagan o'zgarish
  topilmadi.
- Post-deploy production browser QA (haqiqiy ro'yxatdan o'tgan QA
  hisoblar bilan, bir necha marta):
  - Hotels: to'liq sikl PASS (bosish → active → refresh → saqlangan →
    qayta bosish → inactive → refresh → saqlangan), `x-vercel-cache: MISS`
    tasdiqlandi (keshlanmagan, har doim yangi holat).
  - Home (Featured/Deals): to'liq sikl PASS.
  - Guest: ❤️ bosilganda backendga so'rov yuborilmasdan login'ga
    yo'naltirilishi tasdiqlandi (network monitor orqali).
  - Restaurants/Transport/Attractions: sahifalar to'g'ri "Ma'lumot
    topilmadi" holatini ko'rsatadi — productionda hozircha bu 3 katalog
    uchun 0 ta real yozuv bor (oldindan mavjud data holati, bu deploy
    bilan bog'liq emas, production DB'ga tegilmadi). Kod yo'li Hotels/
    Home bilan bir xil (allaqachon tasdiqlangan).
  - Hotel rasmlari: R2'dan haqiqiy o'lchamlar bilan yuklanmoqda.
  - Locale-prefixed hreflar: `/uz/hotels/...` formatida to'g'ri.
  - Console: faqat oldindan mavjud (bu deploydan oldin ham bor bo'lgan,
    fixed seed ID `00000000-0000-7005-...` bilan tasdiqlangan) 3 ta
    buzilgan `/images/hotels/*.jpg` fixture-rasm xatosi bor — Favorite
    bilan bog'liq emas, yangi emas.

## Deploy
- Vercel production
- Project: `web-user`
- URL: https://web-user-rho.vercel.app
- Deployment ID: `dpl_EjF85CHsp1ZhMeGFYgzyPHEanter`

## Git
- Branch: `temp/save-all-work`
- Commit (deploy qilingan): `1a17ce6b`

## Muhim eslatmalar
- Restaurants/Transport/Attractions kataloglari productionda hozircha
  bo'sh — bu ma'lumot yetishmasligi, kod nosozligi emas. Kimdir shu
  kataloglar uchun demo/real ma'lumot qo'shsa, Favorite avtomatik
  ishlaydi (kod allaqachon tayyor).
- Yuqorida qayd etilgan 3 ta buzilgan deal-rasm xatosi alohida, kichik
  tuzatish sifatida qaraladigan — bu ishning qamroviga kirmaydi.

---

# 2026-08-27 — Katalog ❤️ Favorite tugmasini haqiqiy backendga ulash

## Nima o'zgardi
Hotels, Deals/Featured Hotels, Restaurants, Transport va Attractions
kataloglaridagi ❤️ (Favorite) tugmasi endi haqiqiy backendga saqlanadi.
Avval bu tugma faqat `UniversalCard` ichidagi lokal state edi — bosilganda
vizual o'zgarardi, lekin hech qayerga saqlanmasdi va sahifa yangilanganda
(refresh) yo'qolib ketardi.

## Nima uchun
Foydalanuvchi biror ob'ektni (mehmonxona, restoran, transport, ko'ngilochar
joy) sevimlilarga qo'shsa, bu holat login qilingan hisobida doimiy
saqlanishi va boshqa sahifaga o'tib qaytganda ham (yoki qayta kirganda ham)
yo'qolmasligi kerak edi.

## O'zgargan fayllar
- `apps/web-user/components/features/favorites/useFavoriteToggle.ts` (yangi) —
  umumiy hook: optimistik UI + xatoda orqaga qaytarish, bir vaqtda bir nechta
  so'rov yuborilishining oldini olish, guest foydalanuvchini login sahifasiga
  yo'naltirish (backendga so'rov yubormasdan).
- `apps/web-user/components/ui/UniversalCard.tsx` — Favorite holati endi
  to'liq parent orqali boshqariladi (`isFavorite` propi haqiqiy render
  manbai, ilgari faqat boshlang'ich qiymat edi); yangi `favoritePending`
  propi (disabled/aria-busy holat uchun) qo'shildi.
- `apps/web-user/lib/services/account/favorites-actions.ts` — yangi
  `getFavoritesMap(targetType)` funksiyasi (bitta so'rovda foydalanuvchining
  shu turdagi barcha favoritelarini oladi, `targetId -> favoriteId`
  map'iga aylantiradi); `FavoriteTargetType` `hotel`/`bus`dan
  `restaurant`/`transport`/`attraction`gacha kengaytirildi.
- `packages/api-client/src/services/users.ts` — `AddFavoriteInput.targetType`
  shu yangi qiymatlarni qabul qiladigan qilib kengaytirildi (faqat
  TypeScript turi — backend ustuni erkin VARCHAR(32), enum cheklovi yo'q).
- `apps/web-user/components/features/hotels/HotelCard.tsx`,
  `apps/web-user/components/features/home/{FeaturedHotelCard,
  FeaturedHotelsCarousel,DealsSection}.tsx`,
  `apps/web-user/components/features/restaurants/RestaurantsView.tsx`,
  `apps/web-user/components/features/transport/TransportView.tsx`,
  `apps/web-user/components/features/attractions/AttractionsView.tsx` —
  har biriga `useFavoriteToggle` ulandi, `UniversalCard`ga `isFavorite`/
  `favoritePending`/`onFavoriteToggle` propilari uzatildi.
- `apps/web-user/components/accommodation/AccommodationPage.tsx`,
  `apps/web-user/components/features/accommodation/AccommodationListWithMap.tsx`,
  `apps/web-user/app/[lang]/(main)/{page.tsx,restaurants/page.tsx,
  transport/page.tsx,attractions/page.tsx}` — har bir sahifa
  `getFavoritesMap()`ni BITTA marta chaqiradi va natijani kartalarga
  mapping qiladi (har bir karta uchun alohida so'rov yo'q).

## UI/UX
- ❤️ bosilganda darhol (optimistik) to'ladi/bo'shaydi — server javobini
  kutib turmaydi.
- Agar backend xato qaytarsa, tugma avtomatik eski holatga qaytadi.
- Sahifa yangilansa (refresh) yoki boshqa sahifaga o'tib qaytilsa, ❤️
  holati foydalanuvchining haqiqiy saqlangan favoritelariga mos keladi.
- Login qilinmagan foydalanuvchi ❤️ bosganda backendga so'rov yuborilmasdan
  to'g'ridan-to'g'ri login sahifasiga yo'naltiriladi.
- Tez-tez bosilsa ham (masalan tasodifiy ikki marta), faqat bitta so'rov
  yuboriladi — tugma so'rov davomida vaqtincha disabled bo'ladi.

## API / Backend
- Backend o'zgardimi: NO
- Yangi API kerak bo'ldimi: NO
- Mavjud API ishlatilgan: `GET /me/favorites`, `POST /me/favorites`,
  `DELETE /me/favorites/:id` (xuddi mehmonxona detal sahifasidagi
  `FavoriteButton` ishlatgan API'lar).

## Test
- Typecheck: PASS (`apps/web-user`, `apps/web-partner`, `apps/web-admin`)
- Build: PASS (`apps/web-user`, barcha 68 route)
- Unit/integration tests: 395/395 backend testlari (backend
  o'zgartirilmagani uchun ta'sirlanmadi)
- Browser QA: lokal backend + lokal Postgres'da haqiqiy ro'yxatdan o'tgan
  foydalanuvchi bilan tekshirildi — barcha 5 katalog + Deals: bosish →
  active → refresh → saqlangan → qayta bosish → inactive → refresh →
  saqlangan. Guest holati (backendga so'rov yuborilmasligi network orqali
  tasdiqlandi), real backend xatosi orqali rollback (ikki tab race
  condition bilan unique-constraint xatosi hosil qilindi), va tez-tez
  bosishda duplicate-so'rov himoyasi (5 klikdan faqat 1 ta so'rov) alohida
  tekshirildi.
- Muhim regressionlar: topilmadi. UniversalCard rendering, hotel rasmlari,
  locale-prefixed hreflar, narx/chegirma ko'rsatilishi, mavjud
  `FavoriteButton` (detal sahifa), Google OAuth va registratsiya oqimi
  o'zgarishsiz qoldi.

## Deploy
- Local only (bu entry yozilgan vaqtda hali productionga chiqarilmagan)

## Git
- Branch: `temp/save-all-work`
- Commit: `1a17ce6b`

## Muhim eslatmalar
- Lokal dev serverida `/uz/hotels` va `/uz` sahifalari ba'zan Next.js dev
  serverining eski (stale) keshlangan javobini qaytaradi
  (`x-nextjs-cache: HIT`) — bu Favorite ishi bilan bog'liq emas, avvalgi
  sessiyada login formasида topilgan xuddi shu Next.js dev-server keshlash
  xatti-harakati, boshqa sahifada qayta uchradi. Faqat lokal dev
  muhitiga xos, productionga taalluqli emas.
- Lokal dev DB'da ba'zi eski "offer" (deal) fixture yozuvlari
  `/images/hotels/*.jpg` kabi mavjud bo'lmagan static fayllarga
  ishora qiladi (pre-existing, bu ishdan oldin ham mavjud edi) — bu ham
  Favorite bilan bog'liq emas.
