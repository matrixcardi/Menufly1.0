import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { 
  ArrowLeft, 
  Users, 
  ShoppingBag, 
  TrendingUp,
  Clock,
  Phone,
  UserCheck,
  UserX,
  Filter,
  AlertTriangle,
  MessageCircle,
  Send,
  Copy,
  Check
} from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

type FilterOption =
  | "all"
  | "last_week"
  | "last_15"
  | "last_30"
  | "last_60"
  | "last_90"
  | "inactive";

interface Customer {
  id: string;
  name: string;
  phone: string;
  totalOrders: number;
  totalSpent: number;
  lastOrderDate: Date;
  daysInactive: number;
}

interface Restaurant {
  id: string;
  name: string;
  logo_url: string | null;
  owner_email: string | null;
}

const filterLabels: Record<FilterOption, string> = {
  all: "Todos",
  last_week: "Última semana",
  last_15: "15 dias",
  last_30: "30 dias",
  last_60: "60 dias",
  last_90: "90 dias",
  inactive: "Inativos (+90)",
};

export default function MasterRestaurantCRM() {
  const { restaurantId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterOption>("all");
  const [whatsappDialogOpen, setWhatsappDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customMessage, setCustomMessage] = useState("");
  const [copiedMessage, setCopiedMessage] = useState(false);

  // Mensagens personalizadas por estágio do cliente
  const getMessageTemplate = (customer: Customer): string => {
    const firstName = customer.name.split(" ")[0];
    const days = customer.daysInactive;
    const restName = restaurant?.name || "nosso restaurante";

    if (days <= 7) {
      return `Oii ${firstName}! 😊

Vi que pediu conosco recentemente...

Gostou do lanche?? 🍔

Queria aproveitar para te presentear com um Cupom de R$10,00 para pedir conosco! 🎁

Ele vai ficar ativo até Sexta, busca pedir no link abaixo e usar o cupom "PRESENTE" até mais!!

👉 [Link de pedido]

Esperamos você de volta no ${restName}! ❤️`;
    }

    if (days <= 15) {
      return `Oi ${firstName}! 😊

Que bom ter você como cliente do ${restName}!

Já faz ${days} dias desde seu último pedido. Estamos com saudades!

Que tal repetir aquele pedido delicioso? 🍔

Esperamos você!`;
    }

    if (days <= 30) {
      return `Olá!! ${firstName} tudo certo? 😊

Sou a equipe aqui do ${restName}! Vi que faz mais de 30 dias desde que pediu conosco e estou passando para te dar um presente! 🎁

Pedindo conosco até Sexta você vai ganhar uma porção de fritas por nossa conta! 🍟

Basta usar o cupom "VOLTEI" que eu vou saber que é você! Sempre no link abaixo:

👉 [Link de pedido]

Te esperamos! ❤️`;
    }

    if (days <= 60) {
      return `Oi ${firstName}! 💛

Já faz ${days} dias desde sua última visita ao ${restName}.

Sentimos muito sua falta! Para celebrar seu retorno, preparamos uma condição especial só para você! 🎉

Não perca essa oportunidade!

Esperamos seu pedido! 😊`;
    }

    if (days <= 90) {
      return `Olá ${firstName}! 🙏

Percebemos que faz ${days} dias que você não pede no ${restName}.

Queremos muito te ver de volta! Por isso, estamos oferecendo um desconto exclusivo no seu próximo pedido! 🏷️

Volte a fazer parte da nossa família!

Te esperamos!`;
    }

    return `Oi ${firstName}! ❤️

Faz tempo que não nos falamos... ${days} dias para ser exato!

O ${restName} sente muito a sua falta! 

Queremos reconquistar você! Por isso, preparamos uma oferta imperdível exclusiva para o seu retorno! 🔥

Responda essa mensagem e ganhe um brinde especial no pedido!

Esperamos ansiosamente seu retorno! 😊`;
  };

  const getCustomerStage = (days: number): string => {
    if (days <= 7) return "VIP";
    if (days <= 15) return "Ativo";
    if (days <= 30) return "Regular";
    if (days <= 60) return "Em Risco";
    if (days <= 90) return "Quase Inativo";
    return "Inativo";
  };

  const openWhatsappDialog = (customer: Customer) => {
    setSelectedCustomer(customer);
    setCustomMessage(getMessageTemplate(customer));
    setWhatsappDialogOpen(true);
    setCopiedMessage(false);
  };

  const formatPhoneForWhatsapp = (phone: string): string => {
    const numbers = phone.replace(/\D/g, "");
    if (numbers.length === 11 || numbers.length === 10) {
      return `55${numbers}`;
    }
    return numbers;
  };

  const sendWhatsapp = () => {
    if (!selectedCustomer) return;
    
    const phone = formatPhoneForWhatsapp(selectedCustomer.phone);
    const encodedMessage = encodeURIComponent(customMessage);
    const whatsappUrl = `https://wa.me/${phone}?text=${encodedMessage}`;
    
    window.open(whatsappUrl, "_blank");
    setWhatsappDialogOpen(false);
    
    toast({
      title: "WhatsApp aberto!",
      description: `Mensagem preparada para ${selectedCustomer.name}`,
    });
  };

  const copyMessage = () => {
    navigator.clipboard.writeText(customMessage);
    setCopiedMessage(true);
    toast({
      title: "Mensagem copiada!",
      description: "Cole no WhatsApp para enviar",
    });
    setTimeout(() => setCopiedMessage(false), 2000);
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!restaurantId) return;

      try {
        // Fetch restaurant info
        const { data: restData, error: restError } = await supabase
          .from("all_restaurants")
          .select("id, name, logo_url, owner_email")
          .eq("id", restaurantId)
          .single();

        if (restError) throw restError;
        setRestaurant(restData);

        // Fetch customers from customers table
        const { data: customersData, error: customersError } = await supabase
          .from("customers")
          .select("id, name, phone, total_orders, total_spent, last_order_at, created_at")
          .eq("restaurant_id", restaurantId)
          .order("total_spent", { ascending: false });

        if (customersError) throw customersError;

        const sortedCustomers: Customer[] = (customersData || []).map((c) => ({
          id: c.id,
          name: c.name,
          phone: c.phone,
          totalOrders: c.total_orders,
          totalSpent: Number(c.total_spent),
          lastOrderDate: new Date(c.last_order_at || c.created_at),
          daysInactive: differenceInDays(new Date(), new Date(c.last_order_at || c.created_at)),
        }));

        setCustomers(sortedCustomers);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [restaurantId]);

  const filteredCustomers = useMemo(() => {
    return customers.filter((customer) => {
      const days = customer.daysInactive;
      switch (filter) {
        case "last_week":
          return days <= 7;
        case "last_15":
          return days > 7 && days <= 15;
        case "last_30":
          return days > 15 && days <= 30;
        case "last_60":
          return days > 30 && days <= 60;
        case "last_90":
          return days > 60 && days <= 90;
        case "inactive":
          return days > 90;
        default:
          return true;
      }
    });
  }, [customers, filter]);

  const stats = useMemo(() => ({
    totalCustomers: customers.length,
    activeCustomers: customers.filter(c => c.daysInactive <= 90).length,
    inactiveCustomers: customers.filter(c => c.daysInactive > 90).length,
    totalRevenue: customers.reduce((sum, c) => sum + c.totalSpent, 0),
  }), [customers]);

  const getStatusBadge = (daysInactive: number) => {
    if (daysInactive > 90) {
      return (
        <Badge variant="destructive" className="text-xs">
          <AlertTriangle className="w-3 h-3 mr-1" />
          Inativo
        </Badge>
      );
    }
    if (daysInactive > 60) {
      return (
        <Badge variant="outline" className="text-xs border-yellow-500 text-yellow-600">
          Em risco
        </Badge>
      );
    }
    if (daysInactive > 30) {
      return <Badge variant="outline" className="text-xs">Regular</Badge>;
    }
    if (daysInactive <= 7) {
      return <Badge className="bg-green-500 text-xs">VIP</Badge>;
    }
    return (
      <Badge variant="secondary" className="text-xs bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
        Ativo
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="p-8">
        <Skeleton className="h-8 w-48 mb-6" />
        <div className="grid gap-4 md:grid-cols-4 mb-6">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="p-8">
        <p className="text-muted-foreground">Restaurante não encontrado</p>
        <Button variant="link" onClick={() => navigate("/master/restaurantes")}>
          Voltar
        </Button>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate("/master/restaurantes")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{restaurant.name}</h1>
          <p className="text-sm text-muted-foreground">{restaurant.owner_email}</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              Total de Clientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCustomers}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <UserCheck className="h-4 w-4" />
              Clientes Ativos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.activeCustomers}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <UserX className="h-4 w-4" />
              Clientes Inativos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.inactiveCustomers}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Faturamento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              R$ {stats.totalRevenue.toFixed(2).replace(".", ",")}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Tabs */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filtrar por Período
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 mb-4">
            {(Object.keys(filterLabels) as FilterOption[]).map((key) => (
              <Button
                key={key}
                variant={filter === key ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter(key)}
                className={
                  filter === key
                    ? key === "inactive"
                      ? "bg-red-500 hover:bg-red-600"
                      : ""
                    : key === "inactive"
                    ? "border-red-300 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
                    : ""
                }
              >
                {filterLabels[key]}
              </Button>
            ))}
          </div>
          <div className="text-sm text-muted-foreground border-t pt-4">
            Exibindo: <span className="font-medium text-foreground">{filterLabels[filter]}</span>
            {" "}— <span className="font-medium">{filteredCustomers.length}</span> cliente{filteredCustomers.length !== 1 ? "s" : ""}
          </div>
        </CardContent>
      </Card>

      {/* Customer List */}
      <Card>
        <CardHeader>
          <CardTitle>Clientes</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredCustomers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum cliente encontrado neste período</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredCustomers.map((customer) => (
                <div
                  key={customer.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium">{customer.name}</p>
                      {customer.totalOrders === 1 && (
                        <Badge className="text-xs bg-blue-500 hover:bg-blue-600">
                          ✨ Novo Cliente
                        </Badge>
                      )}
                      {getStatusBadge(customer.daysInactive)}
                      <Badge variant="secondary" className="text-xs">
                        {customer.totalOrders} pedido{customer.totalOrders !== 1 ? "s" : ""}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="h-3 w-3" />
                      {customer.phone}
                    </div>
                    <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      Último pedido: {format(customer.lastOrderDate, "dd/MM/yyyy", { locale: ptBR })}
                      {customer.daysInactive > 0 && (
                        <span className={customer.daysInactive > 90 ? "text-red-500 font-medium" : ""}>
                          {" "}({customer.daysInactive} dias atrás)
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="font-semibold text-primary">
                        R$ {customer.totalSpent.toFixed(2)}
                      </p>
                      <p className="text-xs text-muted-foreground">Total gasto</p>
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-10 w-10 shrink-0 text-green-600 border-green-300 hover:bg-green-50 hover:text-green-700 dark:border-green-800 dark:hover:bg-green-950"
                      onClick={() => openWhatsappDialog(customer)}
                    >
                      <MessageCircle className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* WhatsApp Dialog */}
      <Dialog open={whatsappDialogOpen} onOpenChange={setWhatsappDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-green-600" />
              Enviar WhatsApp
            </DialogTitle>
            <DialogDescription>
              {selectedCustomer && (
                <span>
                  Mensagem para <strong>{selectedCustomer.name}</strong> ({selectedCustomer.phone})
                  <br />
                  <Badge variant="outline" className="mt-1">
                    Estágio: {getCustomerStage(selectedCustomer.daysInactive)}
                  </Badge>
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                Mensagem personalizada:
              </label>
              <Textarea
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                rows={10}
                className="resize-none"
                placeholder="Digite sua mensagem..."
              />
            </div>

            <div className="bg-muted/50 p-3 rounded-lg text-xs text-muted-foreground">
              <strong>Dica:</strong> A mensagem já foi personalizada com o nome do cliente e adequada ao estágio dele. 
              Você pode editar antes de enviar.
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={copyMessage}
              className="gap-2"
            >
              {copiedMessage ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copiedMessage ? "Copiado!" : "Copiar"}
            </Button>
            <Button
              onClick={sendWhatsapp}
              className="gap-2 bg-green-600 hover:bg-green-700"
            >
              <Send className="h-4 w-4" />
              Abrir WhatsApp
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
