// context/AuthContext.tsx
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react'; // <<< ADICIONADO useMemo AQUI
import { useRouter, usePathname } from 'next/navigation';
import { jwtDecode } from 'jwt-decode';

// Interfaces (como antes)
interface DecodedToken { userId: number; username: string; iat: number; exp: number; }
interface User { id: number; username: string; }
interface AuthContextProps { user: User | null; token: string | null; isAuthenticated: boolean; isLoading: boolean; login: (token: string) => void; logout: () => void; checkAuthStatus: () => void; }

const initialContextValue: AuthContextProps = {
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: true,
    login: (token: string) => { console.warn('AuthContext login called before provider setup'); },
    logout: () => { console.warn('AuthContext logout called before provider setup'); },
    checkAuthStatus: () => { console.warn('AuthContext checkAuthStatus called before provider setup'); },
};

const AuthContext = createContext<AuthContextProps>(initialContextValue);

export const useAuth = () => useContext(AuthContext);

interface AuthProviderProps { children: ReactNode; }

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const router = useRouter();
  const pathname = usePathname();

  const checkAuthStatus = useCallback(() => {
      console.log('[AuthContext DEBUG] checkAuthStatus started.');
      setIsLoading(true);
      const storedToken = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
      console.log('[AuthContext DEBUG] Stored token found:', !!storedToken);

      if (storedToken) {
          try {
              const decoded: DecodedToken = jwtDecode(storedToken);
              console.log('[AuthContext DEBUG] Token decoded:', decoded);
              const nowInSeconds = Date.now() / 1000;

              if (decoded.exp > nowInSeconds) {
                  console.log(`[AuthContext DEBUG] Token valid for ${decoded.username}. Setting state.`);
                  setUser({ id: decoded.userId, username: decoded.username });
                  setToken(storedToken);
                  setIsAuthenticated(true);
              } else {
                  console.warn('[AuthContext DEBUG] Stored token expired. Clearing.');
                  localStorage.removeItem('authToken');
                  setUser(null);
                  setToken(null);
                  setIsAuthenticated(false);
              }
          } catch (error) {
              console.error('[AuthContext DEBUG] Error decoding stored token:', error);
              localStorage.removeItem('authToken');
              setUser(null);
              setToken(null);
              setIsAuthenticated(false);
          }
      } else {
          console.log('[AuthContext DEBUG] No stored token found.');
          setUser(null);
          setToken(null);
          setIsAuthenticated(false);
      }
      console.log('[AuthContext DEBUG] checkAuthStatus finished. Setting isLoading(false).');
      setIsLoading(false);
  }, []);

  useEffect(() => {
      console.log('[AuthContext Effect] Running checkAuthStatus on mount.');
      checkAuthStatus();
  }, [checkAuthStatus]);

  const login = useCallback((newToken: string) => {
      console.log('[AuthContext DEBUG] login function called.');
      setIsLoading(true);
      try {
          if (!newToken) { throw new Error("Token inválido recebido na função login."); }
          const decoded: DecodedToken = jwtDecode(newToken);
          const nowInSeconds = Date.now() / 1000;
          if (decoded.exp <= nowInSeconds) { console.error("[AuthContext DEBUG] Token recebido já expirado."); throw new Error("Sessão expirada."); }

          console.log(`[AuthContext DEBUG] login: Setting token for ${decoded.username}.`);
          localStorage.setItem('authToken', newToken);
          setToken(newToken);
          setUser({ id: decoded.userId, username: decoded.username });
          setIsAuthenticated(true);
          console.log("[AuthContext DEBUG] login: State updated. Redirecting to / ...");
          router.push('/');

      } catch (error) {
          console.error("[AuthContext DEBUG] Error in login function:", error);
          localStorage.removeItem('authToken');
          setToken(null); setUser(null); setIsAuthenticated(false);
      } finally {
         setTimeout(() => setIsLoading(false), 50);
         console.log("[AuthContext DEBUG] login function finished, isLoading set to false.");
      }
  }, [router]);

  const logout = useCallback(() => {
    console.log('[AuthContext DEBUG] logout called.');
    setIsLoading(true);
    localStorage.removeItem('authToken');
    setToken(null); setUser(null); setIsAuthenticated(false);
    router.push('/login');
    setTimeout(() => setIsLoading(false), 50);
  }, [router]);

  useEffect(() => {
      if (!isLoading && !isAuthenticated && pathname !== '/login') {
          console.log(`[AuthContext Effect] Not authenticated, not loading, and not on /login (current: ${pathname}). Redirecting to /login.`);
          router.push('/login');
      }
  }, [isLoading, isAuthenticated, pathname, router]);

  const value = useMemo(() => ({
      user,
      token,
      isAuthenticated,
      isLoading,
      login,
      logout,
      checkAuthStatus
  }), [user, token, isAuthenticated, isLoading, login, logout, checkAuthStatus]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
