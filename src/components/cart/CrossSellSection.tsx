import { Flame } from "lucide-react";
import { Product } from "@/data/menu-data";

interface CrossSellSectionProps {
  products: Product[];
  onProductClick: (product: Product) => void;
}

export function CrossSellSection({ products, onProductClick }: CrossSellSectionProps) {
  const formatPrice = (price: number) => `R$ ${price.toFixed(2).replace(".", ",")}`;

  return (
    <div className="px-4 pb-4">
      <div className="flex items-center gap-2 mb-3">
        <Flame className="w-5 h-5 text-warning" />
        <h3 className="font-bold text-sm">Para matar sua fome</h3>
      </div>
      
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
        {products.map((product) => (
          <button
            key={product.id}
            onClick={() => onProductClick(product)}
            className="flex-shrink-0 w-32 bg-card rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all group"
          >
            <div className="relative h-20 overflow-hidden">
              <img
                src={product.image}
                alt={product.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              {product.cashback && (
                <span className="absolute top-1 right-1 bg-cashback text-cashback-foreground text-[10px] font-semibold px-1.5 py-0.5 rounded">
                  {product.cashback}%
                </span>
              )}
            </div>
            <div className="p-2">
              <h4 className="font-medium text-xs line-clamp-2 text-left">
                {product.name}
              </h4>
              <p className="text-primary font-bold text-xs mt-1">
                {formatPrice(product.price)}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
