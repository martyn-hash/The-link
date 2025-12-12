import { useState } from "react";
import { useLocation } from "wouter";
import { Eye, Star, FileSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ClientPersonWithPerson } from "../../utils/types";
import { formatPersonName, formatBirthDate } from "../../utils/formatters";
import { QuickViewPersonModal } from "./QuickViewPersonModal";

interface RelatedPersonRowProps {
  clientPerson: ClientPersonWithPerson;
  clientId: string;
  clientName: string;
}

export function RelatedPersonRow({
  clientPerson,
}: RelatedPersonRowProps) {
  const [, setLocation] = useLocation();
  const [showQuickView, setShowQuickView] = useState(false);

  return (
    <>
      <TableRow data-testid={`person-row-${clientPerson.person.id}`}>
        <TableCell className="font-medium">
          <div>
            <div className="flex items-center gap-2">
              <span data-testid={`text-person-name-${clientPerson.person.id}`}>
                {formatPersonName(clientPerson.person.fullName)}
              </span>
              {clientPerson.isPrimaryContact && (
                <Badge className="bg-blue-600 text-white" data-testid={`badge-primary-contact-${clientPerson.person.id}`}>
                  <Star className="h-3 w-3 mr-1" />
                  Primary
                </Badge>
              )}
            </div>
            {clientPerson.officerRole && (
              <div className="text-xs text-muted-foreground mt-1">
                {clientPerson.officerRole}
              </div>
            )}
          </div>
        </TableCell>
        <TableCell>
          <span className="text-sm" data-testid={`text-person-primary-email-${clientPerson.person.id}`}>
            {clientPerson.person.primaryEmail || clientPerson.person.email || '-'}
          </span>
        </TableCell>
        <TableCell>
          <span className="text-sm" data-testid={`text-person-primary-phone-${clientPerson.person.id}`}>
            {clientPerson.person.primaryPhone || clientPerson.person.telephone || '-'}
          </span>
        </TableCell>
        <TableCell>
          <span className="text-sm" data-testid={`text-dob-${clientPerson.person.id}`}>
            {clientPerson.person.dateOfBirth ? formatBirthDate(clientPerson.person.dateOfBirth) : '-'}
          </span>
        </TableCell>
        <TableCell className="text-right">
          <div className="flex items-center justify-end gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowQuickView(true)}
                    data-testid={`button-quick-view-person-${clientPerson.person.id}`}
                  >
                    <FileSearch className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Quick view</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Button
              variant="default"
              size="sm"
              onClick={() => setLocation(`/person/${clientPerson.person.id}`)}
              data-testid={`button-view-person-${clientPerson.person.id}`}
            >
              <Eye className="h-4 w-4 mr-2" />
              View
            </Button>
          </div>
        </TableCell>
      </TableRow>

      <QuickViewPersonModal
        clientPerson={clientPerson}
        open={showQuickView}
        onOpenChange={setShowQuickView}
      />
    </>
  );
}
