import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurantContext } from "@/contexts/RestaurantContext";
import { toast } from "sonner";
import { translateError } from "@/lib/error-messages";

export function useCollaborators() {
  const { selectedRestaurantId, selectedRestaurantIds } = useRestaurantContext();
  const queryClient = useQueryClient();
  const ctxRestaurantId = selectedRestaurantId === "all" ? selectedRestaurantIds[0] : selectedRestaurantId;

  const { data: collaborators = [], isLoading } = useQuery({
    queryKey: ["collaborators", ctxRestaurantId],
    queryFn: async () => {
      if (!ctxRestaurantId) return [];
      
      const { data, error } = await supabase.rpc("list_restaurant_collaborators", {
        p_restaurant_id: ctxRestaurantId,
      });

      if (error) throw error;
      return data || [];
    },
    enabled: !!ctxRestaurantId,
  });

  const removeCollaborator = useMutation({
    mutationFn: async (collaboratorId: string) => {
      const { error } = await supabase
        .from("restaurant_collaborators")
        .update({ status: "removed", updated_at: new Date().toISOString() })
        .eq("id", collaboratorId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Colaborador removido com sucesso");
      queryClient.invalidateQueries({ queryKey: ["collaborators"] });
    },
    onError: (error: any) => {
      toast.error("Erro ao remover colaborador", {
        description: translateError(error.message),
      });
    },
  });

  return {
    collaborators,
    isLoading,
    removeCollaborator: removeCollaborator.mutate,
  };
}
