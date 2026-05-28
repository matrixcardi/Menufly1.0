import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurantContext } from "@/contexts/RestaurantContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { getUserFriendlyError } from "@/lib/error-handler";
import { logger } from "@/lib/logger";
import {
  ImageIcon,
  Loader2,
  Save,
  X,
  Upload,
  Eye,
  FileText,
  Download,
  Palette,
  Moon,
  Sun,
} from "lucide-react";

import MenuHighlightsSection from "@/components/admin/MenuHighlightsSection";
import { exportMenuPDF } from "@/lib/export-menu-pdf";

interface Restaurant {
  id: string;
  name: string;
  slug: string;
  logo_url?: string | null;
  banner_url?: string | null;
  description?: string | null;
  menu_theme?: string | null;
}

export default function AdminMenu() {
  const { selectedRestaurantId, selectedRestaurantIds } = useRestaurantContext();
  const ctxRestaurantId = selectedRestaurantId === "all" ? selectedRestaurantIds[0] : selectedRestaurantId;
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, [ctxRestaurantId]);

  const fetchData = async () => {
    try {
      if (!ctxRestaurantId) {
        setLoading(false);
        return;
      }

      const { data: restaurantData, error: restaurantError } = await supabase
        .from("restaurants")
        .select("id, name, slug, logo_url, banner_url, description, menu_theme")
        .eq("id", ctxRestaurantId)
        .maybeSingle();

      if (restaurantError) {
        logger.error("Error fetching restaurant:", restaurantError);
      }

      if (restaurantData) {
        setRestaurant(restaurantData);
        setLogoPreview(restaurantData.logo_url || null);
        setBannerPreview(restaurantData.banner_url || null);
      }
    } catch (error) {
      logger.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (file: File, type: "logo" | "banner") => {
    if (!file.type.startsWith("image/")) {
      toast({ title: "Erro", description: "Por favor, selecione uma imagem válida.", variant: "destructive" });
      return null;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Erro", description: "A imagem deve ter no máximo 5MB.", variant: "destructive" });
      return null;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/${type}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("product-images")
        .upload(fileName, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("product-images")
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (error) {
      logger.error("Error uploading image:", error);
      toast({ title: "Erro", description: getUserFriendlyError(error), variant: "destructive" });
      return null;
    }
  };

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingLogo(true);
    const url = await handleImageUpload(file, "logo");
    if (url) {
      setLogoPreview(url);
      setRestaurant((prev) => prev ? { ...prev, logo_url: url } : null);
    }
    setIsUploadingLogo(false);
    if (logoInputRef.current) logoInputRef.current.value = "";
  };

  const handleBannerChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingBanner(true);
    const url = await handleImageUpload(file, "banner");
    if (url) {
      setBannerPreview(url);
      setRestaurant((prev) => prev ? { ...prev, banner_url: url } : null);
    }
    setIsUploadingBanner(false);
    if (bannerInputRef.current) bannerInputRef.current.value = "";
  };

  const handleRemoveLogo = () => {
    setLogoPreview(null);
    setRestaurant((prev) => prev ? { ...prev, logo_url: null } : null);
  };

  const handleRemoveBanner = () => {
    setBannerPreview(null);
    setRestaurant((prev) => prev ? { ...prev, banner_url: null } : null);
  };

  const handleSave = async () => {
    if (!restaurant) return;
    setSaving(true);
    try {
      const { error: restaurantError } = await supabase
        .from("restaurants")
        .update({
          logo_url: restaurant.logo_url,
          banner_url: restaurant.banner_url,
          description: restaurant.description,
          menu_theme: restaurant.menu_theme,
        })
        .eq("id", restaurant.id);
      if (restaurantError) throw restaurantError;
      toast({ title: "Cardápio salvo com sucesso!" });
    } catch (error) {
      logger.error("Error saving menu:", error);
      toast({ title: "Erro ao salvar", description: getUserFriendlyError(error), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-3 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Cardápio Digital</h1>
          <p className="text-muted-foreground">Personalize a aparência do seu cardápio</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => window.open(`/${restaurant?.slug}`, "_blank")} className="gap-2 flex-1 sm:flex-initial" disabled={!restaurant}>
            <Eye className="w-4 h-4" />
            <span className="hidden sm:inline">Ver Cardápio</span>
            <span className="sm:hidden">Ver</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!restaurant || isExporting}
            className="gap-2 flex-1 sm:flex-initial"
            onClick={async () => {
              if (!restaurant) return;
              setIsExporting(true);
              try {
                await exportMenuPDF(restaurant.id, restaurant.name, restaurant.logo_url);
                toast({ title: "PDF exportado com sucesso!" });
              } catch (err: any) {
                toast({ title: "Erro ao exportar", description: err.message, variant: "destructive" });
              } finally {
                setIsExporting(false);
              }
            }}
          >
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            <span className="hidden sm:inline">Exportar PDF</span>
            <span className="sm:hidden">PDF</span>
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving} className="flex-1 sm:flex-initial">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Logo Upload */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="w-5 h-5" />
              Foto do Perfil
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">A logo que aparecerá no topo do seu cardápio. Recomendamos uma imagem quadrada.</p>
            {logoPreview ? (
              <div className="relative w-32 h-32 mx-auto">
                <img src={logoPreview} alt="Logo" className="w-full h-full object-cover rounded-full border-4 border-muted" />
                <button onClick={handleRemoveLogo} className="absolute -top-2 -right-2 p-1 bg-destructive text-destructive-foreground rounded-full hover:bg-destructive/90">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div onClick={() => logoInputRef.current?.click()} className="w-32 h-32 mx-auto border-2 border-dashed border-muted-foreground/25 rounded-full flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors">
                {isUploadingLogo ? <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" /> : (
                  <>
                    <Upload className="w-6 h-6 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground text-center">Upload logo</span>
                  </>
                )}
              </div>
            )}
            <input ref={logoInputRef} type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
            {logoPreview && (
              <Button variant="outline" className="w-full" onClick={() => logoInputRef.current?.click()}>Trocar imagem</Button>
            )}
          </CardContent>
        </Card>

        {/* Description Field */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Descrição do Restaurante
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">Um breve texto que aparecerá abaixo da foto de perfil no cardápio.</p>
            <div className="space-y-2">
              <Textarea
                value={restaurant?.description || ""}
                onChange={(e) => {
                  const value = e.target.value.slice(0, 300);
                  setRestaurant((prev) => prev ? { ...prev, description: value } : null);
                }}
                placeholder="Ex: Hambúrgueres artesanais feitos com ingredientes selecionados. Delivery e retirada disponíveis!"
                className="min-h-[100px] resize-none"
                maxLength={300}
              />
              <div className="flex justify-end">
                <span className={`text-xs ${(restaurant?.description?.length || 0) >= 280 ? 'text-amber-500' : 'text-muted-foreground'}`}>
                  {restaurant?.description?.length || 0}/300
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Banner Upload */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="w-5 h-5" />
              Banner do Perfil
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">Imagem de capa do seu cardápio. Recomendamos 1200x400 pixels.</p>
            {bannerPreview ? (
              <div className="relative w-full h-32">
                <img src={bannerPreview} alt="Banner" className="w-full h-full object-cover rounded-lg border" />
                <button onClick={handleRemoveBanner} className="absolute top-2 right-2 p-1 bg-destructive text-destructive-foreground rounded-full hover:bg-destructive/90">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div onClick={() => bannerInputRef.current?.click()} className="w-full h-32 border-2 border-dashed border-muted-foreground/25 rounded-lg flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors">
                {isUploadingBanner ? <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" /> : (
                  <>
                    <Upload className="w-6 h-6 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Upload banner</span>
                  </>
                )}
              </div>
            )}
            <input ref={bannerInputRef} type="file" accept="image/*" onChange={handleBannerChange} className="hidden" />
            {bannerPreview && (
              <Button variant="outline" className="w-full" onClick={() => bannerInputRef.current?.click()}>Trocar imagem</Button>
            )}
          </CardContent>
        </Card>

        {/* Highlights Section */}
        {restaurant && <MenuHighlightsSection restaurantId={restaurant.id} />}
      </div>

      {/* Menu Theme */}
      {restaurant && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="w-5 h-5" />
              Tema do Cardápio
            </CardTitle>
            <CardDescription>
              Escolha a aparência do seu cardápio digital
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setRestaurant({ ...restaurant, menu_theme: 'dark' })}
                className={`relative p-4 rounded-xl border-2 transition-all ${
                  restaurant.menu_theme === 'dark' 
                    ? 'border-primary bg-primary/10' 
                    : 'border-muted hover:border-muted-foreground/50'
                }`}
              >
                <div className="flex flex-col items-center gap-3">
                  <div className="w-full aspect-video bg-zinc-900 rounded-lg flex items-center justify-center border border-zinc-700">
                    <Moon className="w-8 h-8 text-zinc-400" />
                  </div>
                  <div className="text-center">
                    <p className="font-semibold">Dark Mode</p>
                    <p className="text-xs text-muted-foreground">Fundo escuro elegante</p>
                  </div>
                </div>
                {restaurant.menu_theme === 'dark' && (
                  <div className="absolute top-2 right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                    <span className="text-xs text-primary-foreground">✓</span>
                  </div>
                )}
              </button>

              <button
                onClick={() => setRestaurant({ ...restaurant, menu_theme: 'light' })}
                className={`relative p-4 rounded-xl border-2 transition-all ${
                  restaurant.menu_theme === 'light' 
                    ? 'border-primary bg-primary/10' 
                    : 'border-muted hover:border-muted-foreground/50'
                }`}
              >
                <div className="flex flex-col items-center gap-3">
                  <div className="w-full aspect-video bg-zinc-100 rounded-lg flex items-center justify-center border border-zinc-300">
                    <Sun className="w-8 h-8 text-zinc-500" />
                  </div>
                  <div className="text-center">
                    <p className="font-semibold">Clean Mode</p>
                    <p className="text-xs text-muted-foreground">Fundo branco limpo</p>
                  </div>
                </div>
                {restaurant.menu_theme === 'light' && (
                  <div className="absolute top-2 right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                    <span className="text-xs text-primary-foreground">✓</span>
                  </div>
                )}
              </button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
