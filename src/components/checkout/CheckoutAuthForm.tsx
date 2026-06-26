import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Lock, Loader2, User, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { validateEmail, validateName } from "@/lib/validations";
import { translateError } from "@/lib/error-messages";

interface CheckoutAuthFormProps {
  onAuthenticated: () => void;
}

export default function CheckoutAuthForm({ onAuthenticated }: CheckoutAuthFormProps) {
  const [mode, setMode] = useState<"login" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; fullName?: string }>({});
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate fields
    const fieldErrors: { email?: string; fullName?: string } = {};
    
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      fieldErrors.email = emailValidation.error;
    }

    if (mode === "signup") {
      const nameValidation = validateName(fullName);
      if (!nameValidation.valid) {
        fieldErrors.fullName = nameValidation.error;
      }
    }

    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }

    setLoading(true);

    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
            emailRedirectTo: `${window.location.origin}/checkout`,
          },
        });
        if (error) throw error;
        setAwaitingConfirmation(true);
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        onAuthenticated();
      }
    } catch (error: any) {
      const translatedError = translateError(error);
      toast.error(translatedError);
      if (error.message?.includes("already registered")) {
        setMode("login");
      }
    } finally {
      setLoading(false);
    }
  };

  if (awaitingConfirmation) {
    return (
      <div className="text-center space-y-4 py-4">
        <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
          <Mail className="w-7 h-7 text-primary" />
        </div>
        <div className="space-y-1.5">
          <p className="font-semibold">Confirme seu email para continuar</p>
          <p className="text-sm text-muted-foreground">
            Enviamos um link para{" "}
            <span className="font-medium text-foreground">{email}</span>.
            Clique nele e você voltará automaticamente para finalizar sua assinatura.
          </p>
        </div>
        <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground bg-muted/50 rounded-xl p-3">
          <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
          Após confirmar, esta página carregará o pagamento automaticamente
        </div>
        <button
          type="button"
          onClick={() => setAwaitingConfirmation(false)}
          className="text-xs text-muted-foreground hover:text-foreground underline"
        >
          Usar outro email
        </button>
      </div>
    );
  }

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
                onChange={(e) => {
                  setFullName(e.target.value);
                  setErrors(prev => ({ ...prev, fullName: undefined }));
                }}
                className={`pl-9 h-10 rounded-xl ${errors.fullName ? "border-destructive" : ""}`}
                required
              />
            </div>
            {errors.fullName && (
              <p className="text-xs text-destructive">{errors.fullName}</p>
            )}
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
              onChange={(e) => {
                setEmail(e.target.value);
                setErrors(prev => ({ ...prev, email: undefined }));
              }}
              className={`pl-9 h-10 rounded-xl ${errors.email ? "border-destructive" : ""}`}
              required
            />
          </div>
          {errors.email && (
            <p className="text-xs text-destructive">{errors.email}</p>
          )}
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
