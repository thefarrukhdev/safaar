begin;

insert into regions (id, name, created_at, updated_at)
values
  ('00000000-0000-1001-0000-000000000001', '{"uz":"Toshkent","ru":"Ташкент","en":"Tashkent"}', now(), now()),
  ('00000000-0000-1001-0000-000000000002', '{"uz":"Samarqand","ru":"Самарканд","en":"Samarkand"}', now(), now()),
  ('00000000-0000-1001-0000-000000000003', '{"uz":"Buxoro","ru":"Бухара","en":"Bukhara"}', now(), now()),
  ('00000000-0000-1001-0000-000000000004', '{"uz":"Xorazm","ru":"Хорезм","en":"Khorezm"}', now(), now()),
  ('00000000-0000-1001-0000-000000000005', '{"uz":"Farg''ona","ru":"Фергана","en":"Fergana"}', now(), now()),
  ('00000000-0000-1001-0000-000000000006', '{"uz":"Namangan","ru":"Наманган","en":"Namangan"}', now(), now()),
  ('00000000-0000-1001-0000-000000000007', '{"uz":"Jizzax","ru":"Джизак","en":"Jizzakh"}', now(), now()),
  ('00000000-0000-1001-0000-000000000008', '{"uz":"Qoraqalpog''iston","ru":"Каракалпакстан","en":"Karakalpakstan"}', now(), now())
on conflict (id) do update
set name = excluded.name, updated_at = now();

insert into cities (id, region_id, name, slug, image_url, sort_order, created_at, updated_at)
values
  ('00000000-0000-1002-0000-000000000001', '00000000-0000-1001-0000-000000000001', '{"uz":"Toshkent","ru":"Ташкент","en":"Tashkent"}', 'toshkent', '/images/mock/Tashkent-city-skyline.jpeg', 1, now(), now()),
  ('00000000-0000-1002-0000-000000000002', '00000000-0000-1001-0000-000000000002', '{"uz":"Samarqand","ru":"Самарканд","en":"Samarkand"}', 'samarqand', '/images/mock/Samarkand-Registan-cinematic.jpeg', 2, now(), now()),
  ('00000000-0000-1002-0000-000000000003', '00000000-0000-1001-0000-000000000003', '{"uz":"Buxoro","ru":"Бухара","en":"Bukhara"}', 'buxoro', '/images/mock/Bukhara-old-city-golden-hour.jpeg', 3, now(), now()),
  ('00000000-0000-1002-0000-000000000004', '00000000-0000-1001-0000-000000000004', '{"uz":"Xiva","ru":"Хива","en":"Khiva"}', 'xiva', '/images/mock/Khiva-Ichan-Kala-aerial.jpeg', 4, now(), now()),
  ('00000000-0000-1002-0000-000000000005', '00000000-0000-1001-0000-000000000005', '{"uz":"Farg''ona","ru":"Фергана","en":"Fergana"}', 'fargona', '/images/mock/Uzbekistan-travel.jpeg', 5, now(), now()),
  ('00000000-0000-1002-0000-000000000006', '00000000-0000-1001-0000-000000000006', '{"uz":"Namangan","ru":"Наманган","en":"Namangan"}', 'namangan', '/images/mock/Uzbekistan-travel.jpeg', 6, now(), now()),
  ('00000000-0000-1002-0000-000000000007', '00000000-0000-1001-0000-000000000001', '{"uz":"Charvak","ru":"Чарвак","en":"Charvak"}', 'charvak', '/images/mock/Charvak-Lake-drone.jpeg', 7, now(), now()),
  ('00000000-0000-1002-0000-000000000008', '00000000-0000-1001-0000-000000000001', '{"uz":"Chimgan","ru":"Чимган","en":"Chimgan"}', 'chimgan', '/images/mock/Chimgan-mountains-landscape.jpeg', 8, now(), now()),
  ('00000000-0000-1002-0000-000000000009', '00000000-0000-1001-0000-000000000007', '{"uz":"Zaamin","ru":"Заамин","en":"Zaamin"}', 'zaamin', '/images/mock/Zaamin.jpeg', 9, now(), now()),
  ('00000000-0000-1002-0000-00000000000a', '00000000-0000-1001-0000-000000000008', '{"uz":"Nukus","ru":"Нукус","en":"Nukus"}', 'nukus', '/images/mock/Uzbekistan-travel.jpeg', 10, now(), now())
on conflict (id) do update
set region_id = excluded.region_id, name = excluded.name, slug = excluded.slug, image_url = excluded.image_url, sort_order = excluded.sort_order, updated_at = now();

insert into amenities (id, code, name, created_at, updated_at)
values
  -- Internet va texnika
  ('00000000-0000-1003-0000-000000000001', 'wifi', '{"uz":"Bepul Wi-Fi","ru":"Бесплатный Wi-Fi","en":"Free Wi-Fi"}', now(), now()),
  ('00000000-0000-1003-0000-000000000021', 'wifi_public', '{"uz":"Umumiy joylarda Wi-Fi","ru":"Wi-Fi в общественных зонах","en":"Public area Wi-Fi"}', now(), now()),
  ('00000000-0000-1003-0000-000000000022', 'workspace', '{"uz":"Ish stoli","ru":"Рабочий стол","en":"Workspace"}', now(), now()),
  ('00000000-0000-1003-0000-000000000006', 'tv', '{"uz":"Televizor","ru":"Телевизор","en":"TV"}', now(), now()),
  -- Ovqat va ichimlik
  ('00000000-0000-1003-0000-000000000004', 'breakfast', '{"uz":"Nonushta","ru":"Завтрак","en":"Breakfast"}', now(), now()),
  ('00000000-0000-1003-0000-000000000023', 'restaurant', '{"uz":"Restoran","ru":"Ресторан","en":"Restaurant"}', now(), now()),
  ('00000000-0000-1003-0000-000000000024', 'bar', '{"uz":"Bar","ru":"Бар","en":"Bar"}', now(), now()),
  ('00000000-0000-1003-0000-000000000025', 'minibar', '{"uz":"Mini-bar","ru":"Мини-бар","en":"Mini-bar"}', now(), now()),
  ('00000000-0000-1003-0000-000000000026', 'room_service', '{"uz":"Xonaga xizmat (24/7)","ru":"Обслуживание в номер (24/7)","en":"Room service (24/7)"}', now(), now()),
  ('00000000-0000-1003-0000-000000000027', 'kitchen', '{"uz":"Umumiy oshxona","ru":"Общая кухня","en":"Shared kitchen"}', now(), now()),
  -- Sog'lomlashtirish
  ('00000000-0000-1003-0000-000000000002', 'pool', '{"uz":"Hovuz","ru":"Бассейн","en":"Pool"}', now(), now()),
  ('00000000-0000-1003-0000-000000000028', 'gym', '{"uz":"Fitness zal","ru":"Фитнес зал","en":"Gym"}', now(), now()),
  ('00000000-0000-1003-0000-000000000029', 'spa', '{"uz":"Spa","ru":"Спа","en":"Spa"}', now(), now()),
  ('00000000-0000-1003-0000-000000000030', 'sauna', '{"uz":"Sauna","ru":"Сауна","en":"Sauna"}', now(), now()),
  ('00000000-0000-1003-0000-000000000031', 'jacuzzi', '{"uz":"Jakuzi","ru":"Джакузи","en":"Jacuzzi"}', now(), now()),
  -- Xizmatlar
  ('00000000-0000-1003-0000-000000000010', 'reception_24', '{"uz":"24/7 resepsiyon","ru":"Ресепшн 24/7","en":"24/7 reception"}', now(), now()),
  ('00000000-0000-1003-0000-000000000011', 'concierge', '{"uz":"Konsyerj","ru":"Консьерж","en":"Concierge"}', now(), now()),
  ('00000000-0000-1003-0000-000000000012', 'laundry', '{"uz":"Kir yuvish","ru":"Прачечная","en":"Laundry"}', now(), now()),
  ('00000000-0000-1003-0000-000000000013', 'airport_shuttle', '{"uz":"Aeroport transferi","ru":"Трансфер из аэропорта","en":"Airport shuttle"}', now(), now()),
  ('00000000-0000-1003-0000-000000000014', 'car_rental', '{"uz":"Avtomobil ijarasi","ru":"Прокат автомобилей","en":"Car rental"}', now(), now()),
  ('00000000-0000-1003-0000-000000000015', 'tour_desk', '{"uz":"Ekskursiya byurosi","ru":"Туристическое бюро","en":"Tour desk"}', now(), now()),
  -- Umumiy
  ('00000000-0000-1003-0000-000000000003', 'parking', '{"uz":"Bepul parking","ru":"Бесплатная парковка","en":"Free parking"}', now(), now()),
  ('00000000-0000-1003-0000-000000000017', 'elevator', '{"uz":"Lift","ru":"Лифт","en":"Elevator"}', now(), now()),
  ('00000000-0000-1003-0000-000000000018', 'ac', '{"uz":"Konditsioner","ru":"Кондиционер","en":"Air conditioning"}', now(), now()),
  ('00000000-0000-1003-0000-000000000019', 'heating', '{"uz":"Isitish tizimi","ru":"Отопление","en":"Heating"}', now(), now()),
  ('00000000-0000-1003-0000-00000000001a', 'garden', '{"uz":"Bog''","ru":"Сад","en":"Garden"}', now(), now()),
  ('00000000-0000-1003-0000-00000000001b', 'terrace', '{"uz":"Terrasa","ru":"Терраса","en":"Terrace"}', now(), now()),
  -- Xavfsizlik va qulaylik
  ('00000000-0000-1003-0000-00000000001c', 'safe', '{"uz":"Seyf","ru":"Сейф","en":"Safe"}', now(), now()),
  ('00000000-0000-1003-0000-00000000001d', 'smoke_detector', '{"uz":"Tutun detektori","ru":"Дымовой датчик","en":"Smoke detector"}', now(), now()),
  ('00000000-0000-1003-0000-00000000001e', 'fire_extinguisher', '{"uz":"O''t o''chirgich","ru":"Огнетушитель","en":"Fire extinguisher"}', now(), now()),
  ('00000000-0000-1003-0000-00000000001f', 'wheelchair', '{"uz":"Nogironlar aravasi uchun","ru":"Для инвалидов","en":"Wheelchair accessible"}', now(), now()),
  ('00000000-0000-1003-0000-000000000020', 'family_friendly', '{"uz":"Oilaviylar uchun","ru":"Для семей","en":"Family friendly"}', now(), now())
on conflict (code) do update
set name = excluded.name, updated_at = now();

insert into room_types (id, code, name, description, image_url, bed_type, size_sqm, base_price, capacity, amenities, created_at, updated_at)
values
  ('00000000-0000-1004-0000-000000000001', 'standard', '{"uz":"Standart","ru":"Стандарт","en":"Standard"}', 'Qulay standart xona', '/images/mock/hotel-uzbekistan.jpeg', 'queen', 24, 650000, 2, '["wifi","tv","ac"]', now(), now()),
  ('00000000-0000-1004-0000-000000000002', 'deluxe', '{"uz":"Deluxe","ru":"Делюкс","en":"Deluxe"}', 'Keng deluxe xona', '/images/mock/hilton-hostel.jpeg', 'king', 32, 820000, 3, '["wifi","tv","ac","minibar"]', now(), now()),
  ('00000000-0000-1004-0000-000000000003', 'suite', '{"uz":"Suite","ru":"Люкс","en":"Suite"}', 'Premium suite xona', '/images/mock/experiment-hotel-picture.jpeg', 'king', 48, 1450000, 4, '["wifi","tv","ac","minibar","workspace"]', now(), now())
on conflict (code) do update
set name = excluded.name,
    description = excluded.description,
    image_url = excluded.image_url,
    bed_type = excluded.bed_type,
    size_sqm = excluded.size_sqm,
    base_price = excluded.base_price,
    capacity = excluded.capacity,
    amenities = excluded.amenities,
    updated_at = now();

insert into cancellation_policies (id, name, rules, refundable_until_hours, created_at, updated_at)
values (
  '00000000-0000-1005-0000-000000000001',
  '{"uz":"Moslashuvchan bekor qilish","ru":"Гибкая отмена","en":"Flexible cancellation"}',
  '[{"beforeHours":24,"penaltyPercent":0},{"beforeHours":6,"penaltyPercent":50},{"beforeHours":0,"penaltyPercent":100}]',
  24,
  now(),
  now()
)
on conflict (id) do update
set name = excluded.name, rules = excluded.rules, refundable_until_hours = excluded.refundable_until_hours, updated_at = now();

insert into users (
  id, first_name, last_name, phone, email, status, preferred_language,
  blocked_reason, phone_verified_at, last_login_at, created_at, updated_at
)
values
  ('00000000-0000-2001-0000-000000000001', 'Anvar', 'Karimov', '+998901001001', 'anvar.karimov@demo.uz', 'active', 'uz', null, now() - interval '90 days', now() - interval '2 hours', now() - interval '120 days', now()),
  ('00000000-0000-2001-0000-000000000002', 'Dilnoza', 'Rahimova', '+998901001002', 'dilnoza.rahimova@demo.uz', 'active', 'uz', null, now() - interval '80 days', now() - interval '1 day', now() - interval '118 days', now()),
  ('00000000-0000-2001-0000-000000000003', 'Bobur', 'Aliyev', '+998901001003', 'bobur.aliyev@demo.uz', 'active', 'uz', null, now() - interval '72 days', now() - interval '3 days', now() - interval '110 days', now()),
  ('00000000-0000-2001-0000-000000000004', 'Nodira', 'Xasanova', '+998901001004', 'nodira.xasanova@demo.uz', 'blocked', 'uz', 'Demo: fraud signal', now() - interval '70 days', now() - interval '12 days', now() - interval '100 days', now()),
  ('00000000-0000-2001-0000-000000000005', 'Jasur', 'Toshmatov', '+998901001005', 'jasur.toshmatov@demo.uz', 'unverified', 'uz', null, null, null, now() - interval '21 days', now()),
  ('00000000-0000-2001-0000-000000000006', 'Malika', 'Yusupova', '+998901001006', 'malika.yusupova@demo.uz', 'active', 'uz', null, now() - interval '60 days', now() - interval '6 hours', now() - interval '93 days', now()),
  ('00000000-0000-2001-0000-000000000007', 'Sardor', 'Qodirov', '+998901001007', 'sardor.qodirov@demo.uz', 'active', 'uz', null, now() - interval '55 days', now() - interval '8 days', now() - interval '85 days', now()),
  ('00000000-0000-2001-0000-000000000008', 'Zulfiya', 'Mirzayeva', '+998901001008', 'zulfiya.mirzayeva@demo.uz', 'active', 'uz', null, now() - interval '50 days', now() - interval '15 minutes', now() - interval '77 days', now())
on conflict (phone) do update
set first_name = excluded.first_name,
    last_name = excluded.last_name,
    email = excluded.email,
    status = excluded.status,
    blocked_reason = excluded.blocked_reason,
    phone_verified_at = excluded.phone_verified_at,
    last_login_at = excluded.last_login_at,
    updated_at = now();

insert into user_notification_preferences (user_id, sms, email, push, in_app, updated_at)
values
  ('00000000-0000-2001-0000-000000000001', true, true, true, true, now()),
  ('00000000-0000-2001-0000-000000000002', true, true, false, true, now()),
  ('00000000-0000-2001-0000-000000000006', true, false, true, true, now())
on conflict (user_id) do update
set sms = excluded.sms,
    email = excluded.email,
    push = excluded.push,
    in_app = excluded.in_app,
    updated_at = now();

insert into user_bonus_ledger (id, user_id, amount, reason, created_at)
values
  ('00000000-0000-2002-0000-000000000001', '00000000-0000-2001-0000-000000000001', 75000, 'Bron uchun bonus', now() - interval '4 days'),
  ('00000000-0000-2002-0000-000000000002', '00000000-0000-2001-0000-000000000002', 125000, 'Promo aksiya bonusi', now() - interval '8 days'),
  ('00000000-0000-2002-0000-000000000003', '00000000-0000-2001-0000-000000000006', 30000, 'Avtobus bron bonusi', now() - interval '1 day')
on conflict (id) do update
set amount = excluded.amount,
    reason = excluded.reason,
    created_at = excluded.created_at;

insert into admin_users (id, email, password_hash, full_name, role, status, created_at, updated_at)
values
  ('00000000-0000-1006-0000-000000000001', 'admin@safaar.uz', '$argon2id$v=19$m=65536,t=3,p=4$JY830cRTn6tOBJGtMMPuDQ$eFgy85wei//6a/ITO6qS/PCetIyqYaBQLg+q7JTXvKM', 'Demo Super Admin', 'super_admin', 'active', now(), now()),
  ('00000000-0000-1006-0000-000000000002', 'finance@safaar.uz', '$argon2id$v=19$m=65536,t=3,p=4$JY830cRTn6tOBJGtMMPuDQ$eFgy85wei//6a/ITO6qS/PCetIyqYaBQLg+q7JTXvKM', 'Demo Finance Admin', 'finance_admin', 'active', now(), now()),
  ('00000000-0000-1006-0000-000000000003', 'content@safaar.uz', '$argon2id$v=19$m=65536,t=3,p=4$JY830cRTn6tOBJGtMMPuDQ$eFgy85wei//6a/ITO6qS/PCetIyqYaBQLg+q7JTXvKM', 'Demo Content Admin', 'content_admin', 'active', now(), now())
on conflict (email) do update
set password_hash = excluded.password_hash,
    full_name = excluded.full_name,
    role = excluded.role,
    status = excluded.status,
    updated_at = now();

insert into partner_organizations (
  id, type, legal_name, brand_name, tax_id, phone, email, city_id, address,
  status, default_commission_rate, approved_by, approved_at, rejection_reason,
  created_at, updated_at
)
values
  ('00000000-0000-3001-0000-000000000001', 'hotel', 'Grand Samarkand Hotel LLC', 'Grand Samarkand Hotel', 'DEMO-HOTEL-001', '+998901112201', 'grand.samarkand@demo.uz', '00000000-0000-1002-0000-000000000002', 'Samarqand, Registon kochasi 10', 'approved', 14.00, '00000000-0000-1006-0000-000000000001', now() - interval '30 days', null, now() - interval '160 days', now()),
  ('00000000-0000-3001-0000-000000000002', 'hotel', 'Hilton Tashkent Demo LLC', 'Hilton Tashkent', 'DEMO-HOTEL-002', '+998901112202', 'hilton.tashkent@demo.uz', '00000000-0000-1002-0000-000000000001', 'Toshkent, Amir Temur shoh kochasi 7', 'approved', 16.00, '00000000-0000-1006-0000-000000000001', now() - interval '35 days', null, now() - interval '220 days', now()),
  ('00000000-0000-3001-0000-000000000003', 'hotel', 'Buxoro Palace LLC', 'Buxoro Palace', 'DEMO-HOTEL-003', '+998901112203', 'buxoro.palace@demo.uz', '00000000-0000-1002-0000-000000000003', 'Buxoro, Mustaqillik kochasi 45', 'approved', 13.00, '00000000-0000-1006-0000-000000000001', now() - interval '20 days', null, now() - interval '145 days', now()),
  ('00000000-0000-3001-0000-000000000004', 'bus', 'Comfort Bus MChJ', 'Comfort Bus', 'DEMO-BUS-001', '+998901112301', 'comfort.bus@demo.uz', '00000000-0000-1002-0000-000000000001', 'Toshkent, Navoiy kochasi 12', 'approved', 10.00, '00000000-0000-1006-0000-000000000001', now() - interval '18 days', null, now() - interval '180 days', now()),
  ('00000000-0000-3001-0000-000000000005', 'bus', 'Express Yol LLC', 'Express Yol', 'DEMO-BUS-002', '+998901112302', 'express.yol@demo.uz', '00000000-0000-1002-0000-000000000001', 'Toshkent, Beruniy kochasi 9', 'approved', 9.00, '00000000-0000-1006-0000-000000000001', now() - interval '15 days', null, now() - interval '175 days', now()),
  ('00000000-0000-3001-0000-000000000006', 'hotel', 'Buxoro Travel MChJ', 'Buxoro Travel Hotel', 'DEMO-REQ-001', '+998934567890', 'akmal@buxorotravel.uz', '00000000-0000-1002-0000-000000000003', 'Buxoro, Mustaqillik kochasi 45', 'submitted', 12.00, null, null, null, now() - interval '1 day', now()),
  ('00000000-0000-3001-0000-000000000007', 'bus', 'Namangan Express LLC', 'Namangan Express', 'DEMO-REQ-004', '+998943216587', 'xurshid@namanganexp.uz', '00000000-0000-1002-0000-000000000006', 'Namangan, Bobur kochasi 22', 'under_review', 9.00, null, null, null, now() - interval '5 days', now())
on conflict (tax_id) do update
set type = excluded.type,
    legal_name = excluded.legal_name,
    brand_name = excluded.brand_name,
    phone = excluded.phone,
    email = excluded.email,
    city_id = excluded.city_id,
    address = excluded.address,
    status = excluded.status,
    default_commission_rate = excluded.default_commission_rate,
    approved_by = excluded.approved_by,
    approved_at = excluded.approved_at,
    rejection_reason = excluded.rejection_reason,
    updated_at = now();

insert into partner_users (id, organization_id, email, password_hash, full_name, status, created_at, updated_at)
values
  ('00000000-0000-3002-0000-000000000001', '00000000-0000-3001-0000-000000000001', 'grand.samarkand@demo.uz', '$argon2id$v=19$m=65536,t=3,p=4$JY830cRTn6tOBJGtMMPuDQ$eFgy85wei//6a/ITO6qS/PCetIyqYaBQLg+q7JTXvKM', 'Grand Samarkand manager', 'active', now() - interval '160 days', now()),
  ('00000000-0000-3002-0000-000000000002', '00000000-0000-3001-0000-000000000002', 'hilton.tashkent@demo.uz', '$argon2id$v=19$m=65536,t=3,p=4$JY830cRTn6tOBJGtMMPuDQ$eFgy85wei//6a/ITO6qS/PCetIyqYaBQLg+q7JTXvKM', 'Hilton Tashkent manager', 'active', now() - interval '220 days', now()),
  ('00000000-0000-3002-0000-000000000003', '00000000-0000-3001-0000-000000000004', 'comfort.bus@demo.uz', '$argon2id$v=19$m=65536,t=3,p=4$JY830cRTn6tOBJGtMMPuDQ$eFgy85wei//6a/ITO6qS/PCetIyqYaBQLg+q7JTXvKM', 'Comfort Bus manager', 'active', now() - interval '180 days', now())
on conflict (organization_id, email) do update
set password_hash = excluded.password_hash,
    full_name = excluded.full_name,
    status = excluded.status,
    updated_at = now();

update partner_organizations
set logo_url = case tax_id
    when 'DEMO-HOTEL-001' then '/images/mock/hotel-uzbekistan.jpeg'
    when 'DEMO-HOTEL-002' then '/images/mock/hilton-hostel.jpeg'
    when 'DEMO-HOTEL-003' then '/images/mock/Bukhara-old-city-golden-hour.jpeg'
    when 'DEMO-BUS-001' then '/images/mock/Uzbekistan-travel.jpeg'
    when 'DEMO-BUS-002' then '/images/mock/Tashkent-city-skyline.jpeg'
    else logo_url
  end,
  showcase = tax_id in ('DEMO-HOTEL-001', 'DEMO-HOTEL-002', 'DEMO-HOTEL-003', 'DEMO-BUS-001', 'DEMO-BUS-002'),
  updated_at = now()
where tax_id like 'DEMO-%';

insert into hotels (
  id, partner_organization_id, slug, city_id, address, latitude, longitude,
  stars, rating_average, reviews_count, status, check_in_time, check_out_time,
  cancellation_policy_id, created_at, updated_at
)
values
  ('00000000-0000-4001-0000-000000000001', '00000000-0000-3001-0000-000000000001', 'grand-samarkand-hotel', '00000000-0000-1002-0000-000000000002', 'Samarqand, Registon kochasi 10', 39.6542, 66.9597, 5, 4.70, 128, 'published', '14:00', '12:00', '00000000-0000-1005-0000-000000000001', now() - interval '150 days', now()),
  ('00000000-0000-4001-0000-000000000002', '00000000-0000-3001-0000-000000000002', 'hilton-tashkent', '00000000-0000-1002-0000-000000000001', 'Toshkent, Amir Temur shoh kochasi 7', 41.3111, 69.2797, 5, 4.90, 214, 'published', '14:00', '12:00', '00000000-0000-1005-0000-000000000001', now() - interval '210 days', now()),
  ('00000000-0000-4001-0000-000000000003', '00000000-0000-3001-0000-000000000003', 'buxoro-palace', '00000000-0000-1002-0000-000000000003', 'Buxoro, Mustaqillik kochasi 45', 39.7747, 64.4286, 4, 4.50, 89, 'published', '14:00', '12:00', '00000000-0000-1005-0000-000000000001', now() - interval '140 days', now())
on conflict (slug) do update
set partner_organization_id = excluded.partner_organization_id,
    city_id = excluded.city_id,
    address = excluded.address,
    latitude = excluded.latitude,
    longitude = excluded.longitude,
    stars = excluded.stars,
    rating_average = excluded.rating_average,
    reviews_count = excluded.reviews_count,
    status = excluded.status,
    updated_at = now();

update hotels
set featured = true,
    nearby_places = case slug
      when 'grand-samarkand-hotel' then '[{"name":"Registon maydoni","distance":"550 m"},{"name":"Siyob bozori","distance":"1.4 km"},{"name":"Bibixonim masjidi","distance":"1.1 km"}]'::jsonb
      when 'hilton-tashkent' then '[{"name":"Amir Temur xiyoboni","distance":"850 m"},{"name":"Mustaqillik maydoni","distance":"1.8 km"},{"name":"Toshkent City","distance":"2.6 km"}]'::jsonb
      when 'buxoro-palace' then '[{"name":"Lyabi Hovuz","distance":"700 m"},{"name":"Ark qalasi","distance":"1.3 km"},{"name":"Kalon minorasi","distance":"1 km"}]'::jsonb
      else nearby_places
    end,
    updated_at = now()
where slug in ('grand-samarkand-hotel', 'hilton-tashkent', 'buxoro-palace');

insert into hotel_translations (id, hotel_id, language, name, description, created_at, updated_at)
values
  ('00000000-0000-4002-0000-000000000001', '00000000-0000-4001-0000-000000000001', 'uz', 'Grand Samarkand Hotel', 'Registon yaqinidagi 5 yulduzli demo mehmonxona.', now(), now()),
  ('00000000-0000-4002-0000-000000000002', '00000000-0000-4001-0000-000000000002', 'uz', 'Hilton Tashkent', 'Toshkent markazidagi premium demo mehmonxona.', now(), now()),
  ('00000000-0000-4002-0000-000000000003', '00000000-0000-4001-0000-000000000003', 'uz', 'Buxoro Palace', 'Buxoro markazidagi oilaviy demo mehmonxona.', now(), now())
on conflict (hotel_id, language) do update
set name = excluded.name, description = excluded.description, updated_at = now();

insert into media_files (
  id, owner_type, owner_id, bucket, object_key, url, mime_type, size,
  visibility, caption, category, sort_order, is_cover, created_at, deleted_at
)
values
  ('00000000-0000-4006-0000-000000000001', 'hotel', '00000000-0000-4001-0000-000000000001', 'public', 'demo/hotels/grand-samarkand-cover.jpeg', '/images/mock/hotel-uzbekistan.jpeg', 'image/jpeg', 180000, 'public', 'Grand Samarkand cover', 'gallery', 1, true, now(), null),
  ('00000000-0000-4006-0000-000000000002', 'hotel', '00000000-0000-4001-0000-000000000001', 'public', 'demo/hotels/grand-samarkand-gallery.jpeg', '/images/mock/Samarkand-Registan-cinematic.jpeg', 'image/jpeg', 180000, 'public', 'Grand Samarkand gallery', 'gallery', 2, false, now(), null),
  ('00000000-0000-4006-0000-000000000003', 'hotel', '00000000-0000-4001-0000-000000000002', 'public', 'demo/hotels/hilton-tashkent-cover.jpeg', '/images/mock/hilton-hostel.jpeg', 'image/jpeg', 180000, 'public', 'Hilton Tashkent cover', 'gallery', 1, true, now(), null),
  ('00000000-0000-4006-0000-000000000004', 'hotel', '00000000-0000-4001-0000-000000000002', 'public', 'demo/hotels/hilton-tashkent-gallery.jpeg', '/images/mock/Tashkent-skyline-night.jpeg', 'image/jpeg', 180000, 'public', 'Hilton Tashkent gallery', 'gallery', 2, false, now(), null),
  ('00000000-0000-4006-0000-000000000005', 'hotel', '00000000-0000-4001-0000-000000000003', 'public', 'demo/hotels/buxoro-palace-cover.jpeg', '/images/mock/Bukhara-old-city-golden-hour.jpeg', 'image/jpeg', 180000, 'public', 'Buxoro Palace cover', 'gallery', 1, true, now(), null),
  ('00000000-0000-4006-0000-000000000006', 'hotel', '00000000-0000-4001-0000-000000000003', 'public', 'demo/hotels/buxoro-palace-gallery.jpeg', '/images/mock/registan-back-tour.jpg', 'image/jpeg', 180000, 'public', 'Buxoro Palace gallery', 'gallery', 2, false, now(), null)
on conflict (id) do update
set owner_type = excluded.owner_type,
    owner_id = excluded.owner_id,
    bucket = excluded.bucket,
    object_key = excluded.object_key,
    url = excluded.url,
    mime_type = excluded.mime_type,
    size = excluded.size,
    visibility = excluded.visibility,
    caption = excluded.caption,
    category = excluded.category,
    sort_order = excluded.sort_order,
    is_cover = excluded.is_cover,
    deleted_at = null;

insert into hotel_amenities (hotel_id, amenity_id)
select hotel_id, amenity_id
from (values
  -- hotel 1: wifi + pool + breakfast
  ('00000000-0000-4001-0000-000000000001'::uuid, '00000000-0000-1003-0000-000000000001'::uuid),
  ('00000000-0000-4001-0000-000000000001'::uuid, '00000000-0000-1003-0000-000000000002'::uuid),
  ('00000000-0000-4001-0000-000000000001'::uuid, '00000000-0000-1003-0000-000000000004'::uuid),
  -- hotel 2: wifi + parking
  ('00000000-0000-4001-0000-000000000002'::uuid, '00000000-0000-1003-0000-000000000001'::uuid),
  ('00000000-0000-4001-0000-000000000002'::uuid, '00000000-0000-1003-0000-000000000003'::uuid),
  -- hotel 3: wifi + breakfast
  ('00000000-0000-4001-0000-000000000003'::uuid, '00000000-0000-1003-0000-000000000001'::uuid),
  ('00000000-0000-4001-0000-000000000003'::uuid, '00000000-0000-1003-0000-000000000004'::uuid)
) as links(hotel_id, amenity_id)
on conflict (hotel_id, amenity_id) do nothing;

insert into hotel_rooms (
  id, hotel_id, room_type_id, code, floor, base_occupancy, max_adults, max_children,
  total_inventory, base_price, status, housekeeping_status, is_listed, created_at, updated_at
)
values
  ('00000000-0000-4003-0000-000000000001', '00000000-0000-4001-0000-000000000001', '00000000-0000-1004-0000-000000000001', 'STD-1', 1, 2, 2, 1, 12, 650000, 'active', 'VACANT_CLEAN', true, now(), now()),
  ('00000000-0000-4003-0000-000000000002', '00000000-0000-4001-0000-000000000001', '00000000-0000-1004-0000-000000000002', 'DLX-1', 2, 2, 3, 1, 8, 820000, 'active', 'VACANT_CLEAN', true, now(), now()),
  ('00000000-0000-4003-0000-000000000003', '00000000-0000-4001-0000-000000000002', '00000000-0000-1004-0000-000000000001', 'STD-2', 3, 2, 2, 1, 15, 980000, 'active', 'VACANT_DIRTY', true, now(), now()),
  ('00000000-0000-4003-0000-000000000004', '00000000-0000-4001-0000-000000000002', '00000000-0000-1004-0000-000000000003', 'STE-2', 5, 2, 4, 2, 5, 1450000, 'active', 'OCCUPIED_CLEAN', true, now(), now()),
  ('00000000-0000-4003-0000-000000000005', '00000000-0000-4001-0000-000000000003', '00000000-0000-1004-0000-000000000001', 'STD-3', 1, 2, 2, 1, 10, 520000, 'active', 'VACANT_CLEAN', true, now(), now()),
  ('00000000-0000-4003-0000-000000000006', '00000000-0000-4001-0000-000000000003', '00000000-0000-1004-0000-000000000002', 'DLX-3', 2, 2, 3, 1, 6, 710000, 'active', 'OUT_OF_SERVICE', false, now(), now())
on conflict (hotel_id, code) do update
set room_type_id = excluded.room_type_id,
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

insert into hotel_room_translations (id, room_id, language, name, description, created_at, updated_at)
values
  ('00000000-0000-4004-0000-000000000001', '00000000-0000-4003-0000-000000000001', 'uz', 'Standart', 'Qulay standart xona.', now(), now()),
  ('00000000-0000-4004-0000-000000000002', '00000000-0000-4003-0000-000000000002', 'uz', 'Deluxe', 'Keng deluxe xona.', now(), now()),
  ('00000000-0000-4004-0000-000000000003', '00000000-0000-4003-0000-000000000003', 'uz', 'Standart', 'Toshkentdagi standart xona.', now(), now()),
  ('00000000-0000-4004-0000-000000000004', '00000000-0000-4003-0000-000000000004', 'uz', 'Suite', 'Premium suite xona.', now(), now()),
  ('00000000-0000-4004-0000-000000000005', '00000000-0000-4003-0000-000000000005', 'uz', 'Standart', 'Buxoro standart xona.', now(), now()),
  ('00000000-0000-4004-0000-000000000006', '00000000-0000-4003-0000-000000000006', 'uz', 'Deluxe', 'Buxoro deluxe xona.', now(), now())
on conflict (room_id, language) do update
set name = excluded.name, description = excluded.description, updated_at = now();

insert into room_beds (id, room_id, label, status, is_listed, nightly_price, created_at, updated_at)
values
  ('00000000-0000-4007-0000-000000000001', '00000000-0000-4003-0000-000000000001', '101-A', 'VACANT_CLEAN', true, 650000, now(), now()),
  ('00000000-0000-4007-0000-000000000002', '00000000-0000-4003-0000-000000000001', '101-B', 'VACANT_CLEAN', true, 650000, now(), now()),
  ('00000000-0000-4007-0000-000000000003', '00000000-0000-4003-0000-000000000002', '201-A', 'RESERVED', true, 820000, now(), now()),
  ('00000000-0000-4007-0000-000000000004', '00000000-0000-4003-0000-000000000002', '201-B', 'VACANT_CLEAN', true, 820000, now(), now()),
  ('00000000-0000-4007-0000-000000000005', '00000000-0000-4003-0000-000000000003', '301-A', 'VACANT_DIRTY', true, 980000, now(), now()),
  ('00000000-0000-4007-0000-000000000006', '00000000-0000-4003-0000-000000000003', '301-B', 'VACANT_CLEAN', true, 980000, now(), now()),
  ('00000000-0000-4007-0000-000000000007', '00000000-0000-4003-0000-000000000004', '501-A', 'OCCUPIED_CLEAN', true, 1450000, now(), now()),
  ('00000000-0000-4007-0000-000000000008', '00000000-0000-4003-0000-000000000005', '102-A', 'VACANT_CLEAN', true, 520000, now(), now()),
  ('00000000-0000-4007-0000-000000000009', '00000000-0000-4003-0000-000000000006', '202-A', 'OUT_OF_SERVICE', false, 710000, now(), now())
on conflict (room_id, label) do update
set status = excluded.status,
    is_listed = excluded.is_listed,
    nightly_price = excluded.nightly_price,
    updated_at = now();

delete from room_inventory
where id::text like '00000000-0000-4005-0000-%';

insert into room_inventory (id, room_id, date, total_count, held_count, booked_count, closed, version)
select
  ('00000000-0000-4005-0000-' || lpad(((room_no * 100) + day_no)::text, 12, '0'))::uuid,
  room_id,
  current_date + day_no,
  total_count,
  0,
  day_no % 4,
  false,
  1
from (values
  (1, '00000000-0000-4003-0000-000000000001'::uuid, 12),
  (2, '00000000-0000-4003-0000-000000000002'::uuid, 8),
  (3, '00000000-0000-4003-0000-000000000003'::uuid, 15),
  (4, '00000000-0000-4003-0000-000000000004'::uuid, 5),
  (5, '00000000-0000-4003-0000-000000000005'::uuid, 10),
  (6, '00000000-0000-4003-0000-000000000006'::uuid, 6)
) as rooms(room_no, room_id, total_count)
cross join generate_series(0, 13) as day_no
on conflict (room_id, date) do update
set total_count = excluded.total_count,
    booked_count = excluded.booked_count,
    closed = excluded.closed,
    version = room_inventory.version + 1;

insert into bus_companies (id, partner_organization_id, name, status, rating_average, reviews_count, created_at, updated_at)
values
  ('00000000-0000-5001-0000-000000000001', '00000000-0000-3001-0000-000000000004', 'Comfort Bus', 'active', 4.20, 93, now() - interval '180 days', now()),
  ('00000000-0000-5001-0000-000000000002', '00000000-0000-3001-0000-000000000005', 'Express Yol', 'active', 4.00, 76, now() - interval '175 days', now())
on conflict (id) do update
set partner_organization_id = excluded.partner_organization_id,
    name = excluded.name,
    status = excluded.status,
    rating_average = excluded.rating_average,
    reviews_count = excluded.reviews_count,
    updated_at = now();

insert into vehicles (id, company_id, name, plate_number, seats_count, seat_layout, status, created_at, updated_at)
values
  ('00000000-0000-5003-0000-000000000001', '00000000-0000-5001-0000-000000000001', 'Comfort Bus Yutong ZK6122', '01 A 220 AA', 40, '{"rows":10,"columns":4,"aisleAfter":2}', 'active', now(), now()),
  ('00000000-0000-5003-0000-000000000002', '00000000-0000-5001-0000-000000000002', 'Express Yol King Long', '01 A 221 AA', 40, '{"rows":10,"columns":4,"aisleAfter":2}', 'active', now(), now())
on conflict (id) do update
set company_id = excluded.company_id,
    name = excluded.name,
    plate_number = excluded.plate_number,
    seats_count = excluded.seats_count,
    seat_layout = excluded.seat_layout,
    status = excluded.status,
    updated_at = now();

insert into routes (id, from_city_id, to_city_id, duration_minutes, created_at, updated_at)
values
  ('00000000-0000-5002-0000-000000000001', '00000000-0000-1002-0000-000000000001', '00000000-0000-1002-0000-000000000002', 250, now(), now()),
  ('00000000-0000-5002-0000-000000000002', '00000000-0000-1002-0000-000000000001', '00000000-0000-1002-0000-000000000003', 430, now(), now()),
  ('00000000-0000-5002-0000-000000000003', '00000000-0000-1002-0000-000000000002', '00000000-0000-1002-0000-000000000003', 260, now(), now())
on conflict (id) do update
set from_city_id = excluded.from_city_id,
    to_city_id = excluded.to_city_id,
    duration_minutes = excluded.duration_minutes,
    updated_at = now();

insert into trips (
  id, route_id, company_id, vehicle_id, from_city_id, to_city_id,
  departure_at, arrival_at, status, base_price, policy_snapshot, created_at, updated_at
)
values
  ('00000000-0000-5004-0000-000000000001', '00000000-0000-5002-0000-000000000001', '00000000-0000-5001-0000-000000000001', '00000000-0000-5003-0000-000000000001', '00000000-0000-1002-0000-000000000001', '00000000-0000-1002-0000-000000000002', now() + interval '1 day', now() + interval '1 day 4 hours', 'scheduled', 95000, '{"route":"Toshkent - Samarqand","baggage":"20kg included"}', now(), now()),
  ('00000000-0000-5004-0000-000000000002', '00000000-0000-5002-0000-000000000002', '00000000-0000-5001-0000-000000000002', '00000000-0000-5003-0000-000000000002', '00000000-0000-1002-0000-000000000001', '00000000-0000-1002-0000-000000000003', now() + interval '2 days', now() + interval '2 days 7 hours', 'scheduled', 145000, '{"route":"Toshkent - Buxoro","baggage":"20kg included"}', now(), now()),
  ('00000000-0000-5004-0000-000000000003', '00000000-0000-5002-0000-000000000003', '00000000-0000-5001-0000-000000000001', '00000000-0000-5003-0000-000000000001', '00000000-0000-1002-0000-000000000002', '00000000-0000-1002-0000-000000000003', now() - interval '2 days', now() - interval '2 days' + interval '4 hours', 'completed', 85000, '{"route":"Samarqand - Buxoro","baggage":"20kg included"}', now() - interval '20 days', now())
on conflict (id) do update
set route_id = excluded.route_id,
    company_id = excluded.company_id,
    vehicle_id = excluded.vehicle_id,
    departure_at = excluded.departure_at,
    arrival_at = excluded.arrival_at,
    status = excluded.status,
    base_price = excluded.base_price,
    policy_snapshot = excluded.policy_snapshot,
    updated_at = now();

insert into trip_seats (id, trip_id, seat_code, seat_class, price, status, held_by_booking_id, held_until)
select
  ('00000000-0000-5005-0000-' || lpad(((trip_no * 100) + seat_no)::text, 12, '0'))::uuid,
  trip_id,
  seat_no::text,
  'standard',
  price,
  (case when seat_no in (5, 10) then 'booked' else 'available' end)::"TripSeatStatus",
  null,
  null
from (values
  (1, '00000000-0000-5004-0000-000000000001'::uuid, 95000),
  (2, '00000000-0000-5004-0000-000000000002'::uuid, 145000),
  (3, '00000000-0000-5004-0000-000000000003'::uuid, 85000)
) as trips(trip_no, trip_id, price)
cross join generate_series(1, 12) as seat_no
on conflict (trip_id, seat_code) do update
set price = excluded.price,
    status = excluded.status,
    held_by_booking_id = null,
    held_until = null;

insert into bookings (
  id, booking_number, user_id, partner_organization_id, type, confirmation_mode,
  payment_method, status, currency, subtotal, discount_amount, bonus_amount,
  service_fee, total_amount, commission_amount, partner_payable, hotel_id, trip_id,
  partner_confirmation_deadline, expires_at, confirmed_at, cancelled_at,
  cancel_reason_text, policy_snapshot, price_snapshot, created_at, updated_at
)
values
  ('00000000-0000-6001-0000-000000000001', 'B-4501', '00000000-0000-2001-0000-000000000001', '00000000-0000-3001-0000-000000000001', 'hotel', 'instant_confirmation', 'click', 'confirmed', 'UZS', 650000, 0, 0, 0, 650000, 91000, 559000, '00000000-0000-4001-0000-000000000001', null, now() + interval '1 day', null, now() - interval '4 days', null, null, '{"cancellationPolicy":"flexible"}', '{"hotelName":"Grand Samarkand Hotel","roomType":"Standart","checkIn":"2026-07-01","checkOut":"2026-07-03","nights":2,"guests":2}', now() - interval '5 days', now()),
  ('00000000-0000-6001-0000-000000000002', 'B-4502', '00000000-0000-2001-0000-000000000002', '00000000-0000-3001-0000-000000000002', 'hotel', 'instant_confirmation', 'payme', 'completed', 'UZS', 1450000, 0, 0, 0, 1450000, 232000, 1218000, '00000000-0000-4001-0000-000000000002', null, now() + interval '1 day', null, now() - interval '10 days', null, null, '{"cancellationPolicy":"flexible"}', '{"hotelName":"Hilton Tashkent","roomType":"Suite","checkIn":"2026-06-20","checkOut":"2026-06-23","nights":3,"guests":2}', now() - interval '12 days', now()),
  ('00000000-0000-6001-0000-000000000003', 'B-4503', '00000000-0000-2001-0000-000000000003', '00000000-0000-3001-0000-000000000003', 'hotel', 'instant_confirmation', 'uzcard', 'cancelled', 'UZS', 520000, 0, 0, 0, 520000, 67600, 452400, '00000000-0000-4001-0000-000000000003', null, now() + interval '1 day', null, null, now() - interval '1 day', 'Demo: mijoz bekor qildi', '{"cancellationPolicy":"flexible"}', '{"hotelName":"Buxoro Palace","roomType":"Standart","checkIn":"2026-07-05","checkOut":"2026-07-06","nights":1,"guests":1}', now() - interval '3 days', now()),
  ('00000000-0000-6001-0000-000000000004', 'BB-3001', '00000000-0000-2001-0000-000000000006', '00000000-0000-3001-0000-000000000004', 'bus', 'instant_confirmation', 'humo', 'confirmed', 'UZS', 95000, 0, 0, 0, 95000, 9500, 85500, null, '00000000-0000-5004-0000-000000000001', now() + interval '1 day', null, now() - interval '1 day', null, null, '{"cancellationPolicy":"route policy"}', '{"companyName":"Comfort Bus","route":"Toshkent - Samarqand","seatNumber":"5"}', now() - interval '1 day', now()),
  ('00000000-0000-6001-0000-000000000005', 'BB-3002', '00000000-0000-2001-0000-000000000007', '00000000-0000-3001-0000-000000000005', 'bus', 'instant_confirmation', 'click', 'completed', 'UZS', 145000, 0, 0, 0, 145000, 14500, 130500, null, '00000000-0000-5004-0000-000000000002', now() + interval '1 day', null, now() - interval '7 days', null, null, '{"cancellationPolicy":"route policy"}', '{"companyName":"Express Yol","route":"Toshkent - Buxoro","seatNumber":"10"}', now() - interval '8 days', now()),
  ('00000000-0000-6001-0000-000000000006', 'B-4504', '00000000-0000-2001-0000-000000000008', '00000000-0000-3001-0000-000000000001', 'hotel', 'instant_confirmation', 'payme', 'awaiting_payment', 'UZS', 820000, 0, 0, 0, 820000, 114800, 705200, '00000000-0000-4001-0000-000000000001', null, now() + interval '1 day', now() + interval '2 hours', null, null, null, '{"cancellationPolicy":"flexible"}', '{"hotelName":"Grand Samarkand Hotel","roomType":"Deluxe","checkIn":"2026-07-10","checkOut":"2026-07-12","nights":2,"guests":2}', now() - interval '2 hours', now())
on conflict (booking_number) do update
set user_id = excluded.user_id,
    partner_organization_id = excluded.partner_organization_id,
    type = excluded.type,
    payment_method = excluded.payment_method,
    status = excluded.status,
    subtotal = excluded.subtotal,
    total_amount = excluded.total_amount,
    commission_amount = excluded.commission_amount,
    partner_payable = excluded.partner_payable,
    hotel_id = excluded.hotel_id,
    trip_id = excluded.trip_id,
    confirmed_at = excluded.confirmed_at,
    cancelled_at = excluded.cancelled_at,
    cancel_reason_text = excluded.cancel_reason_text,
    price_snapshot = excluded.price_snapshot,
    updated_at = now();

insert into booking_status_history (id, booking_id, status, action, actor_type, actor_id, metadata, created_at)
values
  ('00000000-0000-6002-0000-000000000001', '00000000-0000-6001-0000-000000000001', 'pending', 'created', 'system', '00000000-0000-1006-0000-000000000001', '{"bookingNumber":"B-4501"}', now() - interval '5 days'),
  ('00000000-0000-6002-0000-000000000002', '00000000-0000-6001-0000-000000000001', 'confirmed', 'status_changed', 'system', '00000000-0000-1006-0000-000000000001', '{"bookingNumber":"B-4501"}', now() - interval '4 days'),
  ('00000000-0000-6002-0000-000000000003', '00000000-0000-6001-0000-000000000003', 'cancelled', 'status_changed', 'user', '00000000-0000-2001-0000-000000000003', '{"reason":"customer_cancelled"}', now() - interval '1 day'),
  ('00000000-0000-6002-0000-000000000004', '00000000-0000-6001-0000-000000000004', 'confirmed', 'status_changed', 'system', '00000000-0000-1006-0000-000000000001', '{"bookingNumber":"BB-3001"}', now() - interval '1 day')
on conflict (id) do update
set status = excluded.status,
    action = excluded.action,
    metadata = excluded.metadata,
    created_at = excluded.created_at;

insert into payments (
  id, booking_id, provider, status, amount, currency, payment_url,
  provider_reference, idempotency_key, created_at, updated_at
)
values
  ('00000000-0000-6003-0000-000000000001', '00000000-0000-6001-0000-000000000001', 'click', 'paid', 650000, 'UZS', 'https://pay.demo.uz/B-4501', 'TXN-B-4501', 'admin-seed-payment-B-4501', now() - interval '5 days', now()),
  ('00000000-0000-6003-0000-000000000002', '00000000-0000-6001-0000-000000000002', 'payme', 'paid', 1450000, 'UZS', 'https://pay.demo.uz/B-4502', 'TXN-B-4502', 'admin-seed-payment-B-4502', now() - interval '12 days', now()),
  ('00000000-0000-6003-0000-000000000003', '00000000-0000-6001-0000-000000000003', 'uzcard', 'refunded', 520000, 'UZS', 'https://pay.demo.uz/B-4503', 'TXN-B-4503', 'admin-seed-payment-B-4503', now() - interval '3 days', now()),
  ('00000000-0000-6003-0000-000000000004', '00000000-0000-6001-0000-000000000004', 'humo', 'paid', 95000, 'UZS', 'https://pay.demo.uz/BB-3001', 'TXN-BB-3001', 'admin-seed-payment-BB-3001', now() - interval '1 day', now()),
  ('00000000-0000-6003-0000-000000000005', '00000000-0000-6001-0000-000000000006', 'payme', 'pending', 820000, 'UZS', 'https://pay.demo.uz/B-4504', 'TXN-B-4504', 'admin-seed-payment-B-4504', now() - interval '2 hours', now())
on conflict (idempotency_key) do update
set booking_id = excluded.booking_id,
    provider = excluded.provider,
    status = excluded.status,
    amount = excluded.amount,
    provider_reference = excluded.provider_reference,
    updated_at = now();

insert into refunds (id, booking_id, user_id, status, requested_amount, approved_amount, currency, reason, created_at, updated_at)
values
  ('00000000-0000-6005-0000-000000000001', '00000000-0000-6001-0000-000000000003', '00000000-0000-2001-0000-000000000003', 'approved', 520000, 468000, 'UZS', 'Demo cancelled booking refund', now() - interval '1 day', now())
on conflict (id) do update
set status = excluded.status,
    requested_amount = excluded.requested_amount,
    approved_amount = excluded.approved_amount,
    reason = excluded.reason,
    updated_at = now();

insert into partner_ledger_entries (id, organization_id, booking_id, type, amount, currency, created_at)
values
  ('00000000-0000-6004-0000-000000000001', '00000000-0000-3001-0000-000000000001', '00000000-0000-6001-0000-000000000001', 'booking_payable', 559000, 'UZS', now() - interval '5 days'),
  ('00000000-0000-6004-0000-000000000002', '00000000-0000-3001-0000-000000000002', '00000000-0000-6001-0000-000000000002', 'booking_payable', 1218000, 'UZS', now() - interval '12 days'),
  ('00000000-0000-6004-0000-000000000003', '00000000-0000-3001-0000-000000000004', '00000000-0000-6001-0000-000000000004', 'booking_payable', 85500, 'UZS', now() - interval '1 day')
on conflict (id) do update
set organization_id = excluded.organization_id,
    booking_id = excluded.booking_id,
    amount = excluded.amount,
    created_at = excluded.created_at;

insert into withdrawal_requests (id, organization_id, amount, currency, status, created_at, updated_at)
values
  ('00000000-0000-7002-0000-000000000001', '00000000-0000-3001-0000-000000000001', 12500000, 'UZS', 'requested', now() - interval '2 days', now()),
  ('00000000-0000-7002-0000-000000000002', '00000000-0000-3001-0000-000000000003', 8400000, 'UZS', 'approved', now() - interval '5 days', now()),
  ('00000000-0000-7002-0000-000000000003', '00000000-0000-3001-0000-000000000004', 4200000, 'UZS', 'rejected', now() - interval '1 day', now())
on conflict (id) do update
set organization_id = excluded.organization_id,
    amount = excluded.amount,
    status = excluded.status,
    updated_at = now();

insert into favorites (id, user_id, target_type, target_id, created_at)
values
  ('00000000-0000-7008-0000-000000000001', '00000000-0000-2001-0000-000000000001', 'hotel', '00000000-0000-4001-0000-000000000001', now() - interval '6 days'),
  ('00000000-0000-7008-0000-000000000002', '00000000-0000-2001-0000-000000000001', 'hotel', '00000000-0000-4001-0000-000000000002', now() - interval '2 days'),
  ('00000000-0000-7008-0000-000000000003', '00000000-0000-2001-0000-000000000002', 'hotel', '00000000-0000-4001-0000-000000000003', now() - interval '9 days')
on conflict (user_id, target_type, target_id) do update
set created_at = excluded.created_at;

insert into reviews (id, user_id, booking_id, target_type, target_id, rating, body, status, created_at, updated_at)
values
  ('00000000-0000-7001-0000-000000000001', '00000000-0000-2001-0000-000000000001', '00000000-0000-6001-0000-000000000001', 'hotel', '00000000-0000-4001-0000-000000000001', 5, 'Joylashuv juda qulay.', 'published', now() - interval '4 days', now()),
  ('00000000-0000-7001-0000-000000000002', '00000000-0000-2001-0000-000000000002', '00000000-0000-6001-0000-000000000002', 'hotel', '00000000-0000-4001-0000-000000000002', 5, 'Xizmat darajasi yuqori.', 'published', now() - interval '8 days', now()),
  ('00000000-0000-7001-0000-000000000003', '00000000-0000-2001-0000-000000000006', '00000000-0000-6001-0000-000000000004', 'bus_company', '00000000-0000-5001-0000-000000000001', 4, 'Avtobus toza va vaqtida keldi.', 'published', now() - interval '1 day', now())
on conflict (id) do update
set rating = excluded.rating,
    body = excluded.body,
    status = excluded.status,
    updated_at = now();

insert into support_tickets (id, user_id, actor_type, actor_id, subject, priority, status, created_at, updated_at)
values
  ('00000000-0000-7003-0000-000000000001', '00000000-0000-2001-0000-000000000001', 'user', '00000000-0000-2001-0000-000000000001', 'Tolov otmadi', 'high', 'open', now() - interval '2 hours', now()),
  ('00000000-0000-7003-0000-000000000002', '00000000-0000-2001-0000-000000000002', 'user', '00000000-0000-2001-0000-000000000002', 'Bronni bekor qilish', 'low', 'closed', now() - interval '3 days', now()),
  ('00000000-0000-7003-0000-000000000003', '00000000-0000-2001-0000-000000000003', 'user', '00000000-0000-2001-0000-000000000003', 'Xona malumoti mos kelmadi', 'medium', 'in_progress', now() - interval '1 day', now()),
  ('00000000-0000-7003-0000-000000000004', null, 'partner', '00000000-0000-3001-0000-000000000001', 'Xona inventari bo''yicha savol', 'medium', 'open', now() - interval '3 hours', now())
on conflict (id) do update
set user_id = excluded.user_id,
    actor_type = excluded.actor_type,
    actor_id = excluded.actor_id,
    subject = excluded.subject,
    priority = excluded.priority,
    status = excluded.status,
    updated_at = now();

insert into support_messages (id, ticket_id, sender_type, sender_id, body, created_at)
values
  ('00000000-0000-7004-0000-000000000001', '00000000-0000-7003-0000-000000000001', 'user', '00000000-0000-2001-0000-000000000001', 'Payme orqali tolov qildim, lekin bron tasdiqlanmadi.', now() - interval '2 hours'),
  ('00000000-0000-7004-0000-000000000002', '00000000-0000-7003-0000-000000000001', 'admin', '00000000-0000-1006-0000-000000000001', 'Chekni tekshiryapmiz, tez orada javob beramiz.', now() - interval '90 minutes'),
  ('00000000-0000-7004-0000-000000000003', '00000000-0000-7003-0000-000000000002', 'user', '00000000-0000-2001-0000-000000000002', 'Bronni bekor qilmoqchiman.', now() - interval '3 days'),
  ('00000000-0000-7004-0000-000000000004', '00000000-0000-7003-0000-000000000002', 'admin', '00000000-0000-1006-0000-000000000001', 'Bron bekor qilindi.', now() - interval '2 days'),
  ('00000000-0000-7004-0000-000000000005', '00000000-0000-7003-0000-000000000004', 'partner', '00000000-0000-3002-0000-000000000001', 'Deluxe xonadagi 201-A yotoq statusini tekshirishingizni so''raymiz.', now() - interval '3 hours'),
  ('00000000-0000-7004-0000-000000000006', '00000000-0000-7003-0000-000000000004', 'admin', '00000000-0000-1006-0000-000000000001', 'So''rovingiz qabul qilindi, inventory jurnali tekshirilyapti.', now() - interval '2 hours')
on conflict (id) do update
set sender_type = excluded.sender_type,
    body = excluded.body,
    created_at = excluded.created_at;

insert into cms_entries (id, type, slug, title, body, status, metadata, published_at, created_at, updated_at)
values
  ('00000000-0000-7005-0000-000000000001', 'banner', 'summer-discount', '{"uz":"Yozgi tatil uchun 20% chegirma"}', '{"uz":"Yozgi promo banner."}', 'published', '{"imageUrl":"/images/mock/Uzbekistan-travel.jpeg","link":"/uz/hotels","order":1}', now() - interval '3 days', now(), now()),
  ('00000000-0000-7005-0000-000000000002', 'banner', 'samarkand-bus', '{"uz":"Samarqandga avtobus qatnovi"}', '{"uz":"Samarqand yo nalishi banner."}', 'published', '{"imageUrl":"/images/mock/Samarkand-Registan-cinematic.jpeg","link":"/uz/transport","order":2}', now() - interval '2 days', now(), now()),
  ('00000000-0000-7005-0000-000000000003', 'news', 'yangi-mehmonxonalar-iyun', '{"uz":"Yangi mehmonxonalar qoshildi"}', '{"uz":"Platformaga yangi hamkor mehmonxonalar qoshildi."}', 'published', '{"category":"news"}', now() - interval '2 days', now(), now()),
  ('00000000-0000-7005-0000-000000000004', 'page', 'about', '{"uz":"Biz haqimizda"}', '{"uz":"safaar haqida demo sahifa."}', 'published', '{"menu":"footer"}', now() - interval '100 days', now(), now()),
  ('00000000-0000-7005-0000-000000000005', 'promo', 'summer20', '{"uz":"SUMMER20"}', '{"uz":"20 foiz chegirma promo kodi."}', 'published', '{"discountType":"percent","discountValue":20,"usageLimit":100,"usedCount":45}', now() - interval '1 day', now(), now()),
  ('00000000-0000-7005-0000-000000000006', 'promo', 'welcome50', '{"uz":"WELCOME50"}', '{"uz":"50000 som chegirma promo kodi."}', 'published', '{"discountType":"fixed","discountValue":50000,"usageLimit":500,"usedCount":82}', now() - interval '1 day', now(), now())
on conflict (type, slug) do update
set title = excluded.title,
    body = excluded.body,
    status = excluded.status,
    metadata = excluded.metadata,
    published_at = excluded.published_at,
    updated_at = now();

insert into cms_entries (id, type, slug, title, body, status, metadata, published_at, created_at, updated_at)
values
  (
    '00000000-0000-7005-0000-000000000007',
    'offer',
    'samarkand-plaza-deal',
    '{"uz":"Grand Samarkand Hotel","ru":"Grand Samarkand Hotel","en":"Grand Samarkand Hotel"}',
    '{"uz":"Registon yaqinidagi 5 yulduzli mehmonxona uchun maxsus demo taklif.","ru":"Специальное демо-предложение для 5-звездочного отеля рядом с Регистаном.","en":"Special demo offer for a 5-star hotel near Registan."}',
    'published',
    jsonb_build_object(
      'hotel_id', '00000000-0000-4001-0000-000000000001',
      'slug', 'grand-samarkand-hotel',
      'city_name', jsonb_build_object('uz', 'Samarqand', 'ru', 'Самарканд', 'en', 'Samarkand'),
      'image_url', '/images/mock/hotel-uzbekistan.jpeg',
      'old_price', 900000,
      'new_price', 650000,
      'discount_percent', 28,
      'ends_at', (now() + interval '14 days')::text,
      'order', 1
    ),
    now() - interval '3 days',
    now(),
    now()
  ),
  (
    '00000000-0000-7005-0000-000000000008',
    'offer',
    'hilton-tashkent-deal',
    '{"uz":"Hilton Tashkent","ru":"Hilton Tashkent","en":"Hilton Tashkent"}',
    '{"uz":"Toshkent markazidagi premium mehmonxona uchun demo chegirma.","ru":"Демо-скидка для премиального отеля в центре Ташкента.","en":"Demo discount for a premium hotel in central Tashkent."}',
    'published',
    jsonb_build_object(
      'hotel_id', '00000000-0000-4001-0000-000000000002',
      'slug', 'hilton-tashkent',
      'city_name', jsonb_build_object('uz', 'Toshkent', 'ru', 'Ташкент', 'en', 'Tashkent'),
      'image_url', '/images/mock/hilton-hostel.jpeg',
      'old_price', 1250000,
      'new_price', 980000,
      'discount_percent', 22,
      'ends_at', (now() + interval '10 days')::text,
      'order', 2
    ),
    now() - interval '2 days',
    now(),
    now()
  ),
  (
    '00000000-0000-7005-0000-000000000009',
    'offer',
    'buxoro-palace-deal',
    '{"uz":"Buxoro Palace","ru":"Buxoro Palace","en":"Buxoro Palace"}',
    '{"uz":"Buxoro markazidagi oilaviy mehmonxona uchun demo taklif.","ru":"Демо-предложение для семейного отеля в центре Бухары.","en":"Demo offer for a family hotel in central Bukhara."}',
    'published',
    jsonb_build_object(
      'hotel_id', '00000000-0000-4001-0000-000000000003',
      'slug', 'buxoro-palace',
      'city_name', jsonb_build_object('uz', 'Buxoro', 'ru', 'Бухара', 'en', 'Bukhara'),
      'image_url', '/images/mock/Bukhara-old-city-golden-hour.jpeg',
      'old_price', 710000,
      'new_price', 520000,
      'discount_percent', 27,
      'ends_at', (now() + interval '7 days')::text,
      'order', 3
    ),
    now() - interval '1 day',
    now(),
    now()
  ),
  (
    '00000000-0000-7005-0000-000000000010',
    'attraction',
    'registon',
    '{"uz":"Registon maydoni","ru":"Площадь Регистан","en":"Registan Square"}',
    '{"uz":"Samarqand markazidagi tarixiy ansambl.","ru":"Исторический ансамбль в центре Самарканда.","en":"Historic ensemble in central Samarkand."}',
    'published',
    '{"city_name":{"uz":"Samarqand","ru":"Самарканд","en":"Samarkand"},"category_key":"unesco","category_default":"UNESCO Merosi","rating":4.9,"latitude":39.6542,"longitude":66.9750,"image_url":"/images/mock/Samarkand-Registan-cinematic.jpeg","best_time_to_visit":{"uz":"Mart-may, sentabr-oktabr","ru":"Март-май, сентябрь-октябрь","en":"March-May, September-October"},"order":1}',
    now() - interval '6 days',
    now(),
    now()
  ),
  (
    '00000000-0000-7005-0000-000000000011',
    'attraction',
    'charvak-lake',
    '{"uz":"Chorvoq suv ombori","ru":"Чарвакское водохранилище","en":"Charvak Lake"}',
    '{"uz":"Tog''lar orasidagi dam olish maskani.","ru":"Зона отдыха среди гор.","en":"A mountain getaway by the water."}',
    'published',
    '{"city_name":{"uz":"Charvak","ru":"Чарвак","en":"Charvak"},"category_key":"nature","category_default":"Tabiat & Hordiq","rating":4.7,"latitude":41.6369,"longitude":69.9392,"image_url":"/images/mock/Charvak-Lake-drone.jpeg","best_time_to_visit":{"uz":"May-sentabr","ru":"Май-сентябрь","en":"May-September"},"order":2}',
    now() - interval '5 days',
    now(),
    now()
  ),
  (
    '00000000-0000-7005-0000-000000000012',
    'attraction',
    'ichan-kala',
    '{"uz":"Ichan-Qal''a","ru":"Ичан-Кала","en":"Itchan Kala"}',
    '{"uz":"Xivadagi qadimiy shahriston.","ru":"Древний город-крепость в Хиве.","en":"Ancient walled inner town in Khiva."}',
    'published',
    '{"city_name":{"uz":"Xiva","ru":"Хива","en":"Khiva"},"category_key":"historical","category_default":"Tarixiy Obida","rating":4.8,"latitude":41.3783,"longitude":60.3639,"image_url":"/images/mock/Khiva-Ichan-Kala-aerial.jpeg","best_time_to_visit":{"uz":"Aprel-may, sentabr","ru":"Апрель-май, сентябрь","en":"April-May, September"},"order":3}',
    now() - interval '4 days',
    now(),
    now()
  ),
  (
    '00000000-0000-7005-0000-000000000013',
    'restaurant',
    'osh-markazi-toshkent',
    '{"uz":"Osh Markazi","ru":"Центр плова","en":"Osh Markazi"}',
    '{"uz":"Toshkentcha osh va milliy taomlar.","ru":"Ташкентский плов и национальная кухня.","en":"Tashkent plov and national dishes."}',
    'published',
    '{"city_name":{"uz":"Toshkent","ru":"Ташкент","en":"Tashkent"},"address":"Toshkent, Beshyog''och ko''chasi 12","cuisine":"Milliy taomlar","rating":4.6,"reviews_count":84,"average_check":120000,"latitude":41.3111,"longitude":69.2797,"working_hours":"10:00-22:00","image_url":"/images/mock/Uzbekistan-travel.jpeg","phone":"+998901234501","order":1}',
    now() - interval '4 days',
    now(),
    now()
  ),
  (
    '00000000-0000-7005-0000-000000000014',
    'restaurant',
    'registon-terrace',
    '{"uz":"Registon Terrace","ru":"Registon Terrace","en":"Registan Terrace"}',
    '{"uz":"Samarqand markazida oilaviy restoran.","ru":"Семейный ресторан в центре Самарканда.","en":"Family restaurant in central Samarkand."}',
    'published',
    '{"city_name":{"uz":"Samarqand","ru":"Самарканд","en":"Samarkand"},"address":"Samarqand, Registon ko''chasi 5","cuisine":"Milliy va yevropa","rating":4.7,"reviews_count":56,"average_check":150000,"latitude":39.6554,"longitude":66.9746,"working_hours":"09:00-23:00","image_url":"/images/mock/registan-back-tour.jpg","phone":"+998901234502","order":2}',
    now() - interval '3 days',
    now(),
    now()
  ),
  (
    '00000000-0000-7005-0000-000000000015',
    'restaurant',
    'buxoro-caravan',
    '{"uz":"Buxoro Caravan","ru":"Bukhara Caravan","en":"Bukhara Caravan"}',
    '{"uz":"Buxorocha taomlar va choyxona muhiti.","ru":"Бухарские блюда и атмосфера чайханы.","en":"Bukhara dishes and teahouse atmosphere."}',
    'published',
    '{"city_name":{"uz":"Buxoro","ru":"Бухара","en":"Bukhara"},"address":"Buxoro, Lyabi Hovuz 3","cuisine":"Buxoro taomlari","rating":4.5,"reviews_count":41,"average_check":135000,"latitude":39.7747,"longitude":64.4286,"working_hours":"10:00-23:00","image_url":"/images/mock/Bukhara-old-city-golden-hour.jpeg","phone":"+998901234503","order":3}',
    now() - interval '2 days',
    now(),
    now()
  ),
  (
    '00000000-0000-7005-0000-000000000016',
    'promo_bar',
    'demo-summer-promo',
    '{"uz":"Demo yozgi takliflar faol","ru":"Демо летние предложения активны","en":"Demo summer offers are active"}',
    null,
    'published',
    jsonb_build_object(
      'text', jsonb_build_object('uz', 'Tanlangan mehmonxonalarda demo chegirmalar mavjud', 'ru', 'Демо-скидки доступны в выбранных отелях', 'en', 'Demo discounts are available at selected hotels'),
      'badge', jsonb_build_object('uz', 'Demo', 'ru', 'Demo', 'en', 'Demo'),
      'link', '/uz/hotels',
      'link_text', jsonb_build_object('uz', 'Ko''rish', 'ru', 'Смотреть', 'en', 'View'),
      'ends_at', (now() + interval '21 days')::text,
      'is_active', true,
      'is_dismissible', true
    ),
    now(),
    now(),
    now()
  )
on conflict (type, slug) do update
set title = excluded.title,
    body = excluded.body,
    status = excluded.status,
    metadata = excluded.metadata,
    published_at = excluded.published_at,
    updated_at = now();

insert into audit_logs (
  id, actor_type, actor_id, action, entity_type, entity_id,
  old_value, new_value, metadata, ip_address, user_agent, request_id, created_at
)
values
  ('00000000-0000-7006-0000-000000000001', 'admin', '00000000-0000-1006-0000-000000000001', 'user_registered', 'users', '00000000-0000-2001-0000-000000000001', null, '{"message":"Anvar Karimov royxatdan otdi"}', '{"source":"admin-seed"}', '127.0.0.1', 'seed', 'seed-1', now() - interval '20 minutes'),
  ('00000000-0000-7006-0000-000000000002', 'admin', '00000000-0000-1006-0000-000000000001', 'booking_created', 'bookings', '00000000-0000-6001-0000-000000000001', null, '{"message":"Bron yaratildi"}', '{"source":"admin-seed"}', '127.0.0.1', 'seed', 'seed-2', now() - interval '15 minutes'),
  ('00000000-0000-7006-0000-000000000003', 'admin', '00000000-0000-1006-0000-000000000001', 'partner_request', 'partner_organizations', '00000000-0000-3001-0000-000000000006', null, '{"message":"Yangi hamkor arizasi"}', '{"source":"admin-seed"}', '127.0.0.1', 'seed', 'seed-3', now() - interval '10 minutes'),
  ('00000000-0000-7006-0000-000000000004', 'admin', '00000000-0000-1006-0000-000000000001', 'complaint', 'support_tickets', '00000000-0000-7003-0000-000000000001', null, '{"message":"Yangi shikoyat"}', '{"source":"admin-seed"}', '127.0.0.1', 'seed', 'seed-4', now() - interval '5 minutes')
on conflict (id) do update
set action = excluded.action,
    entity_type = excluded.entity_type,
    entity_id = excluded.entity_id,
    new_value = excluded.new_value,
    metadata = excluded.metadata,
    created_at = excluded.created_at;

insert into notifications (id, user_id, owner_type, owner_id, title, body, read_at, created_at)
values
  ('00000000-0000-7007-0000-000000000001', '00000000-0000-2001-0000-000000000001', 'user', '00000000-0000-2001-0000-000000000001', 'Bron tasdiqlandi', 'B-4501 broningiz tasdiqlandi.', null, now() - interval '1 day'),
  ('00000000-0000-7007-0000-000000000002', '00000000-0000-2001-0000-000000000002', 'user', '00000000-0000-2001-0000-000000000002', 'Promo kod', 'SUMMER20 promo kodidan foydalaning.', now() - interval '1 hour', now() - interval '2 days')
on conflict (id) do update
set title = excluded.title,
    body = excluded.body,
    read_at = excluded.read_at,
    created_at = excluded.created_at;

insert into attractions (id, city_id, slug, title, description, category, cover_image_url, gallery_images, latitude, longitude, ticket_price, opening_hours, recommended_visit_duration_minutes, rating_average, reviews_count, is_active, created_at, updated_at)
values
  ('00000000-0000-8001-0000-000000000001', '00000000-0000-1002-0000-000000000002', 'registon-maydoni',
   '{"uz":"Registon maydoni","ru":"Площадь Регистан","en":"Registan Square"}',
   '{"uz":"Samarqandning yuragi — Ulug''bek, Sherdor va Tillakori madrasalaridan tashkil topgan jahon miqyosidagi meʼmoriy ansambl.","ru":"Сердце Самарканда — архитектурный ансамбль медресе Улугбека, Шердор и Тилля-Кори мирового значения.","en":"The heart of Samarkand — a world-renowned architectural ensemble of the Ulugbek, Sher-Dor, and Tilla-Kori madrasas."}',
   'historical', '/images/mock/Samarkand-Registan-cinematic.jpeg', '["/images/mock/Samarkand-Registan-cinematic.jpeg"]', 39.6542400, 66.9758600, 50000, '08:00-20:00', 90, 4.8, 0, true, now(), now()),
  ('00000000-0000-8001-0000-000000000002', '00000000-0000-1002-0000-000000000003', 'buxoro-eski-shahar',
   '{"uz":"Buxoro Eski Shahri va Kalon Minorasi","ru":"Старый город Бухары и минарет Калян","en":"Bukhara Old City and Kalyan Minaret"}',
   '{"uz":"UNESCO ro''yxatidagi tarixiy markaz — Kalon minorasi, masjidi va Mir-Arab madrasasi atrofida joylashgan qadimiy ko''chalar.","ru":"Исторический центр из списка ЮНЕСКО — древние улицы вокруг минарета Калян, мечети и медресе Мир-Араб.","en":"A UNESCO-listed historic center — ancient streets around the Kalyan Minaret, mosque, and Mir-i-Arab Madrasa."}',
   'historical', '/images/mock/Bukhara-old-city-golden-hour.jpeg', '["/images/mock/Bukhara-old-city-golden-hour.jpeg"]', 39.7747000, 64.4144000, 40000, '08:00-19:00', 120, 4.7, 0, true, now(), now()),
  ('00000000-0000-8001-0000-000000000003', '00000000-0000-1002-0000-000000000004', 'xiva-ichan-qala',
   '{"uz":"Xiva Ichan-Qal''a","ru":"Ичан-Кала Хивы","en":"Khiva Itchan Kala"}',
   '{"uz":"Devor bilan o''ralgan qadimiy ichki shahar — O''zbekistondagi birinchi UNESCO Jahon merosi obyekti.","ru":"Обнесённый стеной древний внутренний город — первый объект Всемирного наследия ЮНЕСКО в Узбекистане.","en":"A walled ancient inner city — Uzbekistan''s first UNESCO World Heritage Site."}',
   'historical', '/images/mock/Khiva-Ichan-Kala-aerial.jpeg', '["/images/mock/Khiva-Ichan-Kala-aerial.jpeg"]', 41.3778000, 60.3617000, 45000, '08:00-19:00', 120, 4.8, 0, true, now(), now()),
  ('00000000-0000-8001-0000-000000000004', '00000000-0000-1002-0000-000000000007', 'chorvoq-suv-ombori',
   '{"uz":"Chorvoq suv ombori va dam olish hududi","ru":"Чарвакское водохранилище и зона отдыха","en":"Charvak Reservoir and Recreation Area"}',
   '{"uz":"Toshkentdan bir soatlik masofada joylashgan tog'' ko''li — suzish, qayiqda sayr va piknik uchun sevimli maskan.","ru":"Горное озеро в часе езды от Ташкента — популярное место для плавания, катания на лодках и пикников.","en":"A mountain lake an hour from Tashkent — a favorite spot for swimming, boating, and picnics."}',
   'nature', '/images/mock/Charvak-Lake-drone.jpeg', '["/images/mock/Charvak-Lake-drone.jpeg"]', 41.6206000, 70.0489000, null, '24 soat', 180, 4.6, 0, true, now(), now()),
  ('00000000-0000-8001-0000-000000000005', '00000000-0000-1002-0000-000000000009', 'zomin-milliy-bogi',
   '{"uz":"Zomin milliy bog''i","ru":"Заминский национальный парк","en":"Zaamin National Park"}',
   '{"uz":"Archazorlar va tog'' manzaralari bilan mashhur qo''riqxona — tabiat sayohati va sog''lomlashtirish uchun ideal.","ru":"Заповедник, известный можжевеловыми лесами и горными пейзажами — идеален для природного туризма и оздоровления.","en":"A reserve famous for juniper forests and mountain scenery — ideal for nature tourism and wellness."}',
   'nature', '/images/mock/Zaamin.jpeg', '["/images/mock/Zaamin.jpeg"]', 39.9500000, 68.4500000, 20000, '09:00-18:00', 150, 4.5, 0, true, now(), now())
on conflict (id) do update
set title = excluded.title,
    description = excluded.description,
    category = excluded.category,
    cover_image_url = excluded.cover_image_url,
    gallery_images = excluded.gallery_images,
    updated_at = now();

insert into promotion_banners (id, title, subtitle, badge_text, image_url, target_url, discount_percentage, start_date, end_date, is_active, sort_order, created_at, updated_at)
values
  ('00000000-0000-8002-0000-000000000001',
   '{"uz":"Yozgi Chorvoq dam olishi","ru":"Летний отдых на Чарваке","en":"Summer getaway at Charvak"}',
   '{"uz":"Tog'' ko''li bo''yidagi mehmonxonalarda maxsus chegirma","ru":"Специальная скидка в отелях у горного озера","en":"Special discount at hotels by the mountain lake"}',
   'Aksiya -20%', '/images/mock/Charvak-Lake-drone.jpeg', '/hotels?city=charvak', 20, now(), now() + interval '30 days', true, 1, now(), now()),
  ('00000000-0000-8002-0000-000000000002',
   '{"uz":"Samarqand va Buxoroga tarixiy sayohat","ru":"Историческое путешествие в Самарканд и Бухару","en":"Historic journey to Samarkand and Bukhara"}',
   '{"uz":"Ikki shahar uchun mehmonxona va transport paketida chegirma","ru":"Скидка на пакет отель + транспорт для двух городов","en":"Discount on hotel + transport package for both cities"}',
   'Paket -15%', '/images/mock/Samarkand-Registan-cinematic.jpeg', '/hotels?city=samarqand', 15, now(), now() + interval '45 days', true, 2, now(), now())
on conflict (id) do update
set title = excluded.title,
    subtitle = excluded.subtitle,
    badge_text = excluded.badge_text,
    image_url = excluded.image_url,
    discount_percentage = excluded.discount_percentage,
    updated_at = now();

commit;
