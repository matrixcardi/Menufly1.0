import { useEffect, useState } from "react";
import { Outlet, useNavigate, NavLink } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import adminBgLight from "@/assets/admin-bg-light.jpg";
import adminBgDark from "@/assets/admin-bg-dark.webp";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  LayoutDashboard, 
  Store, 
  LogOut, 
  Shield,
  FileText,
  UserPlus,
  Users
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { clearLocalAuthState, isRefreshTokenError } from "@/lib/auth-cleanup";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/master" },
  { label: "Restaurantes", icon: Store, path: "/master/restaurantes" },
  { label: "Contas", icon: Users, path: "/master/contas" },
  { label: "Relatórios", icon: FileText, path: "/master/relatorios" },
  { label: "Cadastrar Admin", icon: UserPlus, path: "/master/admins" },
];

export default function MasterLayout() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isMaster, setIsMaster] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const checkMasterAccess = async () => {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      // Refresh token corrompido → limpa e manda pro login
      if (sessionError && isRefreshTokenError(sessionError)) {
        clearLocalAuthState();
        navigate("/master/auth");
        return;
      }

      if (!session) {
        navigate("/master/auth");
        return;
      }

      setUserEmail(session.user.email || null);

      // Check if user has master role
      const { data: roles, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .eq("role", "master")
        .maybeSingle();

      if (error || !roles) {
        toast({
          title: "Acesso negado",
          description: "Você não tem permissão para acessar esta área.",
          variant: "destructive"
        });
        navigate("/admin");
        return;
      }

      setIsMaster(true);
      localStorage.setItem("authAccessScope", "master");
      setLoading(false);
    };

    checkMasterAccess();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    clearLocalAuthState();
    navigate("/master/auth");
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
    );
  }

  if (!isMaster) {
    return null;
  }

  return (
    <div className="flex h-screen relative">
      {/* Background - light */}
      <div 
        className="fixed inset-0 z-0 dark:hidden"
        style={{
          backgroundImage: `url(${adminBgLight})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
      {/* Background - dark */}
      <div 
        className="fixed inset-0 z-0 hidden dark:block"
        style={{
          backgroundImage: `url(${adminBgDark})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
      <div className="fixed inset-0 z-0 bg-background/60 dark:bg-background/50" />
      
      {/* Sidebar */}
      <aside className="w-64 border-r border-white/10 dark:border-white/5 bg-background/60 dark:bg-background/70 backdrop-blur-2xl flex flex-col relative z-10">
        <div className="p-4 border-b">
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            <span className="font-bold text-lg">Admin Master</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">{userEmail}</p>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/master"}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t">
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 text-muted-foreground"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" />
            Sair
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto relative z-10">
        <Outlet />
      </main>
    </div>
  );
}
