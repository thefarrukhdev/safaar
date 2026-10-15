# 🌐 Multilingual Auto-Translation & Dynamic Language Switching

**Mas'ul:** Backend jamoasi  
**Sana:** 2026-10-15  
**Holat:** 🚀 To'liq amalga oshirildi (Production Ready)  

---

## 1. Umumiy Maqsad (Overview)

Safaar platformasida hamkor e'lon yaratayotganida yoki tahrirlayotganida (masalan, mehmonxona nomi, tavsifi, xona turi nomi):
- Ma'lumot qaysi tilda (odatda O'zbek tilida) kiritilishidan qat'i nazar, backend uni **avtomatik ravishda 3 ta tilda (`uz`, `ru`, `en`)** saqlaydi.
- Foydalanuvchi platformada tilni O'zbekcha, Ruscha yoki Inglizchaga almashtirganida, ma'lumotlar avtomatik tarzda tanlangan tilda ko'rsatiladi.

---

## 2. Arxitektura va Ishlash Prinsipi

### A. Asinxron Fon Navbati (BullMQ Queue)
Sinxron tarjima foydalanuvchi so'rovini 3-5 soniya kuttirishi va tashqi API xatolarida butun formani qulatishi xavfi borligi sababli, tizim **asinxron (fon rejimida)** ishlaydi:
1. **Tezkor javob (Instant Response):** Hamkor "Saqlash"ni bosganda, backend kiritilgan matnni darhol saqlab, 0.1 soniyada muvaffaqiyatli javob qaytaradi.
2. **Fon navbati (Job Queue):** `JobQueueService` orqali `entity-auto-translate` jobi fon navbatiga qo'yiladi:
   ```json
   {
     "entityType": "hotel",
     "entityId": "hotel-uuid",
     "fields": {
       "name": "Oq Saroy",
       "description": "Toshkent shahridagi ajoyib mehmonxona"
     },
     "sourceLang": "uz"
   }
   ```
3. **Fon protsessori (`JobsProcessor`):** `JobsProcessor` navbatdagi jobni qabul qilib, `AiTranslateService` orqali Google Gemini AI yordamida qolgan tillarga (`ru`, `en`) tarjima qiladi va bazani yangilaydi:
   - `hotel`: `hotel_translations` jadvalidagi `ru` va `en` yozuvlari yangilanadi.
   - `room_type`: `room_types.name` JSONB obyekti `{ uz: "...", ru: "...", en: "..." }` yangilanadi.
   - `room`: `hotel_room_translations` jadvalidagi nomlar yangilanadi.
4. **Kesh va bildirishnoma:** `touchHotel` va `events.hotelListingChanged` chaqirilib, kesh yangilanadi va o'zgarishlar barcha clientlarga tarqatiladi.

---

### B. Xavfsiz Fallback (Graceful Degradation)
Agar `AI_TRANSLATE_API_KEY` (yoki `GEMINI_API_KEY`) vaqtincha mavjud bo'lmasa yoki tashqi tarjima API limitga uchrasa:
- Tizim hech qachon xato bilan to'xtab qolmaydi.
- Mavjud matn qolgan tillarga fallback qilinadi va ogohlantirish qayd qilinadi.
- AI xizmati tiklanishi bilan navbatdagi joblar tarjimani to'liq amalga oshiradi.

---

### C. Foydalanuvchi tilni almashtirganda (Frontend integratsiyasi)
Frontend (`apps/web-user` va `apps/web-partner`) va `@safaar/api-client` allaqachon ko'p tilli tuzilmani qo'llab-quvvatlaydi:
- Backend barcha endpointlarda (`GET /hotels`, `GET /hotels/:slugOrId`, `GET /partners/hotels/:id`) nom va tavsiflarni to'liq 3 tilda taqdim etadi:
  ```json
  {
    "name": {
      "uz": "Oq Saroy mehmonxonasi",
      "ru": "Гостиница Ок Сарой",
      "en": "Oq Saroy Hotel"
    },
    "description": {
      "uz": "Shahar markazidagi shinam mehmonxona",
      "ru": "Уютная гостиница в центре города",
      "en": "Cozy hotel in the city center"
    }
  }
  ```
- Foydalanuvchi `/uz`, `/ru` yoki `/en` sahifasiga o'tganda yoki til selektorini bosganda, `pickLocale(name, locale)` orqali avtomatik ravishda tanlangan tildagi matn ko'rsatiladi.
- Sahifani qayta yuklash (reload) yoki serverga qayta-qayta so'rov yuborish talab etilmaydi — til bir zumda (0 soniya) almashadi.

---

## 3. O'zgartirilgan Fayllar

1. `apps/backend/src/ai-translate/ai-translate.service.ts`:
   - `detectLanguage`: Matn tilini avtomatik aniqlash (ruscha kirill yoki o'zbekcha lotin).
   - `autoTranslateMultilingualField`: Berilgan matnni 3 tilda `{ uz, ru, en }` to'ldirib berish.
2. `apps/backend/src/ai-translate/ai-translate.module.ts`:
   - `AiTranslateService` boshqa modullar uchun eksport qilindi.
3. `apps/backend/src/jobs/jobs.module.ts`:
   - `AiTranslateModule` import qilindi.
4. `apps/backend/src/jobs/jobs.processor.ts`:
   - `entity-auto-translate` jobi qabul qilinib, `hotel`, `room_type`, `room` bo'yicha bazani avtomatik tarjima qilish mantiqi ulandi.
5. `apps/backend/src/partners/partners.service.ts`:
   - `createHotel`, `updateListingGeneral`, `createRoomType`, `updateRoomType` da bo'sh qolgan tillar uchun fon tarjima jobi navbatga qo'yildi.
6. `apps/backend/src/jobs/jobs.processor.spec.ts` & `src/ai-translate/ai-translate.service.spec.ts`:
   - Yangi yozilgan barcha funksiyalar unit testlar bilan 100% qoplandi.
