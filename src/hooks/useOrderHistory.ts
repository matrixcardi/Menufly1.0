import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Order {
  orderId: string;
  customerName: string;
  deliveryMethod: "pickup" | "delivery";
  total: number;
  status: "pending" | "confirmed" | "preparing" | "ready" | "delivered" | "cancelled" | "rejected";
  paymentStatus?: "pending" | "awaiting_payment" | "paid";
  dbOrderId?: string;
  restaurantId?: string;
  restaurantSlug?: string;
  createdAt: string;
}

const ORDERS_KEY = "burger_orders_history";

export function useOrderHistory() {
  const [orders, setOrders] = useState<Order[]>([]);

  // Load from localStorage then sync with DB
  useEffect(() => {
    const stored = localStorage.getItem(ORDERS_KEY);
    const localOrders: Order[] = stored ? JSON.parse(stored) : [];
    setOrders(localOrders);

    // Sync active orders with real DB status
    const dbOrderIds = localOrders
      .filter(o => o.dbOrderId)
      .map(o => o.dbOrderId as string);

    if (dbOrderIds.length === 0) return;

    supabase
      .from("orders")
      .select("id, status, payment_status")
      .in("id", dbOrderIds)
      .then(({ data }) => {
        if (!data || data.length === 0) return;

        const statusMap = new Map(data.map(d => [d.id, { status: d.status, paymentStatus: d.payment_status }]));
        const updated = localOrders.map(o => {
          if (!o.dbOrderId) return o;
          const dbStatus = statusMap.get(o.dbOrderId);
          if (!dbStatus) return o;
          return {
            ...o,
            status: dbStatus.status as Order["status"],
            paymentStatus: dbStatus.paymentStatus as Order["paymentStatus"],
          };
        });

        setOrders(updated);
        localStorage.setItem(ORDERS_KEY, JSON.stringify(updated));
      });
  }, []);

  const addOrder = (order: Omit<Order, "createdAt" | "status">) => {
    const newOrder: Order = {
      ...order,
      status: "confirmed",
      createdAt: new Date().toISOString(),
    };
    
    const updated = [newOrder, ...orders];
    setOrders(updated);
    localStorage.setItem(ORDERS_KEY, JSON.stringify(updated));
  };

  const refreshOrders = () => {
    const stored = localStorage.getItem(ORDERS_KEY);
    if (stored) {
      setOrders(JSON.parse(stored));
    }
  };

  return { orders, addOrder, refreshOrders };
}

// Helper to save order from anywhere
export function saveOrderToHistory(order: {
  orderId: string;
  customerName: string;
  deliveryMethod: "pickup" | "delivery";
  total: number;
  paymentStatus?: "pending" | "awaiting_payment" | "paid";
  dbOrderId?: string;
  restaurantId?: string;
  restaurantSlug?: string;
}) {
  const stored = localStorage.getItem(ORDERS_KEY);
  const orders: Order[] = stored ? JSON.parse(stored) : [];
  
  // Don't duplicate if already exists
  if (orders.some(o => o.orderId === order.orderId)) return;
  
  const newOrder: Order = {
    ...order,
    status: "confirmed",
    createdAt: new Date().toISOString(),
  };
  
  localStorage.setItem(ORDERS_KEY, JSON.stringify([newOrder, ...orders]));
}

// Update payment status in localStorage
export function updateOrderPaymentStatus(orderId: string, paymentStatus: "pending" | "awaiting_payment" | "paid") {
  const stored = localStorage.getItem(ORDERS_KEY);
  if (!stored) return;
  const orders: Order[] = JSON.parse(stored);
  const updated = orders.map(o => o.orderId === orderId ? { ...o, paymentStatus } : o);
  localStorage.setItem(ORDERS_KEY, JSON.stringify(updated));
}

// Remove order from localStorage history
export function removeOrderFromHistory(orderId: string) {
  const stored = localStorage.getItem(ORDERS_KEY);
  if (!stored) return;
  const orders: Order[] = JSON.parse(stored);
  const updated = orders.filter(o => o.orderId !== orderId);
  localStorage.setItem(ORDERS_KEY, JSON.stringify(updated));
}
