import React from 'react';
import { Message as ChatMessageType } from '@/types/chat';
import styles from '@/styles/Chat.module.css';
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Bot, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatMessageProps {
  message: ChatMessageType;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isUser = message.role === 'user';

  return (
    <div className={cn(
        styles.message,
        "flex items-start gap-3 w-full",
        isUser ? "justify-end" : "justify-start"
    )}>
      {!isUser && (
        <Avatar className="h-8 w-8 border border-border flex-shrink-0">
          <AvatarFallback className='bg-secondary text-secondary-foreground flex items-center justify-center'>
              <Bot size={16} />
          </AvatarFallback>
        </Avatar>
      )}
      <div
        className={cn(
          "max-w-[75%] rounded-lg px-3 py-2 text-sm shadow-[3px_3px_6px_rgba(0,0,0,0.3),-3px_-3px_6px_rgba(255,255,255,0.05)]",
          isUser ? "bg-primary text-primary-foreground rounded-br-none" : "bg-secondary text-secondary-foreground rounded-bl-none"
        )}
        style={{ overflowWrap: 'break-word', wordWrap: 'break-word', wordBreak: 'break-word', hyphens: 'auto' }}
      >
        {message.content}
      </div>
       {isUser && (
        <Avatar className="h-8 w-8 border border-border flex-shrink-0">
          <AvatarFallback className='bg-primary text-primary-foreground flex items-center justify-center'>
              <User size={16}/>
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );
};

export default ChatMessage;
