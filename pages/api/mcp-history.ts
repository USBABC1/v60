// pages/api/mcp-history.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getDbPool } from '@/lib/db-mysql';
import mysql from 'mysql2/promise';

interface DbHistoryMessage { role: 'system' | 'user' | 'assistant' | 'tool' | 'function'; content: string | null; tool_call_id?: string | null; name?: string | null; message_order?: number; }
const MAX_HISTORY_FETCH_LIMIT = 50;

export default async function handler( req: NextApiRequest, res: NextApiResponse<DbHistoryMessage[] | { error: string } | { success: boolean }> ) {
  const sessionId = (req.headers['x-session-id'] as string) || (req.query.sessionId as string);

  if (!sessionId) { return res.status(400).json({ error: 'X-Session-ID header or sessionId query parameter is required.' }); }

  const dbPool = getDbPool();
  if (!dbPool) { console.error("[API McpHistory] Falha pool."); return res.status(500).json({ error: 'Internal server error (DB Pool)' }); }

  try {
    if (req.method === 'GET') {
      // Buscar histórico
      const [rows] = await dbPool.query<mysql.RowDataPacket[]>( `SELECT role, content, tool_call_id, name, message_order FROM mcp_conversation_history WHERE session_id = ? ORDER BY message_order ASC LIMIT ?`, [sessionId, MAX_HISTORY_FETCH_LIMIT] );
      res.status(200).json(rows as DbHistoryMessage[]);

    } else if (req.method === 'DELETE') {
      // Deletar histórico
      console.log(`[API McpHistory] Recebido DELETE para Session ID: ${sessionId}`);
      const [result] = await dbPool.query<mysql.OkPacket>( `DELETE FROM mcp_conversation_history WHERE session_id = ?`, [sessionId] );
      console.log(`[API McpHistory] ${result.affectedRows} linhas deletadas para Session ID: ${sessionId}`);
      res.status(200).json({ success: result.affectedRows > 0 });

    } else {
      // Método não permitido
      res.setHeader('Allow', ['GET', 'DELETE']);
      res.status(405).json({ error: 'Method Not Allowed' });
    }
  } catch (error: any) {
      if (error.code === 'ER_NO_SUCH_TABLE') {
          console.warn(`[API McpHistory] Tabela mcp_conversation_history não encontrada. Retornando vazio/sucesso em operações.`);
          if (req.method === 'GET') return res.status(200).json([]);
          if (req.method === 'DELETE') return res.status(200).json({ success: true }); // Considerar sucesso se a tabela não existe
      }
      console.error(`[API McpHistory] Erro no handler para ${sessionId}:`, error);
      res.status(500).json({ error: `Internal server error: ${error.message}` });
  }
}
