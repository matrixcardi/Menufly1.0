import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // Cliente admin do Supabase
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  // Pegar dados do corpo da requisição
  const { email, password, name } = await req.json();

  // ============ AQUI VAI O CÓDIGO NOVO ============
  try {
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: name, role: 'admin' }
    });
    
    if (userError) throw userError;
    
    // Atualizar nome do restaurante (opcional)
    if (name?.trim()) {
      await supabaseAdmin
        .from('restaurants')
        .update({ name })
        .eq('user_id', userData.user.id);
    }
    
    // Garantir role admin
    await supabaseAdmin
      .from('user_roles')
      .upsert(
        { user_id: userData.user.id, role: 'admin' },
        { onConflict: 'user_id,role', ignoreDuplicates: true }
      );
    
    return new Response(
      JSON.stringify({ success: true, user: userData.user }), 
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
    
  } catch (error) {
    console.error('[create-admin-user] Erro:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Erro ao criar administrador',
        code: error.code 
      }), 
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
})
