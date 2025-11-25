import { RiskAssessmentTab } from "@/components/RiskAssessmentTab";
import { ClientNotificationsView } from "@/components/ClientNotificationsView";

interface RiskTabProps {
  clientId: string;
  riskView: 'risk' | 'notifications';
}

export function RiskTab({ clientId, riskView }: RiskTabProps) {
  if (riskView === "risk") {
    return <RiskAssessmentTab clientId={clientId} />;
  }
  
  return <ClientNotificationsView clientId={clientId} />;
}
