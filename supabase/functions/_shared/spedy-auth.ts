import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export function createServiceRoleClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

interface AuthResult {
  ok: true;
  userId: string;
}

interface AuthError {
  ok: false;
  status: number;
  error: string;
}

// Autentica o chamador via Bearer token e confirma que ele tem acesso
// (dono ou colaborador ativo) ao restaurant_id informado.
export async function requireRestaurantAccess(
  supabase: SupabaseClient,
  req: Request,
  restaurantId: string
): Promise<AuthResult | AuthError> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { ok: false, status: 401, error: "Autenticação necessária." };
  }

  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return { ok: false, status: 401, error: "Token inválido." };
  }

  const { data: hasAccess, error: rpcError } = await supabase.rpc("user_has_access_to_restaurant", {
    p_user_id: user.id,
    p_restaurant_id: restaurantId,
  });

  if (rpcError || !hasAccess) {
    return { ok: false, status: 403, error: "Sem permissão para este restaurante." };
  }

  return { ok: true, userId: user.id };
}
