const PORTAL_TOKEN_KEY = 'portal_jwt';

function getPortalToken(): string | null {
  try {
    // Try localStorage first
    let token = localStorage.getItem(PORTAL_TOKEN_KEY);
    
    // Fallback to sessionStorage if localStorage fails (iOS Safari PWA issue)
    if (!token) {
      token = sessionStorage.getItem(PORTAL_TOKEN_KEY);
      if (token) {
        console.log('[Portal API] Token recovered from sessionStorage');
        localStorage.setItem(PORTAL_TOKEN_KEY, token);
      }
    }
    
    return token;
  } catch (error) {
    console.error('[Portal API] Failed to get token:', error);
    return null;
  }
}

function removePortalToken() {
  try {
    localStorage.removeItem(PORTAL_TOKEN_KEY);
    sessionStorage.removeItem(PORTAL_TOKEN_KEY);
  } catch (error) {
    console.error('[Portal API] Failed to remove token:', error);
  }
}

export async function portalRequest(method: string, url: string, data?: unknown): Promise<any> {
  const token = getPortalToken();
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: 'include',
  });

  if (response.status === 401) {
    removePortalToken();
    window.location.href = '/portal/login';
    throw new Error('Unauthorized');
  }

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = 'Request failed';
    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.message || errorJson.error || errorText;
    } catch {
      errorMessage = errorText || 'Request failed';
    }
    throw new Error(errorMessage);
  }

  const text = await response.text();
  if (!text) return null;
  
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// Legacy internal function for portalApi methods
async function portalRequestLegacy(url: string, options: RequestInit = {}) {
  const token = getPortalToken();
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (response.status === 401) {
    removePortalToken();
    window.location.href = '/portal/login';
    throw new Error('Unauthorized');
  }

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = 'Request failed';
    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.message || errorJson.error || errorText;
    } catch {
      errorMessage = errorText || 'Request failed';
    }
    throw new Error(errorMessage);
  }

  const text = await response.text();
  if (!text) return null;
  
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export const portalApi = {
  auth: {
    requestCode: (email: string) =>
      fetch('/api/portal/auth/request-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
        credentials: 'include',
      }).then(res => {
        if (!res.ok) throw new Error('Failed to request code');
        return res.json();
      }),

    verifyCode: (email: string, code: string) =>
      fetch('/api/portal/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
        credentials: 'include',
      }).then(res => {
        if (!res.ok) throw new Error('Failed to verify code');
        return res.json();
      }),

    // DEPRECATED: Use requestCode instead
    requestMagicLink: (email: string) =>
      fetch('/api/portal/auth/request-magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
        credentials: 'include',
      }).then(res => {
        if (!res.ok) throw new Error('Failed to request magic link');
        return res.json();
      }),

    // DEPRECATED: Use verifyCode instead
    verifyMagicLink: (token: string) =>
      fetch(`/api/portal/auth/verify?token=${token}`, {
        credentials: 'include',
      }).then(res => {
        if (!res.ok) throw new Error('Failed to verify magic link');
        return res.json();
      }),
  },

  threads: {
    list: (status?: string) =>
      portalRequestLegacy(`/api/portal/threads${status ? `?status=${status}` : ''}`),

    get: (threadId: string) =>
      portalRequestLegacy(`/api/portal/threads/${threadId}`),

    create: (topic: string, projectId?: string, serviceId?: string) =>
      portalRequestLegacy('/api/portal/threads', {
        method: 'POST',
        body: JSON.stringify({ topic, projectId, serviceId }),
      }),

    markRead: (threadId: string) =>
      portalRequestLegacy(`/api/portal/threads/${threadId}/mark-read`, {
        method: 'PUT',
      }),
  },

  messages: {
    list: (threadId: string) =>
      portalRequestLegacy(`/api/portal/threads/${threadId}/messages`),

    send: (threadId: string, content: string) =>
      portalRequestLegacy(`/api/portal/threads/${threadId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content }),
      }),
  },

  unreadCount: () =>
    portalRequestLegacy('/api/portal/unread-count'),
};
