import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
  Play, 
  Pause, 
  Square,
  CheckCircle2,
  MessageCircle,
  X,
  CalendarIcon,
  Timer
} from "lucide-react";
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
const INTERVAL_MINUTES = 5;
const STORAGE_KEY_PREFIX = "whatsapp_sent_";

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
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [warningDialogOpen, setWarningDialogOpen] = useState(false);
  const [riskAcknowledged, setRiskAcknowledged] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [sentToday, setSentToday] = useState(0);
  const [queue, setQueue] = useState<Customer[]>([]);
  const [sentCustomers, setSentCustomers] = useState<Set<string>>(new Set());
  const [nextSendTime, setNextSendTime] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [customMessage, setCustomMessage] = useState("");
  
  // Scheduling state
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>(undefined);
  const [scheduledTime, setScheduledTime] = useState("18:00");

  // Get today's date key for localStorage
  const getTodayKey = () => {
    const today = new Date().toISOString().split("T")[0];
    return `${STORAGE_KEY_PREFIX}${restaurantId}_${today}`;
  };

  // Load sent count from localStorage
  useEffect(() => {
    const key = getTodayKey();
    const stored = localStorage.getItem(key);
    if (stored) {
      const data = JSON.parse(stored);
      setSentToday(data.count || 0);
    }
  }, [restaurantId]);

  // Update message template when filter changes
  useEffect(() => {
    setCustomMessage(getFilterMessageTemplate(currentFilter, restaurantName));
  }, [currentFilter, restaurantName]);

  // Save sent count to localStorage
  const updateSentCount = (count: number) => {
    const key = getTodayKey();
    localStorage.setItem(key, JSON.stringify({ count, updatedAt: new Date().toISOString() }));
    setSentToday(count);
  };

  // Countdown timer
  useEffect(() => {
    if (!isRunning || isPaused || !nextSendTime) return;

    const interval = setInterval(() => {
      const now = new Date();
      const diff = Math.max(0, Math.floor((nextSendTime.getTime() - now.getTime()) / 1000));
      setCountdown(diff);

      if (diff === 0 && currentIndex < queue.length) {
        sendNextMessage();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, isPaused, nextSendTime, currentIndex, queue.length]);

  const formatPhoneForWhatsapp = (phone: string): string => {
    const numbers = phone.replace(/\D/g, "");
    if (numbers.length === 11 || numbers.length === 10) {
      return `55${numbers}`;
    }
    return numbers;
  };

  const getPersonalizedMessage = (customer: Customer): string => {
    const firstName = customer.name.split(" ")[0];
    return customMessage.replace(/\{nome\}/gi, firstName);
  };

  const sendNextMessage = useCallback(() => {
    if (currentIndex >= queue.length || sentToday >= DAILY_LIMIT) {
      setIsRunning(false);
      toast({
        title: "Disparo finalizado!",
        description: `${sentCustomers.size} mensagens enviadas com sucesso.`,
      });
      return;
    }

    const customer = queue[currentIndex];
    const message = getPersonalizedMessage(customer);
    const phone = formatPhoneForWhatsapp(customer.phone);
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${phone}?text=${encodedMessage}`;

    // Open WhatsApp
    window.open(whatsappUrl, "_blank");

    // Update state
    setSentCustomers((prev) => new Set(prev).add(customer.id));
    updateSentCount(sentToday + 1);
    setCurrentIndex((prev) => prev + 1);

    // Schedule next message
    if (currentIndex + 1 < queue.length && sentToday + 1 < DAILY_LIMIT) {
      const nextTime = new Date(Date.now() + INTERVAL_MINUTES * 60 * 1000);
      setNextSendTime(nextTime);
      setCountdown(INTERVAL_MINUTES * 60);
    } else {
      setIsRunning(false);
    }
  }, [currentIndex, queue, sentToday, customMessage]);

  const startBulkSend = () => {
    if (selectedCustomers.length === 0) {
      toast({
        title: "Nenhum cliente selecionado",
        description: "Selecione pelo menos um cliente para enviar mensagens.",
        variant: "destructive",
      });
      return;
    }

    const remaining = DAILY_LIMIT - sentToday;
    if (remaining <= 0) {
      toast({
        title: "Limite diário atingido",
        description: `Você já enviou ${DAILY_LIMIT} mensagens hoje. Tente novamente amanhã.`,
        variant: "destructive",
      });
      return;
    }

    const toSend = selectedCustomers.slice(0, remaining);
    setQueue(toSend);
    setRiskAcknowledged(false);
    setWarningDialogOpen(true);
  };

  const confirmAndStart = () => {
    setConfirmDialogOpen(false);

    if (isScheduled && scheduledDate) {
      // Store scheduled dispatch
      const [hours, minutes] = scheduledTime.split(":").map(Number);
      const scheduledDateTime = new Date(scheduledDate);
      scheduledDateTime.setHours(hours, minutes, 0, 0);

      // Save to localStorage for now (in a real app, this would go to a database)
      const scheduleKey = `scheduled_dispatch_${restaurantId}_${Date.now()}`;
      localStorage.setItem(scheduleKey, JSON.stringify({
        customers: queue.map(c => c.id),
        message: customMessage,
        scheduledAt: scheduledDateTime.toISOString(),
        filter: currentFilter,
      }));

      toast({
        title: "Disparo agendado!",
        description: `${queue.length} mensagens serão enviadas em ${format(scheduledDateTime, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`,
      });

      onClearSelection();
      return;
    }

    // Immediate dispatch
    setIsDialogOpen(true);
    setCurrentIndex(0);
    setSentCustomers(new Set());
    setIsRunning(true);
    setIsPaused(false);

    // Send first message immediately
    setTimeout(() => {
      const customer = queue[0];
      const message = getPersonalizedMessage(customer);
      const phone = formatPhoneForWhatsapp(customer.phone);
      const encodedMessage = encodeURIComponent(message);
      const whatsappUrl = `https://wa.me/${phone}?text=${encodedMessage}`;

      window.open(whatsappUrl, "_blank");
      setSentCustomers(new Set([customer.id]));
      updateSentCount(sentToday + 1);
      setCurrentIndex(1);

      if (queue.length > 1 && sentToday + 1 < DAILY_LIMIT) {
        const nextTime = new Date(Date.now() + INTERVAL_MINUTES * 60 * 1000);
        setNextSendTime(nextTime);
        setCountdown(INTERVAL_MINUTES * 60);
      } else {
        setIsRunning(false);
      }
    }, 500);
  };

  const pauseQueue = () => {
    setIsPaused(true);
  };

  const resumeQueue = () => {
    setIsPaused(false);
    const nextTime = new Date(Date.now() + countdown * 1000);
    setNextSendTime(nextTime);
  };

  const stopQueue = () => {
    setIsRunning(false);
    setIsPaused(false);
    setQueue([]);
    setCurrentIndex(0);
    setNextSendTime(null);
    setCountdown(0);
    toast({
      title: "Disparo cancelado",
      description: `${sentCustomers.size} mensagens foram enviadas antes do cancelamento.`,
    });
  };

  const closeDialog = () => {
    if (isRunning) {
      stopQueue();
    }
    setIsDialogOpen(false);
    onClearSelection();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const progress = queue.length > 0 ? (currentIndex / queue.length) * 100 : 0;
  const remaining = DAILY_LIMIT - sentToday;

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
          <Clock className="h-4 w-4" />
          <span>Restam {remaining} hoje</span>
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
          disabled={remaining <= 0}
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
                    ⏱️ <strong>O intervalo não é garantia:</strong> O intervalo de 5 minutos entre mensagens reduz o risco, mas não elimina completamente a chance de detecção. O WhatsApp analisa padrões de comportamento ao longo do tempo.
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
                    <Clock className="h-4 w-4" />
                    <span>Intervalo de <strong>{INTERVAL_MINUTES} minutos</strong> entre cada mensagem</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MessageCircle className="h-4 w-4" />
                    <span>Limite diário: <strong>{remaining} mensagens restantes</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Timer className="h-4 w-4" />
                    <span>Tempo estimado: <strong>~{Math.ceil((queue.length - 1) * INTERVAL_MINUTES)} minutos</strong></span>
                  </div>
                </div>

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

                {!isScheduled && (
                  <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 p-3 rounded-lg text-sm text-yellow-800 dark:text-yellow-200">
                    <strong>⚠️ Importante:</strong> Mantenha esta aba aberta durante o disparo. 
                    A cada {INTERVAL_MINUTES} minutos uma nova aba do WhatsApp será aberta automaticamente.
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmAndStart}
              className="bg-green-600 hover:bg-green-700"
              disabled={isScheduled && !scheduledDate}
            >
              {isScheduled ? "Agendar Disparo" : "Iniciar Disparo"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Progress Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={closeDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-green-600" />
              Disparo em Andamento
            </DialogTitle>
            <DialogDescription>
              Enviando mensagens com cadência segura
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Progress */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progresso</span>
                <span className="font-medium">{currentIndex} de {queue.length}</span>
              </div>
              <Progress value={progress} className="h-3" />
            </div>

            {/* Status */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-green-50 dark:bg-green-950 p-3 rounded-lg text-center">
                <CheckCircle2 className="h-6 w-6 mx-auto text-green-600 mb-1" />
                <div className="text-2xl font-bold text-green-600">{sentCustomers.size}</div>
                <div className="text-xs text-muted-foreground">Enviadas</div>
              </div>
              
              <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-lg text-center">
                <Clock className="h-6 w-6 mx-auto text-blue-600 mb-1" />
                <div className="text-2xl font-bold text-blue-600">{queue.length - currentIndex}</div>
                <div className="text-xs text-muted-foreground">Restantes</div>
              </div>
            </div>

            {/* Countdown */}
            {isRunning && currentIndex < queue.length && (
              <div className="bg-muted p-4 rounded-lg text-center">
                <p className="text-sm text-muted-foreground mb-1">
                  {isPaused ? "Pausado" : "Próxima mensagem em"}
                </p>
                <div className="text-3xl font-mono font-bold">
                  {formatTime(countdown)}
                </div>
                {!isPaused && currentIndex < queue.length && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Próximo: {queue[currentIndex]?.name}
                  </p>
                )}
              </div>
            )}

            {/* Completion message */}
            {!isRunning && currentIndex > 0 && (
              <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg text-center">
                <CheckCircle2 className="h-10 w-10 mx-auto text-green-600 mb-2" />
                <p className="font-medium text-green-800 dark:text-green-200">
                  Disparo finalizado!
                </p>
                <p className="text-sm text-muted-foreground">
                  {sentCustomers.size} mensagens enviadas com sucesso
                </p>
              </div>
            )}

            {/* Daily limit warning */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <AlertTriangle className="h-4 w-4" />
              <span>Limite diário: {sentToday}/{DAILY_LIMIT} mensagens</span>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            {isRunning && (
              <>
                {isPaused ? (
                  <Button onClick={resumeQueue} className="gap-2">
                    <Play className="h-4 w-4" />
                    Retomar
                  </Button>
                ) : (
                  <Button onClick={pauseQueue} variant="outline" className="gap-2">
                    <Pause className="h-4 w-4" />
                    Pausar
                  </Button>
                )}
                <Button onClick={stopQueue} variant="destructive" className="gap-2">
                  <Square className="h-4 w-4" />
                  Parar
                </Button>
              </>
            )}
            {!isRunning && (
              <Button onClick={closeDialog}>
                Fechar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
