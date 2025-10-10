-- Create Test Users for QA Testing
-- This script creates:
-- 1. Two test clients (for portal user isolation testing)
-- 2. One staff user (can access all clients)
-- 3. Two portal users (one per client, for access control testing)

-- Clean up any existing test data
DELETE FROM client_portal_users WHERE email IN ('georgewandhe@icloud.com', 'george@softwaresynth.com');
DELETE FROM users WHERE email = 'georgewandhe@gmail.com';
DELETE FROM clients WHERE name IN ('QA Test Client A', 'QA Test Client B');

-- Create two test clients
INSERT INTO clients (id, name, email, created_at)
VALUES
  ('qa-test-client-a', 'QA Test Client A', 'client-a@test.com', NOW()),
  ('qa-test-client-b', 'QA Test Client B', 'client-b@test.com', NOW());

-- Create staff user with password "TestPassword123"
-- Password hash generated with bcrypt (12 rounds)
INSERT INTO users (
  id,
  email,
  first_name,
  last_name,
  password_hash,
  is_admin,
  can_see_admin_menu,
  created_at,
  updated_at
)
VALUES (
  'qa-test-staff-user',
  'georgewandhe@gmail.com',
  'George (Staff)',
  'Wandhe',
  '$2b$12$YGHOrSLg.LpkTnbwMd5bvuZJGNsaAR.BrvdxIHSOpg8DZbGvVmolO', -- "TestPassword123"
  true, -- is admin
  true, -- can see admin menu
  NOW(),
  NOW()
);

-- Create portal user A (linked to Client A)
INSERT INTO client_portal_users (
  id,
  client_id,
  email,
  name,
  created_at,
  updated_at
)
VALUES (
  'qa-test-portal-user-a',
  'qa-test-client-a',
  'georgewandhe@icloud.com',
  'George (Portal User A)',
  NOW(),
  NOW()
);

-- Create portal user B (linked to Client B)
INSERT INTO client_portal_users (
  id,
  client_id,
  email,
  name,
  created_at,
  updated_at
)
VALUES (
  'qa-test-portal-user-b',
  'qa-test-client-b',
  'george@softwaresynth.com',
  'George (Portal User B)',
  NOW(),
  NOW()
);

-- Verify the creation
SELECT 'Created clients:' as info;
SELECT id, name, email FROM clients WHERE name LIKE 'QA Test%';

SELECT 'Created staff user:' as info;
SELECT id, email, first_name, last_name, is_admin FROM users WHERE email = 'georgewandhe@gmail.com';

SELECT 'Created portal users:' as info;
SELECT id, email, name, client_id FROM client_portal_users WHERE email IN ('georgewandhe@icloud.com', 'george@softwaresynth.com');
