import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CreditCard, Banknote, QrCode, Loader2 } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useCart } from "@/contexts/CartContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { trackPurchase, trackAddPaymentInfo } from "@/lib/meta-pixel";
import { PixPaymentDrawer } from "./PixPaymentDrawer";
import { CardPaymentDrawer } from "./CardPaymentDrawer";

interface PaymentDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBack: () => void;
  customerInfo: { name: string; phone: string };
  deliveryMethod: "pickup" | "delivery";
  address?: {
    street: string;
    number: string;
    neighborhood: string;
    complement?: string;
    reference?: string;
  };
  deliveryFee?: number;
  restaurantId?: string;
  restaurantSlug?: string;
}

type PaymentMethodType = "cash" | "credit_card" | "debit_card" | "pix" | "card_online" | null;

export function PaymentDrawer({
  open,
  onOpenChange,
  onBack,
  customerInfo,
  deliveryMethod,
  address,
  deliveryFee = 0,
  restaurantId,
  restaurantSlug,
}: PaymentDrawerProps) {
  const navigate = useNavigate();
  const { items, coupon, subtotal, discount, total, clearCart, activeBenefits, hasFreeShipping } = useCart();
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodType>(null);
  const [cashChange, setCashChange] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pixEnabled, setPixEnabled] = useState(false);
  const [cashEnabled, setCashEnabled] = useState(true);
  const [cardEnabled, setCardEnabled] = useState(true);
  const [cardOnlineEnabled, setCardOnlineEnabled] = useState(false);
  const [mpPublicKey, setMpPublicKey] = useState<string | null>(null);
  
  // PIX flow state
  const [showPixDrawer, setShowPixDrawer] = useState(false);
  const [pixOrderId, setPixOrderId] = useState<string | null>(null);
  const [pixOrderNumber, setPixOrderNumber] = useState<string | null>(null);
  const [pixTotal, setPixTotal] = useState(0);

  // Card online flow state
  const [showCardDrawer, setShowCardDrawer] = useState(false);
  const [cardOrderId, setCardOrderId] = useState<string | null>(null);
  const [cardOrderNumber, setCardOrderNumber] = useState<string | null>(null);
  const [cardTotal, setCardTotal] = useState(0);

  // Fetch payment settings
  useEffect(() => {
    if (!restaurantId) return;
    supabase
      .from("restaurants")
      .select("pix_enabled, pix_gateway, pix_gateway_token, cash_enabled, card_on_delivery_enabled, card_online_enabled, mp_public_key")
      .eq("id", restaurantId)
      .single()
      .then(({ data }) => {
        if (data) {
          const d = data as any;
          const hasGateway = d.pix_gateway && d.pix_gateway_token;
          setPixEnabled(d.pix_enabled === true && hasGateway);
          setCashEnabled(d.cash_enabled ?? true);
          setCardEnabled(d.card_on_delivery_enabled ?? true);
          setCardOnlineEnabled(d.card_online_enabled === true && hasGateway && !!d.mp_public_key);
          setMpPublicKey(d.mp_public_key || null);
        }
      });
  }, [restaurantId]);

  const handleBack = () => {
    onOpenChange(false);
    setTimeout(onBack, 300);
  };

  const handleSubmit = async () => {
    const isPix = selectedMethod === "pix";
    const isCardOnline = selectedMethod === "card_online";
    const paymentMethod = isPix || isCardOnline ? "pix" : selectedMethod === "cash" ? "cash" : "card";
    // For card_online, we use "card" as the DB payment method but with awaiting_payment status
    const dbPaymentMethod = isCardOnline ? "card" : paymentMethod;

    // Fire AddPaymentInfo event
    const contentIds = items.map((item) => item.product?.id || item.id);
    trackAddPaymentInfo(
      total,
      paymentMethod || "unknown",
      restaurantId,
      { phone: customerInfo.phone, name: customerInfo.name },
      contentIds
    );

    if (!restaurantId) {
      toast.error("Erro ao enviar pedido", {
        description: "Restaurante não identificado",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const orderItems = items.map(item => ({
        productId: item.product.id,
        name: item.product.name,
        price: item.product.price,
        quantity: item.quantity,
        addons: item.addons,
        addonNames: item.addonNames || {},
        addonsTotal: item.unitPrice - item.product.price,
        notes: item.notes || null,
      }));

      const addressString = address
        ? `${address.street}, ${address.number}${address.complement ? ` - ${address.complement}` : ''}, ${address.neighborhood}${address.reference ? ` (Ref: ${address.reference})` : ''}`
        : null;

      const rpcParams = {
        p_restaurant_id: restaurantId,
        p_customer_name: customerInfo.name.trim(),
        p_customer_phone: customerInfo.phone.replace(/\D/g, ''),
        p_customer_address: addressString || '',
        p_delivery_type: deliveryMethod,
        p_payment_method: isCardOnline ? 'pix' : (dbPaymentMethod || 'cash'),
        p_items: orderItems,
        p_coupon_code: coupon?.code || null,
        p_notes: selectedMethod === "cash" && cashChange ? `Troco para: ${cashChange}` : null,
        p_promo_id: items.find(i => i.promoId)?.promoId || null,
        p_auto_promo_ids: activeBenefits.map(b => b.promoId),
        p_delivery_fee: deliveryMethod === "delivery" ? deliveryFee : 0,
      };

      const { data, error } = await supabase.rpc('submit_order', rpcParams);

      if (error) {
        logger.error("Error submitting order:", error);
        toast.error("Erro ao enviar pedido", {
          description: error.message || "Tente novamente mais tarde",
        });
        return;
      }

      const result = data as { success: boolean; error?: string; order_id?: string; order_number?: string; total?: number };

      if (!result.success) {
        toast.error("Erro ao enviar pedido", {
          description: result.error || "Tente novamente",
        });
        return;
      }

      // Send WhatsApp order confirmation only for non-online payments (cash, card_on_delivery)
      // For online payments (pix, card), the confirmation is sent after payment is confirmed
      const isOnlinePayment = selectedMethod === "pix" || selectedMethod === "card_online";
      if (restaurantId && result.order_id && !isOnlinePayment) {
        supabase.functions.invoke("whatsapp-bot", {
          body: {
            action: "send_order_confirmation",
            restaurant_id: restaurantId,
            order_id: result.order_id,
          },
        }).catch(() => {});
      }

      // If PIX, save to history and open the PIX payment drawer
      if (isPix) {
        const { saveOrderToHistory } = await import("@/hooks/useOrderHistory");
        saveOrderToHistory({
          orderId: result.order_number || '',
          customerName: customerInfo.name,
          deliveryMethod,
          total: result.total || total,
          paymentStatus: "awaiting_payment",
          dbOrderId: result.order_id || '',
          restaurantId,
          restaurantSlug,
        });
        setPixOrderId(result.order_id || null);
        setPixOrderNumber(result.order_number || null);
        setPixTotal(result.total || total);
        onOpenChange(false);
        setTimeout(() => setShowPixDrawer(true), 300);
        return;
      }

      // If card online, save to history and open the card payment drawer
      if (isCardOnline) {
        const { saveOrderToHistory } = await import("@/hooks/useOrderHistory");
        saveOrderToHistory({
          orderId: result.order_number || '',
          customerName: customerInfo.name,
          deliveryMethod,
          total: result.total || total,
          paymentStatus: "awaiting_payment",
          dbOrderId: result.order_id || '',
          restaurantId,
          restaurantSlug,
        });
        setCardOrderId(result.order_id || null);
        setCardOrderNumber(result.order_number || null);
        setCardTotal(result.total || total);
        onOpenChange(false);
        setTimeout(() => setShowCardDrawer(true), 300);
        return;
      }

      // Fire Meta Pixel Purchase event
      const finalTotal = result.total || total;
      trackPurchase(
        result.order_number || '',
        finalTotal,
        items.length,
        restaurantId,
        { phone: customerInfo.phone, name: customerInfo.name },
        contentIds
      );

      // Save order to history
      const { saveOrderToHistory } = await import("@/hooks/useOrderHistory");
      saveOrderToHistory({
        orderId: result.order_number || '',
        customerName: customerInfo.name,
        deliveryMethod,
        total: result.total || total,
        paymentStatus: "paid",
        dbOrderId: result.order_id || '',
        restaurantId,
        restaurantSlug,
      });

      clearCart();
      onOpenChange(false);
      
      const params = new URLSearchParams({
        pedido: result.order_number || '',
        nome: customerInfo.name,
        entrega: deliveryMethod,
        total: (result.total || total).toString(),
        ...(restaurantSlug ? { loja: restaurantSlug } : {}),
      });
      
      navigate(`/pedido?${params.toString()}`);
    } catch (err) {
      logger.error("Error submitting order:", err);
      toast.error("Erro ao enviar pedido", {
        description: "Tente novamente mais tarde",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const canProceed = selectedMethod !== null && !isSubmitting;

  useEffect(() => {
    if (!open) {
      setSelectedMethod(null);
      setCashChange("");
    }
  }, [open]);

  const formatCurrency = (value: number) => {
    return value.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  };

  // Separate methods into delivery and online groups
  const deliveryMethods: { key: PaymentMethodType; label: string; icon: React.ReactNode }[] = [];
  if (cashEnabled) deliveryMethods.push({ key: "cash", label: "Dinheiro", icon: <Banknote className="w-6 h-6" /> });
  if (cardEnabled) deliveryMethods.push({ key: "credit_card", label: "Crédito", icon: <CreditCard className="w-6 h-6" /> });
  if (cardEnabled) deliveryMethods.push({ key: "debit_card", label: "Débito", icon: <CreditCard className="w-6 h-6" /> });

  const onlineMethods: { key: PaymentMethodType; label: string; icon: React.ReactNode }[] = [];
  if (pixEnabled) onlineMethods.push({ key: "pix", label: "PIX", icon: <QrCode className="w-6 h-6" /> });
  if (cardOnlineEnabled) onlineMethods.push({ key: "card_online", label: "Cartão Online", icon: <CreditCard className="w-6 h-6" /> });

  const hasDeliveryMethods = deliveryMethods.length > 0;
  const hasOnlineMethods = onlineMethods.length > 0;

  const gridColsMap: Record<number, string> = { 1: "grid-cols-1", 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-4" };

  const renderMethodButton = (method: { key: PaymentMethodType; label: string; icon: React.ReactNode }) => (
    <button
      key={method.key}
      onClick={() => setSelectedMethod(method.key)}
      disabled={isSubmitting}
      className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
        selectedMethod === method.key
          ? "border-primary bg-primary/5"
          : "border-border hover:border-muted-foreground/50"
      }`}
    >
      <div
        className={`p-3 rounded-full ${
          selectedMethod === method.key
            ? "bg-primary text-primary-foreground"
            : "bg-muted"
        }`}
      >
        {method.icon}
      </div>
      <span className="font-medium text-sm text-center">{method.label}</span>
    </button>
  );

  return (
    <>
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85dvh] max-w-md mx-auto" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DrawerHeader className="border-b border-border px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={handleBack}
              className="p-2 -ml-2 hover:bg-muted rounded-full transition-colors"
              disabled={isSubmitting}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <DrawerTitle className="text-lg font-bold">Pagamento</DrawerTitle>
          </div>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <div className="space-y-4">
            {hasDeliveryMethods && (
              <div className="space-y-3">
                <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  💵 Pagamento na entrega
                </Label>
                <div className={`grid ${gridColsMap[Math.min(deliveryMethods.length, 4)] || "grid-cols-3"} gap-3`}>
                  {deliveryMethods.map(renderMethodButton)}
                </div>
              </div>
            )}

            {hasOnlineMethods && (
              <div className="space-y-3">
                {hasDeliveryMethods && <div className="border-t border-border pt-4" />}
                <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  📱 Pagamento online
                </Label>
                <div className={`grid ${gridColsMap[Math.min(onlineMethods.length, 4)] || "grid-cols-2"} gap-3`}>
                  {onlineMethods.map(renderMethodButton)}
                </div>
              </div>
            )}

            {/* Cash Change Field */}
            {selectedMethod === "cash" && (
              <div className="space-y-2 pt-2">
                <Label htmlFor="change" className="text-sm font-medium">
                  Precisa de troco para quanto?
                </Label>
                <Input
                  id="change"
                  type="text"
                  inputMode="numeric"
                  placeholder="Ex: R$ 100,00 (deixe vazio se não precisar)"
                  value={cashChange}
                  onChange={(e) => setCashChange(e.target.value)}
                  className="h-12 text-base"
                  disabled={isSubmitting}
                />
              </div>
            )}

            {/* PIX info */}
            {selectedMethod === "pix" && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
                <QrCode className="w-4 h-4 text-primary flex-shrink-0" />
                <p className="text-sm text-muted-foreground">
                  Você receberá um QR Code para pagamento via PIX com confirmação automática.
                </p>
              </div>
            )}

            {/* Card online info */}
            {selectedMethod === "card_online" && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
                <CreditCard className="w-4 h-4 text-primary flex-shrink-0" />
                <p className="text-sm text-muted-foreground">
                  Pague com cartão de crédito ou débito de forma segura pelo Mercado Pago.
                </p>
              </div>
            )}
          </div>

          {/* Order Summary */}
          <div className="border-t border-border pt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>Desconto</span>
                <span>-{formatCurrency(discount)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Taxa de entrega</span>
              <span className={deliveryMethod === "pickup" || hasFreeShipping || deliveryFee === 0 ? "text-primary font-medium" : ""}>
                {deliveryMethod === "pickup" || hasFreeShipping ? "Grátis" : deliveryFee > 0 ? formatCurrency(deliveryFee) : "Grátis"}
              </span>
            </div>
            <div className="flex justify-between font-bold text-lg pt-2 border-t border-border">
              <span>Total</span>
              <span>{formatCurrency(deliveryMethod === "pickup" || hasFreeShipping ? total : total + deliveryFee)}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border safe-area-bottom">
          <Button
            onClick={handleSubmit}
            disabled={!canProceed}
            className="w-full h-12 text-base font-bold bg-primary hover:bg-primary/90 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Enviando pedido...
              </>
            ) : (
              <>
                {selectedMethod === "pix" ? "Pagar com PIX" : selectedMethod === "card_online" ? "Pagar com Cartão" : "Finalizar pedido"} • {formatCurrency(deliveryMethod === "pickup" || hasFreeShipping ? total : total + deliveryFee)}
              </>
            )}
          </Button>
        </div>
      </DrawerContent>
    </Drawer>

    {pixOrderId && pixOrderNumber && restaurantId && (
      <PixPaymentDrawer
        open={showPixDrawer}
        onOpenChange={setShowPixDrawer}
        orderId={pixOrderId}
        orderNumber={pixOrderNumber}
        restaurantId={restaurantId}
        restaurantSlug={restaurantSlug}
        total={pixTotal}
        customerName={customerInfo.name}
        deliveryMethod={deliveryMethod}
      />
    )}

    {cardOrderId && cardOrderNumber && restaurantId && mpPublicKey && (
      <CardPaymentDrawer
        open={showCardDrawer}
        onOpenChange={setShowCardDrawer}
        orderId={cardOrderId}
        orderNumber={cardOrderNumber}
        restaurantId={restaurantId}
        restaurantSlug={restaurantSlug}
        total={cardTotal}
        customerName={customerInfo.name}
        deliveryMethod={deliveryMethod}
        mpPublicKey={mpPublicKey}
      />
    )}
    </>
  );
}
