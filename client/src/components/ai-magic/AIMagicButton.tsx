import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AIMagicChatPanel } from './AIMagicChatPanel';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';

interface FeatureFlags {
  ringCentralLive: boolean;
  appIsLive: boolean;
  aiButtonEnabled: boolean;
}

export function AIMagicButton() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [triggerVoice, setTriggerVoice] = useState(false);
  const voiceTriggerRef = useRef<(() => void) | null>(null);

  const { data: featureFlags } = useQuery<FeatureFlags>({
    queryKey: ['/api/feature-flags'],
    staleTime: 1000 * 60 * 5,
  });

  const togglePanel = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  // Only show button if global setting is enabled AND user has permission (or is superAdmin)
  const shouldShowButton = featureFlags?.aiButtonEnabled && (user?.canAccessMagicAiButton || user?.superAdmin);

  // Handler to trigger voice recording from the chat panel
  const handleVoiceTrigger = useCallback((toggleFn: () => void) => {
    voiceTriggerRef.current = toggleFn;
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // CMD/CTRL+K: Open panel (text input)
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        togglePanel();
      }
      // CMD/CTRL+I: Open panel with voice input
      if ((e.metaKey || e.ctrlKey) && e.key === 'i') {
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
          setTriggerVoice(true);
        } else if (voiceTriggerRef.current) {
          voiceTriggerRef.current();
        }
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, togglePanel]);

  if (!shouldShowButton) {
    return null;
  }

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <AIMagicChatPanel 
            onClose={() => {
              setIsOpen(false);
              setTriggerVoice(false);
              voiceTriggerRef.current = null;
            }}
            triggerVoice={triggerVoice}
            onVoiceTriggered={() => setTriggerVoice(false)}
            onRegisterVoiceTrigger={handleVoiceTrigger}
          />
        )}
      </AnimatePresence>

      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "fixed bottom-6 left-6 z-50",
          "w-14 h-14 rounded-full",
          "flex items-center justify-center",
          "shadow-lg hover:shadow-xl",
          "transition-all duration-200",
          "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary",
          isOpen
            ? "bg-muted text-muted-foreground"
            : "bg-gradient-to-br from-primary to-accent text-white"
        )}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
        data-testid="button-ai-magic"
        aria-label={isOpen ? "Close AI assistant" : "Open AI assistant"}
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <X className="w-6 h-6" />
            </motion.div>
          ) : (
            <motion.div
              key="sparkles"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <Sparkles className="w-6 h-6" />
            </motion.div>
          )}
        </AnimatePresence>

        {!isOpen && (
          <motion.div
            className="absolute inset-0 rounded-full bg-gradient-to-br from-primary to-accent"
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.5, 0, 0.5],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        )}
      </motion.button>
    </>
  );
}
