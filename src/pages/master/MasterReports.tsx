import { useState, useEffect } from "react";
import { format, startOfDay, endOfDay, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Download, Store, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart3,
  TrendingUp,
  Clock,
  DollarSign,
  Package,
  ShoppingBag,
  Percent,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";

type DateRange = {
  from: Date;
  to: Date;
};

type PresetRange = "today" | "yesterday" | "week" | "month" | "custom";

interface OrderItem {
  name: string;
  quantity: number;
  price: number;
}

interface Restaurant {
  id: string;
  name: string;
  logo_url: string | null;
}

export default function MasterReports() {
  const [dateRange, setDateRange] = useState<DateRange>({
    from: startOfDay(new Date()),
    to: endOfDay(new Date()),
  });
  const [presetRange, setPresetRange] = useState<PresetRange>("today");
  const [loading, setLoading] = useState(true);
  const [loadingRestaurants, setLoadingRestaurants] = useState(true);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string | null>(null);
  const [selectedRestaurantName, setSelectedRestaurantName] = useState<string>("");
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [restaurantSearch, setRestaurantSearch] = useState("");
  const { toast } = useToast();
  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalOrders: 0,
    averageTicket: 0,
    deliveryOrders: 0,
    pickupOrders: 0,
    topProducts: [] as { name: string; quantity: number; revenue: number }[],
    ordersByHour: {} as Record<number, number>,
    paymentMethods: {} as Record<string, number>,
    revenueByDayOfWeek: {} as Record<number, number>,
  });

  // Fetch all restaurants
  useEffect(() => {
    async function fetchRestaurants() {
      setLoadingRestaurants(true);
      const { data, error } = await supabase
        .from("all_restaurants")
        .select("id, name, logo_url")
        .order("name");

      if (!error && data) {
        setRestaurants(data);
        if (data.length > 0) {
          setSelectedRestaurantId(data[0].id);
          setSelectedRestaurantName(data[0].name);
        }
      }
      setLoadingRestaurants(false);
    }
    fetchRestaurants();
  }, []);

  // Fetch orders based on selected restaurant and date range
  useEffect(() => {
    if (!selectedRestaurantId) {
      setLoading(false);
      return;
    }

    async function fetchOrders() {
      setLoading(true);

      const { data: orders, error } = await supabase
        .from("all_orders")
        .select("*")
        .eq("restaurant_id", selectedRestaurantId)
        .gte("created_at", dateRange.from.toISOString())
        .lte("created_at", dateRange.to.toISOString())
        .neq("status", "cancelled");

      if (error || !orders) {
        setLoading(false);
        return;
      }

      // Calculate stats
      const totalRevenue = orders.reduce((sum, order) => sum + Number(order.total || 0), 0);
      const totalOrders = orders.length;
      const averageTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0;
      const deliveryOrders = orders.filter(o => o.delivery_type === "delivery").length;
      const pickupOrders = orders.filter(o => o.delivery_type === "pickup").length;

      // Top products
      const productMap = new Map<string, { quantity: number; revenue: number }>();
      orders.forEach(order => {
        const items = order.items as unknown as OrderItem[];
        if (Array.isArray(items)) {
          items.forEach(item => {
            const existing = productMap.get(item.name) || { quantity: 0, revenue: 0 };
            productMap.set(item.name, {
              quantity: existing.quantity + item.quantity,
              revenue: existing.revenue + (item.price * item.quantity),
            });
          });
        }
      });

      const topProducts = Array.from(productMap.entries())
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 5);

      // Orders by hour
      const ordersByHour: Record<number, number> = {};
      orders.forEach(order => {
        const hour = new Date(order.created_at || "").getHours();
        ordersByHour[hour] = (ordersByHour[hour] || 0) + 1;
      });

      // Payment methods
      const paymentMethods: Record<string, number> = {};
      orders.forEach(order => {
        if (order.payment_method) {
          paymentMethods[order.payment_method] = (paymentMethods[order.payment_method] || 0) + 1;
        }
      });

      // Revenue by day of week
      const revenueByDayOfWeek: Record<number, number> = {};
      orders.forEach(order => {
        const dayOfWeek = new Date(order.created_at || "").getDay();
        revenueByDayOfWeek[dayOfWeek] = (revenueByDayOfWeek[dayOfWeek] || 0) + Number(order.total || 0);
      });

      setStats({
        totalRevenue,
        totalOrders,
        averageTicket,
        deliveryOrders,
        pickupOrders,
        topProducts,
        ordersByHour,
        paymentMethods,
        revenueByDayOfWeek,
      });

      setLoading(false);
    }

    fetchOrders();
  }, [selectedRestaurantId, dateRange]);

  const handlePresetChange = (preset: PresetRange) => {
    setPresetRange(preset);
    const now = new Date();

    switch (preset) {
      case "today":
        setDateRange({ from: startOfDay(now), to: endOfDay(now) });
        break;
      case "yesterday":
        const yesterday = subDays(now, 1);
        setDateRange({ from: startOfDay(yesterday), to: endOfDay(yesterday) });
        break;
      case "week":
        setDateRange({ from: startOfWeek(now, { locale: ptBR }), to: endOfWeek(now, { locale: ptBR }) });
        break;
      case "month":
        setDateRange({ from: startOfMonth(now), to: endOfMonth(now) });
        break;
    }
  };

  const handleRestaurantChange = (restaurantId: string) => {
    setSelectedRestaurantId(restaurantId);
    const restaurant = restaurants.find(r => r.id === restaurantId);
    if (restaurant) {
      setSelectedRestaurantName(restaurant.name);
    }
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  const getPeakHour = () => {
    const entries = Object.entries(stats.ordersByHour);
    if (entries.length === 0) return "-";
    const [peakHour] = entries.sort(([, a], [, b]) => b - a)[0];
    return `${peakHour}:00 - ${Number(peakHour) + 1}:00`;
  };

  const paymentMethodLabels: Record<string, string> = {
    pix: "PIX",
    cash: "Dinheiro",
    card: "Cartão",
  };

  const loadImageAsBase64 = (src: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Could not get canvas context"));
          return;
        }
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = reject;
      img.src = src;
    });
  };

  const generatePDF = async () => {
    setGeneratingPdf(true);
    
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      let yPos = 15;

      const addBlackBackground = () => {
        doc.setFillColor(15, 15, 15);
        doc.rect(0, 0, pageWidth, pageHeight, "F");
      };

      addBlackBackground();

      // Load and add logo
      try {
        const logoModule = await import("@/assets/logo-pdf.png");
        const logoBase64 = await loadImageAsBase64(logoModule.default);
        const logoWidth = 50;
        const logoHeight = 12;
        doc.addImage(logoBase64, "PNG", (pageWidth - logoWidth) / 2, yPos, logoWidth, logoHeight);
        yPos += logoHeight + 8;
      } catch {
        doc.setFontSize(24);
        doc.setTextColor(234, 88, 12);
        doc.text("MenuFly", pageWidth / 2, yPos + 10, { align: "center" });
        yPos += 15;
      }

      doc.setFontSize(10);
      doc.setTextColor(160, 160, 160);
      doc.text("Relatório de Vendas", pageWidth / 2, yPos, { align: "center" });
      yPos += 12;

      doc.setFontSize(16);
      doc.setTextColor(255, 255, 255);
      doc.text(selectedRestaurantName || "Restaurante", pageWidth / 2, yPos, { align: "center" });
      yPos += 10;

      const periodText = dateRange.from.getTime() === dateRange.to.getTime()
        ? format(dateRange.from, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
        : `${format(dateRange.from, "dd/MM/yyyy")} a ${format(dateRange.to, "dd/MM/yyyy")}`;
      
      doc.setFontSize(11);
      doc.setTextColor(160, 160, 160);
      doc.text(`Período: ${periodText}`, pageWidth / 2, yPos, { align: "center" });
      yPos += 5;

      doc.setFontSize(9);
      doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, pageWidth / 2, yPos, { align: "center" });
      yPos += 15;

      doc.setDrawColor(60, 60, 60);
      doc.line(20, yPos, pageWidth - 20, yPos);
      yPos += 15;

      doc.setFontSize(14);
      doc.setTextColor(255, 255, 255);
      doc.text("Resumo Financeiro", 20, yPos);
      yPos += 8;

      const metrics = [
        { label: "Faturamento Total", value: formatCurrency(stats.totalRevenue), highlight: true, icon: "dollar" },
        { label: "Total de Pedidos", value: stats.totalOrders.toString(), icon: "package" },
        { label: "Ticket Médio", value: formatCurrency(stats.averageTicket), icon: "trending" },
        { label: "Pedidos Entrega", value: stats.deliveryOrders.toString(), icon: "truck" },
        { label: "Pedidos Retirada", value: stats.pickupOrders.toString(), icon: "store" },
        { label: "Horário de Pico", value: getPeakHour(), icon: "clock" },
      ];

      const drawIcon = (iconType: string, x: number, y: number, size: number) => {
        doc.setDrawColor(100, 100, 100);
        doc.setLineWidth(0.4);
        
        switch (iconType) {
          case "dollar":
            doc.circle(x + size/2, y + size/2, size/2, "S");
            doc.setFontSize(6);
            doc.setTextColor(100, 100, 100);
            doc.text("$", x + size/2, y + size/2 + 1.5, { align: "center" });
            break;
          case "package":
            doc.rect(x + 1, y + 2, size - 2, size - 3, "S");
            doc.line(x + 1, y + 4.5, x + size - 1, y + 4.5);
            break;
          case "trending":
            doc.line(x + 1, y + size - 2, x + size/2, y + 3);
            doc.line(x + size/2, y + 3, x + size - 1, y + size/2);
            doc.line(x + size - 3, y + 2, x + size - 1, y + size/2);
            break;
          case "truck":
            doc.rect(x + 1, y + 3, size - 4, size - 5, "S");
            doc.rect(x + size - 3, y + 5, 2.5, size - 7, "S");
            doc.circle(x + 3, y + size - 1.5, 1, "S");
            doc.circle(x + size - 2, y + size - 1.5, 1, "S");
            break;
          case "store":
            doc.rect(x + 1, y + 3, size - 2, size - 4, "S");
            doc.line(x, y + 3, x + size/2, y + 1);
            doc.line(x + size/2, y + 1, x + size, y + 3);
            doc.rect(x + size/2 - 1.5, y + size - 4, 3, 3, "S");
            break;
          case "clock":
            doc.circle(x + size/2, y + size/2, size/2 - 0.5, "S");
            doc.line(x + size/2, y + size/2, x + size/2, y + 2.5);
            doc.line(x + size/2, y + size/2, x + size - 2, y + size/2);
            break;
        }
        doc.setLineWidth(0.2);
      };

      const cardWidth = 55;
      const cardHeight = 28;
      const cardGap = 5;
      const startX = 20;
      const cardsPerRow = 3;

      metrics.forEach((metric, index) => {
        const row = Math.floor(index / cardsPerRow);
        const col = index % cardsPerRow;
        const cardX = startX + col * (cardWidth + cardGap);
        const cardY = yPos + row * (cardHeight + cardGap);

        doc.setFillColor(30, 30, 30);
        doc.roundedRect(cardX, cardY, cardWidth, cardHeight, 3, 3, "F");

        doc.setDrawColor(50, 50, 50);
        doc.roundedRect(cardX, cardY, cardWidth, cardHeight, 3, 3, "S");

        drawIcon(metric.icon, cardX + cardWidth - 12, cardY + 3, 8);

        doc.setFontSize(8);
        doc.setTextColor(140, 140, 140);
        doc.text(metric.label, cardX + 5, cardY + 10);

        doc.setFontSize(12);
        doc.setTextColor(metric.highlight ? 234 : 255, metric.highlight ? 88 : 255, metric.highlight ? 12 : 255);
        doc.text(metric.value, cardX + 5, cardY + 21);
      });

      yPos += Math.ceil(metrics.length / cardsPerRow) * (cardHeight + cardGap) + 10;

      // Top Products section
      if (stats.topProducts.length > 0) {
        doc.setFontSize(14);
        doc.setTextColor(255, 255, 255);
        doc.text("Produtos Mais Vendidos", 20, yPos);
        yPos += 8;

        const productsCardHeight = 8 + stats.topProducts.length * 9;
        doc.setFillColor(30, 30, 30);
        doc.roundedRect(20, yPos, 170, productsCardHeight, 3, 3, "F");
        doc.setDrawColor(50, 50, 50);
        doc.roundedRect(20, yPos, 170, productsCardHeight, 3, 3, "S");

        yPos += 7;
        doc.setFontSize(10);
        stats.topProducts.forEach((product, index) => {
          doc.setFillColor(234, 88, 12);
          doc.circle(28, yPos - 1.5, 3, "F");
          doc.setFontSize(7);
          doc.setTextColor(255, 255, 255);
          doc.text(`${index + 1}`, 28, yPos - 0.5, { align: "center" });

          doc.setFontSize(10);
          doc.setTextColor(200, 200, 200);
          const truncatedName = product.name.length > 25 ? product.name.substring(0, 25) + "..." : product.name;
          doc.text(truncatedName, 35, yPos);

          doc.setTextColor(255, 255, 255);
          doc.text(`${product.quantity} un.`, 130, yPos);
          doc.setTextColor(34, 197, 94);
          doc.text(formatCurrency(product.revenue), 155, yPos);
          yPos += 9;
        });

        yPos += 8;
      }

      // Payment Methods section
      const paymentEntries = Object.entries(stats.paymentMethods);
      if (paymentEntries.length > 0) {
        doc.setFontSize(14);
        doc.setTextColor(255, 255, 255);
        doc.text("Formas de Pagamento", 20, yPos);
        yPos += 8;

        const sortedPayments = paymentEntries.sort(([, a], [, b]) => b - a);
        const paymentsCardHeight = 8 + sortedPayments.length * 14;
        doc.setFillColor(30, 30, 30);
        doc.roundedRect(20, yPos, 170, paymentsCardHeight, 3, 3, "F");
        doc.setDrawColor(50, 50, 50);
        doc.roundedRect(20, yPos, 170, paymentsCardHeight, 3, 3, "S");

        yPos += 7;
        sortedPayments.forEach(([method, count]) => {
          const percentage = stats.totalOrders > 0 
            ? Math.round((count / stats.totalOrders) * 100) 
            : 0;

          doc.setFontSize(10);
          doc.setTextColor(200, 200, 200);
          doc.text(paymentMethodLabels[method] || method, 28, yPos);

          doc.setTextColor(255, 255, 255);
          doc.text(`${count} pedidos`, 100, yPos);

          doc.setFillColor(60, 60, 60);
          doc.roundedRect(145, yPos - 4, 20, 6, 2, 2, "F");
          doc.setFontSize(8);
          doc.setTextColor(160, 160, 160);
          doc.text(`${percentage}%`, 155, yPos - 0.5, { align: "center" });

          yPos += 4;
          doc.setFillColor(50, 50, 50);
          doc.roundedRect(28, yPos, 130, 3, 1, 1, "F");
          if (percentage > 0) {
            doc.setFillColor(234, 88, 12);
            doc.roundedRect(28, yPos, (130 * percentage) / 100, 3, 1, 1, "F");
          }
          yPos += 10;
        });

        yPos += 8;
      }

      // Orders by Hour Chart
      const hourEntries = Object.entries(stats.ordersByHour);
      if (hourEntries.length > 0) {
        if (yPos > 220) {
          doc.addPage();
          addBlackBackground();
          yPos = 20;
        }

        doc.setFontSize(14);
        doc.setTextColor(255, 255, 255);
        doc.text("Pedidos por Horário", 20, yPos);
        yPos += 10;

        const chartX = 25;
        const chartWidth = 160;
        const chartHeight = 50;
        const barWidth = chartWidth / 24;
        const maxCount = Math.max(...Object.values(stats.ordersByHour), 1);

        doc.setFillColor(30, 30, 30);
        doc.rect(chartX, yPos, chartWidth, chartHeight, "F");

        for (let hour = 0; hour < 24; hour++) {
          const count = stats.ordersByHour[hour] || 0;
          const barHeight = (count / maxCount) * (chartHeight - 10);
          const barX = chartX + hour * barWidth;
          const barY = yPos + chartHeight - barHeight - 5;

          if (count > 0) {
            doc.setFillColor(234, 88, 12);
            doc.rect(barX + 1, barY, barWidth - 2, barHeight, "F");
          }
        }

        doc.setFontSize(7);
        doc.setTextColor(160, 160, 160);
        for (let hour = 0; hour < 24; hour += 4) {
          const labelX = chartX + hour * barWidth + barWidth / 2;
          doc.text(`${hour}h`, labelX, yPos + chartHeight + 4, { align: "center" });
        }

        doc.text(`${maxCount}`, chartX - 3, yPos + 5, { align: "right" });
        doc.text("0", chartX - 3, yPos + chartHeight - 3, { align: "right" });

        yPos += chartHeight + 15;
      }

      // Revenue by Day of Week Chart
      const dayEntries = Object.entries(stats.revenueByDayOfWeek);
      if (dayEntries.length > 0) {
        if (yPos > 220) {
          doc.addPage();
          addBlackBackground();
          yPos = 20;
        }

        doc.setFontSize(14);
        doc.setTextColor(255, 255, 255);
        doc.text("Faturamento por Dia da Semana", 20, yPos);
        yPos += 10;

        const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
        const chartX = 25;
        const chartWidth = 160;
        const chartHeight = 50;
        const barWidth = chartWidth / 7;
        const maxRevenue = Math.max(...Object.values(stats.revenueByDayOfWeek), 1);

        doc.setFillColor(30, 30, 30);
        doc.rect(chartX, yPos, chartWidth, chartHeight, "F");

        for (let day = 0; day < 7; day++) {
          const revenue = stats.revenueByDayOfWeek[day] || 0;
          const barHeight = (revenue / maxRevenue) * (chartHeight - 10);
          const barX = chartX + day * barWidth;
          const barY = yPos + chartHeight - barHeight - 5;

          if (revenue > 0) {
            doc.setFillColor(34, 197, 94);
            doc.rect(barX + 3, barY, barWidth - 6, barHeight, "F");
          }

          doc.setFontSize(8);
          doc.setTextColor(160, 160, 160);
          doc.text(dayNames[day], barX + barWidth / 2, yPos + chartHeight + 4, { align: "center" });
        }

        doc.setFontSize(7);
        const maxRevenueFormatted = maxRevenue >= 1000 
          ? `R$${(maxRevenue / 1000).toFixed(1)}k` 
          : `R$${maxRevenue.toFixed(0)}`;
        doc.text(maxRevenueFormatted, chartX - 3, yPos + 5, { align: "right" });
        doc.text("R$0", chartX - 3, yPos + chartHeight - 3, { align: "right" });

        yPos += chartHeight + 15;
      }

      // Footer
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text("Relatório gerado automaticamente pelo MenuFly", pageWidth / 2, pageHeight - 10, { align: "center" });

      const dateStr = format(dateRange.from, "yyyy-MM-dd");
      const filename = `relatorio-${selectedRestaurantName?.toLowerCase().replace(/\s+/g, '-') || 'menufly'}-${dateStr}.pdf`;

      doc.save(filename);

      toast({
        title: "✅ Relatório gerado!",
        description: `O arquivo ${filename} foi baixado`,
      });
    } catch (error) {
      toast({
        title: "Erro ao gerar PDF",
        description: "Tente novamente",
        variant: "destructive",
      });
    } finally {
      setGeneratingPdf(false);
    }
  };

  const filteredRestaurants = restaurants.filter(r =>
    r.name.toLowerCase().includes(restaurantSearch.toLowerCase())
  );

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-bold">Relatórios</h1>
          <p className="text-muted-foreground">
            Gere relatórios de vendas para qualquer restaurante
          </p>
        </div>

        {/* Restaurant Selector */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Store className="h-4 w-4" />
              Selecionar Restaurante
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingRestaurants ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <Select
                value={selectedRestaurantId || ""}
                onValueChange={handleRestaurantChange}
              >
                <SelectTrigger className="w-full md:w-[400px]">
                  <SelectValue placeholder="Escolha um restaurante" />
                </SelectTrigger>
                <SelectContent>
                  <div className="p-2">
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar..."
                        value={restaurantSearch}
                        onChange={(e) => setRestaurantSearch(e.target.value)}
                        className="pl-8"
                      />
                    </div>
                  </div>
                  {filteredRestaurants.map((restaurant) => (
                    <SelectItem key={restaurant.id} value={restaurant.id}>
                      <div className="flex items-center gap-2">
                        {restaurant.logo_url ? (
                          <img
                            src={restaurant.logo_url}
                            alt=""
                            className="h-5 w-5 rounded object-cover"
                          />
                        ) : (
                          <Store className="h-4 w-4 text-muted-foreground" />
                        )}
                        {restaurant.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </CardContent>
        </Card>

        {/* Date Selection */}
        <div className="flex flex-wrap gap-2">
          <div className="flex gap-1 bg-muted rounded-lg p-1">
            <Button
              variant={presetRange === "today" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => handlePresetChange("today")}
            >
              Hoje
            </Button>
            <Button
              variant={presetRange === "yesterday" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => handlePresetChange("yesterday")}
            >
              Ontem
            </Button>
            <Button
              variant={presetRange === "week" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => handlePresetChange("week")}
            >
              Semana
            </Button>
            <Button
              variant={presetRange === "month" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => handlePresetChange("month")}
            >
              Mês
            </Button>
          </div>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={presetRange === "custom" ? "secondary" : "outline"}
                size="sm"
                className="gap-2"
              >
                <CalendarIcon className="h-4 w-4" />
                {presetRange === "custom"
                  ? `${format(dateRange.from, "dd/MM")} - ${format(dateRange.to, "dd/MM")}`
                  : "Período"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                selected={{ from: dateRange.from, to: dateRange.to }}
                onSelect={(range) => {
                  if (range?.from && range?.to) {
                    setDateRange({ from: startOfDay(range.from), to: endOfDay(range.to) });
                    setPresetRange("custom");
                  } else if (range?.from) {
                    setDateRange({ from: startOfDay(range.from), to: endOfDay(range.from) });
                    setPresetRange("custom");
                  }
                }}
                locale={ptBR}
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>

          <Button
            variant="default"
            size="sm"
            onClick={generatePDF}
            disabled={loading || generatingPdf || !selectedRestaurantId || stats.totalOrders === 0}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            {generatingPdf ? "Gerando..." : "Baixar PDF"}
          </Button>
        </div>
      </div>

      {/* Period Label */}
      {selectedRestaurantId && (
        <div className="text-sm text-muted-foreground">
          Exibindo dados de{" "}
          <span className="font-medium text-foreground">
            {format(dateRange.from, "dd 'de' MMMM", { locale: ptBR })}
          </span>
          {dateRange.from.getTime() !== dateRange.to.getTime() && (
            <>
              {" "}até{" "}
              <span className="font-medium text-foreground">
                {format(dateRange.to, "dd 'de' MMMM", { locale: ptBR })}
              </span>
            </>
          )}
          {" "}para <span className="font-medium text-foreground">{selectedRestaurantName}</span>
        </div>
      )}

      {!selectedRestaurantId ? (
        <div className="text-center py-16 text-muted-foreground">
          <Store className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Selecione um restaurante para ver os relatórios</p>
        </div>
      ) : loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : (
        <>
          {/* Main Stats */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Faturamento</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">
                  {formatCurrency(stats.totalRevenue)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {stats.totalOrders} pedido{stats.totalOrders !== 1 ? "s" : ""}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(stats.averageTicket)}
                </div>
                <p className="text-xs text-muted-foreground">Por pedido</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Entregas</CardTitle>
                <ShoppingBag className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.deliveryOrders}</div>
                <p className="text-xs text-muted-foreground">
                  {stats.pickupOrders} retirada{stats.pickupOrders !== 1 ? "s" : ""}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Horário de Pico</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{getPeakHour()}</div>
                <p className="text-xs text-muted-foreground">Maior volume</p>
              </CardContent>
            </Card>
          </div>

          {/* Secondary Stats */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Top Products */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Produtos Mais Vendidos
                </CardTitle>
              </CardHeader>
              <CardContent>
                {stats.topProducts.length === 0 ? (
                  <p className="text-muted-foreground text-sm py-4 text-center">
                    Nenhum produto vendido no período
                  </p>
                ) : (
                  <div className="space-y-3">
                    {stats.topProducts.map((product, index) => (
                      <div key={product.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                            {index + 1}
                          </span>
                          <div>
                            <p className="font-medium truncate max-w-[180px]">{product.name}</p>
                            <p className="text-xs text-muted-foreground">{product.quantity} vendidos</p>
                          </div>
                        </div>
                        <span className="font-semibold">{formatCurrency(product.revenue)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Payment Methods */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Percent className="h-5 w-5" />
                  Formas de Pagamento
                </CardTitle>
              </CardHeader>
              <CardContent>
                {Object.keys(stats.paymentMethods).length === 0 ? (
                  <p className="text-muted-foreground text-sm py-4 text-center">
                    Nenhum pedido no período
                  </p>
                ) : (
                  <div className="space-y-3">
                    {Object.entries(stats.paymentMethods)
                      .sort(([, a], [, b]) => b - a)
                      .map(([method, count]) => {
                        const percentage = stats.totalOrders > 0 
                          ? Math.round((count / stats.totalOrders) * 100) 
                          : 0;
                        return (
                          <div key={method} className="space-y-1">
                            <div className="flex justify-between text-sm">
                              <span>{paymentMethodLabels[method] || method}</span>
                              <span className="text-muted-foreground">
                                {count} ({percentage}%)
                              </span>
                            </div>
                            <div className="h-2 rounded-full bg-muted overflow-hidden">
                              <div 
                                className="h-full bg-primary rounded-full transition-all" 
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Orders by Hour Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Pedidos por Horário
              </CardTitle>
            </CardHeader>
            <CardContent>
              {Object.keys(stats.ordersByHour).length === 0 ? (
                <div className="h-48 flex items-center justify-center bg-muted/30 rounded-lg border border-dashed">
                  <p className="text-muted-foreground">Nenhum pedido no período selecionado</p>
                </div>
              ) : (
                <div className="h-48 flex items-end gap-1">
                  {Array.from({ length: 24 }, (_, hour) => {
                    const count = stats.ordersByHour[hour] || 0;
                    const maxCount = Math.max(...Object.values(stats.ordersByHour), 1);
                    const heightPercent = (count / maxCount) * 100;
                    
                    return (
                      <div key={hour} className="flex-1 flex flex-col items-center gap-1">
                        <div 
                          className={cn(
                            "w-full rounded-t transition-all",
                            count > 0 ? "bg-primary" : "bg-muted"
                          )}
                          style={{ height: `${Math.max(heightPercent, 2)}%` }}
                          title={`${hour}h: ${count} pedido(s)`}
                        />
                        {hour % 4 === 0 && (
                          <span className="text-[10px] text-muted-foreground">{hour}h</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Revenue by Day of Week Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Faturamento por Dia da Semana
              </CardTitle>
            </CardHeader>
            <CardContent>
              {Object.keys(stats.revenueByDayOfWeek).length === 0 ? (
                <div className="h-48 flex items-center justify-center bg-muted/30 rounded-lg border border-dashed">
                  <p className="text-muted-foreground">Nenhum dado no período selecionado</p>
                </div>
              ) : (
                <div className="h-48 flex items-end gap-2">
                  {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((dayName, day) => {
                    const revenue = stats.revenueByDayOfWeek[day] || 0;
                    const maxRevenue = Math.max(...Object.values(stats.revenueByDayOfWeek), 1);
                    const heightPercent = (revenue / maxRevenue) * 100;
                    
                    return (
                      <div key={day} className="flex-1 flex flex-col items-center gap-1">
                        <span className="text-xs text-muted-foreground mb-1">
                          {revenue > 0 ? formatCurrency(revenue) : ""}
                        </span>
                        <div 
                          className={cn(
                            "w-full rounded-t transition-all",
                            revenue > 0 ? "bg-green-500" : "bg-muted"
                          )}
                          style={{ height: `${Math.max(heightPercent, 2)}%` }}
                          title={`${dayName}: ${formatCurrency(revenue)}`}
                        />
                        <span className="text-xs text-muted-foreground">{dayName}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
