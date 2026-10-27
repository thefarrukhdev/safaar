-- SAFAAR QA 7 PARTNER ACCOUNTS SEED (idempotent & production-ready)
-- Created for: https://safaar-partner.vercel.app/login (and partner.safaar.uz)
-- Password for all: SafaarQA2026!
-- Hash: $argon2id$v=19$m=65536,t=3,p=4$ZlkSRlkO5tZa75Ol8cFm1A$qKkkQhdIShhm1im8tVNH5oMPei/2mmkll4R69P4xZNA

BEGIN;

-- 1. ROOM TYPES (Distinct domain types for Hotel, Hostel, Guest House, Motel, Dacha, Restaurant)
INSERT INTO room_types (id, code, name, description, bed_type, size_sqm, base_price, capacity, updated_at)
VALUES
  -- Hotel: Standard & Deluxe
  ('00000000-0000-9307-0000-000000000001', 'qa-standard-room', '{"uz":"Standart xona","ru":"Стандартный номер","en":"Standard Room"}'::jsonb, 'QA Standart xona', 'double', 24, 600000, 2, now()),
  ('00000000-0000-9307-0000-000000000002', 'qa-deluxe-room', '{"uz":"Deluxe xona","ru":"Делюкс номер","en":"Deluxe Room"}'::jsonb, 'QA Deluxe xona', 'king', 36, 900000, 3, now()),
  -- Hostel: 8-bed mixed & 4-bed female dorm
  ('00000000-0000-9307-0000-000000000003', 'qa-hostel-dorm-mixed-8-00000000-0000-9303-0000-000000000002', '{"uz":"8 kishilik umumiy yotoqxona (Aralash)","ru":"8-местный общий номер (Смешанный)","en":"8-Bed Mixed Dorm"}'::jsonb, 'Hostel 8 kishilik aralash umumiy yotoqxona', 'Bunk Bed', 32, 150000, 8, now()),
  ('00000000-0000-9307-0000-000000000004', 'qa-hostel-dorm-female-4-00000000-0000-9303-0000-000000000002', '{"uz":"4 kishilik ayollar yotoqxonasi","ru":"4-местный женский номер","en":"4-Bed Female Dorm"}'::jsonb, 'Hostel 4 kishilik qulay ayollar yotoqxonasi', 'Bunk Bed', 20, 180000, 4, now()),
  -- Guest house: Family Room
  ('00000000-0000-9307-0000-000000000011', 'qa-gh-family-room-00000000-0000-9303-0000-000000000003', '{"uz":"Milliy oilaviy xona","ru":"Семейный номер в национальном стиле","en":"Traditional Family Room"}'::jsonb, 'Samarqand milliy uslubidagi qulay oilaviy xona', 'Double Bed', 28, 450000, 4, now()),
  -- Motel: Roadside comfort
  ('00000000-0000-9307-0000-000000000013', 'qa-motel-comfort-room-00000000-0000-9303-0000-000000000004', '{"uz":"Qulay yo''l bo''yi xonasi","ru":"Удобный придорожный номер","en":"Roadside Comfort Room"}'::jsonb, 'Tranzit sayohatchilar uchun avtoturargohli qulay xona', 'Twin Beds', 22, 300000, 2, now()),
  -- Dacha: Full estate
  ('00000000-0000-9307-0000-000000000015', 'qa-dacha-full-estate-00000000-0000-9303-0000-000000000005', '{"uz":"Butun dacha (Kottej majmuasi)","ru":"Дача целиком (Коттеджный комплекс)","en":"Whole Villa (Cottage Estate)"}'::jsonb, 'Basseyn, sauna, bilyard va tapchanli to''liq dacha ijarasi', 'King Bed', 250, 2500000, 12, now()),
  -- Restaurant: Tables & VIP Cabins
  ('00000000-0000-9307-0000-000000000006', 'qa-rest-main-table-00000000-0000-9303-0000-000000000006', '{"uz":"Standart stol (Umumiy zal)","ru":"Стандартный стол (Основной зал)","en":"Standard Table (Main Hall)"}'::jsonb, 'Asosiy zal markazidagi qulay oilaviy stol', 'none', 12, 50000, 4, now()),
  ('00000000-0000-9307-0000-000000000007', 'qa-rest-vip-table-00000000-0000-9303-0000-000000000006', '{"uz":"VIP Stol (Alohida kabinet)","ru":"VIP стол (Отдельный кабинет)","en":"VIP Table (Private Room)"}'::jsonb, 'Alohida yopiq shinam kabinet, xontaxta va musiqa tizimi bilan', 'none', 24, 150000, 8, now()),
  ('00000000-0000-9307-0000-000000000008', 'qa-rest-terrace-table-00000000-0000-9303-0000-000000000006', '{"uz":"Terrasa stoli (Ochiq havo)","ru":"Стол на террасе (Свежий воздух)","en":"Terrace Table (Outdoor)"}'::jsonb, 'Ochiq havodagi so''lim terassa stoli', 'none', 16, 80000, 4, now())
ON CONFLICT (id) DO UPDATE
SET name = excluded.name,
    code = excluded.code,
    description = excluded.description,
    bed_type = excluded.bed_type,
    size_sqm = excluded.size_sqm,
    base_price = excluded.base_price,
    capacity = excluded.capacity,
    updated_at = now();

-- 2. PARTNER ORGANIZATIONS (7 accounts)
INSERT INTO partner_organizations (
  id, type, legal_name, brand_name, tax_id, phone, email, city_id, address,
  contact_person, status, default_commission_rate, created_at, updated_at
)
VALUES
  -- 1: Hotel
  ('00000000-0000-9301-0000-000000000001', 'hotel', 'Toshkent Grand Plaza Hotel MCHJ', 'Toshkent Grand Plaza Hotel', '900010001', '+998900010001', 'hotel.plaza@safaar.uz', '00000000-0000-1002-0000-000000000001', 'Toshkent shahri, Amir Temur shox ko''chasi 15', 'Plaza Admin', 'approved', 12.00, now(), now()),
  -- 2: Hostel
  ('00000000-0000-9301-0000-000000000002', 'hostel', 'Silk Road Youth Hostel MCHJ', 'Silk Road Youth Hostel', '900010002', '+998900010002', 'hostel.silkroad@safaar.uz', '00000000-0000-1002-0000-000000000001', 'Toshkent shahri, Chilonzor 5-mavze', 'Silk Road Admin', 'approved', 12.00, now(), now()),
  -- 3: Guest house
  ('00000000-0000-9301-0000-000000000003', 'guesthouse', 'Samarkand Family Guest House OK', 'Samarkand Family Guest House', '900010003', '+998900010003', 'guesthouse.samarkand@safaar.uz', '00000000-0000-1002-0000-000000000002', 'Samarqand shahri, Registon ko''chasi 42', 'Samarkand Admin', 'approved', 12.00, now(), now()),
  -- 4: Motel
  ('00000000-0000-9301-0000-000000000004', 'motel', 'Oasis Roadside Motel MCHJ', 'Oasis Roadside Motel', '900010004', '+998900010004', 'motel.oasis@safaar.uz', '00000000-0000-1002-0000-000000000001', 'Toshkent viloyati, M39 trassasi 45-km', 'Oasis Admin', 'approved', 12.00, now(), now()),
  -- 5: Dacha
  ('00000000-0000-9301-0000-000000000005', 'dacha', 'Chorvoq Dacha MCHJ', 'Chorvoq Tog'' Bag''rida Dacha', '900010005', '+998900010005', 'dacha.chorvoq@safaar.uz', '00000000-0000-1002-0000-000000000007', 'Bo''stonliq tumani, Yusufxona qishlog''i', 'Chorvoq Admin', 'approved', 12.00, now(), now()),
  -- 6: Restaurant
  ('00000000-0000-9301-0000-000000000006', 'restaurant', 'Afsona Restoran MCHJ', 'Afsona Milliy Taomlar Restorani', '900010006', '+998900010006', 'restoran.afsona@safaar.uz', '00000000-0000-1002-0000-000000000001', 'Toshkent shahri, Navoiy ko''chasi 8', 'Afsona Admin', 'approved', 12.00, now(), now()),
  -- 7: Transport
  ('00000000-0000-9301-0000-000000000007', 'bus', 'Safaar Auto Rent MCHJ', 'Safaar Auto Rent', '900010007', '+998900010007', 'transport.autorent@safaar.uz', '00000000-0000-1002-0000-000000000001', 'Toshkent shahri, Bobur ko''chasi 33', 'Auto Rent Admin', 'approved', 12.00, now(), now())
ON CONFLICT (tax_id) DO UPDATE
SET legal_name = excluded.legal_name,
    brand_name = excluded.brand_name,
    phone = excluded.phone,
    email = excluded.email,
    city_id = excluded.city_id,
    address = excluded.address,
    contact_person = excluded.contact_person,
    status = excluded.status,
    updated_at = now();

-- 3. PARTNER USERS (Login credentials with SafaarQA2026!)
INSERT INTO partner_users (
  id, organization_id, email, password_hash, full_name, role, status, created_at, updated_at
)
VALUES
  ('00000000-0000-9302-0000-000000000001', '00000000-0000-9301-0000-000000000001', 'hotel.plaza@safaar.uz', '$argon2id$v=19$m=65536,t=3,p=4$ZlkSRlkO5tZa75Ol8cFm1A$qKkkQhdIShhm1im8tVNH5oMPei/2mmkll4R69P4xZNA', 'Plaza Boshqaruvchisi', 'owner', 'active', now(), now()),
  ('00000000-0000-9302-0000-000000000002', '00000000-0000-9301-0000-000000000002', 'hostel.silkroad@safaar.uz', '$argon2id$v=19$m=65536,t=3,p=4$ZlkSRlkO5tZa75Ol8cFm1A$qKkkQhdIShhm1im8tVNH5oMPei/2mmkll4R69P4xZNA', 'Silk Road Boshqaruvchisi', 'owner', 'active', now(), now()),
  ('00000000-0000-9302-0000-000000000003', '00000000-0000-9301-0000-000000000003', 'guesthouse.samarkand@safaar.uz', '$argon2id$v=19$m=65536,t=3,p=4$ZlkSRlkO5tZa75Ol8cFm1A$qKkkQhdIShhm1im8tVNH5oMPei/2mmkll4R69P4xZNA', 'Samarkand GH Boshqaruvchisi', 'owner', 'active', now(), now()),
  ('00000000-0000-9302-0000-000000000004', '00000000-0000-9301-0000-000000000004', 'motel.oasis@safaar.uz', '$argon2id$v=19$m=65536,t=3,p=4$ZlkSRlkO5tZa75Ol8cFm1A$qKkkQhdIShhm1im8tVNH5oMPei/2mmkll4R69P4xZNA', 'Oasis Motel Boshqaruvchisi', 'owner', 'active', now(), now()),
  ('00000000-0000-9302-0000-000000000005', '00000000-0000-9301-0000-000000000005', 'dacha.chorvoq@safaar.uz', '$argon2id$v=19$m=65536,t=3,p=4$ZlkSRlkO5tZa75Ol8cFm1A$qKkkQhdIShhm1im8tVNH5oMPei/2mmkll4R69P4xZNA', 'Chorvoq Dacha Boshqaruvchisi', 'owner', 'active', now(), now()),
  ('00000000-0000-9302-0000-000000000006', '00000000-0000-9301-0000-000000000006', 'restoran.afsona@safaar.uz', '$argon2id$v=19$m=65536,t=3,p=4$ZlkSRlkO5tZa75Ol8cFm1A$qKkkQhdIShhm1im8tVNH5oMPei/2mmkll4R69P4xZNA', 'Afsona Restoran Boshqaruvchisi', 'owner', 'active', now(), now()),
  ('00000000-0000-9302-0000-000000000007', '00000000-0000-9301-0000-000000000007', 'transport.autorent@safaar.uz', '$argon2id$v=19$m=65536,t=3,p=4$ZlkSRlkO5tZa75Ol8cFm1A$qKkkQhdIShhm1im8tVNH5oMPei/2mmkll4R69P4xZNA', 'Auto Rent Boshqaruvchisi', 'owner', 'active', now(), now())
ON CONFLICT (organization_id, email) DO UPDATE
SET password_hash = excluded.password_hash,
    full_name = excluded.full_name,
    role = excluded.role,
    status = excluded.status,
    deleted_at = NULL,
    updated_at = now();

-- 4. HOTELS / OBJECTS (Hotels 1..6)
INSERT INTO hotels (
  id, partner_organization_id, slug, city_id, address, stars,
  rating_average, reviews_count, status, check_in_time, check_out_time,
  has_sauna, has_billiards, has_outdoor_pool, land_area_sotix, created_at, updated_at
)
VALUES
  -- 1: Hotel
  ('00000000-0000-9303-0000-000000000001', '00000000-0000-9301-0000-000000000001', 'toshkent-grand-plaza-hotel', '00000000-0000-1002-0000-000000000001', 'Toshkent shahri, Amir Temur shox ko''chasi 15', 4, 4.8, 12, 'published', '14:00', '12:00', false, false, false, NULL, now(), now()),
  -- 2: Hostel
  ('00000000-0000-9303-0000-000000000002', '00000000-0000-9301-0000-000000000002', 'silk-road-youth-hostel', '00000000-0000-1002-0000-000000000001', 'Toshkent shahri, Chilonzor 5-mavze', 2, 4.5, 8, 'published', '14:00', '12:00', false, false, false, NULL, now(), now()),
  -- 3: Guest house
  ('00000000-0000-9303-0000-000000000003', '00000000-0000-9301-0000-000000000003', 'samarkand-family-guest-house', '00000000-0000-1002-0000-000000000002', 'Samarqand shahri, Registon ko''chasi 42', 3, 4.9, 15, 'published', '14:00', '12:00', false, false, false, NULL, now(), now()),
  -- 4: Motel
  ('00000000-0000-9303-0000-000000000004', '00000000-0000-9301-0000-000000000004', 'oasis-roadside-motel', '00000000-0000-1002-0000-000000000001', 'Toshkent viloyati, M39 trassasi 45-km', 2, 4.2, 5, 'published', '14:00', '12:00', false, false, false, NULL, now(), now()),
  -- 5: Dacha
  ('00000000-0000-9303-0000-000000000005', '00000000-0000-9301-0000-000000000005', 'chorvoq-tog-bagrida-dacha', '00000000-0000-1002-0000-000000000007', 'Bo''stonliq tumani, Yusufxona qishlog''i', 4, 4.9, 20, 'published', '14:00', '12:00', true, true, true, 8, now(), now()),
  -- 6: Restaurant
  ('00000000-0000-9303-0000-000000000006', '00000000-0000-9301-0000-000000000006', 'afsona-milliy-taomlar-restorani', '00000000-0000-1002-0000-000000000001', 'Toshkent shahri, Navoiy ko''chasi 8', 0, 4.7, 34, 'published', '10:00', '23:00', false, false, false, NULL, now(), now())
ON CONFLICT (slug) DO UPDATE
SET partner_organization_id = excluded.partner_organization_id,
  city_id = excluded.city_id,
  address = excluded.address,
  status = excluded.status,
  has_sauna = excluded.has_sauna,
  has_billiards = excluded.has_billiards,
  has_outdoor_pool = excluded.has_outdoor_pool,
  land_area_sotix = excluded.land_area_sotix,
  deleted_at = NULL,
  updated_at = now();

-- 5. HOTEL TRANSLATIONS
INSERT INTO hotel_translations (id, hotel_id, language, name, description, created_at, updated_at)
VALUES
  ('00000000-0000-9304-0000-000000000001', '00000000-0000-9303-0000-000000000001', 'uz', 'Toshkent Grand Plaza Hotel', 'Toshkent markazidagi hashamatli va qulay mehmonxona.', now(), now()),
  ('00000000-0000-9304-0000-000000000002', '00000000-0000-9303-0000-000000000002', 'uz', 'Silk Road Youth Hostel', 'Yoshlar va sayohatchilar uchun qulay yotoqxona.', now(), now()),
  ('00000000-0000-9304-0000-000000000003', '00000000-0000-9303-0000-000000000003', 'uz', 'Samarkand Family Guest House', 'Samarqandning tarixiy qismida joylashgan oilaviy mehmon uyi.', now(), now()),
  ('00000000-0000-9304-0000-000000000004', '00000000-0000-9303-0000-000000000004', 'uz', 'Oasis Roadside Motel', 'Yo''l bo''yida tunab qolish uchun shinam motel.', now(), now()),
  ('00000000-0000-9304-0000-000000000005', '00000000-0000-9303-0000-000000000005', 'uz', 'Chorvoq Tog'' Bag''rida Dacha', 'Chorvoq suv ombori yaqinida, basseyn, sauna va bilyardli dacha.', now(), now()),
  ('00000000-0000-9304-0000-000000000006', '00000000-0000-9303-0000-000000000006', 'uz', 'Afsona Milliy Taomlar Restorani', 'Milliy taomlar, stollar va xontaxtali oilaviy restoran.', now(), now())
ON CONFLICT (hotel_id, language) DO UPDATE
SET name = excluded.name, description = excluded.description, updated_at = now();

-- 6. HOTEL ROOMS / UNITS
INSERT INTO hotel_rooms (
  id, hotel_id, room_type_id, code, floor, base_occupancy, max_adults, max_children,
  total_inventory, base_price, status, housekeeping_status, is_listed, created_at, updated_at
)
VALUES
  -- Plaza: Standard
  ('00000000-0000-9305-0000-000000000001', '00000000-0000-9303-0000-000000000001', '00000000-0000-9307-0000-000000000001', 'PLAZA-STD', 1, 2, 2, 1, 10, 600000, 'active', 'VACANT_CLEAN', true, now(), now()),
  -- Plaza: Deluxe
  ('00000000-0000-9305-0000-000000000002', '00000000-0000-9303-0000-000000000001', '00000000-0000-9307-0000-000000000002', 'PLAZA-DLX', 2, 2, 3, 2, 5, 900000, 'active', 'VACANT_CLEAN', true, now(), now()),

  -- Hostel: 8 kishilik umumiy xona
  ('00000000-0000-9305-0000-000000000003', '00000000-0000-9303-0000-000000000002', '00000000-0000-9307-0000-000000000003', 'HOSTEL-DORM8', 1, 8, 8, 0, 8, 150000, 'active', 'VACANT_CLEAN', true, now(), now()),
  -- Hostel: 4 kishilik ayollar xonasi
  ('00000000-0000-9305-0000-000000000008', '00000000-0000-9303-0000-000000000002', '00000000-0000-9307-0000-000000000004', 'HOSTEL-DORM4', 2, 4, 4, 0, 4, 180000, 'active', 'VACANT_CLEAN', true, now(), now()),

  -- Guest house: Oilaviy xona
  ('00000000-0000-9305-0000-000000000004', '00000000-0000-9303-0000-000000000003', '00000000-0000-9307-0000-000000000011', 'GH-FAM', 1, 4, 4, 2, 4, 450000, 'active', 'VACANT_CLEAN', true, now(), now()),

  -- Motel: Yo'l bo'yi qulay xona
  ('00000000-0000-9305-0000-000000000005', '00000000-0000-9303-0000-000000000004', '00000000-0000-9307-0000-000000000013', 'MOTEL-COMF', 1, 2, 2, 1, 8, 300000, 'active', 'VACANT_CLEAN', true, now(), now()),

  -- Dacha: Butun dacha (Basseyn, sauna, bilyard)
  ('00000000-0000-9305-0000-000000000006', '00000000-0000-9303-0000-000000000005', '00000000-0000-9307-0000-000000000015', 'DACHA-MAIN', 1, 10, 12, 4, 1, 2500000, 'active', 'VACANT_CLEAN', true, now(), now()),

  -- Restaurant: Stollar (1-zal Standart, 2-zal VIP, 3-zal Terrasa)
  ('00000000-0000-9305-0000-000000000007', '00000000-0000-9303-0000-000000000006', '00000000-0000-9307-0000-000000000006', 'T1', 1, 4, 4, 2, 1, 50000, 'active', 'VACANT_CLEAN', true, now(), now()),
  ('00000000-0000-9305-0000-000000000009', '00000000-0000-9303-0000-000000000006', '00000000-0000-9307-0000-000000000006', 'T2', 1, 4, 4, 2, 1, 50000, 'active', 'VACANT_CLEAN', true, now(), now()),
  ('00000000-0000-9305-0000-000000000010', '00000000-0000-9303-0000-000000000006', '00000000-0000-9307-0000-000000000007', 'VIP-1', 2, 8, 8, 4, 1, 150000, 'active', 'VACANT_CLEAN', true, now(), now()),
  ('00000000-0000-9305-0000-000000000011', '00000000-0000-9303-0000-000000000006', '00000000-0000-9307-0000-000000000008', 'TER-1', 3, 4, 4, 2, 1, 80000, 'active', 'VACANT_CLEAN', true, now(), now())
ON CONFLICT (hotel_id, code) DO UPDATE
SET room_type_id = excluded.room_type_id,
    floor = excluded.floor,
    base_occupancy = excluded.base_occupancy,
    max_adults = excluded.max_adults,
    max_children = excluded.max_children,
    total_inventory = excluded.total_inventory,
    base_price = excluded.base_price,
    status = excluded.status,
    housekeeping_status = excluded.housekeeping_status,
    is_listed = excluded.is_listed,
    updated_at = now();

-- 7. HOTEL ROOM TRANSLATIONS
INSERT INTO hotel_room_translations (id, room_id, language, name, description, created_at, updated_at)
VALUES
  ('00000000-0000-9306-0000-000000000001', '00000000-0000-9305-0000-000000000001', 'uz', 'Standard xona', 'Qulay standart xona, ikki kishilik karavot bilan.', now(), now()),
  ('00000000-0000-9306-0000-000000000002', '00000000-0000-9305-0000-000000000002', 'uz', 'Deluxe xona', 'Keng va hashamatli Deluxe xona, shahar manzarasi bilan.', now(), now()),
  ('00000000-0000-9306-0000-000000000003', '00000000-0000-9305-0000-000000000003', 'uz', '8 kishilik umumiy yotoqxona', 'Yotoqxonadagi 8 kishilik umumiy xonadan 1 ta o''rin.', now(), now()),
  ('00000000-0000-9306-0000-000000000004', '00000000-0000-9305-0000-000000000004', 'uz', 'Oilaviy xona', 'Oila uchun barcha qulayliklarga ega keng xona.', now(), now()),
  ('00000000-0000-9306-0000-000000000005', '00000000-0000-9305-0000-000000000005', 'uz', 'Yo''l bo''yi qulay xona', 'Sayohat paytida hordiq chiqarish uchun qulay xona.', now(), now()),
  ('00000000-0000-9306-0000-000000000006', '00000000-0000-9305-0000-000000000006', 'uz', 'Chorvoq Tog'' Bag''rida Dacha', 'Basseyn, sauna va bilyard bilan to''liq dacha ijarasi.', now(), now()),
  ('00000000-0000-9306-0000-000000000007', '00000000-0000-9305-0000-000000000007', 'uz', 'Stol 1 (Umumiy zal)', 'Asosiy zaldagi 4 kishilik qulay stol.', now(), now()),
  ('00000000-0000-9306-0000-000000000008', '00000000-0000-9305-0000-000000000008', 'uz', '4 kishilik ayollar yotoqxonasi', 'Ayollar uchun alohida 4 kishilik yotoqxona.', now(), now()),
  ('00000000-0000-9306-0000-000000000009', '00000000-0000-9305-0000-000000000009', 'uz', 'Stol 2 (Umumiy zal)', 'Asosiy zaldagi 4 kishilik qulay stol.', now(), now()),
  ('00000000-0000-9306-0000-000000000010', '00000000-0000-9305-0000-000000000010', 'uz', 'VIP Stol 1 (Kabinet)', 'Alohida VIP kabinet, 8 kishilik.', now(), now()),
  ('00000000-0000-9306-0000-000000000011', '00000000-0000-9305-0000-000000000011', 'uz', 'Terrasa Stoli 1', 'Ochiq havodagi 4 kishilik manzarali stol.', now(), now())
ON CONFLICT (room_id, language) DO UPDATE
SET name = excluded.name, description = excluded.description, updated_at = now();

-- 7b. HOSTEL BEDS SEED (For Silk Road Youth Hostel DORM8)
INSERT INTO room_beds (id, room_id, label, status, is_listed, nightly_price, created_at, updated_at)
VALUES
  ('00000000-0000-9310-0000-000000000001', '00000000-0000-9305-0000-000000000003', 'Yotoq 1 (Pastki)', 'VACANT_CLEAN', true, 150000, now(), now()),
  ('00000000-0000-9310-0000-000000000002', '00000000-0000-9305-0000-000000000003', 'Yotoq 2 (Yuqori)', 'VACANT_CLEAN', true, 150000, now(), now()),
  ('00000000-0000-9310-0000-000000000003', '00000000-0000-9305-0000-000000000003', 'Yotoq 3 (Pastki)', 'VACANT_CLEAN', true, 150000, now(), now()),
  ('00000000-0000-9310-0000-000000000004', '00000000-0000-9305-0000-000000000003', 'Yotoq 4 (Yuqori)', 'VACANT_CLEAN', true, 150000, now(), now()),
  ('00000000-0000-9310-0000-000000000005', '00000000-0000-9305-0000-000000000003', 'Yotoq 5 (Pastki)', 'VACANT_CLEAN', true, 150000, now(), now()),
  ('00000000-0000-9310-0000-000000000006', '00000000-0000-9305-0000-000000000003', 'Yotoq 6 (Yuqori)', 'VACANT_CLEAN', true, 150000, now(), now()),
  ('00000000-0000-9310-0000-000000000007', '00000000-0000-9305-0000-000000000003', 'Yotoq 7 (Pastki)', 'VACANT_CLEAN', true, 150000, now(), now()),
  ('00000000-0000-9310-0000-000000000008', '00000000-0000-9305-0000-000000000003', 'Yotoq 8 (Yuqori)', 'VACANT_CLEAN', true, 150000, now(), now())
ON CONFLICT (room_id, label) DO UPDATE
SET status = excluded.status,
    is_listed = excluded.is_listed,
    nightly_price = excluded.nightly_price,
    updated_at = now();

-- 8. TRANSPORT: BUS COMPANY & VEHICLES (Partner 7)
INSERT INTO bus_companies (
  id, partner_organization_id, name, status, rating_average, reviews_count,
  address, created_at, updated_at
)
VALUES
  ('00000000-0000-9308-0000-000000000001', '00000000-0000-9301-0000-000000000007', 'Safaar Auto Rent', 'active', 4.8, 10, 'Toshkent shahri, Bobur ko''chasi 33', now(), now())
ON CONFLICT (id) DO UPDATE
SET partner_organization_id = excluded.partner_organization_id,
    name = excluded.name,
    status = excluded.status,
    address = excluded.address,
    updated_at = now();

INSERT INTO vehicles (
  id, company_id, name, plate_number, seats_count, status, price_per_day, fuel_type, has_ac, created_at, updated_at
)
VALUES
  ('00000000-0000-9309-0000-000000000001', '00000000-0000-9308-0000-000000000001', 'Chevrolet Malibu 2', '01A777AA', 5, 'active', 650000, 'petrol', true, now(), now()),
  ('00000000-0000-9309-0000-000000000002', '00000000-0000-9308-0000-000000000001', 'Chevrolet Cobalt', '01B888BB', 5, 'active', 350000, 'petrol', true, now(), now()),
  ('00000000-0000-9309-0000-000000000003', '00000000-0000-9308-0000-000000000001', 'Yutong Turistik Avtobus', '01C999CC', 51, 'active', 2200000, 'diesel', true, now(), now())
ON CONFLICT (id) DO UPDATE
SET company_id = excluded.company_id,
    name = excluded.name,
    plate_number = excluded.plate_number,
    seats_count = excluded.seats_count,
    status = excluded.status,
    price_per_day = excluded.price_per_day,
    fuel_type = excluded.fuel_type,
    has_ac = excluded.has_ac,
    updated_at = now();

COMMIT;
