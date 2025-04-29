import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from 'react';
import axios from 'axios';
import { Message } from '@/types/chat'; // Importe a interface Message

interface MCPAgentContextType {
  messages: Message[];
  input: string;
  handleInputChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleSubmit: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
  isLoading: boolean;
  error: Error | null;
  isHistoryLoading: boolean;
  loadHistory: () => Promise<void>;
  clearHistory: () => void;
  saveConversation: (name: string) => Promise<void>;
  loadSavedConversation: (id: number) => Promise<void>;
  savedConversations: { id: number; name: string; created_at: string }[];
  deleteConversation: (id: number) => Promise<void>;
}

const MCPAgentContext = createContext<MCPAgentContextType | undefined>(
  undefined
);

export const MCPAgentProvider = ({ children }: { children: ReactNode }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [savedConversations, setSavedConversations] = useState<
    { id: number; name: string; created_at: string }[]
  >([]);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setInput(event.target.value);
  };

  const processMessage = useCallback(async (userMessage: string) => {
    setIsLoading(true);
    setError(null);

    const newMessage: Message = {
      id: Math.random().toString(36).substring(7),
      role: 'user',
      content: userMessage,
    };
    setMessages((prevMessages) => [...prevMessages, newMessage]);
    setInput('');

    try {
      const response = await axios.post('/api/mcp-agent', {
        message: userMessage,
        history: messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
      });

      const agentResponse: Message = {
        id: Math.random().toString(36).substring(7),
        role: 'assistant',
        content: response.data.reply,
      };
      setMessages((prevMessages) => [...prevMessages, agentResponse]);
    } catch (err) {
      console.error('Error sending message to MCP Agent:', err);
      setError(err as Error);
      setMessages((prevMessages) => [
        ...prevMessages,
        {
          id: Math.random().toString(36).substring(7),
          role: 'assistant',
          content: 'Desculpe, ocorreu um erro ao processar sua solicitação.',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [messages]); // Adicione messages como dependência para que o histórico seja atualizado

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (input.trim()) {
        await processMessage(input);
      }
    },
    [input, processMessage]
  );

  const loadHistory = useCallback(async () => {
    setIsHistoryLoading(true);
    try {
      const historyResponse = await axios.get('/api/mcp-history');
      setMessages(historyResponse.data.history);
      const savedResponse = await axios.get('/api/mcp-saved-conversations');
      setSavedConversations(savedResponse.data.conversations);
    } catch (err) {
      console.error('Error loading MCP history:', err);
      // Opcional: setError para exibir no frontend
    } finally {
      setIsHistoryLoading(false);
    }
  }, []); // Sem dependências, pois carrega o estado inicial

  const clearHistory = useCallback(async () => {
    setIsHistoryLoading(true);
    try {
      await axios.delete('/api/mcp-history');
      setMessages([]);
    } catch (err) {
      console.error('Error clearing MCP history:', err);
      // Opcional: setError
    } finally {
      setIsHistoryLoading(false);
    }
  }, []); // Sem dependências

  const saveConversation = useCallback(
    async (name: string) => {
      if (messages.length === 0) return;
      try {
        await axios.post('/api/mcp-saved-conversations', { name, messages });
        // Recarregar lista de conversas salvas após salvar
        const savedResponse = await axios.get('/api/mcp-saved-conversations');
        setSavedConversations(savedResponse.data.conversations);
      } catch (err) {
        console.error('Error saving conversation:', err);
        // Opcional: setError
      }
    },
    [messages]
  ); // Depende de messages

  const loadSavedConversation = useCallback(async (id: number) => {
    setIsHistoryLoading(true);
    try {
      const response = await axios.get(`/api/mcp-saved-conversations/${id}`);
      setMessages(response.data.conversation.messages);
    } catch (err) {
      console.error('Error loading saved conversation:', err);
      // Opcional: setError
    } finally {
      setIsHistoryLoading(false);
    }
  }, []); // Sem dependências específicas além do ID

  const deleteConversation = useCallback(async (id: number) => {
    try {
      await axios.delete(`/api/mcp-saved-conversations/${id}`);
      // Remover da lista local após excluir
      setSavedConversations(prev => prev.filter(conv => conv.id !== id));
    } catch (err) {
      console.error('Error deleting conversation:', err);
      // Opcional: setError
    }
  }, []); // Sem dependências específicas além do ID


  return (
    <MCPAgentContext.Provider
      value={{
        messages,
        input,
        handleInputChange,
        handleSubmit,
        isLoading,
        error,
        isHistoryLoading,
        loadHistory,
        clearHistory,
        saveConversation,
        loadSavedConversation,
        savedConversations,
        deleteConversation,
      }}
    >
      {children}
    </MCPAgentContext.Provider>
  );
};

// Hook para usar o contexto
export const useMCPAgent = () => {
  const context = useContext(MCPAgentContext);
  if (context === undefined) {
    throw new Error('useMCPAgent must be used within a MCPAgentProvider');
  }
  return context;
};
