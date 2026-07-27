/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Hr, Section,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "MenuFly"

interface WelcomeMenuFlyProps {
  name?: string
  email?: string
  password?: string
  restaurantName?: string
  planName?: string
}

const WelcomeMenuFlyEmail = ({ name, email, password, restaurantName, planName }: WelcomeMenuFlyProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Bem-vindo ao {SITE_NAME}! Seus dados de acesso estão aqui 🚀</Preview>
    <Body style={main}>
      <Container style={container}>
        {/* Header */}
        <Section style={headerSection}>
          <Text style={logoText}>🍔 MenuFly</Text>
        </Section>

        <Heading style={h1}>
          {name ? `Parabéns, ${name}! 🎉` : 'Parabéns! 🎉'}
        </Heading>

        <Text style={text}>
          Você acabou de dar o passo mais importante para <strong style={{ color: '#1a1a1a' }}>aumentar suas vendas no delivery</strong>.
          {restaurantName ? ` O ${restaurantName} agora conta com` : ' Agora você tem'} o cardápio digital com a maior conversão do mercado em tráfego pago.
        </Text>

        {planName && (
          <Section style={planBadgeSection}>
            <Text style={planBadge}>
              ✅ Plano {planName} ativado
            </Text>
          </Section>
        )}

        <Hr style={hr} />

        {/* Credentials */}
        <Heading as="h2" style={h2}>Seus dados de acesso</Heading>

        <Section style={credentialsBox}>
          <Text style={credentialLabel}>🔗 Painel Administrativo:</Text>
          <Text style={credentialValue}>menufly.com.br/admin</Text>

          <Text style={credentialLabel}>📧 Login (email):</Text>
          <Text style={credentialValue}>{email || 'Seu email cadastrado'}</Text>

          <Text style={credentialLabel}>🔑 Senha:</Text>
          <Text style={credentialValue}>{password || '(a senha que você definiu no cadastro)'}</Text>
        </Section>

        <Section style={{ textAlign: 'center' as const, margin: '30px 0' }}>
          <Button
            href="https://menufly.com.br/admin"
            style={button}
          >
            Acessar Meu Painel →
          </Button>
        </Section>

        <Hr style={hr} />

        {/* Next steps */}
        <Heading as="h2" style={h2}>Próximos passos</Heading>

        <Text style={stepText}>
          <strong>1.</strong> Acesse seu painel e configure o cardápio com seus produtos
        </Text>
        <Text style={stepText}>
          <strong>2.</strong> Personalize seu cardápio (logo, banner, cores)
        </Text>
        <Text style={stepText}>
          <strong>3.</strong> Configure seus métodos de pagamento
        </Text>
        <Text style={stepText}>
          <strong>4.</strong> Comece a rodar seus anúncios e veja as vendas chegando! 🚀
        </Text>

        <Hr style={hr} />

        <Text style={footer}>
          Qualquer dúvida, estamos aqui para ajudar.{'\n'}
          Equipe {SITE_NAME}
        </Text>

        <Text style={securityNote}>
          ⚠️ Este email contém suas credenciais de acesso. Guarde-o em um lugar seguro e não compartilhe com terceiros.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: WelcomeMenuFlyEmail,
  subject: '🚀 Bem-vindo ao MenuFly — Seus dados de acesso',
  displayName: 'Boas-vindas MenuFly',
  previewData: {
    name: 'João',
    email: 'joao@email.com',
    password: 'minhaSenha123',
    restaurantName: 'Burger House',
    planName: 'MenuFly Elite',
  },
} satisfies TemplateEntry

// Styles
const main = { backgroundColor: '#ffffff', fontFamily: "'Segoe UI', Arial, sans-serif" }
const container = { padding: '20px 25px', maxWidth: '580px', margin: '0 auto' }
const headerSection = { textAlign: 'center' as const, padding: '20px 0 10px' }
const logoText = { fontSize: '24px', fontWeight: 'bold' as const, color: '#d97706', margin: '0' }
const h1 = { fontSize: '26px', fontWeight: 'bold' as const, color: '#1a1a1a', margin: '20px 0 15px', lineHeight: '1.3' }
const h2 = { fontSize: '18px', fontWeight: 'bold' as const, color: '#1a1a1a', margin: '25px 0 12px' }
const text = { fontSize: '15px', color: '#4a4a4a', lineHeight: '1.6', margin: '0 0 16px' }
const stepText = { fontSize: '14px', color: '#4a4a4a', lineHeight: '1.5', margin: '0 0 8px', paddingLeft: '4px' }
const hr = { borderColor: '#e5e5e5', margin: '24px 0' }
const planBadgeSection = { textAlign: 'center' as const, margin: '16px 0' }
const planBadge = { display: 'inline-block' as const, backgroundColor: '#f0fdf4', color: '#166534', fontSize: '14px', fontWeight: '600' as const, padding: '8px 20px', borderRadius: '20px', border: '1px solid #bbf7d0', margin: '0' }
const credentialsBox = { backgroundColor: '#fafafa', border: '1px solid #e5e5e5', borderRadius: '12px', padding: '20px 24px', margin: '12px 0' }
const credentialLabel = { fontSize: '12px', color: '#888888', margin: '0 0 2px', textTransform: 'uppercase' as const, letterSpacing: '0.5px', fontWeight: '600' as const }
const credentialValue = { fontSize: '15px', color: '#1a1a1a', margin: '0 0 14px', fontWeight: '500' as const }
const button = { backgroundColor: '#d97706', color: '#ffffff', fontSize: '16px', fontWeight: 'bold' as const, padding: '14px 32px', borderRadius: '8px', textDecoration: 'none' }
const footer = { fontSize: '13px', color: '#999999', margin: '20px 0 0', lineHeight: '1.5' }
const securityNote = { fontSize: '11px', color: '#b0b0b0', margin: '16px 0 0', padding: '12px', backgroundColor: '#fefce8', borderRadius: '8px', border: '1px solid #fef08a' }
