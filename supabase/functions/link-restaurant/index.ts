import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get the requesting admin's user from JWT
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: requestingUser }, error: userError } = await userClient.auth.getUser();
    if (userError || !requestingUser) {
      return new Response(JSON.stringify({ error: "Sessão inválida" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body?.password === "string" ? body.password : "";

    if (!email || !password) {
      return new Response(JSON.stringify({ error: "E-mail e senha são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify the other account credentials using anon client (service role can't signInWithPassword)
    const signInClient = createClient(supabaseUrl, anonKey);

    const attemptSignIn = async (attemptPassword: string) => {
      return signInClient.auth.signInWithPassword({
        email,
        password: attemptPassword,
      });
    };

    let { data: signInData, error: signInError } = await attemptSignIn(password);

    // Common copy/paste issue: trailing spaces in password
    if ((signInError || !signInData.user) && password !== password.trim()) {
      const retry = await attemptSignIn(password.trim());
      signInData = retry.data;
      signInError = retry.error;
    }

    if (signInError || !signInData.user) {
      console.error("Sign-in error:", { email, message: signInError?.message });
      return new Response(
        JSON.stringify({
          success: false,
          error: "Credenciais inválidas. Verifique o e-mail/senha da outra conta ou use a opção de recuperação de senha.",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { error: cleanupError } = await signInClient.auth.signOut();
    if (cleanupError) {
      console.warn("Failed to clean up sign-in session:", cleanupError.message);
    }

    const otherUserId = signInData.user.id;

    // Can't link own account
    if (otherUserId === requestingUser.id) {
      return new Response(JSON.stringify({ error: "Você não pode vincular sua própria conta." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get restaurants from the other account
    const { data: otherRestaurants, error: restError } = await supabase
      .from("restaurants")
      .select("id, name, slug, logo_url")
      .eq("user_id", otherUserId);

    if (restError) throw restError;

    if (!otherRestaurants || otherRestaurants.length === 0) {
      return new Response(JSON.stringify({ error: "Nenhum restaurante encontrado nessa conta." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Add the requesting user as collaborator on each restaurant AND grant admin role
    const linkedIds: string[] = [];
    for (const rest of otherRestaurants) {
      // Check if already linked
      const { data: existing } = await supabase
        .from("restaurant_collaborators")
        .select("id")
        .eq("restaurant_id", rest.id)
        .eq("user_id", requestingUser.id)
        .maybeSingle();

      if (existing) {
        linkedIds.push(rest.id);
        continue;
      }

      const { error: insertError } = await supabase
        .from("restaurant_collaborators")
        .insert({
          restaurant_id: rest.id,
          user_id: requestingUser.id,
        });

      if (!insertError) {
        linkedIds.push(rest.id);
      }
    }

    // Ensure the requesting user has admin role (not just collaborator)
    const { data: existingAdminRole } = await supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", requestingUser.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!existingAdminRole) {
      await supabase
        .from("user_roles")
        .insert({ user_id: requestingUser.id, role: "admin" });
    }

    if (linkedIds.length === 0) {
      return new Response(JSON.stringify({ error: "Não foi possível vincular os restaurantes." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      linked: otherRestaurants.filter(r => linkedIds.includes(r.id)),
      message: `${linkedIds.length} restaurante(s) vinculado(s) com sucesso!`,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error linking restaurant:", error);
    return new Response(JSON.stringify({ error: "Erro interno do servidor" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
