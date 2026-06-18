import {
  Clock,
  ChefHat,
  Package,
  HandPlatter,
  Truck,
  CheckCircle2,
  XCircle,
} from "lucide-react";

export interface StageConfig {
  label: string;
  nextLabel: string;
  bg: string;
  text: string;
  border: string;
  icon: React.ElementType;
}

export interface Driver {
  id: string;
  restaurant_id: string;
  name: string;
  phone: string;
  fixed_fee: number;
  per_ride_fee: number;
  fee_mode: string;
  is_active: boolean;
}

export const stageConfig: Record<string, StageConfig> = {
  pending: { label: "Novo", nextLabel: "Preparar", bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-300", border: "border-amber-300 dark:border-amber-700", icon: Clock },
  preparing: { label: "Preparando", nextLabel: "Pronto", bg: "bg-orange-100 dark:bg-orange-900/30", text: "text-orange-700 dark:text-orange-300", border: "border-orange-300 dark:border-orange-700", icon: ChefHat },
  ready: { label: "Pronto", nextLabel: "Enviar", bg: "bg-purple-100 dark:bg-purple-900/30", text: "text-purple-700 dark:text-purple-300", border: "border-purple-300 dark:border-purple-700", icon: Package },
  pickup_ready: { label: "Aguardando Retirada", nextLabel: "Retirado", bg: "bg-indigo-100 dark:bg-indigo-900/30", text: "text-indigo-700 dark:text-indigo-300", border: "border-indigo-300 dark:border-indigo-700", icon: HandPlatter },
  out_for_delivery: { label: "A Caminho", nextLabel: "Entregue", bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-700 dark:text-blue-300", border: "border-blue-300 dark:border-blue-700", icon: Truck },
  delivered: { label: "Entregue", nextLabel: "", bg: "bg-emerald-100 dark:bg-emerald-900/30", text: "text-emerald-700 dark:text-emerald-300", border: "border-emerald-300 dark:border-emerald-700", icon: CheckCircle2 },
  rejected: { label: "Recusado", nextLabel: "", bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-700 dark:text-red-300", border: "border-red-300 dark:border-red-700", icon: XCircle },
  cancelled: { label: "Cancelado", nextLabel: "", bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-700 dark:text-red-300", border: "border-red-300 dark:border-red-700", icon: XCircle },
};

export const stageOrder = ["pending", "preparing", "ready", "pickup_ready", "out_for_delivery", "delivered"];

export const paymentMethodLabels: Record<string, string> = { pix: "PIX", cash: "Dinheiro", card: "Cartão" };

export const formatCurrency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
