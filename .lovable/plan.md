

# Guia Completo: Integração WhatsApp com Evolution API no EasyPanel

Este guia vai te conduzir desde a instalação da Evolution API até a integração completa com o sistema de campanhas.

---

## Arquitetura do Sistema

```text
┌────────────────────────────────────────────────────────────────┐
│                    FLUXO DE CAMPANHAS                          │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│   [1] ADMIN CRIA CAMPANHA                                      │
│         │                                                      │
│         ▼                                                      │
│   ┌─────────────┐      Salva       ┌─────────────────────┐    │
│   │  Frontend   │ ────────────────►│  Banco de Dados     │    │
│   │  (Lovable)  │                  │  campaigns +        │    │
│   └─────────────┘                  │  campaign_recipients│    │
│                                    └──────────┬──────────┘    │
│                                               │               │
│   [2] PROCESSAMENTO AUTOMÁTICO                │               │
│   ┌───────────────────────────────────────────┼────────────┐  │
│   │  CRON JOB (executa a cada 1 minuto)       │            │  │
│   │                    │                      │            │  │
│   │                    ▼                      │            │  │
│   │  ┌─────────────────────────────────┐      │            │  │
│   │  │  Edge Function                  │◄─────┘            │  │
│   │  │  process-campaigns              │                   │  │
│   │  │  - Busca msgs pendentes         │                   │  │
│   │  │  - Respeita intervalo 5 min     │                   │  │
│   │  │  - Limite 50 msgs/dia           │                   │  │
│   │  └──────────────┬──────────────────┘                   │  │
│   │                 │                                      │  │
│   │                 ▼                                      │  │
│   │  [3] ENVIO VIA WHATSAPP                                │  │
│   │  ┌─────────────────────────────────┐                   │  │
│   │  │  Evolution API (seu VPS)        │                   │  │
│   │  │  - Recebe requisição HTTP       │                   │  │
│   │  │  - Envia mensagem WhatsApp      │                   │  │
│   │  └─────────────────────────────────┘                   │  │
│   └────────────────────────────────────────────────────────┘  │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

## PARTE 1: Instalação da Evolution API no EasyPanel

### Passo 1.1 - Criar Novo Projeto
1. Acesse seu EasyPanel em `http://SEU_IP:3000`
2. Clique em **"+ New Project"**
3. Nome do projeto: `whatsapp-api`

### Passo 1.2 - Adicionar Banco de Dados PostgreSQL
1. Dentro do projeto, clique em **"+ Service"**
2. Selecione **"Postgres"** na lista de templates
3. Configure:
   - **Service Name**: `postgres`
   - Anote a senha gerada automaticamente

### Passo 1.3 - Adicionar Evolution API
1. Clique em **"+ Service"** novamente
2. Selecione **"App"**
3. Configure:
   - **Service Name**: `evolution`
   - **Image**: `atendai/evolution-api:latest`

### Passo 1.4 - Configurar Variáveis de Ambiente
Na aba **"Environment"** do serviço evolution, adicione:

```text
SERVER_URL=https://SEU_DOMINIO_OU_IP
AUTHENTICATION_TYPE=apikey
AUTHENTICATION_API_KEY=GERE_UMA_CHAVE_SEGURA
DATABASE_ENABLED=true
DATABASE_PROVIDER=postgresql
DATABASE_CONNECTION_URI=postgresql://postgres:SENHA_DO_POSTGRES@postgres:5432/postgres
DATABASE_CONNECTION_CLIENT_NAME=evolution
```

**Para gerar uma chave API segura**, execute no terminal:
```bash
openssl rand -hex 32
```

### Passo 1.5 - Configurar Domínio/Acesso
Na aba **"Domains"** do serviço evolution:

1. Clique em **"+ Add Domain"**
2. Preencha:
   - **Host**: `api-whatsapp.seudominio.com.br` (ou use o domínio do EasyPanel)
   - **Port**: `8080`
   - **HTTPS**: Ativado

**Se usar domínio próprio**, configure no seu DNS:
```text
Tipo: A
Nome: api-whatsapp
Valor: IP_DO_SEU_VPS
TTL: 3600
```

### Passo 1.6 - Deploy
1. Clique em **"Deploy"** no serviço evolution
2. Aguarde o container iniciar (verifique nos logs)
3. Acesse: `https://SEU_DOMINIO/manager` para verificar se está funcionando

---

## PARTE 2: Conectar WhatsApp

### Passo 2.1 - Criar Instância
Execute o comando (substitua os valores):

```bash
curl -X POST 'https://SEU_DOMINIO/instance/create' \
  -H 'Content-Type: application/json' \
  -H 'apikey: SUA_CHAVE_API' \
  -d '{
    "instanceName": "menufly",
    "integration": "WHATSAPP-BAILEYS",
    "qrcode": true
  }'
```

### Passo 2.2 - Escanear QR Code
Acesse no navegador:
```
https://SEU_DOMINIO/manager
```

1. Localize a instância `menufly`
2. Clique para ver o QR Code
3. Escaneie com o WhatsApp do número que fará os disparos

### Passo 2.3 - Testar Envio
```bash
curl -X POST 'https://SEU_DOMINIO/message/sendText/menufly' \
  -H 'Content-Type: application/json' \
  -H 'apikey: SUA_CHAVE_API' \
  -d '{
    "number": "5511999999999",
    "text": "Teste de mensagem da Evolution API!"
  }'
```

---

## PARTE 3: Integração com Lovable (o que eu vou implementar)

### Passo 3.1 - Você me informa as credenciais
Após completar as partes 1 e 2, me informe:
- **URL da API**: `https://api-whatsapp.seudominio.com.br`
- **API Key**: A chave que você gerou
- **Nome da Instância**: `menufly` (ou o nome que escolheu)

### Passo 3.2 - Eu configuro os secrets
Vou adicionar as variáveis de ambiente no sistema:
- `EVOLUTION_API_URL`
- `EVOLUTION_API_KEY`
- `EVOLUTION_INSTANCE_NAME`

### Passo 3.3 - Eu crio a Edge Function
Implementação da função `process-campaigns` que:
- Busca campanhas agendadas no banco
- Processa mensagens com intervalo de 5 minutos
- Envia para a Evolution API
- Atualiza status de entrega

### Passo 3.4 - Eu atualizo o Frontend
Modifico o `CreateCampaignDialog.tsx` para:
- Salvar campanhas no banco de dados
- Salvar lista de destinatários
- Mostrar progresso em tempo real
- Remover uso de localStorage

### Passo 3.5 - Eu configuro o Cron Job
Crio o agendamento automático usando pg_cron para executar a função a cada minuto.

---

## Limites de Segurança

| Proteção | Valor |
|----------|-------|
| Intervalo entre mensagens | 5 minutos |
| Limite diário por restaurante | 50 mensagens |
| Horário de envio | 9h às 21h |

Estes limites protegem contra banimento do número no WhatsApp.

---

## Resumo de Custos

| Item | Custo |
|------|-------|
| VPS StayCloud | R$ 30-50/mês |
| Evolution API | Grátis |
| EasyPanel | Grátis |
| PostgreSQL | Grátis |

---

## Checklist

- [ ] EasyPanel acessível
- [ ] PostgreSQL rodando
- [ ] Evolution API rodando
- [ ] Domínio/HTTPS configurado
- [ ] Instância WhatsApp criada
- [ ] QR Code escaneado
- [ ] Teste de envio funcionando
- [ ] Credenciais informadas para integração

---

## Próximos Passos

1. **Você**: Configure a Evolution API seguindo os passos acima
2. **Você**: Conecte seu WhatsApp escaneando o QR Code
3. **Você**: Teste o envio de uma mensagem
4. **Você**: Me informe: URL, API Key e nome da instância
5. **Eu**: Adiciono os secrets e implemento toda a integração

Quando completar, me envie uma mensagem com as credenciais no formato:
```
URL: https://sua-url.com
API Key: sua-chave
Instância: menufly
```

