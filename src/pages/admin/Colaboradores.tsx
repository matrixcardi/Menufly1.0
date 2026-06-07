import { useState } from "react";
import { Plus, Users, Shield } from "lucide-react";
import { CollaboratorCard } from "@/components/admin/CollaboratorCard";
import { InviteCollaboratorModal } from "@/components/admin/InviteCollaboratorModal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useCollaborators } from "@/hooks/useCollaborators";
import { useCurrentPlan } from "@/hooks/useCurrentPlan";

export default function ColaboradoresPage() {
  const { collaborators, isLoading, removeCollaborator } = useCollaborators();
  const { plan } = useCurrentPlan();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [toRemove, setToRemove] = useState<any>(null);

  const limit = plan?.max_collaborators ?? 1;
  const used = collaborators.filter(c => c.status === 'active').length;
  const canAddMore = used < limit;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Colaboradores</h1>
          <p className="text-zinc-400 mt-1">
            Gerencie os acessos de colaboradores ao seu painel.
          </p>
        </div>
        <button
          onClick={() => setInviteOpen(true)}
          disabled={!canAddMore}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" />
          Convidar Colaborador
        </button>
      </div>

      {/* Card do plano */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="w-5 h-5 text-orange-500" />
          <div>
            <p className="font-semibold text-white">Seu plano</p>
            <p className="text-sm text-zinc-400">
              {used}/{limit} colaborador(es) utilizado(s)
            </p>
          </div>
        </div>
        {!canAddMore && (
          <span className="px-3 py-1 rounded-full bg-red-500/20 text-red-300 text-xs font-medium">
            Limite atingido
          </span>
        )}
      </div>

      {/* Lista de colaboradores */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-zinc-400" />
          <h2 className="text-lg font-semibold text-white">Colaboradores ativos</h2>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-zinc-500">Carregando...</div>
        ) : collaborators.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-zinc-800 rounded-xl">
            <Users className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
            <p className="text-zinc-400">Nenhum colaborador cadastrado ainda</p>
            <button
              onClick={() => setInviteOpen(true)}
              className="mt-4 text-orange-500 hover:text-orange-400 font-medium"
            >
              Convidar o primeiro colaborador
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {collaborators.map((c) => (
              <CollaboratorCard
                key={c.id}
                collaborator={c}
                onEdit={(c) => { /* TODO: abrir modal de edição */ }}
                onRemove={(c) => setToRemove(c)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modal de convite */}
      <InviteCollaboratorModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
      />

      {/* Modal de confirmação de remoção */}
      <ConfirmDialog
        open={!!toRemove}
        onClose={() => setToRemove(null)}
        type="danger"
        title="Remover colaborador?"
        description={`Tem certeza que deseja remover ${toRemove?.full_name}?`}
        impact="O colaborador perderá imediatamente o acesso ao painel deste restaurante."
        confirmText="Sim, remover"
        cancelText="Cancelar"
        onConfirm={() => {
          removeCollaborator(toRemove.id);
          setToRemove(null);
        }}
      />
    </div>
  );
}
