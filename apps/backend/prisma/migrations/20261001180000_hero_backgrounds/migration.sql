-- CreateTable: hero_backgrounds
CREATE TABLE IF NOT EXISTS "hero_backgrounds" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "page" VARCHAR(64) NOT NULL,
    "title" JSONB,
    "subtitle" JSONB,
    "image_url" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB DEFAULT '{}'::jsonb,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hero_backgrounds_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX IF NOT EXISTS "hero_backgrounds_page_is_active_idx" ON "hero_backgrounds"("page", "is_active");
CREATE INDEX IF NOT EXISTS "hero_backgrounds_is_active_sort_order_idx" ON "hero_backgrounds"("is_active", "sort_order");

-- Seed initial hero backgrounds from User panel
INSERT INTO "hero_backgrounds" ("id", "page", "title", "subtitle", "image_url", "is_active", "sort_order", "created_at", "updated_at")
VALUES
  (
    '00000000-0000-7010-0000-000000000001',
    'home',
    '{"uz": "Orzuyingizdagi mehmonxonani bugun toping", "ru": "Найдите отель вашей мечты сегодня", "en": "Find your dream hotel today"}'::jsonb,
    '{"uz": "O''zbekiston bo''ylab mehmonxonalarni kafolatlangan eng arzon narxlarda kashf eting. Soniyalar ichida bron qiling.", "ru": "Откройте для себя отели по всему Узбекистану по лучшим ценам.", "en": "Discover hotels across Uzbekistan with guaranteed best prices."}'::jsonb,
    '/registon-blue-sky.jpeg',
    true,
    1,
    NOW(),
    NOW()
  ),
  (
    '00000000-0000-7010-0000-000000000002',
    'hotels',
    '{"uz": "O''zbekiston bo''ylab mehmonxonalar qidirish xizmati", "ru": "Поиск отелей по всему Узбекистану", "en": "Hotel search service across Uzbekistan"}'::jsonb,
    '{"uz": "O''zingizga mos va qulay mehmonxonalarni eng yaxshi narxlarda kashf eting.", "ru": "Откройте для себя подходящие и удобные отели по лучшим ценам.", "en": "Discover comfortable hotels that suit you best."}'::jsonb,
    '/images/heroes/hotels_hero.jpg',
    true,
    2,
    NOW(),
    NOW()
  ),
  (
    '00000000-0000-7010-0000-000000000003',
    'restaurants',
    '{"uz": "Restoranlar va Milliy Taomlar", "ru": "Рестораны и национальная кухня", "en": "Restaurants and National Cuisine"}'::jsonb,
    '{"uz": "O''zbekistonning eng saralangan restoranlari, milliy oshxonalar va shinam choyxonalari.", "ru": "Лучшие рестораны Узбекистана, национальная кухня и уютные чайханы.", "en": "Uzbekistan''s finest restaurants, traditional dining and cozy teahouses."}'::jsonb,
    '/images/heroes/hero.png',
    true,
    3,
    NOW(),
    NOW()
  ),
  (
    '00000000-0000-7010-0000-000000000004',
    'transport',
    '{"uz": "Avto Ijarasi va Transfer Xizmatlari", "ru": "Аренда авто и трансфер", "en": "Car Rental and Transfer Services"}'::jsonb,
    '{"uz": "O''zbekiston bo''ylab qulay sayohat qilish uchun avtomobil ijarasi, VIP taksi va aeroport transferlari.", "ru": "Аренда автомобилей, VIP такси и трансферы из аэропорта для комфортных путешествий по Узбекистану.", "en": "Car rental, VIP taxi, and airport transfers for comfortable travel across Uzbekistan."}'::jsonb,
    '/images/heroes/transport_hero.jpg',
    true,
    4,
    NOW(),
    NOW()
  )
ON CONFLICT ("id") DO NOTHING;
