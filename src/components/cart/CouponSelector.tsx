import { useState } from "react";
import { X, Tag, Check, Ticket, Loader2 } from "lucide-react";
import { useCart, Coupon } from "@/contexts/CartContext";
import { supabase } from "@/integrations/supabase/client";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { logger } from "@/lib/logger";

interface CouponSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId?: string;
}

export function CouponSelector({ open, onOpenChange, restaurantId }: CouponSelectorProps) {
  const { coupon: appliedCoupon, applyCoupon, subtotal } = useCart();
  const [inputCode, setInputCode] = useState("");
  const [isValidating, setIsValidating] = useState(false);

  const handleApplyCoupon = (coupon: Coupon) => {
    applyCoupon(coupon);
    toast.success("Cupom aplicado!", {
      description: coupon.description,
      icon: <Ticket className="w-5 h-5 text-cashback" />,
    });
    onOpenChange(false);
  };

  const handleRemoveCoupon = () => {
    applyCoupon(null);
    toast("Cupom removido");
    onOpenChange(false);
  };

  const handleInputSubmit = async () => {
    if (!inputCode.trim()) return;
    
    // If no restaurantId, we can't validate server-side
    if (!restaurantId) {
      toast.error("Erro ao validar cupom", {
        description: "Restaurante não identificado",
      });
      return;
    }

    setIsValidating(true);
    
    try {
      const { data, error } = await supabase.rpc('validate_coupon', {
        p_coupon_code: inputCode.trim(),
        p_restaurant_id: restaurantId,
        p_subtotal: subtotal
      });

      if (error) {
        logger.error("Error validating coupon:", error);
        toast.error("Erro ao validar cupom", {
          description: "Tente novamente mais tarde",
        });
        return;
      }

      const result = data as { valid: boolean; error?: string; discount?: number; code?: string; discount_type?: string; discount_value?: number; description?: string };

      if (!result.valid) {
        toast.error("Cupom inválido", {
          description: result.error || "Verifique o código e tente novamente",
        });
        return;
      }

      // Apply the validated coupon
      const coupon: Coupon = {
        code: result.code || inputCode,
        discount: result.discount_value || 0,
        type: result.discount_type === 'percentage' ? 'percentage' : 'fixed',
        description: result.description || '',
      };

      handleApplyCoupon(coupon);
      setInputCode("");
    } catch (err) {
      logger.error("Error validating coupon:", err);
      toast.error("Erro ao validar cupom", {
        description: "Tente novamente mais tarde",
      });
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85dvh] max-w-md mx-auto">
        <DrawerHeader className="border-b border-border px-4 py-3">
          <div className="flex items-center justify-between">
            <DrawerTitle className="text-lg font-bold flex items-center gap-2">
              <Tag className="w-5 h-5 text-primary" />
              Aplicar cupom
            </DrawerTitle>
            <DrawerClose asChild>
              <button className="p-2 hover:bg-muted rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </DrawerClose>
          </div>
        </DrawerHeader>

        <div className="p-4 space-y-4">
          {/* Applied coupon */}
          {appliedCoupon && (
            <div className="p-4 rounded-xl border-2 border-primary bg-primary/5">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-primary text-primary-foreground">
                  <Check className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm">{appliedCoupon.code}</span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-cashback/20 text-cashback">
                      {appliedCoupon.type === "percentage"
                        ? `${appliedCoupon.discount}% OFF`
                        : `R$ ${appliedCoupon.discount} OFF`}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {appliedCoupon.description}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRemoveCoupon}
                className="w-full mt-3"
              >
                Remover cupom
              </Button>
            </div>
          )}

          {/* Input for manual code */}
          {!appliedCoupon && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Digite o código do cupom para aplicar o desconto
              </p>
              <div className="flex gap-2">
                <Input
                  placeholder="Digite o código do cupom"
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                  className="flex-1 uppercase"
                  disabled={isValidating}
                />
                <Button
                  onClick={handleInputSubmit}
                  disabled={!inputCode.trim() || isValidating}
                  className="bg-primary hover:bg-primary/90"
                >
                  {isValidating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Aplicar"
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
