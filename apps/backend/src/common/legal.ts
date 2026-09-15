/**
 * Ommaviy Oferta / Terms of Service'ning hozirgi "acceptance marker"
 * versiyasi — foydalanuvchi/mehmon aynan QAYSI versiyaga rozi bo'lganini
 * qayd etish uchun (`users.terms_version` / `bookings.terms_version`).
 *
 * MUHIM CHEKLOV: bu FAQAT texnik marker. Terms matni hozircha CMS-backed
 * emas (statik fayl: apps/web-user/data/terms/*.html), shuning uchun
 * "haqiqiy" versiyalash/effective-date/re-consent qoidalari yo'q — bu
 * biznes/yuridik qaror (2026-09-15 final reportga qarang). Matn haqiqatda
 * o'zgarganda, shu qiymatni qo'lda yangilang; avtomatik CMS-versiyalash
 * kelajakda kerak bo'lsa, bu konstantani o'sha manbadan olinadigan
 * qiymat bilan almashtiring.
 */
export const CURRENT_TERMS_VERSION = '2026-09-15';
