import { Product } from "@/data/menu-data";
import { cn } from "@/lib/utils";

interface ProductCardProps {
  product: Product;
  variant?: "horizontal" | "vertical";
  onClick?: () => void;
}

export function ProductCard({ product, variant = "horizontal", onClick }: ProductCardProps) {
  const formattedPrice = `R$ ${product.price.toFixed(2).replace(".", ",")}`;

  if (variant === "vertical") {
    return (
      <button
        onClick={onClick}
        className="flex-shrink-0 w-28 animate-fade-in text-left cursor-pointer"
      >
        <div className="relative aspect-square w-28">
          <img
            src={product.image}
            alt={product.name}
            loading="lazy"
            decoding="async"
            width={112}
            height={112}
            className="w-full h-full rounded-xl object-cover shadow-md transition-transform hover:scale-105"
          />
          {product.cashback && (
            <span className="absolute bottom-2 right-2 bg-cashback text-cashback-foreground text-xs font-semibold px-2 py-0.5 rounded-md">
              {product.cashback}% cashback
            </span>
          )}
        </div>
        <h3 className="mt-2 text-sm font-semibold text-foreground line-clamp-2 leading-tight">
          {product.name}
        </h3>
        {product.description && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{product.description}</p>
        )}
        <p className="text-sm font-bold text-primary mt-1">{formattedPrice}</p>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className="flex gap-3 p-4 bg-card border-b border-border animate-fade-in w-full text-left cursor-pointer hover:bg-secondary/30 transition-colors"
    >
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-foreground text-base leading-tight">
          {product.name}
        </h3>
        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
          {product.description}
        </p>
        <p className="text-base font-bold text-primary mt-2">{formattedPrice}</p>
      </div>
      <div className="relative flex-shrink-0 aspect-square w-24">
        <img
          src={product.image}
          alt={product.name}
          loading="lazy"
          decoding="async"
          width={96}
          height={96}
          className="w-full h-full rounded-xl object-cover shadow-md transition-transform hover:scale-105"
        />
        {product.cashback && (
          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-cashback text-cashback-foreground text-xs font-semibold px-2 py-0.5 rounded-md whitespace-nowrap">
            {product.cashback}% cashback
          </span>
        )}
      </div>
    </button>
  );
}
