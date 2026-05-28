import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurantContext } from "@/contexts/RestaurantContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { getUserFriendlyError } from "@/lib/error-handler";
import { logger } from "@/lib/logger";
import { geocodeAddress } from "@/lib/geocoding";
import { playNotificationSound, SOUND_OPTIONS, NotificationSoundType } from "@/lib/notification-sound";
import {
  MapPin,
  Instagram,
  Clock,
  CreditCard,
  Store,
  Save,
  Plus,
  Trash2,
  Loader2,
  Truck,
  Volume2,
  Play,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Restaurant {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  address_cep: string | null;
  address_street: string | null;
  address_number: string | null;
  address_complement: string | null;
  address_neighborhood: string | null;
  address_city: string | null;
  address_state: string | null;
  instagram_url: string | null;
  whatsapp_phone: string | null;
  opening_time: string;
  closing_time: string;
  min_order: number;
  is_open: boolean;
  delivery_available: boolean;
  pickup_available: boolean;
  menu_theme: string;
  operation_mode: string;
  notification_sound: string;
  default_delivery_time_min: number | null;
}

interface Profile {
  subscription_status: string;
}

interface BusinessHour {
  id: string;
  restaurant_id: string;
  day_of_week: number;
  is_open: boolean;
  opening_time: string;
  closing_time: string;
  period_order: number;
  isNew?: boolean;
  toDelete?: boolean;
}

const DAYS_OF_WEEK = [
  { value: 0, label: "Domingo", short: "Dom" },
  { value: 1, label: "Segunda-feira", short: "Seg" },
  { value: 2, label: "Terça-feira", short: "Ter" },
  { value: 3, label: "Quarta-feira", short: "Qua" },
  { value: 4, label: "Quinta-feira", short: "Qui" },
  { value: 5, label: "Sexta-feira", short: "Sex" },
  { value: 6, label: "Sábado", short: "Sáb" },
];

export default function AdminBusiness() {
  const { selectedRestaurantId, selectedRestaurantIds } = useRestaurantContext();
  const ctxRestaurantId = selectedRestaurantId === "all" ? selectedRestaurantIds[0] : selectedRestaurantId;
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [businessHours, setBusinessHours] = useState<BusinessHour[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadingCep, setLoadingCep] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, [ctxRestaurantId]);

  const fetchData = async () => {
    if (!ctxRestaurantId) {
      setLoading(false);
      return;
    }
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const [restaurantRes, profileRes] = await Promise.all([
        supabase.from("restaurants").select("*").eq("id", ctxRestaurantId).maybeSingle(),
        supabase.from("profiles").select("subscription_status").eq("id", user.id).maybeSingle(),
      ]);

      if (restaurantRes.error) {
        logger.error("Error fetching restaurant:", restaurantRes.error);
      }

      if (restaurantRes.data) {
        setRestaurant(restaurantRes.data);
        
        const { data: hoursData } = await supabase
          .from("business_hours")
          .select("*")
          .eq("restaurant_id", restaurantRes.data.id)
          .order("day_of_week")
          .order("period_order");
        
        if (hoursData && hoursData.length > 0) {
          setBusinessHours(hoursData);
        }
      }
      if (profileRes.data) {
        setProfile(profileRes.data);
      }
    } catch (error) {
      logger.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const getHoursForDay = (dayOfWeek: number) => {
    return businessHours
      .filter(h => h.day_of_week === dayOfWeek && !h.toDelete)
      .sort((a, b) => a.period_order - b.period_order);
  };

  const isDayOpen = (dayOfWeek: number) => {
    const hours = getHoursForDay(dayOfWeek);
    return hours.some(h => h.is_open);
  };

  const toggleDayOpen = (dayOfWeek: number) => {
    const hours = getHoursForDay(dayOfWeek);
    const newIsOpen = !isDayOpen(dayOfWeek);
    
    setBusinessHours(prev => 
      prev.map(hour => 
        hour.day_of_week === dayOfWeek 
          ? { ...hour, is_open: newIsOpen }
          : hour
      )
    );
  };

  const updateBusinessHour = (id: string, field: keyof BusinessHour, value: string) => {
    setBusinessHours(prev => 
      prev.map(hour => 
        hour.id === id ? { ...hour, [field]: value } : hour
      )
    );
  };

  const addPeriod = (dayOfWeek: number) => {
    if (!restaurant) return;
    
    const existingPeriods = getHoursForDay(dayOfWeek);
    const maxOrder = Math.max(...existingPeriods.map(p => p.period_order), 0);
    
    const newPeriod: BusinessHour = {
      id: `new-${Date.now()}`,
      restaurant_id: restaurant.id,
      day_of_week: dayOfWeek,
      is_open: true,
      opening_time: "18:00",
      closing_time: "23:00",
      period_order: maxOrder + 1,
      isNew: true,
    };
    
    setBusinessHours(prev => [...prev, newPeriod]);
  };

  const removePeriod = (id: string, isNew?: boolean) => {
    if (isNew) {
      setBusinessHours(prev => prev.filter(h => h.id !== id));
    } else {
      setBusinessHours(prev => 
        prev.map(h => h.id === id ? { ...h, toDelete: true } : h)
      );
    }
  };

  const formatCep = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    if (numbers.length <= 5) return numbers;
    return `${numbers.slice(0, 5)}-${numbers.slice(5, 8)}`;
  };

  const handleCepChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!restaurant) return;
    const formatted = formatCep(e.target.value);
    setRestaurant({ ...restaurant, address_cep: formatted });

    // Auto-search when CEP is complete
    if (formatted.replace(/\D/g, "").length === 8) {
      await fetchAddressByCep(formatted);
    }
  };

  const fetchAddressByCep = async (cep: string) => {
    const cleanCep = cep.replace(/\D/g, "");
    if (cleanCep.length !== 8) return;

    // Validate CEP format (only digits)
    if (!/^\d{8}$/.test(cleanCep)) {
      toast({ title: "CEP inválido", variant: "destructive" });
      return;
    }

    setLoadingCep(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      if (!response.ok) {
        toast({ title: "Erro ao buscar CEP", variant: "destructive" });
        return;
      }

      const data = await response.json();
      
      // Validate response is an object and not an error
      if (!data || typeof data !== 'object' || data.erro) {
        toast({ title: "CEP não encontrado", variant: "destructive" });
        return;
      }

      // Sanitize string fields from external API
      const sanitizeString = (val: unknown, maxLength: number = 200): string => {
        if (typeof val !== 'string') return '';
        return val.trim().slice(0, maxLength);
      };

      setRestaurant(prev => prev ? {
        ...prev,
        address_street: sanitizeString(data.logradouro) || prev.address_street,
        address_neighborhood: sanitizeString(data.bairro) || prev.address_neighborhood,
        address_city: sanitizeString(data.localidade) || prev.address_city,
        address_state: sanitizeString(data.uf, 2) || prev.address_state,
      } : null);
    } catch (error) {
      toast({ title: "Erro ao buscar CEP", variant: "destructive" });
    } finally {
      setLoadingCep(false);
    }
  };

  const buildFullAddress = () => {
    if (!restaurant) return "";
    const parts = [
      restaurant.address_street,
      restaurant.address_number,
      restaurant.address_neighborhood,
      restaurant.address_city,
      restaurant.address_state,
    ].filter(Boolean);
    return parts.join(", ");
  };

  const handleSave = async () => {
    if (!restaurant) return;

    // Validate required fields
    if (restaurant.address_cep && !restaurant.address_number?.trim()) {
      toast({ 
        title: "Número obrigatório", 
        description: "Preencha o número do endereço para salvar",
        variant: "destructive" 
      });
      return;
    }

    // Validate slug
    if (!restaurant.slug || restaurant.slug.trim().length < 3) {
      toast({ 
        title: "Link inválido", 
        description: "O link do cardápio deve ter pelo menos 3 caracteres",
        variant: "destructive" 
      });
      return;
    }

    setSaving(true);

    // Build full address from components
    const fullAddress = buildFullAddress();

    try {
      // Check if slug is already in use by another restaurant
      const { data: existingSlug, error: slugCheckError } = await supabase
        .from("restaurants")
        .select("id")
        .eq("slug", restaurant.slug)
        .neq("id", restaurant.id)
        .maybeSingle();

      if (slugCheckError) {
        logger.error("Error checking slug:", slugCheckError);
      }

      if (existingSlug) {
        toast({ 
          title: "Link já está em uso", 
          description: "Este link de cardápio já está sendo usado por outro restaurante. Escolha outro.",
          variant: "destructive" 
        });
        setSaving(false);
        return;
      }

      // Auto-geocode if we have a complete address
      let lat = null;
      let lng = null;
      if (fullAddress) {
        const geoResult = await geocodeAddress(fullAddress);
        if (geoResult.success && geoResult.coordinates) {
          lat = geoResult.coordinates.lat;
          lng = geoResult.coordinates.lng;
        }
      }

      // Save restaurant info (excluding is_open - that's controlled by the header toggle)
      const { error: restaurantError } = await supabase
        .from("restaurants")
        .update({
          name: restaurant.name,
          slug: restaurant.slug,
          address: fullAddress || restaurant.address,
          address_cep: restaurant.address_cep,
          address_street: restaurant.address_street,
          address_number: restaurant.address_number,
          address_complement: restaurant.address_complement,
          address_neighborhood: restaurant.address_neighborhood,
          address_city: restaurant.address_city,
          address_state: restaurant.address_state,
          instagram_url: restaurant.instagram_url,
          whatsapp_phone: restaurant.whatsapp_phone,
          opening_time: restaurant.opening_time,
          closing_time: restaurant.closing_time,
          min_order: restaurant.min_order,
          delivery_available: restaurant.delivery_available,
          pickup_available: restaurant.pickup_available,
          menu_theme: restaurant.menu_theme,
          operation_mode: restaurant.operation_mode,
          notification_sound: restaurant.notification_sound,
          default_delivery_time_min: restaurant.default_delivery_time_min,
          ...(lat && lng ? { restaurant_lat: lat, restaurant_lng: lng } : {}),
        } as any)
        .eq("id", restaurant.id);

      if (restaurantError) throw restaurantError;

      // Delete marked hours
      const toDelete = businessHours.filter(h => h.toDelete && !h.isNew);
      for (const hour of toDelete) {
        await supabase.from("business_hours").delete().eq("id", hour.id);
      }

      // Insert new hours
      const newHours = businessHours.filter(h => h.isNew && !h.toDelete);
      for (const hour of newHours) {
        const { error } = await supabase.from("business_hours").insert({
          restaurant_id: hour.restaurant_id,
          day_of_week: hour.day_of_week,
          is_open: hour.is_open,
          opening_time: hour.opening_time,
          closing_time: hour.closing_time,
          period_order: hour.period_order,
        });
        if (error) throw error;
      }

      // Update existing hours
      const existingHours = businessHours.filter(h => !h.isNew && !h.toDelete);
      for (const hour of existingHours) {
        const { error } = await supabase
          .from("business_hours")
          .update({
            is_open: hour.is_open,
            opening_time: hour.opening_time,
            closing_time: hour.closing_time,
            period_order: hour.period_order,
          })
          .eq("id", hour.id);
        if (error) throw error;
      }

      toast({ title: "Configurações salvas com sucesso!" });
      fetchData(); // Refresh to get proper IDs
    } catch (error) {
      logger.error("Error saving:", error);
      toast({
        title: "Erro ao salvar",
        description: getUserFriendlyError(error),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Restaurante não encontrado</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 md:space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Meu Negócio</h1>
          <p className="text-muted-foreground">
            Configure as informações do seu restaurante
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          {saving ? "Salvando..." : "Salvar"}
        </Button>
      </div>

      <div className="grid gap-3 md:gap-6 lg:grid-cols-2">
        {/* Basic Info - tall card, spans 2 rows on right column's worth */}
        <Card className="lg:row-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Store className="w-5 h-5" />
              Informações Básicas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Nome do restaurante</Label>
              <Input
                value={restaurant.name}
                onChange={(e) =>
                  setRestaurant({ ...restaurant, name: e.target.value })
                }
                placeholder="Nome do seu restaurante"
              />
            </div>
            
            {/* Slug Field */}
            <div className="space-y-2">
              <Label>Link do cardápio</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground whitespace-nowrap">
                  menufly.com.br/
                </span>
                <Input
                  value={restaurant.slug}
                  onChange={(e) => {
                    // Only allow lowercase letters, numbers, and hyphens
                    const value = e.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9-]/g, '-')
                      .replace(/-+/g, '-')
                      .replace(/^-/, '');
                    setRestaurant({ ...restaurant, slug: value });
                  }}
                  placeholder="meu-restaurante"
                  className="flex-1"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Este é o link que seus clientes usarão para acessar seu cardápio
              </p>
            </div>
            {/* CEP Field */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                CEP
              </Label>
              <div className="relative">
                <Input
                  value={restaurant.address_cep || ""}
                  onChange={handleCepChange}
                  placeholder="00000-000"
                  maxLength={9}
                  className="pr-10"
                />
                {loadingCep && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
                )}
              </div>
            </div>

            {/* Street Field */}
            <div className="space-y-2">
              <Label>Rua / Avenida</Label>
              <Input
                value={restaurant.address_street || ""}
                onChange={(e) =>
                  setRestaurant({ ...restaurant, address_street: e.target.value })
                }
                placeholder="Nome da rua"
                className={restaurant.address_street ? "bg-muted/50" : ""}
                readOnly={!!restaurant.address_street && loadingCep}
              />
            </div>

            {/* Number and Complement */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Número *</Label>
                <Input
                  value={restaurant.address_number || ""}
                  onChange={(e) =>
                    setRestaurant({ ...restaurant, address_number: e.target.value })
                  }
                  placeholder="Nº"
                />
              </div>
              <div className="space-y-2">
                <Label>Complemento</Label>
                <Input
                  value={restaurant.address_complement || ""}
                  onChange={(e) =>
                    setRestaurant({ ...restaurant, address_complement: e.target.value })
                  }
                  placeholder="Sala, bloco..."
                />
              </div>
            </div>

            {/* Neighborhood Field */}
            <div className="space-y-2">
              <Label>Bairro</Label>
              <Input
                value={restaurant.address_neighborhood || ""}
                onChange={(e) =>
                  setRestaurant({ ...restaurant, address_neighborhood: e.target.value })
                }
                placeholder="Nome do bairro"
                className={restaurant.address_neighborhood ? "bg-muted/50" : ""}
              />
            </div>

            {/* City and State */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2 col-span-2">
                <Label>Cidade</Label>
                <Input
                  value={restaurant.address_city || ""}
                  onChange={(e) =>
                    setRestaurant({ ...restaurant, address_city: e.target.value })
                  }
                  placeholder="Cidade"
                  className={restaurant.address_city ? "bg-muted/50" : ""}
                />
              </div>
              <div className="space-y-2">
                <Label>Estado</Label>
                <Input
                  value={restaurant.address_state || ""}
                  onChange={(e) =>
                    setRestaurant({ ...restaurant, address_state: e.target.value })
                  }
                  placeholder="UF"
                  maxLength={2}
                  className={restaurant.address_state ? "bg-muted/50" : ""}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Instagram className="w-4 h-4" />
                Instagram
              </Label>
              <Input
                value={restaurant.instagram_url || ""}
                onChange={(e) =>
                  setRestaurant({ ...restaurant, instagram_url: e.target.value })
                }
                placeholder="https://instagram.com/seurestaurante"
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                📱 WhatsApp do Restaurante
              </Label>
              <Input
                value={restaurant.whatsapp_phone || ""}
                onChange={(e) =>
                  setRestaurant({ ...restaurant, whatsapp_phone: e.target.value })
                }
                placeholder="5511999999999"
              />
              <p className="text-xs text-muted-foreground">
                Número com DDD usado para o cliente entrar em contato (ex: 5511999999999)
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Operation Mode */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Store className="w-5 h-5" />
              Modo de Operação
            </CardTitle>
            <CardDescription>
              Defina como o restaurante abre e fecha
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                onClick={() => setRestaurant({ ...restaurant, operation_mode: 'automatic' })}
                className={`relative p-4 rounded-xl border-2 transition-all text-left ${
                  restaurant.operation_mode === 'automatic'
                    ? 'border-primary bg-primary/10'
                    : 'border-muted hover:border-muted-foreground/50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold">Automático</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Abre e fecha conforme os horários definidos. Você ainda pode abrir/fechar manualmente e o sistema respeitará sua decisão.
                    </p>
                  </div>
                </div>
                {restaurant.operation_mode === 'automatic' && (
                  <div className="absolute top-2 right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                    <span className="text-xs text-primary-foreground">✓</span>
                  </div>
                )}
              </button>

              <button
                onClick={() => setRestaurant({ ...restaurant, operation_mode: 'manual' })}
                className={`relative p-4 rounded-xl border-2 transition-all text-left ${
                  restaurant.operation_mode === 'manual'
                    ? 'border-primary bg-primary/10'
                    : 'border-muted hover:border-muted-foreground/50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <Store className="w-5 h-5 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold">Manual</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      O cardápio só abre quando você ativar manualmente. Horários de funcionamento são ignorados.
                    </p>
                  </div>
                </div>
                {restaurant.operation_mode === 'manual' && (
                  <div className="absolute top-2 right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                    <span className="text-xs text-primary-foreground">✓</span>
                  </div>
                )}
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Status & Delivery */}
        <Card>
          <CardHeader>
            <CardTitle>Status e Entrega</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div>
                <p className="font-medium">Restaurante aberto agora?</p>
                <p className="text-sm text-muted-foreground">
                  {restaurant.operation_mode === 'manual' 
                    ? 'Modo manual — controle total por você' 
                    : 'Modo automático — controlado pelos horários'}
                </p>
              </div>
              <Switch
                checked={restaurant.is_open}
                onCheckedChange={async (checked) => {
                  setRestaurant({ ...restaurant, is_open: checked });
                  
                  // In manual mode, no override needed. In automatic, set smart override.
                  let overrideUntil: string | null = null;
                  if (restaurant.operation_mode === 'automatic' && checked) {
                    // Find next closing time from business hours
                    const now = new Date();
                    const currentDay = now.getDay();
                    const currentMinutes = now.getHours() * 60 + now.getMinutes();
                    
                    // Check today's remaining closing times
                    const todayHours = businessHours
                      .filter(h => h.day_of_week === currentDay && h.is_open)
                      .sort((a, b) => {
                        const [aH, aM] = a.closing_time.split(':').map(Number);
                        const [bH, bM] = b.closing_time.split(':').map(Number);
                        return (aH * 60 + aM) - (bH * 60 + bM);
                      });
                    
                    let foundClose = false;
                    for (const period of todayHours) {
                      const [cH, cM] = period.closing_time.split(':').map(Number);
                      const closeMin = cH * 60 + cM;
                      if (closeMin > currentMinutes) {
                        // Set override until this closing time today
                        const closeDate = new Date(now);
                        closeDate.setHours(cH, cM, 0, 0);
                        overrideUntil = closeDate.toISOString();
                        foundClose = true;
                        break;
                      }
                    }
                    
                    if (!foundClose) {
                      // No closing time today, check tomorrow
                      for (let i = 1; i <= 7; i++) {
                        const checkDay = (currentDay + i) % 7;
                        const dayHrs = businessHours
                          .filter(h => h.day_of_week === checkDay && h.is_open)
                          .sort((a, b) => {
                            const [aH, aM] = a.closing_time.split(':').map(Number);
                            const [bH, bM] = b.closing_time.split(':').map(Number);
                            return (bH * 60 + bM) - (aH * 60 + aM); // last closing time
                          });
                        if (dayHrs.length > 0) {
                          const lastPeriod = dayHrs[0];
                          const [cH, cM] = lastPeriod.closing_time.split(':').map(Number);
                          const closeDate = new Date(now);
                          closeDate.setDate(closeDate.getDate() + i);
                          closeDate.setHours(cH, cM, 0, 0);
                          overrideUntil = closeDate.toISOString();
                          break;
                        }
                      }
                    }
                    
                    // Fallback: 12 hours if no business hours found
                    if (!overrideUntil) {
                      overrideUntil = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
                    }
                  }
                  
                  const { error } = await supabase
                    .from("restaurants")
                    .update({ 
                      is_open: checked, 
                      manual_override_until: overrideUntil 
                    } as any)
                    .eq("id", restaurant.id);
                  
                  if (error) {
                    toast({
                      title: "Erro ao atualizar status",
                      variant: "destructive",
                    });
                    setRestaurant({ ...restaurant, is_open: !checked });
                  } else {
                    toast({
                      title: checked ? "🟢 Delivery aberto!" : "🔴 Delivery fechado",
                      description: checked 
                        ? "Você está recebendo pedidos" 
                        : "Você não está mais recebendo pedidos",
                    });
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>Pedido mínimo (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={restaurant.min_order}
                onChange={(e) =>
                  setRestaurant({
                    ...restaurant,
                    min_order: parseFloat(e.target.value) || 0,
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Truck className="w-4 h-4" />
                Tempo estimado de entrega (minutos)
              </Label>
              <Input
                type="number"
                min="1"
                max="180"
                value={restaurant.default_delivery_time_min ?? ""}
                onChange={(e) =>
                  setRestaurant({
                    ...restaurant,
                    default_delivery_time_min: e.target.value ? parseInt(e.target.value) : null,
                  })
                }
                placeholder="Ex: 45"
              />
              <p className="text-xs text-muted-foreground">
                Este tempo será exibido ao cliente na tela de acompanhamento do pedido
              </p>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Delivery</p>
                <p className="text-sm text-muted-foreground">
                  Entrega no endereço do cliente
                </p>
              </div>
              <Switch
                checked={restaurant.delivery_available}
                onCheckedChange={(checked) =>
                  setRestaurant({ ...restaurant, delivery_available: checked })
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Retirada</p>
                <p className="text-sm text-muted-foreground">
                  Cliente retira no local
                </p>
              </div>
              <Switch
                checked={restaurant.pickup_available}
                onCheckedChange={(checked) =>
                  setRestaurant({ ...restaurant, pickup_available: checked })
                }
              />
            </div>
          </CardContent>
        </Card>


        {/* Notification Sound */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Volume2 className="w-5 h-5" />
              Som de Notificação
            </CardTitle>
            <CardDescription>
              Escolha o som que toca ao receber um novo pedido
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {SOUND_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setRestaurant({ ...restaurant, notification_sound: option.value })}
                className={`relative w-full p-4 rounded-xl border-2 transition-all text-left flex items-center gap-4 ${
                  restaurant.notification_sound === option.value
                    ? 'border-primary bg-primary/10'
                    : 'border-muted hover:border-muted-foreground/50'
                }`}
              >
                <div className="flex-1">
                  <p className="font-semibold">{option.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{option.description}</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0 h-9 w-9"
                  onClick={(e) => {
                    e.stopPropagation();
                    playNotificationSound(option.value);
                  }}
                >
                  <Play className="w-4 h-4" />
                </Button>
                {restaurant.notification_sound === option.value && (
                  <div className="absolute top-2 right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                    <span className="text-xs text-primary-foreground">✓</span>
                  </div>
                )}
              </button>
            ))}
          </CardContent>
        </Card>

        {/* Business Hours */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Horário de Atendimento por Dia
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {DAYS_OF_WEEK.map((day) => {
                const dayHours = getHoursForDay(day.value);
                const isOpen = isDayOpen(day.value);

                return (
                  <div 
                    key={day.value} 
                    className={`p-4 rounded-lg border transition-colors ${
                      isOpen ? 'bg-card' : 'bg-muted/50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <Switch
                          checked={isOpen}
                          onCheckedChange={() => toggleDayOpen(day.value)}
                        />
                        <span className={`font-medium ${!isOpen ? 'text-muted-foreground' : ''}`}>
                          {day.label}
                        </span>
                      </div>
                      
                      {isOpen && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => addPeriod(day.value)}
                          className="gap-1"
                        >
                          <Plus className="w-4 h-4" />
                          Período
                        </Button>
                      )}
                    </div>
                    
                    {isOpen ? (
                      <div className="space-y-2 ml-0 md:ml-12">
                        {dayHours.map((hour, index) => (
                          <div key={hour.id} className="flex items-center gap-1.5 md:gap-2 flex-wrap md:flex-nowrap">
                            <span className="text-xs md:text-sm text-muted-foreground w-16 md:w-20 shrink-0">
                              {index === 0 ? "Período 1:" : `Período ${index + 1}:`}
                            </span>
                            <Input
                              type="time"
                              value={hour.opening_time}
                              onChange={(e) => 
                                updateBusinessHour(hour.id, 'opening_time', e.target.value)
                              }
                              className="w-24 md:w-28"
                            />
                            <span className="text-muted-foreground text-xs">às</span>
                            <Input
                              type="time"
                              value={hour.closing_time}
                              onChange={(e) => 
                                updateBusinessHour(hour.id, 'closing_time', e.target.value)
                              }
                              className="w-24 md:w-28"
                            />
                            {dayHours.length > 1 && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive shrink-0"
                                onClick={() => removePeriod(hour.id, hour.isNew)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="ml-12">
                        <Badge variant="secondary" className="text-muted-foreground">
                          Fechado
                        </Badge>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Subscription */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Minha Assinatura
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div>
                <p className="font-medium">Status atual</p>
                <Badge
                  variant={
                    profile?.subscription_status === "active"
                      ? "default"
                      : "secondary"
                  }
                  className="mt-1"
                >
                  {profile?.subscription_status === "active"
                    ? "Ativo"
                    : profile?.subscription_status === "trial"
                    ? "Período de teste"
                    : "Inativo"}
                </Badge>
              </div>
              <Button variant="outline">Gerenciar</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
