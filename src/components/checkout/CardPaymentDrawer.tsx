import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CreditCard, Loader2, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useCart } from "@/contexts/CartContext";
import { translateError } from "@/lib/error-messages";

interface CardPaymentDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  orderNumber: string;
  restaurantId: string;
  restaurantSlug?: string;
  total: number;
  customerName: string;
  deliveryMethod: "pickup" | "delivery";
  mpPublicKey: string;
}

type CardStatus = "form" | "processing" | "approved" | "rejected" | "in_process" | "challenge";

interface ThreeDSChallenge {
  external_resource_url: string;
  creq: string;
  payment_id: string;
}

export function CardPaymentDrawer({
  open,
  onOpenChange,
  orderId,
  orderNumber,
  restaurantId,
  restaurantSlug,
  total,
  customerName,
  deliveryMethod,
  mpPublicKey,
}: CardPaymentDrawerProps) {
  const navigate = useNavigate();
  const { clearCart } = useCart();
  const [status, setStatus] = useState<CardStatus>("form");
  const [loading, setLoading] = useState(false);
  const [mpReady, setMpReady] = useState(false);
  const [mpInstance, setMpInstance] = useState<any>(null);

  // Form fields
  const [cardNumber, setCardNumber] = useState("");
  const [cardholderName, setCardholderName] = useState("");
  const [expirationMonth, setExpirationMonth] = useState("");
  const [expirationYear, setExpirationYear] = useState("");
  const [securityCode, setSecurityCode] = useState("");
  const [docNumber, setDocNumber] = useState("");
  const [email, setEmail] = useState("");
  const [installments, setInstallments] = useState("1");
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [issuerId, setIssuerId] = useState("");

  // Desafio 3D Secure (autenticação no banco emissor)
  const [challenge, setChallenge] = useState<ThreeDSChallenge | null>(null);
  const challengeFormRef = useRef<HTMLFormElement | null>(null);

  // Load MercadoPago SDK
  useEffect(() => {
    if (!open || !mpPublicKey) return;

    // Device fingerprint do Mercado Pago: popula window.MP_DEVICE_SESSION_ID, sinal
    // antifraude que reduz rejeições cc_rejected_high_risk. Carregado uma única vez.
    if (!document.getElementById("mp-device-script")) {
      const deviceScript = document.createElement("script");
      deviceScript.id = "mp-device-script";
      deviceScript.src = "https://www.mercadopago.com/v2/security.js";
      deviceScript.setAttribute("view", "checkout");
      deviceScript.async = true;
      document.head.appendChild(deviceScript);
    }

    const loadMP = async () => {
      // Load script if not present
      if (!document.getElementById("mp-sdk-script")) {
        const script = document.createElement("script");
        script.id = "mp-sdk-script";
        script.src = "https://sdk.mercadopago.com/js/v2";
        script.async = true;
        script.onload = () => {
          const mp = new (window as any).MercadoPago(mpPublicKey, { locale: "pt-BR" });
          setMpInstance(mp);
          setMpReady(true);
        };
        document.head.appendChild(script);
      } else if ((window as any).MercadoPago) {
        const mp = new (window as any).MercadoPago(mpPublicKey, { locale: "pt-BR" });
        setMpInstance(mp);
        setMpReady(true);
      }
    };

    loadMP();
  }, [open, mpPublicKey]);

  // Detect payment method from card number
  useEffect(() => {
    if (!mpInstance || cardNumber.replace(/\s/g, "").length < 6) return;

    const bin = cardNumber.replace(/\s/g, "").substring(0, 6);
    mpInstance.getPaymentMethods({ bin }).then((result: any) => {
      if (result.results?.length > 0) {
        const method = result.results[0];
        setPaymentMethodId(method.id);
        if (method.issuer?.id) setIssuerId(String(method.issuer.id));
      }
    }).catch(() => {});
  }, [mpInstance, cardNumber]);

  const formatCardNumber = (value: string) => {
    const digits = value.replace(/\D/g, "").substring(0, 16);
    return digits.replace(/(\d{4})(?=\d)/g, "$1 ");
  };

  const formatCPF = (value: string) => {
    const digits = value.replace(/\D/g, "").substring(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  };

  const handleApproved = useCallback(async () => {
    setStatus("approved");

    // Send WhatsApp order confirmation after payment is confirmed
    if (restaurantId && orderId) {
      supabase.functions.invoke("whatsapp-bot", {
        body: {
          action: "send_order_confirmation",
          restaurant_id: restaurantId,
          order_id: orderId,
        },
      }).catch(() => {});
    }

    // Save order history
    const { saveOrderToHistory } = await import("@/hooks/useOrderHistory");
    saveOrderToHistory({
      orderId: orderNumber,
      customerName,
      deliveryMethod,
      total,
      paymentStatus: "paid",
      dbOrderId: orderId,
      restaurantId,
      restaurantSlug,
    });

    // Navigate after delay
    setTimeout(() => {
      clearCart();
      onOpenChange(false);
      const params = new URLSearchParams({
        pedido: orderNumber,
        nome: customerName,
        entrega: deliveryMethod,
        total: total.toString(),
        ...(restaurantSlug ? { loja: restaurantSlug } : {}),
      });
      navigate(`/pedido?${params.toString()}`);
    }, 2000);
  }, [restaurantId, orderId, orderNumber, customerName, deliveryMethod, total, restaurantSlug, clearCart, onOpenChange, navigate]);

  // Desafio 3DS: submete o creq no iframe e faz polling do resultado no backend
  useEffect(() => {
    if (status !== "challenge" || !challenge) return;

    challengeFormRef.current?.submit();

    const startedAt = Date.now();
    const TIMEOUT_MS = 6 * 60 * 1000;
    let stopped = false;

    const interval = setInterval(async () => {
      if (stopped) return;

      if (Date.now() - startedAt > TIMEOUT_MS) {
        stopped = true;
        clearInterval(interval);
        setStatus("in_process");
        return;
      }

      try {
        const { data } = await supabase.functions.invoke("check-card-status", {
          body: {
            order_id: orderId,
            payment_id: challenge.payment_id,
            restaurant_id: restaurantId,
          },
        });

        if (!data?.success) return;

        if (data.status === "approved") {
          stopped = true;
          clearInterval(interval);
          handleApproved();
        } else if (data.status === "rejected" || data.status === "cancelled") {
          stopped = true;
          clearInterval(interval);
          setStatus("rejected");
        }
      } catch {
        // erro transitório de rede: tenta de novo no próximo tick
      }
    }, 3000);

    return () => {
      stopped = true;
      clearInterval(interval);
    };
  }, [status, challenge, orderId, restaurantId, handleApproved]);

  const handleSubmit = async () => {
    if (!mpInstance) {
      toast.error("Erro ao processar pagamento", {
        description: "SDK do Mercado Pago não carregado",
      });
      return;
    }

    const cleanCardNumber = cardNumber.replace(/\s/g, "");
    if (cleanCardNumber.length < 13 || !cardholderName || !expirationMonth || !expirationYear || !securityCode || !docNumber || !email) {
      toast.error("Erro ao processar pagamento", {
        description: "Preencha todos os campos",
      });
      return;
    }

    setLoading(true);
    setStatus("processing");

    try {
      // Create card token via MP SDK
      const tokenResult = await mpInstance.createCardToken({
        cardNumber: cleanCardNumber,
        cardholderName,
        cardExpirationMonth: expirationMonth,
        cardExpirationYear: expirationYear,
        securityCode,
        identificationType: "CPF",
        identificationNumber: docNumber.replace(/\D/g, ""),
      });

      if (!tokenResult?.id) {
        throw new Error("Erro ao tokenizar cartão");
      }

      // Divide o nome do titular em first/last name para enriquecer o payer no MP.
      const nameParts = cardholderName.trim().split(/\s+/);
      const payerFirstName = nameParts[0] || null;
      const payerLastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : null;

      // Send to backend
      const { data, error } = await supabase.functions.invoke("process-card-payment", {
        body: {
          order_id: orderId,
          restaurant_id: restaurantId,
          token: tokenResult.id,
          installments: parseInt(installments),
          payer_email: email,
          payer_doc_number: docNumber.replace(/\D/g, ""),
          payment_method_id: paymentMethodId,
          issuer_id: issuerId || null,
          device_id: (window as any).MP_DEVICE_SESSION_ID || null,
          payer_first_name: payerFirstName,
          payer_last_name: payerLastName,
        },
      });

      if (error) {
        throw new Error("Erro ao processar pagamento");
      }

      if (!data?.success) {
        throw new Error(data?.error || "Falha no pagamento");
      }

      if (data.status === "approved") {
        handleApproved();
      } else if (data.status === "pending_challenge" && data.three_ds?.external_resource_url && data.three_ds?.creq) {
        // Banco exige autenticação 3DS: renderiza o desafio e faz polling do resultado
        setChallenge({
          external_resource_url: data.three_ds.external_resource_url,
          creq: data.three_ds.creq,
          payment_id: String(data.payment_id),
        });
        setStatus("challenge");
      } else if (data.status === "rejected") {
        setStatus("rejected");
      } else if (data.status === "in_process") {
        setStatus("in_process");
      }
    } catch (err: any) {
      console.error("Card payment error:", err);
      setStatus("rejected");
      const translatedError = translateError(err);
      toast.error("Erro ao processar pagamento", {
        description: translatedError,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = () => {
    setStatus("form");
    setSecurityCode("");
    setChallenge(null);
  };

  // Reset on close
  useEffect(() => {
    if (!open) {
      setStatus("form");
      setCardNumber("");
      setCardholderName("");
      setExpirationMonth("");
      setExpirationYear("");
      setSecurityCode("");
      setDocNumber("");
      setEmail("");
      setInstallments("1");
      setPaymentMethodId("");
      setIssuerId("");
      setChallenge(null);
    }
  }, [open]);

  const formatCurrency = (value: number) =>
    value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 15 }, (_, i) => String(currentYear + i));

  const isFormValid = cardNumber.replace(/\s/g, "").length >= 13 &&
    cardholderName.length >= 3 &&
    expirationMonth && expirationYear &&
    securityCode.length >= 3 &&
    docNumber.replace(/\D/g, "").length === 11 &&
    email.includes("@");

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh] max-w-md mx-auto" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DrawerHeader className="border-b border-border px-4 py-3">
          <div className="flex items-center gap-3">
            {status === "form" && (
              <button
                onClick={() => onOpenChange(false)}
                className="p-2 -ml-2 hover:bg-muted rounded-full transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <DrawerTitle className="text-lg font-bold flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Pagamento com Cartão
            </DrawerTitle>
          </div>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto p-4">
          {status === "form" && (
            <div className="space-y-4">
              {!mpReady && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  <span className="ml-2 text-sm text-muted-foreground">Carregando...</span>
                </div>
              )}

              {mpReady && (
                <>
                  {/* Card Number */}
                  <div className="space-y-1.5">
                    <Label className="text-sm">Número do cartão</Label>
                    <Input
                      placeholder="0000 0000 0000 0000"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                      inputMode="numeric"
                      className="h-11"
                    />
                  </div>

                  {/* Cardholder Name */}
                  <div className="space-y-1.5">
                    <Label className="text-sm">Nome no cartão</Label>
                    <Input
                      placeholder="Como está no cartão"
                      value={cardholderName}
                      onChange={(e) => setCardholderName(e.target.value.toUpperCase())}
                      className="h-11"
                    />
                  </div>

                  {/* Expiration & CVV */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-sm">Mês</Label>
                      <Select value={expirationMonth} onValueChange={setExpirationMonth}>
                        <SelectTrigger className="h-11">
                          <SelectValue placeholder="MM" />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 12 }, (_, i) => {
                            const m = String(i + 1).padStart(2, "0");
                            return <SelectItem key={m} value={m}>{m}</SelectItem>;
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm">Ano</Label>
                      <Select value={expirationYear} onValueChange={setExpirationYear}>
                        <SelectTrigger className="h-11">
                          <SelectValue placeholder="AAAA" />
                        </SelectTrigger>
                        <SelectContent>
                          {years.map(y => (
                            <SelectItem key={y} value={y}>{y}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm">CVV</Label>
                      <Input
                        placeholder="123"
                        value={securityCode}
                        onChange={(e) => setSecurityCode(e.target.value.replace(/\D/g, "").substring(0, 4))}
                        inputMode="numeric"
                        className="h-11"
                      />
                    </div>
                  </div>

                  {/* CPF */}
                  <div className="space-y-1.5">
                    <Label className="text-sm">CPF do titular</Label>
                    <Input
                      placeholder="000.000.000-00"
                      value={docNumber}
                      onChange={(e) => setDocNumber(formatCPF(e.target.value))}
                      inputMode="numeric"
                      className="h-11"
                    />
                  </div>

                  {/* Email */}
                  <div className="space-y-1.5">
                    <Label className="text-sm">E-mail do titular</Label>
                    <Input
                      type="email"
                      placeholder="email@exemplo.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-11"
                    />
                  </div>

                  {/* Installments */}
                  <div className="space-y-1.5">
                    <Label className="text-sm">Parcelas</Label>
                    <Select value={installments} onValueChange={setInstallments}>
                      <SelectTrigger className="h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1x de {formatCurrency(total)} (sem juros)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Total */}
                  <div className="flex justify-between items-center py-3 border-t border-border font-bold text-lg">
                    <span>Total</span>
                    <span>{formatCurrency(total)}</span>
                  </div>
                </>
              )}
            </div>
          )}

          {status === "challenge" && challenge && (
            <div className="flex flex-col items-center gap-3">
              <p className="text-sm text-muted-foreground text-center">
                Seu banco pediu uma confirmação de segurança. Autentique a compra abaixo para concluir o pagamento.
              </p>
              <form
                ref={challengeFormRef}
                method="POST"
                action={challenge.external_resource_url}
                target="mp-3ds-frame"
                className="hidden"
              >
                <input type="hidden" name="creq" value={challenge.creq} />
              </form>
              <iframe
                name="mp-3ds-frame"
                title="Autenticação do banco"
                className="w-full rounded-lg border border-border bg-background"
                style={{ height: "min(500px, 60vh)" }}
              />
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Aguardando confirmação do banco...
              </div>
            </div>
          )}

          {status === "processing" && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <Loader2 className="w-12 h-12 animate-spin text-primary" />
              <p className="text-lg font-medium">Processando pagamento...</p>
              <p className="text-sm text-muted-foreground">Aguarde, não feche esta tela</p>
            </div>
          )}

          {status === "approved" && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <CheckCircle className="w-16 h-16 text-green-500" />
              <p className="text-xl font-bold text-green-600">Pagamento aprovado!</p>
              <p className="text-sm text-muted-foreground">Redirecionando...</p>
            </div>
          )}

          {status === "rejected" && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <XCircle className="w-16 h-16 text-destructive" />
              <p className="text-xl font-bold text-destructive">Pagamento recusado</p>
              <p className="text-sm text-muted-foreground text-center">
                Verifique os dados do cartão ou tente outro método de pagamento.
              </p>
              <Button onClick={handleRetry} variant="outline" className="mt-4">
                Tentar novamente
              </Button>
            </div>
          )}

          {status === "in_process" && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <AlertTriangle className="w-16 h-16 text-yellow-500" />
              <p className="text-xl font-bold">Pagamento em análise</p>
              <p className="text-sm text-muted-foreground text-center">
                Seu pagamento está sendo processado. Você receberá uma confirmação em breve.
              </p>
              <Button
                onClick={() => {
                  clearCart();
                  onOpenChange(false);
                  const params = new URLSearchParams({
                    pedido: orderNumber,
                    nome: customerName,
                    entrega: deliveryMethod,
                    total: total.toString(),
                    ...(restaurantSlug ? { loja: restaurantSlug } : {}),
                  });
                  navigate(`/pedido?${params.toString()}`);
                }}
                className="mt-4"
              >
                Ver meu pedido
              </Button>
            </div>
          )}
        </div>

        {/* Footer - only for form */}
        {status === "form" && mpReady && (
          <div className="p-4 border-t border-border safe-area-bottom">
            <Button
              onClick={handleSubmit}
              disabled={!isFormValid || loading}
              className="w-full h-12 text-base font-bold"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Processando...
                </>
              ) : (
                <>Pagar {formatCurrency(total)}</>
              )}
            </Button>
            <p className="text-xs text-muted-foreground text-center mt-2">
              Pagamento seguro processado pelo Mercado Pago
            </p>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}
