// pages/api/alerts.ts
import type { NextApiRequest, NextApiResponse } from 'next';
// <<< USA initializeAllTables (embora não estritamente necessário aqui, mas seguro) >>>
import { getDbPool, initializeAllTables } from '@/lib/db-mysql';
import mysql from 'mysql2/promise';

// Tipagem básica
interface AlertInput {
    message: string;
    type: string;
    campaignId?: string | null;
    metric?: string | null;
    value?: number | null;
    threshold?: number | null;
    read?: boolean; // Para o corpo do PUT
}
interface Alert {
    id: number;
    type: string;
    message: string;
    metric?: string | null;
    value?: number | null;
    threshold?: number | null;
    created_date: string; // Ou usar created_at?
    read: boolean; // <<< Usa 'read' no tipo retornado
    campaignId?: string | null;
    campaignName?: string; // Para o JOIN no GET
}
type ResponseData = Alert[] | Alert | { message: string; error?: string } | { id: number, read: boolean } | { message: string }; // Adicionado { message: string } para DELETE

export default async function handler(req: NextApiRequest, res: NextApiResponse<ResponseData>) {
  try {
    const dbPool = getDbPool();
    if (!dbPool) throw new Error("Falha ao obter pool de conexão MySQL.");

    // Garante tabelas (pode ser removido se já garantido no login/registro)
    // await initializeAllTables();

    if (req.method === 'GET') {
        // Busca todos os alertas com nome da campanha, ordenados
        // <<< CORRIGIDO: Seleciona is_read >>>
        const sql = `
            SELECT a.*, c.name as campaignName
            FROM alerts a
            LEFT JOIN campaigns c ON a.campaignId = c.id
            ORDER BY a.created_date DESC
        `;
        const [rows] = await dbPool.query<mysql.RowDataPacket[]>(sql);
        // Converte o valor 'is_read' de 0/1 para true/false e renomeia para 'read'
        const alerts = rows.map(row => {
            const { is_read, ...rest } = row; // Separa is_read
            return {
                ...rest,
                read: Boolean(is_read) // Cria a propriedade 'read' como booleano
            };
        });
        res.status(200).json(alerts as Alert[]);

    } else if (req.method === 'POST') {
        const { message, type, campaignId, metric, value, threshold }: AlertInput = req.body;

        if (!message || !type) {
            return res.status(400).json({ message: 'Mensagem e tipo são obrigatórios' });
        }

        // <<< CORRIGIDO: Insere em is_read >>>
        const sql = `
            INSERT INTO alerts (message, type, campaignId, metric, value, threshold, is_read)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        // Usa FALSE para MySQL boolean
        const params = [message, type, campaignId || null, metric || null, value ?? null, threshold ?? null, false];

        const [result] = await dbPool.query<mysql.ResultSetHeader>(sql, params);
        const newAlertId = result.insertId;

        // Busca o alerta criado para retornar
        const [newAlertRows] = await dbPool.query<mysql.RowDataPacket[]>('SELECT * FROM alerts WHERE id = ?', [newAlertId]);
        if(newAlertRows.length > 0){
            const newAlert = newAlertRows[0];
            // Converte is_read para read ao retornar
            const { is_read, ...rest } = newAlert;
            res.status(201).json({ ...rest, read: Boolean(is_read) } as Alert);
        } else {
             res.status(500).json({ message: 'Erro ao buscar alerta recém-criado' });
        }

    } else if (req.method === 'PUT') { // Para marcar como lido/não lido
         const { id } = req.query;
         const { read: readStatus } = req.body; // Pega a propriedade 'read' do corpo

         if (!id || typeof id !== 'string' || isNaN(parseInt(id, 10))) {
             return res.status(400).json({ message: 'ID do alerta válido é obrigatório na query string.' });
         }
         if (typeof readStatus !== 'boolean') { // Verifica o valor booleano recebido
             return res.status(400).json({ message: "A propriedade 'read' (boolean) é obrigatória no corpo da requisição." });
         }
         const alertId = parseInt(id, 10);

         // <<< CORRIGIDO: Atualiza is_read >>>
         const sql = 'UPDATE alerts SET is_read = ? WHERE id = ?';
         const params = [readStatus, alertId]; // Usa o valor booleano diretamente

         const [result] = await dbPool.query<mysql.ResultSetHeader>(sql, params);

         if (result.affectedRows === 0) {
              return res.status(404).json({ message: `Alerta com ID ${alertId} não encontrado.` });
         }
         // Retorna o ID e o status 'read' atualizado (como booleano)
         res.status(200).json({ id: alertId, read: readStatus });

    } else if (req.method === 'DELETE') { // Para deletar
         const { id } = req.query;
         if (!id || typeof id !== 'string' || isNaN(parseInt(id, 10))) {
              return res.status(400).json({ message: 'ID do alerta válido é obrigatório na query string.' });
         }
         const alertId = parseInt(id, 10);

         const [result] = await dbPool.query<mysql.ResultSetHeader>('DELETE FROM alerts WHERE id = ?', [alertId]);

         if (result.affectedRows === 0) {
             return res.status(404).json({ message: `Alerta com ID ${alertId} não encontrado.` });
         }
          res.status(200).json({ message: `Alerta ${alertId} excluído com sucesso.` }); // Mudado para 200 com mensagem

    } else {
        res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
        res.status(405).json({ message: `Method ${req.method} Not Allowed` });
    }
  } catch (error: any) {
    console.error(`[API Alerts ${req?.method || 'Unknown'}] Erro geral:`, error);
    res.status(500).json({ message: 'Erro interno do servidor ao processar alertas.', error: error.message });
  }
}
