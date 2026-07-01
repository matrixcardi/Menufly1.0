import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Check, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { validateCNPJ, maskCpfCnpj } from "@/utils/cpfCnpj";
import { geocodeCep } from "@/lib/geocoding";

interface FiscalWizardProps {
  onCancel: () => void;
  onComplete: () => void;
  initialData?: any;
}

export default function FiscalWizard({ onCancel, onComplete, initialData }: FiscalWizardProps) {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Passo 1: Dados da empresa
  const [cnpj, setCnpj] = useState(initialData?.cnpj ? maskCpfCnpj(initialData.cnpj) : "");
  const [razaoSocial, setRazaoSocial] = useState(initialData?.razao_social || "");
  const [nomeFantasia, setNomeFantasia] = useState(initialData?.nome_fantasia || "");
  const [inscricaoEstadual, setInscricaoEstadual] = useState(initialData?.inscricao_estadual || "");
  const [regimeTributario, setRegimeTributario] = useState(initialData?.regime_tributario || "simples_nacional");

  // Passo 2: Credenciais Spedy + endereço + preferências
  const [environment, setEnvironment] = useState(initialData?.environment || "production");
  const [apiKey, setApiKey] = useState("");
  const [cep, setCep] = useState(initialData?.cep ? initialData.cep.replace(/(\d{5})(\d)/, "$1-$2") : "");
  const [logradouro, setLogradouro] = useState(initialData?.logradouro || "");
  const [numero, setNumero] = useState(initialData?.numero || "");
  const [complemento, setComplemento] = useState(initialData?.complemento || "");
  const [bairro, setBairro] = useState(initialData?.bairro || "");
  const [cidade, setCidade] = useState(initialData?.cidade || "");
  const [uf, setUf] = useState(initialData?.uf || "");
  const [cepLoading, setCepLoading] = useState(false);
  const [defaultNcm, setDefaultNcm] = useState(initialData?.default_ncm || "21069090");
  const [autoIssueMode, setAutoIssueMode] = useState(initialData?.auto_issue_mode || "manual");

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

  const validateStep1 = () => {
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
    if (regimeTributario !== "simples_nacional") {
      toast({ title: "Por enquanto só oferecemos emissão para o Simples Nacional", variant: "destructive" });
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (!apiKey.trim() && !initialData?.is_configured) {
      toast({ title: "Cole a chave de API da Spedy", variant: "destructive" });
      return false;
    }
    const cleanCep = cep.replace(/\D/g, "");
    if (cleanCep.length !== 8) {
      toast({ title: "CEP inválido", variant: "destructive" });
      return false;
    }
    if (!numero.trim()) {
      toast({ title: "Número é obrigatório", variant: "destructive" });
      return false;
    }
    if (!defaultNcm.trim()) {
      toast({ title: "NCM padrão é obrigatório", variant: "destructive" });
      return false;
    }
    return true;
  };

  const handleNext = () => {
    let canProceed = true;
    if (currentStep === 1) canProceed = validateStep1();
    if (currentStep === 2) canProceed = validateStep2();

    if (canProceed && currentStep < 3) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const handleSave = async () => {
    if (!validateStep1() || !validateStep2()) return;

    setLoading(true);
    try {
      const restaurantId = localStorage.getItem("restaurant_id");
      if (!restaurantId) throw new Error("Restaurant ID não encontrado");

      const { data, error } = await supabase.functions.invoke("spedy-save-config", {
        body: {
          restaurant_id: restaurantId,
          cnpj: cnpj.replace(/\D/g, ""),
          razao_social: razaoSocial,
          nome_fantasia: nomeFantasia || null,
          inscricao_estadual: inscricaoEstadual,
          regime_tributario: regimeTributario,
          cep: cep.replace(/\D/g, ""),
          logradouro,
          numero,
          complemento: complemento || null,
          bairro,
          cidade,
          uf,
          default_ncm: defaultNcm,
          auto_issue_mode: autoIssueMode,
          api_key: apiKey.trim(),
          environment,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({ title: "✓ Configuração fiscal salva com sucesso!" });
      if (data?.webhook_warning) {
        toast({
          title: "Aviso",
          description: `Configuração salva, mas houve um problema ao registrar o webhook: ${data.webhook_warning}. Use "Reconectar Webhook" na tela de status.`,
        });
      }
      onComplete();
    } catch (error: any) {
      console.error("[WIZARD] Erro ao salvar:", error);
      toast({ title: "✗ Erro ao salvar configuração fiscal", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-2">Dados da Empresa</h2>
              <p className="text-muted-foreground">
                Informe os dados cadastrais da sua empresa para emissão de NFCe.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="cnpj">CNPJ *</Label>
                <Input
                  id="cnpj"
                  value={cnpj}
                  onChange={(e) => setCnpj(maskCpfCnpj(e.target.value))}
                  placeholder="00.000.000/0000-00"
                  maxLength={18}
                />
              </div>

              <div>
                <Label htmlFor="razaoSocial">Razão Social *</Label>
                <Input
                  id="razaoSocial"
                  value={razaoSocial}
                  onChange={(e) => setRazaoSocial(e.target.value)}
                  placeholder="Nome completo da empresa"
                />
              </div>

              <div>
                <Label htmlFor="nomeFantasia">Nome Fantasia (opcional)</Label>
                <Input
                  id="nomeFantasia"
                  value={nomeFantasia}
                  onChange={(e) => setNomeFantasia(e.target.value)}
                  placeholder="Nome comercial"
                />
              </div>

              <div>
                <Label htmlFor="inscricaoEstadual">Inscrição Estadual *</Label>
                <Input
                  id="inscricaoEstadual"
                  value={inscricaoEstadual}
                  onChange={(e) => setInscricaoEstadual(e.target.value)}
                  placeholder="Número da IE"
                />
              </div>

              <div>
                <Label htmlFor="regimeTributario">Regime Tributário *</Label>
                <Select value={regimeTributario} onValueChange={setRegimeTributario}>
                  <SelectTrigger id="regimeTributario">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="simples_nacional">Simples Nacional</SelectItem>
                    <SelectItem value="lucro_presumido" disabled>
                      Lucro Presumido (em breve)
                    </SelectItem>
                    <SelectItem value="lucro_real" disabled>
                      Lucro Real (em breve)
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Por enquanto a emissão via MenuFly só está disponível para empresas no Simples Nacional.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <Button onClick={onCancel} variant="outline">
                Cancelar
              </Button>
              <Button onClick={handleNext} className="flex-1 bg-orange-500 hover:bg-orange-600">
                Próximo →
              </Button>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-2">Credenciais Spedy</h2>
              <p className="text-muted-foreground">
                O MenuFly emite suas notas através da{" "}
                <a
                  href="https://app.spedy.com.br"
                  target="_blank"
                  rel="noreferrer"
                  className="underline inline-flex items-center gap-1"
                >
                  Spedy <ExternalLink className="w-3 h-3" />
                </a>
                . Crie sua conta lá (ou use sua conta existente), configure o certificado digital A1 e o
                token/CSC da NFC-e, e cole a chave de API abaixo (Perfil → Minha Empresa → Credenciais da API).
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="environment">Ambiente *</Label>
                <Select value={environment} onValueChange={setEnvironment}>
                  <SelectTrigger id="environment">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="production">Produção</SelectItem>
                    <SelectItem value="development">Sandbox (testes)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="apiKey">Chave de API da Spedy *</Label>
                <Input
                  id="apiKey"
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={initialData?.is_configured ? "Deixe em branco para manter a chave atual" : "Cole a chave de API aqui"}
                />
              </div>

              <div>
                <Label htmlFor="cep">CEP *</Label>
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
                <Label htmlFor="logradouro">Logradouro *</Label>
                <Input id="logradouro" value={logradouro} onChange={(e) => setLogradouro(e.target.value)} placeholder="Rua, Avenida, etc." />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="numero">Número *</Label>
                  <Input id="numero" value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="123" />
                </div>
                <div>
                  <Label htmlFor="complemento">Complemento (opcional)</Label>
                  <Input id="complemento" value={complemento} onChange={(e) => setComplemento(e.target.value)} placeholder="Apto, Sala, etc." />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="bairro">Bairro *</Label>
                  <Input id="bairro" value={bairro} onChange={(e) => setBairro(e.target.value)} placeholder="Centro" />
                </div>
                <div>
                  <Label htmlFor="cidade">Cidade *</Label>
                  <Input id="cidade" value={cidade} onChange={(e) => setCidade(e.target.value)} placeholder="São Paulo" />
                </div>
              </div>

              <div>
                <Label htmlFor="uf">UF *</Label>
                <Input id="uf" value={uf} onChange={(e) => setUf(e.target.value.toUpperCase())} placeholder="SP" maxLength={2} />
              </div>

              <div>
                <Label htmlFor="defaultNcm">NCM padrão dos itens do cardápio *</Label>
                <Input id="defaultNcm" value={defaultNcm} onChange={(e) => setDefaultNcm(e.target.value.replace(/\D/g, ""))} placeholder="21069090" maxLength={8} />
                <p className="text-xs text-muted-foreground mt-1">
                  Aplicado a todos os itens da nota. O padrão (21069090 — outras preparações alimentícias) cobre a maioria dos restaurantes.
                </p>
              </div>

              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div>
                  <Label className="text-sm">Emissão automática</Label>
                  <p className="text-xs text-muted-foreground">Emite a nota assim que o pagamento do pedido é confirmado</p>
                </div>
                <Switch checked={autoIssueMode === "automatic"} onCheckedChange={(v) => setAutoIssueMode(v ? "automatic" : "manual")} />
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

      case 3:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-2">Confirmação</h2>
              <p className="text-muted-foreground">
                Vamos validar sua chave de API com a Spedy antes de ativar a emissão.
              </p>
            </div>

            <Card>
              <CardContent className="pt-6 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">CNPJ:</span>
                  <span className="font-medium">{cnpj}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Razão Social:</span>
                  <span className="font-medium">{razaoSocial}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ambiente:</span>
                  <Badge variant={environment === "development" ? "secondary" : "default"}>
                    {environment === "development" ? "Sandbox" : "Produção"}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Endereço:</span>
                  <span className="font-medium text-right">
                    {logradouro}, {numero} {complemento && `- ${complemento}`}
                    <br />
                    {bairro} - {cidade}/{uf}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">NCM padrão:</span>
                  <span className="font-medium">{defaultNcm}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Modo de emissão:</span>
                  <span className="font-medium">{autoIssueMode === "automatic" ? "Automático" : "Manual"}</span>
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button onClick={handleBack} variant="outline">
                ← Voltar
              </Button>
              <Button onClick={handleSave} disabled={loading} className="flex-1 bg-orange-500 hover:bg-orange-600">
                {loading ? "Validando e salvando..." : "Finalizar Configuração"}
              </Button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        {[1, 2, 3].map((step) => (
          <div key={step} className="flex items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step <= currentStep ? "bg-orange-500 text-white" : "bg-muted text-muted-foreground"
              }`}
            >
              {step < currentStep ? <Check className="w-4 h-4" /> : step}
            </div>
            {step < 3 && <div className={`w-16 h-0.5 mx-2 ${step < currentStep ? "bg-orange-500" : "bg-muted"}`} />}
          </div>
        ))}
      </div>
      {renderStep()}
    </div>
  );
}
