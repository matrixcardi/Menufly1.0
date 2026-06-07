import { Trash2, Settings, ChefHat, Wallet, UtensilsCrossed, Bike, Shield, User } from "lucide-react";

interface Collaborator {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  role: 'collaborator' | 'waiter' | 'cook' | 'cashier' | 'delivery' | 'manager';
  status: string;
  created_at: string;
  invited_by_name?: string;
}

const ROLE_CONFIG = {
  collaborator: { label: 'Colaborador', icon: User, color: 'bg-gray-500/20 text-gray-300' },
  waiter:       { label: 'Garçom',       icon: UtensilsCrossed, color: 'bg-blue-500/20 text-blue-300' },
  cook:         { label: 'Cozinheiro',   icon: ChefHat, color: 'bg-orange-500/20 text-orange-300' },
  cashier:      { label: 'Caixa',        icon: Wallet, color: 'bg-green-500/20 text-green-300' },
  delivery:     { label: 'Entregador',   icon: Bike, color: 'bg-purple-500/20 text-purple-300' },
  manager:      { label: 'Gerente',      icon: Shield, color: 'bg-red-500/20 text-red-300' },
};

export function CollaboratorCard({ 
  collaborator, 
  onEdit, 
  onRemove 
}: { 
  collaborator: Collaborator; 
  onEdit: (c: Collaborator) => void;
  onRemove: (c: Collaborator) => void;
}) {
  const roleConfig = ROLE_CONFIG[collaborator.role] || ROLE_CONFIG.collaborator;
  const RoleIcon = roleConfig.icon;
  const initials = collaborator.full_name
    ?.split(' ')
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase() || '?';

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
  };

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 hover:border-orange-500/50 transition-colors">
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-500 to-orange-700 flex items-center justify-center text-white font-bold text-lg">
          {initials}
        </div>

        {/* Conteúdo */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-white truncate">
                {collaborator.full_name || 'Sem nome'}
              </h3>
              <p className="text-sm text-zinc-400 truncate">
                {collaborator.email}
              </p>
            </div>

            {/* Botões */}
            <div className="flex gap-1 shrink-0">
              <button
                onClick={() => onEdit(collaborator)}
                className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                title="Editar permissões"
              >
                <Settings className="w-4 h-4" />
              </button>
              <button
                onClick={() => onRemove(collaborator)}
                className="p-2 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                title="Remover colaborador"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Footer com role + data */}
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${roleConfig.color}`}>
              <RoleIcon className="w-3 h-3" />
              {roleConfig.label}
            </span>
            <span className="text-xs text-zinc-500">
              Adicionado em {formatDate(collaborator.created_at)}
            </span>
            {collaborator.invited_by_name && (
              <span className="text-xs text-zinc-500">
                • Convidado por {collaborator.invited_by_name}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
