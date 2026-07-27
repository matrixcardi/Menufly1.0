# MenuFly

Plataforma SaaS multi-tenant de gerenciamento de restaurantes e delivery.

- **App do cliente**: cardápio digital por slug (`/:slug`), carrinho, checkout e rastreamento de pedido
- **Painel admin** (`/admin`): gestão de cardápio, pedidos, estoque, financeiro, CRM, marketing, PDV e integrações
- **Master admin** (`/master`): visão cross-restaurant para operação da plataforma
- **App mobile**: iOS e Android via Capacitor

## Stack

- React 18 + TypeScript + Vite
- Tailwind CSS + shadcn/ui
- Supabase (Postgres, Auth, Realtime, Edge Functions)
- React Query (`@tanstack/react-query`)
- Capacitor (mobile)

## Desenvolvimento

```sh
npm install
npm run dev       # servidor de desenvolvimento em http://localhost:8080
```

Outros comandos:

```sh
npm run build     # build de produção
npm run lint      # verificação ESLint
npm run preview   # visualizar build localmente
```

Variáveis de ambiente necessárias (`.env`):

```
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_SUPABASE_PROJECT_ID=
```

## Deploy

- **Web**: Vercel (`vercel.json` já configurado para SPA routing), domínio `menufly.com.br`
- **Backend**: Supabase — Edge Functions em `supabase/functions/`, deploy via `supabase functions deploy <nome>`
- **Mobile**: `npm run build && npx cap sync` e build nativo via Android Studio / Xcode

## Documentação

- Guia de desenvolvimento: `CLAUDE.md`
- Integrações e auditorias: `docs/`
