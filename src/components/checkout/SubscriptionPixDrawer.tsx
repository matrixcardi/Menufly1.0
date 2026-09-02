import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Copy, Check, Loader2, QrCode, Clock, AlertCircle, CheckCircle2 } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: "start" | "elite";
  includeImplementation: boolean;
  onActivated: () => void;
}

export function SubscriptionPixDrawer({
  open,
  onOpenChange,
  plan,
  includeImplementation,
  onActivated,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [pixCode, setPixCode] = useState<string | null>(null);
  const [qrImageBase64, setQrImageBase64] = useState<string | null>(null);
  const [amount, setAmount] = useState<number>(0);
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60 * 60);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [checking, setChecking] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const formatCurrency = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m.toString().padStart(2, "0")}:${r.toString().padStart(2, "0")}`;
  };

  const verify = useCallback(async () => {
    if (!paymentId || confirmed || expired) return;
    try {
      const { data } = await supabase.functions.invoke("hypercash-verify-transaction", {
        body: { transaction_id: paymentId },
      });
      if (data?.verified) {
        setConfirmed(true);
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
        toast.success("Pagamento confirmado! Assinatura ativada ✅");
        setTimeout(() => {
          onActivated();
          onOpenChange(false);
        }, 2000);
      }
    } catch {
      // silent
    }
  }, [paymentId, confirmed, expired, onActivated, onOpenChange]);

  // Poll
  useEffect(() => {
    if (!open || !paymentId || confirmed || expired || loading || error) return;
    const t = setTimeout(() => verify(), 5000);
    pollRef.current = setInterval(() => verify(), 5000);
    return () => {
      clearTimeout(t);
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [open, paymentId, confirmed, expired, loading, error, verify]);

  // Generate PIX
  useEffect(() => {
    if (!open) return;
    const fetchPix = async () => {
      setLoading(true);
      setError(null);
      setExpired(false);
      setTimeLeft(60 * 60);
      setPixCode(null);
      setQrImageBase64(null);
      setPaymentId(null);
      setConfirmed(false);
      try {
        const { data, error: fnError } = await supabase.functions.invoke(
          "hypercash-create-pix-subscription",
          { body: { plan, includeImplementation } }
        );
        if (fnError) throw new Error(fnError.message || "Erro ao gerar PIX");
        if (data?.success && data?.qr_code && data?.payment_id) {
          setPixCode(data.qr_code);
          setQrImageBase64(data.qr_code_base64 || null);
          setPaymentId(String(data.payment_id));
          setAmount(Number(data.amount || 0));
        } else {
          throw new Error(data?.error || "Erro ao gerar QR Code PIX");
        }
      } catch (err: any) {
        setError(err.message || "Erro ao carregar PIX");
      } finally {
        setLoading(false);
      }
    };
    fetchPix();
  }, [open, plan, includeImplementation]);

  const qrCodeUrl = useMemo(() => {
    if (qrImageBase64) {
      if (qrImageBase64.startsWith("data:")) return qrImageBase64;
      return `data:image/png;base64,${qrImageBase64}`;
    }
    if (!pixCode) return null;
    return `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(pixCode)}`;
  }, [pixCode, qrImageBase64]);

  // Countdown
  useEffect(() => {
    if (!open || loading || error || expired || confirmed) return;
    const i = setInterval(() => {
      setTimeLeft((p) => {
        if (p <= 1) {
          clearInterval(i);
          setExpired(true);
          return 0;
        }
        return p - 1;
      });
    }, 1000);
    return () => clearInterval(i);
  }, [open, loading, error, expired, confirmed]);

  const handleCopy = useCallback(async () => {
    if (!pixCode) return;
    try {
      await navigator.clipboard.writeText(pixCode);
      setCopied(true);
      toast.success("Código PIX copiado!");
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // fallback
      const ta = document.createElement("textarea");
      ta.value = pixCode;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      toast.success("Código PIX copiado!");
      setTimeout(() => setCopied(false), 3000);
    }
  }, [pixCode]);

  const handleManual = async () => {
    if (!paymentId || checking) return;
    setChecking(true);
    await verify();
    if (!confirmed) {
      toast.info("Pagamento ainda não identificado", {
        description: "Aguarde alguns instantes após realizar o pagamento.",
      });
    }
    setChecking(false);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[95vh] max-w-md mx-auto">
        <DrawerHeader className="border-b border-border px-4 py-3">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${confirmed ? "bg-green-500/20" : "bg-green-500/10"}`}>
              {confirmed ? (
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              ) : (
                <QrCode className="w-5 h-5 text-green-600" />
              )}
            </div>
            <DrawerTitle className="text-lg font-bold">
              {confirmed ? "Assinatura Ativada!" : "Pagamento via PIX"}
            </DrawerTitle>
          </div>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {loading && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <Loader2 className="w-10 h-10 animate-spin text-primary" />
              <p className="text-muted-foreground text-sm">Gerando QR Code PIX...</p>
            </div>
          )}

          {error && !expired && (
            <div className="flex flex-col items-center justify-center py-8 gap-4">
              <div className="p-4 rounded-full bg-destructive/10">
                <AlertCircle className="w-8 h-8 text-destructive" />
              </div>
              <div className="text-center space-y-2">
                <p className="font-medium text-destructive">Erro ao gerar PIX</p>
                <p className="text-sm text-muted-foreground">{error}</p>
              </div>
              <Button onClick={() => onOpenChange(false)} variant="outline">
                Fechar
              </Button>
            </div>
          )}

          {expired && (
            <div className="flex flex-col items-center justify-center py-8 gap-4">
              <div className="p-4 rounded-full bg-destructive/10">
                <Clock className="w-8 h-8 text-destructive" />
              </div>
              <div className="text-center space-y-2">
                <p className="text-lg font-bold text-destructive">Tempo esgotado</p>
                <p className="text-sm text-muted-foreground">
                  O prazo para pagamento expirou. Tente novamente.
                </p>
              </div>
              <Button onClick={() => onOpenChange(false)}>Fechar</Button>
            </div>
          )}

          {confirmed && !expired && (
            <div className="flex flex-col items-center justify-center py-8 gap-4">
              <div className="p-4 rounded-full bg-green-500/20 animate-pulse">
                <CheckCircle2 className="w-12 h-12 text-green-600" />
              </div>
              <div className="text-center space-y-2">
                <p className="text-xl font-bold text-green-600">Pagamento confirmado!</p>
                <p className="text-sm text-muted-foreground">
                  Sua assinatura {plan === "elite" ? "Elite" : "Start"} foi ativada.
                </p>
              </div>
            </div>
          )}

          {!loading && !error && !expired && !confirmed && (
            <>
              <div className="text-center space-y-1">
                <p className="text-sm text-muted-foreground">
                  MenuFly {plan === "elite" ? "Elite" : "Start"} — Mensal
                </p>
                <p className="text-3xl font-bold text-foreground">{formatCurrency(amount)}</p>
              </div>

              <div className="flex items-center justify-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className={`font-mono font-medium ${timeLeft < 300 ? "text-destructive" : "text-muted-foreground"}`}>
                  Expira em {formatTime(timeLeft)}
                </span>
              </div>

              {qrCodeUrl && (
                <div className="flex justify-center">
                  <div className="bg-white p-4 rounded-xl shadow-sm border">
                    <img src={qrCodeUrl} alt="QR Code PIX" className="w-56 h-56 object-contain" />
                  </div>
                </div>
              )}

              {pixCode && (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-center text-muted-foreground">
                    Ou copie o código Copia e Cola:
                  </p>
                  <div className="relative">
                    <div className="bg-muted/50 border rounded-lg p-3 pr-12 text-xs font-mono break-all max-h-24 overflow-y-auto">
                      {pixCode}
                    </div>
                    <Button size="icon" variant="ghost" className="absolute top-2 right-2" onClick={handleCopy}>
                      {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>

                  <Button onClick={handleCopy} variant="outline" className="w-full h-12 text-base font-semibold gap-2">
                    {copied ? (
                      <>
                        <Check className="w-5 h-5 text-green-600" />
                        Copiado!
                      </>
                    ) : (
                      <>
                        <Copy className="w-5 h-5" />
                        Copiar código PIX
                      </>
                    )}
                  </Button>
                </div>
              )}

              <div className="text-center space-y-1">
                <p className="text-xs text-muted-foreground">✓ Pagamento com confirmação automática</p>
                <div className="flex items-center justify-center gap-1.5">
                  <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">Aguardando pagamento...</p>
                </div>
              </div>
            </>
          )}
        </div>

        {!loading && !error && !expired && !confirmed && (
          <div className="p-4 border-t border-border">
            <Button
              onClick={handleManual}
              disabled={checking || !paymentId}
              variant="outline"
              className="w-full h-12 text-base font-bold"
            >
              {checking ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Verificando...
                </>
              ) : (
                "Já paguei • Verificar pagamento"
              )}
            </Button>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}