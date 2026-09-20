/**
 * Restoran ish vaqti ichidagi vaqt-slot tekshiruvi — endi BITTA joyda.
 *
 * Manba ustunlar: `hotels.check_in_time` / `hotels.check_out_time`
 * (`VARCHAR(5)`, `HH:MM` — `schema.prisma`). Bron vaqti (`slot_time`) ham
 * xuddi shu ko'rinishdagi `HH:MM` satri (DB'da `TIME`, vaqt mintaqasisiz).
 * Ikkala tomon ham bir xil "devor soati" (local wall-clock) ifodasida
 * bo'lgani uchun leksikografik satr solishtiruvi to'g'ri ishlaydi va bu
 * yerda HECH QANDAY UTC/timezone o'girish QILINMAYDI — ataylab, chunki
 * o'girish qo'shilsa ikki tomon turli ifodalarda solishtirilgan bo'lardi.
 *
 * Ilgari bu mantiq `bookings.service.ts` (mijoz oqimi) va
 * `partners.service.ts` (hamkor walk-in) da ALOHIDA, bir xil ko'chirilgan
 * holda yozilgan edi va ikkalasi ham faqat BIR KUNLIK oraliqni bilardi:
 *
 *     slot < open  ||  slot >= close   ->  rad etish
 *
 * Yarim tundan keyin yopiladigan restoran uchun (masalan 07:01 -> 01:53,
 * ya'ni `close < open`) bu shart TAVTOLOGIYAGA aylanadi: `slot >= open`
 * va `slot < close` bir vaqtning o'zida hech qachon bajarilmaydi, shuning
 * uchun `A || B` HAR DOIM rost bo'lib, MUMKIN BO'LGAN HAR QANDAY `HH:MM`
 * rad etilardi — 11:00 ham, 23:00 ham. Real production'da bunday
 * restoranni ("Osh markazi", 07:01 -> 01:53) umuman bron qilib bo'lmasdi.
 *
 * CHEGARA KONVENSIYASI — mavjud koddan olingan, ATAYLAB o'zgartirilmagan:
 *   - ochilish vaqti INKLYUZIV (eski `slot < open` -> rad etish, ya'ni
 *     07:01 ning o'zi YAROQLI),
 *   - yopilish vaqti EKSKLYUZIV (eski `slot >= close` -> rad etish, ya'ni
 *     01:53 ning o'zi YAROQSIZ).
 * Yarim tundan o'tuvchi oraliqda ham xuddi shu konvensiya saqlanadi.
 */
export function isSlotWithinOperatingHours(
  slotTime: string,
  openTime: string | null | undefined,
  closeTime: string | null | undefined,
): boolean {
  // Ish vaqti sozlanmagan tomondan cheklov yo'q — eski xulq-atvor
  // (eski kodda `hotel.check_in_time && ...` truthiness tekshiruvi) bir
  // xilda saqlanadi.
  if (!openTime && !closeTime) {
    return true;
  }
  if (!openTime) {
    return slotTime < (closeTime as string);
  }
  if (!closeTime) {
    return slotTime >= openTime;
  }

  if (closeTime > openTime) {
    // Bir kunlik oddiy oraliq: 09:00 -> 23:00.
    return slotTime >= openTime && slotTime < closeTime;
  }

  if (closeTime < openTime) {
    // Yarim tundan o'tuvchi oraliq: 07:01 -> 01:53. Yaroqli =
    // [open .. 23:59] YOKI [00:00 .. close).
    return slotTime >= openTime || slotTime < closeTime;
  }

  // closeTime === openTime — BU YERDA YANGI SEMANTIKA O'YLAB
  // TOPILMAYDI. Mahsulot darajasida bu holat ("24 soat ochiq"mi yoki
  // "yopiq"mi) hech qayerda belgilanmagan: `updateListingRules` va
  // admin/`createListing` yo'llari `check_in_time`/`check_out_time`
  // tartibini ham, tengligini ham umuman tekshirmaydi. Eski kod bu
  // holatda (`slot < open || slot >= open`) HAR QANDAY vaqtni rad
  // etardi, shuning uchun ORTGA MOSLIK uchun AYNAN shu xulq-atvor
  // saqlanadi. Agar biznes "24/7" ma'nosini xohlasa — bu ALOHIDA,
  // ataylab qabul qilingan mahsulot qarori bo'lishi kerak.
  return false;
}
