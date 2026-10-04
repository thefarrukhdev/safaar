# Mehmon Naqd To'lov (Guest Cash Booking) & SMS OTP — Frontend Integratsiya Qo'llanmasi

Ushbu hujjat **frontend (`apps/web-user`)** dasturchisi uchun ro'yxatdan o'tmagan (mehmon / login qilmagan) foydalanuvchilar **"Joyida to'lash (Naqd pul)"** usulini tanlaganda SMS OTP tasdiqlash oqimini ulash bo'yicha to'liq qo'llanmadir.

---

## 1. Mantiq va UX Oqimi (User Experience Flow)

```
[Foydalanuvchi ma'lumotlarni to'ldiradi]
  ├── Ism, Familiya, Email
  ├── Telefon raqami (+998...)  <-- QAT'IY MAJBURIY
  └── To'lov usuli: "Joyida to'lash (Naqd pul)" (payment_method: 'cash')
             │
             ▼
[Foydalanuvchi "Bron qilish"ni bosadi]
  └── POST /v1/bookings
             │
             ├── Agar foydalanuvchi LOGIN QILGAN bo'lsa:
             │     └── Bron darhol "confirmed" bo'ladi (OTP talab etilmaydi).
             │
             └── Agar foydalanuvchi LOGIN QILMAGAN (mehmon) bo'lsa:
                   ├── Backend telefon raqamini tekshiradi (agar 60 kunga bloklangan bo'lsa, xato beradi).
                   ├── Backend bronni "pending" holatda yaratadi (xona band qilinadi).
                   ├── Foydalanuvchining telefoniga 6 xonali SMS kod jo'natiladi.
                   └── Backend javob qaytaradi: { requires_otp: true, booking_id: "...", phone: "+99890***5006", expires_in: 180 }
                                │
                                ▼
                   [Frontendda SMS OTP Modali ochiladi]
                     ├── 6 xonali kod kiritish inputi
                     ├── 180s (3 daqiqa) orqaga sanash taymeri
                     └── "Qayta yuborish" tugmasi (60s cooldown)
                                │
                                ▼
                   [Foydalanuvchi kodni kiritadi]
                     └── POST /v1/bookings/cash/verify-otp
                           │
                           ├── Kod to'g'ri:
                           │     └── Bron "confirmed" bo'ladi, muvaffaqiyatli sahifaga/vaucherga yo'naltiriladi.
                           └── Kod noto'g'ri:
                                 └── Xatolik ko'rsatiladi (3 ta urinishdan so'ng sessiya bekor qilinadi).
```

---

## 2. API Endpointlar va Ma'lumotlar Tuzilmasi

### A. Bron yaratish: `POST /v1/bookings`

Checkout sahifasida foydalanuvchi naqd to'lovni tanlab bron qilishni bosganda yuboriladi:

**Request Body:**
```json
{
  "hotel_id": "97e6822c-a0e2-45a7-96a6-57c2bc351658",
  "room_id": "45fa8b30-9942-4f3b-ba2d-520e774a385b",
  "check_in": "2026-10-10",
  "check_out": "2026-10-12",
  "adults": 2,
  "children": 0,
  "payment_method": "cash",
  "guest_name": "Laziz Shakarov",
  "guest_phone": "+998907435006",
  "guest_email": "laziz@example.com"
}
```

> **MUHIM**: Mehmon (login qilmagan) foydalanuvchi uchun `guest_phone` bo'lishi shart! Aks holda backend `400 PHONE_REQUIRED` xatosini qaytaradi.

**Response (Login qilmagan mehmon uchun — 201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "b3e0c034-71ea-42bb-923f-5d0b431c3bf1",
    "status": "pending",
    "payment_method": "cash",
    "requires_otp": true,
    "phone": "+99890***5006",
    "expires_in": 180,
    "created_at": "2026-10-04T15:30:00.000Z"
  }
}
```

Agar javobda `requires_otp: true` kelsa:
1. `booking_id` ni saqlab oling (`data.id`);
2. Ekranda SMS OTP kodini kiritish modalini oching;
3. `expires_in` (180 soniya) bo'yicha taymerni boshlang.

---

### B. SMS Kodni Tasdiqlash: `POST /v1/bookings/cash/verify-otp`

Foydalanuvchi telefoniga kelgan 6 xonali SMS kodni kiritganda yuboriladi:

**URL Variantlari (ikkalasi ham ishlaydi):**
- `POST /v1/bookings/cash/verify-otp` (body'da `booking_id` bilan)
- `POST /v1/bookings/:id/cash/verify-otp` (paramda `id` bilan)

**Request Body:**
```json
{
  "booking_id": "b3e0c034-71ea-42bb-923f-5d0b431c3bf1",
  "otp_code": "482910"
}
```

**Muvaffaqiyatli Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "b3e0c034-71ea-42bb-923f-5d0b431c3bf1",
    "status": "confirmed",
    "payment_method": "cash",
    "message": "Bron muvaffaqiyatli tasdiqlandi"
  }
}
```

Bu holatda modalni yopib, foydalanuvchini muvaffaqiyatli bron tasdiqlash sahifasiga yo'naltiring (`/booking/success?booking_id=...` yoki vaucher).

---

### C. SMS Kodni Qayta Yuborish (Resend): `POST /v1/bookings/cash/send-otp`

Agar foydalanuvchiga SMS yetib bormasa yoki vaqti tugasa, "Kodni qayta yuborish" tugmasi orqali yangi kod chaqiriladi:

**Request Body:**
```json
{
  "booking_id": "b3e0c034-71ea-42bb-923f-5d0b431c3bf1"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "booking_id": "b3e0c034-71ea-42bb-923f-5d0b431c3bf1",
    "phone": "+99890***5006",
    "expires_in": 180,
    "resend_available_in": 60
  }
}
```

---

## 3. Mumkin Bo'lgan Xatolar va UI Tavsiyalari

Backend qaytarishi mumkin bo'lgan standart xatolar (`error.response.data.message` yoki `data.error`):

| Xato Kodi / Matni | Sababi | Foydalanuvchiga tavsiya etiladigan UI matni |
|---|---|---|
| `PHONE_REQUIRED` | Naqd to'lovda telefon kiritilmagan | "Naqd pul bilan to'lash uchun telefon raqamingizni kiritishingiz shart." |
| `CUSTOMER_BLOCKED_FROM_CASH_BOOKING` | Avvalgi kelmaganlik (no-show) sababli 60 kunga bloklangan | "Kechirasiz, ushbu telefon raqami avvalgi kelmaganlik tufayli 60 kunga naqd to'lovdan cheklangan. Iltimos, online karta orqali to'lang." |
| `INVALID_OTP` | Kiritilgan kod noto'g'ri | "SMS kod noto'g'ri kiritildi. Qaytadan urinib ko'ring." |
| `OTP_EXPIRED` | 3 daqiqalik vaqt tugagan | "SMS kodning amal qilish muddati tugadi. Iltimos, yangi kod so'rang." |
| `TOO_MANY_ATTEMPTS` | 3 martadan ortiq xato kiritilgan | "Urinishlar soni oshib ketdi. Iltimos, yangi kod so'rang." |
| `RESEND_COOLDOWN` | 60 soniya o'tmasdan qayta so'ralgan | "Yangi kod so'rash uchun 60 soniya kuting." |
| `BOOKING_CANCELLED` | Bron bekor qilingan | "Ushbu bron bekor qilingan." |

---

## 4. Frontend uchun Namunaviy React / Next.js Komponenti

Frontendda foydalanish uchun tayyor `CashOtpModal.tsx` namunasi:

```tsx
'use client';

import React, { useState, useEffect } from 'react';

interface CashOtpModalProps {
  isOpen: boolean;
  bookingId: string;
  maskedPhone: string;
  initialExpiresIn?: number;
  onSuccess: (bookingId: string) => void;
  onClose: () => void;
}

export function CashOtpModal({
  isOpen,
  bookingId,
  maskedPhone,
  initialExpiresIn = 180,
  onSuccess,
  onClose,
}: CashOtpModalProps) {
  const [otp, setOtp] = useState('');
  const [timer, setTimer] = useState(initialExpiresIn);
  const [canResend, setCanResend] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setTimer(initialExpiresIn);
    setCanResend(false);

    const interval = setInterval(() => {
      setTimer((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setCanResend(true);
          return 0;
        }
        if (prev <= initialExpiresIn - 60) {
          setCanResend(true);
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, initialExpiresIn]);

  const handleVerify = async () => {
    if (otp.length !== 6) {
      setError("Iltimos, 6 xonali SMS kodni to'liq kiriting");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/v1/bookings/cash/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          booking_id: bookingId,
          otp_code: otp,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'SMS kod noto‘g‘ri');
      }

      onSuccess(bookingId);
    } catch (err: any) {
      setError(err.message || 'Tasdiqlashda xatolik yuz berdi');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!canResend) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/v1/bookings/cash/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_id: bookingId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Kodni qayta yuborib bo‘lmadi');
      }
      setTimer(180);
      setCanResend(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const minutes = Math.floor(timer / 60);
  const seconds = timer % 60;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <h3 className="text-xl font-bold text-gray-900">SMS orqali tasdiqlash</h3>
        <p className="mt-2 text-sm text-gray-600">
          Joyida to‘lash (naqd pul) uchun <strong>{maskedPhone}</strong> raqamiga yuborilgan 6 xonali tasdiqlash kodini kiriting.
        </p>

        <div className="mt-5">
          <input
            type="text"
            maxLength={6}
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
            placeholder="______"
            className="w-full tracking-widest text-center text-3xl font-mono py-3 border-2 border-gray-300 rounded-xl focus:border-blue-600 focus:outline-none"
            autoFocus
          />
        </div>

        {error && (
          <p className="mt-2 text-sm text-red-600 font-medium text-center">{error}</p>
        )}

        <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
          <span>Amal qilish vaqti: {minutes}:{seconds < 10 ? `0${seconds}` : seconds}</span>
          <button
            type="button"
            disabled={!canResend || loading}
            onClick={handleResend}
            className={`font-medium ${
              canResend ? 'text-blue-600 hover:underline cursor-pointer' : 'text-gray-400 cursor-not-allowed'
            }`}
          >
            Kodni qayta yuborish
          </button>
        </div>

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-1/2 py-2.5 border border-gray-300 rounded-xl font-medium text-gray-700 hover:bg-gray-50"
          >
            Bekor qilish
          </button>
          <button
            type="button"
            disabled={otp.length !== 6 || loading}
            onClick={handleVerify}
            className="w-1/2 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Tekshirilmoqda...' : 'Tasdiqlash'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

## 5. Xulosa

- Backend API endpointlari to'liq ishga tushirilgan va production serverida (`https://api.safaar.uz`) sinovdan o'tgan.
- Frontendchi yuqoridagi `requires_otp` flagini tekshirib, ushbu modalni chaqirsa va `POST /v1/bookings/cash/verify-otp` ga ulasa, naqd to'lovli mehmon bron qilish jarayoni to'liq jonlanadi.
