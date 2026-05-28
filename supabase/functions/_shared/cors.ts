// Shared CORS configuration for edge functions
// Restricts access to known origins only

const allowedOrigins = [
  "https://menufly.lovable.app",
  "https://menufly.com.br",
  "https://www.menufly.com.br",
  "https://id-preview--7c949e48-0a46-47da-a818-5948abd25083.lovable.app",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:8080",
];

const allowedOriginSuffixes = [
  ".lovable.app",
  ".lovableproject.com",
];

export const getCorsHeaders = (origin: string | null) => {
  const isAllowed = Boolean(
    origin && (
      allowedOrigins.includes(origin) ||
      allowedOriginSuffixes.some((suffix) => origin.endsWith(suffix))
    )
  );
  
  return {
    "Access-Control-Allow-Origin": isAllowed && origin ? origin : allowedOrigins[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Access-Control-Allow-Credentials": "true",
  };
};

// For truly public endpoints that need wildcard CORS (like checkout embeds)
export const publicCorsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
