import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Zap, Rocket, MoreHorizontal } from "lucide-react";

interface ProviderSelectionProps {
  onProviderSelect: (provider: "focus_nfe" | "speed_nfe") => void;
}

export default function ProviderSelection({ onProviderSelect }: ProviderSelectionProps) {
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-3xl font-bold">🧾 Notas Fiscais Eletrônicas (NFCe)</h1>
      </div>

      {/* Introduction Card */}
      <Card className="bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800">
        <CardContent className="pt-6">
          <p className="text-lg font-medium mb-2">
            Emita notas fiscais eletrônicas diretamente pelo MenuFly!
          </p>
          <p className="text-muted-foreground mb-4">
            Conecte-se a um provedor de NFCe para começar a emitir notas legais para seus clientes.
          </p>
          <ul className="space-y-1 text-sm">
            <li className="flex items-center gap-2">
              <Check className="w-4 h-4 text-green-600" />
              Emissão automática a cada pedido
            </li>
            <li className="flex items-center gap-2">
              <Check className="w-4 h-4 text-green-600" />
              DANFE enviado ao cliente
            </li>
            <li className="flex items-center gap-2">
              <Check className="w-4 h-4 text-green-600" />
              Cancelamento e consulta de notas
            </li>
            <li className="flex items-center gap-2">
              <Check className="w-4 h-4 text-green-600" />
              Conforme exigências da SEFAZ
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Provider Selection Section */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Escolha seu provedor</h2>
        <p className="text-muted-foreground mb-6">
          Você precisa ter conta em um desses serviços. Escolha qual prefere usar:
        </p>

        {/* Grid of 3 Cards */}
        <div className="grid md:grid-cols-3 gap-4">
          {/* Focus NFe Card */}
          <Card className="bg-card border hover:border-primary transition cursor-pointer">
            <CardHeader>
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-5 h-5 text-orange-500" />
                <h3 className="font-semibold text-lg">Focus NFe</h3>
              </div>
              <p className="text-sm text-muted-foreground">API simples e bem documentada</p>
              <Badge className="w-fit bg-orange-500 hover:bg-orange-600">A partir de R$ 25/mês</Badge>
            </CardHeader>
            <CardContent className="space-y-2">
              <ul className="space-y-1 text-sm">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-600" />
                  Documentação em português
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-600" />
                  Suporte por chat
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-600" />
                  Multi-estado
                </li>
              </ul>
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <a
                href="https://focusnfe.com.br"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline"
              >
                Conhecer Focus NFe →
              </a>
              <Button
                className="w-full bg-orange-500 hover:bg-orange-600"
                onClick={() => {
                  console.log("[FISCAL] Provider escolhido:", "focus_nfe");
                  onProviderSelect("focus_nfe");
                }}
              >
                Configurar com Focus NFe
              </Button>
            </CardFooter>
          </Card>

          {/* SpeedNFe Card */}
          <Card className="bg-card border hover:border-primary transition cursor-pointer">
            <CardHeader>
              <div className="flex items-center gap-2 mb-2">
                <Rocket className="w-5 h-5 text-orange-500" />
                <h3 className="font-semibold text-lg">SpeedNFe</h3>
              </div>
              <p className="text-sm text-muted-foreground">Foco em varejo e restaurantes</p>
              <Badge className="w-fit bg-orange-500 hover:bg-orange-600">A partir de R$ 29/mês</Badge>
            </CardHeader>
            <CardContent className="space-y-2">
              <ul className="space-y-1 text-sm">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-600" />
                  Especializada em NFCe
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-600" />
                  Suporte técnico ativo
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-600" />
                  Painel intuitivo
                </li>
              </ul>
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <a
                href="https://www.speednfe.com.br"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline"
              >
                Conhecer SpeedNFe →
              </a>
              <Button
                className="w-full bg-orange-500 hover:bg-orange-600"
                onClick={() => {
                  console.log("[FISCAL] Provider escolhido:", "speed_nfe");
                  onProviderSelect("speed_nfe");
                }}
              >
                Configurar com SpeedNFe
              </Button>
            </CardFooter>
          </Card>

          {/* Em Breve Card */}
          <Card className="bg-muted border-dashed opacity-60 cursor-not-allowed">
            <CardHeader>
              <div className="flex items-center gap-2 mb-2">
                <MoreHorizontal className="w-5 h-5 text-muted-foreground" />
                <h3 className="font-semibold text-lg">Outros provedores</h3>
              </div>
              <p className="text-sm text-muted-foreground">Em breve</p>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• WebmaniaBR</li>
                <li>• NFE.io</li>
                <li>• eNotas</li>
                <li>• PlugNotas</li>
              </ul>
            </CardContent>
            <CardFooter>
              <Button disabled className="w-full">
                Em breve
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>

      {/* Footer Note */}
      <div className="text-center text-muted-foreground text-sm mt-6 space-y-1">
        <p>💡 Não tem conta em nenhum deles? Recomendamos começar pelo Focus NFe.</p>
        <p>A configuração inicial leva cerca de 15 minutos.</p>
      </div>
    </div>
  );
}
