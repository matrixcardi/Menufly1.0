import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Pegar user logado
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Não autenticado');

    const { data: { user: inviter }, error: userErr } = await supabaseAdmin.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (userErr || !inviter) throw new Error('Sessão inválida');

    const { restaurant_id, email, name, role } = await req.json();

    // Validar que o solicitante é dono do restaurante
    const { data: restaurant } = await supabaseAdmin
      .from('restaurants')
      .select('id, user_id, name')
      .eq('id', restaurant_id)
      .single();

    if (!restaurant || restaurant.user_id !== inviter.id) {
      throw new Error('Você não tem permissão para convidar colaboradores neste restaurante');
    }

    // Verificar se o email já existe em auth.users
    const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
    let collaboratorUser = users?.find(u => u.email === email);

    // Se não existe, criar
    if (!collaboratorUser) {
      const tempPassword = `MenuFly@${Math.random().toString(36).slice(-8)}`;
      const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { full_name: name, role: 'collaborator' }
      });
      if (createErr) throw createErr;
      collaboratorUser = newUser.user;

      // TODO: enviar email com tempPassword pro novo colaborador
      console.log(`[invite-collaborator] Senha temporária para ${email}: ${tempPassword}`);
    }

    // Inserir/atualizar em restaurant_collaborators
    const { error: linkErr } = await supabaseAdmin
      .from('restaurant_collaborators')
      .upsert({
        restaurant_id,
        user_id: collaboratorUser.id,
        role,
        invited_by: inviter.id,
        status: 'active',
      }, {
        onConflict: 'restaurant_id,user_id',
      });

    if (linkErr) throw linkErr;

    return new Response(
      JSON.stringify({ success: true, user_id: collaboratorUser.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[invite-collaborator] Erro:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Erro ao convidar colaborador' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
