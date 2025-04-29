// context/AuthContext.tsx
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useRouter } from 'next/router';
import { jwtDecode } from 'jwt-decode'; // <<< CORRIGIDO IMPORT

// Interfaces (como antes)
interface DecodedToken { userId: number; username: string; iat: number; exp: number; }
interface User { id: number; username: string; }
interface AuthContextProps { user: User | null; isAuthenticated: boolean; isLoading: boolean; login: (token: string) => void; logout: () => void; }

const AuthContext = createContext<AuthContextProps>({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  login: () => { console.error('AuthContext: login function called before initialization'); },
  logout: () => { console.error('AuthContext: logout function called before initialization'); },
});

export const useAuth = () => useContext(AuthContext);

interface AuthProviderProps { children: ReactNode; }

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const router = useRouter();

  useEffect(() => {
    const checkToken = () => {
      console.log('[AuthContext Check] Verificando token no localStorage...');
      const token = localStorage.getItem('authToken');
      if (token) {
        try {
          const decoded: DecodedToken = jwtDecode(token); // <<< CORRIGIDO USO
          const nowInSeconds = Date.now() / 1000;

          if (decoded.exp > nowInSeconds) {
            console.log(`[AuthContext Check] Token válido para ${decoded.username}. Autenticando.`);
            setUser({ id: decoded.userId, username: decoded.username });
            setIsAuthenticated(true);
          } else {
            console.warn('[AuthContext Check] Token expirado encontrado. Removendo.');
            localStorage.removeItem('authToken');
            setIsAuthenticated(false);
            setUser(null);
          }
        } catch (error) {
          console.error('[AuthContext Check] Erro ao decodificar token:', error);
          localStorage.removeItem('authToken');
          setIsAuthenticated(false);
          setUser(null);
        }
      } else {
         console.log('[AuthContext Check] Nenhum token encontrado.');
         setIsAuthenticated(false);
         setUser(null);
      }
      console.log('[AuthContext Check] Verificação inicial concluída.');
      setIsLoading(false);
    };

    checkToken();
  }, []);

  const login = useCallback((token: string) => {
    console.log('[AuthContext login] Recebido token:', token ? 'Sim' : 'Não');
    setIsLoading(true);
    try {
      if (!token) {
        throw new Error("Token inválido recebido na função login.");
      }
      const decoded: DecodedToken = jwtDecode(token); // <<< CORRIGIDO USO
      console.log('[AuthContext login] Token decodificado:', decoded);
      const nowInSeconds = Date.now() / 1000;

      if (decoded.exp <= nowInSeconds) {
        console.error("[AuthContext Login] Token recebido expirado.");
        throw new Error("Sessão expirada.");
      }

      console.log(`[AuthContext] Autenticando ${decoded.username}...`);
      localStorage.setItem('authToken', token);
      setUser({ id: decoded.userId, username: decoded.username });
      setIsAuthenticated(true);
      console.log("[AuthContext] Estado atualizado. Redirecionando para / ...");
      router.push('/');

    } catch (error: any) {
       console.error("[AuthContext] Erro no login:", error);
       localStorage.removeItem('authToken');
       setUser(null);
       setIsAuthenticated(false);
       throw error; // Re-lança para o formulário
    } finally {
        setTimeout(() => {
            console.log("[AuthContext login] Finalizando loading no finally.");
            setIsLoading(false);
        }, 50);
    }
  }, [router]);

  const logout = useCallback(() => {
    console.log('[AuthContext] Logout acionado.');
    setIsLoading(true);
    localStorage.removeItem('authToken');
    setUser(null);
    setIsAuthenticated(false);
    setTimeout(() => {
        router.push('/login');
        setIsLoading(false);
    }, 50);
  }, [router]);

  const value = { user, isAuthenticated, isLoading, login, logout };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};