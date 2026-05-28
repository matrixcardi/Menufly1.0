import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Mail, Lock, Loader2, Shield, Users, Eye, EyeOff } from "lucide-react";
import menuFlyLogo from "@/assets/menufly-logo-official.png";
import { performCleanSignOut, clearLocalAuthState } from "@/lib/auth-cleanup";

type LoginMode = "admin" | "collaborator";

export default function AdminAuth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [loginMode, setLoginMode] = useState<LoginMode>("admin");
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // CRITICAL: limpa qualquer sessão anterior + contexto de tenant ANTES do login
      // Evita "2 contas conectadas", tokens corrompidos e contaminação de localStorage.
      await performCleanSignOut();

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;

      if (loginMode === "collaborator") {
        // Verify collaborator role
        const { data: role } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", data.user.id)
          .eq("role", "collaborator")
          .maybeSingle();

        if (!role) {
          await supabase.auth.signOut();
          clearLocalAuthState();
          throw new Error("Esta conta não possui acesso de colaborador.");
        }
      } else {
        const { data: role } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", data.user.id)
          .eq("role", "admin")
          .maybeSingle();

        if (!role) {
          await supabase.auth.signOut();
          clearLocalAuthState();
          throw new Error("Esta conta não possui acesso de administrador.");
        }
      }

      localStorage.setItem("authAccessScope", loginMode);

      navigate("/admin");
    } catch (error: unknown) {
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Credenciais inválidas. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      toast({
        title: "Email obrigatório",
        description: "Por favor, insira seu email.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/admin/reset-password`,
      });

      setResetEmailSent(true);
      toast({
        title: "Email enviado!",
        description: "Se este email estiver cadastrado, você receberá um link de recuperação.",
      });
    } catch {
      toast({
        title: "Erro",
        description: "Ocorreu um erro. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (resetEmailSent) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <img 
              src={menuFlyLogo} 
              alt="MenuFly" 
              className="h-24 mx-auto mb-4"
            />
            <p className="text-muted-foreground mt-2">
              Recuperação de senha
            </p>
          </div>

          <div className="bg-card border border-border rounded-2xl p-8 shadow-lg text-center">
            <div className="mb-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Mail className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Email enviado!</h2>
              <p className="text-muted-foreground">
                Enviamos um link de recuperação para <strong>{email}</strong>. 
                Verifique sua caixa de entrada e spam.
              </p>
            </div>

            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => {
                setResetEmailSent(false);
                setIsForgotPassword(false);
                setEmail("");
              }}
            >
              Voltar ao login
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img 
            src={menuFlyLogo} 
            alt="MenuFly" 
            className="h-24 mx-auto mb-4"
          />
          <p className="text-muted-foreground mt-2">
            {isForgotPassword ? "Recuperar senha" : "Acesse seu painel"}
          </p>
        </div>

        {/* Login mode selector */}
        {!isForgotPassword && (
          <div className="flex gap-2 mb-4">
            <Button
              type="button"
              variant={loginMode === "admin" ? "default" : "outline"}
              className="flex-1 gap-2"
              onClick={() => setLoginMode("admin")}
            >
              <Shield className="w-4 h-4" />
              Administrador
            </Button>
            <Button
              type="button"
              variant={loginMode === "collaborator" ? "default" : "outline"}
              className="flex-1 gap-2"
              onClick={() => setLoginMode("collaborator")}
            >
              <Users className="w-4 h-4" />
              Colaborador
            </Button>
          </div>
        )}

        <div className="bg-card border border-border rounded-2xl p-8 shadow-lg">
          {isForgotPassword ? (
            <form onSubmit={handleForgotPassword} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email">Email cadastrado</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Informe o email cadastrado para receber o link de recuperação.
                </p>
              </div>

              <Button type="submit" className="w-full" size="lg" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : "Enviar link de recuperação"}
              </Button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setIsForgotPassword(false)}
                  className="text-sm text-primary hover:underline"
                >
                  Voltar ao login
                </button>
              </div>
            </form>
          ) : (
            <>
              <form onSubmit={handleLogin} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="seu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 pr-10"
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <Button type="submit" className="w-full" size="lg" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Carregando...
                    </>
                  ) : (
                    <>
                      {loginMode === "collaborator" && <Users className="mr-2 h-4 w-4" />}
                      {loginMode === "admin" ? "Entrar" : "Entrar como Colaborador"}
                    </>
                  )}
                </Button>
              </form>

              <div className="mt-6 text-center">
                <button
                  type="button"
                  onClick={() => setIsForgotPassword(true)}
                  className="text-sm text-primary hover:underline"
                >
                  Esqueceu sua senha?
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
