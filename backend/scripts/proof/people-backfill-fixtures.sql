-- Fixtures for the People backfill proof. Aborts unless the database name ends in _proof.
DO $$
BEGIN
  IF current_database() NOT LIKE '%\_proof' THEN
    RAISE EXCEPTION 'fixtures refuse to run on %, only on a *_proof database', current_database();
  END IF;
END $$;

-- A contract type for the waiter.
INSERT INTO contract_types (id, name, is_active, created_at, updated_at)
VALUES ('proof-ct-1', 'Permanent', true, now(), now());

-- Users: HR (no site), a waiter, a casual with a custom job title, an inactive user, a display account.
INSERT INTO users (id, organization_id, name, email, password_hash, role, is_active, updated_at) VALUES
  ('proof-u-hr',     NULL, 'Proof HR', 'proof.hr@wendo.test', 'x', 'HR_MANAGER', true, now()),
  ('proof-u-waiter', (SELECT id FROM organizations WHERE name = 'Nyeri Town'), 'Proof Waiter', 'proof.waiter@wendo.test', 'x', 'WAITER', true, now()),
  ('proof-u-casual', (SELECT id FROM organizations WHERE name = 'Nyeri Town'), 'Proof Casual', 'proof.casual@wendo.test', 'x', 'CHEF', true, now()),
  ('proof-u-gone',   (SELECT id FROM organizations WHERE name = 'Nyeri Town'), 'Proof Gone', 'proof.gone@wendo.test', 'x', 'WAITER', false, now()),
  ('proof-u-kds',    (SELECT id FROM organizations WHERE name = 'Nyeri Town'), 'Proof KDS', 'proof.kds@wendo.test', 'x', 'KITCHEN_DISPLAY', true, now());

-- Legacy profiles: the waiter (contract, bank, ids), the casual (custom title), the inactive user.
INSERT INTO employee_profiles (id, user_id, national_id, kra_pin, nssf_number, shif_nhif_number, helb_number,
  emergency_name, emergency_relation, emergency_phone, employment_type, contract_type_id, start_date,
  job_title, bank_name, account_number, account_name, bank_branch, reporting_manager_id, created_at, updated_at) VALUES
  ('proof-p-waiter', 'proof-u-waiter', '12345678', 'A001234567B', 'NSSF-1', 'SHA-1', 'HELB-1',
   'Proof Mother', 'Mother', '0700000001', 'FULL_TIME', 'proof-ct-1', '2025-03-03 21:00:00',
   'Waiter', 'Equity', '0123456789', 'Proof Waiter', 'Nyeri', (SELECT id FROM users WHERE email = 'bm.town@wendo.test'), now(), now()),
  ('proof-p-casual', 'proof-u-casual', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'CASUAL', NULL, '2026-01-10 00:00:00',
   'kitchen HAND', NULL, NULL, NULL, NULL, NULL, now(), now()),
  ('proof-p-gone', 'proof-u-gone', '999', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'FULL_TIME', NULL, '2024-01-01 00:00:00',
   'Waiter', NULL, NULL, NULL, NULL, NULL, now(), now());

-- A document on the waiter's legacy profile.
INSERT INTO hr_documents (id, employee_profile_id, document_type, file_name, file_url, uploaded_by_id, created_at)
VALUES ('proof-doc-1', 'proof-p-waiter', (SELECT e.enumlabel::"HrDocumentType" FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'HrDocumentType' ORDER BY e.enumsortorder LIMIT 1),
        'id-card.pdf', 'https://example.test/id-card.pdf', 'proof-u-hr', now());
