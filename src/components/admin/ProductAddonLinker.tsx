import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { getUserFriendlyError } from "@/lib/error-handler";
import { logger } from "@/lib/logger";
import { Loader2, ListPlus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface AddonGroup {
  id: string;
  name: string;
  type: string;
  required: boolean;
  max_select: number | null;
}

interface ProductAddonLinkerProps {
  productId: string;
  productName: string;
  restaurantId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ProductAddonLinker({
  productId,
  productName,
  restaurantId,
  open,
  onOpenChange,
}: ProductAddonLinkerProps) {
  const [groups, setGroups] = useState<AddonGroup[]>([]);
  const [linkedIds, setLinkedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) fetchData();
  }, [open, productId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [groupsRes, linksRes] = await Promise.all([
        supabase
          .from("addon_groups")
          .select("id, name, type, required, max_select")
          .eq("restaurant_id", restaurantId)
          .eq("is_active", true)
          .order("sort_order"),
        supabase
          .from("product_addon_groups")
          .select("addon_group_id")
          .eq("product_id", productId),
      ]);

      if (groupsRes.error) throw groupsRes.error;
      if (linksRes.error) throw linksRes.error;

      setGroups(groupsRes.data || []);
      setLinkedIds(new Set((linksRes.data || []).map((l) => l.addon_group_id)));
    } catch (error) {
      logger.error("Error fetching addon links:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleGroup = (groupId: string) => {
    setLinkedIds((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Delete all existing links for this product
      const { error: deleteError } = await supabase
        .from("product_addon_groups")
        .delete()
        .eq("product_id", productId);

      if (deleteError) throw deleteError;

      // Insert new links
      if (linkedIds.size > 0) {
        const inserts = Array.from(linkedIds).map((groupId, idx) => ({
          product_id: productId,
          addon_group_id: groupId,
          sort_order: idx,
        }));

        const { error: insertError } = await supabase
          .from("product_addon_groups")
          .insert(inserts);

        if (insertError) throw insertError;
      }

      toast({ title: "Adicionais vinculados!" });
      onOpenChange(false);
    } catch (error) {
      logger.error("Error saving addon links:", error);
      toast({ title: "Erro", description: getUserFriendlyError(error), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Adicionais — {productName}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center h-24">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : groups.length === 0 ? (
          <div className="text-center py-8">
            <ListPlus className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              Nenhum grupo de adicionais criado.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Crie grupos na aba "Adicionais" primeiro.
            </p>
          </div>
        ) : (
          <div className="space-y-4 mt-2">
            <p className="text-sm text-muted-foreground">
              Selecione os grupos de adicionais que aparecem neste produto:
            </p>
            <div className="space-y-2">
              {groups.map((group) => (
                <label
                  key={group.id}
                  className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
                >
                  <Checkbox
                    checked={linkedIds.has(group.id)}
                    onCheckedChange={() => toggleGroup(group.id)}
                  />
                  <div className="flex-1">
                    <p className="font-medium text-sm">{group.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {group.type === "single" ? "Escolha única" : "Múltipla escolha"}
                      {group.required && " • Obrigatório"}
                      {group.max_select && ` • Máx. ${group.max_select}`}
                    </p>
                  </div>
                </label>
              ))}
            </div>

            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Salvar Vínculos ({linkedIds.size} grupo{linkedIds.size !== 1 ? "s" : ""})
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
