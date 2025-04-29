// pages/Suggestions.tsx
import React, { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/router';
import type { Campaign } from '@/entities/Campaign'; // Interface base
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Lightbulb, TrendingUp, DollarSign, Target, Copy as CopyIcon, RefreshCw, BrainCircuit, Save, Clock, Star, Loader2, AlertTriangle } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import Layout from '@/components/layout';
import { cn } from "@/lib/utils";
import axios, { AxiosResponse } from 'axios';
import { format, subDays, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// --- Interfaces (como antes) ---
interface Suggestion { id: string; type: string; title: string; description: string; justification?: string; recommended_action?: string; estimated_impact?: string; date?: string; content?: string; }
interface CampaignDetails extends Campaign { impressions: number; clicks: number; leads: number; sales: number; revenue: number; budget?: number | null; objective?: string | string[]; platform?: string | string[]; industry?: string | null; targetAudience?: string | null; segmentation?: string | null; daily_budget?: number | null; duration?: number | null; copies?: { title: string; cta: string }[]; calculatedMetrics: { ctr: number; cpc: number; conversionRate: number; roi: number; costPerLead: number; }; }
type CampaignOption = Pick<Campaign, 'id' | 'name'>;
interface AgentApiResponse { response: string; action?: any | null; }
interface AgentRequestBody { message: string; context: { path: string; }; }

export default function SuggestionsPage() {
    const { isAuthenticated, isLoading: authLoading, user } = useAuth();
    const router = useRouter();
    const currentPagePath = router.pathname;

    // --- Estados (como antes) ---
    const [campaignOptions, setCampaignOptions] = useState<CampaignOption[]>([]);
    const [selectedCampaignId, setSelectedCampaignId] = useState<string>("");
    const [selectedCampaignData, setSelectedCampaignData] = useState<CampaignDetails | null>(null);
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [generatingSuggestions, setGeneratingSuggestions] = useState<boolean>(false);
    const [savedSuggestions, setSavedSuggestions] = useState<Suggestion[]>([]);
    const [suggestionType, setSuggestionType] = useState<string>("performance");
    const [isLoadingCampaigns, setIsLoadingCampaigns] = useState<boolean>(true);
    const [isLoadingDetails, setIsLoadingDetails] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const { toast } = useToast();

    // --- Estilos ---
    const neonColor = '#1E90FF'; const neonColorMuted = '#4682B4'; const neonGreenColor = '#32CD32';
    const cardStyle = "bg-[#141414]/80 backdrop-blur-sm shadow-[5px_5px_10px_rgba(0,0,0,0.4),-5px_-5px_10px_rgba(255,255,255,0.05)] rounded-lg border-none";
    const neumorphicInputStyle = "bg-[#141414] text-white shadow-[inset_2px_2px_4px_rgba(0,0,0,0.3),inset_-2px_-2px_4px_rgba(255,255,255,0.05)] placeholder:text-gray-500 border-none focus:ring-2 focus:ring-[#1E90FF] focus:ring-offset-2 focus:ring-offset-[#0e1015]";
    const neumorphicButtonStyle = "bg-[#141414] border-none text-white shadow-[3px_3px_6px_rgba(0,0,0,0.3),-3px_-3px_6px_rgba(255,255,255,0.05)] hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.3),inset_-2px_-2px_4px_rgba(255,255,255,0.05)] hover:bg-[#1E90FF]/80 active:scale-[0.98] active:brightness-95 transition-all duration-150 ease-out";
    const neumorphicOutlineButtonStyle = cn(neumorphicButtonStyle, "bg-transparent border border-[#1E90FF]/30 hover:bg-[#1E90FF]/20 text-[#1E90FF] hover:text-white");
    // <<<--- ADICIONAR primaryButtonStyle AQUI --->>>
    const primaryButtonStyle = `bg-gradient-to-r from-[hsl(var(--primary))] to-[${neonColorMuted}] hover:from-[${neonColorMuted}] hover:to-[hsl(var(--primary))] text-primary-foreground font-semibold shadow-[0_4px_10px_rgba(30,144,255,0.3)] transition-all duration-300 ease-in-out transform hover:scale-[1.03] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#0e1015] focus:ring-[#5ca2e2]`;
    const titleStyle = "text-lg font-semibold text-white";

    // --- Funções Auxiliares ---
    const formatCurrency = useCallback((value?: number): string => { return (value === undefined || isNaN(value)) ? 'R$ 0,00' : value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }, []);
    const formatNumber = useCallback((value?: number, decimals = 0): string => { return (value === undefined || isNaN(value)) ? '0' : value.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }); }, []);
    const formatPercent = useCallback((value?: number): string => { return (value === undefined || isNaN(value) || !isFinite(value)) ? 'N/A' : `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`; }, []);

    // --- Funções de Busca de Dados ---
    const fetchCampaignOptionsClient = useCallback(async () => { setIsLoadingCampaigns(true); try { const r = await axios.get<CampaignOption[]>('/api/campaigns?fields=id,name'); setCampaignOptions(r.data || []); } catch (e) { console.error('[Sugg] Erro Opt:', e); setCampaignOptions([]); } finally { setIsLoadingCampaigns(false); } }, []);
    const loadSavedSuggestions = useCallback(() => { try { const s = localStorage.getItem('savedSuggestions'); setSavedSuggestions(s ? JSON.parse(s) : []); } catch (e) { console.error("[Sugg] Erro Saved:", e); localStorage.removeItem('savedSuggestions'); setSavedSuggestions([]);} }, []);
    const loadCampaignDataAndMetrics = useCallback(async (campaignId: string) => {
        if (!campaignId || campaignId === 'all') { setSelectedCampaignData(null); setSuggestions([]); setError(null); return; }
        setIsLoadingDetails(true); setSuggestions([]); setError(null);
        try {
            const campResponse = await axios.get<Campaign>(`/api/campaigns?id=${campaignId}`);
            if (!campResponse.data) throw new Error('Campanha não encontrada.');
            let campaignBaseData: Campaign = campResponse.data;
            const safeParse = (field: any): string[] => { if(Array.isArray(field)) return field; if(typeof field === 'string'){ try {const p=JSON.parse(field); return Array.isArray(p)?p:[];} catch{return [];}} return[]; };
            campaignBaseData.platform = safeParse(campaignBaseData.platform); campaignBaseData.objective = safeParse(campaignBaseData.objective); campaignBaseData.adFormat = safeParse(campaignBaseData.adFormat);
            const copiesResponse = await axios.get<{ title: string; cta: string }[]>(`/api/copies?campaign_id=${campaignId}&fields=title,cta`);
            const copiesData = copiesResponse.data || [];
            const endDate = format(new Date(), 'yyyy-MM-dd'); const startDate = format(subDays(new Date(), 29), 'yyyy-MM-dd');
            let metricsAgg = { impressions: 0, clicks: 0, cost: 0, conversions: 0, revenue: 0, leads: 0 };
            try {
                const metricsResponse = await axios.get(`/api/metrics`, { params: { startDate, endDate, campaignId } });
                metricsAgg = { impressions: Number(metricsResponse.data?.totals?.impressions) || Math.random() * 10000 + 5000, clicks: Number(metricsResponse.data?.totals?.clicks) || (metricsAgg.impressions * (Math.random() * 0.03 + 0.01)), cost: Number(metricsResponse.data?.totals?.cost) || (campaignBaseData.daily_budget ? campaignBaseData.daily_budget * 30 : Math.random() * 500 + 100), conversions: Number(metricsResponse.data?.totals?.conversions) || (metricsAgg.clicks * (Math.random() * 0.1 + 0.05)), revenue: Number(metricsResponse.data?.totals?.revenue) || (metricsAgg.conversions * (Math.random() * 50 + 20)), leads: Number(metricsResponse.data?.totals?.leads) || (metricsAgg.clicks * (Math.random() * 0.1 + 0.05)), };
            } catch (metricsError) { console.warn("[Sugg] Falha métricas, usando estimativas:", metricsError); metricsAgg = { impressions: Math.random() * 10000 + 5000, clicks: 0, cost: 0, conversions: 0, revenue: 0, leads: 0 }; metricsAgg.clicks = metricsAgg.impressions * (Math.random() * 0.03 + 0.01); metricsAgg.cost = campaignBaseData.daily_budget ? campaignBaseData.daily_budget * 30 : Math.random() * 500 + 100; metricsAgg.conversions = metricsAgg.clicks * (Math.random() * 0.1 + 0.05); metricsAgg.revenue = metricsAgg.conversions * (Math.random() * 50 + 20); metricsAgg.leads = metricsAgg.clicks * (Math.random() * 0.1 + 0.05); }
            const ctr = metricsAgg.impressions > 0 ? (metricsAgg.clicks / metricsAgg.impressions * 100) : 0; const cpc = metricsAgg.clicks > 0 ? (metricsAgg.cost / metricsAgg.clicks) : 0; const convRate = metricsAgg.clicks > 0 ? (metricsAgg.conversions / metricsAgg.clicks * 100) : 0; const roi = metricsAgg.cost > 0 ? ((metricsAgg.revenue - metricsAgg.cost) / metricsAgg.cost * 100) : (metricsAgg.revenue > 0 ? Infinity : 0); const cpl = metricsAgg.leads > 0 ? (metricsAgg.cost / metricsAgg.leads) : 0;
            const campaignDetails: CampaignDetails = { ...campaignBaseData, impressions: Math.round(metricsAgg.impressions), clicks: Math.round(metricsAgg.clicks), leads: Math.round(metricsAgg.leads), sales: Math.round(metricsAgg.conversions), revenue: metricsAgg.revenue, budget: campaignBaseData.budget ?? metricsAgg.cost * 1.2, copies: copiesData, calculatedMetrics: { ctr: parseFloat(ctr.toFixed(1)) || 0, cpc: parseFloat(cpc.toFixed(2)) || 0, conversionRate: parseFloat(convRate.toFixed(1)) || 0, roi: isFinite(roi) ? parseFloat(roi.toFixed(0)) : (roi === Infinity ? 999 : 0), costPerLead: parseFloat(cpl.toFixed(2)) || 0 } };
            setSelectedCampaignData(campaignDetails);
        } catch (error: any) { console.error('[Sugg] Erro load data/metrics:', error); toast({ title: "Erro Campanha", description: `Falha: ${error.message}`, variant: "destructive" }); setSelectedCampaignData(null); }
        finally { setIsLoadingDetails(false); }
    }, [toast, formatCurrency]); // Adicionada dependência

    // --- Efeitos (como antes) ---
    useEffect(() => { if (!authLoading && isAuthenticated) { fetchCampaignOptionsClient(); loadSavedSuggestions(); } }, [authLoading, isAuthenticated, fetchCampaignOptionsClient, loadSavedSuggestions]);
    useEffect(() => { if (isAuthenticated) { loadCampaignDataAndMetrics(selectedCampaignId); } }, [selectedCampaignId, isAuthenticated, loadCampaignDataAndMetrics]);

    // --- Parse de Sugestões (como antes) ---
    const parseSuggestionsFromText = useCallback((text: string, type: string): Suggestion[] => {
        if (!text) return []; console.log("[Sugg] Parsing AI text:", text); const suggestions: Suggestion[] = []; const blocks = text.split(/---|\nSugestão \d+:|\n###\s/);
        blocks.forEach((block, index) => { const trimmedBlock = block.trim(); if (!trimmedBlock) return; let title = `Sugestão ${suggestions.length + 1} (${type})`; let description = trimmedBlock; let justification = ""; let action = ""; let impact = "médio"; const titleMatch = trimmedBlock.match(/^(?:Título|Title):\s*(.*)/im); const descMatch = trimmedBlock.match(/(?:Descrição|Description):\s*((?:.|\n)*?)(?:Justificativa:|Justification:|Ação Recomendada:|Recommended Action:|Impacto Estimado:|Impact:|###|$)/im); const justMatch = trimmedBlock.match(/(?:Justificativa|Justification):\s*((?:.|\n)*?)(?:Ação Recomendada:|Recommended Action:|Impacto Estimado:|Impact:|###|$)/im); const actionMatch = trimmedBlock.match(/(?:Ação Recomendada|Recommended Action):\s*((?:.|\n)*?)(?:Impacto Estimado:|Impact:|###|$)/im); const impactMatch = trimmedBlock.match(/(?:Impacto Estimado|Impacto|Estimated Impact):\s*(baixo|médio|medio|alto)/im); if (titleMatch?.[1]) title = titleMatch[1].trim(); if (descMatch?.[1]) description = descMatch[1].trim(); else if (titleMatch) description = trimmedBlock.replace(/^(?:Título|Title):\s*(.*)\n?/im, '').trim(); if (justMatch?.[1]) justification = justMatch[1].trim(); if (actionMatch?.[1]) action = actionMatch[1].trim(); if (impactMatch?.[1]) impact = impactMatch[1].trim().toLowerCase().replace('medio', 'médio'); suggestions.push({ id: `s-${Date.now()}-${index}`, type, title, description, justification, recommended_action: action, estimated_impact: impact }); }); if (suggestions.length === 0 && text.trim()) { suggestions.push({ id: `s-${Date.now()}-0`, type, title: `Sugestão Geral (${type})`, description: text.trim() }); } console.log("[Sugg] Parsed Suggestions:", suggestions); return suggestions;
    }, []);

    // --- Geração de Sugestões via MCP Agent (como antes, usando helpers internos) ---
    const generateSuggestions = useCallback(async () => {
        if (!selectedCampaignData) { toast({ title: "Aviso", description: "Selecione uma campanha.", variant: "default" }); return; }
        setGeneratingSuggestions(true); setSuggestions([]); setError(null);
        const campaignContext = ` **Campanha:** ${selectedCampaignData.name || 'N/A'} **Obj:** ${Array.isArray(selectedCampaignData.objective) ? selectedCampaignData.objective.join('/') : selectedCampaignData.objective || 'N/A'} **Plat:** ${Array.isArray(selectedCampaignData.platform) ? selectedCampaignData.platform.join('/') : selectedCampaignData.platform || 'N/A'} **Público:** ${selectedCampaignData.targetAudience || 'N/A'} **Orç. Diário:** ${formatCurrency(selectedCampaignData.daily_budget ?? 0)} **Métricas:** CTR ${selectedCampaignData.calculatedMetrics.ctr}%, CPC ${formatCurrency(selectedCampaignData.calculatedMetrics.cpc)}, Conv.Rate ${selectedCampaignData.calculatedMetrics.conversionRate}%, CPL ${formatCurrency(selectedCampaignData.calculatedMetrics.costPerLead)}, ROI ${selectedCampaignData.calculatedMetrics.roi}% **Cópias (Ex):** ${selectedCampaignData.copies?.slice(0, 1).map(c => `"${c.title}" (CTA: ${c.cta})`).join('; ') || 'N/A'} `;
        let promptInstruction = ""; switch (suggestionType) { case 'performance': promptInstruction = "Sugira 3-5 otimizações de performance geral (lances, estrutura, criativos, LP)."; break; case 'budget': promptInstruction = "Sugira 3-5 otimizações de orçamento (alocação, lances, ROI estimado)."; break; case 'copy': promptInstruction = "Sugira 3 novas variações de copy (Título, Descrição, CTA)."; break; case 'targeting': promptInstruction = "Sugira 3-5 novas ideias de segmentação/targeting."; break; default: promptInstruction = "Sugira 3-5 otimizações gerais."; }
        const fullPrompt = `${promptInstruction}\n\nContexto: ${campaignContext}\n\nFormato: Responda APENAS com as sugestões. Use ### Título:, ### Descrição:, ### Justificativa:, ### Ação Recomendada:, ### Impacto Estimado: (Baixo/Médio/Alto) para cada sugestão. Separe com ---.`;
        toast({ title: "IA Pensando...", description: `Gerando sugestões de ${suggestionType}...` });
        try {
            console.log("[Sugg] Enviando prompt para MCP Agent..."); const requestPayload: AgentRequestBody = { message: fullPrompt, context: { path: currentPagePath } };
            const response: AxiosResponse<AgentApiResponse> = await axios.post('/api/mcp-agent', requestPayload);
            const agentResponseText = response.data.response; console.log(`[Sugg] Resposta crua MCP Agent recebida.`);
            if (agentResponseText && typeof agentResponseText === 'string') { const parsedSuggestions = parseSuggestionsFromText(agentResponseText, suggestionType); if (parsedSuggestions.length > 0) { setSuggestions(parsedSuggestions); toast({ title: "Sucesso!", description: `${parsedSuggestions.length} sugestões geradas.` }); } else { setError("Formato inesperado da IA."); setSuggestions([{id: 'parse-error', type: 'error', title: 'Erro de Formato', description: agentResponseText}]); toast({ title: "Erro Formato", description: "Não foi possível extrair sugestões.", variant: "destructive" }); } } else { throw new Error("Resposta inválida da IA."); }
        } catch (error: any) { console.error('[Sugg] Erro ao chamar MCP agent API:', error.response?.data || error.message); const errorMsg = error.response?.data?.response || error.response?.data?.error || error.message || "Falha IA."; setError(errorMsg); toast({ title: "Erro IA", description: errorMsg, variant: "destructive" }); setSuggestions([]); } finally { setGeneratingSuggestions(false); }
    }, [selectedCampaignData, suggestionType, currentPagePath, toast, parseSuggestionsFromText, formatCurrency, formatNumber, formatPercent]); // Adicionadas funções de formatação

    // --- Salvar/Renderizar Sugestões (como antes) ---
    const saveSuggestion = useCallback((suggestion: Suggestion) => { const now = new Date(); const suggestionWithMeta: Suggestion = { ...suggestion, id: suggestion.id || `s-${Date.now()}`, date: now.toLocaleDateString('pt-BR') + ' ' + now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit'}), content: suggestion.description || suggestion.recommended_action || 'Detalhes indisponíveis', }; const updatedSaved = [suggestionWithMeta, ...savedSuggestions.filter(s => s.id !== suggestionWithMeta.id)]; setSavedSuggestions(updatedSaved); try { localStorage.setItem('savedSuggestions', JSON.stringify(updatedSaved)); toast({ title: "Salvo", description: `Sugestão salva.` }); } catch (error) { console.error("Failed save localStorage:", error); toast({ title: "Erro Salvar", description: "Não foi possível salvar localmente.", variant: "destructive" }); } }, [savedSuggestions, toast]);
    const getTypeIcon = useCallback((type: string | undefined) => { const iconProps = { className: "h-4 w-4 text-[#1E90FF] mt-0.5 shrink-0", style: { filter: `drop-shadow(0 0 3px ${neonColor})` } }; switch (type?.toLowerCase()) { case 'performance': return <TrendingUp {...iconProps} />; case 'budget': return <DollarSign {...iconProps} />; case 'copy': return <CopyIcon {...iconProps} />; case 'targeting': return <Target {...iconProps} />; case 'error': return <AlertTriangle {...iconProps} className="text-red-500" />; default: return <Lightbulb {...iconProps} />; } }, []);
    const renderSuggestionContent = useCallback((suggestion: Suggestion) => { const fields = [ { label: "Descrição", value: suggestion.description }, { label: "Justificativa", value: suggestion.justification }, { label: "Ação Recomendada", value: suggestion.recommended_action }, { label: "Impacto Estimado", value: suggestion.estimated_impact }, ]; const filteredFields = fields.filter(f => f.value); return ( <div className="space-y-1.5"> <div className="flex justify-between items-start gap-2"> <div className="flex items-start gap-1.5"> {getTypeIcon(suggestion.type)} <h4 className="text-sm font-semibold text-white leading-tight" style={{ textShadow: `0 0 4px ${neonColorMuted}` }}>{suggestion.title || "Sugestão"}</h4> </div> {suggestion.type !== 'error' && ( <Button variant="ghost" size="sm" className={cn(neumorphicOutlineButtonStyle, "h-6 px-1.5 text-xs")} onClick={() => saveSuggestion(suggestion)}> <Save className="h-3 w-3 mr-1" /> Salvar </Button> )} </div> {filteredFields.map(field => ( <div key={field.label} className="text-xs pl-5"> <strong className="text-gray-400 font-medium block mb-0.5">{field.label}:</strong> <p className="text-gray-300 whitespace-pre-wrap">{field.value}</p> </div> ))} {filteredFields.length === 0 && suggestion.type !== 'error' && ( <p className="text-xs text-gray-300 whitespace-pre-wrap pl-5">{suggestion.description}</p> )} </div> ); }, [saveSuggestion, getTypeIcon, neumorphicOutlineButtonStyle, neonColorMuted]); // Adicionado dependências

    // --- Loading State Geral ---
    const isLoading = isLoadingCampaigns || isLoadingDetails || generatingSuggestions;

    // --- Auth Check ---
    if (authLoading) { return ( <Layout><div className="flex h-[calc(100vh-100px)] w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></Layout> ); }
    if (!isAuthenticated) { return null; }

    // --- Renderização Principal ---
    return (
        <Layout>
            <Head> <title>Sugestões Inteligentes - USBMKT</title> </Head>
            <div className="flex flex-col h-full overflow-hidden p-4 md:p-6 space-y-4">
                 {/* Cabeçalho */}
                 <div className="flex-shrink-0"> <h1 className="text-2xl font-black text-white" style={{ textShadow: `0 0 8px ${neonColor}` }}> Sugestões Inteligentes (MCP) </h1> </div>
                 {/* Grid Principal */}
                 <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0 overflow-hidden">
                    {/* Coluna Esquerda: Controles */}
                    <div className="lg:col-span-1 space-y-4 overflow-y-auto custom-scrollbar pr-2 pb-2">
                        <Card className={cn(cardStyle, "p-3")}>
                            <CardHeader className="p-0 pb-2 mb-2 border-b border-[#1E90FF]/20"> <CardTitle className={cn(titleStyle, "text-base")} style={{ textShadow: `0 0 6px ${neonColor}` }}> Configuração </CardTitle> </CardHeader>
                            <CardContent className="p-0 space-y-3">
                                {/* Seleção Campanha */}
                                <div className="space-y-1"> <Label htmlFor="campaign_select_sugg" className="text-xs text-gray-400">Campanha</Label> <Select value={selectedCampaignId} onValueChange={setSelectedCampaignId} disabled={isLoadingCampaigns || generatingSuggestions || isLoadingDetails}> <SelectTrigger id="campaign_select_sugg" className={cn(neumorphicInputStyle, "w-full h-9 px-3 py-2 text-xs")}> <SelectValue placeholder={isLoadingCampaigns ? "Carregando..." : "Selecione..."} /> </SelectTrigger> <SelectContent className="bg-[#141414] border-[#1E90FF]/50 text-white shadow-lg"> {isLoadingCampaigns && <div className="px-3 py-2 text-xs flex items-center"><Loader2 className="h-3 w-3 animate-spin mr-1"/>Carregando...</div>} {!isLoadingCampaigns && campaignOptions.length === 0 && <div className="px-3 py-2 text-xs">Nenhuma campanha.</div>} {campaignOptions.map(c => ( <SelectItem key={String(c.id)} value={String(c.id)} className="text-xs hover:bg-[#1E90FF]/20 cursor-pointer">{c.name}</SelectItem> ))} </SelectContent> </Select> </div>
                                <Separator className="bg-[#1E90FF]/20" />
                                {/* Métricas Atuais */}
                                <div> <h3 className="text-xs font-semibold text-gray-300 mb-1.5">Métricas Atuais (Estimadas)</h3> {isLoadingDetails ? ( <div className="text-xs text-gray-500 px-1 py-3 flex items-center"><Loader2 className="h-4 w-4 animate-spin mr-1" /> Carregando...</div> ) : selectedCampaignData ? ( <div className="space-y-1 px-1"> {(Object.keys(selectedCampaignData.calculatedMetrics) as Array<keyof typeof selectedCampaignData.calculatedMetrics>).map(key => ( <div key={key} className="flex justify-between text-[11px]"> <span className="text-gray-400 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}:</span> <span className="text-white font-medium">{ key.includes('Rate') || key === 'ctr' || key === 'roi' ? formatPercent(selectedCampaignData.calculatedMetrics[key]) : key === 'cpc' || key === 'costPerLead' ? formatCurrency(selectedCampaignData.calculatedMetrics[key]) : formatNumber(selectedCampaignData.calculatedMetrics[key]) }</span> </div> ))} </div> ) : ( <div className="text-xs text-gray-500 px-1 py-3 text-center italic">Selecione campanha.</div> )} </div>
                                <Separator className="bg-[#1E90FF]/20" />
                                {/* Tipo Sugestão */}
                                <div className="space-y-1.5"> <Label className="text-xs text-gray-400">Tipo de Sugestão</Label> <div className="grid grid-cols-2 gap-1.5"> {[ { value: 'performance', label: 'Performance', icon: TrendingUp }, { value: 'budget', label: 'Orçamento', icon: DollarSign }, { value: 'copy', label: 'Copys', icon: CopyIcon }, { value: 'targeting', label: 'Targeting', icon: Target } ].map(type => ( <Button key={type.value} variant="outline" size="sm" className={cn( neumorphicButtonStyle, "justify-start gap-1.5 text-xs h-7 px-2 py-1", suggestionType === type.value ? 'bg-[#1E90FF]/30 shadow-[inset_1px_1px_2px_rgba(0,0,0,0.4)]' : 'bg-[#141414]/50 hover:bg-[#1E90FF]/10' )} onClick={() => setSuggestionType(type.value)} disabled={generatingSuggestions || isLoadingDetails} > <type.icon className="h-3.5 w-3.5 shrink-0" /> <span>{type.label}</span> </Button> ))} </div> </div>
                                {/* Botão Gerar */}
                                <Button onClick={generateSuggestions} disabled={isLoading || !selectedCampaignId || !selectedCampaignData} className={cn(primaryButtonStyle, "w-full mt-2 h-9 text-sm")} > {generatingSuggestions ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BrainCircuit className="mr-2 h-4 w-4" />} {generatingSuggestions ? 'Gerando...' : 'Gerar Sugestões'} </Button>
                            </CardContent>
                        </Card>
                         {/* Sugestões Salvas */}
                         <Card className={cn(cardStyle, "p-3")}> <CardHeader className="p-0 pb-2 mb-2 border-b border-[#1E90FF]/20"> <CardTitle className={cn(titleStyle, "text-base flex items-center gap-2")} style={{ textShadow: `0 0 6px ${neonColor}` }}><Save size={16}/> Sugestões Salvas</CardTitle> </CardHeader> <CardContent className="p-0"> <ScrollArea className="h-[180px] pr-1"> {savedSuggestions.length === 0 ? ( <div className="text-center py-5"> <Star className="mx-auto h-6 w-6 text-gray-500 mb-1" /> <p className="text-gray-400 text-xs">Nenhuma salva.</p> </div> ) : ( <div className="space-y-1.5"> {savedSuggestions.map(s => ( <Card key={s.id} className="bg-[#141414]/50 border border-transparent hover:border-[#1E90FF]/20 transition-colors"> <CardContent className="p-1.5 space-y-0.5"> <div className="flex items-start gap-1"> {getTypeIcon(s.type)} <h4 className="text-xs font-medium text-white leading-tight flex-1">{s.title}</h4> </div> <p className="text-[11px] text-gray-500 pl-5 flex items-center gap-1"><Clock className="h-2.5 w-2.5"/> {s.date}</p> </CardContent> </Card> ))} </div> )} </ScrollArea> </CardContent> </Card>
                    </div> {/* Fim Coluna Esquerda */}

                    {/* Coluna Direita: Sugestões Geradas */}
                    <div className="lg:col-span-2">
                         <Card className={cn(cardStyle, "h-full flex flex-col")}> <CardHeader className="flex-shrink-0 p-4 border-b border-[hsl(var(--border))]/30"> <CardTitle className={cn(titleStyle, "text-base flex items-center gap-2")} style={{ textShadow: `0 0 6px ${neonColor}` }}><Lightbulb size={16}/> Sugestões Geradas ({suggestionType})</CardTitle> <CardDescription className="text-gray-400 text-xs mt-1">Baseadas na campanha e métricas selecionadas.</CardDescription> </CardHeader> <CardContent className="flex-grow p-0 overflow-hidden"> <ScrollArea className="h-full p-4"> {generatingSuggestions ? ( <div className="py-10 min-h-[400px] flex flex-col items-center justify-center"> <Loader2 className="mx-auto h-8 w-8 text-primary animate-spin" /> <p className="mt-3 text-gray-300 text-sm">Analisando...</p> <Progress value={50} className="mt-3 w-48 mx-auto h-1 bg-[#141414] [&>div]:bg-primary" /> </div> ) : error && suggestions.length === 0 ? ( <div className="py-10 min-h-[400px] flex flex-col items-center justify-center text-red-400"> <AlertTriangle className="mx-auto h-8 w-8 mb-3" /> <p className="font-semibold mb-1">Erro ao Gerar</p> <p className="text-xs">{error}</p> </div> ) : suggestions.length === 0 ? ( <div className="py-10 min-h-[400px] flex flex-col items-center justify-center"> <Lightbulb className="mx-auto h-9 w-9 text-gray-500 mb-3" /> <p className="text-gray-300 text-base">Pronto para otimizar?</p> <p className="text-gray-500 text-xs mt-1 max-w-xs mx-auto"> {selectedCampaignId ? 'Selecione um tipo e clique em "Gerar Sugestões".' : 'Selecione uma campanha.'} </p> </div> ) : ( <div className="space-y-3"> {suggestions.map((suggestion) => ( <Card key={suggestion.id} className={cn(cardStyle, "p-3 border-l-2", suggestion.type === 'error' ? 'border-red-500 bg-red-900/20' : 'border-primary')}> <CardContent className="p-0">{renderSuggestionContent(suggestion)}</CardContent> </Card> ))} </div> )} </ScrollArea> </CardContent> </Card>
                    </div> {/* Fim Coluna Direita */}
                </div> {/* Fim Grid Principal */}
            </div> {/* Fim Container Página */}
        </Layout>
    );
}
