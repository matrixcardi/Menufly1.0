import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Search, ArrowLeft, ChevronRight, HelpCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Logo } from "@/components/Logo";
import { helpCategories, faqItems, type HelpCategory, type HelpArticle } from "@/data/help-articles";

export default function HelpCenter() {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<HelpCategory | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<HelpArticle | null>(null);

  const filteredCategories = useMemo(() => {
    if (!search.trim()) return helpCategories;
    const q = search.toLowerCase();
    return helpCategories
      .map((cat) => ({
        ...cat,
        articles: cat.articles.filter(
          (a) =>
            a.title.toLowerCase().includes(q) ||
            a.summary.toLowerCase().includes(q) ||
            a.content.toLowerCase().includes(q)
        ),
      }))
      .filter((cat) => cat.articles.length > 0 || cat.name.toLowerCase().includes(q));
  }, [search]);

  const filteredFaq = useMemo(() => {
    if (!search.trim()) return faqItems;
    const q = search.toLowerCase();
    return faqItems.filter(
      (f) => f.question.toLowerCase().includes(q) || f.answer.toLowerCase().includes(q)
    );
  }, [search]);

  // Article detail view
  if (selectedArticle && selectedCategory) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
        {/* Hero header with gradient */}
        <div className={`bg-gradient-to-br ${selectedCategory.gradient} text-white`}>
          <div className="max-w-3xl mx-auto px-4 pt-5 pb-10">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedArticle(null)}
              className="text-white/80 hover:text-white hover:bg-white/10 mb-4 -ml-2"
            >
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              Voltar
            </Button>
            <div className="flex items-center gap-2 mb-2">
              <selectedCategory.icon className="h-5 w-5 text-white/70" />
              <span className="text-sm text-white/70 font-medium">{selectedCategory.name}</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{selectedArticle.title}</h1>
            <p className="text-white/70 mt-2 text-sm">{selectedArticle.summary}</p>
          </div>
        </div>

        {/* Content card */}
        <main className="max-w-3xl mx-auto px-4 -mt-4">
          <div className="bg-white rounded-2xl shadow-lg border p-6 md:p-10 mb-12">
            {renderArticleContent(selectedArticle.content, selectedCategory.gradient)}
          </div>
        </main>
      </div>
    );
  }

  // Category detail view
  if (selectedCategory) {
    const cat = search.trim()
      ? filteredCategories.find((c) => c.id === selectedCategory.id) || selectedCategory
      : selectedCategory;
    return (
      <div className="min-h-screen bg-white">
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-lg border-b">
          <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => { setSelectedCategory(null); setSearch(""); }}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <div className={`h-9 w-9 rounded-lg bg-gradient-to-br ${selectedCategory.gradient} flex items-center justify-center`}>
                <selectedCategory.icon className="h-5 w-5 text-white" />
              </div>
              <h1 className="text-xl font-bold">{selectedCategory.name}</h1>
            </div>
          </div>
        </header>
        <main className="max-w-3xl mx-auto px-4 py-6 space-y-2">
          {cat.articles.map((article) => (
            <button
              key={article.id}
              onClick={() => setSelectedArticle(article)}
              className="w-full text-left p-4 rounded-xl border hover:bg-gray-50 transition-colors flex items-center gap-3 group"
            >
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900">{article.title}</h3>
                <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{article.summary}</p>
              </div>
              <ChevronRight className="h-5 w-5 text-gray-400 shrink-0 group-hover:text-gray-600 transition-colors" />
            </button>
          ))}
          {cat.articles.length === 0 && (
            <p className="text-center text-gray-400 py-12">Nenhum artigo encontrado.</p>
          )}
        </main>
      </div>
    );
  }

  // Main view
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-gradient-to-br from-gray-900 to-gray-800 text-white">
        <div className="max-w-5xl mx-auto px-4 py-6 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Logo className="h-7" />
          </Link>
          <Link to="/admin/auth">
            <Button variant="outline" size="sm" className="text-white border-white/30 hover:bg-white/10">
              Painel Admin
            </Button>
          </Link>
        </div>

        {/* Hero */}
        <div className="max-w-3xl mx-auto px-4 pt-8 pb-14 text-center space-y-5">
          <div className="inline-flex items-center gap-2 bg-white/10 rounded-full px-4 py-1.5 text-sm">
            <HelpCircle className="h-4 w-4" /> Central de Ajuda
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Como podemos te ajudar?</h1>
          <div className="relative max-w-xl mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Busque por qualquer assunto..."
              className="pl-12 h-12 rounded-xl bg-white text-gray-900 border-0 shadow-lg text-base"
            />
          </div>
        </div>
      </header>

      {/* Categories grid */}
      <main className="max-w-5xl mx-auto px-4 -mt-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCategories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat)}
              className="group relative overflow-hidden rounded-2xl bg-white border shadow-sm hover:shadow-md transition-all p-5 text-left"
            >
              <div className="flex items-start gap-3">
                <div className={`h-11 w-11 rounded-xl bg-gradient-to-br ${cat.gradient} flex items-center justify-center shrink-0`}>
                  <cat.icon className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{cat.name}</h3>
                  <p className="text-sm text-gray-500 mt-0.5">{cat.description}</p>
                  <p className="text-xs text-gray-400 mt-2">{cat.articles.length} artigo{cat.articles.length !== 1 ? "s" : ""}</p>
                </div>
              </div>
            </button>
          ))}
        </div>

        {filteredCategories.length === 0 && (
          <p className="text-center text-gray-400 py-12">Nenhuma categoria encontrada para "{search}"</p>
        )}

        {/* FAQ */}
        {filteredFaq.length > 0 && (
          <section className="mt-16 mb-16 max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">Perguntas Frequentes</h2>
            <Accordion type="single" collapsible className="space-y-2">
              {filteredFaq.map((faq, i) => (
                <AccordionItem key={i} value={`faq-${i}`} className="border rounded-xl px-4">
                  <AccordionTrigger className="text-left font-medium text-gray-900 hover:no-underline">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-gray-600">{faq.answer}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t py-8 text-center text-sm text-gray-400">
        <p>© {new Date().getFullYear()} MenuFly. Todos os direitos reservados.</p>
      </footer>
    </div>
  );
}

function renderBold(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="font-semibold text-gray-900">{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

function renderArticleContent(content: string, gradient: string): React.ReactNode {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Skip empty lines
    if (!line.trim()) { i++; continue; }

    // Section header: **Title:**
    if (/^\*\*[^*]+\*\*:?$/.test(line.trim())) {
      elements.push(
        <div key={i} className="mt-8 mb-3 flex items-center gap-2">
          <div className={`h-1 w-5 rounded-full bg-gradient-to-r ${gradient}`} />
          <h3 className="text-lg font-bold text-gray-900">{line.trim().replace(/\*\*/g, "")}</h3>
        </div>
      );
      i++;
      continue;
    }

    // Ordered list block
    if (/^\d+\.\s/.test(line)) {
      const listItems: { num: string; text: string }[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        const match = lines[i].match(/^(\d+)\.\s*(.*)/);
        if (match) listItems.push({ num: match[1], text: match[2] });
        i++;
      }
      elements.push(
        <ol key={`ol-${i}`} className="my-3 space-y-2 pl-1">
          {listItems.map((item, j) => (
            <li key={j} className="flex items-start gap-3 text-gray-700">
              <span className={`mt-0.5 h-6 w-6 rounded-full bg-gradient-to-br ${gradient} text-white text-xs font-bold flex items-center justify-center shrink-0`}>
                {item.num}
              </span>
              <span className="leading-relaxed pt-0.5">{renderBold(item.text)}</span>
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Unordered list block
    if (line.startsWith("- ")) {
      const listItems: string[] = [];
      while (i < lines.length && lines[i].startsWith("- ")) {
        listItems.push(lines[i].replace(/^- /, ""));
        i++;
      }
      elements.push(
        <ul key={`ul-${i}`} className="my-3 space-y-2 pl-1">
          {listItems.map((item, j) => (
            <li key={j} className="flex items-start gap-2.5 text-gray-700">
              <span className={`mt-2 h-1.5 w-1.5 rounded-full shrink-0 bg-gradient-to-br ${gradient}`} />
              <span className="leading-relaxed">{renderBold(item)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Regular paragraph
    elements.push(
      <p key={`p-${i}`} className="text-gray-600 my-3 leading-relaxed text-[15px]">{renderBold(line)}</p>
    );
    i++;
  }

  return <>{elements}</>;
}
