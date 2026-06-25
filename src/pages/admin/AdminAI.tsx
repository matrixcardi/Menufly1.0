import { Construction } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function AdminAI() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center px-4">
      <div className="rounded-full bg-muted p-6">
        <Construction className="w-12 h-12 text-muted-foreground" />
      </div>
      <div className="space-y-2">
        <Badge variant="outline" className="text-sm px-3 py-1">Em Obras</Badge>
        <h1 className="text-2xl font-bold">IA Criativa — Em Breve</h1>
        <p className="text-muted-foreground max-w-md">
          Estamos construindo algo incrível para você. Esta funcionalidade estará disponível em breve.
        </p>
      </div>
    </div>
  );
}


// ─────────────────────────────────────────────────────────────
// CÓDIGO ORIGINAL — COMENTADO PARA PRODUÇÃO
// ─────────────────────────────────────────────────────────────
//
// import { useEffect, useState, useCallback, useRef } from "react";
// import { supabase } from "@/integrations/supabase/client";
// import { useRestaurantContext } from "@/contexts/RestaurantContext";
// import { Button } from "@/components/ui/button";
// import { Badge } from "@/components/ui/badge";
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
// import { Textarea } from "@/components/ui/textarea";
// import { useToast } from "@/hooks/use-toast";
// import { logger } from "@/lib/logger";
// import {
//   Sparkles,
//   Image as ImageIcon,
//   Coins,
//   Clock,
//   Download,
//   Loader2,
//   Camera,
//   Film,
//   Users,
//   RectangleHorizontal,
//   RectangleVertical,
//   Square,
//   Monitor,
//   History,
//   CreditCard,
//   Plus,
//   Zap,
//   TrendingUp,
//   Upload,
//   X,
//   ShoppingBag,
// } from "lucide-react";
// import { format } from "date-fns";
// import { ptBR } from "date-fns/locale";
// import { cn } from "@/lib/utils";
// import { CreditsPixDrawer } from "@/components/campaigns/CreditsPixDrawer";
//
// interface CreditBalance {
//   balance: number;
//   total_purchased: number;
//   total_used: number;
// }
//
// interface Generation {
//   id: string;
//   generation_type: string;
//   prompt: string | null;
//   result_url: string | null;
//   credits_used: number;
//   status: string;
//   created_at: string;
//   product_id: string | null;
// }
//
// interface Transaction {
//   id: string;
//   amount: number;
//   type: string;
//   description: string | null;
//   generation_type: string | null;
//   created_at: string;
// }
//
// interface Product {
//   id: string;
//   name: string;
//   description: string | null;
//   price: number;
//   image_url: string | null;
// }
//
// // ── MODE & MATERIAL DEFINITIONS ──
//
// const MODES = [
//   { type: "ugc", label: "UGC", description: "Conteúdo com pessoas reais", icon: Users },
//   { type: "produto", label: "Produto", description: "Fotos e vídeos profissionais", icon: ShoppingBag },
// ];
//
// const MATERIALS = [
//   { type: "foto", label: "Fotos", icon: Camera },
//   { type: "video", label: "Vídeos", icon: Film },
// ];
//
// const CREDITS_MAP: Record<string, Record<string, number>> = {
//   ugc: { foto: 2, video: 5 },
//   produto: { foto: 1, video: 3 },
// };
//
// const getBackendType = (mode: string, material: string): string => {
//   if (mode === "ugc" && material === "foto") return "ugc_content";
//   if (mode === "ugc" && material === "video") return "ugc_video";
//   if (mode === "produto" && material === "foto") return "product_photo";
//   if (mode === "produto" && material === "video") return "product_video";
//   return "product_photo";
// };
//
// const VIDEO_MODELS = [
//   { value: "gen3a_turbo", label: "Gen-3 Turbo", description: "Rápido e econômico", credits: 3 },
//   { value: "gen4_turbo", label: "Gen-4 Turbo", description: "Qualidade superior", credits: 5 },
// ];
//
// const ASPECT_RATIOS = [
//   { value: "9:16", label: "9:16", sublabel: "Story", icon: RectangleVertical },
//   { value: "16:9", label: "16:9", sublabel: "Landscape", icon: RectangleHorizontal },
//   { value: "1:1", label: "1:1", sublabel: "Quadrado", icon: Square },
//   { value: "4:5", label: "4:5", sublabel: "Feed IG", icon: Monitor },
// ];
//
// const CREDIT_PACKAGES = [
//   { credits: 10, price: 9.90, label: "Iniciante", popular: false },
//   { credits: 30, price: 24.90, label: "Profissional", popular: true },
//   { credits: 100, price: 69.90, label: "Ilimitado", popular: false },
// ];
//
// export default function AdminAI() {
//   const [restaurantId, setRestaurantId] = useState<string | null>(null);
//   const [userId, setUserId] = useState<string | undefined>(undefined);
//   const [credits, setCredits] = useState<CreditBalance>({ balance: 0, total_purchased: 0, total_used: 0 });
//   const [generations, setGenerations] = useState<Generation[]>([]);
//   const [transactions, setTransactions] = useState<Transaction[]>([]);
//   const [products, setProducts] = useState<Product[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [generating, setGenerating] = useState(false);
//   const [exportingVideo, setExportingVideo] = useState<string | null>(null);
//
//   // Form state
//   const [selectedMode, setSelectedMode] = useState("produto");
//   const [selectedMaterial, setSelectedMaterial] = useState("foto");
//   const [selectedRatio, setSelectedRatio] = useState("1:1");
//   const [selectedProductId, setSelectedProductId] = useState("");
//   const [customPrompt, setCustomPrompt] = useState("");
//   const [videoModel, setVideoModel] = useState("gen4_turbo");
//   const [videoDuration, setVideoDuration] = useState(10);
//
//   // Source mode
//   const [sourceMode, setSourceMode] = useState<"none" | "menu" | "upload">("none");
//   const [uploadedFile, setUploadedFile] = useState<File | null>(null);
//   const [uploadedPreview, setUploadedPreview] = useState<string | null>(null);
//   const [uploadingFile, setUploadingFile] = useState(false);
//   const fileInputRef = useRef<HTMLInputElement>(null);
//
//   // View state
//   const [activeView, setActiveView] = useState<"create" | "gallery" | "credits">("create");
//
//   // Purchase state
//   const [selectedPackage, setSelectedPackage] = useState<typeof CREDIT_PACKAGES[0] | null>(null);
//   const [pixDrawerOpen, setPixDrawerOpen] = useState(false);
//
//   const { toast } = useToast();
//
//   // Derived values
//   const isVideoMode = selectedMaterial === "video";
//   const isUGC = selectedMode === "ugc";
//   const currentCredits = isVideoMode && !isUGC
//     ? (VIDEO_MODELS.find(m => m.value === videoModel)?.credits || 3)
//     : CREDITS_MAP[selectedMode]?.[selectedMaterial] || 1;
//   const currentBackendType = getBackendType(selectedMode, selectedMaterial);
//   const currentModeLabel = MODES.find(m => m.type === selectedMode)?.label || "";
//   const currentMaterialLabel = MATERIALS.find(m => m.type === selectedMaterial)?.label || "";
//
//   const { selectedRestaurantId: ctxSelectedId, selectedRestaurantIds } = useRestaurantContext();
//   const ctxRestaurantId = ctxSelectedId === "all" ? selectedRestaurantIds[0] : ctxSelectedId;
//
//   useEffect(() => {
//     fetchData();
//   }, [ctxRestaurantId]);
//
//   const fetchData = async () => {
//     try {
//       if (!ctxRestaurantId) return;
//
//       setRestaurantId(ctxRestaurantId);
//
//       const { data: { session } } = await supabase.auth.getSession();
//       if (session?.user) setUserId(session.user.id);
//
//       const [creditsRes, gensRes, txRes, productsRes] = await Promise.all([
//         supabase.from("ai_credits").select("balance, total_purchased, total_used").eq("restaurant_id", ctxRestaurantId).maybeSingle(),
//         supabase.from("ai_generations").select("*").eq("restaurant_id", ctxRestaurantId).order("created_at", { ascending: false }).limit(50),
//         supabase.from("ai_credit_transactions").select("*").eq("restaurant_id", ctxRestaurantId).order("created_at", { ascending: false }).limit(20),
//         supabase.from("products").select("id, name, description, price, image_url").eq("restaurant_id", ctxRestaurantId).eq("is_active", true).order("name"),
//       ]);
//
//       if (creditsRes.data) {
//         setCredits(creditsRes.data);
//       } else {
//         await supabase.from("ai_credits").insert({ restaurant_id: ctxRestaurantId });
//       }
//
//       if (gensRes.data) setGenerations(gensRes.data);
//       if (txRes.data) setTransactions(txRes.data);
//       if (productsRes.data) setProducts(productsRes.data);
//     } catch (error) {
//       logger.error("Error fetching AI data:", error);
//     } finally {
//       setLoading(false);
//     }
//   };
//
//   const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
//     const file = e.target.files?.[0];
//     if (!file) return;
//
//     const maxSize = 10 * 1024 * 1024;
//     if (file.size > maxSize) {
//       toast({ title: "Arquivo muito grande", description: "O tamanho máximo é 10MB.", variant: "destructive" });
//       return;
//     }
//
//     const validTypes = ["image/jpeg", "image/png", "image/webp", "video/mp4", "video/quicktime"];
//     if (!validTypes.includes(file.type)) {
//       toast({ title: "Formato inválido", description: "Use JPG, PNG, WebP ou MP4.", variant: "destructive" });
//       return;
//     }
//
//     setUploadedFile(file);
//     setUploadedPreview(URL.createObjectURL(file));
//   }, [toast]);
//
//   const clearUpload = useCallback(() => {
//     if (uploadedPreview) URL.revokeObjectURL(uploadedPreview);
//     setUploadedFile(null);
//     setUploadedPreview(null);
//     if (fileInputRef.current) fileInputRef.current.value = "";
//   }, [uploadedPreview]);
//
//   const uploadFileToStorage = useCallback(async (file: File): Promise<string | null> => {
//     if (!restaurantId) return null;
//     setUploadingFile(true);
//     try {
//       const ext = file.name.split(".").pop() || "png";
//       const fileName = `ai-references/${restaurantId}/${Date.now()}.${ext}`;
//       const { error } = await supabase.storage
//         .from("product-images")
//         .upload(fileName, file, { contentType: file.type, upsert: true });
//
//       if (error) throw error;
//
//       const { data: { publicUrl } } = supabase.storage
//         .from("product-images")
//         .getPublicUrl(fileName);
//
//       return publicUrl;
//     } catch (error) {
//       logger.error("Upload error:", error);
//       toast({ title: "Erro no upload", description: "Não foi possível enviar o arquivo.", variant: "destructive" });
//       return null;
//     } finally {
//       setUploadingFile(false);
//     }
//   }, [restaurantId, toast]);
//
//   const handleGenerate = useCallback(async () => {
//     if (!restaurantId) return;
//
//     if (credits.balance < currentCredits) {
//       toast({ title: "Créditos insuficientes", description: "Compre mais créditos para gerar conteúdo.", variant: "destructive" });
//       setActiveView("credits");
//       return;
//     }
//
//     if (sourceMode === "menu" && !selectedProductId) {
//       toast({ title: "Selecione um produto", description: "Escolha um produto do cardápio.", variant: "destructive" });
//       return;
//     }
//
//     if (sourceMode === "upload" && !uploadedFile) {
//       toast({ title: "Envie uma referência", description: "Faça upload de uma foto como referência.", variant: "destructive" });
//       return;
//     }
//
//     if (sourceMode === "none" && !customPrompt.trim()) {
//       toast({ title: "Descreva o conteúdo", description: "Sem referência, é necessário descrever o que deseja.", variant: "destructive" });
//       return;
//     }
//
//     setGenerating(true);
//     try {
//       let referenceImageUrl: string | null = null;
//       if (sourceMode === "upload" && uploadedFile) {
//         referenceImageUrl = await uploadFileToStorage(uploadedFile);
//         if (!referenceImageUrl) { setGenerating(false); return; }
//       }
//
//       const session = (await supabase.auth.getSession()).data.session;
//       const headers = {
//         "Content-Type": "application/json",
//         Authorization: `Bearer ${session?.access_token}`,
//         apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
//       };
//
//       // ── VIDEO GENERATION (Produto mode uses Runway, UGC mode uses Gemini image → Runway) ──
//       if (isVideoMode) {
//         let imageUrl = referenceImageUrl;
//
//         // Get product image if using menu
//         if (sourceMode === "menu" && selectedProductId) {
//           const product = products.find(p => p.id === selectedProductId);
//           if (product?.image_url) imageUrl = product.image_url;
//         }
//
//         // For UGC video: first generate a UGC photo with a person, then animate it
//         if (isUGC && !imageUrl) {
//           const imgResp = await fetch(
//             `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-generate-content`,
//             {
//               method: "POST",
//               headers,
//               body: JSON.stringify({
//                 generation_type: "ugc_content",
//                 product_id: sourceMode === "menu" ? selectedProductId : null,
//                 restaurant_id: restaurantId,
//                 custom_prompt: customPrompt || "pessoa sorrindo com o prato",
//                 aspect_ratio: selectedRatio,
//                 reference_image_url: referenceImageUrl,
//               }),
//             }
//           );
//           const imgData = await imgResp.json();
//           if (!imgResp.ok || imgData.error) throw new Error(imgData.error || "Erro ao gerar imagem UGC");
//           imageUrl = imgData.result_url;
//         }
//
//         // For Produto video without image: generate product photo first
//         if (!isUGC && !imageUrl) {
//           const imgResp = await fetch(
//             `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-generate-content`,
//             {
//               method: "POST",
//               headers,
//               body: JSON.stringify({
//                 generation_type: "product_photo",
//                 product_id: sourceMode === "menu" ? selectedProductId : null,
//                 restaurant_id: restaurantId,
//                 custom_prompt: customPrompt || "",
//                 aspect_ratio: selectedRatio,
//                 reference_image_url: referenceImageUrl,
//               }),
//             }
//           );
//           const imgData = await imgResp.json();
//           if (!imgResp.ok || imgData.error) throw new Error(imgData.error || "Erro ao gerar imagem base");
//           imageUrl = imgData.result_url;
//         }
//
//         // Call video generation (Runway)
//         const videoResp = await fetch(
//           `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-video`,
//           {
//             method: "POST",
//             headers,
//             body: JSON.stringify({
//               action: "start",
//               restaurant_id: restaurantId,
//               product_id: sourceMode === "menu" ? selectedProductId : null,
//               image_url: imageUrl,
//               prompt: isUGC
//                 ? (customPrompt || "pessoa sorrindo naturalmente, movimento sutil, ambiente de restaurante")
//                 : (customPrompt || ""),
//               aspect_ratio: selectedRatio,
//               video_model: isUGC ? "gen4_turbo" : videoModel,
//               duration: videoDuration,
//               generation_type: currentBackendType,
//             }),
//           }
//         );
//
//         const videoData = await videoResp.json();
//         if (!videoResp.ok || videoData.error) throw new Error(videoData.error || "Erro ao iniciar vídeo");
//
//         toast({ title: "Vídeo em produção! 🎬", description: "Acompanhe na galeria." });
//         setCustomPrompt("");
//         clearUpload();
//         setActiveView("gallery");
//         fetchData();
//         pollVideoStatus(videoData.runway_task_id, videoData.generation_id, restaurantId);
//         return;
//       }
//
//       // ── PHOTO GENERATION ──
//       const controller = new AbortController();
//       const timeoutId = setTimeout(() => controller.abort(), 120000);
//
//       const response = await fetch(
//         `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-generate-content`,
//         {
//           method: "POST",
//           headers,
//           body: JSON.stringify({
//             generation_type: currentBackendType,
//             product_id: sourceMode === "menu" ? selectedProductId : null,
//             restaurant_id: restaurantId,
//             custom_prompt: customPrompt || "",
//             aspect_ratio: selectedRatio,
//             reference_image_url: referenceImageUrl,
//           }),
//           signal: controller.signal,
//         }
//       );
//       clearTimeout(timeoutId);
//
//       const data = await response.json();
//       if (!response.ok) throw new Error(data?.error || "Erro desconhecido");
//       if (data?.error) { toast({ title: "Erro", description: data.error, variant: "destructive" }); return; }
//
//       toast({ title: "Conteúdo gerado! ✨", description: `${currentCredits} crédito(s). Saldo: ${data.remaining_credits}` });
//       setCustomPrompt("");
//       clearUpload();
//       setActiveView("gallery");
//       fetchData();
//     } catch (error) {
//       logger.error("Generation error:", error);
//       toast({ title: "Erro ao gerar", description: error instanceof Error ? error.message : "Tente novamente.", variant: "destructive" });
//     } finally {
//       setGenerating(false);
//     }
//   }, [restaurantId, selectedMode, selectedMaterial, selectedProductId, customPrompt, selectedRatio, credits.balance, toast, sourceMode, uploadedFile, uploadFileToStorage, clearUpload, products, currentCredits, currentBackendType, isVideoMode, isUGC, videoModel, videoDuration]);
//
//   const pollVideoStatus = useCallback(async (runwayTaskId: string, generationId: string, restId: string) => {
//     const maxAttempts = 60;
//     let attempt = 0;
//
//     const poll = async () => {
//       attempt++;
//       try {
//         const session = (await supabase.auth.getSession()).data.session;
//         if (!session) return;
//
//         const resp = await fetch(
//           `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-video`,
//           {
//             method: "POST",
//             headers: {
//               "Content-Type": "application/json",
//               Authorization: `Bearer ${session.access_token}`,
//               apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
//             },
//             body: JSON.stringify({
//               action: "poll",
//               runway_task_id: runwayTaskId,
//               generation_id: generationId,
//               restaurant_id: restId,
//             }),
//           }
//         );
//
//         const data = await resp.json();
//
//         if (data.status === "completed") {
//           toast({ title: "Vídeo pronto! 🎬" });
//           fetchData();
//           return;
//         }
//         if (data.status === "failed") {
//           toast({ title: "Falha na geração", description: data.error || "Tente novamente.", variant: "destructive" });
//           fetchData();
//           return;
//         }
//         if (attempt < maxAttempts) setTimeout(poll, 5000);
//         else toast({ title: "Timeout", description: "Verifique a galeria depois.", variant: "destructive" });
//       } catch (error) {
//         logger.error("Poll error:", error);
//         if (attempt < maxAttempts) setTimeout(poll, 10000);
//       }
//     };
//
//     setTimeout(poll, 5000);
//   }, [toast]);
//
//   const handleDownloadMedia = useCallback(async (url: string, genId: string, isVideo: boolean) => {
//     setExportingVideo(genId);
//     try {
//       const res = await fetch(url);
//       const blob = await res.blob();
//       const a = document.createElement("a");
//       a.href = URL.createObjectURL(blob);
//       a.download = `menufly-${isVideo ? "video" : "image"}-${genId.slice(0, 8)}.${isVideo ? "mp4" : "png"}`;
//       document.body.appendChild(a);
//       a.click();
//       document.body.removeChild(a);
//       URL.revokeObjectURL(a.href);
//       toast({ title: "Download iniciado! 📥" });
//     } catch {
//       window.open(url, "_blank");
//     } finally {
//       setExportingVideo(null);
//     }
//   }, [toast]);
//
//   const getGenerationTypeLabel = (type: string) => {
//     if (type === "ad_creative") return "Anúncio";
//     if (type === "ugc_content") return "UGC Foto";
//     if (type === "ugc_video") return "UGC Vídeo";
//     if (type === "product_photo") return "Produto Foto";
//     if (type === "product_video") return "Produto Vídeo";
//     return type;
//   };
//
//   if (loading) {
//     return (
//       <div className="flex items-center justify-center h-64">
//         <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
//       </div>
//     );
//   }
//
//   return (
//     <div className="flex flex-col h-auto md:h-[calc(100vh-4rem)] -m-2 md:-m-6">
//       {/* Top bar */}
//       <div className="flex items-center justify-between px-3 md:px-5 py-2.5 md:py-3 border-b bg-card gap-2">
//         <div className="flex items-center gap-2 shrink-0">
//           <Sparkles className="w-5 h-5 text-primary" />
//           <h1 className="text-base md:text-lg font-bold">IA Criativa</h1>
//         </div>
//         <div className="flex items-center gap-1 md:gap-2 overflow-x-auto scrollbar-hide">
//           <Button variant={activeView === "create" ? "default" : "ghost"} size="sm" onClick={() => setActiveView("create")} className="shrink-0 text-xs md:text-sm px-2 md:px-3 h-8">
//             <Sparkles className="w-3.5 h-3.5 mr-1" />
//             Criar
//           </Button>
//           <Button variant={activeView === "gallery" ? "default" : "ghost"} size="sm" onClick={() => setActiveView("gallery")} className="shrink-0 text-xs md:text-sm px-2 md:px-3 h-8">
//             <History className="w-3.5 h-3.5 mr-1" />
//             Galeria
//           </Button>
//           <Button variant={activeView === "credits" ? "default" : "ghost"} size="sm" onClick={() => setActiveView("credits")} className="shrink-0 text-xs md:text-sm px-2 md:px-3 h-8">
//             <CreditCard className="w-3.5 h-3.5 mr-1" />
//             Créditos
//           </Button>
//           <div className="h-5 w-px bg-border mx-0.5 md:mx-1 shrink-0" />
//           <div className="flex items-center gap-1 text-xs md:text-sm px-2 py-1 rounded-md bg-primary/10 text-primary font-medium shrink-0">
//             <Coins className="w-3.5 h-3.5" />
//             {credits.balance}
//           </div>
//         </div>
//       </div>
//
//       {/* Create View */}
//       {activeView === "create" && (
//         <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
//           {/* Left sidebar - Controls (full width on mobile, fixed width on desktop) */}
//           <div className="w-full md:w-80 md:border-r bg-card overflow-y-auto flex flex-col">
//             <div className="p-3 md:p-4 space-y-4 md:space-y-5 flex-1">
//               {/* Mode Selector */}
//               <div className="space-y-2">
//                 <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Modo</label>
//                 <div className="grid grid-cols-2 gap-2">
//                   {MODES.map((mode) => (
//                     <button
//                       key={mode.type}
//                       onClick={() => setSelectedMode(mode.type)}
//                       className={cn(
//                         "flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-center",
//                         selectedMode === mode.type
//                           ? "border-primary bg-primary/10 text-primary"
//                           : "border-transparent bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
//                       )}
//                     >
//                       <mode.icon className="w-5 h-5" />
//                       <span className="text-xs font-medium">{mode.label}</span>
//                     </button>
//                   ))}
//                 </div>
//               </div>
//
//               {/* Material Selector */}
//               <div className="space-y-2">
//                 <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Material</label>
//                 <div className="grid grid-cols-2 gap-2">
//                   {MATERIALS.map((mat) => (
//                     <button
//                       key={mat.type}
//                       onClick={() => setSelectedMaterial(mat.type)}
//                       className={cn(
//                         "flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-center",
//                         selectedMaterial === mat.type
//                           ? "border-primary bg-primary/10 text-primary"
//                           : "border-transparent bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
//                       )}
//                     >
//                       <mat.icon className="w-5 h-5" />
//                       <span className="text-xs font-medium">{mat.label}</span>
//                     </button>
//                   ))}
//                 </div>
//               </div>
//
//               {/* Aspect Ratio */}
//               <div className="space-y-2">
//                 <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Proporção</label>
//                 <div className="grid grid-cols-4 gap-1.5">
//                   {ASPECT_RATIOS.map((ratio) => (
//                     <button
//                       key={ratio.value}
//                       onClick={() => setSelectedRatio(ratio.value)}
//                       className={cn(
//                         "flex flex-col items-center gap-1 p-2 rounded-lg border transition-all",
//                         selectedRatio === ratio.value
//                           ? "border-primary bg-primary/10 text-primary"
//                           : "border-transparent bg-muted/50 text-muted-foreground hover:bg-muted"
//                       )}
//                     >
//                       <ratio.icon className="w-4 h-4" />
//                       <span className="text-[10px] font-medium">{ratio.label}</span>
//                     </button>
//                   ))}
//                 </div>
//               </div>
//
//               {/* Source Toggle */}
//               <div className="space-y-2">
//                 <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
//                   Referência <span className="text-muted-foreground/60 normal-case font-normal">(opcional)</span>
//                 </label>
//                 <div className="grid grid-cols-3 gap-1.5">
//                   <button
//                     onClick={() => { setSourceMode("none"); clearUpload(); setSelectedProductId(""); }}
//                     className={cn(
//                       "flex items-center justify-center gap-1.5 p-2.5 rounded-lg border transition-all text-xs font-medium",
//                       sourceMode === "none" ? "border-primary bg-primary/10 text-primary" : "border-transparent bg-muted/50 text-muted-foreground hover:bg-muted"
//                     )}
//                   >
//                     <Sparkles className="w-3.5 h-3.5" />
//                     Nenhuma
//                   </button>
//                   <button
//                     onClick={() => { setSourceMode("menu"); clearUpload(); }}
//                     className={cn(
//                       "flex items-center justify-center gap-1.5 p-2.5 rounded-lg border transition-all text-xs font-medium",
//                       sourceMode === "menu" ? "border-primary bg-primary/10 text-primary" : "border-transparent bg-muted/50 text-muted-foreground hover:bg-muted"
//                     )}
//                   >
//                     <ShoppingBag className="w-3.5 h-3.5" />
//                     Cardápio
//                   </button>
//                   <button
//                     onClick={() => { setSourceMode("upload"); setSelectedProductId(""); }}
//                     className={cn(
//                       "flex items-center justify-center gap-1.5 p-2.5 rounded-lg border transition-all text-xs font-medium",
//                       sourceMode === "upload" ? "border-primary bg-primary/10 text-primary" : "border-transparent bg-muted/50 text-muted-foreground hover:bg-muted"
//                     )}
//                   >
//                     <Upload className="w-3.5 h-3.5" />
//                     Upload
//                   </button>
//                 </div>
//               </div>
//
//               {/* Menu Product Selector */}
//               {sourceMode === "menu" && (
//                 <>
//                   <div className="space-y-2">
//                     <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Produto</label>
//                     <Select value={selectedProductId} onValueChange={setSelectedProductId}>
//                       <SelectTrigger className="bg-muted/50 border-0">
//                         <SelectValue placeholder="Escolha um produto" />
//                       </SelectTrigger>
//                       <SelectContent>
//                         {products.map((product) => (
//                           <SelectItem key={product.id} value={product.id}>
//                             <div className="flex items-center gap-2">
//                               {product.image_url && (
//                                 <img src={product.image_url} alt="" className="w-5 h-5 rounded object-cover" />
//                               )}
//                               <span className="truncate">{product.name}</span>
//                             </div>
//                           </SelectItem>
//                         ))}
//                       </SelectContent>
//                     </Select>
//                     {products.length === 0 && (
//                       <p className="text-xs text-muted-foreground">Nenhum produto cadastrado.</p>
//                     )}
//                   </div>
//
//                   {selectedProductId && (() => {
//                     const product = products.find((p) => p.id === selectedProductId);
//                     if (!product) return null;
//                     return (
//                       <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
//                         {product.image_url ? (
//                           <img src={product.image_url} alt={product.name} className="w-12 h-12 rounded-lg object-cover" />
//                         ) : (
//                           <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
//                             <ImageIcon className="w-5 h-5 text-muted-foreground" />
//                           </div>
//                         )}
//                         <div className="min-w-0 flex-1">
//                           <p className="text-sm font-medium truncate">{product.name}</p>
//                           <p className="text-xs text-muted-foreground line-clamp-1">{product.description || "Sem descrição"}</p>
//                         </div>
//                       </div>
//                     );
//                   })()}
//                 </>
//               )}
//
//               {/* Upload Reference */}
//               {sourceMode === "upload" && (
//                 <div className="space-y-2">
//                   <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Foto de referência</label>
//                   <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFileSelect} />
//                   {!uploadedFile ? (
//                     <button
//                       onClick={() => fileInputRef.current?.click()}
//                       className="w-full flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 border-dashed border-muted-foreground/25 bg-muted/30 hover:bg-muted/50 hover:border-primary/30 transition-all cursor-pointer"
//                     >
//                       <Upload className="w-6 h-6 text-muted-foreground/50" />
//                       <div className="text-center">
//                         <p className="text-xs font-medium text-muted-foreground">Clique para enviar</p>
//                         <p className="text-[10px] text-muted-foreground/60 mt-0.5">JPG, PNG, WebP · Máx 10MB</p>
//                       </div>
//                     </button>
//                   ) : (
//                     <div className="relative rounded-xl overflow-hidden bg-muted">
//                       <img src={uploadedPreview!} alt="Referência" className="w-full h-32 object-cover" />
//                       <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-foreground/60 to-transparent p-2 flex items-end justify-between">
//                         <span className="text-[10px] text-background font-medium truncate max-w-[60%]">{uploadedFile.name}</span>
//                         <button onClick={clearUpload} className="p-1 rounded-full bg-background/80 hover:bg-background transition-colors">
//                           <X className="w-3 h-3 text-foreground" />
//                         </button>
//                       </div>
//                     </div>
//                   )}
//                 </div>
//               )}
//
//               {/* Video Model Selector - only for Produto video mode */}
//               {isVideoMode && !isUGC && (
//                 <div className="space-y-2">
//                   <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Modelo de Vídeo</label>
//                   <div className="grid grid-cols-2 gap-2">
//                     {VIDEO_MODELS.map((model) => (
//                       <button
//                         key={model.value}
//                         onClick={() => setVideoModel(model.value)}
//                         className={cn(
//                           "flex flex-col items-start gap-0.5 p-3 rounded-xl border-2 transition-all text-left",
//                           videoModel === model.value ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/40"
//                         )}
//                       >
//                         <span className="text-xs font-semibold">{model.label}</span>
//                         <span className="text-[10px] text-muted-foreground">{model.description}</span>
//                         <span className="text-[10px] font-medium mt-0.5">{model.credits} créditos</span>
//                       </button>
//                     ))}
//                   </div>
//                 </div>
//               )}
//
//               {/* Video Duration */}
//               {isVideoMode && (
//                 <div className="space-y-2">
//                   <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Duração do Vídeo</label>
//                   <div className="flex items-center gap-3">
//                     <input
//                       type="range"
//                       min={5}
//                       max={10}
//                       step={1}
//                       value={videoDuration}
//                       onChange={(e) => setVideoDuration(Number(e.target.value))}
//                       className="flex-1 accent-primary"
//                     />
//                     <span className="text-sm font-semibold text-primary min-w-[40px] text-center">{videoDuration}s</span>
//                   </div>
//                   <p className="text-[10px] text-muted-foreground">Escolha entre 5 e 10 segundos.</p>
//                 </div>
//               )}
//
//               {/* Prompt */}
//               <div className="space-y-2">
//                 <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
//                   Instruções {sourceMode === "none" ? "(obrigatório)" : "(opcional)"}
//                 </label>
//                 {isUGC ? (
//                   <>
//                     <Textarea
//                       value={customPrompt}
//                       onChange={(e) => setCustomPrompt(e.target.value.slice(0, 500))}
//                       placeholder={isVideoMode
//                         ? "Descreva a cena UGC: ex: 'influenciadora provando o hambúrguer e sorrindo', 'pessoa filmando o prato no restaurante'..."
//                         : "Descreva o cenário UGC: ex: 'influenciadora sorrindo com o hambúrguer na mão', 'pessoa tirando foto do prato'..."
//                       }
//                       className="resize-none bg-muted/50 border-0 min-h-[80px]"
//                       maxLength={500}
//                     />
//                     <div className="text-[10px] text-muted-foreground mt-1 space-y-1">
//                       <p>👤 Conteúdo estilo influenciador com pessoas reais.</p>
//                       <p>✅ <strong>Funciona bem:</strong> pessoa comendo, segurando prato, selfie com comida, reação ao provar</p>
//                     </div>
//                   </>
//                 ) : isVideoMode ? (
//                   <>
//                     <Textarea
//                       value={customPrompt}
//                       onChange={(e) => setCustomPrompt(e.target.value.slice(0, 500))}
//                       placeholder="Descreva o efeito visual: ex: 'queijo derretendo com vapor subindo', 'câmera orbital mostrando texturas'..."
//                       className="resize-none bg-muted/50 border-0 min-h-[80px]"
//                       maxLength={500}
//                     />
//                     <div className="text-[10px] text-muted-foreground mt-1 space-y-1">
//                       <p>🎬 A IA traduz automaticamente para o melhor resultado.</p>
//                       <p>✅ <strong>Funciona bem:</strong> vapor, queijo derretendo, câmera se aproximando, molho escorrendo</p>
//                       <p>⚠️ <strong>Evite:</strong> pessoas, mãos, múltiplas cenas</p>
//                     </div>
//                   </>
//                 ) : (
//                   <Textarea
//                     value={customPrompt}
//                     onChange={(e) => setCustomPrompt(e.target.value.slice(0, 500))}
//                     placeholder="Descreva o que deseja: estilo, cores, cenário..."
//                     className="resize-none bg-muted/50 border-0 min-h-[80px]"
//                     maxLength={500}
//                   />
//                 )}
//                 <p className="text-[10px] text-muted-foreground text-right">{customPrompt.length}/500</p>
//               </div>
//             </div>
//
//             {/* Generate Button */}
//             <div className="p-3 md:p-4 border-t bg-card">
//               <div className="flex items-center justify-between mb-3 text-xs text-muted-foreground">
//                 <span>Custo: {currentCredits} crédito{currentCredits > 1 ? "s" : ""}</span>
//                 <span>Saldo: {credits.balance}</span>
//               </div>
//               <Button
//                 className="w-full h-11 text-sm font-semibold"
//                 onClick={handleGenerate}
//                 disabled={
//                   generating || uploadingFile ||
//                   (sourceMode === "menu" && !selectedProductId) ||
//                   (sourceMode === "upload" && !uploadedFile) ||
//                   (sourceMode === "none" && !customPrompt.trim()) ||
//                   credits.balance < currentCredits
//                 }
//               >
//                 {generating ? (
//                   <>
//                     <Loader2 className="w-4 h-4 mr-2 animate-spin" />
//                     Gerando...
//                   </>
//                 ) : (
//                   <>
//                     <Sparkles className="w-4 h-4 mr-2" />
//                     Gerar {currentMaterialLabel}
//                   </>
//                 )}
//               </Button>
//             </div>
//           </div>
//
//           {/* Right area - Preview / Results (hidden on mobile when not generating, shown on desktop always) */}
//           <div className={cn(
//             "flex-1 bg-muted/30 overflow-y-auto",
//             generating ? "block" : "hidden md:block"
//           )}>
//             {generating ? (
//               <div className="flex flex-col items-center justify-center h-full gap-4">
//                 <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
//                   <Loader2 className="w-8 h-8 text-primary animate-spin" />
//                 </div>
//                 <div className="text-center">
//                   <p className="font-medium text-foreground">Gerando {currentModeLabel} {currentMaterialLabel.toLowerCase()}...</p>
//                   <p className="text-sm text-muted-foreground mt-1">
//                     {isVideoMode ? "Isso pode levar até 2 minutos" : "Isso pode levar alguns segundos"}
//                   </p>
//                 </div>
//               </div>
//             ) : generations.length > 0 ? (
//               <div className="p-3 md:p-6">
//                 <h3 className="text-sm font-semibold text-muted-foreground mb-4">Criações recentes</h3>
//                 <div className="grid gap-3 md:gap-4 grid-cols-2 sm:grid-cols-2 lg:grid-cols-3">
//                   {generations.filter((g) => g.status === "completed" && g.result_url).slice(0, 9).map((gen) => {
//                     const displayUrl = gen.result_url;
//                     const genIsVideo = (gen.generation_type === "product_video" || gen.generation_type === "ugc_video") && displayUrl && !displayUrl.startsWith("{");
//
//                     return (
//                       <div key={gen.id} className="group relative rounded-xl overflow-hidden bg-card border shadow-sm hover:shadow-md transition-shadow">
//                         <div className="aspect-square relative overflow-hidden bg-muted">
//                           {genIsVideo && displayUrl ? (
//                             <video
//                               src={displayUrl}
//                               className="w-full h-full object-cover"
//                               muted loop playsInline
//                               onMouseEnter={(e) => (e.target as HTMLVideoElement).play()}
//                               onMouseLeave={(e) => { const v = e.target as HTMLVideoElement; v.pause(); v.currentTime = 0; }}
//                             />
//                           ) : displayUrl ? (
//                             <img src={displayUrl} alt="Generated" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
//                           ) : null}
//                           {genIsVideo && (
//                             <Badge className="absolute top-2 left-2 bg-foreground/80 text-background border-0 text-[10px]">
//                               <Film className="w-3 h-3 mr-1" />
//                               Vídeo
//                             </Badge>
//                           )}
//                           <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/40 transition-colors flex items-center justify-center">
//                             <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
//                               <Button
//                                 size="sm" variant="secondary"
//                                 onClick={() => handleDownloadMedia(displayUrl!, gen.id, !!genIsVideo)}
//                                 disabled={exportingVideo === gen.id}
//                               >
//                                 {exportingVideo === gen.id ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Download className="w-4 h-4 mr-1" />}
//                                 {genIsVideo ? "Baixar MP4" : "Baixar"}
//                               </Button>
//                             </div>
//                           </div>
//                         </div>
//                         <div className="p-3">
//                           <div className="flex items-center justify-between">
//                             <span className="text-xs font-medium">{getGenerationTypeLabel(gen.generation_type)}</span>
//                             <span className="text-[10px] text-muted-foreground">
//                               {format(new Date(gen.created_at), "dd/MM HH:mm", { locale: ptBR })}
//                             </span>
//                           </div>
//                         </div>
//                       </div>
//                     );
//                   })}
//                 </div>
//               </div>
//             ) : (
//               <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
//                 <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
//                   <Sparkles className="w-8 h-8 text-muted-foreground/40" />
//                 </div>
//                 <div>
//                   <p className="font-medium text-foreground">Crie conteúdo com IA</p>
//                   <p className="text-sm text-muted-foreground mt-1 max-w-xs">
//                     Selecione o modo, material e referência para gerar conteúdo profissional
//                   </p>
//                 </div>
//               </div>
//             )}
//           </div>
//         </div>
//       )}
//
//       {/* Gallery View */}
//       {activeView === "gallery" && (
//         <div className="flex-1 overflow-y-auto p-3 md:p-6">
//           {generations.length === 0 ? (
//             <div className="flex flex-col items-center justify-center h-full gap-4">
//               <ImageIcon className="w-12 h-12 text-muted-foreground/30" />
//               <p className="text-muted-foreground">Nenhum conteúdo gerado ainda</p>
//               <Button variant="outline" onClick={() => setActiveView("create")}>
//                 <Sparkles className="w-4 h-4 mr-2" />
//                 Criar conteúdo
//               </Button>
//             </div>
//           ) : (
//             <div className="grid gap-3 md:gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
//               {generations.map((gen) => {
//                 const displayUrl = gen.result_url;
//                 const genIsVideo = (gen.generation_type === "product_video" || gen.generation_type === "ugc_video") && displayUrl && !displayUrl.startsWith("{");
//                 const isProcessing = gen.status === "processing";
//
//                 return (
//                   <div key={gen.id} className="group relative rounded-xl overflow-hidden bg-card border shadow-sm hover:shadow-md transition-shadow">
//                     <div className="aspect-square relative overflow-hidden bg-muted">
//                       {isProcessing ? (
//                         <div className="w-full h-full flex flex-col items-center justify-center gap-2">
//                           <Loader2 className="w-6 h-6 animate-spin text-primary" />
//                           <span className="text-xs text-muted-foreground">Gerando vídeo...</span>
//                         </div>
//                       ) : genIsVideo && displayUrl ? (
//                         <video
//                           src={displayUrl}
//                           className="w-full h-full object-cover"
//                           muted loop playsInline
//                           onMouseEnter={(e) => (e.target as HTMLVideoElement).play()}
//                           onMouseLeave={(e) => { const v = e.target as HTMLVideoElement; v.pause(); v.currentTime = 0; }}
//                         />
//                       ) : displayUrl ? (
//                         <img src={displayUrl} alt="Generated" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
//                       ) : (
//                         <div className="w-full h-full flex items-center justify-center">
//                           {gen.status === "pending" ? <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /> :
//                            gen.status === "failed" ? <span className="text-xs text-destructive">Falhou</span> :
//                            <ImageIcon className="w-6 h-6 text-muted-foreground/30" />}
//                         </div>
//                       )}
//                       {genIsVideo && (
//                         <Badge className="absolute top-2 left-2 bg-foreground/80 text-background border-0 text-[10px]">
//                           <Film className="w-3 h-3 mr-1" />
//                           Vídeo
//                         </Badge>
//                       )}
//                       {displayUrl && gen.status === "completed" && (
//                         <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/40 transition-colors flex items-center justify-center">
//                           <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
//                             <Button
//                               size="sm" variant="secondary"
//                               onClick={() => handleDownloadMedia(displayUrl!, gen.id, !!genIsVideo)}
//                               disabled={exportingVideo === gen.id}
//                             >
//                               {exportingVideo === gen.id ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Download className="w-4 h-4 mr-1" />}
//                               {genIsVideo ? "Baixar MP4" : "Baixar"}
//                             </Button>
//                           </div>
//                         </div>
//                       )}
//                     </div>
//                     <div className="p-3">
//                       <div className="flex items-center justify-between">
//                         <span className="text-xs font-medium">{getGenerationTypeLabel(gen.generation_type)}</span>
//                         <div className="flex items-center gap-1.5">
//                           <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
//                             <Coins className="w-3 h-3" />
//                             {gen.credits_used}
//                           </span>
//                           <span className="text-[10px] text-muted-foreground">
//                             {format(new Date(gen.created_at), "dd/MM", { locale: ptBR })}
//                           </span>
//                         </div>
//                       </div>
//                     </div>
//                   </div>
//                 );
//               })}
//             </div>
//           )}
//         </div>
//       )}
//
//       {/* Credits View */}
//       {activeView === "credits" && (
//         <div className="flex-1 overflow-y-auto p-3 md:p-6 space-y-4 md:space-y-6">
//           <div className="grid gap-4 md:grid-cols-3">
//             <div className="p-4 rounded-xl bg-primary/10 border border-primary/20 flex items-center gap-4">
//               <div className="p-2.5 rounded-full bg-primary/20">
//                 <Coins className="w-5 h-5 text-primary" />
//               </div>
//               <div>
//                 <p className="text-xs text-muted-foreground">Disponíveis</p>
//                 <p className="text-2xl font-bold">{credits.balance}</p>
//               </div>
//             </div>
//             <div className="p-4 rounded-xl bg-muted/50 border flex items-center gap-4">
//               <div className="p-2.5 rounded-full bg-muted">
//                 <TrendingUp className="w-5 h-5 text-primary" />
//               </div>
//               <div>
//                 <p className="text-xs text-muted-foreground">Comprados</p>
//                 <p className="text-2xl font-bold">{credits.total_purchased}</p>
//               </div>
//             </div>
//             <div className="p-4 rounded-xl bg-muted/50 border flex items-center gap-4">
//               <div className="p-2.5 rounded-full bg-muted">
//                 <Zap className="w-5 h-5 text-primary" />
//               </div>
//               <div>
//                 <p className="text-xs text-muted-foreground">Utilizados</p>
//                 <p className="text-2xl font-bold">{credits.total_used}</p>
//               </div>
//             </div>
//           </div>
//
//           <div>
//             <h3 className="text-sm font-semibold mb-3">Comprar créditos</h3>
//             <div className="grid gap-4 md:grid-cols-3">
//               {CREDIT_PACKAGES.map((pkg) => (
//                 <div
//                   key={pkg.credits}
//                   className={cn(
//                     "relative p-5 rounded-xl border-2 transition-all text-center",
//                     pkg.popular ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-primary/30"
//                   )}
//                 >
//                   {pkg.popular && (
//                     <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground border-0 text-[10px]">
//                       Mais popular
//                     </Badge>
//                   )}
//                   <p className="text-sm font-semibold mb-1">{pkg.label}</p>
//                   <div className="flex items-center justify-center gap-1 mb-3">
//                     <Coins className="w-4 h-4 text-primary" />
//                     <span className="text-2xl font-bold">{pkg.credits}</span>
//                     <span className="text-xs text-muted-foreground">créditos</span>
//                   </div>
//                   <p className="text-lg font-bold mb-1">R$ {pkg.price.toFixed(2).replace(".", ",")}</p>
//                   <p className="text-[10px] text-muted-foreground mb-3">
//                     R$ {(pkg.price / pkg.credits).toFixed(2).replace(".", ",")} / crédito
//                   </p>
//                   <Button
//                     className="w-full"
//                     variant={pkg.popular ? "default" : "outline"}
//                     size="sm"
//                     onClick={() => {
//                       if (!restaurantId || !userId) return;
//                       setSelectedPackage(pkg);
//                       setPixDrawerOpen(true);
//                     }}
//                   >
//                     <Plus className="w-4 h-4 mr-1" />
//                     Comprar
//                   </Button>
//                 </div>
//               ))}
//             </div>
//           </div>
//
//           <div>
//             <h3 className="text-sm font-semibold mb-3">Histórico</h3>
//             <div className="rounded-xl border bg-card">
//               {transactions.length === 0 ? (
//                 <p className="text-sm text-muted-foreground text-center py-8">Nenhuma transação</p>
//               ) : (
//                 <div className="divide-y">
//                   {transactions.map((tx) => (
//                     <div key={tx.id} className="flex items-center justify-between px-4 py-3">
//                       <div>
//                         <p className="text-sm font-medium">{tx.description || (tx.type === "purchase" ? "Compra de créditos" : "Uso de créditos")}</p>
//                         <p className="text-xs text-muted-foreground">
//                           {format(new Date(tx.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
//                         </p>
//                       </div>
//                       <span className={cn("text-sm font-bold", tx.amount > 0 ? "text-primary" : "text-destructive")}>
//                         {tx.amount > 0 ? "+" : ""}{tx.amount}
//                       </span>
//                     </div>
//                   ))}
//                 </div>
//               )}
//             </div>
//           </div>
//         </div>
//       )}
//       {/* PIX Payment Drawer for AI Credits */}
//       {selectedPackage && restaurantId && userId && (
//         <CreditsPixDrawer
//           open={pixDrawerOpen}
//           onOpenChange={setPixDrawerOpen}
//           restaurantId={restaurantId}
//           userId={userId}
//           packageId={String(selectedPackage.credits)}
//           credits={selectedPackage.credits}
//           price={selectedPackage.price}
//           onSuccess={() => {
//             setPixDrawerOpen(false);
//             setSelectedPackage(null);
//             fetchData();
//           }}
//           generateFunction="generate-ai-credits-pix"
//           checkFunction="check-ai-credits-pix-status"
//           creditsLabel="créditos IA"
//           confirmLabel="créditos adicionados ao seu saldo."
//         />
//       )}
//     </div>
//   );
// }
//
