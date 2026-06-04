import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
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
import { translateError } from "@/lib/error-messages";

interface PixPaymentDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  orderNumber: string;
  restaurantId: string;
  restaurantSlug?: string;
  total: number;
  customerName: string;
  deliveryMethod: "pickup" | "delivery";
}

export function PixPaymentDrawer({
  open,
  onOpenChange,
  orderId,
  orderNumber,
  restaurantId,
  restaurantSlug,
  total,
  customerName,
  deliveryMethod,
}: PixPaymentDrawerProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [pixCode, setPixCode] = useState<string | null>(null);
  const [qrImageBase64, setQrImageBase64] = useState<string | null>(null);
  const [gatewayUsed, setGatewayUsed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30 * 60);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [checkingPayment, setCheckingPayment] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const formatCurrency = (value: number) =>
    value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const goToConfirmation = useCallback(() => {
    import("@/hooks/useOrderHistory").then(({ updateOrderPaymentStatus }) => {
      updateOrderPaymentStatus(orderNumber, "paid");
    });

    onOpenChange(false);
    const params = new URLSearchParams({
      pedido: orderNumber,
      nome: customerName,
      entrega: deliveryMethod,
      total: total.toString(),
      ...(restaurantSlug ? { loja: restaurantSlug } : {}),
    });
    navigate(`/pedido?${params.toString()}`);
  }, [orderNumber, customerName, deliveryMethod, total, restaurantSlug, navigate, onOpenChange]);

  const checkPaymentStatus = useCallback(async () => {
    if (!paymentId || !orderId || !restaurantId || paymentConfirmed || expired) return;

    try {
      const { data, error: fnError } = await supabase.functions.invoke("check-pix-status", {
        body: { order_id: orderId, payment_id: paymentId, restaurant_id: restaurantId },
      });

      if (fnError) {
        console.error("Error checking PIX status:", fnError);
        return;
      }

      if (data?.success && data?.status === "approved") {
        setPaymentConfirmed(true);
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
        toast.success("Pagamento confirmado! ✅");

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

        setTimeout(() => goToConfirmation(), 2000);
      }
    } catch (err) {
      console.error("Error checking PIX status:", err);
    }
  }, [paymentId, orderId, restaurantId, paymentConfirmed, expired, goToConfirmation]);

  useEffect(() => {
    if (!open || !paymentId || !gatewayUsed || paymentConfirmed || expired || loading || error) return;

    const timeout = setTimeout(() => {
      checkPaymentStatus();
    }, 5000);

    pollRef.current = setInterval(() => {
      checkPaymentStatus();
    }, 5000);

    return () => {
      clearTimeout(timeout);
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [open, paymentId, gatewayUsed, paymentConfirmed, expired, loading, error, checkPaymentStatus]);

  useEffect(() => {
    if (!open || !restaurantId) return;

    const fetchPix = async () => {
      setLoading(true);
      setError(null);
      setExpired(false);
      setTimeLeft(30 * 60);
      setPixCode(null);
      setQrImageBase64(null);
      setGatewayUsed(false);
      setPaymentId(null);
      setPaymentConfirmed(false);

      try {
        const { data: restaurant, error: fetchError } = await supabase
          .from("restaurants")
          .select("pix_gateway, pix_gateway_token")
          .eq("id", restaurantId)
          .single();

        if (fetchError) throw new Error("Erro ao buscar dados do restaurante");

        const hasGateway = (restaurant as any).pix_gateway && (restaurant as any).pix_gateway_token;
        if (!hasGateway) {
          throw new Error("PIX indisponível no momento para este restaurante.");
        }

        const { data: pixData, error: pixError } = await supabase.functions.invoke("generate-pix", {
          body: { order_id: orderId, restaurant_id: restaurantId },
        });

        if (pixError) {
          console.error("Gateway PIX error:", pixError);
          throw new Error("Não foi possível iniciar o pagamento PIX. Refaça o pedido com pagamento na entrega.");
        }

        if (pixData?.success && pixData?.qr_code && pixData?.payment_id) {
          setPixCode(pixData.qr_code);
          setQrImageBase64(pixData.qr_code_base64 || null);
          setGatewayUsed(true);
          setPaymentId(pixData.payment_id);
          return;
        }

        throw new Error(
          pixData?.error ||
            "Não foi possível gerar o QR Code PIX. Refaça o pedido e selecione pagamento na entrega."
        );
      } catch (err: any) {
        console.error("PIX fetch error:", err);
        setError(err.message || "Erro ao carregar dados do PIX");
      } finally {
        setLoading(false);
      }
    };

    fetchPix();
  }, [open, restaurantId, orderId]);

  const qrCodeUrl = useMemo(() => {
    if (qrImageBase64) {
      // Ensure proper data URI prefix for base64 images
      if (qrImageBase64.startsWith("data:")) return qrImageBase64;
      return `data:image/png;base64,${qrImageBase64}`;
    }
    if (!pixCode) return null;
    return `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(pixCode)}`;
  }, [pixCode, qrImageBase64]);

  useEffect(() => {
    if (!open || loading || error || expired || paymentConfirmed) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setExpired(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [open, loading, error, expired, paymentConfirmed]);

  const handleCopyKey = useCallback(async () => {
    if (!pixCode) return;
    try {
      await navigator.clipboard.writeText(pixCode);
      setCopied(true);
      toast.success("Código PIX copiado!");
      setTimeout(() => setCopied(false), 3000);
    } catch {
      const textArea = document.createElement("textarea");
      textArea.value = pixCode;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopied(true);
      toast.success("Código PIX copiado!");
      setTimeout(() => setCopied(false), 3000);
    }
  }, [pixCode]);

  const handleManualCheck = async () => {
    if (!paymentId || checkingPayment) return;
    setCheckingPayment(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("check-pix-status", {
        body: { order_id: orderId, payment_id: paymentId, restaurant_id: restaurantId },
      });

      if (fnError || !data?.success) {
        const translatedError = translateError(fnError || data?.error);
        toast.error("Erro ao verificar pagamento", {
          description: translatedError,
        });
        return;
      }

      if (data.status === "approved") {
        setPaymentConfirmed(true);
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
        toast.success("Pagamento confirmado! ✅");

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

        setTimeout(() => goToConfirmation(), 2000);
      } else {
        toast.info("Pagamento ainda não identificado", {
          description: "Aguarde alguns instantes após realizar o pagamento.",
        });
      }
    } finally {
      setCheckingPayment(false);
    }
  };

  useEffect(() => {
    if (!expired || !orderId) return;
    supabase
      .from("orders")
      .update({
        status: "cancelled",
        cancellation_reason: "Tempo para pagamento PIX expirado",
      })
      .eq("id", orderId)
      .eq("payment_status", "awaiting_payment")
      .then(() => {});
  }, [expired, orderId]);

  const handleDrawerClose = (isOpen: boolean) => {
    if (!isOpen && !expired && !paymentConfirmed && pixCode && timeLeft > 0) {
      toast.warning("Pagamento PIX pendente", {
        description: "Seu pedido será cancelado se o pagamento não for confirmado em " + formatTime(timeLeft) + ".",
        duration: 8000,
      });
    }
    onOpenChange(isOpen);
  };

  const handleBackToMenu = () => {
    onOpenChange(false);
    if (restaurantSlug) {
      navigate(`/${restaurantSlug}`);
      return;
    }
    navigate("/");
  };

  return (
    <Drawer open={open} onOpenChange={handleDrawerClose}>
      <DrawerContent className="max-h-[95vh] max-w-md mx-auto">
        <DrawerHeader className="border-b border-border px-4 py-3">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${paymentConfirmed ? "bg-green-500/20" : "bg-green-500/10"}`}>
              {paymentConfirmed ? (
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              ) : (
                <QrCode className="w-5 h-5 text-green-600" />
              )}
            </div>
            <DrawerTitle className="text-lg font-bold">
              {paymentConfirmed ? "Pagamento Confirmado!" : "Pagamento via PIX"}
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
                <p className="font-medium text-destructive">Erro ao carregar PIX</p>
                <p className="text-sm text-muted-foreground">
                  Não foi possível gerar o QR Code PIX neste momento.
                </p>
                <p className="text-sm text-muted-foreground">
                  Este pedido online não foi confirmado. Refaça o pedido e escolha pagamento na entrega/retirada.
                </p>
              </div>
              <Button onClick={handleBackToMenu} className="mt-4">
                Voltar e refazer pedido
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
                  O prazo para pagamento via PIX expirou e o pedido foi cancelado automaticamente.
                </p>
                <p className="text-sm text-muted-foreground">Para continuar, faça um novo pedido.</p>
              </div>
              <Button onClick={handleBackToMenu} className="mt-4 w-full h-12 text-base font-bold">
                Voltar ao cardápio
              </Button>
            </div>
          )}

          {paymentConfirmed && !expired && (
            <div className="flex flex-col items-center justify-center py-8 gap-4">
              <div className="p-4 rounded-full bg-green-500/20 animate-pulse">
                <CheckCircle2 className="w-12 h-12 text-green-600" />
              </div>
              <div className="text-center space-y-2">
                <p className="text-xl font-bold text-green-600">Pagamento confirmado!</p>
                <p className="text-sm text-muted-foreground">Seu pedido foi recebido e será preparado em breve.</p>
              </div>
              <Button
                onClick={goToConfirmation}
                className="mt-4 w-full h-12 text-base font-bold bg-green-600 hover:bg-green-700"
              >
                Acompanhar pedido
              </Button>
            </div>
          )}

          {!loading && !error && !expired && !paymentConfirmed && (
            <>
              <div className="text-center space-y-1">
                <p className="text-sm text-muted-foreground">Valor a pagar</p>
                <p className="text-3xl font-bold text-foreground">{formatCurrency(total)}</p>
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
                  <p className="text-sm font-medium text-center text-muted-foreground">Ou copie o código Copia e Cola:</p>
                  <div className="relative">
                    <div className="bg-muted/50 border rounded-lg p-3 pr-12 text-xs font-mono break-all max-h-24 overflow-y-auto">
                      {pixCode}
                    </div>
                    <Button size="icon" variant="ghost" className="absolute top-2 right-2" onClick={handleCopyKey}>
                      {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>

                  <Button onClick={handleCopyKey} variant="outline" className="w-full h-12 text-base font-semibold gap-2">
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

              {gatewayUsed && (
                <div className="text-center space-y-1">
                  <p className="text-xs text-muted-foreground">✓ Pagamento com confirmação automática</p>
                  <div className="flex items-center justify-center gap-1.5">
                    <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">Aguardando pagamento...</p>
                  </div>
                </div>
              )}

              <div className="bg-muted/30 rounded-lg p-4 space-y-2">
                <p className="text-sm font-medium">Como pagar:</p>
                <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Abra o app do seu banco</li>
                  <li>Escolha pagar via PIX</li>
                  <li>Escaneie o QR Code ou cole o código</li>
                  <li>Confirme o pagamento</li>
                  <li>A confirmação será automática</li>
                </ol>
              </div>
            </>
          )}
        </div>

        {!loading && !error && !expired && !paymentConfirmed && (
          <div className="p-4 border-t border-border safe-area-bottom space-y-2">
            <Button
              onClick={handleManualCheck}
              disabled={checkingPayment || !paymentId}
              variant="outline"
              className="w-full h-12 text-base font-bold"
            >
              {checkingPayment ? (
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
