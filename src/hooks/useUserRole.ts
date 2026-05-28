import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export type UserRole = "admin" | "collaborator" | "master" | null;
type AccessScope = "admin" | "collaborator" | "master" | null;

const RESTRICTED_ROUTES = [
  "/admin/relatorios",
  "/admin/pagamentos",
  "/admin/entrega",
];

export function useUserRole(userId: string | undefined, accessScope?: AccessScope) {
  const [role, setRole] = useState<UserRole>(null);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const currentUserIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!userId) {
      // NÃO finaliza o loading aqui — userId pode ser undefined temporariamente
      // enquanto o Supabase ainda está restaurando a sessão.
      // Só limpamos o role, mas mantemos loading: true para não barrar ninguém.
      setRole(null);
      setRestaurantId(null);
      return;
    }

    currentUserIdRef.current = userId;
    setLoading(true);

    async function fetchRole() {
      try {
        const { data: roles, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId!)
          .in("role", ["admin", "master", "collaborator"]);

        if (currentUserIdRef.current !== userId) return;

        if (error) {
          console.error("[useUserRole] Erro ao buscar role:", error.message);
          setTimeout(() => {
            if (currentUserIdRef.current === userId) fetchRole();
          }, 2000);
          return;
        }

        if (!roles || roles.length === 0) {
          setRole(null);
          setLoading(false);
          return;
        }

        const roleMap = roles.map(r => r.role as UserRole);

        const savedScope = typeof window !== "undefined"
          ? (localStorage.getItem("authAccessScope") as AccessScope)
          : null;

        const requestedScope = accessScope ?? savedScope;

        if (requestedScope === "master" && roleMap.includes("master")) {
          setRole("master");

        } else if (requestedScope === "admin" && roleMap.includes("admin")) {
          setRole("admin");

        } else if (requestedScope === "collaborator" && roleMap.includes("collaborator")) {
          setRole("collaborator");
          await fetchCollaboratorRestaurant(userId!);

        } else {
          // localStorage vazio ou scope não bate — usa o role mais importante do banco
          // e corrige o localStorage automaticamente
          if (roleMap.includes("master")) {
            setRole("master");
            if (typeof window !== "undefined") localStorage.setItem("authAccessScope", "master");

          } else if (roleMap.includes("admin")) {
            setRole("admin");
            if (typeof window !== "undefined") localStorage.setItem("authAccessScope", "admin");

          } else {
            setRole("collaborator");
            await fetchCollaboratorRestaurant(userId!);
          }
        }
      } catch (err) {
        console.error("[useUserRole] Exceção inesperada:", err);
        setTimeout(() => {
          if (currentUserIdRef.current === userId) fetchRole();
        }, 2000);
        return;
      }

      setLoading(false);
    }

    async function fetchCollaboratorRestaurant(uid: string) {
      try {
        const { data: collab } = await supabase
          .from("restaurant_collaborators")
          .select("restaurant_id")
          .eq("user_id", uid)
          .maybeSingle();

        if (currentUserIdRef.current !== uid) return;
        if (collab) setRestaurantId(collab.restaurant_id);
      } catch (err) {
        console.error("[useUserRole] Erro ao buscar restaurante do colaborador:", err);
      }
    }

    fetchRole();

    return () => {
      currentUserIdRef.current = undefined;
    };
  }, [userId, accessScope]);

  const isCollaborator = role === "collaborator";

  const canAccess = (route: string) => {
    if (!isCollaborator) return true;
    return !RESTRICTED_ROUTES.some(r => route.startsWith(r));
  };

  return { role, isCollaborator, restaurantId, loading, canAccess };
}
