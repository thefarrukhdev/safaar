# Promo-kod va Chegirmali Xonalar (Anti-Stacking) — Frontend Integratsiya Qo'llanmasi

Ushbu qo'llanma **web-user** frontend dasturchilari uchun promo-kodlarni xonalar va transportlar aksiyalari bilan birga qo'llash qoidalari bo'yicha tayyorlangan.

---

## 📌 1. Asosiy Biznes Qoida (Anti-Stacking Siyosati)

1. **Chegirma e'lon qilingan xonalar / transportlar (Aksiyadagi obyektlar):**
   - Hamkor tomonidan maxsus chegirma (aksiya) e'lon qilingan xonaga/mashinaga **har qanday promo-kod ishlatish taqiqlanadi**.
   - Chegirmalar ustma-ust (double discount / stacking) tushishi qat'iyan man etiladi.
2. **Chegirma e'lon qilinmagan xonalar / transportlar (Oddiy narxdagi obyektlar):**
   - Agar xonada/mashinada hech qanday chegirma bo'lmasa, foydalanuvchilar promo-kodlarni bemalol ishlata oladilar va promo chegirmasi to'liq chegiriladi.

---

## 🛠 2. Backend API Imkoniyatlari

Backendda quyidagi ikkita nuqtada to'liq nazorat va himoya o'rnatildi:

### A) Promo-kodni tekshirish (`POST /v1/promos/validate`)

So'rov tanasiga (Request Body) `room_id` (yoki `roomId`) yoki `vehicle_id` (yoki `vehicleId`) parametrini uzatish mumkin:

```json
POST /v1/promos/validate
Content-Type: application/json

{
  "code": "PROMO2025",
  "room_id": "4823084c-8c33-4cc9-828d-7d20e4d9df8f"
}
```

#### Javob variantlari:

1. **Agar xonada chegirma bo'lmasa (Muvaffaqiyatli):**
   ```json
   {
     "code": "PROMO2025",
     "valid": true,
     "discount_type": "percentage",
     "discount_value": 15
   }
   ```

2. **Agar xonada faol chegirma mavjud bo'lsa (Rad etiladi):**
   ```json
   {
     "code": "PROMO2025",
     "valid": false,
     "discount_type": null,
     "discount_value": 0,
     "reason": "PROMO_STACKING_NOT_ALLOWED",
     "message": "Ushbu xonaga allaqachon chegirma e'lon qilingan. Promo-kod faqat chegirmasiz xonalar uchun amal qiladi"
   }
   ```

---

### B) Bron yaratish (`POST /v1/bookings`)

Agar foydalanuvchi qandaydir yo'l bilan chegirmali xonani promo-kod bilan birga bron qilishga urinsa, backend server qat'iy `400 Bad Request` qaytaradi:

```json
{
  "statusCode": 400,
  "code": "PROMO_STACKING_NOT_ALLOWED",
  "message": "Ushbu xonaga allaqachon chegirma e'lon qilingan. Promo-kod faqat chegirmasiz xonalar uchun amal qiladi"
}
```

---

## 💻 3. Frontend Dasturchilar uchun Vazifalar (Action Items)

### 1-qadam: `packages/api-client` ni yangilash
Fayl: `packages/api-client/src/services/promos.ts`

`validate` metodiga `roomId` va `vehicleId` parametrlarini qo'shing:

```typescript
export const promosService = {
  // ...
  async validate(
    code: string,
    roomId?: string,
    vehicleId?: string
  ): Promise<{
    valid: boolean;
    discount_type: string | null;
    discount_value: number;
    reason?: string;
    message?: string;
  }> {
    const raw = await rawApi.post<{
      valid: boolean;
      discount_type: string | null;
      discount_value: number;
      reason?: string;
      message?: string;
    }>("/promos/validate", {
      code,
      roomId,
      vehicleId,
    });
    return raw;
  },
};
```

---

### 2-qadam: Server Action'ni yangilash
Fayl: `apps/web-user/lib/services/booking/actions.ts`

`validatePromoAction` ga `roomId` va `vehicleId` ni qabul qilishni qo'shing:

```typescript
export async function validatePromoAction(
  code: string,
  roomId?: string,
  vehicleId?: string
) {
  try {
    const res = await api.promos.validate(code, roomId, vehicleId);
    return { success: true, data: res };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof ApiRequestError
          ? error.message || error.code || "Xato yuz berdi"
          : "Tizim xatosi",
    };
  }
}
```

---

### 3-qadam: CheckoutForm komponentida tekshirish
Fayl: `apps/web-user/app/[lang]/(main)/booking/_components/CheckoutForm.tsx`

`handleApplyPromo` funksiyasida `room.id` ni uzating va `PROMO_STACKING_NOT_ALLOWED` xatosini ko'rsating:

```tsx
  const handleApplyPromo = async () => {
    if (!promoCode.trim()) return;
    setPromoLoading(true);
    setPromoError("");

    // room.id ni uzatamiz:
    const res = await validatePromoAction(promoCode.trim(), room.id);

    if (res.success && res.data) {
      if (res.data.valid) {
        setPromoDiscount({
          type: res.data.discount_type || "percent",
          value: Number(res.data.discount_value),
        });
      } else {
        setPromoDiscount(null);
        // Backenddan kelgan aniq xabar yoki tarjimani chiqaramiz:
        const errMessage =
          res.data.message ||
          (res.data.reason === "PROMO_STACKING_NOT_ALLOWED"
            ? "Ushbu xonaga allaqachon chegirma e'lon qilingan. Promo-kod faqat chegirmasiz xonalar uchun amal qiladi"
            : dict.errors?.PROMO_INVALID || "Promo kod noto'g'ri");
        setPromoError(errMessage);
      }
    } else {
      setPromoDiscount(null);
      setPromoError(res.error || dict.errors?.PROMO_INVALID || "Promo kod noto'g'ri");
    }
    setPromoLoading(false);
  };
```

---

### 4-qadam: UX / UI Ogohlantirish (Tavsiya)
Fayl: `apps/web-user/app/[lang]/(main)/booking/_components/CheckoutForm.tsx`

Agar tanlangan xonada allaqachon chegirma bo'lsa (`room.basePriceSum && room.basePriceSum > room.priceSum`), Promokod kiritish maydoni ostida foydalanuvchiga tushunarli eslatma chiqaring:

```tsx
{room.basePriceSum && room.basePriceSum > room.priceSum && (
  <p className="text-xs text-amber-600 mt-1">
    💡 Ushbu xonaga aksiya chegirmasi qo‘llanilgan. Promo-kod faqat chegirmasiz xonalar uchun amal qiladi.
  </p>
)}
```

---

## 🧪 4. Qanday Test Qilish Mumkin?

1. **Chegirmali xonani oching:**
   - Masalan: `Standard` xonasi (`400 000 so'm` -> `200 000 so'm`, -50% aksiyada).
   - Promokodga `PROMO2025` yoki `MUXLISA` yozib "Qo'llash"ni bosing.
   - Natija: Qizil rangda *"Ushbu xonaga allaqachon chegirma e'lon qilingan. Promo-kod faqat chegirmasiz xonalar uchun amal qiladi"* xabari chiqadi va chegirma berilmaydi.
2. **Chegirmasiz xonani oching:**
   - Masalan: `Junior Suite` xonasi (`100 000 so'm`, hech qanday aksiya yo'q).
   - Promokodga `PROMO2025` yoki `MUXLISA` yozib "Qo'llash"ni bosing.
   - Natija: Yashil rangda *"Chegirma qo'llanildi"* chiqadi va jami summadan chegirma chegiriladi.
