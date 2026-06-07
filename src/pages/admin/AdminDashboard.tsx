import { useEffect, useState, useRef } from "react";
import { useRestaurantContext } from "@/contexts/RestaurantContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { getUserFriendlyError } from "@/lib/error-handler";
import { logger } from "@/lib/logger";
import {
  Plus,
  Pencil,
  Trash2,
  Package,
  LayoutGrid,
  ListPlus,
  Star,
  Upload,
  ImageIcon,
  Loader2,
  X,
  GripVertical,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AddonGroupsSection from "@/components/admin/AddonGroupsSection";
import ProductAddonLinker from "@/components/admin/ProductAddonLinker";
import InlineAddonLinker from "@/components/admin/InlineAddonLinker";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { SortableProductItem } from "@/components/admin/SortableProductItem";
import { SortableCategoryItem } from "@/components/admin/SortableCategoryItem";
import { DraggableRow } from "@/components/admin/DraggableRow";

interface Category {
  id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  start_collapsed?: boolean;
}

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  cashback: number;
  is_popular: boolean;
  is_active: boolean;
  category_id: string | null;
  sort_order: number;
  category_ids?: string[];
}

interface ProductCategory {
  product_id: string;
  category_id: string;
}

export default function AdminDashboard() {
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [productCategories, setProductCategories] = useState<ProductCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingProduct, setSavingProduct] = useState(false);
  const [savingCategory, setSavingCategory] = useState(false);
  const { toast } = useToast();

  // Product form state
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState({
    name: "",
    description: "",
    price: "",
    image_url: "",
    cashback: "0",
    is_popular: false,
    is_active: true,
    category_ids: [] as string[],
  });
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Category form state
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [categoryStartCollapsed, setCategoryStartCollapsed] = useState(false);
  
  // Inline category creation state (inside product dialog)
  const [showInlineCategoryInput, setShowInlineCategoryInput] = useState(false);
  const [newInlineCategoryName, setNewInlineCategoryName] = useState("");
  const [savingInlineCategory, setSavingInlineCategory] = useState(false);

  // Addon linker state
  const [addonLinkerProduct, setAddonLinkerProduct] = useState<Product | null>(null);

  // Category expand state for drag reorder
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const toggleExpandCategory = (id: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getProductsForCategory = (categoryId: string) => {
    const productIds = productCategories
      .filter(pc => pc.category_id === categoryId)
      .map(pc => pc.product_id);
    return products
      .filter(p => productIds.includes(p.id))
      .sort((a, b) => a.sort_order - b.sort_order);
  };

  const getUncategorizedProducts = () => {
    const categorizedIds = new Set(productCategories.map(pc => pc.product_id));
    return products.filter(p => !categorizedIds.has(p.id)).sort((a, b) => a.sort_order - b.sort_order);
  };

  const handleDragEnd = async (event: DragEndEvent, categoryId: string) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const catProducts = categoryId
      ? getProductsForCategory(categoryId)
      : getUncategorizedProducts();

    const oldIndex = catProducts.findIndex(p => p.id === active.id);
    const newIndex = catProducts.findIndex(p => p.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(catProducts, oldIndex, newIndex);

    // Optimistic update
    const updates = reordered.map((p, i) => ({ ...p, sort_order: i }));
    setProducts(prev => {
      const updatedIds = new Set(updates.map(u => u.id));
      const others = prev.filter(p => !updatedIds.has(p.id));
      return [...others, ...updates];
    });

    // Persist
    try {
      await Promise.all(
        updates.map(p => supabase.from("products").update({ sort_order: p.sort_order }).eq("id", p.id))
      );
    } catch (error) {
      logger.error("Error reordering products:", error);
      toast({ title: "Erro ao reordenar", variant: "destructive" });
      fetchData();
    }
  };

  const handleCategoryDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = categories.findIndex(c => c.id === active.id);
    const newIndex = categories.findIndex(c => c.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(categories, oldIndex, newIndex);
    const updates = reordered.map((c, i) => ({ ...c, sort_order: i }));
    setCategories(updates);

    try {
      await Promise.all(
        updates.map(c => supabase.from("categories").update({ sort_order: c.sort_order }).eq("id", c.id))
      );
    } catch (error) {
      logger.error("Error reordering categories:", error);
      toast({ title: "Erro ao reordenar categorias", variant: "destructive" });
      fetchData();
    }
  };

  const { selectedRestaurantId: ctxSelectedId, selectedRestaurantIds } = useRestaurantContext();
  const ctxRestaurantId = ctxSelectedId === "all" ? selectedRestaurantIds[0] : ctxSelectedId;

  useEffect(() => {
    fetchData();
  }, [ctxRestaurantId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (!ctxRestaurantId) {
        setLoading(false);
        return;
      }

      setRestaurantId(ctxRestaurantId);

      const [categoriesRes, productsRes, productCatsRes] = await Promise.all([
        supabase
          .from("categories")
          .select("*")
          .eq("restaurant_id", ctxRestaurantId)
          .order("sort_order"),
        supabase
          .from("products")
          .select("*")
          .eq("restaurant_id", ctxRestaurantId)
          .order("sort_order")
          .order("created_at", { ascending: false }),
        supabase
          .from("product_categories")
          .select("product_id, category_id")
          .in("product_id", (await supabase
            .from("products")
            .select("id")
            .eq("restaurant_id", ctxRestaurantId)).data?.map(p => p.id) || []),
      ]);

      setCategories(categoriesRes.data || []);
      setProducts(productsRes.data || []);
      setProductCategories(productCatsRes.data || []);
    } catch (error) {
      logger.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Category handlers
  const handleSaveCategory = async () => {
    if (!restaurantId || !categoryName.trim()) {
      toast({ title: "Erro", description: "Nome da categoria é obrigatório", variant: "destructive" });
      return;
    }

    setSavingCategory(true);
    try {
      if (editingCategory) {
        const { error } = await supabase
          .from("categories")
          .update({ name: categoryName, start_collapsed: categoryStartCollapsed })
          .eq("id", editingCategory.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("categories").insert({
          restaurant_id: restaurantId,
          name: categoryName,
          sort_order: categories.length,
          start_collapsed: categoryStartCollapsed,
        });
        if (error) throw error;
      }
      toast({ title: editingCategory ? "Categoria atualizada!" : "Categoria criada!" });
      setCategoryDialogOpen(false);
      setCategoryName("");
      setCategoryStartCollapsed(false);
      setEditingCategory(null);
      fetchData();
    } catch (error) {
      logger.error("Error saving category:", error);
      toast({ title: "Erro", description: getUserFriendlyError(error), variant: "destructive" });
    } finally {
      setSavingCategory(false);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta categoria?")) return;
    try {
      const { error } = await supabase.from("categories").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Categoria excluída!" });
      fetchData();
    } catch (error) {
      logger.error("Error deleting category:", error);
      toast({ title: "Erro", description: getUserFriendlyError(error), variant: "destructive" });
    }
  };

  const handleToggleCategory = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase.from("categories").update({ is_active: isActive }).eq("id", id);
      if (error) throw error;
      setCategories(prev => prev.map(c => c.id === id ? { ...c, is_active: isActive } : c));
      toast({ title: isActive ? "Categoria ativada!" : "Categoria desativada!" });
    } catch (error) {
      logger.error("Error toggling category:", error);
      toast({ title: "Erro", description: getUserFriendlyError(error), variant: "destructive" });
    }
  };

  const handleMoveProduct = async (productId: string, direction: "up" | "down", categoryId: string) => {
    const categoryProducts = categoryId 
      ? getProductsForCategory(categoryId)
      : getUncategorizedProducts();
    
    const index = categoryProducts.findIndex(p => p.id === productId);
    if (index === -1) return;
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === categoryProducts.length - 1) return;

    const swapIndex = direction === "up" ? index - 1 : index + 1;
    const currentProduct = categoryProducts[index];
    const swapProduct = categoryProducts[swapIndex];

    try {
      await Promise.all([
        supabase.from("products").update({ sort_order: swapProduct.sort_order }).eq("id", currentProduct.id),
        supabase.from("products").update({ sort_order: currentProduct.sort_order }).eq("id", swapProduct.id),
      ]);
      
      setProducts(prev => prev.map(p => {
        if (p.id === currentProduct.id) return { ...p, sort_order: swapProduct.sort_order };
        if (p.id === swapProduct.id) return { ...p, sort_order: currentProduct.sort_order };
        return p;
      }));
    } catch (error) {
      logger.error("Error reordering products:", error);
      toast({ title: "Erro ao reordenar", variant: "destructive" });
    }
  };

  // Image upload handler
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast({ title: "Erro", description: "Por favor, selecione uma imagem válida.", variant: "destructive" });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Erro", description: "A imagem deve ter no máximo 5MB.", variant: "destructive" });
      return;
    }

    setIsUploadingImage(true);

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Create unique file name
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("product-images")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("product-images")
        .getPublicUrl(fileName);

      setProductForm({ ...productForm, image_url: publicUrl });
      setImagePreview(publicUrl);
      toast({ title: "Imagem enviada com sucesso!" });
    } catch (error) {
      logger.error("Error uploading image:", error);
      toast({ title: "Erro", description: getUserFriendlyError(error), variant: "destructive" });
    } finally {
      setIsUploadingImage(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemoveImage = () => {
    setProductForm({ ...productForm, image_url: "" });
    setImagePreview(null);
  };

  // Product handlers
  const handleSaveProduct = async () => {
    if (!restaurantId || !productForm.name.trim() || !productForm.price) {
      toast({ title: "Erro", description: "Nome e preço são obrigatórios", variant: "destructive" });
      return;
    }

    setSavingProduct(true);
    const productData = {
      restaurant_id: restaurantId,
      name: productForm.name,
      description: productForm.description || null,
      price: parseFloat(productForm.price),
      image_url: productForm.image_url || null,
      cashback: parseInt(productForm.cashback) || 0,
      is_popular: productForm.is_popular,
      is_active: productForm.is_active,
      category_id: productForm.category_ids[0] || null,
    };

    try {
      let productId: string;
      if (editingProduct) {
        const { error } = await supabase
          .from("products")
          .update(productData)
          .eq("id", editingProduct.id);
        if (error) throw error;
        productId = editingProduct.id;
      } else {
        const { data, error } = await supabase.from("products").insert(productData).select("id").single();
        if (error) throw error;
        productId = data.id;
      }

      // Sync product_categories
      await supabase.from("product_categories").delete().eq("product_id", productId);
      if (productForm.category_ids.length > 0) {
        const links = productForm.category_ids.map(catId => ({
          product_id: productId,
          category_id: catId,
        }));
        await supabase.from("product_categories").insert(links);
      }

      toast({ title: editingProduct ? "Produto atualizado!" : "Produto criado!" });
      setProductDialogOpen(false);
      resetProductForm();
      fetchData();
    } catch (error) {
      logger.error("Error saving product:", error);
      toast({ title: "Erro", description: getUserFriendlyError(error), variant: "destructive" });
    } finally {
      setSavingProduct(false);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este produto?")) return;
    try {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Produto excluído!" });
      fetchData();
    } catch (error) {
      logger.error("Error deleting product:", error);
      toast({ title: "Erro", description: getUserFriendlyError(error), variant: "destructive" });
    }
  };

  const resetProductForm = () => {
    setProductForm({
      name: "",
      description: "",
      price: "",
      image_url: "",
      cashback: "0",
      is_popular: false,
      is_active: true,
      category_ids: [],
    });
    setEditingProduct(null);
    setImagePreview(null);
    setShowInlineCategoryInput(false);
    setNewInlineCategoryName("");
  };
  
  // Inline category creation handler (inside product dialog)
  const handleCreateInlineCategory = async () => {
    if (!restaurantId || !newInlineCategoryName.trim()) {
      toast({ title: "Erro", description: "Nome da categoria é obrigatório", variant: "destructive" });
      return;
    }

    setSavingInlineCategory(true);
    try {
      const { data, error } = await supabase
        .from("categories")
        .insert({
          restaurant_id: restaurantId,
          name: newInlineCategoryName.trim(),
          sort_order: categories.length,
        })
        .select()
        .single();

      if (error) throw error;
      
      // Update categories list and select the new category
      setCategories([...categories, data]);
      setProductForm({ ...productForm, category_ids: [...productForm.category_ids, data.id] });
      setShowInlineCategoryInput(false);
      setNewInlineCategoryName("");
      toast({ title: "Categoria criada!" });
    } catch (error) {
      logger.error("Error creating inline category:", error);
      toast({ title: "Erro", description: getUserFriendlyError(error), variant: "destructive" });
    } finally {
      setSavingInlineCategory(false);
    }
  };

  const openEditProduct = (product: Product) => {
    setEditingProduct(product);
    const catIds = productCategories
      .filter(pc => pc.product_id === product.id)
      .map(pc => pc.category_id);
    setProductForm({
      name: product.name,
      description: product.description || "",
      price: product.price.toString(),
      image_url: product.image_url || "",
      cashback: product.cashback.toString(),
      is_popular: product.is_popular,
      is_active: product.is_active,
      category_ids: catIds.length > 0 ? catIds : (product.category_id ? [product.category_id] : []),
    });
    setImagePreview(product.image_url || null);
    setProductDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-3 md:space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Cardápio Digital</h1>
        <p className="text-muted-foreground">
          Gerencie seus produtos e categorias
        </p>
      </div>

      <Tabs defaultValue="categories" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="categories" className="gap-2">
            <LayoutGrid className="w-4 h-4" />
            Categorias
          </TabsTrigger>
          <TabsTrigger value="products" className="gap-2">
            <Package className="w-4 h-4" />
            Produtos
          </TabsTrigger>
          <TabsTrigger value="addons" className="gap-2">
            <ListPlus className="w-4 h-4" />
            Adicionais
          </TabsTrigger>
        </TabsList>

        {/* Products Tab */}
        <TabsContent value="products" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">
              {products.length} produto(s)
            </h2>
            <Dialog open={productDialogOpen} onOpenChange={(open) => {
              setProductDialogOpen(open);
              if (!open) resetProductForm();
            }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Novo Produto
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingProduct ? "Editar Produto" : "Novo Produto"}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4 pb-2">
                  <div className="space-y-2">
                    <Label>Nome *</Label>
                    <Input
                      value={productForm.name}
                      onChange={(e) =>
                        setProductForm({ ...productForm, name: e.target.value })
                      }
                      placeholder="Ex: Smash Burger"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Descrição</Label>
                    <Textarea
                      value={productForm.description}
                      onChange={(e) =>
                        setProductForm({
                          ...productForm,
                          description: e.target.value,
                        })
                      }
                      placeholder="Descreva seu produto..."
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Preço (R$) *</Label>
                      <CurrencyInput
                        value={typeof productForm.price === 'string' ? parseFloat(productForm.price) || 0 : productForm.price}
                        onChange={(value) =>
                          setProductForm({ ...productForm, price: value })
                        }
                        placeholder="0,00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Cashback (%)</Label>
                      <Input
                        type="number"
                        value={productForm.cashback}
                        onChange={(e) =>
                          setProductForm({
                            ...productForm,
                            cashback: e.target.value,
                          })
                        }
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Imagem do Produto</Label>
                    
                    {/* Image Preview */}
                    {(imagePreview || productForm.image_url) && (
                      <div className="relative w-full h-40 bg-muted rounded-lg overflow-hidden">
                        <img
                          src={imagePreview || productForm.image_url}
                          alt="Preview"
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={handleRemoveImage}
                          className="absolute top-2 right-2 p-1 bg-destructive text-destructive-foreground rounded-full hover:bg-destructive/90"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}

                    {/* Upload Button */}
                    {!imagePreview && !productForm.image_url && (
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full h-32 border-2 border-dashed border-muted-foreground/25 rounded-lg flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors"
                      >
                        {isUploadingImage ? (
                          <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
                        ) : (
                          <>
                            <ImageIcon className="w-8 h-8 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">Clique para fazer upload</span>
                            <span className="text-xs text-muted-foreground">PNG, JPG até 5MB</span>
                          </>
                        )}
                      </div>
                    )}

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />

                    {/* Or URL input */}
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex-1 h-px bg-border" />
                      <span className="text-xs text-muted-foreground">ou cole uma URL</span>
                      <div className="flex-1 h-px bg-border" />
                    </div>
                    
                    <Input
                      value={productForm.image_url}
                      onChange={(e) => {
                        setProductForm({
                          ...productForm,
                          image_url: e.target.value,
                        });
                        setImagePreview(e.target.value || null);
                      }}
                      placeholder="https://..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Categorias</Label>
                    {!showInlineCategoryInput ? (
                      <div className="space-y-2">
                        <div className="border rounded-lg p-3 space-y-2 max-h-40 overflow-y-auto">
                          {categories.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Nenhuma categoria criada</p>
                          ) : (
                            categories.map((cat) => (
                              <label key={cat.id} className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={productForm.category_ids.includes(cat.id)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setProductForm({ ...productForm, category_ids: [...productForm.category_ids, cat.id] });
                                    } else {
                                      setProductForm({ ...productForm, category_ids: productForm.category_ids.filter(id => id !== cat.id) });
                                    }
                                  }}
                                  className="rounded border-input"
                                />
                                <span className="text-sm">{cat.name}</span>
                              </label>
                            ))
                          )}
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setShowInlineCategoryInput(true)}
                          className="w-full"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Criar nova categoria
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <Input
                            value={newInlineCategoryName}
                            onChange={(e) => setNewInlineCategoryName(e.target.value)}
                            placeholder="Nome da categoria"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleCreateInlineCategory();
                              }
                              if (e.key === "Escape") {
                                setShowInlineCategoryInput(false);
                                setNewInlineCategoryName("");
                              }
                            }}
                          />
                          <Button
                            type="button"
                            size="icon"
                            onClick={handleCreateInlineCategory}
                            disabled={savingInlineCategory || !newInlineCategoryName.trim()}
                          >
                            {savingInlineCategory ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Plus className="w-4 h-4" />
                            )}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setShowInlineCategoryInput(false);
                              setNewInlineCategoryName("");
                            }}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Pressione Enter para criar ou Esc para cancelar
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={productForm.is_active}
                      onCheckedChange={(checked) =>
                        setProductForm({ ...productForm, is_active: checked })
                      }
                    />
                    <Label>Deixar produto ativo no cardápio</Label>
                  </div>

                  {/* Inline Addon Groups Linker (only when editing) */}
                  {editingProduct && restaurantId && (
                    <InlineAddonLinker productId={editingProduct.id} restaurantId={restaurantId} />
                  )}

                  <Button onClick={handleSaveProduct} className="w-full" disabled={savingProduct}>
                    {savingProduct ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      editingProduct ? "Salvar Alterações" : "Criar Produto"
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="space-y-6">
            {categories.length === 0 && products.length === 0 ? (
              <div className="text-center py-12 bg-muted/30 rounded-lg border border-dashed">
                <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  Nenhum produto cadastrado ainda
                </p>
              </div>
            ) : (
              <>
                {/* Products without category */}
                {(() => {
                  const uncategorized = getUncategorizedProducts();
                  if (uncategorized.length === 0) return null;
                  return (
                    <div>
                      <h3 className="text-sm font-semibold text-muted-foreground mb-2">Sem categoria</h3>
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={(event) => handleDragEnd(event, "")}
                      >
                        <SortableContext items={uncategorized.map(p => p.id)} strategy={verticalListSortingStrategy}>
                          <div className="grid gap-2">
                            {uncategorized.map((product) => (
                              <DraggableRow key={product.id} id={product.id}>
                                <div className="w-12 h-12 bg-muted rounded-lg overflow-hidden flex-shrink-0">
                              {product.image_url ? (
                                <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Package className="w-4 h-4 text-muted-foreground" />
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <h3 className="font-medium text-sm truncate">{product.name}</h3>
                                {product.is_popular && <Star className="w-3 h-3 text-amber-500 fill-amber-500" />}
                                {!product.is_active && <span className="text-xs px-1.5 py-0.5 bg-muted rounded">Inativo</span>}
                              </div>
                              <p className="text-xs font-semibold text-primary">R$ {product.price.toFixed(2)}</p>
                            </div>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditProduct(product)}>
                                <Pencil className="w-3 h-3" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => handleDeleteProduct(product.id)}>
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                              </DraggableRow>
                            ))}
                          </div>
                        </SortableContext>
                      </DndContext>
                    </div>
                  );
                })()}

                {/* Products grouped by category */}
                {categories.map(category => {
                  const catProducts = getProductsForCategory(category.id);
                  
                  if (catProducts.length === 0) return null;
                  
                  return (
                    <div key={category.id}>
                      <h3 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-2">
                        {category.name}
                        {!category.is_active && <span className="text-xs px-1.5 py-0.5 bg-muted rounded">Oculta</span>}
                        <span className="text-xs font-normal">({catProducts.length})</span>
                      </h3>
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={(event) => handleDragEnd(event, category.id)}
                      >
                        <SortableContext items={catProducts.map(p => p.id)} strategy={verticalListSortingStrategy}>
                          <div className="grid gap-2">
                            {catProducts.map((product) => (
                              <DraggableRow key={product.id} id={product.id}>
                                <div className="w-12 h-12 bg-muted rounded-lg overflow-hidden flex-shrink-0">
                              {product.image_url ? (
                                <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Package className="w-4 h-4 text-muted-foreground" />
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <h3 className="font-medium text-sm truncate">{product.name}</h3>
                                {product.is_popular && <Star className="w-3 h-3 text-amber-500 fill-amber-500" />}
                                {!product.is_active && <span className="text-xs px-1.5 py-0.5 bg-muted rounded">Inativo</span>}
                              </div>
                              <p className="text-xs font-semibold text-primary">R$ {product.price.toFixed(2)}</p>
                            </div>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" title="Gerenciar adicionais" className="h-8 w-8"
                                onClick={() => setAddonLinkerProduct(product)}>
                                <ListPlus className="w-3 h-3" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditProduct(product)}>
                                <Pencil className="w-3 h-3" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => handleDeleteProduct(product.id)}>
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                              </DraggableRow>
                            ))}
                          </div>
                        </SortableContext>
                      </DndContext>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </TabsContent>

        {/* Categories Tab */}
        <TabsContent value="categories" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">
              {categories.length} categoria(s)
            </h2>
            <Dialog open={categoryDialogOpen} onOpenChange={(open) => {
              setCategoryDialogOpen(open);
              if (!open) {
                setCategoryName("");
                setCategoryStartCollapsed(false);
                setEditingCategory(null);
              }
            }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Nova Categoria
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {editingCategory ? "Editar Categoria" : "Nova Categoria"}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>Nome da categoria</Label>
                    <Input
                      value={categoryName}
                      onChange={(e) => setCategoryName(e.target.value)}
                      placeholder="Ex: Smash Burgers"
                    />
                  </div>
                  <div className="flex items-start justify-between gap-3 rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <Label htmlFor="start-collapsed" className="cursor-pointer">
                        Iniciar fechada no cardápio
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        A categoria aparece recolhida e o cliente precisa clicar para ver os produtos.
                      </p>
                    </div>
                    <Switch
                      id="start-collapsed"
                      checked={categoryStartCollapsed}
                      onCheckedChange={setCategoryStartCollapsed}
                    />
                  </div>
                  <Button onClick={handleSaveCategory} className="w-full" disabled={savingCategory}>
                    {savingCategory ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      editingCategory ? "Salvar" : "Criar Categoria"
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid gap-3">
            {categories.length === 0 ? (
              <div className="text-center py-12 bg-muted/30 rounded-lg border border-dashed">
                <LayoutGrid className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  Nenhuma categoria cadastrada ainda
                </p>
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleCategoryDragEnd}
              >
                <SortableContext
                  items={categories.map(c => c.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {categories.map((category) => {
                    const catProducts = getProductsForCategory(category.id);
                    const isExpanded = expandedCategories.has(category.id);

                    return (
                      <SortableCategoryItem key={category.id} id={category.id}>
                        <div className={`flex items-center justify-between p-4 pl-2 ${!category.is_active ? "opacity-60" : ""}`}>
                          <div className="flex items-center gap-3">
                            <Switch
                              checked={category.is_active}
                              onCheckedChange={(checked) => handleToggleCategory(category.id, checked)}
                            />
                            <button
                              className="flex items-center gap-2 hover:text-primary transition-colors"
                              onClick={() => toggleExpandCategory(category.id)}
                            >
                              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                              <span className="font-medium">{category.name}</span>
                              <span className="text-xs text-muted-foreground">({catProducts.length})</span>
                            </button>
                            {!category.is_active && (
                              <span className="text-xs px-2 py-0.5 bg-muted rounded">Oculta</span>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setEditingCategory(category);
                                setCategoryName(category.name);
                                setCategoryStartCollapsed(!!category.start_collapsed);
                                setCategoryDialogOpen(true);
                              }}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              onClick={() => handleDeleteCategory(category.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>

                        {isExpanded && catProducts.length > 0 && (
                          <div className="px-4 pb-4 space-y-2 border-t pt-3">
                            <p className="text-xs text-muted-foreground mb-2">Arraste para reordenar os produtos</p>
                            <DndContext
                              sensors={sensors}
                              collisionDetection={closestCenter}
                              onDragEnd={(event) => handleDragEnd(event, category.id)}
                            >
                              <SortableContext
                                items={catProducts.map(p => p.id)}
                                strategy={verticalListSortingStrategy}
                              >
                                {catProducts.map((product) => (
                                  <SortableProductItem
                                    key={product.id}
                                    id={product.id}
                                    name={product.name}
                                    price={product.price}
                                    image_url={product.image_url}
                                    is_active={product.is_active !== false}
                                    onToggleActive={async (productId, active) => {
                                      await supabase.from("products").update({ is_active: active }).eq("id", productId);
                                      setProducts(prev => prev.map(p => p.id === productId ? { ...p, is_active: active } : p));
                                      toast({ title: active ? "Produto ativado" : "Produto desativado" });
                                    }}
                                  />
                                ))}
                              </SortableContext>
                            </DndContext>
                          </div>
                        )}

                        {isExpanded && catProducts.length === 0 && (
                          <div className="px-4 pb-4 border-t pt-3">
                            <p className="text-sm text-muted-foreground text-center py-4">Nenhum produto nesta categoria</p>
                          </div>
                        )}
                      </SortableCategoryItem>
                    );
                  })}
                </SortableContext>
              </DndContext>
            )}
          </div>
        </TabsContent>

        {/* Addons Tab */}
        <TabsContent value="addons" className="space-y-4">
          {restaurantId && <AddonGroupsSection restaurantId={restaurantId} />}
        </TabsContent>
      </Tabs>

      {/* Product Addon Linker */}
      {restaurantId && addonLinkerProduct && (
        <ProductAddonLinker
          productId={addonLinkerProduct.id}
          productName={addonLinkerProduct.name}
          restaurantId={restaurantId}
          open={!!addonLinkerProduct}
          onOpenChange={(open) => {
            if (!open) setAddonLinkerProduct(null);
          }}
        />
      )}
    </div>
  );
}
