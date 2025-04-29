// pages/Dates.tsx
import React, { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/router';
import Layout from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";
import { format, parseISO, differenceInDays, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import axios from 'axios';
import {
    CalendarDays, LineChart, BarChartHorizontal, Loader2, AlertTriangle, TrendingUp, TrendingDown
} from 'lucide-react';

// --- Interfaces ---
interface DailyMetric { date: string; revenue?: number; clicks?: number; conversions?: number; cost?: number; /* Outras métricas da API */ }
interface MetricsTotals { revenue?: number; clicks?: number; conversions?: number; cost?: number; /* Outras métricas totais */ }
interface MetricsApiResponse { totals: MetricsTotals; dailyData: DailyMetric[]; }
interface ComparisonPoint { day: number; period1Value?: number; period2Value?: number; } // Dados para o gráfico (dia relativo)
interface TooltipState { x: number; y: number; visible: boolean; value: number; day: number; periodLabel: string; periodColor: string; }
interface CampaignOption { id: number; name: string; }

// --- Funções Auxiliares ---
const formatCurrency = (value?: number): string => (value === undefined || isNaN(value)) ? 'R$ 0,00' : value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const formatNumber = (value?: number, decimals = 0): string => (value === undefined || isNaN(value)) ? '0' : value.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
const formatPercent = (value?: number): string => (value === undefined || isNaN(value) || !isFinite(value)) ? 'N/A' : `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;

export default function DatesPage() {
    // --- Autenticação e Roteamento ---
    const { isAuthenticated, isLoading: authLoading } = useAuth();
    const router = useRouter();
    const { toast } = useToast();

    // --- Estados da Página ---
    const today = new Date();
    const [period1, setPeriod1] = useState({ startDate: format(addDays(today, -13), 'yyyy-MM-dd'), endDate: format(today, 'yyyy-MM-dd') });
    const [period2, setPeriod2] = useState({ startDate: format(addDays(today, -27), 'yyyy-MM-dd'), endDate: format(addDays(today, -14), 'yyyy-MM-dd') });
    const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
    const [selectedCampaignId, setSelectedCampaignId] = useState<string>("all");
    const [comparisonData, setComparisonData] = useState<ComparisonPoint[]>([]); // Dados alinhados por dia relativo
    const [totalDifference, setTotalDifference] = useState<number | null>(null);
    const [percentDifference, setPercentDifference] = useState<number | null>(null);
    const [period1Total, setPeriod1Total] = useState<number | null>(null);
    const [period2Total, setPeriod2Total] = useState<number | null>(null);
    const [hasCompared, setHasCompared] = useState(false);
    const [tooltip, setTooltip] = useState<TooltipState>({ x: -100, y: -100, visible: false, value: 0, day: 0, periodLabel: '', periodColor: '' });
    const [isLoadingCampaigns, setIsLoadingCampaigns] = useState(true);
    const [isLoadingComparison, setIsLoadingComparison] = useState(false);
    const [apiError, setApiError] = useState<string | null>(null);

    // --- Constantes de Estilo ---
    const neonColor = '#1E90FF'; const neonColorMuted = '#4682B4'; const neonGreenColor = '#32CD32'; const neonRedColor = '#ef4444';
    const cardStyle = "bg-[#141414]/80 backdrop-blur-sm shadow-[5px_5px_10px_rgba(0,0,0,0.4),-5px_-5px_10px_rgba(255,255,255,0.05)] rounded-lg border border-[#1E90FF]/15";
    const neumorphicInputStyle = "bg-[#141414] text-white shadow-[inset_2px_2px_4px_rgba(0,0,0,0.3),inset_-2px_-2px_4px_rgba(255,255,255,0.05)] placeholder:text-gray-500 border-none focus:ring-2 focus:ring-[#1E90FF] focus:ring-offset-2 focus:ring-offset-[#0e1015] h-8 text-sm px-2 py-1";
    const primaryButtonStyle = `bg-gradient-to-r from-[${neonColor}] to-[${neonColorMuted}] hover:from-[${neonColorMuted}] hover:to-[${neonColor}] text-white font-semibold shadow-[0_4px_10px_rgba(30,144,255,0.4)] transition-all duration-300 ease-in-out transform hover:scale-[1.03] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#0e1015] focus:ring-[#5ca2e2]`;
    const titleStyle = "text-base font-semibold text-white";

    // --- Lógica de Proteção de Rota ---
    useEffect(() => { if (!authLoading && !isAuthenticated) { router.push('/login'); } }, [authLoading, isAuthenticated, router]);

    // --- Busca de Campanhas ---
    const fetchCampaigns = useCallback(async () => {
        if (!isAuthenticated) return; setIsLoadingCampaigns(true);
        try {
            const response = await axios.get<CampaignOption[]>('/api/campaigns?fields=id,name&sort=name:asc');
            setCampaigns(response.data || []);
        } catch (err) { console.error("[Dates] Erro campanhas:", err); setCampaigns([]); toast({ title: "Erro", description: "Falha ao carregar campanhas.", variant: "destructive" }); }
        finally { setIsLoadingCampaigns(false); }
    }, [isAuthenticated, toast]);

    useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);

    // --- Função para buscar dados de UM período ---
    const fetchPeriodData = async (startDate: string, endDate: string, campaignId: string | undefined): Promise<MetricsApiResponse | null> => {
        try {
            const response = await axios.get<MetricsApiResponse>('/api/metrics', {
                params: { startDate, endDate, campaignId }
            });
            return response.data;
        } catch (error) {
            console.error(`Erro ao buscar dados para ${startDate}-${endDate} (Campanha: ${campaignId || 'all'}):`, error);
            throw error; // Re-throw para ser pego pelo Promise.all
        }
    };

    // --- Função Principal de Comparação ---
    const fetchAndComparePeriods = useCallback(async () => {
        if (!period1.startDate || !period1.endDate || !period2.startDate || !period2.endDate) {
            toast({ title: "Erro", description: "Selecione datas válidas para ambos os períodos.", variant: "destructive" }); return;
        }
        setIsLoadingComparison(true); setHasCompared(false); setApiError(null);
        setComparisonData([]); setTotalDifference(null); setPercentDifference(null); setPeriod1Total(null); setPeriod2Total(null); // Reseta estados

        const campId = selectedCampaignId === 'all' ? undefined : selectedCampaignId;
        const metricToCompare: keyof MetricsTotals & keyof DailyMetric = 'revenue'; // Métrica a ser comparada

        try {
            console.log(`[Dates] Comparando... P1: ${period1.startDate}-${period1.endDate}, P2: ${period2.startDate}-${period2.endDate}, Camp: ${campId || 'all'}`);
            // Busca dados dos dois períodos em paralelo
            const [data1, data2] = await Promise.all([
                fetchPeriodData(period1.startDate, period1.endDate, campId),
                fetchPeriodData(period2.startDate, period2.endDate, campId)
            ]);

            console.log("[Dates] Dados recebidos:", { data1, data2 });

            // Extrai totais e dados diários (com fallback para 0 ou array vazio)
            const total1 = data1?.totals?.[metricToCompare] ?? 0;
            const total2 = data2?.totals?.[metricToCompare] ?? 0;
            const dailyData1 = data1?.dailyData || [];
            const dailyData2 = data2?.dailyData || [];

            setPeriod1Total(total1);
            setPeriod2Total(total2);

            // Calcula diferenças
            const difference = total2 - total1;
            const percentChange = total1 !== 0 ? (difference / total1) * 100 : (total2 > 0 ? Infinity : 0); // Evita divisão por zero

            setTotalDifference(difference);
            setPercentDifference(isFinite(percentChange) ? percentChange : null); // Armazena null para Infinity

            // Prepara dados para o gráfico alinhados por dia relativo
            const maxLength = Math.max(dailyData1.length, dailyData2.length);
            const formattedComparisonData: ComparisonPoint[] = [];
            for (let i = 0; i < maxLength; i++) {
                formattedComparisonData.push({
                    day: i + 1,
                    period1Value: dailyData1[i]?.[metricToCompare] ?? undefined, // Usa undefined se não houver dado
                    period2Value: dailyData2[i]?.[metricToCompare] ?? undefined,
                });
            }
            setComparisonData(formattedComparisonData);
            setHasCompared(true); // Marca que a comparação foi feita

        } catch (error: any) {
            console.error("[Dates] Erro na comparação:", error);
            const errorMsg = axios.isAxiosError(error) ? error.response?.data?.message || error.message : (error as Error).message || 'Falha ao comparar períodos.';
            setApiError(errorMsg);
            toast({ title: "Erro na Comparação", description: errorMsg, variant: "destructive" });
            setHasCompared(false); // Reseta se deu erro
        } finally {
            setIsLoadingComparison(false);
        }
    }, [period1, period2, selectedCampaignId, toast]);

    // --- Handlers de Input ---
    const handleInputChange = (periodNum: 1 | 2, field: 'startDate' | 'endDate', value: string) => {
        const setter = periodNum === 1 ? setPeriod1 : setPeriod2;
        setter(prev => ({ ...prev, [field]: value }));
        setHasCompared(false); // Reseta comparação ao mudar data
    };

     const handleCampaignChange = (value: string) => {
         setSelectedCampaignId(value);
         setHasCompared(false); // Reseta comparação ao mudar campanha
     };

    // --- Renderização do Gráfico ---
    const renderLineChart = () => {
        // (Mesmo código SVG da versão anterior, mas ajustado para 'period1Value' e 'period2Value')
         if (comparisonData.length === 0) return <div className="flex items-center justify-center h-full text-gray-500 text-sm italic">Nenhum dado para exibir no gráfico.</div>;
         const width = 600; const height = 300; const padding = 45;
         const maxValue = Math.max(...comparisonData.flatMap(d => [d.period1Value ?? 0, d.period2Value ?? 0]), 1); // Considera 1 como mínimo para escala
         const maxDays = comparisonData.length;
         const effectiveMaxDays = maxDays > 1 ? maxDays : 2; // Evita divisão por zero se houver apenas 1 dia
         const xScale = (day: number) => padding + ((day - 1) / (effectiveMaxDays - 1)) * (width - 2 * padding);
         const yScale = (value: number) => height - padding - Math.max(0, (value / maxValue)) * (height - 2 * padding);

         const getBezierPath = (points: {x: number, y: number}[]) => { /* ... (Função getBezierPath como antes) ... */
             if (points.length < 1) return ''; if (points.length === 1) return `M ${points[0].x},${points[0].y}`;
             let path = `M ${points[0].x},${points[0].y}`;
             for (let i = 0; i < points.length - 1; i++) { const x1 = points[i].x; const y1 = points[i].y; const x2 = points[i + 1].x; const y2 = points[i + 1].y; const cx1 = x1 + (x2 - x1) * 0.4; const cy1 = y1; const cx2 = x1 + (x2 - x1) * 0.6; const cy2 = y2; path += ` C ${cx1.toFixed(2)},${cy1.toFixed(2)} ${cx2.toFixed(2)},${cy2.toFixed(2)} ${x2.toFixed(2)},${y2.toFixed(2)}`; }
             return path;
         };

         // Mapeia para pontos do gráfico, usando periodXValue
         const period1Points = comparisonData .map((data) => data.period1Value !== undefined ? { x: xScale(data.day), y: yScale(data.period1Value), value: data.period1Value, day: data.day } : null) .filter((p): p is {x: number, y: number, value: number, day: number} => p !== null);
         const period2Points = comparisonData .map((data) => data.period2Value !== undefined ? { x: xScale(data.day), y: yScale(data.period2Value), value: data.period2Value, day: data.day } : null) .filter((p): p is {x: number, y: number, value: number, day: number} => p !== null);

         const period1Path = getBezierPath(period1Points);
         const period2Path = getBezierPath(period2Points);

         const gridLines: JSX.Element[] = []; /* ... (Geração de gridlines como antes) ... */
         const numYTicks = 5;
         for (let i = 0; i <= numYTicks; i++) { const yVal = (i / numYTicks) * maxValue; const y = yScale(yVal); gridLines.push(<line key={`grid-y-${i}`} x1={padding} y1={y} x2={width - padding} y2={y} stroke={neonColorMuted} strokeWidth="0.5" opacity="0.3" strokeDasharray="3 3" />); gridLines.push(<text key={`label-y-${i}`} x={padding - 8} y={y + 4} fill="#a0a0a0" fontSize="10" textAnchor="end">{formatCurrency(yVal).replace("R$", "")}</text>); } // Formata como moeda
         const xLabelInterval = Math.max(1, Math.ceil(maxDays / 10));
         if (maxDays > 0) { for (let i = 1; i <= maxDays; i += xLabelInterval) { const currentDay = (i + xLabelInterval > maxDays && i !== maxDays && maxDays > 1) ? maxDays : i; const x = xScale(currentDay); gridLines.push(<line key={`grid-x-${currentDay}`} x1={x} y1={padding} x2={x} y2={height - padding} stroke={neonColorMuted} strokeWidth="0.5" opacity="0.3" strokeDasharray="3 3" />); gridLines.push(<text key={`label-x-${currentDay}`} x={x} y={height - padding + 18} fill="#a0a0a0" fontSize="10" textAnchor="middle">{currentDay}</text>); if (currentDay === maxDays) break; } }

         const handleMouseOver = (point: {x: number, y: number, value: number, day: number}, periodLabel: string, periodColor: string) => { setTooltip({ x: point.x, y: point.y, visible: true, value: point.value, day: point.day, periodLabel, periodColor }); };
         const handleMouseOut = () => { setTooltip(prev => ({ ...prev, visible: false })); };

         return ( <div className="relative"> <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}> {/* ... Defs (filters) como antes ... */} <g> {gridLines} <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#a0a0a0" strokeWidth="0.5"/> <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#a0a0a0" strokeWidth="0.5"/> <text x={width / 2} y={height - 8} fill="#a0a0a0" fontSize="11" textAnchor="middle" > Dia no Período </text> <text x={padding - 35} y={height/2} fill="#a0a0a0" fontSize="11" textAnchor="middle" transform={`rotate(-90 ${padding-35},${height/2})`} > Receita (R$) </text> </g> {period1Path && <path d={period1Path} fill="none" stroke={neonColor} strokeWidth="2" />} {period2Path && <path d={period2Path} fill="none" stroke={neonGreenColor} strokeWidth="2" />} {period1Points.map((point, index) => ( <circle key={`p1-${index}`} cx={point.x} cy={point.y} r="3.5" fill={neonColor} stroke="#0e1015" strokeWidth="1" className="cursor-pointer transition-all duration-150 ease-out hover:r-5" onMouseOver={() => handleMouseOver(point, 'Período 1', neonColor)} onMouseOut={handleMouseOut} /> ))} {period2Points.map((point, index) => ( <circle key={`p2-${index}`} cx={point.x} cy={point.y} r="3.5" fill={neonGreenColor} stroke="#0e1015" strokeWidth="1" className="cursor-pointer transition-all duration-150 ease-out hover:r-5" onMouseOver={() => handleMouseOver(point, 'Período 2', neonGreenColor)} onMouseOut={handleMouseOut} /> ))} </svg> {/* Tooltip Div (como antes, usando tooltip.periodLabel/Color) */} <div className={cn( "absolute z-10 pointer-events-none", "bg-[#13151a]/90 backdrop-blur-sm", "border border-[#2d62a3]/50 rounded-md shadow-lg", "px-3 py-1.5 text-xs text-white whitespace-nowrap", "transition-opacity duration-200 ease-out", tooltip.visible ? "opacity-100" : "opacity-0", "transform -translate-x-1/2 -translate-y-[calc(100%+8px)]" )} style={{ left: tooltip.x, top: tooltip.y }} > <span className="font-semibold" style={{ color: tooltip.periodColor }}> {tooltip.periodLabel} </span> - Dia {tooltip.day}: <br/> <span className="font-bold">{formatCurrency(tooltip.value)}</span> </div> </div> );
    }; // Fim renderLineChart

    // --- Renderização Condicional (Auth Loading) ---
    if (authLoading) { return ( <Layout><div className="flex h-[calc(100vh-100px)] w-full items-center justify-center"> <Loader2 className="h-8 w-8 animate-spin text-primary" /> <span className="ml-3 text-muted-foreground">Verificando acesso...</span> </div></Layout> ); }
    if (!isAuthenticated) { return null; } // Proteção

    // --- Renderização Principal ---
    return (
        <Layout>
            <Head><title>Comparativo de Datas - USBMKT V30</title></Head>
            <div className="space-y-4 p-4 md:p-6 h-full flex flex-col">
                {/* Cabeçalho */}
                <div className="flex-shrink-0">
                    <h1 className="text-2xl font-black text-white mb-4" style={{ textShadow: `0 0 8px ${neonColor}` }}> Comparativo de Datas </h1>
                </div>

                {/* Grid Principal */}
                <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0">

                    {/* Coluna Esquerda: Controles */}
                    <Card className={cn(cardStyle, "lg:col-span-1 p-4 flex flex-col")}>
                        <CardHeader className="p-0 pb-3 mb-3 border-b border-[#1E90FF]/20">
                            <CardTitle className={cn(titleStyle, "text-base flex items-center")} style={{ textShadow: `0 0 6px ${neonColor}` }}>
                                <CalendarDays size={18} className="mr-2" /> Configurar Comparação
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0 space-y-4 overflow-y-auto custom-scrollbar flex-grow">
                            {/* Seletor de Campanha */}
                            <div>
                                <Label htmlFor="campaignSelectDates" className="text-xs text-gray-400 mb-1 block">Campanha</Label>
                                <Select value={selectedCampaignId} onValueChange={handleCampaignChange} disabled={isLoadingCampaigns || isLoadingComparison}>
                                    <SelectTrigger id="campaignSelectDates" className={cn(neumorphicInputStyle, "w-full h-9 px-3 py-1 text-xs")}>
                                        <SelectValue placeholder={isLoadingCampaigns ? "Carregando..." : "Selecione..."} />
                                    </SelectTrigger>
                                    <SelectContent className="bg-[#1e2128] border-[#1E90FF]/30 text-white">
                                        {isLoadingCampaigns ? ( <SelectItem value="loading" disabled>Carregando...</SelectItem> ) : (
                                            <>
                                                <SelectItem value="all" className="text-xs hover:bg-[#1E90FF]/20">Todas Campanhas</SelectItem>
                                                {campaigns.length > 0 ? campaigns.map((c) => (
                                                    <SelectItem key={c.id} value={c.id.toString()} className="text-xs hover:bg-[#1E90FF]/20">{c.name}</SelectItem>
                                                )) : (
                                                    <SelectItem value="no-camps" disabled>Nenhuma campanha</SelectItem>
                                                )}
                                            </>
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Período 1 */}
                            <div className="space-y-1">
                                <h3 className="font-semibold text-sm text-white" style={{ textShadow: `0 0 4px ${neonColor}` }}>Período 1</h3>
                                <div className="grid grid-cols-2 gap-2">
                                    <div> <Label htmlFor="startDate1" className="text-xs text-gray-400 mb-1 block">Data Inicial</Label> <Input id="startDate1" type="date" value={period1.startDate} onChange={(e) => handleInputChange(1, 'startDate', e.target.value)} className={cn(neumorphicInputStyle, "h-8 px-2 text-xs")} disabled={isLoadingComparison} /> </div>
                                    <div> <Label htmlFor="endDate1" className="text-xs text-gray-400 mb-1 block">Data Final</Label> <Input id="endDate1" type="date" value={period1.endDate} onChange={(e) => handleInputChange(1, 'endDate', e.target.value)} className={cn(neumorphicInputStyle, "h-8 px-2 text-xs")} disabled={isLoadingComparison} min={period1.startDate} /> </div>
                                </div>
                            </div>
                            {/* Período 2 */}
                            <div className="space-y-1">
                                <h3 className="font-semibold text-sm text-white" style={{ textShadow: `0 0 4px ${neonColor}` }}>Período 2</h3>
                                <div className="grid grid-cols-2 gap-2">
                                    <div> <Label htmlFor="startDate2" className="text-xs text-gray-400 mb-1 block">Data Inicial</Label> <Input id="startDate2" type="date" value={period2.startDate} onChange={(e) => handleInputChange(2, 'startDate', e.target.value)} className={cn(neumorphicInputStyle, "h-8 px-2 text-xs")} disabled={isLoadingComparison} /> </div>
                                    <div> <Label htmlFor="endDate2" className="text-xs text-gray-400 mb-1 block">Data Final</Label> <Input id="endDate2" type="date" value={period2.endDate} onChange={(e) => handleInputChange(2, 'endDate', e.target.value)} className={cn(neumorphicInputStyle, "h-8 px-2 text-xs")} disabled={isLoadingComparison} min={period2.startDate} /> </div>
                                </div>
                            </div>
                        </CardContent>
                         {/* Botão fica fora do scroll */}
                        <Button onClick={fetchAndComparePeriods} className={cn(primaryButtonStyle, "w-full mt-4 py-2 text-sm")} disabled={isLoadingCampaigns || isLoadingComparison}>
                             {isLoadingComparison ? <Loader2 size={16} className="mr-2 animate-spin" /> : <BarChartHorizontal size={16} className="mr-2" />}
                             {isLoadingComparison ? "Comparando..." : "Comparar Períodos"}
                         </Button>
                    </Card>

                    {/* Coluna Direita: Resultados */}
                    <div className="lg:col-span-2 space-y-4 overflow-y-auto custom-scrollbar">
                        {isLoadingComparison ? (
                             <Card className={cn(cardStyle, "flex items-center justify-center h-[400px] p-6")}>
                                 <Loader2 className="h-10 w-10 animate-spin text-primary" />
                             </Card>
                        ) : apiError ? (
                            <Card className={cn(cardStyle, "flex flex-col items-center justify-center h-[400px] p-6 text-center")}>
                                <AlertTriangle className="h-10 w-10 text-red-400 mb-4" />
                                <p className="text-lg font-semibold text-red-400 mb-1">Erro ao Comparar</p>
                                <p className="text-sm text-red-400/80 mb-4">{apiError}</p>
                                <Button onClick={fetchAndComparePeriods} className={cn(primaryButtonStyle, "text-xs h-8 px-3")} > Tentar Novamente </Button>
                            </Card>
                        ) : hasCompared ? (
                            <>
                                {/* Cards de Diferença */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <Card className={cn(cardStyle, "p-4 text-center")}>
                                        <CardHeader className="p-0 mb-1"> <CardTitle className="text-xs text-gray-400 font-medium uppercase tracking-wider">Receita Total (P1)</CardTitle> </CardHeader>
                                        <CardContent className="p-0"> <p className="text-xl font-bold text-white" style={{ color: neonColor }}>{formatCurrency(period1Total ?? 0)}</p> </CardContent>
                                    </Card>
                                    <Card className={cn(cardStyle, "p-4 text-center")}>
                                        <CardHeader className="p-0 mb-1"> <CardTitle className="text-xs text-gray-400 font-medium uppercase tracking-wider">Receita Total (P2)</CardTitle> </CardHeader>
                                        <CardContent className="p-0"> <p className="text-xl font-bold text-white" style={{ color: neonGreenColor }}>{formatCurrency(period2Total ?? 0)}</p> </CardContent>
                                    </Card>
                                    <Card className={cn(cardStyle, "p-4 text-center")}>
                                        <CardHeader className="p-0 mb-1"> <CardTitle className="text-xs text-gray-400 font-medium uppercase tracking-wider">Diferença (P2 - P1)</CardTitle> </CardHeader>
                                        <CardContent className="p-0"> <p className={`text-xl font-bold ${(totalDifference ?? 0) >= 0 ? "text-green-400" : "text-red-400"}`} style={{ textShadow: `0 0 5px ${(totalDifference ?? 0) >= 0 ? neonGreenColor : neonRedColor}` }}> {formatCurrency(totalDifference ?? 0)} </p> </CardContent>
                                    </Card>
                                    <Card className={cn(cardStyle, "p-4 text-center")}>
                                        <CardHeader className="p-0 mb-1"> <CardTitle className="text-xs text-gray-400 font-medium uppercase tracking-wider">Variação Percentual</CardTitle> </CardHeader>
                                        <CardContent className="p-0"> <p className={`text-xl font-bold ${(percentDifference ?? 0) >= 0 ? "text-green-400" : "text-red-400"}`} style={{ textShadow: `0 0 5px ${(percentDifference ?? 0) >= 0 ? neonGreenColor : neonRedColor}` }}> {(percentDifference ?? 0) >= 0 ? <TrendingUp className="inline h-5 w-5 mr-1"/> : <TrendingDown className="inline h-5 w-5 mr-1"/>} {formatPercent(percentDifference)} </p> </CardContent>
                                    </Card>
                                </div>
                                {/* Card do Gráfico */}
                                <Card className={cn(cardStyle, "p-4")}>
                                    <CardHeader className="p-0 mb-3 border-b border-[#1E90FF]/20 pb-2">
                                        <CardTitle className={cn(titleStyle, "text-base flex items-center")} style={{ textShadow: `0 0 6px ${neonColor}` }}>
                                            <LineChart size={18} className="mr-2" /> Comparativo Diário (Receita)
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-0">
                                        <div className="flex items-center gap-4 mb-3 text-xs">
                                             <div className="flex items-center"> <div className="w-2.5 h-2.5 rounded-sm mr-1.5" style={{ backgroundColor: neonColor }}></div> <span className="text-gray-300"> Período 1</span> </div>
                                             <div className="flex items-center"> <div className="w-2.5 h-2.5 rounded-sm mr-1.5" style={{ backgroundColor: neonGreenColor }}></div> <span className="text-gray-300"> Período 2</span> </div>
                                        </div>
                                        <div className="h-[300px] w-full overflow-hidden"> {renderLineChart()} </div>
                                    </CardContent>
                                </Card>
                            </>
                        ) : (
                            /* Placeholder inicial */
                             <Card className={cn(cardStyle, "flex items-center justify-center h-[400px] p-6")}> <div className="text-center"> <CalendarDays size={48} className="text-primary opacity-30 mx-auto mb-4" style={{ filter: `drop-shadow(0 0 8px ${neonColor})` }}/> <p className="text-lg text-gray-300" style={{ textShadow: `0 0 4px ${neonColorMuted}` }}> Selecione campanha e períodos </p> <p className="text-lg font-semibold text-primary mb-1" style={{ textShadow: `0 0 6px ${neonColor}` }}>e clique em "Comparar"</p> <p className="text-sm text-gray-500">para visualizar o gráfico e as diferenças.</p> </div> </Card>
                        )}
                    </div> {/* Fim Coluna Direita */}
                </div> {/* Fim Grid Principal */}
            </div> {/* Fim Container Página */}
             {/* Estilos Globais (Animação + Date Picker) */}
             <style jsx global>{` @keyframes line-draw { to { stroke-dashoffset: 0; } } .animate-line-draw { animation: line-draw 1.5s ease-in-out forwards; } input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(0.6) brightness(100%) sepia(100%) hue-rotate(180deg) saturate(500%); cursor: pointer; opacity: 0.8; transition: opacity 0.2s; } input[type="date"]::-webkit-calendar-picker-indicator:hover { opacity: 1; } `}</style>
        </Layout>
    );
}
