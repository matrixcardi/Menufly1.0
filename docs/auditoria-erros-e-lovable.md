# Auditoria do Projeto — Erros de Código e Resquícios do Lovable

> Data da análise: 02/07/2026
> Ferramentas usadas: `tsc --noEmit` (TypeScript) e `eslint .` — os mesmos verificadores que a IDE usa para marcar erros.

O projeto foi iniciado pelo Lovable e grande parte dos problemas listados aqui foi herdada dessa origem. Este documento consolida: **(1)** os erros identificados na varredura completa do código e **(2)** todos os resquícios de funcionalidade/configuração do Lovable que ainda existem no repositório.

---

## Parte 1 — Erros identificados na varredura

**Resultado geral:**

| Verificador | Resultado |
|---|---|
| TypeScript (`tsc --noEmit -p tsconfig.app.json`) | **155 erros** |
| ESLint (`npm run lint`) | **463 problemas** (393 erros + 70 avisos) |

### 1.1 Causa raiz principal: tipos do Supabase desatualizados (~70% dos erros TS)

O arquivo de tipos gerados (`src/integrations/supabase/types.ts`) está defasado em relação ao schema real do banco. Faltam nele:

- **Tabelas inteiras**: `stock_levels`, `purchase_orders`, `purchase_order_items`, `stock_movements`, `suppliers`, `ingredient_suppliers`, `pdv_tables`
- **RPC**: `list_restaurant_collaborators`
- **Colunas**: `orders.total_amount`, `orders.scheduled_at`, `restaurant_collaborators.role`, `restaurant_collaborators.status`, `restaurants.google_maps_url`

Isso derruba em cascata os arquivos mais afetados:

| Arquivo | Erros TS |
|---|---|
| `src/pages/admin/AdminListaCompras.tsx` | 24 |
| `src/pages/admin/AdminBIVisaoGeral.tsx` | 18 |
| `src/pages/admin/AdminEstoque.tsx` | 16 |
| `src/pages/admin/AdminFornecedores.tsx` | 13 |
| `src/pages/admin/AdminDRE.tsx` | 8 |
| `src/pages/admin/AdminSalao.tsx` | 8 |
| `src/pages/admin/AdminAgendamento.tsx` | 7 |
| (demais arquivos) | 1–6 cada |

**Correção**: regenerar os tipos —

```bash
npx supabase gen types typescript --project-id $VITE_SUPABASE_PROJECT_ID > src/integrations/supabase/types.ts
```

### 1.2 Erros genuínos de código (~30 erros que sobram após regenerar os tipos)

| Onde | Problema |
|---|---|
| `src/components/orders/OrderReceipt.tsx` (linhas 120, 124, 265, 271, 386, 392) | Comparações `>` e operações aritméticas entre `string` e `number` — valores chegam como string |
| `src/components/admin/OrderDetailDialog.tsx:162,170` | Mesmo problema de string × number |
| `src/components/admin/AddonGroupsSection.tsx:592` | `number` passado onde se espera `string` |
| `src/components/admin/PromoKitsSection.tsx:470,487` | `number` passado onde se espera `string` |
| `src/pages/admin/AdminDrivers.tsx:409` | `number` passado onde se espera `string` |
| `src/components/menu/PromoDetailDrawer.tsx:306` | Tipo `SelectedAddons` incompatível: o drawer usa `string[]`, mas o `CartContext` espera `Record<string, number>` |
| `src/components/forms/AddressForm.tsx:121-127` | Campos `logradouro`, `bairro`, `complemento`, `localidade` não existem em `GeocodingResult` (parecem campos do ViaCEP usados no tipo errado) |
| `src/components/orders/OrdersTab.tsx:170` | Propriedade `orderNumber` não existe no tipo `Order` |
| `src/hooks/useCurrentRestaurant.ts` | 5 erros derivados de coluna `role` ausente nos tipos + instanciação de tipo excessivamente profunda (TS2589) |

### 1.3 ESLint — distribuição por regra

| Regra | Qtde | Gravidade |
|---|---|---|
| `@typescript-eslint/no-explicit-any` | 384 | Dívida técnica difusa — reflexo do `strict: false` no tsconfig |
| `react-hooks/exhaustive-deps` | 55 | Avisos — dependências faltando em `useEffect` |
| `react-refresh/only-export-components` | 15 | Constantes exportadas junto com componentes |
| `react-hooks/rules-of-hooks` | 2 | **Bug real**: hooks chamados condicionalmente em `src/components/admin/HelpChatWidget.tsx:169-175` — pode quebrar em runtime |
| `no-case-declarations`, `no-empty-object-type`, `no-require-imports`, `no-empty`, `prefer-const` | 7 | Pontuais |

### 1.4 Prioridade de correção sugerida

1. **Regenerar os tipos do Supabase** — resolve ~70% dos erros TS de uma vez
2. **Corrigir os hooks condicionais** em `HelpChatWidget.tsx` (risco de crash em runtime)
3. **Atacar os ~30 erros genuínos de tipo** (seção 1.2)
4. Limpeza gradual dos 384 `any` conforme os arquivos forem sendo tocados

---

## Parte 2 — Resquícios do Lovable

O código-fonte em `src/` está limpo — nenhuma referência ao Lovable na lógica da aplicação. Os resquícios estão todos em arquivos de configuração e metadados, listados do mais crítico ao mais cosmético:

### 2.1 `capacitor.config.ts` — **o mais grave**

```ts
appId: 'app.lovable.7c949e480a4647daa8185948abd25083',
server: {
  url: 'https://7c949e48-0a46-47da-a818-5948abd25083.lovableproject.com?forceHideBadge=true',
  cleartext: true,
},
```

- O `appId` que identificaria o app nas lojas (App Store / Play Store) é da Lovable, não do MenuFly.
- O `server.url` faz o app mobile carregar o site **direto dos servidores do Lovable** em vez de usar o build local (`dist`). **Se o projeto for desativado no Lovable, o app mobile para de funcionar.**
- **Correção**: trocar para um appId próprio (ex.: `com.menufly.app`) e remover o bloco `server` para o app empacotar o build local.

### 2.2 `vite.config.ts` (linhas 4 e 19) — plugin `componentTagger`

```ts
import { componentTagger } from "lovable-tagger";
// ...
mode === "development" && componentTagger(),
```

Injeta atributos nos componentes para o editor visual do Lovable identificar o que o usuário clica. Só roda em dev, mas é peso morto fora do Lovable.

### 2.3 `package.json` (linha 92) — dependência `lovable-tagger`

```json
"lovable-tagger": "^1.1.13"
```

Só existe para servir o plugin acima. Remover junto com ele.

### 2.4 `index.html` (linhas 15 e 19) — imagens de compartilhamento social

```html
<meta property="og:image" content="https://lovable.dev/opengraph-image-p98pqg.png" />
<meta name="twitter:image" content="https://lovable.dev/opengraph-image-p98pqg.png" />
```

Quando alguém compartilha o link do MenuFly no WhatsApp/redes sociais, aparece a **imagem padrão do Lovable**. Trocar por uma imagem própria da marca.

### 2.5 `README.md` — boilerplate completo do Lovable

O README é 100% o template padrão ("Welcome to your Lovable project"), inclusive com o placeholder `REPLACE_WITH_PROJECT_ID` não preenchido. Reescrever descrevendo o MenuFly de fato.

### 2.6 `bun.lock` — lockfile do sandbox do Lovable

Todas as URLs do arquivo apontam para o registry npm interno da Lovable (`europe-west4-npm.pkg.dev/lovable-core-prod/...`). Como o projeto usa npm (existe `package-lock.json`), esse arquivo é lixo herdado e pode confundir ferramentas de build/CI. Deletar.

### 2.7 Checklist de limpeza

> **Atualização (13/07/2026):** limpeza executada. Além dos itens abaixo, a remoção completa cobriu dependências funcionais descobertas depois desta auditoria: funções de IA desativadas (usavam o gateway `ai.gateway.lovable.dev`), e-mail transacional migrado do Lovable para o Resend, e todas as URLs `menufly.lovable.app` trocadas por `menufly.com.br` (auth, CORS, checkouts, OAuth Mercado Pago). Pendências operacionais em `docs/` e no plano da sessão.

- [x] `capacitor.config.ts`: appId próprio (`br.com.menufly.app`) + remover `server.url`
- [x] `vite.config.ts`: remover import e uso do `componentTagger`
- [x] `package.json`: remover `lovable-tagger` (`npm uninstall lovable-tagger`)
- [x] `index.html`: substituir `og:image` e `twitter:image` por imagem própria (`public/og-image.png`)
- [x] `README.md`: reescrever para o MenuFly
- [x] Deletar `bun.lock` (e `bun.lockb`)

---

## Observações finais

- O repositório remoto (`github.com/matrixcardi/Menufly1.0`) já é próprio, não um espelho do Lovable — os commits são de autores humanos do time.
- A pasta `public/` não contém uploads do Lovable (não existe `public/lovable-uploads/`).
- Nenhuma variável de ambiente ou Edge Function referencia serviços do Lovable.
