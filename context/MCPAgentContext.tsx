// context/MCPAgentContext.tsx
import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { ChatCompletionMessageParam } from 'groq-sdk/resources/chat/completions';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';

interface MCPAgentContextType {
  isAgentOpen: boolean;
  setIsAgentOpen: (isOpen: boolean) => void;
  conversationHistory: ChatCompletionMessageParam[];
  setConversationHistory: (history: ChatCompletionMessageParam[]) => void;
  sessionId: string;
  resetConversation: () => void;
  saveConversation: (name: string) => Promise<boolean>;
  loadConversation: (sessionId: string) => Promise<void>;
  getSavedConversations: () => Promise<{ id: number; session_id: string; name: string; }[]>;
  deleteSavedConversation: (sessionId: string) => Promise<boolean>;
}

const MCPAgentContext = createContext<MCPAgentContextType | undefined>(undefined);

export const MCPAgentProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isAgentOpen, setIsAgentOpen] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<ChatCompletionMessageParam[]>([]);
  const [sessionId, setSessionId] = useState<string>(uuidv4());

  // Carregar histórico da sessão ao iniciar
  useEffect(() => {
    const loadSessionHistory = async () => {
      const savedSessionId = localStorage.getItem('mcpAgentSessionId');
      if (savedSessionId) {
        setSessionId(savedSessionId);
        try {
          const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/mcp-history?sessionId=${savedSessionId}`);
          if (response.data && response.data.history) {
            setConversationHistory(response.data.history);
          }
        } catch (error) {
          console.error('Erro ao carregar histórico da sessão:', error);
          // Se falhar, iniciar uma nova sessão
          resetConversation();
        }
      } else {
        localStorage.setItem('mcpAgentSessionId', sessionId);
      }
    };
    loadSessionHistory();
  }, []); // Executa apenas uma vez ao montar

  // Salvar histórico da sessão no localStorage (opcional, para persistência básica entre recargas)
  useEffect(() => {
    if (conversationHistory.length > 0) {
       // Salvamento no localStorage pode ser pesado para histórico longo.
       // Considere salvar apenas o sessionId ou usar IndexedDB/API de backend para persistência real.
       // localStorage.setItem(`mcpAgentHistory_${sessionId}`, JSON.stringify(conversationHistory));
    }
  }, [conversationHistory, sessionId]);


  const resetConversation = () => {
    const newSessionId = uuidv4();
    setSessionId(newSessionId);
    setConversationHistory([]);
    localStorage.setItem('mcpAgentSessionId', newSessionId);
    // Limpar histórico antigo do localStorage se estiver sendo usado
    // const oldSessionId = localStorage.getItem('mcpAgentSessionId');
    // if (oldSessionId) localStorage.removeItem(`mcpAgentHistory_${oldSessionId}`);
  };

  const saveConversation = async (name: string): Promise<boolean> => {
      try {
          const token = localStorage.getItem('token'); // Assumindo que o token está no localStorage
          if (!token) {
              console.error("Usuário não autenticado.");
              return false;
          }
          const response = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/api/mcp-saved-conversations`, {
              sessionId: sessionId,
              name: name,
              history: conversationHistory // Salva o histórico junto
          }, {
              headers: { Authorization: `Bearer ${token}` }
          });
          console.log("Conversa salva:", response.data);
          return true;
      } catch (error: any) {
          console.error("Erro ao salvar conversa:", error.response?.data || error.message);
          return false;
      }
  };

  const loadConversation = async (targetSessionId: string): Promise<void> => {
      try {
          const token = localStorage.getItem('token');
          if (!token) {
              console.error("Usuário não autenticado.");
              return;
          }
          const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/mcp-saved-conversations/${targetSessionId}`, {
              headers: { Authorization: `Bearer ${token}` }
          });
          if (response.data && response.data.history) {
              setSessionId(targetSessionId);
              setConversationHistory(response.data.history);
              localStorage.setItem('mcpAgentSessionId', targetSessionId); // Define como sessão ativa
              console.log(`Conversa '${response.data.name}' carregada.`);
          }
      } catch (error: any) {
          console.error("Erro ao carregar conversa:", error.response?.data || error.message);
          // Opcional: resetar para nova conversa em caso de falha
          // resetConversation();
      }
  };

  const getSavedConversations = async (): Promise<{ id: number; session_id: string; name: string; }[]> => {
       try {
            const token = localStorage.getItem('token');
            if (!token) {
                console.error("Usuário não autenticado.");
                return [];
            }
            const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/mcp-saved-conversations`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            return response.data.conversations || [];
       } catch (error: any) {
           console.error("Erro ao buscar conversas salvas:", error.response?.data || error.message);
           return [];
       }
  };

  const deleteSavedConversation = async (targetSessionId: string): Promise<boolean> => {
      try {
          const token = localStorage.getItem('token');
          if (!token) {
              console.error("Usuário não autenticado.");
              return false;
          }
          await axios.delete(`${process.env.NEXT_PUBLIC_API_URL}/api/mcp-saved-conversations/${targetSessionId}`, {
               headers: { Authorization: `Bearer ${token}` }
          });
          console.log(`Conversa salva com session_id ${targetSessionId} deletada.`);
          // Se a conversa deletada for a sessão ativa, resetar
          if (sessionId === targetSessionId) {
              resetConversation();
          }
          return true;
      } catch (error: any) {
          console.error("Erro ao deletar conversa salva:", error.response?.data || error.message);
          return false;
      }
  };


  return (
    <MCPAgentContext.Provider value={{
      isAgentOpen, setIsAgentOpen,
      conversationHistory, setConversationHistory,
      sessionId, resetConversation,
      saveConversation, loadConversation, getSavedConversations, deleteSavedConversation
    }}>
      {children}
    </MCPAgentContext.Provider>
  );
};

// Hook customizado para usar o contexto
export const useMCPAgentContext = () => {
  const context = useContext(MCPAgentContext);
  if (context === undefined) {
    throw new Error('useMCPAgentContext must be used within a MCPAgentProvider');
  }
  return context;
};
