import { useEffect, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CallDialog } from '@/pages/client-detail/components/communications/dialogs/CallDialog';
import { SMSDialog } from '@/pages/client-detail/components/communications/dialogs/SMSDialog';
import { useToast } from '@/hooks/use-toast';
import type { PersonOption } from '@/pages/client-detail/components/communications/types';

interface CallEventDetail {
  personId: string;
  personName: string;
  phoneNumber: string;
  clientId: string | null;
  clientName: string | null;
}

interface SmsEventDetail {
  personId: string;
  personName: string;
  phoneNumber: string;
  clientId: string | null;
  clientName: string | null;
  message?: string;
}

export function AIMagicCallHandler() {
  const { toast } = useToast();
  const [callDialogOpen, setCallDialogOpen] = useState(false);
  const [smsDialogOpen, setSmsDialogOpen] = useState(false);
  const [callData, setCallData] = useState<CallEventDetail | null>(null);
  const [smsData, setSmsData] = useState<SmsEventDetail | null>(null);

  const { data: clientPeople } = useQuery<PersonOption[]>({
    queryKey: ['/api/clients', smsData?.clientId, 'people'],
    enabled: !!smsData?.clientId && smsDialogOpen,
  });

  const handleCallEvent = useCallback((event: CustomEvent<CallEventDetail>) => {
    const { personId, personName, phoneNumber, clientId, clientName } = event.detail;
    console.log('[AI Magic Call Handler] Received call event:', event.detail);
    
    setCallData({ personId, personName, phoneNumber, clientId, clientName });
    setCallDialogOpen(true);
  }, []);

  const handleSmsEvent = useCallback((event: CustomEvent<SmsEventDetail>) => {
    const { personId, personName, phoneNumber, clientId, clientName, message } = event.detail;
    console.log('[AI Magic Call Handler] Received SMS event:', event.detail);
    
    if (!clientId) {
      toast({
        title: "SMS requires client context",
        description: `Cannot send SMS to ${personName} - they are not associated with a client. Try navigating to the client's page first.`,
        variant: "destructive",
      });
      return;
    }
    
    setSmsData({ personId, personName, phoneNumber, clientId, clientName, message });
    setSmsDialogOpen(true);
  }, [toast]);

  useEffect(() => {
    window.addEventListener('ai-magic-call-person', handleCallEvent as EventListener);
    window.addEventListener('ai-magic-sms-person', handleSmsEvent as EventListener);

    return () => {
      window.removeEventListener('ai-magic-call-person', handleCallEvent as EventListener);
      window.removeEventListener('ai-magic-sms-person', handleSmsEvent as EventListener);
    };
  }, [handleCallEvent, handleSmsEvent]);

  const handleCallClose = () => {
    setCallDialogOpen(false);
    setCallData(null);
  };

  const handleSmsClose = () => {
    setSmsDialogOpen(false);
    setSmsData(null);
  };

  return (
    <>
      {callData && (
        <CallDialog
          isOpen={callDialogOpen}
          onClose={handleCallClose}
          clientId={callData.clientId || undefined}
          personId={callData.personId}
          phoneNumber={callData.phoneNumber}
          personName={callData.personName}
        />
      )}
      {smsData && smsData.clientId && clientPeople && (
        <SMSDialog
          isOpen={smsDialogOpen}
          onClose={handleSmsClose}
          clientId={smsData.clientId}
          clientPeople={clientPeople}
          initialValues={{
            personId: smsData.personId,
            message: smsData.message,
          }}
        />
      )}
    </>
  );
}
