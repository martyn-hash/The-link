import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { portalRequest } from '@/lib/portalApi';
import { useQueryClient } from '@tanstack/react-query';

interface PortalUser {
  id: string;
  clientId: string;
  email: string;
}

interface AvailableCompany {
  id: string;
  name: string;
  officerRole?: string | null;
  isCurrent: boolean;
}

interface PortalAuthContextType {
  user: PortalUser | null;
  token: string | null;
  login: (jwt: string) => void;
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
  availableCompanies: AvailableCompany[];
  currentCompany: AvailableCompany | null;
  switchCompany: (clientId: string) => Promise<void>;
  loadAvailableCompanies: () => Promise<void>;
  isLoadingCompanies: boolean;
}

const PortalAuthContext = createContext<PortalAuthContextType | undefined>(undefined);

const PORTAL_TOKEN_KEY = 'portal_jwt';

// Dual storage for iOS Safari PWA persistence
function saveToken(token: string) {
  try {
    localStorage.setItem(PORTAL_TOKEN_KEY, token);
    sessionStorage.setItem(PORTAL_TOKEN_KEY, token);
    console.log('[Portal Auth] Token saved to both localStorage and sessionStorage');
  } catch (error) {
    console.error('[Portal Auth] Failed to save token:', error);
  }
}

function getToken(): string | null {
  try {
    // Try localStorage first
    let token = localStorage.getItem(PORTAL_TOKEN_KEY);
    
    // Fallback to sessionStorage if localStorage fails (iOS Safari PWA issue)
    if (!token) {
      token = sessionStorage.getItem(PORTAL_TOKEN_KEY);
      if (token) {
        console.log('[Portal Auth] Token recovered from sessionStorage, restoring to localStorage');
        localStorage.setItem(PORTAL_TOKEN_KEY, token);
      }
    }
    
    return token;
  } catch (error) {
    console.error('[Portal Auth] Failed to get token:', error);
    return null;
  }
}

function removeToken() {
  try {
    localStorage.removeItem(PORTAL_TOKEN_KEY);
    sessionStorage.removeItem(PORTAL_TOKEN_KEY);
    console.log('[Portal Auth] Token removed from both storages');
  } catch (error) {
    console.error('[Portal Auth] Failed to remove token:', error);
  }
}

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (!payload.exp) return false;
    const isExpired = Date.now() >= payload.exp * 1000;
    if (isExpired) {
      const expiryDate = new Date(payload.exp * 1000);
      console.log('[Portal Auth] Token expired at:', expiryDate.toISOString());
    }
    return isExpired;
  } catch (error) {
    console.error('[Portal Auth] Failed to check token expiry:', error);
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
  const queryClient = useQueryClient();
  const [token, setToken] = useState<string | null>(() => {
    const storedToken = getToken();
    if (storedToken && isTokenExpired(storedToken)) {
      console.log('[Portal Auth] Removing expired token on init');
      removeToken();
      return null;
    }
    console.log('[Portal Auth] Initialized with token:', storedToken ? 'present' : 'none');
    return storedToken;
  });
  
  const [user, setUser] = useState<PortalUser | null>(() => {
    const storedToken = getToken();
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
  const [availableCompanies, setAvailableCompanies] = useState<AvailableCompany[]>([]);
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(false);

  const logout = useCallback(() => {
    console.log('[Portal Auth] Logging out');
    removeToken();
    setToken(null);
    setUser(null);
    setIsLoading(false);
    setAvailableCompanies([]);
  }, []);

  const loadAvailableCompanies = useCallback(async () => {
    if (!token) {
      console.log('[Portal Auth] No token, skipping company load');
      return;
    }

    setIsLoadingCompanies(true);
    try {
      const companies = await portalRequest('GET', '/api/portal/available-companies') as AvailableCompany[];
      console.log('[Portal Auth] Loaded available companies:', companies);
      setAvailableCompanies(companies);
    } catch (error) {
      console.error('[Portal Auth] Failed to load available companies:', error);
      setAvailableCompanies([]);
    } finally {
      setIsLoadingCompanies(false);
    }
  }, [token]);

  const switchCompany = useCallback(async (clientId: string) => {
    if (!token) {
      throw new Error('Not authenticated');
    }

    try {
      console.log('[Portal Auth] Switching to company:', clientId);
      const response = await portalRequest('POST', '/api/portal/switch-company', { clientId }) as { jwt: string };
      
      // Update token and user
      saveToken(response.jwt);
      setToken(response.jwt);
      
      // Clear all queries to force refetch with new company context
      queryClient.clear();
      
      // Reload companies to update current company indicator
      await loadAvailableCompanies();
      
      console.log('[Portal Auth] Successfully switched company');
    } catch (error) {
      console.error('[Portal Auth] Failed to switch company:', error);
      throw error;
    }
  }, [token, queryClient, loadAvailableCompanies]);

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
        const storedToken = getToken();
        
        if (!storedToken && token) {
          // Token was cleared from both storages (rare but handle it)
          console.log('[Portal Auth] Token lost from storage, logging out');
          logout();
        } else if (storedToken && isTokenExpired(storedToken)) {
          // Token expired while app was backgrounded
          console.log('[Portal Auth] Token expired while backgrounded');
          logout();
        } else if (storedToken && !token) {
          // Token recovered from storage (sessionStorage fallback worked)
          console.log('[Portal Auth] Token recovered from storage');
          setToken(storedToken);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [token, logout]);

  const login = (jwt: string) => {
    console.log('[Portal Auth] Logging in with new token');
    setIsLoading(true);
    saveToken(jwt);
    setToken(jwt);
  };

  // Load available companies when user authenticates
  useEffect(() => {
    if (user && token) {
      loadAvailableCompanies();
    }
  }, [user, token, loadAvailableCompanies]);

  // Derive current company from available companies
  const currentCompany = availableCompanies.find(c => c.isCurrent) || null;

  return (
    <PortalAuthContext.Provider
      value={{
        user,
        token,
        login,
        logout,
        isAuthenticated: !!token && !!user,
        isLoading,
        availableCompanies,
        currentCompany,
        switchCompany,
        loadAvailableCompanies,
        isLoadingCompanies
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
