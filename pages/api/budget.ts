// pages/api/budget.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import { ChartConfiguration } from 'chart.js';
import { format, parseISO, isValid, startOfDay, endOfDay } from 'date-fns';
import { getDbPool, initializeAllTables } from '@/lib/db-mysql'; // Usa initializeAllTables
import mysql from 'mysql2/promise';

// Funções de formatação
const formatCurrency = (value: number): string => isNaN(value) ? 'R$ 0,00' : value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const formatPercentage = (value: number): string => `${Number(value).toFixed(1)}%`;

// Estrutura da resposta ATUALIZADA
type BudgetData = {
  totalBudget?: number; totalBudgetFmt?: string;
  totalRealCost?: number; totalRealCostFmt?: string;
  totalRevenue?: number; totalRevenueFmt?: string;
  realProfit?: number; realProfitFmt?: string;
  budgetUsedPerc?: number;
  budgetRemaining?: number; budgetRemainingFmt?: string;
  realProfitMargin?: number | null;
  // Campos de custo planejado por categoria (opcional manter se usar no gráfico)
  trafficCost?: number; trafficCostFmt?: string; trafficPerc?: number;
  creativeCost?: number; creativeCostFmt?: string; creativePerc?: number;
  operationalCost?: number; operationalCostFmt?: string; opPerc?: number;
  unallocatedValue?: number; unallocatedFmt?: string; unallocatedPerc?: number;
  chartImageUrl?: string | null; // Pode ser usado para um gráfico diferente agora
};

// Configuração Chart.js
const chartWidth = 400; const chartHeight = 250;
const chartJSNodeCanvas = new ChartJSNodeCanvas({ width: chartWidth, height: chartHeight, backgroundColour: '#ffffff' });

// <<< FUNÇÃO generatePieChart RESTAURADA >>>
const generatePieChart = async (data: { label: string; value: number; color: string }[]): Promise<string | null> => {
     if (!data || data.length === 0) return null;
     const validData = data.filter(d => d.value > 0); // Filtra valores zero/negativos para pizza
     if (validData.length === 0) return null;

     const config: ChartConfiguration = {
         type: 'doughnut',
         data: {
             labels: validData.map(d => d.label),
             datasets: [{
                 label: 'Distribuição', // Rótulo do Dataset
                 data: validData.map(d => d.value),
                 backgroundColor: validData.map(d => d.color),
                 borderColor: '#fff',
                 borderWidth: 1
             }]
         },
         options: {
             responsive: false, animation: false,
             plugins: {
                 legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 10 }, padding: 15 }},
                 title: { display: true, text: 'Distribuição de Custos Planejados', font: { size: 14, weight: 'bold' }, padding: { top: 10, bottom: 10 }},
                 tooltip: { enabled: false } // Desabilitado na imagem
             }
         }
     };
     try {
         console.log('[Chart Gen Budget] Gerando gráfico de pizza...');
         const dataUrl = await chartJSNodeCanvas.renderToDataURL(config);
         console.log('[Chart Gen Budget] Gráfico de pizza gerado.');
         return dataUrl;
      }
     catch (error) { console.error('[Chart Gen Budget] Erro ao gerar gráfico de pizza:', error); return null; }
 };

// Handler da API
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<BudgetData | { message: string; error?: string; code?: string; }>
) {
  if (req.method === 'GET') {
    let dbPool: mysql.Pool | null = null;
    try {
        dbPool = getDbPool();
        if (!dbPool) throw new Error("Falha ao obter pool de conexão MySQL.");

        // Garante tabelas antes de operar
        await initializeAllTables();

        const { startDate: startDateStr, endDate: endDateStr, campaignId } = req.query;
        console.log(`[API /api/budget] GET Req:`, { startDate: startDateStr, endDate: endDateStr, campaignId });

        // Validação de Datas
        let start: Date | null = null; let end: Date | null = null;
        if (startDateStr && typeof startDateStr === 'string') start = startOfDay(parseISO(startDateStr));
        if (endDateStr && typeof endDateStr === 'string') end = endOfDay(parseISO(endDateStr));
        if ((start && !isValid(start)) || (end && !isValid(end)) || (start && end && end < start)) { start = null; end = null; }
        const startDateSql = start ? format(start, 'yyyy-MM-dd') : null;
        const endDateSql = end ? format(end, 'yyyy-MM-dd') : null;

        // --- BUSCA DADOS REAIS DO BANCO ---
        // 1. Orçamento Planejado e Custos Planejados (da tabela campaigns)
        let campaignSql = `
            SELECT
                SUM(budget) as totalBudgetSum,
                SUM(cost_traffic) as totalTrafficCost,
                SUM(cost_creative) as totalCreativeCost,
                SUM(cost_operational) as totalOperationalCost
            FROM campaigns
            WHERE 1=1
        `;
        const campaignParams: string[] = [];
        if (campaignId && typeof campaignId === 'string' && campaignId !== 'all' && campaignId !== 'manual') {
            campaignSql += ' AND id = ?';
            campaignParams.push(campaignId);
        }
        const [campaignRows] = await dbPool.query<mysql.RowDataPacket[]>(campaignSql, campaignParams);
        const totalBudget = Number(campaignRows[0]?.totalBudgetSum ?? 0);
        const trafficCost = Number(campaignRows[0]?.totalTrafficCost ?? 0); // Custo Tráfego Planejado
        const creativeCost = Number(campaignRows[0]?.totalCreativeCost ?? 0); // Custo Criativo Planejado
        const operationalCost = Number(campaignRows[0]?.totalOperationalCost ?? 0); // Custo Op Planejado

        // 2. Custos e Receita Reais (da tabela daily_metrics) filtrados por data E campanha
        let metricsSql = `
            SELECT
                SUM(cost) as totalRealCostSum,
                SUM(revenue) as totalRevenueSum
            FROM daily_metrics
            WHERE 1=1
        `;
        const metricsParams: (string | null)[] = [];
        if (startDateSql && endDateSql) { metricsSql += ' AND metric_date BETWEEN ? AND ?'; metricsParams.push(startDateSql, endDateSql); }
        if (campaignId && typeof campaignId === 'string' && campaignId !== 'all' && campaignId !== 'manual') { metricsSql += ' AND campaign_id = ?'; metricsParams.push(campaignId); }

        console.log("[API Budget] Metrics Query:", metricsSql);
        console.log("[API Budget] Metrics Params:", metricsParams);
        const [metricsRows] = await dbPool.query<mysql.RowDataPacket[]>(metricsSql, metricsParams);
        const totalRealCost = Number(metricsRows[0]?.totalRealCostSum ?? 0);
        const totalRevenue = Number(metricsRows[0]?.totalRevenueSum ?? 0);

        console.log("[API Budget] Dados Agregados:", { totalBudget, totalRealCost, totalRevenue, trafficCost, creativeCost, operationalCost });

        // --- CALCULAR MÉTRICAS FINAIS ---
        const realProfit = totalRevenue - totalRealCost;
        const allocatedCost = trafficCost + creativeCost + operationalCost; // Soma dos custos PLANJEADOS
        const unallocatedValue = totalBudget - allocatedCost; // Orçamento restante sobre o PLANEJADO
        const budgetUsedPerc = totalBudget > 0 ? (totalRealCost / totalBudget) * 100 : 0; // % Gasto REAL sobre o ORÇAMENTO TOTAL
        const budgetRemaining = totalBudget - totalRealCost; // Quanto sobrou do orçamento total considerando GASTO REAL
        const realProfitMargin = totalRevenue > 0 ? (realProfit / totalRevenue) * 100 : 0;
        const trafficPerc = totalBudget > 0 ? (trafficCost / totalBudget) * 100 : 0;
        const creativePerc = totalBudget > 0 ? (creativeCost / totalBudget) * 100 : 0;
        const opPerc = totalBudget > 0 ? (operationalCost / totalBudget) * 100 : 0;
        const unallocatedPerc = totalBudget > 0 ? (unallocatedValue / totalBudget) * 100 : (totalBudget === 0 ? 100 : 0);

        const budgetDataResponse: BudgetData = {
            totalBudget: totalBudget, totalBudgetFmt: formatCurrency(totalBudget),
            trafficCost: trafficCost, trafficCostFmt: formatCurrency(trafficCost), trafficPerc: parseFloat(trafficPerc.toFixed(1)),
            creativeCost: creativeCost, creativeCostFmt: formatCurrency(creativeCost), creativePerc: parseFloat(creativePerc.toFixed(1)),
            operationalCost: operationalCost, operationalCostFmt: formatCurrency(operationalCost), opPerc: parseFloat(opPerc.toFixed(1)),
            unallocatedValue: unallocatedValue, unallocatedFmt: formatCurrency(unallocatedValue), unallocatedPerc: parseFloat(unallocatedPerc.toFixed(1)),
            totalRevenue: totalRevenue, totalRevenueFmt: formatCurrency(totalRevenue),
            totalRealCost: totalRealCost, totalRealCostFmt: formatCurrency(totalRealCost),
            realProfit: realProfit, realProfitFmt: formatCurrency(realProfit),
            realProfitMargin: isFinite(realProfitMargin) ? parseFloat(realProfitMargin.toFixed(1)) : null,
            budgetUsedPerc: parseFloat(budgetUsedPerc.toFixed(1)),
            budgetRemaining: budgetRemaining, budgetRemainingFmt: formatCurrency(budgetRemaining),
        };

        // --- GERAR GRÁFICO (Distribuição dos custos PLANEJADOS) ---
        const chartData = [ { label: 'Tráfego', value: trafficCost, color: '#0d6efd' }, { label: 'Criativos', value: creativeCost, color: '#198754' }, { label: 'Operacional', value: operationalCost, color: '#ffc107' }, ...(unallocatedValue > 0 ? [{ label: 'Ñ Alocado', value: unallocatedValue, color: '#6c757d' }] : []), ];
        const imageUrl = await generatePieChart(chartData);

        const responseData: BudgetData = { ...budgetDataResponse, chartImageUrl: imageUrl };
        res.status(200).json(responseData);

    } catch (error: any) {
      console.error("[API /api/budget] Erro:", error);
      res.status(500).json({ message: `Erro Interno: ${error.message || 'Erro desconhecido'}`, error: error.message, code: error.code });
    }
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).json({ message: `Método ${req.method} Não Permitido` });
  }
}
