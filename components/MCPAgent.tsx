// components/MCPAgent.tsx
"use client";
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useMCPAgentContext } from '@/context/MCPAgentContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
  DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent
} from "@/components/ui/dropdown-menu";
import { Send, Loader2, PlusCircle, History, Trash2, X, MoreVertical, Paperclip, Save, Sparkles, UserCheck, FolderOpen, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/router';
import Image from 'next/image';
import { NEON_COLOR, baseButtonSelectStyle, baseInputInsetStyle, popoverContentStyle, baseCardStyle } from '@/components/flow/utils';

const MCPAgent: React.FC = () => {
  const {
    isAgentPanelOpen, toggleAgentPanel, messages, sendMessage, isLoading, isHistoryLoading, sessionId,
    startNewConversation,
    savedConversations, isSavedConversationsLoading, fetchSavedConversations,
    saveCurrentConversation, loadSavedConversation, deleteSavedConversation,
    deleteCurrentConversationHistory
  } = useMCPAgentContext();

  const [inputMessage, setInputMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { pathname } = useRouter();

  // --- Estado para Arrastar (Apenas Vertical) ---
  const [position, setPosition] = useState({ bottom: 24, right: 24 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ y: 0, initialBottom: 0 });

  const panelWidth = "360px";
  const panelHeight = "500px";

  const panelRef = useRef<HTMLDivElement>(null);

  // Scroll para a última mensagem
  useEffect(() => {
    if (isAgentPanelOpen) {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isAgentPanelOpen]);

  // --- Lógica de Arrastar (Apenas Vertical) ---
  const handleMouseDownDrag = useCallback((e: React.MouseEvent) => {
    if (!panelRef.current) return;
    setIsDragging(true);
    const rect = panelRef.current.getBoundingClientRect();
    setDragStart({ y: e.clientY, initialBottom: window.innerHeight - rect.bottom });

    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleMouseMoveDrag = useCallback((e: MouseEvent) => {
    if (!isDragging || !panelRef.current) return;
    const deltaY = e.clientY - dragStart.y;
    const newBottom = dragStart.initialBottom - deltaY;

    const panelHeight = panelRef.current.offsetHeight;
    const windowHeight = window.innerHeight;
    const maxBottom = windowHeight - panelHeight - 10;
    const minBottom = 0;

    setPosition(prev => ({
      ...prev,
      bottom: Math.max(minBottom, Math.min(maxBottom, newBottom))
    }));
  }, [isDragging, dragStart]);

  const handleMouseUpDrag = useCallback(() => {
    setIsDragging(false);
  }, []);

  // --- Efeitos para adicionar/remover listeners globais ---
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMoveDrag);
      window.addEventListener('mouseup', handleMouseUpDrag);
    } else {
      window.removeEventListener('mousemove', handleMouseMoveDrag);
      window.removeEventListener('mouseup', handleMouseUpDrag);
    };
    return () => {
      window.removeEventListener('mousemove', handleMouseMoveDrag);
      window.removeEventListener('mouseup', handleMouseUpDrag);
    };
  }, [isDragging, handleMouseMoveDrag, handleMouseUpDrag]);


  // --- Handlers de Mensagem e Anexo ---
  const handleSendMessage = () => {
    if (inputMessage.trim()) {
      sendMessage(inputMessage, { path: pathname });
      setInputMessage('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleAttachClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      console.log("Arquivo selecionado:", file.name, file.type, file.size);
      sendMessage(`Arquivo anexado: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`, { path: pathname });
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Handler para Salvar Conversa (solicita nome)
  const handleSaveConversation = () => {
      const conversationName = prompt("Digite um nome para salvar esta conversa:");
      if (conversationName && conversationName.trim()) {
          saveCurrentConversation(conversationName.trim());
      } else if (conversationName !== null) {
          alert("O nome da conversa não pode ser vazio.");
      }
  };


  // Não renderizar nada se o painel não estiver aberto
  if (!isAgentPanelOpen) {
      return null;
  }

  // Estilos visuais
  const agentTitleStyle = { textShadow: `0 0 6px ${NEON_COLOR}, 0 0 10px ${NEON_COLOR}` };
  const iconNeonFilterStyle = { filter: `drop-shadow(0 0 4px ${NEON_COLOR})` };
  const windowNeonShadowStyle = { boxShadow: `0 0 15px hsl(var(--primary) / 0.8), 0 0 20px hsl(var(--primary) / 0.6)` };


  return (
    <div
      ref={panelRef}
      className={cn(
        "fixed",
        "flex flex-col",
        baseCardStyle,
        "rounded-lg",
        "overflow-hidden",
        "z-50",
        "text-sm"
      )}
      style={{
          bottom: `${position.bottom}px`,
          right: `${position.right}px`,
          width: panelWidth,
          height: panelHeight,
          ...windowNeonShadowStyle,
          cursor: isDragging ? 'grabbing' : 'default'
      }}
    >
        {/* Top Bar (Handle para Arrastar Vertical) */}
        <div
            className="flex justify-between items-center border-b border-[#1E90FF]/20 p-3 flex-shrink-0 cursor-grab"
            onMouseDown={handleMouseDownDrag}
        >
            <h2 className="text-base font-semibold text-white flex items-center" style={agentTitleStyle}>
                <Sparkles className="h-4 w-4 mr-2" style={iconNeonFilterStyle} /> Agente MCP
            </h2>
            <div className="flex space-x-1">
                {/* Menu de Ações */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className={cn(baseButtonSelectStyle, "w-7 h-7 rounded")} aria-label="Menu de Ações">
                            <MoreVertical className="h-4 w-4 text-gray-400" />
                        </Button>
                    </DropdownMenuTrigger>
                    {/* Aplicar popoverContentStyle aqui */}
                    <DropdownMenuContent className={cn(popoverContentStyle, "w-48")}>
                        {/* Iniciar Nova Conversa */}
                        <DropdownMenuItem onClick={startNewConversation} className="text-xs flex items-center cursor-pointer hover:!bg-[#1E90FF]/20">
                            <PlusCircle className="mr-2 h-3.5 w-3.5 text-gray-400" /> Nova Conversa
                        </DropdownMenuItem>

                        {/* Submenu para Ver Histórico (Carregar) */}
                        <DropdownMenuSub>
                            {/* Aplicar estilos de item de menu ao SubTrigger */}
                            <DropdownMenuSubTrigger className={cn("text-xs flex items-center cursor-pointer hover:!bg-[#1E90FF]/20", isSavedConversationsLoading ? "opacity-50 cursor-not-allowed" : "")} disabled={isSavedConversationsLoading}>
                                {isSavedConversationsLoading ? (
                                     <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin text-gray-400" />
                                ) : (
                                     <History className="mr-2 h-3.5 w-3.5 text-gray-400" />
                                )}
                                Ver Histórico
                            </DropdownMenuSubTrigger>
                            {/* Aplicar popoverContentStyle ao conteúdo do submenu */}
                            <DropdownMenuSubContent className={cn(popoverContentStyle, "w-48 max-h-60 overflow-y-auto custom-scrollbar")}>
                                {isSavedConversationsLoading && savedConversations.length === 0 ? (
                                    <DropdownMenuItem disabled className="text-xs text-gray-500">Carregando...</DropdownMenuItem>
                                ) : savedConversations.length === 0 ? (
                                    <DropdownMenuItem disabled className="text-xs text-gray-500">Nenhuma conversa salva.</DropdownMenuItem>
                                ) : (
                                    savedConversations.map(conv => (
                                        // Aplicar estilos de item de menu aos itens individuais
                                        <DropdownMenuItem key={conv.id} onClick={() => loadSavedConversation(conv.id)} className="text-xs flex items-center justify-between cursor-pointer hover:!bg-[#1E90FF]/20">
                                            <span className="truncate mr-2">{conv.name}</span>
                                            {/* Botão para deletar conversa salva individualmente */}
                                            <Button variant="ghost" size="icon" className={cn(baseButtonSelectStyle, "w-6 h-6 rounded hover:!bg-red-500/30")} onClick={(e) => { e.stopPropagation(); deleteSavedConversation(conv.id); }} aria-label={`Deletar ${conv.name}`}>
                                                 <Trash2 className="h-3 w-3 text-red-400" />
                                            </Button>
                                        </DropdownMenuItem>
                                    ))
                                )}
                            </DropdownMenuSubContent>
                        </DropdownMenuSub>

                        {/* Salvar Conversa Atual */}
                        <DropdownMenuItem onClick={handleSaveConversation} className="text-xs flex items-center cursor-pointer hover:!bg-[#1E90FF]/20" disabled={isHistoryLoading || messages.length === 0}>
                            <Save className="mr-2 h-3.5 w-3.5 text-gray-400" /> Salvar Conversa
                        </DropdownMenuItem>

                         <DropdownMenuSeparator className="bg-[#1E90FF]/20"/>

                        {/* Deletar Histórico da Conversa ATUAL */}
                        <DropdownMenuItem onClick={deleteCurrentConversationHistory} className="text-xs flex items-center cursor-pointer text-red-400 hover:!bg-red-500/20" disabled={isHistoryLoading || messages.length === 0}>
                            {isHistoryLoading ? (
                                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin text-red-400" />
                            ) : (
                                <Trash2 className="mr-2 h-3.5 w-3.5 text-red-400" />
                            )}
                             Excluir Histórico Atual
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>

                {/* Botão de fechar o painel */}
                <Button variant="ghost" size="icon" onClick={toggleAgentPanel} aria-label="Fechar Painel" className={cn(baseButtonSelectStyle, "w-7 h-7 rounded hover:!bg-red-500/30")}>
                    <X className="h-4 w-4 text-gray-400" />
                </Button>
            </div>
        </div>

        {/* Área de Chat */}
        <ScrollArea className="flex-1 p-4 custom-scrollbar">
            <div className="space-y-4">
                {/* Exibir indicador de carregamento do histórico */}
                {isHistoryLoading && messages.length === 0 ? (
                     <div className="flex justify-center items-center text-gray-400 text-sm">
                         <Loader2 className="h-5 w-5 animate-spin mr-2" style={iconNeonFilterStyle} /> Carregando histórico...
                     </div>
                ) : !isHistoryLoading && messages.length === 0 ? (
                     <div className="flex justify-center items-center text-gray-500 text-sm">
                         Inicie uma nova conversa!
                     </div>
                ) : (
                    // Mensagens do chat
                    messages.map((msg) => (
                        <div key={msg.id} className={cn( "flex items-start space-x-2", msg.role === 'user' ? 'justify-end' : 'justify-start' )}>
                          {/* Usar a imagem character.png para o assistente, tamanho ajustado */}
                          {msg.role === 'assistant' && (
                              <div className="shrink-0 h-8 w-8 relative rounded-full overflow-hidden bg-gray-700 flex items-center justify-center" style={iconNeonFilterStyle}>
                                  <Image src="/character.png" alt="MCP Agent" fill style={{ objectFit: 'cover' }} sizes="32px" />
                              </div>
                          )}
                           {/* Usar um ícone para o usuário ou outra imagem se disponível */}
                           {/* Mantido UserCheck, mas você pode substituir por uma imagem de avatar de usuário */}
                          {msg.role === 'user' && (
                               <div className="shrink-0 h-8 w-8 relative rounded-full overflow-hidden bg-gray-700 flex items-center justify-center">
                                   {/* Ícone UserCheck para usuário */}
                                   <UserCheck className="h-5 w-5 text-green-400" />
                               </div>
                          )}
                          <div className={cn(
                              "rounded-lg p-2 max-w-[80%]", // Diminuído o padding (p-2)
                              // A fonte menor (text-sm) foi aplicada no container principal
                              // Aplicar estilos neomorphic aos balões de mensagem - Usar baseCardStyle e ajustar cores
                              baseCardStyle, // Aplica fundo escuro e sombras escuras
                              'text-gray-200', // Cor do texto cinza claro
                              // Remover bg-gray-700/800 se baseCardStyle já definir o fundo
                              // msg.role === 'user' ? 'bg-gray-700' : 'bg-gray-800'
                          )}>
                            {msg.content}
                            {/* Renderizar tool_call_id/name se for mensagem de ferramenta */}
                            {msg.role === 'tool' && msg.tool_call_id && (
                                <div className="mt-1 text-xs text-gray-400">
                                    (Tool: {msg.name || 'N/A'}, Call ID: {msg.tool_call_id})
                                </div>
                            )}
                          </div>
                        </div>
                    ))
                )}
                  {/* Indicador de loading para envio de mensagem */}
                  {isLoading && (
                      <div className="flex justify-start items-center space-x-2">
                           {/* Usar a imagem character.png para o loader */}
                           <div className="shrink-0 h-8 w-8 relative rounded-full overflow-hidden bg-gray-700 flex items-center justify-center animate-spin" style={iconNeonFilterStyle}>
                                <Image src="/character.png" alt="Loading" fill style={{ objectFit: 'cover' }} sizes="32px" />
                           </div>
                          <span className="text-gray-400 text-sm">Digitando...</span>
                      </div>
                  )}
                <div ref={messagesEndRef} /> {/* Para scroll automático */}
            </div>
        </ScrollArea>


        {/* Input Area */}
        <div className="flex items-center p-3 border-t border-[#1E90FF]/20 flex-shrink-0">
          {/* Botão de Anexo */}
          <Button variant="ghost" size="icon" onClick={handleAttachClick} aria-label="Anexar arquivo" className={cn(baseButtonSelectStyle, "w-8 h-8 rounded mr-2")}>
              <Paperclip className="h-4 w-4 text-gray-400" />
          </Button>
          {/* Input de Arquivo (escondido) */}
          <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
          />
          {/* Input de Mensagem */}
          <Input
            type="text"
            placeholder="Sua mensagem..."
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            className={cn(baseInputInsetStyle, "flex-1 mr-2 text-xs rounded bg-gray-800 border-gray-700 focus:border-blue-600 focus:ring-blue-600 placeholder-gray-500 text-gray-200")}
            disabled={isLoading || isHistoryLoading} // Desabilitar input enquanto carrega/deleta histórico
          />
          {/* Botão Enviar */}
          <Button onClick={handleSendMessage} disabled={isLoading || isHistoryLoading || !inputMessage.trim()} size="icon" className={cn(baseButtonSelectStyle, "w-8 h-8 rounded bg-blue-600 hover:bg-blue-700 text-white")}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {/* Ícone de loading no botão enviar */}
          </Button>
        </div>

    </div>
  );
};

export default MCPAgent;
