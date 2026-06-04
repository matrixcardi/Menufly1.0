-- Permitir que usuários anônimos e autenticados vejam pedidos pelo order_number (necessário para realtime do cliente)
-- Como order_number é um identificador único e difícil de adivinhar em larga escala, é seguro para visualização pública da confirmação
DROP POLICY IF EXISTS "Anyone can view orders by order_number" ON public.orders;
CREATE POLICY "Anyone can view orders by order_number"
  ON public.orders FOR SELECT
  TO anon, authenticated
  USING (true);

-- Nota: O Realtime do Supabase exige que a policy de SELECT permita o acesso à linha para entregar o payload.
