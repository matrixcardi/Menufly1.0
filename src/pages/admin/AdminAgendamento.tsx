import { useState, useEffect } from "react";
import { Calendar, Clock, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurantContext } from "@/contexts/RestaurantContext";
import { useToast } from "@/hooks/use-toast";

interface DaySchedule {
  enabled: boolean;
  start: string;
  end: string;
}

interface SchedulingConfig {
  enabled_delivery: boolean;
  enabled_pickup: boolean;
  min_advance_minutes: number;
  slot_interval_minutes: number;
  max_orders_per_slot: number;
  schedule: {
    monday: DaySchedule;
    tuesday: DaySchedule;
    wednesday: DaySchedule;
    thursday: DaySchedule;
    friday: DaySchedule;
    saturday: DaySchedule;
    sunday: DaySchedule;
  };
}

const daysOfWeek = [
  { key: 'monday', label: 'Segunda-feira' },
  { key: 'tuesday', label: 'Terça-feira' },
  { key: 'wednesday', label: 'Quarta-feira' },
  { key: 'thursday', label: 'Quinta-feira' },
  { key: 'friday', label: 'Sexta-feira' },
  { key: 'saturday', label: 'Sábado' },
  { key: 'sunday', label: 'Domingo' },
];

const advanceTimeOptions = [
  { value: 30, label: '30 minutos' },
  { value: 60, label: '1 hora' },
  { value: 120, label: '2 horas' },
  { value: 240, label: '4 horas' },
  { value: 1440, label: '24 horas' },
];

const slotIntervalOptions = [
  { value: 15, label: '15 minutos' },
  { value: 30, label: '30 minutos' },
  { value: 60, label: '1 hora' },
];

export default function AdminAgendamento() {
  const { selectedRestaurant, selectedRestaurantIds } = useRestaurantContext();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const restaurantId = selectedRestaurant?.id || (selectedRestaurantIds.length === 1 ? selectedRestaurantIds[0] : null);

  const [config, setConfig] = useState<SchedulingConfig>({
    enabled_delivery: false,
    enabled_pickup: false,
    min_advance_minutes: 120,
    slot_interval_minutes: 30,
    max_orders_per_slot: 5,
    schedule: {
      monday: { enabled: true, start: '10:00', end: '22:00' },
      tuesday: { enabled: true, start: '10:00', end: '22:00' },
      wednesday: { enabled: true, start: '10:00', end: '22:00' },
      thursday: { enabled: true, start: '10:00', end: '22:00' },
      friday: { enabled: true, start: '10:00', end: '22:00' },
      saturday: { enabled: true, start: '10:00', end: '22:00' },
      sunday: { enabled: true, start: '10:00', end: '22:00' },
    },
  });

  const [applyToAllStart, setApplyToAllStart] = useState('10:00');
  const [applyToAllEnd, setApplyToAllEnd] = useState('22:00');

  // Load existing configuration
  useEffect(() => {
    async function loadConfig() {
      if (!restaurantId) return;
      setLoading(true);

      try {
        const { data } = await supabase
          .from("scheduling_config" as any)
          .select("*")
          .eq("restaurant_id", restaurantId)
          .single();

        if (data) {
          setConfig({
            enabled_delivery: data.enabled_delivery || false,
            enabled_pickup: data.enabled_pickup || false,
            min_advance_minutes: data.min_advance_minutes || 120,
            slot_interval_minutes: data.slot_interval_minutes || 30,
            max_orders_per_slot: data.max_orders_per_slot || 5,
            schedule: data.schedule || config.schedule,
          });
        }
      } catch (error) {
        console.error("Error loading scheduling config:", error);
        // If no config exists, use defaults
      } finally {
        setLoading(false);
      }
    }

    loadConfig();
  }, [restaurantId]);

  async function saveConfig() {
    if (!restaurantId) return;
    setSaving(true);

    try {
      const { error } = await supabase
        .from("scheduling_config" as any)
        .upsert({
          restaurant_id: restaurantId,
          enabled_delivery: config.enabled_delivery,
          enabled_pickup: config.enabled_pickup,
          min_advance_minutes: config.min_advance_minutes,
          slot_interval_minutes: config.slot_interval_minutes,
          max_orders_per_slot: config.max_orders_per_slot,
          schedule: config.schedule,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: "restaurant_id"
        });

      if (error) throw error;

      toast({ title: "Configurações salvas com sucesso!" });
      setInitialConfig({ ...config });
    } catch (error: any) {
      console.error("Error saving scheduling config:", error);
      const errorMessage = error?.message || error?.details || "Não foi possível salvar as configurações.";
      toast({ 
        title: "Erro ao salvar", 
        description: errorMessage,
        variant: "destructive" 
      });
    } finally {
      setSaving(false);
    }
  }

  function updateDaySchedule(dayKey: string, field: keyof DaySchedule, value: boolean | string) {
    setConfig(prev => ({
      ...prev,
      schedule: {
        ...prev.schedule,
        [dayKey]: {
          ...prev.schedule[dayKey as keyof typeof prev.schedule],
          [field]: value,
        },
      },
    }));
  }

  function applyToAllActiveDays() {
    setConfig(prev => {
      const newSchedule = { ...prev.schedule };
      daysOfWeek.forEach(day => {
        if (newSchedule[day.key as keyof typeof newSchedule].enabled) {
          newSchedule[day.key as keyof typeof newSchedule] = {
            ...newSchedule[day.key as keyof typeof newSchedule],
            start: applyToAllStart,
            end: applyToAllEnd,
          };
        }
      });
      return { ...prev, schedule: newSchedule };
    });
    toast({ title: "Horário aplicado para todos os dias ativos" });
  }

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Agendamento de Pedidos</h1>
          <p className="text-muted-foreground text-sm">Configure o agendamento de delivery e retirada</p>
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Agendamento de Pedidos</h1>
          <p className="text-muted-foreground text-sm">Configure o agendamento de delivery e retirada</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={saveConfig} disabled={saving} className="gap-2">
            <Save className="w-4 h-4" />
            {saving ? "Salvando..." : "Salvar Configurações"}
          </Button>
        </div>
      </div>

      {/* Enable Toggles */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ativar Agendamento</CardTitle>
          <CardDescription>Escolha quais tipos de agendamento deseja habilitar</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="delivery-toggle" className="text-base font-medium">Agendamento de Delivery</Label>
              <p className="text-sm text-muted-foreground">Permite que clientes agendem pedidos para entrega</p>
            </div>
            <Switch
              id="delivery-toggle"
              checked={config.enabled_delivery}
              onCheckedChange={(checked) => setConfig(prev => ({ ...prev, enabled_delivery: checked }))}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="pickup-toggle" className="text-base font-medium">Agendamento de Retirada</Label>
              <p className="text-sm text-muted-foreground">Permite que clientes agendem pedidos para retirada no local</p>
            </div>
            <Switch
              id="pickup-toggle"
              checked={config.enabled_pickup}
              onCheckedChange={(checked) => setConfig(prev => ({ ...prev, enabled_pickup: checked }))}
            />
          </div>
        </CardContent>
      </Card>

      {/* General Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configurações Gerais</CardTitle>
          <CardDescription>Defina as regras para agendamento de pedidos</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Antecedência Mínima</Label>
              <Select
                value={config.min_advance_minutes.toString()}
                onValueChange={(value) => setConfig(prev => ({ ...prev, min_advance_minutes: parseInt(value) }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {advanceTimeOptions.map(option => (
                    <SelectItem key={option.value} value={option.value.toString()}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Intervalo entre Slots</Label>
              <Select
                value={config.slot_interval_minutes.toString()}
                onValueChange={(value) => setConfig(prev => ({ ...prev, slot_interval_minutes: parseInt(value) }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {slotIntervalOptions.map(option => (
                    <SelectItem key={option.value} value={option.value.toString()}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Máximo de Pedidos por Slot</Label>
              <Input
                type="number"
                min={1}
                max={50}
                value={config.max_orders_per_slot}
                onChange={(e) => setConfig(prev => ({ ...prev, max_orders_per_slot: parseInt(e.target.value) || 1 }))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Weekly Schedule */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Grade Semanal
          </CardTitle>
          <CardDescription>Configure os horários de funcionamento para cada dia da semana</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Apply to all */}
            <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg border">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Clock className="w-4 h-4 text-muted-foreground" />
                Aplicar horário para todos os dias
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="time"
                  value={applyToAllStart}
                  onChange={(e) => setApplyToAllStart(e.target.value)}
                  className="w-[120px]"
                />
                <span className="text-muted-foreground">às</span>
                <Input
                  type="time"
                  value={applyToAllEnd}
                  onChange={(e) => setApplyToAllEnd(e.target.value)}
                  className="w-[120px]"
                />
              </div>
              <Button
                onClick={applyToAllActiveDays}
                className="bg-orange-500 hover:bg-orange-600 text-white"
              >
                Aplicar para todos
              </Button>
            </div>

            <div className="border-t" />

            {/* Days */}
            {daysOfWeek.map((day) => (
              <div key={day.key} className="flex items-center gap-4 p-4 border rounded-lg">
                <Switch
                  checked={config.schedule[day.key as keyof typeof config.schedule].enabled}
                  onCheckedChange={(checked) => updateDaySchedule(day.key, 'enabled', checked)}
                />
                <div className="flex-1 font-medium">{day.label}</div>
                {config.schedule[day.key as keyof typeof config.schedule].enabled && (
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <Input
                      type="time"
                      value={config.schedule[day.key as keyof typeof config.schedule].start}
                      onChange={(e) => updateDaySchedule(day.key, 'start', e.target.value)}
                      className="w-[120px]"
                    />
                    <span className="text-muted-foreground">às</span>
                    <Input
                      type="time"
                      value={config.schedule[day.key as keyof typeof config.schedule].end}
                      onChange={(e) => updateDaySchedule(day.key, 'end', e.target.value)}
                      className="w-[120px]"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
