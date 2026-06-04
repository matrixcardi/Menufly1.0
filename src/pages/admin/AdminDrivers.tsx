import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Bike, Phone, DollarSign, Info } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useRestaurantContext } from "@/contexts/RestaurantContext";

type FeeMode = "fixed_only" | "fixed_per_ride" | "delivery_passthrough";

interface Driver {
  id: string;
  name: string;
  phone: string;
  fixed_fee: number;
  per_ride_fee: number;
  fee_mode: FeeMode;
  is_active: boolean;
  created_at: string;
}

export default function AdminDrivers() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [deleteDriver, setDeleteDriver] = useState<Driver | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    fixed_fee: "",
    per_ride_fee: "",
    fee_mode: "fixed_only" as FeeMode,
  });
  const { selectedRestaurant, selectedRestaurantIds } = useRestaurantContext();
  const { toast } = useToast();

  const restaurantId = selectedRestaurant?.id || (selectedRestaurantIds.length === 1 ? selectedRestaurantIds[0] : null);

  useEffect(() => {
    if (!restaurantId) {
      setDrivers([]);
      setLoading(false);
      return;
    }
    fetchDrivers(restaurantId);
  }, [restaurantId]);

  const fetchDrivers = async (rid: string) => {
    setLoading(true);
    const { data } = await supabase
      .from("drivers")
      .select("*")
      .eq("restaurant_id", rid)
      .order("created_at", { ascending: true });
    setDrivers((data as Driver[]) || []);
    setLoading(false);
  };

  const openCreate = () => {
    setEditingDriver(null);
    setForm({ name: "", phone: "", fixed_fee: "", per_ride_fee: "", fee_mode: "fixed_only" });
    setShowDialog(true);
  };

  const openEdit = (d: Driver) => {
    setEditingDriver(d);
    setForm({
      name: d.name,
      phone: d.phone,
      fixed_fee: d.fixed_fee > 0 ? String(d.fixed_fee) : "",
      per_ride_fee: d.per_ride_fee > 0 ? String(d.per_ride_fee) : "",
      fee_mode: (d.fee_mode as FeeMode) || "fixed_only",
    });
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!restaurantId || !form.name.trim() || !form.phone.trim()) {
      toast({ title: "Preencha nome e telefone", variant: "destructive" });
      return;
    }
    
    // Normalize phone: keep only digits, strip leading country code (55) if present.
    const rawDigits = form.phone.replace(/\D/g, "");
    const localDigits = rawDigits.startsWith("55") && rawDigits.length > 11
      ? rawDigits.slice(2)
      : rawDigits;
    
    if (localDigits.length < 10 || localDigits.length > 11) {
      toast({
        title: "Telefone inválido",
        description: "Use DDD + número (10 ou 11 dígitos). Ex: (51) 99999-9999",
        variant: "destructive",
      });
      return;
    }
    
    setSaving(true);
    
    const fixedFee = parseFloat(form.fixed_fee.replace(",", ".")) || 0;
    const perRideFee = parseFloat(form.per_ride_fee.replace(",", ".")) || 0;

    const payload = {
      name: form.name.trim(),
      phone: localDigits,
      fixed_fee: fixedFee,
      per_ride_fee: perRideFee,
      fee_mode: form.fee_mode,
    };

    try {
      if (editingDriver) {
        const { error } = await supabase
          .from("drivers")
          .update(payload)
          .eq("id", editingDriver.id);
        
        if (error) {
          toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
        } else {
          toast({ title: "✅ Entregador atualizado!" });
        }
      } else {
        const { error } = await supabase
          .from("drivers")
          .insert({ restaurant_id: restaurantId, ...payload });
        
        if (error) {
          toast({ title: "Erro ao criar", description: error.message, variant: "destructive" });
        } else {
          toast({ title: "✅ Entregador adicionado!" });
        }
      }
    } catch (err) {
      toast({ 
        title: "Erro inesperado", 
        description: err instanceof Error ? err.message : "Ocorreu um erro ao salvar", 
        variant: "destructive" 
      });
    } finally {
      setSaving(false);
      setShowDialog(false);
      fetchDrivers(restaurantId);
    }
  };

  const handleToggleActive = async (d: Driver) => {
    await supabase.from("drivers").update({ is_active: !d.is_active }).eq("id", d.id);
    fetchDrivers(restaurantId!);
  };

  const handleDelete = async () => {
    if (!deleteDriver) return;
    const { error } = await supabase.from("drivers").delete().eq("id", deleteDriver.id);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Entregador removido" });
    }
    setDeleteDriver(null);
    fetchDrivers(restaurantId!);
  };

  const formatCurrency = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const feeModeLabel = (mode: FeeMode) => {
    switch (mode) {
      case "fixed_only": return "Só arrancada";
      case "fixed_per_ride": return "Valor fixo/corrida";
      case "delivery_passthrough": return "Repasse do frete";
    }
  };

  const feeDescription = (d: Driver) => {
    const parts: string[] = [];
    if (d.fixed_fee > 0) parts.push(`Arrancada: ${formatCurrency(d.fixed_fee)}`);
    if (d.fee_mode === "fixed_per_ride" && d.per_ride_fee > 0) {
      parts.push(`Por corrida: ${formatCurrency(d.per_ride_fee)}`);
    }
    if (d.fee_mode === "delivery_passthrough") {
      parts.push("+ repasse do frete");
    }
    return parts.length > 0 ? parts.join(" · ") : "—";
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-3 md:space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Entregadores</h1>
          <p className="text-sm text-muted-foreground">Gerencie sua equipe de entregadores</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="w-4 h-4" /> Adicionar
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Bike className="w-5 h-5" />
            Equipe ({drivers.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {drivers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Bike className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>Nenhum entregador cadastrado</p>
              <p className="text-sm">Adicione entregadores para atribuí-los aos pedidos</p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Remuneração</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {drivers.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell className="font-medium">{d.name}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Phone className="w-3.5 h-3.5" />
                            {d.phone}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm space-y-0.5">
                            <span className="text-muted-foreground">{feeDescription(d)}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch checked={d.is_active} onCheckedChange={() => handleToggleActive(d)} />
                            <Badge variant={d.is_active ? "default" : "secondary"}>
                              {d.is_active ? "Ativo" : "Inativo"}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEdit(d)}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => setDeleteDriver(d)} className="text-destructive hover:text-destructive">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden space-y-3">
                {drivers.map((d) => (
                  <div key={d.id} className="p-4 rounded-xl border bg-card space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Bike className="w-4 h-4 text-muted-foreground" />
                        <span className="font-semibold">{d.name}</span>
                      </div>
                      <Badge variant={d.is_active ? "default" : "secondary"} className="text-xs">
                        {d.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                    <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5" />
                        {d.phone}
                      </div>
                      <div className="flex items-center gap-1">
                        <DollarSign className="w-3.5 h-3.5" />
                        {feeDescription(d)}
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-border/50">
                      <Switch checked={d.is_active} onCheckedChange={() => handleToggleActive(d)} />
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(d)} className="gap-1.5 h-8">
                          <Pencil className="w-3.5 h-3.5" /> Editar
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setDeleteDriver(d)} className="text-destructive hover:text-destructive h-8">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingDriver ? "Editar Entregador" : "Novo Entregador"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nome do entregador" />
            </div>
            <div>
              <Label>Telefone (WhatsApp)</Label>
              <PhoneInput value={form.phone} onChange={(value) => setForm({ ...form, phone: value })} placeholder="(11) 9 9999-9999" />
            </div>
            <div>
              <Label>Taxa fixa de arrancada (R$)</Label>
              <Input
                type="text"
                inputMode="decimal"
                value={form.fixed_fee}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9.,]/g, "");
                  setForm({ ...form, fixed_fee: val });
                }}
                placeholder="0,00 (opcional)"
              />
              <p className="text-xs text-muted-foreground mt-1">Valor cobrado ao acionar este motoboy (ex: R$ 50,00 de arrancada)</p>
            </div>

            {/* Fee Mode Selection */}
            <div className="space-y-3">
              <Label className="flex items-center gap-1.5">
                Remuneração por corrida
                <Info className="w-3.5 h-3.5 text-muted-foreground" />
              </Label>
              <RadioGroup
                value={form.fee_mode}
                onValueChange={(val) => setForm({ ...form, fee_mode: val as FeeMode })}
                className="space-y-2"
              >
                <label className="flex items-start gap-3 p-3 rounded-lg border bg-card cursor-pointer hover:bg-secondary/50 transition-colors">
                  <RadioGroupItem value="fixed_only" className="mt-0.5" />
                  <div>
                    <span className="text-sm font-medium">Somente arrancada</span>
                    <p className="text-xs text-muted-foreground">O entregador recebe apenas a taxa fixa de arrancada definida acima.</p>
                  </div>
                </label>
                <label className="flex items-start gap-3 p-3 rounded-lg border bg-card cursor-pointer hover:bg-secondary/50 transition-colors">
                  <RadioGroupItem value="fixed_per_ride" className="mt-0.5" />
                  <div>
                    <span className="text-sm font-medium">Valor fixo por corrida</span>
                    <p className="text-xs text-muted-foreground">O entregador recebe um valor adicional fixo por cada pedido entregue, além da arrancada.</p>
                  </div>
                </label>
                <label className="flex items-start gap-3 p-3 rounded-lg border bg-card cursor-pointer hover:bg-secondary/50 transition-colors">
                  <RadioGroupItem value="delivery_passthrough" className="mt-0.5" />
                  <div>
                    <span className="text-sm font-medium">Repasse total do frete</span>
                    <p className="text-xs text-muted-foreground">O valor de frete cobrado do cliente é integralmente repassado ao entregador, além da arrancada.</p>
                  </div>
                </label>
              </RadioGroup>
            </div>

            {/* Per-ride fee input - only visible for fixed_per_ride mode */}
            {form.fee_mode === "fixed_per_ride" && (
              <div>
                <Label>Valor fixo por corrida (R$)</Label>
                <CurrencyInput
                  value={typeof form.per_ride_fee === 'string' ? parseFloat(form.per_ride_fee) || 0 : form.per_ride_fee}
                  onChange={(value) => setForm({ ...form, per_ride_fee: value })}
                  placeholder="Ex: 5,00"
                />
                <p className="text-xs text-muted-foreground mt-1">Valor adicional pago por cada pedido entregue</p>
              </div>
            )}

            {form.fee_mode === "delivery_passthrough" && (
              <div className="p-3 rounded-lg border border-primary/30 bg-primary/5">
                <p className="text-xs text-muted-foreground flex items-start gap-2">
                  <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <span>Com esta opção, o valor do frete cobrado no pedido será automaticamente descontado do faturamento e contabilizado como pagamento ao entregador no fechamento de caixa e relatórios.</span>
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteDriver} onOpenChange={(open) => { if (!open) setDeleteDriver(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover entregador?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover <strong>{deleteDriver?.name}</strong>? O histórico de pedidos atribuídos será mantido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
