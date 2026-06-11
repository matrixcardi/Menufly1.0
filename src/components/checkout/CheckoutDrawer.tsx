import { useState, useEffect } from "react";
import { ArrowLeft, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { trackInitiateCheckout } from "@/lib/meta-pixel";
import { useCart } from "@/contexts/CartContext";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AddressDrawer } from "./AddressDrawer";
import { validatePhone, validateName, formatPhone } from "@/lib/validations";

interface CheckoutDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBack: () => void;
  restaurantId?: string;
  restaurantSlug?: string;
}


export function CheckoutDrawer({ open, onOpenChange, onBack, restaurantId, restaurantSlug }: CheckoutDrawerProps) {
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [errors, setErrors] = useState<{ phone?: string; name?: string }>({});
  const [showAddressDrawer, setShowAddressDrawer] = useState(false);
  const { total, itemCount, items } = useCart();

  // Fire InitiateCheckout when drawer opens
  useEffect(() => {
    if (open) {
      const contentIds = items.map((item) => item.product?.id || item.id);
      trackInitiateCheckout(total, itemCount, restaurantId, undefined, contentIds);
    }
  }, [open]);


  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhone(e.target.value);
    if (formatted.length <= 15) {
      setPhone(formatted);
      setErrors((prev) => ({ ...prev, phone: undefined }));
    }
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
    setErrors((prev) => ({ ...prev, name: undefined }));
  };

  const handleSubmit = async () => {
    const phoneValidation = validatePhone(phone);
    const nameValidation = validateName(name);
    
    const fieldErrors: { phone?: string; name?: string } = {};
    if (!phoneValidation.valid) {
      fieldErrors.phone = phoneValidation.error;
    }
    if (!nameValidation.valid) {
      fieldErrors.name = nameValidation.error;
    }
    
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }

    // Auto-register customer in background (fire and forget)
    if (restaurantId) {
      supabase.rpc("register_customer", {
        p_restaurant_id: restaurantId,
        p_name: name.trim(),
        p_phone: phone,
      }).then(() => {
        // silently registered
      });
    }

    // Proceed to address step
    onOpenChange(false);
    setTimeout(() => setShowAddressDrawer(true), 300);
  };

  const handleBack = () => {
    onOpenChange(false);
    setTimeout(onBack, 300);
  };

  const handleAddressBack = () => {
    setShowAddressDrawer(false);
    setTimeout(() => onOpenChange(true), 300);
  };

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[85dvh] max-w-md mx-auto" onOpenAutoFocus={(e) => e.preventDefault()}>
          <DrawerHeader className="border-b border-border px-4 py-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                aria-label="Voltar"
                onClick={handleBack}
                className="p-3 -ml-3 hover:bg-muted rounded-full transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <DrawerTitle className="text-lg font-bold">Identifique-se</DrawerTitle>
            </div>
          </DrawerHeader>

          <form
            className="flex flex-1 min-h-0 flex-col"
            onSubmit={(e) => {
              e.preventDefault();
              handleSubmit();
            }}
          >
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-6 space-y-6">
              {/* WhatsApp Field */}
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-sm font-medium text-foreground">
                  Seu número de WhatsApp é:
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  enterKeyHint="next"
                  placeholder="(__) _____-____"
                  value={phone}
                  onChange={handlePhoneChange}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      document.getElementById("name")?.focus();
                    }
                  }}
                  className={`h-12 text-base ${errors.phone ? "border-destructive" : ""}`}
                />
                {errors.phone && (
                  <p className="text-xs text-destructive">{errors.phone}</p>
                )}
              </div>

              {/* Name Field */}
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-medium text-foreground">
                  Seu nome e sobrenome:
                </Label>
                <Input
                  id="name"
                  type="text"
                  autoComplete="name"
                  enterKeyHint="done"
                  placeholder="Nome e sobrenome"
                  value={name}
                  onChange={handleNameChange}
                  maxLength={100}
                  className={`h-12 text-base ${errors.name ? "border-destructive" : ""}`}
                />
                {errors.name && (
                  <p className="text-xs text-destructive">{errors.name}</p>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 pt-4 space-y-4 safe-area-bottom">
              <Button
                type="submit"
                className="w-full h-12 text-base font-bold bg-primary hover:bg-primary/90 disabled:opacity-50"
              >
                Avançar
              </Button>

              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground text-center">
                <Shield className="w-4 h-4 text-primary" />
                <span>
                  Para realizar seu pedido vamos precisar de suas informações, este é um ambiente protegido.
                </span>
              </div>
            </div>
          </form>
        </DrawerContent>
      </Drawer>

      <AddressDrawer
        open={showAddressDrawer}
        onOpenChange={setShowAddressDrawer}
        onBack={handleAddressBack}
        customerInfo={{ name, phone }}
        restaurantId={restaurantId}
        restaurantSlug={restaurantSlug}
      />
    </>
  );
}
