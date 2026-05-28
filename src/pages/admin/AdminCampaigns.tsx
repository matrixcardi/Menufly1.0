import { useState, useMemo, useEffect } from "react";
import { useRestaurantContext } from "@/contexts/RestaurantContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  MessageCircle,
  Plus,
  Search,
  AlertTriangle,
  Pause,
  Play,
  Clock,
  CheckCircle,
  Send,
  Eye,
  Trash2,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import CreateCampaignDialog from "@/components/campaigns/CreateCampaignDialog";
import CampaignDetailsDrawer from "@/components/campaigns/CampaignDetailsDrawer";
import WhatsAppConnection from "@/components/campaigns/WhatsAppConnection";
import WhatsappCreditsCard from "@/components/campaigns/WhatsappCreditsCard";

type CampaignStatus = "scheduled" | "running" | "paused" | "completed";

interface Campaign {
  id: string;
  name: string;
  status: CampaignStatus;
  createdAt: Date;
  scheduledAt?: Date;
  clientCount: number;
  sentCount: number;
  failedCount: number;
  sales: number;
  revenue: number;
  filter?: string;
  imageUrl?: string | null;
}

const statusConfig: Record<CampaignStatus, { label: string; color: string; icon: React.ReactNode }> = {
  scheduled: { 
    label: "Aguardando", 
    color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
    icon: <Clock className="w-3 h-3" />
  },
  running: { 
    label: "Em andamento", 
    color: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
    icon: <Play className="w-3 h-3" />
  },
  paused: { 
    label: "Pausada", 
    color: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
    icon: <Pause className="w-3 h-3" />
  },
  completed: { 
    label: "Concluída", 
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
    icon: <CheckCircle className="w-3 h-3" />
  },
};

export default function AdminCampaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [monthFilter, setMonthFilter] = useState("current");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [detailsCampaignId, setDetailsCampaignId] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [restaurantName, setRestaurantName] = useState("");
  const [restaurantSlug, setRestaurantSlug] = useState("");
  const [userId, setUserId] = useState<string | undefined>();
  const itemsPerPage = 6;

  const { selectedRestaurantId: ctxSelectedId, selectedRestaurantIds } = useRestaurantContext();
  const ctxRestaurantId = ctxSelectedId === "all" ? selectedRestaurantIds[0] : ctxSelectedId;

  // Get current user
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id));
  }, []);

  // Fetch restaurant
  useEffect(() => {
    if (!ctxRestaurantId) return;

    async function fetchRestaurant() {
      const { data } = await supabase
        .from("restaurants")
        .select("id, name, slug")
        .eq("id", ctxRestaurantId)
        .maybeSingle();

      if (data) {
        setRestaurantId(data.id);
        setRestaurantName(data.name);
        setRestaurantSlug(data.slug || "");
      }
    }

    fetchRestaurant();
  }, [ctxRestaurantId]);

  // Load campaigns from database
  const loadCampaigns = async () => {
    if (!restaurantId) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("campaigns")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const mapped: Campaign[] = (data || []).map((c) => ({
        id: c.id,
        name: c.name,
        status: c.status as CampaignStatus,
        createdAt: new Date(c.created_at),
        scheduledAt: c.scheduled_at ? new Date(c.scheduled_at) : undefined,
        clientCount: c.total_recipients,
        sentCount: c.sent_count,
        failedCount: c.failed_count,
        sales: 0,
        revenue: 0,
        filter: c.filter_type,
        imageUrl: (c as any).image_url || null,
      }));
      setCampaigns(mapped);
    } catch (e) {
      console.error("Error loading campaigns:", e);
      setCampaigns([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCampaigns();
  }, [restaurantId]);

  // Auto-refresh running campaigns every 30s
  useEffect(() => {
    const hasRunning = campaigns.some(c => c.status === "running");
    if (!hasRunning) return;
    const interval = setInterval(loadCampaigns, 30000);
    return () => clearInterval(interval);
  }, [campaigns, restaurantId]);

  const filteredCampaigns = useMemo(() => {
    let filtered = campaigns.filter(c => 
      c.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const now = new Date();
    if (monthFilter === "current") {
      filtered = filtered.filter(c => 
        c.createdAt.getMonth() === now.getMonth() && 
        c.createdAt.getFullYear() === now.getFullYear()
      );
    } else if (monthFilter === "last") {
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1);
      filtered = filtered.filter(c => 
        c.createdAt.getMonth() === lastMonth.getMonth() && 
        c.createdAt.getFullYear() === lastMonth.getFullYear()
      );
    }

    return filtered;
  }, [campaigns, searchQuery, monthFilter]);

  const paginatedCampaigns = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredCampaigns.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredCampaigns, currentPage]);

  const totalPages = Math.ceil(filteredCampaigns.length / itemsPerPage);

  const stats = useMemo(() => ({
    totalCampaigns: campaigns.length,
    totalSent: campaigns.reduce((sum, c) => sum + c.sentCount, 0),
    totalSales: campaigns.reduce((sum, c) => sum + c.sales, 0),
    totalRevenue: campaigns.reduce((sum, c) => sum + c.revenue, 0),
  }), [campaigns]);

  const openDetails = (campaignId: string) => {
    setDetailsCampaignId(campaignId);
    setDetailsOpen(true);
  };

  const { toast } = useToast();

  const handlePauseResume = async (e: React.MouseEvent, campaignId: string, currentStatus: CampaignStatus) => {
    e.stopPropagation();
    const newStatus = currentStatus === "paused" ? "running" : "paused";
    const { error } = await supabase
      .from("campaigns")
      .update({ status: newStatus })
      .eq("id", campaignId);

    if (error) {
      toast({ title: "Erro ao atualizar", variant: "destructive" });
    } else {
      toast({ title: newStatus === "paused" ? "⏸️ Campanha pausada" : "▶️ Campanha retomada" });
      loadCampaigns();
    }
  };

  const handleDelete = async (e: React.MouseEvent, campaignId: string) => {
    e.stopPropagation();
    if (!confirm("Tem certeza que deseja excluir esta campanha? Esta ação não pode ser desfeita.")) return;

    // Delete recipients first, then campaign
    await supabase.from("campaign_recipients").delete().eq("campaign_id", campaignId);
    const { error } = await supabase.from("campaigns").delete().eq("id", campaignId);

    if (error) {
      toast({ title: "Erro ao excluir", variant: "destructive" });
    } else {
      toast({ title: "🗑️ Campanha excluída" });
      loadCampaigns();
    }
  };

  if (loading) {
    return (
      <div className="p-3 md:p-6 space-y-3 md:space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-20 md:h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
            <MessageCircle className="w-5 h-5 md:w-6 md:h-6 text-green-600 shrink-0" />
            Campanhas
          </h1>
          <p className="text-muted-foreground text-xs md:text-sm mt-0.5">
            Envie mensagens em massa para seus clientes
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5 shrink-0">
          <AlertTriangle className="w-4 h-4" />
          <span className="hidden sm:inline">Ajuda</span>
        </Button>
      </div>

      {/* Connection + Credits — side by side */}
      <div className="grid gap-3 grid-cols-1 md:grid-cols-[1fr_280px]">
        <WhatsAppConnection restaurantId={restaurantId} />
        <WhatsappCreditsCard restaurantId={restaurantId} userId={userId} />
      </div>

      {/* Stats + Filters Row */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
        {[
          { label: "Campanhas", value: String(stats.totalCampaigns) },
          { label: "Msgs Enviadas", value: String(stats.totalSent) },
          { label: "Vendas", value: String(stats.totalSales) },
          { label: "Total Vendido", value: `R$ ${stats.totalRevenue.toFixed(2).replace(".", ",")}` },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-3 text-center">
              <p className="text-[10px] md:text-xs text-muted-foreground uppercase tracking-wider font-medium">{s.label}</p>
              <p className="text-lg md:text-xl font-bold mt-0.5">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters + New Campaign */}
      <div className="flex items-center gap-2">
        <Select value={monthFilter} onValueChange={setMonthFilter}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="current">Mês atual</SelectItem>
            <SelectItem value="last">Mês passado</SelectItem>
            <SelectItem value="all">Todos</SelectItem>
          </SelectContent>
        </Select>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button 
          className="gap-1.5 bg-green-600 hover:bg-green-700 shrink-0 text-xs md:text-sm px-3 md:px-4"
          onClick={() => setCreateDialogOpen(true)}
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">CAMPANHA</span>
          <span className="sm:hidden">Nova</span>
        </Button>
      </div>

      {/* Campaigns List */}
      <Card>
        <CardContent className="p-0">
          {/* Desktop Table Header */}
          <div className="hidden md:grid grid-cols-[160px_1fr_160px_110px_auto] gap-4 px-4 py-3 border-b bg-muted/30 text-sm font-medium text-muted-foreground">
            <div>Status</div>
            <div>Nome</div>
            <div>Progresso</div>
            <div>Criação</div>
            <div className="text-right">Ações</div>
          </div>

          {/* Campaign Rows */}
          {paginatedCampaigns.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <MessageCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma campanha encontrada</p>
              <p className="text-sm mt-1">Crie sua primeira campanha para começar</p>
            </div>
          ) : (
            <>
              {/* Desktop Rows */}
              <div className="hidden md:block">
                {paginatedCampaigns.map((campaign) => {
                  const status = statusConfig[campaign.status];
                  const progress = campaign.clientCount > 0
                    ? Math.round(((campaign.sentCount + campaign.failedCount) / campaign.clientCount) * 100)
                    : 0;
                  return (
                    <div 
                      key={campaign.id} 
                      className="grid grid-cols-[160px_1fr_160px_110px_auto] gap-4 px-4 py-4 border-b last:border-b-0 items-center hover:bg-muted/20 transition-colors cursor-pointer"
                      onClick={() => openDetails(campaign.id)}
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        {campaign.imageUrl && (
                          <img src={campaign.imageUrl} alt="" className="w-10 h-10 rounded-md object-cover flex-shrink-0 border" />
                        )}
                        <Badge variant="secondary" className={`gap-1 text-[10px] whitespace-nowrap ${status.color}`}>
                          {status.icon}
                          {status.label}
                        </Badge>
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium truncate">{campaign.name}</p>
                        {campaign.scheduledAt && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                            <Clock className="w-3 h-3 shrink-0" />
                            {format(campaign.scheduledAt, "dd/MM 'às' HH:mm", { locale: ptBR })}
                          </p>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Progress value={progress} className="h-1.5 flex-1" />
                          <span className="text-xs text-muted-foreground whitespace-nowrap">{campaign.sentCount}/{campaign.clientCount}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{campaign.sentCount} enviadas</p>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format(campaign.createdAt, "dd/MM/yy", { locale: ptBR })}
                        <br />
                        {format(campaign.createdAt, "HH:mm", { locale: ptBR })}
                      </div>
                      <div className="flex items-center justify-end gap-1">
                        {(campaign.status === "scheduled" || campaign.status === "running" || campaign.status === "paused") && (
                          <Button variant="outline" size="icon" className="h-8 w-8" onClick={(e) => handlePauseResume(e, campaign.id, campaign.status)}>
                            {campaign.status === "paused" ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                          </Button>
                        )}
                        {campaign.status !== "completed" && (
                          <Button variant="outline" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={(e) => handleDelete(e, campaign.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); openDetails(campaign.id); }}>
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden divide-y">
                {paginatedCampaigns.map((campaign) => {
                  const status = statusConfig[campaign.status];
                  const progress = campaign.clientCount > 0
                    ? Math.round(((campaign.sentCount + campaign.failedCount) / campaign.clientCount) * 100)
                    : 0;
                  return (
                    <div 
                      key={campaign.id} 
                      className="p-3 space-y-2.5 active:bg-muted/20 transition-colors"
                      onClick={() => openDetails(campaign.id)}
                    >
                      <div className="flex items-center gap-2.5">
                        {campaign.imageUrl && (
                          <img src={campaign.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0 border" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate">{campaign.name}</p>
                          {campaign.scheduledAt && (
                            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {format(campaign.scheduledAt, "dd/MM 'às' HH:mm", { locale: ptBR })}
                            </p>
                          )}
                        </div>
                        <Badge variant="secondary" className={`gap-1 text-[10px] shrink-0 ${status.color}`}>
                          {status.icon}
                          {status.label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Progress value={progress} className="h-1.5 flex-1" />
                        <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                          {campaign.sentCount}/{campaign.clientCount} enviadas
                        </span>
                      </div>
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[11px] text-muted-foreground">
                          {format(campaign.createdAt, "dd/MM/yy HH:mm", { locale: ptBR })}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {(campaign.status === "scheduled" || campaign.status === "running" || campaign.status === "paused") && (
                            <Button variant="outline" size="sm" className="h-7 text-xs px-2 gap-1" onClick={(e) => handlePauseResume(e, campaign.id, campaign.status)}>
                              {campaign.status === "paused" ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
                            </Button>
                          )}
                          {campaign.status !== "completed" && (
                            <Button variant="outline" size="sm" className="h-7 text-xs px-2 text-destructive hover:text-destructive" onClick={(e) => handleDelete(e, campaign.id)}>
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          )}
                          <Button variant="outline" size="sm" className="h-7 text-xs px-2 gap-1" onClick={(e) => { e.stopPropagation(); openDetails(campaign.id); }}>
                            <Eye className="w-3 h-3" /> Ver
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Mostrando {paginatedCampaigns.length} resultados de {filteredCampaigns.length} resultados
          </p>
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious 
                  href="#" 
                  onClick={(e) => {
                    e.preventDefault();
                    setCurrentPage(p => Math.max(1, p - 1));
                  }}
                />
              </PaginationItem>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <PaginationItem key={page}>
                  <PaginationLink
                    href="#"
                    isActive={currentPage === page}
                    onClick={(e) => {
                      e.preventDefault();
                      setCurrentPage(page);
                    }}
                  >
                    {page}
                  </PaginationLink>
                </PaginationItem>
              ))}
              <PaginationItem>
                <PaginationNext 
                  href="#" 
                  onClick={(e) => {
                    e.preventDefault();
                    setCurrentPage(p => Math.min(totalPages, p + 1));
                  }}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}

      {/* Create Campaign Dialog */}
      <CreateCampaignDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        restaurantId={restaurantId}
        restaurantName={restaurantName}
        restaurantSlug={restaurantSlug}
        onCampaignCreated={loadCampaigns}
      />

      {/* Campaign Details Drawer */}
      <CampaignDetailsDrawer
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        campaignId={detailsCampaignId}
      />
    </div>
  );
}
