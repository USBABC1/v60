'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useMCPAgent } from '@/context/MCPAgentContext';
import { useState, useRef, useEffect } from 'react';
import ChatMessage from './ChatMessage'; // Importação default corrigida
import { Message } from '@/types/chat';

export function MCPAgent() {
  const {
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
  } = useMCPAgent();
  const [isOpen, setIsOpen] = useState(false);
  const [showHistoryMenu, setShowHistoryMenu] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  useEffect(() => {
    if (isOpen) {
      loadHistory();
    }
  }, [isOpen, loadHistory]);

  const toggleAgent = () => {
    setIsOpen(!isOpen);
    setShowHistoryMenu(false);
  };

  const toggleHistoryMenu = () => {
    setShowHistoryMenu(!showHistoryMenu);
  };

  const handleSave = async () => {
    const name = prompt('Nomeie esta conversa:');
    if (name && messages.length > 0) {
      await saveConversation(name);
    } else if (messages.length === 0) {
      alert('Não há mensagens para salvar.');
    }
  };

  const handleLoad = async (id: number) => {
    await loadSavedConversation(id);
    setShowHistoryMenu(false);
  };

  const handleDelete = async (id: number) => {
    if (confirm('Tem certeza que deseja excluir esta conversa?')) {
      await deleteConversation(id);
    }
  };

  const formatMessage = (msg: { role: 'function' | 'user' | 'system' | 'assistant' | 'tool'; content: string | null; id?: string }): Message => ({
    id: msg.id || Math.random().toString(36).substring(7),
    role: msg.role,
    content: msg.content || '',
  });


  return (
    <>
      <Button
        onClick={toggleAgent}
        className="fixed bottom-4 right-4 rounded-full p-4 shadow-lg z-50"
        size="icon"
      >
        🤖
      </Button>

      {isOpen && (
        <div className="fixed bottom-20 right-4 w-80 h-96 bg-white rounded-lg shadow-xl flex flex-col z-50">
          <div className="flex justify-between items-center p-4 border-b">
            <h3 className="text-lg font-semibold">MCP Agent</h3>
            <div className="relative">
              <Button variant="ghost" size="sm" onClick={toggleHistoryMenu}>
                ...
              </Button>
              {showHistoryMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white border rounded shadow-lg z-50">
                  <Button variant="ghost" className="w-full justify-start" onClick={handleSave}>
                    Salvar Conversa
                  </Button>
                  <Button variant="ghost" className="w-full justify-start" onClick={clearHistory}>
                    Nova Conversa
                  </Button>
                  <div className="border-t my-1"></div>
                  <h4 className="text-sm font-semibold px-3 py-1">Conversas Salvas:</h4>
                  <ScrollArea className="h-24">
                    {isHistoryLoading ? (
                      <div className="text-center text-gray-500 text-sm py-2">Carregando...</div>
                    ) : savedConversations.length === 0 ? (
                      <div className="text-center text-gray-500 text-sm py-2">Nenhuma conversa salva.</div>
                    ) : (
                      savedConversations.map((conv) => (
                        <div key={conv.id} className="flex justify-between items-center px-3 py-1 hover:bg-gray-100">
                          <Button variant="ghost" size="sm" className="w-full justify-start h-auto p-0" onClick={() => handleLoad(conv.id)}>
                            {conv.name}
                          </Button>
                          <Button variant="ghost" size="sm" className="h-auto p-1" onClick={() => handleDelete(conv.id)}>
                            🗑️
                          </Button>
                        </div>
                      ))
                    )}
                  </ScrollArea>
                </div>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={toggleAgent}>
              X
            </Button>
          </div>
          <ScrollArea className="flex-grow p-4">
            {isHistoryLoading ? (
              <div className="text-center text-gray-500">Carregando histórico...</div>
            ) : (
              messages.map((msg) => (
                <ChatMessage key={msg.id} message={formatMessage(msg)} />
              ))
            )}
            {isLoading && !isHistoryLoading && (
              <ChatMessage message={{ id: 'loading', role: 'assistant', content: '' }} isLoading={true} />
            )}
            {error && (
              <div className="text-red-500 text-sm mt-2">Erro: {error.message}</div>
            )}
            <div ref={messagesEndRef} />
          </ScrollArea>
          <form onSubmit={handleSubmit} className="p-4 border-t flex gap-2">
            <Input
              placeholder="Digite sua mensagem..."
              value={input}
              onChange={handleInputChange}
              disabled={isLoading || isHistoryLoading}
            />
            <Button type="submit" disabled={isLoading || isHistoryLoading}>
              Enviar
            </Button>
          </form>
        </div>
      )}
    </>
  );
}
