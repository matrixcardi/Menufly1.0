import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Copy, Check, Loader2, QrCode, Clock, AlertCircle, CheckCircle2 } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { maskCpfCnpj, validateCPF } from "@/utils/cpfCnpj";
import { formatPhone } from "@/lib/validations";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { extractEdgeFunctionError } from "@/lib/edge-function-error";
import { logger } from "@/lib/logger";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: "start" | "elite";
  includeImplementation: boolean;
  onActivated: () => void;
}

/** Dados do pagador exigidos pela HyperCash para emitir a cobrança PIX. */
interface Payer {
  name: string;
  document: string;
  phone: string;
}

export function SubscriptionPixDrawer({
  open,
  onOpenChange,
  plan,
  includeImplementation,
  onActivated,
}: Props) {
  // A cobrança só é criada depois que o pagador se identifica: sem CPF a
  // HyperCash aceita o payload e o provedor recusa com "Erro ao realizar
  // pagamento", sem apontar o campo que falta.
  const [payer, setPayer] = useState<Payer | null>(null);
  const [name, setName] = useState("");
  const [cpf, setCpf] = useState("");
  const [phone, setPhone] = useState("");

  const [loading, setLoading] = useState(false);
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

  // Fechar o drawer descarta a cobrança em andamento: ao reabrir, o pagador
  // confirma os dados de novo antes de gerar outro QR.
  useEffect(() => {
    if (open) return;
    setPayer(null);
    setPixCode(null);
    setQrImageBase64(null);
    setPaymentId(null);
    setError(null);
    setExpired(false);
    setConfirmed(false);
  }, [open]);

  // Generate PIX
  useEffect(() => {
    if (!open || !payer) return;
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
          { body: { plan, includeImplementation, customer: payer } }
        );
        if (fnError) {
          const detail = await extractEdgeFunctionError(fnError, "Erro ao gerar PIX");
          logger.error("Falha ao gerar PIX da assinatura", { detail, plan });
          throw new Error(detail);
        }
        if (data?.success && data?.qr_code && data?.payment_id) {
          setPixCode(data.qr_code);
          setQrImageBase64(data.qr_code_base64 || null);
          setPaymentId(String(data.payment_id));
          setAmount(Number(data.amount || 0));
        } else {
          // 200 sem copia-e-cola: a função devolve `pix_raw` justamente para
          // revelar onde a HyperCash colocou o QR nessa resposta.
          logger.error("PIX gerado sem copia-e-cola", { data });
          throw new Error(data?.error || "Erro ao gerar QR Code PIX");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao carregar PIX");
      } finally {
        setLoading(false);
      }
    };
    fetchPix();
  }, [open, plan, includeImplementation, payer]);

  const handleSubmitPayer = () => {
    const digitsCpf = cpf.replace(/\D/g, "");
    const digitsPhone = phone.replace(/\D/g, "");

    if (name.trim().length < 3) return toast.error("Informe o nome completo do pagador.");
    if (!validateCPF(digitsCpf)) return toast.error("CPF inválido.");
    if (digitsPhone.length < 10) return toast.error("Telefone inválido.");

    setPayer({ name: name.trim(), document: digitsCpf, phone: digitsPhone });
  };

  const qrCodeUrl = useMemo(() => {
    if (qrImageBase64) {
      if (qrImageBase64.startsWith("data:")) return qrImageBase64;
      return `data:image/png;base64,${qrImageBase64}`;
    }
    if (!pixCode) return null;
    return `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(pixCode)}`;
  }, [pixCode, qrImageBase64]);

  // Countdown — só corre depois que existe um QR para expirar.
  useEffect(() => {
    if (!open || !pixCode || loading || error || expired || confirmed) return;
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
  }, [open, pixCode, loading, error, expired, confirmed]);

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
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    setError(null);
                    setPayer(null);
                  }}
                >
                  Tentar novamente
                </Button>
                <Button onClick={() => onOpenChange(false)} variant="outline">
                  Fechar
                </Button>
              </div>
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

          {!payer && !loading && !error && !expired && !confirmed && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                A HyperCash exige a identificação do pagador para emitir a cobrança PIX.
              </p>

              <div className="space-y-1.5">
                <Label className="text-sm">Nome completo</Label>
                <Input
                  placeholder="Como está no seu documento"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  className="h-11"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-sm">CPF</Label>
                  <Input
                    placeholder="000.000.000-00"
                    value={cpf}
                    // Trava em 11 dígitos: a HyperCash exige document.type = CPF.
                    onChange={(e) => setCpf(maskCpfCnpj(e.target.value.replace(/\D/g, "").slice(0, 11)))}
                    inputMode="numeric"
                    className="h-11"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Telefone</Label>
                  <Input
                    placeholder="(11) 99999-9999"
                    value={phone}
                    onChange={(e) => setPhone(formatPhone(e.target.value))}
                    inputMode="numeric"
                    autoComplete="tel"
                    className="h-11"
                  />
                </div>
              </div>

              <Button onClick={handleSubmitPayer} className="w-full h-11">
                <QrCode className="w-4 h-4 mr-2" />
                Gerar QR Code PIX
              </Button>
            </div>
          )}

          {payer && !loading && !error && !expired && !confirmed && (
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