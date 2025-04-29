// pages/api/metrics.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getDbPool, initializeAllTables } from '@/lib/db-mysql'; // Importe seu pool MySQL
import { format, parseISO, isValid, startOfDay, endOfDay } from 'date-fns';

// Tipos de dados esperados pela API e retornados
interface MetricsTotals {
    clicks: number;
    impressions: number; // Adicionado se você tiver essa coluna
    conversions: number;
    cost: number;
    revenue: number;
    ctr?: number | null;
    cpc?: number | null;
    conversionRate?: number | null;
    costPerConversion?: number | null;
    roi?: number | null;
}

interface DailyMetric {
    date: string; // Formato YYYY-MM-DD
    clicks: number;
    impressions: number; // Adicionado se você tiver essa coluna
    conversions: number;
    cost: number;
    revenue: number;
}

interface MetricsData {
    totals: MetricsTotals;
    dailyData: DailyMetric[];
}

// Função auxiliar para calcular métricas derivadas
function calculateDerivedMetrics(totals: Omit<MetricsTotals, 'ctr' | 'cpc' | 'conversionRate' | 'costPerConversion' | 'roi'>): MetricsTotals {
    const clicks = totals.clicks ?? 0;
    const impressions = totals.impressions ?? 0; // Use 0 se não houver impressões
    const conversions = totals.conversions ?? 0;
    const cost = totals.cost ?? 0;
    const revenue = totals.revenue ?? 0;

    const ctr = impressions > 0 ? (clicks / impressions) * 100 : null; // Ou 0 se preferir
    const cpc = clicks > 0 ? cost / clicks : null; // Ou 0
    const conversionRate = clicks > 0 ? (conversions / clicks) * 100 : null; // Ou 0
    const costPerConversion = conversions > 0 ? cost / conversions : null; // Ou 0
    // ROI: se cost=0 e revenue>0, ROI é infinito positivo. Se cost=0 e revenue=0, ROI é indefinido.
    // Tratar Infinity e NaN explicitamente
    const rawRoi = cost > 0 ? ((revenue - cost) / cost) * 100 : (revenue > 0 ? Infinity : NaN); // Usar NaN para indefinido

    const safeMetric = (value: number | null | undefined): number | null => {
        // Verifica se é null, undefined, NaN ou Infinity/ -Infinity
        if (value === null || value === undefined || isNaN(value) || !isFinite(value)) {
            return null;
        }
        return value;
    };


    return {
        ...totals,
        impressions, // Inclui impressões no retorno
        ctr: safeMetric(ctr),
        cpc: safeMetric(cpc),
        conversionRate: safeMetric(conversionRate),
        costPerConversion: safeMetric(costPerConversion),
        roi: safeMetric(rawRoi), // Usa o resultado rawRoi aqui
    };
}


export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<MetricsData | { error: string }>
) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { startDate: startDateStr, endDate: endDateStr, campaignId } = req.query;

    // Validação das datas
    if (!startDateStr || !endDateStr || typeof startDateStr !== 'string' || typeof endDateStr !== 'string') {
        return res.status(400).json({ error: 'Start date and end date are required.' });
    }

    const startDate = startOfDay(parseISO(startDateStr));
    const endDate = endOfDay(parseISO(endDateStr)); // Use endOfDay para incluir o dia final inteiro

    if (!isValid(startDate) || !isValid(endDate)) {
        return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
    }

    const pool = getDbPool();
    let connection;

    try {
        // Inicializa tabelas (opcional aqui, pode ser feito no início do app)
        // await initializeAllTables(); // Melhor rodar isso uma vez na inicialização do app

        connection = await pool.getConnection();

        // --- Lógica para tratar campaignId ---
        let campaignIdNumber: number | null = null;
        if (campaignId && typeof campaignId === 'string' && campaignId !== 'all') {
             const parsedId = parseInt(campaignId, 10);
             // Verifica se o parsedId é um número válido antes de usá-lo
             if (!isNaN(parsedId)) {
                 campaignIdNumber = parsedId;
             } else {
                 console.warn(`[API Metrics] campaignId '${campaignId}' não é um número válido.`);
                 // Opcional: retornar um erro 400 aqui se campaignId inválido for um problema
                 // return res.status(400).json({ error: 'Invalid campaign ID.' });
                 // Se não retornar erro, ele simplesmente tratará como se campaignId não tivesse sido fornecido.
             }
        }


        // --- Query para Totais Agregados ---
        let totalsQuery = `
            SELECT
                COALESCE(SUM(clicks), 0) AS clicks,
                COALESCE(SUM(impressions), 0) AS impressions,
                COALESCE(SUM(conversions), 0) AS conversions,
                COALESCE(SUM(cost), 0) AS cost,
                COALESCE(SUM(revenue), 0) AS revenue
            FROM daily_metrics
            WHERE metric_date BETWEEN ? AND ?
        `;
        const totalsParams: (string | number)[] = [
            format(startDate, 'yyyy-MM-dd HH:mm:ss'),
            format(endDate, 'yyyy-MM-dd HH:mm:ss')
        ];

        // Só adiciona a cláusula WHERE se campaignIdNumber for um número válido
        if (campaignIdNumber !== null) {
            totalsQuery += ' AND campaign_id = ?';
            totalsParams.push(campaignIdNumber);
        }

        const [totalsResult]: any = await connection.query(totalsQuery, totalsParams);
        const rawTotals = totalsResult[0] || { clicks: 0, impressions: 0, conversions: 0, cost: 0, revenue: 0 };

        // Calcular métricas derivadas
        const totals = calculateDerivedMetrics(rawTotals);


        // --- Query para Dados Diários ---
        let dailyQuery = `
            SELECT
                DATE_FORMAT(metric_date, '%Y-%m-%d') AS date,
                COALESCE(SUM(clicks), 0) AS clicks,
                COALESCE(SUM(impressions), 0) AS impressions,
                COALESCE(SUM(conversions), 0) AS conversions,
                COALESCE(SUM(cost), 0) AS cost,
                COALESCE(SUM(revenue), 0) AS revenue
            FROM daily_metrics
            WHERE metric_date BETWEEN ? AND ?
        `;
        const dailyParams: (string | number)[] = [
             format(startDate, 'yyyy-MM-dd HH:mm:ss'),
             format(endDate, 'yyyy-MM-dd HH:mm:ss')
        ];

        // Só adiciona a cláusula WHERE se campaignIdNumber for um número válido
        if (campaignIdNumber !== null) {
            dailyQuery += ' AND campaign_id = ?';
            dailyParams.push(campaignIdNumber);
        }

        dailyQuery += ' GROUP BY DATE_FORMAT(metric_date, \'%Y-%m-%d\') ORDER BY date ASC';

        const [dailyResult]: any = await connection.query(dailyQuery, dailyParams);
        // Garante que os valores numéricos sejam números
        const dailyData: DailyMetric[] = dailyResult.map((row: any) => ({
             date: row.date,
             clicks: Number(row.clicks ?? 0),
             impressions: Number(row.impressions ?? 0),
             conversions: Number(row.conversions ?? 0),
             cost: Number(row.cost ?? 0),
             revenue: Number(row.revenue ?? 0),
         }));

        res.status(200).json({ totals, dailyData });

    } catch (error) {
        console.error('Error fetching metrics data:', error);
        res.status(500).json({ error: 'Failed to fetch metrics data from database.' });
    } finally {
        if (connection) {
            connection.release(); // Libera a conexão de volta para o pool
        }
    }
}
