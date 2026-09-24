-- Transport (bus/rent_car) partnerlar "Joylashuv"/"Ijara qoidalari"
-- ekranlarida yuboradigan qiymatlar uchun `bus_companies`da ustun umuman
-- yo'q edi — `createBusCompany()`/`updateBusCompany()` faqat `name`ni
-- o'qir edi, qolgan hammasi jimgina yo'qolardi (audit: "SAFAAR — VERIFY
-- BUS/TRANSPORT LOCATION & RENTAL RULES PERSISTENCE").
--
-- `hotels`dagi bir xil naqsh/turlar qo'llanildi (qarang Hotel.address,
-- Hotel.latitude/longitude, Hotel.nearbyPlaces, Hotel.checkInTime/
-- checkOutTime, Hotel.cancellationPolicyCode, Hotel.extraFees):
--   - address                NULLABLE (Hotel'da NOT NULL, lekin mavjud
--                             bus_companies qatorlarining hech birida
--                             manzil yo'q — additive xavfsizlik uchun
--                             bu yerda NULLABLE)
--   - latitude/longitude     NUMERIC(10,7), NULLABLE (Hotel bilan bir xil)
--   - nearby_places          JSONB, DEFAULT '[]' (Hotel bilan bir xil)
--   - check_in_time/
--     check_out_time         VARCHAR(5), NULLABLE (Hotel bilan bir xil,
--                             "HH:MM" matn sifatida saqlanadi)
--   - cancellation_policy_code VARCHAR(32) NOT NULL DEFAULT 'MODERATE'
--                             (Hotel bilan bir xil default)
--   - extra_fees             JSONB, DEFAULT '[]' (Hotel bilan bir xil)
--
-- Ataylab YO'Q: `cancellation_policy_id` (Hotel'dagi `cancellation_policies`
-- FK'i) — faqat `_code` maydoni so'ralgan/kerak, qo'shimcha relatsiya
-- kiritilmadi.
--
-- XAVFSIZLIK / PRODUKTSIYA: butunlay QO'SHIMCHA (additive) — mavjud
-- qatorlarga tegilmaydi, hech narsa o'chirilmaydi yoki destructive emas.
-- Har bir yangi ustun NULLABLE yoki DEFAULT bilan — mavjud qatorlar
-- darhol valid holatda qoladi. `IF NOT EXISTS` — qayta ishga tushirilsa
-- ham xavfsiz.

ALTER TABLE "bus_companies" ADD COLUMN IF NOT EXISTS "address" TEXT;
ALTER TABLE "bus_companies" ADD COLUMN IF NOT EXISTS "latitude" DECIMAL(10,7);
ALTER TABLE "bus_companies" ADD COLUMN IF NOT EXISTS "longitude" DECIMAL(10,7);
ALTER TABLE "bus_companies" ADD COLUMN IF NOT EXISTS "nearby_places" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "bus_companies" ADD COLUMN IF NOT EXISTS "check_in_time" VARCHAR(5);
ALTER TABLE "bus_companies" ADD COLUMN IF NOT EXISTS "check_out_time" VARCHAR(5);
ALTER TABLE "bus_companies" ADD COLUMN IF NOT EXISTS "cancellation_policy_code" VARCHAR(32) NOT NULL DEFAULT 'MODERATE';
ALTER TABLE "bus_companies" ADD COLUMN IF NOT EXISTS "extra_fees" JSONB NOT NULL DEFAULT '[]';
