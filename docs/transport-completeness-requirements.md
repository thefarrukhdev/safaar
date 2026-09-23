# Transport (Avtobus/Rent-car) E'lonlarini Nashr Qilish Uchun Backend Talablari

## Muammo
Hozirda transport hamkorlari (masalan, `bus` yoki `rent_car` tipidagi tashkilotlar) o'z kompaniya e'lonini nashrga yuborishda `400 Bad Request` ("E'lon to'liq to'ldirilmagan") xatoligiga duch kelmoqda.

Frontend (`web-partner`) qismida transportlar uchun **kamida 3 ta rasm** va **kamida 3 ta umumiy qulaylik (amenity)** talab qilinmasligi mantiqan to'g'rilangan va 100% tayyor deb ko'rsatilmoqda. Sababi transport (mashina) rasmlari va qulayliklari uning o'ziga alohida biriktiriladi, butun kompaniya e'loniga emas.

Biroq, backend (xususan `apps/backend/src/partners/partners.service.ts` faylidagi `assertHotelCompleteness` yoki shunga o'xshash tekshiruvlarda) hamma tashkilot turlari uchun qat'iy ravishda:
- `media: Number(media[0]?.count ?? 0) >= 3`
- `amenities: Number(amenities[0]?.count ?? 0) >= 3`

tekshiruvlari bajarilmoqda. 

## Kerakli o'zgartirishlar
Backend dasturchi `apps/backend/src/partners/partners.service.ts` (yoki kompaniya tekshiruvi qayerda yozilgan bo'lsa) fayliga quyidagi o'zgartirishlarni kiritishi kerak:

1. Agar `partnerType === 'bus'` yoki `partnerType === 'rent_car'` bo'lsa, `media` (kamida 3 ta rasm) va `amenities` (kamida 3 ta qulaylik) shartlarini talab qilmaslik.
2. Shu bilan birga, transport turi uchun `rooms` (xona qo'shilganligi) tekshiruvi ham noto'g'ri bo'lishi mumkin. Hozir `isRestaurant` uchun tekshiruv borligini ko'rdik, huddi shunday `isBus` yoki `isTransport` uchun ham alohida e'tibor qaratish zarur (masalan, uning o'rniga transport vositalari qo'shilganligini tekshirish).

Ushbu o'zgarishlar production serverga (`api.safaar.uz`) deploy qilingandan so'ng, transport hamkorlari o'z e'lonlarini muammosiz nashrga yubora oladilar.
