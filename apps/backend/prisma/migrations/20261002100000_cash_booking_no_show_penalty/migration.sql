-- Naqd to'lov va 60 kunlik no-show jarima tizimi

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "booking_blocked_until" TIMESTAMPTZ(6);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "booking_blocked_reason" VARCHAR(255);

CREATE TABLE IF NOT EXISTS "booking_penalties" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "phone" VARCHAR(20) NOT NULL,
    "booking_id" UUID,
    "reason" VARCHAR(100) NOT NULL DEFAULT 'no_show',
    "blocked_until" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_penalties_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "booking_penalties_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "booking_penalties_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "booking_penalties_phone_blocked_until_idx" ON "booking_penalties"("phone", "blocked_until");
CREATE INDEX IF NOT EXISTS "booking_penalties_user_id_blocked_until_idx" ON "booking_penalties"("user_id", "blocked_until");
