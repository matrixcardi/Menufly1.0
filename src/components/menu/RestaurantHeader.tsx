import { Star, Truck, MapPin } from "lucide-react";

interface Restaurant {
  id: string;
  name: string;
  logo_url: string | null;
  banner_url: string | null;
  is_open: boolean;
  delivery_available: boolean;
  pickup_available: boolean;
  description?: string | null;
}

interface RestaurantHeaderProps {
  restaurant: Restaurant;
  isCurrentlyOpen?: boolean;
  nextOpenTime?: string | null;
}

export function RestaurantHeader({ restaurant, isCurrentlyOpen = true, nextOpenTime }: RestaurantHeaderProps) {
  return (
    <div className="relative">
      {/* Banner */}
      <div className="h-32 bg-gradient-to-br from-primary/80 to-primary overflow-hidden">
        {restaurant.banner_url ? (
          <img
            src={restaurant.banner_url}
            alt="Banner"
            className="w-full h-full object-cover opacity-80"
          />
        ) : (
          <div 
            className="w-full h-full bg-cover bg-center opacity-60"
            style={{
              backgroundImage: `url('https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&auto=format&fit=crop&q=60')`,
            }}
          />
        )}
      </div>

      {/* Rating Badge */}
      <div className="absolute top-3 right-3 flex items-center gap-1 bg-primary text-primary-foreground px-2 py-1 rounded-lg text-sm font-bold shadow-lg">
        <Star className="w-4 h-4 fill-current" />
        5.0
      </div>

      {/* Profile Section - Overlapping */}
      <div className="relative -mt-12 px-4">
        {/* Profile Photo */}
        <div className="w-24 h-24 mx-auto rounded-full border-4 border-background bg-card shadow-lg overflow-hidden flex items-center justify-center">
          {restaurant.logo_url ? (
            <img
              src={restaurant.logo_url}
              alt={restaurant.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-secondary to-muted flex items-center justify-center">
              <span className="text-3xl">🍔</span>
            </div>
          )}
        </div>

        {/* Restaurant Info */}
        <div className="text-center mt-3">
          <h1 className="text-xl font-bold text-foreground">{restaurant.name}</h1>
          
          {/* Description */}
          {restaurant.description && (
            <p className="text-sm text-muted-foreground mt-2 px-4 max-w-md mx-auto">
              {restaurant.description}
            </p>
          )}
          
          <div className="flex items-center justify-center gap-1.5 mt-2">
            <span 
              className={`w-2 h-2 rounded-full ${isCurrentlyOpen ? "bg-green-500" : "bg-amber-500"}`} 
            />
            <span className="text-sm text-muted-foreground">
              {isCurrentlyOpen ? "Aberto agora" : nextOpenTime ? `Abre ${nextOpenTime}` : "Fechado"}
            </span>
          </div>

          {/* Delivery Options */}
          <div className="flex items-center justify-center gap-4 mt-3">
            {restaurant.delivery_available && (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Truck className="w-4 h-4" />
                <span>Entrega</span>
              </div>
            )}
            {restaurant.pickup_available && (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin className="w-4 h-4" />
                <span>Retirada</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Closed Warning */}
      {!isCurrentlyOpen && (
        <div className="mx-4 mt-4 mb-4 py-2 px-3 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-lg text-sm text-center font-medium">
          {nextOpenTime ? `Loja fechada, abre ${nextOpenTime}` : "Loja fechada no momento"}
        </div>
      )}
    </div>
  );
}
