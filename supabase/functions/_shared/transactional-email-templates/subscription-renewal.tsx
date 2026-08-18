/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Html, Preview, Text, Button, Hr, Section } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  name?: string
  restaurantName?: string
  planLabel?: string
  daysRemaining?: number
}

const headlineFor = (d?: number) => {
  if (d === undefined || d === null) return 'Hora de renovar sua assinatura'
  if (d <= 0) return 'Sua assinatura venceu hoje 😔'
  if (d === 1) return 'Sua assinatura vence amanhã ⏰'
  return `Sua assinatura vence em ${d} dias`
}

const subjectFor = (d?: number) => {
  if (d === undefined || d === null) return '⏰ Renove sua assinatura MenuFly'
  if (d <= 0) return '😔 Sua assinatura MenuFly venceu — renove para reativar'
  if (d === 1) return '⏰ Último dia! Sua assinatura MenuFly vence amanhã'
  return `⏰ Sua assinatura MenuFly vence em ${d} dias`
}

const SubscriptionRenewalEmail = ({ name, restaurantName, planLabel, daysRemaining }: Props) => (
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
          Olá{name ? `, ${name}` : ''}! {restaurantName ? `O ${restaurantName}` : 'Sua conta'} está no
          plano <strong>{planLabel || 'MenuFly'}</strong>.
          {daysRemaining !== undefined && daysRemaining > 0
            ? ` Renove nos próximos ${daysRemaining} dia${daysRemaining > 1 ? 's' : ''} para continuar recebendo pedidos sem interrupção.`
            : ' Renove agora para reativar sua conta e voltar a receber pedidos.'}
        </Text>

        <Section style={{ textAlign: 'center' as const, margin: '30px 0' }}>
          <Button href="https://menufly.com.br/checkout" style={button}>
            Renovar agora →
          </Button>
        </Section>

        <Hr style={hr} />

        <Text style={text}>
          A renovação leva menos de um minuto e pode ser feita no <strong>cartão</strong> ou no{' '}
          <strong>PIX</strong>. Os dias que ainda restam do seu período atual são somados ao novo ciclo,
          então renovar adiantado não custa nada.
        </Text>

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
  component: SubscriptionRenewalEmail,
  subject: (data: Record<string, any>) => subjectFor(data?.daysRemaining),
  displayName: 'Lembrete de renovação de assinatura',
  previewData: { name: 'João', restaurantName: 'Burger House', planLabel: 'MenuFly Elite', daysRemaining: 3 },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Segoe UI', Arial, sans-serif" }
const container = { padding: '20px 25px', maxWidth: '580px', margin: '0 auto' }
const headerSection = { textAlign: 'center' as const, padding: '20px 0 10px' }
const logoText = { fontSize: '24px', fontWeight: 'bold' as const, color: '#d97706', margin: '0' }
const h1 = { fontSize: '26px', fontWeight: 'bold' as const, color: '#1a1a1a', margin: '20px 0 15px', lineHeight: '1.3' }
const text = { fontSize: '15px', color: '#4a4a4a', lineHeight: '1.6', margin: '0 0 16px' }
const hr = { borderColor: '#e5e5e5', margin: '24px 0' }
const button = { backgroundColor: '#d97706', color: '#ffffff', fontSize: '16px', fontWeight: 'bold' as const, padding: '14px 32px', borderRadius: '8px', textDecoration: 'none' }
const footer = { fontSize: '13px', color: '#999999', margin: '20px 0 0', lineHeight: '1.5' }
