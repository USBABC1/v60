// lib/whatsappSender.ts - Implementação Sugerida
import axios from 'axios'; // Certifique-se de ter axios instalado: npm install axios

const BOT_API_URL = process.env.WHATSAPP_BOT_API_URL || 'http://localhost:3001'; // URL da API interna do whatsappBot.js

interface SendMessageOptions {
    text?: string;
    image?: { url: string; caption?: string };
    buttons?: any[]; // Adapte conforme a estrutura exata de botões
    sections?: any[]; // Adapte conforme a estrutura exata de listas
    // Adicionar outros tipos conforme necessário
    [key: string]: any;
}

interface SendResult {
    success: boolean;
    messageId?: string;
    error?: string;
}

export async function sendMessageToWhatsApp(jid: string, options: SendMessageOptions): Promise<SendResult> {
    const sendUrl = `${BOT_API_URL}/send`;
    console.log(`[whatsappSender] Enviando POST para ${sendUrl} com JID: ${jid}`);
    console.log(`[whatsappSender] Payload (options):`, JSON.stringify(options));

    try {
        const response = await axios.post<SendResult>(sendUrl, {
            jid: jid,
            options: options // Envia o payload da mensagem diretamente
        }, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 15000 // Timeout de 15 segundos
        });

        console.log(`[whatsappSender] Resposta da API do Bot (${response.status}):`, response.data);
        if (response.data && response.data.success) {
            return { success: true, messageId: response.data.messageId };
        } else {
            // Mesmo que a API retorne 200, pode ter falhado logicamente
            return { success: false, error: response.data.error || 'Bot API returned non-success' };
        }
    } catch (error: any) {
        const errorMsg = error.response?.data?.error || error.response?.data?.message || error.message || 'Erro desconhecido na comunicação com o bot';
        const statusCode = error.response?.status;
        console.error(`[whatsappSender] Erro ao chamar API do Bot (${statusCode || 'N/A'}): ${errorMsg}`);
        return { success: false, error: `Falha ao comunicar com o bot: ${errorMsg}` };
    }
}

// Função para verificar conexão (opcional, mas útil)
export async function checkBotConnection(): Promise<{ status: string; qrCode?: string | null }> {
     const statusUrl = `${BOT_API_URL}/status`;
     console.log(`[whatsappSender] Verificando status em ${statusUrl}`);
     try {
        const response = await axios.get<{ status: string; qrCode?: string | null }>(statusUrl, { timeout: 5000 });
        console.log(`[whatsappSender] Status do Bot: ${response.data.status}`);
        return response.data;
     } catch (error: any) {
         console.error(`[whatsappSender] Não foi possível obter status do bot: ${error.message}`);
         return { status: 'error', qrCode: null };
     }
}