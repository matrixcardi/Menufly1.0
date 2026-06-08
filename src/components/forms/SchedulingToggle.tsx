import { useState, useEffect } from "react";
import { Calendar, Clock, Loader2 } from "lucide-react";
import { format, addDays, parse, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";

interface SchedulingToggleProps {
  restaurantId: string;
  deliveryMethod: "pickup" | "delivery";
  onSchedulingChange: (scheduledAt: string | null, schedulingType: string | null) => void;
}

export function SchedulingToggle({ 
  restaurantId, 
  deliveryMethod, 
  onSchedulingChange 
}: SchedulingToggleProps) {
  const [enableScheduling, setEnableScheduling] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<{ start: Date; end: Date } | null>(null);
  const [availableSlots, setAvailableSlots] = useState<Array<{ start: Date; end: Date; available: number }>>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [schedulingConfig, setSchedulingConfig] = useState<any>(null);

  // Load scheduling config
  useEffect(() => {
    if (!restaurantId) return;
    
    supabase
      .from("scheduling_config" as any)
      .select("*")
      .eq("restaurant_id", restaurantId)
      .single()
      .then(({ data }) => {
        if (data) setSchedulingConfig(data);
      });
  }, [restaurantId]);

  // Check if scheduling is enabled for the selected delivery method
  const isSchedulingEnabled = deliveryMethod === "delivery" 
    ? schedulingConfig?.enabled_delivery 
    : deliveryMethod === "pickup" 
      ? schedulingConfig?.enabled_pickup 
      : false;

  // Load available slots when date is selected
  useEffect(() => {
    const loadSlots = async () => {
      if (!selectedDate || !restaurantId || !schedulingConfig) {
        setAvailableSlots([]);
        return;
      }

      setLoadingSlots(true);

      try {
        const dayStart = startOfDay(selectedDate);
        const dayEnd = endOfDay(selectedDate);
        const dayOfWeek = format(selectedDate, "EEEE", { locale: ptBR });
        const dayKey = dayOfWeek === "segunda-feira" ? "monday" :
                      dayOfWeek === "terça-feira" ? "tuesday" :
                      dayOfWeek === "quarta-feira" ? "wednesday" :
                      dayOfWeek === "quinta-feira" ? "thursday" :
                      dayOfWeek === "sexta-feira" ? "friday" :
                      dayOfWeek === "sábado" ? "saturday" : "sunday";

        const daySchedule = schedulingConfig.schedule?.[dayKey];

        if (!daySchedule || !daySchedule.enabled) {
          setAvailableSlots([]);
          setLoadingSlots(false);
          return;
        }

        const startTime = parse(daySchedule.start, "HH:mm", selectedDate);
        const endTime = parse(daySchedule.end, "HH:mm", selectedDate);
        const intervalMinutes = schedulingConfig.slot_interval_minutes || 30;
        const maxOrders = schedulingConfig.max_orders_per_slot || 5;

        // Get blocked slots
        const { data: blockedData } = await supabase
          .from("scheduling_blocked_slots" as any)
          .select("blocked_at")
          .eq("restaurant_id", restaurantId)
          .gte("blocked_at", dayStart.toISOString())
          .lte("blocked_at", dayEnd.toISOString());

        const blockedTimes = new Set((blockedData || []).map((b: any) => new Date(b.blocked_at).getTime()));

        // Get existing orders for the day
        const { data: ordersData } = await supabase
          .from("orders")
          .select("scheduled_at")
          .eq("restaurant_id", restaurantId)
          .not("scheduled_at", "is", null)
          .gte("scheduled_at", dayStart.toISOString())
          .lte("scheduled_at", dayEnd.toISOString());

        const slotCounts = new Map<number, number>();
        (ordersData || []).forEach((order: any) => {
          if (order.scheduled_at) {
            const time = new Date(order.scheduled_at).getTime();
            slotCounts.set(time, (slotCounts.get(time) || 0) + 1);
          }
        });

        // Generate slots
        const slots: Array<{ start: Date; end: Date; available: number }> = [];
        let current = startTime;
        while (current < endTime) {
          const slotEnd = new Date(current.getTime() + intervalMinutes * 60000);
          const timeKey = current.getTime();
          const isBlocked = blockedTimes.has(timeKey);
          const orderCount = slotCounts.get(timeKey) || 0;
          const available = isBlocked ? 0 : Math.max(0, maxOrders - orderCount);

          slots.push({ start: current, end: slotEnd, available });
          current = slotEnd;
        }

        setAvailableSlots(slots);
      } catch (error) {
        console.error("Error loading slots:", error);
        setAvailableSlots([]);
      } finally {
        setLoadingSlots(false);
      }
    };

    loadSlots();
  }, [selectedDate, restaurantId, schedulingConfig]);

  // Notify parent of changes
  useEffect(() => {
    if (enableScheduling && selectedSlot) {
      onSchedulingChange(selectedSlot.start.toISOString(), deliveryMethod === "delivery" ? "delivery" : "retirada");
    } else {
      onSchedulingChange(null, null);
    }
  }, [enableScheduling, selectedSlot, deliveryMethod, onSchedulingChange]);

  const handleToggleChange = (checked: boolean) => {
    setEnableScheduling(checked);
    if (!checked) {
      setSelectedDate(null);
      setSelectedSlot(null);
      setAvailableSlots([]);
    }
  };

  const getNextDays = () => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      days.push(addDays(new Date(), i));
    }
    return days;
  };

  const formatDate = (date: Date) => {
    const dayOfWeek = format(date, "EEEE", { locale: ptBR });
    const dayMonth = format(date, "dd/MM");
    return `${dayOfWeek}, ${dayMonth}`;
  };

  const formatTime = (date: Date) => {
    return format(date, "HH:mm");
  };

  if (!isSchedulingEnabled) {
    return null;
  }

  return (
    <div className="space-y-4 pt-4 border-t border-border">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Label className="text-sm font-semibold flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Agendar para depois
          </Label>
          <p className="text-xs text-muted-foreground">
            Escolha uma data e hora para receber seu pedido
          </p>
        </div>
        <Switch
          checked={enableScheduling}
          onCheckedChange={handleToggleChange}
        />
      </div>

      {enableScheduling && (
        <div className="space-y-4">
          {/* Date Selector */}
          <div className="space-y-2">
            <Label>Data</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {getNextDays().map((date) => {
                const dayOfWeek = format(date, "EEEE", { locale: ptBR });
                const dayKey = dayOfWeek === "segunda-feira" ? "monday" :
                              dayOfWeek === "terça-feira" ? "tuesday" :
                              dayOfWeek === "quarta-feira" ? "wednesday" :
                              dayOfWeek === "quinta-feira" ? "thursday" :
                              dayOfWeek === "sexta-feira" ? "friday" :
                              dayOfWeek === "sábado" ? "saturday" : "sunday";
                const daySchedule = schedulingConfig?.schedule?.[dayKey];
                const isDayEnabled = daySchedule?.enabled;

                if (!isDayEnabled) return null;

                const isSelected = selectedDate?.toDateString() === date.toDateString();

                return (
                  <Button
                    key={date.toISOString()}
                    variant={isSelected ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setSelectedDate(date);
                      setSelectedSlot(null);
                    }}
                    className="text-xs"
                  >
                    {formatDate(date)}
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Time Slots */}
          {selectedDate && (
            <div className="space-y-2">
              <Label>Horário</Label>
              {loadingSlots ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Carregando horários...
                </div>
              ) : availableSlots.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum horário disponível para esta data.
                </p>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {availableSlots.map((slot, index) => {
                    const isSelected = selectedSlot?.start.getTime() === slot.start.getTime();
                    const isUnavailable = slot.available === 0;

                    return (
                      <Button
                        key={index}
                        variant={isSelected ? "default" : "outline"}
                        size="sm"
                        disabled={isUnavailable}
                        onClick={() => setSelectedSlot(slot)}
                        className="text-xs"
                      >
                        <Clock className="w-3 h-3 mr-1" />
                        {formatTime(slot.start)}
                        {isUnavailable && " (cheio)"}
                      </Button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
