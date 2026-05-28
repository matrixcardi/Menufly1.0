import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { CartProvider } from "@/contexts/CartContext";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ForceTheme } from "@/components/ForceTheme";
// Eager: super lightweight, used on hot paths
import MenuPage from "./pages/MenuPage";
import NotFound from "./pages/NotFound";

// Lazy: keep customer + admin bundles out of /:slug initial load
const LandingPage = lazy(() => import("./pages/LandingPage"));
const Index = lazy(() => import("./pages/Index"));
const OrderConfirmation = lazy(() => import("./pages/OrderConfirmation"));
const Checkout = lazy(() => import("./pages/Checkout"));
const CheckoutSuccess = lazy(() => import("./pages/CheckoutSuccess"));
const CheckoutCanceled = lazy(() => import("./pages/CheckoutCanceled"));
const CreateAccount = lazy(() => import("./pages/CreateAccount"));
const Unsubscribe = lazy(() => import("./pages/Unsubscribe"));
const HelpCenter = lazy(() => import("./pages/HelpCenter"));
const AdminAuth = lazy(() => import("./pages/admin/AdminAuth"));
const AdminResetPassword = lazy(() => import("./pages/admin/AdminResetPassword"));
const AdminLayout = lazy(() => import("./pages/admin/AdminLayout"));
const AdminMenu = lazy(() => import("./pages/admin/AdminMenu"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminOrders = lazy(() => import("./pages/admin/AdminOrders"));
const AdminCoupons = lazy(() => import("./pages/admin/AdminCoupons"));
const AdminAds = lazy(() => import("./pages/admin/AdminAds"));
const AdminReports = lazy(() => import("./pages/admin/AdminReports"));
const AdminBusiness = lazy(() => import("./pages/admin/AdminBusiness"));
const AdminCRM = lazy(() => import("./pages/admin/AdminCRM"));
const AdminDelivery = lazy(() => import("./pages/admin/AdminDelivery"));
const AdminPrinter = lazy(() => import("./pages/admin/AdminPrinter"));
const AdminCampaigns = lazy(() => import("./pages/admin/AdminCampaigns"));
const AdminWhatsAppBot = lazy(() => import("./pages/admin/AdminWhatsAppBot"));
const AdminPayments = lazy(() => import("./pages/admin/AdminPayments"));
const AdminAI = lazy(() => import("./pages/admin/AdminAI"));
const AdminCMV = lazy(() => import("./pages/admin/AdminCMV"));
const AdminHome = lazy(() => import("./pages/admin/AdminHome"));
const AdminDrivers = lazy(() => import("./pages/admin/AdminDrivers"));
const MasterAuth = lazy(() => import("./pages/master/MasterAuth"));
const MasterLayout = lazy(() => import("./pages/master/MasterLayout"));
const MasterDashboard = lazy(() => import("./pages/master/MasterDashboard"));
const MasterRestaurants = lazy(() => import("./pages/master/MasterRestaurants"));
const MasterRestaurantCRM = lazy(() => import("./pages/master/MasterRestaurantCRM"));
const MasterReports = lazy(() => import("./pages/master/MasterReports"));
const MasterAdmins = lazy(() => import("./pages/master/MasterAdmins"));
const MasterAccounts = lazy(() => import("./pages/master/MasterAccounts"));
const AdminCollaborators = lazy(() => import("./pages/admin/AdminCollaborators"));
const AdminIntegrations = lazy(() => import("./pages/admin/AdminIntegrations"));
const AdminSubscription = lazy(() => import("./pages/admin/AdminSubscription"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <CartProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
        <BrowserRouter>
          <Suspense fallback={null}>
          <Routes>
            {/* Landing Page */}
            <Route path="/" element={<ForceTheme theme="light"><LandingPage /></ForceTheme>} />
            
            {/* Customer Menu - Legacy route with query param */}
            <Route path="/menu" element={<Index />} />
            
            {/* Checkout */}
            <Route path="/checkout" element={<ForceTheme theme="light"><Checkout /></ForceTheme>} />
            <Route path="/checkout/sucesso" element={<ForceTheme theme="light"><CheckoutSuccess /></ForceTheme>} />
            <Route path="/checkout/cancelado" element={<ForceTheme theme="light"><CheckoutCanceled /></ForceTheme>} />
            <Route path="/criar-conta" element={<CreateAccount />} />
            <Route path="/pedido" element={<OrderConfirmation />} />
            <Route path="/unsubscribe" element={<Unsubscribe />} />
            <Route path="/ajuda" element={<ForceTheme theme="light"><HelpCenter /></ForceTheme>} />
            
            {/* Admin Panel */}
            <Route path="/admin/auth" element={<AdminAuth />} />
            <Route path="/admin/reset-password" element={<AdminResetPassword />} />
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminHome />} />
              <Route path="home" element={<AdminHome />} />
              <Route path="cardapio" element={<AdminMenu />} />
              <Route path="pedidos" element={<AdminOrders />} />
              <Route path="produtos" element={<AdminDashboard />} />
              <Route path="promos" element={<AdminCoupons />} />
              <Route path="cupons" element={<AdminCoupons />} /> {/* backward compat */}
              <Route path="entrega" element={<AdminDelivery />} />
              <Route path="ads" element={<AdminAds />} />
              <Route path="relatorios" element={<AdminReports />} />
              <Route path="negocio" element={<AdminBusiness />} />
              <Route path="pagamentos" element={<AdminPayments />} />
              <Route path="crm" element={<AdminCRM />} />
              <Route path="impressora" element={<AdminPrinter />} />
              <Route path="campanhas" element={<AdminCampaigns />} />
              <Route path="ia" element={<AdminAI />} />
              <Route path="cmv" element={<AdminCMV />} />
              <Route path="entregadores" element={<AdminDrivers />} />
              <Route path="colaboradores" element={<AdminCollaborators />} />
              <Route path="whatsapp-bot" element={<AdminWhatsAppBot />} />
              <Route path="integracoes" element={<AdminIntegrations />} />
              <Route path="assinatura" element={<AdminSubscription />} />
            </Route>
            
            {/* Master Panel */}
            <Route path="/master/auth" element={<MasterAuth />} />
            <Route path="/master" element={<ForceTheme theme="light"><MasterLayout /></ForceTheme>}>
              <Route index element={<MasterDashboard />} />
              <Route path="restaurantes" element={<MasterRestaurants />} />
              <Route path="contas" element={<MasterAccounts />} />
              <Route path="relatorios" element={<MasterReports />} />
              <Route path="admins" element={<MasterAdmins />} />
              <Route path="crm/:restaurantId" element={<MasterRestaurantCRM />} />
            </Route>
            
            {/* Customer Menu - Slug-based route (MUST be last to avoid conflicts) */}
            <Route path="/:slug" element={<MenuPage />} />
            
            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
          </BrowserRouter>
        </TooltipProvider>
      </CartProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
