import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, CheckCircle2, AlertCircle, Lock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { maskCpfCnpj, validateCPF } from "@/utils/cpfCnpj";
import { formatPhone } from "@/lib/validations";
import { logger } from "@/lib/logger";
import { extractEdgeFunctionError } from "@/lib/edge-function-error";
import type { FastSoftCardData } from "@/types/fastsoft";

interface Props {
  plan: "start" | "elite";
  planLabel: string;
  /** Total em centavos, já incluindo o order bump quando marcado. */
  amountCents: number;
  includeImplementation: boolean;
  onActivated: () => void;
}

type Status = "form" | "processing" | "approved" | "failed";

// Host novo da HyperCash. Substitui js.fastsoftbrasil.com (ainda no ar e ainda
// citado na doc): mesma superfície de API, mas tokeniza contra o backend atual.
const SDK_SRC = "https://js.hypercash.com.br/security.js";
const SDK_ID = "fastsoft-sdk-script";

// Cartão autoriza em 1–5s e confirma em até 30s; damos folga antes de desistir.
const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 120000;

const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

export default function HyperCashCardForm({
  plan, planLabel, amountCents, includeImplementation, onActivated,
}: Props) {
  const [sdkReady, setSdkReady] = useState(false);
  const [sdkError, setSdkError] = useState<string | null>(null);
  const [threeDSEnabled, setThreeDSEnabled] = useState(false);
  const [status, setStatus] = useState<Status>("form");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [cardNumber, setCardNumber] = useState("");
  const [holderName, setHolderName] = useState("");
  const [expMonth, setExpMonth] = useState("");
  const [expYear, setExpYear] = useState("");
  const [cvv, setCvv] = useState("");
  const [cpf, setCpf] = useState("");
  const [phone, setPhone] = useState("");

  // Endereço só é exigido pelo fluxo 3DS.
  const [cep, setCep] = useState("");
  const [street, setStreet] = useState("");
  const [streetNumber, setStreetNumber] = useState("");
  const [complement, setComplement] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [cepLoading, setCepLoading] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollStartRef = useRef<number>(0);

  const publicKey = import.meta.env.VITE_HYPERCASH_PUBLIC_KEY as string | undefined;

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 15 }, (_, i) => String(currentYear + i));

  const formatCurrency = (cents: number) =>
    (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  // Carrega o SDK da FastSoft (tokenização acontece no browser: o número do
  // cartão nunca passa pelo nosso backend).
  useEffect(() => {
    if (!publicKey) {
      setSdkError("Chave pública da HyperCash não configurada.");
      return;
    }

    const init = () => {
      const FastSoft = window.FastSoft;
      if (!FastSoft) {
        setSdkError("Não foi possível carregar o processador de pagamento.");
        return;
      }
      try {
        FastSoft.setPublicKey(publicKey);
        setThreeDSEnabled(
          typeof FastSoft.isThreeDSEnabled === "function" ? !!FastSoft.isThreeDSEnabled() : false,
        );
        setSdkReady(true);
      } catch (err) {
        logger.error("Falha ao inicializar SDK HyperCash", { err });
        setSdkError("Não foi possível iniciar o pagamento com cartão.");
      }
    };

    const existing = document.getElementById(SDK_ID);
    if (existing) {
      if (window.FastSoft) init();
      else existing.addEventListener("load", init, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = SDK_ID;
    script.src = SDK_SRC;
    script.async = true;
    script.onload = init;
    script.onerror = () => setSdkError("Não foi possível carregar o processador de pagamento.");
    document.head.appendChild(script);
  }, [publicKey]);

  useEffect(() => () => {
    if (pollRef.current) clearInterval(pollRef.current);
  }, []);

  // ViaCEP direto: para endereço de cobrança não queremos a dependência de
  // geocodificação do lib/geocoding, que falha quando o Nominatim não resolve.
  const handleCepBlur = async () => {
    const digits = cep.replace(/\D/g, "");
    if (digits.length !== 8) return;
    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setStreet(data.logradouro || "");
        setNeighborhood(data.bairro || "");
        setCity(data.localidade || "");
        setState(data.uf || "");
      }
    } catch {
      // silencioso: o usuário ainda pode preencher à mão
    } finally {
      setCepLoading(false);
    }
  };

  const formatCardNumber = (value: string) => {
    const digits = value.replace(/\D/g, "").substring(0, 16);
    return digits.replace(/(\d{4})(?=\d)/g, "$1 ");
  };

  const formatCep = (value: string) => {
    const digits = value.replace(/\D/g, "").substring(0, 8);
    return digits.length <= 5 ? digits : `${digits.slice(0, 5)}-${digits.slice(5)}`;
  };

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const fail = useCallback((message: string) => {
    stopPolling();
    setErrorMessage(message);
    setStatus("failed");
  }, []);

  const startPolling = useCallback((transactionId: string) => {
    pollStartRef.current = Date.now();

    const tick = async () => {
      if (Date.now() - pollStartRef.current > POLL_TIMEOUT_MS) {
        fail("O pagamento está demorando mais que o esperado. Se o valor foi debitado, sua assinatura será liberada automaticamente em instantes.");
        return;
      }

      const { data, error } = await supabase.functions.invoke("hypercash-verify-transaction", {
        body: { transaction_id: transactionId },
      });

      if (error) return; // erro transitório: continua tentando até o timeout

      if (data?.verified) {
        stopPolling();
        setStatus("approved");
        toast.success("Pagamento confirmado! Assinatura ativada ✅");
        setTimeout(onActivated, 2000);
        return;
      }

      if (data?.failed) {
        fail(data.refusedReason || "Pagamento recusado pelo emissor do cartão. Tente outro cartão.");
      }
    };

    pollRef.current = setInterval(tick, POLL_INTERVAL_MS);
    tick();
  }, [fail, onActivated]);

  const isFormValid =
    cardNumber.replace(/\s/g, "").length >= 13 &&
    holderName.trim().length >= 3 &&
    expMonth && expYear &&
    cvv.length >= 3 &&
    validateCPF(cpf) &&
    (!threeDSEnabled || (
      cep.replace(/\D/g, "").length === 8 && street.trim() && streetNumber.trim() &&
      neighborhood.trim() && city.trim() && state
    ));

  const handleSubmit = async () => {
    if (!isFormValid || status === "processing") return;

    setStatus("processing");
    setErrorMessage(null);

    const FastSoft = window.FastSoft;
    if (!FastSoft) {
      fail("Processador de pagamento indisponível. Recarregue a página.");
      return;
    }

    const cardData: FastSoftCardData = {
      number: cardNumber.replace(/\s/g, ""),
      holderName: holderName.trim().toUpperCase(),
      expMonth,
      expYear,
      cvv,
    };

    try {
      // 3DS antes da tokenização: o token só é gerado após a autenticação passar.
      if (threeDSEnabled && FastSoft.initializeThreeDS && FastSoft.authenticateThreeDS && FastSoft.finalizeThreeDS) {
        await FastSoft.initializeThreeDS({
          amount: amountCents,
          currency: "BRL",
          installments: 1,
          card: cardData,
        });
        await FastSoft.authenticateThreeDS({
          customer: {
            name: holderName.trim().toUpperCase(),
            email: (await supabase.auth.getUser()).data.user?.email ?? "",
            phoneNumber: phone.replace(/\D/g, ""),
          },
          address: {
            street, streetNumber, complement,
            zipCode: cep, neighborhood, city, state, country: "BR",
          },
        });
        await FastSoft.finalizeThreeDS();
      }

      const cardToken = await FastSoft.encrypt(cardData);
      if (!cardToken) throw new Error("Não foi possível processar os dados do cartão.");

      const { data, error } = await supabase.functions.invoke("hypercash-create-transaction", {
        body: {
          plan,
          includeImplementation,
          cardToken,
          installments: 1,
          // O schema da HyperCash valida `card.number` como cartão de verdade e
          // recusa o token em qualquer campo de `card`, então o número vai junto.
          // O token segue viajando para amarrar a sessão de tokenização/3DS.
          card: {
            number: cardData.number,
            expirationMonth: expMonth,
            expirationYear: expYear,
            cvv,
          },
          customer: {
            name: holderName.trim().toUpperCase(),
            document: cpf.replace(/\D/g, ""),
            phone: phone.replace(/\D/g, ""),
          },
          ...(threeDSEnabled ? {
            address: {
              street, streetNumber, complement,
              zipCode: cep.replace(/\D/g, ""), neighborhood, city, state, country: "br",
            },
          } : {}),
        },
      });

      if (error) throw new Error(await extractEdgeFunctionError(error, "Erro ao processar o pagamento."));
      if (data?.error) throw new Error(data.error);
      if (!data?.transactionId) throw new Error("Resposta inválida do processador de pagamento.");

      if (data.activated) {
        setStatus("approved");
        toast.success("Pagamento confirmado! Assinatura ativada ✅");
        setTimeout(onActivated, 2000);
        return;
      }

      startPolling(data.transactionId);
    } catch (err) {
      logger.error("Falha no pagamento HyperCash", { err });
      const message = err instanceof Error ? err.message : "";
      fail(message || "Não foi possível concluir o pagamento. Tente novamente.");
    }
  };

  if (sdkError) {
    return (
      <div className="text-center py-10 space-y-3">
        <AlertCircle className="w-8 h-8 text-destructive mx-auto" />
        <p className="text-sm text-destructive">{sdkError}</p>
        <p className="text-xs text-muted-foreground">
          Você ainda pode assinar usando PIX.
        </p>
      </div>
    );
  }

  if (!sdkReady) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Carregando formulário de pagamento...</p>
      </div>
    );
  }

  if (status === "approved") {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-4">
        <div className="p-4 rounded-full bg-green-500/20 animate-pulse">
          <CheckCircle2 className="w-12 h-12 text-green-600" />
        </div>
        <div className="text-center space-y-1">
          <p className="text-xl font-bold text-green-600">Pagamento confirmado!</p>
          <p className="text-sm text-muted-foreground">
            Sua assinatura {planLabel} foi ativada.
          </p>
        </div>
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-4">
        <div className="p-4 rounded-full bg-destructive/10">
          <AlertCircle className="w-8 h-8 text-destructive" />
        </div>
        <div className="text-center space-y-1">
          <p className="font-semibold text-destructive">Pagamento não concluído</p>
          <p className="text-sm text-muted-foreground max-w-xs">{errorMessage}</p>
        </div>
        <Button variant="outline" className="rounded-xl" onClick={() => setStatus("form")}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  const processing = status === "processing";

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-sm">Número do cartão</Label>
        <Input
          placeholder="0000 0000 0000 0000"
          value={cardNumber}
          onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
          inputMode="numeric"
          autoComplete="cc-number"
          disabled={processing}
          className="h-11"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm">Nome no cartão</Label>
        <Input
          placeholder="Como está no cartão"
          value={holderName}
          onChange={(e) => setHolderName(e.target.value.toUpperCase())}
          autoComplete="cc-name"
          disabled={processing}
          className="h-11"
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label className="text-sm">Mês</Label>
          <Select value={expMonth} onValueChange={setExpMonth} disabled={processing}>
            <SelectTrigger className="h-11"><SelectValue placeholder="MM" /></SelectTrigger>
            <SelectContent>
              {Array.from({ length: 12 }, (_, i) => {
                const m = String(i + 1).padStart(2, "0");
                return <SelectItem key={m} value={m}>{m}</SelectItem>;
              })}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm">Ano</Label>
          <Select value={expYear} onValueChange={setExpYear} disabled={processing}>
            <SelectTrigger className="h-11"><SelectValue placeholder="AAAA" /></SelectTrigger>
            <SelectContent>
              {years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm">CVV</Label>
          <Input
            placeholder="123"
            value={cvv}
            onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").substring(0, 4))}
            inputMode="numeric"
            autoComplete="cc-csc"
            disabled={processing}
            className="h-11"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-sm">CPF do titular</Label>
          <Input
            placeholder="000.000.000-00"
            value={cpf}
            // Trava em 11 dígitos: a HyperCash exige document.type = CPF.
            onChange={(e) => setCpf(maskCpfCnpj(e.target.value.replace(/\D/g, "").slice(0, 11)))}
            inputMode="numeric"
            disabled={processing}
            className="h-11"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm">Telefone</Label>
          <Input
            placeholder="(11) 99999-9999"
            value={phone}
            onChange={(e) => setPhone(formatPhone(e.target.value))}
            inputMode="numeric"
            disabled={processing}
            className="h-11"
          />
        </div>
      </div>

      {threeDSEnabled && (
        <div className="space-y-3 pt-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="w-3.5 h-3.5 text-green-600" />
            Endereço de cobrança — exigido pela autenticação 3D Secure
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm">CEP</Label>
              <div className="relative">
                <Input
                  placeholder="00000-000"
                  value={cep}
                  onChange={(e) => setCep(formatCep(e.target.value))}
                  onBlur={handleCepBlur}
                  inputMode="numeric"
                  disabled={processing}
                  className="h-11"
                />
                {cepLoading && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Número</Label>
              <Input
                placeholder="123"
                value={streetNumber}
                onChange={(e) => setStreetNumber(e.target.value)}
                disabled={processing}
                className="h-11"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">Rua</Label>
            <Input value={street} onChange={(e) => setStreet(e.target.value)} disabled={processing} className="h-11" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm">Bairro</Label>
              <Input value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} disabled={processing} className="h-11" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Complemento</Label>
              <Input placeholder="Opcional" value={complement} onChange={(e) => setComplement(e.target.value)} disabled={processing} className="h-11" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label className="text-sm">Cidade</Label>
              <Input value={city} onChange={(e) => setCity(e.target.value)} disabled={processing} className="h-11" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">UF</Label>
              <Select value={state} onValueChange={setState} disabled={processing}>
                <SelectTrigger className="h-11"><SelectValue placeholder="UF" /></SelectTrigger>
                <SelectContent>
                  {UFS.map((uf) => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-baseline justify-between pt-2 border-t">
        <span className="text-sm text-muted-foreground">Total hoje</span>
        <span className="text-xl font-bold">{formatCurrency(amountCents)}</span>
      </div>

      <Button
        className="w-full h-12 text-base rounded-xl"
        onClick={handleSubmit}
        disabled={!isFormValid || processing}
      >
        {processing ? (
          <><Loader2 className="w-4 h-4 animate-spin mr-2" />Processando pagamento...</>
        ) : (
          <><Lock className="w-4 h-4 mr-2" />Pagar {formatCurrency(amountCents)}</>
        )}
      </Button>

      <p className="text-xs text-center text-muted-foreground">
        Seus dados são enviados por conexão criptografada e usados apenas para processar este pagamento.
      </p>
    </div>
  );
}
