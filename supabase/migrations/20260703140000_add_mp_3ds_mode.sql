-- Modo 3DS por restaurante: 'optional' (MP decide quando desafiar) ou 'mandatory'
-- (desafio do banco em todo pagamento com cartão — usado quando o restaurante sofre
-- recusas cc_rejected_high_risk e precisa forçar a autenticação pelo emissor).
-- Lida apenas pela edge function process-card-payment (service_role); não entra no
-- GRANT por coluna do anon (ver 20260703120000_protect_payment_secrets_from_anon.sql).
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS mp_3ds_mode text NOT NULL DEFAULT 'optional'
  CHECK (mp_3ds_mode IN ('optional', 'mandatory'));
