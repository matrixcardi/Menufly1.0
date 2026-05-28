import { Search, Share2 } from "lucide-react";
import { restaurantInfo } from "@/data/menu-data";

export function MenuHeader() {
  const { name, isOpen, opensAt, minOrder } = restaurantInfo;

  return (
    <header className="bg-card sticky top-0 z-50 border-b border-border">
      <div className="px-4 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-foreground">{name}</h1>
          <div className="flex items-center gap-2">
            <button className="p-2 rounded-full hover:bg-secondary transition-colors">
              <Search className="w-5 h-5 text-muted-foreground" />
            </button>
            <button className="p-2 rounded-full hover:bg-secondary transition-colors">
              <Share2 className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
        </div>
        
        <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
          <span>Abre hoje às {opensAt}</span>
          <span>•</span>
          <span>Pedido mín. R$ {minOrder.toFixed(2).replace(".", ",")}</span>
        </div>

        {!isOpen && (
          <div className="mt-2 py-1.5 px-3 bg-warning/10 text-warning rounded-md text-sm text-center font-medium">
            Loja fechada, abre às {opensAt}
          </div>
        )}
      </div>
    </header>
  );
}
