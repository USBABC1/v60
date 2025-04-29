// pages/Funnel.tsx
import React, { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/router';
import Layout from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import {
    Loader2, TrendingUp, DollarSign, TrendingDown, HelpCircle, BarChartHorizontal, RefreshCw, AlertTriangle, Calendar as CalendarIcon
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { DateRange } from "react-day-picker";
import { format, subDays, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import axios from 'axios';

// --- Tipos ---
interface FunnelStage {
    name: string;           // Nome da etapa (e.g., "Visitantes Únicos")
    value: number;          // Valor numérico bruto
    displayValue: string;   // Valor formatado para exibição (e.g., "10.5k", "R$ 1.234,56")
    color?: string;         // Cor para o gráfico (opcional, pode ser definida no frontend)
}
interface PeriodResult {    // Resultados financeiros/volume por período
    daily: number;
    weekly: number;
    monthly: number;
}
interface LtvState {        // Estado para a calculadora LTV
    avgRevenuePerUser: number;
    churnRate: number;
    avgLifespan: number;
    ltv: number;
}
interface CampaignOption {  // Opção de campanha para o Select
    id: number;
    name: string;
}
interface FunnelApiResponse { // Resposta esperada da API /api/funnel
    clientName: string;
    productName: string;
    funnelData: FunnelStage[]; // Array com os dados das etapas do funil
    volume: PeriodResult;      // Volume de vendas/leads
    revenue: PeriodResult;     // Receita
    profit: PeriodResult;      // Lucro
    chartImageUrl?: string | null; // URL opcional para uma imagem de funil pré-renderizada
    // Outros campos totais podem vir da API, mas não são usados diretamente aqui por enquanto
    totalInvestment?: number;
    totalClicks?: number;
    totalConversions?: number;
    totalRevenue?: number;
}

// --- Funções Auxiliares ---
const formatCurrency = (value: number): string => isNaN(value) ? 'R$ 0,00' : value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const formatNumber = (value: number): string => isNaN(value) ? '0' : value.toLocaleString('pt-BR', { maximumFractionDigits: 0 });

// --- Componente TooltipLabel (Reutilizado/Corrigido) ---
const TooltipLabel = ({ label, tooltipKey, tooltipText }: { label: string, tooltipKey: string, tooltipText?: string }) => (
    <TooltipProvider>
        <Tooltip delayDuration={150}>
            <TooltipTrigger asChild>
                <span className="flex items-center justify-start text-left cursor-help group">
                    <Label htmlFor={tooltipKey} className={cn("text-xs text-gray-400 group-hover:text-gray-100 transition-colors duration-150 mr-1")} style={{ textShadow: `0 0 3px #4682B4` }}>{label}</Label>
                    <HelpCircle className="h-3 w-3 text-gray-500 group-hover:text-primary transition-colors duration-150" />
                </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-xs bg-[#1e2128] border border-[#1E90FF]/30 text-white p-1.5 rounded shadow-lg">
                <p>{tooltipText || "Tooltip não definido"}</p>
            </TooltipContent>
        </Tooltip>
    </TooltipProvider>
);

// Textos dos tooltips para LTV
const tooltips = {
    avgRevenuePerUser: 'Receita média gerada por cliente por mês. Considere a receita recorrente ou o valor médio de compra multiplicado pela frequência mensal.',
    churnRate: 'Percentual de clientes que cancelam ou deixam de comprar por mês. Calculado como (Clientes Perdidos no Mês / Clientes no Início do Mês) * 100.',
    avgLifespan: 'Tempo médio (em meses) que um cliente permanece ativo ou continua comprando. Calculado como 1 / Taxa de Churn Mensal.',
    ltv: 'Lifetime Value (LTV) ou Valor Vitalício do Cliente. Estimativa da receita total que um cliente médio gera durante todo o seu relacionamento com a empresa. Calculado como (Receita Média por Cliente por Mês) * (Tempo Médio de Vida em Meses).'
};

export default function FunnelPage() {
    // --- Autenticação e Roteamento ---
    const { isAuthenticated, isLoading: authLoading, user } = useAuth();
    const router = useRouter();
    const { toast } = useToast();

    // --- Estados ---
    const [dateRange, setDateRange] = useState<DateRange | undefined>({ from: subDays(new Date(), 13), to: new Date() }); // Default 14 dias
    const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
    const [selectedCampaignId, setSelectedCampaignId] = useState<string>("all");
    const [isLoadingCampaigns, setIsLoadingCampaigns] = useState<boolean>(true);
    const [clientName, setClientName] = useState("Carregando Cliente...");
    const [productName, setProductName] = useState("Carregando Produto...");
    const [funnelData, setFunnelData] = useState<FunnelStage[]>([]); // Dados das etapas vindos da API
    const [volume, setVolume] = useState<PeriodResult>({ daily: 0, weekly: 0, monthly: 0 });
    const [revenue, setRevenue] = useState<PeriodResult>({ daily: 0, weekly: 0, monthly: 0 });
    const [profit, setProfit] = useState<PeriodResult>({ daily: 0, weekly: 0, monthly: 0 });
    const [funnelChartUrl, setFunnelChartUrl] = useState<string | null>(null); // URL da imagem (opcional)
    const [loadingFunnelData, setLoadingFunnelData] = useState(true); // Loading dos dados do funil
    const [refreshing, setRefreshing] = useState(false); // Refreshing state
    const [error, setError] = useState<string | null>(null); // Mensagem de erro da API
    const [ltvState, setLtvState] = useState<LtvState>({ avgRevenuePerUser: 20, churnRate: 5, avgLifespan: 0, ltv: 0 }); // Estado inicial LTV

    // --- Estilos ---
    const neonColor = '#1E90FF'; const neonColorMuted = '#4682B4'; const neonGreenColor = '#32CD32';
    const cardStyle = "bg-[#141414]/80 backdrop-blur-sm shadow-[5px_5px_10px_rgba(0,0,0,0.4),-5px_-5px_10px_rgba(255,255,255,0.05)] rounded-lg border-none";
    const neumorphicInputStyle = "bg-[#141414] text-white shadow-[inset_2px_2px_4px_rgba(0,0,0,0.3),inset_-2px_-2px_4px_rgba(255,255,255,0.05)] placeholder:text-gray-500 border-none focus:ring-2 focus:ring-[#1E90FF] focus:ring-offset-2 focus:ring-offset-[#0e1015] h-8 text-sm px-2 py-1";
    const neumorphicButtonStyle = "bg-[#141414] border-none text-white shadow-[3px_3px_6px_rgba(0,0,0,0.3),-3px_-3px_6px_rgba(255,255,255,0.05)] hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.3),inset_-2px_-2px_4px_rgba(255,255,255,0.05)] hover:bg-[#1E90FF]/80 active:scale-[0.98] active:brightness-95 transition-all duration-150 ease-out h-9 px-4 text-sm";
    const labelStyle = "text-xs text-gray-300 mb-0.5"; // Estilo geral para labels
    const valueStyle = "font-semibold text-white text-sm"; // Estilo para valores de LTV
    const titleStyle = "text-base font-semibold text-white"; // Estilo para títulos de card
    const summaryTitleStyle = "text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5"; // Título resumo financeiro
    const customSliderClass = cn( "relative flex w-full touch-none select-none items-center group py-1", "[&_[data-radix-slider-track]]:relative [&_[data-radix-slider-track]]:h-2 [&_[data-radix-slider-track]]:w-full [&_[data-radix-slider-track]]:grow [&_[data-radix-slider-track]]:overflow-hidden [&_[data-radix-slider-track]]:rounded-full [&_[data-radix-slider-track]]:bg-gray-800/60 [&_[data-radix-slider-track]]:shadow-[inset_1px_1px_3px_rgba(0,0,0,0.6)]", "[&_[data-radix-slider-range]]:absolute [&_[data-radix-slider-range]]:h-full [&_[data-radix-slider-range]]:rounded-full [&_[data-radix-slider-range]]:bg-[var(--slider-color)]", "[&_[data-radix-slider-thumb]]:block [&_[data-radix-slider-thumb]]:h-4 [&_[data-radix-slider-thumb]]:w-4 [&_[data-radix-slider-thumb]]:rounded-full [&_[data-radix-slider-thumb]]:border-2 [&_[data-radix-slider-thumb]]:border-gray-900/50 [&_[data-radix-slider-thumb]]:bg-gray-300", "[&_[data-radix-slider-thumb]]:shadow-[1.5px_1.5px_3px_rgba(0,0,0,0.4),-1px_-1px_2px_rgba(255,255,255,0.1)]", "[&_[data-radix-slider-thumb]]:transition-transform [&_[data-radix-slider-thumb]]:duration-100", "[&_[data-radix-slider-thumb]]:focus-visible:outline-none [&_[data-radix-slider-thumb]]:focus-visible:ring-2 [&_[data-radix-slider-thumb]]:focus-visible:ring-offset-1 [&_[data-radix-slider-thumb]]:focus-visible:ring-[var(--slider-color)]", "[&_[data-radix-slider-thumb]]:disabled:pointer-events-none [&_[data-radix-slider-thumb]]:disabled:opacity-50", "hover:[&_[data-radix-slider-thumb]]:scale-110 hover:[&_[data-radix-slider-thumb]]:border-[var(--slider-color)]" );
    const primaryIconStyle = { filter: `drop-shadow(0 0 3px ${neonColor})` };

    // --- Lógica de Proteção de Rota ---
    useEffect(() => { if (!authLoading && !isAuthenticated) { router.push('/login'); } }, [authLoading, isAuthenticated, router]);

    // --- Busca de Campanhas ---
    const fetchCampaignsClient = useCallback(async () => {
        if (!isAuthenticated) return;
        setIsLoadingCampaigns(true);
        try {
            console.log("[Funnel] Carregando campanhas...");
            const response = await axios.get<CampaignOption[]>('/api/campaigns?fields=id,name');
            setCampaigns(response.data || []);
            console.log("[Funnel] Campanhas carregadas:", response.data?.length);
        } catch (err) {
            console.error("[Funnel] Erro ao buscar campanhas:", err);
            const errorMsg = axios.isAxiosError(err) ? err.response?.data?.message || err.message : (err as Error).message;
            toast({ title: "Erro Campanhas", description: errorMsg || "Falha.", variant: "destructive" });
            setCampaigns([]);
        } finally { setIsLoadingCampaigns(false); }
    }, [toast, isAuthenticated]);

    // --- Busca de Dados do Funil (API REAL) ---
    const fetchFunnelData = useCallback(async (isRefresh = false) => {
        if (!isAuthenticated || !dateRange?.from || isLoadingCampaigns) {
             console.warn("[Funnel] Fetch Funnel Abortado: Auth Pendente, Sem Data ou Campanhas Carregando.");
             return;
        }
        if (!isRefresh) { setLoadingFunnelData(true); setError(null); } else { setRefreshing(true); }

        const startDate = format(dateRange.from, 'yyyy-MM-dd');
        const endDate = format(dateRange.to || dateRange.from, 'yyyy-MM-dd'); // Usa 'to' ou 'from' se 'to' for null
        const campId = selectedCampaignId === 'all' ? undefined : selectedCampaignId; // Envia undefined se for 'all'

        console.log(`[Funnel] Buscando: ${startDate} a ${endDate}, Campanha: ${campId || 'all'}`);

        try {
            const response = await axios.get<FunnelApiResponse>('/api/funnel', { params: { startDate, endDate, campaignId: campId } });
            const data = response.data;
            console.log("[Funnel] Dados recebidos da API:", data);

            // Atualiza o estado com os dados recebidos
            setClientName(data.clientName || "Cliente Desconhecido");
            setProductName(data.productName || "Produto Desconhecido");
            setFunnelData(data.funnelData || []);
            setVolume(data.volume || { daily: 0, weekly: 0, monthly: 0 });
            setRevenue(data.revenue || { daily: 0, weekly: 0, monthly: 0 });
            setProfit(data.profit || { daily: 0, weekly: 0, monthly: 0 });
            setFunnelChartUrl(data.chartImageUrl || null);
            setError(null); // Limpa erro se sucesso

            if (isRefresh) toast({ title: "Funil Atualizado!", duration: 2000 });

        } catch (error: any) {
            console.error("[Funnel] Erro ao buscar dados do funil:", error.response?.data || error.message);
            const errorMsg = axios.isAxiosError(error) ? error.response?.data?.message || error.message : (error as Error).message || 'Falha ao carregar dados do funil.';
            setError(errorMsg);
            toast({ title: "Erro Funil", description: errorMsg, variant: "destructive" });
            // Reseta os dados em caso de erro
            setClientName("Erro"); setProductName("Erro"); setFunnelData([]);
            setVolume({ daily: 0, weekly: 0, monthly: 0 }); setRevenue({ daily: 0, weekly: 0, monthly: 0 }); setProfit({ daily: 0, weekly: 0, monthly: 0 });
            setFunnelChartUrl(null);
        } finally {
            setLoadingFunnelData(false); setRefreshing(false);
        }
    }, [isAuthenticated, dateRange, selectedCampaignId, toast, isLoadingCampaigns]); // Adicionado isLoadingCampaigns

    // --- Efeitos ---
    // Busca campanhas ao montar (e quando autenticado)
    useEffect(() => {
        fetchCampaignsClient();
    }, [fetchCampaignsClient]);

    // Carrega dados do funil quando autenticado, campanhas carregadas, ou filtros mudam
    useEffect(() => {
        if (isAuthenticated && !isLoadingCampaigns) {
            fetchFunnelData();
        }
        // Não incluir fetchFunnelData aqui para evitar loop inicial desnecessário
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAuthenticated, isLoadingCampaigns, dateRange, selectedCampaignId]);

    // --- Lógica LTV (mantida localmente) ---
    const calculateLtv = useCallback(() => {
        const churnDecimal = (ltvState.churnRate || 0) / 100;
        const avgLifespan = churnDecimal > 0 ? 1 / churnDecimal : 0; // Evita divisão por zero
        const ltv = (ltvState.avgRevenuePerUser || 0) * avgLifespan;
        setLtvState(prevState => ({ ...prevState, avgLifespan, ltv }));
    }, [ltvState.avgRevenuePerUser, ltvState.churnRate]);

    // Calcula LTV sempre que os inputs mudarem
    useEffect(() => {
        calculateLtv();
    }, [calculateLtv]);

    // Handlers para os sliders de LTV
    const handleLtvChange = (field: keyof Pick<LtvState, 'avgRevenuePerUser' | 'churnRate'>) => (value: number[]) => {
        setLtvState(prevState => ({ ...prevState, [field]: value[0] }));
    };

    // Handlers para os inputs numéricos de LTV (com validação)
    const handleLtvInputChange = (
        setterFunc: (field: keyof Pick<LtvState, 'avgRevenuePerUser' | 'churnRate'>) => (value: number[]) => void,
        field: keyof Pick<LtvState, 'avgRevenuePerUser' | 'churnRate'>,
        min: number, max: number
    ) => (event: React.ChangeEvent<HTMLInputElement>) => {
        const rawValue = event.target.value;
        // Permite campo vazio temporariamente
        if (rawValue === '') {
            setLtvState(prevState => ({ ...prevState, [field]: '' })); // Use string vazia temporariamente se quiser
            return;
        }
        // Normaliza para ponto decimal e valida formato
        const normalizedValue = rawValue.replace(',', '.');
        if (!/^\d*\.?\d*$/.test(normalizedValue)) { // Permite apenas números e um ponto decimal
             return;
        }
        // Tenta converter para número
        const numericValue = parseFloat(normalizedValue);
        if (!isNaN(numericValue)) {
            const clampedValue = Math.max(min, Math.min(max, numericValue));
            setterFunc(field)([clampedValue]);
        } else {
             // Mantem o valor com ponto se for o caso (ex: "10.")
             if (normalizedValue.endsWith('.')) {
                setLtvState(prevState => ({ ...prevState, [field]: normalizedValue }));
             } else {
                 // Se não for número e não terminar com ponto, não atualiza ou reseta
                 // setLtvState(prevState => ({ ...prevState, [field]: min })); // Ou reseta para min
             }
        }
    };

    // Configuração dos inputs LTV para mapeamento
    const ltvInputsConfig = [
        { label: 'Receita Média/Mês (R$)', state: ltvState.avgRevenuePerUser, field: 'avgRevenuePerUser' as const, min: 0, max: 1000, step: 1, tooltip: tooltips.avgRevenuePerUser, isPercent: false },
        { label: 'Churn Mensal (%)', state: ltvState.churnRate, field: 'churnRate' as const, min: 0, max: 100, step: 0.1, tooltip: tooltips.churnRate, isPercent: true },
    ];

    // --- Renderização do Gráfico do Funil ---
    const renderFunnelGraphic = () => {
        if (loadingFunnelData || refreshing) { return <div className="flex items-center justify-center h-[260px] w-full"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>; }
        if (error && !refreshing) { return <div className="flex flex-col items-center justify-center h-[260px] w-full text-red-400 text-xs"><AlertTriangle className="h-6 w-6 mb-2"/>Erro ao carregar gráfico.</div>; }
        if (funnelChartUrl) { return <img src={funnelChartUrl} alt="Gráfico do Funil" className="max-w-full h-auto object-contain mx-auto" />; }
        if (funnelData.length === 0) return <div className="flex items-center justify-center h-[260px] w-full text-gray-500 text-xs italic">Sem dados para exibir funil.</div>;

        // Fallback: Desenhar SVG se URL não vier da API
        const svgHeight = 260; const svgWidth = 300; const maxRectWidth = svgWidth * 0.65; const minRectWidth = svgWidth * 0.10; const rectHeight = svgHeight / (funnelData.length + 1.2); const spacing = rectHeight * 0.12;
        const validStages = funnelData.filter(stage => stage.value >= 0);
        const visualMaxValue = validStages.length > 0 ? Math.max(...validStages.map(d => d.value)) : 1;

        if (visualMaxValue <= 0 && validStages.length > 0) return <div className="flex items-center justify-center h-[260px] text-gray-500 text-xs italic">Valores não positivos para exibir.</div>;

        const getWidth = (value: number) => {
            if (visualMaxValue <= 0) return minRectWidth;
            const proportion = Math.max(0, value) / visualMaxValue;
            return minRectWidth + (maxRectWidth - minRectWidth) * proportion;
        };

        return (
            <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} width="100%" height="auto" preserveAspectRatio="xMidYMid meet" className="max-h-[260px]">
                {funnelData.map((stage, index) => {
                    const yPos = index * (rectHeight + spacing) + spacing;
                    const currentWidth = getWidth(stage.value);
                    // Encontra a próxima etapa com valor positivo para desenhar o trapézio
                    let nextPositiveStageIndex = -1;
                    for (let j = index + 1; j < funnelData.length; j++) {
                        if (funnelData[j].value > 0) { nextPositiveStageIndex = j; break; }
                    }
                    // Se não houver próxima etapa positiva, use a largura da etapa atual para a base
                    const bottomValue = nextPositiveStageIndex !== -1 ? funnelData[nextPositiveStageIndex].value : (stage.value > 0 ? stage.value : 0);
                    const bottomWidth = getWidth(bottomValue);
                    const x1 = (svgWidth - currentWidth) / 2; const x2 = x1 + currentWidth;
                    const x3 = (svgWidth - bottomWidth) / 2; const x4 = x3 + bottomWidth;
                    const y2 = yPos + rectHeight;
                    const points = `${x1},${yPos} ${x2},${yPos} ${x4},${y2} ${x3},${y2}`;
                    const defaultColor = '#8884d8'; // Cor padrão se não fornecida

                    return (
                        <g key={stage.name}>
                            <polygon points={points} fill={stage.color || defaultColor} fillOpacity={0.8} style={{ filter: `drop-shadow(1px 2px 3px rgba(0,0,0,0.4))` }} />
                            {/* Adicionar texto (opcional, pode poluir) */}
                            {/* <text x={svgWidth / 2} y={yPos + rectHeight / 2} fill="#fff" textAnchor="middle" alignmentBaseline="middle" fontSize="10" fontWeight="bold">{stage.name}</text> */}
                        </g>
                    );
                })}
            </svg>
        );
    }; // Fim renderFunnelGraphic

    // --- Renderização Condicional (Auth) ---
    if (authLoading) { return ( <Layout><div className="flex h-[calc(100vh-100px)] w-full items-center justify-center"> <Loader2 className="h-8 w-8 animate-spin text-primary" /> <span className="ml-3 text-muted-foreground">Verificando acesso...</span> </div></Layout> ); }
    if (!isAuthenticated) { return null; } // Redireciona no useEffect

    // --- Renderização Principal ---
    return (
        <Layout>
            <Head><title>Funil de Vendas - USBMKT V30</title></Head>
            <div className='space-y-3 p-4 md:p-6 h-full flex flex-col'>
                {/* Cabeçalho e Controles */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-3 flex-shrink-0">
                    <div className="flex-1">
                        <h1 className="text-xl md:text-2xl font-bold text-white" style={{ textShadow: `0 0 6px ${neonColor}` }}>Funil de Vendas</h1>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        {/* Popover DatePicker */}
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button id="date" variant={"outline"} className={cn( "w-[240px] sm:w-[260px] justify-start text-left font-normal bg-[#141414]/80 border-none text-white shadow-[inset_1px_1px_3px_rgba(0,0,0,0.4)] hover:bg-[#1E90FF]/20 h-8 px-3 text-xs", !dateRange && "text-muted-foreground" )} disabled={loadingFunnelData || refreshing}>
                                    <CalendarIcon className="mr-2 h-3 w-3" />
                                    {dateRange?.from ? ( dateRange.to ? ( <>{format(dateRange.from, "P", { locale: ptBR })} - {format(dateRange.to, "P", { locale: ptBR })}</> ) : ( format(dateRange.from, "P", { locale: ptBR }) ) ) : ( <span className="text-xs italic">Selecione período</span> )}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0 bg-[#1e2128] border-[#1E90FF]/30" align="end">
                                <Calendar initialFocus mode="range" defaultMonth={dateRange?.from} selected={dateRange} onSelect={setDateRange} numberOfMonths={2} locale={ptBR} disabled={loadingFunnelData || refreshing} className="text-white [&>div>table>tbody>tr>td>button]:text-white [&>div>table>tbody>tr>td>button]:border-[#1E90FF]/20 [&>div>table>thead>tr>th]:text-gray-400 [&>div>div>button]:text-white [&>div>div>button:hover]:bg-[#1E90FF]/20 [&>div>div>div]:text-white" />
                            </PopoverContent>
                        </Popover>
                        {/* Select Campanha */}
                        <Select value={selectedCampaignId} onValueChange={setSelectedCampaignId} disabled={loadingFunnelData || refreshing || isLoadingCampaigns}>
                            <SelectTrigger className="w-auto min-w-[140px] max-w-[200px] bg-[#141414]/80 border-none text-white shadow-[inset_1px_1px_3px_rgba(0,0,0,0.4)] hover:bg-[#1E90FF]/20 h-8 px-3 text-xs">
                                <SelectValue placeholder="Campanha" className="truncate" />
                            </SelectTrigger>
                            <SelectContent className="bg-[#1e2128] border-[#1E90FF]/30 text-white">
                                <SelectItem value="all" className="text-xs hover:bg-[#1E90FF]/20">Todas</SelectItem>
                                {isLoadingCampaigns && <div className="p-2 text-xs text-center text-gray-400">Carregando...</div>}
                                {!isLoadingCampaigns && campaigns.length > 0 && campaigns.map((c) => (
                                    <SelectItem key={c.id} value={c.id.toString()} className="text-xs hover:bg-[#1E90FF]/20">{c.name}</SelectItem>
                                ))}
                                {!isLoadingCampaigns && campaigns.length === 0 && <div className="p-2 text-xs text-center text-gray-400">Nenhuma campanha</div>}
                            </SelectContent>
                        </Select>
                        {/* Botão Atualizar */}
                        <Button className={cn(neumorphicButtonStyle, "h-8 px-3")} size="sm" onClick={() => fetchFunnelData(true)} disabled={refreshing || loadingFunnelData || isLoadingCampaigns}>
                            <RefreshCw className={cn("h-3 w-3", refreshing && 'animate-spin')} />
                            <span className="ml-1.5 text-xs">{refreshing ? '' : 'Atualizar'}</span>
                        </Button>
                    </div>
                </div>
                {/* Conteúdo Principal */}
                <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar space-y-3">
                    {/* Exibe erro geral da API aqui se houver */}
                    {error && !refreshing && (
                        <Card className={cn(cardStyle, "flex items-center gap-3 p-3 bg-red-900/30 border border-red-500/50")}>
                            <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0"/>
                            <p className="text-xs text-red-300">{error}</p>
                            <Button variant="ghost" size="sm" className="ml-auto text-red-300 hover:bg-red-400/20 h-6 px-1.5" onClick={() => fetchFunnelData(true)}><RefreshCw className="h-3 w-3 mr-1"/> Tentar Novamente</Button>
                        </Card>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                        {/* Coluna Esquerda: Gráfico e Resumo Financeiro */}
                        <div className="lg:col-span-3 space-y-3">
                            <Card className={cn(cardStyle, "p-3")}>
                                <CardHeader className="p-0 pb-1.5 mb-2 border-b border-[#1E90FF]/20">
                                    <CardTitle className={cn(titleStyle, "text-center text-sm font-bold truncate")} style={{ textShadow: `0 0 4px ${neonColor}` }}>
                                        {loadingFunnelData ? "Carregando Funil..." : `${clientName} | ${productName}`}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-0 grid grid-cols-1 md:grid-cols-2 gap-3 items-center min-h-[280px]">
                                    {/* Gráfico do Funil (Imagem ou SVG) */}
                                    <div className="w-full h-full flex items-center justify-center md:border-r border-[#1E90FF]/15 md:pr-2">
                                        {renderFunnelGraphic()}
                                    </div>
                                    {/* Legenda/Dados do Funil */}
                                    <div className="space-y-1.5 text-xs md:pl-2">
                                        <h5 className="text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-wider" style={{ textShadow: `0 0 4px ${neonColorMuted}` }}>Etapas do Funil</h5>
                                        {(loadingFunnelData || refreshing) && !error ? (
                                            <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-gray-400"/></div>
                                        ) : funnelData.length > 0 && !error ? (
                                            funnelData.map((stage) => (
                                                <div key={stage.name} className="flex items-center justify-between gap-2 border-b border-[#1E90FF]/10 pb-1 last:border-b-0">
                                                    <span className="flex items-center text-gray-300">
                                                        <span className="w-2 h-2 rounded-full mr-1.5 shrink-0" style={{ backgroundColor: stage.color || '#8884d8', filter: `drop-shadow(0 0 2px ${stage.color || '#8884d8'})` }}></span>
                                                        {stage.name}
                                                    </span>
                                                    <span className="font-medium text-white" style={{ textShadow: `0 0 4px ${neonColor}` }}>{stage.displayValue}</span>
                                                </div>
                                            ))
                                        ) : !error ? ( // Only show "Sem dados" if there wasn't an API error
                                            <p className="text-gray-500 italic text-center py-4 text-xs">Sem dados disponíveis para as etapas.</p>
                                        ) : null /* Do not show "sem dados" if there was an error */ }
                                    </div>
                                </CardContent>
                            </Card>
                            {/* Resumo Financeiro */}
                            <Card className={cn(cardStyle)}>
                                <CardHeader className="p-0 pt-2 pb-1.5 mb-2 border-b border-[#1E90FF]/20">
                                    <CardTitle className={cn(titleStyle, "text-center text-sm font-bold")} style={{ textShadow: `0 0 4px ${neonColor}` }}>Resumo Financeiro (Médias)</CardTitle>
                                </CardHeader>
                                <CardContent className="p-2 grid grid-cols-1 sm:grid-cols-3 gap-2 text-center">
                                    {(loadingFunnelData || refreshing) && !error ? (
                                        <div className="sm:col-span-3 flex justify-center py-4"><Loader2 className="h-6 w-6 animate-spin text-gray-400"/></div>
                                    ) : !error ? ( // Only show data if no error
                                        <>
                                            <div>
                                                <h4 className={cn(summaryTitleStyle)} style={{ textShadow: `0 0 4px ${neonColor}` }}> 📈 Vendas/Dia </h4>
                                                <p className={cn(valueStyle, "text-lg")}>{formatNumber(volume.daily)}</p>
                                            </div>
                                            <div>
                                                <h4 className={cn(summaryTitleStyle)} style={{ textShadow: `0 0 4px ${neonColor}` }}> 💰 Receita/Dia </h4>
                                                <p className={cn(valueStyle, "text-lg")}>{formatCurrency(revenue.daily)}</p>
                                            </div>
                                            <div>
                                                <h4 className={cn(summaryTitleStyle)} style={{ textShadow: `0 0 4px ${neonColor}` }}> 💎 Lucro/Dia </h4>
                                                <p className={cn(valueStyle, "text-lg")}>{formatCurrency(profit.daily)}</p>
                                            </div>
                                        </>
                                    ) : <div className="sm:col-span-3 text-center text-xs text-gray-500 py-4 italic">Dados indisponíveis devido a erro.</div>}
                                </CardContent>
                            </Card>
                        </div>
                        {/* Coluna Direita: Calculadora LTV */}
                        <div className="lg:col-span-2 space-y-3">
                            <Card className={cn(cardStyle, "p-3")}>
                                <CardHeader className="p-0 pb-1.5 mb-2 border-b border-[#1E90FF]/20">
                                    <CardTitle className={cn(titleStyle, "text-center text-sm font-bold")} style={{ textShadow: `0 0 4px ${neonColor}` }}>Calculadora LTV</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2 p-0 pt-1">
                                    {ltvInputsConfig.map((input) => (
                                        <div key={input.field} className="space-y-1">
                                            <div className="flex justify-between items-center">
                                                <TooltipLabel label={input.label} tooltipKey={input.field} tooltipText={input.tooltip} />
                                                {/* Input numérico ao lado do valor */}
                                                 <Input
                                                    type="text"
                                                    inputMode="decimal" // Melhora teclado mobile
                                                    value={input.state} // Mostra o estado atual (pode ser string vazia)
                                                    onChange={handleLtvInputChange(handleLtvChange, input.field, input.min, input.max)}
                                                    className={cn(neumorphicInputStyle, "w-16 shrink-0 h-6 text-xs text-right")} // Input menor
                                                    placeholder={input.isPercent ? '0%' : 'R$ 0'}
                                                />
                                            </div>
                                            <Slider
                                                aria-label={input.label}
                                                value={[Number(input.state) || 0]} // Garante que o valor é número
                                                onValueChange={handleLtvChange(input.field)}
                                                min={input.min} max={input.max} step={input.step}
                                                className={cn(customSliderClass, "flex-grow")}
                                                style={{ '--slider-color': neonColor } as React.CSSProperties}
                                            />
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>
                            {/* Resultados LTV */}
                            <Card className={cn(cardStyle)}>
                                <CardHeader className="p-0 pt-2 pb-1.5 mb-2 border-b border-[#1E90FF]/20">
                                    <CardTitle className={cn(titleStyle, "flex items-center justify-center gap-2 text-sm font-bold")} style={{ textShadow: `0 0 4px ${neonColor}` }}>
                                        <TrendingUp className="h-4 w-4" style={primaryIconStyle} /> Resultados LTV
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <div className={cn(cardStyle, "bg-[#101010]/50 p-3 text-center rounded-md")}>
                                        <TooltipLabel label="Tempo Médio de Vida" tooltipKey={'avgLifespan'} tooltipText={tooltips.avgLifespan} />
                                        <p className="text-lg font-semibold text-white" style={{ textShadow: `0 0 5px ${neonColor}` }}>
                                            {ltvState.avgLifespan > 0 && isFinite(ltvState.avgLifespan) ? `${ltvState.avgLifespan.toFixed(1)} meses` : 'N/A'}
                                        </p>
                                    </div>
                                    <div className={cn(cardStyle, "bg-[#101010]/50 p-3 text-center rounded-md")}>
                                        <TooltipLabel label="LTV Estimado (R$)" tooltipKey={'ltv'} tooltipText={tooltips.ltv} />
                                        <p className="text-lg font-semibold text-green-400" style={{ textShadow: `0 0 5px ${neonGreenColor}` }}>
                                            {ltvState.ltv > 0 && isFinite(ltvState.ltv) ? formatCurrency(ltvState.ltv) : 'R$ 0,00'}
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </div> {/* Fim flex-1 */}
            </div> {/* Fim space-y-3 */}
        </Layout>
    );
}
