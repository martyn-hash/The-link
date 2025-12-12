import { useState } from "react";
import { User } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PersonViewMode } from "./PersonViewMode";
import { ClientPersonWithPerson } from "../../utils/types";
import { formatPersonName } from "../../utils/formatters";

interface QuickViewPersonModalProps {
  clientPerson: ClientPersonWithPerson;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QuickViewPersonModal({
  clientPerson,
  open,
  onOpenChange,
}: QuickViewPersonModalProps) {
  const [revealedIdentifiers, setRevealedIdentifiers] = useState<Set<string>>(new Set());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            {formatPersonName(clientPerson.person.fullName)}
          </DialogTitle>
        </DialogHeader>
        <PersonViewMode
          clientPerson={clientPerson}
          revealedIdentifiers={revealedIdentifiers}
          setRevealedIdentifiers={setRevealedIdentifiers}
          onEdit={() => {}}
        />
      </DialogContent>
    </Dialog>
  );
}
