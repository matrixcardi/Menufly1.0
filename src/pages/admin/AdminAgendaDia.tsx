import { useState, useEffect } from "react";
import { format, addDays, subDays, startOfDay, endOfDay, parse } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, ChevronLeft, ChevronRight, Clock, Ban, ShoppingCart, Truck, Package } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurantContext } from "@/contexts/RestaurantContext";
import { useToast } from "@/hooks/use-toast";

interface SchedulingConfig {
  enabled_delivery: boolean;
  enabled_pickup: boolean;
  min_advance_minutes: number;
  slot_interval_minutes: number;
  max_orders_per_slot: number;
  schedule: {
    monday: { enabled: boolean; start: string; end: string };
    tuesday: { enabled: boolean; start: string; end: string };
    wednesday: { enabled: boolean; start: string; end: string };
    thursday: { enabled: boolean; start: string; end: string };
    friday: { enabled: boolean; start: string; end: string };
    saturday: { enabled: boolean; start: string; end: string };
    sunday: { enabled: boolean; start: string; end: string };
  };
}

interface Slot {
  start: Date;
  end: Date;
  orders: Array<{
    id: string;
    orderNumber: string;
    customerName: string;
    schedulingType: string;
    totalAmount: number;
  }>;
  blocked: boolean;
}

interface BlockedSlot {
  id: string;
  blockedAt: Date;
  reason: string | null;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatTime(date: Date) {
  return format(date, "HH:mm", { locale: ptBR });
}

export default function AdminAgendaDia() {
  const { selectedRestaurant, selectedRestaurantIds } = useRestaurantContext();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const restaurantId = selectedRestaurant?.id || (selectedRestaurantIds.length === 1 ? selectedRestaurantIds[0] : null);

  const [config, setConfig] = useState<SchedulingConfig | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [blockedSlots, setBlockedSlots] = useState<BlockedSlot[]>([]);
  const [summary, setSummary] = useState({ total: 0, delivery: 0, pickup: 0 });

  // Block slot dialog
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [selectedSlotToBlock, setSelectedSlotToBlock] = useState<Slot | null>(null);
  const [blockReason, setBlockReason] = useState("");

  // Load data
  useEffect(() => {
    async function loadData() {
      if (!restaurantId) return;
      setLoading(true);

      try {
        const dayStart = startOfDay(selectedDate);
        const dayEnd = endOfDay(selectedDate);

        // Load scheduling config
        const { data: configData } = await supabase
          .from("scheduling_config" as any)
          .select("*")
          .eq("restaurant_id", restaurantId)
          .single();

        if (!configData) {
          setConfig(null);
          setSlots([]);
          setSummary({ total: 0, delivery: 0, pickup: 0 });
          setLoading(false);
          return;
        }

        setConfig(configData);

        // Load blocked slots for the day
        const { data: blockedData } = await supabase
          .from("scheduling_blocked_slots" as any)
          .select("*")
          .eq("restaurant_id", restaurantId)
          .gte("blocked_at", dayStart.toISOString())
          .lte("blocked_at", dayEnd.toISOString());

        setBlockedSlots(
          (blockedData || []).map((bs: any) => ({
            id: bs.id,
            blockedAt: new Date(bs.blocked_at),
            reason: bs.reason,
          }))
        );

        // Load scheduled orders for the day
        const selectedDateStr = format(selectedDate, "yyyy-MM-dd");
        const { data: ordersData } = await supabase
          .from("orders")
          .select("id, order_number, customer_name, scheduling_type, total_amount, scheduled_at")
          .eq("restaurant_id", restaurantId)
          .not("scheduled_at", "is", null)
          .filter("scheduled_at", "gte", `${selectedDateStr}T00:00:00`)
          .filter("scheduled_at", "lte", `${selectedDateStr}T23:59:59`);

        const orders = (ordersData || []).map((order: any) => ({
          id: order.id,
          orderNumber: order.order_number || `#${order.id.substring(0, 8)}`,
          customerName: order.customer_name || "Cliente não informado",
          schedulingType: order.scheduling_type || "delivery",
          totalAmount: Number(order.total_amount),
          scheduledAt: new Date(order.scheduled_at),
        }));

        // Generate slots based on config
        const dayOfWeek = format(selectedDate, "EEEE", { locale: ptBR }).toLowerCase();
        const dayKey = dayOfWeek === "segunda-feira" ? "monday" :
                      dayOfWeek === "terça-feira" ? "tuesday" :
                      dayOfWeek === "quarta-feira" ? "wednesday" :
                      dayOfWeek === "quinta-feira" ? "thursday" :
                      dayOfWeek === "sexta-feira" ? "friday" :
                      dayOfWeek === "sábado" ? "saturday" : "sunday";

        const daySchedule = configData.schedule[dayKey as keyof typeof configData.schedule];

        if (!daySchedule || !daySchedule.enabled) {
          setSlots([]);
          setSummary({ total: 0, delivery: 0, pickup: 0 });
          setLoading(false);
          return;
        }

        const startTime = parse(daySchedule.start, "HH:mm", selectedDate);
        const endTime = parse(daySchedule.end, "HH:mm", selectedDate);
        const intervalMinutes = configData.slot_interval_minutes;

        const generatedSlots: Slot[] = [];
        let currentStart = startTime;

        while (currentStart < endTime) {
          const currentEnd = new Date(currentStart.getTime() + intervalMinutes * 60000);

          // Check if slot is blocked
          const isBlocked = blockedSlots.some((bs) => {
            const blockedStart = new Date(bs.blockedAt);
            const blockedEnd = new Date(blockedStart.getTime() + intervalMinutes * 60000);
            return blockedStart.getTime() === currentStart.getTime();
          });

          // Find orders in this slot
          const slotOrders = orders.filter((order) => {
            const orderTime = new Date(order.scheduledAt);
            return orderTime.getTime() >= currentStart.getTime() && orderTime.getTime() < currentEnd.getTime();
          });

          generatedSlots.push({
            start: currentStart,
            end: currentEnd,
            orders: slotOrders,
            blocked: isBlocked,
          });

          currentStart = currentEnd;
        }

        setSlots(generatedSlots);

        // Calculate summary
        const totalOrders = orders.length;
        const deliveryOrders = orders.filter((o) => o.schedulingType === "delivery").length;
        const pickupOrders = orders.filter((o) => o.schedulingType === "retirada").length;

        setSummary({
          total: totalOrders,
          delivery: deliveryOrders,
          pickup: pickupOrders,
        });

      } catch (error) {
        console.error("Error loading agenda data:", error);
        toast({ title: "Erro ao carregar dados", description: "Não foi possível carregar a agenda.", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [restaurantId, selectedDate, toast]);

  async function blockSlot() {
    if (!selectedSlotToBlock || !restaurantId) return;

    try {
      const { error } = await supabase
        .from("scheduling_blocked_slots" as any)
        .insert({
          restaurant_id: restaurantId,
          blocked_at: selectedSlotToBlock.start.toISOString(),
          reason: blockReason || null,
        });

      if (error) throw error;

      toast({ title: "Slot bloqueado com sucesso!" });
      setBlockDialogOpen(false);
      setBlockReason("");
      setSelectedSlotToBlock(null);

      // Reload data
      const event = new Event("reload");
      window.dispatchEvent(event);
    } catch (error) {
      console.error("Error blocking slot:", error);
      toast({ title: "Erro ao bloquear", description: "Não foi possível bloquear o slot.", variant: "destructive" });
    }
  }

  async function unblockSlot(slotId: string) {
    if (!restaurantId) return;

    try {
      const { error } = await supabase
        .from("scheduling_blocked_slots" as any)
        .delete()
        .eq("id", slotId);

      if (error) throw error;

      toast({ title: "Slot desbloqueado com sucesso!" });

      // Reload data
      const event = new Event("reload");
      window.dispatchEvent(event);
    } catch (error) {
      console.error("Error unblocking slot:", error);
      toast({ title: "Erro ao desbloquear", description: "Não foi possível desbloquear o slot.", variant: "destructive" });
    }
  }

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Agenda do Dia</h1>
            <p className="text-muted-foreground text-sm">Visualize os agendamentos do dia</p>
          </div>
          <Skeleton className="h-10 w-[200px]" />
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardContent className="pt-6">
            <Skeleton className="h-[400px] w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  const isToday = format(selectedDate, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Agenda do Dia</h1>
          <p className="text-muted-foreground text-sm">Visualize os agendamentos do dia</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setSelectedDate(subDays(selectedDate, 1))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" onClick={() => setSelectedDate(new Date())}>
            {isToday ? "Hoje" : format(selectedDate, "dd/MM/yyyy", { locale: ptBR })}
          </Button>
          <Button variant="outline" size="icon" onClick={() => setSelectedDate(addDays(selectedDate, 1))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {!config ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12 text-muted-foreground">
              <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Agendamento não configurado</p>
              <p className="text-sm">Configure o agendamento em Configurações &gt; Agendamento</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Total Agendados</p>
                    <p className="text-2xl font-bold">{summary.total}</p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                    <ShoppingCart className="w-6 h-6" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Delivery</p>
                    <p className="text-2xl font-bold">{summary.delivery}</p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                    <Truck className="w-6 h-6" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Retirada</p>
                    <p className="text-2xl font-bold">{summary.pickup}</p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
                    <Package className="w-6 h-6" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Slots */}
          {slots.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-12 text-muted-foreground">
                  <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum slot disponível para este dia</p>
                  <p className="text-sm">Verifique a configuração de horários para este dia da semana</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {slots.map((slot, index) => {
                const isFull = slot.orders.length >= config.max_orders_per_slot;
                const blockedSlot = blockedSlots.find((bs) => {
                  const blockedStart = new Date(bs.blockedAt);
                  return blockedStart.getTime() === slot.start.getTime();
                });

                return (
                  <Card key={index} className={blockedSlot ? "opacity-50" : ""}>
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4 text-muted-foreground" />
                              <span className="font-medium">{formatTime(slot.start)} - {formatTime(slot.end)}</span>
                            </div>
                            <Badge
                              variant={blockedSlot ? "secondary" : isFull ? "destructive" : "default"}
                              className={blockedSlot ? "" : isFull ? "" : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"}
                            >
                              {blockedSlot ? "Bloqueado" : isFull ? "Cheio" : "Disponível"}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              {slot.orders.length}/{config.max_orders_per_slot}
                            </span>
                          </div>

                          {slot.orders.length > 0 ? (
                            <div className="space-y-2">
                              {slot.orders.map((order) => (
                                <div key={order.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                                  <div className="flex items-center gap-3">
                                    <span className="font-medium text-sm">{order.orderNumber}</span>
                                    <span className="text-sm">{order.customerName}</span>
                                    <Badge variant="outline" className="text-xs">
                                      {order.schedulingType === "delivery" ? "Delivery" : "Retirada"}
                                    </Badge>
                                  </div>
                                  <span className="font-medium text-sm">{formatCurrency(order.totalAmount)}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground">Nenhum pedido agendado</p>
                          )}
                        </div>

                        <div className="flex flex-col gap-2">
                          {blockedSlot ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => unblockSlot(blockedSlot.id)}
                            >
                              Desbloquear
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedSlotToBlock(slot);
                                setBlockDialogOpen(true);
                              }}
                            >
                              <Ban className="w-4 h-4 mr-1" />
                              Bloquear
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Block Slot Dialog */}
      <Dialog open={blockDialogOpen} onOpenChange={setBlockDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bloquear Slot</DialogTitle>
            <DialogDescription>
              Bloquear o slot das {selectedSlotToBlock && formatTime(selectedSlotToBlock.start)} às {selectedSlotToBlock && formatTime(selectedSlotToBlock.end)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reason">Motivo (opcional)</Label>
              <Input
                id="reason"
                placeholder="Ex: Falta de funcionário, Manutenção, etc."
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBlockDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={blockSlot}>
              Bloquear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
