import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Smartphone, Share, PlusSquare, MoreVertical, Download } from 'lucide-react';
import { detectDevice } from '@/lib/pwaUtils';

export default function PortalInstall() {
  const [device, setDevice] = useState<'ios' | 'android' | 'other'>('other');

  useEffect(() => {
    const deviceInfo = detectDevice();
    setDevice(deviceInfo.os);
  }, []);

  const isIOS26Plus = () => {
    if (typeof navigator === 'undefined') return false;
    const match = navigator.userAgent.match(/OS (\d+)_/);
    return match && parseInt(match[1]) >= 26;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A7BBF] via-[#0c8fd6] to-[#76CA23] flex items-center justify-center p-4">
      <Card className="w-full max-w-lg shadow-2xl border-0">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto mb-6 w-20 h-20 bg-gradient-to-br from-[#0A7BBF] to-[#76CA23] rounded-3xl flex items-center justify-center shadow-lg">
            <Smartphone className="h-10 w-10 text-white" />
          </div>
          <CardTitle className="text-3xl font-bold bg-gradient-to-r from-[#0A7BBF] to-[#76CA23] bg-clip-text text-transparent">
            Welcome to The Link
          </CardTitle>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Your secure client portal is just one tap away
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Why Install */}
          <div className="bg-gradient-to-br from-blue-50 to-green-50 dark:from-blue-950 dark:to-green-950 rounded-2xl p-6">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <Download className="h-5 w-5 text-[#0A7BBF]" />
              Why Install the App?
            </h3>
            <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
              <li className="flex items-start gap-2">
                <span className="text-[#76CA23] mt-0.5">✓</span>
                <span>Instant access from your home screen</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#76CA23] mt-0.5">✓</span>
                <span>Secure messaging with your accountant</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#76CA23] mt-0.5">✓</span>
                <span>Receive important notifications</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#76CA23] mt-0.5">✓</span>
                <span>Works offline when you need it</span>
              </li>
            </ul>
          </div>

          {/* Installation Instructions */}
          {device === 'ios' && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border-2 border-[#0A7BBF]/20">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
                Install on iPhone
              </h3>
              <ol className="space-y-4">
                <li className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-[#0A7BBF] text-white rounded-full flex items-center justify-center font-semibold text-sm">
                    1
                  </div>
                  <div className="flex-1">
                    <p className="text-gray-700 dark:text-gray-300">
                      {isIOS26Plus() ? (
                        <>
                          Tap the <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded font-medium animate-pulse">
                            <MoreVertical className="h-4 w-4" /> menu
                          </span> button in Safari
                        </>
                      ) : (
                        <>
                          Tap the <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded font-medium animate-pulse">
                            <Share className="h-4 w-4" /> Share
                          </span> button at the bottom
                        </>
                      )}
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-[#0A7BBF] text-white rounded-full flex items-center justify-center font-semibold text-sm">
                    2
                  </div>
                  <div className="flex-1">
                    <p className="text-gray-700 dark:text-gray-300">
                      Scroll down and tap <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded font-medium">
                        <PlusSquare className="h-4 w-4" /> Add to Home Screen
                      </span>
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-[#76CA23] text-white rounded-full flex items-center justify-center font-semibold text-sm">
                    3
                  </div>
                  <div className="flex-1">
                    <p className="text-gray-700 dark:text-gray-300">
                      Tap <span className="font-semibold text-[#0A7BBF]">Add</span> in the top right corner
                    </p>
                  </div>
                </li>
              </ol>
            </div>
          )}

          {device === 'android' && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border-2 border-[#0A7BBF]/20">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
                Install on Android
              </h3>
              <ol className="space-y-4">
                <li className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-[#0A7BBF] text-white rounded-full flex items-center justify-center font-semibold text-sm">
                    1
                  </div>
                  <div className="flex-1">
                    <p className="text-gray-700 dark:text-gray-300">
                      Tap the <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded font-medium animate-pulse">
                        <MoreVertical className="h-4 w-4" /> menu
                      </span> button in Chrome
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-[#0A7BBF] text-white rounded-full flex items-center justify-center font-semibold text-sm">
                    2
                  </div>
                  <div className="flex-1">
                    <p className="text-gray-700 dark:text-gray-300">
                      Tap <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded font-medium">
                        <Download className="h-4 w-4" /> Install app
                      </span> or <span className="font-medium">Add to Home screen</span>
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-[#76CA23] text-white rounded-full flex items-center justify-center font-semibold text-sm">
                    3
                  </div>
                  <div className="flex-1">
                    <p className="text-gray-700 dark:text-gray-300">
                      Tap <span className="font-semibold text-[#0A7BBF]">Install</span> to confirm
                    </p>
                  </div>
                </li>
              </ol>
            </div>
          )}

          {device === 'other' && (
            <div className="bg-amber-50 dark:bg-amber-950 rounded-2xl p-6 border-2 border-amber-200 dark:border-amber-800">
              <h3 className="font-semibold text-amber-900 dark:text-amber-100 mb-2">
                Mobile Device Required
              </h3>
              <p className="text-amber-800 dark:text-amber-200 text-sm">
                The Link client portal is optimized for mobile devices. Please scan the QR code with your phone to continue.
              </p>
            </div>
          )}

          {/* CTA */}
          <div className="pt-4 text-center space-y-3">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              After installing, open the app from your home screen to get started
            </p>
            <Button
              onClick={() => window.location.href = '/portal/login'}
              className="w-full bg-gradient-to-r from-[#0A7BBF] to-[#76CA23] hover:from-[#0A7BBF]/90 hover:to-[#76CA23]/90 text-white font-semibold py-6 text-lg shadow-lg"
              data-testid="button-skip-to-login"
            >
              Skip to Login
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
