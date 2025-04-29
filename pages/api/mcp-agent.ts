// pages/api/mcp-agent.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import Groq from 'groq-sdk';
import { getDbPool } from '@/lib/db-mysql';
import mysql from 'mysql2/promise';

interface AgentAction { type: 'navigate' | string; payload?: any; }
interface AgentApiResponse { response: string; action?: AgentAction | null; }
interface RequestBody { message: string; context: { path: string; }; lastActionContext?: AgentAction | null; }
interface DbHistoryMessage { role: 'system' | 'user' | 'assistant' | 'tool' | 'function'; content: string | null; tool_call_id?: string | null; name?: string | null; }
type HistoryMessage = Groq.Chat.Completions.ChatCompletionMessageParam & { message_order?: number; tool_call_id?: string | null; name?: string | null; };

const groqApiKey = process.env.GROQ_API_KEY || "";
if (!groqApiKey || !groqApiKey.startsWith('gsk_')) { console.warn("!!! ATENÇÃO: GROQ_API_KEY inválida ou não definida !!!"); }
const groq = new Groq({ apiKey: groqApiKey });
const GROQ_MODEL = 'llama3-70b-8192';
const MAX_HISTORY_DB_MESSAGES = 20; // Limite para buscar histórico do DB

const TOOL_DEFINITIONS_PROMPT = `
Você é o MCP Agent, um assistente IA avançado para o aplicativo de marketing digital USBMKT.
Seu objetivo é ajudar o usuário a navegar na aplicação e gerenciar campanhas de marketing.
A página atual do usuário é fornecida no contexto.

Ferramentas Disponíveis:

1.  **Navegar:** Use para ir para uma página. Ferramenta: \`navigate\`, Argumentos: \`{"path": "/pagina_desejada"}\` (Ex: "/", "/Metrics", "/Campaign"). IMPORTANTE: Se disser "campanha", interprete como /Campaign. Ex: "ir para campanha" -> JSON: \`{"tool": "navigate", "arguments": {"path": "/Campaign"}}\`
2.  **Listar Campanhas:** Use para ver campanhas. Ferramenta: \`list_campaigns\`, Argumentos: \`{}\`. Ex: "Quais campanhas temos?" -> JSON: \`{"tool": "list_campaigns", "arguments": {}}\`
3.  **Obter Detalhes da Campanha:** Use para detalhes de UMA campanha PELO NOME. Ferramenta: \`get_campaign_details\`, Argumentos: \`{"campaign_name": "Nome Exato"}\`. Ex: "Detalhes da Campanha de Verão" -> JSON: \`{"tool": "get_campaign_details", "arguments": {"campaign_name": "Campanha de Verão"}}\`
4.  **Criar Campanha:** Use para criar NOVA campanha. Extraia NOME e ORÇAMENTO DIÁRIO. Ferramenta: \`create_campaign\`, Argumentos: \`{"name": "Nome", "budget": valor_numerico}\`. Ex: "Crie Black Friday com 50 reais por dia" -> JSON: \`{"tool": "create_campaign", "arguments": {"name": "Black Friday", "budget": 50}}\`
5.  **Modificar Campanha:** Use para ALTERAR campanha. Precisa NOME (ou ID) e campos a alterar. Ferramenta: \`modify_campaign\`, Argumentos: \`{"identifier": {"name": "Nome Exato"}, "fields_to_update": {"campo1": valor1}}\`. Campos: \`name\`, \`daily_budget\`, \`status\` ('active', 'paused', 'draft', 'completed'), \`budget\`, \`cost_traffic\`, \`cost_creative\`, \`cost_operational\`. Ex: "Pause Black Friday" -> JSON: \`{"tool": "modify_campaign", "arguments": {"identifier": {"name": "Black Friday"}, "fields_to_update": {"status": "paused"}}}\`

Instruções IMPORTANTES:
- Responda diretamente a perguntas gerais.
- Se uma ação é solicitada, gere APENAS E SOMENTE UM objeto JSON da ferramenta, sem texto adicional.
- SE O USUÁRIO PEDIR MÚLTIPLAS AÇÕES: 1. Identifique a ação PRINCIPAL. 2. Responda textualmente confirmando a ação principal E mencionando que você navegará DEPOIS (se solicitado). Ex: "Ok, vou atualizar o custo. Depois, podemos ir para Campanhas.". 3. NÃO gere JSON nesta resposta textual. ESPERE ou gere APENAS o JSON da ação PRINCIPAL.
- Se não tiver certeza ou faltar informação, peça esclarecimentos.
- Use \`identifier\` com \`name\` para modificar.
`;

async function getHistoryFromDB(sessionId: string, limit: number): Promise<DbHistoryMessage[]> {
    const dbPool = getDbPool(); if (!dbPool) return [];
    try { const [rows] = await dbPool.query<mysql.RowDataPacket[]>( `SELECT role, content, tool_call_id, name, message_order FROM mcp_conversation_history WHERE session_id = ? ORDER BY message_order DESC LIMIT ?`, [sessionId, limit] ); return rows.reverse() as DbHistoryMessage[]; } catch (error) { console.error(`[DB History] Erro buscar ${sessionId}:`, error); return []; }
}

async function getLastMessageOrder(sessionId: string): Promise<number> {
    const dbPool = getDbPool(); if (!dbPool) return 0;
    try {
        const [rows] = await dbPool.query<mysql.RowDataPacket[]>(
            `SELECT message_order FROM mcp_conversation_history WHERE session_id = ? ORDER BY message_order DESC LIMIT 1`,
            [sessionId]
        );
        return rows.length > 0 ? rows[0].message_order : 0;
    } catch (error) {
        console.error(`[DB History] Erro buscar última ordem ${sessionId}:`, error);
        return 0;
    }
}

async function saveMessageToDB(sessionId: string, message: DbHistoryMessage, order: number): Promise<void> {
    const dbPool = getDbPool(); if (!dbPool) return;
    try {
        await dbPool.query(
            `INSERT INTO mcp_conversation_history (session_id, message_order, role, content, tool_call_id, name) VALUES (?, ?, ?, ?, ?, ?)`,
            [
                sessionId,
                order,
                message.role,
                (typeof message.content === 'string' || message.content === null) ? message.content : JSON.stringify(message.content),
                message.tool_call_id ?? null,
                message.name ?? null
            ]
        );
        // console.log(`[DB History] Mensagem salva para ${sessionId} com ordem ${order}.`);
    } catch (error) {
        console.error(`[DB History] Erro salvar mensagem para ${sessionId} (ordem ${order}):`, error);
    }
}

async function findCampaignIdByName(name: string): Promise<string | null> { if (!name) return null; try { const dbPool = getDbPool(); if (!dbPool) { console.error("[findCampaignIdByName] Falha pool."); return null; } const [rows] = await dbPool.query<mysql.RowDataPacket[]>('SELECT id FROM campaigns WHERE name = ? LIMIT 1', [name]); if (rows.length > 0) { return rows[0].id; } return null; } catch (error) { console.error("[INTERNAL] Erro buscar ID:", error); return null; } }
async function internalCreateCampaign(args: { name?: string, budget?: number }): Promise<string> { if (!args.name || args.budget === undefined || args.budget < 0) { return "❌ Falha: Nome e orçamento diário obrigatórios."; } try { const baseUrl = process.env.NEXT_PUBLIC_API_URL; if (!baseUrl) { return "❌ Falha config interna."; } const apiUrl = `${baseUrl}/api/campaigns`; const response = await axios.post(apiUrl, { name: args.name, daily_budget: args.budget, status: 'draft' }); if (response.status === 201 || response.status === 200) { const cId = response.data?.id || '?'; return `✅ Campanha "${args.name}" (ID: ${cId}) criada!`; } else { return `⚠️ Erro criar (Status: ${response.status}).`; } } catch (error: any) { console.error("[INTERNAL] Erro create:", error.response?.data || error.message); if (error.code === 'ECONNREFUSED') return `❌ Falha conexão interna.`; return `❌ Falha criar: ${error.response?.data?.message || error.message || 'Erro API.'}`; } }
async function internalGetCampaignDetails(args: { campaign_name?: string }): Promise<string> { if (!args.campaign_name) return "❌ Especifique nome."; try { const dbPool = getDbPool(); if (!dbPool) return "❌ Falha pool."; const [rows] = await dbPool.query<mysql.RowDataPacket[]>( 'SELECT id, name, status, budget, daily_budget, cost_traffic, cost_creative, cost_operational FROM campaigns WHERE name = ?', [args.campaign_name] ); if (rows.length > 0) { const c = rows[0]; let totalCost = 0; let totalRevenue = 0; try { const [mRows] = await dbPool.query<mysql.RowDataPacket[]>('SELECT SUM(cost) as totalCost, SUM(revenue) as totalRevenue FROM daily_metrics WHERE campaign_id = ?', [c.id]); totalCost = mRows[0]?.totalCost ?? 0; totalRevenue = mRows[0]?.totalRevenue ?? 0; } catch (mErr) { console.error(`[INTERNAL] Erro métricas ${c.id}:`, mErr); } return `📊 Detalhes "${c.name}" (ID: ${c.id}): St ${c.status||'N/A'}, Orç.T ${formatCurrency(c.budget)}, Orç.D ${formatCurrency(c.daily_budget)}. Custos Fixos (T:${formatCurrency(c.cost_traffic)}, C:${formatCurrency(c.cost_creative)}, O:${formatCurrency(c.cost_operational)}). Período(Custo ${formatCurrency(totalCost)}, Receita ${formatCurrency(totalRevenue)}).`; } else { return `ℹ️ Campanha "${args.campaign_name}" não encontrada.`; } } catch (error: any) { console.error("[INTERNAL] Erro getDetails:", error); return `❌ Falha detalhes: ${error.message || 'Erro'}`; } }
async function internalListCampaigns(args: {}): Promise<string> { try { const baseUrl = process.env.NEXT_PUBLIC_API_URL; if (!baseUrl) return "❌ Config interna ausente."; const apiUrl = `${baseUrl}/api/campaigns?fields=name`; const response = await axios.get<{ name: string }[]>(apiUrl); const names = response.data?.map(c => c.name) || []; if (names.length === 0) return "ℹ️ Nenhuma campanha."; return `📁 Campanhas (${names.length}): ${names.join(', ')}.`; } catch (error: any) { console.error("[INTERNAL] Erro list:", error.response?.data || error.message); return `❌ Falha lista: ${error.message}`; } }
async function internalModifyCampaign(args: { identifier?: { name?: string, id?: string }, fields_to_update?: any }): Promise<string> { if (!args.identifier || (!args.identifier.name && !args.identifier.id)) { return "❌ Falha: Identifique a campanha."; } if (!args.fields_to_update || Object.keys(args.fields_to_update).length === 0) { return "❌ Falha: Especifique campos."; } let campaignId = args.identifier.id; const campaignName = args.identifier.name; if (!campaignId && campaignName) { campaignId = await findCampaignIdByName(campaignName); if (!campaignId) return `❌ Falha: Campanha "${campaignName}" não encontrada.`; } if (!campaignId) return "❌ Falha: ID não determinado."; try { const baseUrl = process.env.NEXT_PUBLIC_API_URL; if (!baseUrl) return "❌ Falha config interna."; const apiUrl = `${baseUrl}/api/campaigns?id=${campaignId}`; const response = await axios.put(apiUrl, args.fields_to_update); if (response.status === 200) { const updatedFields = Object.keys(args.fields_to_update).join(', '); let finalName = campaignName || `ID ${campaignId}`; if (args.fields_to_update.name) { finalName = args.fields_to_update.name; } else if (!campaignName) { try { const dbPool = getDbPool(); if(dbPool){ const [nRows]=await dbPool.query<mysql.RowDataPacket[]>('SELECT name FROM campaigns WHERE id = ?', [campaignId]); if(nRows.length>0) finalName=nRows[0].name;} } catch(e) { console.error("Err buscar nome pos upd:", e); } } return `✅ Campanha "${finalName}" atualizada! (Campos: ${updatedFields})`; } else { return `⚠️ Erro modificar (Status: ${response.status}).`; } } catch (error: any) { console.error("[INTERNAL] Erro modify:", error.response?.data || error.message); if (error.code === 'ECONNREFUSED') return `❌ Falha conexão.`; return `❌ Falha modificar: ${error.response?.data?.message || error.message || 'Erro API.'}`; } }
const formatCurrency = (value?: number | null): string => { if (typeof value !== 'number' || isNaN(value)) return 'N/D'; return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); };

export default async function handler( req: NextApiRequest, res: NextApiResponse<AgentApiResponse | { error: string }> ) {
    if (req.method !== 'POST') { res.setHeader('Allow', ['POST']); return res.status(405).json({ error: 'Method Not Allowed' }); }
    const sessionId = req.headers['x-session-id'] as string || req.headers['x-real-ip'] as string || req.headers['user-agent'] || 'default-session';
    const { message, context }: RequestBody = req.body;
    if (!message || !context || !context.path) { return res.status(400).json({ error: 'Parâmetros obrigatórios: message, context.path' }); }

    let agentResponse = "";
    let agentAction: AgentAction | null = null;
    let currentMessageOrder = 0; // Começa em 0, será atualizado

    try {
        // Obter a última ordem de mensagem para a sessão
        currentMessageOrder = await getLastMessageOrder(sessionId);

        // Salvar a mensagem do usuário
        await saveMessageToDB(sessionId, { role: 'user', content: message }, currentMessageOrder + 1);
        currentMessageOrder++;

        // Obter histórico RECENTE para enviar ao LLM (incluindo a nova msg do usuário)
        const dbHistory: DbHistoryMessage[] = await getHistoryFromDB(sessionId, MAX_HISTORY_DB_MESSAGES);

        const currentHistoryForLLM: Groq.Chat.Completions.ChatCompletionMessageParam[] = [
            { role: "system", content: TOOL_DEFINITIONS_PROMPT },
            ...dbHistory.map((dbMsg): Groq.Chat.Completions.ChatCompletionMessageParam | null => {
                let contentForRole: string | null = dbMsg.content;
                // Certificar-se de que o conteúdo é string ou null para roles que não são tool_function
                 if ((dbMsg.role === 'system' || dbMsg.role === 'user' || dbMsg.role === 'assistant') && contentForRole === null) {
                     contentForRole = ''; // Groq pode não gostar de null content para esses roles
                 }

                const baseMsg: any = { role: dbMsg.role, content: contentForRole };

                // Adicionar campos específicos para roles de tool/function
                if (dbMsg.role === 'tool' && dbMsg.tool_call_id) {
                    baseMsg.tool_call_id = dbMsg.tool_call_id;
                    if (dbMsg.name) baseMsg.name = dbMsg.name;
                } else if (dbMsg.role === 'function' && dbMsg.name) {
                     // Groq usa 'tool_calls' no assistant e espera 'tool' no histórico para o resultado
                     // A role 'function' é mais comum em outros modelos, mas ajustamos para 'tool' aqui
                     // Se o seu DB salva 'function', pode ser necessário ajustar
                     baseMsg.role = 'tool'; // Ajuste para compatibilidade com Groq tool_calls response format
                     baseMsg.name = dbMsg.name; // Nome da função/ferramenta
                     // O content aqui seria o resultado da função
                } else if (dbMsg.role === 'assistant' && dbMsg.tool_call_id) {
                     // Se o assistente no histórico já tem tool_call_id, pode ser uma resposta de tool_calls
                     // Groq espera um array de tool_calls no role assistant
                     try {
                         const toolCallContent = dbMsg.content ? JSON.parse(dbMsg.content) : null;
                         if (toolCallContent && Array.isArray(toolCallContent)) {
                             baseMsg.tool_calls = toolCallContent;
                             baseMsg.content = null; // Content é null quando há tool_calls
                         } else {
                             // Se não for um array de tool_calls válido, manter como texto
                              baseMsg.content = dbMsg.content;
                         }
                     } catch (e) {
                         // Se falhar parsear, manter como texto
                         baseMsg.content = dbMsg.content;
                     }
                     // Remover tool_call_id/name se não for role tool/function no histórico
                     delete baseMsg.tool_call_id;
                     delete baseMsg.name;
                }


                return baseMsg as Groq.Chat.Completions.ChatCompletionMessageParam;

            }).filter((msg): msg is Groq.Chat.Completions.ChatCompletionMessageParam => msg !== null),
            { role: "user", content: message } // Garante que a última mensagem é a do usuário
        ];

        console.log(`[API MCP ${sessionId}] Enviando ${currentHistoryForLLM.length} msgs para Groq. Última ordem: ${currentMessageOrder}`);
        // console.log("[API MCP] Histórico para Groq:", JSON.stringify(currentHistoryForLLM, null, 2));


        if (!groqApiKey || !groqApiKey.startsWith('gsk_')) { throw new Error("Chave Groq inválida ou ausente."); }

        const completion = await groq.chat.completions.create({
            messages: currentHistoryForLLM,
            model: GROQ_MODEL,
            temperature: 0.4,
            max_tokens: 1024,
            // Adicionar tool_choice e tools se necessário, mas por padrão o modelo decide
            // tools: [ ... definições de ferramentas em formato Groq ... ]
        });

        const assistantMessage = completion.choices[0]?.message;
        const assistantResponseContent = assistantMessage?.content || "";
        const toolCalls = assistantMessage?.tool_calls;

        console.log(`[API MCP ${sessionId}] Groq Response: Content: "${assistantResponseContent.substring(0, 100)}...", Tool Calls: ${toolCalls?.length}`);

        // Salvar a resposta do assistente (texto e/ou tool_calls)
        if (assistantResponseContent || toolCalls) {
             await saveMessageToDB(sessionId, {
                 role: 'assistant',
                 content: assistantResponseContent || (toolCalls ? JSON.stringify(toolCalls) : null), // Salva tool_calls como JSON se não houver texto
                 // tool_call_id e name não são usados na role assistant para Groq
             }, currentMessageOrder + 1);
             currentMessageOrder++;
        } else {
            console.warn(`[API MCP ${sessionId}] Groq resposta vazia (content e tool_calls).`);
            agentResponse = "Desculpe, não consegui gerar resposta.";
            return res.status(200).json({ response: agentResponse, action: agentAction });
        }


        // Processar Tool Calls se existirem
        if (toolCalls && toolCalls.length > 0) {
            console.log(`[API MCP ${sessionId}] Processando ${toolCalls.length} tool call(s).`);
            // Para simplificar, processamos apenas a primeira tool call aqui
            const firstToolCall = toolCalls[0];
            const toolName = firstToolCall.function.name;
            let toolArguments: any = {};
            try {
                toolArguments = JSON.parse(firstToolCall.function.arguments);
            } catch (e) {
                console.error(`[API MCP ${sessionId}] Erro ao parsear argumentos da ferramenta ${toolName}:`, e);
                // Continuar mesmo com erro de parse, o handler interno pode lidar com args vazios
            }

            console.log(`[API MCP ${sessionId}] Executando ferramenta: ${toolName} com args:`, toolArguments);
            let toolResult = `Erro: Ferramenta '${toolName}' desconhecida ou falhou.`;

            switch (toolName) {
                case 'create_campaign': toolResult = await internalCreateCampaign(toolArguments); break;
                case 'get_campaign_details': toolResult = await internalGetCampaignDetails(toolArguments); break;
                case 'list_campaigns': toolResult = await internalListCampaigns(toolArguments); break;
                case 'modify_campaign': toolResult = await internalModifyCampaign(toolArguments); break;
                case 'navigate':
                    agentResponse = assistantResponseContent || `Ok, navegando para ${toolArguments?.path || 'página desconhecida'}...`;
                    agentAction = { type: 'navigate', payload: toolArguments };
                    toolResult = `(Ação de navegação para ${toolArguments?.path})`; // Resultado para salvar no histórico
                    break;
                default:
                    toolResult = `Erro: Ferramenta '${toolName}' desconhecida.`;
            }

            console.log(`[API MCP ${sessionId}] Resultado da Ferramenta:`, toolResult);

            // Salvar o resultado da ferramenta no histórico
            await saveMessageToDB(sessionId, {
                 role: 'tool', // Groq espera 'tool' para resultados de tool_calls
                 tool_call_id: firstToolCall.id, // Usar o ID da tool call original
                 name: toolName,
                 content: toolResult // Salvar o resultado da execução da ferramenta
            }, currentMessageOrder + 1);
            currentMessageOrder++;

            // Se a ferramenta não foi 'navigate', a resposta final é o resultado da ferramenta
            if (toolName !== 'navigate') {
                 agentResponse = toolResult;
                 agentAction = null; // Nenhuma ação de navegação se for outra ferramenta
            } else {
                 // Se for 'navigate', a resposta já foi definida acima (texto do assistente + ação)
                 // E o resultado da ferramenta (toolResult) foi apenas para o histórico
            }


        } else if (assistantResponseContent) {
            // Se não houve tool calls, a resposta final é apenas o conteúdo textual do assistente
            agentResponse = assistantResponseContent;
            agentAction = null;
        } else {
             // Caso estranho onde não há tool_calls nem content (já tratado acima, mas redundância)
             agentResponse = "Desculpe, não consegui gerar uma resposta clara.";
             agentAction = null;
        }


    } catch (error: any) {
        console.error(`[API MCP ${sessionId}] Erro Handler:`, error);
        agentResponse = `Erro assistente IA (${error?.status || error?.name || 'desconhecido'}). Detalhes: ${error.message || 'Erro interno.'}`;
        agentAction = null;
        // Tentar salvar a mensagem de erro no histórico
        try {
             // Obter a última ordem novamente caso tenha havido erros no meio
             const lastOrderAfterError = await getLastMessageOrder(sessionId);
             await saveMessageToDB(sessionId, { role: 'assistant', content: `Erro Interno: ${error.message}` }, lastOrderAfterError + 1);
        } catch (saveError) {
             console.error(`[API MCP ${sessionId}] Erro ao salvar mensagem de erro no histórico:`, saveError);
        }
    }

    // Garantir que sempre haja uma resposta
    if (!agentResponse) {
        agentResponse = "Problema ao processar a solicitação. Tente novamente.";
    }

    console.log(`[API MCP ${sessionId}] Enviando Resposta Final:`, { response: agentResponse, action: agentAction });
    res.status(200).json({ response: agentResponse, action: agentAction });
}
