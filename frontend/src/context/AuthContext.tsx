import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { User } from '../types/index.ts';
import { authApi, tokenStorage, getErrorMessage } from '../services/api.ts';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isDemo: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  loginWithGoogle: (credential: string) => Promise<void>;
  loginAsDemo: () => Promise<void>;
  register: (username: string, password: string, email?: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(tokenStorage.get());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Load user profile on startup if token exists
  useEffect(() => {
    let isMounted = true;

    async function initializeAuth() {
      const savedToken = tokenStorage.get();
      if (!savedToken) {
        if (isMounted) {
          setIsLoading(false);
        }
        return;
      }

      try {
        const userData = await authApi.getMe();
        if (isMounted) {
          setUser(userData);
          setToken(savedToken);
        }
      } catch (error) {
        console.warn('Session expired or invalid token:', getErrorMessage(error));
        tokenStorage.clear();
        if (isMounted) {
          setUser(null);
          setToken(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    initializeAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = async (username: string, password: string) => {
    setIsLoading(true);
    try {
      const authRes = await authApi.login({ username, password });
      tokenStorage.set(authRes.access_token);
      setToken(authRes.access_token);
      const userData = await authApi.getMe();
      setUser(userData);
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithGoogle = async (credential: string) => {
    setIsLoading(true);
    try {
      const authRes = await authApi.loginWithGoogle(credential);
      tokenStorage.set(authRes.access_token);
      setToken(authRes.access_token);
      const userData = await authApi.getMe();
      setUser(userData);
    } finally {
      setIsLoading(false);
    }
  };

  const loginAsDemo = async () => {
    setIsLoading(true);
    try {
      const authRes = await authApi.loginAsDemo();
      tokenStorage.set(authRes.access_token);
      setToken(authRes.access_token);
      const userData = await authApi.getMe();
      setUser(userData);
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (username: string, password: string, email?: string) => {
    setIsLoading(true);
    try {
      const authRes = await authApi.register({ username, password, email });
      tokenStorage.set(authRes.access_token);
      setToken(authRes.access_token);
      const userData = await authApi.getMe();
      setUser(userData);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    tokenStorage.clear();
    setToken(null);
    setUser(null);
  };

  const refreshUser = async () => {
    try {
      const userData = await authApi.getMe();
      setUser(userData);
    } catch {
      logout();
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isDemo: !!user?.is_demo,
        isLoading,
        login,
        loginWithGoogle,
        loginAsDemo,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
