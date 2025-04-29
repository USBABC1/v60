// pages/api/campaigns.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getDbPool } from '@/lib/db-mysql';
import mysql from 'mysql2/promise';
import crypto from 'crypto';

// Tipagem (ajustada para incluir novos custos)
interface CampaignInput {
    name: string;
    platform?: string | string[] | null;
    objective?: string | string[] | null;
    budget?: number | string | null;
    daily_budget?: number | string | null;
    duration?: number | string | null;
    industry?: string | null;
    targetAudience?: string | null;
    segmentation?: string | null;
    adFormat?: string | string[] | null;
    revenue?: number | null;
    leads?: number | null;
    clicks?: number | null;
    sales?: number | null;
    avgTicket?: number | null;
    purchaseFrequency?: number | null;
    customerLifespan?: number | null;
    status?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    cost_traffic?: number | string | null;
    cost_creative?: number | string | null;
    cost_operational?: number | string | null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   // <<< ADICIONAR LOG AQUI PARA VERIFICAR >>>
   console.log(`[API Campaigns Handler] Received request. Method: ${req.method}, URL: ${req.url}`);
   // <<< FIM DO LOG >>>

   try {
      const dbPool = getDbPool();
      if (!dbPool) {
            console.error("[API Campaigns] Erro Crítico: Falha ao obter pool de conexão MySQL.");
            throw new Error("Falha ao obter pool de conexão MySQL.");
      }

      // --- GET ---
      if (req.method === 'GET') {
            const { id, fields, limit, sort } = req.query;

            if (id && typeof id === 'string') { // Verifica se ID é string
                console.log(`[API Campaigns GET ID] Buscando ID: ${id}`);
                const [rows] = await dbPool.query<mysql.RowDataPacket[]>('SELECT * FROM campaigns WHERE id = ?', [id]);
                if (rows.length > 0) {
                    // Deserializa campos JSON antes de enviar
                    const campaign = { ...rows[0] }; // Copia para modificar
                    try { if (campaign.platform && typeof campaign.platform === 'string') campaign.platform = JSON.parse(campaign.platform); } catch (e) { console.error(`[GET ID ${id}] Erro parse platform: ${e}`); }
                    try { if (campaign.objective && typeof campaign.objective === 'string') campaign.objective = JSON.parse(campaign.objective); } catch (e) { console.error(`[GET ID ${id}] Erro parse objective: ${e}`); }
                    try { if (campaign.adFormat && typeof campaign.adFormat === 'string') campaign.adFormat = JSON.parse(campaign.adFormat); } catch (e) { console.error(`[GET ID ${id}] Erro parse adFormat: ${e}`); }
                    res.status(200).json(campaign);
                } else {
                    console.log(`[API Campaigns GET ID] Campanha ID ${id} não encontrada.`);
                    res.status(404).json({ message: 'Campanha não encontrada' });
                }
            } else {
                // Listar campanhas
                 console.log("[API Campaigns GET List] Listando campanhas...");
                const allowedFields = ['id', 'name', 'platform', 'objective', 'budget', 'daily_budget', 'duration', 'industry', 'targetAudience', 'segmentation', 'adFormat', 'revenue', 'leads', 'clicks', 'sales', 'avgTicket', 'purchaseFrequency', 'customerLifespan', 'status', 'startDate', 'endDate', 'cost_traffic', 'cost_creative', 'cost_operational', 'created_at', 'updated_at'];
                let selectFields = '*';

                if (fields && typeof fields === 'string') {
                    const requestedFields = fields.split(',').map(f => f.trim()).filter(f => allowedFields.includes(f));
                    if (requestedFields.length > 0) { selectFields = requestedFields.map(f => dbPool.escapeId(f)).join(', '); } // Escapa nomes dos campos
                }

                let query = `SELECT ${selectFields} FROM campaigns`;

                // Sorting
                if (sort && typeof sort === 'string') {
                    const [sortField, sortOrder = 'asc'] = sort.split(':');
                    if (allowedFields.includes(sortField) && ['asc', 'desc'].includes(sortOrder.toLowerCase())) { query += ` ORDER BY ${dbPool.escapeId(sortField)} ${sortOrder.toUpperCase()}`; }
                    else { query += ` ORDER BY created_at DESC`; } // Fallback seguro
                } else { query += ` ORDER BY created_at DESC`; } // Padrão

                // Limiting
                const defaultLimit = 50;
                let limitNum = defaultLimit;
                if (limit && typeof limit === 'string' && /^\d+$/.test(limit)) {
                    const requestedLimit = parseInt(limit, 10);
                    if (requestedLimit > 0) limitNum = requestedLimit;
                }
                query += ` LIMIT ${limitNum}`;

                console.log(`[API Campaigns GET List] Executing Query: ${query}`);
                const [rows] = await dbPool.query<mysql.RowDataPacket[]>(query);

                // Deserializa campos JSON para a lista
                const campaigns = rows.map(campaign => {
                    let tempCampaign = { ...campaign };
                    try { if (tempCampaign.platform && typeof tempCampaign.platform === 'string') tempCampaign.platform = JSON.parse(tempCampaign.platform); } catch (e) { console.error(`[GET List] Erro parse platform ID ${tempCampaign.id}: ${e}`); }
                    try { if (tempCampaign.objective && typeof tempCampaign.objective === 'string') tempCampaign.objective = JSON.parse(tempCampaign.objective); } catch (e) { console.error(`[GET List] Erro parse objective ID ${tempCampaign.id}: ${e}`); }
                    try { if (tempCampaign.adFormat && typeof tempCampaign.adFormat === 'string') tempCampaign.adFormat = JSON.parse(tempCampaign.adFormat); } catch (e) { console.error(`[GET List] Erro parse adFormat ID ${tempCampaign.id}: ${e}`); }
                    return tempCampaign;
                });
                res.status(200).json(campaigns);
            }
      }
      // --- POST --- <<<<<<<<<<<<<<<<<<<<<<<<<<<< ADICIONAR ESTE BLOCO
      else if (req.method === 'POST') {
            console.log("[API Campaigns POST] Requisição recebida.");
            const {
                name, platform, objective, budget, daily_budget, duration, industry,
                targetAudience, segmentation, adFormat, revenue, leads, clicks, sales,
                avgTicket, purchaseFrequency, customerLifespan, status, startDate, endDate,
                cost_traffic, cost_creative, cost_operational
            }: CampaignInput = req.body;

            console.log("[API Campaigns POST] Dados recebidos no body:", req.body);

            if (!name || typeof name !== 'string' || name.trim() === '') {
                console.error("[API Campaigns POST] Erro: Nome ausente ou inválido.");
                return res.status(400).json({ error: 'Nome da campanha é obrigatório' });
            }

            const id = crypto.randomUUID();
            let startDateSql: string | null = null;
            if (startDate) { try { startDateSql = new Date(startDate).toISOString().slice(0, 10); } catch { console.warn("[API Campaigns POST] Formato inválido para startDate:", startDate);} }
            let endDateSql: string | null = null;
            if (endDate) { try { endDateSql = new Date(endDate).toISOString().slice(0, 10); } catch { console.warn("[API Campaigns POST] Formato inválido para endDate:", endDate);} }

            const platformJson = platform && Array.isArray(platform) ? JSON.stringify(platform) : null;
            const objectiveJson = objective && Array.isArray(objective) ? JSON.stringify(objective) : null;
            const adFormatJson = adFormat && Array.isArray(adFormat) ? JSON.stringify(adFormat) : null;

            const sql = `
                INSERT INTO campaigns (
                    id, name, platform, objective, budget, daily_budget, duration, industry,
                    targetAudience, segmentation, adFormat, revenue, leads, clicks, sales,
                    avgTicket, purchaseFrequency, customerLifespan, status, startDate, endDate,
                    cost_traffic, cost_creative, cost_operational
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            const params = [
                id, name.trim(),
                platformJson, objectiveJson,
                budget != null && budget !== '' ? Number(budget) : null,
                daily_budget != null && daily_budget !== '' ? Number(daily_budget) : null,
                duration != null && duration !== '' ? Number(duration) : null,
                industry ?? null, targetAudience ?? null, segmentation ?? null,
                adFormatJson,
                revenue ?? 0, leads ?? 0, clicks ?? 0, sales ?? 0,
                avgTicket ?? null, purchaseFrequency ?? null, customerLifespan ?? null,
                status ?? 'draft', startDateSql, endDateSql,
                cost_traffic != null && cost_traffic !== '' ? Number(cost_traffic) : null,
                cost_creative != null && cost_creative !== '' ? Number(cost_creative) : null,
                cost_operational != null && cost_operational !== '' ? Number(cost_operational) : null
            ];

            console.log("[API Campaigns POST] SQL Query:", sql);
            console.log("[API Campaigns POST] Params:", params);

            await dbPool.query(sql, params);
            console.log("[API Campaigns POST] INSERT executado com sucesso. ID:", id);

            const [newCampaignRows] = await dbPool.query<mysql.RowDataPacket[]>('SELECT * FROM campaigns WHERE id = ?', [id]);
            if (newCampaignRows.length > 0) {
                console.log("[API Campaigns POST] Campanha encontrada após INSERT. Retornando 201.");
                const newCampaign = { ...newCampaignRows[0] };
                // Deserializa antes de retornar
                try { if (newCampaign.platform && typeof newCampaign.platform === 'string') newCampaign.platform = JSON.parse(newCampaign.platform); } catch(e){}
                try { if (newCampaign.objective && typeof newCampaign.objective === 'string') newCampaign.objective = JSON.parse(newCampaign.objective); } catch(e){}
                try { if (newCampaign.adFormat && typeof newCampaign.adFormat === 'string') newCampaign.adFormat = JSON.parse(newCampaign.adFormat); } catch(e){}
                res.status(201).json(newCampaign);
            } else {
                console.error("[API Campaigns POST] ERRO: Campanha não encontrada após INSERT!");
                res.status(500).json({ error: "Erro ao buscar campanha recém-criada" });
            }
      }
      // --- PUT --- <<<<<<<<<<<<<<<<<<<<<<<<<<<< ADICIONAR ESTE BLOCO
      else if (req.method === 'PUT') {
            console.log("[API Campaigns PUT] Requisição recebida.");
            // **IMPORTANTE**: Espera-se que o ID venha na query string, não no corpo
            const { id } = req.query;
            const { cost_traffic, cost_creative, cost_operational, ...updateDataRest }: Partial<CampaignInput> & { id?: string } = req.body;
            const updateData = { ...updateDataRest, cost_traffic, cost_creative, cost_operational };

            console.log(`[API Campaigns PUT] ID Recebido na Query: ${id}`);
            console.log("[API Campaigns PUT] Dados recebidos no body:", updateData);

            if (!id || typeof id !== 'string') {
                console.error("[API Campaigns PUT] Erro: ID ausente ou inválido na query.");
                return res.status(400).json({ error: 'ID da campanha (válido) é obrigatório na query string' });
            }
             if (Object.keys(updateData).length === 0) {
                 console.warn("[API Campaigns PUT] Nenhum campo para atualizar no corpo da requisição.");
                 return res.status(400).json({ error: 'Nenhum campo fornecido para atualização.' });
             }

            const fieldsToUpdate: { [key: string]: any } = {};
            const params: any[] = [];
            // Função auxiliar para preparar campos e params
            const addUpdateField = (fieldName: string, value: any, isJson: boolean = false, isDate: boolean = false) => {
                if (value !== undefined) { // Processa mesmo se for null
                    let valueToSave = value;
                    if (value === null || value === '' || value === 'none') { valueToSave = null; }
                    else if (isJson && Array.isArray(value)) { try { valueToSave = JSON.stringify(value); } catch { valueToSave = null; } } // Garante que JSON é stringificado
                    else if (isJson && !(Array.isArray(value) || typeof value === 'string')) { valueToSave = null; } // Invalida JSON não-string/array
                    else if (isDate) { try { valueToSave = new Date(value).toISOString().slice(0, 10); } catch { valueToSave = null; } }
                    else if (['budget', 'daily_budget', 'duration', 'revenue', 'leads', 'clicks', 'sales', 'avgTicket', 'purchaseFrequency', 'customerLifespan', 'cost_traffic', 'cost_creative', 'cost_operational'].includes(fieldName)) {
                         valueToSave = Number(value); if (isNaN(valueToSave)) valueToSave = null;
                     }
                    else if (typeof value === 'string') { valueToSave = value.trim(); }
                    // else value is likely number, boolean - keep as is

                    fieldsToUpdate[fieldName] = valueToSave;
                }
            };

            // Adiciona campos que vieram no corpo (updateData)
            addUpdateField('name', updateData.name);
            addUpdateField('platform', updateData.platform, true);
            addUpdateField('objective', updateData.objective, true);
            addUpdateField('budget', updateData.budget);
            addUpdateField('daily_budget', updateData.daily_budget);
            addUpdateField('duration', updateData.duration);
            addUpdateField('industry', updateData.industry);
            addUpdateField('targetAudience', updateData.targetAudience);
            addUpdateField('segmentation', updateData.segmentation);
            addUpdateField('adFormat', updateData.adFormat, true);
            addUpdateField('revenue', updateData.revenue);
            addUpdateField('leads', updateData.leads);
            addUpdateField('clicks', updateData.clicks);
            addUpdateField('sales', updateData.sales);
            addUpdateField('avgTicket', updateData.avgTicket);
            addUpdateField('purchaseFrequency', updateData.purchaseFrequency);
            addUpdateField('customerLifespan', updateData.customerLifespan);
            addUpdateField('status', updateData.status);
            addUpdateField('startDate', updateData.startDate, false, true); // Corrigido para isDate=true
            addUpdateField('endDate', updateData.endDate, false, true);     // Corrigido para isDate=true
            addUpdateField('cost_traffic', updateData.cost_traffic);
            addUpdateField('cost_creative', updateData.cost_creative);
            addUpdateField('cost_operational', updateData.cost_operational);

            const setClauses = Object.keys(fieldsToUpdate).map(key => `${dbPool.escapeId(key)} = ?`).join(', ');
            // Somente adiciona campos que foram realmente processados
            params.push(...Object.values(fieldsToUpdate));
            params.push(id); // ID é o último parâmetro para a cláusula WHERE

            if (Object.keys(fieldsToUpdate).length === 0) {
                console.log("[API Campaigns PUT] Nenhum campo válido para atualizar após processamento.");
                 // Busca e retorna o estado atual se nenhum campo for atualizado
                 const [currentCampaignRows] = await dbPool.query<mysql.RowDataPacket[]>('SELECT * FROM campaigns WHERE id = ?', [id]);
                 if (currentCampaignRows.length > 0) { return res.status(200).json(currentCampaignRows[0]); }
                 else { return res.status(404).json({ message: 'Campanha não encontrada.' }); }
            }

            const sql = `UPDATE campaigns SET ${setClauses} WHERE id = ?`;
            console.log("[API Campaigns PUT] SQL Query:", sql);
            console.log("[API Campaigns PUT] Params:", params);

            const [result] = await dbPool.query<mysql.ResultSetHeader>(sql, params);
            console.log("[API Campaigns PUT] UPDATE executado. Affected rows:", result.affectedRows);

            // Verifica se a campanha foi encontrada e atualizada
             if (result.affectedRows === 0) {
                 // Verifica se a campanha realmente existe
                 const [checkRows] = await dbPool.query<mysql.RowDataPacket[]>('SELECT id FROM campaigns WHERE id = ?', [id]);
                 if (checkRows.length === 0) {
                     console.warn(`[API Campaigns PUT] Campanha ID ${id} não encontrada para atualização.`);
                     return res.status(404).json({ message: 'Campanha não encontrada para atualização.' });
                 } else {
                     // Nenhuma linha afetada, mas a campanha existe (provavelmente os dados enviados eram iguais aos existentes)
                     console.log(`[API Campaigns PUT] Nenhuma linha afetada para ID ${id} (dados podem ser iguais). Buscando estado atual...`);
                 }
             }

            // Busca e retorna a campanha (potencialmente) atualizada
            const [updatedCampaignRows] = await dbPool.query<mysql.RowDataPacket[]>('SELECT * FROM campaigns WHERE id = ?', [id]);
            if (updatedCampaignRows.length > 0) {
                console.log(`[API Campaigns PUT] Retornando campanha ID ${id} após tentativa de UPDATE. Status 200.`);
                const updatedCampaign = { ...updatedCampaignRows[0] };
                // Deserializa antes de retornar
                try { if (updatedCampaign.platform && typeof updatedCampaign.platform === 'string') updatedCampaign.platform = JSON.parse(updatedCampaign.platform); } catch(e){}
                try { if (updatedCampaign.objective && typeof updatedCampaign.objective === 'string') updatedCampaign.objective = JSON.parse(updatedCampaign.objective); } catch(e){}
                try { if (updatedCampaign.adFormat && typeof updatedCampaign.adFormat === 'string') updatedCampaign.adFormat = JSON.parse(updatedCampaign.adFormat); } catch(e){}
                res.status(200).json(updatedCampaign);
            } else {
                // Isso não deveria acontecer se a verificação anterior passou
                console.error(`[API Campaigns PUT] ERRO CRÍTICO: Campanha ID ${id} não encontrada após UPDATE!`);
                res.status(404).json({ message: 'Campanha não encontrada após atualização.' });
            }
      }
      // --- DELETE --- <<<<<<<<<<<<<<<<<<<<<<<<<<<< ADICIONAR ESTE BLOCO
      else if (req.method === 'DELETE') {
            console.log("[API Campaigns DELETE] Requisição recebida.");
            const { id } = req.query;
            if (!id || typeof id !== 'string') {
                console.error("[API Campaigns DELETE] Erro: ID ausente ou inválido na query.");
                return res.status(400).json({ error: 'ID da campanha (válido) é obrigatório na query string.' });
            }
            console.log(`[API Campaigns DELETE] Tentando deletar ID: ${id}`);

            // TODO: Implementar lógica de exclusão em cascata ou desassociação se necessário
            // Exemplo: await dbPool.query('DELETE FROM daily_metrics WHERE campaign_id = ?', [id]);

            const [result] = await dbPool.query<mysql.ResultSetHeader>('DELETE FROM campaigns WHERE id = ?', [id]);
            console.log("[API Campaigns DELETE] DELETE executado. Affected rows:", result.affectedRows);

            if (result.affectedRows === 0) {
                console.warn(`[API Campaigns DELETE] Campanha ID ${id} não encontrada para exclusão.`);
                return res.status(404).json({ message: 'Campanha não encontrada para exclusão.' });
            }
            console.log(`[API Campaigns DELETE] Campanha ID ${id} excluída com sucesso. Retornando 204.`);
            res.status(204).end(); // Resposta sem corpo para DELETE bem-sucedido
      }
      // --- Método Não Permitido --- <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< ELSE FINAL
      else {
            console.warn(`[API Campaigns Handler] Método não permitido recebido: ${req.method}`);
            res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']); // Informa os métodos permitidos
            res.status(405).json({ error: `Método ${req.method} não permitido` });
      }

   } catch (err: any) {
      console.error(`[API Campaigns ${req?.method || 'Unknown'}] Erro GERAL no try/catch:`, err);
      res.status(500).json({ error: 'Erro interno do servidor', details: err?.message ?? 'Erro desconhecido', code: err.code });
   }
}
