import { useState, useEffect } from "react";
import { format, startOfDay, endOfDay, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Package, Building2, TrendingUp, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurantContext } from "@/contexts/RestaurantContext";
import { useToast } from "@/hooks/use-toast";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

type DateRange = {
  from: Date;
  to: Date;
};

type PresetRange = "today" | "week" | "month" | "custom";

interface SupplierData {
  supplierId: string;
  supplierName: string;
  orderCount: number;
  totalValue: number;
  percentage: number;
}

interface IngredientData {
  ingredientId: string;
  ingredientName: string;
  quantityPurchased: number;
  totalCost: number;
}

interface PurchaseOrderHistory {
  id: string;
  orderNumber: string;
  status: string;
  totalValue: number;
  receivedAt: string | null;
  notes: string | null;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

export default function AdminCustosInsumos() {
  const { selectedRestaurant, selectedRestaurantIds } = useRestaurantContext();
  const [dateRange, setDateRange] = useState<DateRange>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  const [presetRange, setPresetRange] = useState<PresetRange>("month");
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const restaurantId = selectedRestaurant?.id || (selectedRestaurantIds.length === 1 ? selectedRestaurantIds[0] : null);

  // Data states
  const [totalSpent, setTotalSpent] = useState(0);
  const [spendingByMonth, setSpendingByMonth] = useState<Array<{ month: string; value: number }>>([]);
  const [supplierData, setSupplierData] = useState<SupplierData[]>([]);
  const [ingredientData, setIngredientData] = useState<IngredientData[]>([]);

  // Drawer states
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierData | null>(null);
  const [purchaseOrderHistory, setPurchaseOrderHistory] = useState<PurchaseOrderHistory[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Handle preset range changes
  useEffect(() => {
    const now = new Date();
    switch (presetRange) {
      case "today":
        setDateRange({ from: startOfDay(now), to: endOfDay(now) });
        break;
      case "week":
        setDateRange({ from: startOfDay(now), to: endOfDay(now) });
        break;
      case "month":
        setDateRange({ from: startOfMonth(now), to: endOfMonth(now) });
        break;
      case "custom":
        break;
    }
  }, [presetRange]);

  // Load data
  useEffect(() => {
    async function loadData() {
      if (!restaurantId) return;
      setLoading(true);

      try {
        const fromDate = dateRange.from.toISOString();
        const toDate = dateRange.to.toISOString();

        // Fetch purchase orders with supplier info
        const { data: purchaseOrders } = await supabase
          .from("purchase_orders" as any)
          .select(`
            id,
            total_value,
            received_at,
            status,
            supplier_id,
            suppliers!inner(name)
          `)
          .eq("restaurant_id", restaurantId)
          .eq("status", "recebido")
          .gte("received_at", fromDate)
          .lte("received_at", toDate);

        const totalValue = purchaseOrders?.reduce((sum, po: any) => sum + Number(po.total_value), 0) || 0;
        setTotalSpent(totalValue);

        // Spending by month (last 6 months)
        const sixMonthsAgo = subMonths(new Date(), 5);
        const { data: allPurchaseOrders } = await supabase
          .from("purchase_orders" as any)
          .select("total_value, received_at")
          .eq("restaurant_id", restaurantId)
          .eq("status", "recebido")
          .gte("received_at", startOfMonth(sixMonthsAgo).toISOString());

        const spendingByMonthMap = new Map<string, number>();
        allPurchaseOrders?.forEach((po: any) => {
          if (po.received_at) {
            const month = format(new Date(po.received_at), "MMM yyyy", { locale: ptBR });
            spendingByMonthMap.set(month, (spendingByMonthMap.get(month) || 0) + Number(po.total_value));
          }
        });
        const spendingByMonthArray = Array.from(spendingByMonthMap.entries())
          .map(([month, value]) => ({ month, value }))
          .sort((a, b) => {
            const dateA = new Date(a.month);
            const dateB = new Date(b.month);
            return dateA.getTime() - dateB.getTime();
          });
        setSpendingByMonth(spendingByMonthArray);

        // Group by supplier
        const supplierMap = new Map<string, { name: string; orderCount: number; totalValue: number }>();
        purchaseOrders?.forEach((po: any) => {
          const supplierId = po.supplier_id;
          const supplierName = po.suppliers?.name || "Fornecedor sem nome";
          const current = supplierMap.get(supplierId) || { name: supplierName, orderCount: 0, totalValue: 0 };
          supplierMap.set(supplierId, {
            name: supplierName,
            orderCount: current.orderCount + 1,
            totalValue: current.totalValue + Number(po.total_value),
          });
        });
        const supplierArray = Array.from(supplierMap.entries())
          .map(([supplierId, data]) => ({
            supplierId,
            supplierName: data.name,
            orderCount: data.orderCount,
            totalValue: data.totalValue,
            percentage: totalValue > 0 ? (data.totalValue / totalValue) * 100 : 0,
          }))
          .sort((a, b) => b.totalValue - a.totalValue);
        setSupplierData(supplierArray);

        // Fetch purchase order items for ingredient data
        const purchaseOrderIds = purchaseOrders?.map((po: any) => po.id) || [];
        let ingredientMap = new Map<string, { name: string; quantity: number; cost: number }>();

        if (purchaseOrderIds.length > 0) {
          const { data: purchaseOrderItems } = await supabase
            .from("purchase_order_items" as any)
            .select(`
              quantity_ordered,
              total_cost,
              ingredient_id,
              ingredients!inner(name)
            `)
            .in("purchase_order_id", purchaseOrderIds);

          purchaseOrderItems?.forEach((item: any) => {
            const ingredientId = item.ingredient_id;
            const ingredientName = item.ingredients?.name || "Ingrediente sem nome";
            const current = ingredientMap.get(ingredientId) || { name: ingredientName, quantity: 0, cost: 0 };
            ingredientMap.set(ingredientId, {
              name: ingredientName,
              quantity: current.quantity + Number(item.quantity_ordered),
              cost: current.cost + Number(item.total_cost || 0),
            });
          });
        }

        const ingredientArray = Array.from(ingredientMap.entries())
          .map(([ingredientId, data]) => ({
            ingredientId,
            ingredientName: data.name,
            quantityPurchased: data.quantity,
            totalCost: data.cost,
          }))
          .sort((a, b) => b.totalCost - a.totalCost);
        setIngredientData(ingredientArray);

      } catch (error) {
        console.error("Error loading costs data:", error);
        toast({ title: "Erro ao carregar dados", description: "Não foi possível carregar os dados de custos.", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [restaurantId, dateRange, toast]);

  // Load purchase order history for selected supplier
  async function loadSupplierHistory(supplier: SupplierData) {
    setSelectedSupplier(supplier);
    setDrawerOpen(true);
    setLoadingHistory(true);

    try {
      const fromDate = dateRange.from.toISOString();
      const toDate = dateRange.to.toISOString();

      const { data: purchaseOrders } = await supabase
        .from("purchase_orders" as any)
        .select("id, order_number, status, total_value, received_at, notes")
        .eq("restaurant_id", restaurantId)
        .eq("supplier_id", supplier.supplierId)
        .gte("received_at", fromDate)
        .lte("received_at", toDate)
        .order("received_at", { ascending: false });

      setPurchaseOrderHistory(purchaseOrders?.map((po: any) => ({
        id: po.id,
        orderNumber: po.order_number || `PO-${po.id.substring(0, 8)}`,
        status: po.status,
        totalValue: Number(po.total_value),
        receivedAt: po.received_at,
        notes: po.notes,
      })) || []);

    } catch (error) {
      console.error("Error loading supplier history:", error);
      toast({ title: "Erro ao carregar histórico", description: "Não foi possível carregar o histórico do fornecedor.", variant: "destructive" });
    } finally {
      setLoadingHistory(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Custos de Insumos</h1>
            <p className="text-muted-foreground text-sm">Análise de gastos com insumos</p>
          </div>
          <Skeleton className="h-10 w-[200px]" />
        </div>
        <Card>
          <CardContent className="pt-6">
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardContent className="pt-6">
              <Skeleton className="h-[300px] w-full" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <Skeleton className="h-[300px] w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Custos de Insumos</h1>
          <p className="text-muted-foreground text-sm">Análise de gastos com insumos</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={presetRange} onValueChange={(value: PresetRange) => setPresetRange(value)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Hoje</SelectItem>
              <SelectItem value="week">Esta semana</SelectItem>
              <SelectItem value="month">Este mês</SelectItem>
              <SelectItem value="custom">Personalizado</SelectItem>
            </SelectContent>
          </Select>
          {presetRange === "custom" && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-[280px] justify-start text-left font-normal")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "dd/MM/yyyy", { locale: ptBR })} -{" "}
                        {format(dateRange.to, "dd/MM/yyyy", { locale: ptBR })}
                      </>
                    ) : (
                      format(dateRange.from, "dd/MM/yyyy", { locale: ptBR })
                    )
                  ) : (
                    <span>Selecione um período</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="range"
                  selected={dateRange}
                  onSelect={(range) => {
                    if (range?.from && range?.to) {
                      setDateRange(range);
                    }
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          )}
        </div>
      </div>

      {/* Total Spent Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Total Gasto no Período</p>
              <p className="text-3xl font-bold">{formatCurrency(totalSpent)}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Package className="w-6 h-6" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Charts and Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Spending by Month Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Gasto por Mês</CardTitle>
            <CardDescription>Últimos 6 meses</CardDescription>
          </CardHeader>
          <CardContent>
            {spendingByMonth.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={spendingByMonth}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis className="text-xs" tickFormatter={(value) => `R$ ${value}`} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">
                Sem dados para exibir
              </div>
            )}
          </CardContent>
        </Card>

        {/* Spending by Supplier Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Gasto por Fornecedor</CardTitle>
            <CardDescription>Clique no fornecedor para ver histórico</CardDescription>
          </CardHeader>
          <CardContent>
            {supplierData.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead className="text-right">Pedidos</TableHead>
                    <TableHead className="text-right">Valor Total</TableHead>
                    <TableHead className="text-right">% Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {supplierData.map((supplier) => (
                    <TableRow
                      key={supplier.supplierId}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => loadSupplierHistory(supplier)}
                    >
                      <TableCell className="font-medium">{supplier.supplierName}</TableCell>
                      <TableCell className="text-right">{formatNumber(supplier.orderCount)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(supplier.totalValue)}</TableCell>
                      <TableCell className="text-right">{supplier.percentage.toFixed(1)}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                Sem dados para exibir
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Spending by Ingredient Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Gasto por Ingrediente</CardTitle>
          <CardDescription>Ingredientes mais comprados no período</CardDescription>
        </CardHeader>
        <CardContent>
          {ingredientData.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ingrediente</TableHead>
                  <TableHead className="text-right">Qtd. Comprada</TableHead>
                  <TableHead className="text-right">Custo Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ingredientData.map((ingredient) => (
                  <TableRow key={ingredient.ingredientId}>
                    <TableCell className="font-medium">{ingredient.ingredientName}</TableCell>
                    <TableCell className="text-right">{formatNumber(ingredient.quantityPurchased)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(ingredient.totalCost)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
              Sem dados para exibir
            </div>
          )}
        </CardContent>
      </Card>

      {/* Supplier History Drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="w-[600px] sm:w-[700px]">
          <SheetHeader>
            <SheetTitle>Histórico de Pedidos</SheetTitle>
            <SheetDescription>
              {selectedSupplier?.supplierName} - {formatNumber(selectedSupplier?.orderCount || 0)} pedidos no período
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            {loadingHistory ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : purchaseOrderHistory.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nº Pedido</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Data Recebimento</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchaseOrderHistory.map((po) => (
                    <TableRow key={po.id}>
                      <TableCell className="font-medium">{po.orderNumber}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          po.status === 'recebido' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                          po.status === 'enviado' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                          'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
                        }`}>
                          {po.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(po.totalValue)}</TableCell>
                      <TableCell>
                        {po.receivedAt ? format(new Date(po.receivedAt), "dd/MM/yyyy", { locale: ptBR }) : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                Nenhum pedido encontrado no período
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
