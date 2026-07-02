# Integração 99Food

> **Atenção ao prefixo:** as Edge Functions `nf-*` são da integração **99Food** ("nineFood"), **não** de NFe. Nota fiscal eletrônica é tratada pelas funções `spedy-*`.

## Visão geral

O MenuFly importa pedidos do 99Food (plataforma de delivery da DiDi) via **99Food Protocol com webhooks** — os pedidos chegam por push, sem polling nem cron. O protocolo alternativo Open Delivery (polling) foi descartado.

- **Documentação oficial da API**: https://developer-food.99app.com/pt-BR/openapi
- **Base da API**: `https://openapi.99food.com` (sobrescrevível via secret `NINE9FOOD_BASE` para sandbox)
- **Formato de resposta**: `{ errno, errmsg, data }` — `errno 0` = sucesso

### Decisões de projeto

1. **Webhooks, não polling** — o 99Food envia todos os eventos para uma URL única por app.
2. **Auto-confirm** — o pedido é confirmado automaticamente no 99Food na chegada do webhook `orderNew`, porque o 99Food **cancela pedidos não confirmados em 5 minutos**.
3. **`app_shop_id` = `restaurant_id`** — o identificador da loja no nosso lado (`app_shop_id`) é o UUID do restaurante no MenuFly; o `shop_id` (ID interno do 99Food) fica salvo em `platform_integrations.merchant_id`.
4. **Sem migração de banco** — `platform_integrations` (platform=`'99food'`) e `orders` (source=`'99food'`, `external_id`, `external_data`) já cobrem tudo.

## Arquitetura

```
99Food ──webhook──▶ nf-webhook ──▶ orders (insert/update) ──Realtime──▶ Kanban (AdminOrders)
                        │
                        └─▶ auto-confirm (POST /v1/order/order/confirm)

Kanban ──changeStatus/cancelOrder──▶ nf-order-action ──▶ 99Food (ready/delivered/cancel)

AdminIntegrations ──▶ nf-connect-merchant (start/verify) ──▶ URL de autorização + conexão
                  └─▶ nf-disconnect ──▶ unbind + delete da integração
```

### Arquivos

| Arquivo | Papel |
|---|---|
| `supabase/functions/_shared/nine9food.ts` | Helper: MD5, assinatura, parse bigint-safe, `ensureAuthToken`, mapeadores, `buildOrderRow` |
| `supabase/functions/nf-webhook/` | Recebe todos os eventos do 99Food (`verify_jwt = false`) |
| `supabase/functions/nf-connect-merchant/` | Fluxo de conexão: `action: 'start'` \| `'verify'` |
| `supabase/functions/nf-order-action/` | Push-back do Kanban: `ready` \| `delivered` \| `cancel` |
| `supabase/functions/nf-disconnect/` | Unbind best-effort + delete da integração |
| `src/pages/admin/AdminIntegrations.tsx` | UI de conexão (gerar link → autorizar → verificar) |
| `src/hooks/useLiveOrders.ts` | Sincroniza mudanças de status do Kanban com o 99Food |

## Autenticação

- **Credenciais de plataforma** (secrets do Supabase): `NINE9FOOD_APP_ID` + `NINE9FOOD_APP_SECRET`.
- **Token por loja**: `auth_token` com expiração, obtido em `GET /v1/auth/authtoken/get` (rate limit **1 req/30s**; errno `10102` = expirado) e renovado via `/v1/auth/authtoken/refresh` (cooldown 2 min, depois chamar `/get` de novo). Persistido em `platform_integrations.access_token`/`token_expires_at` — tudo encapsulado em `ensureAuthToken()`.
- **Assinatura de webhook**: header `didi-header-sign` = `MD5(rawBody + app_secret)`. Assinatura inválida → HTTP 401 (único caso em que o webhook não responde ok).
- **Assinatura de endpoints app-level** (`signParams`): ordenar chaves ASCII, juntar `k=v` com `&`, concatenar o secret, MD5 hex.

## Cuidados críticos com o payload

1. **IDs são int64 de 19 dígitos** — `JSON.parse` puro perde precisão silenciosamente. Sempre usar `parseNfJson()`, que quota `order_id`, `shop_id`, `app_id`, `sub_order_id`, `delivery_id` e `rider_id` no texto cru antes do parse.
2. **Preços em centavos** (int) — dividir por 100 antes de gravar em `orders`.
3. **Resposta do webhook** — o 99Food exige `{"errno":0,"errmsg":"ok"}` em **até 6s**, senão reenvia o evento. Por isso o `nf-webhook` nunca retorna 500 (erros internos são logados e respondidos com ok) e o auto-confirm roda em background via `EdgeRuntime.waitUntil()`.

## Eventos do webhook (`nf-webhook`)

| `type` | Ação |
|---|---|
| `orderNew` | Insert em `orders` (idempotente por `source+external_id`) + **auto-confirm** em background. Falha no confirm → `last_error` na integração + aviso "⚠️ CONFIRMAÇÃO AUTOMÁTICA FALHOU" nas notes do pedido |
| `orderCancel` / `orderPartialCancel` | Pedido local → `cancelled` + `cancellation_reason` traduzido (`nfCancelReasonText`) |
| `orderFinish` | Pedido local → `delivered` |
| `deliveryStatus` | Coleta → `out_for_delivery`; entrega → `delivered`; dados do entregador salvos em `external_data.delivery_status` |
| `orderConfirm` / `orderReady` | Eco das nossas chamadas — não sobrescreve o Kanban, só merge em `external_data`. Exceção: `orderReady` com pedido local `pending`/`preparing` (lojista usou o app 99Food) → sync para `ready` |
| `shopBindStatus` | Bind → busca `shop/detail`, grava `merchant_id`/`merchant_name`, status `connected`; unbind → `disconnected` + limpa tokens |
| `orderCancelApply` / `orderRefundApply` | **Fase 2** — só loga, merge em `external_data` e avisa nas notes ("responda no app 99Food"). O 99Food auto-recusa cancelamento / auto-aceita refund por padrão |

### Status do pedido (numérico → MenuFly)

| 99Food | MenuFly |
|---|---|
| 100 (criado) | `pending` |
| 200 (aceito) | `preparing` |
| 400 (coletado) / 500 (chegou) | `out_for_delivery` |
| 600 (concluído) | `delivered` |
| 9xx (cancelado) | `cancelled` — 902 cliente, 921/923 loja, 922 timeout de confirmação, 961 suporte, 971/981 entregador |

### Pagamento (`mapNfPayment`)

| Condição | `payment_method` / `payment_status` |
|---|---|
| `pay_channel` 212 ou 280 | `pix` / `paid` |
| `pay_channel` 153 ou `pay_type` 2 | `cash` / `pending` |
| `pay_type` 3 (maquininha) | `card` / `pending` |
| `pay_method` 1 (online) | `card` / `paid` |
| Demais | `card` / `pending` |

O CHECK de `orders.payment_method` só aceita `cash|card|pix` — vale-refeição cai em `card`.

## Fluxo de conexão de loja

1. No painel (**Admin → Integrações → 99food**), clicar em **"Gerar link de autorização"** → `nf-connect-merchant {action:'start'}` chama `POST /v1/auth/authorizationpage/getUrl` e devolve a URL self-service (válida 7 dias).
2. O lojista abre o link, faz login com a conta da loja no 99Food e **autoriza a Menufly**.
3. Dois caminhos finalizam a conexão (o que ocorrer primeiro):
   - o webhook `shopBindStatus` chega e grava `merchant_id`/`merchant_name` + status `connected`;
   - o lojista clica em **"Verificar conexão"** → `nf-connect-merchant {action:'verify'}` tenta obter o `auth_token` e busca `GET /v1/shop/shop/detail`.
4. Desconectar: botão no dialog → `nf-disconnect` (faz `POST /v1/shop/shop/unbind` best-effort e apaga a integração).

## Fluxo do pedido no Kanban (`useLiveOrders.ts`)

| Transição local | Ação no 99Food |
|---|---|
| `pending → preparing` (aceitar) | Nada — já auto-confirmado no webhook |
| `→ ready` / `pickup_ready` | `POST /v1/order/order/ready` |
| `→ delivered` | `POST /v1/order/order/delivered` — **só para entrega própria da loja** (`external_data.delivery_type === 2`); entregas da 99 são concluídas pelo entregador deles (`skipped: true`) |
| `→ rejected` ou cancelar | `POST /v1/order/order/cancel` com `reason_id: 1080` (outro) + motivo em texto |

O update local é otimista; a sincronização falhando gera toast destrutivo ("Falha ao sincronizar com o 99Food") e o lojista deve atualizar no app do 99Food.

**Guards adicionados (corrigem bugs latentes):**
- Auto-estorno via Mercado Pago só para pedidos do próprio MenuFly (`!source || source === 'menufly'`) — antes, rejeitar um pedido iFood/99food "pago" dispararia estorno indevido no MP.
- Auto-dispatch do Lá Vem Entregas pula pedidos 99food com entrega da própria 99 (`external_data.delivery_type === 1`).

## Configuração (deploy)

1. **Secrets no Supabase** (nunca no `.env` do frontend):
   ```bash
   npx supabase secrets set NINE9FOOD_APP_ID=<app_id>
   npx supabase secrets set NINE9FOOD_APP_SECRET=<app_secret>
   # opcional, para sandbox:
   npx supabase secrets set NINE9FOOD_BASE=https://<sandbox-host>
   ```
2. **Deploy das functions**:
   ```bash
   npx supabase functions deploy nf-webhook nf-connect-merchant nf-order-action nf-disconnect
   ```
3. **Portal 99Food**: cadastrar a URL do webhook (única por app):
   ```
   https://tviknowihpwolwfjuwog.supabase.co/functions/v1/nf-webhook
   ```
4. `supabase/config.toml`: `nf-webhook` tem `verify_jwt = false` (o 99Food não manda JWT — a autenticação é a assinatura MD5). As demais `nf-*` usam o default (`verify_jwt = true`) e validam Bearer + ownership manualmente.

## Teste local

Sem Deno/Docker dá para testar a lógica pura do helper em Node (parse bigint-safe, mapeadores, assinatura) — ver histórico do teste com shim de `std/crypto`.

Com o CLI do Supabase:

```bash
supabase functions serve nf-webhook --no-verify-jwt
# em outro terminal:
BODY='{"type":"orderNew","app_id":123,"app_shop_id":"<restaurant_uuid>","data":{"order_info":{...}}}'
SIGN=$(printf '%s%s' "$BODY" "$APP_SECRET" | md5sum | cut -d' ' -f1)
curl -s http://localhost:54321/functions/v1/nf-webhook -H "didi-header-sign: $SIGN" -d "$BODY"
```

Checklist do teste local:
- [ ] Resposta `{"errno":0,"errmsg":"ok"}`
- [ ] Pedido em `orders` com `external_id` de 19 dígitos íntegro, preços ÷100, items + addons
- [ ] Reenvio do mesmo body → sem duplicata
- [ ] Assinatura errada → 401
- [ ] `orderCancel` → status `cancelled` com motivo traduzido
- [ ] `pay_channel` 153/212/150 → cash-pending / pix-paid / card-paid
- [ ] Falha do confirm → aviso nas notes + `last_error` na integração

## Próximos passos

### 1. Antes de produção (obrigatório)
- [ ] Obter credenciais de integradora (`app_id`/`app_secret`) junto ao 99Food e configurar os secrets no Supabase
- [ ] Deploy das 4 functions + cadastro da URL do webhook no portal 99Food
- [ ] Rodar `deno check` nas functions no ambiente de deploy (Deno não está instalado na máquina de dev)

### 2. Homologação em sandbox (pontos em aberto da API)
- [ ] **`app_shop_id` na URL de autorização** — o `nf-connect-merchant` anexa `?app_shop_id=<restaurant_id>` por conta própria se a URL não vier com ele; confirmar se o 99Food aceita/propaga esse parâmetro
- [ ] **`order_id` como string nos POSTs** — o `nfOrderPost` envia string e tem fallback com corpo pré-serializado (int64 cru); confirmar qual formato a API aceita
- [ ] **Params exatos do `/v1/auth/authtoken/get`** — assinatura implementada via `signParams` sobre `{app_id, app_shop_id}`; validar contra o sandbox (inclusive se exige `timestamp`)
- [ ] **Códigos do `shopBindStatus`** — a detecção bind/unbind é heurística (`bind_status`/`bindStatus`/`status`, unbind se contiver "unbind" ou valor 2); ajustar com os valores reais
- [ ] **Códigos do `deliveryStatus`** — o mapeamento usa a mesma escala do status do pedido; ajustar se o evento tiver escala própria
- [ ] Roteiro completo: conectar loja de teste → pedido de teste chega no Kanban `pending` e é confirmado no portal em <5 min → `preparing → ready → delivered` refletindo no portal → cancelamento nos dois sentidos → desconectar/reconectar
- [ ] Regressão: conexão iFood (dialog compartilhado) e estorno de pedido MenuFly (guard novo)

### 3. Fase 2 (pós-lançamento)
- [ ] Responder `orderCancelApply`/`orderRefundApply` pela API (aceitar/recusar direto do painel) — hoje só avisa nas notes do pedido
- [ ] Exibir dados do entregador da 99 (`external_data.delivery_status`) no card do pedido
- [ ] Sincronização de cardápio/estoque com o 99Food (a integração atual é só de pedidos)
