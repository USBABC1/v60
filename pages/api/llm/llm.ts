// pages/api/llm - Copia.ts
// !! ESTE ARQUIVO PARECE SER UMA CÓPIA E ESTÁ CAUSANDO ERRO DE BUILD !!
// Comentando o import problemático para permitir o build.
// Verifique se a biblioteca 'langchain' precisa ser instalada ('npm install langchain')
// ou se este arquivo pode ser removido.

import type { NextApiRequest, NextApiResponse } from 'next';
// import { LlamaCpp } from 'langchain/llms/llama_cpp'; // <<< COMENTADO
// import { Callbacks } from 'langchain/callbacks'; // <<< COMENTADO

// Define o tipo esperado para o corpo da requisição
interface LlmApiRequest extends NextApiRequest {
  body: {
    prompt: string;
    modelPath?: string; // Caminho opcional para o modelo .gguf
    // Outros parâmetros LangChain podem ser adicionados aqui (temperature, maxTokens, etc.)
    temperature?: number;
    maxTokens?: number;
  };
}

export default async function handler(req: LlmApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const {
    prompt,
    modelPath = "E:/MODELOS/TinyLlama-1.1B-Chat-v1.0/ggml-model-q4_0.gguf", // Caminho padrão (AJUSTE CONFORME NECESSÁRIO)
    temperature = 0.7,
    maxTokens = 512, // Limite padrão
   } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'O prompt é obrigatório.' });
  }

  try {
    // console.log(`[LLM API - Copia] Carregando modelo de: ${modelPath}`);

    // --- Código LangChain Comentado ---
    /*
    const llm = new LlamaCpp({
      modelPath: modelPath,
      temperature: temperature,
      maxTokens: maxTokens,
      // verbose: true, // Descomente para logs detalhados do LlamaCpp
      // callbacks: Callbacks.fromHandlers({ // Exemplo de callbacks
      //   handleLLMNewToken(token: string) {
      //     process.stdout.write(token); // Exemplo: escreve token no console do servidor
      //   },
      // }),
      // Adicione outros parâmetros LlamaCpp aqui se necessário
      // nCtx: 2048, // Exemplo: Tamanho do contexto
      // nBatch: 512, // Exemplo: Tamanho do batch
    });

    console.log(`[LLM API - Copia] Gerando resposta para o prompt: "${prompt.substring(0, 50)}..."`);

    // Gera a resposta
    const response = await llm.call(prompt);

    console.log(`[LLM API - Copia] Resposta gerada.`);
    */
    // --- Fim do Código LangChain Comentado ---

    // Resposta simulada enquanto LangChain está comentado
    const response = `Resposta simulada para: "${prompt}" (LangChain comentado)`;


    res.status(200).json({ response });

  } catch (error: any) {
    console.error('[LLM API - Copia] Erro ao processar a requisição:', error);
    res.status(500).json({ error: 'Erro interno do servidor ao processar LLM', details: error.message });
  }
}