import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurantContext } from "@/contexts/RestaurantContext";
import { toast } from "sonner";
import { translateError } from "@/lib/error-messages";
import { useQueryClient } from "@tanstack/react-query";

const ROLES = [
  { value: 'waiter',    label: '🍽️ Garçom',     desc: 'Gerencia mesas e pedidos do salão' },
  { value: 'cook',      label: '👨‍🍳 Cozinheiro', desc: 'Vê apenas pedidos para preparar' },
  { value: 'cashier',   label: '💰 Caixa',       desc: 'Gerencia caixa, pagamentos e fechamentos' },
  { value: 'delivery',  label: '🛵 Entregador',  desc: 'Vê apenas entregas atribuídas' },
  { value: 'manager',   label: '🛡️ Gerente',     desc: 'Acesso amplo, sem dados financeiros' },
  { value: 'collaborator', label: '👤 Colaborador', desc: 'Permissões personalizáveis' },
];

export function InviteCollaboratorModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { selectedRestaurantId, selectedRestaurantIds } = useRestaurantContext();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('collaborator');
  const [loading, setLoading] = useState(false);

  const ctxRestaurantId = selectedRestaurantId === "all" ? selectedRestaurantIds[0] : selectedRestaurantId;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ctxRestaurantId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('invite-collaborator', {
        body: {
          restaurant_id: ctxRestaurantId,
          email,
          name,
          role,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success('Colaborador convidado!', {
        description: `${name} receberá as instruções de acesso no email.`,
      });
      
      queryClient.invalidateQueries({ queryKey: ['collaborators'] });
      onClose();
      setEmail(''); setName(''); setRole('collaborator');
    } catch (error: any) {
      toast.error('Erro ao convidar colaborador', {
        description: translateError(error.message),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-zinc-900 border-zinc-800 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white">Convidar Colaborador</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm text-zinc-300 mb-1 block">Nome</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Nome do colaborador"
              className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white"
            />
          </div>

          <div>
            <label className="text-sm text-zinc-300 mb-1 block">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="email@exemplo.com"
              className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white"
            />
          </div>

          <div>
            <label className="text-sm text-zinc-300 mb-2 block">Função</label>
            <div className="space-y-2">
              {ROLES.map((r) => (
                <label
                  key={r.value}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    role === r.value
                      ? 'border-orange-500 bg-orange-500/10'
                      : 'border-zinc-700 hover:border-zinc-600'
                  }`}
                >
                  <input
                    type="radio"
                    name="role"
                    value={r.value}
                    checked={role === r.value}
                    onChange={(e) => setRole(e.target.value)}
                    className="mt-1"
                  />
                  <div>
                    <div className="font-medium text-white">{r.label}</div>
                    <div className="text-xs text-zinc-400">{r.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg border border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-medium disabled:opacity-50"
            >
              {loading ? 'Enviando...' : 'Convidar'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
