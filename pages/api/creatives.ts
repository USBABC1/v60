// pages/api/creatives.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto'; // Mantenha se usar para gerar ID
import { getDbPool, initializeCreativesTable, initializeCampaignsTable } from '@/lib/db-mysql'; // <<< MUDE A IMPORTAÇÃO
import mysql from 'mysql2/promise';

// Tipagem básica - idealmente importe de @/entities/Creative se tiver
interface CreativeInput {
    name: string;
    campaign_id?: string | null;
    type: string; // 'image', 'video', etc.
    content?: string;
    comments?: string | null;
    status?: string;
    platform?: string[] | string | null; // Pode ser array ou string JSON
    format?: string | null;
    publish_date?: string | null;
    originalFilename?: string | null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        const dbPool = getDbPool();
        if (!dbPool) throw new Error("Falha ao obter pool de conexão MySQL.");

        // Garante que as tabelas necessárias existam
        // await initializeCampaignsTable(); // Garante que a tabela referenciada existe
        await initializeCreativesTable(); // Garante que esta tabela existe

        // --- GET ---
        if (req.method === 'GET') {
            const { id, campaign_id } = req.query; // Renomeado campaignIdFilter para campaign_id

            if (id) {
                // Buscar por ID
                const [rows] = await dbPool.query<mysql.RowDataPacket[]>(
                    'SELECT * FROM creatives WHERE id = ?',
                    [id]
                );
                if (rows.length > 0) {
                    // Deserializar platform se for JSON
                    const creative = rows[0];
                    try {
                        if (creative.platform && typeof creative.platform === 'string') {
                             creative.platform = JSON.parse(creative.platform);
                        }
                    } catch (e) { console.warn(`Creative ${id}: Falha ao parsear platform JSON`); creative.platform = null; } // Lida com JSON inválido
                    res.status(200).json(creative);
                } else {
                    res.status(404).json({ message: 'Criativo não encontrado' });
                }
            } else {
                // Listar (com filtro opcional por campanha)
                let query = 'SELECT * FROM creatives';
                const params: (string | null)[] = [];

                if (campaign_id) {
                    if (campaign_id === 'none') {
                        query += ' WHERE campaign_id IS NULL';
                    } else {
                        query += ' WHERE campaign_id = ?';
                        params.push(campaign_id as string);
                    }
                }
                query += ' ORDER BY created_at DESC, name ASC';

                const [rows] = await dbPool.query<mysql.RowDataPacket[]>(query, params);
                 // Deserializar platform para cada item
                 const creatives = rows.map(c => {
                     try {
                         if (c.platform && typeof c.platform === 'string') {
                              c.platform = JSON.parse(c.platform);
                         } else if (!Array.isArray(c.platform)){ // Se não for string JSON e nem array, define como null
                            c.platform = null;
                         }
                     } catch (e) { console.warn(`List Creatives: Falha ao parsear platform JSON para ID ${c.id}`); c.platform = null; }
                     return c;
                 });
                res.status(200).json(creatives);
            }
        }
        // --- POST ---
        else if (req.method === 'POST') {
            const { name, campaign_id, type, content, comments, status, platform, format, publish_date, originalFilename }: CreativeInput = req.body;
            const id = crypto.randomUUID(); // Gera um UUID

            if (!name || !type) {
                return res.status(400).json({ message: 'Nome e Tipo são obrigatórios.' });
            }

            // Garante que content seja string, e comments seja null se vazio
            const safeContent = content || '';
            const safeComments = comments?.trim() ? comments : null;
            // Garante que platform seja string JSON ou null
            const platformJson = Array.isArray(platform) ? JSON.stringify(platform) : typeof platform === 'string' ? platform : null;

             // Tratar data de publicação
             let publishDateIso: string | null = null;
             if (publish_date) {
                 try {
                     publishDateIso = new Date(publish_date).toISOString().slice(0, 19).replace('T', ' '); // Formato MySQL TIMESTAMP
                 } catch (dateError) {
                     console.warn("Data de publicação inválida recebida:", publish_date);
                     // Opcional: retornar erro 400 ou apenas ignorar a data
                 }
             }

            const sql = `
                INSERT INTO creatives
                (id, name, campaign_id, type, content, comments, status, platform, format, publish_date, originalFilename)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            const params = [
                id, name, campaign_id || null, type, safeContent, safeComments, status || 'draft',
                platformJson, format || null, publishDateIso, originalFilename || null
            ];

            console.log("[API Creatives POST] SQL:", sql);
            console.log("[API Creatives POST] Params:", params);

            await dbPool.query(sql, params);

            // Busca o criativo criado para retornar
            const [newCreativeRows] = await dbPool.query<mysql.RowDataPacket[]>('SELECT * FROM creatives WHERE id = ?', [id]);
            if (newCreativeRows.length > 0) {
                 const createdCreative = newCreativeRows[0];
                 // Deserializar platform antes de retornar
                 try {
                    if (createdCreative.platform && typeof createdCreative.platform === 'string') {
                         createdCreative.platform = JSON.parse(createdCreative.platform);
                    }
                 } catch (e) { createdCreative.platform = null; }
                 res.status(201).json(createdCreative);
            } else {
                 res.status(500).json({ message: "Erro ao buscar criativo após criação" });
            }

        }
        // --- PUT ---
        else if (req.method === 'PUT') {
             const { id } = req.query;
             const { name, campaign_id, type, content, comments, status, platform, format, publish_date, originalFilename }: Partial<CreativeInput> = req.body;

             if (!id || typeof id !== 'string') {
                 return res.status(400).json({ message: 'ID do criativo é obrigatório na query string.' });
             }

             const fieldsToUpdate: { [key: string]: any } = {};
             const params: any[] = [];
             const addUpdateField = (fieldName: string, value: any, defaultValue: any = null) => {
                // Só adiciona se o valor foi realmente passado no body
                 if (value !== undefined) {
                     let valueToSave = value ?? defaultValue;
                     // Tratamentos especiais
                     if (fieldName === 'platform' && Array.isArray(valueToSave)) { valueToSave = JSON.stringify(valueToSave); }
                     else if (fieldName === 'campaign_id' && (valueToSave === 'none' || valueToSave === '')) { valueToSave = null; }
                     else if (fieldName === 'publish_date' && valueToSave !== null && valueToSave !== '') {
                          try { valueToSave = new Date(valueToSave).toISOString().slice(0, 19).replace('T', ' '); } catch (dateError) { valueToSave = null; }
                     } else if (fieldName === 'publish_date' && (valueToSave === null || valueToSave === '')) { valueToSave = null; }
                     else if (fieldName === 'comments' && valueToSave === '') { valueToSave = null; }

                     fieldsToUpdate[fieldName] = valueToSave;
                 }
             };

             addUpdateField('name', name);
             addUpdateField('campaign_id', campaign_id);
             addUpdateField('type', type);
             addUpdateField('content', content);
             addUpdateField('comments', comments);
             addUpdateField('status', status);
             addUpdateField('platform', platform);
             addUpdateField('format', format);
             addUpdateField('publish_date', publish_date);
             addUpdateField('originalFilename', originalFilename);

             const setClauses = Object.keys(fieldsToUpdate).map(key => `${key} = ?`).join(', ');
             params.push(...Object.values(fieldsToUpdate));
             params.push(id); // ID para o WHERE

             if (setClauses.length === 0) {
                 return res.status(400).json({ message: 'Nenhum campo válido fornecido para atualização.' });
             }

             const sql = `UPDATE creatives SET ${setClauses} WHERE id = ?`;
             console.log("[API Creatives PUT] SQL:", sql);
             console.log("[API Creatives PUT] Params:", params);

             const [result] = await dbPool.query<mysql.ResultSetHeader>(sql, params);

             if (result.affectedRows === 0) {
                 return res.status(404).json({ message: 'Criativo não encontrado para atualização.' });
             }

             // Busca o criativo atualizado
            const [updatedCreativeRows] = await dbPool.query<mysql.RowDataPacket[]>('SELECT * FROM creatives WHERE id = ?', [id]);
             if (updatedCreativeRows.length > 0) {
                  const updatedCreative = updatedCreativeRows[0];
                  // Deserializar platform antes de retornar
                  try {
                     if (updatedCreative.platform && typeof updatedCreative.platform === 'string') {
                          updatedCreative.platform = JSON.parse(updatedCreative.platform);
                     }
                  } catch (e) { updatedCreative.platform = null; }
                  res.status(200).json(updatedCreative);
             } else {
                  res.status(404).json({ message: 'Criativo não encontrado após atualização.' });
             }

        }
         // --- DELETE ---
         else if (req.method === 'DELETE') {
             const { id } = req.query;
             if (!id || typeof id !== 'string') {
                 return res.status(400).json({ message: 'ID do criativo é obrigatório.' });
             }

             const [result] = await dbPool.query<mysql.ResultSetHeader>('DELETE FROM creatives WHERE id = ?', [id]);

             if (result.affectedRows === 0) {
                 return res.status(404).json({ message: 'Criativo não encontrado para exclusão.' });
             }
             res.status(204).end(); // Sem conteúdo

        } else {
            res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
            res.status(405).json({ error: `Método ${req.method} não permitido` });
        }

    } catch (err: any) {
        console.error('Erro na API /api/creatives com MySQL:', err);
        res.status(500).json({ error: 'Erro interno do servidor', details: err?.message ?? 'Erro desconhecido' });
    }
    // Não feche o pool
}
