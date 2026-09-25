-- POST /reviews/:id/reply previously built and returned a reply object but
-- never persisted it anywhere (confirmed by "BACKEND AUDIT — REVIEWS /
-- SHARHLAR" + "BACKEND BUG FIX — REVIEW PARTNER REPLY PERSISTENCE"): the
-- `reviews` table had no reply-related column and no separate reply table
-- existed. Partner actor ids come from `partner_users`, not `users`
-- (confirmed via auth.service.ts issuePartnerTokens* -> actorId: partnerUser.id),
-- so `reply_by` references `partner_users(id)`, not `users(id)`.
--
-- Intentionally ONE reply per review (single set of columns on the row,
-- mirroring the existing promotions.reviewed_at/reviewed_by single-decision
-- pattern), not a separate threaded-reply table.
--
-- Additive, safe: all three columns NULLABLE, no default requiring backfill,
-- no existing row/query touched. IF NOT EXISTS — safe to re-run.

ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "reply_body" TEXT;
ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "reply_by" UUID;
ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "replied_at" TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'reviews_reply_by_fkey'
  ) THEN
    ALTER TABLE "reviews"
      ADD CONSTRAINT "reviews_reply_by_fkey"
      FOREIGN KEY ("reply_by") REFERENCES "partner_users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
