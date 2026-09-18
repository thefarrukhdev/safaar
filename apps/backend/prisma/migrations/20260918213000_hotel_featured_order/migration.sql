-- Admin-controlled display order for featured hotels on the public home
-- page (`cms/featured-hotels` reorder UI). NULLABLE, no default — additive,
-- backward-compatible (precedent: 20260916150100_payment_fee_breakdown_fields).
--
-- Deliberately a SEPARATE column from `featured` (boolean): `featured`
-- decides membership, `featured_order` decides display order among members.
-- NULL means "featured but never explicitly ordered yet" — the public query
-- (hotels.service.ts) sorts these last (NULLS LAST), never before an
-- explicitly-ordered hotel, and this column is never read for hotels where
-- featured = false.

ALTER TABLE "hotels" ADD COLUMN "featured_order" INTEGER;
