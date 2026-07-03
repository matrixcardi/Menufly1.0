-- Protege credenciais sensíveis dos restaurantes contra leitura pública (role anon).
--
-- Problema: a policy "Public can view restaurants by slug" usa USING (true), e como RLS
-- é row-level (não column-level), qualquer visitante do cardápio com a chave anon conseguia
-- ler pix_gateway_token, mp_refresh_token, card_gateway_token e meta_access_token de TODOS
-- os restaurantes. Nenhuma tela do cliente precisa do valor do token — só de saber se o
-- gateway está conectado. Edge functions usam service_role e não são afetadas por isto.

-- 1) Coluna booleana pública: indica se o gateway MP está conectado, sem expor o token.
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS pix_gateway_connected boolean
  GENERATED ALWAYS AS (pix_gateway IS NOT NULL AND pix_gateway_token IS NOT NULL) STORED;

-- 2) Substitui o SELECT table-level do anon por SELECT apenas nas colunas seguras.
--    (No Postgres não dá para "revogar uma coluna" de um grant table-level; é preciso
--     revogar o table-level e re-conceder coluna a coluna.)
REVOKE SELECT ON public.restaurants FROM anon;

GRANT SELECT (
  address, address_cep, address_city, address_complement, address_neighborhood,
  address_number, address_state, address_street, banner_url, bot_auto_reply_enabled,
  bot_enabled, bot_feedback_enabled, bot_greeting_message, bot_order_updates,
  card_enabled, card_gateway, card_on_delivery_enabled, card_online_enabled,
  cash_enabled, closing_time, created_at, default_delivery_fee,
  default_delivery_time_min, delivery_available, delivery_method, delivery_mode,
  description, free_shipping_threshold, ga_measurement_id, google_maps_url,
  google_review_link, gtm_container_id, id, instagram_url, is_open, logo_url,
  manual_override_until, menu_theme, meta_pixel_id, min_order, mp_public_key, name,
  notification_sound, opening_time, operation_mode, pickup_available, pix_enabled,
  pix_gateway, pix_gateway_connected, pix_key, pix_on_delivery_enabled, restaurant_lat,
  restaurant_lng, slug, stripe_publishable_key, subscription_active,
  trial_email_d0_sent, trial_email_d1_sent, trial_email_d3_sent, trial_email_d7_sent,
  trial_ends_at, updated_at, user_id, whatsapp_connected, whatsapp_instance_name,
  whatsapp_phone
) ON public.restaurants TO anon;

-- Observação: o role `authenticated` mantém acesso total (owners editam meta_access_token em
-- AdminAds e o token em AdminPayments). O risco residual de um owner logado ler segredos de
-- outro tenant (devido ao USING(true)) exige mover segredos para uma tabela separada — fora
-- do escopo desta migration.
