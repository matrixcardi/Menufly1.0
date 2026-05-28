import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { MessageCircle, Zap, ShoppingCart, Crown } from "lucide-react";
import { useWhatsappCredits } from "@/hooks/useWhatsappCredits";
import { useSubscriptionPlan } from "@/hooks/useSubscriptionPlan";
import { CreditsPixDrawer } from "./CreditsPixDrawer";

interface WhatsappCreditsCardProps {
  restaurantId: string | null;
  userId: string | undefined;
}

const packages = [
  { id: "1000", credits: 1000, price: 19.90, popular: false },
  { id: "3000", credits: 3000, price: 49.90, popular: true },
  { id: "5000", credits: 5000, price: 79.90, popular: false },
];

export default function WhatsappCreditsCard({ restaurantId, userId }: WhatsappCreditsCardProps) {
  const { credits, loading, refetch } = useWhatsappCredits(restaurantId);
  const { isElite } = useSubscriptionPlan(userId);
  const [buyDialogOpen, setBuyDialogOpen] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<typeof packages[0] | null>(null);
  const [pixDrawerOpen, setPixDrawerOpen] = useState(false);

  const handlePurchase = (pkg: typeof packages[0]) => {
    if (!restaurantId || !userId) return;
    setSelectedPackage(pkg);
    setBuyDialogOpen(false);
    setPixDrawerOpen(true);
  };

  const handlePaymentSuccess = () => {
    setPixDrawerOpen(false);
    setSelectedPackage(null);
    refetch();
  };



  if (loading) return null;

  const usagePercent = credits.balance > 0 && (credits.totalUsed + credits.balance) > 0
    ? Math.round((credits.totalUsed / (credits.totalUsed + credits.balance)) * 100)
    : 0;

  return (
    <>
      <Card className="border-green-200 dark:border-green-900">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-green-600" />
              Créditos de Mensagens
            </span>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs h-7 border-green-300 text-green-700 hover:bg-green-50 dark:border-green-800 dark:text-green-400 dark:hover:bg-green-950"
              onClick={() => setBuyDialogOpen(true)}
            >
              <ShoppingCart className="w-3 h-3" />
              Comprar
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                {credits.balance.toLocaleString("pt-BR")}
              </p>
              <p className="text-xs text-muted-foreground">mensagens disponíveis</p>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <p>{credits.totalUsed.toLocaleString("pt-BR")} usadas</p>
              <p>{credits.totalPurchased.toLocaleString("pt-BR")} total adquirido</p>
            </div>
          </div>

          {(credits.totalUsed + credits.balance) > 0 && (
            <div>
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>Uso</span>
                <span>{usagePercent}%</span>
              </div>
              <Progress value={usagePercent} className="h-1.5" />
            </div>
          )}

          {isElite && (
            <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-2 py-1.5 rounded-md">
              <Crown className="w-3 h-3" />
              Plano Elite: 1.000 mensagens grátis/mês (acumulam)
            </div>
          )}
        </CardContent>
      </Card>

      {/* Buy Credits Dialog */}
      <Dialog open={buyDialogOpen} onOpenChange={setBuyDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-green-600" />
              Comprar Mensagens
            </DialogTitle>
            <DialogDescription>
              Escolha um pacote para enviar campanhas pelo WhatsApp
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {packages.map((pkg) => (
              <div
                key={pkg.id}
                className={`relative p-4 rounded-lg border-2 transition-colors cursor-pointer ${
                  pkg.popular
                    ? "border-green-500 bg-green-50/50 dark:bg-green-950/20"
                    : "border-border hover:border-green-300"
                }`}
                onClick={() => handlePurchase(pkg)}
              >
                {pkg.popular && (
                  <Badge className="absolute -top-2 right-3 bg-green-600 text-[10px]">
                    Mais Popular
                  </Badge>
                )}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-lg">
                      {pkg.credits.toLocaleString("pt-BR")} mensagens
                    </p>
                    <p className="text-xs text-muted-foreground">
                      R$ {(pkg.price / pkg.credits * 1000).toFixed(2).replace(".", ",")} por 1.000 msgs
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-green-600">
                      R$ {pkg.price.toFixed(2).replace(".", ",")}
                    </p>
                  </div>
                </div>
                <Button
                  className="w-full mt-3 bg-green-600 hover:bg-green-700"
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePurchase(pkg);
                  }}
                >
                  Comprar
                </Button>
              </div>
            ))}
          </div>

          <DialogFooter>
            <p className="text-xs text-muted-foreground text-center w-full">
              Pagamento via PIX com confirmação automática.
            </p>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PIX Payment Drawer */}
      {selectedPackage && restaurantId && userId && (
        <CreditsPixDrawer
          open={pixDrawerOpen}
          onOpenChange={setPixDrawerOpen}
          restaurantId={restaurantId}
          userId={userId}
          packageId={selectedPackage.id}
          credits={selectedPackage.credits}
          price={selectedPackage.price}
          onSuccess={handlePaymentSuccess}
        />
      )}
    </>
  );
}
