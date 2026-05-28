import { Product } from "@/hooks/useRestaurantStatus";
import { ProductCard } from "./ProductCard";

interface PopularSectionProps {
  products: Product[];
  onProductClick?: (product: Product) => void;
}

export function PopularSection({ products, onProductClick }: PopularSectionProps) {
  const popularProducts = products.filter((p) => p.is_popular);

  // Map products to the format expected by ProductCard
  const mappedProducts = popularProducts.map(p => ({
    id: p.id,
    name: p.name,
    description: p.description || "",
    price: p.price,
    image: p.image_url || "",
    category: p.category_id || "",
    cashback: p.cashback || undefined,
    isPopular: p.is_popular || undefined,
  }));

  if (mappedProducts.length === 0) {
    return null;
  }

  return (
    <section className="py-4 animate-fade-in">
      <h2 className="text-lg font-bold text-foreground px-4 mb-3">
        Os mais pedidos
      </h2>
      <div className="flex gap-3 px-4 overflow-x-auto scrollbar-hide pb-2 items-start">
        {mappedProducts.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            variant="vertical"
            onClick={() => {
              const originalProduct = popularProducts.find(p => p.id === product.id);
              if (originalProduct) {
                onProductClick?.(originalProduct);
              }
            }}
          />
        ))}
      </div>
    </section>
  );
}
