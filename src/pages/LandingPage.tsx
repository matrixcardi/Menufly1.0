import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Bell, Check, ChefHat, Clock, CreditCard, MessageSquare, PieChart, Rocket, ShoppingBag, Smartphone, Star, Target, TrendingUp, Users, Zap, Play, Crosshair, Sparkles, Bot, Calculator, Truck, Megaphone, Contact, Tag, MessageCircle } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState, useRef } from "react";
import type { Easing } from "framer-motion";
import { motion, useInView } from "framer-motion";
import { Logo } from "@/components/Logo";
import { useCheckout } from "@/hooks/useCheckout";
import heroVideo480 from "@/assets/hero-bg-video-480.mp4";
import heroVideo1080 from "@/assets/hero-bg-video.mp4";
import heroPoster from "@/assets/burger-2.jpg";
import testimonialBurger from "@/assets/testimonial-burger.jpg";
import testimonialSushi from "@/assets/testimonial-sushi.jpg";
import testimonialFineDining from "@/assets/testimonial-fine-dining.jpg";
import testimonialPizza from "@/assets/testimonial-pizza.jpg";
import testimonialAcai from "@/assets/testimonial-acai.jpg";
import landingIaCriativa from "@/assets/landing-ia-criativa.jpg";
import landingAppMobile from "@/assets/landing-app-mobile.jpg";

import clientArteEAlho from "@/assets/clients/arte-e-alho.png";
import clientDivino from "@/assets/clients/divino.png";
import clientKaizen from "@/assets/clients/kaizen.png";
import clientMizu from "@/assets/clients/mizu.png";
import clientPizzaBis from "@/assets/clients/pizza-bis.png";
import clientSanTelmo from "@/assets/clients/san-telmo.png";
import clientUmai from "@/assets/clients/umai.png";

const clientLogos = [
  { name: "Arte e Alho", logo: clientArteEAlho },
  { name: "Divino", logo: clientDivino },
  { name: "Kaizen Burgers", logo: clientKaizen },
  { name: "Mizu Japan", logo: clientMizu },
  { name: "Pizza Bis", logo: clientPizzaBis },
  { name: "San Telmo", logo: clientSanTelmo },
  { name: "Umai Sushi", logo: clientUmai },
];

const testimonials = [
  {
    name: "San Telmo Burger",
    location: "Capão da Canoa, RS",
    image: testimonialBurger,
    quote: "Saímos de R$ 40k/mês para mais de R$ 100k/mês após implementar o MenuFly. A integração com Facebook Ads mudou completamente nosso jogo.",
    metric: "+162%",
    metricLabel: "de crescimento",
    result: "De R$40 mil para R$105 mil/mês em apenas 40 dias",
  },
  {
    name: "Kaizen Burgers",
    location: "São Paulo, SP",
    image: testimonialPizza,
    quote: "Com apenas R$1.500 de investimento em anúncios, aumentamos em mais de R$32 mil por mês o faturamento bruto — tudo em estrutura própria, pagando zero taxa. O retorno foi absurdo.",
    metric: "0%",
    metricLabel: "de taxa",
    result: "+R$17 mil/mês com R$1.500 em ads com estrutura própria",
  },
  {
    name: "Mizu Japan",
    location: "Belo Horizonte, MG",
    image: testimonialSushi,
    quote: "Nosso delivery de comida japonesa ganhou mais de R$20 mil em vendas por mês investindo apenas R$1.500 em anúncios. O funil trouxe clientes que realmente compram e voltam a pedir.",
    metric: "13x",
    metricLabel: "de retorno",
    result: "+R$20 mil/mês investindo R$1.500 em anúncios",
  },
];

const stats = [
  { value: "R$ 5M+", label: "Gerenciados em ads" },
  { value: "150+", label: "Restaurantes atendidos" },
  { value: "12.4x", label: "ROAS médio" },
  { value: "Imediato", label: "Primeiros resultados" },
];

const features = [
  {
    icon: Target,
    title: "Integração com Facebook Ads",
    description: "Pixel nativo e eventos de conversão otimizados para melhorar em até 70% os resultados das suas campanhas",
  },
  {
    icon: TrendingUp,
    title: "Integração com Google Ads",
    description: "Conversões Enhanced e remarketing automático para maximizar o ROI dos seus anúncios",
  },
  {
    icon: ShoppingBag,
    title: "Checkout de Alta Conversão",
    description: "O processo de compra mais simplificado do mercado - aumente em até 40% suas conversões",
  },
  {
    icon: Smartphone,
    title: "Cardápio Otimizado para Ads",
    description: "Design pensado para tráfego pago, com carregamento ultra-rápido e experiência mobile-first",
  },
  {
    icon: PieChart,
    title: "Analytics de Conversão",
    description: "Acompanhe cada etapa do funil e identifique onde otimizar para vender mais",
  },
  {
    icon: MessageSquare,
    title: "WhatsApp + Remarketing",
    description: "Recupere carrinhos abandonados e fidelize clientes com automações inteligentes",
  },
];

const deepFeatures = [
  {
    icon: Crosshair,
    badge: "Diferencial",
    title: "Trackeamento Absoluto",
    headline: "Saiba exatamente de onde vem cada real faturado.",
    description: "Enquanto outros cardápios te deixam no escuro, o MenuFly rastreia cada clique, cada visualização, cada pedido. Pixel nativo Meta, Google Ads Enhanced Conversions e eventos personalizados — tudo configurado em segundos. Você sabe qual campanha vendeu, qual criativo converteu e onde está perdendo dinheiro. Sem achismo, só dados.",
    highlight: "Até 70% de melhora no ROAS com trackeamento preciso",
  },
  {
    icon: Sparkles,
    badge: "I.A",
    title: "I.A Criativa",
    headline: "Crie conteúdos dos seus produtos sem precisar de designer.",
    description: "Gere descrições irresistíveis, legendas para redes sociais e artes visuais dos seus produtos com inteligência artificial. Chega de ficar horas quebrando a cabeça pra criar conteúdo. Em poucos cliques a IA entende seu produto e entrega uma copy que vende — pronta pra usar nos seus anúncios, stories e cardápio.",
    highlight: "Conteúdo profissional em segundos, não em dias",
  },
  {
    icon: Bot,
    badge: "Automação",
    title: "ChatBot que Funciona de Verdade",
    headline: "Atendimento automático que vende — sem confundir seu cliente.",
    description: "Esqueça aqueles bots genéricos que mais atrapalham do que ajudam. Nosso ChatBot inteligente entende o contexto do pedido, responde com naturalidade e guia o cliente até a finalização. Atualizações automáticas de status, confirmação de pedido e feedback — tudo sem você precisar tocar no celular.",
    highlight: "Atendimento 24h que realmente converte em vendas",
  },
  {
    icon: Calculator,
    badge: "Gestão",
    title: "CMV Inteligente",
    headline: "Domine os números e mantenha a saúde financeira do seu negócio.",
    description: "Cadastre seus ingredientes, monte fichas técnicas e descubra o custo real de cada produto. O MenuFly calcula automaticamente sua margem de lucro e te alerta quando um prato está comendo seu lucro. Pare de precificar no chute — tenha controle total da sua operação.",
    highlight: "Precificação baseada em dados, não em achismo",
  },
  {
    icon: Truck,
    badge: "Logística",
    title: "Entregadores Vinculados",
    headline: "Facilite suas entregas com automação de ponta a ponta.",
    description: "Vincule seus entregadores diretamente aos pedidos. Com um toque, o motoboy recebe todas as informações do pedido e o endereço abre direto no Google Maps via WhatsApp — automaticamente. Sem ligação, sem confusão, sem atraso. Gestão de corridas, valor por entrega e controle total da sua frota.",
    highlight: "Endereço + pedido enviados automaticamente via WhatsApp",
  },
  {
    icon: Megaphone,
    badge: "Marketing",
    title: "Campanhas de Alta Conversão",
    headline: "Aumente suas vendas com mensagens estratégicas no momento certo.",
    description: "Dispare campanhas segmentadas para sua base de clientes via WhatsApp. Clientes que não compram há 15 dias? Mande um cupom. Cliente VIP? Ofereça exclusividade. Agende disparos, personalize mensagens e acompanhe resultados em tempo real. Marketing direto que realmente gera pedidos.",
    highlight: "Campanhas segmentadas que reativam clientes dormentes",
  },
  {
    icon: Contact,
    badge: "CRM",
    title: "CRM Integrado",
    headline: "Acompanhe a jornada do seu cliente e venda mais — sempre.",
    description: "Conheça seus clientes como nunca: frequência de compra, ticket médio, produto favorito, última compra. Identifique seus clientes VIP, descubra quem está sumindo e crie ações certeiras para cada perfil. Não é só cadastrar contato — é transformar dados em faturamento.",
    highlight: "Visão 360° de cada cliente do seu delivery",
  },
  {
    icon: Tag,
    badge: "Promos",
    title: "Aba Promos no Cardápio",
    headline: "Destaque seus cupons e promoções onde o cliente realmente vê.",
    description: "Chega de cupom escondido. A aba Promos coloca suas ofertas em destaque direto no cardápio — cupons, combos e kits promocionais com visual profissional. O cliente entra, vê a oferta e compra. Simples assim. Você controla tudo: validade, desconto, pedido mínimo e agendamento por dia e horário.",
    highlight: "Promoções visíveis = mais conversão = mais faturamento",
  },
  {
    icon: Smartphone,
    badge: "App Mobile",
    title: "App Mobile Completo",
    headline: "Seu restaurante inteiro no bolso — literalmente.",
    description: "Gerencie tudo direto do celular: acompanhe pedidos em tempo real, edite o cardápio, consulte relatórios, responda clientes e controle entregas. Notificações instantâneas a cada novo pedido. É como ter um painel de controle profissional no seu bolso, funcionando 24 horas. Sem precisar estar na frente do computador.",
    highlight: "Gestão completa do delivery na palma da mão",
  },
];

const sharedPlanFeatures = [
  "Cardápio digital ilimitado",
  "Pedidos ilimitados",
  "Integração WhatsApp",
  "Painel administrativo completo",
  "Relatórios e métricas",
  "Suporte prioritário",
  "Cupons e promoções",
  "Gestão de entrega",
  "Pagamento Online",
  "IA Criativa",
];

const eliteExclusiveFeatures = [
  "10 créditos/mês de IA Criativa",
  "1.000 mensagens/mês WhatsApp",
  "B.I. Financeira",
  "CMV Inteligente",
  "WhatsApp Bot (automação)",
];

/* ── Animation helpers ── */
const customEase: [number, number, number, number] = [0.16, 1, 0.3, 1];

const fadeUp = {
  hidden: { opacity: 0, y: 24, filter: "blur(4px)" },
  visible: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.65, ease: customEase } },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.09 } },
};

function Reveal({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.2 });
  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
      variants={{ hidden: { opacity: 0, y: 20, filter: "blur(4px)" }, visible: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.6, delay, ease: customEase } } }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export default function LandingPage() {
  const navigate = useNavigate();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [heroVideoReady, setHeroVideoReady] = useState(false);
  const { startCheckout, isLoading: isCheckoutLoading } = useCheckout();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setIsLoggedIn(!!session);
      setLoading(false);
    };
    checkAuth();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleAdminAccess = () => {
    navigate(isLoggedIn ? "/admin" : "/admin/auth");
  };

  return (
    <div className="min-h-screen bg-[hsl(20,6%,7%)] text-white overflow-x-hidden">
      {/* ─── Header ─── */}
      <header className="sticky top-0 z-50 w-full border-b border-white/[0.06] bg-[hsl(20,6%,7%)]/90 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <Logo className="h-8 w-auto" variant="dark" />
          <nav className="hidden md:flex items-center gap-8">
            <a href="#resultados" className="text-sm text-white/60 hover:text-white transition-colors">Resultados</a>
            <a href="#features" className="text-sm text-white/60 hover:text-white transition-colors">Recursos</a>
            <a href="#pricing" className="text-sm text-white/60 hover:text-white transition-colors">Planos</a>
          </nav>
          <div className="flex items-center gap-3">
            {!loading && (
              isLoggedIn ? (
                <Button onClick={handleAdminAccess} className="bg-primary hover:bg-primary/90 text-primary-foreground">Acessar Painel</Button>
              ) : (
                <>
                  <Button variant="ghost" className="text-white/70 hover:text-white hover:bg-white/[0.06]" onClick={() => navigate("/admin/auth")}>Entrar</Button>
                  <Button onClick={startCheckout} disabled={isCheckoutLoading} className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full px-6">
                    {isCheckoutLoading ? "Carregando..." : "Assinar agora"}
                  </Button>
                </>
              )
            )}
          </div>
        </div>
      </header>

      {/* ─── Hero ─── */}
      <section className="relative isolate py-24 md:py-36 overflow-hidden">
        {/* Video bg */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          <video
            autoPlay loop muted playsInline preload="auto"
            onLoadedData={() => setHeroVideoReady(true)}
            onCanPlay={() => setHeroVideoReady(true)}
            onError={() => setHeroVideoReady(false)}
            className={"absolute inset-0 h-full w-full object-cover transition-opacity duration-700 " + (heroVideoReady ? "opacity-30" : "opacity-0")}
          >
            <source src={heroVideo480} type="video/mp4" />
            <source src={heroVideo1080} type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-gradient-to-b from-[hsl(20,6%,7%)]/70 via-[hsl(20,6%,7%)]/50 to-[hsl(20,6%,7%)]" />
        </div>

        <div className="container relative z-10">
          <motion.div
            className="flex flex-col items-center text-center space-y-8 max-w-4xl mx-auto"
            initial="hidden"
            animate="visible"
            variants={stagger}
          >
            <motion.div variants={fadeUp}>
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                #1 em Conversão no Brasil
              </span>
            </motion.div>

            <motion.h1
              variants={fadeUp}
              className="text-4xl sm:text-5xl md:text-[3.5rem] lg:text-[4rem] font-extrabold leading-[1.08] tracking-tight"
              style={{ textWrap: "balance" } as React.CSSProperties}
            >
              Aumente{" "}
              <span className="text-primary">70% das suas vendas</span>{" "}
              no delivery nos próximos 30 dias.
            </motion.h1>

            <motion.p variants={fadeUp} className="text-lg md:text-xl text-white/70 max-w-2xl leading-relaxed">
              O cardápio digital com a <strong className="text-primary font-semibold">maior conversão do mercado</strong> em tráfego pago.
            </motion.p>

            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-4">
              <Button
                size="lg"
                className="text-base px-8 py-6 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full shadow-[0_0_40px_hsl(38_92%_50%/0.25)] hover:shadow-[0_0_60px_hsl(38_92%_50%/0.35)] transition-shadow"
                onClick={startCheckout}
                disabled={isCheckoutLoading}
              >
                {isCheckoutLoading ? "Carregando..." : "Quero aumentar minhas vendas"}
                <Zap className="ml-2 w-5 h-5" />
              </Button>
              <Button size="lg" variant="ghost" className="text-base px-8 py-6 text-white/80 hover:text-white hover:bg-white/[0.06] rounded-full border border-white/10" asChild>
                <a href="https://wa.me/5551995135594?text=Ol%C3%A1%21%20Quero%20falar%20com%20um%20especialista%20do%20MenuFly." target="_blank" rel="noopener noreferrer">
                  Falar com um especialista
                  <MessageCircle className="ml-2 w-5 h-5" />
                </a>
              </Button>
            </motion.div>

            <motion.div variants={fadeUp} className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 pt-4 text-white/50 text-sm">
              <span className="flex items-center gap-2"><Check className="w-4 h-4 text-primary" />+40% conversão no checkout</span>
              <span className="flex items-center gap-2"><Check className="w-4 h-4 text-primary" />Pixel nativo Meta & Google</span>
              <span className="flex items-center gap-2"><Check className="w-4 h-4 text-primary" />Feito por quem entende de tráfego</span>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ─── Results / Testimonials ─── */}
      <section id="resultados" className="py-24 md:py-32">
        <div className="container">
          <Reveal className="text-center space-y-4 mb-16 max-w-2xl mx-auto">
            <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight" style={{ textWrap: "balance" } as React.CSSProperties}>
              Resultados que{" "}
              <span className="text-primary italic">falam por si.</span>
            </h2>
            <p className="text-white/50 text-lg">
              Deliverys reais que escalaram seu faturamento com nossos funis de aceleração de pedidos.
            </p>
          </Reveal>

          <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {testimonials.map((t, i) => (
              <Reveal key={t.name} delay={i * 0.1}>
                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 md:p-8 flex flex-col h-full hover:border-white/[0.15] transition-colors">
                  <div className="mb-6">
                    <span className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-bold">
                      {t.metric} <span className="font-normal text-primary/70">{t.metricLabel}</span>
                    </span>
                  </div>
                  <p className="text-white/70 text-[15px] leading-relaxed flex-1 mb-6">
                    "{t.quote}"
                  </p>
                  <div className="border-t border-white/[0.08] pt-4">
                    <p className="font-semibold text-white">{t.name}</p>
                    <p className="text-white/40 text-sm">{t.location}</p>
                    <p className="text-primary text-xs mt-1 font-medium">{t.result}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Stats Bar ─── */}
      <section className="py-16 border-y border-white/[0.06]">
        <div className="container">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto">
            {stats.map((s, i) => (
              <Reveal key={s.label} delay={i * 0.08} className="text-center">
                <p className="text-3xl md:text-4xl font-extrabold text-primary tracking-tight">{s.value}</p>
                <p className="text-white/40 text-sm mt-1">{s.label}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Problem/Solution ─── */}
      <section className="py-24 md:py-32">
        <div className="container">
          <div className="grid md:grid-cols-2 gap-12 md:gap-16 items-center max-w-6xl mx-auto">
            <Reveal>
              <div className="relative rounded-2xl overflow-hidden aspect-[4/3]">
                <img src={heroPoster} alt="Delivery de qualidade" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-[hsl(20,6%,7%)] via-transparent to-transparent" />
              </div>
            </Reveal>
            <Reveal delay={0.15}>
              <div className="space-y-6">
                <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight leading-[1.1]" style={{ textWrap: "balance" } as React.CSSProperties}>
                  Chega de perder 30% do lucro{" "}
                  <span className="text-primary italic">pro iFood.</span>
                </h2>
                <div className="space-y-4 text-white/60 leading-relaxed">
                  <p>
                    A maioria dos deliverys vira escravo do iFood para vender, perdendo de 25-30% de margem 
                    de lucro simplesmente por usar o app. Alguns até tentam investir em tráfego, mas os 
                    clientes chegam no WhatsApp e não finalizam o pedido.
                  </p>
                  <p>
                    Estruturamos o funil que mais gera vendas para delivery no Brasil. Aumentando seu 
                    faturamento <strong className="text-white/90">sem tirar da margem de lucro</strong>, sem precisar atender clientes curiosos no 
                    WhatsApp, investindo a partir de R$40/dia em anúncios.
                  </p>
                </div>
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-4">
                  <p className="text-sm text-white/80">
                    <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 mr-2" />
                    <strong>Estrutura própria:</strong> Clientes que fidelizam e compram recorrentemente. 
                    Faturamento previsível para os próximos meses.
                  </p>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ─── IA Criativa Showcase ─── */}
      <section className="py-24 md:py-32 border-t border-white/[0.06]">
        <div className="container">
          <div className="grid md:grid-cols-2 gap-12 md:gap-16 items-center max-w-6xl mx-auto">
            <Reveal>
              <div className="relative rounded-2xl overflow-hidden">
                <img src={landingIaCriativa} alt="IA Criativa do MenuFly gerando foto profissional" className="w-full h-full object-cover rounded-2xl" loading="lazy" width={1024} height={768} />
              </div>
            </Reveal>
            <Reveal delay={0.15}>
              <div className="space-y-6">
                <span className="text-[11px] font-bold uppercase tracking-widest text-primary/70 bg-primary/[0.08] px-2.5 py-1 rounded-full">
                  Inteligência Artificial
                </span>
                <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight leading-[1.1]" style={{ textWrap: "balance" } as React.CSSProperties}>
                  Pare de pagar caro em{" "}
                  <span className="text-primary italic">filmmaker.</span>
                </h2>
                <div className="space-y-4 text-white/60 leading-relaxed">
                  <p>
                    Crie fotos profissionais, vídeos cinematográficos e artes para anúncios dos seus 
                    produtos usando nossa <strong className="text-white/90">IA integrada direto no painel</strong>. Em poucos cliques, 
                    você transforma uma foto simples do celular em conteúdo de nível profissional.
                  </p>
                  <p>
                    Chega de gastar R$500+ por sessão de fotos ou esperar semanas por um vídeo. 
                    Gere quantos conteúdos quiser, quando quiser — perfeito para manter seus 
                    anúncios e redes sociais sempre atualizados.
                  </p>
                </div>
                <div className="rounded-xl border border-primary/20 bg-primary/[0.06] p-4">
                  <p className="text-sm text-white/80">
                    <Sparkles className="inline w-4 h-4 text-primary mr-2" />
                    <strong>Fotos, vídeos e artes</strong> — tudo gerado por IA com qualidade profissional, 
                    direto do seu cardápio.
                  </p>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ─── App Mobile Showcase ─── */}
      <section className="py-24 md:py-32 border-t border-white/[0.06]">
        <div className="container">
          <div className="grid md:grid-cols-2 gap-12 md:gap-16 items-center max-w-6xl mx-auto">
            <Reveal delay={0.15} className="order-2 md:order-1">
              <div className="space-y-6">
                <span className="text-[11px] font-bold uppercase tracking-widest text-primary/70 bg-primary/[0.08] px-2.5 py-1 rounded-full">
                  App Nativo
                </span>
                <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight leading-[1.1]" style={{ textWrap: "balance" } as React.CSSProperties}>
                  Seu delivery no{" "}
                  <span className="text-primary italic">bolso.</span>
                </h2>
                <div className="space-y-4 text-white/60 leading-relaxed">
                  <p>
                    Acesse seu painel completo direto do celular com nosso <strong className="text-white/90">app nativo para Android e iOS</strong>. 
                    Gerencie pedidos, atualize o cardápio e acompanhe suas vendas de qualquer lugar — 
                    com a mesma experiência do desktop.
                  </p>
                  <p>
                    E o melhor: receba uma <strong className="text-white/90">notificação push a cada nova venda</strong> realizada no seu 
                    cardápio. Aquele som de "ka-ching" direto no celular que vicia e te mantém conectado 
                    com o resultado em tempo real.
                  </p>
                </div>
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-4">
                  <p className="text-sm text-white/80">
                    <Bell className="inline w-4 h-4 text-emerald-400 mr-2" />
                    <strong>Push a cada venda:</strong> Valor, nome do cliente e som personalizado — 
                    o efeito dopamina que todo dono de delivery precisa.
                  </p>
                </div>
              </div>
            </Reveal>
            <Reveal className="order-1 md:order-2">
              <div className="relative rounded-2xl overflow-hidden">
                <img src={landingAppMobile} alt="App Mobile do MenuFly com notificação de venda" className="w-full h-full object-cover rounded-2xl" loading="lazy" width={1024} height={768} />
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ─── Features ─── */}
      <section id="features" className="py-24 md:py-32 border-t border-white/[0.06]">
        <div className="container">
          <Reveal className="text-center space-y-4 mb-16 max-w-2xl mx-auto">
            <span className="text-sm text-primary font-medium uppercase tracking-wider">Por que somos #1 em conversão</span>
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight" style={{ textWrap: "balance" } as React.CSSProperties}>
              Desenvolvido por quem domina o mercado de food marketing
            </h2>
            <p className="text-white/50 text-lg">
              Nossa experiência como assessoria de food marketing nos mostrou exatamente o que faltava nos cardápios digitais.
            </p>
          </Reveal>
          <motion.div
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.15 }}
            variants={stagger}
          >
            {features.map((f) => (
              <motion.div key={f.title} variants={fadeUp}>
                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 md:p-8 h-full hover:border-primary/20 transition-colors group">
                  <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-5 group-hover:bg-primary/15 transition-colors">
                    <f.icon className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="font-bold text-lg mb-2 text-white">{f.title}</h3>
                  <p className="text-white/50 text-[15px] leading-relaxed">{f.description}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ─── Deep Features ─── */}
      <section className="py-24 md:py-32 border-t border-white/[0.06]">
        <div className="container">
          <Reveal className="text-center space-y-4 mb-20 max-w-2xl mx-auto">
            <span className="text-sm text-primary font-medium uppercase tracking-wider">Tudo que você precisa</span>
            <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight" style={{ textWrap: "balance" } as React.CSSProperties}>
              Muito mais que um{" "}
              <span className="text-primary italic">cardápio digital.</span>
            </h2>
            <p className="text-white/50 text-lg">
              Cada funcionalidade resolve uma dor real do dono de delivery. Sem enrolação, sem feature inútil.
            </p>
          </Reveal>

          <div className="space-y-6 max-w-5xl mx-auto">
            {deepFeatures.map((f, i) => (
              <Reveal key={f.title} delay={i * 0.05}>
                <div className="group rounded-2xl border border-white/[0.08] bg-white/[0.02] hover:border-primary/20 transition-all duration-300 overflow-hidden">
                  <div className="p-6 md:p-8 lg:p-10">
                    <div className="flex flex-col md:flex-row md:items-start gap-6">
                      {/* Icon + Badge */}
                      <div className="flex items-center gap-3 md:flex-col md:items-start md:gap-3 shrink-0">
                        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/15 transition-colors">
                          <f.icon className="w-6 h-6 text-primary" />
                        </div>
                        <span className="text-[11px] font-bold uppercase tracking-widest text-primary/70 bg-primary/[0.08] px-2.5 py-1 rounded-full">
                          {f.badge}
                        </span>
                      </div>

                      {/* Content */}
                      <div className="flex-1 space-y-3">
                        <h3 className="text-xl md:text-2xl font-extrabold text-white tracking-tight">{f.title}</h3>
                        <p className="text-white/80 font-medium text-[15px]">{f.headline}</p>
                        <p className="text-white/45 text-[14px] leading-relaxed">{f.description}</p>
                        <div className="pt-2">
                          <span className="inline-flex items-center gap-2 text-sm text-primary font-medium">
                            <Check className="w-4 h-4" />
                            {f.highlight}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>


      <section id="pricing" className="py-24 md:py-32 border-t border-white/[0.06]">
        <div className="container">
          <Reveal className="text-center space-y-4 mb-16 max-w-2xl mx-auto">
            <span className="text-sm text-primary font-medium uppercase tracking-wider">Invista em conversão</span>
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight" style={{ textWrap: "balance" } as React.CSSProperties}>
              Pare de jogar dinheiro fora em tráfego
            </h2>
            <p className="text-white/50 text-lg">
              De nada adianta investir em anúncios se seu cardápio não converte. Escolha a plataforma que transforma cliques em pedidos.
            </p>
          </Reveal>

          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {/* Start */}
            <Reveal>
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-8 md:p-10 h-full flex flex-col">
                <h3 className="text-xl font-bold mb-1">MenuFly Start</h3>
                <p className="text-white/40 text-sm mb-6">Ideal para começar seu delivery digital</p>
                <div className="mb-8">
                  <span className="text-5xl font-extrabold tracking-tight">R$ 97</span>
                  <span className="text-white/40 text-lg ml-1">/mês</span>
                  <p className="text-white/30 text-sm mt-1">Sem fidelidade. Cancele quando quiser.</p>
                </div>
                <ul className="space-y-3 flex-1 mb-8">
                  {sharedPlanFeatures.map((f) => (
                    <li key={f} className="flex items-center gap-3 text-sm text-white/70">
                      <span className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Check className="w-3 h-3 text-primary" />
                      </span>
                      {f}
                    </li>
                  ))}
                  {eliteExclusiveFeatures.map((f) => (
                    <li key={f} className="flex items-center gap-3 text-sm text-white/30">
                      <span className="w-5 h-5 rounded-full bg-white/[0.05] flex items-center justify-center flex-shrink-0">
                        <span className="text-[10px] font-bold">✕</span>
                      </span>
                      <span className="line-through">{f}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full py-6 text-base rounded-full border-white/10 text-white hover:bg-white/[0.06] hover:text-white"
                  onClick={startCheckout}
                  disabled={isCheckoutLoading}
                >
                  {isCheckoutLoading ? "Carregando..." : "Começar com Start"}
                </Button>
                <p className="text-xs text-white/30 text-center mt-3">Sem taxa de setup • Plano mensal</p>
              </div>
            </Reveal>

            {/* Elite */}
            <Reveal delay={0.1}>
              <div className="relative rounded-2xl border-2 border-primary/40 bg-primary/[0.04] p-8 md:p-10 h-full flex flex-col">
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                  Mais Completo
                </span>
                <h3 className="text-xl font-bold mb-1">MenuFly Elite</h3>
                <p className="text-white/40 text-sm mb-6">Todas as funcionalidades sem limites</p>
                <div className="mb-8">
                  <span className="text-5xl font-extrabold tracking-tight">R$ 160</span>
                  <span className="text-white/40 text-lg ml-1">/mês</span>
                  <p className="text-white/30 text-sm mt-1">Sem fidelidade. Cancele quando quiser.</p>
                </div>
                <ul className="space-y-3 flex-1 mb-8">
                  {[...sharedPlanFeatures, ...eliteExclusiveFeatures].map((f) => (
                    <li key={f} className="flex items-center gap-3 text-sm text-white/70">
                      <span className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Check className="w-3 h-3 text-primary" />
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>
                <Button
                  size="lg"
                  className="w-full py-6 text-base rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_0_40px_hsl(38_92%_50%/0.2)]"
                  onClick={startCheckout}
                  disabled={isCheckoutLoading}
                >
                  {isCheckoutLoading ? "Carregando..." : "Começar com Elite"}
                  <Zap className="ml-2 w-5 h-5" />
                </Button>
                <p className="text-xs text-white/30 text-center mt-3">Sem taxa de setup • Plano mensal</p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section className="py-24 md:py-32 border-t border-white/[0.06]">
        <div className="container">
          <Reveal className="text-center space-y-4 mb-16 max-w-2xl mx-auto">
            <span className="text-sm text-primary font-medium uppercase tracking-wider">Dúvidas Frequentes</span>
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">
              Perguntas Frequentes
            </h2>
          </Reveal>
          <Reveal delay={0.1} className="max-w-3xl mx-auto">
            <Accordion type="single" collapsible className="w-full space-y-3">
              {[
                { q: "Como funciona o MenuFly?", a: "O MenuFly é uma plataforma completa de cardápio digital otimizada para conversão. Você cadastra seus produtos, personaliza seu cardápio e compartilha o link com seus clientes. Nossa integração nativa com Facebook e Google Ads permite rastrear e otimizar suas campanhas para obter até 70% mais resultados." },
                { q: "Quais são as formas de pagamento?", a: "Aceitamos cartão de crédito (Visa, Mastercard, Elo, American Express), PIX e boleto bancário. O pagamento é mensal e você pode alterar sua forma de pagamento a qualquer momento pelo painel." },
                { q: "Posso cancelar quando quiser?", a: "Sim! Não temos fidelidade ou multa de cancelamento. Nosso plano é mensal e você pode cancelar a qualquer momento diretamente pelo painel, sem burocracia." },
                { q: "Como funciona a integração com Facebook e Google Ads?", a: "Nossa integração é nativa e simplificada. Basta inserir seus IDs de Pixel (Meta) e Google Ads no painel e pronto! Automaticamente rastreamos todos os eventos de conversão para otimizar suas campanhas e melhorar o ROAS." },
                { q: "O MenuFly cobra taxa por pedido?", a: "Não! Diferente de outros sistemas, não cobramos nenhuma taxa por pedido. Você paga apenas a mensalidade fixa a partir de R$ 97 e pode receber pedidos ilimitados sem custos adicionais." },
                { q: "Preciso de conhecimento técnico para usar?", a: "Não! O MenuFly foi desenvolvido para ser simples e intuitivo. Em poucos minutos você configura seu cardápio e já pode começar a receber pedidos." },
                { q: "Vocês oferecem suporte?", a: "Sim! Oferecemos suporte prioritário por WhatsApp e email. Nossa equipe é formada por especialistas em food marketing e tráfego pago." },
              ].map((item, i) => (
                <AccordionItem key={i} value={`item-${i}`} className="border border-white/[0.08] rounded-xl px-6 bg-white/[0.02] data-[state=open]:border-white/[0.12]">
                  <AccordionTrigger className="text-left font-semibold text-white/90 hover:text-white hover:no-underline">
                    {item.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-white/50 leading-relaxed">
                    {item.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </Reveal>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer id="contact" className="border-t border-white/[0.06] py-12">
        <div className="container">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <Logo className="h-7 w-auto" variant="dark" />
            </div>
            <div className="flex items-center gap-4">
              <Link to="/ajuda" className="text-sm text-white/50 hover:text-white/80 transition-colors">Central de Ajuda</Link>
              <p className="text-sm text-white/30">
                © {new Date().getFullYear()} MenuFly. Todos os direitos reservados.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
