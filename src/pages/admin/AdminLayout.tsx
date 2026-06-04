import { useEffect, useState, useRef } from "react";
import adminBgLight from "@/assets/admin-bg-light.jpg";
import adminBgDark from "@/assets/admin-bg-dark.webp";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";
import { useUserRole } from "@/hooks/useUserRole";
import { useSubscriptionPlan } from "@/hooks/useSubscriptionPlan";
import { playNewOrderSound, NotificationSoundType, unlockAudio } from "@/lib/notification-sound";
import { initPushNotifications } from "@/lib/push-notifications";
import { RestaurantProvider, useRestaurantContext, AdminRestaurant } from "@/contexts/RestaurantContext";
import { clearLocalAuthState, isRefreshTokenError } from "@/lib/auth-cleanup";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NavLink } from "@/components/NavLink";
import {
  Utensils,
  BarChart3,
  Store,
  Users,
  LogOut,
  Menu,
  Tag,
  Package,
  ClipboardList,
  Box,
  Building2,
  Megaphone,
  Copy,
  Check,
  Eye,
  Truck,
  Bike,
  MessageCircle,
  Printer,
  Bot,
  CreditCard,
  Sparkles,
  Settings,
  ChevronRight,
  DollarSign,
  Crown,
  Plug,
  Link2,
  Calendar,
  ShoppingCart,
  Armchair,
  Plus,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { HelpChatWidget } from "@/components/admin/HelpChatWidget";
import { CashRegisterDialog } from "@/components/admin/CashRegisterDialog";
import { useSubscriptionAlert } from "@/hooks/useSubscriptionAlert";
import { SubscriptionExpiryBanner } from "@/components/admin/SubscriptionExpiryBanner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePDVKiosk } from "@/contexts/PDVKioskContext";

// Pedidos separado para ficar em destaque
const ordersItem = { title: "Acompanhar Pedidos", url: "/admin/pedidos", icon: ClipboardList };

// Salão - unifica PDV e Mesas
const salaoItem = { title: "Salão", url: "/admin/salao", icon: ShoppingCart };

const navItems = [
  { title: "CRM", url: "/admin/crm", icon: Users, restrictCollaborator: true },
  { title: "IA Criativa", url: "/admin/ia", icon: Sparkles, restrictCollaborator: true },
  { title: "Campanhas", url: "/admin/campanhas", icon: MessageCircle, isWhatsapp: true, restrictCollaborator: true },
  { title: "ADS", url: "/admin/ads", icon: Megaphone, restrictCollaborator: true },
  { title: "WhatsApp Bot", url: "/admin/whatsapp-bot", icon: Bot, isBot: true, requiresElite: true },
];

const menuItems = [
  { title: "Cardápio Digital", url: "/admin/cardapio", icon: Utensils },
  { title: "Produtos e Categorias", url: "/admin/produtos", icon: Package, restrictCollaborator: true },
  { title: "Promos", url: "/admin/promos", icon: Tag, restrictCollaborator: true },
];

const financeiroItems = [
  { title: "Visão Geral", url: "/admin/bi-financeiro", icon: BarChart3, restrictCollaborator: true },
  { title: "DRE", url: "/admin/dre", icon: DollarSign, restrictCollaborator: true },
  { title: "Custos de Insumos", url: "/admin/custos-insumos", icon: Package, restrictCollaborator: true },
  { title: "Extrato de Pedidos", url: "/admin/extrato-pedidos", icon: ClipboardList, restrictCollaborator: true },
  { title: "Relatórios", url: "/admin/relatorios", icon: BarChart3 },
  { title: "CMV", url: "/admin/cmv", icon: DollarSign, restrictCollaborator: true },
];

const managementItems = [
  { title: "Estoque & Movimentações", url: "/admin/estoque", icon: Box, restrictCollaborator: true },
  { title: "Fornecedores", url: "/admin/fornecedores", icon: Building2, restrictCollaborator: true },
  { title: "Lista de Compras", url: "/admin/lista-compras", icon: ClipboardList, restrictCollaborator: true },
  { title: "Agenda do Dia", url: "/admin/agenda-dia", icon: Calendar, restrictCollaborator: true },
  { title: "Agendamento", url: "/admin/agendamento", icon: Calendar, restrictCollaborator: true },
];

const settingsItems = [
  { title: "Entrega", url: "/admin/entrega", icon: Truck, restrictCollaborator: true },
  { title: "Entregadores", url: "/admin/entregadores", icon: Bike, restrictCollaborator: true },
  { title: "Pagamentos", url: "/admin/pagamentos", icon: CreditCard, restrictCollaborator: true },
  { title: "Minha Assinatura", url: "/admin/assinatura", icon: Crown, restrictCollaborator: true },
  { title: "Meu Negócio", url: "/admin/negocio", icon: Store, restrictCollaborator: true },
  { title: "Impressora", url: "/admin/impressora", icon: Printer, restrictCollaborator: true },
  { title: "Colaboradores", url: "/admin/colaboradores", icon: Users, restrictCollaborator: true },
  { title: "Integrações", url: "/admin/integracoes", icon: Plug, restrictCollaborator: true },
];

interface RestaurantCardProps {
  restaurant: AdminRestaurant | null;
}

function RestaurantCard({ restaurant }: RestaurantCardProps) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  // Show default restaurant card even if restaurant is null (for new users)
  const restaurantName = restaurant?.name || "Meu Restaurante";
  const restaurantSlug = restaurant?.slug || "";
  const restaurantLogo = restaurant?.logo_url || undefined;
  const restaurantIsOpen = restaurant?.is_open || false;

  const menuLink = restaurantSlug ? `${window.location.origin}/${restaurantSlug}` : "#";

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(menuLink);
      setCopied(true);
      toast({ title: "Link copiado!" });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({ title: "Erro ao copiar", variant: "destructive" });
    }
  };

  return (
    <div className="p-3 mx-2 mb-2 rounded-2xl bg-white/10 dark:bg-white/5 border border-white/15 dark:border-white/10 backdrop-blur-xl">
      <div className="flex items-center gap-3 mb-3">
        <Avatar className="h-10 w-10 ring-2 ring-primary/10 ring-offset-2 ring-offset-background">
          <AvatarImage src={restaurantLogo} alt={restaurantName} />
          <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">
            {restaurantName.substring(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{restaurantName}</p>
          <Badge 
            variant={restaurantIsOpen ? "default" : "secondary"}
            className={`text-xs rounded-full ${restaurantIsOpen ? 'bg-accent text-accent-foreground' : ''}`}
          >
            {restaurantIsOpen ? "Aberto" : "Fechado"}
          </Badge>
        </div>
      </div>
      
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground font-medium">Link do cardápio:</p>
        <div className="flex items-center gap-1">
          <div className="flex-1 bg-background/60 backdrop-blur-sm rounded-xl px-2.5 py-1.5 text-xs text-muted-foreground truncate border border-border/50">
            {menuLink}
          </div>
          <Button variant="outline" size="icon" className="h-8 w-8 shrink-0 rounded-xl" onClick={handleCopyLink} disabled={!restaurantSlug}>
            {copied ? <Check className="h-3.5 w-3.5 text-accent" /> : <Copy className="h-3.5 w-3.5" />}
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8 shrink-0 rounded-xl" onClick={() => window.open(menuLink, '_blank')} disabled={!restaurantSlug}>
            <Eye className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// Restaurant Selector Component
function RestaurantSelector() {
  const { restaurants, selectedRestaurantId, setSelectedRestaurantId } = useRestaurantContext();

  if (restaurants.length <= 1) return null;

  return (
    <div className="px-3 mb-3">
      <Select value={selectedRestaurantId} onValueChange={setSelectedRestaurantId}>
        <SelectTrigger className="w-full h-10 bg-muted/50 border-border">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
            <SelectValue placeholder="Selecionar restaurante" />
          </div>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">
            <div className="flex items-center gap-2">
              <span className="font-medium">Todos os restaurantes</span>
              <Badge variant="secondary" className="text-[10px] px-1.5">{restaurants.length}</Badge>
            </div>
          </SelectItem>
          {restaurants.map(r => (
            <SelectItem key={r.id} value={r.id}>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${r.is_open ? 'bg-green-500' : 'bg-muted-foreground/40'}`} />
                <span>{r.name}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function AdminSidebar({ pendingOrdersCount, isCollaborator, canAccessWhatsAppBot, isMaster, onLogout }: { pendingOrdersCount: number; isCollaborator: boolean; canAccessWhatsAppBot: boolean; isMaster: boolean; onLogout: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { selectedRestaurant, restaurants } = useRestaurantContext();

  let filteredNavItems = isCollaborator ? navItems.filter(i => !('restrictCollaborator' in i && i.restrictCollaborator)) : navItems;
  if (!canAccessWhatsAppBot) {
    filteredNavItems = filteredNavItems.filter(i => !('requiresElite' in i && i.requiresElite));
  }
  const filteredSettingsItems = isCollaborator ? settingsItems.filter(i => !('restrictCollaborator' in i && i.restrictCollaborator)) : settingsItems;
  const filteredFinanceiroItems = isCollaborator ? financeiroItems.filter(i => !('restrictCollaborator' in i && i.restrictCollaborator)) : financeiroItems;
  const filteredManagementItems = isCollaborator ? managementItems.filter(i => !('restrictCollaborator' in i && i.restrictCollaborator)) : managementItems;
  const filteredMenuItems = isCollaborator ? menuItems.filter(i => !('restrictCollaborator' in i && i.restrictCollaborator)) : menuItems;
  const menuActive = filteredMenuItems.some((item) => location.pathname === item.url);
  const [menuOpen, setMenuOpen] = useState(menuActive);
  const financeiroActive = filteredFinanceiroItems.some((item) => location.pathname === item.url);
  const [financeiroOpen, setFinanceiroOpen] = useState(financeiroActive);
  const managementActive = filteredManagementItems.some((item) => location.pathname === item.url);
  const [managementOpen, setManagementOpen] = useState(managementActive);
  const settingsActive = filteredSettingsItems.some((item) => location.pathname === item.url);
  const [settingsOpen, setSettingsOpen] = useState(settingsActive);
  
  const whatsappConnected = selectedRestaurant?.whatsapp_connected ?? false;

  const handleLogout = () => {
    onLogout();
  };

  return (
    <Sidebar className="border-r border-border/30 dark:border-white/5 bg-background/70 dark:bg-background/70 backdrop-blur-2xl">
      <SidebarHeader className="p-4 border-b border-border/50">
        <button onClick={() => navigate("/admin")} className="flex items-center gap-3 hover:opacity-80 transition-all duration-300">
          <Logo className="h-10 w-auto" />
        </button>
      </SidebarHeader>

      <SidebarContent className="p-2">
        {/* Restaurant Selector - only for master users */}
        {isMaster && <RestaurantSelector />}

        {/* Salão - Unifica PDV e Mesas */}
        <div className="mb-4 px-1">
          <button
            onClick={() => window.location.href = salaoItem.url}
            className="flex items-center gap-3 px-3 py-3 rounded-2xl bg-orange-500/10 border border-orange-500/20 hover:bg-orange-500/20 transition-all duration-300 w-full text-left"
          >
            <div className="w-10 h-10 bg-orange-500/20 rounded-xl flex items-center justify-center">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <span className="font-semibold text-sm">{salaoItem.title}</span>
            </div>
          </button>
        </div>

        {/* Pedidos - Fixado e em destaque */}
        <div className="mb-4 px-1">
          <NavLink
            to={ordersItem.url}
            className="flex items-center gap-3 px-3 py-3 rounded-2xl bg-primary/8 border border-primary/15 hover:bg-primary/15 transition-all duration-300"
            activeClassName="bg-primary text-primary-foreground border-primary shadow-apple"
          >
            <div className="w-10 h-10 bg-primary/15 rounded-xl flex items-center justify-center">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <span className="font-semibold text-sm">{ordersItem.title}</span>
              {pendingOrdersCount > 0 && (
                <p className="text-xs opacity-70">
                  {pendingOrdersCount} pedido{pendingOrdersCount !== 1 ? 's' : ''} novo{pendingOrdersCount !== 1 ? 's' : ''}
                </p>
              )}
            </div>
            {pendingOrdersCount > 0 && (
              <Badge className="bg-destructive hover:bg-destructive text-destructive-foreground text-sm px-2.5 py-1 animate-pulse rounded-full">
                {pendingOrdersCount}
              </Badge>
            )}
          </NavLink>
        </div>

        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70 px-3">Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/admin"}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-secondary/80 transition-all duration-200"
                      activeClassName="bg-primary/10 text-primary font-medium shadow-apple-sm"
                    >
                      <item.icon className={`w-4.5 h-4.5 ${'isWhatsapp' in item && item.isWhatsapp ? 'text-green-600' : ''} ${'isBot' in item && item.isBot ? 'text-foreground' : ''}`} />
                      <span className="flex-1 text-sm">{item.title}</span>
                      {item.title === "IA Criativa" && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-bold tracking-wide rounded-full">BETA</Badge>
                      )}
                      {'isWhatsapp' in item && item.isWhatsapp && (
                        <span
                          className={`w-2 h-2 rounded-full ${whatsappConnected ? 'bg-green-500' : 'bg-muted-foreground/40'}`}
                          title={whatsappConnected ? 'WhatsApp conectado' : 'WhatsApp desconectado'}
                        />
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Cardápio Digital - Collapsible */}
        <SidebarGroup>
          <Collapsible open={menuOpen} onOpenChange={setMenuOpen}>
            <CollapsibleTrigger className="w-full">
              <SidebarGroupLabel className="flex items-center justify-between cursor-pointer hover:text-foreground transition-all duration-200 w-full text-xs font-semibold uppercase tracking-wider text-muted-foreground/70 px-3">
                <span>Cardápio Digital</span>
                <ChevronRight className={`w-3.5 h-3.5 transition-transform duration-300 ${menuOpen ? 'rotate-90' : ''}`} />
              </SidebarGroupLabel>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {filteredMenuItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild>
                        <NavLink
                          to={item.url}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-secondary/80 transition-all duration-200"
                          activeClassName="bg-primary/10 text-primary font-medium shadow-apple-sm"
                        >
                          <item.icon className="w-4.5 h-4.5" />
                          <span className="flex-1 text-sm">{item.title}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </Collapsible>
        </SidebarGroup>

        {/* FINANCEIRO */}
        <SidebarGroup>
          <Collapsible open={financeiroOpen} onOpenChange={setFinanceiroOpen}>
            <CollapsibleTrigger className="w-full">
              <SidebarGroupLabel className="flex items-center justify-between cursor-pointer hover:text-foreground transition-all duration-200 w-full text-xs font-semibold uppercase tracking-wider text-muted-foreground/70 px-3">
                <span>FINANCEIRO</span>
                <ChevronRight className={`w-3.5 h-3.5 transition-transform duration-300 ${financeiroOpen ? 'rotate-90' : ''}`} />
              </SidebarGroupLabel>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {filteredFinanceiroItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild>
                        <NavLink
                          to={item.url}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-secondary/80 transition-all duration-200"
                          activeClassName="bg-primary/10 text-primary font-medium shadow-apple-sm"
                        >
                          <item.icon className="w-4.5 h-4.5" />
                          <span className="flex-1 text-sm">{item.title}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </Collapsible>
        </SidebarGroup>

        {/* Gestão */}
        <SidebarGroup>
          <Collapsible open={managementOpen} onOpenChange={setManagementOpen}>
            <CollapsibleTrigger className="w-full">
              <SidebarGroupLabel className="flex items-center justify-between cursor-pointer hover:text-foreground transition-all duration-200 w-full text-xs font-semibold uppercase tracking-wider text-muted-foreground/70 px-3">
                <span>GESTÃO</span>
                <ChevronRight className={`w-3.5 h-3.5 transition-transform duration-300 ${managementOpen ? 'rotate-90' : ''}`} />
              </SidebarGroupLabel>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {filteredManagementItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild>
                        <NavLink
                          to={item.url}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-secondary/80 transition-all duration-200"
                          activeClassName="bg-primary/10 text-primary font-medium shadow-apple-sm"
                        >
                          <item.icon className="w-4.5 h-4.5" />
                          <span className="flex-1 text-sm">{item.title}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </Collapsible>
        </SidebarGroup>

        {/* Configurações - Collapsible */}
        <SidebarGroup>
          <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen}>
            <CollapsibleTrigger className="w-full">
              <SidebarGroupLabel className="flex items-center justify-between cursor-pointer hover:text-foreground transition-all duration-200 w-full text-xs font-semibold uppercase tracking-wider text-muted-foreground/70 px-3">
                <span className="flex items-center gap-2">
                  <Settings className="w-3.5 h-3.5" />
                  Configurações
                </span>
                <ChevronRight className={`w-3.5 h-3.5 transition-transform duration-300 ${settingsOpen ? 'rotate-90' : ''}`} />
              </SidebarGroupLabel>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {filteredSettingsItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild>
                        <NavLink
                          to={item.url}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-secondary/80 transition-all duration-200"
                          activeClassName="bg-primary/10 text-primary font-medium shadow-apple-sm"
                        >
                          <item.icon className="w-4.5 h-4.5" />
                          <span className="flex-1 text-sm">{item.title}</span>
                          {'comingSoon' in item && item.comingSoon && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-bold tracking-wide rounded-full">EM BREVE</Badge>
                          )}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </Collapsible>
        </SidebarGroup>
      </SidebarContent>

      <div className="mt-auto border-t border-border/50">
        <RestaurantCard restaurant={selectedRestaurant} />
        <div className="p-4 pt-2 space-y-1">
          {isMaster && localStorage.getItem("masterManaging") === "true" && (
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-muted-foreground hover:text-primary rounded-xl"
              onClick={() => {
                localStorage.removeItem("masterManaging");
                localStorage.removeItem("masterManagedRestaurantId");
                localStorage.removeItem("selectedRestaurantId");
                navigate("/master");
              }}
            >
              <Building2 className="w-4.5 h-4.5" />
              Voltar ao Master
            </Button>
          )}
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive rounded-xl"
            onClick={handleLogout}
          >
            <LogOut className="w-4.5 h-4.5" />
            Sair
          </Button>
        </div>
      </div>
    </Sidebar>
  );
}

interface BusinessHour {
  day_of_week: number;
  opening_time: string;
  closing_time: string;
  is_open: boolean;
  period_order: number;
}

function isWithinBusinessHours(hours: BusinessHour[]): boolean {
  const now = new Date();
  const currentTimeInBrasilia = now.toLocaleTimeString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  const currentDayInBrasilia = now.toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'long'
  });
  
  // Convert day name to number (0 = Sunday, 6 = Saturday)
  const dayNameToNumber: Record<string, number> = {
    'domingo': 0,
    'segunda-feira': 1,
    'terça-feira': 2,
    'quarta-feira': 3,
    'quinta-feira': 4,
    'sexta-feira': 5,
    'sábado': 6
  };
  const currentDay = dayNameToNumber[currentDayInBrasilia.toLowerCase()] || now.getDay();
  const currentTime = currentTimeInBrasilia;
  
  const todayHours = hours.filter(h => h.day_of_week === currentDay && h.is_open);
  if (todayHours.length === 0) return false;
  return todayHours.some(period => currentTime >= period.opening_time && currentTime < period.closing_time);
}

function AdminLayoutInner() {
  const { user, restaurants, selectedRestaurant, selectedRestaurantIds, selectedRestaurantId, refreshRestaurants } = useRestaurantContext();
  const { isKioskMode } = usePDVKiosk();
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [showCashRegister, setShowCashRegister] = useState(false);
  const [cashRegisterLoading, setCashRegisterLoading] = useState(false);
  const [cashRegisterOpen, setCashRegisterOpen] = useState(false);
  const [cashRegisterMode, setCashRegisterMode] = useState<"open" | "close">("open");
  const [businessHours, setBusinessHours] = useState<BusinessHour[]>([]);
  const [manualOverrideUntil, setManualOverrideUntil] = useState<string | null>(null);
  const [showExitGuard, setShowExitGuard] = useState(false);
  const [exitGuardClosing, setExitGuardClosing] = useState(false);
  const [notificationSound, setNotificationSound] = useState<NotificationSoundType>('medium');
  const [profileName, setProfileName] = useState<string>("");
  const prevPendingCountRef = useRef<number>(0);
  const lastAutoUpdateRef = useRef<string>("");
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { isCollaborator, role: userRole } = useUserRole(user?.id);
  const isMaster = userRole === "master";
  const { canAccessWhatsAppBot } = useSubscriptionPlan(user?.id);
  const { showAlert: showSubAlert, daysRemaining, subscriptionEnd, isTrial, trialExpired, subscribed } = useSubscriptionAlert(user?.id);

  // Block access when trial expired and not subscribed (force them to subscription page)
  useEffect(() => {
    if (trialExpired && !subscribed && !isMaster && !isCollaborator) {
      if (location.pathname !== "/admin/assinatura") {
        navigate("/admin/assinatura", { replace: true });
      }
    }
  }, [trialExpired, subscribed, isMaster, isCollaborator, location.pathname, navigate]);
  // Fetch profile name
  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle()
      .then(({ data }) => setProfileName(data?.full_name || user.email || "Operador"));
  }, [user]);

  // Update state from selected restaurant
  useEffect(() => {
    if (selectedRestaurant) {
      setManualOverrideUntil(selectedRestaurant.manual_override_until || null);
      setNotificationSound((selectedRestaurant.notification_sound as NotificationSoundType) || 'medium');
    }
  }, [selectedRestaurant]);

  // Fetch business hours for selected restaurant
  useEffect(() => {
    if (!selectedRestaurant?.id) return;
    supabase.from("business_hours")
      .select("day_of_week, opening_time, closing_time, is_open, period_order")
      .eq("restaurant_id", selectedRestaurant.id)
      .order("day_of_week").order("period_order")
      .then(({ data }) => { if (data) setBusinessHours(data); });
  }, [selectedRestaurant?.id]);

  // Check cash register for selected restaurant
  const [cashRegisterOpenedAt, setCashRegisterOpenedAt] = useState<string | undefined>();
  useEffect(() => {
    if (!selectedRestaurant?.id) return;
    supabase.from("cash_registers").select("id, opened_at")
      .eq("restaurant_id", selectedRestaurant.id)
      .eq("status", "open").limit(1).maybeSingle()
      .then(({ data }: any) => {
        setCashRegisterOpen(!!data);
        setCashRegisterOpenedAt(data?.opened_at || undefined);
      });
  }, [selectedRestaurant?.id]);

  // Auto-check business hours (only for single restaurant selection)
  useEffect(() => {
    if (!selectedRestaurant?.id || selectedRestaurant.operation_mode === 'manual' || businessHours.length === 0) return;

    async function checkAndUpdateStatus() {
      if (manualOverrideUntil) {
        const overrideEnd = new Date(manualOverrideUntil);
        if (overrideEnd > new Date()) return; // Respect manual override regardless of open/closed state
      }
      const shouldBeOpen = isWithinBusinessHours(businessHours);
      const currentStatus = selectedRestaurant?.is_open ?? false;
      const transitionKey = `${shouldBeOpen ? 'open' : 'close'}-${new Date().getMinutes()}`;
      if (shouldBeOpen !== currentStatus && lastAutoUpdateRef.current !== transitionKey) {
        lastAutoUpdateRef.current = transitionKey;
        const { error } = await supabase
          .from("restaurants")
          .update({ is_open: shouldBeOpen, manual_override_until: null } as any)
          .eq("id", selectedRestaurant!.id);
        if (!error) {
          setManualOverrideUntil(null);
          toast({
            title: shouldBeOpen ? "🟢 Delivery aberto automaticamente" : "🔴 Delivery fechado automaticamente",
            description: shouldBeOpen ? "Horário de funcionamento iniciou" : "Horário de funcionamento encerrou",
          });
        }
      }
    }

    checkAndUpdateStatus();
    const interval = setInterval(checkAndUpdateStatus, 60000);
    return () => clearInterval(interval);
  }, [selectedRestaurant?.id, selectedRestaurant?.is_open, selectedRestaurant?.operation_mode, businessHours, manualOverrideUntil, toast]);

  // Fetch and subscribe to pending orders count (across all selected restaurants)
  useEffect(() => {
    if (selectedRestaurantIds.length === 0) return;

    function getTodayStartISO() {
      const spFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' });
      const todayStr = spFormatter.format(new Date());
      return new Date(`${todayStr}T00:00:00-03:00`).toISOString();
    }

    async function fetchPendingCount() {
      let query = supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending")
        .eq("is_archived", false)
        .neq("payment_status", "awaiting_payment")
        .gte("created_at", getTodayStartISO());

      if (selectedRestaurantIds.length === 1) {
        query = query.eq("restaurant_id", selectedRestaurantIds[0]);
      } else {
        query = query.in("restaurant_id", selectedRestaurantIds);
      }

      const { count } = await query;
      const newCount = count || 0;
      if (newCount > prevPendingCountRef.current && prevPendingCountRef.current >= 0) {
        playNewOrderSound(notificationSound);
      }
      prevPendingCountRef.current = newCount;
      setPendingOrdersCount(newCount);
    }

    fetchPendingCount();

    // Subscribe to realtime changes for all selected restaurants
    const channels = selectedRestaurantIds.map((rid, idx) =>
      supabase
        .channel(`pending-orders-${rid}-${idx}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "orders", filter: `restaurant_id=eq.${rid}` },
          (payload) => {
            const newOrder = payload.new as { payment_status?: string; status?: string };
            if (newOrder.payment_status === "awaiting_payment" || newOrder.status !== "pending") return;
            fetchPendingCount();
          }
        )
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders", filter: `restaurant_id=eq.${rid}` }, () => {
          fetchPendingCount();
        })
        .subscribe()
    );

    const pollInterval = setInterval(fetchPendingCount, 15000);

    return () => {
      channels.forEach(ch => supabase.removeChannel(ch));
      clearInterval(pollInterval);
    };
  }, [selectedRestaurantIds.join(","), notificationSound]);

  // Redirect collaborators from restricted routes
  useEffect(() => {
    if (!isCollaborator || !user) return;
    const restricted = [
      "/admin/cmv",
      "/admin/crm",
      "/admin/ia",
      "/admin/campanhas",
      "/admin/bi-financeiro",
      "/admin/dre",
      "/admin/custos-insumos",
      "/admin/extrato-pedidos",
      "/admin/estoque",
      "/admin/fornecedores",
      "/admin/lista-compras",
      "/admin/agenda-dia",
      "/admin/entrega",
      "/admin/entregadores",
      "/admin/pagamentos",
      "/admin/assinatura",
      "/admin/ads",
      "/admin/negocio",
      "/admin/impressora",
      "/admin/colaboradores",
      "/admin/integracoes",
      "/admin/agendamento",
      "/admin/produtos",
      "/admin/promos",
    ];
    if (restricted.some(r => location.pathname.startsWith(r))) {
      navigate("/admin");
      toast({ title: "Acesso restrito", description: "Você não tem permissão para acessar esta página.", variant: "destructive" });
    }
  }, [isCollaborator, location.pathname, user, navigate, toast]);

  // Block WhatsApp Bot for Start plan users
  useEffect(() => {
    if (!user || canAccessWhatsAppBot) return;
    if (location.pathname.startsWith("/admin/whatsapp-bot")) {
      navigate("/admin");
      toast({ title: "Recurso do plano Elite", description: "O WhatsApp Bot está disponível apenas no plano Elite.", variant: "destructive" });
    }
  }, [canAccessWhatsAppBot, location.pathname, user, navigate, toast]);

  // Prevent tab/window close when restaurant or cash register is open
  // REMOVED: This was causing unwanted popups on navigation
  // The beforeunload event is too aggressive and blocks legitimate navigation
  // If this protection is needed in the future, it should be more targeted

  const handleToggleOpen = async (newIsOpen: boolean) => {
    if (!selectedRestaurant) return;
    
    let overrideUntil: string | null = null;
    
    if (selectedRestaurant.operation_mode === 'automatic') {
      const now = new Date();
      const currentDay = now.getDay();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      if (newIsOpen) {
        // Opening manually: override until next scheduled closing time
        const todayHours = businessHours
          .filter(h => h.day_of_week === currentDay && h.is_open)
          .sort((a, b) => {
            const [aH, aM] = a.closing_time.split(':').map(Number);
            const [bH, bM] = b.closing_time.split(':').map(Number);
            return (aH * 60 + aM) - (bH * 60 + bM);
          });
        let foundClose = false;
        for (const period of todayHours) {
          const [cH, cM] = period.closing_time.split(':').map(Number);
          if (cH * 60 + cM > currentMinutes) {
            const closeDate = new Date(now);
            closeDate.setHours(cH, cM, 0, 0);
            overrideUntil = closeDate.toISOString();
            foundClose = true;
            break;
          }
        }
        if (!foundClose) {
          for (let i = 1; i <= 7; i++) {
            const checkDay = (currentDay + i) % 7;
            const dayHrs = businessHours.filter(h => h.day_of_week === checkDay && h.is_open)
              .sort((a, b) => {
                const [aH, aM] = a.closing_time.split(':').map(Number);
                const [bH, bM] = b.closing_time.split(':').map(Number);
                return (bH * 60 + bM) - (aH * 60 + aM);
              });
            if (dayHrs.length > 0) {
              const [cH, cM] = dayHrs[0].closing_time.split(':').map(Number);
              const closeDate = new Date(now);
              closeDate.setDate(closeDate.getDate() + i);
              closeDate.setHours(cH, cM, 0, 0);
              overrideUntil = closeDate.toISOString();
              break;
            }
          }
        }
        if (!overrideUntil) {
          overrideUntil = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
        }
      } else {
        // Closing manually: override until next scheduled opening time
        for (let i = 0; i <= 7; i++) {
          const checkDay = (currentDay + i) % 7;
          const dayHrs = businessHours
            .filter(h => h.day_of_week === checkDay && h.is_open)
            .sort((a, b) => {
              const [aH, aM] = a.opening_time.split(':').map(Number);
              const [bH, bM] = b.opening_time.split(':').map(Number);
              return (aH * 60 + aM) - (bH * 60 + bM);
            });
          for (const period of dayHrs) {
            const [oH, oM] = period.opening_time.split(':').map(Number);
            const openMinutes = oH * 60 + oM;
            if (i === 0 && openMinutes <= currentMinutes) continue; // Skip past openings today
            const openDate = new Date(now);
            openDate.setDate(openDate.getDate() + i);
            openDate.setHours(oH, oM, 0, 0);
            overrideUntil = openDate.toISOString();
            break;
          }
          if (overrideUntil) break;
        }
        if (!overrideUntil) {
          overrideUntil = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
        }
      }
    }

    const { data: updatedRestaurant, error } = await supabase
      .from("restaurants")
      .update({ is_open: newIsOpen, manual_override_until: overrideUntil } as any)
      .eq("id", selectedRestaurant.id)
      .select("id, is_open, manual_override_until")
      .maybeSingle();
    
    if (error || !updatedRestaurant) {
      toast({ title: "Erro ao atualizar", description: "Não foi possível alterar o status", variant: "destructive" });
      return;
    }
    
    setManualOverrideUntil(updatedRestaurant.manual_override_until);
    await refreshRestaurants();
    toast({
      title: newIsOpen ? "Delivery aberto!" : "Delivery fechado",
      description: newIsOpen ? "Você está recebendo pedidos" : "Você não está mais recebendo pedidos",
    });
  };

  const handleConfirmClose = () => { setShowCloseConfirm(false); handleToggleOpen(false); };
  const handleToggleClick = () => {
    if (!selectedRestaurant) return;
    if (selectedRestaurant.is_open) setShowCloseConfirm(true);
    else handleToggleOpen(true);
  };

  const handleLogoutAttempt = async () => {
    const isRestaurantOpen = selectedRestaurant?.is_open ?? false;
    const shouldGuard = isRestaurantOpen || cashRegisterOpen;

    if (shouldGuard) {
      setShowExitGuard(true);
      return;
    }

    await supabase.auth.signOut();
    clearLocalAuthState();
    navigate("/admin/auth");
  };

  const handleSafeExit = async () => {
    setExitGuardClosing(true);
    try {
      // Close restaurant if open
      if (selectedRestaurant?.is_open) {
        await handleToggleOpen(false);
      }
      // Close cash register if open
      if (cashRegisterOpen && selectedRestaurant) {
        const { data: openRegister } = await supabase
          .from("cash_registers").select("id")
          .eq("restaurant_id", selectedRestaurant.id).eq("status", "open")
          .order("created_at", { ascending: false }).limit(1).maybeSingle() as any;
        if (openRegister) {
          await supabase.from("cash_registers")
            .update({ closing_amount: 0, closed_at: new Date().toISOString(), status: "closed" } as any)
            .eq("id", openRegister.id);
          setCashRegisterOpen(false);
        }
      }
      toast({ title: "Tudo encerrado!", description: "Restaurante e caixa fechados com segurança." });
    } finally {
      setExitGuardClosing(false);
      setShowExitGuard(false);
    }
  };

  const handleCashRegisterClick = () => {
    setCashRegisterMode(cashRegisterOpen ? "close" : "open");
    setShowCashRegister(true);
  };

  const handleCashRegisterConfirm = async (amount: number, operatorName: string) => {
    if (!selectedRestaurant) return;
    setCashRegisterLoading(true);

    if (cashRegisterMode === "close") {
      const { data: openRegister } = await supabase
        .from("cash_registers").select("id")
        .eq("restaurant_id", selectedRestaurant.id).eq("status", "open")
        .order("created_at", { ascending: false }).limit(1).maybeSingle() as any;

      if (openRegister) {
        await supabase.from("cash_registers")
          .update({ closing_amount: amount, closed_at: new Date().toISOString(), status: "closed" } as any)
          .eq("id", openRegister.id);
      } else {
        await supabase.from("cash_registers")
          .insert({ restaurant_id: selectedRestaurant.id, opened_by: operatorName, opening_amount: 0, closing_amount: amount, closed_at: new Date().toISOString(), status: "closed" } as any);
      }
      setCashRegisterLoading(false);
      setShowCashRegister(false);
      setCashRegisterOpen(false);
      toast({ title: "Caixa fechado!", description: "O caixa foi encerrado com sucesso." });
    } else {
      const { error: crError } = await supabase
        .from("cash_registers")
        .insert({ restaurant_id: selectedRestaurant.id, opened_by: operatorName, opening_amount: amount, status: "open" } as any);
      if (crError) {
        toast({ title: "Erro ao abrir caixa", description: crError.message, variant: "destructive" });
        setCashRegisterLoading(false);
        return;
      }
      // Refresh opened_at from the newly created register
      const { data: newReg } = await supabase
        .from("cash_registers")
        .select("opened_at")
        .eq("restaurant_id", selectedRestaurant.id)
        .eq("status", "open")
        .limit(1)
        .maybeSingle();
      setCashRegisterOpenedAt(newReg?.opened_at || new Date().toISOString());
      setCashRegisterLoading(false);
      setShowCashRegister(false);
      setCashRegisterOpen(true);
      toast({ title: "Caixa aberto!", description: "O caixa foi aberto com sucesso." });
    }
  };

  return (
    <>
      <SidebarProvider>
        <div className="min-h-screen flex w-full relative">
          {/* Background image - light mode */}
          <div 
            className="fixed inset-0 z-0 dark:hidden"
            style={{
              backgroundImage: `url(${adminBgLight})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundAttachment: 'fixed',
            }}
          />
          {/* Background image - dark mode */}
          <div 
            className="fixed inset-0 z-0 hidden dark:block"
            style={{
              backgroundImage: `url(${adminBgDark})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundAttachment: 'fixed',
            }}
          />
          {/* Semi-transparent overlay for readability */}
          <div className="fixed inset-0 z-0 bg-background/60 dark:bg-background/50" />
          {!isKioskMode && <AdminSidebar pendingOrdersCount={pendingOrdersCount} isCollaborator={isCollaborator} canAccessWhatsAppBot={canAccessWhatsAppBot} isMaster={userRole === "master"} onLogout={handleLogoutAttempt} />}
          <main className="flex-1 overflow-auto relative z-10">
            {showSubAlert && daysRemaining !== null && (
              <SubscriptionExpiryBanner
                daysRemaining={daysRemaining}
                subscriptionEnd={subscriptionEnd}
                isTrial={isTrial}
                trialExpired={trialExpired}
              />
            )}
            
            {/* Setup banner for incomplete restaurant configuration */}
            {selectedRestaurant && selectedRestaurant.name === "Meu Restaurante" && (
              <div className="mx-4 mt-4 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/50 rounded-full flex items-center justify-center flex-shrink-0">
                    <Store className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-amber-900 dark:text-amber-100 mb-1">Configure seu restaurante</h3>
                    <p className="text-sm text-amber-700 dark:text-amber-300 mb-3">
                      Complete o cadastro do seu restaurante para começar a receber pedidos. Adicione nome, logo, horários de funcionamento e mais.
                    </p>
                    <Button 
                      size="sm" 
                      className="bg-amber-600 hover:bg-amber-700 text-white"
                      onClick={() => window.location.href = "/admin/negocio"}
                    >
                      Configurar meu restaurante agora
                    </Button>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/50"
                    onClick={() => {
                      // Dismiss banner by storing in localStorage
                      localStorage.setItem('setupBannerDismissed', 'true');
                      window.location.reload();
                    }}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
            {!isKioskMode && (
              <header className="h-14 md:h-16 border-b border-border/30 dark:border-white/5 flex items-center px-3 md:px-6 gap-2 md:gap-4 bg-background/70 dark:bg-background/60 backdrop-blur-2xl sticky top-0 z-10">
                <SidebarTrigger>
                  <Menu className="w-5 h-5" />
                </SidebarTrigger>
                <div className="flex-1" />
                
                {/* Toggle Delivery Status */}
                <Button
                  variant={selectedRestaurant?.is_open ? "default" : "outline"}
                  size="sm"
                  onClick={handleToggleClick}
                  className={`gap-1.5 md:gap-2 rounded-full text-xs md:text-sm px-2.5 md:px-3 ${
                    selectedRestaurant?.is_open 
                      ? "bg-accent hover:bg-accent/90 text-accent-foreground" 
                      : "border-destructive text-destructive hover:bg-destructive/10"
                  }`}
                >
                  <Store className="w-4 h-4" />
                  <span className="hidden sm:inline">{selectedRestaurant?.is_open ? "Restaurante Aberto" : "Restaurante Fechado"}</span>
                  <span className="sm:hidden">{selectedRestaurant?.is_open ? "Aberto" : "Fechado"}</span>
                </Button>

                {/* Cash Register Button */}
                <Button
                  variant={cashRegisterOpen ? "default" : "outline"}
                  size="sm"
                  onClick={handleCashRegisterClick}
                  className={`gap-1.5 md:gap-2 rounded-full text-xs md:text-sm px-2.5 md:px-3 ${
                    cashRegisterOpen
                      ? "bg-accent hover:bg-accent/90 text-accent-foreground"
                      : "border-muted-foreground/30 text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <DollarSign className="w-4 h-4" />
                  <span className="hidden sm:inline">{cashRegisterOpen ? "Caixa Aberto" : "Caixa Fechado"}</span>
                  <span className="sm:hidden">{cashRegisterOpen ? "Caixa" : "Caixa"}</span>
                </Button>

                {location.pathname !== "/admin/salao" && (
                  <Button
                    size="sm"
                    onClick={() => {
                      navigate("/admin/pedidos?pedido_manual=true");
                    }}
                    disabled={!selectedRestaurant}
                    className="gap-1.5 bg-orange-500 hover:bg-orange-600 text-white"
                  >
                    <Plus className="w-4 h-4" />
                    <span className="hidden sm:inline">Pedido Manual</span>
                    <span className="sm:hidden">Manual</span>
                  </Button>
                )}

                <ThemeToggle />
                <span className="text-sm text-muted-foreground font-medium hidden md:inline">{user?.email}</span>
              </header>
            )}
            <div className="p-2 md:p-6 relative z-10">
              <Outlet context={{ cashRegisterOpen }} />
            </div>
          </main>
        </div>
      </SidebarProvider>

      <HelpChatWidget />

      <AlertDialog open={showCloseConfirm} onOpenChange={setShowCloseConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Fechar o delivery?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                Ao fechar o delivery, você não receberá novos pedidos. Clientes verão que o estabelecimento está fechado.
              </span>
              {pendingOrdersCount > 0 && (
                <span className="block font-medium text-amber-600 dark:text-amber-500">
                  ⚠️ Você ainda tem {pendingOrdersCount} pedido{pendingOrdersCount !== 1 ? 's' : ''} pendente{pendingOrdersCount !== 1 ? 's' : ''} para atender.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmClose} className="bg-destructive hover:bg-destructive/90">
              Sim, fechar delivery
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CashRegisterDialog
        open={showCashRegister}
        onOpenChange={setShowCashRegister}
        userName={profileName || user?.email || "Operador"}
        onConfirm={handleCashRegisterConfirm}
        loading={cashRegisterLoading}
        mode={cashRegisterMode}
        restaurantId={selectedRestaurant?.id}
        cashRegisterOpenedAt={cashRegisterOpenedAt}
      />

      {/* Exit Guard Dialog */}
      <Dialog open={showExitGuard} onOpenChange={setShowExitGuard}>
        <DialogContent className="max-w-md w-full mx-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              ⚠️ Atenção antes de sair
            </DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-3">
                <span className="block">
                  Você ainda tem operações ativas. Se fechar esta janela sem encerrar, o sistema continuará funcionando:
                </span>
                <div className="space-y-2 w-full">
                  {selectedRestaurant?.is_open && (
                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-accent/10 border border-accent/20 w-full">
                      <Store className="w-4 h-4 text-accent flex-shrink-0" />
                      <span className="text-sm font-medium text-foreground">Restaurante aberto — continuará recebendo pedidos</span>
                    </div>
                  )}
                  {cashRegisterOpen && (
                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-primary/10 border border-primary/20 w-full">
                      <DollarSign className="w-4 h-4 text-primary flex-shrink-0" />
                      <span className="text-sm font-medium text-foreground">Caixa aberto — permanecerá aberto sem registro de fechamento</span>
                    </div>
                  )}
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-wrap gap-2 justify-end mt-4">
            <Button variant="outline" onClick={() => setShowExitGuard(false)} className="flex-1 sm:flex-none">Voltar ao painel</Button>
            <Button
              onClick={(e) => {
                e.preventDefault();
                handleSafeExit();
              }}
              disabled={exitGuardClosing}
              className="bg-primary hover:bg-primary/90 gap-2 flex-1 sm:flex-none"
            >
              {exitGuardClosing ? "Encerrando..." : "Fechar tudo com segurança"}
            </Button>
            <Button
              onClick={async (e) => {
                e.preventDefault();
                setShowExitGuard(false);
                await supabase.auth.signOut();
                clearLocalAuthState();
                navigate("/admin/auth");
              }}
              variant="destructive"
              className="flex-1 sm:flex-none"
            >
              Sair mesmo assim
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function AdminLayout() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const [tempUserId, setTempUserId] = useState<string | undefined>(undefined);
  const { role: userRole, isCollaborator, restaurantId: collabRestaurantId, loading: roleLoading } = useUserRole(tempUserId);
  const { isKioskMode } = usePDVKiosk();

  // Unlock audio on mount
  useEffect(() => {
    const handler = () => unlockAudio();
    document.addEventListener('click', handler, { once: true });
    document.addEventListener('touchstart', handler, { once: true });
    return () => { document.removeEventListener('click', handler); document.removeEventListener('touchstart', handler); };
  }, []);

  useEffect(() => {
    let mounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;

      // Se o token foi revogado/expirou, limpa tudo e manda pro login
      if (event === "TOKEN_REFRESHED" && !session) {
        clearLocalAuthState();
        setUser(null);
        setTempUserId(undefined);
        setLoading(false);
        return;
      }

      setUser(session?.user ?? null);
      setTempUserId(session?.user?.id);
      setLoading(false);
      // Init push notifications when user signs in on native
      if (session?.user) {
        initPushNotifications();
      }
    });

    // getSession primeiro restaura do storage; se der erro de refresh token,
    // limpamos estado local para evitar loop de "não consigo entrar".
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (!mounted) return;

      if (error && isRefreshTokenError(error)) {
        clearLocalAuthState();
        setUser(null);
        setTempUserId(undefined);
        setLoading(false);
        return;
      }

      setUser(session?.user ?? null);
      setTempUserId(session?.user?.id);
      setLoading(false);
      if (session?.user) {
        initPushNotifications();
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!loading && !user) navigate("/admin/auth");
  }, [user, loading, navigate]);

  if (loading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="space-y-4 w-64">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-8 w-1/2" />
        </div>
      </div>
    );
  }

  if (!user) return null;

  const isMaster = userRole === "master";

  return (
    <RestaurantProvider user={user} isCollaborator={isCollaborator} isMaster={isMaster} collabRestaurantId={collabRestaurantId}>
      <AdminLayoutInner />
    </RestaurantProvider>
  );
}
