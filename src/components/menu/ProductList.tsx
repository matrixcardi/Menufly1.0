import { useRef, useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Product, Category, ProductCategoryLink } from "@/hooks/useRestaurantBySlug";
import { ProductCard } from "./ProductCard";

interface ProductListProps {
  activeCategory: string;
  categories: Category[];
  products: Product[];
  productCategoryLinks?: ProductCategoryLink[];
  onProductClick?: (product: Product) => void;
  onVisibleCategoryChange?: (categoryId: string) => void;
}

export function ProductList({ activeCategory, categories, products, productCategoryLinks, onProductClick, onVisibleCategoryChange }: ProductListProps) {
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const isExpanded = (cat: Category) => {
    if (!cat.start_collapsed) return true;
    return !!expanded[cat.id];
  };

  const toggleCategory = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Track which category is currently most visible for sticky tab highlight
  useEffect(() => {
    if (!onVisibleCategoryChange || categories.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Find the topmost visible section
        let topEntry: IntersectionObserverEntry | null = null;
        for (const entry of entries) {
          if (entry.isIntersecting) {
            if (!topEntry || entry.boundingClientRect.top < topEntry.boundingClientRect.top) {
              topEntry = entry;
            }
          }
        }
        if (topEntry) {
          const id = (topEntry.target as HTMLElement).dataset.categoryId;
          if (id) onVisibleCategoryChange(id);
        }
      },
      { rootMargin: "-80px 0px -60% 0px", threshold: 0 }
    );

    Object.values(sectionRefs.current).forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [categories, onVisibleCategoryChange]);

  const getProductsForCategory = (categoryId: string) => {
    if (productCategoryLinks && productCategoryLinks.length > 0) {
      return products.filter(p => productCategoryLinks.some(pc => pc.product_id === p.id && pc.category_id === categoryId));
    }
    return products.filter((p) => p.category_id === categoryId);
  };

  return (
    <section className="pb-24">
      {categories.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground">
          Nenhuma categoria cadastrada
        </div>
      ) : (
        categories.map((category) => {
          const catProducts = getProductsForCategory(category.id);

          const mappedProducts = catProducts.map(p => ({
            id: p.id,
            name: p.name,
            description: p.description || "",
            price: p.price,
            image: p.image_url || "",
            category: category.id,
            cashback: p.cashback || undefined,
            isPopular: p.is_popular || undefined,
          }));

          return (
            <div
              key={category.id}
              id={`category-${category.id}`}
              data-category-id={category.id}
              className="scroll-mt-28"
              ref={(el) => { sectionRefs.current[category.id] = el; }}
            >
              {category.start_collapsed ? (
                <button
                  type="button"
                  onClick={() => toggleCategory(category.id)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-secondary/50 text-left"
                  aria-expanded={isExpanded(category)}
                >
                  <h2 className="text-lg font-bold text-foreground">
                    {category.name}
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                      ({mappedProducts.length})
                    </span>
                  </h2>
                  <ChevronDown
                    className={`w-5 h-5 text-muted-foreground transition-transform ${isExpanded(category) ? "rotate-180" : ""}`}
                  />
                </button>
              ) : (
                <h2 className="text-lg font-bold text-foreground px-4 py-3 bg-secondary/50">
                  {category.name}
                </h2>
              )}
              {isExpanded(category) && (mappedProducts.length > 0 ? (
                <div>
                  {mappedProducts.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      variant="horizontal"
                      onClick={() => {
                        const originalProduct = catProducts.find(p => p.id === product.id);
                        if (originalProduct) {
                          onProductClick?.(originalProduct);
                        }
                      }}
                    />
                  ))}
                </div>
              ) : (
                <div className="px-4 py-3 text-sm text-muted-foreground">
                  Nenhum produto nesta categoria.
                </div>
              ))}
            </div>
          );
        })
        )}
    </section>
  );
}
