import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { MessageCircleQuestion, X, Send, ArrowLeft, ExternalLink, Headset } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";

type Msg = { role: "user" | "assistant"; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-help-chat`;

const FAQ_CATEGORIES = [
  {
    label: "📋 Cardápio",
    topics: [
      { q: "Como criar e organizar categorias no cardápio?", label: "Criar categorias" },
      { q: "Como cadastrar e editar produtos no cardápio?", label: "Cadastrar produtos" },
      { q: "Como configurar complementos e adicionais?", label: "Complementos e adicionais" },
      { q: "Como usar os destaques do cardápio?", label: "Destaques do cardápio" },
    ],
  },
  {
    label: "📦 Pedidos",
    topics: [
      { q: "Como receber e gerenciar pedidos?", label: "Gerenciar pedidos" },
      { q: "Como criar um pedido manual?", label: "Pedido manual" },
      { q: "Como funciona a caixa registradora?", label: "Caixa registradora" },
    ],
  },
  {
    label: "🚚 Entrega",
    topics: [
      { q: "Como configurar zonas de entrega?", label: "Zonas de entrega" },
      { q: "Como cadastrar entregadores?", label: "Entregadores" },
    ],
  },
  {
    label: "💳 Pagamentos",
    topics: [
      { q: "Quais métodos de pagamento posso oferecer?", label: "Métodos de pagamento" },
      { q: "Como conectar o Mercado Pago?", label: "Conectar Mercado Pago" },
      { q: "Como configurar PIX manual?", label: "PIX manual" },
    ],
  },
  {
    label: "🏷️ Promoções",
    topics: [
      { q: "Como criar cupons de desconto?", label: "Cupons de desconto" },
      { q: "Como funcionam as promoções automáticas?", label: "Promoções automáticas" },
      { q: "Como criar combos e kits promocionais?", label: "Combos e kits" },
    ],
  },
  {
    label: "📢 Campanhas & WhatsApp",
    topics: [
      { q: "Como criar uma campanha de WhatsApp?", label: "Criar campanha" },
      { q: "Como funciona o bot de WhatsApp?", label: "Bot de WhatsApp" },
    ],
  },
  {
    label: "⚙️ Configurações",
    topics: [
      { q: "Como configurar os dados do restaurante?", label: "Dados do restaurante" },
      { q: "Como configurar o horário de funcionamento?", label: "Horário de funcionamento" },
      { q: "Como adicionar colaboradores?", label: "Colaboradores" },
      { q: "Como configurar a impressora de pedidos?", label: "Impressora" },
    ],
  },
  {
    label: "📊 Relatórios & Mais",
    topics: [
      { q: "Como ver meus relatórios de vendas?", label: "Relatórios" },
      { q: "Como funciona o CMV?", label: "CMV" },
      { q: "Como integrar Meta Pixel e Google Analytics?", label: "Integrações e ADS" },
      { q: "Quais são os planos disponíveis?", label: "Planos e assinatura" },
    ],
  },
];

const WHATSAPP_SUPPORT_NUMBER = "5551991293517";

async function streamChat({
  messages,
  onDelta,
  onDone,
}: {
  messages: Msg[];
  onDelta: (deltaText: string) => void;
  onDone: () => void;
}) {
  const resp = await fetch(CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({ messages }),
  });

  if (!resp.ok || !resp.body) {
    const errData = await resp.json().catch(() => ({}));
    throw new Error(errData.error || "Falha ao conectar com o assistente");
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let textBuffer = "";
  let streamDone = false;

  while (!streamDone) {
    const { done, value } = await reader.read();
    if (done) break;
    textBuffer += decoder.decode(value, { stream: true });

    let newlineIndex: number;
    while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
      let line = textBuffer.slice(0, newlineIndex);
      textBuffer = textBuffer.slice(newlineIndex + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (line.startsWith(":") || line.trim() === "") continue;
      if (!line.startsWith("data: ")) continue;
      const jsonStr = line.slice(6).trim();
      if (jsonStr === "[DONE]") { streamDone = true; break; }
      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (content) onDelta(content);
      } catch {
        textBuffer = line + "\n" + textBuffer;
        break;
      }
    }
  }

  if (textBuffer.trim()) {
    for (let raw of textBuffer.split("\n")) {
      if (!raw) continue;
      if (raw.endsWith("\r")) raw = raw.slice(0, -1);
      if (raw.startsWith(":") || raw.trim() === "") continue;
      if (!raw.startsWith("data: ")) continue;
      const jsonStr = raw.slice(6).trim();
      if (jsonStr === "[DONE]") continue;
      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (content) onDelta(content);
      } catch { /* ignore */ }
    }
  }
  onDone();
}

export function HelpChatWidget() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showHumanSupport, setShowHumanSupport] = useState(false);
  const [view, setView] = useState<"faq" | "chat">("faq");
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Hide widget on /admin/salao route
  if (location.pathname === "/admin/salao") {
    return null;
  }

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = useCallback(async (text: string) => {
    const userMsg: Msg = { role: "user", content: text };
    const allMessages = [...messages, userMsg];
    setMessages(allMessages);
    setInput("");
    setIsLoading(true);
    setShowHumanSupport(false);
    setView("chat");

    let assistantSoFar = "";

    const upsertAssistant = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
        }
        return [...prev, { role: "assistant", content: assistantSoFar }];
      });
    };

    try {
      await streamChat({
        messages: allMessages,
        onDelta: (chunk) => upsertAssistant(chunk),
        onDone: () => {
          setIsLoading(false);
          if (assistantSoFar.includes("[SUPORTE_HUMANO]")) {
            setShowHumanSupport(true);
            setMessages(prev =>
              prev.map((m, i) =>
                i === prev.length - 1 && m.role === "assistant"
                  ? { ...m, content: m.content.replace(/\[SUPORTE_HUMANO\]/g, "").trim() }
                  : m
              )
            );
          }
        },
      });
    } catch (e) {
      console.error(e);
      setIsLoading(false);
      setMessages(prev => [
        ...prev,
        { role: "assistant", content: "Desculpe, ocorreu um erro. Tente novamente ou entre em contato com o suporte." },
      ]);
      setShowHumanSupport(true);
    }
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage(input.trim());
  };

  const handleReset = () => {
    setMessages([]);
    setShowHumanSupport(false);
    setView("faq");
    setExpandedCategory(null);
  };

  const openWhatsAppSupport = () => {
    const text = encodeURIComponent("Olá! Preciso de ajuda com minha conta no MenuFly.");
    window.open(`https://wa.me/${WHATSAPP_SUPPORT_NUMBER}?text=${text}`, "_blank");
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(prev => !prev)}
        className={cn(
          "fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 hover:scale-110",
          open
            ? "bg-muted text-muted-foreground"
            : "bg-primary text-primary-foreground"
        )}
        aria-label="Ajuda"
      >
        {open ? <X className="w-6 h-6" /> : <MessageCircleQuestion className="w-6 h-6" />}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-[380px] max-w-[calc(100vw-3rem)] bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-300"
          style={{ height: "min(580px, calc(100vh - 8rem))" }}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-primary/5">
            {view === "chat" && (
              <button onClick={handleReset} className="text-muted-foreground hover:text-foreground">
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div className="flex-1">
              <h3 className="font-semibold text-sm">Central de Ajuda</h3>
              <p className="text-xs text-muted-foreground">MenuFly • Assistente Virtual</p>
            </div>
          </div>

          {/* Body */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {view === "faq" && messages.length === 0 && (
              <>
                <p className="text-sm text-muted-foreground mb-3">
                  👋 Olá! Como posso ajudar? Selecione um tópico ou digite sua dúvida.
                </p>
                <div className="space-y-2">
                  {FAQ_CATEGORIES.map((cat) => (
                    <div key={cat.label}>
                      <button
                        onClick={() => setExpandedCategory(expandedCategory === cat.label ? null : cat.label)}
                        className={cn(
                          "w-full text-left text-sm font-medium px-3 py-2.5 rounded-lg border transition-colors",
                          expandedCategory === cat.label
                            ? "bg-primary/10 border-primary/30 text-foreground"
                            : "bg-background border-border hover:bg-muted/60 text-foreground"
                        )}
                      >
                        {cat.label}
                      </button>
                      {expandedCategory === cat.label && (
                        <div className="ml-3 mt-1 space-y-1 border-l-2 border-primary/20 pl-3">
                          {cat.topics.map((topic) => (
                            <button
                              key={topic.label}
                              onClick={() => sendMessage(topic.q)}
                              className="w-full text-left text-xs px-2.5 py-2 rounded-md bg-muted/40 hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                            >
                              {topic.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Falar com Atendente - always visible on FAQ */}
                <div className="pt-3 border-t border-border mt-3">
                  <button
                    onClick={openWhatsAppSupport}
                    className="flex items-center gap-2 w-full px-3 py-3 rounded-xl bg-green-500/10 border border-green-500/30 text-green-700 dark:text-green-400 text-sm font-medium hover:bg-green-500/20 transition-colors"
                  >
                    <Headset className="w-4 h-4 shrink-0" />
                    Falar com Atendente
                  </button>
                </div>
              </>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  "max-w-[85%] rounded-xl px-3 py-2 text-sm",
                  msg.role === "user"
                    ? "ml-auto bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                )}
              >
                {msg.role === "assistant" ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:m-0 [&>ul]:my-1 [&>ol]:my-1">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  msg.content
                )}
              </div>
            ))}

            {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
              <div className="max-w-[85%] rounded-xl px-3 py-2 bg-muted text-muted-foreground text-sm flex items-center gap-1.5">
                <span className="animate-pulse">●</span>
                <span className="animate-pulse delay-100">●</span>
                <span className="animate-pulse delay-200">●</span>
              </div>
            )}

            {/* Human support button in chat view */}
            {(showHumanSupport || (view === "chat" && !isLoading && messages.length > 0)) && (
              <button
                onClick={openWhatsAppSupport}
                className="flex items-center gap-2 w-full px-3 py-2.5 rounded-lg bg-green-500/10 border border-green-500/30 text-green-700 dark:text-green-400 text-sm hover:bg-green-500/20 transition-colors"
              >
                <Headset className="w-4 h-4 shrink-0" />
                Falar com Atendente
              </button>
            )}
          </div>

          {/* Input */}
          <form onSubmit={handleSubmit} className="flex items-center gap-2 px-3 py-3 border-t border-border">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Digite sua dúvida..."
              className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
              disabled={isLoading}
            />
            <Button type="submit" size="icon" className="h-9 w-9 shrink-0" disabled={isLoading || !input.trim()}>
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </div>
      )}
    </>
  );
}
