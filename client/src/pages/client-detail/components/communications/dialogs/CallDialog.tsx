import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { RingCentralPhone } from "@/components/ringcentral-phone";
import type { CallDialogProps } from "../types";

export function CallDialog({ 
  clientId, 
  personId, 
  phoneNumber,
  isOpen,
  onClose
}: CallDialogProps) {
  const { toast } = useToast();
  const [selectedPersonId, setSelectedPersonId] = useState<string | undefined>(personId);
  const [selectedPhoneNumber, setSelectedPhoneNumber] = useState<string | undefined>(phoneNumber);
  
  const { data: clientPeople } = useQuery({
    queryKey: ['/api/clients', clientId, 'people'],
    enabled: !!clientId && isOpen,
  });

  useEffect(() => {
    setSelectedPersonId(personId);
    setSelectedPhoneNumber(phoneNumber);
  }, [personId, phoneNumber]);
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Make a Call</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Select Person (Optional)</label>
            <Select
              value={selectedPersonId || 'none'}
              onValueChange={(value) => {
                if (value === 'none') {
                  setSelectedPersonId(undefined);
                  setSelectedPhoneNumber(undefined);
                } else {
                  setSelectedPersonId(value);
                  const selected = (clientPeople || []).find((cp: any) => cp.person.id === value);
                  setSelectedPhoneNumber(selected?.person?.primaryPhone || undefined);
                }
              }}
            >
              <SelectTrigger data-testid="select-call-person">
                <SelectValue placeholder="Select a person..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No person selected</SelectItem>
                {(clientPeople || []).map((cp: any) => (
                  <SelectItem key={cp.person.id} value={cp.person.id}>
                    {cp.person.firstName} {cp.person.lastName}
                    {cp.person.primaryPhone && ` - ${cp.person.primaryPhone}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <RingCentralPhone
            clientId={clientId}
            personId={selectedPersonId}
            defaultPhoneNumber={selectedPhoneNumber}
            onCallComplete={(data) => {
              queryClient.invalidateQueries({ queryKey: ['/api/communications/client', clientId] });
              toast({
                title: "Call logged",
                description: "Call has been recorded in communications timeline",
              });
              onClose();
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
