import { useRef } from "react";
import { cn } from "@/lib/utils";

interface Category {
  id: string;
  name: string;
}

interface CategoryTabsProps {
  categories: Category[];
  activeCategory: string;
  onCategoryChange: (categoryId: string) => void;
  isSticky?: boolean;
}

export function CategoryTabs({ categories, activeCategory, onCategoryChange, isSticky = false }: CategoryTabsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div className={cn(
      "bg-card border-b border-border",
      isSticky && "fixed top-0 left-0 right-0 z-50 shadow-sm max-w-md mx-auto"
    )}>
      <div
        ref={scrollRef}
        className="flex gap-1 px-4 py-2 overflow-x-auto scrollbar-hide"
      >
        {categories.map((category) => (
          <button
            key={category.id}
            onClick={() => onCategoryChange(category.id)}
            className={cn(
              "px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all",
              activeCategory === category.id
                ? "bg-primary text-primary-foreground shadow-md"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            )}
          >
            {category.name}
          </button>
        ))}
      </div>
    </div>
  );
}
