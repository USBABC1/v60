// pages/api/whatsapp/status.ts
import type { NextApiRequest, NextApiResponse } from 'next';

type ResponseData = {
    status: string; // 'connected', 'connecting', 'disconnected', 'error', etc.
    qrCodeString?: string | null; // String base64 do QR code ou null
    message?: string; // Mensagem adicional do bot
};

// <<< USA VARIÁVEL DE AMBIENTE >>>
const BOT_API_URL = process.env.WHATSAPP_BOT_URL;

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<ResponseData | { message: string; error?: string }>
) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        return res.status(405).json({ message: `Método ${req.method} não permitido` });
    }

    // <<< VERIFICA SE A URL DO BOT ESTÁ CONFIGURADA >>>
    if (!BOT_API_URL) {
        console.error("[API Status] ERRO CRÍTICO: WHATSAPP_BOT_URL não definida nas variáveis de ambiente.");
        return res.status(503).json({ message: "Serviço WhatsApp não configurado corretamente no servidor.", status: "error" });
    }

    console.log(`[API Status] Buscando status em: ${BOT_API_URL}/status`);

    try {
        const botResponse = await fetch(`${BOT_API_URL}/status`, {
             method: 'GET',
             headers: { 'Accept': 'application/json' } // Garante que queremos JSON
        });

        if (!botResponse.ok) {
            let errorMsg = `Erro ao buscar status do bot: Status ${botResponse.status}`;
            try {
                const errorJson = await botResponse.json();
                errorMsg = errorJson.message || errorJson.error || errorMsg;
            } catch (e) {
                 // Se não conseguir parsear o erro, usa o status text
                 errorMsg = `${errorMsg} - ${botResponse.statusText}`;
            }
            console.error(`[API Status] Falha na comunicação: ${errorMsg}`);
            // Retorna status de erro do bot, ou 503 se a comunicação falhou totalmente
            return res.status(botResponse.status || 503).json({ message: "Falha ao obter status do serviço WhatsApp.", error: errorMsg, status: "error" });
        }

        const botData = await botResponse.json();
        console.log("[API Status] Status recebido do bot:", botData);

        // Retorna os dados recebidos do bot
        res.status(200).json({
            status: botData.status || 'unknown', // Garante que sempre tenha um status
            qrCodeString: botData.qrCode || botData.qrCodeString || null, // Aceita ambos os nomes comuns
            message: botData.message // Repassa mensagem se houver
        });

    } catch (error: any) {
        console.error("[API Status] Erro de rede ao obter status:", error);
        // Distingue erro de conexão recusada (bot offline?) de outros erros
        const isConnRefused = error.cause?.code === 'ECONNREFUSED';
        const status = isConnRefused ? 503 : 500; // 503 Service Unavailable, 500 Internal Server Error
        const message = isConnRefused ? 'Serviço WhatsApp indisponível.' : 'Erro ao comunicar com o serviço WhatsApp.';
        res.status(status).json({ message: message, error: error.message, status: "error" });
    }
}
