import { ReactNode } from "react";
import { usePlan } from "@/hooks/usePlan";
import { PaywallElite } from "./PaywallElite";
import { Skeleton } from "@/components/ui/skeleton";

interface RequireEliteProps {
  children: ReactNode;
  feature: "nfe" | "whatsapp_bot" | "bi_financeiro" | "cmv_inteligente";
  featureName: string; // "Notas Fiscais", "WhatsApp Bot", etc
  featureDescription: string;
  featureBullets: string[];
}

export const RequireElite = ({
  children,
  feature,
  featureName,
  featureDescription,
  featureBullets,
}: RequireEliteProps) => {
  const { hasFeature, loading } = usePlan();

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <Skeleton className="h-12 w-64 mb-4" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!hasFeature(feature)) {
    return (
      <PaywallElite
        featureName={featureName}
        featureDescription={featureDescription}
        featureBullets={featureBullets}
      />
    );
  }

  return <>{children}</>;
};
