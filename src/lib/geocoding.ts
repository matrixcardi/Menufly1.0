// Geocoding and distance calculation utilities

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface GeocodingResult {
  success: boolean;
  coordinates?: Coordinates;
  address?: {
    street: string;
    neighborhood: string;
    city: string;
    state: string;
    postcode: string;
  };
  error?: string;
}

/**
 * Geocode an address using Nominatim (OpenStreetMap)
 * Free service, no API key required
 */
export async function geocodeAddress(address: string): Promise<GeocodingResult> {
  if (!address || address.trim().length < 5) {
    return { success: false, error: "Endereço muito curto" };
  }

  try {
    const encodedAddress = encodeURIComponent(address + ", Brasil");
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=1`,
      {
        headers: {
          "User-Agent": "LovableRestaurantApp/1.0",
        },
      }
    );

    if (!response.ok) {
      return { success: false, error: "Erro ao buscar localização" };
    }

    const data = await response.json();

    if (!data || data.length === 0) {
      return { success: false, error: "Endereço não encontrado" };
    }

    const result = data[0];
    return {
      success: true,
      coordinates: {
        lat: parseFloat(result.lat),
        lng: parseFloat(result.lon),
      },
    };
  } catch (error) {
    console.error("Geocoding error:", error);
    return { success: false, error: "Erro ao buscar localização" };
  }
}

/**
 * Geocode a CEP (Brazilian postal code) to get approximate coordinates
 * Uses ViaCEP to get address, then Nominatim for coordinates
 */
export async function geocodeCep(cep: string): Promise<GeocodingResult> {
  const cleanCep = cep.replace(/\D/g, "");

  if (cleanCep.length !== 8) {
    return { success: false, error: "CEP inválido" };
  }

  try {
    // First get address from ViaCEP
    const viaCepResponse = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
    if (!viaCepResponse.ok) {
      return { success: false, error: "Erro ao buscar CEP" };
    }

    const viaCepData = await viaCepResponse.json();
    if (viaCepData.erro) {
      return { success: false, error: "CEP não encontrado" };
    }

    // Build address string for geocoding
    const addressParts = [
      viaCepData.logradouro,
      viaCepData.bairro,
      viaCepData.localidade,
      viaCepData.uf,
    ].filter(Boolean);

    if (addressParts.length < 2) {
      return { success: false, error: "Endereço incompleto" };
    }

    // Geocode the address and keep the textual address from ViaCEP for the order/admin view
    const geocoded = await geocodeAddress(addressParts.join(", "));
    if (!geocoded.success) return geocoded;

    return {
      ...geocoded,
      address: {
        street: viaCepData.logradouro || "",
        neighborhood: viaCepData.bairro || "",
        city: viaCepData.localidade || "",
        state: viaCepData.uf || "",
        postcode: cleanCep,
      },
    };
  } catch (error) {
    console.error("CEP geocoding error:", error);
    return { success: false, error: "Erro ao buscar localização" };
  }
}

/**
 * Calculate distance between two points using Haversine formula
 * Returns distance in kilometers
 */
export function calculateDistance(
  point1: Coordinates,
  point2: Coordinates
): number {
  const R = 6371; // Earth's radius in kilometers

  const dLat = toRadians(point2.lat - point1.lat);
  const dLng = toRadians(point2.lng - point1.lng);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(point1.lat)) *
      Math.cos(toRadians(point2.lat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return Math.round(distance * 10) / 10; // Round to 1 decimal place
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

export interface ReverseGeocodeResult {
  success: boolean;
  address?: {
    street: string;
    neighborhood: string;
    city: string;
    state: string;
    postcode: string;
  };
  error?: string;
}

/**
 * Reverse geocode coordinates to a human-readable address using Nominatim
 */
export async function reverseGeocode(lat: number, lng: number): Promise<ReverseGeocodeResult> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      { headers: { "User-Agent": "LovableRestaurantApp/1.0", "Accept-Language": "pt-BR" } }
    );
    if (!res.ok) return { success: false, error: "Erro ao buscar endereço" };
    const data = await res.json();
    if (!data || !data.address) return { success: false, error: "Endereço não encontrado" };
    const a = data.address;
    // Nominatim no Brasil costuma devolver macro-regiões ("Zona Norte", "Zona Sul",
    // "Região Central" etc.) no campo `suburb`. O bairro real geralmente vem em
    // `neighbourhood` ou `city_district`. Priorizamos os campos mais granulares e
    // descartamos valores que correspondam a padrões de macro-zona.
    const isMacroZone = (v: string | undefined) =>
      !!v && /^(zona|região|regiao)\s+(norte|sul|leste|oeste|central|centro)$/i.test(v.trim());

    const candidates = [a.neighbourhood, a.city_district, a.quarter, a.suburb];
    const neighborhood = candidates.find((c) => c && !isMacroZone(c)) || candidates.find(Boolean) || "";

    return {
      success: true,
      address: {
        street: a.road || a.pedestrian || a.residential || a.cycleway || a.footway || "",
        neighborhood,
        city: a.city || a.town || a.village || a.municipality || "",
        state: a.state || "",
        postcode: a.postcode || "",
      },
    };
  } catch (err) {
    console.error("Reverse geocoding error:", err);
    return { success: false, error: "Erro ao buscar endereço" };
  }
}

/**
 * Find the matching delivery zone based on distance
 */
export interface DeliveryZone {
  id: string;
  name: string;
  fee: number;
  min_radius_km: number | null;
  max_radius_km: number | null;
  estimated_time_min: number | null;
}

export function findMatchingZone(
  distance: number,
  zones: DeliveryZone[]
): DeliveryZone | null {
  // Sort zones by min_radius to get the most specific match
  const sortedZones = [...zones].sort(
    (a, b) => (a.min_radius_km || 0) - (b.min_radius_km || 0)
  );

  for (const zone of sortedZones) {
    const min = zone.min_radius_km || 0;
    const max = zone.max_radius_km || Infinity;

    if (distance >= min && distance <= max) {
      return zone;
    }
  }

  return null;
}
