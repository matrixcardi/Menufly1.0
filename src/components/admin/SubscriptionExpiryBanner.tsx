import { AlertTriangle, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

interface SubscriptionExpiryBannerProps {
  daysRemaining: number;
  subscriptionEnd: string | null;
  isTrial?: boolean;
  trialExpired?: boolean;
}

export function SubscriptionExpiryBanner({ daysRemaining, subscriptionEnd, isTrial, trialExpired }: SubscriptionExpiryBannerProps) {
  const endDate = subscriptionEnd ? new Date(subscriptionEnd).toLocaleDateString("pt-BR") : "";
  const isUrgent = trialExpired || daysRemaining <= 2;

  // Trial expired -> hard block message
  if (trialExpired) {
    return (
      <div className="w-full px-4 py-2.5 flex items-center justify-center gap-2 text-sm font-medium bg-destructive/15 text-destructive border-b border-destructive/20">
        <AlertTriangle className="w-4 h-4 shrink-0" />
        <span>Seu período grátis terminou. </span>
        <Link to="/admin/assinatura" className="underline font-semibold">Assine agora</Link>
        <span> para reativar sua conta.</span>
      </div>
    );
  }

  // Active trial banner
  if (isTrial) {
    return (
      <div className={`w-full px-4 py-2.5 flex items-center justify-center gap-2 text-sm font-medium ${
        isUrgent
          ? "bg-destructive/15 text-destructive border-b border-destructive/20"
          : "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-b border-amber-500/20"
      }`}>
        <Sparkles className="w-4 h-4 shrink-0" />
        <span>
          {daysRemaining === 0
            ? `Seu trial grátis encerra hoje. `
            : daysRemaining === 1
            ? `Seu trial grátis encerra amanhã. `
            : `Você tem ${daysRemaining} dias grátis restantes. `}
        </span>
        <Link to="/admin/assinatura" className="underline font-semibold">Escolher plano</Link>
      </div>
    );
  }

  return (
    <div
      className={`w-full px-4 py-2.5 flex items-center justify-center gap-2 text-sm font-medium ${
        isUrgent
          ? "bg-destructive/15 text-destructive border-b border-destructive/20"
          : "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-b border-amber-500/20"
      }`}
    >
      <AlertTriangle className="w-4 h-4 shrink-0" />
      <span>
        {daysRemaining === 0
          ? `Seu plano encerra hoje (${endDate}). Renove para não perder o acesso.`
          : daysRemaining === 1
          ? `Seu plano encerra amanhã (${endDate}). Renove para não perder o acesso.`
          : `Seu plano encerra em ${daysRemaining} dias (${endDate}). Renove para não perder o acesso.`}
      </span>
    </div>
  );
}
