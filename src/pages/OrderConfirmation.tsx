import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { CheckCircle2, Clock, ChefHat, Truck, Package, MessageCircle, Timer, XCircle, Ban, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface OrderStatus {
  id: number;
  label: string;
  icon: React.ReactNode;
  completed: boolean;
  current: boolean;
}

const deliveryStatusToStep: Record<string, number> = {
  pending: 1,
  confirmed: 1,
  preparing: 2,
  ready: 3,
  out_for_delivery: 4,
  delivered: 5,
  cancelled: -1,
  rejected: -1,
};

const pickupStatusToStep: Record<string, number> = {
  pending: 1,
  confirmed: 1,
  preparing: 2,
  ready: 3,
  pickup_ready: 3,
  delivered: 4,
  cancelled: -1,
  rejected: -1,
};

export default function OrderConfirmation() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const orderId = searchParams.get("pedido") || "000000";
  const customerName = searchParams.get("nome") || "Cliente";
  const deliveryMethodParam = searchParams.get("entrega") || "delivery";
  const total = searchParams.get("total") || "0";
  const slugFromUrl = searchParams.get("loja");

  const [isLoaded, setIsLoaded] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [orderStatus, setOrderStatus] = useState<string>("pending");
  const [restaurantName, setRestaurantName] = useState("Restaurante");
  const [restaurantSlug, setRestaurantSlug] = useState<string | null>(slugFromUrl);
  const [restaurantWhatsapp, setRestaurantWhatsapp] = useState<string | null>(null);
  const [restaurantAddress, setRestaurantAddress] = useState<string | null>(null);
  const [restaurantGoogleMapsUrl, setRestaurantGoogleMapsUrl] = useState<string | null>(null);
  const [deliveryMethod, setDeliveryMethod] = useState(deliveryMethodParam);
  const [estimatedTime, setEstimatedTime] = useState<string | null>(null);
  const [orderCreatedAt, setOrderCreatedAt] = useState<string | null>(null);
  const [cancellationReason, setCancellationReason] = useState<string | null>(null);
  const [orderUuid, setOrderUuid] = useState<string | null>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
    const timer = setTimeout(() => setIsLoaded(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Fetch inicial do pedido + dados do restaurante
  useEffect(() => {
    async function fetchOrder() {
      console.log('🔵 CLIENT: Buscando pedido', orderId);
      const { data: order } = await supabase
        .from("orders")
        .select("id, status, restaurant_id, delivery_type, created_at, cancellation_reason")
        .eq("order_number", orderId)
        .maybeSingle();

      if (order) {
        setOrderUuid(order.id);
        const orderDeliveryMethod = order.delivery_type === "pickup" ? "pickup" : "delivery";
        setDeliveryMethod(orderDeliveryMethod);
        setOrderCreatedAt(order.created_at);
        setOrderStatus(order.status);
        setCancellationReason((order as any).cancellation_reason || null);
        const stepMap = orderDeliveryMethod === "pickup" ? pickupStatusToStep : deliveryStatusToStep;
        setCurrentStep(stepMap[order.status] || 1);

        // Fetch dados do restaurante
        const { data: restaurant } = await supabase
          .from("restaurants")
          .select("name, slug, whatsapp_phone, default_delivery_time_min, address_street, address_number, address_neighborhood, address_city, address_state, address_cep, address, google_maps_url")
          .eq("id", order.restaurant_id)
          .maybeSingle();

        if (restaurant) {
          setRestaurantName(restaurant.name);
          setRestaurantSlug(restaurant.slug);
          setRestaurantWhatsapp((restaurant as any).whatsapp_phone || null);
          setRestaurantGoogleMapsUrl((restaurant as any).google_maps_url || null);
          
          const addressParts = [
            (restaurant as any).address_street,
            (restaurant as any).address_number,
            (restaurant as any).address_neighborhood,
            (restaurant as any).address_city,
            (restaurant as any).address_state,
            (restaurant as any).address_cep
          ].filter(Boolean);
          
          const fullAddress = addressParts.length > 0 
            ? addressParts.join(', ')
            : (restaurant as any).address || null;
          
          setRestaurantAddress(fullAddress);
          
          const deliveryTimeMin = (restaurant as any).default_delivery_time_min;
          if (deliveryTimeMin && order.created_at) {
            const createdAt = new Date(order.created_at);
            const estimatedArrival = new Date(createdAt.getTime() + deliveryTimeMin * 60 * 1000);
            setEstimatedTime(
              estimatedArrival.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
            );
          }
        }
      }
    }

    fetchOrder();

    // Polling de segurança a cada 10 segundos (caso o realtime falhe)
    const pollInterval = setInterval(fetchOrder, 10000);

    return () => {
      clearInterval(pollInterval);
    };
  }, [orderId]);

  // REALTIME — Só inicia depois que tem o UUID do pedido
  useEffect(() => {
    if (!orderUuid) return;

    console.log('📡 CLIENT: Inscrevendo no realtime para UUID:', orderUuid);
    
    const channel = supabase
      .channel(`order-update-${orderUuid}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `id=eq.${orderUuid}`,
        },
        (payload) => {
          console.log('🟢 CLIENT EVENT RECEIVED:', payload);
          const newRecord = payload.new as { status: string; cancellation_reason?: string; delivery_type?: string };
          
          setOrderStatus(newRecord.status);
          setCancellationReason(newRecord.cancellation_reason || null);
          
          const currentDeliveryMethod = newRecord.delivery_type === "pickup" ? "pickup" : "delivery";
          const stepMap = currentDeliveryMethod === "pickup" ? pickupStatusToStep : deliveryStatusToStep;
          setCurrentStep(stepMap[newRecord.status] || 1);
        }
      )
      .subscribe((status, err) => {
        console.log('📡 CLIENT REALTIME STATUS:', status);
        if (err) console.error('❌ CLIENT REALTIME ERROR:', err);
      });

    return () => {
      console.log('🔵 CLIENT: Desinscrevendo do canal realtime');
      supabase.removeChannel(channel);
    };
  }, [orderUuid]);

  const statuses: OrderStatus[] = deliveryMethod === "pickup"
    ? [
        {
          id: 1,
          label: "Pedido recebido",
          icon: <CheckCircle2 className="w-5 h-5" />,
          completed: currentStep >= 1,
          current: currentStep === 1,
        },
        {
          id: 2,
          label: "Preparando seu pedido",
          icon: <ChefHat className="w-5 h-5" />,
          completed: currentStep >= 2,
          current: currentStep === 2,
        },
        {
          id: 3,
          label: "Pronto para retirada",
          icon: <Package className="w-5 h-5" />,
          completed: currentStep >= 3,
          current: currentStep === 3,
        },
        {
          id: 4,
          label: "Pedido retirado",
          icon: <CheckCircle2 className="w-5 h-5" />,
          completed: currentStep >= 4,
          current: currentStep === 4,
        },
      ]
    : [
        {
          id: 1,
          label: "Pedido recebido",
          icon: <CheckCircle2 className="w-5 h-5" />,
          completed: currentStep >= 1,
          current: currentStep === 1,
        },
        {
          id: 2,
          label: "Preparando seu pedido",
          icon: <ChefHat className="w-5 h-5" />,
          completed: currentStep >= 2,
          current: currentStep === 2,
        },
        {
          id: 3,
          label: "Pedido pronto",
          icon: <Package className="w-5 h-5" />,
          completed: currentStep >= 3,
          current: currentStep === 3,
        },
        {
          id: 4,
          label: "Saiu para entrega",
          icon: <Truck className="w-5 h-5" />,
          completed: currentStep >= 4,
          current: currentStep === 4,
        },
        {
          id: 5,
          label: "Pedido entregue",
          icon: <CheckCircle2 className="w-5 h-5" />,
          completed: currentStep >= 5,
          current: currentStep === 5,
        },
      ];

  const handleWhatsAppClick = () => {
    if (!restaurantWhatsapp) return;
    const message = encodeURIComponent(
      `Fiz um pedido pelo menufly, quero acompanhar meu pedido #${orderId}`
    );
    window.open(`https://wa.me/${restaurantWhatsapp}?text=${message}`, "_blank");
  };

  const handleGoogleMapsClick = () => {
    if (restaurantGoogleMapsUrl) {
      window.open(restaurantGoogleMapsUrl, "_blank");
    } else if (restaurantAddress) {
      const encodedAddress = encodeURIComponent(restaurantAddress);
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`, "_blank");
    }
  };

  const formatCurrency = (value: string) => {
    return parseFloat(value).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className={`px-4 py-8 text-center overflow-hidden ${
        orderStatus === "rejected" || orderStatus === "cancelled" 
          ? "bg-red-500 text-white" 
          : "bg-primary text-primary-foreground"
      }`}>
        <div 
          className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 transition-all duration-700 ease-out ${
            orderStatus === "rejected" || orderStatus === "cancelled" ? "bg-white/20" : "bg-primary-foreground/20"
          } ${isLoaded ? "opacity-100 scale-100" : "opacity-0 scale-50"}`}
        >
          {orderStatus === "rejected" || orderStatus === "cancelled" ? (
            <XCircle className="w-10 h-10" />
          ) : (
            <CheckCircle2 className="w-10 h-10" />
          )}
        </div>
        <h1 
          className={`text-2xl font-bold mb-2 transition-all duration-500 delay-200 ease-out ${
            isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          {orderStatus === "rejected" ? "Pedido recusado" : orderStatus === "cancelled" ? "Pedido cancelado" : "Pedido realizado!"}
        </h1>
        <p 
          className={`opacity-80 transition-all duration-500 delay-300 ease-out ${
            isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          {orderStatus === "rejected" || orderStatus === "cancelled"
            ? `${customerName.split(" ")[0]}, seu pedido não pôde ser processado.`
            : `Obrigado, ${customerName.split(" ")[0]}! Seu pedido foi recebido.`}
        </p>
      </div>

      <div className="max-w-md mx-auto px-4 py-6 space-y-6">
        {/* Order Info Card */}
        <div className="bg-card rounded-xl border border-border p-4 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Número do pedido</span>
            <span className="font-bold text-lg">#{orderId}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Total</span>
            <span className="font-bold text-primary">{formatCurrency(total)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">
              {deliveryMethod === "pickup" ? "Retirada em" : "Entrega em"}
            </span>
            <span className="font-medium">{restaurantName}</span>
          </div>
          {estimatedTime && (
            <div className="flex justify-between items-center pt-2 border-t border-border">
              <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                <Timer className="w-4 h-4" />
                {deliveryMethod === "pickup" ? "Previsão de retirada" : "Previsão de entrega"}
              </span>
              <span className="font-bold text-primary text-lg">{estimatedTime}</span>
            </div>
          )}
        </div>

        {/* Status Tracker */}
        {orderStatus === "rejected" || orderStatus === "cancelled" ? (
          <div className="bg-card rounded-xl border border-red-300 p-6 text-center space-y-3">
            <div className="w-14 h-14 bg-red-500/10 rounded-full flex items-center justify-center mx-auto">
              {orderStatus === "rejected" ? (
                <Ban className="w-8 h-8 text-red-500" />
              ) : (
                <XCircle className="w-8 h-8 text-red-500" />
              )}
            </div>
            <h2 className="font-bold text-lg text-red-600">
              {orderStatus === "rejected" ? "Pedido Recusado" : "Pedido Cancelado"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {orderStatus === "rejected"
                ? "Infelizmente o restaurante não pôde aceitar seu pedido."
                : "O restaurante cancelou seu pedido."}
            </p>
            {cancellationReason && (
              <p className="text-sm text-muted-foreground">
                <span className="font-medium">Motivo:</span> {cancellationReason}
              </p>
            )}
          </div>
        ) : (
          <div className="bg-card rounded-xl border border-border p-4">
            <h2 className="font-bold text-lg mb-4">Acompanhe seu pedido</h2>
            
            <div className="relative">
              {statuses.map((status, index) => (
                <div key={status.id} className="flex items-start gap-4 relative">
                  {index < statuses.length - 1 && (
                    <div
                      className={`absolute left-[18px] top-10 w-0.5 h-12 transition-colors duration-500 ${
                        status.completed ? "bg-primary" : "bg-muted"
                      }`}
                    />
                  )}
                  <div className="relative">
                    {status.current && (
                      <div className="absolute inset-0 w-9 h-9 rounded-full bg-primary/30 animate-ping" />
                    )}
                    <div
                      className={`relative z-10 w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-500 ${
                        status.completed
                          ? "bg-primary text-primary-foreground"
                          : status.current
                          ? "bg-primary/20 text-primary border-2 border-primary"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {status.icon}
                    </div>
                  </div>
                  <div className="pb-8">
                    <p
                      className={`font-medium transition-colors duration-300 ${
                        status.completed || status.current
                          ? "text-foreground"
                          : "text-muted-foreground"
                      }`}
                    >
                      {status.label}
                    </p>
                    {status.current && (
                      <p className="text-sm text-primary mt-0.5 animate-pulse">Status atual</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Google Maps Button for Pickup / WhatsApp Button for Delivery */}
        {deliveryMethod === "pickup" ? (
          <Button
            onClick={handleGoogleMapsClick}
            className="w-full h-14 text-base font-bold bg-blue-500 hover:bg-blue-600 text-white gap-3"
          >
            <MapPin className="w-6 h-6" />
            Ver no Google Maps
          </Button>
        ) : (
          restaurantWhatsapp && (
            <Button
              onClick={handleWhatsAppClick}
              className="w-full h-14 text-base font-bold bg-[#25D366] hover:bg-[#25D366]/90 text-white gap-3"
            >
              <MessageCircle className="w-6 h-6" />
              Quero acompanhar pelo WhatsApp
            </Button>
          )
        )}

        {/* Back to Menu */}
        <button
          onClick={() => {
            if (restaurantSlug) {
              navigate(`/${restaurantSlug}`);
            } else {
              navigate("/");
            }
          }}
          className="w-full h-14 text-base font-bold bg-[#F5A623] hover:bg-[#E0951F] text-white rounded-lg transition-colors"
        >
          Voltar ao cardápio
        </button>
      </div>
    </div>
  );
}