// pages/Budget.tsx
import React, { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/router';
import Layout from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Filter, Calendar as CalendarIcon, BarChartHorizontal, Users, Target, ShoppingCart, TrendingUp, Minus, ArrowUpCircle, ArrowDownCircle, Percent, Sigma, Scale, Coins } from 'lucide-react'; // Adicionado mais ícones
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import axios from 'axios';
import { format, subDays, parseISO, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { DateRange } from "react-day-picker";
import Image from 'next/image';
import type { Campaign } from '@/entities/Campaign';
// REMOVIDO: import { StatCard } from '@/components/dashboard/StatCard'; // NÃO DEVE ESTAR AQUI SE StatCard IMPORTAR DB
// REMOVIDO: import { GaugeChart } from '@/components/dashboard/GaugeChart'; // NÃO DEVE ESTAR AQUI SE GaugeChart IMPORTAR DB

// Tipos - Reflete a API /api/budget
type BudgetData = {
    totalBudget?: number; totalBudgetFmt?: string;
    totalRealCost?: number; totalRealCostFmt?: string;
    totalRevenue?: number; totalRevenueFmt?: string;
    realProfit?: number; realProfitFmt?: string;
    budgetUsedPerc?: number;
    budgetRemaining?: number; budgetRemainingFmt?: string;
    realProfitMargin?: number | null;
    trafficCost?: number; trafficCostFmt?: string; trafficPerc?: number;
    creativeCost?: number; creativeCostFmt?: string; creativePerc?: number;
    operationalCost?: number; operationalCostFmt?: string; opPerc?: number;
    unallocatedValue?: number; unallocatedFmt?: string; unallocatedPerc?: number;
    chartImageUrl?: string | null;
};
type CampaignOption = Pick<Campaign, 'id' | 'name'>;

// Constantes
const DATE_FORMAT_API = 'yyyy-MM-dd';
const DEFAULT_PERIOD_DAYS = 30; // Período padrão para orçamento pode ser maior

// Funções Auxiliares (Apenas formatação, sem DB)
const formatCurrency = (value: number | undefined | null): string => { const numValue = Number(value); return isNaN(numValue) ? 'R$ 0,00' : numValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); };
const formatNumber = (value: number | undefined | null): string => { const numValue = Number(value); return isNaN(numValue) ? '0' : numValue.toLocaleString('pt-BR', { maximumFractionDigits: 0 }); };
const formatPercent = (value: number | undefined | null): string => { const numValue = Number(value); return isNaN(numValue) ? '0.0%' : `${numValue.toFixed(1)}%`; };

export default function BudgetPage() {
    // Estados e Hooks
    const { isAuthenticated, isLoading: authLoading } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [budgetData, setBudgetData] = useState<BudgetData | null>(null); // Estado para guardar os dados da API
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [campaignOptions, setCampaignOptions] = useState<CampaignOption[]>([]);
    const [selectedCampaignId, setSelectedCampaignId] = useState<string>('all');
    const [isLoadingCampaigns, setIsLoadingCampaigns] = useState<boolean>(true);
    const [currentStartDate, setCurrentStartDate] = useState<Date>(subDays(new Date(), DEFAULT_PERIOD_DAYS -1)); // Usa constante de período
    const [currentEndDate, setCurrentEndDate] = useState<Date>(new Date());
    const [dateRange, setDateRange] = useState<DateRange | undefined>({ from: currentStartDate, to: currentEndDate });

    // Estilos
    const neonColor = '#1E90FF';
    const cardStyle = "bg-[#141414]/80 backdrop-blur-sm shadow-[5px_5px_10px_rgba(0,0,0,0.4),-5px_-5px_10px_rgba(255,255,255,0.05)] rounded-lg border-none";
    const labelStyle = "text-xs text-gray-300 mb-1 block";
    const titleStyle = "text-base font-semibold text-white";
    const valueStyle = "text-lg md:text-xl font-bold text-white";
    const percentStyle = "text-xs text-gray-400 ml-1";

    // Funções de Callback
    // Função para buscar dados da API /api/budget
    const loadBudgetData = useCallback(async () => {
        if (!isAuthenticated || !currentStartDate || !currentEndDate) {
            console.log("loadBudgetData: Autenticação ou datas ausentes.");
            return;
        }

        console.log("loadBudgetData: Iniciando busca...");
        setIsLoading(true);
        setError(null);
        setBudgetData(null);

        try {
            const startDateFormatted = format(currentStartDate, DATE_FORMAT_API);
            const endDateFormatted = format(currentEndDate, DATE_FORMAT_API);
            const campaignParam = selectedCampaignId || 'all';

            console.log(`loadBudgetData: Parâmetros - Start: ${startDateFormatted}, End: ${endDateFormatted}, Campaign: ${campaignParam}`);

            const response = await axios.get<BudgetData>('/api/budget', {
                params: {
                    startDate: startDateFormatted,
                    endDate: endDateFormatted,
                    campaignId: campaignParam,
                }
            });

            console.log("loadBudgetData: Dados recebidos:", response.data);
            setBudgetData(response.data);

        } catch (err: any) {
            console.error("Erro ao carregar dados de orçamento:", err);
            const errorMessage = err.response?.data?.message || err.message || "Falha ao buscar dados de orçamento.";
            setError(errorMessage);
            toast({
                title: "Erro ao carregar Orçamento",
                description: errorMessage,
                variant: "destructive",
            });
            setBudgetData(null);
        } finally {
            console.log("loadBudgetData: Busca finalizada.");
            setIsLoading(false);
        }
    }, [isAuthenticated, currentStartDate, currentEndDate, selectedCampaignId, toast]);

    // Função para buscar opções de campanha (igual às outras páginas)
    const fetchCampaignOptions = useCallback(async () => {
        setIsLoadingCampaigns(true);
        try {
            const response = await axios.get<CampaignOption[]>('/api/campaigns?fields=id,name');
            setCampaignOptions(response.data || []);
        } catch (err: any) {
            toast({ title: "Erro", description: "Falha ao carregar opções de campanha.", variant: "destructive" });
            setCampaignOptions([]);
        } finally {
            setIsLoadingCampaigns(false);
        }
    }, [toast]);

    const handleCampaignChange = (campaignId: string) => {
        setSelectedCampaignId(campaignId);
    };

    // Efeitos
    useEffect(() => {
        if (dateRange?.from && dateRange?.to) {
            setCurrentStartDate(dateRange.from);
            setCurrentEndDate(dateRange.to);
        }
    }, [dateRange]);

    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            router.push('/login');
            return;
        }
        if (!authLoading && isAuthenticated) {
            fetchCampaignOptions();
        }
    }, [authLoading, isAuthenticated, router, fetchCampaignOptions]);

    useEffect(() => {
        if (isAuthenticated && !isLoadingCampaigns && currentStartDate && currentEndDate) {
            loadBudgetData(); // Chama a função que busca da API
        }
    }, [isAuthenticated, isLoadingCampaigns, selectedCampaignId, loadBudgetData, currentStartDate, currentEndDate]);

    // Renderização Condicional
    if (authLoading) {
        return ( <Layout><div className="flex h-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></Layout> );
    }
    if (!isAuthenticated) { return null; }

    return (
        <Layout>
            <Head><title>Análise de Orçamento - USBMKT</title></Head>
            <div className="p-4 md:p-6 space-y-4 h-full flex flex-col">
                {/* Cabeçalho e Filtros */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 flex-shrink-0">
                    <h1 className="text-xl md:text-2xl font-black text-white" style={{ textShadow: `0 0 8px ${neonColor}` }}>Análise de Orçamento</h1>
                    <div className="flex flex-wrap items-center gap-2">
                        {/* Seletor de Data */}
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button id="date" variant={"outline"} className={cn( "w-[240px] sm:w-[260px] justify-start text-left font-normal bg-[#141414]/80 border-none text-white shadow-[inset_2px_2px_4px_rgba(0,0,0,0.3)] hover:bg-[#1E90FF]/20 h-8 px-3 text-xs", !dateRange && "text-muted-foreground" )} disabled={isLoading || isLoadingCampaigns}>
                                    <CalendarIcon className="mr-2 h-3 w-3" />
                                    {dateRange?.from ? ( dateRange.to ? ( <>{format(dateRange.from, "P", { locale: ptBR })} - {format(dateRange.to, "P", { locale: ptBR })}</> ) : ( format(dateRange.from, "P", { locale: ptBR }) ) ) : ( <span>Selecione</span> )}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0 bg-[#1e2128] border-[#1E90FF]/30" align="end">
                                <Calendar initialFocus mode="range" defaultMonth={dateRange?.from} selected={dateRange} onSelect={setDateRange} numberOfMonths={2} locale={ptBR} disabled={isLoading || isLoadingCampaigns} className="text-white [&>div>table>tbody>tr>td>button]:text-white [&>div>table>tbody>tr>td>button]:border-[#1E90FF]/20 [&>div>table>thead>tr>th]:text-gray-400 [&>div>div>button]:text-white [&>div>div>button:hover]:bg-[#1E90FF]/20 [&>div>div>div]:text-white" />
                            </PopoverContent>
                        </Popover>
                        {/* Seletor de Campanha */}
                        <Select value={selectedCampaignId} onValueChange={handleCampaignChange} disabled={isLoadingCampaigns || isLoading}>
                            <SelectTrigger className="w-auto min-w-[140px] max-w-[200px] bg-[#141414]/80 border-none text-white shadow-[inset_2px_2px_4px_rgba(0,0,0,0.3)] hover:bg-[#1E90FF]/20 h-8 px-3 text-xs">
                                <SelectValue placeholder="Campanha" className="truncate" />
                            </SelectTrigger>
                            <SelectContent className="bg-[#1e2128] border-[#1E90FF]/30 text-white">
                                <SelectItem value="all" className="text-xs hover:bg-[#1E90FF]/20">Todas</SelectItem>
                                {isLoadingCampaigns && <div className="p-2 text-xs text-center">...</div>}
                                {!isLoadingCampaigns && campaignOptions.map((c) => (
                                    <SelectItem key={c.id} value={c.id.toString()} className="text-xs hover:bg-[#1E90FF]/20">{c.name}</SelectItem>
                                ))}
                                {!isLoadingCampaigns && campaignOptions.length === 0 && <div className="p-2 text-xs text-center">Nenhuma</div>}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* Conteúdo Principal */}
                <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                    {isLoading ? ( <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div> )
                    : error ? ( <Card className={cn(cardStyle, "h-full flex items-center justify-center")}><CardContent className="p-6 text-center text-red-400"><p>{error}</p></CardContent></Card> )
                    : !budgetData ? ( <Card className={cn(cardStyle, "h-full flex items-center justify-center")}><CardContent className="p-6 text-center text-gray-400"><p>Sem dados de orçamento.</p></CardContent></Card> )
                    : (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                            {/* Coluna Esquerda: Sumário e Gráfico */}
                            <div className="lg:col-span-2 space-y-4">
                                <Card className={cn(cardStyle)}>
                                    <CardHeader className="pb-2"><CardTitle className={cn(titleStyle, "text-lg")}>Sumário do Orçamento</CardTitle></CardHeader>
                                    <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2">
                                        <div> <Label className={labelStyle}>Orçam. Total</Label> <p className={valueStyle}>{budgetData.totalBudgetFmt ?? 'R$ 0,00'}</p> </div>
                                        <div> <Label className={labelStyle}>Gasto Real</Label> <p className={valueStyle}>{budgetData.totalRealCostFmt ?? 'R$ 0,00'} <span className={percentStyle}>({formatPercent(budgetData.budgetUsedPerc)})</span></p> </div>
                                        <div> <Label className={labelStyle}>Receita</Label> <p className={valueStyle}>{budgetData.totalRevenueFmt ?? 'R$ 0,00'}</p> </div>
                                        <div> <Label className={labelStyle}>Lucro Real</Label> <p className={valueStyle}>{budgetData.realProfitFmt ?? 'R$ 0,00'}</p> </div>
                                        <div> <Label className={labelStyle}>Margem Lucro</Label> <p className={valueStyle}>{formatPercent(budgetData.realProfitMargin)}</p> </div>
                                        <div> <Label className={labelStyle}>Saldo Orçam.</Label> <p className={valueStyle}>{budgetData.budgetRemainingFmt ?? 'R$ 0,00'}</p> </div>
                                    </CardContent>
                                </Card>
                                <Card className={cn(cardStyle, "p-4 flex flex-col items-center")}>
                                    <CardHeader className="p-0 pb-2 mb-2 text-center">
                                        <CardTitle className={cn(titleStyle, "text-lg")} style={{ textShadow: `0 0 5px ${neonColor}` }}>Distribuição de Custos (Planejado)</CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-0 w-full max-w-[400px] flex items-center justify-center min-h-[250px]">
                                        {budgetData.chartImageUrl ? ( <Image src={budgetData.chartImageUrl} alt="Gráfico Distribuição de Custos" width={400} height={250} style={{ maxWidth: '100%', height: 'auto' }} /> ) : ( <p className="text-gray-500 text-sm">Gráfico indisponível.</p> )}
                                    </CardContent>
                                </Card>
                            </div>
                            {/* Coluna Direita: Detalhes Custos Planejados */}
                            <div className="lg:col-span-1 space-y-4">
                                <Card className={cn(cardStyle)}>
                                    <CardHeader className="pb-2"><CardTitle className={cn(titleStyle, "text-base")}>Custos Planejados</CardTitle></CardHeader>
                                    <CardContent className="space-y-3 pt-2">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2"> <Coins className="w-4 h-4 text-blue-400"/> <span className="text-sm text-gray-200">Tráfego</span> </div>
                                            <div className="text-right"> <p className="text-sm font-medium text-white">{budgetData.trafficCostFmt}</p> <p className="text-xs text-gray-400">{formatPercent(budgetData.trafficPerc)} do total</p> </div>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2"> <Target className="w-4 h-4 text-green-400"/> <span className="text-sm text-gray-200">Criativos</span> </div>
                                            <div className="text-right"> <p className="text-sm font-medium text-white">{budgetData.creativeCostFmt}</p> <p className="text-xs text-gray-400">{formatPercent(budgetData.creativePerc)} do total</p> </div>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2"> <Scale className="w-4 h-4 text-yellow-400"/> <span className="text-sm text-gray-200">Operacional</span> </div>
                                            <div className="text-right"> <p className="text-sm font-medium text-white">{budgetData.operationalCostFmt}</p> <p className="text-xs text-gray-400">{formatPercent(budgetData.opPerc)} do total</p> </div>
                                        </div>
                                        <div className="flex items-center justify-between border-t border-gray-700 pt-3 mt-2">
                                            <div className="flex items-center gap-2"> <Sigma className="w-4 h-4 text-gray-400"/> <span className="text-sm text-gray-200">Total Alocado</span> </div>
                                            <div className="text-right"> <p className="text-sm font-medium text-white">{formatCurrency((budgetData.trafficCost ?? 0) + (budgetData.creativeCost ?? 0) + (budgetData.operationalCost ?? 0))}</p> </div>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2"> <Minus className="w-4 h-4 text-gray-500"/> <span className="text-sm text-gray-200">Não Alocado</span> </div>
                                            <div className="text-right"> <p className="text-sm font-medium text-white">{budgetData.unallocatedFmt}</p> <p className="text-xs text-gray-400">{formatPercent(budgetData.unallocatedPerc)} do total</p> </div>
                                        </div>
                                    </CardContent>
                                </Card>
                             </div>
                        </div>
                    )}
                </div>
            </div>
        </Layout>
    );
}
