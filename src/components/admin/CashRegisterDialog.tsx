import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, User, Clock, ShoppingBag, TrendingUp, Truck, Receipt, Ban } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface CashRegisterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userName: string;
  onConfirm: (amount: number, operatorName: string) => void;
  loading?: boolean;
  mode?: "open" | "close";
  restaurantId?: string;
  cashRegisterOpenedAt?: string;
}

interface DaySummary {
  totalOrders: number;
  revenue: number;
  driverPayments: number;
  deliveryFees: number;
  netRevenue: number;
  cancelledOrders: number;
  cancelledRevenue: number;
}

export function CashRegisterDialog({
  open,
  onOpenChange,
  userName,
  onConfirm,
  loading,
  mode = "open",
  restaurantId,
  cashRegisterOpenedAt,
}: CashRegisterDialogProps) {
  const [operatorName] = useState(userName);
  const [amount, setAmount] = useState("");
  const [daySummary, setDaySummary] = useState<DaySummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  const isClosing = mode === "close";

  const now = new Date();
  const formattedDate = now.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const formattedTime = now.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  // Fetch session summary when closing
  useEffect(() => {
    if (!isClosing || !open || !restaurantId) {
      setDaySummary(null);
      return;
    }

    const fetchSummary = async () => {
      setLoadingSummary(true);
      try {
        // MUST use cash register opened_at as start time for session-based accounting
        if (!cashRegisterOpenedAt) {
          console.error("No cashRegisterOpenedAt provided for closing summary");
          setLoadingSummary(false);
          return;
        }

        const startTime = cashRegisterOpenedAt;

        // Fetch orders ACCEPTED during this session (accepted_at >= opened_at), excluding pending
        const { data: orders } = await supabase
          .from("orders")
          .select("total, delivery_fee, driver_id, driver_name, status, accepted_at")
          .eq("restaurant_id", restaurantId)
          .gte("accepted_at", startTime)
          .neq("status", "pending");

        // Fetch drivers to get fees
        const { data: drivers } = await supabase
          .from("drivers")
          .select("id, name, fixed_fee, per_ride_fee, fee_mode")
          .eq("restaurant_id", restaurantId)
          .eq("is_active", true);

        const allOrders = orders || [];
        const driversList = drivers || [];

        // Separate valid orders from cancelled/rejected
        const validOrders = allOrders.filter(o => !["cancelled", "rejected"].includes(o.status));
        const cancelledOrdersList = allOrders.filter(o => ["cancelled", "rejected"].includes(o.status));

        const totalOrders = validOrders.length;
        const revenue = validOrders.reduce((sum, o) => sum + (o.total || 0), 0);
        const deliveryFees = validOrders.reduce((sum, o) => sum + (o.delivery_fee || 0), 0);
        const cancelledOrders = cancelledOrdersList.length;
        const cancelledRevenue = cancelledOrdersList.reduce((sum, o) => sum + (o.total || 0), 0);

        // Calculate driver payments based on valid orders assigned to drivers
        const driverOrders = new Map<string, typeof validOrders>();
        validOrders.forEach(o => {
          if (o.driver_id) {
            const existing = driverOrders.get(o.driver_id) || [];
            existing.push(o);
            driverOrders.set(o.driver_id, existing);
          }
        });

        let driverPayments = 0;
        driverOrders.forEach((driverOrdersList, driverId) => {
          const driver = driversList.find(d => d.id === driverId);
          if (driver) {
            const count = driverOrdersList.length;
            driverPayments += (driver.fixed_fee || 0) * count;
            if (driver.fee_mode === "fixed_per_ride") {
              driverPayments += (driver.per_ride_fee || 0) * count;
            } else if (driver.fee_mode === "delivery_passthrough") {
              const passthrough = driverOrdersList.reduce((sum, o) => sum + (o.delivery_fee || 0), 0);
              driverPayments += passthrough;
            }
          }
        });

        const netRevenue = revenue - driverPayments;

        setDaySummary({ totalOrders, revenue, driverPayments, deliveryFees, netRevenue, cancelledOrders, cancelledRevenue });
      } catch (e) {
        console.error("Error fetching session summary:", e);
      } finally {
        setLoadingSummary(false);
      }
    };

    fetchSummary();
  }, [isClosing, open, restaurantId, cashRegisterOpenedAt]);

  const handleConfirm = () => {
    const parsedAmount = parseFloat(amount.replace(",", ".")) || 0;
    onConfirm(parsedAmount, operatorName || userName);
  };

  const formatCurrency = (value: number) =>
    `R$ ${value.toFixed(2).replace(".", ",")}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <DollarSign className={`w-5 h-5 ${isClosing ? "text-destructive" : "text-primary"}`} />
            {isClosing ? "Fechamento de Caixa" : "Abertura de Caixa"}
          </DialogTitle>
          <DialogDescription>
            {isClosing
              ? "Confira o resumo do dia e registre o fechamento."
              : "Preencha os dados para registrar a abertura do caixa de hoje."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Operator Name */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-2 text-xs">
              <User className="w-3.5 h-3.5 text-muted-foreground" />
              {isClosing ? "Operador do fechamento" : "Nome do operador"}
            </Label>
            <div className="rounded-md border border-input bg-muted/50 px-3 py-2 text-sm select-none">
              {operatorName}
            </div>
          </div>

          {/* Date/Time */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-2 text-xs">
              <Clock className="w-3.5 h-3.5 text-muted-foreground" />
              {isClosing ? "Data e hora de fechamento" : "Data e hora de abertura"}
            </Label>
            <div className="rounded-md border border-input bg-muted/50 px-3 py-2 text-sm capitalize">
              {formattedDate} — {formattedTime}
            </div>
          </div>

          {/* Day Summary - Only for closing */}
          {isClosing && (
            <>
              <Separator />
              <div className="space-y-3">
                <Label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <Receipt className="w-3.5 h-3.5" />
                  Resumo do dia
                </Label>

                {loadingSummary ? (
                  <div className="space-y-2">
                    {[...Array(5)].map((_, i) => (
                      <Skeleton key={i} className="h-9 w-full" />
                    ))}
                  </div>
                ) : daySummary ? (
                  <div className="space-y-2">
                    {/* Order count */}
                    <div className="flex items-center justify-between rounded-md border border-input bg-muted/30 px-3 py-2">
                      <span className="text-sm flex items-center gap-2">
                        <ShoppingBag className="w-3.5 h-3.5 text-muted-foreground" />
                        Pedidos do dia
                      </span>
                      <span className="text-sm font-semibold">{daySummary.totalOrders}</span>
                    </div>

                    {/* Revenue */}
                    <div className="flex items-center justify-between rounded-md border border-input bg-muted/30 px-3 py-2">
                      <span className="text-sm flex items-center gap-2">
                        <TrendingUp className="w-3.5 h-3.5 text-green-600" />
                        Faturamento bruto
                      </span>
                      <span className="text-sm font-semibold text-green-600">{formatCurrency(daySummary.revenue)}</span>
                    </div>

                    {/* Driver Payments */}
                    <div className="flex items-center justify-between rounded-md border border-input bg-muted/30 px-3 py-2">
                      <span className="text-sm flex items-center gap-2">
                        <Truck className="w-3.5 h-3.5 text-orange-500" />
                        Pago entregadores
                      </span>
                      <span className="text-sm font-semibold text-orange-500">- {formatCurrency(daySummary.driverPayments)}</span>
                    </div>

                    {/* Cancelled Orders */}
                    {daySummary.cancelledOrders > 0 && (
                      <div className="flex items-center justify-between rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2">
                        <span className="text-sm flex items-center gap-2">
                          <Ban className="w-3.5 h-3.5 text-destructive" />
                          Pedidos cancelados ({daySummary.cancelledOrders})
                        </span>
                        <span className="text-sm font-semibold text-destructive">- {formatCurrency(daySummary.cancelledRevenue)}</span>
                      </div>
                    )}

                    {/* Net Revenue */}
                    <div className="flex items-center justify-between rounded-lg border-2 border-primary/30 bg-primary/5 px-3 py-2.5">
                      <span className="text-sm font-semibold flex items-center gap-2">
                        <DollarSign className="w-3.5 h-3.5 text-primary" />
                        Faturamento líquido
                      </span>
                      <span className="text-base font-bold text-primary">{formatCurrency(daySummary.netRevenue)}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-2">Sem dados disponíveis</p>
                )}
              </div>
              <Separator />
            </>
          )}

          {/* Amount */}
          <div className="space-y-1.5">
            <Label htmlFor="amount" className="flex items-center gap-2 text-xs">
              <DollarSign className="w-3.5 h-3.5 text-muted-foreground" />
              Valor em caixa (R$)
            </Label>
            <CurrencyInput
              id="amount"
              value={parseFloat(amount) || 0}
              onChange={(value) => setAmount(value.toString())}
              placeholder="0,00"
              className="text-lg font-semibold"
            />
            <p className="text-xs text-muted-foreground">
              {isClosing
                ? "Informe o valor em dinheiro no caixa ao encerrar o turno."
                : "Informe o valor em dinheiro disponível no caixa neste momento."}
            </p>
          </div>

          <Button
            onClick={handleConfirm}
            disabled={loading}
            className={`w-full ${isClosing ? "bg-destructive hover:bg-destructive/90" : ""}`}
            size="lg"
          >
            {loading
              ? "Registrando..."
              : isClosing
                ? "Fechar Caixa"
                : "Abrir Caixa"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
