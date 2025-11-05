import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { X, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';

export function PWAUpdatePrompt() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateFailed, setUpdateFailed] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const confettiIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const celebrationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Check if we just updated
    const justUpdated = localStorage.getItem('app-just-updated');
    if (justUpdated === 'true') {
      localStorage.removeItem('app-just-updated');
      setShowCelebration(true);
      
      // Trigger confetti
      const duration = 3000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

      const randomInRange = (min: number, max: number) => {
        return Math.random() * (max - min) + min;
      };

      confettiIntervalRef.current = setInterval(() => {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          if (confettiIntervalRef.current) {
            clearInterval(confettiIntervalRef.current);
            confettiIntervalRef.current = null;
          }
          return;
        }

        const particleCount = 50 * (timeLeft / duration);
        
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
        });
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
        });
      }, 250);

      // Auto-hide celebration after 5 seconds
      celebrationTimeoutRef.current = setTimeout(() => {
        setShowCelebration(false);
      }, 5000);
    }

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((reg) => {
        setRegistration(reg);

        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                setUpdateAvailable(true);
              }
            });
          }
        });

        if (reg.waiting) {
          setUpdateAvailable(true);
        }
      });
    }

    // Cleanup on unmount
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
      if (confettiIntervalRef.current) {
        clearInterval(confettiIntervalRef.current);
      }
      if (celebrationTimeoutRef.current) {
        clearTimeout(celebrationTimeoutRef.current);
      }
    };
  }, []);

  const handleUpdate = () => {
    if (registration?.waiting) {
      setIsUpdating(true);
      setUpdateFailed(false);
      localStorage.setItem('app-just-updated', 'true');
      
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      
      // Set up timeout in case update doesn't complete
      updateTimeoutRef.current = setTimeout(() => {
        setUpdateFailed(true);
        setIsUpdating(false);
        localStorage.removeItem('app-just-updated');
      }, 10000); // 10 second timeout
      
      window.addEventListener('controllerchange', () => {
        if (updateTimeoutRef.current) {
          clearTimeout(updateTimeoutRef.current);
        }
        window.location.reload();
      }, { once: true });
    }
  };

  const handleCancelUpdate = () => {
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }
    localStorage.removeItem('app-just-updated');
    setIsUpdating(false);
    setUpdateFailed(false);
    setUpdateAvailable(true); // Show the update prompt again
  };

  const handleClose = () => {
    setUpdateAvailable(false);
    setUpdateFailed(false);
  };

  const handleCloseCelebration = () => {
    setShowCelebration(false);
    if (confettiIntervalRef.current) {
      clearInterval(confettiIntervalRef.current);
      confettiIntervalRef.current = null;
    }
    if (celebrationTimeoutRef.current) {
      clearTimeout(celebrationTimeoutRef.current);
      celebrationTimeoutRef.current = null;
    }
  };

  // Loading overlay during update
  if (isUpdating) {
    return (
      <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center">
        <div className="text-center px-6 max-w-md">
          <div className="mb-6 animate-pulse">
            <Sparkles className="h-16 w-16 mx-auto text-blue-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-3" data-testid="text-updating-title">
            ✨ Sit tight while we add exciting new things to The Link...
          </h2>
          <div className="flex justify-center gap-2 mt-6 mb-8">
            <div className="w-3 h-3 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-3 h-3 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-3 h-3 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
          <Button
            onClick={handleCancelUpdate}
            variant="outline"
            className="bg-white/10 hover:bg-white/20 text-white border-white/30"
            data-testid="button-cancel-update"
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  // Update failed message
  if (updateFailed) {
    return (
      <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="bg-white dark:bg-gray-800 border border-red-200 dark:border-red-700 rounded-lg shadow-lg p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100" data-testid="text-update-failed-title">
                Update Delayed
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1" data-testid="text-update-failed-message">
                The update is taking longer than expected. Please try again or refresh the page manually.
              </p>
            </div>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              aria-label="Close"
              data-testid="button-close-failed"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleUpdate}
              className="flex-1"
              data-testid="button-retry-update"
            >
              Try Again
            </Button>
            <Button
              onClick={handleClose}
              variant="outline"
              className="flex-1"
              data-testid="button-close-update-failed"
            >
              Close
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Celebration message after update
  if (showCelebration) {
    return (
      <div className="fixed inset-0 z-[9998] pointer-events-none flex items-center justify-center">
        <div className="pointer-events-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-2xl shadow-2xl p-6 max-w-md mx-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-6 w-6" />
                  <h3 className="text-xl font-bold" data-testid="text-celebration-title">
                    Welcome Back!
                  </h3>
                </div>
                <p className="text-blue-50" data-testid="text-celebration-message">
                  You're now running the latest version of The Link with new features and improvements! 🎉
                </p>
              </div>
              <button
                onClick={handleCloseCelebration}
                className="text-white/80 hover:text-white transition-colors ml-2"
                aria-label="Close"
                data-testid="button-close-celebration"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Update available notification
  if (!updateAvailable) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100" data-testid="text-update-title">
              Update Available
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1" data-testid="text-update-message">
              A new version of the app is available. Update now to get the latest features and improvements.
            </p>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            aria-label="Close"
            data-testid="button-close-update"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleUpdate}
            className="flex-1"
            data-testid="button-update-now"
          >
            Update Now
          </Button>
          <Button
            onClick={handleClose}
            variant="outline"
            className="flex-1"
            data-testid="button-later"
          >
            Later
          </Button>
        </div>
      </div>
    </div>
  );
}
