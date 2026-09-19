-- ============================================================================
-- sql/seed-second-user.sql — idempotent second test user for acceptance flows
-- (join/leave as another member, two-user messaging). Follows the exact
-- convention of sql/_seed_autotest_user.sql with a sibling test id.
-- ============================================================================
DO $$
DECLARE
  uid uuid := 'd1eeb9c0-0000-4000-8000-000000000008';
BEGIN
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, is_sso_user, is_anonymous
  ) VALUES (
    uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'g4m37z.autotest2@gmail.com',
    crypt('G4m37z!autotest2026', gen_salt('bf', 10)),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"username":"autotest2","display_name":"Autotest Two"}'::jsonb,
    now(), now(), false, false
  )
  ON CONFLICT (id) DO UPDATE
    SET encrypted_password = EXCLUDED.encrypted_password,
        email_confirmed_at = now(),
        updated_at = now();

  INSERT INTO auth.identities (
    provider_id, user_id, identity_data, provider, last_sign_in_at,
    created_at, updated_at, id
  ) VALUES (
    uid, uid,
    jsonb_build_object('sub', uid::text, 'email', 'g4m37z.autotest2@gmail.com'),
    'email', now(), now(), now(), uid
  )
  ON CONFLICT (provider_id, provider) DO NOTHING;

  UPDATE auth.users
  SET confirmation_token = COALESCE(confirmation_token, ''),
      recovery_token = COALESCE(recovery_token, ''),
      email_change = COALESCE(email_change, ''),
      email_change_token_new = COALESCE(email_change_token_new, ''),
      email_change_token_current = COALESCE(email_change_token_current, ''),
      phone_change = COALESCE(phone_change, ''),
      phone_change_token = COALESCE(phone_change_token, ''),
      reauthentication_token = COALESCE(reauthentication_token, '')
  WHERE id = uid;

  INSERT INTO public.profiles (
    id, username, display_name, created_at, updated_at, role,
    presence_state, notification_prefs
  ) VALUES (
    uid, 'autotest2', 'Autotest Two', now(), now(), 'member',
    'offline', '{}'::jsonb
  )
  ON CONFLICT (id) DO NOTHING;
END $$;

SELECT u.id, u.email, u.email_confirmed_at IS NOT NULL AS confirmed
FROM auth.users u WHERE u.email = 'g4m37z.autotest2@gmail.com';
