import type { NextApiRequest, NextApiResponse } from 'next';
import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import { ChartConfiguration } from 'chart.js';
import { format, parseISO, isValid, startOfDay, endOfDay, differenceInDays } from 'date-fns';
import { getDbPool, initializeAllTables } from '@/lib/db-mysql'; // Usa MySQL
import mysql from 'mysql2/promise';

// --- Estruturas e Funções ---
interface FunnelStage { name: string; value: number; displayValue: string; color?: string; }
interface PeriodResult { daily: number; weekly: number; monthly: number; }
// Estrutura de resposta da API (ATUALIZADA)
interface FunnelData {
    clientName: string; // Nome da Campanha ou "Todas as Campanhas"
    productName: string; // Período selecionado
    funnelData: FunnelStage[]; // Etapas calculadas com dados reais
    volume: PeriodResult; // Vendas/dia, semana, mês
    revenue: PeriodResult; // Receita/dia, semana, mês
    profit: PeriodResult; // Lucro/dia, semana, mês
    chartImageUrl?: string | null; // URL da imagem do gráfico gerado (opcional)
    // Adicionar métricas base para o frontend, se necessário para display
    totalInvestment?: number;
    totalClicks?: number;
    totalConversions?: number;
    totalRevenue?: number;
}

const formatCurrency = (value: number): string => isNaN(value) ? 'R$ 0,00' : value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const formatNumber = (value: number): string => isNaN(value) ? '0' : value.toLocaleString('pt-BR', { maximumFractionDigits: 0 });

// --- Configuração Chart.js (Opcional no backend, pode ser feito no frontend) ---
const chartWidth = 450; const chartHeight = 300;
const chartJSNodeCanvas = new ChartJSNodeCanvas({ width: chartWidth, height: chartHeight, backgroundColour: '#141414', chartCallback: (ChartJS) => { /* Configurações ChartJS */ } });

const generateFunnelBarChart = async (stages: FunnelStage[]): Promise<string | null> => {
    if (!stages || stages.length === 0) return null;
    const validStages = stages.filter(s => typeof s.value === 'number' && s.value >= 0);
    if (validStages.length === 0) return null;

    const defaultColors = ['#6c757d', '#0d6efd', '#198754', '#ffc107']; // Cores para Investimento, Cliques, Conversões, Receita

    const config: ChartConfiguration = {
        type: 'bar',
        data: {
            labels: validStages.map(s => s.name),
            datasets: [{
                label: 'Volume/Valor',
                data: validStages.map(s => s.value),
                backgroundColor: validStages.map((s, i) => s.color || defaultColors[i % defaultColors.length]),
                borderColor: validStages.map((s, i) => s.color || defaultColors[i % defaultColors.length]),
                borderWidth: 0, // Sem borda
                borderRadius: 3,
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: false, maintainAspectRatio: false, animation: false,
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: { font: { size: 10 }, color: '#a0aec0', callback: (value) => { /*...*/ return value; } }, // Ajustar callback se necessário
                    grid: { color: 'rgba(255, 255, 255, 0.05)' }
                },
                y: { ticks: { font: { size: 10 }, color: '#a0aec0' }, grid: { drawOnChartArea: false } }
            },
            plugins: {
                legend: { display: false },
                title: { display: true, text: 'Funil Baseado em Dados Reais', font: { size: 14, weight: 'bold' }, color: '#e2e8f0', padding: { top: 10, bottom: 15 } },
                tooltip: { enabled: true, // Habilitar tooltip pode ser útil
                   backgroundColor: 'rgba(0,0,0,0.7)', titleColor: '#fff', bodyColor: '#fff',
                   callbacks: {
                       label: function(context) {
                           let label = context.dataset.label || '';
                           if (label) { label += ': '; }
                           if (context.parsed.x !== null) {
                               // Formatação pode ser mais específica aqui baseada no nome da etapa
                               if(context.label === 'Investimento' || context.label === 'Faturamento') {
                                   label += formatCurrency(context.parsed.x);
                               } else {
                                   label += formatNumber(context.parsed.x);
                               }
                           }
                           return label;
                       }
                   }
                }
            }
        }
    };
    try {
        const dataUrl = await chartJSNodeCanvas.renderToDataURL(config);
        return dataUrl;
    } catch (e) {
        console.error('[Chart Gen Funnel] Erro ao gerar gráfico:', e);
        return null;
    }
};

// --- Handler da API ---
export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<FunnelData | { message: string; error?: string; code?: string; }>
) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        return res.status(405).json({ message: `Método ${req.method} Não Permitido` });
    }

    let connection: mysql.PoolConnection | null = null; // Use PoolConnection
    try {
        const pool = getDbPool();
        if (!pool) throw new Error("Falha ao obter pool de conexão MySQL.");
        connection = await pool.getConnection(); // Obter conexão do pool

        await initializeAllTables(); // Garantir tabelas (pode ser feito no início do app)

        const { startDate: startDateStr, endDate: endDateStr, campaignId } = req.query;

        // Validação
        if (typeof startDateStr !== 'string' || typeof endDateStr !== 'string' || !startDateStr || !endDateStr) {
            return res.status(400).json({ message: 'startDate e endDate são obrigatórios.' });
        }
        const start = startOfDay(parseISO(startDateStr));
        const end = endOfDay(parseISO(endDateStr));
        if (!isValid(start) || !isValid(end) || end < start) {
            return res.status(400).json({ message: 'Formato de data inválido ou data final anterior à inicial.' });
        }

        const startDateSql = format(start, 'yyyy-MM-dd HH:mm:ss'); // Usar formato DATETIME para queries
        const endDateSql = format(end, 'yyyy-MM-dd HH:mm:ss');
        const numberOfDays = differenceInDays(end, start) + 1;

        // --- BUSCAR DADOS REAIS DA TABELA daily_metrics ---
        let sql = `
            SELECT
                SUM(cost) as totalCost,
                SUM(clicks) as totalClicks,
                SUM(conversions) as totalConversions,
                SUM(revenue) as totalRevenue
            FROM daily_metrics
            WHERE metric_date BETWEEN ? AND ?
        `;
        const params: (string | number)[] = [startDateSql, endDateSql];
        let campaignName = "Todas as Campanhas";

        if (campaignId && typeof campaignId === 'string' && campaignId !== 'all') {
            const campaignIdNum = parseInt(campaignId, 10);
            if (!isNaN(campaignIdNum)) {
                sql += ' AND campaign_id = ?';
                params.push(campaignIdNum);
                // Buscar nome da campanha específica
                const [campaignRows] = await connection.query<mysql.RowDataPacket[]>(
                    'SELECT name FROM campaigns WHERE id = ?', [campaignIdNum]
                );
                if (campaignRows.length > 0) {
                    campaignName = campaignRows[0].name;
                } else {
                     campaignName = `Campanha ID ${campaignIdNum} (Não encontrada)`;
                }
            } else {
                 return res.status(400).json({ message: 'campaignId inválido.' });
            }
        }

        console.log("[API Funnel] Query SQL:", connection.format(sql, params)); // Log formatado
        const [rows] = await connection.query<mysql.RowDataPacket[]>(sql, params);

        const aggregatedData = {
            totalCost: Number(rows[0]?.totalCost ?? 0),
            totalClicks: Number(rows[0]?.totalClicks ?? 0),
            totalConversions: Number(rows[0]?.totalConversions ?? 0),
            totalRevenue: Number(rows[0]?.totalRevenue ?? 0),
        };
        console.log("[API Funnel] Dados Agregados:", aggregatedData);

        // --- Calcular métricas e formatar resposta ---
        const totalInvestment = aggregatedData.totalCost;
        const totalClicks = aggregatedData.totalClicks; // Usando cliques como proxy para visitantes
        const totalSales = aggregatedData.totalConversions;
        const totalRevenue = aggregatedData.totalRevenue;
        const totalProfit = totalRevenue - totalInvestment;

        const avgDailySales = numberOfDays > 0 ? totalSales / numberOfDays : 0;
        const avgDailyRevenue = numberOfDays > 0 ? totalRevenue / numberOfDays : 0;
        const avgDailyProfit = numberOfDays > 0 ? totalProfit / numberOfDays : 0;

        // Montar os dados do funil para o gráfico/frontend
        const funnelStepsData: FunnelStage[] = [
            { name: "Investimento", value: totalInvestment, displayValue: formatCurrency(totalInvestment), color: '#6c757d' },
            { name: "Visitantes (Cliques)", value: totalClicks, displayValue: formatNumber(totalClicks), color: '#0d6efd' },
            { name: "Vendas (Conversões)", value: totalSales, displayValue: formatNumber(totalSales), color: '#198754' },
            { name: "Faturamento", value: totalRevenue, displayValue: formatCurrency(totalRevenue), color: '#ffc107' },
            // Poderia adicionar Lucro aqui se fizesse sentido visualmente
            // { name: "Lucro", value: totalProfit, displayValue: formatCurrency(totalProfit), color: '#32CD32' },
        ];

        const volumeData: PeriodResult = { daily: avgDailySales, weekly: avgDailySales * 7, monthly: avgDailySales * 30 };
        const revenueData: PeriodResult = { daily: avgDailyRevenue, weekly: avgDailyRevenue * 7, monthly: avgDailyRevenue * 30 };
        const profitData: PeriodResult = { daily: avgDailyProfit, weekly: avgDailyProfit * 7, monthly: avgDailyProfit * 30 };

        // Gera Gráfico (opcional, pode ser feito no frontend)
        const imageUrl = await generateFunnelBarChart(funnelStepsData);

        const responseData: FunnelData = {
            clientName: campaignName,
            productName: `Período: ${format(start, 'dd/MM/yy')} - ${format(end, 'dd/MM/yy')}`,
            funnelData: funnelStepsData.map(s => ({...s, value: parseFloat(s.value.toFixed(2))})), // Ajustar precisão
            volume: { daily: parseFloat(volumeData.daily.toFixed(0)), weekly: parseFloat(volumeData.weekly.toFixed(0)), monthly: parseFloat(volumeData.monthly.toFixed(0)) },
            revenue: { daily: parseFloat(revenueData.daily.toFixed(2)), weekly: parseFloat(revenueData.weekly.toFixed(2)), monthly: parseFloat(revenueData.monthly.toFixed(2)) },
            profit: { daily: parseFloat(profitData.daily.toFixed(2)), weekly: parseFloat(profitData.weekly.toFixed(2)), monthly: parseFloat(profitData.monthly.toFixed(2)) },
            chartImageUrl: imageUrl,
            // Incluir totais na resposta para o frontend usar se precisar
            totalInvestment: parseFloat(totalInvestment.toFixed(2)),
            totalClicks: totalClicks,
            totalConversions: totalSales,
            totalRevenue: parseFloat(totalRevenue.toFixed(2)),
        };

        res.status(200).json(responseData);

    } catch (error: any) {
        console.error("[API /api/funnel] Erro:", error);
        res.status(500).json({ message: `Erro Interno: ${error.message || 'Erro desconhecido'}`, error: error.message, code: error.code });
    } finally {
        if (connection) {
            connection.release(); // Liberar conexão de volta ao pool
            console.log("[API Funnel] Conexão liberada.");
        }
    }
}
