import { useState, useEffect, useMemo } from "react";
import { Plus, Minus, Trash2, Search, X, ChevronDown, ChevronUp } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAddonGroups, AddonGroupWithItems } from "@/hooks/useAddonGroups";
import { cn } from "@/lib/utils";

interface Product {
  id: string;
  name: string;
  price: number;
  description: string | null;
  image_url: string | null;
  category_id: string | null;
}

interface Category {
  id: string;
  name: string;
}

type SelectedAddons = Record<string, string[]>;

interface CartItem {
  id: string;
  cartItemId: string; // unique key per cart entry (same product can appear multiple times with different addons)
  name: string;
  price: number;
  quantity: number;
  addons: SelectedAddons;
  addonsTotal: number;
  notes: string;
}

interface ManualOrderDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId: string;
}

// Sub-component: Addon picker shown when adding a product
function ProductAddonPicker({
  product,
  restaurantId,
  onConfirm,
  onCancel,
}: {
  product: Product;
  restaurantId: string;
  onConfirm: (addons: SelectedAddons, addonsTotal: number, notes: string, quantity: number) => void;
  onCancel: () => void;
}) {
  const { addonGroups } = useAddonGroups(restaurantId, product.id);
  const [selectedAddons, setSelectedAddons] = useState<SelectedAddons>({});
  const [itemNotes, setItemNotes] = useState("");
  const [quantity, setQuantity] = useState(1);

  const handleAddonToggle = (sectionId: string, itemId: string, section: AddonGroupWithItems) => {
    setSelectedAddons((prev) => {
      const current = prev[sectionId] || [];
      if (section.type === "single") {
        if (current.includes(itemId)) return { ...prev, [sectionId]: [] };
        return { ...prev, [sectionId]: [itemId] };
      }
      if (current.includes(itemId)) {
        return { ...prev, [sectionId]: current.filter((id) => id !== itemId) };
      }
      if (section.max_select && current.length >= section.max_select) return prev;
      return { ...prev, [sectionId]: [...current, itemId] };
    });
  };

  const addonsTotal = useMemo(() => {
    let total = 0;
    addonGroups.forEach((section) => {
      const selected = selectedAddons[section.id] || [];
      selected.forEach((itemId) => {
        const item = section.items.find((i) => i.id === itemId);
        if (item) total += item.price;
      });
    });
    return total;
  }, [addonGroups, selectedAddons]);

  const totalPrice = (product.price + addonsTotal) * quantity;

  const formatPrice = (price: number) =>
    price === 0 ? "Grátis" : `+ R$ ${price.toFixed(2).replace(".", ",")}`;

  const handleConfirm = () => {
    onConfirm(selectedAddons, addonsTotal, itemNotes, quantity);
  };

  return (
    <div className="flex flex-col h-full max-h-[90vh]">
      {/* Scrollable area */}
      <div className="flex-1 overflow-y-auto">
        {/* Product Image - square like /menu */}
        <div className="relative w-full aspect-square">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-muted flex items-center justify-center">
              <span className="text-4xl">🍽️</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          <button
            onClick={onCancel}
            className="absolute top-3 right-3 p-2 bg-card/90 rounded-full shadow-lg z-10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content scrolls over image */}
        <div className="relative bg-card -mt-6 rounded-t-3xl z-10">
          <div className="px-4 pt-6 pb-2">
            <h3 className="text-xl font-bold">{product.name}</h3>
            {product.description && (
              <p className="text-muted-foreground text-sm mt-1">{product.description}</p>
            )}
            <p className="text-lg font-bold text-primary mt-2">
              R$ {product.price.toFixed(2).replace(".", ",")}
            </p>
          </div>

          {/* Addon groups */}
          <div className="px-4 pb-4 space-y-4">
            {addonGroups.map((section) => (
              <div key={section.id} className="bg-secondary/50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="font-semibold text-foreground">{section.name}</h4>
                    {section.description && (
                      <p className="text-xs text-muted-foreground">{section.description}</p>
                    )}
                  </div>
                  {section.required && (
                    <span className="text-xs font-medium bg-destructive/10 text-destructive px-2 py-1 rounded">
                      Obrigatório
                    </span>
                  )}
                  {section.max_select && (
                    <span className="text-xs text-muted-foreground">
                      Máx. {section.max_select}
                    </span>
                  )}
                </div>

                {section.type === "single" ? (
                  <RadioGroup
                    value={(selectedAddons[section.id] || [])[0] || ""}
                    onValueChange={(value) => handleAddonToggle(section.id, value, section)}
                    className="space-y-2"
                  >
                    {section.items.map((item) => (
                      <label
                        key={item.id}
                        className={cn(
                          "flex items-center justify-between p-3 rounded-lg bg-card cursor-pointer transition-all",
                          (selectedAddons[section.id] || []).includes(item.id) && "ring-2 ring-primary"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <RadioGroupItem value={item.id} className="border-primary" />
                          <div>
                            <span className="font-medium text-sm">{item.name}</span>
                            {item.description && (
                              <p className="text-xs text-muted-foreground">{item.description}</p>
                            )}
                          </div>
                        </div>
                        <span className="text-sm font-semibold text-primary">{formatPrice(item.price)}</span>
                      </label>
                    ))}
                  </RadioGroup>
                ) : (
                  <div className="space-y-2">
                    {section.items.map((item) => (
                      <label
                        key={item.id}
                        className={cn(
                          "flex items-center justify-between p-3 rounded-lg bg-card cursor-pointer transition-all",
                          (selectedAddons[section.id] || []).includes(item.id) && "ring-2 ring-primary"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <Checkbox
                            checked={(selectedAddons[section.id] || []).includes(item.id)}
                            onCheckedChange={() => handleAddonToggle(section.id, item.id, section)}
                            className="border-primary data-[state=checked]:bg-primary"
                          />
                          <div>
                            <span className="font-medium text-sm">{item.name}</span>
                            {item.description && (
                              <p className="text-xs text-muted-foreground">{item.description}</p>
                            )}
                          </div>
                        </div>
                        <span className="text-sm font-semibold text-primary">{formatPrice(item.price)}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Per-item notes */}
            <div className="space-y-1">
              <Label className="text-sm">Observação do item</Label>
              <Input
                placeholder="Ex: sem cebola, bem passado..."
                value={itemNotes}
                onChange={(e) => setItemNotes(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Fixed Footer - like /menu */}
      <div className="border-t border-border p-4 bg-card">
        <div className="flex items-center gap-4">
          {/* Quantity Selector */}
          <div className="flex items-center gap-3 bg-secondary rounded-xl p-1">
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="p-2 rounded-lg hover:bg-muted transition-colors"
              disabled={quantity <= 1}
            >
              <Minus className={cn("w-5 h-5", quantity <= 1 && "text-muted-foreground")} />
            </button>
            <span className="w-8 text-center font-bold text-lg">{quantity}</span>
            <button
              onClick={() => setQuantity(quantity + 1)}
              className="p-2 rounded-lg hover:bg-muted transition-colors"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          {/* Add Button */}
          <Button
            onClick={handleConfirm}
            className="flex-1 h-12 text-base font-bold bg-primary hover:bg-primary/90"
          >
            Adicionar • R$ {totalPrice.toFixed(2).replace(".", ",")}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ManualOrderDrawer({ open, onOpenChange, restaurantId }: ManualOrderDrawerProps) {
  const [step, setStep] = useState<"products" | "customer" | "review">("products");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [deliveryType, setDeliveryType] = useState<"delivery" | "pickup">("pickup");
  const [paymentMethod, setPaymentMethod] = useState<"pix" | "cash" | "card">("cash");
  const [notes, setNotes] = useState("");
  const [needsChange, setNeedsChange] = useState(false);
  const [changeFor, setChangeFor] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pickerProduct, setPickerProduct] = useState<Product | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!open || !restaurantId) return;

    async function fetchProducts() {
      const { data: productsData } = await supabase
        .from("products")
        .select("id, name, price, description, image_url, category_id")
        .eq("restaurant_id", restaurantId)
        .eq("is_active", true)
        .order("name");

      const { data: categoriesData } = await supabase
        .from("categories")
        .select("id, name")
        .eq("restaurant_id", restaurantId)
        .order("sort_order");

      if (productsData) setProducts(productsData);
      if (categoriesData) setCategories(categoriesData);
    }

    fetchProducts();
  }, [open, restaurantId]);

  useEffect(() => {
    if (!open) {
      setStep("products");
      setCustomerName("");
      setCustomerPhone("");
      setCustomerAddress("");
      setDeliveryType("pickup");
      setPaymentMethod("cash");
      setNotes("");
      setNeedsChange(false);
      setChangeFor("");
      setCart([]);
      setSearchQuery("");
      setSelectedCategory(null);
      setPickerProduct(null);
    }
  }, [open]);

  const handleProductClick = (product: Product) => {
    setPickerProduct(product);
  };

  const handleAddonConfirm = (addons: SelectedAddons, addonsTotal: number, itemNotes: string, quantity: number) => {
    if (!pickerProduct) return;
    const cartItemId = `${pickerProduct.id}-${Date.now()}`;
    setCart((prev) => [
      ...prev,
      {
        id: pickerProduct.id,
        cartItemId,
        name: pickerProduct.name,
        price: pickerProduct.price,
        quantity,
        addons,
        addonsTotal,
        notes: itemNotes,
      },
    ]);
    setPickerProduct(null);
  };

  const updateQuantity = (cartItemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) =>
          item.cartItemId === cartItemId ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const removeFromCart = (cartItemId: string) => {
    setCart((prev) => prev.filter((item) => item.cartItemId !== cartItemId));
  };

  const updateItemNotes = (cartItemId: string, newNotes: string) => {
    setCart((prev) =>
      prev.map((item) => (item.cartItemId === cartItemId ? { ...item, notes: newNotes } : item))
    );
  };

  const subtotal = cart.reduce((sum, item) => sum + (item.price + item.addonsTotal) * item.quantity, 0);

  const filteredProducts = products.filter((product) => {
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !selectedCategory || product.category_id === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const formatCurrency = (value: number) => {
    return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  const canProceedToProducts = customerName.length >= 2 && customerPhone.replace(/\D/g, "").length >= 10;
  const canProceedToReview = cart.length > 0;
  const canSubmit = canProceedToProducts && canProceedToReview && (deliveryType === "pickup" || customerAddress.length >= 5);

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setSubmitting(true);

    const orderItems = cart.map((item) => ({
      id: item.id,
      productId: item.id,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      addons: item.addons,
      addonsTotal: item.addonsTotal,
      notes: item.notes || undefined,
    }));

    // For manual orders, use 'cash' as payment method to avoid awaiting_payment status
    // which would hide the order from admin view
    const effectivePaymentMethod = paymentMethod;

    const combinedNotes = [
      notes,
      needsChange && changeFor ? `Troco para R$ ${changeFor}` : needsChange ? "Precisa de troco" : "",
    ].filter(Boolean).join(" | ") || null;

    const { data, error } = await supabase.rpc("submit_order", {
      p_restaurant_id: restaurantId,
      p_customer_name: customerName.trim(),
      p_customer_phone: customerPhone,
      p_customer_address: deliveryType === "delivery" ? customerAddress : "",
      p_delivery_type: deliveryType,
      p_payment_method: effectivePaymentMethod,
      p_items: orderItems as any,
      p_coupon_code: null,
      p_notes: combinedNotes,
      p_promo_id: null,
    });

    setSubmitting(false);

    if (error || !(data as any)?.success) {
      toast({
        title: "Erro ao criar pedido",
        description: (data as any)?.error || error?.message || "Erro desconhecido",
        variant: "destructive",
      });
      return;
    }

    // For manual PIX orders, confirm payment immediately since admin created them
    if (paymentMethod === "pix" && (data as any)?.order_id) {
      await supabase.rpc("confirm_pix_payment", { p_order_id: (data as any).order_id });
    }

    toast({
      title: "✅ Pedido criado!",
      description: `Pedido #${(data as any).daily_number || (data as any).order_number} foi adicionado`,
    });

    onOpenChange(false);
  };

  const getAddonNames = (item: CartItem) => {
    // We don't have the full addon data here, but we store the IDs
    // For display we'll show count
    const count = Object.values(item.addons).flat().length;
    return count > 0 ? `${count} adicional(is)` : null;
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] p-0 flex flex-col gap-0 overflow-hidden">
        <div className="border-b border-border px-4 py-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">
              {step === "products" && "Novo Pedido Manual"}
              {step === "customer" && "Dados do Cliente"}
              {step === "review" && "Revisar Pedido"}
            </h2>
            {cart.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {cart.reduce((sum, item) => sum + item.quantity, 0)} itens
              </Badge>
            )}
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          {/* Step 1: Customer Info */}
          {step === "customer" && (
            <div className="p-4 space-y-4 pb-8">
              <div className="space-y-2">
                <Label htmlFor="name">Nome do cliente *</Label>
                <Input
                  id="name"
                  placeholder="Nome completo"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="h-12"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Telefone *</Label>
                <PhoneInput
                  id="phone"
                  placeholder="(11) 9 9999-9999"
                  value={customerPhone}
                  onChange={(value) => setCustomerPhone(value)}
                  className="h-12"
                />
              </div>

              <div className="space-y-2">
                <Label>Tipo de pedido</Label>
                <RadioGroup
                  value={deliveryType}
                  onValueChange={(v) => setDeliveryType(v as "delivery" | "pickup")}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="pickup" id="pickup" />
                    <Label htmlFor="pickup" className="cursor-pointer">🏪 Retirada</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="delivery" id="delivery" />
                    <Label htmlFor="delivery" className="cursor-pointer">🛵 Entrega</Label>
                  </div>
                </RadioGroup>
              </div>

              {deliveryType === "delivery" && (
                <div className="space-y-2">
                  <Label htmlFor="address">Endereço de entrega *</Label>
                  <Textarea
                    id="address"
                    placeholder="Rua, número, bairro, complemento..."
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                    rows={3}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>Forma de pagamento</Label>
                <RadioGroup
                  value={paymentMethod}
                  onValueChange={(v) => setPaymentMethod(v as "pix" | "cash" | "card")}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="cash" id="cash" />
                    <Label htmlFor="cash" className="cursor-pointer">💵 Dinheiro</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="pix" id="pix" />
                    <Label htmlFor="pix" className="cursor-pointer">📱 PIX</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="card" id="card" />
                    <Label htmlFor="card" className="cursor-pointer">💳 Cartão</Label>
                  </div>
              </RadioGroup>

              {paymentMethod === "cash" && (
                <div className="space-y-2 pl-2 border-l-2 border-primary/30 ml-2">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="needs-change"
                      checked={needsChange}
                      onCheckedChange={(checked) => {
                        setNeedsChange(!!checked);
                        if (!checked) setChangeFor("");
                      }}
                    />
                    <Label htmlFor="needs-change" className="cursor-pointer text-sm">
                      Precisa de troco?
                    </Label>
                  </div>
                  {needsChange && (
                    <Input
                      placeholder="Troco para quanto? Ex: 100"
                      value={changeFor}
                      onChange={(e) => setChangeFor(e.target.value.replace(/[^0-9.,]/g, ""))}
                      className="h-10"
                    />
                  )}
                </div>
              )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Observações gerais</Label>
                <Textarea
                  id="notes"
                  placeholder="Alguma observação para o pedido?"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}

          {/* Step 2: Products */}
          {step === "products" && (
            <div className="p-4 space-y-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar produto..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-10"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                  >
                    <X className="w-4 h-4 text-muted-foreground" />
                  </button>
                )}
              </div>

              {/* Categories */}
              {categories.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-2">
                  <Button
                    variant={selectedCategory === null ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedCategory(null)}
                  >
                    Todos
                  </Button>
                  {categories.map((category) => (
                    <Button
                      key={category.id}
                      variant={selectedCategory === category.id ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedCategory(category.id)}
                      className="whitespace-nowrap"
                    >
                      {category.name}
                    </Button>
                  ))}
                </div>
              )}

              {/* Cart summary at top */}
              {cart.length > 0 && (
                <div className="bg-primary/10 rounded-lg p-3 space-y-2">
                  <p className="text-sm font-semibold">Itens adicionados:</p>
                  {cart.map((item) => (
                    <div key={item.cartItemId} className="flex items-center justify-between text-sm">
                      <div className="flex-1">
                        <span>{item.quantity}x {item.name}</span>
                        {getAddonNames(item) && (
                          <span className="text-xs text-muted-foreground ml-1">({getAddonNames(item)})</span>
                        )}
                        {item.notes && (
                          <p className="text-xs text-muted-foreground italic">📝 {item.notes}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-medium">{formatCurrency((item.price + item.addonsTotal) * item.quantity)}</span>
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeFromCart(item.cartItemId)}>
                          <Trash2 className="w-3 h-3 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Products List */}
              <div className="space-y-2">
                {filteredProducts.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhum produto encontrado
                  </p>
                ) : (
                  filteredProducts.map((product) => (
                    <button
                      key={product.id}
                      onClick={() => handleProductClick(product)}
                      className="w-full flex items-center gap-3 p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors text-left"
                    >
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                          <Plus className="w-5 h-5 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{product.name}</p>
                        {product.description && (
                          <p className="text-xs text-muted-foreground line-clamp-1">{product.description}</p>
                        )}
                        <p className="text-sm text-primary font-semibold">
                          {formatCurrency(product.price)}
                        </p>
                      </div>
                      <Plus className="w-5 h-5 text-primary flex-shrink-0" />
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Addon Picker as Dialog */}
          <Dialog open={!!pickerProduct} onOpenChange={(open) => { if (!open) setPickerProduct(null); }}>
            <DialogContent className="max-w-md max-h-[90vh] p-0 overflow-hidden flex flex-col gap-0">
              {pickerProduct && (
                <ProductAddonPicker
                  product={pickerProduct}
                  restaurantId={restaurantId}
                  onConfirm={handleAddonConfirm}
                  onCancel={() => setPickerProduct(null)}
                />
              )}
            </DialogContent>
          </Dialog>

          {/* Step 3: Review */}
          {step === "review" && (
            <div className="p-4 space-y-4 pb-8">
              {/* Customer Summary */}
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <h3 className="font-semibold">Cliente</h3>
                <p className="text-sm">{customerName}</p>
                <p className="text-sm text-muted-foreground">{customerPhone}</p>
                <Badge variant="outline">
                  {deliveryType === "delivery" ? "🛵 Entrega" : "🏪 Retirada"}
                </Badge>
                {deliveryType === "delivery" && customerAddress && (
                  <p className="text-sm text-muted-foreground">{customerAddress}</p>
                )}
              </div>

              {/* Cart Items */}
              <div className="space-y-2">
                <h3 className="font-semibold">Itens do pedido</h3>
                {cart.map((item) => (
                  <div
                    key={item.cartItemId}
                    className="p-3 bg-muted/50 rounded-lg space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-medium">
                          {item.quantity}x {item.name}
                        </p>
                        {getAddonNames(item) && (
                          <p className="text-xs text-muted-foreground">{getAddonNames(item)}</p>
                        )}
                        <p className="text-sm text-muted-foreground">
                          {formatCurrency((item.price + item.addonsTotal) * item.quantity)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-7 w-7"
                          onClick={() => updateQuantity(item.cartItemId, -1)}
                        >
                          <Minus className="w-3 h-3" />
                        </Button>
                        <span className="w-5 text-center text-sm font-medium">{item.quantity}</span>
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-7 w-7"
                          onClick={() => updateQuantity(item.cartItemId, 1)}
                        >
                          <Plus className="w-3 h-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive"
                          onClick={() => removeFromCart(item.cartItemId)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                    {/* Per-item notes in review */}
                    <Input
                      placeholder="Observação do item..."
                      value={item.notes}
                      onChange={(e) => updateItemNotes(item.cartItemId, e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                ))}
              </div>

              {/* Payment & Notes */}
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <p className="text-sm">
                  <span className="font-medium">Pagamento:</span>{" "}
                  {paymentMethod === "pix" ? "PIX" : paymentMethod === "cash" ? "Dinheiro" : "Cartão"}
                </p>
                {notes && (
                  <p className="text-sm">
                    <span className="font-medium">Obs geral:</span> {notes}
                  </p>
                )}
              </div>

              {/* Total */}
              <div className="flex justify-between items-center p-4 bg-primary/10 rounded-lg">
                <span className="font-semibold">Total</span>
                <span className="text-xl font-bold">{formatCurrency(subtotal)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border space-y-2">
          {step === "products" && (
            <Button
              className="w-full h-12"
              onClick={() => setStep("customer")}
              disabled={!canProceedToReview}
            >
              Continuar ({formatCurrency(subtotal)})
            </Button>
          )}

          

          {step === "customer" && (
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 h-12" onClick={() => setStep("products")}>
                Voltar
              </Button>
              <Button
                className="flex-1 h-12"
                onClick={() => setStep("review")}
                disabled={!canProceedToProducts}
              >
                Revisar pedido
              </Button>
            </div>
          )}

          {step === "review" && (
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 h-12" onClick={() => setStep("customer")}>
                Editar
              </Button>
              <Button
                className="flex-1 h-12"
                onClick={handleSubmit}
                disabled={!canSubmit || submitting}
              >
                {submitting ? "Criando..." : "Criar pedido"}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
