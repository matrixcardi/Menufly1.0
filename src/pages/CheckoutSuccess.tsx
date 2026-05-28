import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function CheckoutSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const method = searchParams.get("method");
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    if (method === "pix" && sessionId) {
      // Verify PIX payment and activate subscription
      setVerifying(true);
      supabase.functions.invoke("verify-pix-subscription", {
        body: { sessionId },
      }).then(({ data, error }) => {
        setVerifying(false);
        if (error || !data?.verified) {
          console.error("PIX verification failed:", error || data);
        } else {
          setVerified(true);
        }
        // Redirect after brief delay
        setTimeout(() => {
          navigate(`/criar-conta${sessionId ? `?session_id=${sessionId}` : ""}`);
        }, 2000);
      });
    } else {
      // Card flow: redirect immediately
      const timer = setTimeout(() => {
        navigate(`/criar-conta${sessionId ? `?session_id=${sessionId}` : ""}`);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [navigate, sessionId, method]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        {verified ? (
          <>
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
            <p className="text-foreground font-semibold">Pagamento PIX confirmado!</p>
            <p className="text-muted-foreground text-sm">Redirecionando...</p>
          </>
        ) : (
          <>
            <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
            <p className="text-muted-foreground">
              {verifying ? "Verificando pagamento PIX..." : "Processando seu pagamento..."}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
