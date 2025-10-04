import { useEffect } from 'react';

/**
 * Custom hook to set portal-specific PWA manifest and restore original on cleanup.
 * Use this in all portal pages to ensure the correct manifest is loaded.
 */
export function usePortalManifest() {
  useEffect(() => {
    const manifestLink = document.querySelector('link[rel="manifest"]') as HTMLLinkElement;
    const originalHref = manifestLink?.href || '/manifest.json';
    
    if (manifestLink) {
      manifestLink.href = '/portal-manifest.json';
    } else {
      const newManifestLink = document.createElement('link');
      newManifestLink.rel = 'manifest';
      newManifestLink.href = '/portal-manifest.json';
      document.head.appendChild(newManifestLink);
    }

    // Restore original manifest on cleanup
    return () => {
      const currentManifestLink = document.querySelector('link[rel="manifest"]') as HTMLLinkElement;
      if (currentManifestLink) {
        currentManifestLink.href = originalHref;
      }
    };
  }, []);
}
