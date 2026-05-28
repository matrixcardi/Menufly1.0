import { useState, useEffect } from "react";
import { format, startOfDay, endOfDay, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Download, ClipboardList, ChevronLeft, ChevronRight } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurantContext } from "@/contexts/RestaurantContext";
import { useToast } from "@/hooks/use-toast";

type DateRange = {
  from: Date;
  to: Date;
};

interface OrderData {
  id: string;
  orderNumber: string;
  dailyNumber: number | null;
  customerName: string;
  customerPhone: string;
  items: string;
  paymentMethod: string;
  grossValue: number;
  estimatedFee: number;
  netValue: number;
  status: string;
  createdAt: string;
}

interface Totals {
  totalOrders: number;
  sumGross: number;
  sumFees: number;
  sumNet: number;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatDateTime(dateString: string) {
  return format(new Date(dateString), "dd/MM/yyyy HH:mm", { locale: ptBR });
}

export default function AdminExtratoPedidos() {
  const { selectedRestaurant, selectedRestaurantIds } = useRestaurantContext();
  const [dateRange, setDateRange] = useState<DateRange>({
    from: startOfDay(subDays(new Date(), 30)),
    to: endOfDay(new Date()),
  });
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>("todos");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const { toast } = useToast();

  const restaurantId = selectedRestaurant?.id || (selectedRestaurantIds.length === 1 ? selectedRestaurantIds[0] : null);

  // Data states
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [totals, setTotals] = useState<Totals>({ totalOrders: 0, sumGross: 0, sumFees: 0, sumNet: 0 });
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [totalItems, setTotalItems] = useState(0);

  // Load data
  useEffect(() => {
    async function loadData() {
      if (!restaurantId) return;
      setLoading(true);

      try {
        const fromDate = dateRange.from.toISOString();
        const toDate = dateRange.to.toISOString();

        let query = supabase
          .from("orders")
          .select(`
            id,
            order_number,
            daily_number,
            customer_name,
            customer_phone,
            items,
            payment_method,
            total_amount,
            status,
            created_at
          `)
          .eq("restaurant_id", restaurantId)
          .gte("created_at", fromDate)
          .lte("created_at", toDate);

        if (statusFilter !== "todos") {
          query = query.eq("status", statusFilter);
        }

        if (paymentMethodFilter !== "todos") {
          query = query.eq("payment_method", paymentMethodFilter);
        }

        query = query.order("created_at", { ascending: false });

        const { data, count } = await query;

        const processedOrders: OrderData[] = (data || []).map((order: any) => {
          const grossValue = Number(order.total_amount);
          const estimatedFee = grossValue * 0.025; // 2.5% estimated fee
          const netValue = grossValue - estimatedFee;

          // Parse items to get a summary
          let itemsSummary = "";
          try {
            const itemsArray = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
            if (Array.isArray(itemsArray)) {
              itemsSummary = itemsArray.map((item: any) => {
                const name = item.name || item.productName || "Item";
                const qty = item.quantity || 1;
                return `${qty}x ${name}`;
              }).join(", ");
            }
          } catch (e) {
            itemsSummary = "Erro ao ler itens";
          }

          return {
            id: order.id,
            orderNumber: order.order_number || `#${order.daily_number || order.id.substring(0, 8)}`,
            dailyNumber: order.daily_number,
            customerName: order.customer_name || "Cliente não informado",
            customerPhone: order.customer_phone || "",
            items: itemsSummary,
            paymentMethod: order.payment_method || "Não informado",
            grossValue,
            estimatedFee,
            netValue,
            status: order.status,
            createdAt: order.created_at,
          };
        });

        setOrders(processedOrders);
        setTotalItems(count || 0);
        setCurrentPage(1);

        // Calculate totals
        const sumGross = processedOrders.reduce((sum, o) => sum + o.grossValue, 0);
        const sumFees = processedOrders.reduce((sum, o) => sum + o.estimatedFee, 0);
        const sumNet = processedOrders.reduce((sum, o) => sum + o.netValue, 0);

        setTotals({
          totalOrders: processedOrders.length,
          sumGross,
          sumFees,
          sumNet,
        });

      } catch (error) {
        console.error("Error loading orders data:", error);
        toast({ title: "Erro ao carregar dados", description: "Não foi possível carregar os dados dos pedidos.", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [restaurantId, dateRange, statusFilter, paymentMethodFilter, toast]);

  // Export CSV
  async function exportCSV() {
    setExporting(true);
    try {
      const fromDate = dateRange.from.toISOString();
      const toDate = dateRange.to.toISOString();

      let query = supabase
        .from("orders")
        .select(`
          id,
          order_number,
          daily_number,
          customer_name,
          customer_phone,
          items,
          payment_method,
          total_amount,
          status,
          created_at
        `)
        .eq("restaurant_id", restaurantId)
        .gte("created_at", fromDate)
        .lte("created_at", toDate);

      if (statusFilter !== "todos") {
        query = query.eq("status", statusFilter);
      }

      if (paymentMethodFilter !== "todos") {
        query = query.eq("payment_method", paymentMethodFilter);
      }

      const { data } = await query;

      const processedOrders = (data || []).map((order: any) => {
        const grossValue = Number(order.total_amount);
        const estimatedFee = grossValue * 0.025;
        const netValue = grossValue - estimatedFee;

        let itemsSummary = "";
        try {
          const itemsArray = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
          if (Array.isArray(itemsArray)) {
            itemsSummary = itemsArray.map((item: any) => {
              const name = item.name || item.productName || "Item";
              const qty = item.quantity || 1;
              return `${qty}x ${name}`;
            }).join(", ");
          }
        } catch (e) {
          itemsSummary = "Erro ao ler itens";
        }

        return {
          orderNumber: order.order_number || `#${order.daily_number || order.id.substring(0, 8)}`,
          customerName: order.customer_name || "Cliente não informado",
          items: itemsSummary,
          paymentMethod: order.payment_method || "Não informado",
          grossValue,
          estimatedFee,
          netValue,
          status: order.status,
          createdAt: order.created_at,
        };
      });

      // Create CSV
      const headers = ["Data/Hora", "Nº Pedido", "Cliente", "Itens", "Forma de Pagamento", "Valor Bruto", "Taxa Estimada", "Valor Líquido", "Status"];
      const csvContent = [
        headers.join(","),
        ...processedOrders.map((order) => [
          formatDateTime(order.createdAt),
          order.orderNumber,
          `"${order.customerName}"`,
          `"${order.items}"`,
          `"${order.paymentMethod}"`,
          order.grossValue.toFixed(2),
          order.estimatedFee.toFixed(2),
          order.netValue.toFixed(2),
          order.status,
        ].join(",")),
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `extrato_pedidos_${format(new Date(), "dd-MM-yyyy")}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({ title: "CSV exportado com sucesso!" });

    } catch (error) {
      console.error("Error exporting CSV:", error);
      toast({ title: "Erro ao exportar", description: "Não foi possível exportar o CSV.", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  }

  // Pagination
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const paginatedOrders = orders.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  function getStatusBadge(status: string) {
    const statusMap: Record<string, { label: string; className: string }> = {
      pending: { label: "Pendente", className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
      confirmed: { label: "Confirmado", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
      preparing: { label: "Preparando", className: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
      ready: { label: "Pronto", className: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400" },
      delivered: { label: "Entregue", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
      cancelled: { label: "Cancelado", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
    };
    const statusInfo = statusMap[status] || { label: status, className: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400" };
    return <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusInfo.className}`}>{statusInfo.label}</span>;
  }

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Extrato de Pedidos</h1>
            <p className="text-muted-foreground text-sm">Histórico detalhado de pedidos</p>
          </div>
          <Skeleton className="h-10 w-[200px]" />
        </div>
        <Card>
          <CardContent className="pt-6">
            <Skeleton className="h-[400px] w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Extrato de Pedidos</h1>
          <p className="text-muted-foreground text-sm">Histórico detalhado de pedidos</p>
        </div>
        <Button onClick={exportCSV} disabled={exporting} className="gap-2">
          <Download className="w-4 h-4" />
          {exporting ? "Exportando..." : "Exportar CSV"}
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[200px]">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal")}>
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
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="confirmed">Confirmado</SelectItem>
                <SelectItem value="preparing">Preparando</SelectItem>
                <SelectItem value="ready">Pronto</SelectItem>
                <SelectItem value="delivered">Entregue</SelectItem>
                <SelectItem value="cancelled">Cancelado</SelectItem>
              </SelectContent>
            </Select>
            <Select value={paymentMethodFilter} onValueChange={setPaymentMethodFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas as formas</SelectItem>
                <SelectItem value="pix">PIX</SelectItem>
                <SelectItem value="credit_card">Cartão de Crédito</SelectItem>
                <SelectItem value="debit_card">Cartão de Débito</SelectItem>
                <SelectItem value="cash">Dinheiro</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data/Hora</TableHead>
                <TableHead>Nº Pedido</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Itens</TableHead>
                <TableHead>Forma de Pagamento</TableHead>
                <TableHead className="text-right">Valor Bruto</TableHead>
                <TableHead className="text-right">Taxa Estimada</TableHead>
                <TableHead className="text-right">Valor Líquido</TableHead>
                <TableHead className="text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedOrders.length > 0 ? (
                paginatedOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell>{formatDateTime(order.createdAt)}</TableCell>
                    <TableCell className="font-medium">{order.orderNumber}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{order.customerName}</p>
                        {order.customerPhone && <p className="text-xs text-muted-foreground">{order.customerPhone}</p>}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate" title={order.items}>
                      {order.items}
                    </TableCell>
                    <TableCell>{order.paymentMethod}</TableCell>
                    <TableCell className="text-right">{formatCurrency(order.grossValue)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{formatCurrency(order.estimatedFee)}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(order.netValue)}</TableCell>
                    <TableCell className="text-center">{getStatusBadge(order.status)}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    Nenhum pedido encontrado com os filtros selecionados
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Totals Footer */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Total de Pedidos</p>
              <p className="text-2xl font-bold">{totals.totalOrders}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Soma Bruta</p>
              <p className="text-2xl font-bold">{formatCurrency(totals.sumGross)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Soma Taxas</p>
              <p className="text-2xl font-bold text-muted-foreground">{formatCurrency(totals.sumFees)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Soma Líquida</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(totals.sumNet)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Mostrando {(currentPage - 1) * itemsPerPage + 1} a {Math.min(currentPage * itemsPerPage, totalItems)} de {totalItems} pedidos
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="w-4 h-4" />
              Anterior
            </Button>
            <span className="text-sm">
              Página {currentPage} de {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Próxima
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
