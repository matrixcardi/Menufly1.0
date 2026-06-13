import { useState, useEffect, useMemo } from "react";
// GPS — Radar e Navigation serão reativados futuramente
import { ArrowLeft, MapPin, Store, ChevronDown, Loader2, Clock } from "lucide-react";
// import { Radar, Navigation } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
// GPS — será implementado futuramente
// import { haversineDistanceKm } from "@/lib/haversine";
// import { geocodeCep, reverseGeocode } from "@/lib/geocoding";
import { format, addDays, parse, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useCart } from "@/contexts/CartContext";
import { toast } from "sonner";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { PaymentDrawer } from "./PaymentDrawer";

interface AddressDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBack: () => void;
  customerInfo: { name: string; phone: string };
  restaurantId?: string;
  restaurantSlug?: string;
}

type DeliveryMethod = "pickup" | "delivery" | null;

interface DeliveryZone {
  id: string;
  name: string;
  city: string | null;
  fee: number;
  estimated_time_min: number | null;
  min_radius_km: number | null;
  max_radius_km: number | null;
  zone_type: string;
}

interface AddressData {
  street: string;
  number: string;
  complement: string;
  reference: string;
  neighborhood: string;
}

interface DaySchedule {
  enabled: boolean;
  start: string;
  end: string;
}

interface SchedulingConfig {
  enabled_delivery: boolean;
  enabled_pickup: boolean;
  schedule: Record<string, DaySchedule>;
  slot_interval_minutes: number;
  max_orders_per_slot: number;
}

const addressSchema = z.object({
  street: z.string().min(3, "Rua inválida"),
  number: z.string().min(1, "Número obrigatório"),
});

export function AddressDrawer({ open, onOpenChange, onBack, customerInfo, restaurantId, restaurantSlug }: AddressDrawerProps) {
  const { subtotal, hasFreeShipping } = useCart();
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>(null);
  const [restaurantData, setRestaurantData] = useState<{
    name: string;
    address_street: string | null;
    address_number: string | null;
    address_neighborhood: string | null;
    address_city: string | null;
    address_state: string | null;
    address_complement: string | null;
    address_cep: string | null;
    address: string | null;
    opening_time: string | null;
    closing_time: string | null;
    delivery_mode: string;
    default_delivery_fee: number;
    restaurant_lat: number | null;
    restaurant_lng: number | null;
    pickup_available: boolean | null;
    delivery_available: boolean | null;
    min_order: number | null;
    free_shipping_threshold: number | null;
  } | null>(null);

  // Delivery zones from DB
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedZoneId, setSelectedZoneId] = useState("");
  const [loadingRestaurant, setLoadingRestaurant] = useState(false);

  // GPS/Radius mode — será implementado futuramente
  // const [geoLoading, setGeoLoading] = useState(false);
  // const [geoError, setGeoError] = useState<string | null>(null);
  // const [userLat, setUserLat] = useState<number | null>(null);
  // const [userLng, setUserLng] = useState<number | null>(null);
  // const [distanceKm, setDistanceKm] = useState<number | null>(null);
  // const [matchedRadiusZone, setMatchedRadiusZone] = useState<DeliveryZone | null>(null);
  // const [cep, setCep] = useState("");
  // const [cepLoading, setCepLoading] = useState(false);
  // const [cepError, setCepError] = useState<string | null>(null);
  // const [locationSource, setLocationSource] = useState<"gps" | "cep" | null>(null);
  // const [resolvingAddress, setResolvingAddress] = useState(false);
  // const [resolvedCity, setResolvedCity] = useState<string>("");
  // const [resolvedState, setResolvedState] = useState<string>("");

  // Neighborhood mode CEP state
  const [neighborhoodCep, setNeighborhoodCep] = useState("");

  const [address, setAddress] = useState<AddressData>({
    street: "",
    number: "",
    complement: "",
    reference: "",
    neighborhood: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPaymentDrawer, setShowPaymentDrawer] = useState(false);
  // When both zone types exist, the user must pick which flow to use.
  // "none" = restaurant has no delivery zones configured (plain address form).
  const [locationMode, setLocationMode] = useState<"radius" | "neighborhood" | "none" | null>(null);

  // Scheduling state
  const [schedulingConfig, setSchedulingConfig] = useState<SchedulingConfig | null>(null);
  const [enableScheduling, setEnableScheduling] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<{ start: Date; end: Date } | null>(null);
  const [availableSlots, setAvailableSlots] = useState<Array<{ start: Date; end: Date; available: number }>>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Fetch restaurant address + delivery zones + scheduling config
  useEffect(() => {
    if (!restaurantId) return;

    setLoadingRestaurant(true);

    supabase
      .from("restaurants")
      .select("name, address_street, address_number, address_neighborhood, address_city, address_state, address_complement, address_cep, address, opening_time, closing_time, delivery_mode, default_delivery_fee, restaurant_lat, restaurant_lng, pickup_available, delivery_available, min_order, free_shipping_threshold")
      .eq("id", restaurantId)
      .single()
      .then(({ data, error }) => {
        if (!error && data) {
          setRestaurantData(data);
        }
        setLoadingRestaurant(false);
      });

    supabase
      .from("delivery_zones")
      .select("id, name, city, fee, estimated_time_min, min_radius_km, max_radius_km, zone_type")
      .eq("restaurant_id", restaurantId)
      .eq("is_active", true)
      .order("city")
      .order("name")
      .then(({ data }) => {
        if (data) setZones(data as DeliveryZone[]);
      });

    // Load scheduling config — tabela fora do schema gerado, cast explícito necessário
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("scheduling_config")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .single()
      .then(({ data }: { data: SchedulingConfig | null }) => {
        if (data) setSchedulingConfig(data);
      });
  }, [restaurantId]);

  // Neighborhood zones
  const neighborhoodZones = useMemo(() => zones.filter(z => z.zone_type === "neighborhood"), [zones]);
  // GPS/Radius — será implementado futuramente
  // const radiusZones = useMemo(() => zones.filter(z => z.zone_type === "radius").sort((a, b) => (a.min_radius_km || 0) - (b.min_radius_km || 0)), [zones]);

  const hasNeighborhoodZones = neighborhoodZones.length > 0;
  // const hasRadiusZones = radiusZones.length > 0;
  // const hasBothModes = hasNeighborhoodZones && hasRadiusZones;

  // GPS/Radius mode desativado temporariamente — será implementado futuramente
  useEffect(() => {
    if (deliveryMethod !== "delivery") {
      setLocationMode(null);
      return;
    }

    if (hasNeighborhoodZones) setLocationMode("neighborhood");
    else setLocationMode("none");
  }, [hasNeighborhoodZones, deliveryMethod]);

  // const isRadiusMode = locationMode === "radius"; // GPS — será implementado futuramente

  // Derive unique cities
  const cities = useMemo(() => {
    const set = new Set<string>();
    neighborhoodZones.forEach((z) => set.add(z.city || ""));
    return Array.from(set).sort();
  }, [neighborhoodZones]);

  const hasMultipleCities = cities.filter(Boolean).length >= 1;

  const availableNeighborhoods = useMemo(() => {
    if (!hasMultipleCities) return neighborhoodZones;
    return neighborhoodZones.filter((z) => (z.city || "") === selectedCity);
  }, [neighborhoodZones, selectedCity, hasMultipleCities]);

  const selectedZone = zones.find((z) => z.id === selectedZoneId);

  // GPS — será implementado futuramente
  // const requestGeolocation = () => {
  //   if (!navigator.geolocation) {
  //     setGeoError("Seu navegador não suporta geolocalização");
  //     return;
  //   }
  //   setGeoLoading(true);
  //   setGeoError(null);
  //   navigator.geolocation.getCurrentPosition(
  //     (pos) => {
  //       setUserLat(pos.coords.latitude);
  //       setUserLng(pos.coords.longitude);
  //       setGeoLoading(false);
  //       setLocationSource("gps");
  //     },
  //     (err) => {
  //       setGeoLoading(false);
  //       if (err.code === err.PERMISSION_DENIED) {
  //         setGeoError("Permissão de localização negada. Ative o GPS e tente novamente.");
  //       } else if (err.code === err.POSITION_UNAVAILABLE) {
  //         setGeoError("Localização indisponível. Verifique seu GPS.");
  //       } else {
  //         setGeoError("Não foi possível obter sua localização. Tente novamente.");
  //       }
  //     },
  //     { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
  //   );
  // };

  const formatCep = (v: string) => {
    const n = v.replace(/\D/g, "").slice(0, 8);
    if (n.length <= 5) return n;
    return `${n.slice(0, 5)}-${n.slice(5)}`;
  };

  // Neighborhood mode: apply CEP mask only — no auto-lookup
  const handleNeighborhoodCepChange = (value: string) => {
    setNeighborhoodCep(formatCep(value));
  };

  // GPS — será implementado futuramente
  // const lookupCep = async (rawCep?: string) => { ... };

  // GPS — será implementado futuramente
  // useEffect calculando distância por haversine removido

  // GPS — será implementado futuramente
  // useEffect de reverse geocoding removido

  // GPS — será implementado futuramente
  // const radiusDeliveryFee = ...;
  // const isOutOfRange = ...;
  // const maxRadius = ...;

  // Check if free shipping threshold is met
  const freeShippingThresholdMet = restaurantData?.free_shipping_threshold && subtotal >= restaurantData.free_shipping_threshold;

  const handleInputChange = (field: keyof AddressData) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setAddress((prev) => ({ ...prev, [field]: e.target.value }));
    setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const handleBack = () => {
    onOpenChange(false);
    setTimeout(onBack, 300);
  };

  const handlePaymentBack = () => {
    setShowPaymentDrawer(false);
    setTimeout(() => onOpenChange(true), 300);
  };

  // Smooth-scroll the drawer's inner scroll area to a section so the user
  // sees which field blocked the submit. Body scroll is locked by the drawer,
  // so scrollIntoView only moves the inner container.
  const scrollToSection = (id: string) => {
    requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  };

  const failValidation = (fieldErrors: Record<string, string>, sectionId: string) => {
    setErrors(fieldErrors);
    scrollToSection(sectionId);
  };

  // After the keyboard finishes opening (visualViewport resize), nudge the
  // focused field into view with the minimum movement needed ("nearest"), so
  // the user never loses their place in the form.
  const handleFieldFocus = (e: React.FocusEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (!/^(INPUT|SELECT|TEXTAREA)$/.test(target.tagName)) return;
    const vv = window.visualViewport;
    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      vv?.removeEventListener("resize", settle);
      target.scrollIntoView({ behavior: "smooth", block: "nearest" });
    };
    vv?.addEventListener("resize", settle);
    setTimeout(settle, 300);
  };

  const handleSubmit = () => {
    setErrors({});

    if (!deliveryMethod) {
      failValidation({ deliveryMethod: "Escolha como deseja receber seu pedido" }, "delivery-method-section");
      return;
    }

    if (enableScheduling && (!selectedDate || !selectedSlot)) {
      failValidation(
        { scheduling: !selectedDate ? "Selecione a data do agendamento" : "Selecione o horário do agendamento" },
        "scheduling-section"
      );
      return;
    }

    if (deliveryMethod === "delivery") {
      // Check minimum order for delivery
      if (restaurantData?.min_order && subtotal < restaurantData.min_order) {
        toast.error(`Pedido mínimo para delivery: R$ ${restaurantData.min_order.toFixed(2)}`);
        return;
      }

      if (!locationMode) {
        failValidation({ locationMode: "Escolha como informar seu endereço" }, "location-mode-section");
        return;
      }

      // GPS/Radius validation — será implementado futuramente
      // if (locationMode === "radius") { ... }

      if (locationMode === "neighborhood") {
        if (neighborhoodCep.replace(/\D/g, "").length !== 8) {
          failValidation({ neighborhoodCep: "Informe um CEP válido" }, "neighborhood-cep-field");
          return;
        }
        if (hasMultipleCities && !selectedCity) {
          failValidation({ neighborhood: "Selecione sua cidade" }, "zone-select-field");
          return;
        }
        if (!selectedZoneId) {
          failValidation({ neighborhood: "Selecione o setor/bairro" }, "zone-select-field");
          return;
        }
      }

      const result = addressSchema.safeParse({
        street: address.street.trim(),
        number: address.number.trim(),
      });
      if (!result.success) {
        const fieldErrors: Record<string, string> = {};
        result.error.errors.forEach((err) => {
          const field = err.path[0] as string;
          fieldErrors[field] = err.message;
        });
        const firstField = result.error.errors[0]?.path[0] as string;
        failValidation(fieldErrors, firstField);
        return;
      }
    }

    setShowPaymentDrawer(true);
    onOpenChange(false);
  };

  // Keep everything the user typed between openings (back navigation, returning
  // from payment, accidental close) — losing a half-filled address is the worst
  // outcome. Only transient error states are cleared when the drawer opens.
  useEffect(() => {
    if (open) {
      setErrors({});
      // setGeoError(null);   // GPS — será implementado futuramente
      // setCepError(null);   // GPS — será implementado futuramente
    }
  }, [open]);

  // Check if scheduling is enabled for the selected delivery method
  const isSchedulingEnabled = deliveryMethod === "delivery" 
    ? schedulingConfig?.enabled_delivery 
    : deliveryMethod === "pickup" 
      ? schedulingConfig?.enabled_pickup 
      : false;

  // Load available slots when date is selected
  useEffect(() => {
    async function loadSlots() {
      if (!selectedDate || !restaurantId || !schedulingConfig) {
        setAvailableSlots([]);
        return;
      }

      setLoadingSlots(true);
      try {
        const dayStart = startOfDay(selectedDate);
        const dayEnd = endOfDay(selectedDate);

        // Get blocked slots — tabela fora do schema gerado, cast explícito necessário
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: blockedData } = await (supabase as any)
          .from("scheduling_blocked_slots")
          .select("blocked_at")
          .eq("restaurant_id", restaurantId)
          .gte("blocked_at", dayStart.toISOString())
          .lte("blocked_at", dayEnd.toISOString()) as { data: { blocked_at: string }[] | null };

        const blockedTimes = new Set(
          (blockedData || []).map((b: { blocked_at: string }) => new Date(b.blocked_at).getTime())
        );

        // Get existing orders for the day
        const { data: ordersData } = await supabase
          .from("orders")
          .select("scheduled_at")
          .eq("restaurant_id", restaurantId)
          .not("scheduled_at", "is", null)
          .gte("scheduled_at", dayStart.toISOString())
          .lte("scheduled_at", dayEnd.toISOString()) as unknown as { data: { scheduled_at: string | null }[] | null };

        // Count orders per slot
        const slotCounts = new Map<number, number>();
        (ordersData || []).forEach((order) => {
          if (order.scheduled_at) {
            const time = new Date(order.scheduled_at).getTime();
            slotCounts.set(time, (slotCounts.get(time) || 0) + 1);
          }
        });

        // Generate slots based on config
        // Use America/Sao_Paulo timezone for day calculation
        const dayOfWeekInBrasilia = selectedDate.toLocaleDateString('pt-BR', {
          timeZone: 'America/Sao_Paulo',
          weekday: 'long'
        }).toLowerCase();
        
        const dayKey = dayOfWeekInBrasilia === "segunda-feira" ? "monday" :
                      dayOfWeekInBrasilia === "terça-feira" ? "tuesday" :
                      dayOfWeekInBrasilia === "quarta-feira" ? "wednesday" :
                      dayOfWeekInBrasilia === "quinta-feira" ? "thursday" :
                      dayOfWeekInBrasilia === "sexta-feira" ? "friday" :
                      dayOfWeekInBrasilia === "sábado" ? "saturday" : "sunday";

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

        const slots: Array<{ start: Date; end: Date; available: number }> = [];
        let currentStart = startTime;

        while (currentStart < endTime) {
          const currentEnd = new Date(currentStart.getTime() + intervalMinutes * 60000);
          const isBlocked = blockedTimes.has(currentStart.getTime());
          const orderCount = slotCounts.get(currentStart.getTime()) || 0;
          const available = isBlocked ? 0 : maxOrders - orderCount;

          slots.push({
            start: currentStart,
            end: currentEnd,
            available,
          });

          currentStart = currentEnd;
        }

        setAvailableSlots(slots);
      } catch (error) {
        console.error("Error loading slots:", error);
        setAvailableSlots([]);
      } finally {
        setLoadingSlots(false);
      }
    }

    loadSlots();
  }, [selectedDate, restaurantId, schedulingConfig]);

  // Build delivery fee and neighborhood for payment drawer
  const currentDeliveryFee = (freeShippingThresholdMet || hasFreeShipping)
    ? 0
    : (locationMode === "none"
      ? (restaurantData?.default_delivery_fee || 0)
      : (selectedZone?.fee || 0));

  const currentNeighborhood = locationMode === "none"
    ? (address.neighborhood || "")
    : (selectedZone?.name || "");

  // GPS — será implementado futuramente
  // const radiusStreetForOrder = ...;
  // const radiusNeighborhoodForOrder = ...;

  return (
    <>
      {/* dismissible=false: a long form is too easy to dismiss by accident with
          a drag or an outside tap — the back arrow is the only way out. */}
      <Drawer open={open} onOpenChange={onOpenChange} dismissible={false}>
        <DrawerContent hideHandle className="max-h-[85dvh] max-w-md mx-auto" onOpenAutoFocus={(e) => e.preventDefault()}>
          <DrawerHeader className="border-b border-border px-4 py-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                aria-label="Voltar"
                onClick={handleBack}
                className="p-3 -ml-3 hover:bg-muted rounded-full transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <DrawerTitle className="text-lg font-bold">Endereço</DrawerTitle>
            </div>
          </DrawerHeader>

          <div
            className="flex-1 min-h-0 overflow-y-auto overscroll-contain scroll-pt-6 scroll-pb-32 p-4 space-y-6 pb-2"
            onFocus={handleFieldFocus}
          >
            {/* Customer Info Summary */}
            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-xs text-muted-foreground mb-1">Este pedido será entregue a:</p>
              <p className="font-semibold">{customerInfo.name}</p>
              <p className="text-sm text-muted-foreground">{customerInfo.phone}</p>
            </div>

            {/* Delivery Method Selection */}
            <div id="delivery-method-section" className="space-y-3">
              <Label className="text-sm font-semibold">Como deseja receber seu pedido?</Label>

              <div className="space-y-2">
                {/* Delivery Option */}
                {(restaurantData?.delivery_available !== false) && (
                  <button
                    type="button"
                    onClick={() => {
                      setDeliveryMethod("delivery");
                      setErrors((prev) => ({ ...prev, deliveryMethod: "" }));
                      // The address form mounts below the fold — bring it into view
                      setTimeout(() => {
                        document.getElementById("delivery-method-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
                      }, 150);
                    }}
                    className={`w-full flex items-center gap-4 p-4 rounded-lg border-2 transition-all ${
                      deliveryMethod === "delivery"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-muted-foreground/50"
                    }`}
                  >
                    <div className={`p-2 rounded-full ${
                      deliveryMethod === "delivery" ? "bg-primary text-primary-foreground" : "bg-muted"
                    }`}>
                      <MapPin className="w-5 h-5" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-medium">Entrega no endereço</p>
                      <p className="text-sm text-muted-foreground">Receba em casa</p>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      deliveryMethod === "delivery" ? "border-primary" : "border-muted-foreground/50"
                    }`}>
                      {deliveryMethod === "delivery" && (
                        <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                      )}
                    </div>
                  </button>
                )}

                {/* Pickup Option */}
                {(restaurantData?.pickup_available !== false) && (
                <button
                  type="button"
                  onClick={() => {
                    setDeliveryMethod("pickup");
                    setErrors((prev) => ({ ...prev, deliveryMethod: "" }));
                  }}
                  className={`w-full flex items-start gap-4 p-4 rounded-lg border-2 transition-all ${
                    deliveryMethod === "pickup"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-muted-foreground/50"
                  }`}
                >
                  <div className={`p-2 rounded-full ${
                    deliveryMethod === "pickup" ? "bg-primary text-primary-foreground" : "bg-muted"
                  }`}>
                    <Store className="w-5 h-5" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-medium">Retirar no balcão</p>
                    <p className="text-sm text-muted-foreground">Retire na loja</p>
                    {deliveryMethod === "pickup" && (restaurantData?.address_street || restaurantData?.address) && (
                      <div className="mt-3 pt-3 border-t border-border">
                        <p className="text-xs text-muted-foreground flex items-start gap-1">
                          <span className="mt-0.5">📍</span>
                          <span>
                            {restaurantData.address_street
                              ? `${restaurantData.address_street}${restaurantData.address_number ? `, ${restaurantData.address_number}` : ""}${restaurantData.address_complement ? ` - ${restaurantData.address_complement}` : ""}${restaurantData.address_neighborhood ? `, ${restaurantData.address_neighborhood}` : ""}${restaurantData.address_city ? `, ${restaurantData.address_city}` : ""}${restaurantData.address_state ? ` - ${restaurantData.address_state}` : ""}${restaurantData.address_cep ? `, CEP ${restaurantData.address_cep}` : ""}`
                              : restaurantData?.address || "Endereço não informado"}
                          </span>
                        </p>
                        {restaurantData?.opening_time && restaurantData?.closing_time && (
                          <p className="text-xs text-muted-foreground mt-1">
                            ⏰ Horário: {restaurantData.opening_time} às {restaurantData.closing_time}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    deliveryMethod === "pickup" ? "border-primary" : "border-muted-foreground/50"
                  }`}>
                    {deliveryMethod === "pickup" && (
                      <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                    )}
                  </div>
                </button>
                )}
              </div>
              {errors.deliveryMethod && (
                <p className="text-xs text-destructive">{errors.deliveryMethod}</p>
              )}
            </div>

            {/* Scheduling Toggle */}
            {deliveryMethod && isSchedulingEnabled && (
              <div id="scheduling-section" className="space-y-4 pt-4 border-t border-border">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label className="text-sm font-semibold">Agendar para depois</Label>
                    <p className="text-xs text-muted-foreground">Escolha uma data e hora para receber seu pedido</p>
                  </div>
                  <Switch
                    checked={enableScheduling}
                    onCheckedChange={(checked) => {
                      setEnableScheduling(checked);
                      if (!checked) {
                        setSelectedDate(null);
                        setSelectedSlot(null);
                        setAvailableSlots([]);
                      }
                    }}
                  />
                </div>

                {enableScheduling && (
                  <div className="space-y-4">
                    {/* Date Selector */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Selecione a data</Label>
                      <div className="grid grid-cols-3 gap-2">
                        {[0, 1, 2, 3, 4, 5, 6].map((days) => {
                          const date = addDays(new Date(), days);
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

                          const isSelected = selectedDate && format(selectedDate, "yyyy-MM-dd") === format(date, "yyyy-MM-dd");

                          return (
                            <button
                              key={days}
                              type="button"
                              onClick={() => {
                                setSelectedDate(date);
                                setSelectedSlot(null);
                                setErrors((prev) => ({ ...prev, scheduling: "" }));
                              }}
                              className={`p-3 rounded-lg border-2 transition-all text-center ${
                                isSelected
                                  ? "border-primary bg-primary/5"
                                  : "border-border hover:border-muted-foreground/50"
                              }`}
                            >
                              <p className="text-xs text-muted-foreground capitalize">{dayOfWeek.slice(0, 3)}</p>
                              <p className="font-semibold">{format(date, "dd/MM")}</p>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Time Selector */}
                    {selectedDate && (
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Selecione o horário</Label>
                        {loadingSlots ? (
                          <div className="flex items-center justify-center p-4">
                            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                          </div>
                        ) : availableSlots.length === 0 ? (
                          <p className="text-sm text-muted-foreground">Nenhum horário disponível para esta data</p>
                        ) : (
                          <div className="grid grid-cols-3 gap-2">
                            {availableSlots.map((slot, index) => {
                              const isSelected = selectedSlot && selectedSlot.start.getTime() === slot.start.getTime();
                              const isFull = slot.available === 0;
                              const isAvailable = slot.available > 0;

                              return (
                                <button
                                  key={index}
                                  type="button"
                                  onClick={() => {
                                    if (!isAvailable) return;
                                    setSelectedSlot(slot);
                                    setErrors((prev) => ({ ...prev, scheduling: "" }));
                                  }}
                                  disabled={!isAvailable}
                                  className={`p-3 rounded-lg border-2 transition-all text-center ${
                                    isSelected
                                      ? "border-primary bg-primary/5"
                                      : isAvailable
                                        ? "border-border hover:border-muted-foreground/50"
                                        : "border-border opacity-50 cursor-not-allowed"
                                  }`}
                                >
                                  <div className="flex items-center justify-center gap-1">
                                    <Clock className="w-3 h-3 text-muted-foreground" />
                                    <p className="font-semibold text-sm">{format(slot.start, "HH:mm")}</p>
                                  </div>
                                  <p className="text-xs text-muted-foreground">
                                    {isFull ? "Cheio" : `${slot.available} disponíveis`}
                                  </p>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {errors.scheduling && (
                  <p className="text-xs text-destructive">{errors.scheduling}</p>
                )}
              </div>
            )}

            {/* Delivery Address Form */}
            {deliveryMethod === "delivery" && (
              <div className="space-y-4">
                {/* GPS/Radius mode selector — será implementado futuramente */}
                {/* {hasBothModes && ( ... )} */}

                {/* Hide form fields until a mode is chosen (only matters when both available) */}
                {locationMode && (
                  <>
                {/* ─── No Zones Mode: Simple address form ─────────────── */}
                {locationMode === "none" && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="street" className="text-sm font-medium">Rua / Avenida *</Label>
                      <Input
                        id="street"
                        type="text"
                        autoComplete="address-line1"
                        enterKeyHint="next"
                        placeholder="Nome da rua"
                        value={address.street}
                        onChange={handleInputChange("street")}
                        className={`h-12 text-base ${errors.street ? "border-destructive" : ""}`}
                      />
                      {errors.street && <p className="text-xs text-destructive">{errors.street}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="number" className="text-sm font-medium">Número *</Label>
                        <Input
                          id="number"
                          type="text"
                          enterKeyHint="next"
                          placeholder="Nº"
                          value={address.number}
                          onChange={handleInputChange("number")}
                          className={`h-12 text-base ${errors.number ? "border-destructive" : ""}`}
                        />
                        {errors.number && <p className="text-xs text-destructive">{errors.number}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="complement" className="text-sm font-medium">Complemento</Label>
                        <Input
                          id="complement"
                          type="text"
                          autoComplete="address-line2"
                          enterKeyHint="next"
                          placeholder="Apto, bloco..."
                          value={address.complement}
                          onChange={handleInputChange("complement")}
                          className="h-12 text-base"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="neighborhood" className="text-sm font-medium">Bairro</Label>
                      <Input
                        id="neighborhood"
                        type="text"
                        enterKeyHint="next"
                        placeholder="Bairro"
                        value={address.neighborhood}
                        onChange={handleInputChange("neighborhood")}
                        className="h-12 text-base"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="reference" className="text-sm font-medium">Ponto de referência</Label>
                      <Input
                        id="reference"
                        type="text"
                        enterKeyHint="done"
                        placeholder="Próximo a..."
                        value={address.reference}
                        onChange={handleInputChange("reference")}
                        className="h-12 text-base"
                      />
                    </div>
                  </>
                )}

                {/* ─── Radius Mode: GPS — será implementado futuramente ─── */}
                {/* {isRadiusMode && ( ... )} */}

                {/* ─── Zones Mode: City + Neighborhood selects ─── */}
                {locationMode === "neighborhood" && (
                  <>
                    {/* CEP Field — first and triggers auto-fill */}
                    <div id="neighborhood-cep-field" className="space-y-2">
                      <Label htmlFor="neighborhood-cep" className="text-sm font-medium">CEP *</Label>
                      <Input
                        id="neighborhood-cep"
                        type="text"
                        inputMode="numeric"
                        autoComplete="postal-code"
                        enterKeyHint="next"
                        placeholder="00000-000"
                        value={neighborhoodCep}
                        onChange={(e) => {
                          handleNeighborhoodCepChange(e.target.value);
                          setErrors((prev) => ({ ...prev, neighborhoodCep: "" }));
                        }}
                        maxLength={9}
                        className={`h-12 text-base ${errors.neighborhoodCep ? "border-destructive" : ""}`}
                      />
                      {errors.neighborhoodCep && (
                        <p className="text-xs text-destructive">{errors.neighborhoodCep}</p>
                      )}
                    </div>

                    {hasMultipleCities && (
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Cidade *</Label>
                        <div className="relative">
                          <select
                            value={selectedCity}
                            onChange={(e) => {
                              setSelectedCity(e.target.value);
                              setSelectedZoneId("");
                            }}
                            className="w-full h-12 text-base rounded-md border border-input bg-background px-3 pr-10 appearance-none focus:outline-none focus:ring-2 focus:ring-ring"
                          >
                            <option value="">Selecione sua cidade</option>
                            {cities.filter(Boolean).map((city) => (
                              <option key={city} value={city}>{city}</option>
                            ))}
                          </select>
                          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                        </div>
                      </div>
                    )}

                    <div id="zone-select-field" className="space-y-2">
                      <Label className="text-sm font-medium">Setor/Bairro *</Label>
                      <div className="relative">
                        <select
                          value={selectedZoneId}
                          onChange={(e) => {
                            setSelectedZoneId(e.target.value);
                            setErrors((prev) => ({ ...prev, neighborhood: "" }));
                          }}
                          disabled={hasMultipleCities && !selectedCity}
                          className="w-full h-12 text-base rounded-md border border-input bg-background px-3 pr-10 appearance-none focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                        >
                          <option value="">Selecione seu setor/bairro</option>
                          {availableNeighborhoods.map((zone) => (
                            <option key={zone.id} value={zone.id}>
                              {zone.name} — R$ {zone.fee.toFixed(2)}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                      </div>
                      {errors.neighborhood && (
                        <p className="text-xs text-destructive">{errors.neighborhood}</p>
                      )}
                    </div>

                    {selectedZone && (
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
                        <MapPin className="w-4 h-4 text-primary flex-shrink-0" />
                        <p className="text-sm text-muted-foreground">
                          Taxa de entrega: <span className="font-semibold text-foreground">R$ {selectedZone.fee.toFixed(2)}</span>
                          {selectedZone.estimated_time_min && (
                            <> · ~{selectedZone.estimated_time_min} min</>
                          )}
                        </p>
                      </div>
                    )}
                  </>
                )}

                {locationMode === "neighborhood" && (
                  <>
                    {/* Street Field */}
                    <div className="space-y-2">
                      <Label htmlFor="street" className="text-sm font-medium">Rua / Avenida *</Label>
                      <Input
                        id="street"
                        type="text"
                        autoComplete="address-line1"
                        enterKeyHint="next"
                        placeholder="Nome da rua"
                        value={address.street}
                        onChange={handleInputChange("street")}
                        className={`h-12 text-base ${errors.street ? "border-destructive" : ""}`}
                      />
                      {errors.street && <p className="text-xs text-destructive">{errors.street}</p>}
                    </div>

                    {/* Number and Complement Row */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="number" className="text-sm font-medium">Número *</Label>
                        <Input
                          id="number"
                          type="text"
                          enterKeyHint="next"
                          placeholder="Nº"
                          value={address.number}
                          onChange={handleInputChange("number")}
                          className={`h-12 text-base ${errors.number ? "border-destructive" : ""}`}
                        />
                        {errors.number && <p className="text-xs text-destructive">{errors.number}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="complement" className="text-sm font-medium">Complemento</Label>
                        <Input
                          id="complement"
                          type="text"
                          autoComplete="address-line2"
                          enterKeyHint="next"
                          placeholder="Apto, bloco..."
                          value={address.complement}
                          onChange={handleInputChange("complement")}
                          className="h-12 text-base"
                        />
                      </div>
                    </div>

                    {/* Reference Field */}
                    <div className="space-y-2">
                      <Label htmlFor="reference" className="text-sm font-medium">Ponto de referência</Label>
                      <Input
                        id="reference"
                        type="text"
                        enterKeyHint="done"
                        placeholder="Próximo a..."
                        value={address.reference}
                        onChange={handleInputChange("reference")}
                        className="h-12 text-base"
                      />
                    </div>
                  </>
                )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-border safe-area-bottom">
            <Button
              onClick={handleSubmit}
              className="w-full h-12 text-base font-bold bg-primary hover:bg-primary/90"
            >
            Continuar para pagamento
            </Button>
          </div>
        </DrawerContent>
      </Drawer>

      <PaymentDrawer
        open={showPaymentDrawer}
        onOpenChange={setShowPaymentDrawer}
        onBack={handlePaymentBack}
        customerInfo={customerInfo}
        deliveryMethod={deliveryMethod as "pickup" | "delivery"}
        address={
          deliveryMethod === "delivery"
            ? {
                street: address.street,
                number: address.number,
                neighborhood: currentNeighborhood,
                complement: address.complement || undefined,
                reference: address.reference || undefined,
                cep: neighborhoodCep || undefined,
              }
            : undefined
        }
        deliveryFee={deliveryMethod === "delivery" ? currentDeliveryFee : 0}
        restaurantId={restaurantId}
        restaurantSlug={restaurantSlug}
        scheduledAt={selectedSlot?.start.toISOString() || null}
        schedulingType={enableScheduling ? (deliveryMethod === "delivery" ? "delivery" : "retirada") : null}
      />
    </>
  );
}
