import { useState, useEffect } from "react";
import { ArrowLeft, Shield } from "lucide-react";
import { z } from "zod";
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

interface CheckoutDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBack: () => void;
  restaurantId?: string;
  restaurantSlug?: string;
}

const identificationSchema = z.object({
  phone: z.string().min(14, "Número de WhatsApp inválido").max(15),
  name: z.string().trim().min(3, "Nome muito curto").max(100, "Nome muito longo"),
});

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

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    if (numbers.length <= 2) return `(${numbers}`;
    if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    if (numbers.length <= 11) return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
  };

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
    const result = identificationSchema.safeParse({ phone, name });
    
    if (!result.success) {
      const fieldErrors: { phone?: string; name?: string } = {};
      result.error.errors.forEach((err) => {
        const field = err.path[0] as "phone" | "name";
        fieldErrors[field] = err.message;
      });
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

  const isValid = phone.length >= 14 && name.trim().length >= 3;

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[85dvh] max-w-md mx-auto" onOpenAutoFocus={(e) => e.preventDefault()}>
          <DrawerHeader className="border-b border-border px-4 py-3">
            <div className="flex items-center gap-3">
              <button
                onClick={handleBack}
                className="p-2 -ml-2 hover:bg-muted rounded-full transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <DrawerTitle className="text-lg font-bold">Identifique-se</DrawerTitle>
            </div>
          </DrawerHeader>

          <div className="p-6 space-y-6">
            {/* WhatsApp Field */}
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-sm font-medium text-foreground">
                Seu número de WhatsApp é:
              </Label>
              <Input
                id="phone"
                type="tel"
                inputMode="numeric"
                placeholder="(__) _____-____"
                value={phone}
                onChange={handlePhoneChange}
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
          <div className="p-6 pt-0 space-y-4 safe-area-bottom">
            <Button
              onClick={handleSubmit}
              disabled={!isValid}
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
