import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurantContext } from "@/contexts/RestaurantContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Save, ExternalLink, Facebook, BarChart3, Code2, Loader2 } from "lucide-react";

interface AdsSettings {
  meta_pixel_id: string | null;
  meta_access_token: string | null;
  gtm_container_id: string | null;
  ga_measurement_id: string | null;
}

export default function AdminAds() {
  const { selectedRestaurantId, selectedRestaurantIds } = useRestaurantContext();
  const ctxRestaurantId = selectedRestaurantId === "all" ? selectedRestaurantIds[0] : selectedRestaurantId;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [settings, setSettings] = useState<AdsSettings>({
    meta_pixel_id: "",
    meta_access_token: "",
    gtm_container_id: "",
    ga_measurement_id: "",
  });
  const { toast } = useToast();

  useEffect(() => {
    async function fetchSettings() {
      if (!ctxRestaurantId) return;

      const { data, error } = await supabase
        .from("restaurants")
        .select("id, meta_pixel_id, meta_access_token, gtm_container_id, ga_measurement_id")
        .eq("id", ctxRestaurantId)
        .maybeSingle();

      if (error) {
        toast({
          title: "Erro ao carregar configurações",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      if (data) {
        setRestaurantId(data.id);
        setSettings({
          meta_pixel_id: data.meta_pixel_id || "",
          meta_access_token: (data as any).meta_access_token || "",
          gtm_container_id: data.gtm_container_id || "",
          ga_measurement_id: data.ga_measurement_id || "",
        });
      }
      setLoading(false);
    }

    fetchSettings();
  }, [ctxRestaurantId]);

  const handleSave = async () => {
    if (!restaurantId) return;

    setSaving(true);
    const { error } = await supabase
      .from("restaurants")
      .update({
        meta_pixel_id: settings.meta_pixel_id || null,
        meta_access_token: settings.meta_access_token || null,
        gtm_container_id: settings.gtm_container_id || null,
        ga_measurement_id: settings.ga_measurement_id || null,
      } as any)
      .eq("id", restaurantId);

    setSaving(false);

    if (error) {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Configurações salvas!",
      description: "Suas tags de marketing foram atualizadas.",
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-6">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 md:space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">ADS & Marketing</h1>
        <p className="text-muted-foreground">
          Configure suas tags de rastreamento para análise e remarketing
        </p>
      </div>

      <div className="grid gap-6">
        {/* Meta Pixel */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
                <Facebook className="w-6 h-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <CardTitle className="flex items-center gap-2">
                  Meta Pixel
                  {settings.meta_pixel_id && (
                    <Badge variant="secondary" className="bg-green-100 text-green-700">
                      Ativo
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  Rastreie conversões e crie públicos para anúncios no Facebook e Instagram
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="meta_pixel_id">Pixel ID</Label>
              <Input
                id="meta_pixel_id"
                placeholder="123456789012345"
                value={settings.meta_pixel_id || ""}
                onChange={(e) =>
                  setSettings({ ...settings, meta_pixel_id: e.target.value })
                }
              />
              <p className="text-xs text-muted-foreground">
                Encontre seu Pixel ID no{" "}
                <a
                  href="https://business.facebook.com/events_manager"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  Gerenciador de Eventos do Meta
                  <ExternalLink className="w-3 h-3" />
                </a>
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="meta_access_token">Token da API de Conversões</Label>
              <Input
                id="meta_access_token"
                type="password"
                placeholder="EAAxxxxxxx..."
                value={settings.meta_access_token || ""}
                onChange={(e) =>
                  setSettings({ ...settings, meta_access_token: e.target.value })
                }
              />
              <p className="text-xs text-muted-foreground">
                Gere o token em{" "}
                <a
                  href="https://business.facebook.com/events_manager"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  Configurações do Pixel → API de Conversões
                  <ExternalLink className="w-3 h-3" />
                </a>
                . Melhora a precisão das conversões.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Google Tag Manager */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-xl flex items-center justify-center">
                <Code2 className="w-6 h-6 text-amber-600" />
              </div>
              <div className="flex-1">
                <CardTitle className="flex items-center gap-2">
                  Google Tag Manager
                  {settings.gtm_container_id && (
                    <Badge variant="secondary" className="bg-green-100 text-green-700">
                      Ativo
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  Gerencie todas as suas tags de marketing em um só lugar
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="gtm_container_id">Container ID</Label>
              <Input
                id="gtm_container_id"
                placeholder="GTM-XXXXXXX"
                value={settings.gtm_container_id || ""}
                onChange={(e) =>
                  setSettings({ ...settings, gtm_container_id: e.target.value })
                }
              />
              <p className="text-xs text-muted-foreground">
                Encontre seu Container ID no{" "}
                <a
                  href="https://tagmanager.google.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  Google Tag Manager
                  <ExternalLink className="w-3 h-3" />
                </a>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Google Analytics */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-xl flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-orange-600" />
              </div>
              <div className="flex-1">
                <CardTitle className="flex items-center gap-2">
                  Google Analytics 4
                  {settings.ga_measurement_id && (
                    <Badge variant="secondary" className="bg-green-100 text-green-700">
                      Ativo
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  Analise o tráfego e comportamento dos visitantes do seu cardápio
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ga_measurement_id">Measurement ID</Label>
              <Input
                id="ga_measurement_id"
                placeholder="G-XXXXXXXXXX"
                value={settings.ga_measurement_id || ""}
                onChange={(e) =>
                  setSettings({ ...settings, ga_measurement_id: e.target.value })
                }
              />
              <p className="text-xs text-muted-foreground">
                Encontre seu Measurement ID no{" "}
                <a
                  href="https://analytics.google.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  Google Analytics
                  <ExternalLink className="w-3 h-3" />
                </a>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Button onClick={handleSave} disabled={saving} className="gap-2">
        {saving ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Save className="w-4 h-4" />
        )}
        {saving ? "Salvando..." : "Salvar Configurações"}
      </Button>
    </div>
  );
}
