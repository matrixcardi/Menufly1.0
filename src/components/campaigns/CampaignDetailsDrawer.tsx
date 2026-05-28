import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Send,
  CheckCheck,
  ShoppingCart,
  Users,
  Clock,
  XCircle,
  MessageCircle,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface CampaignDetailsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string | null;
}

interface Recipient {
  id: string;
  customer_name: string;
  customer_phone: string;
  status: string;
  sent_at: string | null;
  error_message: string | null;
}

interface CampaignDetails {
  id: string;
  name: string;
  status: string;
  filter_type: string;
  message_template: string;
  scheduled_at: string;
  started_at: string | null;
  completed_at: string | null;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  image_url: string | null;
}

const statusLabels: Record<string, { label: string; color: string }> = {
  scheduled: { label: "Aguardando", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300" },
  running: { label: "Em andamento", color: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" },
  paused: { label: "Pausada", color: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300" },
  completed: { label: "Concluída", color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" },
};

const recipientStatusLabels: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  pending: { label: "Pendente", icon: <Clock className="w-3 h-3" />, color: "text-muted-foreground" },
  sent: { label: "Enviada", icon: <Send className="w-3 h-3" />, color: "text-green-600" },
  failed: { label: "Falhou", icon: <XCircle className="w-3 h-3" />, color: "text-destructive" },
};

export default function CampaignDetailsDrawer({
  open,
  onOpenChange,
  campaignId,
}: CampaignDetailsDrawerProps) {
  const [campaign, setCampaign] = useState<CampaignDetails | null>(null);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [conversions, setConversions] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open || !campaignId) return;
    setLoading(true);

    async function fetchDetails() {
      // Fetch campaign + recipients in parallel
      const [campaignRes, recipientsRes] = await Promise.all([
        supabase
          .from("campaigns")
          .select("*")
          .eq("id", campaignId!)
          .single(),
        supabase
          .from("campaign_recipients")
          .select("*")
          .eq("campaign_id", campaignId!)
          .order("sent_at", { ascending: false, nullsFirst: false }),
      ]);

      if (campaignRes.data) {
        setCampaign(campaignRes.data as CampaignDetails);

        // Calculate conversions: orders from campaign recipient phones after campaign started
        const startDate = campaignRes.data.started_at || campaignRes.data.scheduled_at;
        const phones = (recipientsRes.data || []).map((r) => {
          let phone = r.customer_phone.replace(/\D/g, "");
          // Normalize to 11 digits (remove country code if present)
          if (phone.startsWith("55") && phone.length >= 12) {
            phone = phone.substring(2);
          }
          return phone;
        });

        if (phones.length > 0 && startDate) {
          const { count } = await supabase
            .from("orders")
            .select("id", { count: "exact" })
            .eq("restaurant_id", campaignRes.data.restaurant_id)
            .gte("created_at", startDate)
            .in("customer_phone", phones);

          setConversions(count || 0);
        }
      }

      setRecipients((recipientsRes.data as Recipient[]) || []);
      setLoading(false);
    }

    fetchDetails();
  }, [open, campaignId]);

  const stats = useMemo(() => {
    if (!campaign) return null;
    const sent = campaign.sent_count;
    const failed = campaign.failed_count;
    const pending = campaign.total_recipients - sent - failed;
    const progress = campaign.total_recipients > 0
      ? Math.round(((sent + failed) / campaign.total_recipients) * 100)
      : 0;
    return { sent, failed, pending, progress };
  }, [campaign]);

  const statusConfig = campaign ? statusLabels[campaign.status] || statusLabels.scheduled : statusLabels.scheduled;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-green-600" />
            Detalhes da Campanha
          </SheetTitle>
        </SheetHeader>

        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : !campaign ? (
          <p className="text-muted-foreground text-center py-12">Campanha não encontrada</p>
        ) : (
          <div className="space-y-6">
            {/* Campaign Info */}
            <div>
              <h3 className="text-lg font-semibold">{campaign.name}</h3>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary" className={statusConfig.color}>
                  {statusConfig.label}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {campaign.filter_type === "first_purchase" && "Primeira Compra"}
                  {campaign.filter_type === "recent_15" && "Recentes (15 dias)"}
                  {campaign.filter_type === "inactive_30" && "Inativos (+30 dias)"}
                </span>
              </div>
              {campaign.started_at && (
                <p className="text-xs text-muted-foreground mt-2">
                  Iniciada em {format(new Date(campaign.started_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </p>
              )}
            </div>

            {/* Campaign Image */}
            {campaign.image_url && (
              <div>
                <img
                  src={campaign.image_url}
                  alt="Imagem da campanha"
                  className="w-full rounded-lg border object-cover max-h-48"
                />
              </div>
            )}

            {/* Progress */}
            {stats && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Progresso</span>
                  <span className="font-medium">{stats.progress}%</span>
                </div>
                <Progress value={stats.progress} className="h-2" />
              </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border bg-card p-4 text-center">
                <Send className="w-5 h-5 mx-auto mb-1 text-green-600" />
                <p className="text-2xl font-bold">{stats?.sent || 0}</p>
                <p className="text-xs text-muted-foreground">Enviadas</p>
              </div>
              <div className="rounded-xl border bg-card p-4 text-center">
                <CheckCheck className="w-5 h-5 mx-auto mb-1 text-blue-500" />
                <p className="text-2xl font-bold">{stats?.sent || 0}</p>
                <p className="text-xs text-muted-foreground">Visualizadas</p>
              </div>
              <div className="rounded-xl border bg-card p-4 text-center">
                <ShoppingCart className="w-5 h-5 mx-auto mb-1 text-primary" />
                <p className="text-2xl font-bold">{conversions}</p>
                <p className="text-xs text-muted-foreground">Conversões</p>
              </div>
              <div className="rounded-xl border bg-card p-4 text-center">
                <Users className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
                <p className="text-2xl font-bold">{campaign.total_recipients}</p>
                <p className="text-xs text-muted-foreground">Destinatários</p>
              </div>
            </div>

            {/* Failed count */}
            {stats && stats.failed > 0 && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <XCircle className="w-4 h-4 text-destructive" />
                <span className="text-sm text-destructive">
                  {stats.failed} mensagem{stats.failed !== 1 ? "ns" : ""} falhou{stats.failed !== 1 ? "ram" : ""}
                </span>
              </div>
            )}

            {/* Recipients List */}
            <div>
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <Users className="w-4 h-4" />
                Destinatários ({recipients.length})
              </h4>
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {recipients.map((r) => {
                  const rStatus = recipientStatusLabels[r.status] || recipientStatusLabels.pending;
                  return (
                    <div
                      key={r.id}
                      className="flex items-center justify-between p-2.5 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{r.customer_name}</p>
                        <p className="text-xs text-muted-foreground">{r.customer_phone}</p>
                      </div>
                      <div className={`flex items-center gap-1 text-xs font-medium ${rStatus.color}`}>
                        {rStatus.icon}
                        {rStatus.label}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Message Preview */}
            <div>
              <h4 className="font-medium mb-2">Mensagem</h4>
              <div className="p-3 rounded-lg bg-muted/50 border text-sm whitespace-pre-wrap max-h-40 overflow-y-auto">
                {campaign.message_template}
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
