// components/MCPAgent.tsx
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useMCPAgentContext } from '@/context/MCPAgentContext';
import { useState, useRef, useEffect } from 'react';
import ChatMessage from './ChatMessage';
import { Message } from '@/types/chat';
import { Loader2, Send, Trash2, Save, FolderOpen } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandList } from '@/components/ui/command';
import { v4 as uuidv4 } from 'uuid'; // Importar uuid para gerar IDs

const MCPAgent: React.FC = () => {
  const {
    isAgentOpen,
    setIsAgentOpen,
    conversationHistory,
    setConversationHistory,
    sessionId,
    resetConversation,
    saveConversation,
    loadConversation,
    getSavedConversations,
    deleteSavedConversation
  } = useMCPAgentContext();

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [savedConversations, setSavedConversations] = useState<{ id: number; session_id: string; name: string; }[]>([]);
  const [loadPopoverOpen, setLoadPopoverOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);


  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({
        top: scrollAreaRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [conversationHistory]);

  const handleSend = async () => {
    if (input.trim() === '' || isLoading) return;

    // CORREÇÃO: Gerar e atribuir um ID único à mensagem do usuário
    const newUserMessage: Message = { id: uuidv4(), role: 'user', content: input };
    const updatedHistory = [...conversationHistory, newUserMessage];
    setConversationHistory(updatedHistory);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/mcp-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sessionId,
          messages: updatedHistory,
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      const data = await response.json();
      // CORREÇÃO: Gerar e atribuir um ID único à mensagem do assistente
      const assistantMessage: Message = { id: uuidv4(), role: 'assistant', content: data.reply };
      setConversationHistory([...updatedHistory, assistantMessage]);

    } catch (error: any) {
      console.error('Erro ao enviar mensagem para o agente:', error);
      // CORREÇÃO: Gerar e atribuir um ID único à mensagem de erro
      const errorMessage: Message = { id: uuidv4(), role: 'assistant', content: `Ocorreu um erro: ${error.message}. Por favor, tente novamente.` };
      setConversationHistory([...updatedHistory, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSaveClick = () => {
      setSaveDialogOpen(true);
      setSaveName(`Conversa ${new Date().toLocaleString()}`);
  };

  const handleConfirmSave = async () => {
      if (saveName.trim() === '') return;
      setIsLoading(true);
      const success = await saveConversation(saveName);
      if (success) {
          console.log("Conversa salva com sucesso!");
          setSaveDialogOpen(false);
          setSaveName('');
      } else {
          console.error("Falha ao salvar conversa.");
      }
      setIsLoading(false);
  };

  const handleLoadClick = async () => {
      setIsLoading(true);
      const conversations = await getSavedConversations();
      setSavedConversations(conversations);
      setIsLoading(false);
      setLoadPopoverOpen(true);
  };

  const handleSelectConversationToLoad = async (session_id: string) => {
      setIsLoading(true);
      await loadConversation(session_id);
      setIsLoading(false);
      setLoadPopoverOpen(false);
  };

  const handleDeleteClick = (session_id: string) => {
      setSessionToDelete(session_id);
      setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
      if (!sessionToDelete) return;
      setIsLoading(true);
      const success = await deleteSavedConversation(sessionToDelete);
      if (success) {
          console.log(`Conversa ${sessionToDelete} deletada.`);
          const updatedConversations = savedConversations.filter(conv => conv.session_id !== sessionToDelete);
          setSavedConversations(updatedConversations);
      } else {
          console.error(`Falha ao deletar conversa ${sessionToDelete}.`);
      }
      setIsLoading(false);
      setDeleteDialogOpen(false);
      setSessionToDelete(null);
  };


  if (!isAgentOpen) return null;

  return (
    <div className="fixed bottom-4 right-4 w-80 h-[calc(100vh-8rem)] bg-gray-800 text-white rounded-lg shadow-lg flex flex-col z-50 border border-gray-700">
      <div className="flex justify-between items-center p-3 border-b border-gray-700">
        <h3 className="text-lg font-semibold">MCP Agent</h3>
        <div className="flex space-x-2">
             <Button variant="ghost" size="icon" onClick={handleSaveClick} title="Salvar Conversa">
                <Save className="h-4 w-4 text-gray-400 hover:text-white" />
             </Button>
             <Popover open={loadPopoverOpen} onOpenChange={setLoadPopoverOpen}>
                <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={handleLoadClick} title="Carregar Conversa Salva" disabled={isLoading}>
                        {isLoading ? <Loader2 className="h-4 w-4 animate-spin text-gray-400" /> : <FolderOpen className="h-4 w-4 text-gray-400 hover:text-white" />}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0 bg-gray-800 border border-gray-700 text-white">
                     <Command>
                        <CommandInput placeholder="Buscar conversa..." className="border-gray-700" />
                        <CommandList>
                            <CommandEmpty>Nenhuma conversa encontrada.</CommandEmpty>
                            <CommandGroup>
                                {savedConversations.map((conv) => (
                                    <CommandItem
                                        key={conv.session_id}
                                        value={conv.name}
                                        onSelect={() => handleSelectConversationToLoad(conv.session_id)}
                                        className="flex justify-between items-center cursor-pointer hover:bg-gray-700"
                                    >
                                        <span>{conv.name}</span>
                                        <Trash2
                                            className="h-4 w-4 text-red-400 hover:text-red-500 ml-2"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteClick(conv.session_id);
                                            }}
                                        />
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
                     </Command>
                </PopoverContent>
             </Popover>

             <Button variant="ghost" size="icon" onClick={resetConversation} title="Nova Conversa">
                <Trash2 className="h-4 w-4 text-red-400 hover:text-red-500" />
             </Button>
             <Button variant="ghost" size="icon" onClick={() => setIsAgentOpen(false)} title="Fechar">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
             </Button>
        </div>
      </div>
      <ScrollArea ref={scrollAreaRef} className="flex-1 p-3">
        <div className="flex flex-col space-y-3">
          {conversationHistory.map((message, index) => (
            <ChatMessage key={message.id || index} message={message} /> {/* Usar message.id como key */}
          ))}
           {isLoading && (
               <div className="flex justify-start">
                   <div className="bg-gray-700 text-white p-2 rounded-lg max-w-[80%]">
                       <Loader2 className="h-4 w-4 animate-spin" />
                   </div>
               </div>
           )}
        </div>
      </ScrollArea>
      <div className="p-3 border-t border-gray-700 flex items-center">
        <Textarea
          placeholder="Digite sua mensagem..."
          className="flex-1 bg-gray-700 border-gray-600 text-white rounded-lg mr-2 resize-none"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          rows={1}
          maxRows={4}
        />
        <Button onClick={handleSend} disabled={input.trim() === '' || isLoading} className="bg-blue-600 hover:bg-blue-700 text-white">
          <Send className="h-5 w-5" />
        </Button>
      </div>

      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
          <DialogContent className="bg-gray-800 text-white border border-gray-700">
              <DialogHeader>
                  <DialogTitle>Salvar Conversa</DialogTitle>
                  <DialogDescription>
                      Dê um nome para a conversa que você deseja salvar.
                  </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="saveName" className="text-right">
                          Nome
                      </Label>
                      <Input
                          id="saveName"
                          value={saveName}
                          onChange={(e) => setSaveName(e.target.value)}
                          className="col-span-3 bg-gray-700 border-gray-600 text-white"
                      />
                  </div>
              </div>
              <DialogFooter>
                  <Button variant="outline" onClick={() => setSaveDialogOpen(false)} className="border-gray-600 text-gray-300 hover:bg-gray-700">Cancelar</Button>
                  <Button onClick={handleConfirmSave} disabled={saveName.trim() === '' || isLoading} className="bg-blue-600 hover:bg-blue-700 text-white">
                       {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                       Salvar
                  </Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>

       <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <DialogContent className="bg-gray-800 text-white border border-gray-700">
                <DialogHeader>
                    <DialogTitle>Confirmar Exclusão</DialogTitle>
                    <DialogDescription>
                        Tem certeza que deseja excluir esta conversa salva? Esta ação não pode ser desfeita.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} className="border-gray-600 text-gray-300 hover:bg-gray-700">Cancelar</Button>
                    <Button variant="destructive" onClick={handleConfirmDelete} disabled={isLoading}>
                        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Excluir
                    </Button>
                </DialogFooter>
            </DialogContent>
       </Dialog>

    </div>
  );
};

export default MCPAgent;
