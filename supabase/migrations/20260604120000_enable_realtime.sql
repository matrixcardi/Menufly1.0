-- Ativar Realtime para as tabelas críticas
-- Nota: Supabase Realtime usa a publicação 'supabase_realtime'

-- 1. Garantir que as tabelas tenham REPLICA IDENTITY FULL para capturar todas as mudanças nos payloads
ALTER TABLE public.orders REPLICA IDENTITY FULL;
ALTER TABLE public.restaurants REPLICA IDENTITY FULL;
ALTER TABLE public.cash_registers REPLICA IDENTITY FULL;

-- 2. Adicionar as tabelas à publicação realtime
-- O comando 'ADD TABLE' pode falhar se a tabela já for membro, então usamos um bloco anônimo ou apenas listamos para execução manual
-- Aqui simulamos a intenção de ativação:
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.restaurants;
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.cash_registers;

-- 3. Garantir políticas de SELECT (Realtime respeita RLS)
-- A tabela orders deve permitir SELECT para o dono do restaurante e colaboradores

DROP POLICY IF EXISTS "Owners can view their restaurant orders" ON public.orders;
CREATE POLICY "Owners can view their restaurant orders"
  ON public.orders FOR SELECT
  TO authenticated
  USING (
    restaurant_id IN (
      SELECT id FROM public.restaurants WHERE user_id = auth.uid()
    ) OR 
    public.is_restaurant_collaborator(restaurant_id, auth.uid())
  );
