export interface DeviceInfo {
  os: 'ios' | 'android' | 'other';
  version?: number;
  isStandalone: boolean;
  canInstall: boolean;
}

export function detectDevice(): DeviceInfo {
  const userAgent = navigator.userAgent.toLowerCase();
  const isStandalone = 
    ('standalone' in window.navigator && (window.navigator as any).standalone) || 
    window.matchMedia('(display-mode: standalone)').matches;

  // Detect iOS
  if (/iphone|ipad|ipod/.test(userAgent)) {
    // Extract iOS version
    const match = userAgent.match(/os (\d+)_/);
    const version = match ? parseInt(match[1]) : undefined;
    
    // iOS PWA support started from 11.3, but better support from 16.4+
    const canInstall = !isStandalone && version !== undefined && version >= 16;
    
    return {
      os: 'ios',
      version,
      isStandalone,
      canInstall
    };
  }

  // Detect Android
  if (/android/.test(userAgent)) {
    const match = userAgent.match(/android (\d+)/);
    const version = match ? parseInt(match[1]) : undefined;
    
    // Android has native install prompt support
    const canInstall = !isStandalone && version !== undefined && version >= 8;
    
    return {
      os: 'android',
      version,
      isStandalone,
      canInstall
    };
  }

  return {
    os: 'other',
    isStandalone,
    canInstall: false
  };
}

export function isIOSSafari(): boolean {
  const userAgent = navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod/.test(userAgent) && 
         /safari/.test(userAgent) && 
         !/chrome|crios|fxios/.test(userAgent);
}

export function shouldShowIOSInstructions(device: DeviceInfo): boolean {
  return device.os === 'ios' && device.canInstall && !device.isStandalone && isIOSSafari();
}

export function shouldShowAndroidPrompt(device: DeviceInfo): boolean {
  return device.os === 'android' && device.canInstall && !device.isStandalone;
}
