import { Receipt, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface FiscalWelcomeProps {
  onConfigure: () => void;
}

export const FiscalWelcome = ({ onConfigure }: FiscalWelcomeProps) => {
  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <Card className="p-8 border-2 border-amber-500/20 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20">
        <div className="flex flex-col items-center text-center space-y-6">
          <div className="rounded-full bg-amber-500/10 p-4">
            <Receipt className="w-12 h-12 text-amber-600" />
          </div>

          <div>
            <h2 className="text-2xl font-bold mb-2">
              Emita NFCe direto pelo MenuFly
            </h2>
            <p className="text-muted-foreground">
              Sem complicação, sem outras contas
            </p>
          </div>

          <ul className="space-y-2 text-left w-full max-w-sm">
            <li className="flex items-start gap-2">
              <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <span className="text-sm">CNPJ ativo da empresa</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <span className="text-sm">Inscrição Estadual ativa</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <span className="text-sm">Certificado Digital A1 (.pfx)</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <span className="text-sm">5 minutos do seu tempo</span>
            </li>
          </ul>

          <Button
            size="lg"
            className="w-full bg-amber-600 hover:bg-amber-700"
            onClick={onConfigure}
          >
            Configurar Agora →
          </Button>
        </div>
      </Card>
    </div>
  );
};
