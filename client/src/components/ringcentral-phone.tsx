import { useState, useEffect, useRef } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Pause, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { showFriendlyError } from '@/lib/friendlyErrors';
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
  const sipInfoRef = useRef<any>(null);
  
  // Refs to capture call context at call time (prevents stale closures)
  const callContextRef = useRef<{
    clientId: string | undefined;
    personId: string | undefined;
    phoneNumber: string;
    sessionId: string;
  } | null>(null);
  
  // Track if we've already logged this call (prevents duplicate logs from multiple events)
  const callLoggedRef = useRef<boolean>(false);

  // Warn if mounted without clientId - calls won't be logged without it
  useEffect(() => {
    if (!clientId) {
      console.warn('[RingCentral] ⚠️ Component mounted WITHOUT clientId - calls will NOT be logged to communications!');
    } else {
      console.log('[RingCentral] ✓ Component mounted with clientId:', clientId);
    }
  }, [clientId]);

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

      // Store sipInfo for later use (extracting fromNumber for outbound calls)
      sipInfoRef.current = sipProvision.sipInfo[0];

      // Initialize WebPhone with version 2.x API - pass single sipInfo object (not array)
      // Enable debug mode to get detailed SIP logs
      console.log('[RingCentral] Creating WebPhone instance with sipInfo[0] and debug=true...');
      const webPhone = new RingCentralWebPhone({ 
        sipInfo: sipProvision.sipInfo[0],
        debug: true  // Enable SIP debug logs
      });
      console.log('[RingCentral] WebPhone instance created:', webPhone);
      console.log('[RingCentral] WebPhone available methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(webPhone)));
      console.log('[RingCentral] WebPhone own properties:', Object.keys(webPhone));

      // Add WebPhone-level event listeners to catch all events
      webPhone.on('outboundCall', (session: any) => {
        console.log('[RingCentral] 📤 WebPhone outboundCall event fired!');
        console.log('[RingCentral] Session from event:', session);
        console.log('[RingCentral] Session state:', session?.state);
        console.log('[RingCentral] Session direction:', session?.direction);
      });

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
      
      showFriendlyError({ error });
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

  // Unified call logging function - handles logging from any termination event
  const logCallToServer = async (eventName: string) => {
    // Prevent duplicate logging from multiple events
    if (callLoggedRef.current) {
      console.log(`[RingCentral] 🔄 Call already logged, skipping (triggered by ${eventName})`);
      return;
    }
    
    console.log(`[RingCentral] 📞 Call ended via ${eventName} event - attempting to log...`);
    
    // Get call context from ref
    const ctx = callContextRef.current;
    console.log('[RingCentral] 📋 Call context from ref:', ctx);
    console.log('[RingCentral] 📋 callStartTimeRef.current:', callStartTimeRef.current);
    
    // Calculate duration directly from ref (more reliable than state)
    // IMPORTANT: Calculate duration BEFORE stopping the timer!
    let finalDuration = 0;
    if (callStartTimeRef.current) {
      finalDuration = Math.floor((Date.now() - callStartTimeRef.current) / 1000);
      console.log('[RingCentral] 📋 Calculated duration from timer ref:', finalDuration, 'seconds');
    } else {
      console.log('[RingCentral] ⚠️ callStartTimeRef.current is NULL - timer was never started!');
    }
    
    // Now stop the timer (which clears callStartTimeRef)
    stopCallTimer();
    setCallState(prev => ({ ...prev, status: 'disconnected' }));
    
    // Use context from ref (should always be available if makeCall was called properly)
    const logClientId = ctx?.clientId || clientId;
    const logPersonId = ctx?.personId || personId;
    const logPhoneNumber = ctx?.phoneNumber;
    const logSessionId = ctx?.sessionId;
    
    console.log('[RingCentral] 📋 Logging values:', { logClientId, logSessionId, logPhoneNumber, finalDuration });
    
    // Log the call
    if (logClientId && logSessionId) {
      callLoggedRef.current = true; // Mark as logged to prevent duplicates
      
      console.log('[RingCentral] ✅ Logging call to API...');
      try {
        const response = await apiRequest('POST', '/api/ringcentral/log-call', {
          clientId: logClientId,
          personId: logPersonId || undefined,
          phoneNumber: logPhoneNumber,
          direction: 'outbound',
          duration: finalDuration,
          sessionId: logSessionId,
        });
        
        console.log('[RingCentral] ✅ Call logged successfully:', response);
        toast({
          title: 'Call Logged',
          description: 'Call has been logged to communications',
        });
        
        if (onCallComplete) {
          onCallComplete(finalDuration, logPhoneNumber || '');
        }
      } catch (error: any) {
        console.error('[RingCentral] ❌ Error logging call:', error);
        toast({
          title: 'Call Logging Failed',
          description: 'The call completed but failed to save',
          variant: 'destructive',
        });
      }
    } else {
      console.warn('[RingCentral] ⚠️ Cannot log call - missing data:', {
        hasClientId: !!logClientId,
        hasSessionId: !!logSessionId,
        context: ctx
      });
      toast({
        title: 'Call Not Logged',
        description: 'Missing client or session data',
        variant: 'destructive',
      });
    }
    
    // Reset state after a delay
    setTimeout(() => {
      setCallState(initialCallState);
      sessionRef.current = null;
      callContextRef.current = null;
      callLoggedRef.current = false; // Reset for next call
    }, 2000);
  };

  // Make outbound call
  const makeCall = async (number: string) => {
    console.log('[RingCentral] makeCall called with number:', number);
    
    if (!webPhoneRef.current || !isInitialized) {
      console.error('[RingCentral] Phone not ready');
      showFriendlyError({ error: 'Please initialize the phone first' });
      return;
    }

    try {
      // Request microphone permission explicitly
      console.log('[RingCentral] Requesting microphone permission...');
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log('[RingCentral] Microphone permission granted');
        // Stop the stream immediately - we just needed permission
        stream.getTracks().forEach(track => track.stop());
      } catch (permError: any) {
        console.error('[RingCentral] Microphone permission denied:', permError);
        showFriendlyError({ error: 'Please allow microphone access to make calls' });
        return;
      }

      const sessionId = `call-${Date.now()}`;
      
      // Capture call context in ref to avoid stale closures in event handlers
      callContextRef.current = {
        clientId,
        personId,
        phoneNumber: number,
        sessionId,
      };
      console.log('[RingCentral] 📋 Captured call context in ref:', callContextRef.current);
      
      // Format phone number for RingCentral (add +44 for UK numbers if needed)
      let formattedNumber = number;
      if (number.startsWith('07')) {
        formattedNumber = '+44' + number.substring(1);
        console.log('[RingCentral] Formatted UK mobile:', number, '->', formattedNumber);
      } else if (number.startsWith('01') || number.startsWith('02')) {
        formattedNumber = '+44' + number.substring(1);
        console.log('[RingCentral] Formatted UK landline:', number, '->', formattedNumber);
      } else if (!number.startsWith('+')) {
        formattedNumber = '+44' + number;
        console.log('[RingCentral] Added country code:', number, '->', formattedNumber);
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

      console.log('[RingCentral] Initiating call to:', formattedNumber);
      
      // WebPhone v2 call() signature: call(callee, callerId?, options?)
      // callee = the phone number to call (positional argument, NOT an object)
      // callerId = optional caller ID (we omit to use default line)
      // options = optional call options
      console.log('[RingCentral] Calling webPhone.call() with callee:', formattedNumber);
      console.log('[RingCentral] WebPhone instance state:', {
        isStarted: webPhoneRef.current?.sipClient ? 'has sipClient' : 'no sipClient',
        callSessions: webPhoneRef.current?.callSessions?.length || 0,
      });
      
      try {
        // call() takes positional arguments, not an object!
        // Add a timeout wrapper to detect if call() hangs
        const callPromise = webPhoneRef.current.call(formattedNumber);
        console.log('[RingCentral] webPhone.call() returned promise:', callPromise);
        
        // Race against a timeout to detect hanging
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Call setup timed out after 30 seconds')), 30000);
        });
        
        const session = await Promise.race([callPromise, timeoutPromise]) as any;
        
        console.log('[RingCentral] call() returned session:', session);
        console.log('[RingCentral] Session state:', session?.state);
        console.log('[RingCentral] Session available methods:', session ? Object.getOwnPropertyNames(Object.getPrototypeOf(session)) : 'null');
        
        if (!session) {
          throw new Error('call() returned null/undefined session');
        }
        
        sessionRef.current = session;
      
      // IMPORTANT: The call() promise resolves AFTER the call connects (session.state === 'answered')
      // So we need to start the timer immediately when the promise resolves, not wait for events
      console.log('[RingCentral] Session state after call():', session.state);
      
      // If the session is already answered/connected, start the timer now
      if (session.state === 'answered' || session.state === 'confirmed' || session.state === 'connected') {
        console.log('[RingCentral] ⏱️ Call already connected (state:', session.state, '), starting timer IMMEDIATELY');
        setCallState(prev => ({ ...prev, status: 'connected' }));
        startCallTimer();
      }

      // Setup session event listeners for future events
      // These may not fire if the events already happened before we set up listeners
      session.on('accepted', () => {
        console.log('[RingCentral] ✅ Outbound call ACCEPTED - call connected!');
        setCallState(prev => ({ ...prev, status: 'connected' }));
        // Start timer if not already started
        if (!callStartTimeRef.current) {
          console.log('[RingCentral] ⏱️ Starting call timer on ACCEPTED');
          startCallTimer();
        }
      });

      session.on('progress', () => {
        console.log('[RingCentral] 📞 Call PROGRESS - phone is ringing');
        setCallState(prev => ({ ...prev, status: 'ringing' }));
        // Start timer on progress as fallback (in case 'accepted' doesn't fire for some sessions)
        if (!callStartTimeRef.current) {
          console.log('[RingCentral] ⏱️ Starting call timer on PROGRESS (fallback)');
          startCallTimer();
        }
      });
      
      // Also listen for 'confirmed' event (some SIP implementations use this)
      session.on('confirmed', () => {
        console.log('[RingCentral] ✅ Outbound call CONFIRMED');
        setCallState(prev => ({ ...prev, status: 'connected' }));
        if (!callStartTimeRef.current) {
          console.log('[RingCentral] ⏱️ Starting call timer on CONFIRMED');
          startCallTimer();
        }
      });
      
      // Listen for 'connecting' event
      session.on('connecting', () => {
        console.log('[RingCentral] 🔄 Call CONNECTING');
        if (!callStartTimeRef.current) {
          console.log('[RingCentral] ⏱️ Starting call timer on CONNECTING (fallback)');
          startCallTimer();
        }
      });

      // Reset the logged flag for this new call
      callLoggedRef.current = false;

      // Listen for ALL possible session termination events
      // Different WebPhone versions may emit different events
      
      session.on('terminated', () => {
        console.log('[RingCentral] 🔴 EVENT: terminated');
        logCallToServer('terminated');
      });

      session.on('ended', () => {
        console.log('[RingCentral] 🔴 EVENT: ended');
        logCallToServer('ended');
      });

      session.on('bye', () => {
        console.log('[RingCentral] 🔴 EVENT: bye');
        logCallToServer('bye');
      });

      session.on('disposed', () => {
        console.log('[RingCentral] 🔴 EVENT: disposed');
        logCallToServer('disposed');
      });

      session.on('cancel', () => {
        console.log('[RingCentral] 🔴 EVENT: cancel');
        logCallToServer('cancel');
      });

      session.on('rejected', () => {
        console.log('[RingCentral] 🔴 EVENT: rejected');
        logCallToServer('rejected');
      });

      session.on('failed', (error: any) => {
        console.error('[RingCentral] ⚠️ EVENT: failed', error);
        console.error('[RingCentral] Failure details:', {
          message: error?.message,
          statusCode: error?.statusCode,
          reasonPhrase: error?.reasonPhrase,
        });
        stopCallTimer();
        setCallState(prev => ({ ...prev, status: 'disconnected' }));
        showFriendlyError({ error: error?.message || error?.reasonPhrase || 'Failed to connect call' });
        // Also try to log on failure in case the call connected briefly
        logCallToServer('failed');
      });

      // Also log all session events for debugging
      const knownEvents = ['accepted', 'progress', 'terminated', 'ended', 'bye', 'disposed', 'cancel', 'rejected', 'failed'];
      const logUnknownEvent = (eventName: string) => {
        console.log(`[RingCentral] 🔵 Unknown session event: ${eventName}`);
      };
      
      // Try to catch any events we might have missed
      if (session.on) {
        const originalOn = session.on.bind(session);
        // Don't override, just log that we've set up listeners
        console.log('[RingCentral] ✅ Set up listeners for events:', knownEvents.join(', '));
      }

      console.log('[RingCentral] Event listeners attached for all termination events, waiting for call to connect...');

      } catch (callError: any) {
        // Handle errors from the call() promise itself
        console.error('[RingCentral] ⚠️ call() promise rejected:', callError);
        console.error('[RingCentral] Call error message:', callError?.message);
        console.error('[RingCentral] Call error details:', JSON.stringify(callError, Object.getOwnPropertyNames(callError), 2));
        
        stopCallTimer();
        setCallState(initialCallState);
        
        // Show user-friendly error
        const errorMessage = callError?.message || callError?.reasonPhrase || 'Failed to initiate call';
        showFriendlyError({ error: errorMessage });
        return;
      }

    } catch (error: any) {
      console.error('[RingCentral] Error making call:', error);
      console.error('[RingCentral] Error stack:', error.stack);
      console.error('[RingCentral] Error details:', JSON.stringify(error, null, 2));
      setCallState(initialCallState);
      showFriendlyError({ error });
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
      } catch (error: any) {
        console.error('Error answering call:', error);
        showFriendlyError({ error });
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
