// pages/Projection.tsx
import React, { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/router';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { TrendingUp, DollarSign, Target, CalendarDays, AlertCircle, Loader2, Users, HelpCircle } from 'lucide-react';
import Layout from '@/components/layout';
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";
import type { Campaign } from '@/entities/Campaign'; // Mantém tipo para busca detalhada
import axios from 'axios';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// --- Tipos ---
interface ProjectionData { futureInvestment: number; expectedLeads: number; expectedSales: number; expectedRevenue: number; expectedRoi: number; cpaEstimate: number; }
interface CampaignMetrics { costPerLead: number; conversionRate: number; averageSaleValue: number; }
type CampaignOption = Pick<Campaign, 'id' | 'name'>; // Para o select

// --- Tooltip Label Component ---
const TooltipLabel = ({ label, tooltipKey, tooltipText }: { label: string, tooltipKey: string, tooltipText?: string }) => ( <TooltipProvider> <Tooltip delayDuration={150}> <TooltipTrigger type="button" className="flex items-center justify-start text-left cursor-help w-full"> <Label htmlFor={tooltipKey} className={cn("text-sm text-gray-300 mr-1")} style={{ textShadow: `0 0 4px #2d62a3` }}>{label}</Label> <HelpCircle className="h-3 w-3 text-gray-500 flex-shrink-0" /> </TooltipTrigger> <TooltipContent className="max-w-xs text-xs bg-[#1e2128] border border-[#1E90FF]/30 text-white p-1.5 rounded shadow-lg"> <p>{tooltipText || "Tooltip não definido"}</p> </TooltipContent> </Tooltip> </TooltipProvider>);
const tooltips = { campaignBase: 'Selecione uma campanha existente para usar suas métricas como base para a projeção.', metricsBase: 'Métricas atuais da campanha selecionada (CPL, Taxa de Conversão Lead->Venda, Valor Médio da Venda). Usadas como referência.', futureInvestment: 'Valor total que você planeja investir no período da projeção.', projectionPeriod: 'Número de dias para o qual a projeção será calculada.' };

export default function ProjectionPage() {
  // --- Autenticação e Roteamento ---
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const router = useRouter();

  // --- Estados ---
  const [campaignOptions, setCampaignOptions] = useState<CampaignOption[]>([]); // <<< ESTADO PARA OPÇÕES DO SELECT
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('');
  const [currentMetrics, setCurrentMetrics] = useState<CampaignMetrics | null>(null);
  const [futureInvestment, setFutureInvestment] = useState<number>(1000);
  const [projectionPeriod, setProjectionPeriod] = useState<number>(30);
  const [projectionData, setProjectionData] = useState<ProjectionData | null>(null);
  const [isLoadingCampaigns, setIsLoadingCampaigns] = useState<boolean>(true); // <<< NOME CORRETO AQUI
  const [isLoadingMetrics, setIsLoadingMetrics] = useState<boolean>(false);
  const [isCalculating, setIsCalculating] = useState<boolean>(false);
  const { toast } = useToast();

  // --- Estilos ---
  const neonColor = '#1E90FF'; const neonColorMuted = '#4682B4'; const neonGreenColor = '#32CD32'; const neonRedColor = '#FF4444';
  const cardStyle = "bg-[#141414]/80 backdrop-blur-sm shadow-[5px_5px_10px_rgba(0,0,0,0.4),-5px_-5px_10px_rgba(255,255,255,0.05)] rounded-lg border-none";
  const neumorphicInputStyle = "bg-[#141414] text-white shadow-[inset_2px_2px_4px_rgba(0,0,0,0.3),inset_-2px_-2px_4px_rgba(255,255,255,0.05)] placeholder:text-gray-500 border-none focus:ring-2 focus:ring-[#1E90FF] focus:ring-offset-2 focus:ring-offset-[hsl(var(--background))] h-9";
  const primaryButtonStyle = `bg-gradient-to-r from-[${neonColor}] to-[${neonColorMuted}] hover:from-[${neonColorMuted}] hover:to-[${neonColor}] text-white font-semibold shadow-[0_4px_10px_rgba(30,144,255,0.4)] transition-all duration-300 ease-in-out transform hover:scale-[1.03] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#0e1015] focus:ring-[#5ca2e2]`;
  const labelStyle = "text-sm text-gray-300";
  const valueStyle = "font-semibold text-white text-3xl";
  const titleStyle = "text-base font-semibold text-white";

  // --- Lógica de Proteção de Rota ---
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      console.log(`[Auth Guard /Projection] Usuário não autenticado, redirecionando para /login`);
      router.push('/login');
    }
    if (!authLoading && isAuthenticated && campaignOptions.length === 0) {
        fetchCampaignOptionsClient();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isAuthenticated, router, campaignOptions.length]);

  // --- Funções ---
  const fetchCampaignOptionsClient = useCallback(async () => { setIsLoadingCampaigns(true); try { const response = await axios.get<CampaignOption[]>('/api/campaigns?fields=id,name'); setCampaignOptions(response.data || []); if (response.data && response.data.length > 0 && !selectedCampaignId) { setSelectedCampaignId(String(response.data[0].id)); } else if (!response.data || response.data.length === 0) { setSelectedCampaignId(String('')); } } catch (error: any) { console.error('Erro buscar opções campanha:', error); toast({ title: "Erro", description: "Falha buscar campanhas.", variant: "destructive" }); setCampaignOptions([]); } finally { setIsLoadingCampaigns(false); } }, [toast, selectedCampaignId]);
  const loadMetricsForCampaign = useCallback(async (campaignId: string) => { if (!campaignId) { setCurrentMetrics(null); setProjectionData(null); return; } setIsLoadingMetrics(true); setProjectionData(null); try { await new Promise(resolve => setTimeout(resolve, 600)); const baseCpl = 5 + Math.random() * 15; const baseConvRate = 1 + Math.random() * 5; const baseAvgSale = 50 + Math.random() * 200; const metrics: CampaignMetrics = { costPerLead: parseFloat(baseCpl.toFixed(2)), conversionRate: parseFloat(baseConvRate.toFixed(1)), averageSaleValue: parseFloat(baseAvgSale.toFixed(2)) }; if (metrics.costPerLead > 0 && metrics.averageSaleValue >= 0 && metrics.conversionRate >= 0) { setCurrentMetrics(metrics); console.log("Métricas Carregadas:", metrics); } else { console.warn("Métricas inválidas:", metrics); setCurrentMetrics(null); toast({ title: "Aviso", description: "Métricas base inválidas.", variant: "default" }); } } catch (error: any) { console.error("Erro carregar métricas:", error); toast({ title: "Erro", description: "Falha métricas.", variant: "destructive" }); setCurrentMetrics(null); } finally { setIsLoadingMetrics(false); } }, [toast]);
  useEffect(() => { if (isAuthenticated && !isLoadingCampaigns && selectedCampaignId) { loadMetricsForCampaign(selectedCampaignId); } else if (!selectedCampaignId) { setCurrentMetrics(null); setProjectionData(null); } }, [selectedCampaignId, isLoadingCampaigns, isAuthenticated, loadMetricsForCampaign]);
  const calculateProjection = useCallback(() => { if (!currentMetrics) { toast({ title: "Aviso", description: "Métricas base não carregadas.", variant: "default" }); return; } if (futureInvestment <= 0) { toast({ title: "Aviso", description: "Investimento > 0.", variant: "default" }); return; } setIsCalculating(true); setProjectionData(null); try { const { costPerLead, conversionRate, averageSaleValue } = currentMetrics; if (costPerLead <= 0) throw new Error("CPL inválido (<= 0)."); const expectedLeads = Math.max(0, Math.floor(futureInvestment / costPerLead)); const expectedSales = Math.max(0, Math.floor(expectedLeads * (conversionRate / 100))); const expectedRevenue = Math.max(0, parseFloat((expectedSales * averageSaleValue).toFixed(2))); let expectedRoi = 0; if (futureInvestment > 0) expectedRoi = parseFloat((((expectedRevenue - futureInvestment) / futureInvestment) * 100).toFixed(1)); else if (expectedRevenue > 0) expectedRoi = Infinity; const cpaEstimate = expectedSales > 0 ? parseFloat((futureInvestment / expectedSales).toFixed(2)) : Infinity; setProjectionData({ futureInvestment, expectedLeads, expectedSales, expectedRevenue, expectedRoi, cpaEstimate }); } catch (error: any) { console.error("Erro projeção:", error); toast({ title: "Erro Cálculo", description: error.message || "Erro.", variant: "destructive" }); setProjectionData(null); } finally { setIsCalculating(false); } }, [currentMetrics, futureInvestment, toast]); // Removido projectionPeriod
  useEffect(() => { if (projectionData) { console.log("Projeção Calculada:", projectionData); } }, [projectionData]);

  // --- Renderização Condicional (Auth + Page Loading) ---
  if (authLoading || isLoadingCampaigns) { return ( <Layout><div className="flex h-[calc(100vh-100px)] w-full items-center justify-center"> <Loader2 className="h-8 w-8 animate-spin text-primary" /><span className="ml-3 text-muted-foreground">{authLoading ? 'Verificando...' : 'Carregando...'}</span> </div></Layout> ); }
  if (!isAuthenticated) { return null; }

  // --- Renderização Principal ---
  return (
    <Layout>
      <Head><title>Projeção de Resultados - USBMKT</title></Head>
      <div className="space-y-6">
        <h1 className="text-3xl font-black text-white mb-6" style={{ textShadow: `0 0 10px ${neonColor}` }}>Projeção de Resultados</h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Coluna Configuração */}
          <div className="md:col-span-1 space-y-6">
            <Card className={cn(cardStyle, "p-4")}>
               <CardHeader className="p-0 pb-4 mb-4 border-b border-[#1E90FF]/20"> <CardTitle className="text-xl font-semibold text-white" style={{ textShadow: `0 0 6px ${neonColor}` }}> Configurar Projeção </CardTitle> </CardHeader>
               <CardContent className="p-0 space-y-4">
                   {/* Select Campanha */}
                   <div className="space-y-1.5"> <TooltipLabel label="Campanha Base" tooltipKey="campaignBase" tooltipText={tooltips.campaignBase}/>
                   {/* >>> CORREÇÃO AQUI: usa isLoadingCampaigns e conserta o tipo do onValueChange <<< */}
                   <Select 
                     value={selectedCampaignId} 
                     onValueChange={(value: string) => setSelectedCampaignId(value)} 
                     disabled={isLoadingCampaigns || isCalculating || isLoadingMetrics}
                   > 
                     <SelectTrigger id="campaign_select_proj" className={cn(neumorphicInputStyle, "w-full h-9 px-3 py-2 text-sm")}> 
                       <SelectValue placeholder={isLoadingCampaigns ? "Carregando..." : "Selecione..."} /> 
                     </SelectTrigger> 
                     <SelectContent className="bg-[#141414] border-[#1E90FF]/50 text-white shadow-[0_4px_10px_rgba(0,0,0,0.5)]"> 
                       {isLoadingCampaigns ? (
                         <SelectItem value="loading" disabled>
                           <div className='flex items-center'>
                             <Loader2 className="h-3 w-3 animate-spin mr-2" />Carregando...
                           </div>
                         </SelectItem>
                       ) : ( 
                         campaignOptions.length === 0 ? 
                           <SelectItem value="" disabled>Nenhuma campanha</SelectItem> : 
                           campaignOptions.map(campaign => ( 
                             <SelectItem 
                               key={campaign.id} 
                               value={String(campaign.id)} 
                               className="hover:bg-[#1E90FF]/20 focus:bg-[#1E90FF]/30 text-sm"
                             > 
                               {campaign.name} 
                             </SelectItem> 
                           ))
                       )} 
                     </SelectContent> 
                   </Select>
                   </div>
                   {/* Métricas Atuais */}
                   <div className="space-y-1"> <TooltipLabel label="Métricas Atuais (Base)" tooltipKey="metricsBase" tooltipText={tooltips.metricsBase}/> <div className={cn(cardStyle, "bg-[#101010]/50 p-3 space-y-1 text-xs rounded-md")}> {isLoadingMetrics ? ( <div className="flex items-center justify-center py-2"><Loader2 className="h-4 w-4 animate-spin text-gray-400"/></div> ) : currentMetrics ? ( <> <p className="text-gray-400">CPL: <span className="font-medium text-white">R$ {currentMetrics.costPerLead.toFixed(2)}</span></p> <p className="text-gray-400">Conv. L→V: <span className="font-medium text-white">{currentMetrics.conversionRate.toFixed(1)}%</span></p> <p className="text-gray-400">Valor Venda: <span className="font-medium text-white">R$ {currentMetrics.averageSaleValue.toFixed(2)}</span></p> </> ) : ( <p className="text-gray-500 italic py-2 text-center">{selectedCampaignId ? 'Carregando...' : 'Selecione campanha.'}</p> )} </div> </div>
                   {/* Investimento Futuro */}
                   <div className="space-y-1.5"> <TooltipLabel label="Investimento Futuro (R$)" tooltipKey="futureInvestment" tooltipText={tooltips.futureInvestment}/> <Input id="future_investment" type="number" value={futureInvestment} onChange={(e) => setFutureInvestment(Math.max(0, parseFloat(e.target.value) || 0))} className={cn(neumorphicInputStyle, "w-full h-9 px-3 py-2 text-sm")} placeholder="Ex: 5000" disabled={isCalculating} min="0"/> </div>
                   {/* Período da Projeção */}
                   <div className="space-y-1.5"> <TooltipLabel label="Período (Dias)" tooltipKey="projectionPeriod" tooltipText={tooltips.projectionPeriod}/> <Input id="projection_period" type="number" value={projectionPeriod} onChange={(e) => setProjectionPeriod(Math.max(1, parseInt(e.target.value) || 1))} className={cn(neumorphicInputStyle, "w-full h-9 px-3 py-2 text-sm")} placeholder="Ex: 30" min="1" disabled={isCalculating}/> </div>
                   {/* Botão Calcular */}
                   <Button onClick={calculateProjection} disabled={isCalculating || isLoadingMetrics || !currentMetrics || !selectedCampaignId || futureInvestment <= 0} className={cn(primaryButtonStyle, "w-full mt-4 h-10 text-sm")}> {isCalculating ? ( <Loader2 className="mr-2 h-4 w-4 animate-spin" /> ) : ( <TrendingUp className="mr-2 h-4 w-4" /> )} Calcular Projeção </Button>
               </CardContent>
            </Card>
          </div>
          {/* Coluna de Resultados */}
          <div className="md:col-span-2">
             <Card className={cn(cardStyle, "p-4 min-h-[400px] flex flex-col")}>
                 <CardHeader className="p-0 pb-4 mb-4 border-b border-[#1E90FF]/20 flex-shrink-0">
                    <CardTitle className="text-xl font-semibold text-white" style={{ textShadow: `0 0 6px ${neonColor}` }}> Resultados Projetados </CardTitle>
                    <CardDescription className="text-gray-400 text-sm" style={{ textShadow: `0 0 4px ${neonColorMuted}` }}>
                        Estimativas para {projectionPeriod} dia(s) baseadas em "{
                            // <<< CORREÇÃO: Usa campaignOptions AQUI >>>
                            campaignOptions.find(c => String(c.id) === selectedCampaignId)?.name || 'Campanha Selecionada'
                        }".
                     </CardDescription>
                 </CardHeader>
                 <CardContent className="p-0 flex-grow flex items-center justify-center"> {isCalculating ? ( <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin text-[#1E90FF]" /></div> ) : projectionData ? ( <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full"> {/* Cards de resultado */} <div className={cn(cardStyle, "bg-[#101010]/50 p-4 text-center rounded-md")}> <DollarSign className="mx-auto h-6 w-6 text-[#1E90FF] mb-2" style={{ filter: `drop-shadow(0 0 4px ${neonColor})` }} /> <p className="text-xs text-gray-400 uppercase tracking-wider">Investimento</p> <p className="text-xl font-bold text-white">R$ {projectionData.futureInvestment.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p> </div> <div className={cn(cardStyle, "bg-[#101010]/50 p-4 text-center rounded-md")}> <Users className="mx-auto h-6 w-6 text-[#1E90FF] mb-2" style={{ filter: `drop-shadow(0 0 4px ${neonColor})` }} /> <p className="text-xs text-gray-400 uppercase tracking-wider">Leads Esperados</p> <p className="text-xl font-bold text-white">{projectionData.expectedLeads.toLocaleString('pt-BR')}</p> </div> <div className={cn(cardStyle, "bg-[#101010]/50 p-4 text-center rounded-md")}> <Target className="mx-auto h-6 w-6 text-[#1E90FF] mb-2" style={{ filter: `drop-shadow(0 0 4px ${neonColor})` }} /> <p className="text-xs text-gray-400 uppercase tracking-wider">Vendas Esperadas</p> <p className="text-xl font-bold text-white">{projectionData.expectedSales.toLocaleString('pt-BR')}</p> </div> <div className={cn(cardStyle, "bg-[#101010]/50 p-4 text-center rounded-md")}> <TrendingUp className="mx-auto h-6 w-6 text-[#1E90FF] mb-2" style={{ filter: `drop-shadow(0 0 4px ${neonColor})` }} /> <p className="text-xs text-gray-400 uppercase tracking-wider">Receita Esperada</p> <p className="text-xl font-bold text-white">R$ {projectionData.expectedRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p> </div> <div className={cn(cardStyle, "bg-[#101010]/50 p-4 text-center rounded-md")}> <DollarSign className="mx-auto h-6 w-6 text-[#1E90FF] mb-2" style={{ filter: `drop-shadow(0 0 4px ${neonColor})` }} /> <p className="text-xs text-gray-400 uppercase tracking-wider">Custo por Venda (CPA)</p> <p className="text-xl font-bold text-white">{isFinite(projectionData.cpaEstimate) ? `R$ ${projectionData.cpaEstimate.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : "N/A (0 Vendas)"}</p> </div> <div className={cn(cardStyle, "bg-[#101010]/50 p-4 text-center rounded-md")}> <TrendingUp className="mx-auto h-6 w-6 mb-2" style={{ filter: `drop-shadow(0 0 4px ${projectionData.expectedRoi >= 0 ? 'rgba(74, 222, 128, 0.6)' : 'rgba(248, 113, 113, 0.6)'})` }} /> <p className="text-xs text-gray-400 uppercase tracking-wider">ROI Esperado</p> <p className={cn("text-xl font-bold", projectionData.expectedRoi >= 0 ? "text-green-400" : "text-red-400")}>{isFinite(projectionData.expectedRoi) ? `${projectionData.expectedRoi.toLocaleString('pt-BR')}%` : "+Inf"}</p> </div> </div> ) : ( <div className="text-center py-10"> <AlertCircle className="mx-auto h-8 w-8 text-gray-500 mb-3" /> <p className="text-gray-400">Configure os parâmetros e clique em "Calcular Projeção".</p> {!selectedCampaignId && <p className="text-sm text-yellow-500 mt-2">Selecione uma campanha base.</p>} {!currentMetrics && selectedCampaignId && !isLoadingMetrics && <p className="text-sm text-yellow-500 mt-2">Métricas não disponíveis.</p>} </div> )} </CardContent>
             </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}
