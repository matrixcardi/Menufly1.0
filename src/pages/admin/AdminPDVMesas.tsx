import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurantContext } from "@/contexts/RestaurantContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/useUserRole";
import {
  Armchair,
  Plus,
  Settings,
  Clock,
  DollarSign,
  Loader2,
  X,
  ArrowRight,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";

interface Table {
  id: string;
  name: string;
  number: number;
  capacity: number;
  status: "free" | "occupied" | "bill_requested";
  current_order_id: string | null;
  position_x: number;
  position_y: number;
  created_at: string;
}

interface Order {
  id: string;
  items: any[];
  total_amount: number;
  created_at: string;
}

export default function AdminPDVMesas() {
  const { selectedRestaurantId, selectedRestaurantIds, selectedRestaurant } = useRestaurantContext();
  const { user } = useRestaurantContext();
  const { isCollaborator } = useUserRole(user?.id);
  const ctxRestaurantId = selectedRestaurantId === "all" ? selectedRestaurantIds[0] : selectedRestaurantId;
  const { toast } = useToast();

  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewTableDialog, setShowNewTableDialog] = useState(false);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [showDrawer, setShowDrawer] = useState(false);
  const [selectedTableOrder, setSelectedTableOrder] = useState<Order | null>(null);
  const [newTableName, setNewTableName] = useState("");
  const [newTableNumber, setNewTableNumber] = useState("");
  const [newTableCapacity, setNewTableCapacity] = useState("4");

  useEffect(() => {
    fetchTables();
  }, [ctxRestaurantId]);

  const fetchTables = async () => {
    try {
      if (!ctxRestaurantId) {
        setLoading(false);
        return;
      }

      const { data: tablesData } = await supabase
        .from("pdv_tables")
        .select("*")
        .eq("restaurant_id", ctxRestaurantId)
        .order("number");

      if (tablesData) {
        setTables(tablesData);
      }
    } catch (error) {
      console.error("Error fetching tables:", error);
      toast({ title: "Erro", description: "Erro ao carregar mesas", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTable = async () => {
    if (!ctxRestaurantId || !newTableName || !newTableNumber) {
      toast({ title: "Erro", description: "Preencha todos os campos", variant: "destructive" });
      return;
    }

    try {
      const { error } = await supabase.from("pdv_tables").insert({
        restaurant_id: ctxRestaurantId,
        name: newTableName,
        number: parseInt(newTableNumber),
        capacity: parseInt(newTableCapacity),
        status: "free",
      });

      if (error) throw error;

      toast({ title: "Sucesso", description: "Mesa criada com sucesso" });
      setShowNewTableDialog(false);
      setNewTableName("");
      setNewTableNumber("");
      setNewTableCapacity("4");
      fetchTables();
    } catch (error) {
      console.error("Error creating table:", error);
      toast({ title: "Erro", description: "Erro ao criar mesa", variant: "destructive" });
    }
  };

  const handleTableClick = async (table: Table) => {
    setSelectedTable(table);
    if (table.status === "occupied" || table.status === "bill_requested") {
      // Fetch order details
      if (table.current_order_id) {
        const { data: orderData } = await supabase
          .from("orders")
          .select("*")
          .eq("id", table.current_order_id)
          .single();

        if (orderData) {
          setSelectedTableOrder(orderData);
        }
      }
      setShowDrawer(true);
    }
  };

  const handleCloseBill = () => {
    // Open payment modal - similar to PDV
    toast({ title: "Info", description: "Funcionalidade de fechar conta em desenvolvimento" });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "free":
        return "bg-green-500";
      case "occupied":
        return "bg-red-500";
      case "bill_requested":
        return "bg-yellow-500";
      default:
        return "bg-gray-500";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "free":
        return "Livre";
      case "occupied":
        return "Ocupada";
      case "bill_requested":
        return "Conta Pedida";
      default:
        return status;
    }
  };

  const getTimeOccupied = (table: Table) => {
    if (!table.current_order_id || table.status === "free") return null;
    const created = new Date(table.created_at);
    const now = new Date();
    const diff = Math.floor((now.getTime() - created.getTime()) / 60000); // minutes
    if (diff < 60) return `${diff} min`;
    return `${Math.floor(diff / 60)}h ${diff % 60}min`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-border p-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
          <Armchair className="w-6 h-6" />
          Mesas
        </h1>
        <div className="flex gap-2">
          <Button
            onClick={() => setShowNewTableDialog(true)}
            className="bg-orange-500 hover:bg-orange-600 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nova Mesa
          </Button>
          <Button variant="outline">
            <Settings className="w-4 h-4 mr-2" />
            Configurar Mesas
          </Button>
        </div>
      </div>

      {/* Tables Grid */}
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {tables.map((table) => (
            <Card
              key={table.id}
              className={`cursor-pointer hover:shadow-lg transition-all ${
                table.status === "occupied" ? "ring-2 ring-red-500" : ""
              }`}
              onClick={() => handleTableClick(table)}
            >
              <CardContent className="p-4">
                <div className={`${getStatusColor(table.status)} w-3 h-3 rounded-full mb-2`} />
                <h3 className="font-bold text-lg">{table.name}</h3>
                <p className="text-sm text-muted-foreground">Mesa {table.number}</p>
                <div className="mt-2 space-y-1 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Capacidade:</span>
                    <span className="font-medium">{table.capacity} pessoas</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Status:</span>
                    <span className="font-medium">{getStatusText(table.status)}</span>
                  </div>
                  {table.status !== "free" && getTimeOccupied(table) && (
                    <div className="flex items-center gap-2">
                      <Clock className="w-3 h-3" />
                      <span className="font-medium">{getTimeOccupied(table)}</span>
                    </div>
                  )}
                  {selectedTableOrder && selectedTable?.id === table.id && (
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-3 h-3" />
                      <span className="font-medium">R$ {selectedTableOrder.total_amount.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* New Table Dialog */}
      <Dialog open={showNewTableDialog} onOpenChange={setShowNewTableDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Mesa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                placeholder="Ex: Mesa 1"
                value={newTableName}
                onChange={(e) => setNewTableName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="number">Número</Label>
              <Input
                id="number"
                type="number"
                placeholder="Ex: 1"
                value={newTableNumber}
                onChange={(e) => setNewTableNumber(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="capacity">Capacidade</Label>
              <Input
                id="capacity"
                type="number"
                placeholder="Ex: 4"
                value={newTableCapacity}
                onChange={(e) => setNewTableCapacity(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewTableDialog(false)}>
              Cancelar
            </Button>
            <Button
              className="bg-orange-500 hover:bg-orange-600 text-white"
              onClick={handleCreateTable}
            >
              Criar Mesa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Table Drawer */}
      <Sheet open={showDrawer} onOpenChange={setShowDrawer}>
        <SheetContent className="w-[400px]">
          <SheetHeader>
            <SheetTitle>{selectedTable?.name}</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            {selectedTableOrder && (
              <>
                <div className="border rounded-lg p-4">
                  <h3 className="font-semibold mb-2">Itens do Pedido</h3>
                  <div className="space-y-2">
                    {selectedTableOrder.items.map((item: any, index: number) => (
                      <div key={index} className="flex justify-between text-sm">
                        <span>{item.quantity}x {item.name}</span>
                        <span>R$ {(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="border-t mt-2 pt-2 flex justify-between font-bold">
                    <span>Total</span>
                    <span className="text-primary">R$ {selectedTableOrder.total_amount.toFixed(2)}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Button className="w-full" variant="outline">
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar Itens
                  </Button>
                  <Button className="w-full" variant="outline">
                    <ArrowRight className="w-4 h-4 mr-2" />
                    Transferir Mesa
                  </Button>
                  <Button
                    className="w-full bg-orange-500 hover:bg-orange-600 text-white"
                    onClick={handleCloseBill}
                  >
                    Fechar Conta
                  </Button>
                </div>
              </>
            )}
          </div>
          <SheetFooter>
            <Button variant="outline" onClick={() => setShowDrawer(false)}>
              Fechar
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
