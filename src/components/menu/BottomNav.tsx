import { Home, ShoppingBag, Tag, ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCart } from "@/contexts/CartContext";
import { useOrderHistory } from "@/hooks/useOrderHistory";

interface BottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onCartClick: () => void;
}

const navItems = [
  { id: "inicio", icon: Home, label: "Início" },
  { id: "pedidos", icon: ShoppingBag, label: "Pedidos" },
  { id: "promos", icon: Tag, label: "Promos" },
];

export function BottomNav({ activeTab, onTabChange, onCartClick }: BottomNavProps) {
  const { itemCount } = useCart();
  const { orders } = useOrderHistory();
  
  // Count active orders (not delivered)
  const terminalStatuses = ["delivered", "cancelled", "rejected"];
  const activeOrdersCount = orders.filter(o => !terminalStatuses.includes(o.status || "")).length;

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50 safe-area-bottom max-w-md mx-auto">
      <div className="flex items-center justify-around py-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          const showBadge = item.id === "pedidos" && activeOrdersCount > 0;
          
          const isPromos = item.id === "promos";
          
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={cn(
                "flex flex-col items-center gap-0.5 px-4 py-1 transition-colors",
                isPromos
                  ? isActive ? "text-orange-500" : "text-orange-400"
                  : isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              <div className="relative">
                <Icon className={cn(
                  "w-6 h-6",
                  isPromos && isActive && "fill-orange-500/20",
                  !isPromos && isActive && "fill-primary/20"
                )} />
                {showBadge && (
                  <span className="absolute -top-2 -right-2 w-5 h-5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center animate-scale-in">
                    {activeOrdersCount > 9 ? "9+" : activeOrdersCount}
                  </span>
                )}
              </div>
              <span className={cn("text-xs font-bold", isPromos && "tracking-wide")}>{item.label}</span>
            </button>
          );
        })}
        
        {/* Cart Button with Badge */}
        <button
          onClick={onCartClick}
          className="flex flex-col items-center gap-0.5 px-4 py-1 transition-colors text-muted-foreground relative"
        >
          <div className="relative">
            <ShoppingCart className="w-6 h-6" />
            {itemCount > 0 && (
              <span className="absolute -top-2 -right-2 w-5 h-5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center animate-scale-in">
                {itemCount > 9 ? "9+" : itemCount}
              </span>
            )}
          </div>
          <span className="text-xs font-medium">Carrinho</span>
        </button>
      </div>
    </nav>
  );
}
