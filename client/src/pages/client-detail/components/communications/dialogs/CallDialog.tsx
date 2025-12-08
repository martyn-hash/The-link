import { useState, useEffect, useRef } from "react";
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
import { Phone, PhoneOff, Mic, MicOff, Pause, Play, Loader2 } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { showFriendlyError } from '@/lib/friendlyErrors';
// @ts-ignore - RingCentral Web Phone types
import RingCentralWebPhone from 'ringcentral-web-phone';
import type { CallDialogProps } from "../types";

interface CallState {
  sessionId: string | null;
  phoneNumber: string | null;
  status: 'idle' | 'ringing' | 'connected' | 'disconnected';
  duration: number;
  isMuted: boolean;
  isOnHold: boolean;
  isInbound: boolean;
}

const initialCallState: CallState = {
  sessionId: null,
  phoneNumber: null,
  status: 'idle',
  duration: 0,
  isMuted: false,
  isOnHold: false,
  isInbound: false,
};

export function CallDialog({ 
  clientId, 
  personId, 
  phoneNumber,
  personName,
  isOpen,
  onClose
}: CallDialogProps) {
  const { toast } = useToast();
  const [selectedPersonId, setSelectedPersonId] = useState<string | undefined>(personId);
  const [selectedPhoneNumber, setSelectedPhoneNumber] = useState<string | undefined>(phoneNumber);
  
  const [phoneStatus, setPhoneStatus] = useState<'not_ready' | 'initializing' | 'ready' | 'error'>('not_ready');
  const [callState, setCallState] = useState<CallState>(initialCallState);
  const [isDialing, setIsDialing] = useState(false);
  
  const webPhoneRef = useRef<any>(null);
  const sessionRef = useRef<any>(null);
  const timerIntervalRef = useRef<number | null>(null);
  const callStartTimeRef = useRef<number | null>(null);
  const callContextRef = useRef<{
    clientId: string | undefined;
    personId: string | undefined;
    phoneNumber: string;
    sessionId: string;
  } | null>(null);
  const callLoggedRef = useRef<boolean>(false);
  const sipInfoRef = useRef<any>(null);
  
  const { data: clientPeople } = useQuery<any[]>({
    queryKey: ['/api/clients', clientId, 'people'],
    enabled: !!clientId && isOpen,
  });

  const derivedPersonName = (() => {
    if (personName) return personName;
    if (selectedPersonId && clientPeople) {
      const found = clientPeople.find((cp: any) => cp.person.id === selectedPersonId);
      if (found) {
        return `${found.person.firstName || ''} ${found.person.lastName || ''}`.trim();
      }
    }
    return undefined;
  })();

  useEffect(() => {
    setSelectedPersonId(personId);
    setSelectedPhoneNumber(phoneNumber);
  }, [personId, phoneNumber]);
  
  useEffect(() => {
    if (isOpen && phoneStatus === 'not_ready') {
      initializeWebPhone();
    }
  }, [isOpen]);

  const waitForPhoneReady = (maxWaitMs: number = 15000): Promise<boolean> => {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const checkReady = () => {
        if (webPhoneRef.current) {
          resolve(true);
          return;
        }
        if (phoneStatus === 'error') {
          resolve(false);
          return;
        }
        if (Date.now() - startTime > maxWaitMs) {
          resolve(false);
          return;
        }
        setTimeout(checkReady, 200);
      };
      checkReady();
    });
  };

  const initializeAndCall = async () => {
    const number = selectedPhoneNumber;
    if (!number) {
      toast({
        title: 'No phone number',
        description: 'Please select a person with a phone number',
        variant: 'destructive',
      });
      return;
    }

    setIsDialing(true);

    if (!webPhoneRef.current) {
      if (phoneStatus === 'not_ready' || phoneStatus === 'error') {
        initializeWebPhone();
      }
      
      const isReady = await waitForPhoneReady(15000);
      if (!isReady) {
        toast({
          title: 'Connection failed',
          description: 'Could not connect to phone system. Please try again.',
          variant: 'destructive',
        });
        setIsDialing(false);
        return;
      }
    }

    await makeCallInternal(number);
  };

  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      if (sessionRef.current) {
        try {
          sessionRef.current.dispose();
        } catch (e) {}
      }
    };
  }, []);

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const initializeWebPhone = async () => {
    if (phoneStatus === 'initializing' || phoneStatus === 'ready') {
      return;
    }

    try {
      setPhoneStatus('initializing');
      console.log('[RingCentral] Starting phone initialization...');

      const sipProvision = await apiRequest('POST', '/api/ringcentral/sip-provision');

      if (!sipProvision || !sipProvision.sipInfo || sipProvision.sipInfo.length === 0) {
        throw new Error('Failed to get SIP provisioning credentials');
      }

      sipInfoRef.current = sipProvision.sipInfo[0];

      const webPhone = new RingCentralWebPhone({ 
        sipInfo: sipProvision.sipInfo[0],
        debug: false
      });

      await webPhone.start();
      
      webPhoneRef.current = webPhone;
      setPhoneStatus('ready');
      console.log('[RingCentral] Phone ready');

    } catch (error: any) {
      console.error('[RingCentral] Initialization failed:', error);
      setPhoneStatus('error');
      showFriendlyError({ error: 'Failed to initialize phone. Please try again.' });
    }
  };

  const startCallTimer = () => {
    callStartTimeRef.current = Date.now();
    timerIntervalRef.current = window.setInterval(() => {
      if (callStartTimeRef.current) {
        const elapsed = Math.floor((Date.now() - callStartTimeRef.current) / 1000);
        setCallState(prev => ({ ...prev, duration: elapsed }));
      }
    }, 1000);
  };

  const stopCallTimer = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    callStartTimeRef.current = null;
  };

  const logCallToServer = async (eventName: string) => {
    if (callLoggedRef.current) {
      return;
    }
    
    const ctx = callContextRef.current;
    let finalDuration = 0;
    if (callStartTimeRef.current) {
      finalDuration = Math.floor((Date.now() - callStartTimeRef.current) / 1000);
    }
    
    stopCallTimer();
    setCallState(prev => ({ ...prev, status: 'disconnected' }));
    
    const logClientId = ctx?.clientId || clientId;
    const logPersonId = ctx?.personId || selectedPersonId;
    const logPhoneNumber = ctx?.phoneNumber;
    const logSessionId = ctx?.sessionId;
    
    if (logSessionId) {
      callLoggedRef.current = true;
      
      if (logClientId) {
        try {
          await apiRequest('POST', '/api/ringcentral/log-call', {
            clientId: logClientId,
            personId: logPersonId || undefined,
            phoneNumber: logPhoneNumber,
            direction: 'outbound',
            duration: finalDuration,
            sessionId: logSessionId,
          });
          
          toast({
            title: 'Call Logged',
            description: 'Call has been logged to communications',
          });
          
          queryClient.invalidateQueries({ queryKey: ['/api/communications/client', logClientId] });
        } catch (error: any) {
          console.error('[RingCentral] Error logging call:', error);
        }
      } else {
        toast({
          title: 'Call Completed',
          description: 'Call ended. Note: Call was not logged as no client context was provided.',
        });
      }
    }
    
    setTimeout(() => {
      setCallState(initialCallState);
      sessionRef.current = null;
      callContextRef.current = null;
      callLoggedRef.current = false;
      setIsDialing(false);
      onClose();
    }, 2000);
  };

  const makeCallInternal = async (number: string) => {
    try {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
      } catch (permError: any) {
        showFriendlyError({ error: 'Please allow microphone access to make calls' });
        setIsDialing(false);
        return;
      }

      const sessionId = `call-${Date.now()}`;
      
      callContextRef.current = {
        clientId,
        personId: selectedPersonId,
        phoneNumber: number,
        sessionId,
      };
      
      let formattedNumber = number;
      if (number.startsWith('07') || number.startsWith('01') || number.startsWith('02')) {
        formattedNumber = '+44' + number.substring(1);
      } else if (!number.startsWith('+')) {
        formattedNumber = '+44' + number;
      }
      
      setCallState({
        sessionId,
        phoneNumber: number,
        status: 'ringing',
        duration: 0,
        isMuted: false,
        isOnHold: false,
        isInbound: false,
      });

      const callPromise = webPhoneRef.current.call(formattedNumber);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Call setup timed out')), 30000);
      });
      
      const session = await Promise.race([callPromise, timeoutPromise]) as any;
      
      if (!session) {
        throw new Error('Failed to create call session');
      }
      
      sessionRef.current = session;
      
      if (session.state === 'answered' || session.state === 'confirmed' || session.state === 'connected') {
        setCallState(prev => ({ ...prev, status: 'connected' }));
        startCallTimer();
      }

      session.on('accepted', () => {
        setCallState(prev => ({ ...prev, status: 'connected' }));
        if (!callStartTimeRef.current) {
          startCallTimer();
        }
      });

      session.on('progress', () => {
        if (!callStartTimeRef.current) {
          startCallTimer();
        }
      });
      
      session.on('confirmed', () => {
        setCallState(prev => ({ ...prev, status: 'connected' }));
        if (!callStartTimeRef.current) {
          startCallTimer();
        }
      });

      callLoggedRef.current = false;

      session.on('terminated', () => logCallToServer('terminated'));
      session.on('ended', () => logCallToServer('ended'));
      session.on('bye', () => logCallToServer('bye'));
      session.on('disposed', () => logCallToServer('disposed'));
      session.on('cancel', () => logCallToServer('cancel'));
      session.on('rejected', () => logCallToServer('rejected'));
      session.on('failed', (error: any) => {
        stopCallTimer();
        setCallState(prev => ({ ...prev, status: 'disconnected' }));
        setIsDialing(false);
        showFriendlyError({ error: error?.message || 'Failed to connect call' });
        logCallToServer('failed');
      });

    } catch (error: any) {
      console.error('[RingCentral] Error making call:', error);
      setCallState(initialCallState);
      setIsDialing(false);
      showFriendlyError({ error });
    }
  };

  const hangup = async () => {
    if (sessionRef.current) {
      const session = sessionRef.current;
      
      try {
        if (typeof session.hangup === 'function') {
          await session.hangup();
        } else if (typeof session.bye === 'function') {
          await session.bye();
        } else if (typeof session.terminate === 'function') {
          await session.terminate();
        } else if (typeof session.cancel === 'function') {
          await session.cancel();
        } else if (typeof session.dispose === 'function') {
          await session.dispose();
        }
        
        sessionRef.current = null;
        stopCallTimer();
        setCallState(initialCallState);
        setIsDialing(false);
      } catch (error) {
        console.error('[RingCentral] Error hanging up:', error);
        try {
          if (typeof session.dispose === 'function') {
            await session.dispose();
          }
        } catch (e) {}
        sessionRef.current = null;
        stopCallTimer();
        setCallState(initialCallState);
        setIsDialing(false);
      }
    } else {
      setCallState(initialCallState);
      setIsDialing(false);
    }
  };

  const toggleMute = async () => {
    if (sessionRef.current) {
      try {
        if (callState.isMuted) {
          await sessionRef.current.unmute();
        } else {
          await sessionRef.current.mute();
        }
        setCallState(prev => ({ ...prev, isMuted: !prev.isMuted }));
      } catch (error) {
        console.error('Error toggling mute:', error);
      }
    }
  };

  const toggleHold = async () => {
    if (sessionRef.current) {
      try {
        if (callState.isOnHold) {
          await sessionRef.current.unhold();
        } else {
          await sessionRef.current.hold();
        }
        setCallState(prev => ({ ...prev, isOnHold: !prev.isOnHold }));
      } catch (error) {
        console.error('Error toggling hold:', error);
      }
    }
  };

  const isCallActive = callState.status === 'ringing' || callState.status === 'connected';

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open && !isCallActive) {
        onClose();
      }
    }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            {isCallActive ? 'Call in Progress' : 'Make a Call'}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {!isCallActive ? (
            <>
              {derivedPersonName && selectedPhoneNumber && !clientId ? (
                <div className="p-4 bg-muted/50 rounded-lg border space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Phone className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="font-medium">{derivedPersonName}</div>
                      <div className="text-sm text-muted-foreground font-mono">{selectedPhoneNumber}</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Select Person</label>
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
                    disabled={isDialing}
                  >
                    <SelectTrigger data-testid="select-call-person">
                      <SelectValue placeholder="Select a person to call..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No person selected</SelectItem>
                      {(clientPeople || []).map((cp: any) => (
                        <SelectItem 
                          key={cp.person.id} 
                          value={cp.person.id}
                          disabled={!cp.person.primaryPhone}
                        >
                          {cp.person.firstName} {cp.person.lastName}
                          {cp.person.primaryPhone ? ` - ${cp.person.primaryPhone}` : ' (no phone)'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <Button
                onClick={initializeAndCall}
                disabled={!selectedPhoneNumber || isDialing}
                className="w-full h-12 text-base"
                data-testid="button-call"
              >
                {isDialing ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    {phoneStatus !== 'ready' ? 'Connecting...' : 'Dialing...'}
                  </>
                ) : (
                  <>
                    <Phone className="h-5 w-5 mr-2" />
                    Call
                  </>
                )}
              </Button>

              {phoneStatus === 'error' && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setPhoneStatus('not_ready');
                    initializeWebPhone();
                  }}
                  className="w-full"
                >
                  Retry Phone Connection
                </Button>
              )}
            </>
          ) : (
            <div className="space-y-4">
              <div className="text-center py-4" data-testid="call-status-container">
                <div className="text-lg font-semibold" data-testid="text-call-phone-number">
                  {callState.phoneNumber}
                </div>
                <div className="text-2xl font-bold text-primary mt-2" data-testid="text-call-status">
                  {callState.status === 'ringing' && 'Calling...'}
                  {callState.status === 'connected' && formatDuration(callState.duration)}
                  {callState.status === 'disconnected' && 'Call Ended'}
                </div>
              </div>

              {callState.status === 'connected' && (
                <div className="flex gap-2">
                  <Button
                    onClick={toggleMute}
                    variant={callState.isMuted ? 'default' : 'outline'}
                    className="flex-1"
                    data-testid="button-toggle-mute"
                  >
                    {callState.isMuted ? (
                      <><MicOff className="h-4 w-4 mr-2" /> Unmute</>
                    ) : (
                      <><Mic className="h-4 w-4 mr-2" /> Mute</>
                    )}
                  </Button>
                  <Button
                    onClick={toggleHold}
                    variant={callState.isOnHold ? 'default' : 'outline'}
                    className="flex-1"
                    data-testid="button-toggle-hold"
                  >
                    {callState.isOnHold ? (
                      <><Play className="h-4 w-4 mr-2" /> Resume</>
                    ) : (
                      <><Pause className="h-4 w-4 mr-2" /> Hold</>
                    )}
                  </Button>
                </div>
              )}

              <Button
                onClick={hangup}
                variant="destructive"
                className="w-full h-12 text-base"
                data-testid="button-hangup"
              >
                <PhoneOff className="h-5 w-5 mr-2" />
                {callState.status === 'ringing' ? 'Cancel' : 'End Call'}
              </Button>
            </div>
          )}
        </div>

        <audio id="rc-audio-remote" hidden />
        <audio id="rc-audio-local" hidden muted />
      </DialogContent>
    </Dialog>
  );
}
