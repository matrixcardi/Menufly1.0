import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Users, Search, Mail, Calendar, Store, Pencil, Loader2, RefreshCw } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Account {
  id: string;
  email: string | null;
  full_name: string | null;
  subscription_status: string | null;
  subscription_plan: string | null;
  created_at: string;
  restaurant_count: number;
  restaurant_names: string[];
  role: string | null;
}

export default function MasterAccounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Account | null>(null);
  const [editPlan, setEditPlan] = useState<string>("start");
  const [editStatus, setEditStatus] = useState<string>("trial");
  const [editRole, setEditRole] = useState<string>("admin");
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, email, full_name, subscription_status, subscription_plan, created_at")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      const { data: restaurants, error: restaurantsError } = await supabase
        .from("restaurants")
        .select("user_id, name");

      if (restaurantsError) throw restaurantsError;

      const { data: userRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");

      if (rolesError) throw rolesError;

      const restaurantsByUser = new Map<string, string[]>();
      restaurants?.forEach((r) => {
        const list = restaurantsByUser.get(r.user_id) || [];
        list.push(r.name);
        restaurantsByUser.set(r.user_id, list);
      });

      const rolesByUser = new Map<string, string>();
      userRoles?.forEach((r) => {
        rolesByUser.set(r.user_id, r.role);
      });

      const enriched: Account[] = (profiles || []).map((p) => ({
        ...p,
        restaurant_count: restaurantsByUser.get(p.id)?.length || 0,
        restaurant_names: restaurantsByUser.get(p.id) || [],
        role: rolesByUser.get(p.id) || null,
      }));

      setAccounts(enriched);
    } catch (err: any) {
      toast({
        title: "Erro ao carregar contas",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filtered = accounts.filter((a) => {
    const term = search.toLowerCase().trim();
    if (!term) return true;
    return (
      a.email?.toLowerCase().includes(term) ||
      a.full_name?.toLowerCase().includes(term) ||
      a.restaurant_names.some((n) => n.toLowerCase().includes(term))
    );
  });

  const stats = {
    total: accounts.length,
    active: accounts.filter((a) => a.subscription_status === "active").length,
    trial: accounts.filter((a) => a.subscription_status === "trial").length,
    inactive: accounts.filter(
      (a) => !a.subscription_status || ["expired", "cancelled", "inactive"].includes(a.subscription_status)
    ).length,
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "active":
        return <Badge className="bg-emerald-500 hover:bg-emerald-600">Ativo</Badge>;
      case "trial":
        return <Badge className="bg-blue-500 hover:bg-blue-600">Trial</Badge>;
      case "expired":
        return <Badge variant="destructive">Expirado</Badge>;
      case "cancelled":
        return <Badge variant="secondary">Cancelado</Badge>;
      default:
        return <Badge variant="outline">{status || "—"}</Badge>;
    }
  };

  const openEdit = (acc: Account) => {
    setEditing(acc);
    setEditPlan(acc.subscription_plan || "start");
    setEditStatus(acc.subscription_status || "trial");
    setEditRole(acc.role || "admin");
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      // Check if role already exists for this user
      const { data: existingRole } = await supabase
        .from("user_roles")
        .select("id")
        .eq("user_id", editing.id)
        .maybeSingle();

      // Update or insert role in user_roles
      if (existingRole) {
        const { error: roleError } = await supabase
          .from("user_roles")
          .update({ role: editRole })
          .eq("user_id", editing.id);

        if (roleError) throw roleError;
      } else {
        const { error: roleError } = await supabase
          .from("user_roles")
          .insert({ user_id: editing.id, role: editRole });

        if (roleError) throw roleError;
      }

      // Update subscription_status in profiles
      const { error: statusError } = await supabase
        .from("profiles")
        .update({ subscription_status: editStatus })
        .eq("id", editing.id);

      if (statusError) throw statusError;

      toast({ title: "Conta atualizada", description: "Role e status alterados com sucesso." });
      setEditing(null);
      await fetchAccounts();
    } catch (err: any) {
      toast({ title: "Erro ao atualizar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const syncStripe = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-stripe-subscriptions");
      if (error) throw error;
      toast({
        title: "Sincronização concluída",
        description: `${data?.updated ?? 0} conta(s) atualizadas a partir do Stripe.`,
      });
      await fetchAccounts();
    } catch (err: any) {
      toast({ title: "Erro ao sincronizar", description: err.message, variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Users className="h-8 w-8" /> Contas Cadastradas
        </h1>
        <p className="text-muted-foreground mt-1">
          Visualize todos os usuários cadastrados no sistema, ativos ou não.
        </p>
        <div className="mt-3">
          <Button onClick={syncStripe} disabled={syncing} variant="outline" size="sm">
            {syncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Sincronizar pagamentos Stripe
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ativos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{stats.active}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Em Trial</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.trial}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Inativos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-muted-foreground">{stats.inactive}</div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por email, nome ou restaurante..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              Nenhuma conta encontrada.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px] text-xs">Usuário</TableHead>
                  <TableHead className="min-w-[180px] text-xs">Email</TableHead>
                  <TableHead className="w-[70px] text-xs">Role</TableHead>
                  <TableHead className="w-[180px] text-xs">Restaurante(s)</TableHead>
                  <TableHead className="w-[70px] text-xs">Plano</TableHead>
                  <TableHead className="w-[70px] text-xs">Status</TableHead>
                  <TableHead className="w-[60px] text-xs">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((acc) => (
                  <TableRow key={acc.id}>
                    <TableCell className="font-medium text-xs">
                      <span className="truncate block">{acc.full_name || <span className="text-muted-foreground italic">sem nome</span>}</span>
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="flex items-center gap-1.5">
                        <Mail className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span className="truncate">{acc.email || "—"}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">
                      <Badge variant="outline" className="capitalize text-xs">
                        {acc.role || "—"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {acc.role === 'admin' ? (
                        acc.restaurant_count === 0 ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <div className="flex items-center gap-1">
                            <Store className="h-3 w-3 text-muted-foreground shrink-0" />
                            <span className="truncate" title={acc.restaurant_names.join(", ")}>
                              {acc.restaurant_names.join(", ")}
                            </span>
                          </div>
                        )
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      <Badge variant="outline" className="capitalize text-xs">
                        {acc.subscription_plan || "—"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{getStatusBadge(acc.subscription_status)}</TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost" onClick={() => openEdit(acc)} className="h-7 w-7">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center">
        Mostrando {filtered.length} de {accounts.length} contas
      </p>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar conta</DialogTitle>
            <DialogDescription>
              Altere a role e o status do usuário.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome</Label>
              <div className="text-sm font-medium">{editing?.full_name || "—"}</div>
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <div className="text-sm text-muted-foreground">{editing?.email || "—"}</div>
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={editRole} onValueChange={setEditRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="master">Master</SelectItem>
                  <SelectItem value="collaborator">Colaborador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={editStatus} onValueChange={setEditStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="trial">Trial</SelectItem>
                  <SelectItem value="inactive">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>Cancelar</Button>
            <Button onClick={saveEdit} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
