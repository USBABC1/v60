// types/chat.ts
// *** REVISÃO FINAL: Garanta que esta é a definição usada ***
export interface Message {
  // id?: string; // ID pode ser adicionado se necessário
  role: 'user' | 'assistant'; // Propriedade para identificar o remetente
  content: string;           // Propriedade para o texto da mensagem
  timestamp?: string;        // Opcional
}

export interface Conversation {
    id: string;
    title: string;
    date: string;
    messages: Message[]; // Usa a interface Message correta
}

export interface ModelConfig {
    useLocal: boolean;
    modelName: string;
    modelPath?: string;
    temperature: number;
    maxTokens: number;
    repetitionPenalty: number;
}