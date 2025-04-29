// pages/api/mcp-agent.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import Groq from 'groq-sdk';
import { getDbPool } from '@/lib/db-mysql';
import mysql from 'mysql2/promise';

// --- Tipos ---
interface AgentAction { type: 'navigate' | string; payload?: any; }
interface AgentApiResponse { response: string; action?: AgentAction | null; }
interface RequestBody { message: string; context: { path: string; }; lastActionContext?: AgentAction | null; }
interface DbHistoryMessage { role: 'system' | 'user' | 'assistant' | 'tool' | 'function'; content: string | null; tool_call_id?: string | null; name?: string | null; message_order?: number; }
type HistoryMessage = Groq.Chat.Completions.ChatCompletionMessageParam & { message_order?: number; tool_call_id?: string | null; name?: string | null; };

// --- Configuração Groq ---
const groqApiKey = process.env.GROQ_API_KEY || "";
if (!groqApiKey || !groqApiKey.startsWith('gsk_')) { console.warn("!!! ATENÇÃO: GROQ_API_KEY inválida ou não definida !!!"); }
const groq = new Groq({ apiKey: groqApiKey });
const GROQ_MODEL = 'llama3-70b-8192';
const MAX_HISTORY_DB_MESSAGES = 20;

// --- Prompt (REFINADO) ---
const TOOL_DEFINITIONS_PROMPT = `
Você é o MCP Agent, um assistente IA avançado para o aplicativo de marketing digital USBMKT.
Sua função principal é executar ações solicitadas pelo usuário usando as ferramentas disponíveis e responder de forma concisa.
A página atual do usuário é: {context.path}

**Ferramentas Disponíveis:**

1.  **Navegar para Página:**
    *   **Quando usar:** SEMPRE que o usuário pedir para ir, levar, mostrar, abrir ou navegar para uma página/seção específica do app (ex: "métricas", "campanhas", "funil", "orçamento", "copys", "sugestões", "builder", "visão geral").
    *   **Ferramenta:** \`navigate\`
    *   **Argumentos:** \`{"path": "/NomeDaPagina"}\` (Use a capitalização correta: /Metrics, /Campaign, /Funnel, /Budget, /CopyPage, /Suggestions, /builder, /)
    *   **Exemplo 1:** Usuário: "me leve pra campanha" -> JSON: \`{"tool": "navigate", "arguments": {"path": "/Campaign"}}\`
    *   **Exemplo 2:** Usuário: "mostrar métricas" -> JSON: \`{"tool": "navigate", "arguments": {"path": "/Metrics"}}\`
    *   **Exemplo 3:** Usuário: "abrir o funil" -> JSON: \`{"tool": "navigate", "arguments": {"path": "/Funnel"}}\`
    *   **IMPORTANTE:** Se o pedido for claramente de navegação, gere APENAS o JSON da ferramenta \`navigate\`. NÃO converse ou analise texto.

2.  **Listar Campanhas:**
    *   **Quando usar:** Quando o usuário pedir para listar ou ver todas as campanhas existentes.
    *   **Ferramenta:** \`list_campaigns\`
    *   **Argumentos:** \`{}\`
    *   **Exemplo:** Usuário: "Quais campanhas temos?" -> JSON: \`{"tool": "list_campaigns", "arguments": {}}\`

3.  **Obter Detalhes da Campanha:**
    *   **Quando usar:** Quando o usuário pedir detalhes de UMA campanha específica PELO NOME.
    *   **Ferramenta:** \`get_campaign_details\`
    *   **Argumentos:** \`{"campaign_name": "Nome Exato da Campanha"}\`
    *   **Exemplo:** Usuário: "Detalhes da Campanha de Verão" -> JSON: \`{"tool": "get_campaign_details", "arguments": {"campaign_name": "Campanha de Verão"}}\`

4.  **Criar Campanha:**
    *   **Quando usar:** Quando o usuário pedir para criar uma NOVA campanha. Extraia NOME e ORÇAMENTO DIÁRIO.
    *   **Ferramenta:** \`create_campaign\`
    *   **Argumentos:** \`{"name": "Nome da Nova Campanha", "budget": valor_numerico_orcamento_diario}\`
    *   **Exemplo:** Usuário: "Crie a campanha Black Friday com 50 por dia" -> JSON: \`{"tool": "create_campaign", "arguments": {"name": "Black Friday", "budget": 50}}\`

5.  **Modificar Campanha:**
    *   **Quando usar:** Quando o usuário pedir para ALTERAR dados de uma campanha existente. Precisa do NOME e dos campos a alterar.
    *   **Ferramenta:** \`modify_campaign\`
    *   **Argumentos:** \`{"identifier": {"name": "Nome Exato"}, "fields_to_update": {"campo": valor}}\` (Campos: name, daily_budget, status, budget, cost_traffic, cost_creative, cost_operational)
    *   **Exemplo:** Usuário: "Pause a campanha Black Friday" -> JSON: \`{"tool": "modify_campaign", "arguments": {"identifier": {"name": "Black Friday"}, "fields_to_update": {"status": "paused"}}}\`

**Instruções de Comportamento:**
- **Foco na Última Mensagem:** Preste atenção principal na ÚLTIMA mensagem do usuário para determinar a intenção.
- **Ação Direta:** Se a última mensagem for um comando claro para usar uma ferramenta, gere **APENAS E SOMENTE** o JSON da ferramenta correspondente. Não adicione texto explicativo antes ou depois do JSON.
- **Sem Análise Desnecessária:** NÃO analise textos anteriores ou gere descrições se o pedido for claramente para NAVEGAR ou EXECUTAR uma ação de campanha (criar, modificar, listar, detalhar).
- **Múltiplas Ações:** Se o usuário pedir múltiplas ações (ex: modificar e navegar), execute a ação principal (modificar/criar) gerando o JSON dela. Confirme a ação textualmente na sua resposta APÓS a execução da ferramenta. NÃO gere o JSON de navegação junto.
- **Dúvidas:** Se faltar informação ou a intenção não for clara, peça esclarecimentos ao usuário.
- **Respostas Gerais:** Responda normalmente a saudações ou perguntas gerais que não envolvam ferramentas.
`;

// --- Funções Auxiliares de Histórico (DB) ---
async function getHistoryFromDB(sessionId: string, limit: number): Promise<DbHistoryMessage[]> { const dbPool = getDbPool(); if (!dbPool) return []; try { const [rows] = await dbPool.query<mysql.RowDataPacket[]>( `SELECT role, content, tool_call_id, name, message_order FROM mcp_conversation_history WHERE session_id = ? ORDER BY message_order DESC LIMIT ?`, [sessionId, limit] ); return rows.reverse() as DbHistoryMessage[]; } catch (error) { console.error(`[DB History] Erro buscar ${sessionId}:`, error); return []; } }
async function saveMessageToDB(sessionId: string, message: DbHistoryMessage, order: number): Promise<void> { const dbPool = getDbPool(); if (!dbPool) return; try { await dbPool.query( `INSERT INTO mcp_conversation_history (session_id, message_order, role, content, tool_call_id, name) VALUES (?, ?, ?, ?, ?, ?)`, [ sessionId, order, message.role, (typeof message.content === 'string' || message.content === null) ? message.content : JSON.stringify(message.content), message.tool_call_id ?? null, message.name ?? null ] ); } catch (error) { console.error(`[DB History] Erro salvar ${sessionId}:`, error); } }

// --- Funções Internas (Corpos completos e retornos garantidos) ---
async function findCampaignIdByName(name: string): Promise<string | null> { if (!name) return null; try { const dbPool = getDbPool(); if (!dbPool) { console.error("[findCampaignIdByName] Falha pool."); return null; } const [rows] = await dbPool.query<mysql.RowDataPacket[]>('SELECT id FROM campaigns WHERE name = ? LIMIT 1', [name]); if (rows.length > 0) { return rows[0].id; } return null; } catch (error) { console.error("[INTERNAL] Erro buscar ID:", error); return null; } }
async function internalCreateCampaign(args: { name?: string, budget?: number }): Promise<string> { if (!args.name || args.budget === undefined || args.budget < 0) { return "❌ Falha: Nome e orçamento diário obrigatórios."; } try { const baseUrl = process.env.NEXT_PUBLIC_API_URL; if (!baseUrl) { return "❌ Falha config interna."; } const apiUrl = `${baseUrl}/api/campaigns`; const response = await axios.post(apiUrl, { name: args.name, daily_budget: args.budget, status: 'draft' }); if (response.status === 201 || response.status === 200) { const cId = response.data?.id || '?'; return `✅ Campanha "${args.name}" (ID: ${cId}) criada!`; } else { return `⚠️ Erro criar (Status: ${response.status}).`; } } catch (error: any) { console.error("[INTERNAL] Erro create:", error.response?.data || error.message); if (error.code === 'ECONNREFUSED') return `❌ Falha conexão interna.`; return `❌ Falha criar: ${error.response?.data?.message || error.message || 'Erro API.'}`; } }
async function internalGetCampaignDetails(args: { campaign_name?: string }): Promise<string> { if (!args.campaign_name) return "❌ Especifique nome."; try { const dbPool = getDbPool(); if (!dbPool) return "❌ Falha pool."; const [rows] = await dbPool.query<mysql.RowDataPacket[]>( 'SELECT id, name, status, budget, daily_budget, cost_traffic, cost_creative, cost_operational FROM campaigns WHERE name = ?', [args.campaign_name] ); if (rows.length > 0) { const c = rows[0]; let totalCost = 0; let totalRevenue = 0; try { const [mRows] = await dbPool.query<mysql.RowDataPacket[]>('SELECT SUM(cost) as totalCost, SUM(revenue) as totalRevenue FROM daily_metrics WHERE campaign_id = ?', [c.id]); totalCost = mRows[0]?.totalCost ?? 0; totalRevenue = mRows[0]?.totalRevenue ?? 0; } catch (mErr) { console.error(`[INTERNAL] Erro métricas ${c.id}:`, mErr); } return `📊 Detalhes "${c.name}" (ID: ${c.id}): St ${c.status||'N/A'}, Orç.T ${formatCurrency(c.budget)}, Orç.D ${formatCurrency(c.daily_budget)}. Custos Fixos (T:${formatCurrency(c.cost_traffic)}, C:${formatCurrency(c.cost_creative)}, O:${formatCurrency(c.cost_operational)}). Período(Custo ${formatCurrency(totalCost)}, Receita ${formatCurrency(totalRevenue)}).`; } else { return `ℹ️ Campanha "${args.campaign_name}" não encontrada.`; } } catch (error: any) { console.error("[INTERNAL] Erro getDetails:", error); return `❌ Falha detalhes: ${error.message || 'Erro'}`; } }
async function internalListCampaigns(args: {}): Promise<string> { try { const baseUrl = process.env.NEXT_PUBLIC_API_URL; if (!baseUrl) return "❌ Config interna ausente."; const apiUrl = `${baseUrl}/api/campaigns?fields=name`; const response = await axios.get<{ name: string }[]>(apiUrl); const names = response.data?.map(c => c.name) || []; if (names.length === 0) return "ℹ️ Nenhuma campanha."; return `📁 Campanhas (${names.length}): ${names.join(', ')}.`; } catch (error: any) { console.error("[INTERNAL] Erro list:", error.response?.data || error.message); return `❌ Falha lista: ${error.message}`; } }
async function internalModifyCampaign(args: { identifier?: { name?: string, id?: string }, fields_to_update?: any }): Promise<string> { if (!args.identifier || (!args.identifier.name && !args.identifier.id)) { return "❌ Falha: Identifique a campanha."; } if (!args.fields_to_update || Object.keys(args.fields_to_update).length === 0) { return "❌ Falha: Especifique campos."; } let campaignId = args.identifier.id; const campaignName = args.identifier.name; if (!campaignId && campaignName) { campaignId = await findCampaignIdByName(campaignName); if (!campaignId) return `❌ Falha: Campanha "${campaignName}" não encontrada.`; } if (!campaignId) return "❌ Falha: ID não determinado."; try { const baseUrl = process.env.NEXT_PUBLIC_API_URL; if (!baseUrl) return "❌ Falha config interna."; const apiUrl = `${baseUrl}/api/campaigns?id=${campaignId}`; const response = await axios.put(apiUrl, args.fields_to_update); if (response.status === 200) { const updatedFields = Object.keys(args.fields_to_update).join(', '); let finalName = campaignName || `ID ${campaignId}`; if (args.fields_to_update.name) { finalName = args.fields_to_update.name; } else if (!campaignName) { try { const dbPool = getDbPool(); if(dbPool){ const [nRows]=await dbPool.query<mysql.RowDataPacket[]>('SELECT name FROM campaigns WHERE id = ?', [campaignId]); if(nRows.length>0) finalName=nRows[0].name;} } catch(e) { console.error("Err buscar nome pos upd:", e); } } return `✅ Campanha "${finalName}" atualizada! (Campos: ${updatedFields})`; } else { return `⚠️ Erro modificar (Status: ${response.status}).`; } } catch (error: any) { console.error("[INTERNAL] Erro modify:", error.response?.data || error.message); if (error.code === 'ECONNREFUSED') return `❌ Falha conexão.`; return `❌ Falha modificar: ${error.response?.data?.message || error.message || 'Erro API.'}`; } }
const formatCurrency = (value?: number | null): string => { if (typeof value !== 'number' || isNaN(value)) return 'N/D'; return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); };

// --- Handler Principal da API ---
export default async function handler( req: NextApiRequest, res: NextApiResponse<AgentApiResponse | { error: string }> ) {
    if (req.method !== 'POST') { res.setHeader('Allow', ['POST']); return res.status(405).json({ error: 'Method Not Allowed' }); }
    const sessionId = req.headers['x-session-id'] as string || req.headers['x-real-ip'] as string || req.headers['user-agent'] || 'default-session';
    const { message, context }: RequestBody = req.body;
    if (!message || !context || !context.path) { return res.status(400).json({ error: 'Parâmetros obrigatórios: message, context.path' }); }
    let agentResponse = ""; let agentAction: AgentAction | null = null; let lastMessageOrder = 0;
    try {
        const dbHistory: DbHistoryMessage[] = await getHistoryFromDB(sessionId, MAX_HISTORY_DB_MESSAGES);
        lastMessageOrder = dbHistory.length > 0 ? (dbHistory[dbHistory.length - 1].message_order ?? 0) : 0;
        const currentHistoryForLLM: Groq.Chat.Completions.ChatCompletionMessageParam[] = [ { role: "system", content: TOOL_DEFINITIONS_PROMPT }, ...dbHistory.map((dbMsg): Groq.Chat.Completions.ChatCompletionMessageParam | null => { let contentForRole: string | null = dbMsg.content; if ((dbMsg.role === 'system' || dbMsg.role === 'user' || dbMsg.role === 'tool') && contentForRole === null) { contentForRole = ''; } const baseMsg: any = { role: dbMsg.role, content: contentForRole }; if (dbMsg.role === 'tool' && dbMsg.tool_call_id) { baseMsg.tool_call_id = dbMsg.tool_call_id; if (dbMsg.name) baseMsg.name = dbMsg.name; } else if (dbMsg.role === 'function' && dbMsg.name) { baseMsg.name = dbMsg.name; } return baseMsg as Groq.Chat.Completions.ChatCompletionMessageParam; }).filter((msg): msg is Groq.Chat.Completions.ChatCompletionMessageParam => msg !== null), { role: "user", content: message } ];
        console.log(`[API MCP ${sessionId}] Recebido: "${message}". Enviando ${currentHistoryForLLM.length} msgs para Groq.`);
        await saveMessageToDB(sessionId, { role: 'user', content: message }, lastMessageOrder + 1); lastMessageOrder++;
        if (!groqApiKey || !groqApiKey.startsWith('gsk_')) { throw new Error("Chave Groq inválida."); }
        const completion = await groq.chat.completions.create({ messages: currentHistoryForLLM, model: GROQ_MODEL, temperature: 0.3, max_tokens: 1024 }); // Temperatura ainda mais baixa
        const assistantResponseContent = completion.choices[0]?.message?.content || ""; console.log(`[API MCP ${sessionId}] Groq Raw:`, assistantResponseContent);
        if (assistantResponseContent || completion.choices[0]?.message?.tool_calls) { await saveMessageToDB(sessionId, { role: 'assistant', content: assistantResponseContent }, lastMessageOrder + 1); lastMessageOrder++; } else { console.warn(`[API MCP ${sessionId}] Groq resposta vazia.`); agentResponse = "Desculpe, não consegui gerar resposta."; return res.status(200).json({ response: agentResponse, action: agentAction }); }
        let toolCall = null; const trimmedResponse = assistantResponseContent?.trim() ?? '';
        if (trimmedResponse.startsWith('{') && trimmedResponse.endsWith('}')) { try { toolCall = JSON.parse(trimmedResponse); if (!toolCall.tool || typeof toolCall.arguments !== 'object') { toolCall = null; } } catch (e) { toolCall = null; } }
        if (toolCall) {
            console.log(`[API MCP ${sessionId}] Ferramenta Detectada:`, toolCall); let toolResult = "Erro ferramenta."; let toolName = toolCall.tool;
            switch (toolName) { case 'create_campaign': toolResult = await internalCreateCampaign(toolCall.arguments); break; case 'get_campaign_details': toolResult = await internalGetCampaignDetails(toolCall.arguments); break; case 'list_campaigns': toolResult = await internalListCampaigns(toolCall.arguments); break; case 'modify_campaign': toolResult = await internalModifyCampaign(toolCall.arguments); break; case 'navigate': agentResponse = `Ok, navegando para ${toolCall.arguments?.path}...`; agentAction = { type: 'navigate', payload: toolCall.arguments }; toolResult = `(Navegação para ${toolCall.arguments?.path})`; break; default: toolResult = `Erro: Ferramenta '${toolName}' desconhecida.`; }
            console.log(`[API MCP ${sessionId}] Resultado Ferramenta:`, toolResult);
            if (toolName !== 'navigate') { agentResponse = toolResult; const toolCallId = `mcp_tool_call_${Date.now()}`; await saveMessageToDB(sessionId, { role: "tool", tool_call_id: toolCallId, name: toolName, content: toolResult }, lastMessageOrder + 1); lastMessageOrder++; }
        } else { agentResponse = assistantResponseContent; agentAction = null; }
    } catch (error: any) { console.error(`[API MCP ${sessionId}] Erro Handler:`, error); agentResponse = `Erro assistente IA (${error?.status || error?.name || 'desconhecido'}).`; agentAction = null; try { await saveMessageToDB(sessionId, { role: 'assistant', content: `Erro Interno: ${error.message}` }, lastMessageOrder + 1); } catch {} }
    if (!agentResponse) { agentResponse = "Problema."; } console.log(`[API MCP ${sessionId}] Enviando Resposta Final:`, { response: agentResponse, action: agentAction });
    res.status(200).json({ response: agentResponse, action: agentAction });
}
