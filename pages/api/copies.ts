// pages/api/copies.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
// <<< MUDE AS IMPORTAÇÕES DO BANCO DE DADOS >>>
import { getDbPool, initializeCopiesTable, initializeCampaignsTable } from '@/lib/db-mysql';
import mysql from 'mysql2/promise';

// Interface (ajustada para nomes de colunas MySQL)
interface CopyInput {
    title: string;
    content: string;
    cta?: string | null; // Tornando opcional para refletir DB
    target_audience?: string | null;
    status?: string | null;
    campaign_id?: string | null;
    clicks?: number | null;
    impressions?: number | null;
    conversions?: number | null;
}
interface Copy extends CopyInput {
    id: string;
    created_date: string; // Ou usar created_at do MySQL?
    updated_at: string;
}
type ResponseData = Copy[] | Copy | { message: string; error?: string } | { message: string };


export default async function handler(req: NextApiRequest, res: NextApiResponse<ResponseData>) {
  try {
    const dbPool = getDbPool();
    if (!dbPool) throw new Error("Falha ao obter pool de conexão MySQL.");

    // Garante tabelas
    // await initializeCampaignsTable(); // Necessário para FK
    await initializeCopiesTable();

    switch (req.method) {
      case 'GET':
        const { campaign_id: getCampaignId } = req.query;
        let query = 'SELECT * FROM copies';
        const params: string[] = [];

        if (getCampaignId) {
            query += ' WHERE campaign_id = ?';
            params.push(getCampaignId as string);
        }
        query += ' ORDER BY created_date DESC'; // Ou updated_at

        const [rows] = await dbPool.query<mysql.RowDataPacket[]>(query, params);
        res.status(200).json(rows as Copy[]);
        break;

      case 'POST':
        const { title, content, cta, target_audience, status, campaign_id }: CopyInput = req.body;

        if (!title || !content) { // CTA pode ser opcional dependendo da tabela
          return res.status(400).json({ message: 'Título e Conteúdo são obrigatórios.' });
        }

        const id = crypto.randomUUID();
        // Usar CURRENT_TIMESTAMP do MySQL para created_date e updated_at

        const sql = `
            INSERT INTO copies (id, title, content, cta, target_audience, status, campaign_id, clicks, impressions, conversions)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        // Mapeia os valores, usando NULL para opcionais não fornecidos
        const postParams = [
            id, title, content, cta ?? null, target_audience ?? null, status ?? 'draft',
            campaign_id || null, 0, 0, 0 // Defaults para métricas
        ];

        await dbPool.query(sql, postParams);

        // Busca a cópia criada
        const [newCopyRows] = await dbPool.query<mysql.RowDataPacket[]>('SELECT * FROM copies WHERE id = ?', [id]);
         if (newCopyRows.length > 0) {
            res.status(201).json(newCopyRows[0] as Copy);
         } else {
             res.status(500).json({ message: "Erro ao buscar cópia recém-criada" });
         }
        break;

      case 'PUT':
            const { id: updateIdQuery } = req.query;
            const updateData: Partial<CopyInput> = req.body;

            if (!updateIdQuery || typeof updateIdQuery !== 'string') {
              return res.status(400).json({ message: 'ID da cópia é obrigatório para atualização.' });
            }
            const copyIdToUpdate = updateIdQuery;

            const fieldsToUpdate: { [key: string]: any } = {};
            const putParams: any[] = [];
             const addUpdateField = (fieldName: string, value: any) => {
                if (value !== undefined) { // Só atualiza se o campo foi passado
                    fieldsToUpdate[fieldName] = value === '' ? null : value; // Trata string vazia como NULL?
                }
             };

             addUpdateField('title', updateData.title);
             addUpdateField('content', updateData.content);
             addUpdateField('cta', updateData.cta);
             addUpdateField('target_audience', updateData.target_audience);
             addUpdateField('status', updateData.status);
             addUpdateField('campaign_id', updateData.campaign_id === 'none' ? null : updateData.campaign_id);
             addUpdateField('clicks', updateData.clicks);
             addUpdateField('impressions', updateData.impressions);
             addUpdateField('conversions', updateData.conversions);


            if (Object.keys(fieldsToUpdate).length === 0) {
              return res.status(400).json({ message: 'Nenhum campo fornecido para atualização.' });
            }

            const setClauses = Object.keys(fieldsToUpdate).map(key => `${dbPool.escapeId(key)} = ?`).join(', ');
            putParams.push(...Object.values(fieldsToUpdate));
            putParams.push(copyIdToUpdate); // ID para o WHERE

            const updateSql = `UPDATE copies SET ${setClauses} WHERE id = ?`;
            const [result] = await dbPool.query<mysql.ResultSetHeader>(updateSql, putParams);

            if (result.affectedRows === 0) {
                 const [checkRows] = await dbPool.query<mysql.RowDataPacket[]>('SELECT id FROM copies WHERE id = ?', [copyIdToUpdate]);
                 if(checkRows.length === 0) {
                    return res.status(404).json({ message: `Cópia com ID ${copyIdToUpdate} não encontrada.` });
                 } else {
                     // Nenhuma linha afetada, mas existe -> retorna o atual sem erro?
                     const [currentCopy] = await dbPool.query<mysql.RowDataPacket[]>('SELECT * FROM copies WHERE id = ?', [copyIdToUpdate]);
                     return res.status(200).json(currentCopy[0] as Copy);
                 }
            }

            // Busca a cópia atualizada
            const [updatedCopyRows] = await dbPool.query<mysql.RowDataPacket[]>('SELECT * FROM copies WHERE id = ?', [copyIdToUpdate]);
            if (updatedCopyRows.length > 0) {
                 res.status(200).json(updatedCopyRows[0] as Copy);
            } else {
                res.status(404).json({ message: 'Cópia não encontrada após atualização.'});
            }
        break;

      case 'DELETE':
        const { id: deleteIdQuery } = req.query;
        if (!deleteIdQuery || typeof deleteIdQuery !== 'string') {
            return res.status(400).json({ message: 'ID da cópia é obrigatório para exclusão.' });
        }
        const copyIdToDelete = deleteIdQuery;

        const [deleteResult] = await dbPool.query<mysql.ResultSetHeader>('DELETE FROM copies WHERE id = ?', [copyIdToDelete]);

        if (deleteResult.affectedRows === 0) {
            return res.status(404).json({ message: `Cópia com ID ${copyIdToDelete} não encontrada.` });
        }
        res.status(200).json({ message: `Cópia ${copyIdToDelete} excluída com sucesso.` });
        break;

      default:
        res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
        res.status(405).json({ message: `Method ${req.method} Not Allowed`});
    }
  } catch (error: any) {
    console.error(`[API Copies ${req?.method || 'Unknown'}] Erro geral:`, error);
    res.status(500).json({ message: 'Erro interno do servidor', error: error.message });
  }
  // Não feche o pool
}
