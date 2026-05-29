import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, User, Mail, Lock, MapPin, Store, CheckCircle, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { Logo } from "@/components/Logo";
import { logger } from "@/lib/logger";
import { validateEmail, validateName } from "@/lib/validations";

export default function CreateAccount() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const sessionId = searchParams.get("session_id");

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
    address: "",
    restaurantName: "",
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear error when user types
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: "" }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    // Validate full name
    const nameValidation = validateName(formData.fullName);
    if (!nameValidation.valid) {
      newErrors.fullName = nameValidation.error;
    }

    // Validate email
    const emailValidation = validateEmail(formData.email);
    if (!emailValidation.valid) {
      newErrors.email = emailValidation.error;
    }

    // Validate password
    if (formData.password.length < 6) {
      newErrors.password = "Senha deve ter pelo menos 6 caracteres";
    }
    if (formData.password.length > 100) {
      newErrors.password = "Senha muito longa (máximo 100 caracteres)";
    }

    // Validate address
    if (formData.address.length < 5) {
      newErrors.address = "Endereço deve ter pelo menos 5 caracteres";
    }
    if (formData.address.length > 300) {
      newErrors.address = "Endereço muito longo (máximo 300 caracteres)";
    }

    // Validate restaurant name
    if (formData.restaurantName.length < 2) {
      newErrors.restaurantName = "Nome do restaurante deve ter pelo menos 2 caracteres";
    }
    if (formData.restaurantName.length > 100) {
      newErrors.restaurantName = "Nome muito longo (máximo 100 caracteres)";
    }

    // Validate password confirmation
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "As senhas não coincidem";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      // 1. Create the user account
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/admin`,
          data: {
            full_name: formData.fullName,
          },
        },
      });

      if (signUpError) {
        if (signUpError.message.includes("already registered")) {
          setErrors({ email: "Este email já está cadastrado" });
        } else {
          toast({
            title: "Erro ao criar conta",
            description: signUpError.message,
            variant: "destructive",
          });
        }
        setLoading(false);
        return;
      }

      if (!signUpData.user) {
        toast({
          title: "Erro ao criar conta",
          description: "Não foi possível criar a conta. Tente novamente.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // 2. Update the profile with additional info
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          full_name: formData.fullName,
        })
        .eq("id", signUpData.user.id);

      if (profileError) {
        logger.error("Error updating profile:", profileError);
      }

      // 3. Update the restaurant with the name and address
      const { error: restaurantError } = await supabase
        .from("restaurants")
        .update({
          name: formData.restaurantName,
          address: formData.address,
        })
        .eq("user_id", signUpData.user.id);

      if (restaurantError) {
        logger.error("Error updating restaurant:", restaurantError);
      }

      toast({
        title: "Conta criada com sucesso!",
        description: "Você será redirecionado para o painel administrativo.",
      });

      // Send welcome email with credentials
      try {
        await supabase.functions.invoke("send-transactional-email", {
          body: {
            templateName: "welcome-menufly",
            recipientEmail: formData.email,
            idempotencyKey: `welcome-${signUpData.user.id}`,
            templateData: {
              name: formData.fullName,
              email: formData.email,
              password: formData.password,
              restaurantName: formData.restaurantName,
              planName: sessionId ? "MenuFly" : undefined,
            },
          },
        });
      } catch (emailErr) {
        logger.error("Failed to send welcome email:", emailErr);
      }

      // Redirect to admin panel
      setTimeout(() => {
        navigate("/admin");
      }, 1500);

    } catch (err) {
      logger.error("Create account error:", err);
      toast({
        title: "Erro ao criar conta",
        description: "Ocorreu um erro inesperado. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-lg"
      >
        <Card className="border-2">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-4">
              <Logo className="h-10 w-auto" />
            </div>
            
            {/* Success Badge */}
            <div className="flex items-center justify-center gap-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full px-4 py-2 mx-auto mb-4">
              <CheckCircle className="w-4 h-4" />
              <span className="text-sm font-medium">Pagamento Confirmado!</span>
            </div>

            <CardTitle className="text-2xl">Complete seu cadastro</CardTitle>
            <CardDescription>
              Preencha os dados abaixo para criar sua conta e configurar seu restaurante
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Full Name */}
              <div className="space-y-2">
                <Label htmlFor="fullName">Nome completo</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="fullName"
                    name="fullName"
                    placeholder="Seu nome completo"
                    value={formData.fullName}
                    onChange={handleChange}
                    className={`pl-10 ${errors.fullName ? "border-destructive" : ""}`}
                    disabled={loading}
                  />
                </div>
                {errors.fullName && (
                  <p className="text-xs text-destructive">{errors.fullName}</p>
                )}
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={formData.email}
                    onChange={handleChange}
                    className={`pl-10 ${errors.email ? "border-destructive" : ""}`}
                    disabled={loading}
                  />
                </div>
                {errors.email && (
                  <p className="text-xs text-destructive">{errors.email}</p>
                )}
              </div>

              {/* Password */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      placeholder="••••••"
                      value={formData.password}
                      onChange={handleChange}
                      className={`pl-10 ${errors.password ? "border-destructive" : ""}`}
                      disabled={loading}
                    />
                  </div>
                  {errors.password && (
                    <p className="text-xs text-destructive">{errors.password}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirmar</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="confirmPassword"
                      name="confirmPassword"
                      type="password"
                      placeholder="••••••"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      className={`pl-10 ${errors.confirmPassword ? "border-destructive" : ""}`}
                      disabled={loading}
                    />
                  </div>
                  {errors.confirmPassword && (
                    <p className="text-xs text-destructive">{errors.confirmPassword}</p>
                  )}
                </div>
              </div>

              {/* Restaurant Name */}
              <div className="space-y-2">
                <Label htmlFor="restaurantName">Nome do Restaurante</Label>
                <div className="relative">
                  <Store className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="restaurantName"
                    name="restaurantName"
                    placeholder="Ex: Burger House, Pizzaria do João..."
                    value={formData.restaurantName}
                    onChange={handleChange}
                    className={`pl-10 ${errors.restaurantName ? "border-destructive" : ""}`}
                    disabled={loading}
                  />
                </div>
                {errors.restaurantName && (
                  <p className="text-xs text-destructive">{errors.restaurantName}</p>
                )}
              </div>

              {/* Address */}
              <div className="space-y-2">
                <Label htmlFor="address">Endereço do Restaurante</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="address"
                    name="address"
                    placeholder="Rua, número, bairro, cidade - UF"
                    value={formData.address}
                    onChange={handleChange}
                    className={`pl-10 ${errors.address ? "border-destructive" : ""}`}
                    disabled={loading}
                  />
                </div>
                {errors.address && (
                  <p className="text-xs text-destructive">{errors.address}</p>
                )}
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                size="lg"
                className="w-full text-lg mt-6"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Criando conta...
                  </>
                ) : (
                  <>
                    Criar Conta e Acessar Painel
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </>
                )}
              </Button>

              <p className="text-xs text-center text-muted-foreground mt-4">
                Ao criar sua conta, você concorda com nossos Termos de Uso e Política de Privacidade
              </p>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
