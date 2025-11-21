import { UAParser } from 'ua-parser-js';
import geoip from 'geoip-lite';
import type { Request } from 'express';

export interface SessionMetadata {
  ipAddress: string | null;
  city: string | null;
  country: string | null;
  browser: string | null;
  device: string | null;
  os: string | null;
  platformType: 'desktop' | 'mobile' | 'tablet' | null;
}

export function getClientIp(req: Request): string | null {
  // Check various headers for client IP (considering proxies)
  const forwarded = req.headers['x-forwarded-for'];
  const realIp = req.headers['x-real-ip'];
  
  if (forwarded) {
    const ips = (typeof forwarded === 'string' ? forwarded : forwarded[0]).split(',');
    return ips[0].trim();
  }
  
  if (realIp) {
    return typeof realIp === 'string' ? realIp : realIp[0];
  }
  
  return req.socket.remoteAddress || null;
}

export function parseUserAgent(userAgent: string | undefined): Pick<SessionMetadata, 'browser' | 'device' | 'os' | 'platformType'> {
  if (!userAgent) {
    return {
      browser: null,
      device: null,
      os: null,
      platformType: null,
    };
  }

  const parser = new UAParser(userAgent);
  const result = parser.getResult();

  // Format browser info
  const browser = result.browser.name && result.browser.version
    ? `${result.browser.name} ${result.browser.version.split('.')[0]}`
    : result.browser.name || null;

  // Format OS info
  const os = result.os.name && result.os.version
    ? `${result.os.name} ${result.os.version}`
    : result.os.name || null;

  // Determine device type
  const device = result.device.type || 'Desktop';
  
  // Determine platform type
  let platformType: 'desktop' | 'mobile' | 'tablet' | null = null;
  if (result.device.type === 'mobile') {
    platformType = 'mobile';
  } else if (result.device.type === 'tablet') {
    platformType = 'tablet';
  } else {
    platformType = 'desktop';
  }

  return {
    browser,
    device: device.charAt(0).toUpperCase() + device.slice(1),
    os,
    platformType,
  };
}

export function getGeoLocation(ipAddress: string | null): Pick<SessionMetadata, 'city' | 'country'> {
  if (!ipAddress) {
    return { city: null, country: null };
  }

  // Skip geolocation for local/private IPs
  if (
    ipAddress === '::1' ||
    ipAddress === '127.0.0.1' ||
    ipAddress.startsWith('192.168.') ||
    ipAddress.startsWith('10.') ||
    ipAddress.startsWith('172.')
  ) {
    return { city: 'Local', country: 'Local' };
  }

  const geo = geoip.lookup(ipAddress);
  
  if (!geo) {
    return { city: null, country: null };
  }

  return {
    city: geo.city || null,
    country: geo.country || null,
  };
}

export function extractSessionMetadata(req: Request): SessionMetadata {
  const ipAddress = getClientIp(req);
  const userAgentData = parseUserAgent(req.headers['user-agent']);
  const geoData = getGeoLocation(ipAddress);

  return {
    ipAddress,
    ...userAgentData,
    ...geoData,
  };
}
