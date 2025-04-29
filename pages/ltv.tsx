// pages/ltv.tsx
import React, { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/router';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, DollarSign, Repeat, CalendarDays, TrendingUp, HelpCircle } from 'lucide-react';
import Layout from '@/components/layout';
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";
// Ajuste: Importar de forma explícita se houver ambiguidade
import type { Campaign as CampaignType } from '@/entities/Campaign';
import axios from 'axios';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// Tipo apenas para o Select
type CampaignOption = Pick<CampaignType, 'id' | 'name'>;

// Tipo CampaignType PRECISA incluir os campos opcionais
interface ExtendedCampaign extends CampaignType {
    avgTicket?: number | null;
    purchaseFrequency?: number | null;
    customerLifespan?: number | null;
}

// --- Tooltip Label Component (CORRIGIDO) ---
const TooltipLabel = ({ label, tooltipKey, tooltipText }: { label: string, tooltipKey: string, tooltipText?: string }) => (
    <TooltipProvider>
        <Tooltip delayDuration={150}>
            <TooltipTrigger asChild> {/* <<< asChild PRESENTE */}
                <span className="flex items-center justify-start text-left cursor-help w-full"> {/* <<< span ÚNICO filho */}
                    <Label htmlFor={tooltipKey} className={cn("text-sm text-gray-300 mr-1")} style={{ textShadow: `0 0 4px #2d62a3` }}>{label}</Label>
                    <HelpCircle className="h-3 w-3 text-gray-500 flex-shrink-0" />
                </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-xs bg-[#1e2128] border border-[#1E90FF]/30 text-white p-1.5 rounded shadow-lg">
                <p>{tooltipText || "Tooltip não definido"}</p>
            </TooltipContent>
        </Tooltip>
    </TooltipProvider>
);
const tooltips = {
  avgTicket: 'Valor médio de CADA compra realizada pelo cliente.',
  purchaseFrequency: 'Quantas vezes, em média, um cliente compra por MÊS.',
  customerLifespan: 'Tempo médio (em MESES) que um cliente permanece ativo e comprando.',
  ltv: 'Valor Total estimado que um cliente gera durante seu ciclo de vida com a empresa.'
};

export default function LTVPage() {
  // --- Autenticação e Roteamento ---
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const router = useRouter();

  // --- Estados ---
  const [campaignOptions, setCampaignOptions] = useState<CampaignOption[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("manual");
  const [campaignsLoading, setCampaignsLoading] = useState<boolean>(true);
  const [avgTicket, setAvgTicket] = useState<number>(100);
  const [purchaseFrequency, setPurchaseFrequency] = useState<number>(1.5);
  const [customerLifespan, setCustomerLifespan] = useState<number>(12);
  const [ltvResult, setLtvResult] = useState<number>(0);
  const [isLoadingDetails, setIsLoadingDetails] = useState<boolean>(false);
  const { toast } = useToast();

  // --- Estilos ---
  const neonColor = '#1E90FF'; const neonColorMuted = '#4682B4'; const neonGreenColor = '#32CD32';
  const cardStyle = "bg-[#141414]/80 backdrop-blur-sm shadow-[5px_5px_10px_rgba(0,0,0,0.4),-5px_-5px_10px_rgba(255,255,255,0.05)] rounded-lg border-none";
  const neumorphicInputStyle = "bg-[#141414] text-white shadow-[inset_2px_2px_4px_rgba(0,0,0,0.3),inset_-2px_-2px_4px_rgba(255,255,255,0.05)] placeholder:text-gray-500 border-none focus:ring-2 focus:ring-[#1E90FF] focus:ring-offset-2 focus:ring-offset-[hsl(var(--background))] h-9";
  const labelStyle = "text-sm text-gray-300";
  const valueStyle = "font-semibold text-white text-3xl";
  const titleStyle = "text-base font-semibold text-white";

  // --- Lógica de Proteção de Rota ---
  useEffect(() => {
    if (!authLoading && !isAuthenticated) { console.log(`[Auth Guard /ltv] Redir.`); router.push('/login'); }
    if (!authLoading && isAuthenticated && campaignOptions.length === 0) { loadCampaignOptions(); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isAuthenticated, router]); // Removido campaignOptions daqui

  // --- Funções ---
  const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const loadCampaignOptions = useCallback(async () => {
    if (!isAuthenticated) return; // Segurança
    setCampaignsLoading(true);
    try { const response = await axios.get<CampaignOption[]>('/api/campaigns?fields=id,name'); setCampaignOptions(response.data || []); }
    catch (error: any) { console.error("Erro campanhas:", error); toast({ title: "Erro", description: "Falha.", variant: "destructive" }); }
    finally { setCampaignsLoading(false); }
  }, [toast, isAuthenticated]); // Adicionado isAuthenticated

  const calculateLTV = useCallback(() => { const ltv = (avgTicket || 0) * (purchaseFrequency || 0) * (customerLifespan || 0); setLtvResult(ltv); }, [avgTicket, purchaseFrequency, customerLifespan]);

  useEffect(() => { calculateLTV(); }, [calculateLTV]);

  useEffect(() => {
    const fetchAndUpdateInputs = async () => {
      if (!isAuthenticated || !selectedCampaignId || selectedCampaignId === "manual") return;
      setIsLoadingDetails(true);
      try {
        console.log(`[LTV] Buscando campanha ID: ${selectedCampaignId}`);
        // Usar a interface estendida para garantir que o tipo esperado tenha os campos
        const response = await axios.get<ExtendedCampaign>(`/api/campaigns?id=${selectedCampaignId}`);
        const selected = response.data;
        if (selected) {
           // Usar valores padrão se os da API forem null ou undefined
           setAvgTicket(Number(selected.avgTicket ?? 100));
           setPurchaseFrequency(Number(selected.purchaseFrequency ?? 1.5));
           setCustomerLifespan(Number(selected.customerLifespan ?? 12));
           console.log('[LTV] Inputs atualizados:', selected);
        } else {
            console.warn(`[LTV] Campanha ${selectedCampaignId} não encontrada.`);
            toast({title: "Aviso", description: "Dados não encontrados.", variant: "default"});
             setSelectedCampaignId("manual"); setAvgTicket(100); setPurchaseFrequency(1.5); setCustomerLifespan(12);
        }
      } catch (error) {
         console.error(`[LTV] Erro ao buscar campanha ${selectedCampaignId}:`, error);
         toast({title: "Erro", description: "Falha.", variant: "destructive"});
         setSelectedCampaignId("manual"); setAvgTicket(100); setPurchaseFrequency(1.5); setCustomerLifespan(12);
      } finally { setIsLoadingDetails(false); }
    };
    fetchAndUpdateInputs();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCampaignId, toast, isAuthenticated]); // Removido set* dos inputs das deps

  const handleNumericInputChange = (setter: React.Dispatch<React.SetStateAction<number>>) => (e: React.ChangeEvent<HTMLInputElement>) => {
     const value = e.target.value.replace(',', '.'); const numValue = parseFloat(value);
     if (value === "" || value === "-") { setter(0); }
     else if (!isNaN(numValue)) { setter(Math.max(0, numValue)); }
     // Reseta para manual SE o valor foi alterado enquanto uma campanha estava selecionada
     if (selectedCampaignId !== "manual") {
         // Comparar com valor anterior poderia ser mais robusto, mas isso funciona
          console.log("[LTV] Input manual detectado, resetando para -- Manual --");
          setSelectedCampaignId("manual");
     }
  };

  // --- Renderização Condicional (Auth) ---
  if (authLoading) { return ( <Layout><div className="flex h-[calc(100vh-100px)] w-full items-center justify-center"> <Loader2 className="h-8 w-8 animate-spin text-primary" /><span className="ml-3 text-muted-foreground">Verificando...</span> </div></Layout> ); }
  if (!isAuthenticated) { return null; }

  // --- Renderização Principal ---
  return (
    <Layout>
      <Head><title>LTV - USBMKT</title></Head>
      <h1 className="text-2xl font-black text-white mb-6" style={{ textShadow: `0 0 8px ${neonColor}` }}> Calculadora de LTV (Lifetime Value) </h1>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna Inputs */}
        <div className="lg:col-span-1 space-y-4">
           <Card className={cn(cardStyle)}>
             <CardHeader className="pt-3 pb-2"><CardTitle className={cn(titleStyle)} style={{ textShadow: `0 0 5px ${neonColor}` }}>Campanha (Opcional)</CardTitle></CardHeader>
             <CardContent className="p-3">
               <Label htmlFor="campaign-select-ltv" className={cn(labelStyle, "mb-1 block")} style={{ textShadow: `0 0 4px ${neonColor}` }}>Carregar dados</Label>
               <Select value={selectedCampaignId} onValueChange={setSelectedCampaignId} disabled={campaignsLoading || isLoadingDetails}>
                  {/* SelectTrigger usa SelectValue, OK */}
                  <SelectTrigger id="campaign-select-ltv" className={cn(neumorphicInputStyle, "w-full h-9")}> <SelectValue placeholder="Manual ou Selecione..." /> </SelectTrigger>
                  <SelectContent className="bg-[#1e2128] border-[#1E90FF]/30 text-white">
                    <SelectItem value="manual" className="hover:bg-[#1E90FF]/20 focus:bg-[#1E90FF]/20">-- Manual --</SelectItem>
                    {campaignsLoading ? (<SelectItem value="loading" disabled>...</SelectItem>)
                     : ( campaignOptions.map((campaign) => ( <SelectItem key={campaign.id} value={String(campaign.id)} className="hover:bg-[#1E90FF]/20 focus:bg-[#1E90FF]/20"> {campaign.name} </SelectItem> )) )}
                    {!campaignsLoading && campaignOptions.length === 0 && (<SelectItem value="no-camp" disabled>Nenhuma</SelectItem>)}
                  </SelectContent>
                </Select>
             </CardContent>
           </Card>
           <Card className={cn(cardStyle)}>
             <CardHeader className="pt-3 pb-2"><CardTitle className={cn(titleStyle)} style={{ textShadow: `0 0 5px ${neonColor}` }}>Variáveis LTV</CardTitle></CardHeader>
             <CardContent className="space-y-3 p-3 relative">
                {isLoadingDetails && (<div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10 rounded-lg"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>)}
                <div className="space-y-1">
                    {/* TooltipLabel já foi corrigido */}
                    <TooltipLabel label="Ticket Médio Compra (R$)" tooltipKey="avgTicket" tooltipText={tooltips.avgTicket}/>
                    <div className="flex items-center gap-1"> <DollarSign className="h-4 w-4 text-gray-400 shrink-0" /> <Input id="avgTicket" type="text" inputMode='decimal' value={avgTicket} onChange={handleNumericInputChange(setAvgTicket)} min="0" step="10" className={cn(neumorphicInputStyle, "flex-grow")} disabled={isLoadingDetails}/> </div>
                </div>
                <div className="space-y-1">
                    <TooltipLabel label="Frequência Compra (por Mês)" tooltipKey="purchaseFrequency" tooltipText={tooltips.purchaseFrequency}/>
                    <div className="flex items-center gap-1"> <Repeat className="h-4 w-4 text-gray-400 shrink-0" /> <Input id="purchaseFrequency" type="text" inputMode='decimal' value={purchaseFrequency} onChange={handleNumericInputChange(setPurchaseFrequency)} min="0" step="0.1" className={cn(neumorphicInputStyle, "flex-grow")} disabled={isLoadingDetails}/> </div>
                </div>
                <div className="space-y-1">
                    <TooltipLabel label="Tempo de Vida (Meses)" tooltipKey="customerLifespan" tooltipText={tooltips.customerLifespan}/>
                    <div className="flex items-center gap-1"> <CalendarDays className="h-4 w-4 text-gray-400 shrink-0" /> <Input id="customerLifespan" type="text" inputMode='decimal' value={customerLifespan} onChange={handleNumericInputChange(setCustomerLifespan)} min="0" step="1" className={cn(neumorphicInputStyle, "flex-grow")} disabled={isLoadingDetails}/> </div>
                </div>
             </CardContent>
           </Card>
        </div>
        {/* Coluna Resultado */}
        <div className="lg:col-span-2 flex flex-col justify-center items-center">
           <Card className={cn(cardStyle, "w-full max-w-md")}>
             <CardHeader className="pt-4 pb-2 text-center"> <CardTitle className={cn(titleStyle, "text-xl")} style={{ textShadow: `0 0 6px ${neonColor}` }}> LTV Estimado </CardTitle> </CardHeader>
             <CardContent className="p-6 text-center">
                 <div className={cn(valueStyle, "mb-2")} style={{ textShadow: `0 0 10px ${neonGreenColor}, 0 0 15px ${neonGreenColor}` }}> {formatCurrency(ltvResult)} </div>
                 <p className={cn(labelStyle, "text-xs")}> (Ticket Médio × Freq. Mensal × Meses Vida) </p>
             </CardContent>
           </Card>
        </div>
      </div>
    </Layout>
  );
}
