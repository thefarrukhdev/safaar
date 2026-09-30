# Frontend Jamoasi Uchun To'lov Tizimi Bo'yicha Vazifalar (Action Items)

> **Hujjat maqsadi:** `apps/web-user` va `apps/web-partner` frontend dasturchilari uchun Safaar to'lov tizimini to'liq va xatosiz ulash bo'yicha amaliy qo'llanma.  
> **Sana:** 2026-09-30  
> **Backend holati:** ✅ Jonli (Production Ready) — Uzum Checkout API, Yandex Gateway Egress Proxy (`51.250.78.204`), Humo/Uzcard (1.5%), Visa/Mastercard (3.5%), Fiskalizatsiya («INTELLEX» MCHJ, TIN `312932219`, SPIC `10703999001000000`, QQS 12%), Click, Payme, Cash to'liq sinovdan o'tgan.

---

## 📌 Asosiy Qoidalar va Xavfsizlik

1. **Karta ma'lumotlarini to'g'ridan-to'g'ri qabul qilmang:**  
   Safaar frontend kodida mijozning karta raqami, CVV kodi yoki amal qilish muddati **hech qachon to'planmaydi va saqlanmaydi** (PCI-DSS talabi). Barcha karta ma'lumotlari faqat Uzum Checkout'ning xavfsiz iframesi yoki sahifasida kiritiladi.
2. **Komissiyani (Fee) frontendda mustaqil hisoblamang:**  
   Har bir karta turi uchun to'lov haqi (Humo/Uzcard 1.5%, Visa/Mastercard 3.5%) backend tomonidan aniq hisoblab beriladi. Frontend faqat backend qaytargan summalarni (`amount`, `base_amount`, `fee_amount`) ko'rsatadi.
3. **Yakuniy haqiqat manbai — faqat Backend:**  
   Redirect URL parametrlari (`?payment=success`) faqat tezkor UI ko'rsatish uchun. Haqiqiy bron tasdiqlanishi faqat `payment.status === 'paid'` (backend javobi) orqali belgilanadi.

---

## 📋 5 Ta Asosiy Vazifa (Action Items)

### 1. `UnifiedCheckoutClient.tsx` dagi Soxta Karta Maydonlarini Olib Tashlash
* **Fayl:** `apps/web-user/components/features/checkout/UnifiedCheckoutClient.tsx`
* **Muammo:** Hozirgi formadagi `cardNumber` va `cardExpire` inputlari backendga bormaydi va foydalanuvchida xavfli taassurot uyg'otadi.
* **Qilinishi kerak:**
  - Soxta `cardNumber` va `cardExpire` inputlarini formadan butunlay olib tashlash.
  - Foydalanuvchi "Karta orqali to'lash"ni tanlaganda, bron yaratilgach qaytgan `bookingId` orqali to'lov sessiyasini ochish (`createPaymentSessionAction`).
  - Natijada olingan `payment_url` orqali `UzumCheckoutFrame` modal oynasini ko'rsatish.

---

### 2. To'lov Usullari Tanlagichini (`PaymentSelector.tsx`) Moslashtirish
* **Fayl:** `apps/web-user/components/features/checkout/PaymentSelector.tsx`
* **Backend qabul qiladigan qiymatlar (`provider`):**
  - `"uzcard"` — Uzcard (1.5% fee)
  - `"humo"` — Humo (1.5% fee)
  - `"visa"` — Visa (3.5% fee)
  - `"mastercard"` — Mastercard (3.5% fee)
  - `"cash"` — Joyida naqd to'lash (agar xizmat ruxsat bersa)
* **Qilinishi kerak:**
  - Agar dizaynda har bir karta alohida ko'rsatilishi kerak bo'lsa, UI plitkalarini ajratish va tanlangan qiymatni backendga yuborish.
  - Foydalanuvchi kartani tanlaganda `previewPayment(bookingId, provider)` orqali summani olish va ko'rsatish:
    ```
    Bron summasi:           500,000 UZS
    Visa to'lov haqi (3.5%): +17,500 UZS
    Jami to'lanadi:         517,500 UZS
    ```

---

### 3. IFRAME Modal Oqimini (`UzumCheckoutFrame`) To'liq Integratsiya Qilish
* **Komponent:** `apps/web-user/app/[lang]/(main)/booking/[id]/_components/UzumCheckoutFrame.tsx`
* **Return sahifasi:** `apps/web-user/app/payment/return/page.tsx`
* **Ishlash tartibi:**
  1. `POST /v1/payments/:bookingId/create` chaqiriladi.
  2. Qaytgan `payment_url` iframe ichida ochiladi:
     ```tsx
     <UzumCheckoutFrame
       checkoutUrl={paymentUrl}
       bookingId={bookingId}
       guestToken={guestToken}
       onPaid={() => {
         // To'lov tasdiqlandi, sahifani yangilash yoki voucherni ko'rsatish
         router.refresh();
       }}
       onClose={() => setIframeUrl(null)}
     />
     ```
  3. Foydalanuvchi to'lovni yakunlagach, Uzum iframe ichida `https://safaar.uz/payment/return` sahifasiga redirect qiladi.
  4. Return sahifasi ota oynaga `window.parent.postMessage({ type: "SAFAAR_PAYMENT_RESULT", status: "success" }, "*")` yuboradi.
  5. `UzumCheckoutFrame` xabarni qabul qilib, backenddan `checkPaymentStatusAction()` orqali `status === "paid"` bo'lganini tekshiradi va modalni yopib, muvaffaqiyat holatini ko'rsatadi.

---

### 4. Mehmon (Guest) Foydalanuvchilar Uchun `guestToken` Uzatish
* **Fayl:** `apps/web-user/lib/services/payments/actions.ts` va `lib/services/booking/actions.ts`
* **Qoida:** Ro'yxatdan o'tmagan mijoz bron qilganda, backend javobida `guestAccessToken` qaytadi.
* **Qilinishi kerak:**
  - Barcha to'lov so'rovlariga `guestToken` parametrini qo'shish:
    ```
    POST /v1/payments/:bookingId/create?guestToken=<guestAccessToken>
    GET  /v1/payments/:bookingId?guestToken=<guestAccessToken>
    ```
  - Agar token uzatilmasa, backend xavfsizlik yuzasidan `401 Unauthorized` qaytaradi.

---

### 5. Holat Yangilanishi va UX (Web-User va Web-Partner)
* **Web-User (Kutish va Yangilash holati):**
  - Uzum'dan qaytishda bank webhook'i 1-2 soniya kechikishi mumkin (holat `processing` bo'lib turadi).
  - Sahifada "To'lov tekshirilmoqda..." animatsiyasi va "Holatni yangilash" tugmasi bo'lishi kerak (yoki 2.5 soniya interval bilan 3-4 marta avtomatik tekshirish).
* **Web-Partner (Hamkor paneli):**
  - Hamkor panelida to'langan bronlar `paid`, joyida to'lanadigan bronlar esa `awaiting_cash` deb aniq ajratilishi kerak.
  - Bron holatini o'zgartirishda (masalan `board` yoki `complete`) mutatsiya xatoga uchrasa, `onError: (err) => toast.error(err.message)` ulanishi lozim (sahifa silent failure bo'lib qolmasligi uchun).

---

## 📡 API Endpointlar Xulosasi

| Amal | Metod va Yo'l | Auth / Parametrlar | Asosiy Javob Maydonlari |
|---|---|---|---|
| **To'lov yaratish / olish** | `POST /v1/payments/:bookingId/create` | Bearer Token yoki `?guestToken=`<br>Body: `{ "provider": "uzcard" }` | `{ id, payment_url, amount, base_amount, fee_rate, fee_amount, status }` |
| **To'lov holatini tekshirish** | `GET /v1/payments/:bookingId` | Bearer Token yoki `?guestToken=` | `{ id, status: "paid" \| "processing" \| "failed", amount }` |
| **Bron va to'lov ma'lumotlari** | `GET /v1/bookings/:id` | Bearer Token yoki `?guestToken=` | Bron tafsilotlari + `payment` obyekti |

---

Barcha backend endpointlar, testlar va fiskal modullar ishlab turibdi. Frontend jamoasi yuqoridagi 5 band bo'yicha integratsiyani amalga oshirishi mumkin.
