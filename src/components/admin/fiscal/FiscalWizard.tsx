import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Check, Eye, EyeOff, ChevronRight, HelpCircle, Upload, ArrowRight, ExternalLink } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { validateCNPJ, maskCpfCnpj } from "@/utils/cpfCnpj";
import { geocodeCep } from "@/lib/geocoding";

interface FiscalWizardProps {
  provider: "focus_nfe" | "speed_nfe";
  onCancel: () => void;
  onComplete: () => void;
  initialData?: any;
}

export default function FiscalWizard({ provider, onCancel, onComplete, initialData }: FiscalWizardProps) {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showToken, setShowToken] = useState(false);

  // Step 2: API Credentials
  const [apiToken, setApiToken] = useState(initialData?.api_token || "");
  const [environment, setEnvironment] = useState<"homologation" | "production">(initialData?.environment || "homologation");

  // Step 3: Company Data
  const [cnpj, setCnpj] = useState(initialData?.cnpj ? maskCpfCnpj(initialData.cnpj) : "");
  const [razaoSocial, setRazaoSocial] = useState(initialData?.razao_social || "");
  const [nomeFantasia, setNomeFantasia] = useState(initialData?.nome_fantasia || "");
  const [inscricaoEstadual, setInscricaoEstadual] = useState(initialData?.inscricao_estadual || "");
  const [regimeTributario, setRegimeTributario] = useState(initialData?.regime_tributario || "simples_nacional");

  // Step 4: Address
  const [cep, setCep] = useState(initialData?.cep ? initialData.cep.replace(/(\d{5})(\d)/, "$1-$2") : "");
  const [logradouro, setLogradouro] = useState(initialData?.logradouro || "");
  const [numero, setNumero] = useState(initialData?.numero || "");
  const [bairro, setBairro] = useState(initialData?.bairro || "");
  const [cidade, setCidade] = useState(initialData?.cidade || "");
  const [uf, setUf] = useState(initialData?.uf || "");
  const [codigoIbge, setCodigoIbge] = useState(initialData?.codigo_ibge || "");
  const [cepLoading, setCepLoading] = useState(false);

  // Step 5: Fiscal Settings
  const [csosn, setCsosn] = useState(initialData?.csosn || "102");
  const [cfop, setCfop] = useState(initialData?.cfop || "5102");
  const [serie, setSerie] = useState(initialData?.serie ? String(initialData.serie) : "1");

  // Step 6: Certificate (optional)
  const [certFile, setCertFile] = useState<File | null>(null);
  const [certPassword, setCertPassword] = useState(initialData?.certificado_password || "");

  // Step 7: Activation
  const [activateNow, setActivateNow] = useState(initialData?.is_active || false);

  const providerName = provider === "focus_nfe" ? "Focus NFe" : "SpeedNFe";
  const providerUrl = provider === "focus_nfe" ? "https://focusnfe.com.br" : "https://www.speednfe.com.br";

  // CEP lookup
  const handleCepLookup = async () => {
    const cleanCep = cep.replace(/\D/g, "");
    if (cleanCep.length !== 8) {
      toast({ title: "CEP inválido", variant: "destructive" });
      return;
    }

    setCepLoading(true);
    try {
      const result = await geocodeCep(cleanCep);
      if (result.success && result.address) {
        setLogradouro(result.address.street || "");
        setBairro(result.address.neighborhood || "");
        setCidade(result.address.city || "");
        setUf(result.address.state || "");
        toast({ title: "Endereço encontrado com sucesso!" });
      } else {
        toast({ title: "CEP não encontrado", variant: "destructive" });
      }
    } catch (error) {
      console.error("CEP lookup error:", error);
      toast({ title: "Erro ao buscar CEP", variant: "destructive" });
    } finally {
      setCepLoading(false);
    }
  };

  // Validation functions
  const validateStep2 = () => {
    if (apiToken.length < 20) {
      toast({ title: "Token deve ter no mínimo 20 caracteres", variant: "destructive" });
      return false;
    }
    if (!environment) {
      toast({ title: "Selecione o ambiente", variant: "destructive" });
      return false;
    }
    return true;
  };

  const validateStep3 = () => {
    const cleanCnpj = cnpj.replace(/\D/g, "");
    if (!validateCNPJ(cleanCnpj)) {
      toast({ title: "CNPJ inválido", variant: "destructive" });
      return false;
    }
    if (!razaoSocial.trim()) {
      toast({ title: "Razão Social é obrigatória", variant: "destructive" });
      return false;
    }
    if (!inscricaoEstadual.trim()) {
      toast({ title: "Inscrição Estadual é obrigatória", variant: "destructive" });
      return false;
    }
    return true;
  };

  const validateStep4 = () => {
    const cleanCep = cep.replace(/\D/g, "");
    if (cleanCep.length !== 8) {
      toast({ title: "CEP inválido", variant: "destructive" });
      return false;
    }
    if (!numero.trim()) {
      toast({ title: "Número é obrigatório", variant: "destructive" });
      return false;
    }
    if (codigoIbge.length !== 7) {
      toast({ title: "Código IBGE deve ter 7 dígitos", variant: "destructive" });
      return false;
    }
    return true;
  };

  const validateStep5 = () => {
    if (!csosn.trim()) {
      toast({ title: "CSOSN é obrigatório", variant: "destructive" });
      return false;
    }
    if (!cfop.trim()) {
      toast({ title: "CFOP é obrigatório", variant: "destructive" });
      return false;
    }
    if (parseInt(serie) < 1) {
      toast({ title: "Série deve ser maior que 0", variant: "destructive" });
      return false;
    }
    return true;
  };

  const validateStep7 = () => {
    return validateStep2() && validateStep3() && validateStep4() && validateStep5();
  };

  // Navigation
  const handleNext = () => {
    console.log("[WIZARD] Passo:", currentStep, "→ tentando avançar");

    let canProceed = true;
    if (currentStep === 2) canProceed = validateStep2();
    if (currentStep === 3) canProceed = validateStep3();
    if (currentStep === 4) canProceed = validateStep4();
    if (currentStep === 5) canProceed = validateStep5();

    if (canProceed && currentStep < 7) {
      setCurrentStep(currentStep + 1);
      console.log("[WIZARD] Passo:", currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      console.log("[WIZARD] Passo:", currentStep - 1);
    }
  };

  // Save to database
  const handleSave = async () => {
    if (!validateStep7()) return;

    setLoading(true);
    console.log("[WIZARD] Salvando:", {
      provider,
      environment,
      cnpj,
      razaoSocial,
      nomeFantasia,
      inscricaoEstadual,
      regimeTributario,
      cep,
      logradouro,
      numero,
      bairro,
      cidade,
      uf,
      codigoIbge,
      csosn,
      cfop,
      serie,
      activateNow,
    });

    try {
      const restaurantId = localStorage.getItem("restaurant_id");
      if (!restaurantId) {
        throw new Error("Restaurant ID não encontrado");
      }

      const payload = {
        restaurant_id: restaurantId,
        provider,
        environment,
        api_token: apiToken,
        cnpj: cnpj.replace(/\D/g, ""),
        razao_social: razaoSocial,
        nome_fantasia: nomeFantasia,
        inscricao_estadual: inscricaoEstadual,
        regime_tributario: regimeTributario,
        cep: cep.replace(/\D/g, ""),
        logradouro,
        numero,
        bairro,
        cidade,
        uf,
        codigo_ibge: codigoIbge,
        csosn,
        cfop,
        serie: parseInt(serie),
        certificado_file: certFile?.name || null,
        certificado_password: certPassword || null,
        is_configured: true,
        is_active: activateNow,
      };

      const { error } = await supabase
        .from("fiscal_config")
        .upsert(payload, {
          onConflict: "restaurant_id",
          ignoreDuplicates: false,
        });

      if (error) throw error;

      console.log("[WIZARD] Salvo com sucesso!");
      toast({ title: "✓ Configuração fiscal salva com sucesso!" });
      onComplete();
    } catch (error) {
      console.error("[WIZARD] Erro ao salvar:", error);
      toast({ title: "✗ Erro ao salvar configuração fiscal", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Stepper component
  const Stepper = () => (
    <div className="flex items-center justify-between mb-8">
      {[1, 2, 3, 4, 5, 6, 7].map((step) => (
        <div key={step} className="flex items-center">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              step <= currentStep
                ? "bg-orange-500 text-white"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {step < currentStep ? <Check className="w-4 h-4" /> : step}
          </div>
          {step < 7 && (
            <div
              className={`w-12 h-0.5 mx-2 ${
                step < currentStep ? "bg-orange-500" : "bg-muted"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );

  // Step 1: Introduction
  const Step1 = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Vamos começar! 🚀</h2>
        <p className="text-muted-foreground">
          Vamos configurar a emissão de notas fiscais com {providerName}. Esse processo leva cerca de 15 minutos.
        </p>
      </div>

      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <p className="font-medium mb-4">Você vai precisar de:</p>
          <ul className="space-y-2">
            <li className="flex items-center gap-2">
              <Check className="w-4 h-4 text-green-600" />
              Sua conta no {providerName} (criar agora se não tiver)
            </li>
            <li className="flex items-center gap-2">
              <Check className="w-4 h-4 text-green-600" />
              CNPJ ativo da sua empresa
            </li>
            <li className="flex items-center gap-2">
              <Check className="w-4 h-4 text-green-600" />
              Inscrição Estadual ativa
            </li>
            <li className="flex items-center gap-2">
              <Check className="w-4 h-4 text-green-600" />
              Certificado Digital A1 (opcional para testes)
            </li>
          </ul>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button onClick={handleNext} className="flex-1 bg-orange-500 hover:bg-orange-600">
          Já tenho conta
        </Button>
        <Button
          onClick={() => {
            window.open(providerUrl, "_blank");
            handleNext();
          }}
          variant="outline"
          className="flex-1"
        >
          Criar conta agora <ExternalLink className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );

  // Step 2: API Credentials
  const Step2 = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Cole seu token de API do {providerName}</h2>
      </div>

      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <p className="font-medium mb-4">Como obter seu token:</p>
          <ol className="space-y-2 list-decimal list-inside text-sm">
            {provider === "focus_nfe" ? (
              <>
                <li>Acesse sua conta no Focus NFe</li>
                <li>Vá em "Configurações" → "API"</li>
                <li>Clique em "Gerar novo token"</li>
                <li>Copie o token gerado</li>
              </>
            ) : (
              <>
                <li>Acesse sua conta no SpeedNFe</li>
                <li>Vá em "Integrações" → "API"</li>
                <li>Clique em "Criar token de acesso"</li>
                <li>Copie o token gerado</li>
              </>
            )}
          </ol>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div>
          <Label htmlFor="apiToken">API Token</Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                id="apiToken"
                type={showToken ? "text" : "password"}
                value={apiToken}
                onChange={(e) => setApiToken(e.target.value)}
                placeholder="Cole seu token aqui"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        <div>
          <Label>Ambiente</Label>
          <RadioGroup value={environment} onValueChange={(v: any) => setEnvironment(v)}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="homologation" id="homologation" />
              <Label htmlFor="homologation">Homologação (teste)</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="production" id="production" />
              <Label htmlFor="production">Produção</Label>
            </div>
          </RadioGroup>
        </div>

        <div className="bg-orange-50 dark:bg-orange-950/20 p-3 rounded-lg text-sm">
          💡 Em homologação você pode testar sem custo. Notas emitidas não valem fiscalmente.
        </div>
      </div>

      <div className="flex gap-3">
        <Button onClick={handleBack} variant="outline">
          ← Voltar
        </Button>
        <Button onClick={handleNext} className="flex-1 bg-orange-500 hover:bg-orange-600" disabled={apiToken.length < 20}>
          Próximo →
        </Button>
      </div>
    </div>
  );

  // Step 3: Company Data
  const Step3 = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Dados da sua empresa</h2>
      </div>

      <div className="space-y-4">
        <div>
          <Label htmlFor="cnpj">CNPJ</Label>
          <Input
            id="cnpj"
            value={cnpj}
            onChange={(e) => setCnpj(maskCpfCnpj(e.target.value))}
            placeholder="00.000.000/0000-00"
            maxLength={18}
          />
        </div>

        <div>
          <Label htmlFor="razaoSocial">Razão Social</Label>
          <Input
            id="razaoSocial"
            value={razaoSocial}
            onChange={(e) => setRazaoSocial(e.target.value)}
            placeholder="Nome completo da empresa"
          />
        </div>

        <div>
          <Label htmlFor="nomeFantasia">Nome Fantasia</Label>
          <Input
            id="nomeFantasia"
            value={nomeFantasia}
            onChange={(e) => setNomeFantasia(e.target.value)}
            placeholder="Nome comercial"
          />
        </div>

        <div>
          <Label htmlFor="inscricaoEstadual">Inscrição Estadual</Label>
          <Input
            id="inscricaoEstadual"
            value={inscricaoEstadual}
            onChange={(e) => setInscricaoEstadual(e.target.value)}
            placeholder="Número da IE"
          />
        </div>

        <div>
          <Label htmlFor="regimeTributario">Regime Tributário</Label>
          <Select value={regimeTributario} onValueChange={setRegimeTributario}>
            <SelectTrigger id="regimeTributario">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="simples_nacional">Simples Nacional</SelectItem>
              <SelectItem value="lucro_presumido">Lucro Presumido</SelectItem>
              <SelectItem value="lucro_real">Lucro Real</SelectItem>
              <SelectItem value="mei">MEI</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex gap-3">
        <Button onClick={handleBack} variant="outline">
          ← Voltar
        </Button>
        <Button onClick={handleNext} className="flex-1 bg-orange-500 hover:bg-orange-600">
          Próximo →
        </Button>
      </div>
    </div>
  );

  // Step 4: Address
  const Step4 = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Endereço da empresa</h2>
      </div>

      <div className="space-y-4">
        <div>
          <Label htmlFor="cep">CEP</Label>
          <div className="flex gap-2">
            <Input
              id="cep"
              value={cep}
              onChange={(e) => setCep(e.target.value.replace(/\D/g, "").replace(/(\d{5})(\d)/, "$1-$2"))}
              placeholder="00000-000"
              maxLength={9}
            />
            <Button onClick={handleCepLookup} disabled={cepLoading || cep.replace(/\D/g, "").length !== 8} variant="outline">
              {cepLoading ? "Buscando..." : "Buscar"}
            </Button>
          </div>
        </div>

        <div>
          <Label htmlFor="logradouro">Logradouro</Label>
          <Input
            id="logradouro"
            value={logradouro}
            onChange={(e) => setLogradouro(e.target.value)}
            placeholder="Rua, Avenida, etc."
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="numero">Número</Label>
            <Input
              id="numero"
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
              placeholder="123"
            />
          </div>
          <div>
            <Label htmlFor="bairro">Bairro</Label>
            <Input
              id="bairro"
              value={bairro}
              onChange={(e) => setBairro(e.target.value)}
              placeholder="Centro"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="cidade">Cidade</Label>
            <Input
              id="cidade"
              value={cidade}
              onChange={(e) => setCidade(e.target.value)}
              placeholder="São Paulo"
            />
          </div>
          <div>
            <Label htmlFor="uf">UF</Label>
            <Input
              id="uf"
              value={uf}
              onChange={(e) => setUf(e.target.value.toUpperCase())}
              placeholder="SP"
              maxLength={2}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="codigoIbge" className="flex items-center gap-2">
            Código IBGE do município
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <HelpCircle className="w-4 h-4" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Encontre em ibge.gov.br/explica/codigos-dos-municipios.php</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </Label>
          <Input
            id="codigoIbge"
            value={codigoIbge}
            onChange={(e) => setCodigoIbge(e.target.value.replace(/\D/g, ""))}
            placeholder="3550308"
            maxLength={7}
          />
        </div>
      </div>

      <div className="flex gap-3">
        <Button onClick={handleBack} variant="outline">
          ← Voltar
        </Button>
        <Button onClick={handleNext} className="flex-1 bg-orange-500 hover:bg-orange-600">
          Próximo →
        </Button>
      </div>
    </div>
  );

  // Step 5: Fiscal Settings
  const Step5 = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Configurações fiscais</h2>
      </div>

      <div className="space-y-4">
        <div>
          <Label htmlFor="csosn" className="flex items-center gap-2">
            CSOSN padrão
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <HelpCircle className="w-4 h-4" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Código de Situação da Operação - Simples Nacional</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </Label>
          <Input
            id="csosn"
            value={csosn}
            onChange={(e) => setCsosn(e.target.value)}
            placeholder="102"
          />
        </div>

        <div>
          <Label htmlFor="cfop" className="flex items-center gap-2">
            CFOP padrão
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <HelpCircle className="w-4 h-4" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>5102 = Venda dentro do estado</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </Label>
          <Input
            id="cfop"
            value={cfop}
            onChange={(e) => setCfop(e.target.value)}
            placeholder="5102"
          />
        </div>

        <div>
          <Label htmlFor="serie">Série da NFCe</Label>
          <Input
            id="serie"
            type="number"
            value={serie}
            onChange={(e) => setSerie(e.target.value)}
            placeholder="1"
            min="1"
          />
        </div>

        <div className="bg-orange-50 dark:bg-orange-950/20 p-3 rounded-lg text-sm">
          💡 Se não tiver certeza, mantenha os valores padrão. Sua contabilidade pode te orientar.
        </div>
      </div>

      <div className="flex gap-3">
        <Button onClick={handleBack} variant="outline">
          ← Voltar
        </Button>
        <Button onClick={handleNext} className="flex-1 bg-orange-500 hover:bg-orange-600">
          Próximo →
        </Button>
      </div>
    </div>
  );

  // Step 6: Certificate (optional)
  const Step6 = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Certificado Digital (opcional)</h2>
      </div>

      <Card className="bg-orange-50 dark:bg-orange-950/20">
        <CardContent className="pt-6">
          <p className="text-sm">
            💡 O certificado é necessário apenas para emissão em PRODUÇÃO. Para testes (homologação), você pode pular esse passo.
          </p>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div>
          <Label htmlFor="certFile">Arquivo do certificado (.pfx)</Label>
          <div className="flex items-center gap-3">
            <Input
              id="certFile"
              type="file"
              accept=".pfx"
              onChange={(e) => setCertFile(e.target.files?.[0] || null)}
              className="cursor-pointer"
            />
            {certFile && <Badge variant="secondary">{certFile.name}</Badge>}
          </div>
        </div>

        <div>
          <Label htmlFor="certPassword">Senha do certificado</Label>
          <Input
            id="certPassword"
            type="password"
            value={certPassword}
            onChange={(e) => setCertPassword(e.target.value)}
            placeholder="Senha do arquivo .pfx"
          />
        </div>
      </div>

      <div className="flex gap-3">
        <Button onClick={handleBack} variant="outline">
          ← Voltar
        </Button>
        <Button onClick={() => setCurrentStep(7)} variant="outline" className="flex-1">
          Pular por enquanto
        </Button>
        <Button onClick={handleNext} className="bg-orange-500 hover:bg-orange-600">
          Próximo →
        </Button>
      </div>
    </div>
  );

  // Step 7: Summary and Activation
  const Step7 = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Resumo e Ativação</h2>
      </div>

      <Card>
        <CardHeader>
          <h3 className="font-semibold">Resumo da Configuração</h3>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Provider:</span>
            <span className="font-medium">{providerName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Ambiente:</span>
            <span className="font-medium">{environment === "homologation" ? "Homologação" : "Produção"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">CNPJ:</span>
            <span className="font-medium">{cnpj}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Razão Social:</span>
            <span className="font-medium">{razaoSocial}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Endereço:</span>
            <span className="font-medium text-right">
              {logradouro}, {numero} - {bairro}<br />
              {cidade} - {uf}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Regime:</span>
            <span className="font-medium">{regimeTributario.replace(/_/g, " ").toUpperCase()}</span>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="activateNow" className="text-base">Ativar emissão de NFCe agora?</Label>
            <p className="text-sm text-muted-foreground mt-1">
              Quando ativado, os botões "Emitir NFe" nos pedidos ficarão habilitados.
              Você pode desativar a qualquer momento nas configurações.
            </p>
          </div>
          <Switch id="activateNow" checked={activateNow} onCheckedChange={setActivateNow} />
        </div>
      </div>

      <div className="flex gap-3">
        <Button onClick={handleBack} variant="outline">
          ← Voltar
        </Button>
        <Button onClick={handleSave} disabled={loading} className="flex-1 bg-orange-500 hover:bg-orange-600">
          {loading ? "Salvando..." : "Salvar e Concluir"}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto">
      <Stepper />
      {currentStep === 1 && <Step1 />}
      {currentStep === 2 && <Step2 />}
      {currentStep === 3 && <Step3 />}
      {currentStep === 4 && <Step4 />}
      {currentStep === 5 && <Step5 />}
      {currentStep === 6 && <Step6 />}
      {currentStep === 7 && <Step7 />}
    </div>
  );
}
