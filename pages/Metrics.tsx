// pages/Metrics.tsx
import React, { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/router';
import Layout from '@/components/layout';
import { Campaign } from '@/entities/Campaign';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import {
    RefreshCw, BarChart2, PieChart as PieChartIcon, LineChart as LineChartIcon,
    Loader2, AlertTriangle, Calendar as CalendarIcon, DollarSign, TrendingUp, Activity, ArrowUpCircle, Users, MousePointerClick, ShoppingCart, Maximize2, Minimize2
} from 'lucide-react'; // Adicionado MousePointerClick, ShoppingCart, Activity se usados com StatCard
import { format, subDays, parseISO, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { DateRange } from "react-day-picker";
import { useToast } from "@/components/ui/use-toast";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import axios from 'axios';
import StatCard from '@/components/dashboard/StatCard'; // Reutilizar o StatCard do dashboard

// --- Tipos (Reutilizando os tipos corretos da API) ---
interface ApiMetricsTotals {
    clicks: number; impressions: number; conversions: number; cost: number; revenue: number;
    ctr: number | null; cpc: number | null; conversionRate: number | null; costPerConversion: number | null; roi: number | null;
}
interface DailyMetric {
    date: string; clicks: number; impressions?: number; conversions: number; cost: number; revenue: number;
    roi?: number | null; ctr?: number | null; cpc?: number | null; conversionRate?: number | null; costPerConversion?: number | null;
}
interface MetricsData { totals: ApiMetricsTotals; dailyData: DailyMetric[]; }
type CampaignOption = Pick<Campaign, 'id' | 'name'>;
type MetricConfigItem = { key: keyof DailyMetric | keyof ApiMetricsTotals; name: string; color: string };
type MetricsMap = { [key: string]: MetricConfigItem[] };

// --- Constantes ---
const DATE_FORMAT_DISPLAY = 'dd/MM/yyyy';
const DATE_FORMAT_AXIS = 'dd/MM';
const DATE_FORMAT_API = 'yyyy-MM-dd';
const DEFAULT_TIMEFRAME_DAYS = 14; // Padrão de 14 dias

// --- Funções Auxiliares Globais (Copied & Adapted) ---
// Função para buscar dados reais da API
const fetchMetricsData = async (startDate: string, endDate: string, campaignId: string | undefined): Promise<MetricsData | null> => {
    try {
        console.log(`[Metrics API CALL] Fetching /api/metrics for: ${startDate} to ${endDate}, Camp: ${campaignId || 'All'}`);
        const response = await axios.get<MetricsData>('/api/metrics', {
            params: { startDate, endDate, campaignId }
        });
        console.log("[Metrics API CALL] Data received:", response.data);

        // Basic validation/sanitization (can be more robust)
        const safeTotals: ApiMetricsTotals = {
            clicks: Number(response.data?.totals?.clicks ?? 0),
            impressions: Number(response.data?.totals?.impressions ?? 0),
            conversions: Number(response.data?.totals?.conversions ?? 0),
            cost: Number(response.data?.totals?.cost ?? 0),
            revenue: Number(response.data?.totals?.revenue ?? 0),
            ctr: response.data?.totals?.ctr !== null ? Number(response.data?.totals?.ctr) : null,
            cpc: response.data?.totals?.cpc !== null ? Number(response.data?.totals?.cpc) : null,
            conversionRate: response.data?.totals?.conversionRate !== null ? Number(response.data?.totals?.conversionRate) : null,
            costPerConversion: response.data?.totals?.costPerConversion !== null ? Number(response.data?.totals?.costPerConversion) : null,
            roi: response.data?.totals?.roi !== null ? Number(response.data?.totals?.roi) : null,
        };

        const safeDailyData: DailyMetric[] = (response.data?.dailyData || []).map(item => ({
            ...item,
            date: item.date, // Assuming API returns YYYY-MM-DD
            clicks: Number(item.clicks ?? 0),
            impressions: Number(item.impressions ?? 0),
            conversions: Number(item.conversions ?? 0),
            cost: Number(item.cost ?? 0),
            revenue: Number(item.revenue ?? 0),
            // Use API calculated derived metrics if available, otherwise null
            ctr: item.ctr !== null && item.ctr !== undefined ? Number(item.ctr) : null,
            cpc: item.cpc !== null && item.cpc !== undefined ? Number(item.cpc) : null,
            conversionRate: item.conversionRate !== null && item.conversionRate !== undefined ? Number(item.conversionRate) : null,
            costPerConversion: item.costPerConversion !== null && item.costPerConversion !== undefined ? Number(item.costPerConversion) : null,
            roi: item.roi !== null && item.roi !== undefined ? Number(item.roi) : null,
        })).sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime()); // Sort by date ascending

        return { totals: safeTotals, dailyData: safeDailyData };

    } catch (error: any) {
        console.error("[Metrics API CALL] Erro API /api/metrics:", error.response?.data || error.message);
        // Rethrow a more specific error message if possible
        let errorMessage = 'Falha ao buscar dados de métricas.';
        if (axios.isAxiosError(error)) {
            errorMessage = error.response?.data?.message || error.response?.data?.error || error.message || errorMessage;
        } else if (error instanceof Error) {
            errorMessage = error.message;
        }
        throw new Error(errorMessage);
    }
};

// Função para formatar valores para exibição
const formatMetricValue = (metricKey: string, value: any): string => {
    const numValue = Number(value);
    if (value === undefined || value === null || isNaN(numValue)) return 'N/A';
    if (!isFinite(numValue)) return value > 0 ? '+Inf' : '-Inf';

    const lowerMetricKey = metricKey.toLowerCase();

    if (lowerMetricKey.includes('click') || lowerMetricKey.includes('impression') || lowerMetricKey.includes('conversion') || lowerMetricKey.includes('users') || lowerMetricKey.includes('leads')) {
        return numValue.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
    }
    if (lowerMetricKey.includes('ctr') || lowerMetricKey.includes('rate') || lowerMetricKey.includes('roi')) {
        return `${numValue.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`; // Uma casa decimal para %
    }
    if (lowerMetricKey.includes('cpc') || lowerMetricKey.includes('cost') || lowerMetricKey.includes('revenue') || lowerMetricKey.includes('budget') || lowerMetricKey.includes('ltv') || lowerMetricKey.includes('ticket')) {
        return `R$ ${numValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return numValue.toLocaleString('pt-BR', { maximumFractionDigits: 1 }); // Padrão com uma casa decimal
};

// Função para formatar o eixo X (data)
const formatXAxis = (tickItem: string): string => {
    try {
        const date = parseISO(tickItem);
        return isValid(date) ? format(date, DATE_FORMAT_AXIS, { locale: ptBR }) : '';
    } catch { return ''; }
};

// Função para formatar o eixo Y (números)
const formatYAxis = (tickItem: number): string => {
     if (tickItem >= 1000000) return `${(tickItem / 1000000).toFixed(1)}M`;
     if (tickItem >= 1000) return `${(tickItem / 1000).toFixed(0)}k`;
     // Avoid showing decimals on Y axis for better readability
     return tickItem.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
};

// --- Componente Principal ---
export default function MetricsPageV2() { // Nome diferente para evitar conflito de cache se necessário
    // --- Estados e Hooks ---
    const { isAuthenticated, isLoading: authLoading } = useAuth();
    const router = useRouter();
    const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
    const [selectedCampaignId, setSelectedCampaignId] = useState<string>("all"); // "all" como padrão
    const [dateRange, setDateRange] = useState<DateRange | undefined>({
        from: subDays(new Date(), DEFAULT_TIMEFRAME_DAYS -1), // Padrão dos últimos N dias
        to: new Date(),
    });
    const [chartType, setChartType] = useState<"line" | "bar" | "pie">("line"); // Tipagem mais estrita
    const [metricType, setMetricType] = useState<"performance" | "costs" | "revenue">("performance");
    const [metricsData, setMetricsData] = useState<DailyMetric[]>([]); // Dados diários para gráficos
    const [keyMetrics, setKeyMetrics] = useState<ApiMetricsTotals | null>(null); // Totais do período
    const [loading, setLoading] = useState(true); // Loading inicial da página
    const [refreshing, setRefreshing] = useState(false); // Loading de atualização de dados
    const [campaignsLoading, setCampaignsLoading] = useState<boolean>(true); // Loading das campanhas
    const [apiError, setApiError] = useState<string | null>(null); // Mensagem de erro da API
    const { toast } = useToast();

    // --- Estilos (Reutilizando do projeto) ---
    const neonColor = '#1E90FF'; // Usar a cor neon diretamente ou importar NEON_COLOR se preferir
    const cardStyle = "bg-[#141414]/80 backdrop-blur-sm shadow-[5px_5px_10px_rgba(0,0,0,0.4),-5px_-5px_10px_rgba(255,255,255,0.05)] rounded-lg border-none";
    const neumorphicInputStyle = "bg-[#141414] text-white shadow-[inset_2px_2px_4px_rgba(0,0,0,0.3),inset_-2px_-2px_4px_rgba(255,255,255,0.05)] placeholder:text-gray-500 border-none focus:ring-2 focus:ring-[#1E90FF] focus:ring-offset-2 focus:ring-offset-[hsl(var(--background))]";
    const neumorphicButtonStyle = "bg-[#141414] border-none text-white shadow-[3px_3px_6px_rgba(0,0,0,0.3),-3px_-3px_6px_rgba(255,255,255,0.05)] hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.3),inset_-2px_-2px_4px_rgba(255,255,255,0.05)] hover:bg-[#1E90FF]/80 active:scale-[0.98] active:brightness-95 transition-all duration-150 ease-out";
    const neumorphicButtonPrimaryStyle = cn(neumorphicButtonStyle, "bg-[#1E90FF]/80 hover:bg-[#1E90FF]/100");
    const labelStyle = "text-xs text-gray-400 mb-1 block"; // Ajustado tamanho label
    const titleStyle = "text-lg font-semibold text-white";

    // --- Mapa de Configuração de Métricas (Dentro do Componente) ---
    const colors = { clicks: "#3b82f6", impressions: "#6366f1", conversions: "#22c55e", ctr: "#eab308", cpc: "#f97316", costPerConversion: "#a855f7", cost: "#ef4444", revenue: "#0ea5e9", roi: "#14b8a6" };
    const metricsMap: MetricsMap = {
        performance: [
            { key: "clicks", name: "Cliques", color: colors.clicks },
            { key: "conversions", name: "Conversões", color: colors.conversions },
            { key: "ctr", name: "CTR (%)", color: colors.ctr },
            { key: "impressions", name: "Impressões", color: colors.impressions },
        ],
        costs: [
            { key: "cost", name: "Custo (R$)", color: colors.cost },
            { key: "cpc", name: "CPC (R$)", color: colors.cpc },
            { key: "costPerConversion", name: "Custo/Conv. (R$)", color: colors.costPerConversion },
        ],
        revenue: [
            { key: "revenue", name: "Receita (R$)", color: colors.revenue },
            { key: "roi", name: "ROI (%)", color: colors.roi },
            { key: "cost", name: "Custo (R$)", color: colors.cost }, // Custo repetido aqui para contexto
        ]
    };

    // Função para obter a config do gráfico atual
    const getChartConfig = (): MetricConfigItem[] => {
        return metricsMap[metricType] || metricsMap.performance;
    };

     // Função para formatar o tooltip (adaptada da versão anterior)
    const formatTooltipValue = (value: number, name: string): [string] | [string, string] => {
         let metricKey: string | undefined;
         const allMetricsConfig: MetricConfigItem[] = [
             ...(metricsMap.performance || []), ...(metricsMap.costs || []), ...(metricsMap.revenue || []),
         ];
         const found = allMetricsConfig.find(m => m.name === name);
         if (found) { metricKey = found.key as string; }
         if (metricKey) { return [`${name}: ${formatMetricValue(metricKey, value)}`]; }
         return [`${name}: ${value.toLocaleString('pt-BR',{maximumFractionDigits: 1})}`]; // Fallback formatado
    };

    // --- Lógica de Carregamento de Dados ---

    // Carregar Campanhas
    const loadCampaigns = useCallback(async () => {
        if (!isAuthenticated) return;
        setCampaignsLoading(true);
        setApiError(null);
        try {
            console.log("[Metrics] Carregando campanhas...");
            const response = await axios.get<CampaignOption[]>('/api/campaigns?fields=id,name&sort=name:asc'); // Ordena por nome
            setCampaigns(response.data || []);
            console.log("[Metrics] Campanhas carregadas:", response.data?.length);
        } catch (error) {
            console.error('[Metrics] Erro ao carregar campanhas:', error);
            const errorMsg = axios.isAxiosError(error) ? error.response?.data?.message || error.message : (error as Error).message;
            toast({ title: "Erro Campanhas", description: errorMsg || "Não foi possível carregar as campanhas.", variant: "destructive" });
            setCampaigns([]);
            setApiError("Erro ao carregar campanhas."); // Define erro se falhar ao carregar campanhas
        } finally {
            setCampaignsLoading(false);
        }
    }, [toast, isAuthenticated]);

    // Carregar Métricas
    const loadMetricsData = useCallback(async (isRefresh = false) => {
        if (!isAuthenticated || !dateRange?.from) {
            console.warn("[Metrics] Load Metrics Abortado: Não autenticado ou sem data de início.");
            return;
        }

        if (!isRefresh) setLoading(true); else setRefreshing(true);
        setApiError(null); // Limpa erro anterior

        const startDateStr = format(dateRange.from, DATE_FORMAT_API);
        const endDate = dateRange.to || dateRange.from; // Usa 'from' se 'to' for nulo
        const endDateStr = format(endDate, DATE_FORMAT_API);
        const campIdToSend = selectedCampaignId === 'all' ? undefined : selectedCampaignId;

        console.log(`[Metrics] Buscando métricas - Período: ${startDateStr} a ${endDateStr}, Campanha: ${campIdToSend || 'Todas'}`);

        try {
            const data = await fetchMetricsData(startDateStr, endDateStr, campIdToSend);

            if (data?.totals && data?.dailyData) {
                setMetricsData(data.dailyData);
                setKeyMetrics(data.totals);
                console.log("[Metrics] Dados de métricas processados com sucesso.");
                if (isRefresh) toast({ title: "Métricas Atualizadas", duration: 2000 });
            } else {
                console.warn("[Metrics] API retornou dados nulos ou vazios para métricas.");
                setMetricsData([]);
                setKeyMetrics(null); // Reset key metrics
            }

        } catch (error: any) {
            console.error('[Metrics] Erro ao carregar dados de métricas:', error);
            const errorMsg = error.message || 'Ocorreu um erro desconhecido.';
            setApiError(errorMsg);
            setMetricsData([]);
            setKeyMetrics(null);
            toast({ title: "Erro de Métricas", description: errorMsg, variant: "destructive" });
        } finally {
            if (!isRefresh) setLoading(false); else setRefreshing(false);
        }
    }, [dateRange, selectedCampaignId, toast, isAuthenticated]); // Dependências corretas

    // --- Efeitos ---

    // Autenticação e Carregamento Inicial de Campanhas
    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            router.push('/login');
        } else if (!authLoading && isAuthenticated) {
            loadCampaigns();
        }
    }, [authLoading, isAuthenticated, router, loadCampaigns]);

    // Carregar Métricas quando período ou campanha mudar (e campanhas já carregadas)
    useEffect(() => {
        // Só carrega se autenticado, não estiver carregando campanhas e tiver data inicial
        if (isAuthenticated && !campaignsLoading && dateRange?.from) {
            loadMetricsData();
        }
        // Não incluir loadMetricsData na dependência para evitar loop inicial
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedCampaignId, dateRange, isAuthenticated, campaignsLoading]);


    // --- Renderização ---

    // Renderização do Gráfico Principal
    const renderChart = () => {
        const data = metricsData;
        const config = getChartConfig();
        const axisTickColor = "#a0aec0"; const gridColor = `${neonColor}33`;
        const tooltipBg = "rgba(20, 20, 20, 0.85)"; const tooltipBorder = `${neonColor}66`;

        // Loading dentro do card
        if (loading || refreshing) {
            return (
                <div className="flex flex-col items-center justify-center h-[400px] text-center text-primary">
                    <Loader2 className="h-8 w-8 animate-spin mb-3" style={{ filter: `drop-shadow(0 0 4px ${neonColor})`}}/>
                    <span className="text-xs text-gray-400">
                         {loading ? "Carregando dados..." : "Atualizando..."}
                    </span>
                </div>
            );
        }

        // Erro dentro do card
        if (apiError && !refreshing) { // Mostra erro apenas se não estiver refreshando
            return (
                <div className="flex flex-col items-center justify-center h-[400px] text-center text-red-400">
                    <AlertTriangle className="h-8 w-8 mb-3" style={{ filter: `drop-shadow(0 0 4px ${neonColor})`}}/>
                    <span className="text-sm font-semibold">Erro ao Carregar Métricas</span>
                    <span className="text-xs mt-1">{apiError}</span>
                    <Button className={cn(neumorphicButtonStyle, "mt-4")} size="sm" onClick={() => loadMetricsData(true)}>
                        <RefreshCw className="h-3 w-3 mr-1.5" />Tentar Novamente
                    </Button>
                </div>
            );
        }

        // Sem dados
        // Verifica se keyMetrics é null E dailyData está vazio, após tentativa de load sem erro
        if (keyMetrics === null && metricsData.length === 0 && !loading && !refreshing && !apiError) {
             return (
                 <div className="flex flex-col items-center justify-center h-[400px] text-center text-gray-500">
                      <BarChart2 className="h-8 w-8 mb-3" />
                      <span className="text-sm font-semibold">Sem Dados</span>
                      <span className="text-xs mt-1">Nenhum dado de métrica encontrado para o período ou campanha selecionada.</span>
                 </div>
             );
        }

        // Gráfico de Linha
        if (chartType === "line" && data.length > 0) {
            return (
                <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={data} margin={{ top: 5, right: 15, left: 5, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                        <XAxis dataKey="date" tickFormatter={formatXAxis} tick={{ fill: axisTickColor, fontSize: 10 }} axisLine={false} tickLine={false} style={{ textShadow: `0 0 4px ${neonColor}`}}/>
                        <YAxis tickFormatter={formatYAxis} tick={{ fill: axisTickColor, fontSize: 10 }} axisLine={false} tickLine={false} style={{ textShadow: `0 0 4px ${neonColor}`}}/>
                        <Tooltip contentStyle={{ backgroundColor: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: '6px', backdropFilter: 'blur(4px)', boxShadow: '5px 5px 10px rgba(0,0,0,0.4)' }} labelStyle={{ color: '#a0aec0', fontSize: '11px', marginBottom: '4px' }} itemStyle={{ color: 'white', fontSize: '11px' }} formatter={formatTooltipValue} />
                        <Legend wrapperStyle={{ color: axisTickColor, fontSize: '10px', paddingTop: '10px' }} />
                        {config.map(metric => ( <Line key={metric.key as string} type="monotone" dataKey={metric.key as string} name={metric.name} stroke={metric.color} strokeWidth={2} dot={false} activeDot={{ r: 5, strokeWidth: 1, fill: metric.color, stroke: '#fff' }} style={{ filter: `drop-shadow(0 0 4px ${metric.color})` }}/> ))}
                    </LineChart>
                </ResponsiveContainer>
            );
        }
        // Gráfico de Barra
        else if (chartType === "bar" && data.length > 0) {
             return (
                 <ResponsiveContainer width="100%" height={400}>
                     <BarChart data={data} margin={{ top: 5, right: 15, left: 5, bottom: 5 }}>
                         <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                         <XAxis dataKey="date" tickFormatter={formatXAxis} tick={{ fill: axisTickColor, fontSize: 10 }} axisLine={false} tickLine={false} style={{ textShadow: `0 0 4px ${neonColor}`}}/>
                         <YAxis tickFormatter={formatYAxis} tick={{ fill: axisTickColor, fontSize: 10 }} axisLine={false} tickLine={false} style={{ textShadow: `0 0 4px ${neonColor}`}}/>
                         <Tooltip contentStyle={{ backgroundColor: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: '6px', backdropFilter: 'blur(4px)', boxShadow: '5px 5px 10px rgba(0,0,0,0.4)' }} labelStyle={{ color: '#a0aec0', fontSize: '11px', marginBottom: '4px' }} itemStyle={{ color: 'white', fontSize: '11px' }} formatter={formatTooltipValue} />
                         <Legend wrapperStyle={{ color: axisTickColor, fontSize: '10px', paddingTop: '10px' }} />
                         {config.map(metric => ( <Bar key={metric.key as string} dataKey={metric.key as string} name={metric.name} fill={metric.color} radius={[2, 2, 0, 0]} fillOpacity={0.8} style={{ filter: `drop-shadow(0 0 3px ${metric.color}88)` }}/> ))}
                     </BarChart>
                 </ResponsiveContainer>
             );
        }
        // Gráfico de Pizza (usando keyMetrics)
        else if (chartType === "pie" && keyMetrics) {
            const pieData = config
                .map(metricConfig => {
                    const value = keyMetrics[metricConfig.key as keyof ApiMetricsTotals];
                     if (typeof value !== 'number' || value === null || !isFinite(value) || value <= 0) { return null; }
                    return { name: metricConfig.name, value: parseFloat(value.toFixed(2)), color: metricConfig.color };
                })
                .filter((d): d is { name: string; value: number; color: string } => d !== null && d.value > 0);

            if (pieData.length === 0) { return <div className="flex items-center justify-center h-[400px] text-gray-500 text-xs">Sem dados agregados válidos para Pizza.</div>; }

            return (
                <ResponsiveContainer width="100%" height={400}>
                    <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" labelLine={false} label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`} outerRadius={130} innerRadius={50} fill="#8884d8" dataKey="value" paddingAngle={3} stroke="none">
                            {pieData.map((entry, index) => ( <Cell key={`cell-${index}`} fill={entry.color} fillOpacity={0.8} style={{ filter: `drop-shadow(0 0 5px ${entry.color})` }}/> ))}
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: '6px', backdropFilter: 'blur(4px)', boxShadow: '5px 5px 10px rgba(0,0,0,0.4)' }} labelStyle={{ color: '#a0aec0', fontSize: '11px', marginBottom: '4px' }} itemStyle={{ color: 'white', fontSize: '11px' }} formatter={(value: number, name: string) => { return formatTooltipValue(value, name); }} />
                        <Legend wrapperStyle={{ color: axisTickColor, fontSize: '10px', paddingTop: '10px' }} />
                    </PieChart>
                </ResponsiveContainer>
            );
        }

        // Fallback se nenhuma condição for atendida (ex: dados diários vazios para linha/barra)
        return <div className="flex items-center justify-center h-[400px] text-gray-500 text-xs">Sem dados para exibir para este tipo de gráfico.</div>;
    }; // Fim de renderChart

    // Loading da página inteira (Auth + Carregamento inicial campanhas)
    if (authLoading || (loading && campaignsLoading)) {
        return (
             <Layout>
                 <div className="flex items-center justify-center h-[calc(100vh-80px)] w-full text-primary text-lg">
                     <Loader2 className="h-6 w-6 mr-2 animate-spin" style={{ filter: `drop-shadow(0 0 4px ${neonColor})`}}/>
                     {authLoading ? "Autenticando..." : "Carregando dados iniciais..."}
                 </div>
             </Layout>
        );
    }

     // Se não autenticado (após verificação)
    if (!isAuthenticated) { return null; /* Redirecionamento já tratado no useEffect */ }

    // Se erro ao carregar campanhas E NENHUMA CAMPANHA CARREGADA
    if (!campaignsLoading && apiError && campaigns.length === 0) {
          return (
              <Layout>
                  <div className="flex flex-col items-center justify-center h-[calc(100vh-80px)] w-full text-red-400 text-center p-5">
                      <AlertTriangle className="h-10 w-10 mb-4" style={{ filter: `drop-shadow(0 0 4px ${neonColor})`}}/>
                      <h2 className="text-lg font-semibold mb-1">Erro ao Carregar Campanhas</h2>
                      <p className="text-sm mb-4">{apiError}</p>
                      <Button className={cn(neumorphicButtonStyle)} size="sm" onClick={loadCampaigns}>
                          <RefreshCw className="h-3 w-3 mr-1.5" />Tentar Novamente
                      </Button>
                  </div>
              </Layout>
          );
    }


    // --- JSX Principal ---
    return (
        <Layout>
            <Head><title>Métricas - USBMKT V30</title></Head>
            <div className="space-y-4 p-4 md:p-6 h-full flex flex-col">
                 {/* Cabeçalho e Controles */}
                 <div className="flex-shrink-0">
                     <h1 className="text-2xl font-black text-white mb-4" style={{ textShadow: `0 0 8px ${neonColor}` }}> Análise de Métricas </h1>
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                          {/* Card Campanha */}
                          <Card className={cn(cardStyle)}>
                               <CardContent className="p-3">
                                    <Label htmlFor="campaign_select" className={cn(labelStyle)} style={{ textShadow: `0 0 4px ${neonColor}` }}>Campanha</Label>
                                    <Select value={selectedCampaignId} onValueChange={setSelectedCampaignId} disabled={loading || refreshing || campaignsLoading}>
                                         <SelectTrigger id="campaign_select" className={cn(neumorphicInputStyle, "w-full h-9 px-3 py-1 text-xs")}>
                                              <SelectValue placeholder={campaignsLoading ? "Carregando..." : (campaigns.length === 0 ? "Nenhuma Campanha" : "Selecione...")} />
                                         </SelectTrigger>
                                         <SelectContent className="bg-[#1e2128] border-[#1E90FF]/30 text-white">
                                              {campaignsLoading ? ( <SelectItem value="loading" disabled>Carregando...</SelectItem> ) : (
                                                  <>
                                                      <SelectItem value="all" className="text-xs hover:bg-[#1E90FF]/20 focus:bg-[#1E90FF]/20">Todas Campanhas</SelectItem>
                                                      {campaigns.length > 0 ? campaigns.map((c) => (
                                                          <SelectItem key={c.id} value={c.id.toString()} className="text-xs hover:bg-[#1E90FF]/20 focus:bg-[#1E90FF]/20">{c.name}</SelectItem>
                                                      )) : (
                                                          <SelectItem value="no-camps" disabled>Nenhuma campanha encontrada</SelectItem>
                                                      )}
                                                  </>
                                              )}
                                         </SelectContent>
                                    </Select>
                               </CardContent>
                          </Card>
                          {/* Card Período */}
                          <Card className={cn(cardStyle)}>
                               <CardContent className="p-3">
                                    <Label htmlFor="date_range" className={cn(labelStyle)} style={{ textShadow: `0 0 4px ${neonColor}` }}>Período</Label>
                                    <Popover>
                                         <PopoverTrigger asChild>
                                              <Button id="date_range" variant={"outline"} className={cn( "w-full justify-start text-left font-normal h-9 px-3 py-1 text-xs", neumorphicInputStyle, !dateRange && "text-muted-foreground" )} disabled={loading || refreshing}>
                                                   <CalendarIcon className="mr-1.5 h-3 w-3" />
                                                   {dateRange?.from ? ( dateRange.to ? ( <>{format(dateRange.from, "P", { locale: ptBR })} - {format(dateRange.to, "P", { locale: ptBR })}</> ) : ( format(dateRange.from, "P", { locale: ptBR }) ) ) : ( <span>Selecione</span> )}
                                              </Button>
                                         </PopoverTrigger>
                                         <PopoverContent className="w-auto p-0 bg-[#1e2128] border-[#1E90FF]/30" align="start">
                                              <Calendar initialFocus mode="range" defaultMonth={dateRange?.from} selected={dateRange} onSelect={setDateRange} numberOfMonths={2} locale={ptBR} disabled={loading || refreshing} className="text-white [&>div>table>tbody>tr>td>button]:text-white [&>div>table>tbody>tr>td>button]:border-[#1E90FF]/20 [&>div>table>thead>tr>th]:text-gray-400 [&>div>div>button]:text-white [&>div>div>button:hover]:bg-[#1E90FF]/20 [&>div>div>div]:text-white" />
                                         </PopoverContent>
                                    </Popover>
                               </CardContent>
                          </Card>
                          {/* Card Tipo Métrica */}
                          <Card className={cn(cardStyle)}>
                               <CardContent className="p-3">
                                    <Label htmlFor="metric_type_select" className={cn(labelStyle)} style={{ textShadow: `0 0 4px ${neonColor}` }}>Agrupar Métricas</Label>
                                    <Select value={metricType} onValueChange={(v) => setMetricType(v as typeof metricType)} disabled={loading || refreshing}>
                                         <SelectTrigger id="metric_type_select" className={cn(neumorphicInputStyle, "w-full h-9 px-3 py-1 text-xs")}> <SelectValue /> </SelectTrigger>
                                         <SelectContent className="bg-[#1e2128] border-[#1E90FF]/30 text-white">
                                              <SelectItem value="performance" className="text-xs hover:bg-[#1E90FF]/20 focus:bg-[#1E90FF]/20">Performance</SelectItem>
                                              <SelectItem value="costs" className="text-xs hover:bg-[#1E90FF]/20 focus:bg-[#1E90FF]/20">Custos</SelectItem>
                                              <SelectItem value="revenue" className="text-xs hover:bg-[#1E90FF]/20 focus:bg-[#1E90FF]/20">Receita & ROI</SelectItem>
                                         </SelectContent>
                                    </Select>
                               </CardContent>
                          </Card>
                          {/* Card Visualização */}
                          <Card className={cn(cardStyle)}>
                               <CardContent className="p-3">
                                    <Label className={cn(labelStyle)} style={{ textShadow: `0 0 4px ${neonColor}` }}>Visualização</Label>
                                    <div className="flex space-x-2">
                                         <Button variant="outline" size="icon" className={cn(chartType === "line" ? neumorphicButtonPrimaryStyle : neumorphicButtonStyle, "h-9 w-9")} onClick={() => setChartType("line")} title="Gráfico de Linha"> <LineChartIcon className="h-4 w-4" style={{ filter: `drop-shadow(0 0 3px ${neonColor})` }}/> </Button>
                                         <Button variant="outline" size="icon" className={cn(chartType === "bar" ? neumorphicButtonPrimaryStyle : neumorphicButtonStyle, "h-9 w-9")} onClick={() => setChartType("bar")} title="Gráfico de Barra"> <BarChart2 className="h-4 w-4" style={{ filter: `drop-shadow(0 0 3px ${neonColor})` }}/> </Button>
                                         <Button variant="outline" size="icon" className={cn(chartType === "pie" ? neumorphicButtonPrimaryStyle : neumorphicButtonStyle, "h-9 w-9")} onClick={() => setChartType("pie")} title="Gráfico de Pizza (Totais)" disabled={metricType === 'costs' || !keyMetrics || loading || refreshing}> <PieChartIcon className="h-4 w-4" style={{ filter: `drop-shadow(0 0 3px ${neonColor})` }}/> </Button>
                                         <Button variant="outline" size="icon" className={cn(neumorphicButtonStyle, "ml-auto h-9 w-9")} onClick={() => loadMetricsData(true)} disabled={refreshing || loading || campaignsLoading} title="Atualizar Dados"> <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} style={{ filter: `drop-shadow(0 0 3px ${neonColor})` }}/> </Button>
                                    </div>
                               </CardContent>
                          </Card>
                     </div>
                 </div>

                 {/* Área de Conteúdo com Scroll */}
                 <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar space-y-4">
                    {/* Key Metrics Row - Mostra se não estiver loading/refreshing E tiver keyMetrics */}
                    {!loading && !refreshing && keyMetrics && (
                         <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                            {/* Adapte quais métricas mostrar aqui */}
                            <StatCard label="Custo Total" value={formatMetricValue('cost', keyMetrics.cost)} icon={DollarSign} iconColorClass='text-red-400' isLoading={refreshing} isCompact={true} />
                            <StatCard label="Receita Total" value={formatMetricValue('revenue', keyMetrics.revenue)} icon={DollarSign} iconColorClass='text-green-400' isLoading={refreshing} isCompact={true} />
                            <StatCard label="ROI" value={formatMetricValue('roi', keyMetrics.roi)} icon={TrendingUp} iconColorClass='text-blue-400' isLoading={refreshing} isCompact={true} />
                            <StatCard label="Cliques" value={formatMetricValue('clicks', keyMetrics.clicks)} icon={MousePointerClick} isLoading={refreshing} isCompact={true} />
                            <StatCard label="Conversões" value={formatMetricValue('conversions', keyMetrics.conversions)} icon={ShoppingCart} iconColorClass='text-emerald-400' isLoading={refreshing} isCompact={true} />
                            <StatCard label="Custo/Conv." value={formatMetricValue('costPerConversion', keyMetrics.costPerConversion)} icon={Activity} iconColorClass='text-purple-400' isLoading={refreshing} isCompact={true} />
                         </div>
                     )}

                    {/* Card Principal do Gráfico - Mostra sempre, mas o conteúdo interno lida com loading/erro/sem dados */}
                    <Card className={cn(cardStyle)}>
                         <CardHeader className="pt-4 pb-2 px-4">
                            <CardTitle className={cn(titleStyle, "text-base")} style={{ textShadow: `0 0 6px ${neonColor}` }}>
                                 {metricType === "performance" ? "Desempenho Diário" : metricType === "costs" ? "Custos Diários" : "Receita & ROI Diários"}
                                 <span className="text-xs font-normal text-gray-400 ml-2"> ({selectedCampaignId === 'all' ? 'Todas Campanhas' : campaigns.find(c => c.id.toString() === selectedCampaignId)?.name || '...'}) </span>
                            </CardTitle>
                         </CardHeader>
                         <CardContent className="px-2 pb-2">
                            {renderChart()} {/* Função que renderiza o gráfico OU estados de loading/erro/sem dados */}
                         </CardContent>
                     </Card>

                 </div>
            </div>
        </Layout>
    );
}
