// pages/api/whatsapp/send.ts
import { NextApiRequest, NextApiResponse } from 'next';
// <<< IMPORTAÇÃO REMOVIDA - A comunicação será via API HTTP >>>
// import { sendWhatsAppMessage } from '../../../lib/whatsappBot';

// <<< USA VARIÁVEL DE AMBIENTE >>>
const BOT_API_URL = process.env.WHATSAPP_BOT_URL;

type SendResponse = {
    success: boolean;
    message: string;
    error?: string;
    details?: any; // Para detalhes do erro do bot
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<SendResponse>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, error: `Método ${req.method} não permitido`, message: "Método inválido." });
  }

  // <<< VERIFICA SE A URL DO BOT ESTÁ CONFIGURADA >>>
   if (!BOT_API_URL) {
      console.error("[API Send] ERRO CRÍTICO: WHATSAPP_BOT_URL não definida nas variáveis de ambiente.");
      return res.status(503).json({ success: false, message: "Serviço WhatsApp não configurado corretamente no servidor.", error: "Configuração ausente." });
  }

  const { number, message } = req.body;

  if (!number || !message || typeof number !== 'string' || typeof message !== 'string') {
    return res.status(400).json({ success: false, error: 'Número e mensagem (como strings) são obrigatórios.', message: 'Dados inválidos.' });
  }

  // Formata o número para JID (mantido)
  const jid = `${number.replace(/\D/g, '')}@s.whatsapp.net`;
  console.log(`[API Send] Preparando para enviar para ${jid} via ${BOT_API_URL}/send`);

  try {
    // --- CHAMADA HTTP PARA A API DO BOT ---
    const botResponse = await fetch(`${BOT_API_URL}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            recipientJid: jid, // Envia o JID formatado
            message: { text: message } // Assume que o bot espera um objeto { text: ... }
            // Ajuste o corpo (body) conforme a API do seu bot espera!
            // Pode ser que ele espere { number: ..., message: ... }
            // body: JSON.stringify({ number: jid, message: message }) // Exemplo alternativo
        }),
        // Adicionar timeout?
        // signal: AbortSignal.timeout(15000) // Ex: timeout de 15s
    });

    if (!botResponse.ok) {
        let errorMsg = `Erro do Bot ao Enviar: Status ${botResponse.status}`;
        let errorDetails = null;
        try {
            const errorJson = await botResponse.json();
            errorMsg = errorJson.message || errorJson.error || errorMsg;
            errorDetails = errorJson.details || errorJson;
        } catch (e) {}
        console.error(`[API Send] Falha na API do bot: ${errorMsg}`, errorDetails);
        return res.status(botResponse.status || 503).json({ success: false, message: "Falha ao enviar mensagem via serviço WhatsApp.", error: errorMsg, details: errorDetails });
    }

    const responseData = await botResponse.json();
    console.log(`[API Send] Sucesso no envio para ${jid}. Resposta do bot:`, responseData);
    res.status(200).json({ success: true, message: responseData.message || 'Mensagem enviada para processamento pelo bot.' });

  } catch (error: any) {
    const isConnRefused = error.cause?.code === 'ECONNREFUSED';
    const status = isConnRefused ? 503 : 500;
    const message = isConnRefused ? 'Serviço WhatsApp indisponível.' : 'Erro ao comunicar com o serviço WhatsApp para envio.';
    console.error(`[API Send] Erro (${status}) ao enviar para ${jid}:`, error);
    res.status(status).json({ success: false, message: message, error: error.message });
  }
}
