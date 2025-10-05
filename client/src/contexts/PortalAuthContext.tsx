import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';

interface PortalUser {
  id: string;
  clientId: string;
  email: string;
}

interface PortalAuthContextType {
  user: PortalUser | null;
  token: string | null;
  login: (jwt: string) => void;
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const PortalAuthContext = createContext<PortalAuthContextType | undefined>(undefined);

const PORTAL_TOKEN_KEY = 'portal_jwt';

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (!payload.exp) return false;
    return Date.now() >= payload.exp * 1000;
  } catch {
    return true;
  }
}

function parseTokenUser(token: string): PortalUser | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    
    // Check if token is expired
    if (payload.exp && Date.now() >= payload.exp * 1000) {
      console.log('[Portal Auth] Token expired');
      return null;
    }
    
    return {
      id: payload.userId,
      clientId: payload.clientId,
      email: payload.email
    };
  } catch (error) {
    console.error('[Portal Auth] Invalid token:', error);
    return null;
  }
}

export function PortalAuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => {
    const storedToken = localStorage.getItem(PORTAL_TOKEN_KEY);
    if (storedToken && isTokenExpired(storedToken)) {
      console.log('[Portal Auth] Removing expired token from localStorage');
      localStorage.removeItem(PORTAL_TOKEN_KEY);
      return null;
    }
    console.log('[Portal Auth] Initialized with token:', storedToken ? 'present' : 'none');
    return storedToken;
  });
  
  const [user, setUser] = useState<PortalUser | null>(() => {
    const storedToken = localStorage.getItem(PORTAL_TOKEN_KEY);
    if (!storedToken) return null;
    
    if (isTokenExpired(storedToken)) {
      console.log('[Portal Auth] Token expired on init');
      return null;
    }
    
    const parsedUser = parseTokenUser(storedToken);
    console.log('[Portal Auth] Initialized user:', parsedUser ? parsedUser.email : 'none');
    return parsedUser;
  });
  
  const [isLoading, setIsLoading] = useState(true);

  const logout = useCallback(() => {
    console.log('[Portal Auth] Logging out');
    localStorage.removeItem(PORTAL_TOKEN_KEY);
    setToken(null);
    setUser(null);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    console.log('[Portal Auth] Token changed, validating...', token ? 'present' : 'none');
    
    if (token) {
      // Check if expired
      if (isTokenExpired(token)) {
        console.log('[Portal Auth] Token is expired, logging out');
        logout();
        return;
      }
      
      const parsedUser = parseTokenUser(token);
      if (parsedUser) {
        console.log('[Portal Auth] Valid token, user:', parsedUser.email);
        setUser(parsedUser);
      } else {
        console.log('[Portal Auth] Invalid token, logging out');
        logout();
      }
    } else {
      console.log('[Portal Auth] No token, clearing user');
      setUser(null);
    }
    setIsLoading(false);
  }, [token, logout]);

  // Validate token on visibility change (PWA comes back to foreground)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('[Portal Auth] App became visible, checking token...');
        const storedToken = localStorage.getItem(PORTAL_TOKEN_KEY);
        
        if (!storedToken && token) {
          // Token was cleared from localStorage (iOS Safari PWA issue)
          console.log('[Portal Auth] Token lost from localStorage, logging out');
          logout();
        } else if (storedToken && isTokenExpired(storedToken)) {
          // Token expired while app was backgrounded
          console.log('[Portal Auth] Token expired while backgrounded');
          logout();
        } else if (storedToken && !token) {
          // Token appeared in localStorage (shouldn't happen but handle it)
          console.log('[Portal Auth] Token reappeared in localStorage');
          setToken(storedToken);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [token, logout]);

  const login = (jwt: string) => {
    console.log('[Portal Auth] Logging in');
    setIsLoading(true);
    localStorage.setItem(PORTAL_TOKEN_KEY, jwt);
    setToken(jwt);
  };

  return (
    <PortalAuthContext.Provider
      value={{
        user,
        token,
        login,
        logout,
        isAuthenticated: !!token && !!user,
        isLoading
      }}
    >
      {children}
    </PortalAuthContext.Provider>
  );
}

export function usePortalAuth() {
  const context = useContext(PortalAuthContext);
  if (context === undefined) {
    throw new Error('usePortalAuth must be used within a PortalAuthProvider');
  }
  return context;
}
