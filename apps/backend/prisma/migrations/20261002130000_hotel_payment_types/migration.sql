-- Mehmonxonalarda to'lov turlari (naqd/joyida to'lov va onlayn to'lov)
ALTER TABLE "hotels" ADD COLUMN IF NOT EXISTS "allows_cash" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "hotels" ADD COLUMN IF NOT EXISTS "allows_online_payment" BOOLEAN NOT NULL DEFAULT true;
