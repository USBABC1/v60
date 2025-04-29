// pages/api/llm.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import axios, { AxiosError } from 'axios';

// *** ATENÇÃO: Esta função agora roteia para diferentes backends ***

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  // *** Extrai dados do corpo, incluindo a configuração do provedor ***
  const {
    prompt,
    providerType = 'local', // Default to local if not provided
    localServerUrl = process.env.LLM_SERVER_URL || 'http://127.0.0.1:8001', // Get local URL from request or env
    apiKey, // API Key for online providers
    customApiUrl, // URL for custom provider
    temperature,
    max_new_tokens,
    repetition_penalty,
    // Adicione outros parâmetros que podem ser passados
    response_json_schema,
    do_sample,
    top_p,
    top_k,
  } = req.body;

  console.log(`[API LLM Router] Recebido: provider=${providerType}, localUrl=${localServerUrl}, customUrl=${customApiUrl}, apiKey?=${!!apiKey}`);

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt é obrigatório.' });
  }

  // --- Lógica de Roteamento ---
  try {
    let response;

    switch (providerType) {
      case 'local':
        if (!localServerUrl) {
             throw new Error("URL do servidor local não configurada.");
        }
        const localEndpoint = `${localServerUrl}/generate`;
        console.log(`[API LLM Router] Encaminhando para LOCAL: ${localEndpoint}`);
        const localPayload: Record<string, any> = { prompt, temperature, max_new_tokens, repetition_penalty, response_json_schema, do_sample, top_p, top_k };
        // Limpa payload local de undefined
        Object.keys(localPayload).forEach(key => localPayload[key] === undefined && delete localPayload[key]);
        response = await axios.post(localEndpoint, localPayload, { timeout: 120000 });
        break;

      case 'openai':
        if (!apiKey) { throw new Error("Chave de API OpenAI não fornecida."); }
        console.log(`[API LLM Router] Chamando OpenAI API...`);
        // IMPLEMENTAR chamada para API OpenAI usando 'apiKey' e 'prompt', etc.
        // Exemplo (requer biblioteca 'openai'):
        // const { OpenAI } = require("openai");
        // const openai = new OpenAI({ apiKey: apiKey });
        // const completion = await openai.chat.completions.create({
        //   messages: [{ role: "user", content: prompt }],
        //   model: "gpt-3.5-turbo", // Ou outro modelo
        //   temperature: temperature,
        //   max_tokens: max_new_tokens
        // });
        // response = { data: { response: completion.choices[0]?.message?.content } }; // Adapte a estrutura da resposta
        // *** RESPOSTA MOCKADA POR ENQUANTO ***
        await new Promise(resolve => setTimeout(resolve, 500)); // Simula delay
        response = { status: 200, data: { text: `(Simulado OpenAI) Resposta para: ${prompt.substring(0,30)}...` } }; // Use 'text' field like local
        break;

      case 'gemini':
         if (!apiKey) { throw new Error("Chave de API Gemini não fornecida."); }
         console.log(`[API LLM Router] Chamando Gemini API...`);
         // IMPLEMENTAR chamada para API Gemini usando 'apiKey' e 'prompt', etc.
         // Exemplo (requer biblioteca '@google/generative-ai'):
         // const { GoogleGenerativeAI } = require("@google/generative-ai");
         // const genAI = new GoogleGenerativeAI(apiKey);
         // const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash"}); // Ou outro
         // const result = await model.generateContent(prompt);
         // response = { data: { response: result.response.text() } }; // Adapte
         // *** RESPOSTA MOCKADA POR ENQUANTO ***
         await new Promise(resolve => setTimeout(resolve, 500)); // Simula delay
         response = { status: 200, data: { text: `(Simulado Gemini) Resposta para: ${prompt.substring(0,30)}...` } }; // Use 'text' field
         break;

       case 'custom':
         if (!customApiUrl) { throw new Error("URL da API customizada não fornecida."); }
         console.log(`[API LLM Router] Chamando API Customizada: ${customApiUrl}`);
         const customPayload: Record<string, any> = { prompt, temperature, max_new_tokens, repetition_penalty };
         Object.keys(customPayload).forEach(key => customPayload[key] === undefined && delete customPayload[key]);
         const headers: Record<string, string> = { 'Content-Type': 'application/json' };
         if (apiKey) { headers['Authorization'] = `Bearer ${apiKey}`; } // Exemplo com Bearer Token
         response = await axios.post(customApiUrl, customPayload, { headers, timeout: 120000 });
         // Assuming custom API also returns { text: "..." } or similar
         break;

      default:
        console.warn(`[API LLM Router] providerType desconhecido: ${providerType}`);
        return res.status(400).json({ error: `Tipo de provedor desconhecido: ${providerType}` });
    }

    // --- Retorno ---
    console.log(`[API LLM Router] Resposta recebida do provedor ${providerType}:`, response?.status, response?.data);
    // Garante que a resposta tenha um status e um corpo
    const status = response?.status || 500;
    const responseData = response?.data || { error: `Resposta inesperada do provedor ${providerType}` };

    // *** Ensure consistency: frontend expects a 'text' field ***
    if (providerType !== 'local' && responseData && responseData.response) {
      responseData.text = responseData.response;
      delete responseData.response; // Remove original if needed
    }
    // Ensure custom API also has a 'text' field or adapt here

    return res.status(status).json(responseData);

  } catch (error: any) {
      console.error(`[API LLM Router] Erro ao processar provider ${providerType}:`);
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        console.error('  -> Axios Error Code:', axiosError.code);
        console.error('  -> Axios Error Message:', axiosError.message);
        if (axiosError.response) {
          console.error('  -> Backend Status:', axiosError.response.status);
          console.error('  -> Backend Data:', axiosError.response.data);
          const status = axiosError.response.status;
          let errorData: any = axiosError.response.data;
          if (typeof errorData !== 'object' || errorData === null) { errorData = { error: 'Resposta inválida do servidor LLM.', details: String(errorData) }; }
          else if (!errorData.error && !errorData.message && !errorData.detail) { errorData.error = `Erro ${status} retornado pelo servidor ${providerType}.`; }
          return res.status(status).json(errorData);
        } else if (axiosError.request) {
           let specificError = `Falha ao comunicar com o servidor ${providerType} (sem resposta).`;
           if (providerType === 'local') specificError += ` Verifique se está rodando em ${localServerUrl}.`;
           console.error(`  -> ${specificError}`);
           return res.status(503).json({ error: specificError, code: axiosError.code });
        } else {
          console.error('  -> Erro na config Axios:', axiosError.message);
          return res.status(500).json({ error: 'Erro interno ao preparar requisição.', details: axiosError.message });
        }
      } else {
        console.error('  -> Erro não-Axios:', error.message);
        return res.status(500).json({ error: `Erro interno inesperado na API LLM (${providerType}).`, details: error.message });
      }
  }
}