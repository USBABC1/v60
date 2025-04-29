// context/MCPAgentContext.tsx
import React, { createContext, useState, useContext, ReactNode, useMemo, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { useRouter } from 'next/router';
import { useAuth } from './AuthContext'; // Importar useAuth para obter o token/userId

// Definir tipos
interface Message { id: string; role: 'system' | 'user' | 'assistant' | 'tool' | 'function'; content: string | null; tool_call_id?: string | null; name?: string | null; }
interface SavedConversation { id: number; user_id: number; session_id: string; name: string; created_at: string; }

interface MCPAgentContextType {
  isAgentPanelOpen: boolean;
  toggleAgentPanel: () => void;
  messages: Message[];
  sendMessage: (message: string, context: { path: string }) => Promise<void>;
  isLoading: boolean; // Loading de envio de mensagem
  isHistoryLoading: boolean; // Loading de histórico (fetch/delete)
  sessionId: string;
  startNewConversation: () => void;
  // Funcionalidades de Salvar/Carregar/Deletar Conversas Salvas
  savedConversations: SavedConversation[];
  isSavedConversationsLoading: boolean; // Loading da lista de conversas salvas
  fetchSavedConversations: () => Promise<void>; // Função para buscar a lista
  saveCurrentConversation: (name: string) => Promise<void>; // Função para salvar a conversa atual
  loadSavedConversation: (savedConversationId: number) => Promise<void>; // Função para carregar uma conversa salva
  deleteSavedConversation: (savedConversationId: number) => Promise<void>; // Função para deletar uma conversa salva (por ID)
  deleteCurrentConversationHistory: () => Promise<void>; // Função para deletar o histórico da conversa ATUAL
}

const MCPAgentContext = createContext<MCPAgentContextType | undefined>(undefined);

// ADICIONADO: Interface para as props do Provider
interface MCPAgentProviderProps {
    children: ReactNode;
    // userId já é obtido dentro do contexto via useAuth, não precisa passar como prop
    // userId: number | null;
}

export const useMCPAgentContext = () => {
  const context = useContext(MCPAgentContext);
  if (context === undefined) {
    throw new Error('useMCPAgentContext must be used within a MCPAgentProvider');
  }
  return context;
};

// ADICIONADO: Não receber userId nas props, obter via useAuth
export const MCPAgentProvider: React.FC<MCPAgentProviderProps> = ({ children }) => {
  const { user, token } = useAuth(); // Obter user e token do AuthContext
  const userId = user?.id ?? null; // Obter o ID do usuário

  const [isAgentPanelOpen, setIsAgentPanelOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [savedConversations, setSavedConversations] = useState<SavedConversation[]>([]);
  const [isSavedConversationsLoading, setIsSavedConversationsLoading] = useState(false);

  const router = useRouter();
  const [sessionId, setSessionId] = useState<string>(() => {
      if (typeof window !== 'undefined') {
          const savedSessionId = localStorage.getItem('currentMcpSessionId');
          if (savedSessionId) return savedSessionId;
      }
      return uuidv4();
  });

  // Efeito para carregar histórico quando sessionId muda
  useEffect(() => {
      const fetchHistory = async () => {
          setIsHistoryLoading(true);
          setMessages([]);
          try {
              const response = await axios.get(`/api/mcp-history?sessionId=${sessionId}`);
              const historyMessages: Message[] = response.data.map((msg: any) => ({
                  id: uuidv4(),
                  role: msg.role,
                  content: msg.content,
                  tool_call_id: msg.tool_call_id,
                  name: msg.name,
              }));
              setMessages(historyMessages);
          } catch (error) {
              console.error(`[MCP Context] Erro ao carregar histórico para ${sessionId}:`, error);
              setMessages([{ id: uuidv4(), role: 'assistant', content: "Erro ao carregar histórico da conversa." }]);
          } finally {
              setIsHistoryLoading(false);
          }
      };
      fetchHistory();
  }, [sessionId]);

  // Efeito para carregar conversas salvas quando o usuário autentica ou o painel abre
  useEffect(() => {
      // Carrega apenas se autenticado E o painel estiver aberto
      if (userId !== null && isAgentPanelOpen) {
          fetchSavedConversations();
      } else if (userId === null) {
          setSavedConversations([]);
      }
  }, [userId, isAgentPanelOpen]); // Depende de userId e isAgentPanelOpen

  const toggleAgentPanel = () => {
    setIsAgentPanelOpen(prev => !prev);
  };

  const sendMessage = async (message: string, context: { path: string }) => {
      if (!message.trim() || isLoading) return;

      const userMessage: Message = { id: uuidv4(), role: 'user', content: message };
      setMessages(prev => [...prev, userMessage]);
      setIsLoading(true);

      try {
          const response = await axios.post('/api/mcp-agent', { message, context }, {
              headers: { 'X-Session-ID': sessionId }
          });

          const agentResponse: { response: string; action?: any } = response.data;

          const assistantMessage: Message = { id: uuidv4(), role: 'assistant', content: agentResponse.response };
          setMessages(prev => [...prev, assistantMessage]);

          if (agentResponse.action?.type === 'navigate' && agentResponse.action.payload?.path) {
              router.push(agentResponse.action.payload.path);
          }

      } catch (error) {
          console.error("[MCP Context] Erro ao enviar mensagem para o agente:", error);
          setMessages(prev => [...prev, { id: uuidv4(), role: 'assistant', content: "Desculpe, houve um erro ao processar sua solicitação." }]);
      } finally {
          setIsLoading(false);
      }
  };

  const startNewConversation = () => {
      console.log("[MCP Context] Iniciando nova conversa...");
      const newSessionId = uuidv4();
      setSessionId(newSessionId);
      setMessages([]);
      if (typeof window !== 'undefined') {
          localStorage.setItem('currentMcpSessionId', newSessionId);
      }
      // O histórico para a nova sessão será carregado pelo useEffect
  };

  // Implementar fetchSavedConversations
  const fetchSavedConversations = async () => {
      if (userId === null || !token) { // Precisa de token para autenticar no backend
          setSavedConversations([]);
          return;
      }
      setIsSavedConversationsLoading(true);
      try {
          const response = await axios.get<SavedConversation[]>('/api/mcp-saved-conversations', {
              headers: { Authorization: `Bearer ${token}` } // Enviar token no header
          });
          setSavedConversations(response.data);
      } catch (error) {
          console.error("[MCP Context] Erro ao buscar conversas salvas:", error);
          setSavedConversations([]);
      } finally {
          setIsSavedConversationsLoading(false);
      }
  };

  // Implementar saveCurrentConversation
  const saveCurrentConversation = async (name: string) => {
      if (userId === null || !token || !sessionId || !name.trim()) {
          console.warn("[MCP Context] Não é possível salvar: Usuário não autenticado, sem token, sem Session ID ou nome vazio.");
          // Opcional: Mostrar um toast informando o usuário
          return;
      }
      setIsHistoryLoading(true); // Mostrar loading durante o salvamento
      try {
          const response = await axios.post('/api/mcp-saved-conversations', { sessionId, name }, {
              headers: { Authorization: `Bearer ${token}` } // Enviar token no header
          });
          if (response.data?.id) {
              console.log("[MCP Context] Conversa salva com sucesso:", response.data);
              fetchSavedConversations(); // Atualizar a lista
              // Opcional: Mostrar um toast de sucesso
          } else if (response.data?.success === false) {
               console.warn("[MCP Context] Falha ao salvar conversa:", response.data.message);
               // Opcional: Mostrar um toast de erro com response.data.message
          } else {
              console.error("[MCP Context] Resposta inesperada ao salvar conversa:", response.data);
              // Opcional: Mostrar um toast de erro genérico
          }
      } catch (error) {
          console.error("[MCP Context] Erro na API ao salvar conversa:", error);
           // Opcional: Mostrar um toast de erro
      } finally {
          setIsHistoryLoading(false);
      }
  };

  // Implementar loadSavedConversation
  const loadSavedConversation = async (savedConversationId: number) => {
      if (userId === null || !token || !savedConversationId) {
          console.warn("[MCP Context] Não é possível carregar: Usuário não autenticado, sem token ou sem ID da conversa salva.");
          // Opcional: Mostrar um toast
          return;
      }
      setIsHistoryLoading(true); // Mostrar loading
      try {
          // Buscar a conversa salva pelo ID para obter o session_id
          // Modificamos a API GET para aceitar ?id=...
          const response = await axios.get<SavedConversation[]>(`/api/mcp-saved-conversations?id=${savedConversationId}`, {
               headers: { Authorization: `Bearer ${token}` } // Enviar token no header
          });
           const conversationToLoad = response.data?.[0];

          if (conversationToLoad && conversationToLoad.session_id) {
              console.log(`[MCP Context] Carregando Session ID da conversa salva (ID: ${savedConversationId}): ${conversationToLoad.session_id}`);
              setSessionId(conversationToLoad.session_id); // Isso dispara o useEffect para carregar o histórico
              // Opcional: Fechar o painel após carregar
              // setIsAgentPanelOpen(false);
              // Opcional: Mostrar um toast de sucesso
          } else {
              console.warn("[MCP Context] Conversa salva não encontrada ou sem Session ID.");
              setMessages(prev => [...prev, { id: uuidv4(), role: 'assistant', content: "Conversa salva não encontrada ou inválida." }]);
          }
      } catch (error) {
          console.error("[MCP Context] Erro na API ao carregar conversa salva:", error);
           setMessages(prev => [...prev, { id: uuidv4(), role: 'assistant', content: "Erro ao comunicar com o servidor para carregar a conversa." }]);
      } finally {
          setIsHistoryLoading(false);
      }
  };

  // Implementar deleteSavedConversation (operando por ID)
  const deleteSavedConversation = async (savedConversationId: number) => {
      if (userId === null || !token || !savedConversationId) {
          console.warn("[MCP Context] Não é possível deletar: Usuário não autenticado, sem token ou sem ID da conversa salva.");
          // Opcional: Mostrar um toast
          return;
      }
      setIsSavedConversationsLoading(true); // Mostrar loading na lista
      try {
          const response = await axios.delete(`/api/mcp-saved-conversations?savedConversationId=${savedConversationId}`, {
               headers: { Authorization: `Bearer ${token}` } // Enviar token no header
          });
          if (response.data?.success) {
              console.log(`[MCP Context] Conversa salva (ID: ${savedConversationId}) deletada.`);
              setSavedConversations(prev => prev.filter(conv => conv.id !== savedConversationId)); // Remover da lista localmente

              // Se a conversa deletada for a conversa ATUAL, iniciar uma nova conversa
              const currentSavedConv = savedConversations.find(conv => conv.session_id === sessionId);
              if (currentSavedConv?.id === savedConversationId) {
                   console.log("[MCP Context] A conversa atual foi deletada. Iniciando nova conversa.");
                   startNewConversation(); // Inicia nova sessão
              }
              // Opcional: Mostrar um toast de sucesso

          } else if (response.data?.success === false) {
               console.warn("[MCP Context] Falha ao deletar conversa salva:", response.data.message);
               // Opcional: Mostrar um toast de erro com response.data.message
          } else {
               console.error("[MCP Context] Resposta inesperada ao deletar conversa salva:", response.data);
               // Opcional: Mostrar um toast de erro genérico
          }
      } catch (error) {
          console.error("[MCP Context] Erro na API ao deletar conversa salva:", error);
           // Opcional: Mostrar um toast de erro
      } finally {
          setIsSavedConversationsLoading(false);
      }
  };

  // Implementar deleteCurrentConversationHistory
   const deleteCurrentConversationHistory = async () => {
       if (!sessionId || messages.length === 0 || !token) { // Precisa de token para autenticar
           console.warn("[MCP Context] Não é possível deletar histórico: Sem Session ID, sem mensagens ou sem token.");
           // Opcional: Mostrar um toast
           return;
       }
       console.log(`[MCP Context] Deletando histórico para Session ID: ${sessionId}`);
       setIsHistoryLoading(true); // Mostrar loading
       try {
           const response = await axios.delete(`/api/mcp-history?sessionId=${sessionId}`, {
                headers: { Authorization: `Bearer ${token}` } // Enviar token no header
           });
           if (response.data?.success) {
               console.log("[MCP Context] Histórico deletado com sucesso.");
               setMessages([]); // Limpa as mensagens locais
               // Opcional: Mostrar um toast de sucesso
           } else {
               console.warn("[MCP Context] Falha ao deletar histórico:", response.data);
                setMessages(prev => [...prev[0] ? [prev[0]] : [], { id: uuidv4(), role: 'assistant', content: "Falha ao deletar o histórico." }]); // Manter apenas a primeira mensagem se houver erro
           }
       } catch (error) {
           console.error("[MCP Context] Erro na API ao deletar histórico:", error);
            setMessages(prev => [...prev[0] ? [prev[0]] : [], { id: uuidv4(), role: 'assistant', content: "Erro ao comunicar com o servidor para deletar o histórico." }]);
       } finally {
           setIsHistoryLoading(false);
       }
   };


  const value = useMemo(() => ({
    isAgentPanelOpen, toggleAgentPanel, messages, sendMessage, isLoading, isHistoryLoading, sessionId,
    startNewConversation,
    // Funções de Salvar/Carregar/Deletar Conversas Salvas
    savedConversations, isSavedConversationsLoading, fetchSavedConversations,
    saveCurrentConversation, loadSavedConversation, deleteSavedConversation,
    deleteCurrentConversationHistory
  }), [isAgentPanelOpen, messages, isLoading, isHistoryLoading, sessionId, savedConversations, isSavedConversationsLoading, fetchSavedConversations, saveCurrentConversation, loadSavedConversation, deleteSavedConversation, deleteCurrentConversationHistory]); // ADICIONADO todas as dependências relevantes

  return (
    <MCPAgentContext.Provider value={value}>
      {children}
    </MCPAgentContext.Provider>
  );
};
