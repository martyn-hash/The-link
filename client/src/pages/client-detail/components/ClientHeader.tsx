import { Building2, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Client } from "@shared/schema";

export interface ClientHeaderProps {
  client: Client;
}

export function ClientHeader({ client }: ClientHeaderProps) {
  return (
    <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="page-container py-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground truncate" data-testid="text-client-name">
              {client.name}
            </h1>
            <div className="flex items-center mt-2 flex-wrap gap-x-3 text-meta">
              {client.companyNumber && (
                <span className="flex items-center gap-1">
                  <Building2 className="w-4 h-4" />
                  Company #{client.companyNumber}
                </span>
              )}
              {client.dateOfCreation && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  Formed {new Date(client.dateOfCreation).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {client.companyStatus && (
              <Badge 
                variant={client.companyStatus === 'active' ? 'default' : 'secondary'}
                data-testid="badge-company-status"
              >
                {client.companyStatus}
              </Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
