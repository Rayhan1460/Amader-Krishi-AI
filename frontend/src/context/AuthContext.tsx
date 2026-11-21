import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from 'react';
import axios from 'axios';
import type { AuthResponse, User } from '../types/index.ts';
import { authApi, tokenStorage } from '../services/api.ts';

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
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const authOperation = useRef(0);

  useEffect(() => {
    const operation = ++authOperation.current;
    const savedToken = tokenStorage.get();

    async function restoreSession() {
      try {
        if (!savedToken) return;
        const profile = await authApi.getMe(savedToken);
        if (operation !== authOperation.current) return;
        setUser(profile);
        setToken(savedToken);
      } catch (error) {
        if (operation !== authOperation.current) return;
        if (axios.isAxiosError(error) && error.response?.status === 401) tokenStorage.clear();
        setUser(null);
        setToken(null);
      } finally {
        if (operation === authOperation.current) setIsLoading(false);
      }
    }

    void restoreSession();
    return () => { ++authOperation.current; };
  }, []);

  async function signIn(request: () => Promise<AuthResponse>) {
    const operation = ++authOperation.current;
    setIsLoading(true);
    try {
      const result = await request();
      const profile = await authApi.getMe(result.access_token);
      if (operation !== authOperation.current) return;
      tokenStorage.set(result.access_token);
      setToken(result.access_token);
      setUser(profile);
    } finally {
      if (operation === authOperation.current) setIsLoading(false);
    }
  }

  const login = (username: string, password: string) => signIn(() => authApi.login({ username, password }));
  const loginWithGoogle = (credential: string) => signIn(() => authApi.loginWithGoogle(credential));
  const loginAsDemo = () => signIn(() => authApi.loginAsDemo());
  const register = (username: string, password: string, email?: string) =>
    signIn(() => authApi.register({ username, password, email }));

  const logout = () => {
    ++authOperation.current;
    tokenStorage.clear();
    setToken(null);
    setUser(null);
    setIsLoading(false);
  };

  const refreshUser = async () => {
    if (!token) return;
    const operation = authOperation.current;
    try {
      const profile = await authApi.getMe(token);
      if (operation === authOperation.current) setUser(profile);
    } catch (error) {
      if (operation === authOperation.current && axios.isAxiosError(error) && error.response?.status === 401) logout();
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
