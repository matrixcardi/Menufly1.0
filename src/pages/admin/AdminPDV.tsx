import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurantContext } from "@/contexts/RestaurantContext";
import { usePDVKiosk } from "@/contexts/PDVKioskContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  ShoppingCart,
  Search,
  Maximize2,
  Minimize2,
  Plus,
  Minus,
  Trash2,
  Clock,
  Utensils,
  Loader2,
  DollarSign,
  CreditCard,
  Smartphone,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Product {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  category_id: string;
}

interface Category {
  id: string;
  name: string;
}

interface Table {
  id: string;
  name: string;
  number: number;
}

interface CartItem {
  product: Product;
  quantity: number;
  observation: string;
}

interface PaymentMethod {
  type: "cash" | "card" | "pix";
  amount: number;
  received?: number;
}

export default function AdminPDV() {
  const {
    selectedRestaurantId,
    selectedRestaurantIds,
    selectedRestaurant,
    user,
  } = useRestaurantContext();

  const { toast } = useToast();
  const { isKioskMode, setKioskMode } = usePDVKiosk();

  const db = supabase as any;

  const ctxRestaurantId =
    selectedRestaurantId === "all"
      ? selectedRestaurantIds?.[0]
      : selectedRestaurantId;

  const [currentTime, setCurrentTime] = useState(new Date());
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>("counter");
  const [discount, setDiscount] = useState<string>("");
  const [discountType, setDiscountType] = useState<"amount" | "percentage">(
    "amount"
  );
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [cashAmount, setCashAmount] = useState<string>("");
  const [cashReceived, setCashReceived] = useState<string>("");
  const [cardAmount, setCardAmount] = useState<string>("");
  const [pixAmount, setPixAmount] = useState<string>("");
  const [confirmingPayment, setConfirmingPayment] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    fetchData();
  }, [ctxRestaurantId]);

  const fetchData = async () => {
    try {
      if (!ctxRestaurantId) {
        setLoading(false);
        return;
      }

      const { data: categoriesData } = await db
        .from("categories")
        .select("id, name")
        .eq("restaurant_id", ctxRestaurantId)
        .order("name");

      if (categoriesData) {
        setCategories(categoriesData);
      }

      const { data: productsData } = await db
        .from("products")
        .select("id, name, price, image_url, category_id")
        .eq("restaurant_id", ctxRestaurantId)
        .eq("active", true)
        .order("name");

      if (productsData) {
        setProducts(productsData);
      }

      const { data: tablesData } = await db
        .from("pdv_tables")
        .select("id, name, number")
        .eq("restaurant_id", ctxRestaurantId)
        .order("number");

      if (tablesData) {
        setTables(tablesData);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar dados",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const addToCart = (product: Product) => {
    setCart((prevCart) => {
      const existingItem = prevCart.find(
        (item) => item.product.id === product.id
      );

      if (existingItem) {
        return prevCart.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }

      return [...prevCart, { product, quantity: 1, observation: "" }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart((prevCart) =>
      prevCart.filter((item) => item.product.id !== productId)
    );
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart((prevCart) =>
      prevCart.map((item) =>
        item.product.id === productId
          ? { ...item, quantity: Math.max(1, item.quantity + delta) }
          : item
      )
    );
  };

  const updateObservation = (productId: string, observation: string) => {
    setCart((prevCart) =>
      prevCart.map((item) =>
        item.product.id === productId ? { ...item, observation } : item
      )
    );
  };

  const filteredProducts = products.filter((product) => {
    const matchesSearch = product.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());

    const matchesCategory =
      selectedCategory === "all" || product.category_id === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const subtotal = cart.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  );

  const parsedDiscount = parseFloat(discount) || 0;

  const discountValue =
    discountType === "percentage"
      ? subtotal * (parsedDiscount / 100)
      : parsedDiscount;

  const total = Math.max(0, subtotal - discountValue);

  const totalPaid = paymentMethods.reduce((sum, pm) => sum + pm.amount, 0);
  const remainingAmount = Math.max(0, total - totalPaid);
  const cashPayment = paymentMethods.find((pm) => pm.type === "cash");

  const changeAmount = cashPayment
    ? Math.max(0, (cashPayment.received || 0) - cashPayment.amount)
    : 0;

  const toggleKioskMode = () => {
    setKioskMode(!isKioskMode);
  };

  const handleOpenPaymentModal = () => {
    if (cart.length === 0) return;

    setPaymentMethods([]);
    setCashAmount("");
    setCashReceived("");
    setCardAmount("");
    setPixAmount("");
    setShowPaymentModal(true);
  };

  const handleAddPaymentMethod = (
    type: "cash" | "card" | "pix",
    amount: number,
    received?: number
  ) => {
    setPaymentMethods((prev) => {
      const existing = prev.find((pm) => pm.type === type);

      if (existing) {
        return prev.map((pm) =>
          pm.type === type ? { ...pm, amount, received } : pm
        );
      }

      return [...prev, { type, amount, received }];
    });
  };

  const handleConfirmPayment = async () => {
    if (!ctxRestaurantId || totalPaid < total || cart.length === 0) return;

    setConfirmingPayment(true);

    try {
      const cashTotal =
        paymentMethods.find((pm) => pm.type === "cash")?.amount || 0;

      const cardTotal =
        paymentMethods.find((pm) => pm.type === "card")?.amount || 0;

      const pixTotal =
        paymentMethods.find((pm) => pm.type === "pix")?.amount || 0;

      const { data: orderData, error: orderError } = await db
        .from("orders")
        .insert({
          restaurant_id: ctxRestaurantId,
          items: cart.map((item) => ({
            product_id: item.product.id,
            name: item.product.name,
            quantity: item.quantity,
            price: item.product.price,
            observation: item.observation,
          })),
          total_amount: total,
          payment_method: paymentMethods,
          origin: "pdv",
          status: "confirmed",
          table_id: selectedTable !== "counter" ? selectedTable : null,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      if (selectedTable !== "counter") {
        await db
          .from("pdv_tables")
          .update({
            status: "occupied",
            current_order_id: orderData.id,
          })
          .eq("id", selectedTable);
      }

      const { data: sessionData } = await db
        .from("pdv_sessions")
        .select("id, total_sales, total_cash, total_card, total_pix")
        .eq("restaurant_id", ctxRestaurantId)
        .eq("status", "open")
        .maybeSingle();

      if (sessionData) {
        await db
          .from("pdv_sessions")
          .update({
            total_sales: Number(sessionData.total_sales || 0) + total,
            total_cash: Number(sessionData.total_cash || 0) + cashTotal,
            total_card: Number(sessionData.total_card || 0) + cardTotal,
            total_pix: Number(sessionData.total_pix || 0) + pixTotal,
          })
          .eq("id", sessionData.id);
      } else {
        await db.from("pdv_sessions").insert({
          restaurant_id: ctxRestaurantId,
          opened_by: user?.id,
          total_sales: total,
          total_cash: cashTotal,
          total_card: cardTotal,
          total_pix: pixTotal,
        });
      }

      toast({
        title: "Venda confirmada!",
        description: `Pedido #${orderData.id.slice(0, 8)} criado com sucesso.`,
      });

      setCart([]);
      setDiscount("");
      setSelectedTable("counter");
      setPaymentMethods([]);
      setShowPaymentModal(false);
    } catch (error) {
      console.error("Error confirming payment:", error);
      toast({
        title: "Erro",
        description: "Erro ao confirmar pagamento",
        variant: "destructive",
      });
    } finally {
      setConfirmingPayment(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100dvh-84px)]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div
      className={`relative min-h-0 flex flex-col bg-background overflow-hidden ${
        isKioskMode
          ? "h-screen pdv-kiosk-mode"
          : "h-[calc(100dvh-84px)]"
      }`}
    >
      {isKioskMode && (
        <Button
          className="fixed top-4 right-4 z-50 bg-red-500 hover:bg-red-600 text-white rounded-full w-10 h-10 p-0"
          onClick={toggleKioskMode}
        >
          <X className="w-5 h-5" />
        </Button>
      )}

      <div className="bg-white dark:bg-gray-800 border-b border-border px-4 py-2 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4 min-w-0">
          <h1
            className={`font-bold text-primary truncate ${
              isKioskMode ? "text-2xl" : "text-lg"
            }`}
          >
            {selectedRestaurant?.name || "PDV"}
          </h1>

          <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground whitespace-nowrap">
            <Clock className="w-4 h-4" />
            {currentTime.toLocaleString("pt-BR")}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Select value={selectedTable} onValueChange={setSelectedTable}>
            <SelectTrigger
              className={`w-44 ${
                isKioskMode ? "h-12 text-lg" : "h-9 text-sm"
              }`}
            >
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>

            <SelectContent>
              <SelectItem value="counter">Balcao</SelectItem>
              {tables.map((table) => (
                <SelectItem key={table.id} value={table.id}>
                  {table.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="icon"
            onClick={toggleKioskMode}
            className={isKioskMode ? "w-12 h-12" : "w-9 h-9"}
          >
            {isKioskMode ? (
              <Minimize2 className="w-5 h-5" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex overflow-hidden">
        <div className="flex-[7] min-w-0 min-h-0 flex flex-col p-3 overflow-hidden">
          <div className="mb-3 flex-shrink-0">
            <div className="relative">
              <Search
                className={`absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground ${
                  isKioskMode ? "w-6 h-6" : "w-4 h-4"
                }`}
              />

              <Input
                placeholder="Buscar produtos..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className={`pl-10 ${isKioskMode ? "h-12 text-lg" : "h-10"}`}
              />
            </div>
          </div>

          <div className="mb-3 flex gap-2 overflow-x-auto pb-2 flex-shrink-0">
            <Button
              variant={selectedCategory === "all" ? "default" : "outline"}
              onClick={() => setSelectedCategory("all")}
              className={`whitespace-nowrap ${
                isKioskMode ? "h-12 text-lg px-6" : "h-9"
              }`}
            >
              Todos
            </Button>

            {categories.map((category) => (
              <Button
                key={category.id}
                variant={selectedCategory === category.id ? "default" : "outline"}
                onClick={() => setSelectedCategory(category.id)}
                className={`whitespace-nowrap ${
                  isKioskMode ? "h-12 text-lg px-6" : "h-9"
                }`}
              >
                {category.name}
              </Button>
            ))}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto">
            <div
              className={`grid gap-3 ${
                isKioskMode
                  ? "grid-cols-2"
                  : "grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
              }`}
            >
              {filteredProducts.map((product) => (
                <Card
                  key={product.id}
                  className={`cursor-pointer hover:shadow-lg transition-shadow ${
                    isKioskMode ? "p-4" : ""
                  }`}
                  onClick={() => addToCart(product)}
                >
                  <CardContent className={`p-3 ${isKioskMode ? "p-4" : ""}`}>
                    <div className="bg-gray-100 dark:bg-gray-800 rounded-lg mb-3 flex items-center justify-center overflow-hidden aspect-square">
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Utensils
                          className={`text-muted-foreground ${
                            isKioskMode ? "w-16 h-16" : "w-12 h-12"
                          }`}
                        />
                      )}
                    </div>

                    <h3
                      className={`font-medium mb-1 line-clamp-2 ${
                        isKioskMode ? "text-lg" : "text-sm"
                      }`}
                    >
                      {product.name}
                    </h3>

                    <p
                      className={`text-primary font-bold ${
                        isKioskMode ? "text-xl" : ""
                      }`}
                    >
                      R$ {product.price.toFixed(2)}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>

        <div
          className={`relative flex-[3] min-w-[300px] min-h-0 flex flex-col bg-white dark:bg-gray-800 border-l border-border overflow-hidden ${
            isKioskMode ? "p-4" : "p-2"
          }`}
        >
          <div className="flex items-center justify-between mb-2 flex-shrink-0">
            <h2
              className={`font-bold flex items-center gap-2 ${
                isKioskMode ? "text-xl" : "text-sm"
              }`}
            >
              <ShoppingCart className={isKioskMode ? "w-5 h-5" : "w-4 h-4"} />
              Carrinho
            </h2>

            <span
              className={`bg-primary text-primary-foreground px-2 py-1 rounded-full ${
                isKioskMode ? "text-sm px-2 py-1" : "text-xs"
              }`}
            >
              {cart.reduce((sum, item) => sum + item.quantity, 0)}
            </span>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto space-y-1 mb-2 pb-2">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                <ShoppingCart className="w-10 h-10 mb-2 opacity-30" />
                <p className="text-xs">Carrinho vazio</p>
              </div>
            ) : (
              cart.map((item) => (
                <Card key={item.product.id}>
                  <CardContent className={`p-2 ${isKioskMode ? "p-3" : ""}`}>
                    <div className="flex items-start justify-between mb-1">
                      <div className="flex-1 min-w-0">
                        <h4
                          className={`font-medium truncate ${
                            isKioskMode ? "text-base" : "text-xs"
                          }`}
                        >
                          {item.product.name}
                        </h4>

                        <p
                          className={`text-xs text-muted-foreground ${
                            isKioskMode ? "text-sm" : "text-[10px]"
                          }`}
                        >
                          R$ {item.product.price.toFixed(2)}
                        </p>
                      </div>

                      <Button
                        variant="ghost"
                        size="icon"
                        className={`h-5 w-5 ${isKioskMode ? "h-8 w-8" : ""}`}
                        onClick={() => removeFromCart(item.product.id)}
                      >
                        <Trash2
                          className={isKioskMode ? "w-4 h-4" : "w-3 h-3"}
                        />
                      </Button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          className={`h-5 w-5 ${isKioskMode ? "h-8 w-8" : ""}`}
                          onClick={() => updateQuantity(item.product.id, -1)}
                        >
                          <Minus
                            className={isKioskMode ? "w-4 h-4" : "w-3 h-3"}
                          />
                        </Button>

                        <span
                          className={`font-medium w-6 text-center ${
                            isKioskMode ? "text-lg w-8" : "text-xs"
                          }`}
                        >
                          {item.quantity}
                        </span>

                        <Button
                          variant="outline"
                          size="icon"
                          className={`h-5 w-5 ${isKioskMode ? "h-8 w-8" : ""}`}
                          onClick={() => updateQuantity(item.product.id, 1)}
                        >
                          <Plus
                            className={isKioskMode ? "w-4 h-4" : "w-3 h-3"}
                          />
                        </Button>
                      </div>

                      <span
                        className={`font-bold ${
                          isKioskMode ? "text-lg" : "text-xs"
                        }`}
                      >
                        R$ {(item.product.price * item.quantity).toFixed(2)}
                      </span>
                    </div>

                    {item.observation && (
                      <p
                        className={`text-xs text-muted-foreground mt-1 italic ${
                          isKioskMode ? "text-sm" : "text-[10px]"
                        }`}
                      >
                        Obs: {item.observation}
                      </p>
                    )}

                    <Input
                      placeholder="Adicionar observacao..."
                      value={item.observation}
                      onChange={(event) =>
                        updateObservation(item.product.id, event.target.value)
                      }
                      className={`mt-1 text-xs ${
                        isKioskMode ? "h-10 text-sm" : "h-7"
                      }`}
                    />
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          <div className="flex-shrink-0 bg-white dark:bg-gray-800 border-t border-border pt-2 pb-2 space-y-2">
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span>Subtotal</span>
                <span>R$ {subtotal.toFixed(2)}</span>
              </div>

              <div className="flex items-center gap-1">
                <span className="text-xs">Desconto</span>

                <Input
                  type="number"
                  placeholder="0"
                  value={discount}
                  onChange={(event) => setDiscount(event.target.value)}
                  className={`w-16 h-7 ${
                    isKioskMode ? "w-20 h-10 text-sm" : ""
                  }`}
                />

                <Select
                  value={discountType}
                  onValueChange={(value) =>
                    setDiscountType(value as "amount" | "percentage")
                  }
                >
                  <SelectTrigger
                    className={`w-16 h-7 ${
                      isKioskMode ? "w-20 h-10 text-sm" : ""
                    }`}
                  >
                    <SelectValue />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectItem value="amount">R$</SelectItem>
                    <SelectItem value="percentage">%</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div
                className={`flex justify-between font-bold ${
                  isKioskMode ? "text-xl" : "text-sm"
                }`}
              >
                <span>Total</span>
                <span className="text-primary">R$ {total.toFixed(2)}</span>
              </div>
            </div>

            <Button
              className="w-full bg-orange-500 hover:bg-orange-600 text-white h-11 shadow-lg"
              size="sm"
              onClick={handleOpenPaymentModal}
              disabled={cart.length === 0}
            >
              <span
                className={
                  isKioskMode ? "text-base" : "text-sm font-semibold"
                }
              >
                Finalizar Venda
              </span>
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pagamento</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="border rounded-lg p-4">
              <h3 className="font-semibold mb-2">Resumo do Pedido</h3>

              <div className="space-y-1 text-sm">
                {cart.map((item) => (
                  <div
                    key={item.product.id}
                    className="flex justify-between gap-4"
                  >
                    <span>
                      {item.quantity}x {item.product.name}
                    </span>
                    <span>
                      R$ {(item.product.price * item.quantity).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="border-t mt-2 pt-2 flex justify-between font-bold">
                <span>Total</span>
                <span className="text-primary">R$ {total.toFixed(2)}</span>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold">Formas de Pagamento</h3>

              <div className="border rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-5 h-5 text-green-600" />
                  <span className="font-medium">Dinheiro</span>
                </div>

                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="Valor"
                    value={cashAmount}
                    onChange={(event) => {
                      setCashAmount(event.target.value);

                      const amount = parseFloat(event.target.value) || 0;
                      const received = parseFloat(cashReceived) || 0;

                      handleAddPaymentMethod("cash", amount, received);
                    }}
                    className="flex-1"
                  />

                  <Input
                    type="number"
                    placeholder="Recebido"
                    value={cashReceived}
                    onChange={(event) => {
                      setCashReceived(event.target.value);

                      const amount = parseFloat(cashAmount) || 0;
                      const received = parseFloat(event.target.value) || 0;

                      handleAddPaymentMethod("cash", amount, received);
                    }}
                    className="flex-1"
                  />
                </div>

                {paymentMethods.find((pm) => pm.type === "cash") && (
                  <div className="mt-2 text-sm">
                    <span className="text-green-600">
                      Troco: R$ {changeAmount.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>

              <div className="border rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <CreditCard className="w-5 h-5 text-blue-600" />
                  <span className="font-medium">Cartao</span>
                </div>

                <Input
                  type="number"
                  placeholder="Valor"
                  value={cardAmount}
                  onChange={(event) => {
                    setCardAmount(event.target.value);

                    const amount = parseFloat(event.target.value) || 0;

                    handleAddPaymentMethod("card", amount);
                  }}
                />
              </div>

              <div className="border rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Smartphone className="w-5 h-5 text-purple-600" />
                  <span className="font-medium">PIX</span>
                </div>

                <Input
                  type="number"
                  placeholder="Valor"
                  value={pixAmount}
                  onChange={(event) => {
                    setPixAmount(event.target.value);

                    const amount = parseFloat(event.target.value) || 0;

                    handleAddPaymentMethod("pix", amount);
                  }}
                />
              </div>
            </div>

            <div className="border rounded-lg p-4 space-y-2">
              <div className="flex justify-between">
                <span>Total a pagar:</span>
                <span className="font-bold">R$ {total.toFixed(2)}</span>
              </div>

              <div className="flex justify-between">
                <span>Total pago:</span>
                <span className="font-bold">R$ {totalPaid.toFixed(2)}</span>
              </div>

              {totalPaid >= total ? (
                <div className="flex justify-between text-green-600">
                  <span>Troco:</span>
                  <span className="font-bold">
                    R$ {(totalPaid - total).toFixed(2)}
                  </span>
                </div>
              ) : (
                <div className="flex justify-between text-red-600">
                  <span>Restante:</span>
                  <span className="font-bold">
                    R$ {remainingAmount.toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPaymentModal(false)}>
              Cancelar
            </Button>

            <Button
              className="bg-orange-500 hover:bg-orange-600 text-white"
              onClick={handleConfirmPayment}
              disabled={totalPaid < total || confirmingPayment}
            >
              {confirmingPayment ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processando...
                </>
              ) : (
                "Confirmar Pagamento"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}