import { useState, useEffect, useRef } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Pause, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

// Import RingCentral Web Phone (will be initialized dynamically)
declare global {
  interface Window {
    RingCentral: any;
  }
}

interface CallState {
  sessionId: string | null;
  phoneNumber: string | null;
  status: 'idle' | 'calling' | 'ringing' | 'connected' | 'disconnected';
  duration: number;
  isMuted: boolean;
  isOnHold: boolean;
  isInbound: boolean;
  recordingId?: string;
}

interface RingCentralPhoneProps {
  clientId?: string;
  personId?: string;
  onCallComplete?: (callData: {
    phoneNumber: string;
    duration: number;
    sessionId: string;
    recordingId?: string;
  }) => void;
}

export function RingCentralPhone({ clientId, personId, onCallComplete }: RingCentralPhoneProps) {
  const { toast } = useToast();
  const [callState, setCallState] = useState<CallState>({
    sessionId: null,
    phoneNumber: null,
    status: 'idle',
    duration: 0,
    isMuted: false,
    isOnHold: false,
    isInbound: false,
  });
  
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isInitialized, setIsInitialized] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  
  const webPhoneRef = useRef<any>(null);
  const sessionRef = useRef<any>(null);
  const timerIntervalRef = useRef<number | null>(null);
  const callStartTimeRef = useRef<number | null>(null);
  const autoRejectTimerRef = useRef<number | null>(null);

  // Format call duration
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Initialize WebPhone
  const initializeWebPhone = async () => {
    if (isInitializing || isInitialized) return;

    try {
      setIsInitializing(true);

      // Load RingCentral Web Phone SDK if not already loaded
      if (!window.RingCentral) {
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/ringcentral-web-phone@latest/dist/ringcentral-web-phone.js';
        script.async = true;
        
        await new Promise((resolve, reject) => {
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }

      // Get SIP provisioning credentials
      const sipProvision = await apiRequest('POST', '/api/ringcentral/sip-provision');

      if (!sipProvision || !sipProvision.sipInfo || sipProvision.sipInfo.length === 0) {
        throw new Error('Failed to get SIP provisioning credentials');
      }

      const sipInfo = sipProvision.sipInfo[0];

      // Initialize WebPhone
      const webPhone = new window.RingCentral.WebPhone(sipProvision, {
        appKey: import.meta.env.VITE_RINGCENTRAL_CLIENT_ID || '',
        appName: 'CRM Phone',
        appVersion: '1.0.0',
        media: {
          remote: document.getElementById('rc-audio-remote') as HTMLAudioElement,
          local: document.getElementById('rc-audio-local') as HTMLAudioElement,
        },
        logLevel: 1,
      });

      // WebPhone event listeners
      webPhone.userAgent.on('registered', () => {
        console.log('WebPhone registered');
        setIsInitialized(true);
        toast({ title: 'Phone Ready', description: 'RingCentral phone is ready to make calls' });
      });

      webPhone.userAgent.on('unregistered', () => {
        console.log('WebPhone unregistered');
        setIsInitialized(false);
      });

      webPhone.userAgent.on('registrationFailed', (error: any) => {
        console.error('WebPhone registration failed:', error);
        setIsInitialized(false);
        toast({
          title: 'Phone Registration Failed',
          description: 'Failed to register with RingCentral. Please reconnect your account.',
          variant: 'destructive',
        });
      });

      // Handle incoming calls
      webPhone.userAgent.on('invite', (session: any) => {
        console.log('Incoming call from:', session.request.from.displayName || session.request.from.uri.user);
        
        const incomingNumber = session.request.from.displayName || session.request.from.uri.user;
        const incomingSessionId = session.request.callId || `call-${Date.now()}`;
        
        sessionRef.current = session;
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
        session.on('accepted', () => {
          console.log('Inbound call accepted');
          setCallState(prev => ({ ...prev, status: 'connected' }));
          startCallTimer();
        });

        session.on('terminated', async () => {
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
            setCallState({
              sessionId: null,
              phoneNumber: null,
              status: 'idle',
              duration: 0,
              isMuted: false,
              isOnHold: false,
              isInbound: false,
            });
          }, 2000);
        });

        session.on('failed', (error: any) => {
          console.error('Inbound call failed:', error);
          stopCallTimer();
          setCallState(prev => ({ ...prev, status: 'disconnected' }));
        });

        // Auto-reject after 30 seconds if not answered
        autoRejectTimerRef.current = window.setTimeout(() => {
          // Check if session is still in ringing state
          if (sessionRef.current === session && session.state === 'Ringing') {
            console.log('Auto-rejecting unanswered call');
            session.reject();
            sessionRef.current = null;
            setCallState({
              sessionId: null,
              phoneNumber: null,
              status: 'idle',
              duration: 0,
              isMuted: false,
              isOnHold: false,
              isInbound: false,
            });
          }
          autoRejectTimerRef.current = null;
        }, 30000);
      });

      webPhoneRef.current = webPhone;
    } catch (error) {
      console.error('Error initializing WebPhone:', error);
      toast({
        title: 'Initialization Error',
        description: error instanceof Error ? error.message : 'Failed to initialize phone',
        variant: 'destructive',
      });
      setIsInitialized(false);
    } finally {
      setIsInitializing(false);
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

  // Make a call
  const makeCall = async (number: string) => {
    if (!isInitialized || !webPhoneRef.current) {
      toast({
        title: 'Phone Not Ready',
        description: 'Please wait for the phone to initialize',
        variant: 'destructive',
      });
      return;
    }

    try {
      const session = webPhoneRef.current.userAgent.invite(number, {
        media: {
          render: {
            remote: document.getElementById('rc-audio-remote') as HTMLAudioElement,
            local: document.getElementById('rc-audio-local') as HTMLAudioElement,
          },
        },
      });

      sessionRef.current = session;
      
      const sessionId = session.request.callId || `call-${Date.now()}`;
      
      setCallState({
        sessionId,
        phoneNumber: number,
        status: 'calling',
        duration: 0,
        isMuted: false,
        isOnHold: false,
        isInbound: false,
      });

      // Session event listeners
      session.on('progress', () => {
        console.log('Call progress');
        setCallState(prev => ({ ...prev, status: 'ringing' }));
      });

      session.on('accepted', () => {
        console.log('Call accepted');
        setCallState(prev => ({ ...prev, status: 'connected' }));
        startCallTimer();
      });

      session.on('terminated', async () => {
        console.log('Call terminated');
        stopCallTimer();
        
        // Use functional update to get fresh duration
        let finalDuration = 0;
        setCallState(prev => {
          finalDuration = prev.duration;
          return { ...prev, status: 'disconnected' };
        });

        // Log the call
        if (clientId && sessionId) {
          try {
            const communication = await apiRequest('POST', '/api/ringcentral/log-call', {
              clientId,
              personId: personId || undefined,
              phoneNumber: number,
              direction: 'outbound',
              duration: finalDuration,
              sessionId,
              recordingId: callState.recordingId,
            });

            toast({
              title: 'Call Logged',
              description: 'Call has been logged to communications',
            });

            // Call completion callback
            if (onCallComplete) {
              onCallComplete({
                phoneNumber: number,
                duration: finalDuration,
                sessionId,
                recordingId: callState.recordingId,
              });
            }
          } catch (error) {
            console.error('Error logging call:', error);
          }
        }

        // Reset state
        setTimeout(() => {
          setCallState({
            sessionId: null,
            phoneNumber: null,
            status: 'idle',
            duration: 0,
            isMuted: false,
            isOnHold: false,
            isInbound: false,
          });
          setPhoneNumber('');
        }, 2000);
      });

      session.on('failed', (error: any) => {
        console.error('Call failed:', error);
        stopCallTimer();
        setCallState(prev => ({ ...prev, status: 'disconnected' }));
        toast({
          title: 'Call Failed',
          description: 'Failed to connect the call',
          variant: 'destructive',
        });
      });
    } catch (error) {
      console.error('Error making call:', error);
      toast({
        title: 'Call Error',
        description: 'Failed to initiate call',
        variant: 'destructive',
      });
    }
  };

  // Answer incoming call
  const answerCall = () => {
    if (sessionRef.current) {
      // Clear auto-reject timer
      if (autoRejectTimerRef.current) {
        clearTimeout(autoRejectTimerRef.current);
        autoRejectTimerRef.current = null;
      }
      
      sessionRef.current.accept({
        media: {
          render: {
            remote: document.getElementById('rc-audio-remote') as HTMLAudioElement,
            local: document.getElementById('rc-audio-local') as HTMLAudioElement,
          },
        },
      });
    }
  };

  // Hangup call
  const hangup = () => {
    // Clear auto-reject timer if exists
    if (autoRejectTimerRef.current) {
      clearTimeout(autoRejectTimerRef.current);
      autoRejectTimerRef.current = null;
    }
    
    if (sessionRef.current) {
      sessionRef.current.terminate();
      sessionRef.current = null;
    }
  };

  // Toggle mute
  const toggleMute = () => {
    if (sessionRef.current) {
      if (callState.isMuted) {
        sessionRef.current.unmute();
      } else {
        sessionRef.current.mute();
      }
      setCallState(prev => ({ ...prev, isMuted: !prev.isMuted }));
    }
  };

  // Toggle hold
  const toggleHold = () => {
    if (sessionRef.current) {
      if (callState.isOnHold) {
        sessionRef.current.unhold();
      } else {
        sessionRef.current.hold();
      }
      setCallState(prev => ({ ...prev, isOnHold: !prev.isOnHold }));
    }
  };

  // Initialize on mount
  useEffect(() => {
    initializeWebPhone();

    return () => {
      // Cleanup
      if (autoRejectTimerRef.current) {
        clearTimeout(autoRejectTimerRef.current);
      }
      if (webPhoneRef.current) {
        webPhoneRef.current.userAgent.stop();
      }
      stopCallTimer();
    };
  }, []);

  return (
    <>
      {/* Hidden audio elements for WebRTC */}
      <audio id="rc-audio-remote" hidden />
      <audio id="rc-audio-local" hidden muted />

      <Card className="w-full max-w-md" data-testid="card-ringcentral-phone">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="w-5 h-5" />
            RingCentral Phone
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isInitialized ? (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                {isInitializing ? 'Initializing phone...' : 'Phone not initialized'}
              </p>
            </div>
          ) : (
            <>
              {/* Call Status */}
              {callState.status !== 'idle' && (
                <div className="p-4 bg-muted rounded-lg text-center" data-testid="div-call-status">
                  <p className="text-sm text-muted-foreground mb-1">
                    {callState.status === 'calling' && 'Calling...'}
                    {callState.status === 'ringing' && 'Ringing...'}
                    {callState.status === 'connected' && 'Connected'}
                    {callState.status === 'disconnected' && 'Call Ended'}
                  </p>
                  <p className="text-lg font-semibold" data-testid="text-call-number">
                    {callState.phoneNumber}
                  </p>
                  {callState.status === 'connected' && (
                    <p className="text-2xl font-mono mt-2" data-testid="text-call-duration">
                      {formatDuration(callState.duration)}
                    </p>
                  )}
                </div>
              )}

              {/* Phone Number Input */}
              {callState.status === 'idle' && (
                <div className="space-y-2">
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="Enter phone number"
                    className="w-full px-3 py-2 border rounded-md"
                    data-testid="input-phone-number"
                  />
                </div>
              )}

              {/* Call Controls */}
              <div className="flex items-center justify-center gap-2">
                {callState.status === 'idle' ? (
                  <Button
                    onClick={() => phoneNumber && makeCall(phoneNumber)}
                    disabled={!phoneNumber}
                    size="lg"
                    className="flex items-center gap-2"
                    data-testid="button-make-call"
                  >
                    <Phone className="w-5 h-5" />
                    Call
                  </Button>
                ) : callState.status === 'ringing' && callState.isInbound ? (
                  // Incoming call - show Answer button
                  <>
                    <Button
                      onClick={answerCall}
                      variant="default"
                      size="lg"
                      className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
                      data-testid="button-answer-call"
                    >
                      <Phone className="w-5 h-5" />
                      Answer
                    </Button>
                    <Button
                      onClick={hangup}
                      variant="destructive"
                      size="lg"
                      className="flex items-center gap-2"
                      data-testid="button-reject-call"
                    >
                      <PhoneOff className="w-5 h-5" />
                      Reject
                    </Button>
                  </>
                ) : (
                  <>
                    {callState.status === 'connected' && (
                      <>
                        <Button
                          onClick={toggleMute}
                          variant={callState.isMuted ? 'default' : 'outline'}
                          size="icon"
                          data-testid="button-toggle-mute"
                        >
                          {callState.isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                        </Button>
                        <Button
                          onClick={toggleHold}
                          variant={callState.isOnHold ? 'default' : 'outline'}
                          size="icon"
                          data-testid="button-toggle-hold"
                        >
                          {callState.isOnHold ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                        </Button>
                      </>
                    )}
                    {callState.status !== 'disconnected' && (
                      <Button
                        onClick={hangup}
                        variant="destructive"
                        size="lg"
                        className="flex items-center gap-2"
                        data-testid="button-hangup"
                      >
                        <PhoneOff className="w-5 h-5" />
                        Hang Up
                      </Button>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </>
  );
}
