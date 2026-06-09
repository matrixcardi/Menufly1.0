import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Check, Upload, X, FileText, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { validateCNPJ, maskCpfCnpj } from "@/utils/cpfCnpj";
import { geocodeCep } from "@/lib/geocoding";
import { uploadCertificate, deleteCertificate, encodePassword } from "@/lib/fiscal/certificate";

interface FiscalWizardProps {
  onCancel: () => void;
  onComplete: () => void;
  initialData?: any;
}

export default function FiscalWizard({ onCancel, onComplete, initialData }: FiscalWizardProps) {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Step 1: Company Data
  const [cnpj, setCnpj] = useState(initialData?.cnpj ? maskCpfCnpj(initialData.cnpj) : "");
  const [razaoSocial, setRazaoSocial] = useState(initialData?.razao_social || "");
  const [nomeFantasia, setNomeFantasia] = useState(initialData?.nome_fantasia || "");
  const [inscricaoEstadual, setInscricaoEstadual] = useState(initialData?.inscricao_estadual || "");
  const [regimeTributario, setRegimeTributario] = useState(initialData?.regime_tributario || "simples_nacional");

  // Step 2: Address
  const [cep, setCep] = useState(initialData?.cep ? initialData.cep.replace(/(\d{5})(\d)/, "$1-$2") : "");
  const [logradouro, setLogradouro] = useState(initialData?.logradouro || "");
  const [numero, setNumero] = useState(initialData?.numero || "");
  const [complemento, setComplemento] = useState(initialData?.complemento || "");
  const [bairro, setBairro] = useState(initialData?.bairro || "");
  const [cidade, setCidade] = useState(initialData?.cidade || "");
  const [uf, setUf] = useState(initialData?.uf || "");
  const [cepLoading, setCepLoading] = useState(false);

  // Step 3: Certificate
  const [certFile, setCertFile] = useState<File | null>(null);
  const [certPassword, setCertPassword] = useState(initialData?.certificado_password || "");
  const [certUploadStatus, setCertUploadStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [certUploadError, setCertUploadError] = useState<string>("");
  const [keepCurrentCert, setKeepCurrentCert] = useState<boolean>(!!initialData?.certificado_url);

  // Step 4: Activation
  const [activateNow, setActivateNow] = useState(initialData?.is_active || false);

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

  // Certificate file validation
  const validateCertificateFile = (file: File): boolean => {
    const validExtensions = ['.pfx', '.p12'];
    const fileExtension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    
    if (!validExtensions.includes(fileExtension)) {
      toast({ title: "Arquivo inválido. Use .pfx ou .p12", variant: "destructive" });
      return false;
    }

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      toast({ title: "Arquivo muito grande. Máximo 5MB", variant: "destructive" });
      return false;
    }

    return true;
  };

  // Certificate file handler
  const handleCertificateFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (validateCertificateFile(file)) {
      setCertFile(file);
      setCertUploadStatus("success");
      setCertUploadError("");
    }
  };

  const handleRemoveCertificate = () => {
    setCertFile(null);
    setCertUploadStatus("idle");
    setCertUploadError("");
  };

  // Validation functions
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
    return true;
  };

  const validateStep2 = () => {
    const cleanCep = cep.replace(/\D/g, "");
    if (cleanCep.length !== 8) {
      toast({ title: "CEP inválido", variant: "destructive" });
      return false;
    }
    if (!numero.trim()) {
      toast({ title: "Número é obrigatório", variant: "destructive" });
      return false;
    }
    return true;
  };

  const validateStep3 = () => {
    if (keepCurrentCert) {
      return true; // Keeping existing certificate
    }
    if (!certFile && !initialData?.certificado_url) {
      toast({ title: "Certificado Digital é obrigatório", variant: "destructive" });
      return false;
    }
    if (certFile && !certPassword.trim()) {
      toast({ title: "Senha do certificado é obrigatória", variant: "destructive" });
      return false;
    }
    return true;
  };

  // Navigation
  const handleNext = () => {
    console.log("[WIZARD] Passo:", currentStep, "→ tentando avançar");

    let canProceed = true;
    if (currentStep === 1) canProceed = validateStep1();
    if (currentStep === 2) canProceed = validateStep2();
    if (currentStep === 3) canProceed = validateStep3();

    if (canProceed && currentStep < 4) {
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
    if (!validateStep1() || !validateStep2() || !validateStep3()) return;

    setLoading(true);
    console.log("[WIZARD] Salvando:", {
      cnpj,
      razaoSocial,
      nomeFantasia,
      inscricaoEstadual,
      regimeTributario,
      cep,
      logradouro,
      numero,
      complemento,
      bairro,
      cidade,
      uf,
      certFile,
      keepCurrentCert,
      activateNow,
    });

    try {
      const restaurantId = localStorage.getItem("restaurant_id");
      if (!restaurantId) {
        throw new Error("Restaurant ID não encontrado");
      }

      let certPath = initialData?.certificado_url || null;
      let certFileName = initialData?.certificado_nome_arquivo || null;
      let encodedPassword = initialData?.certificado_senha || null;

      // Upload new certificate if provided and not keeping current
      if (certFile && !keepCurrentCert) {
        setCertUploadStatus("uploading");
        try {
          console.log("[WIZARD] Uploading certificate to Storage...");
          const uploadResult = await uploadCertificate(restaurantId, certFile);
          certPath = uploadResult.path;
          certFileName = uploadResult.fileName;
          encodedPassword = encodePassword(certPassword);
          setCertUploadStatus("success");
          console.log("[WIZARD] Certificate uploaded successfully");
        } catch (error) {
          console.error("[WIZARD] Certificate upload error:", error);
          setCertUploadStatus("error");
          setCertUploadError(error instanceof Error ? error.message : "Erro ao fazer upload");
          toast({ title: "Erro ao fazer upload do certificado", variant: "destructive" });
          setLoading(false);
          return;
        }
      } else if (keepCurrentCert && initialData?.certificado_senha) {
        // Keep existing certificate, use existing password
        encodedPassword = initialData.certificado_senha;
        certFileName = initialData.certificado_nome_arquivo;
      }

      const payload = {
        restaurant_id: restaurantId,
        provider: "focus_nfe",
        environment: "production",
        cnpj: cnpj.replace(/\D/g, ""),
        razao_social: razaoSocial,
        nome_fantasia: nomeFantasia,
        inscricao_estadual: inscricaoEstadual,
        regime_tributario: regimeTributario,
        cep: cep.replace(/\D/g, ""),
        logradouro,
        numero,
        complemento,
        bairro,
        cidade,
        uf,
        certificado_url: certPath,
        certificado_senha: encodedPassword,
        certificado_nome_arquivo: certFileName,
        certificado_valido_ate: null, // Will be filled in FASE 4
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
                    <SelectItem value="lucro_presumido">Lucro Presumido</SelectItem>
                    <SelectItem value="lucro_real">Lucro Real</SelectItem>
                  </SelectContent>
                </Select>
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
              <h2 className="text-2xl font-bold mb-2">Endereço Fiscal</h2>
              <p className="text-muted-foreground">
                Informe o endereço completo da empresa conforme cadastro na SEFAZ.
              </p>
            </div>

            <div className="space-y-4">
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
                <Input
                  id="logradouro"
                  value={logradouro}
                  onChange={(e) => setLogradouro(e.target.value)}
                  placeholder="Rua, Avenida, etc."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="numero">Número *</Label>
                  <Input
                    id="numero"
                    value={numero}
                    onChange={(e) => setNumero(e.target.value)}
                    placeholder="123"
                  />
                </div>
                <div>
                  <Label htmlFor="complemento">Complemento (opcional)</Label>
                  <Input
                    id="complemento"
                    value={complemento}
                    onChange={(e) => setComplemento(e.target.value)}
                    placeholder="Apto, Sala, etc."
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="bairro">Bairro *</Label>
                  <Input
                    id="bairro"
                    value={bairro}
                    onChange={(e) => setBairro(e.target.value)}
                    placeholder="Centro"
                  />
                </div>
                <div>
                  <Label htmlFor="cidade">Cidade *</Label>
                  <Input
                    id="cidade"
                    value={cidade}
                    onChange={(e) => setCidade(e.target.value)}
                    placeholder="São Paulo"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="uf">UF *</Label>
                <Input
                  id="uf"
                  value={uf}
                  onChange={(e) => setUf(e.target.value.toUpperCase())}
                  placeholder="SP"
                  maxLength={2}
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

      case 3:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-2">Certificado Digital A1</h2>
              <p className="text-muted-foreground">
                Faça upload do arquivo do certificado digital (.pfx ou .p12).
              </p>
            </div>

            <Card className="bg-orange-50 dark:bg-orange-950/20">
              <CardContent className="pt-6">
                <p className="text-sm">
                  💡 O certificado digital é obrigatório para emissão de NFCe em produção.
                  Certifique-se de que o certificado está válido e não expirado.
                </p>
              </CardContent>
            </Card>

            {/* Show keep/replace option if editing with existing certificate */}
            {initialData?.certificado_url && (
              <div className="space-y-3">
                <Label>Certificado atual</Label>
                <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{initialData.certificado_nome_arquivo || "certificado.pfx"}</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={keepCurrentCert ? "default" : "outline"}
                    onClick={() => {
                      setKeepCurrentCert(true);
                      setCertFile(null);
                      setCertPassword("");
                    }}
                    className="flex-1"
                  >
                    Manter atual
                  </Button>
                  <Button
                    type="button"
                    variant={!keepCurrentCert ? "default" : "outline"}
                    onClick={() => {
                      setKeepCurrentCert(false);
                    }}
                    className="flex-1"
                  >
                    Substituir
                  </Button>
                </div>
              </div>
            )}

            {!keepCurrentCert && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="certFile">Arquivo do certificado (.pfx ou .p12) *</Label>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <Input
                        id="certFile"
                        type="file"
                        accept=".pfx,.p12"
                        onChange={handleCertificateFileChange}
                        className="cursor-pointer"
                        disabled={certUploadStatus === "uploading"}
                      />
                      {certFile && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleRemoveCertificate}
                          disabled={certUploadStatus === "uploading"}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                    
                    {/* Status indicator */}
                    {certUploadStatus === "idle" && !certFile && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Upload className="w-4 h-4" />
                        <span>📁 Aguardando arquivo</span>
                      </div>
                    )}
                    {certUploadStatus === "uploading" && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Upload className="w-4 h-4 animate-spin" />
                        <span>⏳ Enviando...</span>
                      </div>
                    )}
                    {certUploadStatus === "success" && certFile && (
                      <div className="flex items-center gap-2 text-sm text-green-600">
                        <Check className="w-4 h-4" />
                        <span>✅ Arquivo selecionado: {certFile.name}</span>
                      </div>
                    )}
                    {certUploadStatus === "error" && (
                      <div className="flex items-center gap-2 text-sm text-red-600">
                        <AlertCircle className="w-4 h-4" />
                        <span>❌ Erro: {certUploadError}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <Label htmlFor="certPassword">Senha do certificado *</Label>
                  <Input
                    id="certPassword"
                    type="password"
                    value={certPassword}
                    onChange={(e) => setCertPassword(e.target.value)}
                    placeholder="Senha do arquivo .pfx"
                    disabled={certUploadStatus === "uploading"}
                  />
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <Button onClick={handleBack} variant="outline">
                ← Voltar
              </Button>
              <Button onClick={handleNext} className="flex-1 bg-orange-500 hover:bg-orange-600" disabled={certUploadStatus === "uploading"}>
                Próximo →
              </Button>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-2">Confirmação e Ativação</h2>
              <p className="text-muted-foreground">
                Revise os dados antes de finalizar a configuração.
              </p>
            </div>

            <Card>
              <CardHeader>
                <h3 className="font-semibold">Resumo da Configuração</h3>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">CNPJ:</span>
                  <span className="font-medium">{cnpj}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Razão Social:</span>
                  <span className="font-medium">{razaoSocial}</span>
                </div>
                {nomeFantasia && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Nome Fantasia:</span>
                    <span className="font-medium">{nomeFantasia}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Inscrição Estadual:</span>
                  <span className="font-medium">{inscricaoEstadual}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Regime Tributário:</span>
                  <span className="font-medium">{regimeTributario.replace(/_/g, " ").toUpperCase()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Endereço:</span>
                  <span className="font-medium text-right">
                    {logradouro}, {numero} {complemento && `- ${complemento}`}<br />
                    {bairro} - {cidade}/{uf}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Certificado:</span>
                  <span className="font-medium">{certFile?.name || initialData?.certificado_url || "Nenhum"}</span>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="activateNow" className="text-base">Ativar emissão imediatamente?</Label>
                  <p className="text-sm text-muted-foreground mt-1">
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
                {loading ? "Salvando..." : "Finalizar Configuração"}
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
        {[1, 2, 3, 4].map((step) => (
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
            {step < 4 && (
              <div
                className={`w-12 h-0.5 mx-2 ${
                  step < currentStep ? "bg-orange-500" : "bg-muted"
                }`}
              />
            )}
          </div>
        ))}
      </div>
      {renderStep()}
    </div>
  );
}
