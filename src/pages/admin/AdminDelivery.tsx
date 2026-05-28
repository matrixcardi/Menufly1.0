import { useEffect, useState, useCallback } from "react";
import { useRestaurantContext } from "@/contexts/RestaurantContext";
import { supabase } from "@/integrations/supabase/client";
import { geocodeCep } from "@/lib/geocoding";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, MapPin, Clock, Save, Loader2, Pencil, Radar, Map } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";


interface DeliveryZone {
  id: string;
  zone_type: "neighborhood" | "radius";
  name: string;
  city: string | null;
  fee: number;
  min_radius_km: number | null;
  max_radius_km: number | null;
  estimated_time_min: number | null;
  is_active: boolean;
}

interface Restaurant {
  id: string;
  address: string | null;
  delivery_mode: "zones" | "radius";
  default_delivery_time_min: number | null;
  default_delivery_fee: number;
  restaurant_lat: number | null;
  restaurant_lng: number | null;
  address_cep: string | null;
  address_street: string | null;
  address_number: string | null;
  address_complement: string | null;
  address_neighborhood: string | null;
  address_city: string | null;
  address_state: string | null;
}

export default function AdminDelivery() {
  const { selectedRestaurantId, selectedRestaurantIds } = useRestaurantContext();
  const ctxRestaurantId = selectedRestaurantId === "all" ? selectedRestaurantIds[0] : selectedRestaurantId;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  
  const [defaultTime, setDefaultTime] = useState<string>("");
  const [defaultFee, setDefaultFee] = useState<string>("");
  const [deliveryMode, setDeliveryMode] = useState<"zones" | "radius">("zones");
  const [dialogOpen, setDialogOpen] = useState(false);

  // Address fields for radius mode
  const [addrCep, setAddrCep] = useState("");
  const [addrStreet, setAddrStreet] = useState("");
  const [addrNumber, setAddrNumber] = useState("");
  const [addrComplement, setAddrComplement] = useState("");
  const [addrNeighborhood, setAddrNeighborhood] = useState("");
  const [addrCity, setAddrCity] = useState("");
  const [addrState, setAddrState] = useState("");
  const [gpsLat, setGpsLat] = useState("");
  const [gpsLng, setGpsLng] = useState("");
  const [geocoding, setGeocoding] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [editingZone, setEditingZone] = useState<DeliveryZone | null>(null);
  const [editingCity, setEditingCity] = useState<string | null>(null);
  const [newCityName, setNewCityName] = useState("");

  // Multi-select state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkFee, setBulkFee] = useState("");
  const [bulkTime, setBulkTime] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);
  
  // Form state for new/edit zone
  const [zoneCity, setZoneCity] = useState("");
  const [zoneName, setZoneName] = useState("");
  const [zoneFee, setZoneFee] = useState("");
  const [zoneMinRadius, setZoneMinRadius] = useState("");
  const [zoneMaxRadius, setZoneMaxRadius] = useState("");
  const [zoneTime, setZoneTime] = useState("");
  
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, [ctxRestaurantId]);

  async function fetchData() {
    setLoading(true);
    
    if (!ctxRestaurantId) {
      setLoading(false);
      return;
    }

    const { data: restaurantData } = await supabase
      .from("restaurants")
      .select("id, address, delivery_mode, default_delivery_time_min, default_delivery_fee, restaurant_lat, restaurant_lng, address_cep, address_street, address_number, address_complement, address_neighborhood, address_city, address_state")
      .eq("id", ctxRestaurantId)
      .maybeSingle();

    if (restaurantData) {
      const r = restaurantData as Restaurant;
      setRestaurant(r);
      setDeliveryMode(r.delivery_mode || "zones");
      setDefaultTime(r.default_delivery_time_min?.toString() || "");
      setDefaultFee(r.default_delivery_fee?.toString() || "0");
      setAddrCep(r.address_cep || "");
      setAddrStreet(r.address_street || "");
      setAddrNumber(r.address_number || "");
      setAddrComplement(r.address_complement || "");
      setAddrNeighborhood(r.address_neighborhood || "");
      setAddrCity(r.address_city || "");
      setAddrState(r.address_state || "");
      setGpsLat(r.restaurant_lat?.toString() || "");
      setGpsLng(r.restaurant_lng?.toString() || "");

      const { data: zonesData } = await supabase
        .from("delivery_zones")
        .select("*")
        .eq("restaurant_id", r.id)
        .order("name");

      if (zonesData) {
        setZones(zonesData as DeliveryZone[]);
      }
    }

    setLoading(false);
  }

  async function handleModeChange(mode: "zones" | "radius") {
    if (mode === deliveryMode) return;
    setDeliveryMode(mode);
    if (!restaurant) return;
    const { error } = await supabase
      .from("restaurants")
      .update({ delivery_mode: mode })
      .eq("id", restaurant.id);
    if (error) {
      toast({ title: "Erro ao salvar modo", description: error.message, variant: "destructive" });
      setDeliveryMode(deliveryMode); // revert
    } else {
      toast({ title: mode === "radius" ? "Modo raio ativado!" : "Modo bairros ativado!" });
      setRestaurant(prev => prev ? { ...prev, delivery_mode: mode } : prev);
    }
  }

  async function saveSettings() {
    if (!restaurant) return;
    setSaving(true);

    const { error } = await supabase
      .from("restaurants")
      .update({
        delivery_mode: deliveryMode,
        default_delivery_time_min: defaultTime ? parseInt(defaultTime) : null,
        default_delivery_fee: defaultFee ? parseFloat(defaultFee) : 0,
      })
      .eq("id", restaurant.id);

    setSaving(false);

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Configurações salvas!" });
      setRestaurant(prev => prev ? { ...prev, delivery_mode: deliveryMode } : prev);
    }
  }

  async function handleCepLookup() {
    const cleanCep = addrCep.replace(/\D/g, "");
    if (cleanCep.length !== 8) return;
    setGeocoding(true);
    try {
      const viaCepRes = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const viaCepData = await viaCepRes.json();
      if (!viaCepData.erro) {
        setAddrStreet(viaCepData.logradouro || "");
        setAddrNeighborhood(viaCepData.bairro || "");
        setAddrCity(viaCepData.localidade || "");
        setAddrState(viaCepData.uf || "");
      }
      const geoResult = await geocodeCep(cleanCep);
      if (geoResult.success && geoResult.coordinates) {
        setGpsLat(geoResult.coordinates.lat.toString());
        setGpsLng(geoResult.coordinates.lng.toString());
        toast({ title: "Coordenadas encontradas!" });
      } else {
        toast({ title: "CEP encontrado, mas não foi possível obter coordenadas", description: "Insira latitude e longitude manualmente.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Erro ao buscar CEP", variant: "destructive" });
    }
    setGeocoding(false);
  }

  async function saveAddress() {
    if (!restaurant) return;
    setSavingAddress(true);
    const fullAddress = [addrStreet, addrNumber, addrNeighborhood, addrCity, addrState].filter(Boolean).join(", ");
    const { error } = await supabase
      .from("restaurants")
      .update({
        address_cep: addrCep || null,
        address_street: addrStreet || null,
        address_number: addrNumber || null,
        address_complement: addrComplement || null,
        address_neighborhood: addrNeighborhood || null,
        address_city: addrCity || null,
        address_state: addrState || null,
        address: fullAddress || null,
        restaurant_lat: gpsLat ? parseFloat(gpsLat) : null,
        restaurant_lng: gpsLng ? parseFloat(gpsLng) : null,
      })
      .eq("id", restaurant.id);
    setSavingAddress(false);
    if (error) {
      toast({ title: "Erro ao salvar endereço", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Endereço salvo com sucesso!" });
      setRestaurant(prev => prev ? { ...prev, restaurant_lat: gpsLat ? parseFloat(gpsLat) : null, restaurant_lng: gpsLng ? parseFloat(gpsLng) : null } : prev);
    }
  }

  function openAddDialog() {
    setEditingZone(null);
    setZoneCity("");
    setZoneName("");
    setZoneFee("");
    setZoneMinRadius("");
    setZoneMaxRadius("");
    setZoneTime("");
    setDialogOpen(true);
  }

  function openEditDialog(zone: DeliveryZone) {
    setEditingZone(zone);
    setZoneCity(zone.city || "");
    setZoneName(zone.name);
    setZoneFee(zone.fee.toString());
    setZoneMinRadius(zone.min_radius_km?.toString() || "");
    setZoneMaxRadius(zone.max_radius_km?.toString() || "");
    setZoneTime(zone.estimated_time_min?.toString() || "");
    setDialogOpen(true);
  }

  function parseBulkNames(input: string): string[] {
    return input.split(/[,\n]/).map(n => n.trim()).filter(n => n.length > 0);
  }

  const bulkCount = editingZone ? 0 : parseBulkNames(zoneName).length;

  async function saveZone() {
    if (!restaurant) return;

    // Validation differs by mode
    if (deliveryMode === "radius") {
      if (!zoneName || !zoneFee || !zoneMaxRadius) {
        toast({ title: "Preencha nome, raio máximo e taxa", variant: "destructive" });
        return;
      }
    } else {
      if (!zoneName || !zoneFee) {
        toast({ title: "Preencha os campos obrigatórios", variant: "destructive" });
        return;
      }
    }

    setSaving(true);

    if (deliveryMode === "radius") {
      // Radius zone save
      const zoneData = {
        restaurant_id: restaurant.id,
        zone_type: "radius" as const,
        name: zoneName.trim(),
        city: null,
        fee: parseFloat(zoneFee),
        min_radius_km: zoneMinRadius ? parseFloat(zoneMinRadius) : 0,
        max_radius_km: parseFloat(zoneMaxRadius),
        estimated_time_min: zoneTime ? parseInt(zoneTime) : null,
      };

      if (editingZone) {
        const { error } = await supabase.from("delivery_zones").update(zoneData).eq("id", editingZone.id);
        if (error) toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
        else toast({ title: "Faixa atualizada!" });
      } else {
        const { error } = await supabase.from("delivery_zones").insert(zoneData);
        if (error) toast({ title: "Erro ao criar", description: error.message, variant: "destructive" });
        else toast({ title: "Faixa adicionada!" });
      }
    } else {
      // Neighborhood zone save
      if (editingZone) {
        const zoneData = {
          restaurant_id: restaurant.id,
          zone_type: "neighborhood" as const,
          name: zoneName.trim(),
          city: zoneCity || null,
          fee: parseFloat(zoneFee),
          min_radius_km: null,
          max_radius_km: null,
          estimated_time_min: zoneTime ? parseInt(zoneTime) : null,
        };
        const { error } = await supabase.from("delivery_zones").update(zoneData).eq("id", editingZone.id);
        if (error) toast({ title: "Erro ao salvar zona", description: error.message, variant: "destructive" });
        else toast({ title: "Zona atualizada!" });
      } else {
        const names = parseBulkNames(zoneName);
        const rows = names.map(name => ({
          restaurant_id: restaurant.id,
          zone_type: "neighborhood" as const,
          name,
          city: zoneCity || null,
          fee: parseFloat(zoneFee),
          min_radius_km: null,
          max_radius_km: null,
          estimated_time_min: zoneTime ? parseInt(zoneTime) : null,
        }));
        const { error } = await supabase.from("delivery_zones").insert(rows);
        if (error) toast({ title: "Erro ao salvar zonas", description: error.message, variant: "destructive" });
        else toast({ title: `${names.length} bairro(s) adicionado(s)!` });
      }
    }

    setSaving(false);
    setDialogOpen(false);
    fetchData();
  }

  async function toggleZoneActive(zone: DeliveryZone) {
    const { error } = await supabase.from("delivery_zones").update({ is_active: !zone.is_active }).eq("id", zone.id);
    if (error) toast({ title: "Erro ao atualizar", variant: "destructive" });
    else fetchData();
  }

  async function renameCityZones(oldCity: string, newCity: string) {
    if (!restaurant || !newCity.trim()) return;
    setSaving(true);
    const zoneIds = zones.filter(z => (z.city || "Sem cidade") === oldCity).map(z => z.id);
    const { error } = await supabase.from("delivery_zones").update({ city: newCity.trim() }).in("id", zoneIds);
    setSaving(false);
    setEditingCity(null);
    if (error) toast({ title: "Erro ao renomear cidade", description: error.message, variant: "destructive" });
    else { toast({ title: "Cidade renomeada!" }); fetchData(); }
  }

  async function deleteZone(zone: DeliveryZone) {
    const { error } = await supabase.from("delivery_zones").delete().eq("id", zone.id);
    if (error) toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    else { toast({ title: "Zona excluída!" }); fetchData(); }
  }

  // Multi-select
  function toggleSelect(id: string) {
    setSelectedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }

  function toggleSelectAll() {
    if (selectedIds.size === currentFilteredZones.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(currentFilteredZones.map(z => z.id)));
  }

  function toggleSelectCity(cityZones: DeliveryZone[]) {
    const allSelected = cityZones.every(z => selectedIds.has(z.id));
    setSelectedIds(prev => { const next = new Set(prev); cityZones.forEach(z => allSelected ? next.delete(z.id) : next.add(z.id)); return next; });
  }

  async function bulkEdit() {
    if (selectedIds.size === 0) return;
    setBulkSaving(true);
    const updates: Record<string, any> = {};
    if (bulkFee !== "") updates.fee = parseFloat(bulkFee);
    if (bulkTime !== "") updates.estimated_time_min = bulkTime ? parseInt(bulkTime) : null;
    if (Object.keys(updates).length === 0) { toast({ title: "Preencha ao menos um campo", variant: "destructive" }); setBulkSaving(false); return; }
    const { error } = await supabase.from("delivery_zones").update(updates).in("id", Array.from(selectedIds));
    setBulkSaving(false);
    setBulkEditOpen(false);
    if (error) toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
    else { toast({ title: `${selectedIds.size} zona(s) atualizada(s)!` }); setSelectedIds(new Set()); setBulkFee(""); setBulkTime(""); fetchData(); }
  }

  async function bulkDelete() {
    if (selectedIds.size === 0) return;
    if (!confirm(`Excluir ${selectedIds.size} zona(s)?`)) return;
    const { error } = await supabase.from("delivery_zones").delete().in("id", Array.from(selectedIds));
    if (error) toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    else { toast({ title: `${selectedIds.size} zona(s) excluída(s)!` }); setSelectedIds(new Set()); fetchData(); }
  }

  async function bulkToggleActive(active: boolean) {
    if (selectedIds.size === 0) return;
    const { error } = await supabase.from("delivery_zones").update({ is_active: active }).in("id", Array.from(selectedIds));
    if (error) toast({ title: "Erro ao atualizar", variant: "destructive" });
    else { toast({ title: `${selectedIds.size} zona(s) ${active ? "ativada(s)" : "desativada(s)"}!` }); setSelectedIds(new Set()); fetchData(); }
  }

  const neighborhoodZones = zones.filter(z => z.zone_type === "neighborhood");
  const radiusZones = zones.filter(z => z.zone_type === "radius").sort((a, b) => (a.min_radius_km || 0) - (b.min_radius_km || 0));
  const currentFilteredZones = deliveryMode === "radius" ? radiusZones : neighborhoodZones;

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-3 md:space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Configurações de Entrega</h1>
        <p className="text-muted-foreground">
          Configure as taxas de entrega e tempo estimado
        </p>
      </div>

      {/* Modo de entrega */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Map className="w-5 h-5" />
            Modo de Entrega
          </CardTitle>
          <CardDescription>
            Escolha como o cliente informa seu endereço de entrega
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <button
              onClick={() => handleModeChange("zones")}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                deliveryMode === "zones"
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-muted-foreground/50"
              }`}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className={`p-2 rounded-full ${deliveryMode === "zones" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                  <MapPin className="w-5 h-5" />
                </div>
                <span className="font-semibold">Limitado por bairros</span>
              </div>
              <p className="text-sm text-muted-foreground">
                O cliente seleciona cidade e bairro entre os cadastrados. Taxa definida por zona.
              </p>
            </button>

            <button
              onClick={() => handleModeChange("radius")}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                deliveryMode === "radius"
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-muted-foreground/50"
              }`}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className={`p-2 rounded-full ${deliveryMode === "radius" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                  <Radar className="w-5 h-5" />
                </div>
                <span className="font-semibold">Raio por geolocalização</span>
              </div>
              <p className="text-sm text-muted-foreground">
                O cliente usa seu GPS. A taxa é calculada automaticamente pela distância.
              </p>
            </button>
          </div>

          {deliveryMode === "radius" && (
            <div className="mt-4 space-y-4 border-t pt-4">
              <div>
                <h3 className="font-semibold text-sm mb-1">Endereço do Restaurante</h3>
                <p className="text-xs text-muted-foreground">Necessário para calcular a distância até o cliente</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">CEP</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="00000-000"
                      value={addrCep}
                      onChange={(e) => setAddrCep(e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={geocoding || addrCep.replace(/\D/g, "").length !== 8}
                      onClick={handleCepLookup}
                    >
                      {geocoding ? <Loader2 className="w-3 h-3 animate-spin" /> : "Buscar"}
                    </Button>
                  </div>
                </div>
                <div className="space-y-1 md:col-span-2">
                  <Label className="text-xs">Rua</Label>
                  <Input placeholder="Rua / Avenida" value={addrStreet} onChange={(e) => setAddrStreet(e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Número</Label>
                  <Input placeholder="Nº" value={addrNumber} onChange={(e) => setAddrNumber(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Complemento</Label>
                  <Input placeholder="Sala, bloco..." value={addrComplement} onChange={(e) => setAddrComplement(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Bairro</Label>
                  <Input placeholder="Bairro" value={addrNeighborhood} onChange={(e) => setAddrNeighborhood(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Cidade</Label>
                  <Input placeholder="Cidade" value={addrCity} onChange={(e) => setAddrCity(e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Estado</Label>
                  <Input placeholder="UF" value={addrState} onChange={(e) => setAddrState(e.target.value)} maxLength={2} className="w-20" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Latitude</Label>
                  <Input type="number" step="any" placeholder="-23.55" value={gpsLat} onChange={(e) => setGpsLat(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Longitude</Label>
                  <Input type="number" step="any" placeholder="-46.63" value={gpsLng} onChange={(e) => setGpsLng(e.target.value)} />
                </div>
                <div className="flex items-end">
                  <Button size="sm" onClick={saveAddress} disabled={savingAddress || !gpsLat || !gpsLng}>
                    {savingAddress ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Save className="w-3 h-3 mr-1" />}
                    Salvar Endereço
                  </Button>
                </div>
              </div>

              {gpsLat && gpsLng && (
                <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <p className="text-xs text-emerald-700 dark:text-emerald-400">
                    ✅ Coordenadas GPS configuradas: {parseFloat(gpsLat).toFixed(6)}, {parseFloat(gpsLng).toFixed(6)}
                  </p>
                </div>
              )}

              {(!gpsLat || !gpsLng) && (
                <div className="p-2 rounded-lg border border-amber-500/30 bg-amber-500/5">
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    ⚠️ Preencha o CEP e clique em "Buscar" para obter as coordenadas automaticamente, ou insira latitude e longitude manualmente.
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Configurações Gerais */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Configurações Gerais
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tempo médio de entrega (opcional)</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  placeholder="Ex: 45"
                  value={defaultTime}
                  onChange={(e) => setDefaultTime(e.target.value)}
                  className="w-32"
                />
                <span className="text-muted-foreground">minutos</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Será usado quando a faixa não tiver tempo específico
              </p>
            </div>

            {deliveryMode === "radius" && (
              <div className="space-y-2">
                <Label>Taxa fixa padrão (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Ex: 5.00"
                  value={defaultFee}
                  onChange={(e) => setDefaultFee(e.target.value)}
                  className="w-32"
                />
                <p className="text-xs text-muted-foreground">
                  Usada quando nenhuma faixa de raio for encontrada
                </p>
              </div>
            )}
          </div>

          <Button onClick={saveSettings} disabled={saving}>
            {saving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            {saving ? "Salvando..." : "Salvar Configurações"}
          </Button>
        </CardContent>
      </Card>

      {/* Zonas de Entrega */}
      {deliveryMode === "zones" && (
        <NeighborhoodZonesCard
          zones={neighborhoodZones}
          selectedIds={selectedIds}
          toggleSelect={toggleSelect}
          toggleSelectAll={toggleSelectAll}
          toggleSelectCity={toggleSelectCity}
          openAddDialog={openAddDialog}
          openEditDialog={openEditDialog}
          toggleZoneActive={toggleZoneActive}
          deleteZone={deleteZone}
          editingCity={editingCity}
          setEditingCity={setEditingCity}
          newCityName={newCityName}
          setNewCityName={setNewCityName}
          renameCityZones={renameCityZones}
          saving={saving}
          bulkEditOpen={bulkEditOpen}
          setBulkEditOpen={setBulkEditOpen}
          bulkFee={bulkFee}
          setBulkFee={setBulkFee}
          bulkTime={bulkTime}
          setBulkTime={setBulkTime}
          bulkSaving={bulkSaving}
          bulkEdit={bulkEdit}
          bulkDelete={bulkDelete}
          bulkToggleActive={bulkToggleActive}
          setSelectedIds={setSelectedIds}
        />
      )}

      {deliveryMode === "radius" && (
        <RadiusZonesCard
          zones={radiusZones}
          openAddDialog={openAddDialog}
          openEditDialog={openEditDialog}
          toggleZoneActive={toggleZoneActive}
          deleteZone={deleteZone}
        />
      )}

      {/* Create/Edit Dialog — shared */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingZone
                ? deliveryMode === "radius" ? "Editar Faixa" : "Editar Bairro"
                : deliveryMode === "radius" ? "Nova Faixa de Raio" : "Adicionar Bairros"
              }
            </DialogTitle>
            <DialogDescription>
              {deliveryMode === "radius"
                ? "Defina a faixa de distância e o valor da taxa"
                : editingZone
                  ? "Edite as informações deste bairro"
                  : "Adicione vários bairros de uma vez separando por vírgula"
              }
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {deliveryMode === "radius" ? (
              <>
                <div className="space-y-2">
                  <Label>Nome da faixa *</Label>
                  <Input placeholder="Ex: Até 3km, 3-6km" value={zoneName} onChange={(e) => setZoneName(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Raio mínimo (km)</Label>
                    <Input type="number" step="0.1" placeholder="0" value={zoneMinRadius} onChange={(e) => setZoneMinRadius(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Raio máximo (km) *</Label>
                    <Input type="number" step="0.1" placeholder="Ex: 5" value={zoneMaxRadius} onChange={(e) => setZoneMaxRadius(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Taxa de Entrega (R$) *</Label>
                  <Input type="number" step="0.01" placeholder="Ex: 8.00" value={zoneFee} onChange={(e) => setZoneFee(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Tempo Estimado (minutos)</Label>
                  <Input type="number" placeholder="Ex: 30" value={zoneTime} onChange={(e) => setZoneTime(e.target.value)} />
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Cidade</Label>
                  <Input placeholder="Ex: São Paulo, Campinas" value={zoneCity} onChange={(e) => setZoneCity(e.target.value)} />
                  <p className="text-xs text-muted-foreground">Opcional — agrupar bairros por cidade</p>
                </div>
                <div className="space-y-2">
                  <Label>{editingZone ? "Nome do Bairro *" : "Bairros *"}</Label>
                  {editingZone ? (
                    <Input placeholder="Ex: Centro" value={zoneName} onChange={(e) => setZoneName(e.target.value)} />
                  ) : (
                    <>
                      <textarea
                        className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        placeholder={"Cole ou digite os bairros:\n\nCentro\nJardins\nVila Madalena\n\nOu separados por vírgula: Centro, Jardins"}
                        value={zoneName}
                        onChange={(e) => setZoneName(e.target.value)}
                      />
                      {bulkCount > 0 && (
                        <Badge variant="secondary" className="w-fit">{bulkCount} bairro(s) detectado(s)</Badge>
                      )}
                    </>
                  )}
                  {!editingZone && (
                    <p className="text-xs text-muted-foreground">Cole uma lista (um por linha) ou separe por vírgula</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Taxa de Entrega (R$) *</Label>
                  <Input type="number" step="0.01" placeholder="Ex: 8.00" value={zoneFee} onChange={(e) => setZoneFee(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Tempo Estimado (minutos)</Label>
                  <Input type="number" placeholder="Ex: 30" value={zoneTime} onChange={(e) => setZoneTime(e.target.value)} />
                  <p className="text-xs text-muted-foreground">Opcional - deixe vazio para usar o tempo padrão</p>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={saveZone} disabled={saving}>
              {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</> : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Radius Zones Card ─────────────────────────────────────
function RadiusZonesCard({
  zones,
  openAddDialog,
  openEditDialog,
  toggleZoneActive,
  deleteZone,
}: {
  zones: DeliveryZone[];
  openAddDialog: () => void;
  openEditDialog: (z: DeliveryZone) => void;
  toggleZoneActive: (z: DeliveryZone) => void;
  deleteZone: (z: DeliveryZone) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Radar className="w-5 h-5" />
          Faixas de Raio
        </CardTitle>
        <CardDescription>
          Configure as faixas de distância e suas respectivas taxas. O GPS do cliente será usado para calcular automaticamente.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-end">
          <Button onClick={openAddDialog}>
            <Plus className="w-4 h-4 mr-2" />
            Nova Faixa
          </Button>
        </div>

        {zones.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Radar className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Nenhuma faixa de raio cadastrada</p>
            <p className="text-sm">Adicione faixas para definir taxas por distância</p>
          </div>
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Faixa</TableHead>
                    <TableHead>Distância</TableHead>
                    <TableHead>Taxa</TableHead>
                    <TableHead>Tempo</TableHead>
                    <TableHead>Ativo</TableHead>
                    <TableHead className="w-32">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {zones.map((zone) => (
                    <TableRow key={zone.id}>
                      <TableCell className="font-medium">{zone.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {zone.min_radius_km || 0}km — {zone.max_radius_km}km
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">R$ {zone.fee.toFixed(2)}</Badge>
                      </TableCell>
                      <TableCell>
                        {zone.estimated_time_min ? `${zone.estimated_time_min} min` : <span className="text-muted-foreground">Padrão</span>}
                      </TableCell>
                      <TableCell>
                        <Switch checked={zone.is_active} onCheckedChange={() => toggleZoneActive(zone)} />
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEditDialog(zone)}>
                            <Pencil className="w-4 h-4 mr-1" />Editar
                          </Button>
                          <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => deleteZone(zone)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile */}
            <div className="md:hidden space-y-3">
              {zones.map((zone) => (
                <div key={zone.id} className="p-4 rounded-xl border bg-card space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{zone.name}</span>
                    <Badge variant="secondary">R$ {zone.fee.toFixed(2)}</Badge>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Radar className="w-3.5 h-3.5" />
                    {zone.min_radius_km || 0}km — {zone.max_radius_km}km
                    {zone.estimated_time_min && (
                      <> · <Clock className="w-3.5 h-3.5" /> {zone.estimated_time_min} min</>
                    )}
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-border/50">
                    <div className="flex items-center gap-2">
                      <Switch checked={zone.is_active} onCheckedChange={() => toggleZoneActive(zone)} />
                      <span className="text-xs text-muted-foreground">{zone.is_active ? "Ativo" : "Inativo"}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEditDialog(zone)} className="h-8">
                        <Pencil className="w-3.5 h-3.5 mr-1" />Editar
                      </Button>
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive h-8" onClick={() => deleteZone(zone)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Neighborhood Zones Card ────────────────────────────────
function NeighborhoodZonesCard({
  zones,
  selectedIds,
  toggleSelect,
  toggleSelectAll,
  toggleSelectCity,
  openAddDialog,
  openEditDialog,
  toggleZoneActive,
  deleteZone,
  editingCity,
  setEditingCity,
  newCityName,
  setNewCityName,
  renameCityZones,
  saving,
  bulkEditOpen,
  setBulkEditOpen,
  bulkFee,
  setBulkFee,
  bulkTime,
  setBulkTime,
  bulkSaving,
  bulkEdit,
  bulkDelete,
  bulkToggleActive,
  setSelectedIds,
}: any) {
  // Group zones by city
  const grouped: Record<string, DeliveryZone[]> = {};
  zones.forEach((zone: DeliveryZone) => {
    const city = zone.city || "Sem cidade";
    if (!grouped[city]) grouped[city] = [];
    grouped[city].push(zone);
  });
  const cityNames = Object.keys(grouped).sort();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="w-5 h-5" />
          Zonas de Entrega
        </CardTitle>
        <CardDescription>
          Cadastre as cidades e bairros onde você entrega. Apenas clientes dessas localidades poderão fazer pedidos para entrega.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className="text-sm text-muted-foreground">
            Adicione as cidades e bairros atendidos com suas respectivas taxas.
          </p>
          <Button onClick={openAddDialog}>
            <Plus className="w-4 h-4 mr-2" />
            Adicionar Bairros
          </Button>
        </div>

        {/* Bulk actions toolbar */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2 flex-wrap p-3 rounded-lg bg-primary/5 border border-primary/20">
            <Badge variant="default">{selectedIds.size} selecionado(s)</Badge>
            <Dialog open={bulkEditOpen} onOpenChange={setBulkEditOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" onClick={() => { setBulkFee(""); setBulkTime(""); }}>
                  <Pencil className="w-3.5 h-3.5 mr-1" />Editar
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Editar {selectedIds.size} bairro(s)</DialogTitle>
                  <DialogDescription>Preencha apenas os campos que deseja alterar</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Nova Taxa de Entrega (R$)</Label>
                    <Input type="number" step="0.01" placeholder="Deixe vazio para manter" value={bulkFee} onChange={(e: any) => setBulkFee(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Novo Tempo Estimado (minutos)</Label>
                    <Input type="number" placeholder="Deixe vazio para manter" value={bulkTime} onChange={(e: any) => setBulkTime(e.target.value)} />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setBulkEditOpen(false)}>Cancelar</Button>
                  <Button onClick={bulkEdit} disabled={bulkSaving}>
                    {bulkSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</> : "Aplicar"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button size="sm" variant="outline" onClick={() => bulkToggleActive(true)}>Ativar</Button>
            <Button size="sm" variant="outline" onClick={() => bulkToggleActive(false)}>Desativar</Button>
            <Button size="sm" variant="destructive" onClick={bulkDelete}>
              <Trash2 className="w-3.5 h-3.5 mr-1" />Excluir
            </Button>
            <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setSelectedIds(new Set())}>Limpar seleção</Button>
          </div>
        )}

        {zones.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <MapPin className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum bairro cadastrado</p>
            <p className="text-sm">Adicione bairros para configurar as taxas de entrega</p>
          </div>
        ) : (
          <div className="space-y-6">
            {cityNames.map((city) => (
              <div key={city} className="space-y-2">
                <div className="flex items-center gap-2 pb-1 border-b border-border">
                  <Checkbox
                    checked={grouped[city].every((z: DeliveryZone) => selectedIds.has(z.id))}
                    onCheckedChange={() => toggleSelectCity(grouped[city])}
                  />
                  <MapPin className="w-4 h-4 text-primary" />
                  {editingCity === city ? (
                    <div className="flex items-center gap-2">
                      <Input
                        value={newCityName}
                        onChange={(e: any) => setNewCityName(e.target.value)}
                        className="h-7 w-48 text-sm"
                        autoFocus
                        onKeyDown={(e: any) => {
                          if (e.key === "Enter") renameCityZones(city, newCityName);
                          if (e.key === "Escape") setEditingCity(null);
                        }}
                      />
                      <Button size="sm" variant="default" className="h-7 text-xs" onClick={() => renameCityZones(city, newCityName)} disabled={saving}>Salvar</Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingCity(null)}>Cancelar</Button>
                    </div>
                  ) : (
                    <>
                      <h3 className="font-semibold text-sm uppercase tracking-wide">{city}</h3>
                      <Badge variant="outline" className="text-xs">{grouped[city].length} bairro(s)</Badge>
                      <Button variant="ghost" size="sm" className="h-7 text-xs ml-auto" onClick={() => { setEditingCity(city); setNewCityName(city === "Sem cidade" ? "" : city); }}>
                        <Pencil className="w-3.5 h-3.5 mr-1" />Editar Cidade
                      </Button>
                    </>
                  )}
                </div>

                {/* Desktop Table */}
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10"></TableHead>
                        <TableHead>Bairro</TableHead>
                        <TableHead>Taxa</TableHead>
                        <TableHead>Tempo</TableHead>
                        <TableHead>Ativo</TableHead>
                        <TableHead className="w-32">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {grouped[city].map((zone: DeliveryZone) => (
                        <TableRow key={zone.id} className={selectedIds.has(zone.id) ? "bg-primary/5" : ""}>
                          <TableCell><Checkbox checked={selectedIds.has(zone.id)} onCheckedChange={() => toggleSelect(zone.id)} /></TableCell>
                          <TableCell className="font-medium">{zone.name}</TableCell>
                          <TableCell><Badge variant="secondary">R$ {zone.fee.toFixed(2)}</Badge></TableCell>
                          <TableCell>{zone.estimated_time_min ? `${zone.estimated_time_min} min` : <span className="text-muted-foreground">Padrão</span>}</TableCell>
                          <TableCell><Switch checked={zone.is_active} onCheckedChange={() => toggleZoneActive(zone)} /></TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="sm" onClick={() => openEditDialog(zone)}><Pencil className="w-4 h-4 mr-1" />Editar</Button>
                              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => deleteZone(zone)}><Trash2 className="w-4 h-4" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden space-y-3">
                  {grouped[city].map((zone: DeliveryZone) => (
                    <div key={zone.id} className={`p-4 rounded-xl border bg-card space-y-3 ${selectedIds.has(zone.id) ? "border-primary bg-primary/5" : ""}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Checkbox checked={selectedIds.has(zone.id)} onCheckedChange={() => toggleSelect(zone.id)} />
                          <span className="font-semibold">{zone.name}</span>
                        </div>
                        <Badge variant="secondary">R$ {zone.fee.toFixed(2)}</Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        {zone.estimated_time_min ? (
                          <div className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{zone.estimated_time_min} min</div>
                        ) : <span className="text-xs">Tempo padrão</span>}
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-border/50">
                        <div className="flex items-center gap-2">
                          <Switch checked={zone.is_active} onCheckedChange={() => toggleZoneActive(zone)} />
                          <span className="text-xs text-muted-foreground">{zone.is_active ? "Ativo" : "Inativo"}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEditDialog(zone)} className="h-8"><Pencil className="w-3.5 h-3.5 mr-1" />Editar</Button>
                          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive h-8" onClick={() => deleteZone(zone)}><Trash2 className="w-3.5 h-3.5" /></Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
