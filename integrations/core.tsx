// integrations/core.tsx
import { z } from 'zod';
import axios from 'axios';

// Define a schema for the input
const LLMInputSchema = z.object({
  prompt: z.string(),
  temperature: z.number().optional().default(0.7),
  maxTokens: z.number().optional(),
  response_json_schema: z.any().optional(),
  context: z.object({
      path: z.string().default('/')
  }).optional().default({ path: '/'}),
  lastActionContext: z.any().optional().nullable()
});

// Define o schema de output da API do agente.
// A Zod schema está correta: se action existir, 'type' é string obrigatório.
const LLMOutputSchema = z.object({
    response: z.string(),
    action: z.object({
        type: z.string(), // String obrigatória DENTRO do objeto action
        payload: z.any().optional()
    }).optional().nullable() // O objeto action inteiro é opcional/pode ser null
});

// Define um tipo mais flexível para o que o frontend espera de InvokeLLM.
// action: { type: string; payload?: any } | null | undefined
// O TypeScript está reclamando que o tipo inferido da Zod não garante que type seja string se action existir.
type InvokeLLMResponse = {
    textResponse: string;
    jsonResponse: any;
    action?: { type: string; payload?: any } | null; // Mantemos este tipo conforme o frontend espera
};

type LLMInput = z.infer<typeof LLMInputSchema>;

export const InvokeLLM = async (input: LLMInput): Promise<InvokeLLMResponse> => {
  try {
    const validatedInput = LLMInputSchema.parse(input);
    console.log("[InvokeLLM] Chamando API do Agente MCP...");

    const apiPayload = {
        message: `Gere insights em formato JSON estrito que valide contra a seguinte schema: ${JSON.stringify(validatedInput.response_json_schema || {})} com base em: ${validatedInput.prompt}`,
        context: validatedInput.context,
        lastActionContext: validatedInput.lastActionContext,
        response_json_schema: validatedInput.response_json_schema,
    };

    const response = await axios.post<z.infer<typeof LLMOutputSchema>>('/api/mcp-agent', apiPayload);
    console.log("[InvokeLLM] Resposta da API do Agente MCP recebida.");

    // Valida a estrutura básica da resposta da API usando Zod
    const apiResponse = LLMOutputSchema.parse(response.data);

    let jsonResponse = null;
    let textResponse = apiResponse.response;

    if (validatedInput.response_json_schema) {
        try {
            const possibleJson = JSON.parse(apiResponse.response);
            jsonResponse = possibleJson;
        } catch (e) {
            console.warn("[InvokeLLM] Resposta da API não pôde ser parseada como JSON:", apiResponse.response, "Erro:", e);
            jsonResponse = null;
        }
    }

    // --- NOVA CORREÇÃO AQUI ---
    // Verifica se apiResponse.action existe e, se existir, garante que tem a estrutura esperada antes de atribuir.
    // Isso força o TypeScript a reconhecer que, dentro deste if, apiResponse.action tem a forma { type: string, payload?: any }
    let actionResult: { type: string; payload?: any } | null = null;
    if (apiResponse.action && typeof apiResponse.action.type === 'string') {
        actionResult = {
            type: apiResponse.action.type,
            payload: apiResponse.action.payload
        };
    }


    return {
        textResponse: textResponse,
        jsonResponse: jsonResponse,
        action: actionResult // Atribui o resultado da verificação condicional
    };

  } catch (error: any) {
      console.error("[InvokeLLM] Erro ao invocar LLM via API:", error);
      return {
          textResponse: `Erro ao se comunicar com o assistente IA: ${error.message || 'Erro desconhecido'}. Verifique os logs do backend.`,
          jsonResponse: null,
          action: null
      };
  }
};

// Exporte outros utilitários se houverem
