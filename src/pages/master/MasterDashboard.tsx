import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Store, Users, ShoppingBag, TrendingUp } from "lucide-react";

interface Stats {
  totalRestaurants: number;
  activeRestaurants: number;
  totalOrders: number;
  totalRevenue: number;
}

export default function MasterDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Fetch all restaurants (using the view that bypasses RLS for masters)
        const { data: restaurants, error: restError } = await supabase
          .from("all_restaurants")
          .select("id, is_open");

        if (restError) throw restError;

        // Fetch all orders
        const { data: orders, error: ordersError } = await supabase
          .from("all_orders")
          .select("total");

        if (ordersError) throw ordersError;

        const totalRevenue = orders?.reduce((sum, order) => sum + (Number(order.total) || 0), 0) || 0;

        setStats({
          totalRestaurants: restaurants?.length || 0,
          activeRestaurants: restaurants?.filter(r => r.is_open).length || 0,
          totalOrders: orders?.length || 0,
          totalRevenue,
        });
      } catch (error) {
        console.error("Error fetching stats:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const statCards = [
    {
      title: "Total de Restaurantes",
      value: stats?.totalRestaurants || 0,
      icon: Store,
      description: "Restaurantes cadastrados",
    },
    {
      title: "Restaurantes Ativos",
      value: stats?.activeRestaurants || 0,
      icon: Users,
      description: "Online agora",
    },
    {
      title: "Total de Pedidos",
      value: stats?.totalOrders || 0,
      icon: ShoppingBag,
      description: "Pedidos realizados",
    },
    {
      title: "Faturamento Total",
      value: `R$ ${(stats?.totalRevenue || 0).toFixed(2).replace(".", ",")}`,
      icon: TrendingUp,
      description: "Receita da plataforma",
    },
  ];

  if (loading) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.title}
              </CardTitle>
              <card.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
              <p className="text-xs text-muted-foreground">{card.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
