import { useState, useEffect } from "react";
import { format, startOfDay, endOfDay, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Download, FileText, Eye, ChevronDown, ChevronUp, XCircle, Pencil, Save, X, DollarSign, Wallet, Truck, TrendingDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  BarChart3,
  TrendingUp,
  Clock,
  Package,
  ShoppingBag,
  Percent,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurantContext } from "@/contexts/RestaurantContext";
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
  addons?: any[];
  addonNames?: Record<string, string[]>;
  addonsTotal?: number;
  notes?: string;
}

interface RawOrder {
  id: string;
  order_number: string;
  daily_number: number | null;
  customer_name: string;
  customer_phone: string;
  customer_address: string | null;
  delivery_type: string;
  payment_method: string;
  payment_status: string;
  subtotal: number;
  discount: number | null;
  delivery_fee: number | null;
  total: number;
  items: unknown;
  notes: string | null;
  status: string;
  coupon_code: string | null;
  created_at: string | null;
  driver_id: string | null;
  driver_name: string | null;
}

interface CashRegister {
  id: string;
  opened_by: string;
  opening_amount: number;
  closing_amount: number | null;
  opened_at: string;
  closed_at: string | null;
  status: string;
}

export default function AdminReports() {
  const { selectedRestaurant, selectedRestaurantIds, restaurants } = useRestaurantContext();
  const [dateRange, setDateRange] = useState<DateRange>({
    from: startOfDay(new Date()),
    to: endOfDay(new Date()),
  });
  const [presetRange, setPresetRange] = useState<PresetRange>("today");
  const [loading, setLoading] = useState(true);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const { toast } = useToast();

  // Derive restaurantId and name from context
  const restaurantId = selectedRestaurant?.id || (selectedRestaurantIds.length === 1 ? selectedRestaurantIds[0] : null);
  const restaurantName = selectedRestaurant?.name || restaurants[0]?.name || "";

  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalOrders: 0,
    rejectedOrders: 0,
    averageTicket: 0,
    deliveryOrders: 0,
    pickupOrders: 0,
    deliveryCosts: 0,
    onlinePaymentFees: 0,
    netRevenue: 0,
    topProducts: [] as { name: string; quantity: number; revenue: number }[],
    ordersByHour: {} as Record<number, number>,
    topProductsByHour: {} as Record<number, { name: string; quantity: number }[]>,
    paymentMethods: {} as Record<string, number>,
    revenueByDayOfWeek: {} as Record<number, number>,
  });
  const [rawOrders, setRawOrders] = useState<RawOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<RawOrder | null>(null);
  const [showOrdersTable, setShowOrdersTable] = useState(true);
  const [showCashTable, setShowCashTable] = useState(true);
  const [cashRegisters, setCashRegisters] = useState<CashRegister[]>([]);
  const [selectedCashRegister, setSelectedCashRegister] = useState<CashRegister | null>(null);
  const [cashSessionOrders, setCashSessionOrders] = useState<RawOrder[]>([]);
  const [cashSessionDrivers, setCashSessionDrivers] = useState<{ id: string; name: string; fixed_fee: number; per_ride_fee: number; fee_mode: string }[]>([]);
  const [loadingSessionOrders, setLoadingSessionOrders] = useState(false);
  const [expandedSessionOrder, setExpandedSessionOrder] = useState<string | null>(null);

  // Edit order state
  const [editingOrder, setEditingOrder] = useState(false);
  const [editForm, setEditForm] = useState({
    status: "",
    delivery_type: "",
    payment_method: "",
    total: "",
    delivery_fee: "",
    discount: "",
    notes: "",
  });
  const [savingOrder, setSavingOrder] = useState(false);

  // Fetch orders and cash registers based on date range
  useEffect(() => {
    if (!restaurantId) return;

    async function fetchData() {
      setLoading(true);

      // Fetch orders (ALL statuses for complete reporting)
      const { data: orders, error } = await supabase
        .from("orders")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .gte("created_at", dateRange.from.toISOString())
        .lte("created_at", dateRange.to.toISOString())
        .order("created_at", { ascending: false });

      // Fetch cash registers
      const { data: registers } = await supabase
        .from("cash_registers")
        .select("*")
        .eq("restaurant_id", restaurantId!)
        .gte("opened_at", dateRange.from.toISOString())
        .lte("opened_at", dateRange.to.toISOString())
        .order("opened_at", { ascending: false }) as any;

      // Fetch drivers for delivery cost calculation
      const { data: drivers } = await supabase
        .from("drivers")
        .select("id, name, fixed_fee, per_ride_fee, fee_mode")
        .eq("restaurant_id", restaurantId!);

      setCashRegisters((registers as CashRegister[]) || []);

      if (error || !orders) {
        setLoading(false);
        return;
      }

      const driversList = drivers || [];

      // Rejected/cancelled orders
      const rejectedOrders = orders.filter(o => ["rejected", "cancelled"].includes(o.status));
      // Valid orders = accepted/paid (exclude pending, cancelled, rejected)
      const validOrders = orders.filter(o => !["pending", "cancelled", "rejected"].includes(o.status));

      // Revenue from valid orders only (Faturamento Bruto)
      const totalRevenue = validOrders.reduce((sum, order) => sum + Number(order.total), 0);
      const totalOrders = validOrders.length;
      const averageTicket = validOrders.length > 0 ? totalRevenue / validOrders.length : 0;
      const deliveryOrders = validOrders.filter(o => o.delivery_type === "delivery").length;
      const pickupOrders = validOrders.filter(o => o.delivery_type === "pickup").length;

      // Calculate delivery costs from valid orders with assigned drivers
      const driverOrdersMap = new Map<string, typeof validOrders>();
      validOrders.forEach(o => {
        if (o.driver_id) {
          const existing = driverOrdersMap.get(o.driver_id) || [];
          existing.push(o);
          driverOrdersMap.set(o.driver_id, existing);
        }
      });

      let deliveryCosts = 0;
      driverOrdersMap.forEach((driverOrders, driverId) => {
        const driver = driversList.find(d => d.id === driverId);
        if (driver) {
          const count = driverOrders.length;
          deliveryCosts += (driver.fixed_fee || 0) * count;
          if (driver.fee_mode === "fixed_per_ride") {
            deliveryCosts += (driver.per_ride_fee || 0) * count;
          } else if (driver.fee_mode === "delivery_passthrough") {
            const passthrough = driverOrders.reduce((sum, o) => sum + (o.delivery_fee || 0), 0);
            deliveryCosts += passthrough;
          }
        }
      });

      // Calculate online payment fees (Mercado Pago split)
      // PIX: R$1.00 per transaction | Card: R$0.50 + 0.5% of total
      let onlinePaymentFees = 0;
      validOrders.forEach(order => {
        if (order.payment_status === "paid") {
          if (order.payment_method === "pix") {
            onlinePaymentFees += 1.0;
          } else if (order.payment_method === "card") {
            onlinePaymentFees += 0.5 + (Number(order.total) * 0.005);
          }
        }
      });

      const netRevenue = totalRevenue - deliveryCosts - onlinePaymentFees;

      // Top products (from valid orders)
      const productMap = new Map<string, { quantity: number; revenue: number }>();
      validOrders.forEach(order => {
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

      // Orders by hour (all orders) + top products per hour
      const ordersByHour: Record<number, number> = {};
      const productsByHourMap: Record<number, Record<string, number>> = {};
      orders.forEach(order => {
        const hour = new Date(order.created_at || "").getHours();
        ordersByHour[hour] = (ordersByHour[hour] || 0) + 1;
        const items = order.items as unknown as OrderItem[];
        if (Array.isArray(items)) {
          if (!productsByHourMap[hour]) productsByHourMap[hour] = {};
          items.forEach(item => {
            productsByHourMap[hour][item.name] = (productsByHourMap[hour][item.name] || 0) + item.quantity;
          });
        }
      });
      const topProductsByHour: Record<number, { name: string; quantity: number }[]> = {};
      for (const [h, products] of Object.entries(productsByHourMap)) {
        topProductsByHour[Number(h)] = Object.entries(products)
          .map(([name, quantity]) => ({ name, quantity }))
          .sort((a, b) => b.quantity - a.quantity)
          .slice(0, 3);
      }

      // Payment methods (from valid orders)
      const paymentMethods: Record<string, number> = {};
      validOrders.forEach(order => {
        paymentMethods[order.payment_method] = (paymentMethods[order.payment_method] || 0) + 1;
      });

      // Revenue by day of week (from valid orders)
      const revenueByDayOfWeek: Record<number, number> = {};
      validOrders.forEach(order => {
        const dayOfWeek = new Date(order.created_at || "").getDay();
        revenueByDayOfWeek[dayOfWeek] = (revenueByDayOfWeek[dayOfWeek] || 0) + Number(order.total);
      });

      setStats({
        totalRevenue,
        totalOrders,
        rejectedOrders: rejectedOrders.length,
        averageTicket,
        deliveryOrders,
        pickupOrders,
        deliveryCosts,
        onlinePaymentFees,
        netRevenue,
        topProducts,
        ordersByHour,
        topProductsByHour,
        paymentMethods,
        revenueByDayOfWeek,
      });

      setRawOrders(orders as unknown as RawOrder[]);
      setLoading(false);
    }

    fetchData();
  }, [restaurantId, dateRange]);

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
        setDateRange({ from: startOfDay(subDays(now, 6)), to: endOfDay(now) });
        break;
      case "month":
        setDateRange({ from: startOfDay(subDays(now, 29)), to: endOfDay(now) });
        break;
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

  const statusLabels: Record<string, string> = {
    pending: "Novo",
    preparing: "Preparando",
    ready: "Pronto",
    pickup_ready: "Aguardando Retirada",
    out_for_delivery: "A Caminho",
    delivered: "Entregue",
    cancelled: "Cancelado",
    rejected: "Recusado",
  };

  const startEditOrder = () => {
    if (!selectedOrder) return;
    setEditForm({
      status: selectedOrder.status,
      delivery_type: selectedOrder.delivery_type,
      payment_method: selectedOrder.payment_method,
      total: selectedOrder.total.toString(),
      delivery_fee: (selectedOrder.delivery_fee ?? 0).toString(),
      discount: (selectedOrder.discount ?? 0).toString(),
      notes: selectedOrder.notes || "",
    });
    setEditingOrder(true);
  };

  const cancelEdit = () => {
    setEditingOrder(false);
  };

  const saveOrderEdit = async () => {
    if (!selectedOrder) return;
    setSavingOrder(true);

    const newTotal = parseFloat(editForm.total.replace(",", ".")) || selectedOrder.total;
    const newDeliveryFee = parseFloat(editForm.delivery_fee.replace(",", ".")) || 0;
    const newDiscount = parseFloat(editForm.discount.replace(",", ".")) || 0;

    const { error } = await supabase
      .from("orders")
      .update({
        status: editForm.status,
        delivery_type: editForm.delivery_type,
        payment_method: editForm.payment_method,
        total: newTotal,
        delivery_fee: newDeliveryFee,
        discount: newDiscount,
        notes: editForm.notes || null,
      })
      .eq("id", selectedOrder.id);

    setSavingOrder(false);

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      return;
    }

    // Update local state
    const updatedOrder: RawOrder = {
      ...selectedOrder,
      status: editForm.status,
      delivery_type: editForm.delivery_type,
      payment_method: editForm.payment_method,
      total: newTotal,
      delivery_fee: newDeliveryFee,
      discount: newDiscount,
      notes: editForm.notes || null,
    };
    setSelectedOrder(updatedOrder);
    setRawOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
    setEditingOrder(false);
    toast({ title: "✅ Pedido atualizado!" });
  };

  // Fetch orders for a specific cash register session
  const openCashSession = async (reg: CashRegister) => {
    setSelectedCashRegister(reg);
    setLoadingSessionOrders(true);
    setCashSessionOrders([]);
    setCashSessionDrivers([]);
    setExpandedSessionOrder(null);

    try {
      let query = supabase
        .from("orders")
        .select("*")
        .eq("restaurant_id", restaurantId!)
        .gte("created_at", reg.opened_at)
        .neq("status", "cancelled")
        .order("created_at", { ascending: false });

      if (reg.closed_at) {
        query = query.lte("created_at", reg.closed_at);
      }

      const [{ data: ordersData }, { data: driversData }] = await Promise.all([
        query,
        supabase
          .from("drivers")
          .select("id, name, fixed_fee, per_ride_fee, fee_mode")
          .eq("restaurant_id", restaurantId!),
      ]);

      setCashSessionOrders((ordersData as unknown as RawOrder[]) || []);
      setCashSessionDrivers(driversData || []);
    } catch (e) {
      console.error("Error fetching session orders:", e);
    } finally {
      setLoadingSessionOrders(false);
    }
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
        if (!ctx) { reject(new Error("Could not get canvas context")); return; }
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

      // Helper function to add black background to current page
      const addBlackBackground = () => {
        doc.setFillColor(15, 15, 15); // Near black
        doc.rect(0, 0, pageWidth, pageHeight, "F");
      };

      // Add background to first page
      addBlackBackground();

      // Load and add logo (use light version for dark background)
      try {
        const logoModule = await import("@/assets/logo-pdf.png");
        const logoBase64 = await loadImageAsBase64(logoModule.default);
        const logoWidth = 50;
        const logoHeight = 12;
        doc.addImage(logoBase64, "PNG", (pageWidth - logoWidth) / 2, yPos, logoWidth, logoHeight);
        yPos += logoHeight + 8;
      } catch {
        // Fallback to text if logo fails
        doc.setFontSize(24);
        doc.setTextColor(234, 88, 12);
        doc.text("MenuFly", pageWidth / 2, yPos + 10, { align: "center" });
        yPos += 15;
      }

      doc.setFontSize(10);
      doc.setTextColor(160, 160, 160);
      doc.text("Relatório de Vendas", pageWidth / 2, yPos, { align: "center" });
      yPos += 12;

      // Restaurant name
      doc.setFontSize(16);
      doc.setTextColor(255, 255, 255);
      doc.text(restaurantName || "Meu Restaurante", pageWidth / 2, yPos, { align: "center" });
      yPos += 10;

      // Period
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

      // Divider line
      doc.setDrawColor(60, 60, 60);
      doc.line(20, yPos, pageWidth - 20, yPos);
      yPos += 15;

      // Main metrics section
      doc.setFontSize(14);
      doc.setTextColor(255, 255, 255);
      doc.text("Resumo Financeiro", 20, yPos);
      yPos += 8;

      const metrics = [
        { label: "Faturamento Bruto", value: formatCurrency(stats.totalRevenue), highlight: true, icon: "dollar" },
        { label: "Gastos de Entrega", value: `- ${formatCurrency(stats.deliveryCosts)}`, icon: "truck" },
        { label: "Faturamento Líquido", value: formatCurrency(stats.netRevenue), highlight: true, icon: "trending" },
        { label: "Total de Pedidos", value: stats.totalOrders.toString(), icon: "package" },
        { label: "Ticket Médio", value: formatCurrency(stats.averageTicket), icon: "trending" },
        { label: "Pedidos Entrega", value: stats.deliveryOrders.toString(), icon: "truck" },
        { label: "Pedidos Retirada", value: stats.pickupOrders.toString(), icon: "store" },
        { label: "Horário de Pico", value: getPeakHour(), icon: "clock" },
      ];

      // Helper function to draw icons
      const drawIcon = (iconType: string, x: number, y: number, size: number) => {
        doc.setDrawColor(100, 100, 100);
        doc.setLineWidth(0.4);
        
        switch (iconType) {
          case "dollar":
            // Circle with $ sign
            doc.circle(x + size/2, y + size/2, size/2, "S");
            doc.setFontSize(6);
            doc.setTextColor(100, 100, 100);
            doc.text("$", x + size/2, y + size/2 + 1.5, { align: "center" });
            break;
          case "package":
            // Box shape
            doc.rect(x + 1, y + 2, size - 2, size - 3, "S");
            doc.line(x + 1, y + 4.5, x + size - 1, y + 4.5);
            break;
          case "trending":
            // Trending up arrow
            doc.line(x + 1, y + size - 2, x + size/2, y + 3);
            doc.line(x + size/2, y + 3, x + size - 1, y + size/2);
            doc.line(x + size - 3, y + 2, x + size - 1, y + size/2);
            break;
          case "truck":
            // Simple truck
            doc.rect(x + 1, y + 3, size - 4, size - 5, "S");
            doc.rect(x + size - 3, y + 5, 2.5, size - 7, "S");
            doc.circle(x + 3, y + size - 1.5, 1, "S");
            doc.circle(x + size - 2, y + size - 1.5, 1, "S");
            break;
          case "store":
            // Store/building
            doc.rect(x + 1, y + 3, size - 2, size - 4, "S");
            doc.line(x, y + 3, x + size/2, y + 1);
            doc.line(x + size/2, y + 1, x + size, y + 3);
            doc.rect(x + size/2 - 1.5, y + size - 4, 3, 3, "S");
            break;
          case "clock":
            // Clock
            doc.circle(x + size/2, y + size/2, size/2 - 0.5, "S");
            doc.line(x + size/2, y + size/2, x + size/2, y + 2.5);
            doc.line(x + size/2, y + size/2, x + size - 2, y + size/2);
            break;
        }
        doc.setLineWidth(0.2);
      };

      // Draw metrics in a 2x3 grid of cards
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

        // Card background with rounded corners
        doc.setFillColor(30, 30, 30);
        doc.roundedRect(cardX, cardY, cardWidth, cardHeight, 3, 3, "F");

        // Card border
        doc.setDrawColor(50, 50, 50);
        doc.roundedRect(cardX, cardY, cardWidth, cardHeight, 3, 3, "S");

        // Draw icon in top-right corner
        drawIcon(metric.icon, cardX + cardWidth - 12, cardY + 3, 8);

        // Label
        doc.setFontSize(8);
        doc.setTextColor(140, 140, 140);
        doc.text(metric.label, cardX + 5, cardY + 10);

        // Value
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

        // Card container for products
        const productsCardHeight = 8 + stats.topProducts.length * 9;
        doc.setFillColor(30, 30, 30);
        doc.roundedRect(20, yPos, 170, productsCardHeight, 3, 3, "F");
        doc.setDrawColor(50, 50, 50);
        doc.roundedRect(20, yPos, 170, productsCardHeight, 3, 3, "S");

        yPos += 7;
        doc.setFontSize(10);
        stats.topProducts.forEach((product, index) => {
          // Rank badge
          doc.setFillColor(234, 88, 12);
          doc.circle(28, yPos - 1.5, 3, "F");
          doc.setFontSize(7);
          doc.setTextColor(255, 255, 255);
          doc.text(`${index + 1}`, 28, yPos - 0.5, { align: "center" });

          // Product name
          doc.setFontSize(10);
          doc.setTextColor(200, 200, 200);
          const truncatedName = product.name.length > 25 ? product.name.substring(0, 25) + "..." : product.name;
          doc.text(truncatedName, 35, yPos);

          // Quantity and revenue
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

        // Card container for payment methods
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

          // Method name
          doc.setFontSize(10);
          doc.setTextColor(200, 200, 200);
          doc.text(paymentMethodLabels[method] || method, 28, yPos);

          // Count
          doc.setTextColor(255, 255, 255);
          doc.text(`${count} pedidos`, 100, yPos);

          // Percentage badge
          doc.setFillColor(60, 60, 60);
          doc.roundedRect(145, yPos - 4, 20, 6, 2, 2, "F");
          doc.setFontSize(8);
          doc.setTextColor(160, 160, 160);
          doc.text(`${percentage}%`, 155, yPos - 0.5, { align: "center" });

          // Progress bar
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
        // Check if we need a new page
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

        // Draw chart background
        doc.setFillColor(30, 30, 30);
        doc.rect(chartX, yPos, chartWidth, chartHeight, "F");

        // Draw bars
        for (let hour = 0; hour < 24; hour++) {
          const count = stats.ordersByHour[hour] || 0;
          const barHeight = (count / maxCount) * (chartHeight - 10);
          const barX = chartX + hour * barWidth;
          const barY = yPos + chartHeight - barHeight - 5;

          if (count > 0) {
            doc.setFillColor(234, 88, 12); // Orange
            doc.rect(barX + 1, barY, barWidth - 2, barHeight, "F");
          }
        }

        // Draw x-axis labels (every 4 hours)
        doc.setFontSize(7);
        doc.setTextColor(160, 160, 160);
        for (let hour = 0; hour < 24; hour += 4) {
          const labelX = chartX + hour * barWidth + barWidth / 2;
          doc.text(`${hour}h`, labelX, yPos + chartHeight + 4, { align: "center" });
        }

        // Draw y-axis max value
        doc.text(`${maxCount}`, chartX - 3, yPos + 5, { align: "right" });
        doc.text("0", chartX - 3, yPos + chartHeight - 3, { align: "right" });

        yPos += chartHeight + 15;
      }

      // Revenue by Day of Week Chart
      const dayEntries = Object.entries(stats.revenueByDayOfWeek);
      if (dayEntries.length > 0) {
        // Check if we need a new page
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

        // Draw chart background
        doc.setFillColor(30, 30, 30);
        doc.rect(chartX, yPos, chartWidth, chartHeight, "F");

        // Draw bars
        for (let day = 0; day < 7; day++) {
          const revenue = stats.revenueByDayOfWeek[day] || 0;
          const barHeight = (revenue / maxRevenue) * (chartHeight - 10);
          const barX = chartX + day * barWidth;
          const barY = yPos + chartHeight - barHeight - 5;

          if (revenue > 0) {
            doc.setFillColor(34, 197, 94); // Green
            doc.rect(barX + 3, barY, barWidth - 6, barHeight, "F");
          }

          // Day label
          doc.setFontSize(8);
          doc.setTextColor(160, 160, 160);
          doc.text(dayNames[day], barX + barWidth / 2, yPos + chartHeight + 4, { align: "center" });
        }

        // Draw y-axis max value
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

      // Generate filename
      const dateStr = format(dateRange.from, "yyyy-MM-dd");
      const filename = `relatorio-${restaurantName?.toLowerCase().replace(/\s+/g, '-') || 'menufly'}-${dateStr}.pdf`;

      // Download
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

  return (
    <div className="space-y-3 md:space-y-6">
      {/* Header with Date Selection */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Relatórios</h1>
          <p className="text-muted-foreground">
            Acompanhe o desempenho do seu negócio
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {/* Preset Buttons */}
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

          {/* Custom Date Range */}
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
            <PopoverContent className="w-auto p-0" align="end">
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

          {/* Download Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={generatePDF}
            disabled={loading || generatingPdf || stats.totalOrders === 0}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            {generatingPdf ? "Gerando..." : "Baixar PDF"}
          </Button>
        </div>
      </div>

      {/* Period Label */}
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
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-36" />
            ))}
          </div>
          <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Hero Financial Row — Bruto | Deductions | Líquido */}
          <div className="grid gap-4 md:grid-cols-3">
            {/* Faturamento Bruto */}
            <Card className="relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-bl-full" />
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
                <CardTitle className="text-sm font-medium text-muted-foreground">Faturamento Bruto</CardTitle>
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <DollarSign className="h-4 w-4 text-primary" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-primary tracking-tight">
                  {formatCurrency(stats.totalRevenue)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.totalOrders} pedido{stats.totalOrders !== 1 ? "s" : ""} aceito{stats.totalOrders !== 1 ? "s" : ""}
                </p>
              </CardContent>
            </Card>

            {/* Deductions (Entregas + Taxas) */}
            <Card className="relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/5 rounded-bl-full" />
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
                <CardTitle className="text-sm font-medium text-muted-foreground">Deduções</CardTitle>
                <div className="h-8 w-8 rounded-full bg-orange-500/10 flex items-center justify-center">
                  <TrendingDown className="h-4 w-4 text-orange-500" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Truck className="h-3 w-3" /> Entregadores
                    </span>
                    <span className="text-sm font-semibold text-orange-500">- {formatCurrency(stats.deliveryCosts)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Wallet className="h-3 w-3" /> Taxas online
                    </span>
                    <span className="text-sm font-semibold text-orange-500">- {formatCurrency(stats.onlinePaymentFees)}</span>
                  </div>
                  <Separator className="my-1" />
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">Total deduzido</span>
                    <span className="text-base font-bold text-orange-500">- {formatCurrency(stats.deliveryCosts + stats.onlinePaymentFees)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Faturamento Líquido */}
            <Card className="relative overflow-hidden border-green-500/30 bg-green-500/[0.03]">
              <div className="absolute top-0 right-0 w-24 h-24 bg-green-500/5 rounded-bl-full" />
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
                <CardTitle className="text-sm font-medium text-muted-foreground">Faturamento Líquido</CardTitle>
                <div className="h-8 w-8 rounded-full bg-green-500/10 flex items-center justify-center">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600 dark:text-green-400 tracking-tight">
                  {formatCurrency(stats.netRevenue)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Bruto − entregas − taxas
                </p>
                {stats.totalRevenue > 0 && (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-green-500 transition-all"
                        style={{ width: `${Math.max((stats.netRevenue / stats.totalRevenue) * 100, 0)}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-semibold text-green-600 dark:text-green-400">
                      {((stats.netRevenue / stats.totalRevenue) * 100).toFixed(0)}% margem
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Secondary KPIs */}
          <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-4 px-4">
                <CardTitle className="text-xs font-medium text-muted-foreground">Ticket Médio</CardTitle>
                <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="text-xl font-bold">{formatCurrency(stats.averageTicket)}</div>
                <p className="text-[10px] text-muted-foreground">Por pedido</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-4 px-4">
                <CardTitle className="text-xs font-medium text-muted-foreground">Entregas</CardTitle>
                <ShoppingBag className="h-3.5 w-3.5 text-muted-foreground" />
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="text-xl font-bold">{stats.deliveryOrders}</div>
                <p className="text-[10px] text-muted-foreground">{stats.pickupOrders} retirada{stats.pickupOrders !== 1 ? "s" : ""}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-4 px-4">
                <CardTitle className="text-xs font-medium text-muted-foreground">Horário de Pico</CardTitle>
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="text-xl font-bold">{getPeakHour()}</div>
                <p className="text-[10px] text-muted-foreground">Maior volume</p>
              </CardContent>
            </Card>

            {stats.rejectedOrders > 0 ? (
              <Card className="border-destructive/30">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-4 px-4">
                  <CardTitle className="text-xs font-medium text-destructive">Recusados</CardTitle>
                  <XCircle className="h-3.5 w-3.5 text-destructive" />
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="text-xl font-bold text-destructive">{stats.rejectedOrders}</div>
                  <p className="text-[10px] text-muted-foreground">pedido{stats.rejectedOrders !== 1 ? "s" : ""} recusado{stats.rejectedOrders !== 1 ? "s" : ""}</p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-4 px-4">
                  <CardTitle className="text-xs font-medium text-muted-foreground">Recusados</CardTitle>
                  <XCircle className="h-3.5 w-3.5 text-muted-foreground" />
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="text-xl font-bold">0</div>
                  <p className="text-[10px] text-muted-foreground">Nenhum recusado</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Charts Row — Orders by Hour + Revenue by Day */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Orders by Hour Chart */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <BarChart3 className="h-4 w-4" />
                  Pedidos por Horário
                </CardTitle>
              </CardHeader>
              <CardContent>
                {Object.keys(stats.ordersByHour).length === 0 ? (
                  <div className="h-40 flex items-center justify-center bg-muted/30 rounded-lg border border-dashed">
                    <p className="text-muted-foreground text-sm">Nenhum pedido no período</p>
                  </div>
                ) : (
                  <div>
                    <div className="h-40 flex items-end gap-[2px] mb-1">
                      {Array.from({ length: 24 }, (_, hour) => {
                        const count = stats.ordersByHour[hour] || 0;
                        const totalOrders = Object.values(stats.ordersByHour).reduce((a, b) => a + b, 0);
                        const percent = totalOrders > 0 ? ((count / totalOrders) * 100) : 0;
                        const maxCount = Math.max(...Object.values(stats.ordersByHour), 1);
                        const heightPercent = (count / maxCount) * 100;
                        const topProducts = stats.topProductsByHour[hour] || [];

                        return (
                          <div key={hour} className="flex-1 flex flex-col items-center h-full group relative">
                            <div className="flex-1 w-full flex items-end">
                              <div
                                className={cn(
                                  "w-full rounded-t transition-all cursor-pointer",
                                  count > 0 ? "bg-primary hover:bg-primary/80" : "bg-muted/50"
                                )}
                                style={{ height: `${Math.max(heightPercent, 2)}%` }}
                              />
                            </div>
                            {count > 0 && (
                              <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:block z-50 pointer-events-none">
                                <div className="bg-popover border border-border rounded-lg shadow-lg p-3 min-w-[160px] text-left">
                                  <p className="font-semibold text-sm text-foreground">{hour}h - {hour + 1}h</p>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {count} pedido{count !== 1 ? 's' : ''} ({percent.toFixed(1)}%)
                                  </p>
                                  {topProducts.length > 0 && (
                                    <>
                                      <div className="border-t border-border my-1.5" />
                                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Top produtos</p>
                                      {topProducts.map((p, i) => (
                                        <p key={i} className="text-xs text-foreground mt-0.5 truncate max-w-[180px]">
                                          {i + 1}. {p.name} <span className="text-muted-foreground">({p.quantity}x)</span>
                                        </p>
                                      ))}
                                    </>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex gap-[2px]">
                      {Array.from({ length: 24 }, (_, hour) => {
                        const count = stats.ordersByHour[hour] || 0;
                        return (
                          <div key={hour} className="flex-1 text-center">
                            <span className={cn(
                              "text-[8px] leading-none",
                              count > 0 ? "text-foreground font-medium" : "text-muted-foreground/50"
                            )}>
                              {String(hour).padStart(2, '0')}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Revenue by Day of Week */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <TrendingUp className="h-4 w-4" />
                  Faturamento por Dia da Semana
                </CardTitle>
              </CardHeader>
              <CardContent>
                {Object.keys(stats.revenueByDayOfWeek).length === 0 ? (
                  <div className="h-40 flex items-center justify-center bg-muted/30 rounded-lg border border-dashed">
                    <p className="text-muted-foreground text-sm">Nenhum dado no período</p>
                  </div>
                ) : (
                  <div className="flex items-end gap-3 h-40">
                    {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((dayName, day) => {
                      const revenue = stats.revenueByDayOfWeek[day] || 0;
                      const maxRevenue = Math.max(...Object.values(stats.revenueByDayOfWeek), 1);
                      const heightPercent = revenue > 0 ? Math.max((revenue / maxRevenue) * 100, 8) : 3;
                      
                      return (
                        <div key={day} className="flex-1 flex flex-col items-center justify-end h-full gap-1 group relative">
                          <div className="w-full relative flex-shrink-0 cursor-pointer" style={{ height: `${heightPercent}%` }}>
                            <div 
                              className={cn(
                                "absolute inset-0 rounded-t-md transition-all",
                                revenue > 0 ? "bg-green-500 group-hover:bg-green-400" : "bg-muted"
                              )}
                            />
                          </div>
                          <span className="text-[10px] text-muted-foreground font-semibold">{dayName}</span>
                          {revenue > 0 && (
                            <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block z-50 pointer-events-none">
                              <div className="bg-popover border border-border rounded-md shadow-lg px-2.5 py-1.5 whitespace-nowrap">
                                <p className="text-xs font-semibold text-foreground">{formatCurrency(revenue)}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Products + Payment Methods Row */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Top Products */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Package className="h-4 w-4" />
                  Produtos Mais Vendidos
                </CardTitle>
              </CardHeader>
              <CardContent>
                {stats.topProducts.length === 0 ? (
                  <p className="text-muted-foreground text-sm py-4 text-center">
                    Nenhum produto vendido no período
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {stats.topProducts.map((product, index) => (
                      <div key={product.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                            {index + 1}
                          </span>
                          <div>
                            <p className="font-medium text-sm truncate max-w-[180px]">{product.name}</p>
                            <p className="text-[10px] text-muted-foreground">{product.quantity} vendidos</p>
                          </div>
                        </div>
                        <span className="font-semibold text-sm">{formatCurrency(product.revenue)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Payment Methods */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Percent className="h-4 w-4" />
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

          {/* Cash Register History */}
          <Card>
            <CardHeader>
              <CardTitle 
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setShowCashTable(!showCashTable)}
              >
                <div className="flex items-center gap-2">
                  <Wallet className="h-5 w-5" />
                  Histórico de Caixa ({cashRegisters.length})
                </div>
                {showCashTable ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </CardTitle>
            </CardHeader>
            {showCashTable && (
              <CardContent>
                {cashRegisters.length === 0 ? (
                  <p className="text-muted-foreground text-sm py-4 text-center">
                    Nenhum registro de caixa no período
                  </p>
                ) : (
                  <>
                    {/* Desktop Table */}
                    <div className="hidden md:block overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Operador</TableHead>
                            <TableHead>Abertura</TableHead>
                            <TableHead>Fechamento</TableHead>
                            <TableHead className="text-right">Valor Abertura</TableHead>
                            <TableHead className="text-right">Valor Fechamento</TableHead>
                            <TableHead className="text-right">Diferença</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {cashRegisters.map((reg) => {
                            const diff = reg.closing_amount != null ? reg.closing_amount - reg.opening_amount : null;
                            return (
                              <TableRow key={reg.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openCashSession(reg)}>
                                <TableCell className="font-medium">{reg.opened_by}</TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  {format(new Date(reg.opened_at), "dd/MM HH:mm", { locale: ptBR })}
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  {reg.closed_at ? format(new Date(reg.closed_at), "dd/MM HH:mm", { locale: ptBR }) : "-"}
                                </TableCell>
                                <TableCell className="text-right font-semibold">{formatCurrency(reg.opening_amount)}</TableCell>
                                <TableCell className="text-right font-semibold">
                                  {reg.closing_amount != null ? formatCurrency(reg.closing_amount) : "-"}
                                </TableCell>
                                <TableCell className={cn("text-right font-semibold", diff != null && diff > 0 && "text-accent", diff != null && diff < 0 && "text-destructive")}>
                                  {diff != null ? `${diff >= 0 ? "+" : ""}${formatCurrency(diff)}` : "-"}
                                </TableCell>
                                <TableCell>
                                  <Badge variant={reg.status === "open" ? "default" : "secondary"}>
                                    {reg.status === "open" ? "Aberto" : "Fechado"}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Mobile Cards */}
                    <div className="md:hidden space-y-2">
                      {cashRegisters.map((reg) => {
                        const diff = reg.closing_amount != null ? reg.closing_amount - reg.opening_amount : null;
                        return (
                          <button
                            key={reg.id}
                            onClick={() => openCashSession(reg)}
                            className="w-full text-left p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors space-y-2"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-sm">{reg.opened_by}</span>
                              <Badge variant={reg.status === "open" ? "default" : "secondary"} className="text-xs">
                                {reg.status === "open" ? "Aberto" : "Fechado"}
                              </Badge>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <p className="text-muted-foreground">Abertura</p>
                                <p className="font-semibold">{formatCurrency(reg.opening_amount)}</p>
                                <p className="text-muted-foreground">{format(new Date(reg.opened_at), "dd/MM HH:mm", { locale: ptBR })}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Fechamento</p>
                                <p className="font-semibold">{reg.closing_amount != null ? formatCurrency(reg.closing_amount) : "-"}</p>
                                <p className="text-muted-foreground">{reg.closed_at ? format(new Date(reg.closed_at), "dd/MM HH:mm", { locale: ptBR }) : "-"}</p>
                              </div>
                            </div>
                            {diff != null && (
                              <div className={cn("text-sm font-semibold pt-1 border-t border-border/50", diff > 0 ? "text-accent" : diff < 0 ? "text-destructive" : "")}>
                                Diferença: {diff >= 0 ? "+" : ""}{formatCurrency(diff)}
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </CardContent>
            )}
          </Card>

          {/* Histórico de Pedidos */}
          <Card>
            <CardHeader>
              <CardTitle 
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setShowOrdersTable(!showOrdersTable)}
              >
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Histórico de Pedidos ({rawOrders.length})
                </div>
                {showOrdersTable ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </CardTitle>
            </CardHeader>
            {showOrdersTable && (
              <CardContent>
                {rawOrders.length === 0 ? (
                  <p className="text-muted-foreground text-sm py-4 text-center">
                    Nenhum pedido no período selecionado
                  </p>
                ) : (
                  <>
                    {/* Desktop Table */}
                    <div className="hidden md:block overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[80px]">Nº</TableHead>
                            <TableHead>Cliente</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Pagamento</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                            <TableHead>Data/Hora</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rawOrders.map((order) => {
                            const items = order.items as unknown as OrderItem[];
                            return (
                              <TableRow key={order.id}>
                                <TableCell className="font-bold">
                                  #{order.daily_number || order.order_number}
                                </TableCell>
                                <TableCell>
                                  <div>
                                    <p className="font-medium">{order.customer_name}</p>
                                    <p className="text-xs text-muted-foreground">{order.customer_phone}</p>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="text-xs">
                                    {order.delivery_type === "delivery" ? "Entrega" : "Retirada"}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-sm">
                                  {paymentMethodLabels[order.payment_method] || order.payment_method}
                                </TableCell>
                                <TableCell>
                                  <Badge variant={order.status === "rejected" ? "destructive" : order.status === "delivered" ? "default" : "secondary"} className="text-xs">
                                    {statusLabels[order.status] || order.status}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right font-semibold">
                                  {formatCurrency(order.total)}
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                                  {order.created_at ? format(new Date(order.created_at), "dd/MM HH:mm", { locale: ptBR }) : "-"}
                                </TableCell>
                                <TableCell>
                                  <Button variant="ghost" size="icon" onClick={() => setSelectedOrder(order)}>
                                    <Eye className="w-4 h-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Mobile Cards */}
                    <div className="md:hidden space-y-2">
                      {rawOrders.map((order) => (
                        <button
                          key={order.id}
                          onClick={() => setSelectedOrder(order)}
                          className="w-full text-left p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm">#{order.daily_number || order.order_number}</span>
                              <Badge variant={order.status === "rejected" ? "destructive" : order.status === "delivered" ? "default" : "secondary"} className="text-[10px]">
                                {statusLabels[order.status] || order.status}
                              </Badge>
                            </div>
                            <span className="font-semibold text-sm">{formatCurrency(order.total)}</span>
                          </div>
                          <p className="text-sm font-medium truncate">{order.customer_name}</p>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                            <span>{order.delivery_type === "delivery" ? "🛵 Entrega" : "🏪 Retirada"}</span>
                            <span>{paymentMethodLabels[order.payment_method] || order.payment_method}</span>
                            <span>{order.created_at ? format(new Date(order.created_at), "dd/MM HH:mm", { locale: ptBR }) : "-"}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            )}
          </Card>
        </>
      )}

      {/* Order Detail / Edit Dialog */}
      <Dialog open={!!selectedOrder} onOpenChange={() => { setSelectedOrder(null); setEditingOrder(false); }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Pedido #{selectedOrder?.daily_number || selectedOrder?.order_number}</span>
              {!editingOrder ? (
                <Button variant="outline" size="sm" className="gap-1.5" onClick={startEditOrder}>
                  <Pencil className="h-3.5 w-3.5" />
                  Editar
                </Button>
              ) : (
                <div className="flex gap-1.5">
                  <Button variant="outline" size="sm" onClick={cancelEdit}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" className="gap-1.5" onClick={saveOrderEdit} disabled={savingOrder}>
                    <Save className="h-3.5 w-3.5" />
                    {savingOrder ? "Salvando..." : "Salvar"}
                  </Button>
                </div>
              )}
            </DialogTitle>
          </DialogHeader>
          {selectedOrder && !editingOrder && (
            <div className="space-y-4">
              {/* Customer Info */}
              <div className="space-y-1">
                <p className="text-sm font-medium">Cliente</p>
                <p className="text-sm">{selectedOrder.customer_name}</p>
                <p className="text-sm text-muted-foreground">{selectedOrder.customer_phone}</p>
                {selectedOrder.customer_address && (
                  <p className="text-sm text-muted-foreground">{selectedOrder.customer_address}</p>
                )}
              </div>

              {/* Order Info */}
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Tipo:</span>{" "}
                  {selectedOrder.delivery_type === "delivery" ? "Entrega" : "Retirada"}
                </div>
                <div>
                  <span className="text-muted-foreground">Pagamento:</span>{" "}
                  {paymentMethodLabels[selectedOrder.payment_method] || selectedOrder.payment_method}
                </div>
                <div>
                  <span className="text-muted-foreground">Status:</span>{" "}
                  {statusLabels[selectedOrder.status] || selectedOrder.status}
                </div>
                <div>
                  <span className="text-muted-foreground">Data:</span>{" "}
                  {selectedOrder.created_at
                    ? format(new Date(selectedOrder.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
                    : "-"}
                </div>
              </div>

              {/* Items */}
              <div>
                <p className="text-sm font-medium mb-2">Itens do Pedido</p>
                <div className="space-y-2">
                  {Array.isArray(selectedOrder.items) &&
                    (selectedOrder.items as unknown as OrderItem[]).map((item, idx) => (
                      <div key={idx} className="flex justify-between items-start text-sm border-b border-border pb-2 last:border-0">
                        <div className="flex-1">
                          <p className="font-medium">
                            {item.quantity}x {item.name}
                          </p>
                          {item.addonNames && Object.entries(item.addonNames).map(([group, addons]) => (
                            <p key={group} className="text-xs text-muted-foreground ml-2">
                              {group}: {Array.isArray(addons) ? (addons as string[]).join(", ") : String(addons)}
                            </p>
                          ))}
                          {item.notes && (
                            <p className="text-xs text-muted-foreground ml-2 italic">Obs: {item.notes}</p>
                          )}
                        </div>
                        <span className="font-medium">
                          {formatCurrency((item.price + (item.addonsTotal || 0)) * item.quantity)}
                        </span>
                      </div>
                    ))}
                </div>
              </div>

              {/* Totals */}
              <div className="border-t border-border pt-2 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatCurrency(selectedOrder.subtotal)}</span>
                </div>
                {(selectedOrder.discount ?? 0) > 0 && (
                  <div className="flex justify-between text-accent">
                    <span>Desconto {selectedOrder.coupon_code && `(${selectedOrder.coupon_code})`}</span>
                    <span>-{formatCurrency(selectedOrder.discount!)}</span>
                  </div>
                )}
                {(selectedOrder.delivery_fee ?? 0) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Taxa de entrega</span>
                    <span>{formatCurrency(selectedOrder.delivery_fee!)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-base pt-1 border-t border-border">
                  <span>Total</span>
                  <span className="text-primary">{formatCurrency(selectedOrder.total)}</span>
                </div>
              </div>

              {/* Notes */}
              {selectedOrder.notes && (
                <div className="bg-muted/50 p-3 rounded-lg">
                  <p className="text-sm font-medium">Observações</p>
                  <p className="text-sm text-muted-foreground">{selectedOrder.notes}</p>
                </div>
              )}
            </div>
          )}

          {/* Edit Mode */}
          {selectedOrder && editingOrder && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={editForm.status} onValueChange={(v) => setEditForm(prev => ({ ...prev, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(statusLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Tipo de Entrega</Label>
                <Select value={editForm.delivery_type} onValueChange={(v) => setEditForm(prev => ({ ...prev, delivery_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="delivery">Entrega</SelectItem>
                    <SelectItem value="pickup">Retirada</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Forma de Pagamento</Label>
                <Select value={editForm.payment_method} onValueChange={(v) => setEditForm(prev => ({ ...prev, payment_method: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pix">PIX</SelectItem>
                    <SelectItem value="cash">Dinheiro</SelectItem>
                    <SelectItem value="card">Cartão</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>Total (R$)</Label>
                  <Input
                    value={editForm.total}
                    onChange={(e) => setEditForm(prev => ({ ...prev, total: e.target.value.replace(/[^0-9.,]/g, "") }))}
                    inputMode="decimal"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tx. Entrega</Label>
                  <Input
                    value={editForm.delivery_fee}
                    onChange={(e) => setEditForm(prev => ({ ...prev, delivery_fee: e.target.value.replace(/[^0-9.,]/g, "") }))}
                    inputMode="decimal"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Desconto</Label>
                  <Input
                    value={editForm.discount}
                    onChange={(e) => setEditForm(prev => ({ ...prev, discount: e.target.value.replace(/[^0-9.,]/g, "") }))}
                    inputMode="decimal"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Observações</Label>
                <Input
                  value={editForm.notes}
                  onChange={(e) => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Observações do pedido"
                />
              </div>

              {/* Show items read-only */}
              <div>
                <p className="text-sm font-medium mb-2 text-muted-foreground">Itens do Pedido (somente leitura)</p>
                <div className="space-y-1 text-sm">
                  {Array.isArray(selectedOrder.items) &&
                    (selectedOrder.items as unknown as OrderItem[]).map((item, idx) => (
                      <div key={idx} className="flex justify-between text-muted-foreground">
                        <span>{item.quantity}x {item.name}</span>
                        <span>{formatCurrency((item.price + (item.addonsTotal || 0)) * item.quantity)}</span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Cash Register Session Detail Dialog */}
      <Dialog open={!!selectedCashRegister} onOpenChange={() => setSelectedCashRegister(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Sessão de Caixa
            </DialogTitle>
          </DialogHeader>
          {selectedCashRegister && (
            <div className="space-y-4">
              {/* Session Info */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Operador</p>
                  <p className="font-medium">{selectedCashRegister.opened_by}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Status</p>
                  <Badge variant={selectedCashRegister.status === "open" ? "default" : "secondary"}>
                    {selectedCashRegister.status === "open" ? "Aberto" : "Fechado"}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Abertura</p>
                  <p className="font-medium">{format(new Date(selectedCashRegister.opened_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
                  <p className="text-xs text-muted-foreground">{formatCurrency(selectedCashRegister.opening_amount)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Fechamento</p>
                  <p className="font-medium">
                    {selectedCashRegister.closed_at
                      ? format(new Date(selectedCashRegister.closed_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
                      : "Em aberto"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {selectedCashRegister.closing_amount != null ? formatCurrency(selectedCashRegister.closing_amount) : "-"}
                  </p>
                </div>
              </div>

              {/* Session Summary */}
              {!loadingSessionOrders && cashSessionOrders.length > 0 && (() => {
                const completedOrders = cashSessionOrders.filter(o => o.status !== "rejected");
                const sessionRevenue = completedOrders.reduce((sum, o) => sum + o.total, 0);
                const sessionDeliveryFees = completedOrders.reduce((sum, o) => sum + (o.delivery_fee || 0), 0);

                // Calculate driver costs for session
                const driverOrdersMap = new Map<string, typeof completedOrders>();
                completedOrders.forEach(o => {
                  if (o.driver_id) {
                    const existing = driverOrdersMap.get(o.driver_id) || [];
                    existing.push(o);
                    driverOrdersMap.set(o.driver_id, existing);
                  }
                });

                let totalDriverCosts = 0;
                driverOrdersMap.forEach((driverOrders, driverId) => {
                  const driver = cashSessionDrivers.find(d => d.id === driverId);
                  if (driver) {
                    const count = driverOrders.length;
                    totalDriverCosts += (driver.fixed_fee || 0) * count;
                    if (driver.fee_mode === "fixed_per_ride") {
                      totalDriverCosts += (driver.per_ride_fee || 0) * count;
                    } else if (driver.fee_mode === "delivery_passthrough") {
                      totalDriverCosts += driverOrders.reduce((sum, o) => sum + (o.delivery_fee || 0), 0);
                    }
                  }
                });

                return (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg border bg-muted/30 p-2.5 text-center">
                      <p className="text-xs text-muted-foreground">Pedidos</p>
                      <p className="text-lg font-bold">{completedOrders.length}</p>
                    </div>
                    <div className="rounded-lg border bg-muted/30 p-2.5 text-center">
                      <p className="text-xs text-muted-foreground">Faturamento</p>
                      <p className="text-lg font-bold text-primary">{formatCurrency(sessionRevenue)}</p>
                    </div>
                    <div className="rounded-lg border bg-muted/30 p-2.5 text-center">
                      <p className="text-xs text-muted-foreground">Tx. Entrega</p>
                      <p className="text-lg font-bold">{formatCurrency(sessionDeliveryFees)}</p>
                    </div>
                    <div className="rounded-lg border bg-orange-500/10 border-orange-500/30 p-2.5 text-center">
                      <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                        <Truck className="h-3 w-3" />
                        Custo Entregadores
                      </p>
                      <p className="text-lg font-bold text-orange-500">{formatCurrency(totalDriverCosts)}</p>
                    </div>
                  </div>
                );
              })()}

              {/* Session Orders List */}
              <div>
                <p className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Pedidos da sessão ({cashSessionOrders.length})
                </p>
                {loadingSessionOrders ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full" />)}
                  </div>
                ) : cashSessionOrders.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Nenhum pedido nesta sessão</p>
                ) : (
                  <div className="space-y-2 max-h-[40vh] overflow-y-auto">
                    {cashSessionOrders.map((order) => {
                      const items = Array.isArray(order.items) ? order.items : [];
                      const isExpanded = expandedSessionOrder === order.id;
                      return (
                        <div
                          key={order.id}
                          className="rounded-lg border bg-card overflow-hidden cursor-pointer hover:border-primary/40 transition-colors"
                          onClick={() => setExpandedSessionOrder(isExpanded ? null : order.id)}
                        >
                          <div className="p-3 space-y-1">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm">#{order.daily_number || order.order_number}</span>
                                <Badge variant={order.status === "rejected" ? "destructive" : order.status === "delivered" ? "default" : "secondary"} className="text-[10px]">
                                  {statusLabels[order.status] || order.status}
                                </Badge>
                              </div>
                              <span className="font-semibold text-sm">{formatCurrency(order.total)}</span>
                            </div>
                            <p className="text-sm truncate">{order.customer_name}</p>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                              <span>{order.delivery_type === "delivery" ? "🛵 Entrega" : "🏪 Retirada"}</span>
                              <span>{paymentMethodLabels[order.payment_method] || order.payment_method}</span>
                              <span>{order.created_at ? format(new Date(order.created_at), "HH:mm", { locale: ptBR }) : "-"}</span>
                            </div>
                            {/* Driver info */}
                            {order.driver_name && (() => {
                              const driver = cashSessionDrivers.find(d => d.id === order.driver_id);
                              let driverCost = 0;
                              if (driver) {
                                driverCost += driver.fixed_fee || 0;
                                if (driver.fee_mode === "fixed_per_ride") {
                                  driverCost += driver.per_ride_fee || 0;
                                } else if (driver.fee_mode === "delivery_passthrough") {
                                  driverCost += order.delivery_fee || 0;
                                }
                              }
                              return (
                                <div className="flex items-center gap-2 text-xs mt-1 pt-1 border-t border-border/40">
                                  <Truck className="h-3 w-3 text-orange-500 shrink-0" />
                                  <span className="font-medium">{order.driver_name}</span>
                                  {driverCost > 0 && (
                                    <span className="text-orange-500 font-semibold ml-auto">
                                      {formatCurrency(driverCost)}
                                    </span>
                                  )}
                                </div>
                              );
                            })()}
                          </div>

                          {isExpanded && (
                            <div className="border-t bg-muted/30 p-3 space-y-2">
                              {items.length > 0 ? items.map((item: any, idx: number) => {
                                const addonNames = item.addonNames || {};
                                const addonsTotal = item.addonsTotal || 0;
                                const addonsArr = item.addons ? (Array.isArray(item.addons) ? item.addons : Object.values(item.addons).flat()) : [];
                                return (
                                  <div key={idx} className="text-sm space-y-0.5">
                                    <div className="flex justify-between">
                                      <span className="font-medium">{item.quantity}x {item.name}</span>
                                      <span className="text-muted-foreground">{formatCurrency((item.price || 0) * (item.quantity || 1))}</span>
                                    </div>
                                    {addonsArr.length > 0 && (
                                      <div className="pl-4 text-xs text-muted-foreground space-y-0.5">
                                        {addonsArr.map((addonId: string, aIdx: number) => {
                                          const addonName = addonNames[addonId] || addonId;
                                          return (
                                            <p key={aIdx}>+ {typeof addonName === 'object' ? (addonName as any).name || addonId : addonName}</p>
                                          );
                                        })}
                                        {addonsTotal > 0 && (
                                          <p className="text-primary/80">Adicionais: {formatCurrency(addonsTotal * (item.quantity || 1))}</p>
                                        )}
                                      </div>
                                    )}
                                    {item.notes && <p className="pl-4 text-xs italic text-muted-foreground">Obs: {item.notes}</p>}
                                  </div>
                                );
                              }) : <p className="text-xs text-muted-foreground">Sem itens</p>}

                              <Separator />
                              <div className="text-xs space-y-0.5">
                                <div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(order.subtotal)}</span></div>
                                {(order.discount || 0) > 0 && (
                                  <div className="flex justify-between text-green-600"><span>Desconto</span><span>- {formatCurrency(order.discount)}</span></div>
                                )}
                                {(order.delivery_fee || 0) > 0 && (
                                  <div className="flex justify-between"><span>Taxa de entrega</span><span>{formatCurrency(order.delivery_fee)}</span></div>
                                )}
                                <div className="flex justify-between font-bold text-sm pt-1 border-t">
                                  <span>Total</span><span>{formatCurrency(order.total)}</span>
                                </div>
                              </div>
                              {order.customer_phone && (
                                <p className="text-xs text-muted-foreground">📞 {order.customer_phone}</p>
                              )}
                              {order.customer_address && (
                                <p className="text-xs text-muted-foreground">📍 {order.customer_address}</p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
