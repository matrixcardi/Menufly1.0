import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Loader2, ListPlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getUserFriendlyError } from "@/lib/error-handler";
import { logger } from "@/lib/logger";

interface AddonGroup {
  id: string;
  name: string;
  type: string;
  required: boolean;
  max_select: number | null;
}

interface InlineAddonLinkerProps {
  productId: string;
  restaurantId: string;
}

export default function InlineAddonLinker({ productId, restaurantId }: InlineAddonLinkerProps) {
  const [groups, setGroups] = useState<AddonGroup[]>([]);
  const [linkedIds, setLinkedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, [productId, restaurantId]);

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

  const toggleGroup = async (groupId: string) => {
    const isLinked = linkedIds.has(groupId);
    setSaving(groupId);

    try {
      if (isLinked) {
        const { error } = await supabase
          .from("product_addon_groups")
          .delete()
          .eq("product_id", productId)
          .eq("addon_group_id", groupId);
        if (error) throw error;
        setLinkedIds((prev) => {
          const next = new Set(prev);
          next.delete(groupId);
          return next;
        });
      } else {
        const { error } = await supabase
          .from("product_addon_groups")
          .insert({ product_id: productId, addon_group_id: groupId, sort_order: linkedIds.size });
        if (error) throw error;
        setLinkedIds((prev) => new Set(prev).add(groupId));
      }
    } catch (error) {
      logger.error("Error toggling addon link:", error);
      toast({ title: "Erro", description: getUserFriendlyError(error), variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-16">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-4 text-center">
        <ListPlus className="w-8 h-8 text-muted-foreground mx-auto mb-1" />
        <p className="text-xs text-muted-foreground">
          Crie grupos na aba "Adicionais" primeiro
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label>Grupos de Adicionais</Label>
      <div className="rounded-lg border divide-y max-h-48 overflow-y-auto">
        {groups.map((group) => (
          <label
            key={group.id}
            className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/50 transition-colors"
          >
            {saving === group.id ? (
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground flex-shrink-0" />
            ) : (
              <Checkbox
                checked={linkedIds.has(group.id)}
                onCheckedChange={() => toggleGroup(group.id)}
              />
            )}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{group.name}</p>
              <p className="text-xs text-muted-foreground">
                {group.type === "single" ? "Escolha única" : "Múltipla escolha"}
                {group.required && " • Obrigatório"}
                {group.max_select && ` • Máx. ${group.max_select}`}
              </p>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}
