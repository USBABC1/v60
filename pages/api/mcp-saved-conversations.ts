// pages/api/mcp-saved-conversations.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getDbPool, initializeAllTables } from '@/lib/db-mysql'; // Importar initializeAllTables
import mysql from 'mysql2/promise';
import jwt from 'jsonwebtoken'; // Para verificar o token e obter o user_id

// Tipo para uma conversa salva
interface SavedConversation {
    id: number;
    user_id: number;
    session_id: string;
    name: string;
    created_at: string; // Ou Date
}

// Middleware de autenticação simples para obter o user_id do JWT
const authenticate = (req: NextApiRequest): number | null => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return null;

    const token = authHeader.split(' ')[1];
    if (!token) return null;

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as { userId: number; [key: string]: any };
        return decoded.userId;
    } catch (error) {
        console.error("Erro ao verificar JWT:", error);
        return null;
    }
};


export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<SavedConversation[] | SavedConversation | { success: boolean; message?: string } | { error: string }>
) {
    // ADICIONADO: Garantir que todas as tabelas sejam inicializadas antes de qualquer operação de DB
    try {
        await initializeAllTables();
    } catch (dbInitError) {
        console.error("[API McpSavedConversations] Erro CRÍTICO durante a inicialização do DB:", dbInitError);
        return res.status(500).json({ error: 'Internal server error: Database initialization failed.' });
    }


    const userId = authenticate(req);

    if (userId === null) {
        return res.status(401).json({ error: 'Não autenticado.' });
    }

    const dbPool = getDbPool();
    if (!dbPool) {
        console.error("[API McpSavedConversations] Falha pool (após init).");
        return res.status(500).json({ error: 'Internal server error (DB Pool) after initialization.' });
    }

    try {
        if (req.method === 'GET') {
            // Listar conversas salvas do usuário
            console.log(`[API McpSavedConversations] Recebido GET para User ID: ${userId}`);
            // Modificamos a query GET para aceitar ?id=... para carregar uma conversa específica
            const savedConversationId = req.query.id as string;

            if (savedConversationId) {
                 // Buscar uma conversa salva específica pelo ID (e garantir que pertença ao usuário)
                 console.log(`[API McpSavedConversations] Buscando conversa salva por ID: ${savedConversationId}`);
                 const [rows] = await dbPool.query<mysql.RowDataPacket[]>(
                     `SELECT id, user_id, session_id, name, created_at FROM mcp_saved_conversations WHERE id = ? AND user_id = ?`,
                     [savedConversationId, userId]
                 );
                 // Retorna um array com 0 ou 1 resultado
                 res.status(200).json(rows as SavedConversation[]);

            } else {
                // Listar todas as conversas salvas do usuário
                const [rows] = await dbPool.query<mysql.RowDataPacket[]>(
                    `SELECT id, user_id, session_id, name, created_at FROM mcp_saved_conversations WHERE user_id = ? ORDER BY created_at DESC`,
                    [userId]
                );
                res.status(200).json(rows as SavedConversation[]);
            }


        } else if (req.method === 'POST') {
            // Salvar a conversa atual
            const { sessionId, name } = req.body;
            console.log(`[API McpSavedConversations] Recebido POST para User ID: ${userId}, Session ID: ${sessionId}, Name: "${name}"`);

            if (!sessionId || !name) {
                return res.status(400).json({ error: 'Session ID e nome são obrigatórios.' });
            }

            try {
                const [result] = await dbPool.query<mysql.OkPacket>(
                    `INSERT INTO mcp_saved_conversations (user_id, session_id, name) VALUES (?, ?, ?)`,
                    [userId, sessionId, name]
                );
                console.log(`[API McpSavedConversations] Conversa salva (ID: ${result.insertId}).`);
                // Retornar o item salvo completo
                const [newRows] = await dbPool.query<mysql.RowDataPacket[]>(
                     `SELECT id, user_id, session_id, name, created_at FROM mcp_saved_conversations WHERE id = ?`,
                     [result.insertId]
                );
                 res.status(201).json(newRows[0] as SavedConversation);

            } catch (error: any) {
                if (error.code === 'ER_DUP_ENTRY') {
                    // Tratar caso de nome ou session_id duplicado para o usuário
                    if (error.message.includes('unique_user_name')) {
                         return res.status(409).json({ success: false, message: `Já existe uma conversa salva com o nome "${name}".` });
                    }
                     if (error.message.includes('unique_user_session')) {
                         return res.status(409).json({ success: false, message: `Esta conversa (Session ID: ${sessionId}) já foi salva.` });
                    }
                }
                console.error("[API McpSavedConversations] Erro ao salvar conversa:", error);
                return res.status(500).json({ error: `Erro ao salvar conversa: ${error.message}` });
            }

        } else if (req.method === 'DELETE') {
            // Deletar uma conversa salva específica
            const { savedConversationId } = req.query;
            console.log(`[API McpSavedConversations] Recebido DELETE para Saved Conversation ID: ${savedConversationId}, User ID: ${userId}`);

            if (!savedConversationId) {
                return res.status(400).json({ error: 'ID da conversa salva é obrigatório.' });
            }

            const [result] = await dbPool.query<mysql.OkPacket>(
                `DELETE FROM mcp_saved_conversations WHERE id = ? AND user_id = ?`,
                [savedConversationId, userId]
            );

            if (result.affectedRows > 0) {
                console.log(`[API McpSavedConversations] Conversa salva (ID: ${savedConversationId}) deletada.`);
                res.status(200).json({ success: true });
            } else {
                // Pode ser que o ID não exista ou não pertença ao usuário
                res.status(404).json({ success: false, message: 'Conversa salva não encontrada ou não pertence ao usuário.' });
            }

        } else {
            // Método não permitido
            res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
            res.status(405).json({ error: 'Method Not Allowed' });
        }
    } catch (error: any) {
        // Captura erros que não foram tratados nos blocos try/catch específicos
        console.error(`[API McpSavedConversations] Erro no handler geral:`, error);
        // Verifica se o erro é ER_NO_SUCH_TABLE novamente, caso a inicialização tenha falhado por algum motivo
        if (error.code === 'ER_NO_SUCH_TABLE') {
             console.warn(`[API McpSavedConversations] Tabela mcp_saved_conversations não encontrada durante a operação. A inicialização deveria ter ocorrido.`);
             return res.status(500).json({ error: 'Internal server error: Database table not found. Initialization may have failed.' });
        }
        res.status(500).json({ error: `Internal server error: ${error.message}` });
    }
}
