UPDATE auth.users
SET encrypted_password = '$2a$10$H1GDKjcwzj79g.MAzmOlCO.GKtMt7omP5X2ahB.rrntingQeWOYLy',
    raw_user_meta_data = '{"email":"repro_fixture@test.dev"}',
    email_confirmed_at = '2026-09-11T18:17:56.698Z',
    confirmation_token = '',
    recovery_token = ''
WHERE id = 'aaaaaaaa-0000-4000-8000-0000000000aa';

UPDATE auth.identities
SET provider_id = 'c017c3c4-0cff-4670-a0e7-6acad1d9eecc', id = 'c017c3c4-0cff-4670-a0e7-6acad1d9eecc'
WHERE user_id = 'aaaaaaaa-0000-4000-8000-0000000000aa';
