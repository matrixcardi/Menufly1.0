import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, CheckCircle, XCircle, MailX } from "lucide-react";
import { Logo } from "@/components/Logo";

type Status = "loading" | "valid" | "already" | "invalid" | "success" | "error";

export default function Unsubscribe() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<Status>("loading");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus("invalid");
      return;
    }

    const validate = async () => {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${token}`,
          { headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } }
        );
        const data = await response.json();
        if (!response.ok) {
          setStatus("invalid");
        } else if (data.valid === false && data.reason === "already_unsubscribed") {
          setStatus("already");
        } else if (data.valid) {
          setStatus("valid");
        } else {
          setStatus("invalid");
        }
      } catch {
        setStatus("invalid");
      }
    };

    validate();
  }, [token]);

  const handleUnsubscribe = async () => {
    if (!token) return;
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke("handle-email-unsubscribe", {
        body: { token },
      });
      if (error) throw error;
      setStatus(data?.success ? "success" : "error");
    } catch {
      setStatus("error");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            <Logo className="h-8 w-auto" />
          </div>
          {status === "loading" && (
            <>
              <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-2" />
              <CardTitle>Verificando...</CardTitle>
            </>
          )}
          {status === "valid" && (
            <>
              <MailX className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
              <CardTitle>Cancelar inscrição</CardTitle>
              <CardDescription>
                Deseja parar de receber emails do MenuFly?
              </CardDescription>
            </>
          )}
          {status === "success" && (
            <>
              <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-2" />
              <CardTitle>Inscrição cancelada</CardTitle>
              <CardDescription>
                Você não receberá mais emails do MenuFly.
              </CardDescription>
            </>
          )}
          {status === "already" && (
            <>
              <CheckCircle className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
              <CardTitle>Já cancelada</CardTitle>
              <CardDescription>
                Sua inscrição já foi cancelada anteriormente.
              </CardDescription>
            </>
          )}
          {(status === "invalid" || status === "error") && (
            <>
              <XCircle className="w-10 h-10 text-destructive mx-auto mb-2" />
              <CardTitle>Link inválido</CardTitle>
              <CardDescription>
                Este link de cancelamento é inválido ou expirou.
              </CardDescription>
            </>
          )}
        </CardHeader>
        {status === "valid" && (
          <CardContent className="text-center">
            <Button
              onClick={handleUnsubscribe}
              disabled={processing}
              variant="destructive"
              className="w-full"
            >
              {processing ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processando...</>
              ) : (
                "Confirmar cancelamento"
              )}
            </Button>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
