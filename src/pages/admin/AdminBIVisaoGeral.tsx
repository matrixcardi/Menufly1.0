import { useState, useEffect, useMemo } from "react";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, TrendingUp, DollarSign, Package, ShoppingCart, Percent, BarChart3, LineChart, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurantContext } from "@/contexts/RestaurantContext";
import { useToast } from "@/hooks/use-toast";
import { LineChart as RechartsLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";

type DateRange = {
  from: Date;
  to: Date;
};

type PresetRange = "today" | "week" | "month" | "year" | "custom";

interface KPICardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  trend?: number;
  trendLabel?: string;
}

function KPICard({ title, value, icon, trend, trendLabel }: KPICardProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {trend !== undefined && (
              <div className="flex items-center gap-1 text-xs">
                {trend >= 0 ? (
                  <ArrowUpRight className="w-3 h-3 text-green-600" />
                ) : (
                  <ArrowDownRight className="w-3 h-3 text-red-600" />
                )}
                <span className={trend >= 0 ? "text-green-600" : "text-red-600"}>
                  {Math.abs(trend).toFixed(1)}%
                </span>
                {trendLabel && <span className="text-muted-foreground">{trendLabel}</span>}
              </div>
            )}
          </div>
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
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

export default function AdminBIVisaoGeral() {
  const { selectedRestaurant, selectedRestaurantIds } = useRestaurantContext();
  const [dateRange, setDateRange] = useState<DateRange>({
    from: startOfDay(new Date()),
    to: endOfDay(new Date()),
  });
  const [presetRange, setPresetRange] = useState<PresetRange>("today");
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const restaurantId = selectedRestaurant?.id || (selectedRestaurantIds.length === 1 ? selectedRestaurantIds[0] : null);

  // Data states
  const [revenue, setRevenue] = useState(0);
  const [ingredientCost, setIngredientCost] = useState(0);
  const [totalOrders, setTotalOrders] = useState(0);
  const [revenueByDay, setRevenueByDay] = useState<Array<{ date: string; revenue: number }>>([]);
  const [revenueCostByWeek, setRevenueCostByWeek] = useState<Array<{ week: string; revenue: number; cost: number }>>([]);
  const [topProducts, setTopProducts] = useState<Array<{ name: string; quantity: number; revenue: number }>>([]);

  // Handle preset range changes
  useEffect(() => {
    const now = new Date();
    switch (presetRange) {
      case "today":
        setDateRange({ from: startOfDay(now), to: endOfDay(now) });
        break;
      case "week":
        setDateRange({ from: startOfWeek(now, { weekStartsOn: 0 }), to: endOfWeek(now, { weekStartsOn: 0 }) });
        break;
      case "month":
        setDateRange({ from: startOfMonth(now), to: endOfMonth(now) });
        break;
      case "year":
        setDateRange({ from: startOfYear(now), to: endOfYear(now) });
        break;
      case "custom":
        // Keep current date range
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

        // Fetch orders for revenue and order count
        const { data: orders } = await supabase
          .from("orders")
          .select("total_amount, created_at")
          .eq("restaurant_id", restaurantId)
          .neq("status", "cancelled")
          .gte("created_at", fromDate)
          .lte("created_at", toDate);

        const totalRevenue = orders?.reduce((sum, order) => sum + Number(order.total_amount), 0) || 0;
        const orderCount = orders?.length || 0;
        setRevenue(totalRevenue);
        setTotalOrders(orderCount);

        // Fetch purchase orders for ingredient cost
        const { data: purchaseOrders } = await supabase
          .from("purchase_orders")
          .select("total_value, received_at")
          .eq("restaurant_id", restaurantId)
          .eq("status", "recebido")
          .gte("received_at", fromDate)
          .lte("received_at", toDate);

        const totalCost = purchaseOrders?.reduce((sum, po) => sum + Number(po.total_value), 0) || 0;
        setIngredientCost(totalCost);

        // Revenue by day
        const revenueByDayMap = new Map<string, number>();
        orders?.forEach(order => {
          if (order.created_at) {
            const date = format(new Date(order.created_at), "dd/MM");
            revenueByDayMap.set(date, (revenueByDayMap.get(date) || 0) + Number(order.total_amount));
          }
        });
        const revenueByDayArray = Array.from(revenueByDayMap.entries())
          .map(([date, revenue]) => ({ date, revenue }))
          .sort((a, b) => a.date.localeCompare(b.date));
        setRevenueByDay(revenueByDayArray);

        // Revenue and cost by week
        const revenueCostByWeekMap = new Map<string, { revenue: number; cost: number }>();
        orders?.forEach(order => {
          if (order.created_at) {
            const week = format(new Date(order.created_at), "'Sem' w", { locale: ptBR });
            const current = revenueCostByWeekMap.get(week) || { revenue: 0, cost: 0 };
            revenueCostByWeekMap.set(week, { ...current, revenue: current.revenue + Number(order.total_amount) });
          }
        });
        purchaseOrders?.forEach(po => {
          if (po.received_at) {
            const week = format(new Date(po.received_at), "'Sem' w", { locale: ptBR });
            const current = revenueCostByWeekMap.get(week) || { revenue: 0, cost: 0 };
            revenueCostByWeekMap.set(week, { ...current, cost: current.cost + Number(po.total_value) });
          }
        });
        const revenueCostByWeekArray = Array.from(revenueCostByWeekMap.entries())
          .map(([week, data]) => ({ week, ...data }))
          .sort((a, b) => a.week.localeCompare(b.week));
        setRevenueCostByWeek(revenueCostByWeekArray);

        // Top 5 products
        const { data: orderItems } = await supabase
          .from("order_items")
          .select("product_id, quantity, total_price, products!inner(name)")
          .eq("restaurant_id", restaurantId)
          .gte("created_at", fromDate)
          .lte("created_at", toDate);

        const productMap = new Map<string, { name: string; quantity: number; revenue: number }>();
        orderItems?.forEach(item => {
          const productId = item.product_id;
          const productName = (item as any).products?.name || "Produto sem nome";
          const current = productMap.get(productId) || { name: productName, quantity: 0, revenue: 0 };
          productMap.set(productId, {
            name: productName,
            quantity: current.quantity + Number(item.quantity),
            revenue: current.revenue + Number(item.total_price),
          });
        });
        const topProductsArray = Array.from(productMap.values())
          .sort((a, b) => b.quantity - a.quantity)
          .slice(0, 5);
        setTopProducts(topProductsArray);

      } catch (error) {
        console.error("Error loading BI data:", error);
        toast({ title: "Erro ao carregar dados", description: "Não foi possível carregar os dados do BI.", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [restaurantId, dateRange, toast]);

  // Calculated KPIs
  const grossProfit = revenue - ingredientCost;
  const margin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
  const averageTicket = totalOrders > 0 ? revenue / totalOrders : 0;

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">BI Financeiro</h1>
            <p className="text-muted-foreground text-sm">Visão geral do desempenho financeiro</p>
          </div>
          <Skeleton className="h-10 w-[200px]" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">BI Financeiro</h1>
          <p className="text-muted-foreground text-sm">Visão geral do desempenho financeiro</p>
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
              <SelectItem value="year">Este ano</SelectItem>
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

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <KPICard
          title="Faturamento Total"
          value={formatCurrency(revenue)}
          icon={<DollarSign className="w-6 h-6" />}
        />
        <KPICard
          title="Custo de Insumos"
          value={formatCurrency(ingredientCost)}
          icon={<Package className="w-6 h-6" />}
        />
        <KPICard
          title="Lucro Bruto"
          value={formatCurrency(grossProfit)}
          icon={<TrendingUp className="w-6 h-6" />}
        />
        <KPICard
          title="Margem %"
          value={`${margin.toFixed(1)}%`}
          icon={<Percent className="w-6 h-6" />}
        />
        <KPICard
          title="Ticket Médio"
          value={formatCurrency(averageTicket)}
          icon={<ShoppingCart className="w-6 h-6" />}
        />
        <KPICard
          title="Total de Pedidos"
          value={formatNumber(totalOrders)}
          icon={<BarChart3 className="w-6 h-6" />}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue by Day */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Faturamento por Dia</CardTitle>
            <CardDescription>Evolução do faturamento no período selecionado</CardDescription>
          </CardHeader>
          <CardContent>
            {revenueByDay.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <RechartsLineChart data={revenueByDay}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-xs" />
                  <YAxis className="text-xs" tickFormatter={(value) => `R$ ${value}`} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} />
                </RechartsLineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">
                Sem dados para exibir
              </div>
            )}
          </CardContent>
        </Card>

        {/* Revenue vs Cost by Week */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Receita x Custo por Semana</CardTitle>
            <CardDescription>Comparativo de receita e custo de insumos</CardDescription>
          </CardHeader>
          <CardContent>
            {revenueCostByWeek.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={revenueCostByWeek}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="week" className="text-xs" />
                  <YAxis className="text-xs" tickFormatter={(value) => `R$ ${value}`} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Bar dataKey="revenue" fill="hsl(var(--primary))" name="Receita" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="cost" fill="hsl(var(--destructive))" name="Custo" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">
                Sem dados para exibir
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top 5 Products */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top 5 Produtos Mais Vendidos</CardTitle>
          <CardDescription>Produtos com maior quantidade vendida no período</CardDescription>
        </CardHeader>
        <CardContent>
          {topProducts.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-right">Qtd. Vendida</TableHead>
                  <TableHead className="text-right">Receita Gerada</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topProducts.map((product, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell className="text-right">{formatNumber(product.quantity)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(product.revenue)}</TableCell>
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
  );
}
