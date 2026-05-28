import { useState, useEffect } from "react";
import { format, startOfMonth, endOfMonth, subMonths, getMonth, getYear } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DollarSign, TrendingUp, TrendingDown, Download, FileText, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurantContext } from "@/contexts/RestaurantContext";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";

interface DRELine {
  type: "+" | "-" | "=";
  description: string;
  value: number;
  percentage: number;
}

interface DREData {
  receitaBruta: number;
  devolucoes: number;
  receitaLiquida: number;
  custoInsumos: number;
  lucroBruto: number;
  taxasPagamento: number;
  resultadoOperacional: number;
}

interface ComparisonData {
  currentMonth: DREData;
  previousMonth: DREData;
  variation: {
    receitaBruta: number;
    lucroBruto: number;
    resultadoOperacional: number;
  };
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatPercentage(value: number) {
  return `${value.toFixed(1)}%`;
}

export default function AdminDRE() {
  const { selectedRestaurant, selectedRestaurantIds } = useRestaurantContext();
  const [selectedYear, setSelectedYear] = useState(getYear(new Date()));
  const [selectedMonth, setSelectedMonth] = useState(getMonth(new Date()));
  const [loading, setLoading] = useState(true);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const { toast } = useToast();

  const restaurantId = selectedRestaurant?.id || (selectedRestaurantIds.length === 1 ? selectedRestaurantIds[0] : null);

  const [dreData, setDreData] = useState<DREData | null>(null);
  const [comparisonData, setComparisonData] = useState<ComparisonData | null>(null);

  const months = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  const years = [getYear(new Date()), getYear(new Date()) - 1, getYear(new Date()) - 2];

  // Load DRE data
  useEffect(() => {
    async function loadDREData() {
      if (!restaurantId) return;
      setLoading(true);

      try {
        const currentMonthStart = startOfMonth(new Date(selectedYear, selectedMonth));
        const currentMonthEnd = endOfMonth(new Date(selectedYear, selectedMonth));
        const previousMonthStart = startOfMonth(subMonths(currentMonthStart, 1));
        const previousMonthEnd = endOfMonth(subMonths(currentMonthEnd, 1));

        // Fetch current month orders
        const { data: currentOrders } = await supabase
          .from("orders")
          .select("total_amount, status")
          .eq("restaurant_id", restaurantId)
          .gte("created_at", currentMonthStart.toISOString())
          .lte("created_at", currentMonthEnd.toISOString());

        // Fetch previous month orders
        const { data: previousOrders } = await supabase
          .from("orders")
          .select("total_amount, status")
          .eq("restaurant_id", restaurantId)
          .gte("created_at", previousMonthStart.toISOString())
          .lte("created_at", previousMonthEnd.toISOString());

        // Fetch current month purchase orders
        const { data: currentPurchaseOrders } = await supabase
          .from("purchase_orders" as any)
          .select("total_value")
          .eq("restaurant_id", restaurantId)
          .eq("status", "recebido")
          .gte("received_at", currentMonthStart.toISOString())
          .lte("received_at", currentMonthEnd.toISOString());

        // Fetch previous month purchase orders
        const { data: previousPurchaseOrders } = await supabase
          .from("purchase_orders" as any)
          .select("total_value")
          .eq("restaurant_id", restaurantId)
          .eq("status", "recebido")
          .gte("received_at", previousMonthStart.toISOString())
          .lte("received_at", previousMonthEnd.toISOString());

        // Calculate current month DRE
        const currentReceitaBruta = currentOrders
          ?.filter(o => o.status !== 'cancelled')
          .reduce((sum, o) => sum + Number(o.total_amount), 0) || 0;

        const currentDevolucoes = currentOrders
          ?.filter(o => o.status === 'cancelled')
          .reduce((sum, o) => sum + Number(o.total_amount), 0) || 0;

        const currentReceitaLiquida = currentReceitaBruta - currentDevolucoes;

        const currentCustoInsumos = (currentPurchaseOrders as any[])
          ?.reduce((sum, po) => sum + Number(po.total_value), 0) || 0;

        const currentLucroBruto = currentReceitaLiquida - currentCustoInsumos;

        // Payment fees: 2.5% estimate (no payment_fee column found)
        const currentTaxasPagamento = currentReceitaBruta * 0.025;

        const currentResultadoOperacional = currentLucroBruto - currentTaxasPagamento;

        const currentDREData: DREData = {
          receitaBruta: currentReceitaBruta,
          devolucoes: currentDevolucoes,
          receitaLiquida: currentReceitaLiquida,
          custoInsumos: currentCustoInsumos,
          lucroBruto: currentLucroBruto,
          taxasPagamento: currentTaxasPagamento,
          resultadoOperacional: currentResultadoOperacional,
        };

        // Calculate previous month DRE
        const previousReceitaBruta = previousOrders
          ?.filter(o => o.status !== 'cancelled')
          .reduce((sum, o) => sum + Number(o.total_amount), 0) || 0;

        const previousDevolucoes = previousOrders
          ?.filter(o => o.status === 'cancelled')
          .reduce((sum, o) => sum + Number(o.total_amount), 0) || 0;

        const previousReceitaLiquida = previousReceitaBruta - previousDevolucoes;

        const previousCustoInsumos = (previousPurchaseOrders as any[])
          ?.reduce((sum, po) => sum + Number(po.total_value), 0) || 0;

        const previousLucroBruto = previousReceitaLiquida - previousCustoInsumos;

        const previousTaxasPagamento = previousReceitaBruta * 0.025;

        const previousResultadoOperacional = previousLucroBruto - previousTaxasPagamento;

        const previousDREData: DREData = {
          receitaBruta: previousReceitaBruta,
          devolucoes: previousDevolucoes,
          receitaLiquida: previousReceitaLiquida,
          custoInsumos: previousCustoInsumos,
          lucroBruto: previousLucroBruto,
          taxasPagamento: previousTaxasPagamento,
          resultadoOperacional: previousResultadoOperacional,
        };

        // Calculate variations
        const variation = {
          receitaBruta: previousReceitaBruta > 0 ? ((currentReceitaBruta - previousReceitaBruta) / previousReceitaBruta) * 100 : 0,
          lucroBruto: previousLucroBruto > 0 ? ((currentLucroBruto - previousLucroBruto) / previousLucroBruto) * 100 : 0,
          resultadoOperacional: previousResultadoOperacional > 0 ? ((currentResultadoOperacional - previousResultadoOperacional) / previousResultadoOperacional) * 100 : 0,
        };

        setDreData(currentDREData);
        setComparisonData({
          currentMonth: currentDREData,
          previousMonth: previousDREData,
          variation,
        });

      } catch (error) {
        console.error("Error loading DRE data:", error);
        toast({ title: "Erro ao carregar dados", description: "Não foi possível carregar os dados do DRE.", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    }

    loadDREData();
  }, [restaurantId, selectedYear, selectedMonth, toast]);

  // Generate DRE lines
  const dreLines: DRELine[] = dreData ? [
    {
      type: "+",
      description: "Receita Bruta",
      value: dreData.receitaBruta,
      percentage: dreData.receitaBruta > 0 ? 100 : 0,
    },
    {
      type: "-",
      description: "Devoluções/Cancelamentos",
      value: dreData.devolucoes,
      percentage: dreData.receitaBruta > 0 ? (dreData.devolucoes / dreData.receitaBruta) * 100 : 0,
    },
    {
      type: "=",
      description: "Receita Líquida",
      value: dreData.receitaLiquida,
      percentage: dreData.receitaBruta > 0 ? (dreData.receitaLiquida / dreData.receitaBruta) * 100 : 0,
    },
    {
      type: "-",
      description: "Custo de Insumos",
      value: dreData.custoInsumos,
      percentage: dreData.receitaBruta > 0 ? (dreData.custoInsumos / dreData.receitaBruta) * 100 : 0,
    },
    {
      type: "=",
      description: "Lucro Bruto",
      value: dreData.lucroBruto,
      percentage: dreData.receitaBruta > 0 ? (dreData.lucroBruto / dreData.receitaBruta) * 100 : 0,
    },
    {
      type: "-",
      description: "Taxas de Pagamento (est. 2.5%)",
      value: dreData.taxasPagamento,
      percentage: dreData.receitaBruta > 0 ? (dreData.taxasPagamento / dreData.receitaBruta) * 100 : 0,
    },
    {
      type: "=",
      description: "Resultado Operacional",
      value: dreData.resultadoOperacional,
      percentage: dreData.receitaBruta > 0 ? (dreData.resultadoOperacional / dreData.receitaBruta) * 100 : 0,
    },
  ] : [];

  // Export PDF
  async function exportPDF() {
    if (!dreData) return;
    setGeneratingPdf(true);

    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 20;
      let y = margin;

      // Title
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("DRE — Demonstrativo de Resultado", margin, y);
      y += 10;

      // Period
      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      const periodText = `${months[selectedMonth]} ${selectedYear}`;
      doc.text(periodText, margin, y);
      y += 20;

      // Table header
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("Descrição", margin, y);
      doc.text("Valor (R$)", pageWidth - margin - 40, y);
      doc.text("% Receita", pageWidth - margin, y);
      y += 8;

      // Table lines
      doc.setFont("helvetica", "normal");
      dreLines.forEach((line) => {
        const typeSymbol = line.type === "+" ? "(+)" : line.type === "-" ? "(-)" : "(=)";
        doc.text(`${typeSymbol} ${line.description}`, margin, y);
        doc.text(formatCurrency(line.value), pageWidth - margin - 40, y);
        doc.text(formatPercentage(line.percentage), pageWidth - margin, y);
        y += 7;
      });

      // Comparison
      if (comparisonData) {
        y += 15;
        doc.setFont("helvetica", "bold");
        doc.text("Comparativo com Mês Anterior", margin, y);
        y += 10;
        doc.setFont("helvetica", "normal");
        doc.text(`Receita Bruta: ${comparisonData.variation.receitaBruta.toFixed(1)}%`, margin, y);
        y += 7;
        doc.text(`Lucro Bruto: ${comparisonData.variation.lucroBruto.toFixed(1)}%`, margin, y);
        y += 7;
        doc.text(`Resultado Operacional: ${comparisonData.variation.resultadoOperacional.toFixed(1)}%`, margin, y);
      }

      doc.save(`DRE_${months[selectedMonth]}_${selectedYear}.pdf`);
      toast({ title: "PDF gerado com sucesso!" });

    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({ title: "Erro ao gerar PDF", description: "Não foi possível gerar o PDF.", variant: "destructive" });
    } finally {
      setGeneratingPdf(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">DRE — Demonstrativo de Resultado</h1>
            <p className="text-muted-foreground text-sm">Análise financeira detalhada</p>
          </div>
          <Skeleton className="h-10 w-[200px]" />
        </div>
        <Card>
          <CardContent className="pt-6">
            <Skeleton className="h-[400px] w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">DRE — Demonstrativo de Resultado</h1>
          <p className="text-muted-foreground text-sm">Análise financeira detalhada</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedMonth.toString()} onValueChange={(value) => setSelectedMonth(parseInt(value))}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {months.map((month, index) => (
                <SelectItem key={index} value={index.toString()}>{month}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((year) => (
                <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={exportPDF} disabled={generatingPdf} className="gap-2">
            <Download className="w-4 h-4" />
            {generatingPdf ? "Gerando..." : "Exportar PDF"}
          </Button>
        </div>
      </div>

      {/* Comparison Card */}
      {comparisonData && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Comparativo com Mês Anterior</CardTitle>
            <CardDescription>Variação em relação a {months[(selectedMonth - 1 + 12) % 12]} {selectedMonth === 0 ? selectedYear - 1 : selectedYear}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/50">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Receita Bruta</p>
                  <div className="flex items-center gap-1">
                    {comparisonData.variation.receitaBruta >= 0 ? (
                      <ArrowUpRight className="w-4 h-4 text-green-600" />
                    ) : (
                      <ArrowDownRight className="w-4 h-4 text-red-600" />
                    )}
                    <p className={`text-lg font-bold ${comparisonData.variation.receitaBruta >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {comparisonData.variation.receitaBruta.toFixed(1)}%
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/50">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Lucro Bruto</p>
                  <div className="flex items-center gap-1">
                    {comparisonData.variation.lucroBruto >= 0 ? (
                      <ArrowUpRight className="w-4 h-4 text-green-600" />
                    ) : (
                      <ArrowDownRight className="w-4 h-4 text-red-600" />
                    )}
                    <p className={`text-lg font-bold ${comparisonData.variation.lucroBruto >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {comparisonData.variation.lucroBruto.toFixed(1)}%
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/50">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Resultado Operacional</p>
                  <div className="flex items-center gap-1">
                    {comparisonData.variation.resultadoOperacional >= 0 ? (
                      <ArrowUpRight className="w-4 h-4 text-green-600" />
                    ) : (
                      <ArrowDownRight className="w-4 h-4 text-red-600" />
                    )}
                    <p className={`text-lg font-bold ${comparisonData.variation.resultadoOperacional >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {comparisonData.variation.resultadoOperacional.toFixed(1)}%
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* DRE Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Demonstrativo do Exercício</CardTitle>
          <CardDescription>{months[selectedMonth]} de {selectedYear}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Descrição</TableHead>
                <TableHead className="text-right">Valor (R$)</TableHead>
                <TableHead className="text-right">% Receita Bruta</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dreLines.map((line, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">
                    <span className={`inline-flex items-center gap-2 ${line.type === "=" ? "font-bold" : ""}`}>
                      <span className={`text-xs font-bold ${line.type === "+" ? "text-green-600" : line.type === "-" ? "text-red-600" : "text-muted-foreground"}`}>
                        {line.type === "+" ? "(+)" : line.type === "-" ? "(-)" : "(=)"}
                      </span>
                      {line.description}
                    </span>
                  </TableCell>
                  <TableCell className={`text-right ${line.type === "=" ? "font-bold" : ""}`}>
                    {formatCurrency(line.value)}
                  </TableCell>
                  <TableCell className={`text-right ${line.type === "=" ? "font-bold" : ""}`}>
                    {formatPercentage(line.percentage)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
