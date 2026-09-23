# Backend uchun texnik topshiriq: Support Chat Guest Flow

**Status:** Frontend qismi (web-user) to'liq tayyor va Mock (soxta) API ulangan.
**Maqsad:** Foydalanuvchilar (mehmonlar) ro'yxatdan o'tmasdan turib (login qilmay) support tizimiga xabar yozishlari va o'z aloqa ma'lumotlarini qoldirishlari kerak.

## Nima qilish kerak?

Hozirgi vaqtda `SupportController` (backend) dagi barcha yo'nalishlar (`@Roles(Role.USER, Role.PARTNER)`) qat'iy avtorizatsiya talab qiladi.

Buning uchun quyidagi 2 ta usuldan birini amalga oshirish kerak:

### Variant A (Tavsiya etiladi): Alohida Guest endpoint ochish
Tizimda chigal bo'lmasligi uchun mehmonlar murojaati uchun maxsus ochiq endpoint yaratish.

**Endpoint:** `POST /support/tickets/guest` (Yoki `/support/anonymous`)
**Ruxsat:** `@Roles()` yoki AuthGuard qo'yilmaydi (ochiq/public).
**Body parametri (Request DTO):**
```ts
{
  message: string;      // Foydalanuvchi muammosi / xabari
  guestName: string;    // Ismi
  guestPhone: string;   // Telefon raqami
}
```
**Qanday ishlashi kerak:** 
Ushbu endpoint tizimda yangi Ticket yaratadi va ushbu ticketga `guestName` va `guestPhone` ma'lumotlarini biriktirib qo'yadi. Agar tizim buni qo'llab quvvatlamasa, xabar (`message`) matniga ism va raqamni qo'shib saqlash ham (masalan, `Xabar: ... \n\nIsm: ... \nTelefon: ...`) vaqtincha yechim bo'lishi mumkin.

### Variant B: Mavjud endpointni o'zgartirish
**Endpoint:** `POST /support/tickets`
1. `@Roles` ni olib tashlab (yoki guest uchun ochiq qilib) `CurrentActor` ni `optional` qilish kerak.
2. DTO ga ixtiyoriy `guestName` va `guestPhone` maydonlarini qo'shish kerak.

---

## Frontend ulash
Backend dagi ushbu endpoint tayyor bo'lgach, frontenddagi `apps/web-user/lib/services/support/actions.ts` faylidagi `sendGuestSupportTicketAction` funksiyasi ichiga ushbu yangi API ulanadi. (Hozir u yerda `setTimeout` bilan mock yozib qo'yilgan).

---

# 2. Direct Card Payment & SMS Verification - Backend Task

## Context
The user requested a **Direct Card Entry & SMS Verification** flow for checkout instead of redirecting the user to Click/Payme full-page checkouts. 

We have implemented the UI mock in the frontend (`CheckoutForm.tsx`). When the user selects Uzcard, Humo, Visa, or Mastercard, they enter their Card Number and Expiry Date directly on the checkout form. Upon submitting, a mock SMS verification modal appears. When they enter the code, it creates the booking and skips the "pending" redirect, marking it as a successful payment.

## Required API Changes (Backend)

The backend currently returns a `paymentUrl` for redirect flows (Click, Payme, Uzum). To support direct card payment, the backend needs to implement endpoints that probably integrate with **Payme Subscribe API** or similar tokenization gateways.

### 1. Send SMS Code (Initiate Card Payment)
`POST /v1/payments/card/send-otp`
- **Request Body**:
  ```json
  {
    "bookingId": "uuid",
    "cardNumber": "1234567812345678",
    "expiryDate": "12/25"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "sessionId": "payme-session-uuid-123",
    "phoneMask": "+998 ** *** ** 78"
  }
  ```
  *(The session ID is needed for the verification step).*

### 2. Verify SMS Code (Confirm Payment)
`POST /v1/payments/card/verify-otp`
- **Request Body**:
  ```json
  {
    "bookingId": "uuid",
    "sessionId": "payme-session-uuid-123",
    "smsCode": "123456"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "transactionId": "...",
    "status": "PAID"
  }
  ```

## Integration Plan
Once the backend endpoints are ready, the frontend developer will update `createBookingAction` (or a separate payment action) to call these APIs instead of the current `setTimeout` UI mock.

**Note on Database/Entities:**
You may need to add a table or fields to store partial payment sessions (`sessionId`) before the payment is fully authorized.

---

# 3. Multi-Currency (Exchange Rates) - Backend Task

## Context
Platformada mehmonxonalar narxlarini nafaqat UZS (so'm), balki xalqaro mijozlar uchun USD ($), EUR (€), va RUB (₽) da ham ko'rsatish talab etilmoqda. Hozirda Frontend narxlarni o'girish uchun `apps/web-user/lib/utils/money.ts` faylida qotirib yozilgan (hardcoded) kurslardan (`USD: 12650`) foydalanmoqda. 

Narxlar har doim dolzarb (real vaqtda) bo'lishi va platforma zarar ko'rmasligi uchun, kurslarni **Backend** taqdim etishi kerak.

## Nima qilish kerak?

1. **Exchange Rates Endpoint yaratish:**
   - **Endpoint:** `GET /v1/exchange-rates` (Ochiq, authorization talab etilmaydi)
   - **Qanday ishlaydi:** Keshga olingan (cached) joriy valyuta kurslarini qaytaradi.
   - **Response formati:**
     ```json
     {
       "base": "UZS",
       "rates": {
         "USD": 12650.00,
         "EUR": 13800.00,
         "RUB": 140.00
       },
       "updatedAt": "2026-09-22T10:00:00Z"
     }
     ```

2. **Kurslarni Avtomatik Yangilash (Cron Job):**
   - Backend har kuni (masalan, Markaziy Bank - CBU API yoki valyuta birjasi API'dan) joriy kurslarni olib, bazaga yoki Redis'ga saqlashi kerak.
   - Tranzaksiyalar (xaridlar) amalga oshirilganda (payment gateway'ga), to'lov hisob-kitoblarida qaysi kurs ishlatilayotganini inobatga olish uchun backend ham buni hisobga olishi kerak. Asosan to'lov shlyuzlari (Payme/Click) summa (UZS) ni talab qilgani uchun, frontend vizual tarzda ko'rsatish uchun ham ushbu ma'lumotdan foydalanadi.

## Frontend integratsiyasi
Backend tayyor bo'lgach, Frontend jamoasi `Zustand` yoki `React Query` orqali ilova yuklanganda ushbu API'ni bir marta chaqiradi. Foydalanuvchi UI (Header) orqali USD yoki RUB ni tanlasa, hamma mehmonxonalar narxi backenddan kelgan real kurs bilan dinamik o'zgaradi (Cookie orqali SSR bilan birga).

---
