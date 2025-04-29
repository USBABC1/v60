// pages/index.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Head from 'next/head';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/router';
import Layout from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import {
    RefreshCw, BarChart2, PieChart as PieChartIcon, LineChart as LineChartIcon,
    Loader2, AlertTriangle, Calendar as CalendarIcon, DollarSign, TrendingUp, Activity, ArrowUpCircle, Users, MousePointerClick, ShoppingCart, Maximize2, Minimize2, ArrowDownCircle
} from 'lucide-react'; // Importar ícones necessários
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
import StatCard from '@/components/dashboard/StatCard'; // Reutilizar o StatCard

// --- Tipos (Adapte conforme a estrutura real dos seus dados de dashboard) ---
interface DashboardData {
    totalUsers: number | null;
    userChange: number | null;
    totalRevenue: number | null;
    revenueChange: number | null;
    totalClicks: number | null;
    clickChange: number | null;
    totalSales: number | null; // Assumindo que Vendas é 'sales'
    salesChange: number | null;
    conversionRate: number | null;
    conversionRateChange: number | null;
    useBudget: number | null; // Assumindo Uso Orçamento é 'useBudget'
    useBudgetChange: number | null;
    roi: number | null; // Assumindo ROI
    roiChange: number | null;
    revenueClicksData: { date: string; revenue: number; clicks: number }[];
    deviceData: { device: string; count: number }[];
    budgetData: { date: string; budget: number; spent: number }[];
}

type CampaignOption = { id: string; name: string }; // Tipo simplificado para opções de campanha
type MetricConfigItem = { key: string; name: string; color: string }; // Simplificado para este contexto

// --- Constantes ---
const DATE_FORMAT_DISPLAY = 'dd/MM/yyyy';
const DATE_FORMAT_AXIS = 'dd/MM';
const DATE_FORMAT_API = 'yyyy-MM-dd';
const DEFAULT_TIMEFRAME_DAYS = 30; // Padrão de 30 dias para o dashboard

// --- Cores para Gráficos (Definido Fora do Componente) ---
const colors = {
    clicks: "#3b82f6", // Azul
    impressions: "#6366f1", // Indigo
    conversions: "#22c55e", // Verde
    ctr: "#eab308", // Amarelo
    cpc: "#f97316", // Laranja
    costPerConversion: "#a855f7", // Violeta
    cost: "#ef4444", // Vermelho
    revenue: "#0ea5e9", // Ciano
    roi: "#14b8a6" // Teal
};

// --- Funções Auxiliares (Definidas Fora do Componente) ---

// Função para buscar dados REAIS do dashboard (MOCKS REMANESCENTES AQUI)
const fetchDashboardData = async (startDate: string, endDate: string, campaignId: string | undefined): Promise<DashboardData | null> => {
    try {
        console.log(`[Dashboard API CALL] Fetching data for: ${startDate} to ${endDate}, Camp: ${campaignId || 'All'}`);

        // TODO: SUBSTITUIR ESTES MOCKS POR CHAMADAS REAIS ÀS APIs
        // Exemplo: Chamar /api/metrics, /api/campaigns, etc.
        // A estrutura de retorno DEVE ser compatível com a interface DashboardData
        // Esta é a parte que AINDA USA MOCKS para alguns dados
        const response = await axios.get('/api/metrics', { // Exemplo: buscar métricas
             params: { startDate, endDate, campaignId }
        });

        const metricsData = response.data?.totals; // Assumindo que totais vêm daqui
        const dailyMetrics = response.data?.dailyData; // Assumindo que dados diários vêm daqui

        // --- MOCKS REMANESCENTES ---
        // Estes dados ainda estão mockados e precisam ser buscados de APIs reais
        const mockTotalUsers = 1401764; // Exemplo mockado
        const mockUserChange = 24.8; // Exemplo mockado
        const mockDeviceData = [ // Exemplo mockado
            { device: 'Desktop', count: 300 },
            { device: 'Mobile', count: 700 },
            { device: 'Tablet', count: 100 },
        ];
        const mockBudgetSpent = metricsData?.cost ?? 0; // Usando custo real se disponível
        const mockTotalBudget = 10000; // Exemplo mockado
        const mockUseBudget = mockTotalBudget > 0 ? (mockBudgetSpent / mockTotalBudget) * 100 : 0; // Cálculo mockado

        const mockRevenueClicksData = dailyMetrics?.map((d: any) => ({ // Usando dados diários reais se disponíveis
            date: d.date,
            revenue: d.revenue ?? 0,
            clicks: d.clicks ?? 0,
        })) || [];


        const data: DashboardData = {
            totalUsers: mockTotalUsers, // MOCK
            userChange: mockUserChange, // MOCK
            totalRevenue: metricsData?.revenue ?? 0, // REAL (do /api/metrics)
            revenueChange: -37.9, // MOCK (calcular variação real)
            totalClicks: metricsData?.clicks ?? 0, // REAL (do /api/metrics)
            clickChange: 57.5, // MOCK (calcular variação real)
            totalSales: metricsData?.conversions ?? 0, // REAL (do /api/metrics) - Assumindo conversões = vendas
            salesChange: 16.51, // MOCK (calcular variação real)
            conversionRate: metricsData?.conversionRate ?? null, // REAL (do /api/metrics)
            conversionRateChange: null, // MOCK (calcular variação real)
            useBudget: mockUseBudget, // MOCK (baseado em custo real e orçamento mockado)
            useBudgetChange: null, // MOCK (calcular variação real)
            roi: metricsData?.roi ?? null, // REAL (do /api/metrics)
            roiChange: null, // MOCK (calcular variação real)
            revenueClicksData: mockRevenueClicksData, // REAL (do /api/metrics daily)
            deviceData: mockDeviceData, // MOCK
            budgetData: [], // MOCK (implementar API real)
        };

        console.log("[Dashboard API CALL] Mock/Real Data generated:", data);

        // Simular um pequeno atraso para ver o loading
        await new Promise(resolve => setTimeout(resolve, 500));

        return data;

    } catch (error: any) {
        console.error("[Dashboard API CALL] Erro ao buscar dados:", error.response?.data || error.message);
        let errorMessage = 'Falha ao buscar dados do dashboard.';
        if (axios.isAxiosError(error)) {
            errorMessage = error.response?.data?.message || error.response?.data?.error || error.message || errorMessage;
        } else if (error instanceof Error) {
            errorMessage = error.message;
        }
        throw new Error(errorMessage);
    }
};


// Função para formatar valores para exibição - MOVIDA PARA FORA DO COMPONENTE
const formatMetricValue = (metricKey: string, value: any): string => {
    const numValue = Number(value);
    if (value === undefined || value === null || isNaN(numValue)) return 'N/A';
    if (!isFinite(numValue)) return value > 0 ? '+Inf' : '-Inf';

    const lowerMetricKey = metricKey.toLowerCase();

    if (lowerMetricKey.includes('click') || lowerMetricKey.includes('impression') || lowerMetricKey.includes('conversion') || lowerMetricKey.includes('users') || lowerMetricKey.includes('leads')) {
        return numValue.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
    }
    if (lowerMetricKey.includes('ctr') || lowerMetricKey.includes('rate') || lowerMetricKey.includes('roi')) {
        return `${numValue.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
    }
    if (lowerMetricKey.includes('cpc') || lowerMetricKey.includes('cost') || lowerMetricKey.includes('revenue') || lowerMetricKey.includes('budget') || lowerMetricKey.includes('ltv') || lowerMetricKey.includes('ticket')) {
        return `R$ ${numValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return numValue.toLocaleString('pt-BR', { maximumFractionDigits: 1 }); // Padrão com uma casa decimal
};


// Função para formatar o eixo X (data) - Recharts
const formatXAxis = (tickItem: string): string => {
    try {
        const date = parseISO(tickItem);
        return isValid(date) ? format(date, DATE_FORMAT_AXIS, { locale: ptBR }) : '';
    } catch { return ''; }
};

// Função para formatar o eixo Y (números) - Recharts
const formatYAxis = (tickItem: number): string => {
     if (tickItem >= 1000000) return `${(tickItem / 1000000).toFixed(1)}M`;
     if (tickItem >= 1000) return `${(tickItem / 1000).toFixed(0)}k`;
     // Avoid showing decimals on Y axis for better readability
     return tickItem.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
};

// Função para formatar o tooltip (Recharts)
const formatTooltipValue = (value: number, name: string): [string] | [string, string] => {
    // Lógica simplificada para formatar valores no tooltip
    if (name.includes('Receita') || name.includes('Custo')) {
        return [`${name}: R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`];
    }
     if (name.includes('CTR') || name.includes('ROI') || name.includes('Taxa')) {
         return [`${name}: ${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`];
     }
    return [`${name}: ${value.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`];
};


// --- Componente Principal ---
export default function DashboardPage() {
    // --- Estados e Hooks ---
    const { isAuthenticated, isLoading: authLoading } = useAuth();
    const router = useRouter();
    const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
    const [selectedCampaignId, setSelectedCampaignId] = useState<string>("all"); // "all" como padrão
    const [dateRange, setDateRange] = useState<DateRange | undefined>({
        from: subDays(new Date(), DEFAULT_TIMEFRAME_DAYS -1), // Padrão dos últimos N dias
        to: new Date(),
    });
    const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
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
    // Definir axisTickColor aqui para ser acessível por ambos os gráficos
    const axisTickColor = "#a0aec0";


    // --- Lógica de Carregamento de Dados ---

    // Carregar Campanhas
    const loadCampaigns = useCallback(async () => {
        if (!isAuthenticated) return;
        setCampaignsLoading(true);
        setApiError(null);
        try {
            console.log("[Dashboard] Carregando campanhas...");
            const response = await axios.get<CampaignOption[]>('/api/campaigns?fields=id,name&sort=name:asc'); // Ordena por nome
            setCampaigns(response.data || []);
            console.log("[Dashboard] Campanhas carregadas:", response.data?.length);
        } catch (error) {
            console.error('[Dashboard] Erro ao carregar campanhas:', error);
            const errorMsg = axios.isAxiosError(error) ? error.response?.data?.message || error.message : (error as Error).message;
            toast({ title: "Erro Campanhas", description: errorMsg || "Não foi possível carregar as campanhas.", variant: "destructive" });
            setCampaigns([]);
            setApiError("Erro ao carregar campanhas."); // Define erro se falhar ao carregar campanhas
        } finally {
            setCampaignsLoading(false);
        }
    }, [toast, isAuthenticated]);

    // Carregar Dados do Dashboard
    const loadDashboardData = useCallback(async (isRefresh = false) => {
        if (!isAuthenticated || !dateRange?.from) {
            console.warn("[Dashboard] Load Data Abortado: Não autenticado ou sem data de início.");
            return;
        }

        if (!isRefresh) setLoading(true); else setRefreshing(true);
        setApiError(null); // Limpa erro anterior

        const startDateStr = format(dateRange.from, DATE_FORMAT_API);
        const endDate = dateRange.to || dateRange.from; // Usa 'from' se 'to' for nulo
        const endDateStr = format(endDate, DATE_FORMAT_API);
        const campIdToSend = selectedCampaignId === 'all' ? undefined : selectedCampaignId;

        console.log(`[Dashboard] Buscando dados - Período: ${startDateStr} a ${endDateStr}, Campanha: ${campIdToSend || 'Todas'}`);

        try {
            const data = await fetchDashboardData(startDateStr, endDateStr, campIdToSend);

            if (data) {
                setDashboardData(data);
                console.log("[Dashboard] Dados processados com sucesso.");
                if (isRefresh) toast({ title: "Dashboard Atualizado", duration: 2000 });
            } else {
                console.warn("[Dashboard] API retornou dados nulos ou vazios.");
                setDashboardData(null);
            }

        } catch (error: any) {
            console.error('[Dashboard] Erro ao carregar dados:', error);
            const errorMsg = error.message || 'Ocorreu um erro desconhecido.';
            setApiError(errorMsg);
            setDashboardData(null);
            toast({ title: "Erro Dashboard", description: errorMsg, variant: "destructive" });
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

    // Carregar Dados do Dashboard quando período ou campanha mudar (e campanhas já carregadas)
    useEffect(() => {
        // Só carrega se autenticado, não estiver carregando campanhas e tiver data inicial
        if (isAuthenticated && !campaignsLoading && dateRange?.from) {
            loadDashboardData();
        }
        // Não incluir loadDashboardData na dependência para evitar loop inicial
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedCampaignId, dateRange, isAuthenticated, campaignsLoading]);


    // --- Renderização ---

    // Renderização do Gráfico de Receita e Cliques
    const renderRevenueClicksChart = () => {
        const data = dashboardData?.revenueClicksData || [];
        // const axisTickColor = "#a0aec0"; // Definido fora da função
        const gridColor = `${neonColor}33`;
        const tooltipBg = "rgba(20, 20, 20, 0.85)"; const tooltipBorder = `${neonColor}66`;

        if (loading || refreshing) {
            return (
                <div className="flex flex-col items-center justify-center h-[200px] text-center text-primary">
                    <Loader2 className="h-6 w-6 animate-spin mb-2" style={{ filter: `drop-shadow(0 0 4px ${neonColor})`}}/>
                    <span className="text-xs text-gray-400">Carregando gráfico...</span>
                </div>
            );
        }

         if (apiError && !refreshing) { // Mostra erro apenas se não estiver refreshando
            return (
                <div className="flex flex-col items-center justify-center h-[200px] text-center text-red-400 text-xs">
                    Erro ao carregar dados do gráfico.
                </div>
            );
        }

        if (data.length === 0) {
             return <div className="flex items-center justify-center h-[200px] text-gray-500 text-xs">Sem dados para o gráfico de Receita & Cliques.</div>;
        }

        return (
            <ResponsiveContainer width="100%" height={200}>
                <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                    <XAxis dataKey="date" tickFormatter={formatXAxis} tick={{ fill: axisTickColor, fontSize: 10 }} axisLine={false} tickLine={false} style={{ textShadow: `0 0 4px ${neonColor}`}}/>
                    <YAxis yAxisId="left" tickFormatter={formatYAxis} tick={{ fill: colors.revenue, fontSize: 10 }} axisLine={false} tickLine={false} style={{ textShadow: `0 0 4px ${colors.revenue}`}}/>
                    <YAxis yAxisId="right" orientation="right" tickFormatter={formatYAxis} tick={{ fill: colors.clicks, fontSize: 10 }} axisLine={false} tickLine={false} style={{ textShadow: `0 0 4px ${colors.clicks}`}}/>
                    <Tooltip contentStyle={{ backgroundColor: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: '6px', backdropFilter: 'blur(4px)', boxShadow: '5px 5px 10px rgba(0,0,0,0.4)' }} labelStyle={{ color: '#a0aec0', fontSize: '11px', marginBottom: '4px' }} itemStyle={{ color: 'white', fontSize: '11px' }} formatter={formatTooltipValue} />
                    <Legend wrapperStyle={{ color: axisTickColor, fontSize: '10px', paddingTop: '10px' }} />
                    <Line yAxisId="left" type="monotone" dataKey="revenue" name="Receita" stroke={colors.revenue} strokeWidth={2} dot={false} activeDot={{ r: 5, strokeWidth: 1, fill: colors.revenue, stroke: '#fff' }} style={{ filter: `drop-shadow(0 0 4px ${colors.revenue})` }}/>
                    <Line yAxisId="right" type="monotone" dataKey="clicks" name="Cliques" stroke={colors.clicks} strokeWidth={2} dot={false} activeDot={{ r: 5, strokeWidth: 1, fill: colors.clicks, stroke: '#fff' }} style={{ filter: `drop-shadow(0 0 4px ${colors.clicks})` }}/>
                </LineChart>
            </ResponsiveContainer>
        );
    };

     // Renderização do Gráfico de Uso por Dispositivo
    const renderDeviceChart = () => {
        const data = dashboardData?.deviceData || [];
        const pieColors = ['#1E90FF', '#FF6384', '#FFCE56', '#4BC0C0', '#9966CC']; // Cores para o gráfico de pizza
        const tooltipBg = "rgba(20, 20, 20, 0.85)"; const tooltipBorder = `${neonColor}66`;
        // const axisTickColor = "#a0aec0"; // Definido fora da função


        if (loading || refreshing) {
            return (
                <div className="flex flex-col items-center justify-center h-[200px] text-center text-primary">
                    <Loader2 className="h-6 w-6 animate-spin mb-2" style={{ filter: `drop-shadow(0 0 4px ${neonColor})`}}/>
                    <span className="text-xs text-gray-400">Carregando gráfico...</span>
                </div>
            );
        }

         if (apiError && !refreshing) { // Mostra erro apenas se não estiver refreshando
            return (
                <div className="flex flex-col items-center justify-center h-[200px] text-center text-red-400 text-xs">
                    Erro ao carregar dados do gráfico.
                </div>
            );
        }

        if (data.length === 0) {
             return <div className="flex items-center justify-center h-[200px] text-gray-500 text-xs">Sem dados para o gráfico de Dispositivo.</div>;
        }

        return (
            <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                    <Pie data={data} cx="50%" cy="50%" outerRadius={80} fill="#8884d8" dataKey="count" label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                        {data.map((entry, index) => (
                            <Cell
                                key={`cell-${index}`}
                                fill={pieColors[index % pieColors.length]}
                                fillOpacity={0.8}
                                style={{ filter: `drop-shadow(0 0 5px ${pieColors[index % pieColors.length]})` }}
                            />
                        ))}
                    </Pie>
                     <Tooltip contentStyle={{ backgroundColor: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: '6px', backdropFilter: 'blur(4px)', boxShadow: '5px 5px 10px rgba(0,0,0,0.4)' }} itemStyle={{ color: 'white', fontSize: '11px' }} formatter={(value: number, name: string) => [`${name}: ${value.toLocaleString('pt-BR')}`]} />
                     <Legend wrapperStyle={{ color: axisTickColor, fontSize: '10px', paddingTop: '10px' }} />
                </PieChart>
            </ResponsiveContainer>
        );
    };


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
            <Head><title>Dashboard - USBMKT V30</title></Head>
            <div className="space-y-4 p-4 md:p-6 h-full flex flex-col">
                 {/* Cabeçalho e Controles */}
                 <div className="flex-shrink-0">
                     <h1 className="text-2xl font-black text-white mb-4" style={{ textShadow: `0 0 8px ${neonColor}` }}> Visão Geral (adm30) </h1>
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
                                                          <SelectItem key={c.id} value={c.id} className="text-xs hover:bg-[#1E90FF]/20 focus:bg-[#1E90FF]/20"> {/* CORRIGIDO: Removido value duplicado */}
                                                            {c.name}
                                                        </SelectItem>
                                                    )) : (
                                                        <SelectItem value="none" disabled className="text-gray-500 text-xs">Nenhuma campanha encontrada</SelectItem>
                                                    )}
                                                </>
                                              )}
                                         </SelectContent>
                                    </Select>
                               </CardContent>
                          </Card>

                          {/* Card Período */}
                          <Card className={cn(cardStyle, "col-span-1 md:col-span-2")}>
                               <CardContent className="p-3">
                                    <Label className={cn(labelStyle)} style={{ textShadow: `0 0 4px ${neonColor}` }}>Período</Label>
                                    <div className="flex">
                                         <Popover>
                                              <PopoverTrigger asChild>
                                                   <Button id="date_range" variant={"outline"} className={cn(neumorphicInputStyle, "w-full h-9 px-3 py-1 text-xs justify-start text-left font-normal")} disabled={loading || refreshing}>
                                                        <CalendarIcon className="h-3.5 w-3.5 mr-2 opacity-50" />
                                                        {dateRange?.from ? (
                                                            dateRange.to ? (
                                                                <>
                                                                    {format(dateRange.from, DATE_FORMAT_DISPLAY, { locale: ptBR })} - {format(dateRange.to, DATE_FORMAT_DISPLAY, { locale: ptBR })}
                                                                </>
                                                            ) : (
                                                                format(dateRange.from, DATE_FORMAT_DISPLAY, { locale: ptBR })
                                                            )
                                                        ) : (
                                                            <span>Selecione o Período</span>
                                                        )}
                                                   </Button>
                                              </PopoverTrigger>
                                              <PopoverContent className="w-auto p-0 bg-[#1e2128] border-[#1E90FF]/30 text-white" align="start">
                                                   <Calendar
                                                        mode="range"
                                                        defaultMonth={dateRange?.from}
                                                        selected={dateRange}
                                                        onSelect={setDateRange}
                                                        numberOfMonths={2}
                                                        locale={ptBR}
                                                        classNames={{
                                                            cell: "text-center text-sm p-0 relative [&:has([aria-selected])]:bg-[#1E90FF]/20 first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
                                                            day: "h-8 w-8 p-0 font-normal aria-selected:opacity-100",
                                                            day_selected: "bg-[#1E90FF] text-white hover:bg-[#1E90FF]/80 focus:bg-[#1E90FF] hover:text-white focus:text-white",
                                                            day_today: "bg-[#1E90FF]/10 text-white",
                                                            day_range_middle: "aria-selected:bg-[#1E90FF]/20 aria-selected:text-white",
                                                        }}
                                                   />
                                              </PopoverContent>
                                         </Popover>
                                    </div>
                               </CardContent>
                          </Card>

                          {/* Botão Atualizar */}
                          <Card className={cn(cardStyle)}>
                               <CardContent className="p-3 flex items-end h-full">
                                    <Button
                                         onClick={() => loadDashboardData(true)} // Passar true para indicar refresh
                                         className={cn(neumorphicButtonPrimaryStyle, "w-full h-9")}
                                         disabled={loading || refreshing || campaignsLoading || !dateRange?.from}
                                    >
                                         {refreshing ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
                                         {refreshing ? "Atualizando..." : "Atualizar"}
                                    </Button>
                               </CardContent>
                          </Card>
                     </div>
                 </div>

                 {/* Cartões de Métricas */}
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                     <StatCard label="Usuários" value={(dashboardData?.totalUsers || 0).toLocaleString('pt-BR')} icon={Users} percentageChange={dashboardData?.userChange} isLoading={refreshing} isCompact={true} />
                     <StatCard label="Cliques" value={(dashboardData?.totalClicks || 0).toLocaleString('pt-BR')} icon={MousePointerClick} percentageChange={dashboardData?.clickChange} isLoading={refreshing} isCompact={true} />
                     <StatCard label="Vendas" value={(dashboardData?.totalSales || 0).toLocaleString('pt-BR')} icon={ShoppingCart} percentageChange={dashboardData?.salesChange} isLoading={refreshing} isCompact={true} />
                     <StatCard label="Receita" value={`R$ ${(dashboardData?.totalRevenue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`} icon={DollarSign} percentageChange={dashboardData?.revenueChange} isLoading={refreshing} isCompact={true} />

                     {/* Adicionar outros StatCards conforme necessário, usando label */}
                     {dashboardData?.roi !== null && (
                         <StatCard key={`roi-${selectedCampaignId}`} label="ROI (%)" value={formatMetricValue('roi', dashboardData?.roi)} icon={TrendingUp} percentageChange={dashboardData?.roiChange} isLoading={refreshing} isCompact={true} />
                     )}
                     {dashboardData?.conversionRate !== null && (
                         <StatCard key={`conversion-rate-${selectedCampaignId}`} label="Tx. Conversão (%)" value={formatMetricValue('conversionRate', dashboardData?.conversionRate)} icon={Activity} percentageChange={dashboardData?.conversionRateChange} isLoading={refreshing} isCompact={true} />
                     )}
                      {dashboardData?.useBudget !== null && (
                          <StatCard key={`use-budget-${selectedCampaignId}`} label="Uso Orçamento (%)" value={formatMetricValue('useBudget', dashboardData?.useBudget)} icon={DollarSign} percentageChange={dashboardData?.useBudgetChange} isLoading={refreshing} isCompact={true} />
                      )}
                      {/* Exemplo de KPI que pode ser calculado no frontend se os dados base estiverem disponíveis */}
                       {!loading && !refreshing && dashboardData && (
                           <StatCard
                               key={`kpi-${selectedCampaignId}`}
                               label="Receita/Clique"
                               icon={Activity} // Ou outro ícone relevante
                               value={dashboardData.totalClicks && dashboardData.totalClicks > 0 ? formatMetricValue('revenue', (dashboardData.totalRevenue || 0) / dashboardData.totalClicks) : formatMetricValue('revenue', 0)}
                               percentageChange={null} // CORRIGIDO: Usar percentageChange
                               isLoading={refreshing}
                               isCompact={true}
                               accentColor={colors.roi} // Ou outra cor
                           />
                       )}


                 </div>

                 {/* Gráficos */}
                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-4"> {/* Layout para os gráficos */}
                     {/* Gráfico de Receita & Cliques */}
                     <Card className={cn(cardStyle)}>
                         <CardHeader className="pt-4 pb-2 px-4">
                             <CardTitle className={cn(titleStyle)}>
                                 <LineChartIcon className="h-4 w-4 inline-block mr-1.5" /> Receita & Cliques
                             </CardTitle>
                         </CardHeader>
                         <CardContent className="px-2 pb-2">
                             {renderRevenueClicksChart()}
                         </CardContent>
                     </Card>

                     {/* Gráfico de Dispositivos */}
                     <Card className={cn(cardStyle)}>
                         <CardHeader className="pt-4 pb-2 px-4">
                             <CardTitle className={cn(titleStyle)}>
                                 <PieChartIcon className="h-4 w-4 inline-block mr-1.5" /> Uso por Dispositivo
                             </CardTitle>
                         </CardHeader>
                         <CardContent className="px-2 pb-2">
                             {renderDeviceChart()}
                         </CardContent>
                     </Card>
                 </div>
                 {/* Footer com Último Atualizado/Status em texto muito pequeno */}
                 <div className="mt-auto pt-4 text-[10px] text-gray-500 text-right">
                     {loading ? 'Carregando dados...' : `Último atualizado: ${format(new Date(), 'dd/MM/yyyy HH:mm:ss', { locale: ptBR })}`}
                 </div>
            </div>
        </Layout>
    );
}
