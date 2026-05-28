import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders } from "../_shared/cors.ts";

// Credentials are now read from environment secrets
// Set these secrets: MASTER_USER_1_EMAIL, MASTER_USER_1_PASSWORD, MASTER_USER_2_EMAIL, MASTER_USER_2_PASSWORD
// Set these secrets: ADMIN_USER_1_EMAIL, ADMIN_USER_1_PASSWORD
function getMasterUsers(): Array<{ email: string; password: string }> {
  const users: Array<{ email: string; password: string }> = []
  
  // Check for master user 1
  const master1Email = Deno.env.get('MASTER_USER_1_EMAIL')
  const master1Password = Deno.env.get('MASTER_USER_1_PASSWORD')
  if (master1Email && master1Password) {
    users.push({ email: master1Email, password: master1Password })
  }
  
  // Check for master user 2
  const master2Email = Deno.env.get('MASTER_USER_2_EMAIL')
  const master2Password = Deno.env.get('MASTER_USER_2_PASSWORD')
  if (master2Email && master2Password) {
    users.push({ email: master2Email, password: master2Password })
  }
  
  return users
}

function getAdminUsers(): Array<{ email: string; password: string }> {
  const users: Array<{ email: string; password: string }> = []
  
  // Check for admin user 1
  const admin1Email = Deno.env.get('ADMIN_USER_1_EMAIL')
  const admin1Password = Deno.env.get('ADMIN_USER_1_PASSWORD')
  if (admin1Email && admin1Password) {
    users.push({ email: admin1Email, password: admin1Password })
  }
  
  return users
}

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

    // ========== AUTHENTICATION CHECK ==========
    // This endpoint requires an existing master user to be authenticated
    // This prevents unauthorized privilege escalation
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ 
        error: 'Authentication required. This endpoint requires master user authorization.' 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Verify the JWT token
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    
    if (authError || !user) {
      return new Response(JSON.stringify({ 
        error: 'Invalid or expired authentication token.' 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check if the authenticated user has master role
    const { data: masterRole, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('id')
      .eq('user_id', user.id)
      .eq('role', 'master')
      .maybeSingle()

    if (roleError || !masterRole) {
      // Log the unauthorized attempt for audit
      console.warn(`Unauthorized seed-master-users attempt by user: ${user.id} (${user.email})`)
      return new Response(JSON.stringify({ 
        error: 'Access denied. Only master users can access this endpoint.' 
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Log successful access for audit trail
    console.log(`seed-master-users accessed by master user: ${user.id} (${user.email})`)
    // ========== END AUTHENTICATION CHECK ==========

    const MASTER_USERS = getMasterUsers()
    const ADMIN_USERS = getAdminUsers()

    if (MASTER_USERS.length === 0 && ADMIN_USERS.length === 0) {
      return new Response(JSON.stringify({ 
        error: 'No user credentials configured. Please set MASTER_USER_*_EMAIL/PASSWORD and/or ADMIN_USER_*_EMAIL/PASSWORD secrets.' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const results = []

    for (const user of MASTER_USERS) {
      // Check if user already exists
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
      const existingUser = existingUsers?.users?.find(u => u.email === user.email)

      let userId: string

      if (existingUser) {
        userId = existingUser.id
        results.push({ email: user.email, status: 'already exists', userId })
      } else {
        // Create user
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: user.email,
          password: user.password,
          email_confirm: true,
        })

        if (createError) {
          results.push({ email: user.email, status: 'error', error: createError.message })
          continue
        }

        userId = newUser.user.id
        results.push({ email: user.email, status: 'created', userId })
      }

      // Check if already has master role
      const { data: existingRole } = await supabaseAdmin
        .from('user_roles')
        .select('id')
        .eq('user_id', userId)
        .eq('role', 'master')
        .maybeSingle()

      if (!existingRole) {
        // Add master role
        const { error: roleError } = await supabaseAdmin
          .from('user_roles')
          .insert({ user_id: userId, role: 'master' })

        if (roleError) {
          results.push({ email: user.email, roleStatus: 'error', error: roleError.message })
        } else {
          results.push({ email: user.email, roleStatus: 'master role added' })
        }
      } else {
      results.push({ email: user.email, roleStatus: 'already has master role' })
      }
    }

    // Process admin users
    for (const user of ADMIN_USERS) {
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
      const existingUser = existingUsers?.users?.find(u => u.email === user.email)

      let userId: string

      if (existingUser) {
        userId = existingUser.id
        results.push({ email: user.email, status: 'already exists', userId })
      } else {
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: user.email,
          password: user.password,
          email_confirm: true,
        })

        if (createError) {
          results.push({ email: user.email, status: 'error', error: createError.message })
          continue
        }

        userId = newUser.user.id
        results.push({ email: user.email, status: 'created', userId })
      }

      // Check if already has admin role
      const { data: existingRole } = await supabaseAdmin
        .from('user_roles')
        .select('id')
        .eq('user_id', userId)
        .eq('role', 'admin')
        .maybeSingle()

      if (!existingRole) {
        const { error: roleError } = await supabaseAdmin
          .from('user_roles')
          .insert({ user_id: userId, role: 'admin' })

        if (roleError) {
          results.push({ email: user.email, roleStatus: 'error', error: roleError.message })
        } else {
          results.push({ email: user.email, roleStatus: 'admin role added' })
        }
      } else {
        results.push({ email: user.email, roleStatus: 'already has admin role' })
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: unknown) {
    const origin = req.headers.get("origin");
    const corsHeaders = getCorsHeaders(origin);
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
