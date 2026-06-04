import { useState, useEffect, useMemo } from "react";
import { ArrowLeft, MapPin, Store, ChevronDown, Loader2, Radar, Navigation, Calendar, Clock } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { haversineDistanceKm } from "@/lib/haversine";
import { geocodeCep, reverseGeocode } from "@/lib/geocoding";
import { format, addDays, parse, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useCart } from "@/contexts/CartContext";
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

  // Radius mode state
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [matchedRadiusZone, setMatchedRadiusZone] = useState<DeliveryZone | null>(null);
  const [cep, setCep] = useState("");
  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState<string | null>(null);
  const [locationSource, setLocationSource] = useState<"gps" | "cep" | null>(null);
  const [resolvingAddress, setResolvingAddress] = useState(false);
  const [resolvedCity, setResolvedCity] = useState<string>("");
  const [resolvedState, setResolvedState] = useState<string>("");

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
  const [locationMode, setLocationMode] = useState<"radius" | "neighborhood" | null>(null);

  // Scheduling state
  const [schedulingConfig, setSchedulingConfig] = useState<any>(null);
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
        if (error) {
          console.error("Error loading restaurant data:", error);
        } else if (data) {
          console.log("Restaurant data loaded:", data);
          setRestaurantData(data as NonNullable<typeof restaurantData>);
        }
      })
      .finally(() => {
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

    // Load scheduling config
    supabase
      .from("scheduling_config" as any)
      .select("*")
      .eq("restaurant_id", restaurantId)
      .single()
      .then(({ data }) => {
        if (data) setSchedulingConfig(data);
      });
  }, [restaurantId]);

  // Neighborhood zones
  const neighborhoodZones = useMemo(() => zones.filter(z => z.zone_type === "neighborhood"), [zones]);
  const radiusZones = useMemo(() => zones.filter(z => z.zone_type === "radius").sort((a, b) => (a.min_radius_km || 0) - (b.min_radius_km || 0)), [zones]);

  const hasNeighborhoodZones = neighborhoodZones.length > 0;
  const hasRadiusZones = radiusZones.length > 0;
  const hasBothModes = hasNeighborhoodZones && hasRadiusZones;

  // Auto-select the only available mode; reset choice when zones change or delivery is selected
  useEffect(() => {
    if (deliveryMethod !== "delivery") {
      setLocationMode(null);
      return;
    }

    if (hasBothModes) {
      // keep whatever user picked (or null until they pick)
      return;
    }
    if (hasRadiusZones) setLocationMode("radius");
    else if (hasNeighborhoodZones) setLocationMode("neighborhood");
    else setLocationMode("none"); // No zones configured, allow delivery without zone selection
  }, [hasBothModes, hasRadiusZones, hasNeighborhoodZones, deliveryMethod]);

  const isRadiusMode = locationMode === "radius";

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

  // Geolocation for radius mode
  const requestGeolocation = () => {
    if (!navigator.geolocation) {
      setGeoError("Seu navegador não suporta geolocalização");
      return;
    }
    setGeoLoading(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLat(pos.coords.latitude);
        setUserLng(pos.coords.longitude);
        setGeoLoading(false);
        setLocationSource("gps");
      },
      (err) => {
        setGeoLoading(false);
        if (err.code === err.PERMISSION_DENIED) {
          setGeoError("Permissão de localização negada. Ative o GPS e tente novamente.");
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setGeoError("Localização indisponível. Verifique seu GPS.");
        } else {
          setGeoError("Não foi possível obter sua localização. Tente novamente.");
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  };

  const formatCep = (v: string) => {
    const n = v.replace(/\D/g, "").slice(0, 8);
    if (n.length <= 5) return n;
    return `${n.slice(0, 5)}-${n.slice(5)}`;
  };

  // Neighborhood mode: apply CEP mask only — no auto-lookup
  const handleNeighborhoodCepChange = (value: string) => {
    setNeighborhoodCep(formatCep(value));
  };

  const lookupCep = async () => {
    const clean = cep.replace(/\D/g, "");
    if (clean.length !== 8) {
      setCepError("CEP inválido");
      return;
    }
    setCepLoading(true);
    setCepError(null);
    const result = await geocodeCep(clean);
    setCepLoading(false);
    if (!result.success || !result.coordinates) {
      setCepError(result.error || "Não foi possível localizar o CEP");
      return;
    }
    setUserLat(result.coordinates.lat);
    setUserLng(result.coordinates.lng);
    if (result.address) {
      setAddress((prev) => ({
        ...prev,
        street: result.address!.street || prev.street,
        neighborhood: result.address!.neighborhood || prev.neighborhood,
      }));
      setResolvedCity(result.address.city);
      setResolvedState(result.address.state);
    }
    setLocationSource("cep");
  };

  // Calculate distance and find matching zone when GPS coordinates are available
  useEffect(() => {
    if (!isRadiusMode || userLat === null || userLng === null) return;
    if (!restaurantData?.restaurant_lat || !restaurantData?.restaurant_lng) return;

    const dist = haversineDistanceKm(
      restaurantData.restaurant_lat,
      restaurantData.restaurant_lng,
      userLat,
      userLng
    );
    setDistanceKm(dist);

    // Find matching radius zone
    const match = radiusZones.find(
      (z) => dist >= (z.min_radius_km || 0) && dist <= (z.max_radius_km || 999)
    );
    setMatchedRadiusZone(match || null);
  }, [userLat, userLng, restaurantData, radiusZones, isRadiusMode]);

  // Reverse geocode when we have coordinates, to fill street/neighborhood
  useEffect(() => {
    if (!isRadiusMode || userLat === null || userLng === null) return;
    let cancelled = false;
    setResolvingAddress(true);
    reverseGeocode(userLat, userLng).then((res) => {
      if (cancelled) return;
      setResolvingAddress(false);
      if (res.success && res.address) {
        setAddress((prev) => ({
          ...prev,
          street: prev.street || res.address!.street,
          neighborhood: prev.neighborhood || res.address!.neighborhood,
        }));
        setResolvedCity(res.address.city);
        setResolvedState(res.address.state);
      }
    });
    return () => { cancelled = true; };
  }, [userLat, userLng, isRadiusMode]);

  const radiusDeliveryFee = matchedRadiusZone
    ? matchedRadiusZone.fee
    : (restaurantData?.default_delivery_fee || 0);

  const isOutOfRange = isRadiusMode && distanceKm !== null && radiusZones.length > 0 && !matchedRadiusZone;
  const maxRadius = radiusZones.length > 0 ? Math.max(...radiusZones.map(z => z.max_radius_km || 0)) : null;

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

  const handleSubmit = () => {
    // Check minimum order for delivery
    if (deliveryMethod === "delivery" && restaurantData?.min_order && subtotal < restaurantData.min_order) {
      setErrors({ neighborhood: `Pedido mínimo para delivery: R$ ${restaurantData.min_order.toFixed(2)}` });
      return;
    }

    if (deliveryMethod === "delivery") {
      if (!locationMode) {
        setErrors({ neighborhood: "Selecione a forma de localização" });
        return;
      }
      if (!isRadiusMode && !selectedZoneId) {
        setErrors({ neighborhood: "Selecione o bairro" });
        return;
      }
      if (isRadiusMode && isOutOfRange) {
        return;
      }
      if (isRadiusMode) {
        if (address.street.trim().length < 3) {
          setErrors({ street: "Informe a rua" });
          return;
        }
        if (!address.number.trim()) {
          setErrors({ number: "Número obrigatório" });
          return;
        }
      }
      if (!isRadiusMode) {
        const result = addressSchema.safeParse(address);
        if (!result.success) {
          const fieldErrors: Record<string, string> = {};
          result.error.errors.forEach((err) => {
            const field = err.path[0] as string;
            fieldErrors[field] = err.message;
          });
          setErrors(fieldErrors);
          return;
        }
      }
    }

    setShowPaymentDrawer(true);
    onOpenChange(false);
  };

  const isPickupValid = deliveryMethod === "pickup" && (restaurantData?.pickup_available !== false) && (!enableScheduling || (selectedDate && selectedSlot));
  const isDeliveryValid = deliveryMethod === "delivery" && (restaurantData?.delivery_available !== false) && !!locationMode && (
    locationMode === "none"
      ? (address.street.length >= 3 && address.number.length >= 1)
      : isRadiusMode
        ? (userLat !== null && userLng !== null && !isOutOfRange && address.number.trim().length >= 1 && address.street.trim().length >= 3)
        : (address.street.length >= 3 && address.number.length >= 1 && !!selectedZoneId && neighborhoodCep.replace(/\D/g, "").length === 8)
  ) && (!enableScheduling || (selectedDate && selectedSlot));

  const canProceed = isPickupValid || isDeliveryValid;

  console.log("=== VALIDATION DEBUG ===");
  console.log("deliveryMethod:", deliveryMethod);
  console.log("pickup_available:", restaurantData?.pickup_available);
  console.log("delivery_available:", restaurantData?.delivery_available);
  console.log("enableScheduling:", enableScheduling);
  console.log("selectedDate:", selectedDate);
  console.log("selectedSlot:", selectedSlot);
  console.log("locationMode:", locationMode);
  console.log("isRadiusMode:", isRadiusMode);
  console.log("userLat:", userLat);
  console.log("userLng:", userLng);
  console.log("isOutOfRange:", isOutOfRange);
  console.log("address.street:", address.street);
  console.log("address.number:", address.number);
  console.log("selectedZoneId:", selectedZoneId);
  console.log("isPickupValid:", isPickupValid);
  console.log("isDeliveryValid:", isDeliveryValid);
  console.log("canProceed:", canProceed);
  const hasDeliveryOption = hasRadiusZones || hasNeighborhoodZones;

  // Reset form only when drawer closes AND payment drawer is not opening
  useEffect(() => {
    if (!open && !showPaymentDrawer) {
      setDeliveryMethod(null);
      setSelectedCity("");
      setSelectedZoneId("");
      setAddress({ street: "", number: "", complement: "", reference: "", neighborhood: "" });
      setErrors({});
      setUserLat(null);
      setUserLng(null);
      setDistanceKm(null);
      setMatchedRadiusZone(null);
      setGeoError(null);
      setCep("");
      setCepError(null);
      setLocationSource(null);
      setResolvedCity("");
      setResolvedState("");
      setResolvingAddress(false);
      setNeighborhoodCep("");
      setEnableScheduling(false);
      setSelectedDate(null);
      setSelectedSlot(null);
      setAvailableSlots([]);
      // Reset location mode only if user has a real choice; otherwise auto-select effect will refill it
      if (hasBothModes) setLocationMode(null);
    }
  }, [open, showPaymentDrawer, hasBothModes]);

  // Check if scheduling is enabled for the selected delivery method
  const isSchedulingEnabled = deliveryMethod === "delivery" 
    ? schedulingConfig?.enabled_delivery 
    : deliveryMethod === "pickup" 
      ? schedulingConfig?.enabled_pickup 
      : false;

  // Load available slots when date is selected
  useEffect(() => {
    async function loadSlots() {
      console.log("=== LOAD SLOTS START ===");
      console.log("selectedDate:", selectedDate);
      console.log("restaurantId:", restaurantId);
      console.log("schedulingConfig:", schedulingConfig);

      if (!selectedDate || !restaurantId || !schedulingConfig) {
        console.log("Missing required data, returning empty slots");
        setAvailableSlots([]);
        return;
      }

      setLoadingSlots(true);
      try {
        const dayStart = startOfDay(selectedDate);
        const dayEnd = endOfDay(selectedDate);

        console.log("dayStart:", dayStart.toISOString());
        console.log("dayEnd:", dayEnd.toISOString());

        // Get blocked slots
        const { data: blockedData } = await supabase
          .from("scheduling_blocked_slots" as any)
          .select("blocked_at")
          .eq("restaurant_id", restaurantId)
          .gte("blocked_at", dayStart.toISOString())
          .lte("blocked_at", dayEnd.toISOString());

        console.log("blockedData:", blockedData);

        const blockedTimes = new Set(
          (blockedData || []).map((b: any) => new Date(b.blocked_at).getTime())
        );

        // Get existing orders for the day
        const { data: ordersData } = await supabase
          .from("orders")
          .select("scheduled_at")
          .eq("restaurant_id", restaurantId)
          .not("scheduled_at", "is", null)
          .gte("scheduled_at", dayStart.toISOString())
          .lte("scheduled_at", dayEnd.toISOString());

        console.log("ordersData:", ordersData);

        // Count orders per slot
        const slotCounts = new Map<number, number>();
        (ordersData || []).forEach((order: any) => {
          if (order.scheduled_at) {
            const time = new Date(order.scheduled_at).getTime();
            slotCounts.set(time, (slotCounts.get(time) || 0) + 1);
          }
        });

        console.log("slotCounts:", slotCounts);

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

        console.log("dayOfWeek (pt-BR, America/Sao_Paulo):", dayOfWeekInBrasilia);
        console.log("dayKey:", dayKey);
        console.log("schedulingConfig.schedule:", schedulingConfig.schedule);

        const daySchedule = schedulingConfig.schedule?.[dayKey];

        console.log("daySchedule:", daySchedule);

        if (!daySchedule || !daySchedule.enabled) {
          console.log("Day schedule not found or not enabled");
          setAvailableSlots([]);
          setLoadingSlots(false);
          return;
        }

        const startTime = parse(daySchedule.start, "HH:mm", selectedDate);
        const endTime = parse(daySchedule.end, "HH:mm", selectedDate);
        const intervalMinutes = schedulingConfig.slot_interval_minutes || 30;
        const maxOrders = schedulingConfig.max_orders_per_slot || 5;

        console.log("startTime:", startTime);
        console.log("endTime:", endTime);
        console.log("intervalMinutes:", intervalMinutes);
        console.log("maxOrders:", maxOrders);

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

        console.log("Generated slots:", slots);
        console.log("Slots count:", slots.length);
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
      : (isRadiusMode
        ? radiusDeliveryFee
        : (selectedZone?.fee || 0)));

  const currentNeighborhood = locationMode === "none"
    ? (address.neighborhood || "")
    : isRadiusMode
      ? (address.neighborhood || (matchedRadiusZone?.name || ""))
      : (selectedZone?.name || "");

  // Build human-readable address fields for the order/admin view. Never send raw
  // coordinates as the street; the customer must confirm a written street name.
  const radiusStreetForOrder = isRadiusMode
    ? address.street.trim()
    : "";

  const radiusNeighborhoodForOrder = isRadiusMode
    ? (address.neighborhood?.trim() || resolvedCity || matchedRadiusZone?.name || "")
    : "";

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[85dvh] max-w-md mx-auto" onOpenAutoFocus={(e) => e.preventDefault()}>
          <DrawerHeader className="border-b border-border px-4 py-3">
            <div className="flex items-center gap-3">
              <button
                onClick={handleBack}
                className="p-2 -ml-2 hover:bg-muted rounded-full transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <DrawerTitle className="text-lg font-bold">Endereço</DrawerTitle>
            </div>
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-2" onFocus={(e) => {
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'SELECT') {
              setTimeout(() => target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
            }
          }}>
            {/* Customer Info Summary */}
            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-xs text-muted-foreground mb-1">Este pedido será entregue a:</p>
              <p className="font-semibold">{customerInfo.name}</p>
              <p className="text-sm text-muted-foreground">{customerInfo.phone}</p>
            </div>

            {/* Delivery Method Selection */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Como deseja receber seu pedido?</Label>
              
              <div className="space-y-2">
                {/* Delivery Option */}
                {(restaurantData?.delivery_available !== false) && (
                  <button
                    onClick={() => setDeliveryMethod("delivery")}
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
                  onClick={() => setDeliveryMethod("pickup")}
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
            </div>

            {/* Scheduling Toggle */}
            {deliveryMethod && isSchedulingEnabled && (
              <div className="space-y-4 pt-4 border-t border-border">
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
                              }}
                              className={`p-3 rounded-lg border-2 transition-all text-center ${
                                isSelected
                                  ? "border-primary bg-primary/5"
                                  : "border-border hover:border-muted-foreground/50"
                              }`}
                            >
                              <p className="text-xs text-muted-foreground">{dayOfWeek}</p>
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
                                  onClick={() => isAvailable && setSelectedSlot(slot)}
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
              </div>
            )}

            {/* Delivery Address Form */}
            {deliveryMethod === "delivery" && (
              <div className="space-y-4">
                {/* Mode selector — only when admin enabled BOTH neighborhood and radius */}
                {hasBothModes && (
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Como informar seu endereço?</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setLocationMode("neighborhood")}
                        className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-all text-left ${
                          locationMode === "neighborhood"
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-muted-foreground/50"
                        }`}
                      >
                        <MapPin className="w-4 h-4 text-primary flex-shrink-0" />
                        <span className="text-sm font-medium">Selecionar bairro</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setLocationMode("radius")}
                        className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-all text-left ${
                          locationMode === "radius"
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-muted-foreground/50"
                        }`}
                      >
                        <Radar className="w-4 h-4 text-primary flex-shrink-0" />
                        <span className="text-sm font-medium">Usar GPS</span>
                      </button>
                    </div>
                  </div>
                )}

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
                        placeholder="Próximo a..."
                        value={address.reference}
                        onChange={handleInputChange("reference")}
                        className="h-12 text-base"
                      />
                    </div>
                  </>
                )}

                {/* ─── Radius Mode: GPS ─────────────── */}
                {isRadiusMode && (
                  <>
                    {userLat === null ? (
                      <div className="space-y-3">
                        <Button
                          onClick={requestGeolocation}
                          disabled={geoLoading}
                          variant="outline"
                          className="w-full h-12 gap-2"
                        >
                          {geoLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Navigation className="w-4 h-4" />
                          )}
                          {geoLoading ? "Obtendo localização..." : "Usar minha localização"}
                        </Button>
                        {geoError && (
                          <p className="text-xs text-destructive">{geoError}</p>
                        )}
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-px bg-border" />
                          <span className="text-xs text-muted-foreground">ou informe seu CEP</span>
                          <div className="flex-1 h-px bg-border" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="cep" className="text-sm font-medium">CEP</Label>
                          <div className="flex gap-2">
                            <Input
                              id="cep"
                              type="text"
                              inputMode="numeric"
                              placeholder="00000-000"
                              value={cep}
                              onChange={(e) => { setCep(formatCep(e.target.value)); setCepError(null); }}
                              className={`h-12 text-base ${cepError ? "border-destructive" : ""}`}
                            />
                            <Button
                              onClick={lookupCep}
                              disabled={cepLoading || cep.replace(/\D/g, "").length !== 8}
                              variant="outline"
                              className="h-12 px-4"
                            >
                              {cepLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Buscar"}
                            </Button>
                          </div>
                          {cepError && <p className="text-xs text-destructive">{cepError}</p>}
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* Distance + fee info */}
                        {distanceKm !== null && !isOutOfRange && (
                          <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
                            <Radar className="w-4 h-4 text-primary flex-shrink-0" />
                            <p className="text-sm text-muted-foreground">
                              Distância: <span className="font-semibold text-foreground">{distanceKm.toFixed(1)} km</span>
                              {" · "}Taxa: <span className="font-semibold text-foreground">R$ {radiusDeliveryFee.toFixed(2)}</span>
                              {matchedRadiusZone?.estimated_time_min && (
                                <> · ~{matchedRadiusZone.estimated_time_min} min</>
                              )}
                            </p>
                          </div>
                        )}

                        {isOutOfRange && (
                          <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/5">
                            <p className="text-sm text-destructive">
                              Infelizmente você está fora da área de entrega ({distanceKm?.toFixed(1)} km).
                              {maxRadius && <> Entregamos até {maxRadius} km.</>}
                            </p>
                          </div>
                        )}

                        <Button
                          onClick={() => {
                            setUserLat(null);
                            setUserLng(null);
                            setDistanceKm(null);
                            setMatchedRadiusZone(null);
                            setLocationSource(null);
                          }}
                          variant="ghost"
                          size="sm"
                          className="gap-1.5 text-muted-foreground"
                        >
                          <Navigation className="w-3.5 h-3.5" />
                          Alterar localização
                        </Button>

                        {/* Extra address details for radius mode */}
                        {!isOutOfRange && (
                          <div className="space-y-4 pt-2 border-t border-border">
                            <p className="text-xs text-muted-foreground">
                              {resolvingAddress ? "Buscando endereço..." : "Confirme e complemente seu endereço para o entregador encontrar você:"}
                            </p>

                            <div className="space-y-2">
                              <Label htmlFor="radius-street" className="text-sm font-medium">Rua / Avenida *</Label>
                              <Input
                                id="radius-street"
                                type="text"
                                placeholder="Nome da rua"
                                value={address.street}
                                onChange={handleInputChange("street")}
                                className="h-12 text-base"
                              />
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="radius-neighborhood" className="text-sm font-medium">Bairro</Label>
                              <Input
                                id="radius-neighborhood"
                                type="text"
                                placeholder="Bairro"
                                value={address.neighborhood}
                                onChange={handleInputChange("neighborhood")}
                                className="h-12 text-base"
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-2">
                                <Label htmlFor="radius-number" className="text-sm font-medium">Número *</Label>
                                <Input
                                  id="radius-number"
                                  type="text"
                                  placeholder="Nº"
                                  value={address.number}
                                  onChange={handleInputChange("number")}
                                  className={`h-12 text-base ${errors.number ? "border-destructive" : ""}`}
                                />
                                {errors.number && <p className="text-xs text-destructive">{errors.number}</p>}
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="radius-complement" className="text-sm font-medium">Complemento</Label>
                                <Input
                                  id="radius-complement"
                                  type="text"
                                  placeholder="Apto, bloco..."
                                  value={address.complement}
                                  onChange={handleInputChange("complement")}
                                  className="h-12 text-base"
                                />
                              </div>
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="radius-reference" className="text-sm font-medium">Ponto de referência</Label>
                              <Input
                                id="radius-reference"
                                type="text"
                                placeholder="Próximo a..."
                                value={address.reference}
                                onChange={handleInputChange("reference")}
                                className="h-12 text-base"
                              />
                            </div>
                          </div>
                        )}
                      </>
                    )}

                  </>
                )}

                {/* ─── Zones Mode: City + Neighborhood selects ─── */}
                {!isRadiusMode && (
                  <>
                    {/* CEP Field — first and triggers auto-fill */}
                    <div className="space-y-2">
                      <Label htmlFor="neighborhood-cep" className="text-sm font-medium">CEP *</Label>
                      <Input
                        id="neighborhood-cep"
                        type="text"
                        inputMode="numeric"
                        placeholder="00000-000"
                        value={neighborhoodCep}
                        onChange={(e) => handleNeighborhoodCepChange(e.target.value)}
                        maxLength={9}
                        className="h-12 text-base"
                      />
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

                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Bairro *</Label>
                      <div className="relative">
                        <select
                          value={selectedZoneId}
                          onChange={(e) => setSelectedZoneId(e.target.value)}
                          disabled={hasMultipleCities && !selectedCity}
                          className="w-full h-12 text-base rounded-md border border-input bg-background px-3 pr-10 appearance-none focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                        >
                          <option value="">Selecione seu bairro</option>
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

                {!isRadiusMode && (
                  <>
                    {/* Street Field */}
                    <div className="space-y-2">
                      <Label htmlFor="street" className="text-sm font-medium">Rua / Avenida *</Label>
                      <Input
                        id="street"
                        type="text"
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
              disabled={!canProceed}
              className="w-full h-12 text-base font-bold bg-primary hover:bg-primary/90 disabled:opacity-50"
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
                street: locationMode === "none" ? address.street : (isRadiusMode ? radiusStreetForOrder : address.street),
                number: address.number,
                neighborhood: locationMode === "none" ? (address.neighborhood || "") : (isRadiusMode ? radiusNeighborhoodForOrder : currentNeighborhood),
                complement: address.complement || undefined,
                reference: address.reference || undefined,
                cep: isRadiusMode ? cep : neighborhoodCep || undefined,
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
