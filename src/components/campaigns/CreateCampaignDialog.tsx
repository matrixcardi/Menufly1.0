import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  MessageCircle,
  Users,
  CalendarIcon,
  Clock,
  Sparkles,
  ShoppingBag,
  UserMinus,
  Filter,
  ImagePlus,
  X,
  Loader2,
  Ticket,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface CouponOption {
  id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  description: string;
}

type CampaignFilter = 
  | "all"
  | "first_purchase"
  | "recent_15"
  | "inactive_30";

interface Customer {
  id: string;
  name: string;
  phone: string;
  lastOrderDate: Date;
  totalOrders: number;
  daysInactive: number;
}

interface CreateCampaignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId: string | null;
  restaurantName: string;
  restaurantSlug: string;
  onCampaignCreated: () => void;
}

const filterConfig: Record<CampaignFilter, { 
  label: string; 
  description: string; 
  icon: React.ReactNode;
  template: (restaurantName: string) => string;
}> = {
  all: {
    label: "Todos os Clientes",
    description: "Enviar para toda a base de clientes",
    icon: <Users className="w-4 h-4 text-purple-500" />,
    template: (restName) => `Oi {nome}! 😊

Temos novidades no ${restName}! 🎉

Confira nosso cardápio e peça agora:

👉 [Link de pedido]

Te esperamos! ❤️`,
  },
  first_purchase: {
    label: "Primeira Compra",
    description: "Clientes que fizeram apenas 1 pedido",
    icon: <Sparkles className="w-4 h-4 text-blue-500" />,
    template: (restName) => `Oii {nome}! 😊

Vi que você fez seu primeiro pedido conosco...

Gostou?? 🍔

Queria aproveitar para te presentear com um Cupom de R$10,00! 🎁

Ele vai ficar ativo até Sexta, use o cupom "PRESENTE" no link:

👉 [Link de pedido]

Esperamos você de volta no ${restName}! ❤️`,
  },
  recent_15: {
    label: "Pediram há 15 dias ou menos",
    description: "Clientes ativos recentemente",
    icon: <ShoppingBag className="w-4 h-4 text-green-500" />,
    template: (restName) => `Oi {nome}! 😊

Que bom ter você como cliente do ${restName}!

Estamos preparando novidades especiais e você é um cliente VIP! ⭐

Que tal repetir aquele pedido delicioso? Temos uma surpresa para você! 🎁

👉 [Link de pedido]

Te esperamos!`,
  },
  inactive_30: {
    label: "Não pedem há mais de 30 dias",
    description: "Clientes que precisam ser reconquistados",
    icon: <UserMinus className="w-4 h-4 text-orange-500" />,
    template: (restName) => `Olá {nome}! 😊

Faz tempo que não nos vemos... o ${restName} sente sua falta! 💛

Preparamos um presente especial para você voltar: uma porção de fritas GRÁTIS! 🍟

Use o cupom "VOLTEI" no seu próximo pedido:

👉 [Link de pedido]

Válido até Sexta! Te esperamos! ❤️`,
  },
};

export default function CreateCampaignDialog({
  open,
  onOpenChange,
  restaurantId,
  restaurantName,
  restaurantSlug,
  onCampaignCreated,
}: CreateCampaignDialogProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<"filter" | "message" | "schedule">("filter");
  const [campaignName, setCampaignName] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<CampaignFilter | null>(null);
  const [customMessage, setCustomMessage] = useState("");
  const [campaignImage, setCampaignImage] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<Set<string>>(new Set());
  
  // Scheduling
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>(undefined);
  const [scheduledTime, setScheduledTime] = useState("18:00");
  const [dispatchDays, setDispatchDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);

  const [saving, setSaving] = useState(false);
  const [coupons, setCoupons] = useState<CouponOption[]>([]);

  // Generate menu link
  const menuLink = useMemo(() => {
    return `${window.location.origin}/${restaurantSlug}`;
  }, [restaurantSlug]);

  // Fetch active coupons for the restaurant
  useEffect(() => {
    if (!restaurantId) return;
    async function fetchCoupons() {
      const { data } = await supabase
        .from("coupons")
        .select("id, code, discount_type, discount_value, is_active, expires_at")
        .eq("restaurant_id", restaurantId)
        .eq("is_active", true);

      const activeCoupons: CouponOption[] = (data || [])
        .filter((c: any) => !c.expires_at || new Date(c.expires_at) > new Date())
        .map((c: any) => ({
          id: c.id,
          code: c.code,
          discount_type: c.discount_type,
          discount_value: c.discount_value,
          description: c.discount_type === "percentage"
            ? `${c.discount_value}% OFF`
            : `R$ ${Number(c.discount_value).toFixed(2).replace(".", ",")} OFF`,
        }));
      setCoupons(activeCoupons);
    }
    fetchCoupons();
  }, [restaurantId]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setStep("filter");
      setCampaignName("");
      setSelectedFilter(null);
      setCustomMessage("");
      setCampaignImage(null);
      setCustomers([]);
      setSelectedCustomerIds(new Set());
      setScheduledDate(undefined);
      setScheduledTime("18:00");
      setDispatchDays([0, 1, 2, 3, 4, 5, 6]);
    }
  }, [open]);
  // Update message template when filter changes
  useEffect(() => {
    if (selectedFilter) {
      const template = filterConfig[selectedFilter].template(restaurantName);
      // Replace [Link de pedido] with actual menu link
      const messageWithLink = template.replace(/\[Link de pedido\]/g, menuLink);
      setCustomMessage(messageWithLink);
    }
  }, [selectedFilter, restaurantName, menuLink]);

  // Fetch customers based on filter
  useEffect(() => {
    if (!selectedFilter || !restaurantId) return;

    async function fetchCustomers() {
      setLoadingCustomers(true);
      try {
        const { data: orders, error } = await supabase
          .from("orders")
          .select("customer_name, customer_phone, created_at")
          .eq("restaurant_id", restaurantId);

        if (error) throw error;

        // Aggregate customers
        const customerMap = new Map<string, Customer>();
        
        orders?.forEach((order) => {
          const key = order.customer_phone;
          if (!key) return;
          
          const orderDate = new Date(order.created_at || new Date());
          const existing = customerMap.get(key);
          
          if (existing) {
            existing.totalOrders += 1;
            if (orderDate > existing.lastOrderDate) {
              existing.lastOrderDate = orderDate;
              existing.name = order.customer_name || existing.name;
            }
          } else {
            customerMap.set(key, {
              id: key,
              name: order.customer_name || "Sem nome",
              phone: order.customer_phone || "",
              totalOrders: 1,
              lastOrderDate: orderDate,
              daysInactive: differenceInDays(new Date(), orderDate),
            });
          }
        });

        // Update days inactive
        customerMap.forEach((customer) => {
          customer.daysInactive = differenceInDays(new Date(), customer.lastOrderDate);
        });

        // Filter based on selected option
        let filtered = Array.from(customerMap.values());
        
        switch (selectedFilter) {
          case "all":
            // No filter — send to all
            break;
          case "first_purchase":
            filtered = filtered.filter(c => c.totalOrders === 1);
            break;
          case "recent_15":
            filtered = filtered.filter(c => c.daysInactive <= 15);
            break;
          case "inactive_30":
            filtered = filtered.filter(c => c.daysInactive > 30);
            break;
        }

        setCustomers(filtered);
        setSelectedCustomerIds(new Set(filtered.map(c => c.id)));
      } catch (error) {
        console.error("Error fetching customers:", error);
        toast({
          title: "Erro ao buscar clientes",
          variant: "destructive",
        });
      } finally {
        setLoadingCustomers(false);
      }
    }

    fetchCustomers();
  }, [selectedFilter, restaurantId, toast]);

  const selectedCustomers = useMemo(() => {
    return customers.filter(c => selectedCustomerIds.has(c.id));
  }, [customers, selectedCustomerIds]);

  const toggleCustomer = (id: string) => {
    setSelectedCustomerIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAllCustomers = () => {
    if (selectedCustomerIds.size === customers.length) {
      setSelectedCustomerIds(new Set());
    } else {
      setSelectedCustomerIds(new Set(customers.map(c => c.id)));
    }
  };


  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !restaurantId) return;

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      toast({ title: "Imagem muito grande", description: "Máximo 5MB", variant: "destructive" });
      return;
    }

    setUploadingImage(true);
    try {
      const ext = file.name.split(".").pop();
      const filePath = `${restaurantId}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("campaign-images")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("campaign-images")
        .getPublicUrl(filePath);

      setCampaignImage(urlData.publicUrl);
      toast({ title: "Imagem adicionada! 📸" });
    } catch (err) {
      console.error("Upload error:", err);
      toast({ title: "Erro ao enviar imagem", variant: "destructive" });
    } finally {
      setUploadingImage(false);
    }
  };

  const handleCreateCampaign = async () => {
    if (!campaignName.trim()) {
      toast({
        title: "Nome obrigatório",
        description: "Informe um nome para a campanha",
        variant: "destructive",
      });
      return;
    }

    if (selectedCustomers.length === 0) {
      toast({
        title: "Nenhum cliente selecionado",
        description: "Selecione pelo menos um cliente para a campanha",
        variant: "destructive",
      });
      return;
    }

    if (!scheduledDate) {
      toast({
        title: "Data obrigatória",
        description: "Selecione uma data para o disparo",
        variant: "destructive",
      });
      return;
    }

    if (!restaurantId) return;

    setSaving(true);
    try {
      // Build scheduled datetime
      const [hours, minutes] = scheduledTime.split(":").map(Number);
      const scheduledDateTime = new Date(scheduledDate);
      scheduledDateTime.setHours(hours, minutes, 0, 0);

      // Save campaign to database
      const { data: campaign, error: campaignError } = await supabase
        .from("campaigns")
        .insert({
          restaurant_id: restaurantId,
          name: campaignName,
          filter_type: selectedFilter!,
          message_template: customMessage,
          image_url: campaignImage,
          scheduled_at: scheduledDateTime.toISOString(),
          status: "scheduled",
          total_recipients: selectedCustomers.length,
          dispatch_days: dispatchDays,
        } as any)
        .select()
        .single();

      if (campaignError) throw campaignError;

      // Save recipients
      const recipients = selectedCustomers.map(c => ({
        campaign_id: campaign.id,
        customer_name: c.name,
        customer_phone: c.phone,
        status: "pending",
      }));

      const { error: recipientsError } = await supabase
        .from("campaign_recipients")
        .insert(recipients);

      if (recipientsError) throw recipientsError;

      toast({
        title: "Campanha criada! 🎉",
        description: `${selectedCustomers.length} clientes serão contatados em ${format(scheduledDateTime, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`,
      });

      onCampaignCreated();
      onOpenChange(false);
    } catch (error) {
      console.error("Error creating campaign:", error);
      toast({
        title: "Erro ao criar campanha",
        description: "Tente novamente em instantes",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-green-600" />
            Nova Campanha
          </DialogTitle>
          <DialogDescription>
            Crie uma campanha de mensagens para seus clientes
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Filter Selection */}
        {step === "filter" && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="campaign-name">Nome da Campanha</Label>
              <Input
                id="campaign-name"
                placeholder="Ex: Reativação Janeiro"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label className="flex items-center gap-2 mb-3">
                <Filter className="w-4 h-4" />
                Selecione o Filtro de Clientes
              </Label>
              <div className="grid gap-3">
                {(Object.keys(filterConfig) as CampaignFilter[]).map((key) => {
                  const config = filterConfig[key];
                  const isSelected = selectedFilter === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setSelectedFilter(key)}
                      className={cn(
                        "flex items-start gap-3 p-4 rounded-lg border text-left transition-all",
                        isSelected 
                          ? "border-primary bg-primary/5 ring-2 ring-primary" 
                          : "border-border hover:border-primary/50 hover:bg-muted/50"
                      )}
                    >
                      <div className="mt-0.5">{config.icon}</div>
                      <div className="flex-1">
                        <p className="font-medium">{config.label}</p>
                        <p className="text-sm text-muted-foreground">{config.description}</p>
                      </div>
                      {isSelected && (
                        <Badge variant="default" className="bg-primary">
                          Selecionado
                        </Badge>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Customer Preview */}
            {selectedFilter && (
              <div className="border rounded-lg p-4 bg-muted/30">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    <span className="font-medium">Clientes encontrados</span>
                  </div>
                  {loadingCustomers ? (
                    <Skeleton className="h-6 w-16" />
                  ) : (
                    <Badge variant="secondary">{customers.length}</Badge>
                  )}
                </div>
                
                {loadingCustomers ? (
                  <div className="space-y-2">
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                  </div>
                ) : customers.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhum cliente encontrado com este filtro
                  </p>
                ) : (
                  <>
                    <div className="flex items-center gap-2 mb-2">
                      <Checkbox
                        id="select-all"
                        checked={selectedCustomerIds.size === customers.length}
                        onCheckedChange={toggleAllCustomers}
                      />
                      <Label htmlFor="select-all" className="text-sm cursor-pointer">
                        Selecionar todos ({customers.length})
                      </Label>
                    </div>
                    <div className="max-h-40 overflow-y-auto space-y-1">
                      {customers.slice(0, 10).map((customer) => (
                        <div 
                          key={customer.id}
                          className="flex items-center gap-2 p-2 rounded hover:bg-background"
                        >
                          <Checkbox
                            id={customer.id}
                            checked={selectedCustomerIds.has(customer.id)}
                            onCheckedChange={() => toggleCustomer(customer.id)}
                          />
                          <Label htmlFor={customer.id} className="flex-1 text-sm cursor-pointer">
                            {customer.name}
                          </Label>
                          <span className="text-xs text-muted-foreground">
                            {customer.phone}
                          </span>
                        </div>
                      ))}
                      {customers.length > 10 && (
                        <p className="text-xs text-muted-foreground text-center pt-2">
                          + {customers.length - 10} clientes...
                        </p>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step 2: Message Customization */}
        {step === "message" && selectedFilter && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm">
              <Badge variant="outline">{filterConfig[selectedFilter].label}</Badge>
              <span className="text-muted-foreground">
                {selectedCustomers.length} cliente{selectedCustomers.length !== 1 ? "s" : ""} selecionado{selectedCustomers.length !== 1 ? "s" : ""}
              </span>
            </div>

            <div>
              <Label htmlFor="message" className="flex items-center gap-2 mb-2">
                <MessageCircle className="w-4 h-4" />
                Mensagem Personalizada
              </Label>
              <Textarea
                id="message"
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                rows={12}
                className="resize-none font-mono text-sm"
                placeholder="Digite sua mensagem..."
              />
              <p className="text-xs text-muted-foreground mt-2">
                Use <code className="bg-muted px-1 rounded">{"{nome}"}</code> para inserir o nome do cliente
              </p>
            </div>

            {/* Coupon Selector */}
            {coupons.length > 0 && (
              <div>
                <Label className="flex items-center gap-2 mb-2">
                  <Ticket className="w-4 h-4" />
                  Inserir Cupom na Mensagem (opcional)
                </Label>
                <div className="flex flex-wrap gap-2">
                  {coupons.map((coupon) => (
                    <button
                      key={coupon.id}
                      type="button"
                      onClick={() => {
                        const couponText = `\n\n🎟️ Use o cupom *${coupon.code}* e ganhe ${coupon.description}!`;
                        setCustomMessage((prev) => prev + couponText);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm hover:border-primary/50 hover:bg-muted/50 transition-colors"
                    >
                      <Ticket className="w-3.5 h-3.5 text-primary" />
                      <span className="font-medium">{coupon.code}</span>
                      <span className="text-muted-foreground">({coupon.description})</span>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">
                  Clique em um cupom para inseri-lo no corpo da mensagem
                </p>
              </div>
            )}

            {/* Image Upload */}
            <div>
              <Label className="flex items-center gap-2 mb-2">
                <ImagePlus className="w-4 h-4" />
                Imagem da Campanha (opcional)
              </Label>
              {campaignImage ? (
                <div className="relative inline-block">
                  <img
                    src={campaignImage}
                    alt="Imagem da campanha"
                    className="w-full max-w-xs rounded-lg border object-cover max-h-48"
                  />
                  <button
                    type="button"
                    onClick={() => setCampaignImage(null)}
                    className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 shadow-md hover:opacity-80"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center gap-2 p-6 rounded-lg border-2 border-dashed border-border hover:border-primary/50 cursor-pointer transition-colors bg-muted/30">
                  {uploadingImage ? (
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  ) : (
                    <>
                      <ImagePlus className="w-8 h-8 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Clique para selecionar uma imagem</span>
                      <span className="text-xs text-muted-foreground">JPG, PNG — Máx. 5MB</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                    disabled={uploadingImage}
                  />
                </label>
              )}
            </div>
          </div>
        )}

        {/* Step 3: Scheduling */}
        {step === "schedule" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm mb-4">
              <Badge variant="outline">{filterConfig[selectedFilter!].label}</Badge>
              <span className="text-muted-foreground">
                {selectedCustomers.length} cliente{selectedCustomers.length !== 1 ? "s" : ""}
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label className="flex items-center gap-2 mb-2">
                  <CalendarIcon className="w-4 h-4" />
                  Data do Disparo
                </Label>
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
                      {scheduledDate 
                        ? format(scheduledDate, "dd/MM/yyyy", { locale: ptBR }) 
                        : "Selecione a data"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={scheduledDate}
                      onSelect={setScheduledDate}
                    disabled={(date) => {
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      return date < today;
                    }}
                      initialFocus
                      className="p-3 pointer-events-auto"
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div>
                <Label className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4" />
                  Horário
                </Label>
                <Input
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                />
              </div>
            </div>

            {/* Weekday Selection */}
            <div>
              <Label className="flex items-center gap-2 mb-2">
                📅 Dias da Semana para Disparo
              </Label>
              <p className="text-xs text-muted-foreground mb-3">
                Selecione em quais dias da semana as mensagens serão enviadas
              </p>
              <div className="flex flex-wrap gap-2">
                {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((day, index) => {
                  const isSelected = dispatchDays.includes(index);
                  return (
                    <button
                      key={index}
                      type="button"
                      onClick={() => {
                        setDispatchDays(prev =>
                          isSelected
                            ? prev.filter(d => d !== index)
                            : [...prev, index].sort()
                        );
                      }}
                      className={cn(
                        "px-3 py-2 rounded-lg text-sm font-medium border transition-all",
                        isSelected
                          ? "bg-green-600 text-white border-green-600"
                          : "bg-background border-border text-muted-foreground hover:border-green-400"
                      )}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Summary */}
            <div className="border rounded-lg p-4 bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800 mt-4">
              <h4 className="font-medium text-green-700 dark:text-green-300 mb-2">
                Resumo da Campanha
              </h4>
              <ul className="text-sm space-y-1 text-green-600 dark:text-green-400">
                <li>📝 <strong>Nome:</strong> {campaignName || "Não definido"}</li>
                <li>👥 <strong>Clientes:</strong> {selectedCustomers.length}</li>
                <li>📅 <strong>Data:</strong> {scheduledDate ? format(scheduledDate, "dd/MM/yyyy", { locale: ptBR }) : "Não definida"}</li>
                <li>⏰ <strong>Horário:</strong> {scheduledTime}</li>
                <li>📆 <strong>Dias:</strong> {dispatchDays.length === 7 ? "Todos os dias" : dispatchDays.map(d => ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][d]).join(", ")}</li>
              </ul>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {step === "filter" && (
            <Button
              onClick={() => setStep("message")}
              disabled={!selectedFilter || !campaignName.trim() || selectedCustomers.length === 0}
              className="gap-2"
            >
              Próximo: Mensagem
            </Button>
          )}
          
          {step === "message" && (
            <>
              <Button variant="outline" onClick={() => setStep("filter")}>
                Voltar
              </Button>
              <Button
                onClick={() => setStep("schedule")}
                disabled={!customMessage.trim()}
                className="gap-2"
              >
                Próximo: Agendar
              </Button>
            </>
          )}
          
          {step === "schedule" && (
            <>
              <Button variant="outline" onClick={() => setStep("message")}>
                Voltar
              </Button>
              <Button
                onClick={handleCreateCampaign}
                disabled={saving}
                className="gap-2 bg-green-600 hover:bg-green-700"
              >
                <MessageCircle className="w-4 h-4" />
                {saving ? "Criando..." : "Criar Campanha"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
