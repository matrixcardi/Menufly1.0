import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageCircle, Wifi, WifiOff, RefreshCw, LogOut, QrCode } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface WhatsAppConnectionProps {
  restaurantId: string | null;
}

type ConnectionState = "loading" | "disconnected" | "connecting" | "connected";

export default function WhatsAppConnection({ restaurantId }: WhatsAppConnectionProps) {
  const { toast } = useToast();
  const [state, setState] = useState<ConnectionState>("loading");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [instanceName, setInstanceName] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const [refreshingQR, setRefreshingQR] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const callFunction = useCallback(async (action: string) => {
    if (!restaurantId) return null;
    const { data, error } = await supabase.functions.invoke("whatsapp-instance", {
      body: { action, restaurantId },
    });
    if (error) throw error;
    return data;
  }, [restaurantId]);

  // Check initial status
  const checkStatus = useCallback(async () => {
    if (!restaurantId) return;
    try {
      const data = await callFunction("status");
      if (data?.connected) {
        setState("connected");
        setInstanceName(data.instanceName);
        setQrCode(null);
      } else if (data?.instanceName) {
        setInstanceName(data.instanceName);
        setState("disconnected");
      } else {
        setState("disconnected");
      }
    } catch {
      setState("disconnected");
    }
  }, [restaurantId, callFunction]);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  // Poll for connection status while showing QR code
  useEffect(() => {
    if (!polling || state !== "connecting") return;

    const interval = setInterval(async () => {
      try {
        const data = await callFunction("status");
        if (data?.connected) {
          setState("connected");
          setQrCode(null);
          setPolling(false);
          toast({
            title: "WhatsApp conectado! ✅",
            description: "Seu WhatsApp está pronto para enviar campanhas",
          });
        }
      } catch {
        // Keep polling
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [polling, state, callFunction, toast]);

  const handleConnect = async () => {
    setState("connecting");
    try {
      // Try to create or get QR code
      const data = await callFunction("create");
      
      if (data?.qrcode) {
        setQrCode(data.qrcode);
        setInstanceName(data.instanceName);
        setPolling(true);
      } else {
        // Instance exists, just get QR code
        const qrData = await callFunction("qrcode");
        if (qrData?.qrcode) {
          setQrCode(qrData.qrcode);
          setInstanceName(qrData.instanceName);
          setPolling(true);
        } else {
          toast({
            title: "Erro ao gerar QR Code",
            description: "Tente novamente em instantes",
            variant: "destructive",
          });
          setState("disconnected");
        }
      }
    } catch (error) {
      console.error("Error connecting:", error);
      toast({
        title: "Erro ao conectar",
        description: "Verifique sua configuração e tente novamente",
        variant: "destructive",
      });
      setState("disconnected");
    }
  };


  const startCooldown = useCallback(() => {
    setCooldown(30);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(cooldownRef.current!);
          cooldownRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // Start cooldown after initial QR code is shown
  useEffect(() => {
    if (state === "connecting" && qrCode) {
      startCooldown();
    }
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, [state === "connecting" && !!qrCode]);

  const handleRefreshQR = async () => {
    if (cooldown > 0) return;
    setRefreshingQR(true);
    try {
      setQrCode(null);
      const qrData = await callFunction("qrcode");
      if (qrData?.qrcode) {
        setQrCode(qrData.qrcode);
        startCooldown();
        toast({ title: "QR Code atualizado! 🔄" });
      } else {
        toast({ title: "Erro ao atualizar QR Code", variant: "destructive" });
      }
    } catch (error) {
      console.error("Error refreshing QR:", error);
      toast({ title: "Erro ao atualizar QR Code", variant: "destructive" });
    } finally {
      setRefreshingQR(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await callFunction("disconnect");
      setState("disconnected");
      setQrCode(null);
      setPolling(false);
      toast({ title: "WhatsApp desconectado" });
    } catch (error) {
      console.error("Error disconnecting:", error);
    }
  };

  if (!restaurantId) return null;

  if (state === "loading") {
    return (
      <Card>
        <CardContent className="p-6">
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={state === "connected" ? "border-green-500/50" : state === "connecting" ? "border-yellow-500/50" : ""}>
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          {/* QR Code area */}
          {state === "connecting" && qrCode && (
            <div className="flex-shrink-0">
              <div className="bg-white p-2 rounded-lg shadow-sm">
                <img
                  src={qrCode.startsWith("data:") ? qrCode : `data:image/png;base64,${qrCode}`}
                  alt="QR Code WhatsApp"
                  className="w-48 h-48"
                />
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="w-full mt-2 gap-1 text-xs"
                onClick={handleRefreshQR}
                disabled={refreshingQR || cooldown > 0}
              >
                <RefreshCw className={`w-3 h-3 ${refreshingQR ? "animate-spin" : ""}`} />
                {refreshingQR ? "Atualizando..." : cooldown > 0 ? `Aguarde ${cooldown}s` : "Atualizar QR Code"}
              </Button>
            </div>
          )}

          {/* Info area */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <MessageCircle className="w-5 h-5 text-green-600" />
              <h3 className="font-semibold">Conexão WhatsApp</h3>
              {state === "connected" && (
                <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 gap-1">
                  <Wifi className="w-3 h-3" />
                  Conectado
                </Badge>
              )}
              {state === "disconnected" && (
                <Badge variant="secondary" className="gap-1">
                  <WifiOff className="w-3 h-3" />
                  Desconectado
                </Badge>
              )}
              {state === "connecting" && (
                <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300 gap-1">
                  <QrCode className="w-3 h-3" />
                  Aguardando leitura...
                </Badge>
              )}
            </div>

            {state === "disconnected" && (
              <>
                <p className="text-sm text-muted-foreground mb-3">
                  Conecte seu WhatsApp para enviar campanhas de mensagens em massa aos seus clientes.
                </p>
                <Button onClick={handleConnect} className="gap-2 bg-green-600 hover:bg-green-700">
                  <QrCode className="w-4 h-4" />
                  Conectar WhatsApp
                </Button>
              </>
            )}

            {state === "connecting" && (
              <div>
                <p className="text-sm text-muted-foreground mb-2">
                  Abra o WhatsApp no celular → <strong>Aparelhos conectados</strong> → <strong>Conectar aparelho</strong> → Escaneie o QR Code ao lado.
                </p>
                <p className="text-xs text-muted-foreground animate-pulse">
                  ⏳ Aguardando leitura do QR Code...
                </p>
              </div>
            )}

            {state === "connected" && (
              <>
                <p className="text-sm text-muted-foreground mb-1">
                  Seu WhatsApp está conectado e pronto para enviar campanhas.
                </p>
                {instanceName && (
                  <p className="text-xs text-muted-foreground mb-3">
                    Instância: <code className="bg-muted px-1 rounded">{instanceName}</code>
                  </p>
                )}
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={checkStatus} className="gap-1">
                    <RefreshCw className="w-3 h-3" />
                    Verificar
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleDisconnect} className="gap-1 text-destructive hover:text-destructive">
                    <LogOut className="w-3 h-3" />
                    Desconectar
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
