import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurantContext } from "@/contexts/RestaurantContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import WhatsAppConnection from "@/components/campaigns/WhatsAppConnection";
import {
  Bot,
  MessageSquare,
  Bell,
  Star,
  Save,
  Loader2,
  Link as LinkIcon,
} from "lucide-react";

interface BotSettings {
  bot_enabled: boolean;
  bot_greeting_message: string;
  bot_auto_reply_enabled: boolean;
  bot_order_updates: boolean;
  bot_feedback_enabled: boolean;
  google_review_link: string | null;
  whatsapp_connected: boolean;
  whatsapp_phone: string | null;
  slug: string;
}

export default function AdminWhatsAppBot() {
  const { selectedRestaurantId, selectedRestaurantIds } = useRestaurantContext();
  const ctxRestaurantId = selectedRestaurantId === "all" ? selectedRestaurantIds[0] : selectedRestaurantId;
  const [settings, setSettings] = useState<BotSettings | null>(null);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchSettings();
  }, [ctxRestaurantId]);

  const fetchSettings = async () => {
    if (!ctxRestaurantId) return;

    const { data } = await supabase
      .from("restaurants")
      .select("id, bot_enabled, bot_greeting_message, bot_auto_reply_enabled, bot_order_updates, bot_feedback_enabled, google_review_link, whatsapp_connected, whatsapp_phone, slug")
      .eq("id", ctxRestaurantId)
      .maybeSingle();

    if (data) {
      setRestaurantId(data.id);
      setSettings({
        bot_enabled: (data as any).bot_enabled ?? false,
        bot_greeting_message: (data as any).bot_greeting_message ?? "Olá! 👋 Bem-vindo ao nosso restaurante! Confira nosso cardápio completo:",
        bot_auto_reply_enabled: (data as any).bot_auto_reply_enabled ?? true,
        bot_order_updates: (data as any).bot_order_updates ?? true,
        bot_feedback_enabled: (data as any).bot_feedback_enabled ?? true,
        google_review_link: (data as any).google_review_link ?? null,
        whatsapp_connected: data.whatsapp_connected ?? false,
        whatsapp_phone: data.whatsapp_phone ?? null,
        slug: data.slug,
      });
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!restaurantId || !settings) return;
    setSaving(true);

    const { error } = await supabase
      .from("restaurants")
      .update({
        bot_enabled: settings.bot_enabled,
        bot_greeting_message: settings.bot_greeting_message,
        bot_auto_reply_enabled: settings.bot_auto_reply_enabled,
        bot_order_updates: settings.bot_order_updates,
        bot_feedback_enabled: settings.bot_feedback_enabled,
        google_review_link: settings.google_review_link,
      } as any)
      .eq("id", restaurantId);

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "✅ Configurações do bot salvas!" });
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!settings) {
    return <p className="text-center text-muted-foreground py-12">Restaurante não encontrado</p>;
  }

  const menuLink = `${window.location.origin}/${settings.slug}`;

  return (
    <div className="space-y-3 md:space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bot className="w-6 h-6" />
            WhatsApp Bot
          </h1>
          <p className="text-muted-foreground">Configure respostas automáticas e notificações</p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          {saving ? "Salvando..." : "Salvar"}
        </Button>
      </div>

      {/* WhatsApp Connection (same instance shared with Campanhas) */}
      <WhatsAppConnection restaurantId={restaurantId} />

      {/* Master Toggle */}
      <Card>
        <CardContent className="flex items-center justify-between py-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <Bot className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="font-semibold">Ativar WhatsApp Bot</p>
              <p className="text-sm text-muted-foreground">Habilita todas as funções automáticas abaixo</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={settings.bot_enabled ? "default" : "secondary"}>
              {settings.bot_enabled ? "Ativo" : "Inativo"}
            </Badge>
            <Switch
              checked={settings.bot_enabled}
              onCheckedChange={(checked) => setSettings({ ...settings, bot_enabled: checked })}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Greeting */}
        <Card className={!settings.bot_enabled ? "opacity-50 pointer-events-none" : ""}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="w-5 h-5 text-blue-500" />
              Atendimento Automático
            </CardTitle>
            <CardDescription>
              Quando alguém manda uma mensagem no seu WhatsApp, o bot responde automaticamente com esta mensagem + link do cardápio.
              Para evitar spam, cada cliente recebe a resposta no máximo 1 vez a cada 4 horas.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Responder mensagens recebidas</p>
                <p className="text-xs text-muted-foreground">Envia a mensagem abaixo automaticamente para quem te chamar</p>
              </div>
              <Switch
                checked={settings.bot_auto_reply_enabled}
                onCheckedChange={(checked) => setSettings({ ...settings, bot_auto_reply_enabled: checked })}
              />
            </div>
            <div className="space-y-2">
              <Label>Mensagem automática</Label>
              <Textarea
                value={settings.bot_greeting_message}
                onChange={(e) => setSettings({ ...settings, bot_greeting_message: e.target.value })}
                placeholder="Olá! 👋 Bem-vindo..."
                rows={3}
              />
            </div>
            <div className="p-3 rounded-lg bg-muted/50 border">
              <p className="text-xs font-medium text-muted-foreground mb-1">Prévia da mensagem:</p>
              <p className="text-sm whitespace-pre-wrap">
                {settings.bot_greeting_message}
                {"\n\n"}🍽️ {menuLink}
                {"\n\n"}Caso queira falar com um atendente, digite: *Falar com Atendente* 😊
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Order Updates */}
        <Card className={!settings.bot_enabled ? "opacity-50 pointer-events-none" : ""}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="w-5 h-5 text-orange-500" />
              Acompanhamento de Pedidos
            </CardTitle>
            <CardDescription>
              Envia automaticamente o status atualizado do pedido ao cliente via WhatsApp.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Notificar mudanças de status</p>
                <p className="text-xs text-muted-foreground">Ao alterar o status, o cliente recebe uma mensagem</p>
              </div>
              <Switch
                checked={settings.bot_order_updates}
                onCheckedChange={(checked) => setSettings({ ...settings, bot_order_updates: checked })}
              />
            </div>
            <div className="space-y-2 p-3 rounded-lg bg-muted/50 border">
              <p className="text-xs font-medium text-muted-foreground">Mensagens automáticas:</p>
              <div className="space-y-1.5 text-xs">
                <p>🔥 <strong>Preparando:</strong> "Seu pedido #XX está sendo preparado!"</p>
                <p>📦 <strong>Pronto:</strong> "Seu pedido #XX está pronto!"</p>
                <p>🛵 <strong>A caminho:</strong> "Seu pedido #XX saiu para entrega!"</p>
                <p>🏪 <strong>Retirada:</strong> "Seu pedido #XX está pronto para retirada!"</p>
                <p>✅ <strong>Entregue:</strong> "Seu pedido #XX foi entregue!"</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Feedback / Google Review */}
        <Card className={`lg:col-span-2 ${!settings.bot_enabled ? "opacity-50 pointer-events-none" : ""}`}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Star className="w-5 h-5 text-yellow-500" />
              Feedback e Avaliação
            </CardTitle>
            <CardDescription>
              Quando o pedido é marcado como "Entregue", envia uma mensagem pedindo avaliação no Google.
              {!settings.google_review_link && (
                <span className="block mt-1 text-amber-600 dark:text-amber-400">
                  ⚠️ Cadastre o link do Google Meu Negócio para ativar esta função.
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Enviar pedido de avaliação</p>
                <p className="text-xs text-muted-foreground">Mensagem enviada junto com a confirmação de entrega</p>
              </div>
              <Switch
                checked={settings.bot_feedback_enabled}
                onCheckedChange={(checked) => setSettings({ ...settings, bot_feedback_enabled: checked })}
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <LinkIcon className="w-4 h-4" />
                Link do Google Meu Negócio
              </Label>
              <Input
                value={settings.google_review_link || ""}
                onChange={(e) => setSettings({ ...settings, google_review_link: e.target.value || null })}
                placeholder="https://g.page/r/seu-restaurante/review"
              />
              <p className="text-xs text-muted-foreground">
                Cole aqui o link de avaliação do Google Maps do seu restaurante
              </p>
            </div>
            {settings.google_review_link && settings.bot_feedback_enabled && (
              <div className="p-3 rounded-lg bg-muted/50 border">
                <p className="text-xs font-medium text-muted-foreground mb-1">Prévia da mensagem de feedback:</p>
                <p className="text-sm whitespace-pre-wrap">
                  ✅ Seu pedido foi entregue com sucesso!{"\n\n"}
                  Ficamos felizes em atendê-lo! 😊{"\n"}
                  Que tal nos avaliar no Google? Sua opinião é muito importante para nós!{"\n\n"}
                  ⭐ {settings.google_review_link}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
