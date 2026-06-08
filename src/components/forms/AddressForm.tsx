import { useState, useEffect } from "react";
import { MapPin, Loader2 } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { geocodeCep } from "@/lib/geocoding";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface DeliveryZone {
  id: string;
  name: string;
  city: string | null;
  fee: number;
  estimated_time_min: number | null;
}

interface AddressData {
  street: string;
  number: string;
  complement: string;
  reference: string;
  neighborhood: string;
  cep: string;
  city: string;
  zoneId: string;
}

interface AddressFormProps {
  restaurantId: string;
  onAddressChange: (address: AddressData, deliveryFee: number) => void;
  initialAddress?: Partial<AddressData>;
  showDeliveryFee?: boolean;
}

const addressSchema = z.object({
  street: z.string().min(3, "Rua inválida"),
  number: z.string().min(1, "Número obrigatório"),
  cep: z.string().regex(/^\d{5}-\d{3}$/, "CEP inválido"),
});

export function AddressForm({ 
  restaurantId, 
  onAddressChange, 
  initialAddress = {},
  showDeliveryFee = true 
}: AddressFormProps) {
  const [cep, setCep] = useState(initialAddress.cep || "");
  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState<string | null>(null);
  
  const [city, setCity] = useState(initialAddress.city || "");
  const [zoneId, setZoneId] = useState(initialAddress.zoneId || "");
  const [street, setStreet] = useState(initialAddress.street || "");
  const [number, setNumber] = useState(initialAddress.number || "");
  const [complement, setComplement] = useState(initialAddress.complement || "");
  const [reference, setReference] = useState(initialAddress.reference || "");
  const [neighborhood, setNeighborhood] = useState(initialAddress.neighborhood || "");
  
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [deliveryFee, setDeliveryFee] = useState(0);

  // Load delivery zones
  useEffect(() => {
    if (!restaurantId) return;
    
    supabase
      .from("delivery_zones")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .then(({ data }) => {
        if (data) {
          const zones = data as DeliveryZone[];
          setZones(zones);
          const uniqueCities = [...new Set(zones.map(z => z.city).filter(Boolean) as string[])];
          setCities(uniqueCities);
        }
      });
  }, [restaurantId]);

  // Filter zones by selected city
  const cityZones = city ? zones.filter(z => z.city === city) : zones;

  // Calculate delivery fee when zone changes
  useEffect(() => {
    if (zoneId) {
      const zone = zones.find(z => z.id === zoneId);
      setDeliveryFee(zone?.fee || 0);
    } else {
      setDeliveryFee(0);
    }
  }, [zoneId, zones]);

  // Notify parent of changes
  useEffect(() => {
    const addressData: AddressData = {
      street,
      number,
      complement,
      reference,
      neighborhood,
      cep,
      city,
      zoneId,
    };
    onAddressChange(addressData, deliveryFee);
  }, [street, number, complement, reference, neighborhood, cep, city, zoneId, deliveryFee, onAddressChange]);

  // CEP lookup via ViaCEP
  const handleCepBlur = async () => {
    const cepDigits = cep.replace(/\D/g, "");
    if (cepDigits.length !== 8) return;

    setCepLoading(true);
    setCepError(null);

    try {
      const result = await geocodeCep(cep);
      if (result) {
        setStreet(result.logradouro || street);
        setNeighborhood(result.bairro || neighborhood);
        setComplement(result.complemento || complement);
        
        // Try to match city
        const matchedCity = cities.find(c => 
          c.toLowerCase() === result.localidade?.toLowerCase()
        );
        if (matchedCity) {
          setCity(matchedCity);
        }
      }
    } catch (error) {
      setCepError("Erro ao buscar CEP");
    } finally {
      setCepLoading(false);
    }
  };

  const formatCep = (value: string) => {
    const digits = value.replace(/\D/g, "");
    if (digits.length <= 5) return digits;
    return `${digits.slice(0, 5)}-${digits.slice(5, 8)}`;
  };

  return (
    <div className="space-y-4">
      {/* CEP */}
      <div className="space-y-2">
        <Label htmlFor="cep">CEP *</Label>
        <div className="relative">
          <Input
            id="cep"
            placeholder="00000-000"
            value={cep}
            onChange={(e) => setCep(formatCep(e.target.value))}
            onBlur={handleCepBlur}
            className={cepError ? "border-red-500" : ""}
          />
          {cepLoading && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
          )}
        </div>
        {cepError && <p className="text-xs text-red-500">{cepError}</p>}
      </div>

      {/* Cidade */}
      <div className="space-y-2">
        <Label htmlFor="city">Cidade *</Label>
        <Select value={city} onValueChange={setCity}>
          <SelectTrigger id="city">
            <SelectValue placeholder="Selecione a cidade" />
          </SelectTrigger>
          <SelectContent>
            {cities.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Setor/Bairro */}
      {city && (
        <div className="space-y-2">
          <Label htmlFor="zone">Setor/Bairro *</Label>
          <Select value={zoneId} onValueChange={setZoneId}>
            <SelectTrigger id="zone">
              <SelectValue placeholder="Selecione o setor" />
            </SelectTrigger>
            <SelectContent>
              {cityZones.map((z) => (
                <SelectItem key={z.id} value={z.id}>
                  {z.name} {showDeliveryFee && `(+ R$ ${z.fee.toFixed(2)})`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {showDeliveryFee && deliveryFee > 0 && (
            <p className="text-xs text-muted-foreground">
              Taxa de entrega: R$ {deliveryFee.toFixed(2)}
            </p>
          )}
        </div>
      )}

      {/* Rua */}
      <div className="space-y-2">
        <Label htmlFor="street">Rua/Avenida *</Label>
        <Input
          id="street"
          placeholder="Nome da rua"
          value={street}
          onChange={(e) => setStreet(e.target.value)}
        />
      </div>

      {/* Número */}
      <div className="space-y-2">
        <Label htmlFor="number">Número *</Label>
        <Input
          id="number"
          placeholder="123"
          value={number}
          onChange={(e) => setNumber(e.target.value)}
        />
      </div>

      {/* Complemento */}
      <div className="space-y-2">
        <Label htmlFor="complement">Complemento (opcional)</Label>
        <Input
          id="complement"
          placeholder="Apto, bloco, etc."
          value={complement}
          onChange={(e) => setComplement(e.target.value)}
        />
      </div>

      {/* Ponto de Referência */}
      <div className="space-y-2">
        <Label htmlFor="reference">Ponto de referência (opcional)</Label>
        <Input
          id="reference"
          placeholder="Próximo ao..."
          value={reference}
          onChange={(e) => setReference(e.target.value)}
        />
      </div>
    </div>
  );
}
