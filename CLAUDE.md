# MenuFly 1.0 — Guia de Desenvolvimento

## Visão Geral

MenuFly é uma plataforma SaaS multi-tenant de gerenciamento de restaurantes e delivery. Funciona como:
- **App do cliente**: cardápio digital por slug (`/:slug`), carrinho, checkout, rastreamento de pedido
- **Painel admin**: gestão de cardápio, pedidos, estoque, financeiro, CRM, marketing, PDV, integrações
- **Master admin**: visão cross-restaurant para operação da plataforma
- **App mobile**: iOS e Android via Capacitor

**Stack principal**: React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui + Supabase + React Query

---

## Comandos Essenciais

```bash
npm run dev          # Servidor de desenvolvimento (http://localhost:8080)
npm run build        # Build de produção
npm run lint         # Verificação ESLint
npm run preview      # Visualizar build localmente
```

**Deploy**: Vercel — vercel.json já configurado para SPA routing.

---

## Arquitetura

### Roteamento (App.tsx)
```
/                        → LandingPage (marketing)
/:slug                   → MenuPage (cardápio do restaurante, público)
/checkout                → Checkout (assinatura do plano)
/order-confirmation/:id  → OrderConfirmation
/admin/*                 → Painel admin (protegido por auth)
/master/*                → Super admin (protegido por auth)
```

Pages admin são **lazy-loaded** via `React.lazy()` — manter esse padrão em toda nova page admin.

### Contextos globais
| Contexto | Arquivo | Responsabilidade |
|---|---|---|
| `CartContext` | `contexts/CartContext.tsx` | Estado do carrinho, promoções, cupons |
| `RestaurantContext` | `contexts/RestaurantContext.tsx` | Restaurante ativo, auth, permissões |
| `PDVKioskContext` | `contexts/PDVKioskContext.tsx` | Estado do PDV/caixa |

### Camadas de dados
1. **React Query** (`@tanstack/react-query`) — cache e sincronização de dados do servidor
2. **Supabase Realtime** — atualizações ao vivo (pedidos, notificações)
3. **localStorage** — carrinho persistido entre sessões
4. **Contexts** — estado de UI e auth compartilhado

---

## Banco de Dados (Supabase)

### Domínios principais de tabelas
| Domínio | Tabelas chave |
|---|---|
| Restaurante | `restaurants`, `business_hours`, `delivery_zones`, `restaurant_collaborators` |
| Cardápio | `categories`, `products`, `addon_groups`, `addon_items`, `product_addon_groups` |
| Pedidos | `orders`, `order_items`, `coupons`, `promos`, `auto_promos` |
| Estoque | `ingredients`, `recipe_items`, `stock_movements`, `suppliers`, `purchase_orders` |
| Clientes | `customers`, `profiles` |
| PDV | `pdv_tables`, `pdv_sessions`, `table_reservations` |
| Financeiro | `cmv_settings`, `cash_registers` |
| Marketing | `campaign_recipients`, `email_send_log`, `device_tokens` |
| Integração | `platform_integrations` |

### Padrões Supabase obrigatórios

**Sempre usar o cliente tipado:**
```ts
import { supabase } from '@/integrations/supabase/client'
```

**RLS está ativo em todas as tabelas.** Toda query de owner usa o user_id do auth. Nunca bypassar RLS passando um ID diretamente sem validação.

**Atualizar tipos após mudanças no schema:**
```bash
npx supabase gen types typescript --project-id $VITE_SUPABASE_PROJECT_ID > src/integrations/supabase/types.ts
```

**Padrão de query com React Query:**
```ts
const { data, isLoading, error } = useQuery({
  queryKey: ['products', restaurantId],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('restaurant_id', restaurantId)
    if (error) throw error
    return data
  },
  enabled: !!restaurantId,
})
```

**Invalidar cache após mutações:**
```ts
const queryClient = useQueryClient()
// após mutation:
queryClient.invalidateQueries({ queryKey: ['products', restaurantId] })
```

### Edge Functions
Ficam em `supabase/functions/`. Cada função é um Deno module. O arquivo `_shared/cors.ts` já fornece headers CORS — sempre importar nele. Funções de pagamento, email e integrações externas **devem** usar Edge Functions, nunca chamar APIs privadas do frontend.

---

## Padrões de Código

### Estrutura de componente padrão
```tsx
// 1. Imports: externos → internos → tipos
// 2. Tipos e interfaces locais (apenas se não reutilizável)
// 3. Componente
// 4. Export default no final

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import type { Tables } from '@/integrations/supabase/types'

interface Props {
  restaurantId: string
}

export default function ProductList({ restaurantId }: Props) {
  // ...
}
```

### Alias de imports
Use sempre `@/` para imports internos — jamais caminhos relativos de múltiplos níveis (`../../`).

```ts
// ✓ Correto
import { useUserRole } from '@/hooks/useUserRole'

// ✗ Evitar
import { useUserRole } from '../../../hooks/useUserRole'
```

### Custom hooks
- Prefixo `use` obrigatório
- Um hook = uma responsabilidade
- Hooks que fazem fetch devem usar `useQuery`/`useMutation` do React Query
- Ficam em `src/hooks/`

### Formulários
Use sempre `react-hook-form` + `zod`:
```ts
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const schema = z.object({
  name: z.string().min(2, 'Nome muito curto'),
  phone: z.string().regex(/^\d{10,11}$/, 'Telefone inválido'),
})

type FormData = z.infer<typeof schema>
```

Use os validadores em `src/lib/validations.ts` para CPF/CNPJ, email e telefone.

---

## Design e Layout

### Princípios
- **Mobile-first**: todo layout deve funcionar em telas a partir de 320px
- **Dark mode**: o app suporta dark mode via `next-themes` — não usar cores fixas, sempre Tailwind semantic tokens
- **Touch targets**: mínimo 44×44px para elementos clicáveis no mobile

### Sistema de design
- Componentes base: `src/components/ui/` (shadcn/ui — não editar diretamente)
- Tokens do Tailwind: `tailwind.config.ts` — usar sempre as variáveis CSS do tema (`bg-background`, `text-foreground`, `border`, etc.)
- Animações: `framer-motion` para transições de página/modal; Tailwind `transition` para micro-animações simples

### Responsividade obrigatória
```tsx
// Sempre pensar em xs → sm → md → lg
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
```

### Admin layout
Pages admin herdam layout de `AdminLayout.tsx` — sidebar + header já incluídos. Cada page admin deve apenas renderizar seu conteúdo, sem replicar a estrutura de layout.

---

## Autenticação e Permissões

### Verificação de role
```ts
import { useUserRole } from '@/hooks/useUserRole'

const { isOwner, isCollaborator, isLoading } = useUserRole(restaurantId)
```

### Guards de rota
- Pages admin checam `session` via `RestaurantContext`
- Master pages checam `isMaster` flag
- Nunca confiar apenas no frontend — RLS no banco é a fonte de verdade

### Colaboradores
Roles disponíveis: `owner`, `manager`, `cashier`, `kitchen`, `delivery`. Verificar sempre com `has_role()` function do Supabase antes de ações sensíveis.

---

## Pagamentos

### Gateways suportados
| Gateway | Uso |
|---|---|
| Stripe | Cartão de crédito (assinaturas plataforma) |
| Mercado Pago | Cartão + PIX (restaurantes brasileiros) |
| PIX direto | Pagamento manual confirmado pelo admin |

### Regra de ouro
**Nunca processar pagamento no frontend.** Todo processamento passa por Edge Functions:
- `supabase/functions/create-checkout/` — Stripe
- `supabase/functions/generate-pix/` — PIX
- `supabase/functions/process-card-payment/` — cartão MP

---

## Integrações Externas

| Integração | Edge Function | Propósito |
|---|---|---|
| iFood | `ifood-poll-orders`, `ifood-connect-merchant` | Importar pedidos |
| WhatsApp Business | `whatsapp-bot`, `whatsapp-instance` | Bot e marketing |
| 99Food | `nf-webhook`, `nf-connect-merchant`, `nf-order-action`, `nf-disconnect` | Importar pedidos (webhooks) — ver `docs/integracao-99food.md` |
| NFe/NFC-e (Spedy) | `spedy-issue-invoice`, `spedy-webhook`, `spedy-*` | Nota fiscal eletrônica |
| Meta Pixel | `meta-conversions`, `src/lib/meta-pixel.ts` | Tracking de conversão |
| OpenAI | `ai-generate-content` | Geração de descrições e imagens |
| Push notifications | `send-push`, `src/lib/push-notifications.ts` | Notificações mobile |

---

## Performance

### Boas práticas obrigatórias
1. **Lazy load** todas as pages admin (já implementado — manter)
2. **`enabled: !!id`** em queries que dependem de IDs — nunca disparar query com `undefined`
3. **`select` específico** no Supabase — não usar `select('*')` em tabelas grandes de produção, especificar colunas
4. **Debounce** em inputs de busca — usar o hook `useDebounce` antes de disparar queries
5. **Paginação** em listagens grandes (pedidos, clientes, relatórios)

### Realtime — usar com critério
Supabase Realtime consome conexões. Ativar apenas onde necessário (pedidos ao vivo, notificações de cozinha). Sempre cancelar subscription no cleanup do `useEffect`.

---

## Tratamento de Erros

### Logger
```ts
import { logger } from '@/lib/logger'

logger.error('Mensagem', { context: dados })
```

### Erros de usuário
Usar `sonner` (já importado globalmente):
```ts
import { toast } from 'sonner'

toast.error('Mensagem amigável para o usuário')
toast.success('Ação concluída com sucesso')
```

### Erros de formulário
Sempre exibir com `FormMessage` do shadcn/ui — nunca `console.log` de erros silenciosos.

---

## Variáveis de Ambiente

| Variável | Onde é usada |
|---|---|
| `VITE_SUPABASE_URL` | Cliente Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Cliente Supabase (chave anon) |
| `VITE_SUPABASE_PROJECT_ID` | Geração de tipos, CLI |
| `VITE_CLARITY_PROJECT_ID` | Microsoft Clarity — gravação de sessão e heatmaps do cardápio do cliente (agrupado por restaurante via custom tags) |

Prefixo `VITE_` obrigatório para qualquer variável acessível no frontend (exposta ao browser). Segredos (Stripe secret key, API keys de terceiros) ficam **apenas** nas Edge Functions como secrets do Supabase, nunca no `.env` do frontend.

---

## Internacionalização

O produto é voltado para o mercado brasileiro:
- Moeda: Real (R$) — usar `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`
- Datas: `date-fns` com `ptBR` locale
- Telefone: formato `(XX) XXXXX-XXXX`
- CPF/CNPJ: validar com `src/utils/cpfCnpj.ts`
- Texto da UI: português brasileiro

---

## Problemas Conhecidos / Dívida Técnica

1. **TypeScript fraco**: `strict: false` em `tsconfig.app.json`. Ao criar código novo, preferir tipos explícitos e evitar `any`.
2. **Sem testes**: não há arquivos de teste. Ao adicionar lógica de negócio crítica (cálculos financeiros, validações), considerar adicionar testes unitários com Vitest.
3. **Componentes grandes**: `AdminOrders.tsx`, `AdminSalao.tsx`, `AdminReports.tsx` são muito grandes — ao editar, extrair sub-componentes quando possível.
4. **Strings mágicas**: status de pedido e roles de colaborador aparecem em múltiplos arquivos. Consultar `src/types/order.ts` para status canônicos.
5. **Sem Error Boundaries**: adicionar quando criar novas seções de UI críticas.

---

## Fluxo de Pedido (referência rápida)

```
Cliente faz pedido
  → submit_order (RPC Supabase)
    → cria registro em `orders` + `order_items`
    → envia notificação push para admin
Admin vê no Kanban (AdminOrders)
  → muda status: pending → confirmed → preparing → ready → delivered
    → Realtime atualiza UI do cliente em OrderConfirmation
```

Status possíveis: `pending`, `confirmed`, `preparing`, `ready`, `out_for_delivery`, `delivered`, `canceled`

---

## Checklist antes de abrir PR

- [ ] Layout testado em mobile (375px) e desktop (1280px+)
- [ ] Dark mode sem cores quebradas
- [ ] Queries Supabase com `enabled` guard quando dependem de IDs
- [ ] Formulários com validação Zod
- [ ] Sem `console.log` em produção
- [ ] Sem segredos hardcoded (API keys, passwords)
- [ ] Lazy load mantido para novas pages admin
- [ ] Cache React Query invalidado após mutações
