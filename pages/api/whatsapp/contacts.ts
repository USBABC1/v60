// pages/api/whatsapp/contacts.ts
import type { NextApiRequest, NextApiResponse } from 'next';

// Define a estrutura esperada para um contato (importar de @/types/zap se preferir)
type Contact = {
    jid: string;
    name?: string;
    notify?: string;
    imgUrl?: string;
};

type ResponseData =
    | Contact[]
    | { message: string; error?: string };

// <<< USA VARIÁVEL DE AMBIENTE >>>
const BOT_API_URL = process.env.WHATSAPP_BOT_URL;

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<ResponseData>
) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        return res.status(405).json({ message: `Método ${req.method} não permitido` });
    }

     // <<< VERIFICA SE A URL DO BOT ESTÁ CONFIGURADA >>>
     if (!BOT_API_URL) {
        console.error("[API Contacts] ERRO CRÍTICO: WHATSAPP_BOT_URL não definida nas variáveis de ambiente.");
        return res.status(503).json({ message: "Serviço WhatsApp não configurado corretamente no servidor." });
    }

    console.log(`[API Contacts GET] Buscando contatos em: ${BOT_API_URL}/contacts`);

    try {
        const botResponse = await fetch(`${BOT_API_URL}/contacts`, {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });

        if (!botResponse.ok) {
            let errorMsg = `Erro ao buscar contatos do bot: Status ${botResponse.status}`;
            try { const errorJson = await botResponse.json(); errorMsg = errorJson.message || errorJson.error || errorMsg; } catch (e) {}
            console.error(`[API Contacts GET] Falha na comunicação com a API do bot: ${errorMsg}`);
            return res.status(botResponse.status || 503).json({ message: 'Serviço do bot falhou ao buscar contatos.', error: errorMsg });
        }

        const contacts: Contact[] = await botResponse.json();
        console.log(`[API Contacts GET] Retornando ${contacts.length} contatos.`);

        res.status(200).json(contacts);

    } catch (error: any) {
        console.error("[API Contacts GET] Erro de rede ao tentar buscar contatos:", error);
        const isConnRefused = error.cause?.code === 'ECONNREFUSED';
        const status = isConnRefused ? 503 : 500;
        const message = isConnRefused ? 'Serviço WhatsApp indisponível.' : 'Erro interno ao processar solicitação de contatos.';
        res.status(status).json({ message: message, error: error.message });
    }
}
