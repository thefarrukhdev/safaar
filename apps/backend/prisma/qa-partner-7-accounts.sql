-- SAFAAR QA 7 PARTNER ACCOUNTS SEED (idempotent & production-ready)
-- Created for: https://safaar-partner.vercel.app/login
-- Password for all: SafaarQA2026!
-- Hash: $argon2id$v=19$m=65536,t=3,p=4$ZlkSRlkO5tZa75Ol8cFm1A$qKkkQhdIShhm1im8tVNH5oMPei/2mmkll4R69P4xZNA

BEGIN;

-- 1. ROOM TYPES (Standard & Deluxe for QA)
INSERT INTO room_types (id, code, name, description, bed_type, size_sqm, base_price, capacity, updated_at)
VALUES
  ('00000000-0000-9307-0000-000000000001', 'qa-standard-room', '{"uz":"Standart xona","ru":"Стандартный номер","en":"Standard Room"}'::jsonb, 'QA Standart xona', 'double', 24, 600000, 2, now()),
  ('00000000-0000-9307-0000-000000000002', 'qa-deluxe-room', '{"uz":"Deluxe xona","ru":"Делюкс номер","en":"Deluxe Room"}'::jsonb, 'QA Deluxe xona', 'king', 36, 900000, 3, now())
ON CONFLICT (id) DO UPDATE
SET name = excluded.name, description = excluded.description, updated_at = now();

-- 2. PARTNER ORGANIZATIONS (7 accounts)
INSERT INTO partner_organizations (
  id, type, legal_name, brand_name, tax_id, phone, email, city_id, address,
  contact_person, status, default_commission_rate, created_at, updated_at
)
VALUES
  -- 1: Hotel
  ('00000000-0000-9301-0000-000000000001', 'hotel', 'Toshkent Grand Plaza Hotel MCHJ', 'Toshkent Grand Plaza Hotel', '900010001', '+998900010001', 'hotel.plaza@safaar.uz', '1bf1fb7a-3698-4ccc-a9cb-1ad72b475303', 'Toshkent shahri, Amir Temur shox ko''chasi 15', 'Plaza Admin', 'approved', 12.00, now(), now()),
  -- 2: Hostel
  ('00000000-0000-9301-0000-000000000002', 'hostel', 'Silk Road Youth Hostel MCHJ', 'Silk Road Youth Hostel', '900010002', '+998900010002', 'hostel.silkroad@safaar.uz', '1bf1fb7a-3698-4ccc-a9cb-1ad72b475303', 'Toshkent shahri, Chilonzor 5-mavze', 'Silk Road Admin', 'approved', 12.00, now(), now()),
  -- 3: Guest house
  ('00000000-0000-9301-0000-000000000003', 'guesthouse', 'Samarkand Family Guest House OK', 'Samarkand Family Guest House', '900010003', '+998900010003', 'guesthouse.samarkand@safaar.uz', 'd40bd716-65f6-4cb7-a858-22ff203d1978', 'Samarqand shahri, Registon ko''chasi 42', 'Samarkand Admin', 'approved', 12.00, now(), now()),
  -- 4: Motel
  ('00000000-0000-9301-0000-000000000004', 'motel', 'Oasis Roadside Motel MCHJ', 'Oasis Roadside Motel', '900010004', '+998900010004', 'motel.oasis@safaar.uz', '1bf1fb7a-3698-4ccc-a9cb-1ad72b475303', 'Toshkent viloyati, M39 trassasi 45-km', 'Oasis Admin', 'approved', 12.00, now(), now()),
  -- 5: Dacha
  ('00000000-0000-9301-0000-000000000005', 'dacha', 'Chorvoq Dacha MCHJ', 'Chorvoq Tog'' Bag''rida Dacha', '900010005', '+998900010005', 'dacha.chorvoq@safaar.uz', 'd5548474-6864-4f23-9b8e-e13639a26e6a', 'Bo''stonliq tumani, Yusufxona qishlog''i', 'Chorvoq Admin', 'approved', 12.00, now(), now()),
  -- 6: Restaurant
  ('00000000-0000-9301-0000-000000000006', 'restaurant', 'Afsona Restoran MCHJ', 'Afsona Milliy Taomlar Restorani', '900010006', '+998900010006', 'restoran.afsona@safaar.uz', '1bf1fb7a-3698-4ccc-a9cb-1ad72b475303', 'Toshkent shahri, Navoiy ko''chasi 8', 'Afsona Admin', 'approved', 12.00, now(), now()),
  -- 7: Transport
  ('00000000-0000-9301-0000-000000000007', 'bus', 'Safaar Auto Rent MCHJ', 'Safaar Auto Rent', '900010007', '+998900010007', 'transport.autorent@safaar.uz', '1bf1fb7a-3698-4ccc-a9cb-1ad72b475303', 'Toshkent shahri, Bobur ko''chasi 33', 'Auto Rent Admin', 'approved', 12.00, now(), now())
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
  has_sauna, has_billiards, has_outdoor_pool, created_at, updated_at
)
VALUES
  -- 1: Hotel
  ('00000000-0000-9303-0000-000000000001', '00000000-0000-9301-0000-000000000001', 'toshkent-grand-plaza-hotel', '1bf1fb7a-3698-4ccc-a9cb-1ad72b475303', 'Toshkent shahri, Amir Temur shox ko''chasi 15', 4, 4.8, 12, 'published', '14:00', '12:00', false, false, false, now(), now()),
  -- 2: Hostel
  ('00000000-0000-9303-0000-000000000002', '00000000-0000-9301-0000-000000000002', 'silk-road-youth-hostel', '1bf1fb7a-3698-4ccc-a9cb-1ad72b475303', 'Toshkent shahri, Chilonzor 5-mavze', 2, 4.5, 8, 'published', '14:00', '12:00', false, false, false, now(), now()),
  -- 3: Guest house
  ('00000000-0000-9303-0000-000000000003', '00000000-0000-9301-0000-000000000003', 'samarkand-family-guest-house', 'd40bd716-65f6-4cb7-a858-22ff203d1978', 'Samarqand shahri, Registon ko''chasi 42', 3, 4.9, 15, 'published', '14:00', '12:00', false, false, false, now(), now()),
  -- 4: Motel
  ('00000000-0000-9303-0000-000000000004', '00000000-0000-9301-0000-000000000004', 'oasis-roadside-motel', '1bf1fb7a-3698-4ccc-a9cb-1ad72b475303', 'Toshkent viloyati, M39 trassasi 45-km', 2, 4.2, 5, 'published', '14:00', '12:00', false, false, false, now(), now()),
  -- 5: Dacha
  ('00000000-0000-9303-0000-000000000005', '00000000-0000-9301-0000-000000000005', 'chorvoq-tog-bagrida-dacha', 'd5548474-6864-4f23-9b8e-e13639a26e6a', 'Bo''stonliq tumani, Yusufxona qishlog''i', 4, 4.9, 20, 'published', '14:00', '12:00', true, true, true, now(), now()),
  -- 6: Restaurant
  ('00000000-0000-9303-0000-000000000006', '00000000-0000-9301-0000-000000000006', 'afsona-milliy-taomlar-restorani', '1bf1fb7a-3698-4ccc-a9cb-1ad72b475303', 'Toshkent shahri, Navoiy ko''chasi 8', 0, 4.7, 34, 'published', '10:00', '23:00', false, false, false, now(), now())
ON CONFLICT (slug) DO UPDATE
SET partner_organization_id = excluded.partner_organization_id,
  city_id = excluded.city_id,
  address = excluded.address,
  status = excluded.status,
  has_sauna = excluded.has_sauna,
  has_billiards = excluded.has_billiards,
  has_outdoor_pool = excluded.has_outdoor_pool,
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

-- 6. HOTEL ROOMS / PLACES
INSERT INTO hotel_rooms (
  id, hotel_id, room_type_id, code, base_occupancy, max_adults, max_children,
  total_inventory, base_price, status, is_listed, created_at, updated_at
)
VALUES
  -- Plaza: Standard
  ('00000000-0000-9305-0000-000000000001', '00000000-0000-9303-0000-000000000001', '00000000-0000-9307-0000-000000000001', 'PLAZA-STD', 2, 2, 1, 10, 600000, 'active', true, now(), now()),
  -- Plaza: Deluxe
  ('00000000-0000-9305-0000-000000000002', '00000000-0000-9303-0000-000000000001', '00000000-0000-9307-0000-000000000002', 'PLAZA-DLX', 2, 3, 2, 5, 900000, 'active', true, now(), now()),
  -- Hostel: 8 kishilik umumiy xona
  ('00000000-0000-9305-0000-000000000003', '00000000-0000-9303-0000-000000000002', '00000000-0000-9307-0000-000000000001', 'HOSTEL-DORM8', 1, 1, 0, 16, 150000, 'active', true, now(), now()),
  -- Guest house: Oilaviy xona
  ('00000000-0000-9305-0000-000000000004', '00000000-0000-9303-0000-000000000003', '00000000-0000-9307-0000-000000000001', 'GH-FAM', 4, 4, 2, 4, 450000, 'active', true, now(), now()),
  -- Motel: Yo'l bo'yi qulay xona
  ('00000000-0000-9305-0000-000000000005', '00000000-0000-9303-0000-000000000004', '00000000-0000-9307-0000-000000000001', 'MOTEL-COMF', 2, 2, 1, 8, 300000, 'active', true, now(), now()),
  -- Dacha: Butun dacha (Basseyn, sauna, bilyard)
  ('00000000-0000-9305-0000-000000000006', '00000000-0000-9303-0000-000000000005', '00000000-0000-9307-0000-000000000002', 'DACHA-MAIN', 10, 12, 4, 1, 2500000, 'active', true, now(), now()),
  -- Restaurant: Stollar, xontaxta
  ('00000000-0000-9305-0000-000000000007', '00000000-0000-9303-0000-000000000006', '00000000-0000-9307-0000-000000000001', 'T1', 4, 6, 2, 12, 50000, 'active', true, now(), now())
ON CONFLICT (hotel_id, code) DO UPDATE
SET room_type_id = excluded.room_type_id,
    total_inventory = excluded.total_inventory,
    base_price = excluded.base_price,
    status = excluded.status,
    is_listed = excluded.is_listed,
    updated_at = now();

-- 7. HOTEL ROOM TRANSLATIONS
INSERT INTO hotel_room_translations (id, room_id, language, name, description, created_at, updated_at)
VALUES
  ('00000000-0000-9306-0000-000000000001', '00000000-0000-9305-0000-000000000001', 'uz', 'Standard xona', 'Qulay standart xona, ikki kishilik karavot bilan.', now(), now()),
  ('00000000-0000-9306-0000-000000000002', '00000000-0000-9305-0000-000000000002', 'uz', 'Deluxe xona', 'Keng va hashamatli Deluxe xona, shahar manzarasi bilan.', now(), now()),
  ('00000000-0000-9306-0000-000000000003', '00000000-0000-9305-0000-000000000003', 'uz', '8 kishilik umumiy xona', 'Yotoqxonadagi 8 kishilik umumiy xonadan 1 ta o''rin.', now(), now()),
  ('00000000-0000-9306-0000-000000000004', '00000000-0000-9305-0000-000000000004', 'uz', 'Oilaviy xona', 'Oila uchun barcha qulayliklarga ega keng xona.', now(), now()),
  ('00000000-0000-9306-0000-000000000005', '00000000-0000-9305-0000-000000000005', 'uz', 'Yo''l bo''yi qulay xona', 'Sayohat paytida hordiq chiqarish uchun qulay xona.', now(), now()),
  ('00000000-0000-9306-0000-000000000006', '00000000-0000-9305-0000-000000000006', 'uz', 'Chorvoq Tog'' Bag''rida Dacha', 'Basseyn, sauna va bilyard bilan to''liq dacha ijarasi.', now(), now()),
  ('00000000-0000-9306-0000-000000000007', '00000000-0000-9305-0000-000000000007', 'uz', 'Stollar, xontaxta', 'Milliy taomlar restorani uchun stol va xontaxta rezervatsiyasi.', now(), now())
ON CONFLICT (room_id, language) DO UPDATE
SET name = excluded.name, description = excluded.description, updated_at = now();

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
  ('00000000-0000-9309-0000-000000000002', '00000000-0000-9308-0000-000000000001', 'Chevrolet Cobalt', '01B888BB', 5, 'active', 350000, 'petrol', true, now(), now())
ON CONFLICT (id) DO UPDATE
SET company_id = excluded.company_id,
    name = excluded.name,
    plate_number = excluded.plate_number,
    seats_count = excluded.seats_count,
    status = excluded.status,
    price_per_day = excluded.price_per_day,
    updated_at = now();

COMMIT;
