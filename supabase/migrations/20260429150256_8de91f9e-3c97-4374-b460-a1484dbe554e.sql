-- Lá Vem Entregas: hide platform API key from admin; admin only enters their Lá Vem account credentials.
-- 1) Add credential columns
ALTER TABLE public.lavem_integrations
  ADD COLUMN IF NOT EXISTS account_email text,
  ADD COLUMN IF NOT EXISTS account_password text;

-- 2) Drop old api_key column (was the platform-level key, now stored as a backend secret)
ALTER TABLE public.lavem_integrations
  DROP COLUMN IF EXISTS api_key;

-- 3) Make integration active by default; remains togglable
ALTER TABLE public.lavem_integrations
  ALTER COLUMN is_active SET DEFAULT true;