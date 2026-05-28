/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Html, Preview, Text, Button, Hr, Section } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  name?: string
  restaurantName?: string
  daysRemaining?: number
}

const headlineFor = (d?: number) => {
  if (d === undefined || d === null) return 'Seu trial está terminando'
  if (d <= 0) return 'Seu trial grátis acabou hoje 😔'
  if (d === 1) return 'Último dia do seu trial grátis ⏰'
  if (d === 3) return 'Faltam 3 dias do seu trial grátis'
  return `Faltam ${d} dias do seu trial grátis`
}

const subjectFor = (d?: number) => {
  if (d === undefined || d === null) return '⏰ Seu trial MenuFly está terminando'
  if (d <= 0) return '😔 Seu trial MenuFly acabou hoje — assine para reativar'
  if (d === 1) return '⏰ Último dia! Seu trial MenuFly encerra amanhã'
  return `⏰ Faltam ${d} dias do seu trial MenuFly`
}

const TrialReminderEmail = ({ name, restaurantName, daysRemaining }: Props) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>{headlineFor(daysRemaining)}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={headerSection}>
          <Text style={logoText}>🍔 MenuFly</Text>
        </Section>

        <Heading style={h1}>{headlineFor(daysRemaining)}</Heading>

        <Text style={text}>
          Olá{name ? `, ${name}` : ''}! {restaurantName ? `O ${restaurantName}` : 'Sua conta'} está usando o MenuFly em modo trial.
          {daysRemaining !== undefined && daysRemaining > 0
            ? ` Você tem ${daysRemaining} dia${daysRemaining > 1 ? 's' : ''} para escolher seu plano e continuar recebendo pedidos sem interrupção.`
            : ' Para reativar sua conta e voltar a receber pedidos, escolha um plano agora.'}
        </Text>

        <Section style={{ textAlign: 'center' as const, margin: '30px 0' }}>
          <Button href="https://menufly.com.br/admin/assinatura" style={button}>
            Escolher meu plano →
          </Button>
        </Section>

        <Hr style={hr} />

        <Text style={text}>
          A partir de <strong>R$ 97/mês</strong>, você mantém:
        </Text>
        <Text style={stepText}>✅ Cardápio digital online 24/7</Text>
        <Text style={stepText}>✅ Pedidos pelo WhatsApp automaticamente</Text>
        <Text style={stepText}>✅ Pagamento online integrado</Text>
        <Text style={stepText}>✅ Relatórios de vendas em tempo real</Text>

        <Hr style={hr} />

        <Text style={footer}>
          Qualquer dúvida, é só responder este e-mail.{'\n'}
          Equipe MenuFly
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: TrialReminderEmail,
  subject: (data: Record<string, any>) => subjectFor(data?.daysRemaining),
  displayName: 'Lembrete de fim de trial',
  previewData: { name: 'João', restaurantName: 'Burger House', daysRemaining: 3 },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Segoe UI', Arial, sans-serif" }
const container = { padding: '20px 25px', maxWidth: '580px', margin: '0 auto' }
const headerSection = { textAlign: 'center' as const, padding: '20px 0 10px' }
const logoText = { fontSize: '24px', fontWeight: 'bold' as const, color: '#d97706', margin: '0' }
const h1 = { fontSize: '26px', fontWeight: 'bold' as const, color: '#1a1a1a', margin: '20px 0 15px', lineHeight: '1.3' }
const text = { fontSize: '15px', color: '#4a4a4a', lineHeight: '1.6', margin: '0 0 16px' }
const stepText = { fontSize: '14px', color: '#4a4a4a', lineHeight: '1.5', margin: '0 0 8px', paddingLeft: '4px' }
const hr = { borderColor: '#e5e5e5', margin: '24px 0' }
const button = { backgroundColor: '#d97706', color: '#ffffff', fontSize: '16px', fontWeight: 'bold' as const, padding: '14px 32px', borderRadius: '8px', textDecoration: 'none' }
const footer = { fontSize: '13px', color: '#999999', margin: '20px 0 0', lineHeight: '1.5' }