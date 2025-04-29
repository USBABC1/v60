// /pages/api/whatsapp/webhook.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { sendMessageToWhatsApp } from '@/lib/whatsappSender'; // Importa a função que usa a API interna do bot
import axios from 'axios'; // Usaremos axios para chamar o flow controller

const FLOW_CONTROLLER_URL = process.env.FLOW_CONTROLLER_URL || 'http://localhost:5000/process_message';
const WEBHOOK_VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || 'seu_token_secreto'; // Mantenha seu token

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  console.log('[Webhook] Received request:', req.method, req.url);

  // --- Verificação do Webhook (Mantido igual) ---
  if (req.method === 'GET') {
    console.log('[Webhook GET] Request query:', req.query);
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === WEBHOOK_VERIFY_TOKEN) {
      console.log('[Webhook GET] Verification successful.');
      res.status(200).send(challenge);
    } else {
      console.warn('[Webhook GET] Verification failed.');
      res.status(403).send('Forbidden');
    }
    return;
  }

  // --- Processamento de Mensagens Recebidas (POST) ---
  if (req.method === 'POST') {
    const body = req.body;
    console.log('[Webhook POST] Request body:', JSON.stringify(body, null, 2));

    // *** CORREÇÃO: Extrai dados diretamente do corpo enviado pelo bot ***
    const senderId = body?.sender_id; // Espera JID completo (ex: 5511...@s.whatsapp.net)
    const messageText = body?.message;

    if (!senderId || typeof senderId !== 'string' || !senderId.includes('@')) {
        console.warn('[Webhook POST] Ignorando: sender_id inválido ou ausente.', senderId);
        return res.status(200).send('EVENT_RECEIVED_INVALID_SENDER');
    }
    if (typeof messageText !== 'string' || messageText.trim() === '') {
        console.warn('[Webhook POST] Ignorando: mensagem vazia ou inválida.');
        return res.status(200).send('EVENT_RECEIVED_EMPTY_MESSAGE');
    }
    // *** FIM DA CORREÇÃO ***

    console.log(`[Webhook POST] Mensagem de ${senderId}: "${messageText}"`);

    try {
      console.log(`[Webhook POST] Enviando para Flow Controller (${FLOW_CONTROLLER_URL})...`);
      const flowResponse = await axios.post(FLOW_CONTROLLER_URL, {
        sender_id: senderId, // Já está no formato JID completo
        message: messageText,
      }, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 15000 // Timeout de 15 segundos
      });

      console.log(`[Webhook POST] Resposta do Flow Controller (${flowResponse.status}):`, flowResponse.data);

      if (flowResponse.status !== 200) {
          console.error(`[Webhook POST] Erro do Flow Controller (${flowResponse.status}):`, flowResponse.data);
          // Poderia tentar enviar uma mensagem de erro genérica aqui, mas é opcional
          // await sendMessageToWhatsApp(senderId, { text: "Desculpe, não consegui processar sua solicitação no momento." });
          return res.status(200).send('EVENT_RECEIVED_CONTROLLER_ERROR'); // Responde OK pro WhatsApp
      }

      const flowData = flowResponse.data;

      // Verifica se há um payload de resposta para enviar de volta
      if (flowData.response_payload && typeof flowData.response_payload === 'object') {
         console.log(`[Webhook POST] Enviando resposta via whatsappSender para ${senderId}:`, flowData.response_payload);
         // ** PONTO CRÍTICO: Chamar a função de envio REAL **
         const sendResult = await sendMessageToWhatsApp(senderId, flowData.response_payload); // Envia o payload completo
         if (sendResult.success) {
            console.log('[Webhook POST] Mensagem enviada com sucesso via whatsappSender.');
         } else {
            console.error('[Webhook POST] Falha ao enviar mensagem via whatsappSender:', sendResult.error);
            // Logar o erro é importante, mas ainda respondemos OK para o WhatsApp
         }
      } else {
         console.log('[Webhook POST] Flow Controller não retornou mensagem de resposta (response_payload).');
      }

      // Responde ao WhatsApp que o evento foi processado
      return res.status(200).send('EVENT_RECEIVED');

    } catch (error: any) {
      const errorMsg = error.response?.data?.message || error.message || 'Erro desconhecido';
      console.error(`[Webhook POST] Erro ao processar mensagem ou comunicar com Flow Controller: ${errorMsg}`);
      // Responde OK para o WhatsApp não reenviar, mas loga o erro
      return res.status(200).send('EVENT_RECEIVED_INTERNAL_ERROR');
    }

  } else {
    res.setHeader('Allow', ['GET', 'POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}