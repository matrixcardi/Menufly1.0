import { useState, useEffect } from "react";
import { Printer, Check, Info, TestTube } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { printOrder } from "@/components/orders/OrderReceipt";
import { Tables } from "@/integrations/supabase/types";

type Order = Tables<"orders">;

export default function AdminPrinter() {
  const { toast } = useToast();

  const [autoPrint, setAutoPrint] = useState(() => localStorage.getItem("autoPrintOrders") === "true");
  const [paperSize, setPaperSize] = useState(() => localStorage.getItem("printerPaperSize") || "80mm");
  const [printCopies, setPrintCopies] = useState(() => Number(localStorage.getItem("printerCopies") || "1"));
  const [showCustomerInfo, setShowCustomerInfo] = useState(() => localStorage.getItem("printerShowCustomer") !== "false");
  const [showNotes, setShowNotes] = useState(() => localStorage.getItem("printerShowNotes") !== "false");

  const handleAutoPrintChange = (checked: boolean) => {
    setAutoPrint(checked);
    localStorage.setItem("autoPrintOrders", String(checked));
    toast({
      title: checked ? "🖨️ Impressão automática ativada" : "Impressão automática desativada",
      description: checked ? "Novos pedidos serão impressos automaticamente" : "",
    });
  };

  const handlePaperSizeChange = (value: string) => {
    setPaperSize(value);
    localStorage.setItem("printerPaperSize", value);
  };

  const handleCopiesChange = (value: string) => {
    const copies = Number(value);
    setPrintCopies(copies);
    localStorage.setItem("printerCopies", value);
  };

  const handleShowCustomerChange = (checked: boolean) => {
    setShowCustomerInfo(checked);
    localStorage.setItem("printerShowCustomer", String(checked));
  };

  const handleShowNotesChange = (checked: boolean) => {
    setShowNotes(checked);
    localStorage.setItem("printerShowNotes", String(checked));
  };

  const handleTestPrint = () => {
    const testOrder: Order = {
      id: "test-id",
      restaurant_id: "test-restaurant",
      order_number: "TESTE-0001",
      daily_number: 10,
      customer_name: "Cliente Teste",
      customer_phone: "(51) 99999-9999",
      customer_address: "Rua Exemplo, 123 - Centro, Porto Alegre - RS",
      delivery_type: "delivery",
      payment_method: "pix",
      payment_status: "pending",
      subtotal: 45.90,
      discount: 5.00,
      delivery_fee: 7.00,
      total: 47.90,
      status: "pending",
      is_archived: false,
      coupon_code: "DESC10",
      notes: "Sem cebola, por favor. Troco para R$100.",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      driver_id: null,
      driver_name: null,
      cancellation_reason: null,
      accepted_at: null,
      lavem_delivery_id: null,
      lavem_status: null,
      lavem_tracking_url: null,
      lavem_driver_name: null,
      lavem_driver_phone: null,
      lavem_fee: 0,
      source: "menufly",
      external_id: null,
      external_data: null,
      items: [
        { name: "X-Bacon Especial", quantity: 2, price: 18.95, addons: [{ name: "Cheddar Extra", price: 4.00 }] },
        { name: "Batata Frita Grande", quantity: 1, price: 12.00, addons: [] },
        { name: "Refrigerante 600ml", quantity: 2, price: 7.00, addons: [] },
      ] as unknown as Tables<"orders">["items"],
    };

    printOrder(testOrder, "Meu Restaurante (TESTE)");

    toast({
      title: "🖨️ Impressão de teste enviada",
      description: "Verifique se o layout está correto na sua impressora.",
    });
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Impressora</h1>
        <p className="text-sm text-muted-foreground">
          Configure a impressão automática de pedidos
        </p>
      </div>

      {/* Status Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Printer className="w-6 h-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Impressão Automática</CardTitle>
                <CardDescription>
                  Imprime automaticamente quando um novo pedido chegar
                </CardDescription>
              </div>
            </div>
            <Switch checked={autoPrint} onCheckedChange={handleAutoPrintChange} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 border border-border">
            <Info className="w-4 h-4 mt-0.5 text-muted-foreground flex-shrink-0" />
            <p className="text-xs text-muted-foreground">
              A impressão usa o navegador (window.print). Certifique-se de que sua impressora está configurada como padrão no sistema operacional.
              Para melhor experiência, mantenha o painel aberto no navegador.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Configurações do Cupom</CardTitle>
          <CardDescription>Personalize o layout da impressão</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Paper Size */}
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Tamanho do papel</Label>
              <p className="text-xs text-muted-foreground">Largura da bobina térmica</p>
            </div>
            <Select value={paperSize} onValueChange={handlePaperSizeChange}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="58mm">58mm</SelectItem>
                <SelectItem value="80mm">80mm</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Copies */}
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Número de cópias</Label>
              <p className="text-xs text-muted-foreground">Cópias por pedido (cozinha + balcão)</p>
            </div>
            <Select value={String(printCopies)} onValueChange={handleCopiesChange}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 cópia</SelectItem>
                <SelectItem value="2">2 cópias</SelectItem>
                <SelectItem value="3">3 cópias</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Show Customer Info */}
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Dados do cliente</Label>
              <p className="text-xs text-muted-foreground">Nome, telefone e endereço</p>
            </div>
            <Switch checked={showCustomerInfo} onCheckedChange={handleShowCustomerChange} />
          </div>

          {/* Show Notes */}
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Observações</Label>
              <p className="text-xs text-muted-foreground">Mostrar observações do cliente no cupom</p>
            </div>
            <Switch checked={showNotes} onCheckedChange={handleShowNotesChange} />
          </div>
        </CardContent>
      </Card>

      {/* Test Print */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Teste de Impressão</CardTitle>
          <CardDescription>
            Imprima um pedido fictício para verificar o layout
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleTestPrint} className="gap-2">
            <TestTube className="w-4 h-4" />
            Imprimir Teste
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
