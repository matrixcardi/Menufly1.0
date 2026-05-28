import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Authenticate caller
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Autenticação necessária.' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !caller) {
      return new Response(JSON.stringify({ error: 'Token inválido.' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Parse body
    const { email, password, full_name, restaurant_id } = await req.json()

    if (!email || !password) {
      return new Response(JSON.stringify({ error: 'Email e senha são obrigatórios.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (password.length < 6) {
      return new Response(JSON.stringify({ error: 'Senha deve ter no mínimo 6 caracteres.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check if caller is master
    const { data: masterRole } = await supabaseAdmin
      .from('user_roles')
      .select('id')
      .eq('user_id', caller.id)
      .eq('role', 'master')
      .maybeSingle()

    // Check if caller is admin
    const { data: adminRole } = await supabaseAdmin
      .from('user_roles')
      .select('id')
      .eq('user_id', caller.id)
      .eq('role', 'admin')
      .maybeSingle()

    if (!adminRole && !masterRole) {
      return new Response(JSON.stringify({ error: 'Acesso negado. Apenas administradores.' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Determine the restaurant
    let targetRestaurantId: string | null = restaurant_id || null;

    if (targetRestaurantId) {
      // Verify the restaurant exists
      const { data: restaurant } = await supabaseAdmin
        .from('restaurants')
        .select('id, user_id')
        .eq('id', targetRestaurantId)
        .maybeSingle()

      if (!restaurant) {
        return new Response(JSON.stringify({ error: 'Restaurante não encontrado.' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // If not master, verify caller owns or collaborates on this restaurant
      if (!masterRole) {
        const isOwner = restaurant.user_id === caller.id
        const { data: isCollab } = await supabaseAdmin
          .from('restaurant_collaborators')
          .select('id')
          .eq('restaurant_id', targetRestaurantId)
          .eq('user_id', caller.id)
          .maybeSingle()

        if (!isOwner && !isCollab) {
          return new Response(JSON.stringify({ error: 'Sem permissão para este restaurante.' }), {
            status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
      }
    } else {
      // Fallback: find restaurant owned by caller
      const { data: restaurant } = await supabaseAdmin
        .from('restaurants')
        .select('id')
        .eq('user_id', caller.id)
        .maybeSingle()

      if (!restaurant) {
        return new Response(JSON.stringify({ error: 'Restaurante não encontrado.' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      targetRestaurantId = restaurant.id
    }

    // Check collaborator limit (1 per MenuFly Pro plan)
    const { count: existingCount } = await supabaseAdmin
      .from('restaurant_collaborators')
      .select('*', { count: 'exact', head: true })
      .eq('restaurant_id', targetRestaurantId)

    const MAX_COLLABORATORS = 1;
    if ((existingCount || 0) >= MAX_COLLABORATORS) {
      return new Response(JSON.stringify({ 
        error: `Limite de ${MAX_COLLABORATORS} colaborador(es) atingido para o seu plano.` 
      }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check if user already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
    const existingUser = existingUsers?.users?.find(u => u.email === email)

    let userId: string

    if (existingUser) {
      userId = existingUser.id

      // Check if already a collaborator for this restaurant
      const { data: existingCollab } = await supabaseAdmin
        .from('restaurant_collaborators')
        .select('id')
        .eq('user_id', userId)
        .eq('restaurant_id', targetRestaurantId)
        .maybeSingle()

      if (existingCollab) {
        return new Response(JSON.stringify({ error: 'Este usuário já é colaborador deste restaurante.' }), {
          status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    } else {
      // Create user
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: full_name ? { full_name } : undefined,
      })

      if (createError) {
        return new Response(JSON.stringify({ error: createError.message }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      userId = newUser.user.id
    }

    // Assign collaborator role (if not already)
    const { data: existingRole } = await supabaseAdmin
      .from('user_roles')
      .select('id')
      .eq('user_id', userId)
      .eq('role', 'collaborator')
      .maybeSingle()

    if (!existingRole) {
      const { error: roleError } = await supabaseAdmin
        .from('user_roles')
        .insert({ user_id: userId, role: 'collaborator' })

      if (roleError) {
        return new Response(JSON.stringify({ error: 'Erro ao atribuir papel: ' + roleError.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    // Link collaborator to restaurant
    const { error: linkError } = await supabaseAdmin
      .from('restaurant_collaborators')
      .insert({ user_id: userId, restaurant_id: targetRestaurantId })

    if (linkError) {
      return new Response(JSON.stringify({ error: 'Erro ao vincular colaborador: ' + linkError.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ 
      success: true, 
      userId,
      message: 'Colaborador criado com sucesso.'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...getCorsHeaders(req.headers.get("origin")), 'Content-Type': 'application/json' },
    })
  }
})
