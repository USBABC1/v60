// pages/api/flows.ts
import type { NextApiRequest, NextApiResponse } from 'next';
// <<< MUDE AS IMPORTAÇÕES DO BANCO DE DADOS >>>
import { getDbPool, initializeFlowsTable, initializeCampaignsTable } from '@/lib/db-mysql';
import mysql from 'mysql2/promise';

// Tipos (mantidos, mas ID agora é number)
interface FlowElementData { nodes: any[]; edges: any[]; }
interface FlowData {
    id: number; // <<< ID agora é number (AUTO_INCREMENT)
    name: string;
    status: 'active' | 'inactive' | 'draft';
    campaign_id?: string | null;
    elements?: FlowElementData | null;
    created_at?: string;
    updated_at?: string;
}
type FlowListItem = Omit<FlowData, 'elements'>;
type ResponseData =
    | FlowListItem[]
    | FlowData
    | { message: string; error?: string }
    | { message: string; changes?: number }; // Removido FlowData duplicado

// Função helper para parsear JSON com segurança
function safeParseJson(jsonString: string | null | undefined): FlowElementData | null {
    if (!jsonString) return null;
    try {
        const parsed = JSON.parse(jsonString);
        // Validação básica da estrutura esperada
        if (typeof parsed === 'object' && parsed !== null && Array.isArray(parsed.nodes) && Array.isArray(parsed.edges)) {
            return parsed;
        }
        console.warn("SafeParseJson: Estrutura JSON inválida encontrada:", jsonString);
        return null;
    } catch (e) {
        console.error("SafeParseJson: Erro ao parsear JSON:", e);
        return null;
    }
}


export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<ResponseData>
) {
    try {
        const dbPool = getDbPool();
        if (!dbPool) throw new Error("Falha ao obter pool de conexão MySQL.");

        // Garante que as tabelas existam ANTES de operar
        // await initializeCampaignsTable(); // Necessário por causa da FK
        await initializeFlowsTable();

        // --- GET: Buscar Fluxos ---
        if (req.method === 'GET') {
            const { id, campaignId } = req.query;

            if (id) {
                // --- GET por ID ---
                const flowId = Array.isArray(id) ? id[0] : id;
                const flowIdNum = parseInt(flowId, 10);
                 if (isNaN(flowIdNum)) {
                    return res.status(400).json({ message: "ID do fluxo inválido." });
                 }
                console.log(`[API Flows GET] Buscando fluxo com ID: ${flowIdNum}`);

                // <<< USA MYSQL >>>
                const [rows] = await dbPool.query<mysql.RowDataPacket[]>(
                    'SELECT * FROM flows WHERE id = ?',
                    [flowIdNum]
                );

                if (rows.length > 0) {
                    const flow = rows[0];
                    // Parsear elements (se for string JSON)
                    flow.elements = safeParseJson(flow.elements);
                    res.status(200).json(flow as FlowData);
                } else {
                    res.status(404).json({ message: `Fluxo com ID ${flowIdNum} não encontrado` });
                }
            } else {
                // --- GET Lista ---
                const campIdValue = Array.isArray(campaignId) ? campaignId[0] : campaignId;
                console.log(`[API Flows GET] Buscando lista com campaignId: ${campIdValue || 'todos'}`);

                let query = 'SELECT id, name, status, campaign_id, updated_at FROM flows'; // Não seleciona 'elements' na lista
                const params: (string | null)[] = [];

                let filterValue: string | null | undefined = undefined;
                if (campIdValue === 'none') {
                    query += ' WHERE campaign_id IS NULL';
                } else if (campIdValue && campIdValue !== 'all') {
                    query += ' WHERE campaign_id = ?';
                    params.push(campIdValue);
                }
                 query += ' ORDER BY updated_at DESC, name ASC';

                // <<< USA MYSQL >>>
                const [rows] = await dbPool.query<mysql.RowDataPacket[]>(query, params);

                console.log(`[API Flows GET] Retornando ${rows.length} fluxos.`);
                res.status(200).json(rows as FlowListItem[]); // Retorna como lista
            }
        }
        // --- POST: Criar Novo Fluxo ---
        else if (req.method === 'POST') {
            const { name, campaign_id } = req.body;
            if (!name || typeof name !== 'string' || name.trim() === '') {
                return res.status(400).json({ message: "Nome do fluxo é obrigatório." });
            }

            const campaignIdToSave = campaign_id === 'none' || campaign_id === '' ? null : campaign_id;
            const elementsJson = JSON.stringify({ nodes: [], edges: [] }); // Começa vazio
            const status = 'draft';

            console.log(`[API Flows POST] Criando fluxo: ${name}, Campanha ID: ${campaignIdToSave}`);

            // <<< USA MYSQL >>>
            const [result] = await dbPool.query<mysql.ResultSetHeader>(
                'INSERT INTO flows (name, campaign_id, elements, status) VALUES (?, ?, ?, ?)',
                [name.trim(), campaignIdToSave, elementsJson, status]
            );

            const newFlowId = result.insertId; // Pega o ID auto-incrementado

            // Busca o fluxo criado para retornar
            const [newFlowRows] = await dbPool.query<mysql.RowDataPacket[]>('SELECT * FROM flows WHERE id = ?', [newFlowId]);

            if (newFlowRows.length === 0) {
                 throw new Error("Falha ao buscar fluxo recém-criado.");
            }
            const newFlow = newFlowRows[0];
            newFlow.elements = safeParseJson(newFlow.elements); // Parsear antes de retornar

            console.log(`[API Flows POST] Fluxo criado com ID: ${newFlow.id}`);
            res.status(201).json(newFlow as FlowData);
        }
        // --- PUT: Atualizar Fluxo Existente ---
        else if (req.method === 'PUT') {
            const { id } = req.query;
            const { name, campaign_id, elements, status } = req.body;

            if (!id) { return res.status(400).json({ message: "ID do fluxo é obrigatório para atualização." }); }
            const flowId = Array.isArray(id) ? id[0] : id;
            const flowIdNum = parseInt(flowId, 10);
            if (isNaN(flowIdNum)) {
               return res.status(400).json({ message: "ID do fluxo inválido." });
            }

            const fieldsToUpdate: { [key: string]: any } = {};
            const params: any[] = [];
             const addUpdateField = (fieldName: string, value: any, isJson: boolean = false) => {
                 if (value !== undefined) {
                     let valueToSave = value;
                     if (fieldName === 'campaign_id' && (value === 'none' || value === '')) valueToSave = null;
                     else if (isJson) { // Stringify JSON se necessário
                         try {
                              valueToSave = (value === null || (typeof value === 'object' && value !== null))
                                            ? JSON.stringify(value)
                                            : value; // Assume que já é string JSON ou null
                         } catch (e) {
                              console.error(`Erro ao stringificar ${fieldName}:`, e);
                              valueToSave = null; // Salva null se houver erro
                         }
                     }
                     fieldsToUpdate[fieldName] = valueToSave;
                 }
             };

            addUpdateField('name', name?.trim()); // Trim nome
            addUpdateField('campaign_id', campaign_id);
            addUpdateField('elements', elements, true); // Marcar como JSON
            if (status !== undefined && ['active', 'inactive', 'draft'].includes(status)) {
                addUpdateField('status', status);
            } else if (status !== undefined) {
                 return res.status(400).json({ message: `Status inválido: ${status}. Use 'active', 'inactive' ou 'draft'.` });
            }

            if (Object.keys(fieldsToUpdate).length === 0) {
                return res.status(400).json({ message: "Nenhum dado válido fornecido para atualização." });
            }
             if (fieldsToUpdate.name !== undefined && fieldsToUpdate.name === '') {
                 return res.status(400).json({ message: "Nome do fluxo não pode ser vazio." });
             }

            const setClauses = Object.keys(fieldsToUpdate).map(key => `${key} = ?`).join(', ');
            params.push(...Object.values(fieldsToUpdate));
            params.push(flowIdNum); // ID para o WHERE

            console.log(`[API Flows PUT] Atualizando fluxo ID: ${flowIdNum} com campos:`, Object.keys(fieldsToUpdate));

             // <<< USA MYSQL >>>
            // Se está ativando, desativa os outros primeiro
             if (fieldsToUpdate.status === 'active') {
                 console.log(`[API Flows PUT] Desativando outros fluxos ativos...`);
                 await dbPool.query("UPDATE flows SET status = 'inactive' WHERE status = 'active' AND id != ?", [flowIdNum]);
             }

            const [result] = await dbPool.query<mysql.ResultSetHeader>(
                 `UPDATE flows SET ${setClauses} WHERE id = ?`,
                 params
            );

            if (result.affectedRows === 0) {
                // Verifica se o fluxo existe antes de dizer que não foi encontrado
                const [checkRows] = await dbPool.query<mysql.RowDataPacket[]>('SELECT id FROM flows WHERE id = ?', [flowIdNum]);
                if (checkRows.length > 0) {
                    return res.status(200).json({ message: `Nenhuma alteração detectada para o fluxo ${flowIdNum}.`, changes: 0 });
                } else {
                    return res.status(404).json({ message: `Fluxo com ID ${flowIdNum} não encontrado para atualização.` });
                }
            }

            // Recarregar fluxo no bot (se necessário)
             if (fieldsToUpdate.status === 'active') {
                 try {
                     const { loadFlowFromDb: reloadBotFlow } = require('@/lib/whatsappBot'); // Tenta carregar
                     if (typeof reloadBotFlow === 'function') {
                        await reloadBotFlow();
                        console.log(`[API Flows PUT] Recarregamento do fluxo ativo no bot solicitado após atualização do ID ${flowIdNum}.`);
                     } else {
                         console.warn(`[API Flows PUT] Função loadFlowFromDb não encontrada ou não é uma função em whatsappBot.js.`);
                     }
                 } catch (reloadError: any) {
                     console.error(`[API Flows PUT] Erro ao tentar recarregar fluxo no bot para ID ${flowIdNum}:`, reloadError.message);
                      // Responde sucesso, mas avisa do erro
                      const updatedFlow = await dbPool.query<mysql.RowDataPacket[]>('SELECT * FROM flows WHERE id = ?', [flowIdNum]);
                      if(updatedFlow[0].length > 0) {
                          const flow = updatedFlow[0][0];
                          flow.elements = safeParseJson(flow.elements);
                          return res.status(200).json(flow as FlowData); // Retorna o flow atualizado
                      } else {
                          // Resposta genérica se não encontrar o flow após update bem sucedido (estranho)
                           return res.status(200).json({ message: `Fluxo ${flowIdNum} atualizado, mas erro ao recarregar no bot.`, changes: result.affectedRows });
                      }
                 }
             }

            // Se não precisou recarregar ou recarregou com sucesso, busca e retorna o fluxo atualizado
            const [finalFlowRows] = await dbPool.query<mysql.RowDataPacket[]>('SELECT * FROM flows WHERE id = ?', [flowIdNum]);
             if (finalFlowRows.length > 0) {
                const finalFlow = finalFlowRows[0];
                finalFlow.elements = safeParseJson(finalFlow.elements);
                res.status(200).json(finalFlow as FlowData);
             } else {
                 // Caso estranho onde o update deu certo mas a busca falhou
                 res.status(404).json({ message: `Fluxo com ID ${flowIdNum} atualizado, mas não encontrado para retorno.` });
             }
        }
         // --- DELETE: Deletar Fluxo ---
         else if (req.method === 'DELETE') {
            const { id } = req.query;
            if (!id) { return res.status(400).json({ message: "ID do fluxo é obrigatório para deletar." }); }
            const flowId = Array.isArray(id) ? id[0] : id;
            const flowIdNum = parseInt(flowId, 10);
            if (isNaN(flowIdNum)) {
               return res.status(400).json({ message: "ID do fluxo inválido." });
            }

            console.log(`[API Flows DELETE] Deletando fluxo ID: ${flowIdNum}`);
            // <<< USA MYSQL >>>
            const [result] = await dbPool.query<mysql.ResultSetHeader>(
                'DELETE FROM flows WHERE id = ?',
                [flowIdNum]
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({ message: `Fluxo com ID ${flowIdNum} não encontrado para deletar.` });
            }
            res.status(200).json({ message: `Fluxo ${flowIdNum} deletado com sucesso.`, changes: result.affectedRows }); // Retorna 200 OK com mensagem
        }
        // --- Método não permitido ---
        else {
            res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
            res.status(405).json({ message: `Método ${req.method} não permitido` });
        }

    } catch (error: any) {
        console.error(`[API Flows ${req?.method || 'Unknown'}] Erro geral:`, error);
        res.status(500).json({ message: error.message || 'Erro interno no servidor ao processar solicitação de fluxos.', error: error.code }); // Inclui código do erro se disponível
    }
    // Não feche o pool aqui
}
