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
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from "@/components/ui/drawer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Users, Search, Mail, Calendar, Store, Pencil, Loader2, DollarSign, AlertTriangle, Download, Filter, ChevronDown, User, Building2, CreditCard, Clock, XCircle, CheckCircle2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Account {
  id: string;
  email: string | null;
  full_name: string | null;
  subscription_status: string | null;
  subscription_plan: string | null;
  subscription_period_end: string | null;
  subscription_period_start: string | null;
  cancel_at_period_end: boolean | null;
  created_at: string;
  restaurant_count: number;
  restaurant_names: string[];
  restaurant_id: string | null;
  restaurant_slug: string | null;
  role: string | null;
}

export default function MasterAccounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPlan, setFilterPlan] = useState<string>("all");
  const [filterExpiring, setFilterExpiring] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [editing, setEditing] = useState<Account | null>(null);
  const [editPlan, setEditPlan] = useState<string>("start");
  const [editStatus, setEditStatus] = useState<string>("trial");
  const [editRole, setEditRole] = useState<string>("admin");
  const [editName, setEditName] = useState<string>("");
  const [editEmail, setEditEmail] = useState<string>("");
  const [editRestaurantName, setEditRestaurantName] = useState<string>("");
  const [editRestaurantSlug, setEditRestaurantSlug] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set());
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("dados");

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, email, full_name, subscription_status, subscription_plan, created_at");

      if (profilesError) throw profilesError;

      const { data: restaurants, error: restaurantsError } = await supabase
        .from("restaurants")
        .select("id, user_id, name, slug, trial_ends_at");

      if (restaurantsError) throw restaurantsError;

      const { data: userRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");

      if (rolesError) throw rolesError;

      const restaurantsByUser = new Map<string, { names: string[]; id: string | null; slug: string | null; trial_ends_at: string | null }>();
      restaurants?.forEach((r) => {
        const existing = restaurantsByUser.get(r.user_id) || { names: [], id: null, slug: null, trial_ends_at: null };
        existing.names.push(r.name);
        if (!existing.id) existing.id = r.id;
        if (!existing.slug) existing.slug = r.slug;
        if (!existing.trial_ends_at) existing.trial_ends_at = r.trial_ends_at;
        restaurantsByUser.set(r.user_id, existing);
      });

      const rolesByUser = new Map<string, string>();
      userRoles?.forEach((r) => {
        rolesByUser.set(r.user_id, r.role);
      });

      const enriched: Account[] = (profiles || []).map((p: any) => {
        const restaurantData = restaurantsByUser.get(p.id) || { names: [], id: null, slug: null, trial_ends_at: null };
        return {
          id: p.id,
          email: p.email,
          full_name: p.full_name,
          subscription_status: p.subscription_status,
          subscription_plan: p.subscription_plan,
          subscription_period_end: restaurantData.trial_ends_at,
          subscription_period_start: null,
          cancel_at_period_end: false,
          created_at: p.created_at,
          restaurant_count: restaurantData.names.length,
          restaurant_names: restaurantData.names,
          restaurant_id: restaurantData.id,
          restaurant_slug: restaurantData.slug,
          role: rolesByUser.get(p.id) || null,
        };
      });

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
    const matchesSearch = !term ||
      a.email?.toLowerCase().includes(term) ||
      a.full_name?.toLowerCase().includes(term) ||
      a.restaurant_names.some((n) => n.toLowerCase().includes(term));
    
    const matchesRole = filterRole === "all" || a.role === filterRole;
    const matchesStatus = filterStatus === "all" || a.subscription_status === filterStatus;
    const matchesPlan = filterPlan === "all" || a.subscription_plan === filterPlan;
    
    const matchesExpiring = filterExpiring === "all" || 
      (filterExpiring === "7days" && (() => {
        if (!a.subscription_period_end) return false;
        const endDate = new Date(a.subscription_period_end);
        return endDate <= sevenDaysFromNow && endDate > now;
      })()) ||
      (filterExpiring === "30days" && (() => {
        if (!a.subscription_period_end) return false;
        const endDate = new Date(a.subscription_period_end);
        return endDate <= thirtyDaysFromNow && endDate > now;
      })()) ||
      (filterExpiring === "canceling" && a.cancel_at_period_end);
    
    return matchesSearch && matchesRole && matchesStatus && matchesPlan && matchesExpiring;
  }).sort((a, b) => {
    let comparison = 0;
    switch (sortBy) {
      case "created_at":
        comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        break;
      case "name":
        comparison = (a.full_name || "").localeCompare(b.full_name || "");
        break;
      case "status":
        comparison = (a.subscription_status || "").localeCompare(b.subscription_status || "");
        break;
      default:
        comparison = 0;
    }
    return sortOrder === "asc" ? comparison : -comparison;
  });

  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  const stats = {
    total: accounts.length,
    active: accounts.filter((a) => a.subscription_status === "active").length,
    trial: accounts.filter((a) => a.subscription_status === "trial").length,
    inactive: accounts.filter(
      (a) => !a.subscription_status || ["expired", "cancelled", "inactive"].includes(a.subscription_status)
    ).length,
    mrr: accounts.filter((a) => a.subscription_status === "active").length * 99, // Valor médio estimado
    renewingToday: accounts.filter((a) => {
      if (!a.subscription_period_end) return false;
      const endDate = new Date(a.subscription_period_end);
      const endDay = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
      return endDay.getTime() === today.getTime();
    }).length,
    expiringIn7Days: accounts.filter((a) => {
      if (!a.subscription_period_end) return false;
      const endDate = new Date(a.subscription_period_end);
      return endDate <= sevenDaysFromNow && endDate > now;
    }).length,
    canceling: accounts.filter((a) => a.cancel_at_period_end).length,
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
      case "inactive":
        return <Badge variant="outline">Inativo</Badge>;
      default:
        return <Badge variant="outline">{status || "—"}</Badge>;
    }
  };

  const getRoleBadge = (role: string | null) => {
    switch (role) {
      case "master":
        return <Badge className="bg-purple-500 hover:bg-purple-600">Master</Badge>;
      case "admin":
        return <Badge className="bg-blue-500 hover:bg-blue-600">Admin</Badge>;
      case "collaborator":
        return <Badge className="bg-orange-500 hover:bg-orange-600">Colaborador</Badge>;
      default:
        return <Badge variant="outline">{role || "—"}</Badge>;
    }
  };

  const getPlanBadge = (plan: string | null) => {
    switch (plan) {
      case "elite":
        return <Badge className="bg-purple-500 hover:bg-purple-600">Elite</Badge>;
      case "start":
        return <Badge className="bg-emerald-500 hover:bg-emerald-600">Start</Badge>;
      case "assessoria":
        return <Badge className="bg-orange-500 hover:bg-orange-600">Assessoria</Badge>;
      default:
        return <Badge variant="outline">{plan || "—"}</Badge>;
    }
  };

  const getExpirationInfo = (periodEnd: string | null, cancelAtEnd: boolean | null) => {
    if (!periodEnd) return null;
    const endDate = new Date(periodEnd);
    const now = new Date();
    const daysUntilExpiry = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    let text = "";
    let colorClass = "";
    
    if (daysUntilExpiry < 0) {
      const daysExpired = Math.abs(daysUntilExpiry);
      text = daysExpired === 1 ? "Expirado há 1 dia" : `Expirado há ${daysExpired} dias`;
      colorClass = "text-red-600";
    } else if (daysUntilExpiry === 0) {
      text = "Vence hoje";
      colorClass = "text-red-600";
    } else if (daysUntilExpiry === 1) {
      text = "Vence amanhã";
      colorClass = "text-red-600";
    } else if (daysUntilExpiry <= 2) {
      text = `Vence em ${daysUntilExpiry} dias`;
      colorClass = "text-red-600";
    } else if (daysUntilExpiry <= 7) {
      text = `Vence em ${daysUntilExpiry} dias`;
      colorClass = "text-amber-600";
    } else if (daysUntilExpiry <= 15) {
      text = `Vence em ${daysUntilExpiry} dias`;
      colorClass = "text-yellow-600";
    } else {
      text = `Vence em ${daysUntilExpiry} dias`;
      colorClass = "text-emerald-600";
    }
    
    if (cancelAtEnd) {
      text += " (cancelando)";
    }
    
    return { text, colorClass, daysUntilExpiry };
  };


  const openEdit = (acc: Account) => {
    setEditing(acc);
    setEditName(acc.full_name || "");
    setEditEmail(acc.email || "");
    setEditPlan(acc.subscription_plan || "start");
    setEditStatus(acc.subscription_status || "trial");
    setEditRole(acc.role || "admin");
    setEditRestaurantName(acc.restaurant_names[0] || "");
    setEditRestaurantSlug(acc.restaurant_slug || "");
    setDrawerOpen(true);
    setActiveTab("dados");
  };

  const handleSelectAccount = (accountId: string) => {
    const newSelected = new Set(selectedAccounts);
    if (newSelected.has(accountId)) {
      newSelected.delete(accountId);
    } else {
      newSelected.add(accountId);
    }
    setSelectedAccounts(newSelected);
    setShowBulkActions(newSelected.size > 0);
  };

  const handleSelectAll = () => {
    if (selectedAccounts.size === filtered.length) {
      setSelectedAccounts(new Set());
      setShowBulkActions(false);
    } else {
      setSelectedAccounts(new Set(filtered.map(a => a.id)));
      setShowBulkActions(true);
    }
  };

  const handleBulkAction = async (action: string) => {
    try {
      if (action === "export") {
        const csv = [
          ["Nome", "Email", "Role", "Restaurante", "Plano", "Status", "Cadastro"].join(","),
          ...filtered.map(a => [
            a.full_name || "",
            a.email || "",
            a.role || "",
            a.restaurant_names.join("; "),
            a.subscription_plan || "",
            a.subscription_status || "",
            new Date(a.created_at).toLocaleDateString("pt-BR")
          ].join(","))
        ].join("\n");
        
        const blob = new Blob([csv], { type: "text/csv" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "contas.csv";
        a.click();
        toast({ title: "CSV exportado com sucesso" });
      }
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      // Update profile
      const { data: updatedProfile, error: profileError } = await supabase
        .from("profiles")
        .update({ 
          full_name: editName,
          subscription_status: editStatus,
          subscription_plan: editPlan
        })
        .eq("id", editing.id)
        .select();

      if (profileError) throw profileError;

      if (!updatedProfile || updatedProfile.length === 0) {
        throw new Error("Não foi possível atualizar o perfil. Verifique as permissões.");
      }

      // Update role
      const { data: existingRole, error: fetchRoleError } = await supabase
        .from("user_roles")
        .select("id")
        .eq("user_id", editing.id)
        .maybeSingle();

      if (fetchRoleError) {
        console.error("[DEBUG] Erro ao buscar role atual:", fetchRoleError);
        throw fetchRoleError;
      }

      if (existingRole) {
        const { data: updatedRole, error: roleError } = await supabase
          .from("user_roles")
          .update({ role: editRole })
          .eq("user_id", editing.id)
          .select();
          
        if (roleError) {
          console.error("[DEBUG] Erro ao atualizar role:", roleError);
          throw roleError;
        }
        
        if (!updatedRole || updatedRole.length === 0) {
          throw new Error("Não foi possível atualizar a role. Verifique as permissões na tabela user_roles.");
        }
      } else {
        const { data: insertedRole, error: roleError } = await supabase
          .from("user_roles")
          .insert({ user_id: editing.id, role: editRole })
          .select();
          
        if (roleError) {
          console.error("[DEBUG] Erro ao inserir role:", roleError);
          throw roleError;
        }
        
        if (!insertedRole || insertedRole.length === 0) {
          throw new Error("Não foi possível inserir a role. Verifique as permissões na tabela user_roles.");
        }
      }

      // Update restaurant if exists
      if (editing.restaurant_id) {
        const { data: updatedRestaurant, error: restaurantError } = await supabase
          .from("restaurants")
          .update({ 
            name: editRestaurantName,
            slug: editRestaurantSlug
          })
          .eq("id", editing.restaurant_id)
          .select();
          
        if (restaurantError) throw restaurantError;
        
        if (!updatedRestaurant || updatedRestaurant.length === 0) {
          throw new Error("Não foi possível atualizar o restaurante. Verifique as permissões.");
        }
      }

      toast({ title: "Conta atualizada", description: "Alterações salvas com sucesso." });
      setDrawerOpen(false);
      setEditing(null);
      await fetchAccounts();
    } catch (err: any) {
      console.error("[DEBUG] Erro completo ao atualizar conta:", err);
      toast({ 
        title: "Erro ao atualizar", 
        description: err.message || "Erro desconhecido ao salvar alterações.", 
        variant: "destructive" 
      });
    } finally {
      setSaving(false);
    }
  };

  const resetPassword = async () => {
    if (!editing?.email) return;
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(editing.email, {
        redirectTo: `${window.location.origin}/reset-password`
      });
      if (error) throw error;
      toast({ title: "Email enviado", description: "Email de reset de senha enviado com sucesso." });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };


  return (
    <div className="p-6 md:p-10 w-full space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Users className="h-8 w-8" /> Contas Cadastradas
        </h1>
        <p className="text-muted-foreground mt-1">
          Visualize todos os usuários cadastrados no sistema, ativos ou não.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
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
            <CardTitle className="text-sm font-medium text-muted-foreground">Renovam hoje</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{stats.renewingToday}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Vencem em 7 dias</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{stats.expiringIn7Days}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Cancelando</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.canceling}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por email, nome ou restaurante..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <Select value={filterRole} onValueChange={setFilterRole}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="master">Master</SelectItem>
              <SelectItem value="collaborator">Colaborador</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="active">Ativo</SelectItem>
              <SelectItem value="trial">Trial</SelectItem>
              <SelectItem value="expired">Expirado</SelectItem>
              <SelectItem value="inactive">Inativo</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterPlan} onValueChange={setFilterPlan}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Plano" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="start">Start</SelectItem>
              <SelectItem value="elite">Elite</SelectItem>
              <SelectItem value="assessoria">Assessoria</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterExpiring} onValueChange={setFilterExpiring}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Vencimento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="7days">Vencem em 7 dias</SelectItem>
              <SelectItem value="30days">Vencem em 30 dias</SelectItem>
              <SelectItem value="canceling">Cancelando</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Ordenar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="created_at">Cadastro</SelectItem>
              <SelectItem value="name">Nome</SelectItem>
              <SelectItem value="status">Status</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}>
            <ChevronDown className={`h-4 w-4 transition-transform ${sortOrder === "desc" ? "rotate-180" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Bulk Actions */}
      {showBulkActions && (
        <div className="flex items-center gap-2 p-4 bg-muted rounded-lg">
          <span className="text-sm font-medium">{selectedAccounts.size} selecionados</span>
          <Button size="sm" variant="outline" onClick={() => handleBulkAction("export")}>
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
          <Button size="sm" variant="outline" onClick={() => setSelectedAccounts(new Set())}>
            Limpar seleção
          </Button>
        </div>
      )}

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
                  <TableHead className="w-[50px] text-xs">
                    <Checkbox checked={selectedAccounts.size === filtered.length && filtered.length > 0} onCheckedChange={handleSelectAll} />
                  </TableHead>
                  <TableHead className="text-xs">Usuário</TableHead>
                  <TableHead className="text-xs">Email</TableHead>
                  <TableHead className="text-xs">Role</TableHead>
                  <TableHead className="text-xs">Restaurante</TableHead>
                  <TableHead className="text-xs">Plano</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">Vence em</TableHead>
                  <TableHead className="text-xs">Próxima cobrança</TableHead>
                  <TableHead className="text-xs">Cadastro</TableHead>
                  <TableHead className="w-[60px] text-xs">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((acc) => (
                  <TableRow key={acc.id}>
                      <TableCell>
                        <Checkbox checked={selectedAccounts.has(acc.id)} onCheckedChange={() => handleSelectAccount(acc.id)} />
                      </TableCell>
                      <TableCell className="font-medium text-xs py-2">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <User className="h-3.5 w-3.5 text-primary" />
                          </div>
                          <span className="truncate block">{acc.full_name || <span className="text-muted-foreground italic">sem nome</span>}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs py-2">
                        <div className="flex items-center gap-1">
                          <Mail className="h-3 w-3 text-muted-foreground shrink-0" />
                          <span className="truncate">{acc.email || "—"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs py-2">{getRoleBadge(acc.role)}</TableCell>
                      <TableCell className="text-xs py-2">
                        {acc.restaurant_count > 0 ? (
                          <div className="flex items-center gap-1">
                            <Building2 className="h-3 w-3 text-muted-foreground shrink-0" />
                            <span className="truncate" title={acc.restaurant_names.join(", ")}>
                              {acc.restaurant_names.join(", ")}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs py-2">{getPlanBadge(acc.subscription_plan)}</TableCell>
                      <TableCell className="text-xs py-2">{getStatusBadge(acc.subscription_status)}</TableCell>
                      <TableCell className="text-xs py-2">
                        {(() => {
                          const info = getExpirationInfo(acc.subscription_period_end, acc.cancel_at_period_end);
                          if (!info) return <span className="text-muted-foreground">—</span>;
                          return <span className={info.colorClass}>{info.text}</span>;
                        })()}
                      </TableCell>
                      <TableCell className="text-xs py-2">
                        {acc.subscription_period_end ? (
                          <span>{new Date(acc.subscription_period_end).toLocaleDateString("pt-BR")}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs py-2">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          {new Date(acc.created_at).toLocaleDateString("pt-BR")}
                        </div>
                      </TableCell>
                      <TableCell className="py-2">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(acc)} className="h-6 w-6">
                          <Pencil className="h-3 w-3" />
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

      {/* Edit Drawer */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent className="max-w-2xl mx-auto">
          <DrawerHeader>
            <DrawerTitle>Editar Conta</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-4">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="dados">Dados</TabsTrigger>
                <TabsTrigger value="assinatura">Assinatura</TabsTrigger>
                <TabsTrigger value="restaurante">Restaurante</TabsTrigger>
              </TabsList>
              <TabsContent value="dados" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Nome completo</Label>
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
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
                  <Label>Status da assinatura</Label>
                  <Select value={editStatus} onValueChange={setEditStatus}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Ativo</SelectItem>
                      <SelectItem value="trial">Trial</SelectItem>
                      <SelectItem value="inactive">Inativo</SelectItem>
                      <SelectItem value="expired">Expirado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Plano</Label>
                  <Select value={editPlan} onValueChange={setEditPlan}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="start">Start</SelectItem>
                      <SelectItem value="elite">Elite</SelectItem>
                      <SelectItem value="assessoria">Assessoria</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={resetPassword} className="flex-1">
                    Resetar senha
                  </Button>
                </div>
              </TabsContent>
              <TabsContent value="assinatura" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Plano atual</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-lg font-bold">{getPlanBadge(editing?.subscription_plan)}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Status</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-lg font-bold">{getStatusBadge(editing?.subscription_status)}</div>
                    </CardContent>
                  </Card>
                </div>
                <div className="space-y-2">
                  <Label>Cadastro</Label>
                  <div className="text-sm font-medium">
                    {editing?.created_at ? new Date(editing.created_at).toLocaleDateString("pt-BR") : "—"}
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="restaurante" className="space-y-4 mt-4">
                {editing?.restaurant_id ? (
                  <>
                    <div className="space-y-2">
                      <Label>Nome do restaurante</Label>
                      <Input value={editRestaurantName} onChange={(e) => setEditRestaurantName(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Slug do cardápio</Label>
                      <Input value={editRestaurantSlug} onChange={(e) => setEditRestaurantSlug(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Link do cardápio</Label>
                      <div className="text-sm text-muted-foreground break-all">
                        {editRestaurantSlug ? `${window.location.origin}/${editRestaurantSlug}` : "—"}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    Este usuário não possui restaurante cadastrado
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
          <DrawerFooter>
            <Button variant="outline" onClick={() => setDrawerOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={saveEdit} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar alterações
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
