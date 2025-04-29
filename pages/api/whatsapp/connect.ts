// pages/api/whatsapp/connect.ts
import type { NextApiRequest, NextApiResponse } from 'next';

type ResponseData = {
  message: string;
  status?: string; // Status atual retornado pelo bot
};

// <<< USA VARIÁVEL DE AMBIENTE >>>
const BOT_API_URL = process.env.WHATSAPP_BOT_URL;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData | { message: string; error?: string }>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ message: `Método ${req.method} não permitido` });
  }

  // <<< VERIFICA SE A URL DO BOT ESTÁ CONFIGURADA >>>
  if (!BOT_API_URL) {
      console.error("[API Connect] ERRO CRÍTICO: WHATSAPP_BOT_URL não definida nas variáveis de ambiente.");
      return res.status(503).json({ message: "Serviço WhatsApp não configurado corretamente no servidor." });
  }

  console.log(`[API Connect] Solicitando conexão em: ${BOT_API_URL}/connect`);

  try {
      const botResponse = await fetch(`${BOT_API_URL}/connect`, { method: 'POST' });

       if (!botResponse.ok) {
         let errorMsg = `Erro ao solicitar conexão ao bot: Status ${botResponse.status}`;
         try { const errorJson = await botResponse.json(); errorMsg = errorJson.message || errorJson.error || errorMsg; } catch (e) {}
         console.error(`[API Connect] Falha na comunicação com a API do bot: ${errorMsg}`);
         return res.status(botResponse.status || 503).json({ message: "Falha ao iniciar conexão com serviço WhatsApp.", error: errorMsg });
       }

      const data = await botResponse.json();
      console.log('[API Connect] Resposta recebida do bot:', data.message);

      // Resposta 200 ou 202 indica que a solicitação foi aceita pelo bot
      // O status real ('connecting', 'connected') vem no corpo da resposta do bot
      const httpStatus = botResponse.status === 200 || botResponse.status === 202 ? 200 : botResponse.status;
      res.status(httpStatus).json({ message: data.message || "Solicitação de conexão recebida.", status: data.status });

  } catch (error: any) {
      console.error("[API Connect] Erro de rede ao tentar iniciar conexão:", error);
      const isConnRefused = error.cause?.code === 'ECONNREFUSED';
      const status = isConnRefused ? 503 : 500;
      const message = isConnRefused ? 'Serviço WhatsApp indisponível.' : 'Erro ao comunicar com o serviço WhatsApp para iniciar conexão.';
      res.status(status).json({ message: message, error: error.message });
  }
}
