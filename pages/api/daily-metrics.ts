// pages/api/daily-metrics.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getDbPool, initializeAllTables } from '@/lib/db-mysql';
import mysql from 'mysql2/promise';
import { isValid, parseISO, format } from 'date-fns';

// Tipo esperado no corpo da requisição POST
interface DailyMetricInput {
    campaign_id: string;
    date: string; // Espera formato YYYY-MM-DD
    clicks?: number;
    impressions?: number;
    conversions?: number;
    cost?: number;
    revenue?: number;
}

type PostResponse = {
    message: string;
    insertedId?: number | string;
    error?: string;
    code?: string;
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<PostResponse>
) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ message: `Method ${req.method} Not Allowed`, error: 'Only POST is allowed' });
    }

    let dbPool: mysql.Pool | null = null;
    try {
        dbPool = getDbPool();
        if (!dbPool) throw new Error("Falha ao obter pool de conexão MySQL.");

        // Garante que as tabelas existam
        await initializeAllTables();

        const {
            campaign_id,
            date: dateStr,
            clicks,
            impressions,
            conversions,
            cost,
            revenue
        }: DailyMetricInput = req.body;

        // Validações
        if (!campaign_id || !dateStr) {
            return res.status(400).json({ message: "campaign_id e date são obrigatórios.", error: "Dados inválidos" });
        }
        const metricDate = parseISO(dateStr);
        if (!isValid(metricDate)) {
            return res.status(400).json({ message: "Formato de data inválido. Use YYYY-MM-DD.", error: "Data inválida" });
        }
        const metricDateSql = format(metricDate, 'yyyy-MM-dd'); // Garante formato correto para SQL

        // Usa INSERT ... ON DUPLICATE KEY UPDATE para inserir ou atualizar
        // Se já existir um registro para a mesma campaign_id e metric_date, ele atualiza os valores.
        const sql = `
            INSERT INTO daily_metrics
                (campaign_id, metric_date, clicks, impressions, conversions, cost, revenue)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                clicks = VALUES(clicks),
                impressions = VALUES(impressions),
                conversions = VALUES(conversions),
                cost = VALUES(cost),
                revenue = VALUES(revenue),
                updated_at = CURRENT_TIMESTAMP;
        `;

        const params = [
            campaign_id,
            metricDateSql,
            clicks ?? 0,
            impressions ?? 0,
            conversions ?? 0,
            cost ?? 0.00,
            revenue ?? 0.00
        ];

        console.log("[API DailyMetrics POST] SQL:", sql);
        console.log("[API DailyMetrics POST] Params:", params);

        const [result] = await dbPool.query<mysql.ResultSetHeader>(sql, params);

        if (result.affectedRows > 0 || result.warningStatus === 0) { // Sucesso se inseriu ou atualizou
             const message = result.insertId > 0 ? "Métrica diária inserida com sucesso." : "Métrica diária atualizada com sucesso.";
             console.log(`[API DailyMetrics POST] ${message} ID: ${result.insertId || campaign_id +'/'+ metricDateSql}`);
             res.status(result.insertId > 0 ? 201 : 200).json({ message: message, insertedId: result.insertId || `${campaign_id}/${metricDateSql}` });
        } else {
             console.error("[API DailyMetrics POST] Nenhuma linha afetada.", result);
             res.status(500).json({ message: "Falha ao salvar métrica diária, nenhuma linha afetada.", error: "DB Error" });
        }

    } catch (error: any) {
        console.error(`[API DailyMetrics POST] Erro geral:`, error);
         // Trata erro específico de chave estrangeira (campanha não existe)
         const isFkError = error.code === 'ER_NO_REFERENCED_ROW_2';
         const status = isFkError ? 400 : 500;
         const message = isFkError ? `Campanha com ID ${req.body.campaign_id} não encontrada.` : 'Erro interno do servidor ao salvar métrica.';
        res.status(status).json({ message: message, error: error.message, code: error.code });
    }
}
