import React, { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
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
  ChevronDown,
  ChevronRight,
  Loader2,
  ListPlus,
  Upload,
  ImageIcon,
  X,
} from "lucide-react";

interface AddonGroup {
  id: string;
  name: string;
  description: string | null;
  type: string;
  required: boolean;
  min_select: number | null;
  max_select: number | null;
  sort_order: number;
  is_active: boolean;
}

interface AddonItem {
  id: string;
  addon_group_id: string;
  name: string;
  description: string | null;
  price: number;
  sort_order: number;
  is_active: boolean;
  image_url: string | null;
}

interface AddonGroupsSectionProps {
  restaurantId: string;
}

export default function AddonGroupsSection({ restaurantId }: AddonGroupsSectionProps) {
  const [groups, setGroups] = useState<AddonGroup[]>([]);
  const [items, setItems] = useState<Record<string, AddonItem[]>>({});
  const [loading, setLoading] = useState(true);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const { toast } = useToast();

  // Group form
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<AddonGroup | null>(null);
  const [savingGroup, setSavingGroup] = useState(false);
  const [groupForm, setGroupForm] = useState({
    name: "",
    description: "",
    type: "multiple",
    required: false,
    min_select: "",
    max_select: "",
  });

  // Item form
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AddonItem | null>(null);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [savingItem, setSavingItem] = useState(false);
  const [itemForm, setItemForm] = useState({
    name: "",
    description: "",
    price: "0",
    image_url: "",
  });
  const [isUploadingItemImage, setIsUploadingItemImage] = useState(false);
  const itemImageInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchGroups();
  }, [restaurantId]);

  const fetchGroups = async () => {
    try {
      const { data, error } = await supabase
        .from("addon_groups")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("sort_order");

      if (error) throw error;
      setGroups(data || []);
    } catch (error) {
      logger.error("Error fetching addon groups:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchItems = async (groupId: string) => {
    try {
      const { data, error } = await supabase
        .from("addon_items")
        .select("*")
        .eq("addon_group_id", groupId)
        .order("sort_order");

      if (error) throw error;
      setItems((prev) => ({ ...prev, [groupId]: data || [] }));
    } catch (error) {
      logger.error("Error fetching addon items:", error);
    }
  };

  const toggleExpand = (groupId: string) => {
    if (expandedGroup === groupId) {
      setExpandedGroup(null);
    } else {
      setExpandedGroup(groupId);
      if (!items[groupId]) {
        fetchItems(groupId);
      }
    }
  };

  // Group CRUD
  const resetGroupForm = () => {
    setGroupForm({ name: "", description: "", type: "multiple", required: false, min_select: "", max_select: "" });
    setEditingGroup(null);
  };

  const openEditGroup = (group: AddonGroup) => {
    setEditingGroup(group);
    setGroupForm({
      name: group.name,
      description: group.description || "",
      type: group.type,
      required: group.required,
      min_select: group.min_select?.toString() || "",
      max_select: group.max_select?.toString() || "",
    });
    setGroupDialogOpen(true);
  };

  const handleSaveGroup = async () => {
    if (!groupForm.name.trim()) {
      toast({ title: "Erro", description: "Nome é obrigatório", variant: "destructive" });
      return;
    }

    setSavingGroup(true);
    const payload = {
      restaurant_id: restaurantId,
      name: groupForm.name.trim(),
      description: groupForm.description.trim() || null,
      type: groupForm.type,
      required: groupForm.required,
      min_select: groupForm.min_select ? parseInt(groupForm.min_select) : null,
      max_select: groupForm.max_select ? parseInt(groupForm.max_select) : null,
      sort_order: editingGroup ? editingGroup.sort_order : groups.length,
    };

    try {
      if (editingGroup) {
        const { error } = await supabase.from("addon_groups").update(payload).eq("id", editingGroup.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("addon_groups").insert(payload);
        if (error) throw error;
      }
      toast({ title: editingGroup ? "Grupo atualizado!" : "Grupo criado!" });
      setGroupDialogOpen(false);
      resetGroupForm();
      fetchGroups();
    } catch (error) {
      logger.error("Error saving addon group:", error);
      toast({ title: "Erro", description: getUserFriendlyError(error), variant: "destructive" });
    } finally {
      setSavingGroup(false);
    }
  };

  const handleDeleteGroup = async (id: string) => {
    if (!confirm("Excluir este grupo e todos seus itens?")) return;
    try {
      const { error } = await supabase.from("addon_groups").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Grupo excluído!" });
      fetchGroups();
    } catch (error) {
      logger.error("Error deleting addon group:", error);
      toast({ title: "Erro", description: getUserFriendlyError(error), variant: "destructive" });
    }
  };

  const toggleGroupActive = async (group: AddonGroup) => {
    try {
      const { error } = await supabase
        .from("addon_groups")
        .update({ is_active: !group.is_active })
        .eq("id", group.id);
      if (error) throw error;
      setGroups((prev) =>
        prev.map((g) => (g.id === group.id ? { ...g, is_active: !group.is_active } : g))
      );
      toast({ title: !group.is_active ? "Grupo ativado!" : "Grupo desativado!" });
    } catch (error) {
      logger.error("Error toggling addon group:", error);
      toast({ title: "Erro", description: getUserFriendlyError(error), variant: "destructive" });
    }
  };

  const toggleItemActive = async (item: AddonItem, groupId: string) => {
    try {
      const { error } = await supabase
        .from("addon_items")
        .update({ is_active: !item.is_active })
        .eq("id", item.id);
      if (error) throw error;
      setItems((prev) => ({
        ...prev,
        [groupId]: (prev[groupId] || []).map((i) =>
          i.id === item.id ? { ...i, is_active: !item.is_active } : i
        ),
      }));
      toast({ title: !item.is_active ? "Item ativado!" : "Item desativado!" });
    } catch (error) {
      logger.error("Error toggling addon item:", error);
      toast({ title: "Erro", description: getUserFriendlyError(error), variant: "destructive" });
    }
  };

  // Item CRUD
  const resetItemForm = () => {
    setItemForm({ name: "", description: "", price: "0", image_url: "" });
    setEditingItem(null);
  };

  const openEditItem = (item: AddonItem, groupId: string) => {
    setEditingItem(item);
    setActiveGroupId(groupId);
    setItemForm({
      name: item.name,
      description: item.description || "",
      price: item.price.toString(),
      image_url: item.image_url || "",
    });
    setItemDialogOpen(true);
  };

  const openNewItem = (groupId: string) => {
    resetItemForm();
    setActiveGroupId(groupId);
    setItemDialogOpen(true);
  };

  const handleSaveItem = async () => {
    if (!activeGroupId || !itemForm.name.trim()) {
      toast({ title: "Erro", description: "Nome é obrigatório", variant: "destructive" });
      return;
    }

    setSavingItem(true);
    const currentItems = items[activeGroupId] || [];
    const payload = {
      addon_group_id: activeGroupId,
      name: itemForm.name.trim(),
      description: itemForm.description.trim() || null,
      price: parseFloat(itemForm.price) || 0,
      sort_order: editingItem ? editingItem.sort_order : currentItems.length,
      image_url: itemForm.image_url || null,
    };

    try {
      if (editingItem) {
        const { error } = await supabase.from("addon_items").update(payload).eq("id", editingItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("addon_items").insert(payload);
        if (error) throw error;
      }
      toast({ title: editingItem ? "Item atualizado!" : "Item criado!" });
      setItemDialogOpen(false);
      resetItemForm();
      fetchItems(activeGroupId);
    } catch (error) {
      logger.error("Error saving addon item:", error);
      toast({ title: "Erro", description: getUserFriendlyError(error), variant: "destructive" });
    } finally {
      setSavingItem(false);
    }
  };

  const handleDeleteItem = async (itemId: string, groupId: string) => {
    if (!confirm("Excluir este item?")) return;
    try {
      const { error } = await supabase.from("addon_items").delete().eq("id", itemId);
      if (error) throw error;
      toast({ title: "Item excluído!" });
      fetchItems(groupId);
    } catch (error) {
      logger.error("Error deleting addon item:", error);
      toast({ title: "Erro", description: getUserFriendlyError(error), variant: "destructive" });
    }
  };

  const formatPrice = (price: number) =>
    price === 0 ? "Grátis" : `R$ ${price.toFixed(2).replace(".", ",")}`;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleGroupsDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = groups.findIndex((g) => g.id === active.id);
    const newIndex = groups.findIndex((g) => g.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(groups, oldIndex, newIndex);
    setGroups(reordered);
    try {
      await Promise.all(
        reordered.map((g, idx) =>
          supabase.from("addon_groups").update({ sort_order: idx }).eq("id", g.id)
        )
      );
    } catch (error) {
      logger.error("Error reordering addon groups:", error);
      toast({ title: "Erro", description: getUserFriendlyError(error), variant: "destructive" });
      fetchGroups();
    }
  };

  const handleItemsDragEnd = async (groupId: string, event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const list = items[groupId] || [];
    const oldIndex = list.findIndex((i) => i.id === active.id);
    const newIndex = list.findIndex((i) => i.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(list, oldIndex, newIndex);
    setItems((prev) => ({ ...prev, [groupId]: reordered }));
    try {
      await Promise.all(
        reordered.map((it, idx) =>
          supabase.from("addon_items").update({ sort_order: idx }).eq("id", it.id)
        )
      );
    } catch (error) {
      logger.error("Error reordering addon items:", error);
      toast({ title: "Erro", description: getUserFriendlyError(error), variant: "destructive" });
      fetchItems(groupId);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">
          {groups.length} grupo(s) de adicionais
        </h2>
        <Dialog open={groupDialogOpen} onOpenChange={(open) => {
          setGroupDialogOpen(open);
          if (!open) resetGroupForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Novo Grupo
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingGroup ? "Editar Grupo" : "Novo Grupo de Adicionais"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input
                  value={groupForm.name}
                  onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                  placeholder="Ex: Turbine seu Hambúrguer"
                />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Input
                  value={groupForm.description}
                  onChange={(e) => setGroupForm({ ...groupForm, description: e.target.value })}
                  placeholder="Ex: Deixe seu lanche ainda mais saboroso"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo de seleção</Label>
                  <Select value={groupForm.type} onValueChange={(v) => setGroupForm({ ...groupForm, type: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="multiple">Múltipla escolha</SelectItem>
                      <SelectItem value="single">Escolha única</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Obrigatório?</Label>
                  <div className="flex items-center gap-2 h-10">
                    <Switch
                      checked={groupForm.required}
                      onCheckedChange={(v) => setGroupForm({ ...groupForm, required: v })}
                    />
                    <span className="text-sm text-muted-foreground">
                      {groupForm.required ? "Sim" : "Não"}
                    </span>
                  </div>
                </div>
              </div>
              {groupForm.type === "multiple" && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Mín. seleções</Label>
                    <Input
                      type="number"
                      value={groupForm.min_select}
                      onChange={(e) => setGroupForm({ ...groupForm, min_select: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Máx. seleções</Label>
                    <Input
                      type="number"
                      value={groupForm.max_select}
                      onChange={(e) => setGroupForm({ ...groupForm, max_select: e.target.value })}
                      placeholder="Sem limite"
                    />
                  </div>
                </div>
              )}
              <Button onClick={handleSaveGroup} disabled={savingGroup} className="w-full">
                {savingGroup && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editingGroup ? "Salvar" : "Criar Grupo"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {groups.length === 0 ? (
        <div className="text-center py-12 bg-muted/30 rounded-lg border border-dashed">
          <ListPlus className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="font-medium text-foreground">Nenhum grupo de adicionais</p>
          <p className="text-sm text-muted-foreground mt-1">
            Crie grupos como "Turbine seu lanche" ou "Escolha sua bebida"
          </p>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleGroupsDragEnd}>
          <SortableContext items={groups.map((g) => g.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {groups.map((group) => (
                <SortableGroupCard
                  key={group.id}
                  group={group}
                  expanded={expandedGroup === group.id}
                  onToggleExpand={() => toggleExpand(group.id)}
                  onToggleActive={() => toggleGroupActive(group)}
                  onEdit={() => openEditGroup(group)}
                  onDelete={() => handleDeleteGroup(group.id)}
                >
                  <CardContent className="pt-0 px-4 pb-4">
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={(e) => handleItemsDragEnd(group.id, e)}
                    >
                      <SortableContext
                        items={(items[group.id] || []).map((i) => i.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="space-y-2">
                          {(items[group.id] || []).map((item) => (
                            <SortableItemRow
                              key={item.id}
                              item={item}
                              formatPrice={formatPrice}
                              onToggleActive={() => toggleItemActive(item, group.id)}
                              onEdit={() => openEditItem(item, group.id)}
                              onDelete={() => handleDeleteItem(item.id, group.id)}
                            />
                          ))}
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full mt-2"
                            onClick={() => openNewItem(group.id)}
                          >
                            <Plus className="w-4 h-4 mr-1" />
                            Adicionar Item
                          </Button>
                        </div>
                      </SortableContext>
                    </DndContext>
                  </CardContent>
                </SortableGroupCard>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Item Dialog */}
      <Dialog open={itemDialogOpen} onOpenChange={(open) => {
        setItemDialogOpen(open);
        if (!open) resetItemForm();
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Editar Item" : "Novo Item"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input
                value={itemForm.name}
                onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                placeholder="Ex: Bacon Extra"
              />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input
                value={itemForm.description}
                onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
                placeholder="Ex: Porção extra de bacon crocante"
              />
            </div>
            <div className="space-y-2">
              <Label>Preço (R$)</Label>
              <CurrencyInput
                value={typeof itemForm.price === 'string' ? parseFloat(itemForm.price) || 0 : itemForm.price}
                onChange={(value) => setItemForm({ ...itemForm, price: value })}
                placeholder="0,00"
              />
            </div>
            <div className="space-y-2">
              <Label>Imagem (opcional)</Label>
              {itemForm.image_url ? (
                <div className="relative w-20 h-20">
                  <img src={itemForm.image_url} alt="Preview" className="w-full h-full object-cover rounded-lg border" />
                  <button
                    type="button"
                    onClick={() => setItemForm({ ...itemForm, image_url: "" })}
                    className="absolute -top-2 -right-2 p-1 bg-destructive text-destructive-foreground rounded-full hover:bg-destructive/90"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => itemImageInputRef.current?.click()}
                  className="w-full h-20 border-2 border-dashed border-muted-foreground/25 rounded-lg flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors"
                >
                  {isUploadingItemImage ? (
                    <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
                  ) : (
                    <>
                      <Upload className="w-5 h-5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Upload imagem</span>
                    </>
                  )}
                </div>
              )}
              <input
                ref={itemImageInputRef}
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (!file.type.startsWith("image/")) {
                    toast({ title: "Erro", description: "Selecione uma imagem válida.", variant: "destructive" });
                    return;
                  }
                  if (file.size > 5 * 1024 * 1024) {
                    toast({ title: "Erro", description: "Imagem deve ter no máximo 5MB.", variant: "destructive" });
                    return;
                  }
                  setIsUploadingItemImage(true);
                  try {
                    const { data: { user } } = await supabase.auth.getUser();
                    if (!user) throw new Error("Usuário não autenticado");
                    const fileExt = file.name.split(".").pop();
                    const fileName = `${user.id}/addon-${Date.now()}.${fileExt}`;
                    const { error: uploadError } = await supabase.storage.from("product-images").upload(fileName, file);
                    if (uploadError) throw uploadError;
                    const { data: { publicUrl } } = supabase.storage.from("product-images").getPublicUrl(fileName);
                    setItemForm({ ...itemForm, image_url: publicUrl });
                  } catch (error) {
                    logger.error("Error uploading addon image:", error);
                    toast({ title: "Erro", description: getUserFriendlyError(error), variant: "destructive" });
                  } finally {
                    setIsUploadingItemImage(false);
                    if (itemImageInputRef.current) itemImageInputRef.current.value = "";
                  }
                }}
                className="hidden"
              />
            </div>
            <Button onClick={handleSaveItem} disabled={savingItem} className="w-full">
              {savingItem && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingItem ? "Salvar" : "Adicionar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface SortableGroupCardProps {
  group: AddonGroup;
  expanded: boolean;
  onToggleExpand: () => void;
  onToggleActive: () => void;
  onEdit: () => void;
  onDelete: () => void;
  children?: React.ReactNode;
}

function SortableGroupCard({
  group,
  expanded,
  onToggleExpand,
  onToggleActive,
  onEdit,
  onDelete,
  children,
}: SortableGroupCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: group.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };
  return (
    <div ref={setNodeRef} style={style}>
      <Card className={!group.is_active ? "opacity-60" : ""}>
        <CardHeader className="py-3 px-4 cursor-pointer" onClick={onToggleExpand}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="cursor-grab active:cursor-grabbing touch-none text-muted-foreground hover:text-foreground"
                onClick={(e) => e.stopPropagation()}
                {...attributes}
                {...listeners}
                aria-label="Arrastar para reordenar"
              >
                <GripVertical className="w-4 h-4" />
              </button>
              {expanded ? (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              )}
              <div>
                <CardTitle className="text-base">{group.name}</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {group.type === "single" ? "Escolha única" : "Múltipla escolha"}
                  {group.required && " • Obrigatório"}
                  {group.max_select && ` • Máx. ${group.max_select}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <Switch
                checked={group.is_active}
                onCheckedChange={onToggleActive}
                aria-label={group.is_active ? "Desativar grupo" : "Ativar grupo"}
              />
              <Button size="icon" variant="ghost" onClick={onEdit}>
                <Pencil className="w-4 h-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={onDelete}>
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          </div>
        </CardHeader>
        {expanded && children}
      </Card>
    </div>
  );
}

interface SortableItemRowProps {
  item: AddonItem;
  formatPrice: (n: number) => string;
  onToggleActive: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function SortableItemRow({ item, formatPrice, onToggleActive, onEdit, onDelete }: SortableItemRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
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
      className={`flex items-center justify-between p-3 bg-muted/50 rounded-lg ${!item.is_active ? "opacity-60" : ""}`}
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="cursor-grab active:cursor-grabbing touch-none text-muted-foreground hover:text-foreground"
          {...attributes}
          {...listeners}
          aria-label="Arrastar para reordenar"
        >
          <GripVertical className="w-4 h-4" />
        </button>
        {item.image_url ? (
          <img src={item.image_url} alt={item.name} className="w-10 h-10 rounded-md object-cover" />
        ) : (
          <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center">
            <ImageIcon className="w-4 h-4 text-muted-foreground" />
          </div>
        )}
        <div>
          <p className="font-medium text-sm">{item.name}</p>
          {item.description && (
            <p className="text-xs text-muted-foreground">{item.description}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-primary">{formatPrice(item.price)}</span>
        <Switch
          checked={item.is_active}
          onCheckedChange={onToggleActive}
          aria-label={item.is_active ? "Desativar item" : "Ativar item"}
        />
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onEdit}>
          <Pencil className="w-3 h-3" />
        </Button>
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onDelete}>
          <Trash2 className="w-3 h-3 text-destructive" />
        </Button>
      </div>
    </div>
  );
}
