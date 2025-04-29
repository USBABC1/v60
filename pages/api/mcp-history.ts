// pages/api/mcp-history.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getDbPool } from '@/lib/db-mysql';
import mysql from 'mysql2/promise';

// Reutiliza o tipo simples para mensagens do DB
interface DbHistoryMessage {
    role: 'system' | 'user' | 'assistant' | 'tool' | 'function';
    content: string | null;
    tool_call_id?: string | null;
    name?: string | null;
    message_order?: number;
}

const MAX_HISTORY_FETCH_LIMIT = 50; // Limite de mensagens a buscar

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<DbHistoryMessage[] | { error: string }>
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Pega o sessionId do header (preferencial) ou query param
  const sessionId = (req.headers['x-session-id'] as string) || (req.query.sessionId as string);

  if (!sessionId) {
    return res.status(400).json({ error: 'X-Session-ID header or sessionId query parameter is required.' });
  }

  const dbPool = getDbPool();
  if (!dbPool) {
    console.error("[API McpHistory] Falha ao obter pool de conexão.");
    return res.status(500).json({ error: 'Internal server error (DB Pool)' });
  }

  try {
    // Busca as mensagens ordenadas pela ordem (message_order)
    const [rows] = await dbPool.query<mysql.RowDataPacket[]>(
      `SELECT role, content, tool_call_id, name, message_order
       FROM mcp_conversation_history
       WHERE session_id = ?
       ORDER BY message_order ASC
       LIMIT ?`, // Pega as mais recentes pela ordem salva
      [sessionId, MAX_HISTORY_FETCH_LIMIT]
    );

    // Retorna as mensagens como um array do tipo DbHistoryMessage
    res.status(200).json(rows as DbHistoryMessage[]);

  } catch (error: any) {
    // Verifica se o erro é "tabela não existe" e retorna vazio nesse caso
    if (error.code === 'ER_NO_SUCH_TABLE') {
        console.warn(`[API McpHistory] Tabela mcp_conversation_history não encontrada para session ${sessionId}. Retornando vazio.`);
        return res.status(200).json([]); // Retorna array vazio se tabela não existe (primeira vez)
    }
    console.error(`[API McpHistory] Erro ao buscar histórico para session ${sessionId}:`, error);
    res.status(500).json({ error: `Internal server error: ${error.message}` });
  }
  // Pool é gerenciado globalmente, não precisa liberar conexão aqui
}
