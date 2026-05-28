import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Package } from "lucide-react";
import { Switch } from "@/components/ui/switch";

interface SortableProductItemProps {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  is_active: boolean;
  onToggleActive?: (id: string, active: boolean) => void;
}

export function SortableProductItem({ id, name, price, image_url, is_active, onToggleActive }: SortableProductItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-3 bg-card border rounded-lg ${isDragging ? "shadow-lg" : ""}`}
    >
      <button
        className="cursor-grab active:cursor-grabbing touch-none text-muted-foreground hover:text-foreground"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="w-4 h-4" />
      </button>
      <Switch
        checked={is_active}
        onCheckedChange={(checked) => onToggleActive?.(id, checked)}
        className="scale-75"
      />
      <div className="w-10 h-10 bg-muted rounded-lg overflow-hidden flex-shrink-0">
        {image_url ? (
          <img src={image_url} alt={name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="w-4 h-4 text-muted-foreground" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <h4 className={`font-medium text-sm truncate ${!is_active ? "text-muted-foreground line-through" : ""}`}>{name}</h4>
        <p className="text-xs font-semibold text-primary">R$ {price.toFixed(2)}</p>
      </div>
    </div>
  );
}
