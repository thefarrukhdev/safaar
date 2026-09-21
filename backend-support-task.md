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
