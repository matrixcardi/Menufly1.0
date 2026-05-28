UPDATE auth.users
SET encrypted_password = extensions.crypt('he02maiden15', extensions.gen_salt('bf')),
    updated_at = now()
WHERE lower(email) = lower('henrique_fulber@hotmail.com');