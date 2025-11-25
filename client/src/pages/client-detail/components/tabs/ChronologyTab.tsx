import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock } from "lucide-react";
import ClientChronology from "@/components/client-chronology";

interface ChronologyTabProps {
  clientId: string;
}

export function ChronologyTab({ clientId }: ChronologyTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Client Activity Chronology
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ClientChronology clientId={clientId} />
      </CardContent>
    </Card>
  );
}
