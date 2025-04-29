// pages/api/whatsapp/reload-flow.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios'; // Usando axios como no seu original

type ResponseData = {
  message: string;
  error?: string;
};

// <<< USA VARIÁVEL DE AMBIENTE PARA O FLOW CONTROLLER >>>
const FLOW_CONTROLLER_API_URL = process.env.FLOW_CONTROLLER_URL; // Ex: http://flow-controller.railway.internal:5000

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ message: `Método ${req.method} não permitido` });
  }

  // <<< VERIFICA SE A URL DO CONTROLLER ESTÁ CONFIGURADA >>>
   if (!FLOW_CONTROLLER_API_URL) {
      console.error("[API Reload Flow] ERRO CRÍTICO: FLOW_CONTROLLER_URL não definida nas variáveis de ambiente.");
      return res.status(503).json({ message: "Serviço de controle de fluxo não configurado corretamente no servidor." });
  }

  console.log(`[API Reload Flow] Solicitando recarga em: ${FLOW_CONTROLLER_API_URL}/reload_flow`);

  try {
      // Chama o endpoint /reload_flow do Python usando axios
      const controllerResponse = await axios.post(`${FLOW_CONTROLLER_API_URL}/reload_flow`,
        {}, // Corpo vazio, se a API do controller não esperar nada
        { timeout: 10000 } // Timeout de 10s
      );

      // Axios lança erro para status não-2xx, então se chegou aqui, status é 2xx
      console.log('[API Reload Flow] Resposta recebida do controller:', controllerResponse.data);
      res.status(200).json({ message: controllerResponse.data?.message || 'Solicitação de recarga enviada ao controller.' });

  } catch (error: any) {
      let errorMsg = 'Erro desconhecido ao comunicar com Flow Controller';
      let status = 503; // Service Unavailable por padrão

      if (axios.isAxiosError(error)) {
          status = error.response?.status || 503;
          errorMsg = error.response?.data?.message || error.response?.data?.error || error.message;
           console.error(`[API Reload Flow] Erro Axios ${status}: ${errorMsg}`, error.response?.data);
      } else {
          errorMsg = error.message;
           console.error("[API Reload Flow] Erro não-Axios:", error);
      }
      res.status(status).json({ message: 'Erro ao comunicar com o serviço de fluxo para recarregar', error: errorMsg });
  }
}
