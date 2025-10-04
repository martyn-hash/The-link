const PORTAL_TOKEN_KEY = 'portal_jwt';

function getPortalToken(): string | null {
  return localStorage.getItem(PORTAL_TOKEN_KEY);
}

async function portalRequest(url: string, options: RequestInit = {}) {
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
  });

  if (response.status === 401) {
    localStorage.removeItem(PORTAL_TOKEN_KEY);
    window.location.href = '/portal/login';
    throw new Error('Unauthorized');
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || 'Request failed');
  }

  return response.json();
}

export const portalApi = {
  auth: {
    requestMagicLink: (email: string) =>
      fetch('/api/portal/auth/request-magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      }).then(res => res.json()),

    verifyMagicLink: (token: string) =>
      fetch(`/api/portal/auth/verify?token=${token}`)
        .then(res => res.json()),
  },

  threads: {
    list: (status?: string) =>
      portalRequest(`/api/portal/threads${status ? `?status=${status}` : ''}`),

    get: (threadId: string) =>
      portalRequest(`/api/portal/threads/${threadId}`),

    create: (topic: string, projectId?: string, serviceId?: string) =>
      portalRequest('/api/portal/threads', {
        method: 'POST',
        body: JSON.stringify({ topic, projectId, serviceId }),
      }),

    markRead: (threadId: string) =>
      portalRequest(`/api/portal/threads/${threadId}/mark-read`, {
        method: 'PUT',
      }),
  },

  messages: {
    list: (threadId: string) =>
      portalRequest(`/api/portal/threads/${threadId}/messages`),

    send: (threadId: string, content: string) =>
      portalRequest(`/api/portal/threads/${threadId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content }),
      }),
  },

  unreadCount: () =>
    portalRequest('/api/portal/unread-count'),
};
