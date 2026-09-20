# @safaar/types — AI Agent Yo'riqnomasi

Bu paket — **frontend va backend o'rtasidagi yagona shartnoma (contract)**.
Bu yerdagi TypeScript turlari API javoblarining "shaklini" belgilaydi va
uchala frontend (user, partner, admin) hamda backend shularni ishlatadi.

---

## ⛔ EGALIK — eng muhim qoida

Bu paketni **faqat backend dasturchisi** o'zgartiradi.

- ✅ **Backend dev:** turlarni shu yerda yaratadi/yangilaydi.
- 📖 **Frontend dev'lar (user/partner/admin):** faqat **import qiladi**, o'zgartirmaydi.

Agar sen frontend app kontekstidan ishlayotgan bo'lsang — bu papkaga **hech narsa
yozma**. Faqat o'qi.

---

## ⚠️ O'zgartirish qoidalari (breaking change'dan saqlaning)

1. **Faqat tur (interface/enum/type).** Bu yerga biznes-mantiq, funksiya yoki
   runtime kod yozma — faqat turlar va kichik yordamchi enum'lar.
2. **Buzuvchi o'zgartirishdan ehtiyot bo'l.** Maydonni o'chirish yoki nomini
   o'zgartirish 3 frontend'ni bir vaqtda buzadi. Avval `optional` (`?`) sifatida
   qo'sh, keyin bosqichma-bosqich migratsiya qil.
3. **Yangi tur qo'shsang** — mos faylga qo'sh va `index.ts`'da re-export qil.
4. **Maxfiy maydon yo'q.** Parol hash, ichki token kabi narsalarni bu turlarga
   qo'shma — ular frontend'ga chiqib ketadi.
5. **O'zgartirgandan keyin build qil:**
   ```bash
   npm run build      # tsc → dist/ (frontend/backend shuni o'qiydi)
   ```
   Buni qilmasang, iste'molchilar eski turlarni ko'radi.

---

## Senior dev sifatida ish tartibi

1. Turlarni **toza va izohli** yoz (JSDoc bilan). Bu hujjat vazifasini bajaradi.
2. Nomlash izchil bo'lsin (`Dto` so'rovlar uchun, oddiy nom obyektlar uchun).
3. Har o'zgartirishdan keyin `npm run build` — `dist/` yangilansin.
4. Buzuvchi o'zgartirish bo'lsa — frontend dev'larni ogohlantir.
