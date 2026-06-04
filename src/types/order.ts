// Order status types
export type OrderStatus = 
  | "pending"
  | "preparing"
  | "ready"
  | "pickup_ready"
  | "out_for_delivery"
  | "delivered"
  | "rejected"
  | "cancelled";

// Order status configuration
export interface OrderStatusConfig {
  label: string;
  nextLabel: string;
  bg: string;
  text: string;
  border: string;
  icon: React.ElementType;
}

// Order status transitions by delivery type
export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ["preparing", "rejected"],
  preparing: ["ready", "cancelled"],
  ready: ["pickup_ready", "out_for_delivery", "cancelled"],
  pickup_ready: ["delivered", "cancelled"],
  out_for_delivery: ["delivered"],
  delivered: [],
  rejected: [],
  cancelled: [],
};

// Delivery-specific transitions (skips pickup_ready)
export const DELIVERY_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ["preparing", "rejected"],
  preparing: ["ready", "cancelled"],
  ready: ["out_for_delivery", "cancelled"],
  pickup_ready: [], // Not used for delivery
  out_for_delivery: ["delivered"],
  delivered: [],
  rejected: [],
  cancelled: [],
};

// Pickup-specific transitions (skips out_for_delivery)
export const PICKUP_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ["preparing", "rejected"],
  preparing: ["ready", "cancelled"],
  ready: ["pickup_ready", "cancelled"],
  pickup_ready: ["delivered", "cancelled"],
  out_for_delivery: [], // Not used for pickup
  delivered: [],
  rejected: [],
  cancelled: [],
};

// Order status labels
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Novos Pedidos",
  preparing: "Em Preparo",
  ready: "Pronto",
  pickup_ready: "Aguardando Retirada",
  out_for_delivery: "Em Entrega",
  delivered: "Entregue",
  rejected: "Recusado",
  cancelled: "Cancelado",
};

// Kanban column order (excluding rejected/cancelled)
export const KANBAN_COLUMNS: OrderStatus[] = [
  "pending",
  "preparing",
  "ready",
  "pickup_ready",
  "out_for_delivery",
  "delivered",
];
