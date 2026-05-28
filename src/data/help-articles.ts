import {
  Utensils, ClipboardList, Truck, CreditCard, Users, Sparkles,
  Megaphone, Bot, Calculator, Tag, Settings, Printer, BarChart3,
  Link2, Store, HelpCircle, type LucideIcon,
} from "lucide-react";

export interface HelpArticle {
  id: string;
  title: string;
  summary: string;
  content: string; // markdown-like plain text
}

export interface HelpCategory {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  gradient: string;
  articles: HelpArticle[];
}

export interface FaqItem {
  question: string;
  answer: string;
}

// ─── FAQ ──────────────────────────────────────────────
export const faqItems: FaqItem[] = [
  {
    question: "Como meus clientes acessam o cardápio?",
    answer:
      "Seu cardápio fica disponível em um link exclusivo (ex: menufly.lovable.app/seu-restaurante). Basta compartilhar o link nas redes sociais, WhatsApp ou imprimir um QR Code. Não é necessário instalar nenhum aplicativo.",
  },
  {
    question: "Preciso pagar taxa por pedido?",
    answer:
      "Não! O MenuFly cobra apenas a assinatura mensal. Você não paga comissão por pedido, diferente dos marketplaces tradicionais.",
  },
  {
    question: "Como recebo os pagamentos dos clientes?",
    answer:
      "Os pagamentos via PIX e cartão caem diretamente na sua conta do Mercado Pago. O MenuFly não intermedia os valores — todo o dinheiro é seu.",
  },
  {
    question: "Posso usar no celular?",
    answer:
      "Sim! O painel administrativo é 100% responsivo e também oferecemos um app nativo para Android e iOS para acompanhar pedidos com notificações push.",
  },
  {
    question: "Como funciona o período de teste?",
    answer:
      "Você pode criar sua conta gratuitamente e montar todo o seu cardápio. O período de teste permite que você configure tudo antes de começar a receber pedidos.",
  },
  {
    question: "Consigo importar meu cardápio de outro sistema?",
    answer:
      "Atualmente a importação é manual, mas nosso painel é muito intuitivo. Você consegue cadastrar todos os produtos rapidamente com fotos, descrições e preços.",
  },
  {
    question: "O sistema funciona para delivery e retirada?",
    answer:
      "Sim! Você pode habilitar entrega, retirada no balcão, ou ambos. Cada modalidade tem configurações independentes.",
  },
  {
    question: "Como configuro as taxas de entrega?",
    answer:
      "Você pode configurar zonas de entrega por bairro e cidade, definindo taxa e tempo estimado para cada região individualmente.",
  },
];

// ─── CATEGORIAS & ARTIGOS ─────────────────────────────
export const helpCategories: HelpCategory[] = [
  {
    id: "cardapio",
    name: "Cardápio Digital",
    description: "Monte e gerencie seu cardápio completo",
    icon: Utensils,
    gradient: "from-emerald-500 to-emerald-700",
    articles: [
      {
        id: "criar-categorias",
        title: "Como criar e organizar categorias",
        summary: "Aprenda a criar categorias para organizar seus produtos no cardápio.",
        content: `As categorias são a base da organização do seu cardápio. Cada produto pertence a pelo menos uma categoria.

**Como criar uma categoria:**
1. Acesse o painel admin → Cardápio
2. Clique em "Nova Categoria"
3. Digite o nome da categoria (ex: Pizzas, Bebidas, Sobremesas)
4. A categoria será criada automaticamente

**Organizando a ordem:**
- Arraste e solte as categorias para reordená-las
- A ordem definida aqui é a mesma que o cliente verá no cardápio
- Você pode ativar/desativar categorias sem excluí-las

**Dica:** Use nomes claros e objetivos. Evite categorias muito genéricas como "Outros".`,
      },
      {
        id: "cadastrar-produtos",
        title: "Como cadastrar e editar produtos",
        summary: "Guia completo para adicionar produtos com fotos, preços e descrições.",
        content: `Cada produto no seu cardápio pode ter foto, descrição, preço e diversas configurações.

**Cadastrando um novo produto:**
1. Acesse Cardápio → clique em "Novo Produto"
2. Preencha: nome, descrição, preço e categoria
3. Faça upload de uma foto (recomendamos 800x800px, formato quadrado)
4. Clique em "Salvar"

**Campos importantes:**
- **Nome**: aparece em destaque no cardápio
- **Descrição**: detalhe ingredientes ou informações relevantes
- **Preço**: valor em reais
- **Foto**: fundamental para aumentar as vendas — produtos com foto vendem até 3x mais
- **Popular**: marque para aparecer na seção "Mais Pedidos"
- **Ativo/Inativo**: desative temporariamente sem excluir

**Editando um produto:**
- Clique no produto na lista do cardápio
- Altere qualquer campo e salve
- As alterações são instantâneas no cardápio do cliente`,
      },
      {
        id: "complementos-adicionais",
        title: "Complementos e adicionais (add-ons)",
        summary: "Configure grupos de complementos para personalizar pedidos.",
        content: `Os complementos permitem que o cliente personalize o pedido (ex: escolher sabor, adicionar bacon, etc).

**Criando um grupo de complementos:**
1. Acesse Cardápio → aba "Complementos"
2. Clique em "Novo Grupo"
3. Defina: nome do grupo, tipo (obrigatório ou opcional), mínimo e máximo de seleções
4. Adicione os itens com nome e preço adicional

**Tipos de grupo:**
- **Obrigatório**: o cliente DEVE escolher (ex: "Escolha o sabor")
- **Opcional**: o cliente pode pular (ex: "Adicionais")

**Vinculando a produtos:**
- Após criar o grupo, vincule-o aos produtos desejados
- Um produto pode ter vários grupos de complementos
- A ordem dos grupos pode ser alterada arrastando

**Exemplo prático:**
- Produto: "Hambúrguer Clássico"
- Grupo 1 (obrigatório): "Ponto da carne" → Mal passado, Ao ponto, Bem passado
- Grupo 2 (opcional): "Adicionais" → Bacon (+R$5), Queijo extra (+R$3), Ovo (+R$3)`,
      },
      {
        id: "destaques-menu",
        title: "Destaques do cardápio",
        summary: "Destaque produtos e promoções no topo do seu cardápio.",
        content: `Os destaques aparecem como banners no topo do cardápio, chamando atenção para ofertas especiais.

**Como adicionar um destaque:**
1. Acesse Cardápio → aba "Destaques"
2. Clique em "Novo Destaque"
3. Escolha o tipo: Produto ou Cupom
4. Selecione o item e personalize título/descrição

**Tipos de destaque:**
- **Produto**: destaca um produto específico com foto e preço
- **Cupom**: mostra um cupom de desconto clicável

**Dicas:**
- Use no máximo 3-4 destaques para não poluir
- Atualize regularmente com novas ofertas
- Destaques com boas fotos convertem muito mais`,
      },
      {
        id: "temas-cardapio",
        title: "Temas do cardápio (claro/escuro)",
        summary: "Personalize a aparência do cardápio para seus clientes.",
        content: `O cardápio pode ser exibido em tema claro ou escuro.

**Como alterar o tema:**
1. Acesse Configurações → Negócio
2. Na seção "Aparência", escolha entre Claro ou Escuro
3. A alteração é instantânea

**Quando usar cada tema:**
- **Tema Escuro**: ideal para hamburguerias, bares, restaurantes sofisticados
- **Tema Claro**: ideal para confeitarias, açaiterias, restaurantes casuais

O tema afeta todo o visual do cardápio público do seu restaurante.`,
      },
    ],
  },
  {
    id: "pedidos",
    name: "Gestão de Pedidos",
    description: "Acompanhe e gerencie pedidos em tempo real",
    icon: ClipboardList,
    gradient: "from-blue-500 to-blue-700",
    articles: [
      {
        id: "receber-pedidos",
        title: "Como receber e gerenciar pedidos",
        summary: "Entenda o fluxo completo desde o recebimento até a entrega.",
        content: `O painel de pedidos mostra todos os pedidos em tempo real com atualizações automáticas.

**Fluxo do pedido:**
1. **Pendente** → cliente acabou de enviar o pedido
2. **Aceito** → você confirmou e está preparando
3. **Pronto** → pedido preparado, aguardando entrega/retirada
4. **Entregue** → pedido finalizado
5. **Cancelado** → pedido cancelado (com motivo)

**Ações disponíveis:**
- Aceitar ou recusar pedidos pendentes
- Mover entre status com um clique
- Ver detalhes completos: itens, complementos, endereço, pagamento
- Atribuir entregador ao pedido

**Notificações:**
- Som de alerta para novos pedidos (configurável)
- Notificações push no app mobile
- O tempo do pedido é exibido em contagem regressiva`,
      },
      {
        id: "pedido-manual",
        title: "Criando pedidos manuais",
        summary: "Registre pedidos feitos por telefone ou presencialmente.",
        content: `Você pode criar pedidos manualmente para atendimentos por telefone, balcão ou WhatsApp.

**Como criar um pedido manual:**
1. Na tela de Pedidos, clique em "Novo Pedido"
2. Selecione os produtos e quantidades
3. Preencha dados do cliente (nome, telefone)
4. Escolha: delivery ou retirada
5. Se delivery, informe o endereço
6. Selecione a forma de pagamento
7. Confirme o pedido

O pedido manual entra no fluxo normal e pode ser gerenciado como qualquer outro.`,
      },
      {
        id: "caixa-registradora",
        title: "Caixa registradora",
        summary: "Controle de abertura e fechamento de caixa diário.",
        content: `A caixa registradora ajuda a controlar o fluxo de dinheiro do dia.

**Abrindo o caixa:**
1. Clique em "Abrir Caixa" na tela de pedidos
2. Informe o valor de abertura (troco inicial)
3. O caixa ficará aberto até você fechar

**Fechando o caixa:**
1. Clique em "Fechar Caixa"
2. Informe o valor final em caixa
3. O sistema mostra o resumo: vendas do período, formas de pagamento, diferença

**Relatório do caixa:**
- Total de vendas por forma de pagamento
- Quantidade de pedidos
- Diferença entre valor esperado e valor informado`,
      },
      {
        id: "historico-pedidos",
        title: "Histórico e arquivamento de pedidos",
        summary: "Acesse pedidos anteriores e mantenha o painel organizado.",
        content: `Pedidos entregues e cancelados podem ser arquivados para manter o painel limpo.

**Arquivando pedidos:**
- Pedidos finalizados podem ser arquivados automaticamente
- Pedidos arquivados saem da visualização principal
- Você pode acessá-los a qualquer momento no histórico

**Filtros disponíveis:**
- Por status (pendente, aceito, pronto, entregue, cancelado)
- Por data
- Por forma de pagamento
- Busca por nome ou telefone do cliente`,
      },
    ],
  },
  {
    id: "entrega",
    name: "Entrega e Retirada",
    description: "Configure zonas, taxas e entregadores",
    icon: Truck,
    gradient: "from-orange-500 to-orange-700",
    articles: [
      {
        id: "zonas-entrega",
        title: "Configurando zonas de entrega",
        summary: "Defina bairros, cidades, taxas e tempo estimado por região.",
        content: `As zonas de entrega determinam onde você entrega, quanto cobra e o tempo estimado.

**Método por bairro/cidade:**
1. Acesse Entrega no painel admin
2. Clique em "Nova Zona"
3. Preencha: nome do bairro, cidade, taxa de entrega, tempo estimado
4. Ative ou desative zonas individualmente

**Campos de cada zona:**
- **Nome**: nome do bairro
- **Cidade**: cidade da zona
- **Taxa**: valor cobrado pela entrega
- **Tempo estimado**: em minutos
- **Ativo**: se a zona está disponível

**Como funciona para o cliente:**
- Na hora do pedido, o cliente seleciona cidade e bairro
- A taxa e tempo são aplicados automaticamente
- Se o bairro não estiver cadastrado, o cliente não consegue pedir delivery

**Dica:** Cadastre todos os bairros que você atende para não perder vendas.`,
      },
      {
        id: "modalidades-atendimento",
        title: "Delivery vs. Retirada no balcão",
        summary: "Habilite e configure as modalidades de atendimento.",
        content: `Você pode oferecer delivery, retirada no balcão, ou ambos.

**Configurando:**
1. Acesse Configurações → Negócio
2. Ative/desative "Delivery disponível" e "Retirada disponível"
3. Para retirada, não é cobrada taxa de entrega

**Pedido mínimo:**
- Defina um valor mínimo para pedidos de delivery
- Pedidos de retirada não têm valor mínimo (opcional)

**Endereço do restaurante:**
- Configure seu endereço completo para que o cliente saiba onde retirar
- O endereço aparece na confirmação do pedido de retirada`,
      },
      {
        id: "entregadores",
        title: "Cadastro de entregadores",
        summary: "Gerencie sua frota de entregadores com controle de comissão.",
        content: `Cadastre seus entregadores para atribuir entregas e controlar custos.

**Cadastrando um entregador:**
1. Acesse Entregadores no painel
2. Clique em "Novo Entregador"
3. Preencha: nome, telefone, modo de comissão

**Modos de comissão:**
- **Taxa fixa**: valor fixo mensal
- **Por corrida**: valor por entrega realizada
- **Ambos**: fixo + por corrida

**Atribuindo entregas:**
- Na tela de pedidos, selecione o entregador para cada pedido
- O sistema registra automaticamente para relatórios`,
      },
    ],
  },
  {
    id: "pagamentos",
    name: "Pagamentos",
    description: "PIX, cartão e dinheiro",
    icon: CreditCard,
    gradient: "from-green-500 to-green-700",
    articles: [
      {
        id: "metodos-pagamento",
        title: "Métodos de pagamento disponíveis",
        summary: "Conheça todas as formas de pagamento que você pode oferecer.",
        content: `O MenuFly suporta diversas formas de pagamento:

**1. Dinheiro:**
- Sempre disponível
- Ative/desative na aba Pagamentos

**2. PIX:**
- Pagamento instantâneo
- Pode usar chave PIX manual ou gateway automático (Mercado Pago)
- Com gateway: o cliente vê o QR Code e o pagamento é confirmado automaticamente

**3. Cartão Online (Mercado Pago):**
- Pagamento com cartão de crédito/débito no checkout
- Requer integração com Mercado Pago via OAuth
- Tokenização segura — dados do cartão nunca passam pelo seu servidor

**4. Cartão na Entrega:**
- Cliente paga com maquininha na hora da entrega
- Não requer integração — é apenas um registro`,
      },
      {
        id: "configurar-mercadopago",
        title: "Conectando o Mercado Pago",
        summary: "Passo a passo para integrar o Mercado Pago e receber online.",
        content: `A integração com o Mercado Pago permite cobrar via PIX automático e cartão de crédito.

**Como conectar:**
1. Acesse Pagamentos no painel admin
2. Na seção "Mercado Pago", clique em "Conectar"
3. Você será redirecionado para o Mercado Pago
4. Autorize o acesso à sua conta
5. Pronto! Volte ao painel e os métodos estarão disponíveis

**Após conectar:**
- Ative individualmente: PIX Online e/ou Cartão Online
- Cada método tem seu próprio toggle independente
- Os pagamentos caem direto na sua conta do Mercado Pago

**Importante:**
- Você precisa ter uma conta Mercado Pago ativa
- A conexão é via OAuth (segura, sem precisar compartilhar senhas)
- Você pode desconectar a qualquer momento`,
      },
      {
        id: "pix-manual",
        title: "PIX com chave manual",
        summary: "Aceite PIX sem integração automática usando sua chave.",
        content: `Se você não quer usar gateway, pode aceitar PIX com chave manual.

**Como configurar:**
1. Acesse Pagamentos → PIX
2. Selecione "PIX Manual"
3. Informe sua chave PIX (CPF, CNPJ, telefone, e-mail ou aleatória)

**Como funciona para o cliente:**
- O cliente seleciona PIX como pagamento
- Sua chave é exibida para o cliente copiar
- O cliente faz o PIX manualmente
- Você confirma o recebimento no painel

**Diferença do PIX automático:**
- Manual: você precisa conferir e confirmar manualmente
- Automático (Mercado Pago): confirmação instantânea com QR Code`,
      },
    ],
  },
  {
    id: "promocoes",
    name: "Promoções e Cupons",
    description: "Crie ofertas, combos e cupons de desconto",
    icon: Tag,
    gradient: "from-pink-500 to-rose-600",
    articles: [
      {
        id: "cupons-desconto",
        title: "Criando cupons de desconto",
        summary: "Configure cupons com regras de uso, validade e limites.",
        content: `Cupons são códigos que os clientes aplicam no carrinho para obter descontos.

**Criando um cupom:**
1. Acesse Promos → aba "Cupons"
2. Clique em "Novo Cupom"
3. Configure:
   - **Código**: texto que o cliente digita (ex: PROMO10)
   - **Tipo de desconto**: percentual (%) ou valor fixo (R$)
   - **Valor**: quantidade do desconto
   - **Pedido mínimo**: valor mínimo do carrinho para usar
   - **Máximo de usos**: limite total de utilizações
   - **Validade**: data de expiração

**Visibilidade no cardápio:**
- Ative "Mostrar no cardápio" para o cupom aparecer como banner
- O cliente pode clicar e aplicar automaticamente

**Dica:** Cupons com prazo curto geram urgência e mais conversões.`,
      },
      {
        id: "promos-automaticas",
        title: "Promoções automáticas",
        summary: "Configure promoções que se aplicam automaticamente.",
        content: `Promoções automáticas são aplicadas sem precisar de código — acontecem quando o cliente atinge a condição.

**Tipos de gatilho:**
- **Quantidade mínima**: "Na compra de 3+ itens, ganhe frete grátis"
- **Valor mínimo**: "Acima de R$50, ganhe 10% de desconto"
- **Produto específico**: "Compre o X e ganhe Y"
- **Categoria**: "Compre 2 pizzas e ganhe uma bebida"

**Tipos de benefício:**
- Frete grátis
- Desconto em percentual
- Desconto em valor fixo
- Produto grátis

**Agendamento:**
- Sempre ativa
- Dias da semana específicos
- Período com data início/fim
- Horário específico

**Exemplo:** "Toda terça e quinta, acima de R$60, frete grátis"`,
      },
      {
        id: "combos-kits",
        title: "Combos e kits promocionais",
        summary: "Monte combos com preço fixo ou desconto progressivo.",
        content: `Combos permitem agrupar produtos com preço especial.

**Criando um combo:**
1. Acesse Promos → "Novo Combo"
2. Defina o nome e descrição
3. Adicione os produtos que compõem o combo
4. Defina o preço fixo do combo
5. Opcionalmente, adicione uma foto

**Tipos de combo:**
- **Kit fixo**: produtos predefinidos com preço fechado
- **Kit com escolha**: cliente escolhe dentro de grupos (ex: "escolha 1 pizza + 1 bebida")

**Configuração de grupos:**
- Cada grupo pode ter: nome, produtos disponíveis, máximo de escolhas
- Grupos podem ser obrigatórios ou opcionais

**Dica:** Combos com foto e nome criativo vendem muito mais!`,
      },
    ],
  },
  {
    id: "crm",
    name: "CRM e Clientes",
    description: "Base de clientes e relacionamento",
    icon: Users,
    gradient: "from-violet-500 to-violet-700",
    articles: [
      {
        id: "base-clientes",
        title: "Sua base de clientes",
        summary: "Entenda como funciona o cadastro automático de clientes.",
        content: `Cada vez que um cliente faz um pedido, ele é automaticamente cadastrado na sua base.

**Informações salvas:**
- Nome e telefone
- Total de pedidos
- Total gasto
- Data do último pedido
- Produto favorito

**Visualizando clientes:**
1. Acesse CRM no painel
2. Veja a lista completa de clientes
3. Use a busca para encontrar por nome ou telefone

**Filtros:**
- Clientes novos (1 pedido)
- Clientes recorrentes (2+ pedidos)
- Clientes inativos (sem pedidos há X dias)

A base de clientes é essencial para campanhas de marketing e fidelização.`,
      },
      {
        id: "envio-whatsapp",
        title: "Envio de mensagens em massa via WhatsApp",
        summary: "Envie mensagens personalizadas para sua base de clientes.",
        content: `Você pode enviar mensagens via WhatsApp para toda sua base ou segmentos específicos.

**Como enviar:**
1. Acesse CRM → selecione os clientes
2. Clique em "Enviar WhatsApp em massa"
3. Escreva a mensagem (com variáveis como {nome})
4. Confirme o envio

**Créditos WhatsApp:**
- Cada mensagem consome 1 crédito
- Compre pacotes de créditos pelo painel
- O saldo é exibido na tela de campanhas

**Dica:** Personalize as mensagens com o nome do cliente para melhor engajamento.`,
      },
    ],
  },
  {
    id: "campanhas",
    name: "Campanhas",
    description: "Marketing automatizado via WhatsApp",
    icon: Megaphone,
    gradient: "from-cyan-500 to-cyan-700",
    articles: [
      {
        id: "criar-campanha",
        title: "Criando uma campanha",
        summary: "Agende e envie campanhas de WhatsApp para seus clientes.",
        content: `Campanhas permitem enviar mensagens em massa de forma agendada.

**Criando uma campanha:**
1. Acesse Campanhas no painel
2. Clique em "Nova Campanha"
3. Configure:
   - **Nome**: identificação interna
   - **Filtro**: todos os clientes, novos, recorrentes, inativos
   - **Mensagem**: texto com suporte a variáveis
   - **Imagem** (opcional): anexe uma imagem à mensagem
   - **Agendamento**: data e hora de envio
   - **Dias de envio**: selecione os dias da semana

**Status da campanha:**
- Agendada → Enviando → Concluída
- Acompanhe o progresso em tempo real
- Veja quantas foram enviadas, falhas e pendentes

**Pré-requisitos:**
- WhatsApp conectado
- Créditos de WhatsApp disponíveis`,
      },
      {
        id: "whatsapp-bot",
        title: "Bot de WhatsApp",
        summary: "Automatize respostas e atualizações de pedidos via WhatsApp.",
        content: `O bot de WhatsApp responde automaticamente seus clientes.

**Funcionalidades:**
- **Mensagem de boas-vindas**: saudação automática com link do cardápio
- **Atualizações de pedido**: notifica o cliente quando o pedido é aceito, está pronto ou saiu para entrega
- **Feedback**: solicita avaliação após a entrega

**Configurando:**
1. Acesse WhatsApp Bot no painel
2. Conecte sua instância do WhatsApp
3. Ative as funcionalidades desejadas
4. Personalize a mensagem de boas-vindas

**Dica:** O bot economiza tempo e melhora a experiência do cliente. Ative as atualizações de pedido para reduzir ligações de "cadê meu pedido?".`,
      },
    ],
  },
  {
    id: "ia",
    name: "IA Criativa",
    description: "Geração de conteúdo com inteligência artificial",
    icon: Sparkles,
    gradient: "from-amber-500 to-orange-600",
    articles: [
      {
        id: "gerar-descricoes",
        title: "Gerando descrições com IA",
        summary: "Crie descrições profissionais para seus produtos automaticamente.",
        content: `A IA pode criar descrições atraentes e profissionais para seus produtos.

**Como usar:**
1. Acesse IA Criativa no painel
2. Selecione "Gerar Descrição"
3. Escolha o produto
4. A IA gera uma descrição otimizada
5. Revise e aplique ao produto

**Créditos de IA:**
- Cada geração consome créditos
- Compre pacotes de créditos pelo painel
- O saldo é exibido na tela de IA

**Tipos de geração:**
- Descrições de produtos
- Textos para promoções
- Sugestões de nomes criativos
- Conteúdo para redes sociais

**Dica:** Descrições bem escritas aumentam significativamente a conversão de vendas.`,
      },
    ],
  },
  {
    id: "relatorios",
    name: "Relatórios",
    description: "Análise de vendas e desempenho",
    icon: BarChart3,
    gradient: "from-indigo-500 to-indigo-700",
    articles: [
      {
        id: "relatorio-vendas",
        title: "Relatório de vendas",
        summary: "Acompanhe seu faturamento, ticket médio e produtos mais vendidos.",
        content: `O relatório de vendas fornece uma visão completa do desempenho do seu negócio.

**Métricas disponíveis:**
- Faturamento total (por período)
- Quantidade de pedidos
- Ticket médio
- Produtos mais vendidos
- Formas de pagamento mais usadas
- Pedidos por dia/hora

**Filtros:**
- Por período (hoje, semana, mês, personalizado)
- Por forma de pagamento
- Por status do pedido

**Como acessar:**
1. Acesse Relatórios no painel
2. Selecione o período desejado
3. Analise os gráficos e tabelas

**Dica:** Analise semanalmente para identificar tendências e ajustar estratégias.`,
      },
      {
        id: "cmv",
        title: "CMV — Custo da Mercadoria Vendida",
        summary: "Controle o custo dos seus produtos e margem de lucro.",
        content: `O módulo CMV ajuda a controlar custos e precificar corretamente.

**Configurando:**
1. Acesse CMV no painel
2. Cadastre seus ingredientes com custo unitário
3. Monte a ficha técnica de cada produto (ingredientes + quantidades)
4. O sistema calcula automaticamente o custo de cada produto

**Métricas:**
- Custo por produto
- Percentual de CMV
- Margem de lucro
- Alertas quando o CMV está acima do ideal

**Configurações globais:**
- Meta de CMV (ex: 30%)
- Faixa ótima e de alerta
- Custos fixos mensais
- Custo padrão de embalagem

**Dica:** Manter o CMV abaixo de 35% é fundamental para a saúde financeira do restaurante.`,
      },
    ],
  },
  {
    id: "configuracoes",
    name: "Configurações",
    description: "Personalize seu restaurante",
    icon: Settings,
    gradient: "from-gray-500 to-gray-700",
    articles: [
      {
        id: "dados-restaurante",
        title: "Dados do restaurante",
        summary: "Configure nome, endereço, logo e informações gerais.",
        content: `As configurações gerais definem a identidade do seu restaurante no sistema.

**Informações básicas:**
- Nome do restaurante
- Descrição
- Endereço completo (CEP, rua, número, bairro, cidade, estado)
- Telefone/WhatsApp
- Instagram

**Identidade visual:**
- Logo (recomendado: 400x400px, fundo transparente)
- Banner (recomendado: 1200x400px)
- Tema do cardápio (claro ou escuro)

**Slug (link personalizado):**
- Seu cardápio fica em: menufly.lovable.app/seu-slug
- Escolha um slug curto e fácil de lembrar
- Ex: /pizzaria-do-joao, /sushi-master

**Como acessar:**
1. Acesse Negócio no painel admin
2. Preencha/altere os campos
3. Clique em "Salvar"`,
      },
      {
        id: "horario-funcionamento",
        title: "Horário de funcionamento",
        summary: "Defina os horários de abertura e fechamento por dia da semana.",
        content: `O horário de funcionamento controla quando seu cardápio aceita pedidos.

**Configurando:**
1. Acesse Negócio → Horário de Funcionamento
2. Para cada dia da semana, defina:
   - Se está aberto ou fechado
   - Horário de abertura
   - Horário de fechamento
3. Suporte a múltiplos períodos por dia (ex: 11h-14h e 18h-23h)

**Modo de operação:**
- **Automático**: abre e fecha conforme horário configurado
- **Manual**: você controla manualmente se está aberto ou fechado

**Override manual:**
- Mesmo no modo automático, você pode forçar abertura/fechamento
- O override expira automaticamente no próximo horário programado

**Quando fechado:**
- O cliente vê a mensagem "Fechado" no cardápio
- Os pedidos são bloqueados
- O cardápio continua visível para consulta`,
      },
      {
        id: "colaboradores",
        title: "Gerenciando colaboradores",
        summary: "Adicione funcionários com acesso ao painel admin.",
        content: `Você pode convidar colaboradores para ajudar a gerenciar o restaurante.

**Adicionando um colaborador:**
1. Acesse Colaboradores no painel
2. Clique em "Novo Colaborador"
3. Informe o e-mail e defina uma senha
4. O colaborador receberá acesso ao painel

**Permissões:**
- Colaboradores têm acesso a todas as funcionalidades do restaurante
- Apenas o dono pode gerenciar colaboradores e configurações críticas

**Removendo acesso:**
- Você pode remover um colaborador a qualquer momento
- O acesso é revogado imediatamente`,
      },
      {
        id: "impressora",
        title: "Impressora de pedidos",
        summary: "Configure a impressão automática de pedidos.",
        content: `Você pode imprimir pedidos automaticamente ou manualmente.

**Como funciona:**
1. Acesse Impressora no painel
2. A impressão usa o navegador do computador
3. Ao receber um pedido, clique em "Imprimir" ou configure a impressão automática

**Formato do ticket:**
- Número do pedido
- Data e hora
- Itens com quantidades e complementos
- Dados do cliente
- Endereço de entrega
- Forma de pagamento
- Total

**Dica:** Use uma impressora térmica 80mm para melhor resultado. Impressoras comuns também funcionam.`,
      },
    ],
  },
  {
    id: "integracoes",
    name: "Integrações",
    description: "Conecte com outras ferramentas e plataformas",
    icon: Link2,
    gradient: "from-teal-500 to-teal-700",
    articles: [
      {
        id: "meta-pixel",
        title: "Meta Pixel (Facebook/Instagram Ads)",
        summary: "Rastreie conversões dos seus anúncios pagos.",
        content: `O Meta Pixel permite rastrear ações dos clientes vindos de anúncios do Facebook e Instagram.

**Como configurar:**
1. Acesse Integrações no painel (ou Ads)
2. Cole seu Pixel ID do Meta
3. Opcionalmente, cole o Access Token para API de Conversões
4. Salve

**Eventos rastreados automaticamente:**
- PageView: quando o cliente abre o cardápio
- ViewContent: quando visualiza um produto
- AddToCart: quando adiciona ao carrinho
- InitiateCheckout: quando inicia o checkout
- Purchase: quando finaliza o pedido

**Por que usar:**
- Otimize campanhas de anúncios
- Crie públicos de remarketing
- Meça o retorno sobre investimento (ROI)

**Dica:** Configure também o Google Tag Manager e Google Analytics para uma visão completa.`,
      },
      {
        id: "google-analytics",
        title: "Google Analytics e GTM",
        summary: "Monitore o tráfego do seu cardápio com Google Analytics.",
        content: `Integre o Google Analytics e/ou Google Tag Manager para analisar o comportamento dos visitantes.

**Google Analytics:**
1. Acesse Integrações
2. Cole seu Measurement ID (G-XXXXXXX)
3. Salve

**Google Tag Manager:**
1. Cole seu Container ID (GTM-XXXXXXX)
2. Salve

**Métricas disponíveis:**
- Visitantes únicos
- Tempo no cardápio
- Produtos mais visualizados
- Taxa de conversão
- Origem do tráfego`,
      },
      {
        id: "google-review",
        title: "Link do Google Review",
        summary: "Incentive avaliações no Google após a entrega.",
        content: `Adicione o link do Google Meu Negócio para solicitar avaliações.

**Configurando:**
1. Acesse Integrações
2. Cole o link de review do Google Meu Negócio
3. O bot de WhatsApp pode enviar automaticamente após a entrega

**Como conseguir o link:**
1. Pesquise seu restaurante no Google
2. Clique em "Escrever avaliação"
3. Copie a URL

**Benefícios:**
- Melhora seu ranking no Google
- Gera confiança para novos clientes
- Feedback valioso para melhorias`,
      },
    ],
  },
  {
    id: "assinatura",
    name: "Assinatura e Planos",
    description: "Gerencie seu plano e pagamento",
    icon: Store,
    gradient: "from-rose-500 to-pink-600",
    articles: [
      {
        id: "planos-disponíveis",
        title: "Planos disponíveis",
        summary: "Conheça os planos e escolha o ideal para seu negócio.",
        content: `O MenuFly oferece planos acessíveis sem cobrança de taxa por pedido.

**O que está incluso em todos os planos:**
- Cardápio digital ilimitado
- Gestão de pedidos em tempo real
- Notificações push
- CRM de clientes
- Relatórios de vendas
- Zonas de entrega ilimitadas
- Cupons e promoções
- Suporte via chat

**Pagamento:**
- Mensal via PIX ou cartão
- Sem fidelidade — cancele quando quiser
- Sem taxa por pedido

**Como assinar:**
1. Acesse Minha Assinatura no painel
2. Escolha o plano
3. Realize o pagamento
4. Acesso liberado imediatamente`,
      },
    ],
  },
];
