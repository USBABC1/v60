// pages/Campaign.tsx
import React, { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/router';
import Layout from '@/components/layout';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Campaign } from '@/entities/Campaign';
import axios from 'axios';
import { Trash2, Edit, PlusCircle, Loader2, ChevronUp, ChevronDown } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { MultiSelectPopover } from "@/components/ui/multi-select-popover";
import { ScrollArea } from "@/components/ui/scroll-area"; // Usado apenas na lista de campanhas agora

// --- Interfaces, Constantes, Estados, Estilos ---
interface FormDataState { name: string; industry?: string | null; targetAudience?: string | null; platform: string[]; objective: string[]; budget: string; daily_budget: string; segmentation?: string | null; adFormat: string[]; duration: string; cost_traffic: string; cost_creative: string; cost_operational: string; status?: string | null; startDate?: string | null; endDate?: string | null; }
const initialFormData: FormDataState = { name: '', industry: '', targetAudience: '', platform: [], objective: [], budget: '0', daily_budget: '0', segmentation: '', adFormat: [], duration: '0', cost_traffic: '0', cost_creative: '0', cost_operational: '0', status: 'draft', startDate: null, endDate: null };
interface FormFieldCardProps { children: React.ReactNode; className?: string; }
const FormFieldCard: React.FC<FormFieldCardProps> = ({ children, className }) => ( <Card className={cn( "bg-[#141414]/50", "shadow-[inset_1px_1px_2px_rgba(0,0,0,0.3),inset_-1px_-1px_2px_rgba(255,255,255,0.03)]", "rounded-md p-2", "border-none", "flex flex-col gap-1", className )}> {children} </Card> );
const platformOptions = [ { value: "google_ads", label: "Google Ads" }, { value: "meta_ads", label: "Meta Ads" }, { value: "tiktok_ads", label: "TikTok Ads" }, { value: "linkedin_ads", label: "LinkedIn Ads" }, { value: "other", label: "Outra" }, ];
const objectiveOptions = [ { value: "conversao", label: "Conversão" }, { value: "leads", label: "Leads" }, { value: "trafego", label: "Tráfego" }, { value: "reconhecimento", label: "Reconhecimento" }, { value: "vendas_catalogo", label: "Vendas Catálogo" }, ];
const adFormatOptions = [ { value: "imagem", label: "Imagem" }, { value: "video", label: "Vídeo" }, { value: "carrossel", label: "Carrossel" }, { value: "colecao", label: "Coleção" }, { value: "search", label: "Search" }, { value: "display", label: "Display" }, ];
const neonColor = '#1E90FF'; const neonColorMuted = '#4682B4'; const neonRedColor = '#FF4444';
const cardStyle = "bg-[#141414]/80 backdrop-blur-sm shadow-[5px_5px_10px_rgba(0,0,0,0.4),-5px_-5px_10px_rgba(255,255,255,0.05)] rounded-lg border-none";
const neumorphicInputStyle = "bg-[#141414] text-white shadow-[inset_2px_2px_4px_rgba(0,0,0,0.3),inset_-2px_-2px_4px_rgba(255,255,255,0.05)] placeholder:text-gray-500 border-none focus:ring-2 focus:ring-[#1E90FF] focus:ring-offset-2 focus:ring-offset-[#0e1015] h-9 text-sm px-3 py-2";
const neumorphicTextAreaStyle = cn(neumorphicInputStyle, "min-h-[80px] py-2");
const neumorphicButtonStyle = "bg-[#141414] border-none text-white shadow-[3px_3px_6px_rgba(0,0,0,0.3),-3px_-3px_6px_rgba(255,255,255,0.05)] hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.3),inset_-2px_-2px_4px_rgba(255,255,255,0.05)] hover:bg-[#1E90FF]/80 active:scale-[0.98] active:brightness-95 transition-all duration-150 ease-out h-9 px-3 text-sm";
const primaryNeumorphicButtonStyle = cn(neumorphicButtonStyle, "bg-[#1E90FF]/80 hover:bg-[#1E90FF]/100");
const stepperButtonStyle = cn( "bg-[#141414]/70 border-none text-white shadow-[2px_2px_4px_rgba(0,0,0,0.3),-2px_-2px_4px_rgba(255,255,255,0.05)]", "h-5 w-5 p-0 min-w-0 rounded", "hover:brightness-110 hover:bg-[#1E90FF]/20", "active:shadow-[inset_1px_1px_2px_rgba(0,0,0,0.3),inset_-1px_-1px_2px_rgba(255,255,255,0.03)] active:scale-[0.97] active:brightness-90", "text-blue-400 hover:text-blue-300", );
const labelStyle = "text-xs text-gray-300 mb-0.5";

export default function CampaignPage() {
  // Estados e Hooks
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [formData, setFormData] = useState<FormDataState>(initialFormData);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Funções
   const fetchCampaignsEffect = useCallback(async () => { setIsLoading(true); setError(null); try { const response = await axios.get<Campaign[]>('/api/campaigns',{headers:{'Cache-Control':'no-cache'}}); const fetchedCampaigns = (response.data || []).map((camp: any) => { const safeParse = (field: any): string[] => { if (Array.isArray(field)) return field; if (typeof field === 'string') { try { const p = JSON.parse(field); return Array.isArray(p) ? p : []; } catch { return []; } } return []; }; return { ...camp, platform: safeParse(camp.platform), objective: safeParse(camp.objective), adFormat: safeParse(camp.adFormat), }; }); setCampaigns(fetchedCampaigns); } catch (err: any) { const errorMsg = err.response?.data?.message || err.message || "Falha."; setError(errorMsg); toast({ title: "Erro", description: errorMsg, variant: "destructive" }); } finally { setIsLoading(false); } }, [toast]);
   const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => { const { name, value } = e.target; setFormData((prev) => ({ ...prev, [name]: value })); };
   const handleNumberInputChange = (e: React.ChangeEvent<HTMLInputElement>) => { const { name, value } = e.target; const regex = /^-?\d*\.?\d*$/; if (value === '' || value === '-' || regex.test(value)) { setFormData((prev) => ({ ...prev, [name]: value })); } };
   const handleMultiSelectChange = (name: keyof FormDataState) => (selectedValues: string[]) => { setFormData((prev) => ({ ...prev, [name]: selectedValues })); };
   const handleStepChange = (name: 'budget' | 'daily_budget' | 'duration' | 'cost_traffic' | 'cost_creative' | 'cost_operational', direction: 'up' | 'down') => { setFormData((prev) => { const currentValue = parseFloat(String(prev[name] || '0').replace(',','.')); const step = name === 'duration' ? 1 : 10; const precision = (name === 'duration') ? 0 : 2; let newValue = direction === 'up' ? currentValue + step : currentValue - step; newValue = Math.max(0, newValue); return { ...prev, [name]: newValue.toFixed(precision) }; }); };
   const handleSave = async (e: React.FormEvent) => { e.preventDefault(); setIsSaving(true); setError(null); if (!formData.name?.trim()) { const msg = "Nome."; setError(msg); setIsSaving(false); toast({ title: "Erro", description: msg, variant: "destructive" }); return; } const budgetValue = parseFloat(String(formData.budget || '0').replace(',', '.')); const dailyBudgetValue = parseFloat(String(formData.daily_budget || '0').replace(',', '.')); const durationValue = parseInt(String(formData.duration || '0').replace(/\D/g,''), 10); const costTrafficValue = parseFloat(String(formData.cost_traffic || '0').replace(',', '.')); const costCreativeValue = parseFloat(String(formData.cost_creative || '0').replace(',', '.')); const costOperationalValue = parseFloat(String(formData.cost_operational || '0').replace(',', '.')); if (isNaN(budgetValue) || isNaN(dailyBudgetValue) || isNaN(durationValue) || budgetValue < 0 || dailyBudgetValue < 0 || durationValue < 0 || isNaN(costTrafficValue) || isNaN(costCreativeValue) || isNaN(costOperationalValue) || costTrafficValue < 0 || costCreativeValue < 0 || costOperationalValue < 0) { const msg = "Nums inválidos."; setError(msg); setIsSaving(false); toast({ title: "Erro", description: msg, variant: "destructive" }); return; } const campaignData = { ...formData, name: formData.name.trim(), budget: budgetValue, daily_budget: dailyBudgetValue, duration: durationValue, cost_traffic: costTrafficValue, cost_creative: costCreativeValue, cost_operational: costOperationalValue, platform: formData.platform && formData.platform.length > 0 ? JSON.stringify(formData.platform) : null, objective: formData.objective && formData.objective.length > 0 ? JSON.stringify(formData.objective) : null, adFormat: formData.adFormat && formData.adFormat.length > 0 ? JSON.stringify(formData.adFormat) : null, }; console.log('[handleSave] Enviando (JSON):', JSON.stringify(campaignData, null, 2)); try { let response; if (selectedCampaign?.id) { response = await axios.put(`/api/campaigns?id=${selectedCampaign.id}`, campaignData); toast({ title: "Atualizada" }); } else { response = await axios.post('/api/campaigns', campaignData); toast({ title: "Criada" }); } console.log("[handleSave] Sucesso:", response.status); resetForm(); await fetchCampaignsEffect(); } catch (error: any) { console.error("[handleSave] ERRO Axios:", error); const errorMsg = error.response?.data?.message || error.response?.data?.error || error.message || "Falha."; setError(errorMsg); toast({ title: "Erro", description: errorMsg, variant: "destructive" }); } finally { setIsSaving(false); } };
   const handleEdit = (campaign: Campaign) => { console.log("[handleEdit]", campaign.id); setSelectedCampaign(campaign); const safeParse = (field: any): string[] => { if(Array.isArray(field)) return field; if(typeof field === 'string'){ try {const p=JSON.parse(field); return Array.isArray(p)?p:[];} catch{return [];}} return[]; }; setFormData({ name: campaign.name || '', industry: campaign.industry || '', targetAudience: campaign.targetAudience || '', platform: safeParse(campaign.platform), objective: safeParse(campaign.objective), budget: campaign.budget?.toString() ?? '0', daily_budget: campaign.daily_budget?.toString() ?? '0', segmentation: campaign.segmentation || '', adFormat: safeParse(campaign.adFormat), duration: campaign.duration?.toString() ?? '0', cost_traffic: campaign.cost_traffic?.toString() ?? '0', cost_creative: campaign.cost_creative?.toString() ?? '0', cost_operational: campaign.cost_operational?.toString() ?? '0', status: campaign.status, startDate: campaign.startDate, endDate: campaign.endDate, }); setError(null); };
   const handleDelete = async (id: string | number) => { if (!confirm(`Excluir ${id}?`)) return; setIsSaving(true); setError(null); try { await axios.delete(`/api/campaigns?id=${id}`); toast({ title: "Excluída" }); resetForm(); await fetchCampaignsEffect(); } catch (error: any) { const errorMsg = error.response?.data?.message || "Falha."; setError(errorMsg); toast({ title: "Erro", description: errorMsg, variant: "destructive" }); } finally { setIsSaving(false); } };
   const resetForm = () => { setFormData(initialFormData); setSelectedCampaign(null); setError(null); };

  // Efeitos
  useEffect(() => { if (!authLoading && !isAuthenticated) { router.push('/login'); return; } if (!authLoading && isAuthenticated) { fetchCampaignsEffect(); } }, [authLoading, isAuthenticated, router, fetchCampaignsEffect]);

  // Renderização Condicional
  if (authLoading) { return ( <Layout><div className="flex h-[calc(100vh-100px)] w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /><span>Verificando...</span></div></Layout> ); }
  if (!isAuthenticated) { return null; }

  return (
    <Layout>
      <Head><title>Campanhas - USBMKT</title></Head>
      {/* Container principal Flex Coluna com Altura Total e Overflow */}
      <div className="flex flex-col h-full overflow-hidden"> {/* Usa h-full do pai (main do Layout) */}

        {/* Cabeçalho Fixo */}
        <div className="p-3 md:p-6 flex-shrink-0">
             <h1 className="text-xl md:text-2xl font-black text-white" style={{ textShadow: `0 0 8px ${neonColor}` }}>
               Configurações de Campanha
             </h1>
        </div>

         {/* Área de Conteúdo Rolável */}
         {/* flex-1 faz ocupar espaço restante, overflow-auto adiciona scroll se necessário */}
         <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 px-3 md:px-6 pb-3 md:pb-6 overflow-y-auto custom-scrollbar">

            {/* Coluna Lista (Altura automática dentro do grid) */}
            {/* Adicionado max-h para limitar altura em telas grandes e evitar que estique demais */}
            <div className="lg:col-span-1 lg:max-h-[calc(100vh-var(--header-height,60px)-var(--page-padding-y,48px)-theme(space.4))]"> {/* Ajuste --page-padding-y se necessário */}
                <Card className={cn(cardStyle, "p-3 flex flex-col h-full")}> {/* h-full ainda necessário para flex-col funcionar */}
                    <CardHeader className="p-0 pb-3 mb-3 border-b border-[#1E90FF]/20 flex-shrink-0">
                        <CardTitle className="text-base lg:text-lg" style={{ textShadow: `0 0 6px ${neonColor}` }}>Campanhas</CardTitle>
                    </CardHeader>
                    {/* ScrollArea aqui agora */}
                    <ScrollArea className="flex-grow min-h-0 mb-3">
                        <CardContent className="p-0 pr-2"> {/* Padding direito para scrollbar */}
                            {isLoading && <div className='flex justify-center p-4'><Loader2 className="h-5 w-5 animate-spin"/></div>}
                            {!isLoading && error && <p className="text-red-400 text-xs p-2">{error}</p>}
                            {!isLoading && !error && campaigns.length === 0 && <p className="text-gray-400 text-xs p-2">Nenhuma campanha.</p>}
                            {!isLoading && !error && campaigns.length > 0 && (
                            <ul className="space-y-1.5">
                                {campaigns.map((campaign) => (
                                <li key={campaign.id} className={cn(`p-2 rounded-md flex justify-between items-center group bg-[#141414]/50 hover:bg-[#1E90FF]/20 cursor-pointer`, selectedCampaign?.id === campaign.id && 'bg-[#1E90FF]/30 ring-1 ring-[#1E90FF]/50')} onClick={() => handleEdit(campaign)}>
                                    <span className="text-xs font-medium truncate pr-2">{campaign.name}</span>
                                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 flex-shrink-0">
                                    <Button variant="ghost" size="icon" className="h-5 w-5 text-[#6495ED] hover:text-[#87CEFA]" onClick={(e) => { e.stopPropagation(); handleEdit(campaign); }}><Edit size={12}/></Button>
                                    <Button variant="ghost" size="icon" className="h-5 w-5 text-[#FF6347] hover:text-[#F08080]" onClick={(e) => { e.stopPropagation(); handleDelete(campaign.id); }}><Trash2 size={12}/></Button>
                                    </div>
                                </li>
                                ))}
                            </ul>
                            )}
                        </CardContent>
                    </ScrollArea>
                    <Button variant="outline" size="sm" className={cn(neumorphicButtonStyle, "w-full flex-shrink-0")} onClick={resetForm}>
                        <PlusCircle size={14} className="mr-1.5"/> Nova Campanha
                    </Button>
                </Card>
            </div>

            {/* Coluna Formulário (Altura automática dentro do grid) */}
            <div className="lg:col-span-2">
                <form onSubmit={handleSave} className="space-y-3">
                    <Card className={cn(cardStyle, "p-3")}>
                        <CardHeader className="p-0 pb-2 mb-3 border-b border-[#1E90FF]/10">
                            <CardTitle className="text-base lg:text-lg" style={{ textShadow: `0 0 6px ${neonColor}` }}>
                                {selectedCampaign ? `Editando: ${selectedCampaign.name}` : 'Criar Nova Campanha'}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            {/* Grid dos campos do formulário */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {/* Campos com ID/htmlFor e autoComplete */}
                                <FormFieldCard className="md:col-span-2"> <Label htmlFor="campaignName" className={labelStyle}>Nome*</Label> <Input id="campaignName" name="name" value={formData.name} onChange={handleInputChange} required className={cn(neumorphicInputStyle)} autoComplete="off" /> </FormFieldCard>
                                <FormFieldCard> <Label htmlFor="campaignIndustry" className={labelStyle}>Indústria</Label> <Input id="campaignIndustry" name="industry" value={formData.industry || ''} onChange={handleInputChange} placeholder="Ex: Varejo" className={cn(neumorphicInputStyle)} autoComplete="off" /> </FormFieldCard>
                                <FormFieldCard> <Label htmlFor="campaignSegmentation" className={labelStyle}>Segmentação</Label> <Input id="campaignSegmentation" name="segmentation" value={formData.segmentation || ''} onChange={handleInputChange} placeholder="Ex: Idade" className={cn(neumorphicInputStyle)} autoComplete="off" /> </FormFieldCard>
                                <FormFieldCard className="md:col-span-2"> <Label htmlFor="campaignTargetAudience" className={labelStyle}>Público-Alvo</Label> <Textarea id="campaignTargetAudience" name="targetAudience" value={formData.targetAudience || ''} onChange={handleInputChange} placeholder="Descreva..." className={cn(neumorphicTextAreaStyle)} /> </FormFieldCard>
                                {/* Labels sem htmlFor para MultiSelect */}
                                <FormFieldCard> <Label className={labelStyle}>Plataforma(s)</Label> <MultiSelectPopover options={platformOptions} value={formData.platform || []} onChange={handleMultiSelectChange('platform')} placeholder="Selecione..." triggerClassName="h-8 text-sm" /> </FormFieldCard>
                                <FormFieldCard> <Label className={labelStyle}>Objetivo(s)</Label> <MultiSelectPopover options={objectiveOptions} value={formData.objective || []} onChange={handleMultiSelectChange('objective')} placeholder="Selecione..." triggerClassName="h-8 text-sm" /> </FormFieldCard>
                                <FormFieldCard> <Label className={labelStyle}>Formato(s)</Label> <MultiSelectPopover options={adFormatOptions} value={formData.adFormat || []} onChange={handleMultiSelectChange('adFormat')} placeholder="Selecione..." triggerClassName="h-8 text-sm" /> </FormFieldCard>
                                {/* Inputs numéricos */}
                                <FormFieldCard> <Label htmlFor="campaignBudget" className={labelStyle}>Orçamento Total (R$)</Label> <div className="flex items-center gap-1"> <Input id="campaignBudget" name="budget" type="text" inputMode='decimal' value={formData.budget} onChange={handleNumberInputChange} className={cn(neumorphicInputStyle)} autoComplete="off"/> <div className="flex flex-col gap-0.5"> <Button type="button" variant="ghost" className={stepperButtonStyle} onClick={() => handleStepChange('budget', 'up')}><ChevronUp size={12}/></Button> <Button type="button" variant="ghost" className={stepperButtonStyle} onClick={() => handleStepChange('budget', 'down')}><ChevronDown size={12}/></Button> </div> </div> </FormFieldCard>
                                <FormFieldCard> <Label htmlFor="campaignDailyBudget" className={labelStyle}>Orçamento Diário (R$)</Label> <div className="flex items-center gap-1"> <Input id="campaignDailyBudget" name="daily_budget" type="text" inputMode='decimal' value={formData.daily_budget} onChange={handleNumberInputChange} className={cn(neumorphicInputStyle)} autoComplete="off"/> <div className="flex flex-col gap-0.5"> <Button type="button" variant="ghost" className={stepperButtonStyle} onClick={() => handleStepChange('daily_budget', 'up')}><ChevronUp size={12}/></Button> <Button type="button" variant="ghost" className={stepperButtonStyle} onClick={() => handleStepChange('daily_budget', 'down')}><ChevronDown size={12}/></Button> </div> </div> </FormFieldCard>
                                <FormFieldCard> <Label htmlFor="campaignDuration" className={labelStyle}>Duração (Dias)</Label> <div className="flex items-center gap-1"> <Input id="campaignDuration" name="duration" type="text" inputMode='numeric' value={formData.duration} onChange={handleNumberInputChange} className={cn(neumorphicInputStyle)} autoComplete="off"/> <div className="flex flex-col gap-0.5"> <Button type="button" variant="ghost" className={stepperButtonStyle} onClick={() => handleStepChange('duration', 'up')}><ChevronUp size={12}/></Button> <Button type="button" variant="ghost" className={stepperButtonStyle} onClick={() => handleStepChange('duration', 'down')}><ChevronDown size={12}/></Button> </div> </div> </FormFieldCard>
                                <FormFieldCard> <Label htmlFor="campaignCostTraffic" className={labelStyle}>Custo Tráfego (R$)</Label> <div className="flex items-center gap-1"> <Input id="campaignCostTraffic" name="cost_traffic" type="text" inputMode='decimal' value={formData.cost_traffic} onChange={handleNumberInputChange} className={cn(neumorphicInputStyle)} autoComplete="off"/> <div className="flex flex-col gap-0.5"> <Button type="button" variant="ghost" className={stepperButtonStyle} onClick={() => handleStepChange('cost_traffic', 'up')}><ChevronUp size={12}/></Button> <Button type="button" variant="ghost" className={stepperButtonStyle} onClick={() => handleStepChange('cost_traffic', 'down')}><ChevronDown size={12}/></Button> </div> </div> </FormFieldCard>
                                <FormFieldCard> <Label htmlFor="campaignCostCreative" className={labelStyle}>Custo Criativos (R$)</Label> <div className="flex items-center gap-1"> <Input id="campaignCostCreative" name="cost_creative" type="text" inputMode='decimal' value={formData.cost_creative} onChange={handleNumberInputChange} className={cn(neumorphicInputStyle)} autoComplete="off"/> <div className="flex flex-col gap-0.5"> <Button type="button" variant="ghost" className={stepperButtonStyle} onClick={() => handleStepChange('cost_creative', 'up')}><ChevronUp size={12}/></Button> <Button type="button" variant="ghost" className={stepperButtonStyle} onClick={() => handleStepChange('cost_creative', 'down')}><ChevronDown size={12}/></Button> </div> </div> </FormFieldCard>
                                <FormFieldCard> <Label htmlFor="campaignCostOperational" className={labelStyle}>Custo Operacional (R$)</Label> <div className="flex items-center gap-1"> <Input id="campaignCostOperational" name="cost_operational" type="text" inputMode='decimal' value={formData.cost_operational} onChange={handleNumberInputChange} className={cn(neumorphicInputStyle)} autoComplete="off"/> <div className="flex flex-col gap-0.5"> <Button type="button" variant="ghost" className={stepperButtonStyle} onClick={() => handleStepChange('cost_operational', 'up')}><ChevronUp size={12}/></Button> <Button type="button" variant="ghost" className={stepperButtonStyle} onClick={() => handleStepChange('cost_operational', 'down')}><ChevronDown size={12}/></Button> </div> </div> </FormFieldCard>
                            </div>
                        </CardContent>
                        {error && <div className="mt-3 p-2 bg-red-900/30 rounded border border-red-700/50 text-red-400 text-xs text-center mx-0">{error}</div>}
                        {/* Botões DENTRO do card */}
                        <div className="flex justify-end gap-2 pt-3 mt-3 border-t border-[#1E90FF]/10">
                           <Button type="button" variant="outline" onClick={resetForm} className={cn(neumorphicButtonStyle, "text-gray-300")}> Cancelar </Button>
                           <Button type="submit" disabled={isSaving} className={cn(primaryNeumorphicButtonStyle)}> {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2"/> : null} {isSaving ? 'Salvando...' : (selectedCampaign ? 'Salvar Alterações' : 'Salvar Campanha')} </Button>
                        </div>
                    </Card>
                </form>
            </div> {/* Fim da Coluna Formulário */}

         </div> {/* Fim do Grid Principal Rolável */}
      </div> {/* Fim do Container principal Flex */}
    </Layout>
  );
}
