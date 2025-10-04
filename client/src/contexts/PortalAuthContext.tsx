import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

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

function parseTokenUser(token: string): PortalUser | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return {
      id: payload.userId,
      clientId: payload.clientId,
      email: payload.email
    };
  } catch (error) {
    console.error('Invalid token:', error);
    return null;
  }
}

export function PortalAuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem(PORTAL_TOKEN_KEY);
  });
  const [user, setUser] = useState<PortalUser | null>(() => {
    const storedToken = localStorage.getItem(PORTAL_TOKEN_KEY);
    return storedToken ? parseTokenUser(storedToken) : null;
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (token) {
      const parsedUser = parseTokenUser(token);
      if (parsedUser) {
        setUser(parsedUser);
      } else {
        logout();
      }
    } else {
      setUser(null);
    }
    setIsLoading(false);
  }, [token]);

  const login = (jwt: string) => {
    setIsLoading(true);
    localStorage.setItem(PORTAL_TOKEN_KEY, jwt);
    setToken(jwt);
  };

  const logout = () => {
    localStorage.removeItem(PORTAL_TOKEN_KEY);
    setToken(null);
    setUser(null);
    setIsLoading(false);
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
