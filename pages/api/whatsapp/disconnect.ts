// pages/api/whatsapp/disconnect.ts
import type { NextApiRequest, NextApiResponse } from 'next';

type ResponseData = {
  message: string;
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
      console.error("[API Disconnect] ERRO CRÍTICO: WHATSAPP_BOT_URL não definida nas variáveis de ambiente.");
      return res.status(503).json({ message: "Serviço WhatsApp não configurado corretamente no servidor." });
  }

  console.log(`[API Disconnect] Solicitando desconexão em: ${BOT_API_URL}/disconnect`);

  try {
       const botResponse = await fetch(`${BOT_API_URL}/disconnect`, { method: 'POST' });

       if (!botResponse.ok) {
         let errorMsg = `Erro ao solicitar desconexão ao bot: Status ${botResponse.status}`;
         try { const errorJson = await botResponse.json(); errorMsg = errorJson.message || errorJson.error || errorMsg; } catch (e) {}
         console.error(`[API Disconnect] Falha na comunicação com a API do bot: ${errorMsg}`);
          return res.status(botResponse.status || 503).json({ message: "Falha ao desconectar do serviço WhatsApp.", error: errorMsg });
       }

       const data = await botResponse.json();
       console.log('[API Disconnect] Resposta recebida do bot:', data.message);

      res.status(botResponse.status).json({ message: data.message || 'Desconexão solicitada.' }); // Repassa status e mensagem do bot

  } catch (error: any) {
      console.error("[API Disconnect] Erro de rede ao tentar desconectar:", error);
      const isConnRefused = error.cause?.code === 'ECONNREFUSED';
      const status = isConnRefused ? 503 : 500;
      const message = isConnRefused ? 'Serviço WhatsApp indisponível.' : 'Erro ao comunicar com o serviço WhatsApp para desconectar.';
      res.status(status).json({ message: message, error: error.message });
  }
}
