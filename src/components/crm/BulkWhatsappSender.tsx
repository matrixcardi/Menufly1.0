import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
  Send,
  Users,
  Clock,
  AlertTriangle,
  MessageCircle,
  X,
  CalendarIcon,
  Ticket,
  Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurantContext } from "@/contexts/RestaurantContext";
import { useWhatsappCredits } from "@/hooks/useWhatsappCredits";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface Customer {
  id: string;
  name: string;
  phone: string;
  lastOrder: string;
  totalOrders: number;
  totalSpent: number;
  daysInactive: number;
}

type FilterOption =
  | "all"
  | "first_purchase"
  | "last_week"
  | "last_15"
  | "last_30"
  | "last_60"
  | "last_90"
  | "inactive";

interface BulkWhatsappSenderProps {
  selectedCustomers: Customer[];
  restaurantName: string;
  restaurantId: string;
  currentFilter: FilterOption;
  onClearSelection: () => void;
}

const DAILY_LIMIT = 50;

// Templates de mensagem por filtro
const getFilterMessageTemplate = (filter: FilterOption, restaurantName: string): string => {
  const restName = restaurantName || "nosso restaurante";

  switch (filter) {
    case "first_purchase":
      return `Oii {nome}! 😊

Vi que você fez seu primeiro pedido conosco...

Gostou do lanche?? 🍔

Queria aproveitar para te presentear com um Cupom de R$10,00 para pedir conosco! 🎁

Ele vai ficar ativo até Sexta, busca pedir no link abaixo e usar o cupom "PRESENTE" até mais!!

👉 [Link de pedido]

Esperamos você de volta no ${restName}! ❤️`;

    case "last_week":
      return `Oii {nome}! 😊

Vi que pediu conosco recentemente...

Gostou do lanche?? 🍔

Queria aproveitar para te presentear com um Cupom de R$10,00 para pedir conosco! 🎁

Ele vai ficar ativo até Sexta, busca pedir no link abaixo e usar o cupom "PRESENTE" até mais!!

👉 [Link de pedido]

Esperamos você de volta no ${restName}! ❤️`;

    case "last_15":
      return `Oi {nome}! 😊

Que bom ter você como cliente do ${restName}!

Estamos com saudades! Que tal repetir aquele pedido delicioso? 🍔

Esperamos você!`;

    case "last_30":
      return `Olá!! {nome} tudo certo? 😊

Sou a equipe aqui do ${restName}! Vi que faz mais de 30 dias desde que pediu conosco e estou passando para te dar um presente! 🎁

Pedindo conosco até Sexta você vai ganhar uma porção de fritas por nossa conta! 🍟

Basta usar o cupom "VOLTEI" que eu vou saber que é você! Sempre no link abaixo:

👉 [Link de pedido]

Te esperamos! ❤️`;

    case "last_60":
      return `Oi {nome}! 💛

Sentimos muito sua falta! Para celebrar seu retorno, preparamos uma condição especial só para você! 🎉

Não perca essa oportunidade!

Esperamos seu pedido! 😊`;

    case "last_90":
      return `Olá {nome}! 🙏

Queremos muito te ver de volta! Por isso, estamos oferecendo um desconto exclusivo no seu próximo pedido! 🏷️

Volte a fazer parte da nossa família!

Te esperamos!`;

    case "inactive":
      return `Oi {nome}! ❤️

Faz tempo que não nos falamos...

O ${restName} sente muito a sua falta!

Queremos reconquistar você! Por isso, preparamos uma oferta imperdível exclusiva para o seu retorno! 🔥

Responda essa mensagem e ganhe um brinde especial no pedido!

Esperamos ansiosamente seu retorno! 😊`;

    default:
      return `Olá {nome}! 👋

Temos novidades no ${restName} esperando por você!

Venha conferir nosso cardápio e faça seu pedido! 🍔

Te esperamos!`;
  }
};

const getFilterLabel = (filter: FilterOption): string => {
  const labels: Record<FilterOption, string> = {
    all: "Todos os clientes",
    first_purchase: "Primeira compra",
    last_week: "Última semana",
    last_15: "8-15 dias",
    last_30: "16-30 dias",
    last_60: "31-60 dias",
    last_90: "61-90 dias",
    inactive: "Inativos (+90 dias)",
  };
  return labels[filter];
};

export default function BulkWhatsappSender({
  selectedCustomers,
  restaurantName,
  restaurantId,
  currentFilter,
  onClearSelection,
}: BulkWhatsappSenderProps) {
  const { toast } = useToast();
  const { selectedRestaurant } = useRestaurantContext();
  const { credits, refetch: refetchCredits } = useWhatsappCredits(restaurantId);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [warningDialogOpen, setWarningDialogOpen] = useState(false);
  const [riskAcknowledged, setRiskAcknowledged] = useState(false);
  const [queue, setQueue] = useState<Customer[]>([]);
  const [customMessage, setCustomMessage] = useState("");
  const [saving, setSaving] = useState(false);

  // Scheduling state
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>(undefined);
  const [scheduledTime, setScheduledTime] = useState("18:00");

  const menuLink = useMemo(() => {
    return selectedRestaurant?.slug
      ? `${window.location.origin}/${selectedRestaurant.slug}`
      : "";
  }, [selectedRestaurant?.slug]);

  // Update message template when filter changes
  useEffect(() => {
    const template = getFilterMessageTemplate(currentFilter, restaurantName);
    setCustomMessage(menuLink ? template.replace(/\[Link de pedido\]/g, menuLink) : template);
  }, [currentFilter, restaurantName, menuLink]);

  const startBulkSend = () => {
    if (selectedCustomers.length === 0) {
      toast({
        title: "Nenhum cliente selecionado",
        description: "Selecione pelo menos um cliente para enviar mensagens.",
        variant: "destructive",
      });
      return;
    }

    if (!selectedRestaurant?.whatsapp_connected) {
      toast({
        title: "WhatsApp não conectado",
        description: "Conecte seu WhatsApp na página de Campanhas antes de disparar mensagens automáticas.",
        variant: "destructive",
      });
      return;
    }

    if (credits.balance <= 0) {
      toast({
        title: "Sem créditos de WhatsApp",
        description: "Adquira créditos na página de Campanhas para enviar mensagens automáticas.",
        variant: "destructive",
      });
      return;
    }

    setQueue(selectedCustomers);
    setRiskAcknowledged(false);
    setWarningDialogOpen(true);
  };

  const confirmAndStart = async () => {
    if (saving) return;

    let scheduledDateTime = new Date();
    if (isScheduled && scheduledDate) {
      const [hours, minutes] = scheduledTime.split(":").map(Number);
      scheduledDateTime = new Date(scheduledDate);
      scheduledDateTime.setHours(hours, minutes, 0, 0);
    }

    setSaving(true);
    try {
      const { data: campaign, error: campaignError } = await supabase
        .from("campaigns")
        .insert({
          restaurant_id: restaurantId,
          name: `Disparo CRM — ${getFilterLabel(currentFilter)} — ${format(scheduledDateTime, "dd/MM HH:mm", { locale: ptBR })}`,
          filter_type: currentFilter,
          message_template: customMessage,
          image_url: null,
          scheduled_at: scheduledDateTime.toISOString(),
          status: "scheduled",
          total_recipients: queue.length,
          dispatch_days: [0, 1, 2, 3, 4, 5, 6],
        })
        .select()
        .single();

      if (campaignError) throw campaignError;

      const recipients = queue.map((c) => ({
        campaign_id: campaign.id,
        customer_name: c.name,
        customer_phone: c.phone,
        status: "pending",
      }));

      const { error: recipientsError } = await supabase
        .from("campaign_recipients")
        .insert(recipients);

      if (recipientsError) throw recipientsError;

      setConfirmDialogOpen(false);
      toast({
        title: isScheduled ? "Disparo agendado! 🎉" : "Disparo iniciado! 🎉",
        description: isScheduled
          ? `${queue.length} mensagens serão enviadas automaticamente a partir de ${format(scheduledDateTime, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}. Acompanhe na página de Campanhas.`
          : `${queue.length} mensagens serão enviadas automaticamente pelo seu WhatsApp conectado. Acompanhe o progresso na página de Campanhas.`,
      });

      refetchCredits();
      onClearSelection();
    } catch (error) {
      console.error("Error creating CRM dispatch:", error);
      toast({
        title: "Erro ao criar disparo",
        description: "Tente novamente em instantes.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (selectedCustomers.length === 0) return null;

  return (
    <>
      {/* Floating Action Bar */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-background border rounded-lg shadow-lg p-4 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <span className="font-medium">{selectedCustomers.length} selecionado{selectedCustomers.length !== 1 ? "s" : ""}</span>
        </div>

        <div className="h-8 w-px bg-border" />

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Ticket className="h-4 w-4" />
          <span>{credits.balance} crédito{credits.balance !== 1 ? "s" : ""}</span>
        </div>

        <div className="h-8 w-px bg-border" />

        <Button
          variant="outline"
          size="sm"
          onClick={onClearSelection}
        >
          <X className="h-4 w-4 mr-1" />
          Limpar
        </Button>

        <Button
          className="bg-green-600 hover:bg-green-700 gap-2"
          onClick={startBulkSend}
        >
          <Send className="h-4 w-4" />
          Disparar WhatsApp
        </Button>
      </div>

      {/* Risk Warning Dialog */}
      <AlertDialog open={warningDialogOpen} onOpenChange={setWarningDialogOpen}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-yellow-600 dark:text-yellow-500">
              <AlertTriangle className="h-6 w-6" />
              ⚠️ Atenção antes de disparar
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4 pt-2">
                <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 p-4 rounded-lg space-y-3">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    🚫 <strong>Risco de banimento:</strong> O WhatsApp possui sistemas automáticos de detecção de disparos em massa. Enviar mensagens para muitos contatos em sequência pode resultar no banimento temporário ou permanente do seu número, sem possibilidade de recuperação.
                  </p>
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    📵 <strong>Denúncias de clientes:</strong> Se os destinatários marcarem sua mensagem como spam, o algoritmo do WhatsApp pode bloquear seu número automaticamente. Quanto mais denúncias, maior o risco.
                  </p>
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    ⏱️ <strong>A cadência não é garantia:</strong> A plataforma envia as mensagens com intervalo entre elas e respeitando o limite diário, o que reduz o risco, mas não elimina completamente a chance de detecção. O WhatsApp analisa padrões de comportamento ao longo do tempo.
                  </p>
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    📋 <strong>Boas práticas obrigatórias:</strong> Envie apenas para clientes que realmente conhecem seu estabelecimento. Evite disparos repetidos para a mesma base em curtos períodos. Mensagens irrelevantes aumentam drasticamente o risco de denúncias.
                  </p>
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    ⚠️ <strong>Responsabilidade:</strong> O uso desta funcionalidade é de total responsabilidade do usuário. A plataforma não se responsabiliza por banimentos ou bloqueios decorrentes do uso inadequado do disparo em massa.
                  </p>
                </div>

                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="risk-checkbox"
                    checked={riskAcknowledged}
                    onChange={(e) => setRiskAcknowledged(e.target.checked)}
                    className="mt-1 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <Label
                    htmlFor="risk-checkbox"
                    className="text-sm cursor-pointer leading-tight"
                  >
                    Estou ciente dos riscos e desejo continuar
                  </Label>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setWarningDialogOpen(false);
                setConfirmDialogOpen(true);
              }}
              disabled={!riskAcknowledged}
              className={!riskAcknowledged ? "opacity-50 cursor-not-allowed" : ""}
            >
              Continuar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Confirmar Disparo em Massa
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p>
                  Você está prestes a enviar mensagens para <strong>{queue.length} cliente{queue.length !== 1 ? "s" : ""}</strong> do segmento <Badge variant="outline">{getFilterLabel(currentFilter)}</Badge>
                </p>

                <div className="bg-muted p-3 rounded-lg space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <MessageCircle className="h-4 w-4" />
                    <span>Envio <strong>automático</strong> pelo seu WhatsApp conectado — não precisa manter a aba aberta</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    <span>Cadência segura controlada pela plataforma: janela das <strong>9h às 21h</strong>, até <strong>{DAILY_LIMIT} mensagens por dia</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Ticket className="h-4 w-4" />
                    <span>Cada mensagem consome 1 crédito — saldo atual: <strong>{credits.balance}</strong></span>
                  </div>
                </div>

                {credits.balance < queue.length && (
                  <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 p-3 rounded-lg text-sm text-yellow-800 dark:text-yellow-200">
                    <strong>⚠️ Créditos insuficientes:</strong> você tem {credits.balance} crédito{credits.balance !== 1 ? "s" : ""} para {queue.length} mensagens. O disparo será pausado quando os créditos acabarem e retomado após a recarga.
                  </div>
                )}

                {/* Message Template */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    Mensagem personalizada (use {"{nome}"} para inserir o nome do cliente):
                  </Label>
                  <Textarea
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    rows={8}
                    className="resize-none font-mono text-sm"
                    placeholder="Digite sua mensagem personalizada..."
                  />
                  <p className="text-xs text-muted-foreground">
                    💡 O {"{nome}"} será substituído pelo primeiro nome de cada cliente automaticamente.
                  </p>
                </div>

                {/* Scheduling Options */}
                <div className="space-y-3 border-t pt-4">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="schedule-checkbox"
                      checked={isScheduled}
                      onChange={(e) => setIsScheduled(e.target.checked)}
                      className="rounded"
                    />
                    <Label htmlFor="schedule-checkbox" className="flex items-center gap-2 cursor-pointer">
                      <CalendarIcon className="h-4 w-4" />
                      Agendar disparo para outra data/hora
                    </Label>
                  </div>

                  {isScheduled && (
                    <div className="grid grid-cols-2 gap-4 pl-6">
                      <div className="space-y-2">
                        <Label className="text-sm">Data</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-left font-normal",
                                !scheduledDate && "text-muted-foreground"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {scheduledDate ? format(scheduledDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar data"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={scheduledDate}
                              onSelect={setScheduledDate}
                              disabled={(date) => date < new Date()}
                              initialFocus
                              locale={ptBR}
                              className={cn("p-3 pointer-events-auto")}
                            />
                          </PopoverContent>
                        </Popover>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm">Horário</Label>
                        <Input
                          type="time"
                          value={scheduledTime}
                          onChange={(e) => setScheduledTime(e.target.value)}
                          className="w-full"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-muted p-3 rounded-lg text-sm text-muted-foreground">
                  📊 Após confirmar, acompanhe o progresso do disparo na página <strong>Campanhas</strong> do painel.
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmAndStart();
              }}
              className="bg-green-600 hover:bg-green-700"
              disabled={saving || (isScheduled && !scheduledDate)}
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Criando disparo...
                </>
              ) : isScheduled ? "Agendar Disparo" : "Iniciar Disparo"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
