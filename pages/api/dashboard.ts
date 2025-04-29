// pages/api/dashboard.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getDbPool, initializeAllTables } from '@/lib/db-mysql'; // Usa MySQL
import { format, parseISO, isValid, startOfDay, endOfDay, subDays, differenceInDays } from 'date-fns';
import mysql from 'mysql2/promise';

// Tipos para os dados do Dashboard
interface DashboardTotals {
    totalUsers: number; // Nota: Pode ser difícil calcular sem mais dados
    totalRevenue: number;
    totalClicks: number;
    totalSales: number; // = Conversões
    totalCost: number;
    totalBudget: number; // Estimado ou de 'campaigns'
}

interface DailyDataPoint {
    date: string; // YYYY-MM-DD
    revenue: number;
    clicks: number;
}

// Tipo da Resposta da API
interface DashboardData {
    totals: DashboardTotals;
    dailyData: DailyDataPoint[];
    // Alterações vs período anterior (calculado aqui)
    userChange?: string | null;
    revenueChange?: string | null;
    clickChange?: string | null;
    salesChange?: string | null;
}

// Função auxiliar para calcular a mudança percentual
const calculateChange = (current: number, previous: number): string | null => {
    if (previous === 0) return current > 0 ? "+100.0%" : "0.0%";
    if (current === null || previous === null || isNaN(current) || isNaN(previous)) return null;
    const change = ((current - previous) / previous) * 100;
    // Evita retornar NaN ou Infinity se current for 0 e previous 0
     if (!isFinite(change)) return "0.0%";
    return `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`;
};

// Função auxiliar para buscar dados agregados
async function getAggregatedData(
    connection: mysql.PoolConnection,
    startDate: string,
    endDate: string,
    campaignId: number | null
): Promise<{ totalRevenue: number; totalClicks: number; totalSales: number; totalCost: number; totalBudget: number; }> {

    let baseSql = `
        SELECT
            COALESCE(SUM(d.revenue), 0) AS totalRevenue,
            COALESCE(SUM(d.clicks), 0) AS totalClicks,
            COALESCE(SUM(d.conversions), 0) AS totalSales,
            COALESCE(SUM(d.cost), 0) AS totalCost,
            COALESCE(SUM(c.budget), 0) AS totalBudgetSum,
            COALESCE(SUM(c.daily_budget) * ?, 0) AS totalDailyBudgetSumEstimated
        FROM daily_metrics d
        LEFT JOIN campaigns c ON d.campaign_id = c.id
        WHERE d.metric_date BETWEEN ? AND ?
    `;
    // Estimar dias no período para multiplicar orçamento diário
    const daysInPeriod = differenceInDays(parseISO(endDate), parseISO(startDate)) + 1;
    const params: (string | number | null)[] = [daysInPeriod, startDate, endDate];

    if (campaignId !== null) {
        baseSql += ' AND d.campaign_id = ?';
        // Se filtrar por campanha, busca o orçamento específico dela
         baseSql = baseSql.replace('SUM(c.budget)', 'c.budget'); // Pega orçamento total direto
         baseSql = baseSql.replace('SUM(c.daily_budget) * ?', 'c.daily_budget * ?'); // Pega orçamento diário direto
         params[0] = daysInPeriod; // Mantém daysInPeriod para multiplicar daily_budget
         params.push(campaignId);
    }

    console.log("[API DB Query Agg]", connection.format(baseSql, params));
    const [rows] = await connection.query<mysql.RowDataPacket[]>(baseSql, params);

    const result = rows[0] || { totalRevenue: 0, totalClicks: 0, totalSales: 0, totalCost: 0, totalBudgetSum: 0, totalDailyBudgetSumEstimated: 0 };

    // Decide qual orçamento usar: total se disponível e filtrado por 1 camp, senão estimado diário
    const totalBudget = campaignId !== null && result.totalBudgetSum > 0 ? result.totalBudgetSum : result.totalDailyBudgetSumEstimated;


    return {
        totalRevenue: Number(result.totalRevenue),
        totalClicks: Number(result.totalClicks),
        totalSales: Number(result.totalSales),
        totalCost: Number(result.totalCost),
        totalBudget: Number(totalBudget) // Usa a lógica para definir o orçamento
    };
}

// Função auxiliar para buscar dados diários
async function getDailyData(
    connection: mysql.PoolConnection,
    startDate: string,
    endDate: string,
    campaignId: number | null
): Promise<DailyDataPoint[]> {
    let sql = `
        SELECT
            DATE_FORMAT(metric_date, '%Y-%m-%d') AS date,
            COALESCE(SUM(revenue), 0) AS revenue,
            COALESCE(SUM(clicks), 0) AS clicks
        FROM daily_metrics
        WHERE metric_date BETWEEN ? AND ?
    `;
    const params: (string | number)[] = [startDate, endDate];

    if (campaignId !== null) {
        sql += ' AND campaign_id = ?';
        params.push(campaignId);
    }

    sql += ' GROUP BY date ORDER BY date ASC';

    console.log("[API DB Query Daily]", connection.format(sql, params));
    const [rows] = await connection.query<mysql.RowDataPacket[]>(sql, params);

    return rows.map(row => ({
        date: row.date,
        revenue: Number(row.revenue),
        clicks: Number(row.clicks)
    }));
}


export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<DashboardData | { error: string }>
) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { startDate: startDateStr, endDate: endDateStr, campaignId: campaignIdStr } = req.query;

    // Validação
    if (!startDateStr || !endDateStr || typeof startDateStr !== 'string' || typeof endDateStr !== 'string') {
        return res.status(400).json({ error: 'startDate e endDate são obrigatórios.' });
    }
    const start = startOfDay(parseISO(startDateStr));
    const end = endOfDay(parseISO(endDateStr));
    if (!isValid(start) || !isValid(end) || end < start) {
        return res.status(400).json({ error: 'Datas inválidas.' });
    }

    const campaignId = (campaignIdStr && typeof campaignIdStr === 'string' && campaignIdStr !== 'all')
        ? parseInt(campaignIdStr, 10)
        : null;
    if (campaignIdStr && campaignIdStr !== 'all' && (campaignId === null || isNaN(campaignId))) {
         return res.status(400).json({ error: 'campaignId inválido.' });
    }


    let connection: mysql.PoolConnection | null = null;
    try {
        const pool = getDbPool();
        connection = await pool.getConnection();
        await initializeAllTables(); // Garante tabelas

        // Período Atual
        const currentData = await getAggregatedData(connection, startDateStr, endDateStr, campaignId);
        const currentDaily = await getDailyData(connection, startDateStr, endDateStr, campaignId);

        // Período Anterior para comparação
        const daysInPeriod = differenceInDays(end, start); // 0-indexed difference
        const prevEndDate = subDays(start, 1);
        const prevStartDate = subDays(prevEndDate, daysInPeriod);
        const prevStartDateStr = format(prevStartDate, 'yyyy-MM-dd');
        const prevEndDateStr = format(prevEndDate, 'yyyy-MM-dd');
        const prevData = await getAggregatedData(connection, prevStartDateStr, prevEndDateStr, campaignId);

        // Calcular Totais e Mudanças
        const responseData: DashboardData = {
            totals: {
                // TODO: Calcular totalUsers se tiver como (ex: tabela de leads ou users únicos por período)
                totalUsers: Math.floor(currentData.totalClicks * (0.05 + Math.random() * 0.1)), // Mock para usuários
                totalRevenue: currentData.totalRevenue,
                totalClicks: currentData.totalClicks,
                totalSales: currentData.totalSales,
                totalCost: currentData.totalCost,
                totalBudget: currentData.totalBudget,
            },
            dailyData: currentDaily,
            // Calcula as mudanças
            revenueChange: calculateChange(currentData.totalRevenue, prevData.totalRevenue),
            clickChange: calculateChange(currentData.totalClicks, prevData.totalClicks),
            salesChange: calculateChange(currentData.totalSales, prevData.totalSales),
             // TODO: Calcular userChange se tiver dados reais de usuários
             userChange: calculateChange( Math.floor(currentData.totalClicks * (0.05 + Math.random() * 0.1)), Math.floor(prevData.totalClicks * (0.05 + Math.random() * 0.1)) ),
        };

        res.status(200).json(responseData);

    } catch (error: any) {
        console.error('[API /api/dashboard] Erro:', error);
        res.status(500).json({ error: 'Erro ao buscar dados do dashboard.' });
    } finally {
        if (connection) connection.release();
    }
}
