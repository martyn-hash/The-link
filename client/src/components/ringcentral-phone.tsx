import { useState, useEffect, useRef } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Pause, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
// @ts-ignore - RingCentral Web Phone types
import RingCentralWebPhone from 'ringcentral-web-phone';

interface CallState {
  sessionId: string | null;
  phoneNumber: string | null;
  status: 'idle' | 'ringing' | 'connected' | 'disconnected';
  duration: number;
  isMuted: boolean;
  isOnHold: boolean;
  isInbound: boolean;
}

interface RingCentralPhoneProps {
  clientId?: string;
  personId?: string;
  defaultPhoneNumber?: string;
  onCallComplete?: (duration: number, phoneNumber: string) => void;
}

export function RingCentralPhone({ clientId, personId, defaultPhoneNumber, onCallComplete }: RingCentralPhoneProps) {
  // VERSION CHECK - if you see this, new code is loaded!
  console.log('🔄 RingCentral Phone Component LOADED - Version: 2025-10-03-085500');
  console.log('🔄 Props:', { clientId, personId, defaultPhoneNumber });
  
  const { toast } = useToast();
  
  const initialCallState: CallState = {
    sessionId: null,
    phoneNumber: null,
    status: 'idle',
    duration: 0,
    isMuted: false,
    isOnHold: false,
    isInbound: false,
  };

  const [callState, setCallState] = useState<CallState>(initialCallState);
  
  const [phoneNumber, setPhoneNumber] = useState(defaultPhoneNumber || '');
  const [isInitialized, setIsInitialized] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  
  const webPhoneRef = useRef<any>(null);
  const sessionRef = useRef<any>(null);
  const timerIntervalRef = useRef<number | null>(null);
  const callStartTimeRef = useRef<number | null>(null);
  const autoRejectTimerRef = useRef<number | null>(null);

  // Update phone number when defaultPhoneNumber prop changes
  useEffect(() => {
    if (defaultPhoneNumber) {
      console.log('[RingCentral] Setting phone number from prop:', defaultPhoneNumber);
      setPhoneNumber(defaultPhoneNumber);
    }
  }, [defaultPhoneNumber]);

  // Format call duration
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Initialize WebPhone with v2.x API (CACHE BUST v2025-10-03-084900)
  const initializeWebPhone = async () => {
    console.log('[RingCentral] initializeWebPhone called');
    console.log('[RingCentral] isInitializing:', isInitializing, 'isInitialized:', isInitialized);
    
    if (isInitializing || isInitialized) {
      console.log('[RingCentral] Already initializing or initialized, skipping');
      return;
    }

    try {
      setIsInitializing(true);
      console.log('[RingCentral] Starting initialization...');

      // Get SIP provisioning credentials
      console.log('[RingCentral] Requesting SIP provisioning from backend...');
      const sipProvision = await apiRequest('POST', '/api/ringcentral/sip-provision');

      console.log('[RingCentral] SIP provision response received:', sipProvision);

      if (!sipProvision || !sipProvision.sipInfo || sipProvision.sipInfo.length === 0) {
        throw new Error('Failed to get SIP provisioning credentials - no sipInfo in response');
      }

      console.log('[RingCentral] SIP provisioning successful');
      console.log('[RingCentral] sipInfo details:', {
        username: sipProvision.sipInfo[0].username,
        domain: sipProvision.sipInfo[0].domain,
        outboundProxy: sipProvision.sipInfo[0].outboundProxy,
        transport: sipProvision.sipInfo[0].transport
      });

      // Initialize WebPhone with version 2.x API - pass single sipInfo object (not array)
      console.log('[RingCentral] Creating WebPhone instance with sipInfo[0]...');
      const webPhone = new RingCentralWebPhone({ sipInfo: sipProvision.sipInfo[0] });
      console.log('[RingCentral] WebPhone instance created:', webPhone);
      console.log('[RingCentral] WebPhone available methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(webPhone)));
      console.log('[RingCentral] WebPhone own properties:', Object.keys(webPhone));

      // Start the WebPhone (connects and registers)
      console.log('[RingCentral] Starting WebPhone (connecting WebSocket)...');
      await webPhone.start();
      console.log('[RingCentral] WebPhone started and registered successfully');
      
      webPhoneRef.current = webPhone;
      setIsInitialized(true);
      setIsInitializing(false);
      
      toast({ title: 'Phone Ready', description: 'RingCentral phone is ready to make calls' });

      // Handle incoming calls
      webPhone.on('inboundCall', async (inboundCallSession: any) => {
        console.log('Incoming call received');
        
        const incomingNumber = inboundCallSession.remoteIdentity?.displayName || 
                               inboundCallSession.remoteIdentity?.uri?.user || 
                               'Unknown';
        const incomingSessionId = `call-${Date.now()}`;
        
        sessionRef.current = inboundCallSession;
        setCallState({
          sessionId: incomingSessionId,
          phoneNumber: incomingNumber,
          status: 'ringing',
          duration: 0,
          isMuted: false,
          isOnHold: false,
          isInbound: true,
        });

        // Setup session event listeners for inbound call
        inboundCallSession.on('accepted', () => {
          console.log('Inbound call accepted');
          setCallState(prev => ({ ...prev, status: 'connected' }));
          startCallTimer();
        });

        inboundCallSession.on('terminated', async () => {
          console.log('Inbound call terminated');
          stopCallTimer();
          
          let finalDuration = 0;
          setCallState(prev => {
            finalDuration = prev.duration;
            return { ...prev, status: 'disconnected' };
          });

          // Log the inbound call
          if (clientId && incomingSessionId) {
            try {
              await apiRequest('POST', '/api/ringcentral/log-call', {
                clientId,
                personId: personId || undefined,
                phoneNumber: incomingNumber,
                direction: 'inbound',
                duration: finalDuration,
                sessionId: incomingSessionId,
              });

              toast({
                title: 'Call Logged',
                description: 'Call has been logged to communications',
              });
            } catch (error) {
              console.error('Error logging inbound call:', error);
            }
          }

          // Reset state
          setTimeout(() => {
            setCallState(initialCallState);
            sessionRef.current = null;
          }, 2000);
        });

        inboundCallSession.on('failed', (error: any) => {
          console.error('Inbound call failed:', error);
          stopCallTimer();
          setCallState(prev => ({ ...prev, status: 'disconnected' }));
        });

        // Auto-reject after 30 seconds if not answered
        autoRejectTimerRef.current = window.setTimeout(async () => {
          if (sessionRef.current === inboundCallSession) {
            console.log('Auto-rejecting unanswered call');
            try {
              await inboundCallSession.decline();
            } catch (error) {
              console.error('Error declining call:', error);
            }
            sessionRef.current = null;
            setCallState(initialCallState);
          }
        }, 30000);
      });

    } catch (error: any) {
      console.error('[RingCentral] ========== INITIALIZATION ERROR ==========');
      console.error('[RingCentral] Error initializing WebPhone:', error);
      console.error('[RingCentral] Error message:', error?.message);
      console.error('[RingCentral] Error stack:', error?.stack);
      console.error('[RingCentral] Error details:', JSON.stringify(error, null, 2));
      console.error('[RingCentral] ==========================================');
      
      setIsInitializing(false);
      setIsInitialized(false);
      
      toast({
        title: 'Initialization Error',
        description: error.message || 'Failed to initialize phone',
        variant: 'destructive',
      });
    }
  };

  // Start call timer
  const startCallTimer = () => {
    callStartTimeRef.current = Date.now();
    timerIntervalRef.current = window.setInterval(() => {
      if (callStartTimeRef.current) {
        const elapsed = Math.floor((Date.now() - callStartTimeRef.current) / 1000);
        setCallState(prev => ({ ...prev, duration: elapsed }));
      }
    }, 1000);
  };

  // Stop call timer
  const stopCallTimer = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    callStartTimeRef.current = null;
  };

  // Make outbound call
  const makeCall = async (number: string) => {
    console.log('[RingCentral] makeCall called with number:', number);
    console.log('[RingCentral] webPhoneRef.current:', webPhoneRef.current);
    console.log('[RingCentral] isInitialized:', isInitialized);
    
    if (!webPhoneRef.current || !isInitialized) {
      console.error('[RingCentral] Phone not ready - webPhone:', !!webPhoneRef.current, 'initialized:', isInitialized);
      toast({
        title: 'Phone Not Ready',
        description: 'Please initialize the phone first',
        variant: 'destructive',
      });
      return;
    }

    try {
      console.log('[RingCentral] Starting call to:', number);
      const sessionId = `call-${Date.now()}`;
      console.log('[RingCentral] Generated session ID:', sessionId);
      
      setCallState({
        sessionId,
        phoneNumber: number,
        status: 'ringing',
        duration: 0,
        isMuted: false,
        isOnHold: false,
        isInbound: false,
      });
      console.log('[RingCentral] Call state updated to ringing');

      // Make call with v2.x API - use call method
      console.log('[RingCentral] Calling webPhone.call() with number:', number);
      let session: any;
      try {
        session = await webPhoneRef.current.call({
          toNumber: number,
        });
        
        console.log('[RingCentral] Call session created successfully:', session);
        sessionRef.current = session;
      } catch (callError: any) {
        console.error('[RingCentral] ERROR in webPhone.call():', callError);
        console.error('[RingCentral] Call error message:', callError?.message);
        console.error('[RingCentral] Call error stack:', callError?.stack);
        throw callError;
      }

      // Setup session event listeners for outbound call
      session.on('accepted', () => {
        console.log('[RingCentral] Outbound call accepted - call connected');
        setCallState(prev => ({ ...prev, status: 'connected' }));
        startCallTimer();
      });

      session.on('terminated', async () => {
        console.log('[RingCentral] Outbound call terminated');
        stopCallTimer();
        
        let finalDuration = 0;
        setCallState(prev => {
          finalDuration = prev.duration;
          return { ...prev, status: 'disconnected' };
        });

        // Log the outbound call
        if (clientId && sessionId) {
          try {
            await apiRequest('POST', '/api/ringcentral/log-call', {
              clientId,
              personId: personId || undefined,
              phoneNumber: number,
              direction: 'outbound',
              duration: finalDuration,
              sessionId,
            });

            toast({
              title: 'Call Logged',
              description: 'Call has been logged to communications',
            });

            if (onCallComplete) {
              onCallComplete(finalDuration, number);
            }
          } catch (error) {
            console.error('Error logging outbound call:', error);
          }
        }

        // Reset state
        setTimeout(() => {
          setCallState(initialCallState);
          sessionRef.current = null;
        }, 2000);
      });

      session.on('failed', (error: any) => {
        console.error('[RingCentral] Outbound call failed:', error);
        console.error('[RingCentral] Error details:', JSON.stringify(error, null, 2));
        stopCallTimer();
        setCallState(prev => ({ ...prev, status: 'disconnected' }));
        toast({
          title: 'Call Failed',
          description: error?.message || 'Failed to connect call',
          variant: 'destructive',
        });
      });

    } catch (error: any) {
      console.error('[RingCentral] Error making call:', error);
      console.error('[RingCentral] Error stack:', error.stack);
      console.error('[RingCentral] Error details:', JSON.stringify(error, null, 2));
      setCallState(initialCallState);
      toast({
        title: 'Call Error',
        description: error.message || 'Failed to make call',
        variant: 'destructive',
      });
    }
  };

  // Hang up call
  const hangup = async () => {
    console.log('[RingCentral] Hangup called, sessionRef.current:', sessionRef.current);
    console.log('[RingCentral] Current call state:', callState);
    
    if (sessionRef.current) {
      try {
        console.log('[RingCentral] Attempting to hang up call');
        
        // Try to terminate the session properly
        if (typeof sessionRef.current.terminate === 'function') {
          console.log('[RingCentral] Calling session.terminate()');
          await sessionRef.current.terminate();
        } else if (typeof sessionRef.current.dispose === 'function') {
          console.log('[RingCentral] Calling session.dispose()');
          await sessionRef.current.dispose();
        } else if (typeof sessionRef.current.bye === 'function') {
          console.log('[RingCentral] Calling session.bye()');
          await sessionRef.current.bye();
        } else {
          console.warn('[RingCentral] No terminate/dispose/bye method found on session');
        }
        
        console.log('[RingCentral] Hangup successful, clearing session reference');
        sessionRef.current = null;
        stopCallTimer();
        
        // Reset state immediately
        setCallState(initialCallState);
      } catch (error) {
        console.error('[RingCentral] Error hanging up:', error);
        // Reset state even if there was an error
        sessionRef.current = null;
        stopCallTimer();
        setCallState(initialCallState);
      }
    } else {
      console.warn('[RingCentral] Hangup called but no active session');
      // Reset state anyway
      setCallState(initialCallState);
    }
  };

  // Answer incoming call
  const answerCall = async () => {
    if (sessionRef.current && callState.isInbound) {
      try {
        console.log('Answering call');
        
        // Clear auto-reject timer
        if (autoRejectTimerRef.current) {
          clearTimeout(autoRejectTimerRef.current);
          autoRejectTimerRef.current = null;
        }

        await sessionRef.current.answer();
      } catch (error) {
        console.error('Error answering call:', error);
        toast({
          title: 'Error',
          description: 'Failed to answer call',
          variant: 'destructive',
        });
      }
    }
  };

  // Decline incoming call
  const declineCall = async () => {
    if (sessionRef.current && callState.isInbound) {
      try {
        console.log('Declining call');
        
        // Clear auto-reject timer
        if (autoRejectTimerRef.current) {
          clearTimeout(autoRejectTimerRef.current);
          autoRejectTimerRef.current = null;
        }

        await sessionRef.current.decline();
        sessionRef.current = null;
        setCallState(initialCallState);
      } catch (error) {
        console.error('Error declining call:', error);
      }
    }
  };

  // Toggle mute
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

  // Toggle hold
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      if (autoRejectTimerRef.current) {
        clearTimeout(autoRejectTimerRef.current);
      }
      if (sessionRef.current) {
        sessionRef.current.dispose();
      }
    };
  }, []);

  return (
    <Card className="w-full" data-testid="ringcentral-phone-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Phone className="h-5 w-5" />
          RingCentral Phone
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isInitialized ? (
          <div className="flex flex-col items-center justify-center py-8">
            {isInitializing ? (
              <>
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4" data-testid="phone-initializing-spinner" />
                <p className="text-sm text-muted-foreground" data-testid="phone-initializing-text">Initializing phone...</p>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground mb-4" data-testid="phone-not-initialized-text">Phone not initialized</p>
                <Button 
                  onClick={initializeWebPhone}
                  data-testid="button-initialize-phone"
                >
                  Initialize Phone
                </Button>
              </>
            )}
          </div>
        ) : callState.status === 'idle' ? (
          <div className="space-y-4">
            <div>
              <label htmlFor="phone-number" className="text-sm font-medium mb-2 block">
                Phone Number
              </label>
              <input
                id="phone-number"
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+1234567890"
                className="w-full px-3 py-2 border rounded-md"
                data-testid="input-phone-number"
              />
            </div>
            <Button
              onClick={() => makeCall(phoneNumber)}
              disabled={!phoneNumber}
              className="w-full"
              data-testid="button-make-call"
            >
              <Phone className="h-4 w-4 mr-2" />
              Make Call
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-center" data-testid="call-status-container">
              <div className="text-lg font-semibold" data-testid="text-call-phone-number">{callState.phoneNumber}</div>
              <div className="text-sm text-muted-foreground" data-testid="text-call-status">
                {callState.status === 'ringing' && !callState.isInbound && 'Calling...'}
                {callState.status === 'ringing' && callState.isInbound && 'Incoming Call'}
                {callState.status === 'connected' && formatDuration(callState.duration)}
                {callState.status === 'disconnected' && 'Call Ended'}
              </div>
            </div>

            {callState.status === 'ringing' && callState.isInbound ? (
              <div className="flex gap-2">
                <Button
                  onClick={answerCall}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  data-testid="button-answer-call"
                >
                  <Phone className="h-4 w-4 mr-2" />
                  Answer
                </Button>
                <Button
                  onClick={declineCall}
                  variant="destructive"
                  className="flex-1"
                  data-testid="button-decline-call"
                >
                  <PhoneOff className="h-4 w-4 mr-2" />
                  Decline
                </Button>
              </div>
            ) : callState.status === 'connected' ? (
              <>
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
                <Button
                  onClick={hangup}
                  variant="destructive"
                  className="w-full"
                  data-testid="button-hangup"
                >
                  <PhoneOff className="h-4 w-4 mr-2" />
                  Hang Up
                </Button>
              </>
            ) : callState.status === 'ringing' ? (
              <Button
                onClick={hangup}
                variant="destructive"
                className="w-full"
                data-testid="button-cancel-call"
              >
                <PhoneOff className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            ) : null}
          </div>
        )}

        {/* Hidden audio elements for WebRTC */}
        <audio id="rc-audio-remote" hidden />
        <audio id="rc-audio-local" hidden muted />
      </CardContent>
    </Card>
  );
}
