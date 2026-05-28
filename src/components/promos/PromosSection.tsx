import { useEffect, useState } from "react";
import { Tag, Sparkles, Copy, Check, Ticket, Package, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface PromoCoupon {
  id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  min_order: number | null;
  expires_at: string | null;
}

interface PromoKit {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  promo_type: string;
  price: number | null;
  discount_value: number | null;
  discount_type: string | null;
  schedule_type: string;
  schedule_days: number[];
  schedule_start_date: string | null;
  schedule_end_date: string | null;
  schedule_start_time: string | null;
  schedule_end_time: string | null;
}

interface PromosSectionProps {
  restaurantId?: string;
  onAddPromoToCart?: (promo: PromoKit) => void;
  onOpenCart?: () => void;
}

function isPromoCurrentlyActive(promo: PromoKit): boolean {
  if (promo.schedule_type === "always") return true;

  const now = new Date();
  const currentDay = now.getDay();
  const currentTime = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;

  let dayMatch = true;
  let timeMatch = true;
  let dateMatch = true;

  if (promo.schedule_type === "weekday" || promo.schedule_type === "both") {
    if (promo.schedule_days?.length > 0) {
      dayMatch = promo.schedule_days.includes(currentDay);
    }
    if (promo.schedule_start_time && promo.schedule_end_time) {
      timeMatch = currentTime >= promo.schedule_start_time.slice(0, 5) && currentTime <= promo.schedule_end_time.slice(0, 5);
    }
  }

  if (promo.schedule_type === "specific_date" || promo.schedule_type === "both") {
    const today = now.toISOString().split("T")[0];
    if (promo.schedule_start_date) dateMatch = today >= promo.schedule_start_date;
    if (promo.schedule_end_date) dateMatch = dateMatch && today <= promo.schedule_end_date;
  }

  if (promo.schedule_type === "weekday") return dayMatch && timeMatch;
  if (promo.schedule_type === "specific_date") return dateMatch;
  if (promo.schedule_type === "both") return dayMatch && timeMatch && dateMatch;

  return true;
}

export function PromosSection({ restaurantId, onAddPromoToCart, onOpenCart }: PromosSectionProps) {
  const [coupons, setCoupons] = useState<PromoCoupon[]>([]);
  const [promoKits, setPromoKits] = useState<PromoKit[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    if (!restaurantId) {
      setLoading(false);
      return;
    }

    async function fetchData() {
      try {
        const [couponsRes, promosRes] = await Promise.all([
          supabase
            .from("coupons")
            .select("id, code, discount_type, discount_value, min_order, expires_at")
            .eq("restaurant_id", restaurantId)
            .eq("is_active", true)
            .eq("show_in_menu", true)
            .order("created_at", { ascending: false }),
          supabase
            .from("promos")
            .select("*")
            .eq("restaurant_id", restaurantId)
            .eq("is_active", true)
            .eq("show_in_menu", true)
            .order("sort_order"),
        ]);

        if (couponsRes.data) {
          const now = new Date();
          const validCoupons = couponsRes.data.filter((c) => {
            if (!c.expires_at) return true;
            return new Date(c.expires_at) > now;
          });
          setCoupons(validCoupons);
        }

        if (promosRes.data) {
          const activePromos = (promosRes.data as any[]).filter(isPromoCurrentlyActive);
          setPromoKits(activePromos);
        }
      } catch (error) {
        console.error("Error fetching promos:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [restaurantId]);

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success("Código copiado!", {
      description: "Cole o código no carrinho ao finalizar o pedido.",
      icon: <Ticket className="w-5 h-5 text-primary" />,
    });
    setTimeout(() => setCopiedCode(null), 3000);
  };

  const formatDiscount = (coupon: PromoCoupon) => {
    return coupon.discount_type === "percentage"
      ? `${coupon.discount_value}% OFF`
      : `R$ ${coupon.discount_value.toFixed(2).replace(".", ",")} OFF`;
  };

  if (loading) {
    return (
      <div className="px-4 py-6 pb-24 space-y-4">
        <div className="h-6 w-48 bg-muted rounded animate-pulse" />
        <div className="h-32 w-full bg-muted rounded-xl animate-pulse" />
        <div className="h-20 w-full bg-muted rounded-xl animate-pulse" />
      </div>
    );
  }

  const hasContent = coupons.length > 0 || promoKits.length > 0;

  return (
    <div className="px-4 py-6 pb-24 space-y-6">
      {/* Promo Kits Section */}
      {promoKits.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold text-foreground">Promoções</h2>
          </div>

          <div className="space-y-3">
            {promoKits.map((promo) => (
              <div
                key={promo.id}
                className="relative overflow-hidden rounded-xl border bg-card border-border shadow-sm"
              >
                {promo.image_url && (
                  <img
                    src={promo.image_url}
                    alt={promo.name}
                    className="w-full h-40 object-cover"
                  />
                )}
                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-lg text-foreground">{promo.name}</h3>
                      {promo.description && (
                        <p className="text-sm text-muted-foreground mt-1">{promo.description}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      {promo.promo_type !== "auto_discount" && promo.price != null ? (
                        <span className="text-xl font-bold text-primary">
                          R$ {Number(promo.price).toFixed(2).replace(".", ",")}
                        </span>
                      ) : promo.discount_value != null ? (
                        <span className="text-lg font-bold text-primary bg-primary/10 px-3 py-1 rounded-full">
                          {promo.discount_type === "percentage"
                            ? `${promo.discount_value}% OFF`
                            : `R$ ${Number(promo.discount_value).toFixed(2).replace(".", ",")} OFF`}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  {promo.schedule_type !== "always" && (
                    <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Promoção por tempo limitado</span>
                    </div>
                  )}
                  <Button
                    className="w-full mt-3 gap-2 font-bold"
                    onClick={() => onAddPromoToCart?.(promo)}
                  >
                    <Package className="w-4 h-4" />
                    Pedir
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Coupons Section */}
      <div className="flex items-center gap-2">
        <Tag className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-bold text-foreground">Cupons Disponíveis</h2>
      </div>

      {coupons.length === 0 && promoKits.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <Tag className="w-8 h-8 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground text-sm">
            Nenhuma promoção disponível no momento.
          </p>
        </div>
      ) : coupons.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">Nenhum cupom disponível no momento.</p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Copie o código e aplique no carrinho na hora de finalizar o pedido.
          </p>

          <div className="space-y-3">
            {coupons.map((coupon, index) => {
              const isCopied = copiedCode === coupon.code;

              return (
                <div
                  key={coupon.id}
                  className={cn(
                    "relative overflow-hidden rounded-xl border transition-all",
                    index === 0
                      ? "bg-gradient-to-r from-primary to-primary/80 text-primary-foreground border-primary shadow-lg"
                      : "bg-card border-border"
                  )}
                >
                  {index === 0 && (
                    <>
                      <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
                      <div className="absolute bottom-0 left-0 w-20 h-20 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />
                    </>
                  )}

                  <div className="relative z-10 p-4">
                    {index === 0 && (
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="w-4 h-4" />
                        <span className="text-xs font-semibold uppercase tracking-wider opacity-90">
                          Em destaque
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "font-mono font-bold text-lg",
                            index === 0 ? "text-primary-foreground" : "text-foreground"
                          )}>
                            {coupon.code}
                          </span>
                          <span className={cn(
                            "text-xs font-semibold px-2 py-0.5 rounded-full",
                            index === 0
                              ? "bg-white/20 text-primary-foreground"
                              : "bg-primary/10 text-primary"
                          )}>
                            {formatDiscount(coupon)}
                          </span>
                        </div>
                        {coupon.min_order && coupon.min_order > 0 && (
                          <p className={cn(
                            "text-xs mt-1",
                            index === 0 ? "text-primary-foreground/80" : "text-muted-foreground"
                          )}>
                            Pedido mínimo: R$ {coupon.min_order.toFixed(2).replace(".", ",")}
                          </p>
                        )}
                      </div>

                      <Button
                        onClick={() => handleCopyCode(coupon.code)}
                        variant={index === 0 ? "secondary" : "outline"}
                        size="sm"
                        className={cn(
                          "ml-3 shrink-0 gap-1.5",
                          index === 0 && "bg-white text-primary hover:bg-white/90"
                        )}
                      >
                        {isCopied ? (
                          <>
                            <Check className="w-4 h-4" />
                            Copiado
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4" />
                            Copiar
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
