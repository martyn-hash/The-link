import { useState } from "react";
import { Building2, Calendar, MoreVertical, Share2, UserX, UserCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ShareDataModal } from "./ShareDataModal";
import { NlacModal } from "./NlacModal";
import type { Client, ClientPerson } from "@shared/schema";

export interface ClientHeaderProps {
  client: Client;
  people?: ClientPerson[];
}

export function ClientHeader({ client, people = [] }: ClientHeaderProps) {
  const [showShareModal, setShowShareModal] = useState(false);
  const [showNlacModal, setShowNlacModal] = useState(false);

  return (
    <>
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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" data-testid="btn-client-actions">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem 
                    onClick={() => setShowShareModal(true)}
                    data-testid="menu-share-data"
                  >
                    <Share2 className="h-4 w-4 mr-2" />
                    Share Data
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {client.companyStatus === 'inactive' ? (
                    <DropdownMenuItem 
                      onClick={() => setShowNlacModal(true)}
                      data-testid="menu-reactivate"
                      className="text-green-600 focus:text-green-600"
                    >
                      <UserCheck className="h-4 w-4 mr-2" />
                      Re-activate Client
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem 
                      onClick={() => setShowNlacModal(true)}
                      data-testid="menu-nlac"
                      className="text-destructive focus:text-destructive"
                    >
                      <UserX className="h-4 w-4 mr-2" />
                      Mark as NLAC
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>
      
      <ShareDataModal
        open={showShareModal}
        onOpenChange={setShowShareModal}
        client={client}
        people={people}
      />
      
      <NlacModal
        open={showNlacModal}
        onOpenChange={setShowNlacModal}
        client={client}
      />
    </>
  );
}
