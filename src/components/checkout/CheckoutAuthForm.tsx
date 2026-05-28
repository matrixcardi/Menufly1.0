import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Lock, Loader2, User } from "lucide-react";
import { toast } from "sonner";

interface CheckoutAuthFormProps {
  onAuthenticated: () => void;
}

export default function CheckoutAuthForm({ onAuthenticated }: CheckoutAuthFormProps) {
  const [mode, setMode] = useState<"login" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === "signup") {
        if (!fullName.trim()) {
          toast.error("Informe seu nome completo.");
          setLoading(false);
          return;
        }
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        toast.success("Conta criada com sucesso!");
        onAuthenticated();
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        onAuthenticated();
      }
    } catch (error: any) {
      const msg = error.message?.includes("already registered")
        ? "Este email já está cadastrado. Faça login."
        : error.message || "Erro ao processar. Tente novamente.";
      toast.error(msg);
      if (error.message?.includes("already registered")) {
        setMode("login");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-center space-y-1">
        <p className="text-sm text-muted-foreground">
          {mode === "signup"
            ? "Crie sua conta para continuar com a assinatura"
            : "Faça login para continuar com a assinatura"}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {mode === "signup" && (
          <div className="space-y-1.5">
            <Label htmlFor="checkout-name" className="text-xs">Nome completo</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="checkout-name"
                type="text"
                placeholder="Seu nome"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="pl-9 h-10 rounded-xl"
                required
              />
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="checkout-email" className="text-xs">Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="checkout-email"
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-9 h-10 rounded-xl"
              required
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="checkout-password" className="text-xs">Senha</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="checkout-password"
              type="password"
              placeholder="Mínimo 6 caracteres"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-9 h-10 rounded-xl"
              minLength={6}
              required
            />
          </div>
        </div>

        <Button type="submit" className="w-full rounded-xl h-10" disabled={loading}>
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : null}
          {mode === "signup" ? "Criar conta e continuar" : "Entrar e continuar"}
        </Button>
      </form>

      <p className="text-xs text-center text-muted-foreground">
        {mode === "signup" ? (
          <>
            Já tem conta?{" "}
            <button type="button" onClick={() => setMode("login")} className="text-primary hover:underline font-medium">
              Fazer login
            </button>
          </>
        ) : (
          <>
            Não tem conta?{" "}
            <button type="button" onClick={() => setMode("signup")} className="text-primary hover:underline font-medium">
              Criar conta
            </button>
          </>
        )}
      </p>
    </div>
  );
}
