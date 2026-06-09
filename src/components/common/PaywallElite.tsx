import { Lock, Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";

interface PaywallEliteProps {
  featureName: string;
  featureDescription: string;
  featureBullets: string[];
}

export const PaywallElite = ({
  featureName,
  featureDescription,
  featureBullets,
}: PaywallEliteProps) => {
  const navigate = useNavigate();

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <Card className="p-8 border-2 border-amber-500/20 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20">
        <div className="flex flex-col items-center text-center space-y-6">
          <div className="rounded-full bg-amber-500/10 p-4 relative">
            <Lock className="w-12 h-12 text-amber-600" />
            <Sparkles className="w-5 h-5 text-amber-500 absolute -top-1 -right-1" />
          </div>

          <div>
            <h2 className="text-2xl font-bold mb-2">
              Funcionalidade Exclusiva Elite
            </h2>
            <h3 className="text-xl font-semibold text-foreground">
              {featureName}
            </h3>
          </div>

          <p className="text-muted-foreground max-w-md">
            {featureDescription}
          </p>

          <ul className="space-y-2 text-left w-full max-w-sm">
            {featureBullets.map((bullet, i) => (
              <li key={i} className="flex items-start gap-2">
                <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <span>{bullet}</span>
              </li>
            ))}
          </ul>

          <div className="pt-4 border-t w-full">
            <p className="text-sm text-muted-foreground mb-2">
              Disponível no plano
            </p>
            <p className="text-3xl font-bold text-amber-600 mb-1">
              MenuFly Elite
            </p>
            <p className="text-lg text-muted-foreground mb-6">
              R$ 160/mês
            </p>

            <Button
              size="lg"
              className="w-full bg-amber-600 hover:bg-amber-700"
              onClick={() => navigate("/checkout")}
            >
              Fazer Upgrade Agora →
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};
