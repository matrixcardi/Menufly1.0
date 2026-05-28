import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Store, 
  Search, 
  Users,
  ExternalLink,
  Settings
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Restaurant {
  id: string;
  name: string;
  logo_url: string | null;
  is_open: boolean;
  created_at: string;
  user_id: string;
  owner_email: string | null;
  owner_name: string | null;
}

export default function MasterRestaurants() {
  const navigate = useNavigate();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const fetchRestaurants = async () => {
      try {
        const { data, error } = await supabase
          .from("all_restaurants")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) throw error;
        setRestaurants(data || []);
      } catch (error) {
        console.error("Error fetching restaurants:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchRestaurants();
  }, []);

  const filteredRestaurants = restaurants.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.owner_email?.toLowerCase().includes(search.toLowerCase()) ||
    r.owner_name?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-6">Restaurantes</h1>
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Restaurantes</h1>
        <Badge variant="secondary" className="text-sm">
          {restaurants.length} cadastrados
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, email ou proprietário..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Restaurante</TableHead>
                <TableHead>Proprietário</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRestaurants.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Nenhum restaurante encontrado
                  </TableCell>
                </TableRow>
              ) : (
                filteredRestaurants.map((restaurant) => (
                  <TableRow key={restaurant.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {restaurant.logo_url ? (
                          <img
                            src={restaurant.logo_url}
                            alt={restaurant.name}
                            className="h-10 w-10 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                            <Store className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                        <span className="font-medium">{restaurant.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {restaurant.owner_name || "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {restaurant.owner_email || "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={restaurant.is_open ? "default" : "secondary"}>
                        {restaurant.is_open ? "Online" : "Offline"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(restaurant.created_at), "dd/MM/yyyy", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/master/crm/${restaurant.id}`)}
                        >
                          <Users className="h-4 w-4 mr-2" />
                          CRM
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            localStorage.setItem("authAccessScope", "master");
                            localStorage.setItem("masterManaging", "true");
                            localStorage.setItem("masterManagedRestaurantId", restaurant.id);
                            localStorage.removeItem("selectedRestaurantId");
                            navigate("/admin");
                          }}
                        >
                          <Settings className="h-4 w-4 mr-2" />
                          Gerenciar
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
