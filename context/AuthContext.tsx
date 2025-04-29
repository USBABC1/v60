// context/AuthContext.tsx
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useRouter } from 'next/router';
import { jwtDecode } from 'jwt-decode'; // <<< CORRIGIDO IMPORT

// Interfaces (como antes)
interface DecodedToken { userId: number; username: string; iat: number; exp: number; }
interface User { id: number; username: string; }
// ADICIONADO: token à interface AuthContextProps
interface AuthContextProps { user: User | null; isAuthenticated: boolean; isLoading: boolean; login: (token: string) => void; logout: () => void; token: string | null; }

const AuthContext = createContext<AuthContextProps>({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  login: () => { console.error('AuthContext: login function called before initialization'); },
  logout: () => { console.error('AuthContext: logout function called before initialization'); },
  token: null, // ADICIONADO: Valor inicial para token
});

export const useAuth = () => useContext(AuthContext);

interface AuthProviderProps { children: ReactNode; }

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [token, setToken] = useState<string | null>(null); // ADICIONADO: Estado para armazenar o token
  const router = useRouter();

  useEffect(() => {
    const checkToken = () => {
      console.log('[AuthContext Check] Verificando token no localStorage...');
      const storedToken = localStorage.getItem('authToken'); // Usar nome diferente para não conflitar com o estado 'token'
      if (storedToken) {
        try {
          const decoded: DecodedToken = jwtDecode(storedToken); // <<< CORRIGIDO USO
          const nowInSeconds = Date.now() / 1000;

          if (decoded.exp > nowInSeconds) {
            console.log(`[AuthContext Check] Token válido para ${decoded.username}. Autenticando.`);
            setUser({ id: decoded.userId, username: decoded.username });
            setIsAuthenticated(true);
            setToken(storedToken); // ADICIONADO: Salvar o token no estado
          } else {
            console.warn('[AuthContext Check] Token expirado encontrado. Removendo.');
            localStorage.removeItem('authToken');
            setIsAuthenticated(false);
            setUser(null);
            setToken(null); // ADICIONADO: Limpar o token no estado
          }
        } catch (error) {
          console.error('[AuthContext Check] Erro ao decodificar token:', error);
          localStorage.removeItem('authToken');
          setIsAuthenticated(false);
          setUser(null);
          setToken(null); // ADICIONADO: Limpar o token no estado
        }
      } else {
         console.log('[AuthContext Check] Nenhum token encontrado.');
         setIsAuthenticated(false);
         setUser(null);
         setToken(null); // ADICIONADO: Limpar o token no estado
      }
      console.log('[AuthContext Check] Verificação inicial concluída.');
      setIsLoading(false);
    };

    checkToken();
  }, []);

  const login = useCallback((newToken: string) => { // Usar nome diferente para o token recebido
    console.log('[AuthContext login] Recebido token:', newToken ? 'Sim' : 'Não');
    setIsLoading(true);
    try {
      if (!newToken) {
        throw new Error("Token inválido recebido na função login.");
      }
      const decoded: DecodedToken = jwtDecode(newToken); // <<< CORRIGIDO USO
      console.log('[AuthContext login] Token decodificado:', decoded);
      const nowInSeconds = Date.now() / 1000;

      if (decoded.exp <= nowInSeconds) {
        console.error("[AuthContext Login] Token recebido expirado.");
        throw new Error("Sessão expirada.");
      }

      console.log(`[AuthContext] Autenticando ${decoded.username}...`);
      localStorage.setItem('authToken', newToken);
      setUser({ id: decoded.userId, username: decoded.username });
      setIsAuthenticated(true);
      setToken(newToken); // ADICIONADO: Salvar o novo token no estado
      console.log("[AuthContext] Estado atualizado. Redirecionando para / ...");
      router.push('/');

    } catch (error: any) {
       console.error("[AuthContext] Erro no login:", error);
       localStorage.removeItem('authToken');
       setUser(null);
       setIsAuthenticated(false);
       setToken(null); // ADICIONADO: Limpar o token no estado
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
    setToken(null); // ADICIONADO: Limpar o token no estado
    setTimeout(() => {
        router.push('/login');
        setIsLoading(false);
    }, 50);
  }, [router]);

  // ADICIONADO: Incluir 'token' no valor fornecido pelo contexto
  const value = { user, isAuthenticated, isLoading, login, logout, token };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
