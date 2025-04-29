// C:\Users\ADM\Desktop\V10\lib\whatsappBot.js
const { makeWASocket, useMultiFileAuthState, Browsers, proto, fetchLatestBaileysVersion, DisconnectReason, isJidUser, jidNormalizedUser } = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const http = require('http');
const url = require('url');
const axios = require('axios');

const SESSION_DIR = path.resolve(__dirname, '..', 'auth_info');
let sock = null;
let qrCodeData = null;
let connectionStatus = 'disconnected';
let connectionRetryTimeout = null;
let globalResolveConnect = null;
const API_PORT = process.env.WHATSAPP_BOT_API_PORT || 3001;
const NEXTJS_WEBHOOK_URL = process.env.NEXTJS_WEBHOOK_URL || 'http://localhost:3000/api/whatsapp/webhook';
let contactsCache = new Map(); // Usar Map para melhor performance

const pinoOptions = { level: process.env.LOG_LEVEL || 'info' };
if (process.env.NODE_ENV === 'development') {
    try {
        const prettyTarget = require.resolve('pino-pretty');
        pinoOptions.transport = { target: prettyTarget, options: { colorize: true } };
    } catch (err) { console.warn("pino-pretty não encontrado..."); }
}
const logger = pino(pinoOptions);

const getQrCodeInternal = () => qrCodeData;
const getConnectionStatusInternal = () => connectionStatus;

// Função Síncrona para obter contatos do cache
function getContactsFromCacheInternal() {
    const contactsArray = Array.from(contactsCache.values());
    contactsArray.sort((a, b) => (a.notify || a.name || a.jid).localeCompare(b.notify || b.name || b.jid));
    // logger.info(`[CONTACTS CACHE GET] Retornando ${contactsArray.length} contatos do cache.`);
    return contactsArray;
}

function updateContactsCache(newOrUpdatedContacts) {
    if (!Array.isArray(newOrUpdatedContacts)) return;
    let updatedCount = 0; let newCount = 0;
    newOrUpdatedContacts.forEach(contact => {
        if (contact && contact.id && isJidUser(contact.id)) {
            const jid = jidNormalizedUser(contact.id);
            const existingContact = contactsCache.get(jid);
            // Apenas armazena o essencial para a lista
            const formattedContact = {
                jid: jid,
                name: contact.name || undefined, // Armazena undefined se não houver
                notify: contact.notify || undefined, // Armazena undefined se não houver
            };
            // Atualiza apenas se houver mudança real para evitar logs desnecessários
            if (!existingContact || JSON.stringify(existingContact) !== JSON.stringify(formattedContact)) {
                if (existingContact) { updatedCount++; } else { newCount++; }
                contactsCache.set(jid, formattedContact);
            }
        }
    });
    if (newCount > 0 || updatedCount > 0) { logger.info(`[CONTACTS CACHE] Cache atualizado: ${newCount} novos, ${updatedCount} atualizados. Total: ${contactsCache.size}`); }
}

function displayQrInTerminal(qrString) {
    try { qrcode.generate(qrString, { small: true }, (qrVisual) => { console.log('\n---------------- QR Code ----------------'); console.log(qrVisual); console.log('---------------------------------------'); }); logger.info('[CONN] QR Code gerado para exibição no console.'); }
    catch (qrErr) { logger.error('[CONN] Erro ao gerar QR Code:', qrErr); }
}

const ensureSessionDirExists = () => { if (!fs.existsSync(SESSION_DIR)) { fs.mkdirSync(SESSION_DIR, { recursive: true }); logger.info(`[SYS] Diretório de sessão criado: ${SESSION_DIR}`); } };

async function sendWhatsAppMessageInternal(jid, message) {
    if (!sock || connectionStatus !== 'connected') { logger.warn(`[WPP SEND] Falha ao enviar para ${jid}. Status: ${connectionStatus}`); throw new Error(`Bot not connected (status: ${connectionStatus})`); }
    if (!isJidUser(jid)) { logger.warn(`[WPP SEND] JID inválido: ${jid}`); throw new Error(`Invalid JID: ${jid}`); }
    try {
        logger.info(`[WPP SEND] Tentando enviar para ${jid}:`, message);
        await sock.presenceSubscribe(jid);
        await sock.sendPresenceUpdate('composing', jid);
        await new Promise(resolve => setTimeout(resolve, 300));
        const sentMsg = await sock.sendMessage(jid, message);
        await sock.sendPresenceUpdate('paused', jid);
        logger.info(`[WPP SEND] Mensagem enviada para ${jid}. ID: ${sentMsg?.key?.id}`);
        return sentMsg;
    } catch (error) { logger.error(`[WPP SEND] Erro ao enviar mensagem para ${jid}:`, error); throw error; }
}

const clearConnectionRetry = () => { if (connectionRetryTimeout) { clearTimeout(connectionRetryTimeout); connectionRetryTimeout = null; } };
const scheduleConnectionRetry = (delay = 15000) => { clearConnectionRetry(); if (connectionStatus === 'connected' || connectionStatus === 'logging_out') return; connectionRetryTimeout = setTimeout(() => { if (connectionStatus !== 'connected') { logger.warn('[CONN] Tentando reconectar...'); connectToWhatsApp().catch(err => logger.error("[CONN] Falha na reconexão:", err)); } }, delay); };

async function disconnectWhatsApp(manualLogout = false) {
    logger.info(`[CONN] Desconexão solicitada (Manual: ${manualLogout}). Status: ${connectionStatus}`);
    clearConnectionRetry(); contactsCache.clear(); logger.info('[CONTACTS CACHE] Cache de contatos limpo.');
    if (!sock || connectionStatus === 'disconnected') { connectionStatus = 'disconnected'; qrCodeData = null; return; }
    const currentSock = sock; sock = null;
    if (manualLogout) {
        connectionStatus = 'logging_out';
        try { logger.info('[CONN] Tentando logout...'); await currentSock.logout(); logger.info('[CONN] Logout realizado com sucesso.'); if (fs.existsSync(SESSION_DIR)) { fs.rmSync(SESSION_DIR, { recursive: true, force: true }); logger.info(`[SYS] Sessão ${SESSION_DIR} removida.`); } }
        catch (err) { logger.error('[CONN] Erro durante logout:', err); } finally { connectionStatus = 'disconnected'; }
    } else {
        connectionStatus = 'disconnected';
        try { logger.info('[CONN] Encerrando conexão local...'); currentSock.end(new Error('Desconexão local solicitada')); logger.info('[CONN] Conexão local encerrada.'); }
        catch (err) { logger.error('[CONN] Erro ao encerrar conexão local:', err); }
    }
    qrCodeData = null;
    if (currentSock?.ev) { currentSock.ev.removeAllListeners(); logger.info('[CONN] Listeners removidos do socket antigo.'); }
    if (globalResolveConnect) { globalResolveConnect(null); globalResolveConnect = null; }
    logger.info(`[CONN] Estado final após desconexão: ${connectionStatus}`);
}

async function connectToWhatsApp() {
    if (connectionStatus === 'connected' || connectionStatus === 'connecting') { logger.warn(`[CONN] Conexão já em andamento (Status: ${connectionStatus}).`); return Promise.resolve(sock); }
    logger.info('[CONN] Iniciando conexão WhatsApp...');
    connectionStatus = 'connecting'; qrCodeData = null; ensureSessionDirExists(); clearConnectionRetry(); contactsCache.clear();

    try {
        const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
        const { version } = await fetchLatestBaileysVersion();
        logger.info(`[SYS] Usando Baileys v${version.join('.')}`);
        sock = makeWASocket({ version, logger: logger.child({ class: 'baileys' }), printQRInTerminal: false, auth: state, browser: Browsers.ubuntu('Chrome'), shouldIgnoreJid: jid => !isJidUser(jid), getMessage: async key => undefined, syncFullHistory: false, markOnlineOnConnect: true, });

        // --- Gerenciamento de Eventos ---
        sock.ev.on('contacts.upsert', contacts => { logger.info(`[STORE EVENT] contacts.upsert recebido com ${contacts.length} contatos.`); updateContactsCache(contacts); });
        sock.ev.on('contacts.set', ({ contacts }) => { logger.info(`[STORE EVENT] contacts.set recebido com ${contacts.length} contatos. (Re)Inicializando cache.`); contactsCache.clear(); updateContactsCache(contacts); });

        sock.ev.on('connection.update', async (update) => {
            logger.info('[CONN UPDATE RAW]', update);
            const { connection, lastDisconnect, qr } = update;
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const disconnectError = lastDisconnect?.error;
            const errorMessage = disconnectError ? (disconnectError.message || disconnectError.toString()) : 'Motivo desconhecido';
            logger.info(`[CONN UPDATE] Status: ${connection || 'N/A'}, QR: ${!!qr}, LastDisconnect Code: ${statusCode || 'N/A'}`);

            if (qr) { qrCodeData = qr; connectionStatus = 'connecting'; logger.info('[CONN] QR Code recebido.'); displayQrInTerminal(qr); }
            if (connection === 'close') {
                qrCodeData = null; const reasonCode = statusCode || DisconnectReason.connectionClosed;
                const shouldReconnect = reasonCode !== DisconnectReason.loggedOut && reasonCode !== 401;
                logger.error(`[CONN] Conexão fechada! Código: ${reasonCode}, Motivo: ${errorMessage}`);
                if (connectionStatus !== 'logging_out') { connectionStatus = 'disconnected'; }
                contactsCache.clear(); logger.info('[CONTACTS CACHE] Cache de contatos limpo devido à conexão fechada.');
                if (shouldReconnect) { logger.info('[CONN] Agendando tentativa de reconexão...'); scheduleConnectionRetry(); }
                else { logger.info(`[CONN] Desconexão permanente (Código ${reasonCode}). Limpando sessão...`); await disconnectWhatsApp(true); }
            } else if (connection === 'open') {
                qrCodeData = null; connectionStatus = 'connected'; clearConnectionRetry(); logger.info('[CONN] WhatsApp conectado!');
                // Tenta popular o cache inicial AQUI
                if (sock?.store?.contacts) {
                    logger.info('[CONN OPEN] Populando cache inicial com sock.store.contacts...');
                    updateContactsCache(Object.values(sock.store.contacts));
                } else {
                    logger.warn('[CONN OPEN] sock.store.contacts não disponível imediatamente. Cache será populado por eventos.');
                }
                if (globalResolveConnect) { globalResolveConnect(sock); globalResolveConnect = null; }
            }
        });

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('messages.upsert', async ({ messages }) => {
            const msg = messages[0];
            if (!msg.message || msg.key.fromMe || !isJidUser(msg.key.remoteJid)) return;

            const jid = msg.key.remoteJid;
            let userMessage = '';

            if (msg.message.conversation) { userMessage = msg.message.conversation; }
            else if (msg.message.extendedTextMessage?.text) { userMessage = msg.message.extendedTextMessage.text; }
            else if (msg.message.buttonsResponseMessage?.selectedButtonId) { userMessage = msg.message.buttonsResponseMessage.selectedButtonId; }
            else if (msg.message.listResponseMessage?.singleSelectReply?.selectedRowId) { userMessage = msg.message.listResponseMessage.singleSelectReply.selectedRowId; }
            else { logger.info(`[WPP MSG] Recebido tipo não textual/interativo de ${jid}.`); return; }

            if (!userMessage.trim()) { logger.info(`[WPP MSG] Mensagem vazia de ${jid} ignorada.`); return; }

            logger.info(`[WPP MSG] Recebida de ${jid}: "${userMessage}"`);

            try {
                logger.info(`[WPP MSG] Enviando para Webhook Next.js (${NEXTJS_WEBHOOK_URL})...`);
                await axios.post(NEXTJS_WEBHOOK_URL, { sender_id: jid, message: userMessage, }, { headers: { 'Content-Type': 'application/json' }, timeout: 10000 });
                logger.info(`[WPP MSG] Mensagem de ${jid} encaminhada para o webhook com sucesso.`);
            } catch (error) {
                const status = error.response?.status;
                const errorMsg = error.response?.data?.message || error.message || 'Erro desconhecido';
                logger.error(`[WPP MSG] Erro ao enviar para Webhook Next.js (Status: ${status || 'N/A'}): ${errorMsg}`);
            }
        });

        return new Promise((resolve) => { globalResolveConnect = resolve; });
    } catch (error) {
        logger.fatal('[CONN] Erro fatal ao iniciar conexão:', error); connectionStatus = 'disconnected'; qrCodeData = null;
        if (sock?.ev) { sock.ev.removeAllListeners(); } sock = null; contactsCache.clear(); return Promise.resolve(null);
    }
}

// --- Servidor API Interno ---
const apiServer = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url || '', true);
    res.setHeader('Access-Control-Allow-Origin', '*'); res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS'); res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    try {
        if (req.method === 'GET' && parsedUrl.pathname === '/status') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: getConnectionStatusInternal(), qrCode: getQrCodeInternal() }));
        }
        else if (req.method === 'POST' && parsedUrl.pathname === '/connect') {
            if (connectionStatus === 'connected' || connectionStatus === 'connecting') {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: `Conexão já ${connectionStatus}.`, status: connectionStatus }));
            } else {
                connectToWhatsApp().catch(err => logger.error("[API /connect] Erro ao iniciar conexão:", err));
                res.writeHead(202, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: 'Solicitação de conexão recebida.' }));
            }
        }
        else if (req.method === 'POST' && parsedUrl.pathname === '/disconnect') {
            await disconnectWhatsApp(true);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ message: 'Desconexão solicitada.' }));
        }
        else if (req.method === 'GET' && parsedUrl.pathname === '/contacts') {
            logger.info(`[API Interna] Recebida requisição GET /contacts`);
            const contacts = getContactsFromCacheInternal(); // Usa a função síncrona
            logger.info(`[API Interna] Retornando ${contacts.length} contatos (do cache) para a API Next.`);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(contacts));
        }
        else if (req.method === 'POST' && parsedUrl.pathname === '/send') {
            let body = '';
            req.on('data', chunk => { body += chunk.toString(); });
            req.on('end', async () => {
                try {
                    const { jid, options } = JSON.parse(body);
                    if (!jid || !options) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        return res.end(JSON.stringify({ success: false, error: 'JID e options são obrigatórios.' }));
                    }
                    const result = await sendWhatsAppMessageInternal(jid, options);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, messageId: result?.key?.id }));
                } catch (error) {
                    logger.error(`[API Interna /send] Erro ao enviar:`, error);
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: error.message || 'Erro interno ao enviar mensagem.' }));
                }
            });
        }
        else {
            logger.warn(`[API Interna] Endpoint não encontrado: ${req.method} ${parsedUrl.pathname}`);
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ message: 'Endpoint não encontrado nesta API interna.' }));
        }
    } catch (error) {
        logger.error(`[API Interna ${req.method} ${parsedUrl.pathname}] Erro inesperado:`, error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Erro interno do servidor no bot.' }));
    }
});

if (require.main === module) {
    logger.info('[SYS] Iniciando bot WhatsApp e servidor API interno...');
    connectToWhatsApp().catch(err => logger.error("[SYS] Falha na tentativa de conexão inicial:", err));
    apiServer.listen(API_PORT, () => { logger.info(`[SYS] Servidor API interno escutando na porta ${API_PORT}`); }).on('error', (err) => { logger.fatal(`[SYS] Falha ao iniciar servidor API na porta ${API_PORT}:`, err); process.exit(1); });
    const gracefulShutdown = async (signal) => { logger.info(`[SYS] Sinal ${signal} recebido. Encerrando bot e servidor...`); clearConnectionRetry(); await disconnectWhatsApp(false).catch(err => logger.error('[SYS] Erro durante desconexão no shutdown:', err)); logger.info('[SYS] Fechando servidor API...'); apiServer.close(() => { logger.info('[SYS] Servidor API interno parado.'); setTimeout(() => { logger.info('[SYS] Encerrando processo.'); process.exit(0); }, 500); }); setTimeout(() => { logger.warn('[SYS] Timeout! Forçando encerramento do processo.'); process.exit(1); }, 5000); };
    process.on('SIGINT', gracefulShutdown); process.on('SIGTERM', gracefulShutdown);
}

// Exporta apenas o essencial, se necessário por outros módulos locais (raro)
module.exports = {
    connectToWhatsApp,
    disconnectWhatsApp,
    getConnectionStatus: getConnectionStatusInternal,
    getQrCode: getQrCodeInternal,
    // getContacts: getContactsFromCacheInternal, // A API /contacts agora usa isso internamente
};
