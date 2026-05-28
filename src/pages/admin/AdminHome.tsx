import { useNavigate } from "react-router-dom";
import { ClipboardList, Utensils, Sparkles, Settings, CreditCard } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const homeCards = [
  {
    title: "Acompanhar Pedidos",
    description: "Gerencie pedidos em tempo real",
    icon: ClipboardList,
    path: "/admin/pedidos",
    gradient: "from-emerald-500 to-emerald-700",
  },
  {
    title: "Cardápio Digital",
    description: "Edite produtos e categorias",
    icon: Utensils,
    path: "/admin/cardapio",
    gradient: "from-blue-500 to-blue-700",
  },
  {
    title: "IA Criativa",
    description: "Crie conteúdo com inteligência artificial",
    icon: Sparkles,
    path: "/admin/ia",
    gradient: "from-amber-500 to-orange-600",
  },
  {
    title: "Configurações",
    description: "Entrega, pagamentos e negócio",
    icon: Settings,
    path: "/admin/negocio",
    gradient: "from-purple-500 to-purple-700",
  },
  {
    title: "Minha Assinatura",
    description: "Gerencie seu plano e pagamento",
    icon: CreditCard,
    path: "/admin/assinatura",
    gradient: "from-rose-500 to-pink-600",
  },
];

export default function AdminHome() {
  const navigate = useNavigate();

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Bem-vindo ao Menufly</h1>
        <p className="text-muted-foreground mt-1">O que você deseja fazer?</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {homeCards.map((card) => (
          <button
            key={card.path}
            onClick={() => navigate(card.path)}
            className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br ${card.gradient} p-6 text-left text-white shadow-lg transition-all duration-300 hover:scale-[1.03] hover:shadow-xl active:scale-[0.98]`}
          >
            {/* Decorative circle */}
            <div className="absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/10 transition-transform duration-500 group-hover:scale-150" />

            <div className="relative z-10 flex flex-col gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
                <card.icon className="h-7 w-7" />
              </div>
              <div>
                <h2 className="text-lg font-bold">{card.title}</h2>
                {card.title === "IA Criativa" && (
                  <Badge className="bg-white/20 text-white border-white/30 text-[10px] px-1.5 py-0 h-4 font-bold tracking-wide w-fit">BETA</Badge>
                )}
                <p className="text-sm text-white/80">{card.description}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
