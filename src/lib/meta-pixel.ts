// Meta Pixel event tracking utility (client-side + server-side)
// Implements dual tracking with proper deduplication via event_id
// Supports: PageView, ViewContent, AddToCart, InitiateCheckout, AddPaymentInfo, Purchase

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

// ─── Utilities ───────────────────────────────────────────────

function generateEventId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

async function sha256(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(value.trim().toLowerCase());
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function normalizePhone(phone: string): string {
  let cleaned = phone.replace(/\D/g, "");
  if (cleaned.startsWith("0")) cleaned = cleaned.substring(1);
  if (!cleaned.startsWith("55")) cleaned = "55" + cleaned;
  return cleaned;
}

// ─── fbclid / _fbc cookie management ────────────────────────

/**
 * Captures fbclid from URL query string and stores it as _fbc cookie.
 * Should be called once on page load (e.g. in TrackingScripts).
 * Format: fb.1.{timestamp}.{fbclid}
 */
export function captureFbclid() {
  if (typeof window === "undefined") return;
  try {
    const params = new URLSearchParams(window.location.search);
    const fbclid = params.get("fbclid");
    if (fbclid) {
      const fbc = `fb.1.${Date.now()}.${fbclid}`;
      document.cookie = `_fbc=${fbc};path=/;max-age=${90 * 24 * 60 * 60};SameSite=Lax`;
    }
  } catch {
    // silently fail
  }
}

function getMetaCookies() {
  const cookies: Record<string, string> = {};
  if (typeof document === "undefined") return cookies;
  document.cookie.split(";").forEach((c) => {
    const [key, val] = c.trim().split("=");
    if (key === "_fbp" || key === "_fbc") cookies[key] = val;
  });

  // Fallback: generate _fbc from fbclid in URL if cookie doesn't exist
  if (!cookies._fbc) {
    try {
      const params = new URLSearchParams(window.location.search);
      const fbclid = params.get("fbclid");
      if (fbclid) {
        cookies._fbc = `fb.1.${Date.now()}.${fbclid}`;
      }
    } catch {
      // silently fail
    }
  }

  return cookies;
}

// ─── Core tracking functions ─────────────────────────────────

function trackEvent(eventName: string, params?: Record<string, unknown>, eventId?: string) {
  if (typeof window !== "undefined" && window.fbq) {
    const trackParams = { ...params };
    if (eventId) {
      window.fbq("track", eventName, trackParams, { eventID: eventId });
    } else {
      window.fbq("track", eventName, trackParams);
    }
  }
}

export interface UserInfo {
  phone?: string;
  name?: string;
}

export interface GeoInfo {
  city?: string;
  state?: string;
  country?: string;
}

async function trackServerEvent(
  restaurantId: string,
  eventName: string,
  eventId: string,
  customData?: Record<string, unknown>,
  userInfo?: UserInfo,
  geoInfo?: GeoInfo
) {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  if (!projectId || !restaurantId) return;

  const url = `https://${projectId}.supabase.co/functions/v1/meta-conversions`;
  const metaCookies = getMetaCookies();

  // Hash user data if available
  const hashedUserData: Record<string, string> = {};
  if (userInfo?.phone) {
    const normalized = normalizePhone(userInfo.phone);
    hashedUserData.ph = await sha256(normalized);
    hashedUserData.external_id = await sha256(normalized);
  }
  if (userInfo?.name) {
    const parts = userInfo.name.trim().split(/\s+/);
    hashedUserData.fn = await sha256(parts[0]);
    if (parts.length > 1) {
      hashedUserData.ln = await sha256(parts.slice(1).join(" "));
    }
  }

  // Geo data (hashed)
  if (geoInfo?.city) hashedUserData.ct = await sha256(geoInfo.city);
  if (geoInfo?.state) hashedUserData.st = await sha256(geoInfo.state);
  if (geoInfo?.country) {
    hashedUserData.country = await sha256(geoInfo.country);
  } else {
    hashedUserData.country = await sha256("br"); // Default to Brazil
  }

  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${anonKey}`,
    },
    body: JSON.stringify({
      restaurant_id: restaurantId,
      event_name: eventName,
      event_id: eventId,
      event_data: {
        source_url: window.location.href,
        user_agent: navigator.userAgent,
        fbp: metaCookies._fbp || undefined,
        fbc: metaCookies._fbc || undefined,
        custom_data: customData,
        user_data: Object.keys(hashedUserData).length > 0 ? hashedUserData : undefined,
      },
    }),
  }).catch(() => {
    // Silently fail — tracking should never block UX
  });
}

// ─── Event: PageView (dual tracking) ────────────────────────

export function trackPageView(restaurantId?: string) {
  const eventId = generateEventId();
  trackEvent("PageView", undefined, eventId);

  if (restaurantId) {
    trackServerEvent(restaurantId, "PageView", eventId);
  }
}

// ─── Event: ViewContent ─────────────────────────────────────

export function trackViewContent(
  productName: string,
  productId: string,
  price: number,
  restaurantId?: string,
  categoryName?: string
) {
  const eventId = generateEventId();
  const data: Record<string, unknown> = {
    content_name: productName,
    content_ids: [productId],
    content_type: "product",
    value: price,
    currency: "BRL",
  };
  if (categoryName) data.content_category = categoryName;
  trackEvent("ViewContent", data, eventId);

  if (restaurantId) {
    trackServerEvent(restaurantId, "ViewContent", eventId, data);
  }
}

// ─── Event: AddToCart ────────────────────────────────────────

export function trackAddToCart(
  productName: string,
  productId: string,
  price: number,
  quantity: number,
  restaurantId?: string,
  categoryName?: string
) {
  const eventId = generateEventId();
  const data: Record<string, unknown> = {
    content_name: productName,
    content_ids: [productId],
    content_type: "product",
    value: price * quantity,
    currency: "BRL",
    num_items: quantity,
  };
  if (categoryName) data.content_category = categoryName;
  trackEvent("AddToCart", data, eventId);

  if (restaurantId) {
    trackServerEvent(restaurantId, "AddToCart", eventId, data);
  }
}

// ─── Event: InitiateCheckout ─────────────────────────────────

export function trackInitiateCheckout(
  totalValue: number,
  numItems: number,
  restaurantId?: string,
  userInfo?: UserInfo,
  contentIds?: string[]
) {
  const eventId = generateEventId();
  const data: Record<string, unknown> = {
    value: totalValue,
    currency: "BRL",
    num_items: numItems,
    content_type: "product",
  };
  if (contentIds && contentIds.length > 0) {
    data.content_ids = contentIds;
  }
  trackEvent("InitiateCheckout", data, eventId);

  if (restaurantId) {
    trackServerEvent(restaurantId, "InitiateCheckout", eventId, data, userInfo);
  }
}

// ─── Event: AddPaymentInfo ───────────────────────────────────

export function trackAddPaymentInfo(
  totalValue: number,
  paymentMethod: string,
  restaurantId?: string,
  userInfo?: UserInfo,
  contentIds?: string[]
) {
  const eventId = generateEventId();
  const data: Record<string, unknown> = {
    value: totalValue,
    currency: "BRL",
    content_type: "product",
  };
  if (contentIds && contentIds.length > 0) {
    data.content_ids = contentIds;
  }
  trackEvent("AddPaymentInfo", data, eventId);

  if (restaurantId) {
    trackServerEvent(restaurantId, "AddPaymentInfo", eventId, data, userInfo);
  }
}

// ─── Event: Purchase ─────────────────────────────────────────

export function trackPurchase(
  orderId: string,
  totalValue: number,
  numItems: number,
  restaurantId?: string,
  userInfo?: UserInfo,
  contentIds?: string[]
) {
  const eventId = generateEventId();
  const data: Record<string, unknown> = {
    value: totalValue,
    currency: "BRL",
    num_items: numItems,
    content_type: "product",
    order_id: orderId,
  };
  if (contentIds && contentIds.length > 0) {
    data.content_ids = contentIds;
  }
  trackEvent("Purchase", data, eventId);

  if (restaurantId) {
    trackServerEvent(restaurantId, "Purchase", eventId, data, userInfo);
  }
}
