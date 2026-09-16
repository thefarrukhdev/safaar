-- SAFAAR QA/TEST ACCOUNTS SEED (production-safe, idempotent)
--
-- Creates 10 persistent test USER accounts (email+password login via
-- POST /auth/user/login -> web-user "/login", no SMS OTP needed) and 10
-- persistent test PARTNER accounts (phone+password login via
-- POST /auth/partner/password-login -> web-partner "/login", no SMS OTP
-- needed -- organizations are inserted already "approved", matching the
-- exact same pattern this file's sibling (admin-demo-seed.sql) already
-- uses for its own demo partner orgs), plus one bookable test hotel per
-- test partner so QA can exercise the full checkout flow (including terms
-- acceptance) end-to-end without touching real inventory.
--
-- Idempotent: safe to re-run at any time. Every INSERT conflicts on a
-- natural unique key already enforced by the schema (phone for users,
-- tax_id for partner_organizations, (organization_id,email) for
-- partner_users, slug/hotel_id+language/hotel_id+code for hotel rows) and
-- every row uses a FIXED id (00000000-0000-91xx/92xx/... blocks, chosen
-- to not collide with any block already used in admin-demo-seed.sql or
-- with any real generated uuid), so re-running never duplicates rows,
-- never changes an id, and never touches unrelated real data.
--
-- Password hashes below are argon2id (one-way, generated with the same
-- `argon2` package and default parameters AuthService itself uses) --
-- there is no plaintext credential anywhere in this file or in git. The
-- actual plaintext test credentials are documented separately, outside
-- the repository, and were reported directly to the requester.
--
-- Test phone/tax_id ranges used (reserved for this purpose, never used by
-- any other fixture/seed/task in this project):
--   users:              +998 900 002 0NN  (NN = 01..10)
--   partner orgs:       +998 900 003 0NN  (NN = 01..10)
--   partner orgs tax_id: 9000000NN        (NN = 01..10)

begin;

insert into users (
  id, first_name, last_name, phone, email, password_hash, status,
  preferred_language, phone_verified_at, email_verified_at, created_at, updated_at
)
values
  ('00000000-0000-9101-0000-000000000001', 'Test', 'User01', '+998900002010', 'test.user01@safaar.uz', '$argon2id$v=19$m=65536,t=3,p=4$GxeVLQBiKU9tfDuxkjI0ng$shlJYYsQVrN25K4cxx45SJpgSY+bqWhvMMSMEVnXLaQ', 'active', 'uz', now(), now(), now(), now()),
  ('00000000-0000-9101-0000-000000000002', 'Test', 'User02', '+998900002020', 'test.user02@safaar.uz', '$argon2id$v=19$m=65536,t=3,p=4$snV77IBwDKReeiL3gteAjw$Do80bR7MITa0COTUetP14fQc1iWXgZhgnJ30Jx2btGQ', 'active', 'uz', now(), now(), now(), now()),
  ('00000000-0000-9101-0000-000000000003', 'Test', 'User03', '+998900002030', 'test.user03@safaar.uz', '$argon2id$v=19$m=65536,t=3,p=4$FHE1JpZ0nhM+DzGQt9QbKw$vMLvyIH2/A7Ba3BbLweFFqsPa/DLYk/sDrI1c9hF/8o', 'active', 'uz', now(), now(), now(), now()),
  ('00000000-0000-9101-0000-000000000004', 'Test', 'User04', '+998900002040', 'test.user04@safaar.uz', '$argon2id$v=19$m=65536,t=3,p=4$o4A5lqbCDfvEZhafewxB4w$o+w6Fh4FV8EXUWFJlEaruqUjnUFtQ3dKqFctaMd0C+k', 'active', 'uz', now(), now(), now(), now()),
  ('00000000-0000-9101-0000-000000000005', 'Test', 'User05', '+998900002050', 'test.user05@safaar.uz', '$argon2id$v=19$m=65536,t=3,p=4$gHHvv9kMxu1lscU9VtiJMg$cuRHsgSZytj8L2PUOzccwNhN+AonQjbJdoX7+o4yUvk', 'active', 'uz', now(), now(), now(), now()),
  ('00000000-0000-9101-0000-000000000006', 'Test', 'User06', '+998900002060', 'test.user06@safaar.uz', '$argon2id$v=19$m=65536,t=3,p=4$9TG5/Rio34q7ruXXpzwY1g$iVZQJZyhWpIrGBzwqvGYBYbFddSF1eBhprUZn4gWs9g', 'active', 'uz', now(), now(), now(), now()),
  ('00000000-0000-9101-0000-000000000007', 'Test', 'User07', '+998900002070', 'test.user07@safaar.uz', '$argon2id$v=19$m=65536,t=3,p=4$iiItwUxCR88R62okjnfKXA$6m1Cnpp+ik65uPf2a+eBTF36lqHyXZgTl56TE22RRMk', 'active', 'uz', now(), now(), now(), now()),
  ('00000000-0000-9101-0000-000000000008', 'Test', 'User08', '+998900002080', 'test.user08@safaar.uz', '$argon2id$v=19$m=65536,t=3,p=4$Hj54QuXdj0ao8RWYRT0ivw$AeqM4HFh2Iqj/HkBuqYzT8sZ5c2DFtYarLkaCXCybRo', 'active', 'uz', now(), now(), now(), now()),
  ('00000000-0000-9101-0000-000000000009', 'Test', 'User09', '+998900002090', 'test.user09@safaar.uz', '$argon2id$v=19$m=65536,t=3,p=4$7bpMA07oOotuePUcOCJy7A$X3AEJUvPpBlWKm9QkVYhKTer7fqy2OLxXWPLhBzCL6Y', 'active', 'uz', now(), now(), now(), now()),
  ('00000000-0000-9101-0000-000000000010', 'Test', 'User10', '+998900002100', 'test.user10@safaar.uz', '$argon2id$v=19$m=65536,t=3,p=4$2uwxEhHONitiJauQ1Qg6yw$o4qO1PIjFYlqqVsamNfdLYAK+fDf/LGmbT/nTSVC7ts', 'active', 'uz', now(), now(), now(), now())
on conflict (phone) do update
set first_name = excluded.first_name,
    last_name = excluded.last_name,
    email = excluded.email,
    password_hash = excluded.password_hash,
    status = excluded.status,
    phone_verified_at = excluded.phone_verified_at,
    email_verified_at = excluded.email_verified_at,
    updated_at = now();

insert into room_types (id, code, name, description, bed_type, size_sqm, base_price, capacity, updated_at)
values
  ('00000000-0000-9207-0000-000000000001', 'safaar-qa-test-standard', '{"uz":"QA Test Standart","ru":"QA Тест Стандарт","en":"QA Test Standard"}'::jsonb, 'QA/testing uchun umumiy standart xona turi.', 'double', 22, 500000, 2, now())
on conflict (id) do update
set name = excluded.name, description = excluded.description, updated_at = now();

insert into partner_organizations (
  id, type, legal_name, brand_name, tax_id, phone, email, city_id, address,
  contact_person, status, default_commission_rate, approved_by, approved_at, created_at, updated_at
)
values
  ('00000000-0000-9201-0000-000000000001', 'hotel', 'Safaar Test Partner 01 LLC', 'Safaar Test Hotel 01', '900000001', '+998900003010', 'test.partner01@safaar.uz', '1bf1fb7a-3698-4ccc-a9cb-1ad72b475303', 'Toshkent, Test ko''chasi 01', 'Test Owner 01', 'approved', 12.00, 'c319aa79-3bf8-4637-8def-c5975c9ef5df', now(), now(), now()),
  ('00000000-0000-9201-0000-000000000002', 'hotel', 'Safaar Test Partner 02 LLC', 'Safaar Test Hotel 02', '900000002', '+998900003020', 'test.partner02@safaar.uz', '1bf1fb7a-3698-4ccc-a9cb-1ad72b475303', 'Toshkent, Test ko''chasi 02', 'Test Owner 02', 'approved', 12.00, 'c319aa79-3bf8-4637-8def-c5975c9ef5df', now(), now(), now()),
  ('00000000-0000-9201-0000-000000000003', 'hotel', 'Safaar Test Partner 03 LLC', 'Safaar Test Hotel 03', '900000003', '+998900003030', 'test.partner03@safaar.uz', '1bf1fb7a-3698-4ccc-a9cb-1ad72b475303', 'Toshkent, Test ko''chasi 03', 'Test Owner 03', 'approved', 12.00, 'c319aa79-3bf8-4637-8def-c5975c9ef5df', now(), now(), now()),
  ('00000000-0000-9201-0000-000000000004', 'hotel', 'Safaar Test Partner 04 LLC', 'Safaar Test Hotel 04', '900000004', '+998900003040', 'test.partner04@safaar.uz', '1bf1fb7a-3698-4ccc-a9cb-1ad72b475303', 'Toshkent, Test ko''chasi 04', 'Test Owner 04', 'approved', 12.00, 'c319aa79-3bf8-4637-8def-c5975c9ef5df', now(), now(), now()),
  ('00000000-0000-9201-0000-000000000005', 'hotel', 'Safaar Test Partner 05 LLC', 'Safaar Test Hotel 05', '900000005', '+998900003050', 'test.partner05@safaar.uz', '1bf1fb7a-3698-4ccc-a9cb-1ad72b475303', 'Toshkent, Test ko''chasi 05', 'Test Owner 05', 'approved', 12.00, 'c319aa79-3bf8-4637-8def-c5975c9ef5df', now(), now(), now()),
  ('00000000-0000-9201-0000-000000000006', 'hotel', 'Safaar Test Partner 06 LLC', 'Safaar Test Hotel 06', '900000006', '+998900003060', 'test.partner06@safaar.uz', '1bf1fb7a-3698-4ccc-a9cb-1ad72b475303', 'Toshkent, Test ko''chasi 06', 'Test Owner 06', 'approved', 12.00, 'c319aa79-3bf8-4637-8def-c5975c9ef5df', now(), now(), now()),
  ('00000000-0000-9201-0000-000000000007', 'hotel', 'Safaar Test Partner 07 LLC', 'Safaar Test Hotel 07', '900000007', '+998900003070', 'test.partner07@safaar.uz', '1bf1fb7a-3698-4ccc-a9cb-1ad72b475303', 'Toshkent, Test ko''chasi 07', 'Test Owner 07', 'approved', 12.00, 'c319aa79-3bf8-4637-8def-c5975c9ef5df', now(), now(), now()),
  ('00000000-0000-9201-0000-000000000008', 'hotel', 'Safaar Test Partner 08 LLC', 'Safaar Test Hotel 08', '900000008', '+998900003080', 'test.partner08@safaar.uz', '1bf1fb7a-3698-4ccc-a9cb-1ad72b475303', 'Toshkent, Test ko''chasi 08', 'Test Owner 08', 'approved', 12.00, 'c319aa79-3bf8-4637-8def-c5975c9ef5df', now(), now(), now()),
  ('00000000-0000-9201-0000-000000000009', 'hotel', 'Safaar Test Partner 09 LLC', 'Safaar Test Hotel 09', '900000009', '+998900003090', 'test.partner09@safaar.uz', '1bf1fb7a-3698-4ccc-a9cb-1ad72b475303', 'Toshkent, Test ko''chasi 09', 'Test Owner 09', 'approved', 12.00, 'c319aa79-3bf8-4637-8def-c5975c9ef5df', now(), now(), now()),
  ('00000000-0000-9201-0000-000000000010', 'hotel', 'Safaar Test Partner 10 LLC', 'Safaar Test Hotel 10', '900000010', '+998900003100', 'test.partner10@safaar.uz', '1bf1fb7a-3698-4ccc-a9cb-1ad72b475303', 'Toshkent, Test ko''chasi 10', 'Test Owner 10', 'approved', 12.00, 'c319aa79-3bf8-4637-8def-c5975c9ef5df', now(), now(), now())
on conflict (tax_id) do update
set legal_name = excluded.legal_name,
    brand_name = excluded.brand_name,
    phone = excluded.phone,
    email = excluded.email,
    city_id = excluded.city_id,
    address = excluded.address,
    contact_person = excluded.contact_person,
    status = excluded.status,
    approved_by = excluded.approved_by,
    approved_at = excluded.approved_at,
    updated_at = now();

insert into partner_users (id, organization_id, email, password_hash, full_name, role, status, created_at, updated_at)
values
  ('00000000-0000-9202-0000-000000000001', '00000000-0000-9201-0000-000000000001', 'owner.partner01@safaar.uz', '$argon2id$v=19$m=65536,t=3,p=4$fX3igzu6hWWylqGjdrKisg$Q/Adln1TeIyloIcf16n/ZOuKoKswHsFwm9YpeLjqBzw', 'Test Partner Owner 01', 'owner', 'active', now(), now()),
  ('00000000-0000-9202-0000-000000000002', '00000000-0000-9201-0000-000000000002', 'owner.partner02@safaar.uz', '$argon2id$v=19$m=65536,t=3,p=4$ymNrcCZuqp66L5f8bVh9zw$AoT9uTTxDO4xRMwoSf4qexrAOkW7AN112bo0KhSm+yU', 'Test Partner Owner 02', 'owner', 'active', now(), now()),
  ('00000000-0000-9202-0000-000000000003', '00000000-0000-9201-0000-000000000003', 'owner.partner03@safaar.uz', '$argon2id$v=19$m=65536,t=3,p=4$Mt8d37Ai4Xsft/xMG5GBIg$XxUcE2VufJ9ruoYxWVefX+xYugxD6IyqbBmZrou5T9Q', 'Test Partner Owner 03', 'owner', 'active', now(), now()),
  ('00000000-0000-9202-0000-000000000004', '00000000-0000-9201-0000-000000000004', 'owner.partner04@safaar.uz', '$argon2id$v=19$m=65536,t=3,p=4$Vz9zEzWQG3+0dqE0txqJQw$Cx4WABpv5XwM5DHFO5Xq9uEflrXwOdTPCIXLe7SFk3c', 'Test Partner Owner 04', 'owner', 'active', now(), now()),
  ('00000000-0000-9202-0000-000000000005', '00000000-0000-9201-0000-000000000005', 'owner.partner05@safaar.uz', '$argon2id$v=19$m=65536,t=3,p=4$kTDtbSdrwvFD7qUgJdkxjA$z017fH7g8Nqp3SAXDA6Th7hRhGlcCkL5jYB/t1Rv0+Y', 'Test Partner Owner 05', 'owner', 'active', now(), now()),
  ('00000000-0000-9202-0000-000000000006', '00000000-0000-9201-0000-000000000006', 'owner.partner06@safaar.uz', '$argon2id$v=19$m=65536,t=3,p=4$c3G+BchaUxlcgAdw3oolsQ$O4WZSe7JqDIq4uCuQT86MpZSINbygRwRcMqlQm2nI34', 'Test Partner Owner 06', 'owner', 'active', now(), now()),
  ('00000000-0000-9202-0000-000000000007', '00000000-0000-9201-0000-000000000007', 'owner.partner07@safaar.uz', '$argon2id$v=19$m=65536,t=3,p=4$fn6ZKmkkIG+Gw5B7CiepuQ$rcxm+tN+HZgkfJJDUBzLxHIWQwkdg0O7b9EOFkeppmY', 'Test Partner Owner 07', 'owner', 'active', now(), now()),
  ('00000000-0000-9202-0000-000000000008', '00000000-0000-9201-0000-000000000008', 'owner.partner08@safaar.uz', '$argon2id$v=19$m=65536,t=3,p=4$TkF5fJkqqs/xN1SQBpLJLg$Fw3WjXHK7WfKPkrdI4QQXnzw20zI+IVftcWQWHSuBzI', 'Test Partner Owner 08', 'owner', 'active', now(), now()),
  ('00000000-0000-9202-0000-000000000009', '00000000-0000-9201-0000-000000000009', 'owner.partner09@safaar.uz', '$argon2id$v=19$m=65536,t=3,p=4$xua8NZ4oNP44KXtewHYPlA$cCHikZybM4YsAPPa1wHjyD1Na5T4hlBRsff1vCQwyEY', 'Test Partner Owner 09', 'owner', 'active', now(), now()),
  ('00000000-0000-9202-0000-000000000010', '00000000-0000-9201-0000-000000000010', 'owner.partner10@safaar.uz', '$argon2id$v=19$m=65536,t=3,p=4$JGSHZR7t+4sj87B/KF8qNA$WzxHoj3VqPY3SpdBn7xaAEt5vLvTM3Pv7lPNg0d6Hjo', 'Test Partner Owner 10', 'owner', 'active', now(), now())
on conflict (organization_id, email) do update
set password_hash = excluded.password_hash,
    full_name = excluded.full_name,
    role = excluded.role,
    status = excluded.status,
    updated_at = now();

insert into hotels (
  id, partner_organization_id, slug, city_id, address, stars,
  rating_average, reviews_count, status, check_in_time, check_out_time, created_at, updated_at
)
values
  ('00000000-0000-9203-0000-000000000001', '00000000-0000-9201-0000-000000000001', 'safaar-test-hotel-01', '1bf1fb7a-3698-4ccc-a9cb-1ad72b475303', 'Toshkent, Test ko''chasi 01', 3, 0, 0, 'published', '14:00', '12:00', now(), now()),
  ('00000000-0000-9203-0000-000000000002', '00000000-0000-9201-0000-000000000002', 'safaar-test-hotel-02', '1bf1fb7a-3698-4ccc-a9cb-1ad72b475303', 'Toshkent, Test ko''chasi 02', 3, 0, 0, 'published', '14:00', '12:00', now(), now()),
  ('00000000-0000-9203-0000-000000000003', '00000000-0000-9201-0000-000000000003', 'safaar-test-hotel-03', '1bf1fb7a-3698-4ccc-a9cb-1ad72b475303', 'Toshkent, Test ko''chasi 03', 3, 0, 0, 'published', '14:00', '12:00', now(), now()),
  ('00000000-0000-9203-0000-000000000004', '00000000-0000-9201-0000-000000000004', 'safaar-test-hotel-04', '1bf1fb7a-3698-4ccc-a9cb-1ad72b475303', 'Toshkent, Test ko''chasi 04', 3, 0, 0, 'published', '14:00', '12:00', now(), now()),
  ('00000000-0000-9203-0000-000000000005', '00000000-0000-9201-0000-000000000005', 'safaar-test-hotel-05', '1bf1fb7a-3698-4ccc-a9cb-1ad72b475303', 'Toshkent, Test ko''chasi 05', 3, 0, 0, 'published', '14:00', '12:00', now(), now()),
  ('00000000-0000-9203-0000-000000000006', '00000000-0000-9201-0000-000000000006', 'safaar-test-hotel-06', '1bf1fb7a-3698-4ccc-a9cb-1ad72b475303', 'Toshkent, Test ko''chasi 06', 3, 0, 0, 'published', '14:00', '12:00', now(), now()),
  ('00000000-0000-9203-0000-000000000007', '00000000-0000-9201-0000-000000000007', 'safaar-test-hotel-07', '1bf1fb7a-3698-4ccc-a9cb-1ad72b475303', 'Toshkent, Test ko''chasi 07', 3, 0, 0, 'published', '14:00', '12:00', now(), now()),
  ('00000000-0000-9203-0000-000000000008', '00000000-0000-9201-0000-000000000008', 'safaar-test-hotel-08', '1bf1fb7a-3698-4ccc-a9cb-1ad72b475303', 'Toshkent, Test ko''chasi 08', 3, 0, 0, 'published', '14:00', '12:00', now(), now()),
  ('00000000-0000-9203-0000-000000000009', '00000000-0000-9201-0000-000000000009', 'safaar-test-hotel-09', '1bf1fb7a-3698-4ccc-a9cb-1ad72b475303', 'Toshkent, Test ko''chasi 09', 3, 0, 0, 'published', '14:00', '12:00', now(), now()),
  ('00000000-0000-9203-0000-000000000010', '00000000-0000-9201-0000-000000000010', 'safaar-test-hotel-10', '1bf1fb7a-3698-4ccc-a9cb-1ad72b475303', 'Toshkent, Test ko''chasi 10', 3, 0, 0, 'published', '14:00', '12:00', now(), now())
on conflict (slug) do update
set partner_organization_id = excluded.partner_organization_id,
    city_id = excluded.city_id,
    address = excluded.address,
    status = excluded.status,
    updated_at = now();

insert into hotel_translations (id, hotel_id, language, name, description, created_at, updated_at)
values
  ('00000000-0000-9204-0000-000000000001', '00000000-0000-9203-0000-000000000001', 'uz', 'Safaar Test Hotel 01', 'QA/testing uchun maxsus test mehmonxonasi. Real mijozlar uchun emas.', now(), now()),
  ('00000000-0000-9204-0000-000000000002', '00000000-0000-9203-0000-000000000002', 'uz', 'Safaar Test Hotel 02', 'QA/testing uchun maxsus test mehmonxonasi. Real mijozlar uchun emas.', now(), now()),
  ('00000000-0000-9204-0000-000000000003', '00000000-0000-9203-0000-000000000003', 'uz', 'Safaar Test Hotel 03', 'QA/testing uchun maxsus test mehmonxonasi. Real mijozlar uchun emas.', now(), now()),
  ('00000000-0000-9204-0000-000000000004', '00000000-0000-9203-0000-000000000004', 'uz', 'Safaar Test Hotel 04', 'QA/testing uchun maxsus test mehmonxonasi. Real mijozlar uchun emas.', now(), now()),
  ('00000000-0000-9204-0000-000000000005', '00000000-0000-9203-0000-000000000005', 'uz', 'Safaar Test Hotel 05', 'QA/testing uchun maxsus test mehmonxonasi. Real mijozlar uchun emas.', now(), now()),
  ('00000000-0000-9204-0000-000000000006', '00000000-0000-9203-0000-000000000006', 'uz', 'Safaar Test Hotel 06', 'QA/testing uchun maxsus test mehmonxonasi. Real mijozlar uchun emas.', now(), now()),
  ('00000000-0000-9204-0000-000000000007', '00000000-0000-9203-0000-000000000007', 'uz', 'Safaar Test Hotel 07', 'QA/testing uchun maxsus test mehmonxonasi. Real mijozlar uchun emas.', now(), now()),
  ('00000000-0000-9204-0000-000000000008', '00000000-0000-9203-0000-000000000008', 'uz', 'Safaar Test Hotel 08', 'QA/testing uchun maxsus test mehmonxonasi. Real mijozlar uchun emas.', now(), now()),
  ('00000000-0000-9204-0000-000000000009', '00000000-0000-9203-0000-000000000009', 'uz', 'Safaar Test Hotel 09', 'QA/testing uchun maxsus test mehmonxonasi. Real mijozlar uchun emas.', now(), now()),
  ('00000000-0000-9204-0000-000000000010', '00000000-0000-9203-0000-000000000010', 'uz', 'Safaar Test Hotel 10', 'QA/testing uchun maxsus test mehmonxonasi. Real mijozlar uchun emas.', now(), now())
on conflict (hotel_id, language) do update
set name = excluded.name, description = excluded.description, updated_at = now();

insert into hotel_rooms (
  id, hotel_id, room_type_id, code, base_occupancy, max_adults, max_children,
  total_inventory, base_price, status, is_listed, created_at, updated_at
)
values
  ('00000000-0000-9205-0000-000000000001', '00000000-0000-9203-0000-000000000001', '00000000-0000-9207-0000-000000000001', 'TEST-STD', 2, 2, 1, 10, 500000, 'active', true, now(), now()),
  ('00000000-0000-9205-0000-000000000002', '00000000-0000-9203-0000-000000000002', '00000000-0000-9207-0000-000000000001', 'TEST-STD', 2, 2, 1, 10, 500000, 'active', true, now(), now()),
  ('00000000-0000-9205-0000-000000000003', '00000000-0000-9203-0000-000000000003', '00000000-0000-9207-0000-000000000001', 'TEST-STD', 2, 2, 1, 10, 500000, 'active', true, now(), now()),
  ('00000000-0000-9205-0000-000000000004', '00000000-0000-9203-0000-000000000004', '00000000-0000-9207-0000-000000000001', 'TEST-STD', 2, 2, 1, 10, 500000, 'active', true, now(), now()),
  ('00000000-0000-9205-0000-000000000005', '00000000-0000-9203-0000-000000000005', '00000000-0000-9207-0000-000000000001', 'TEST-STD', 2, 2, 1, 10, 500000, 'active', true, now(), now()),
  ('00000000-0000-9205-0000-000000000006', '00000000-0000-9203-0000-000000000006', '00000000-0000-9207-0000-000000000001', 'TEST-STD', 2, 2, 1, 10, 500000, 'active', true, now(), now()),
  ('00000000-0000-9205-0000-000000000007', '00000000-0000-9203-0000-000000000007', '00000000-0000-9207-0000-000000000001', 'TEST-STD', 2, 2, 1, 10, 500000, 'active', true, now(), now()),
  ('00000000-0000-9205-0000-000000000008', '00000000-0000-9203-0000-000000000008', '00000000-0000-9207-0000-000000000001', 'TEST-STD', 2, 2, 1, 10, 500000, 'active', true, now(), now()),
  ('00000000-0000-9205-0000-000000000009', '00000000-0000-9203-0000-000000000009', '00000000-0000-9207-0000-000000000001', 'TEST-STD', 2, 2, 1, 10, 500000, 'active', true, now(), now()),
  ('00000000-0000-9205-0000-000000000010', '00000000-0000-9203-0000-000000000010', '00000000-0000-9207-0000-000000000001', 'TEST-STD', 2, 2, 1, 10, 500000, 'active', true, now(), now())
on conflict (hotel_id, code) do update
set room_type_id = excluded.room_type_id,
    total_inventory = excluded.total_inventory,
    base_price = excluded.base_price,
    status = excluded.status,
    is_listed = excluded.is_listed,
    updated_at = now();

insert into hotel_room_translations (id, room_id, language, name, description, created_at, updated_at)
values
  ('00000000-0000-9206-0000-000000000001', '00000000-0000-9205-0000-000000000001', 'uz', 'Test Standart xona', 'QA testing uchun standart xona.', now(), now()),
  ('00000000-0000-9206-0000-000000000002', '00000000-0000-9205-0000-000000000002', 'uz', 'Test Standart xona', 'QA testing uchun standart xona.', now(), now()),
  ('00000000-0000-9206-0000-000000000003', '00000000-0000-9205-0000-000000000003', 'uz', 'Test Standart xona', 'QA testing uchun standart xona.', now(), now()),
  ('00000000-0000-9206-0000-000000000004', '00000000-0000-9205-0000-000000000004', 'uz', 'Test Standart xona', 'QA testing uchun standart xona.', now(), now()),
  ('00000000-0000-9206-0000-000000000005', '00000000-0000-9205-0000-000000000005', 'uz', 'Test Standart xona', 'QA testing uchun standart xona.', now(), now()),
  ('00000000-0000-9206-0000-000000000006', '00000000-0000-9205-0000-000000000006', 'uz', 'Test Standart xona', 'QA testing uchun standart xona.', now(), now()),
  ('00000000-0000-9206-0000-000000000007', '00000000-0000-9205-0000-000000000007', 'uz', 'Test Standart xona', 'QA testing uchun standart xona.', now(), now()),
  ('00000000-0000-9206-0000-000000000008', '00000000-0000-9205-0000-000000000008', 'uz', 'Test Standart xona', 'QA testing uchun standart xona.', now(), now()),
  ('00000000-0000-9206-0000-000000000009', '00000000-0000-9205-0000-000000000009', 'uz', 'Test Standart xona', 'QA testing uchun standart xona.', now(), now()),
  ('00000000-0000-9206-0000-000000000010', '00000000-0000-9205-0000-000000000010', 'uz', 'Test Standart xona', 'QA testing uchun standart xona.', now(), now())
on conflict (room_id, language) do update
set name = excluded.name, description = excluded.description, updated_at = now();

commit;
