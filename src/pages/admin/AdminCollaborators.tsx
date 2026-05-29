import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurantContext } from "@/contexts/RestaurantContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, Loader2, Eye, EyeOff, Users, Trash2, Shield } from "lucide-react";
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

interface Collaborator {
  id: string;
  user_id: string;
  created_at: string;
  email?: string;
  full_name?: string;
  cargo?: string;
}

export default function AdminCollaborators() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [cargo, setCargo] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const MAX_COLLABORATORS = 1;

  const { selectedRestaurantId, selectedRestaurantIds } = useRestaurantContext();
  const ctxRestaurantId = selectedRestaurantId === "all" ? selectedRestaurantIds[0] : selectedRestaurantId;

  const fetchCollaborators = async () => {
    if (!ctxRestaurantId) return;

    const { data } = await supabase
      .from("restaurant_collaborators")
      .select("id, user_id, created_at")
      .eq("restaurant_id", ctxRestaurantId)
      .order("created_at", { ascending: false });

    if (data) {
      // Fetch profiles for emails and cargo
      const userIds = data.map(c => c.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email, full_name, raw_user_meta_data")
        .in("id", userIds);

      const enriched = data.map(c => {
        const profile = profiles?.find(p => p.id === c.user_id);
        return {
          ...c,
          email: profile?.email || "—",
          full_name: profile?.full_name || undefined,
          cargo: profile?.raw_user_meta_data?.cargo as string || undefined,
        };
      });

      setCollaborators(enriched);
    }

    setLoadingList(false);
  };

  useEffect(() => {
    fetchCollaborators();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      toast({ title: "Campos obrigatórios", description: "Email e senha são obrigatórios.", variant: "destructive" });
      return;
    }

    if (password.length < 6) {
      toast({ title: "Senha fraca", description: "A senha deve ter no mínimo 6 caracteres.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const response = await supabase.functions.invoke("create-collaborator", {
        body: { email, password, full_name: fullName || undefined, cargo: cargo || undefined, restaurant_id: ctxRestaurantId },
      });

      if (response.error) {
        throw new Error(response.error.message || "Erro ao criar colaborador.");
      }

      const result = response.data;
      if (result.error) {
        throw new Error(result.error);
      }

      toast({
        title: "Colaborador criado com sucesso!",
        description: `Credenciais: Email: ${email} | Senha: ${password}`,
      });
      setEmail("");
      setPassword("");
      setFullName("");
      setCargo("");
      fetchCollaborators();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);

    try {
      const { error } = await supabase
        .from("restaurant_collaborators")
        .delete()
        .eq("id", deleteId);

      if (error) throw error;

      toast({ title: "Colaborador removido" });
      setCollaborators(prev => prev.filter(c => c.id !== deleteId));
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  };

  const canAddMore = collaborators.length < MAX_COLLABORATORS;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Colaboradores</h1>
        <p className="text-muted-foreground">
          Gerencie os acessos de colaboradores ao seu painel.
        </p>
      </div>

      {/* Plan info */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4 flex items-center gap-3">
          <Shield className="h-5 w-5 text-primary" />
          <div className="flex-1">
            <p className="text-sm font-medium">Seu plano</p>
            <p className="text-xs text-muted-foreground">
              {collaborators.length}/{MAX_COLLABORATORS} colaborador(es) utilizado(s)
            </p>
          </div>
          <Badge variant={canAddMore ? "secondary" : "destructive"}>
            {canAddMore ? "Disponível" : "Limite atingido"}
          </Badge>
        </CardContent>
      </Card>

      {/* Existing collaborators */}
      {collaborators.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5" />
              Colaboradores ativos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {collaborators.map((collab) => (
              <div
                key={collab.id}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border"
              >
                <div>
                  <p className="font-medium text-sm">{collab.full_name || collab.email}</p>
                  {collab.cargo && (
                    <p className="text-xs text-primary font-medium">{collab.cargo}</p>
                  )}
                  {collab.full_name && (
                    <p className="text-xs text-muted-foreground">{collab.email}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Adicionado em {new Date(collab.created_at).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => setDeleteId(collab.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Info about restrictions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Permissões do colaborador</CardTitle>
          <CardDescription>
            Colaboradores têm acesso restrito. Eles <strong>NÃO</strong> poderão:
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-center gap-2">
              <span className="text-destructive">✕</span> Acessar Configurações (entrega, pagamentos, impressora, etc)
            </li>
            <li className="flex items-center gap-2">
              <span className="text-destructive">✕</span> Acessar CMV, Campanhas, CRM, IA Criativa
            </li>
            <li className="flex items-center gap-2">
              <span className="text-destructive">✕</span> Acessar FINANCEIRO (Visão Geral, DRE, Custos, Extrato)
            </li>
            <li className="flex items-center gap-2">
              <span className="text-destructive">✕</span> Acessar GESTÃO (Estoque, Fornecedores, Lista de Compras, Agenda)
            </li>
            <li className="flex items-center gap-2">
              <span className="text-destructive">✕</span> Editar Cardápio Digital, Produtos e Categorias, Promos
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-600">✓</span> Acompanhar Pedidos
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-600">✓</span> Visualizar Cardápio Digital (modo leitura)
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-600">✓</span> Acessar Relatórios básicos
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Create form */}
      {canAddMore && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Novo Colaborador
            </CardTitle>
            <CardDescription>
              Crie um login e senha para seu colaborador acessar o painel.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Nome completo *</Label>
                <Input
                  id="fullName"
                  placeholder="Nome do colaborador"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  disabled={loading}
                  maxLength={100}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cargo">Cargo/Função *</Label>
                <Input
                  id="cargo"
                  placeholder="Ex: Caixa, Garçom, Cozinheiro"
                  value={cargo}
                  onChange={(e) => setCargo(e.target.value)}
                  disabled={loading}
                  maxLength={50}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="colaborador@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Senha temporária *</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Mínimo 6 caracteres"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    required
                    minLength={6}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="bg-muted/50 p-3 rounded-lg text-xs text-muted-foreground">
                <p>O colaborador deverá acessar pela mesma tela de login:</p>
                <p className="font-mono mt-1 text-foreground">{window.location.origin}/admin/auth</p>
                <p className="mt-1">E selecionar a opção <strong>"Colaborador"</strong>.</p>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Criando...
                  </>
                ) : (
                  <>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Criar Colaborador
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover colaborador?</AlertDialogTitle>
            <AlertDialogDescription>
              O colaborador perderá acesso ao painel. Você poderá adicionar um novo depois.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleting ? "Removendo..." : "Remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
