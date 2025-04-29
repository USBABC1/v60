export interface Message {
  id: string;
  // Atualizado para incluir todos os tipos de role possíveis
  role: 'user' | 'assistant' | 'system' | 'function' | 'tool';
  content: string;
}
