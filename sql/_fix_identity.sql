UPDATE auth.identities
SET provider_id = user_id,
    id = user_id,
    identity_data = jsonb_build_object('sub', user_id, 'email', 'repro_fixture@test.dev', 'email_verified', true, 'phone_verified', false)
WHERE user_id = 'aaaaaaaa-0000-4000-8000-0000000000aa';