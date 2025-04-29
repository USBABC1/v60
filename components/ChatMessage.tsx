import { cn } from '@/lib/utils';
import { Message } from '@/types/chat';

interface ChatMessageProps {
  message: Message;
  isLoading?: boolean; // Adicionando a propriedade isLoading aqui
}

function ChatMessage({ message, isLoading }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';

  return (
    <div
      className={cn('flex items-start gap-2', {
        'justify-end': isUser,
      })}
    >
      {isAssistant && (
        <div className="flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-md border bg-black text-white">
          🤖
        </div>
      )}
      <div
        className={cn(
          'flex flex-col gap-1 rounded-lg px-3 py-2 text-sm max-w-[70%]',
          {
            'bg-primary text-primary-foreground': isUser,
            'bg-muted': isAssistant,
          }
        )}
      >
        {isLoading ? (
          <div className="flex items-center gap-1">
            <span>Carregando...</span>
            <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        ) : (
          message.content
        )}
      </div>
      {isUser && (
        <div className="flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-md border bg-gray-200 text-gray-800">
          👤
        </div>
      )}
    </div>
  );
}

export default ChatMessage;
