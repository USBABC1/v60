// pages/CopyPage.tsx
import React, { useState, useEffect, ChangeEvent, useCallback } from 'react';
import Head from 'next/head';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/router';
import Layout from '@/components/layout';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
// Interface Campaign não precisa ser importada diretamente se usarmos CampaignOption
// import { Campaign } from '@/entities/Campaign';
import axios, { AxiosResponse } from 'axios';
import { Trash2, Edit, PlusCircle, Brain, ClipboardCopy, Loader2, Save, Sparkles, Bot, ListChecks, Copy as CopyIcon } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

// --- INTERFACES ---
interface CopyFormData {
    title: string;
    content: string;
    cta: string;
    target_audience: string;
    status: string;
    campaign_id: string | number | null; // Mantém number para compatibilidade inicial se necessário
}
interface Copy { // Interface para dados recebidos da API /api/copies
    id: string;
    title: string;
    content: string;
    cta: string;
    target_audience?: string | null;
    status?: string | null;
    campaign_id: string | number | null;
    created_date?: string; // Ajustar para created_at se for o nome da coluna MySQL
    updated_at?: string;
    clicks?: number | null;
    impressions?: number | null;
    conversions?: number | null;
    // performance?: any; // Remover se não usado
}
interface CampaignOption { // Para o select de campanhas
    id: number | string; // ID pode ser string ou number vindo da API
    name: string;
}
// Tipos para a API do MCP Agent (adaptado)
interface AgentApiResponse { response: string; action?: any | null; }
interface AgentRequestBody { message: string; context: { path: string; }; }


export default function CopyPage() {
    // --- Autenticação e Roteamento ---
    const { isAuthenticated, isLoading: authLoading } = useAuth();
    const router = useRouter();
    const currentPagePath = router.pathname; // Captura o path atual para o contexto do agente

    // --- ESTADOS ---
    const [campaignOptions, setCampaignOptions] = useState<CampaignOption[]>([]);
    const [copies, setCopies] = useState<Copy[]>([]);
    const [selectedCopy, setSelectedCopy] = useState<Copy | null>(null);
    const initialFormData: CopyFormData = { title: '', content: '', cta: '', target_audience: '', status: 'draft', campaign_id: null, };
    const [formData, setFormData] = useState<CopyFormData>(initialFormData);
    const [isLoading, setIsLoading] = useState(false); // Loading de salvar/deletar
    const [isFetchingData, setIsFetchingData] = useState(true); // Loading inicial (campanhas, cópias)
    const [isGenerating, setIsGenerating] = useState(false); // Loading da IA (MCP Agent)
    const [error, setError] = useState<string | null>(null);
    const { toast } = useToast();

    // --- Constantes de Estilo ---
    const neonColor = '#1E90FF'; const neonColorMuted = '#4682B4'; const neonRedColor = '#FF4444'; const neonGreenColor = '#32CD32';
    const cardStyle = "bg-[#141414]/80 backdrop-blur-sm shadow-[5px_5px_10px_rgba(0,0,0,0.4),-5px_-5px_10px_rgba(255,255,255,0.05)] rounded-lg border border-[hsl(var(--border))]/30";
    const neumorphicInputStyle = "bg-[#141414] text-white shadow-[inset_2px_2px_4px_rgba(0,0,0,0.3),inset_-2px_-2px_4px_rgba(255,255,255,0.05)] placeholder:text-gray-500 border border-[hsl(var(--border))]/20 focus:ring-2 focus:ring-[hsl(var(--primary))] focus:ring-offset-2 focus:ring-offset-[#0e1015] h-9";
    const neumorphicTextAreaStyle = cn(neumorphicInputStyle, "min-h-[80px] py-2");
    const neumorphicButtonStyle = `bg-[#141414] border border-[hsl(var(--border))]/30 text-white shadow-[3px_3px_6px_rgba(0,0,0,0.3),-3px_-3px_6px_rgba(255,255,255,0.05)] hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.3),inset_-2px_-2px_4px_rgba(255,255,255,0.05)] hover:bg-[hsl(var(--primary))]/10 active:scale-[0.98] active:brightness-95 transition-all duration-150 ease-out`;
    const primaryButtonStyle = `bg-gradient-to-r from-[hsl(var(--primary))] to-[${neonColorMuted}] hover:from-[${neonColorMuted}] hover:to-[hsl(var(--primary))] text-primary-foreground font-semibold shadow-[0_4px_10px_rgba(30,144,255,0.3)] transition-all duration-300 ease-in-out transform hover:scale-[1.03] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#0e1015] focus:ring-[#5ca2e2]`;
    const statusColors: { [key: string]: string } = { draft: 'bg-gray-600/80 border-gray-500/50 text-gray-200', active: `bg-green-600/80 border-green-500/50 text-green-100 shadow-[0_0_5px_${neonGreenColor}]`, paused: 'bg-yellow-600/80 border-yellow-500/50 text-yellow-100', archived: 'bg-slate-700/80 border-slate-600/50 text-slate-300', };
    const getStatusBadgeClass = (status?: string) => cn("text-[10px] uppercase font-medium tracking-wider border px-2 py-0.5 rounded-full shadow-sm", statusColors[status || 'draft'] || statusColors['draft']);

    // --- Lógica de Proteção de Rota ---
    useEffect(() => {
        if (!authLoading && !isAuthenticated) { router.push('/login'); }
        if (!authLoading && isAuthenticated && campaignOptions.length === 0) { loadCampaignOptions(); }
        if (!authLoading && !isAuthenticated) { setIsFetchingData(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [authLoading, isAuthenticated, router]); // Removido loadCampaignOptions daqui para evitar loops

    // --- FUNÇÕES ---
    const loadCampaignOptions = useCallback(async () => {
        setIsFetchingData(true); setError(null);
        try {
            const response = await axios.get<CampaignOption[]>('/api/campaigns?fields=id,name');
            setCampaignOptions(response.data || []);
            // Se NENHUMA campanha estiver selecionada AINDA e houver opções, seleciona a primeira como padrão
            if (response.data && response.data.length > 0 && formData.campaign_id === null) {
                setFormData(prev => ({ ...prev, campaign_id: response.data[0].id }));
            } else if (!response.data || response.data.length === 0) {
                 setFormData(prev => ({ ...prev, campaign_id: null })); // Garante que fica null se não houver campanhas
            }
        } catch (err: any) {
            console.error("Erro ao carregar opções de campanha:", err);
            setError("Falha ao carregar campanhas.");
            toast({ title: "Erro", description: "Falha ao carregar campanhas.", variant: "destructive" });
            setCampaignOptions([]);
        } finally {
            setIsFetchingData(false); // Marca que o carregamento das campanhas terminou
        }
   }, [toast, formData.campaign_id]); // Depende de formData.campaign_id para não resetar seleção

    // Busca cópias quando a campanha selecionada muda OU após salvar/deletar
    const fetchCopiesForCampaign = useCallback(async () => {
        // Só busca se autenticado, opções de campanha carregadas, e uma campanha válida selecionada
        if (!isAuthenticated || isFetchingData || !formData.campaign_id || formData.campaign_id === 'loading') {
            setCopies([]); // Limpa se não deve buscar
            return;
        }
        setIsLoading(true); setError(null); // Usa isLoading geral para cópias
        try {
            console.log(`Buscando cópias para campanha ID: ${formData.campaign_id}`);
            const response = await axios.get<Copy[]>(`/api/copies?campaign_id=${formData.campaign_id}`);
            setCopies(response.data || []);
        } catch (err: any) {
            console.error(`Erro ao buscar cópias para campanha ${formData.campaign_id}:`, err);
            setError("Falha ao buscar cópias para esta campanha.");
            toast({ title: "Erro", description: "Falha ao buscar cópias.", variant: "destructive" });
            setCopies([]);
        } finally {
            setIsLoading(false);
        }
   }, [isAuthenticated, isFetchingData, formData.campaign_id, toast]); // Dependências corretas

    useEffect(() => {
        fetchCopiesForCampaign();
    }, [fetchCopiesForCampaign]); // Chama a busca de cópias quando as dependências mudam


    // Handlers (demais handlers como antes)
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => { const { name, value } = e.target; setFormData(prev => ({ ...prev, [name]: value })); };
    const handleSelectChange = (name: keyof CopyFormData) => (value: string) => { setFormData(prev => ({ ...prev, [name]: value })); };
    const handleSelectCampaignChange = (value: string) => { // Recebe o ID como string
        const selectedId = value === 'loading' || value === 'no-camps' ? null : value;
        setFormData({ ...initialFormData, campaign_id: selectedId }); // Reseta campos ao mudar campanha
        setSelectedCopy(null);
        setError(null);
        // fetchCopiesForCampaign será chamado pelo useEffect dependente de formData.campaign_id
    };

    // --- GERAR CÓPIA COM MCP AGENT ---
    const handleGenerateCopy = async () => {
        if (!formData.campaign_id) {
            toast({ title: "Atenção", description: "Selecione uma campanha primeiro.", variant: "default" });
            return;
        }
        // Pega o nome da campanha selecionada para dar contexto
        const selectedCampaignName = campaignOptions.find(c => String(c.id) === String(formData.campaign_id))?.name || "Campanha Selecionada";

        // Monta o prompt para o MCP Agent
        const prompt = `Gere o conteúdo principal (corpo do texto) para um anúncio da campanha "${selectedCampaignName}".
        O público-alvo é: ${formData.target_audience || 'não especificado'}.
        O Call-to-Action (CTA) principal é: "${formData.cta || 'não especificado'}".
        Foco em destacar benefícios e ser persuasivo. Gere apenas o texto do conteúdo.`;

        setIsGenerating(true);
        setError(null);
        toast({ title: "IA Pensando...", description: "Gerando sugestão de conteúdo...", variant: "default" });

        try {
            console.log(`[CopyPage] Enviando prompt para MCP Agent: "${prompt}"`);
            const requestPayload: AgentRequestBody = {
                message: prompt,
                context: { path: currentPagePath } // Envia o path atual
            };

            const response: AxiosResponse<AgentApiResponse> = await axios.post('/api/mcp-agent', requestPayload);

            const agentResponseText = response.data.response;
            console.log(`[CopyPage] Resposta do MCP Agent:`, agentResponseText);

            if (agentResponseText && typeof agentResponseText === 'string') {
                // Remove possíveis JSONs de ferramenta ou texto extra que o LLM possa ter adicionado por engano
                const cleanedResponse = agentResponseText.replace(/^{.*}$/gs, '').trim(); // Tenta remover JSON completo
                if (cleanedResponse) {
                     setFormData(prev => ({ ...prev, content: cleanedResponse })); // ATUALIZA O CONTEÚDO
                     toast({ title: "Sugestão Gerada!", description: "Conteúdo preenchido pela IA." });
                } else {
                     // Se a resposta foi só um JSON ou ficou vazia após limpeza
                     setError("IA retornou formato inesperado. Tente novamente.");
                     toast({ title: "Erro IA", description: "Formato de resposta inesperado.", variant: "destructive" });
                }
            } else {
                throw new Error("Resposta inválida ou vazia da IA.");
            }

        } catch (error: any) {
            console.error("[CopyPage] Erro ao chamar MCP agent API:", error.response?.data || error.message);
             const errorMsg = error.response?.data?.response || error.response?.data?.error || error.message || "Falha ao comunicar com a IA.";
            setError(errorMsg);
            toast({ title: "Erro IA", description: errorMsg, variant: "destructive" });
        } finally {
            setIsGenerating(false);
        }
    }; // Fim handleGenerateCopy

    // Resto dos Handlers (Save, Select, Delete, Reset, Copy)
    const handleSaveCopy = async (e: React.FormEvent) => {
        e.preventDefault(); setError(null);
        if (!formData.campaign_id) { setError("Selecione uma campanha."); toast({ title: "Erro", description: "Selecione uma campanha.", variant: "destructive" }); return; }
        if (!formData.title.trim() || !formData.content.trim() || !formData.cta.trim()) { setError("Título, Conteúdo e CTA são obrigatórios."); toast({ title: "Erro", description: "Preencha Título, Conteúdo e CTA.", variant: "destructive" }); return; }
        setIsLoading(true);
        const apiData = { // Garante que os campos corretos são enviados
            title: formData.title.trim(),
            content: formData.content.trim(),
            cta: formData.cta.trim(),
            target_audience: formData.target_audience?.trim() || null,
            status: formData.status || 'draft',
            campaign_id: String(formData.campaign_id), // Envia como string para a API
            // Inclui métricas apenas se editando e se existirem no selectedCopy
            clicks: selectedCopy?.clicks ?? 0,
            impressions: selectedCopy?.impressions ?? 0,
            conversions: selectedCopy?.conversions ?? 0,
        };
        try {
            let response: AxiosResponse<Copy>; let successMessage = '';
            if (selectedCopy) {
                console.log(`[CopyPage] Atualizando cópia ID: ${selectedCopy.id}`);
                response = await axios.put(`/api/copies?id=${selectedCopy.id}`, apiData);
                successMessage = 'Cópia atualizada com sucesso.';
                setCopies(copies.map(c => (String(c.id) === String(selectedCopy!.id) ? response.data : c))); // Comparar como string
            } else {
                 console.log(`[CopyPage] Criando nova cópia para campanha ID: ${formData.campaign_id}`);
                response = await axios.post('/api/copies', apiData);
                successMessage = 'Nova cópia criada com sucesso.';
                setCopies(prev => [response.data, ...prev]); // Adiciona no início
            }
            toast({ title: "Sucesso!", description: successMessage });
            resetFormFields(formData.campaign_id); // Mantém campanha selecionada
            setSelectedCopy(null); // Limpa seleção após salvar
            // fetchCopiesForCampaign(); // Recarrega a lista (opcional, já atualiza localmente)
        } catch (err: any) {
            console.error("Erro ao salvar cópia:", err.response?.data || err.message);
            const errorMsg = err.response?.data?.message || "Falha ao salvar a cópia.";
            setError(errorMsg);
            toast({ title: "Erro", description: errorMsg, variant: "destructive" });
        } finally { setIsLoading(false); }
    };
    const handleSelectCopy = (copy: Copy) => {
        setSelectedCopy(copy);
        setFormData({
            title: copy.title || '',
            content: copy.content || '',
            cta: copy.cta || '',
            target_audience: copy.target_audience || '',
            status: copy.status || 'draft',
            campaign_id: copy.campaign_id, // Mantém o ID da campanha
        });
        setError(null);
    };
    const handleDeleteCopy = async (id: string) => {
        if (!confirm(`Tem certeza que deseja excluir a cópia "${copies.find(c=>c.id===id)?.title || id}"?`)) return;
        setIsLoading(true); setError(null);
        try {
            await axios.delete(`/api/copies?id=${id}`);
            setCopies(copies.filter(c => String(c.id) !== String(id))); // Comparar como string
            toast({ title: "Cópia Excluída" });
            if (String(selectedCopy?.id) === String(id)) {
                resetFormFields(formData.campaign_id);
                setSelectedCopy(null);
            }
        } catch (err: any) {
            console.error("Erro ao excluir cópia:", err.response?.data || err.message);
            const errorMsg = err.response?.data?.message || "Falha ao excluir.";
            setError(errorMsg); toast({ title: "Erro", description: errorMsg, variant: "destructive" });
        } finally { setIsLoading(false); }
    };
    const resetFormFields = (campaignIdToKeep: string | number | null = null) => {
        setFormData({ ...initialFormData, campaign_id: campaignIdToKeep });
        setSelectedCopy(null);
        setError(null);
    };
    const copyToClipboard = (text: string | undefined | null) => {
        if (text) {
            navigator.clipboard.writeText(text)
                .then(() => toast({ title: "Copiado!", description: "Conteúdo copiado para a área de transferência." }))
                .catch(err => toast({ title: "Erro", description: "Não foi possível copiar o texto.", variant: "destructive" }));
        } else {
             toast({ title: "Aviso", description: "Não há conteúdo para copiar.", variant: "default" });
        }
    };


    // --- Renderização Condicional (Auth Loading) ---
    if (authLoading || (isFetchingData && campaignOptions.length === 0)) { // Loading inicial
        return (
            <Layout> <div className="flex h-[calc(100vh-100px)] w-full items-center justify-center"> <Loader2 className="h-8 w-8 animate-spin text-primary" /> <span className="ml-3 text-muted-foreground"> {authLoading ? 'Verificando acesso...' : 'Carregando dados...'} </span> </div> </Layout>
        );
    }
    if (!isAuthenticated) { return null; } // Proteção

    // --- Renderização Principal ---
    return (
        <Layout>
            <Head><title>Planejamento de Copy - USBMKT</title></Head>
            <div className="flex flex-col h-full overflow-hidden p-4 md:p-6 space-y-4"> {/* Container principal flex col */}
                {/* Cabeçalho */}
                <div className="flex-shrink-0">
                    <h1 className="text-2xl font-black text-white" style={{ textShadow: `0 0 8px ${neonColor}` }}> Planejamento de Copy </h1>
                </div>

                {/* Grid Principal (rolável) */}
                <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0 overflow-hidden">

                    {/* Coluna Esquerda: Formulário e IA */}
                    <div className="lg:col-span-2 space-y-4 overflow-y-auto custom-scrollbar pr-2 pb-2"> {/* Scroll individual */}
                        <Card className={cn(cardStyle)}>
                             <CardHeader> <CardTitle className="flex items-center text-base font-semibold text-white" style={{ textShadow: `0 0 6px ${neonColor}` }}> {selectedCopy ? <Edit size={16} className="mr-2" /> : <PlusCircle size={16} className="mr-2" />} {selectedCopy ? 'Editar Cópia' : 'Nova Cópia'} </CardTitle> </CardHeader>
                             <CardContent>
                                {/* Exibe erro do formulário */}
                                {error && !isLoading && <p className={cn("text-xs mb-3 p-2 rounded border text-center", `bg-red-900/30 border-red-700/50 text-red-300`)}>{error}</p>}
                                <form onSubmit={handleSaveCopy} className="space-y-3">
                                    {/* Select Campanha */}
                                    <div className="space-y-1"> <Label htmlFor="campaign_id" className="text-xs text-gray-400">Campanha*</Label> <Select value={formData.campaign_id ? String(formData.campaign_id) : ''} onValueChange={handleSelectCampaignChange} required disabled={isFetchingData || isLoading || isGenerating}> <SelectTrigger id="campaign_id" className={cn(neumorphicInputStyle, "w-full h-9 text-sm")}> <SelectValue placeholder={isFetchingData ? "Carregando..." : "Selecione..."} /> </SelectTrigger> <SelectContent className="bg-[#1a1c23] border-[#2d62a3]/50 text-white"> {isFetchingData && campaignOptions.length === 0 && <SelectItem value="loading" disabled>Carregando...</SelectItem>} {!isFetchingData && campaignOptions.length === 0 && <SelectItem value="no-camps" disabled>Nenhuma campanha</SelectItem>} {campaignOptions.map((camp) => ( <SelectItem key={camp.id} value={String(camp.id)} className="text-xs hover:bg-[#2d62a3]/30 cursor-pointer"> {camp.name} </SelectItem> ))} </SelectContent> </Select> </div>
                                    {/* Fields */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div className="space-y-1 md:col-span-2"> <Label htmlFor="title" className="text-xs text-gray-400">Título*</Label> <Input id="title" name="title" value={formData.title} onChange={handleInputChange} required className={cn(neumorphicInputStyle, "h-9 text-sm")} disabled={isLoading || isGenerating}/> </div>
                                        <div className="space-y-1 md:col-span-2"> <Label htmlFor="content" className="text-xs text-gray-400">Conteúdo*</Label> <Textarea id="content" name="content" value={formData.content} onChange={handleInputChange} className={cn(neumorphicTextAreaStyle, "min-h-[150px] text-sm")} required disabled={isLoading || isGenerating}/> </div>
                                        <div className="space-y-1"> <Label htmlFor="cta" className="text-xs text-gray-400">CTA*</Label> <Input id="cta" name="cta" value={formData.cta} onChange={handleInputChange} required className={cn(neumorphicInputStyle, "h-9 text-sm")} disabled={isLoading || isGenerating}/> </div>
                                        <div className="space-y-1"> <Label htmlFor="target_audience" className="text-xs text-gray-400">Público-Alvo</Label> <Input id="target_audience" name="target_audience" value={formData.target_audience} onChange={handleInputChange} className={cn(neumorphicInputStyle, "h-9 text-sm")} disabled={isLoading || isGenerating}/> </div>
                                        <div className="space-y-1"> <Label htmlFor="status" className="text-xs text-gray-400">Status</Label> <Select value={formData.status} onValueChange={handleSelectChange('status')} disabled={isLoading || isGenerating} > <SelectTrigger id="status" className={cn(neumorphicInputStyle, "w-full h-9 text-sm")}> <SelectValue /> </SelectTrigger> <SelectContent className="bg-[#1a1c23] border-[#2d62a3]/50 text-white"> <SelectItem value="draft" className="text-xs hover:bg-[#2d62a3]/30 cursor-pointer">Rascunho</SelectItem> <SelectItem value="active" className="text-xs hover:bg-[#2d62a3]/30 cursor-pointer">Ativa</SelectItem> <SelectItem value="paused" className="text-xs hover:bg-[#2d62a3]/30 cursor-pointer">Pausada</SelectItem> <SelectItem value="archived" className="text-xs hover:bg-[#2d62a3]/30 cursor-pointer">Arquivada</SelectItem> </SelectContent> </Select> </div>
                                    </div>
                                    {/* Botões do Formulário */}
                                    <div className="flex justify-end gap-2 pt-3">
                                        <Button type="button" variant="outline" onClick={() => resetFormFields(formData.campaign_id)} className={cn(neumorphicButtonStyle, "h-8 px-3 text-xs")} disabled={isLoading || isGenerating}> Limpar </Button>
                                        <Button type="submit" disabled={isLoading || isGenerating || isFetchingData || !formData.campaign_id || !formData.title.trim() || !formData.content.trim() || !formData.cta.trim()} className={cn(primaryButtonStyle, "h-8 px-3 text-xs")} > {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1"/> : <Save className="h-4 w-4 mr-1" />} {isLoading ? 'Salvando...' : (selectedCopy ? 'Salvar Alterações' : 'Salvar Cópia')} </Button>
                                    </div>
                                </form>
                             </CardContent>
                        </Card>
                        {/* Card de Geração IA */}
                        <Card className={cn(cardStyle)}>
                             <CardHeader> <CardTitle className="flex items-center text-base font-semibold text-white" style={{ textShadow: `0 0 6px ${neonColor}` }}> <Bot size={16} className="mr-2" /> Assistente de Copy (MCP) </CardTitle> </CardHeader>
                             <CardContent> <p className="text-xs text-gray-400 mb-3">Gere sugestões de conteúdo com base na Campanha, Público e CTA informados no formulário.</p> <Button onClick={handleGenerateCopy} disabled={isGenerating || !formData.campaign_id || isLoading} className={cn(primaryButtonStyle, "w-full h-9 text-sm")} > {isGenerating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />} {isGenerating ? 'Gerando...' : 'Gerar Conteúdo'} </Button> </CardContent>
                        </Card>
                    </div> {/* Fim Coluna Esquerda */}

                    {/* Coluna Direita: Lista de Cópias */}
                    <div className="lg:col-span-1">
                        <Card className={cn(cardStyle, "h-full flex flex-col")}> {/* h-full para ocupar espaço */}
                             <CardHeader className="flex-shrink-0 p-4 border-b border-[hsl(var(--border))]/30"> <CardTitle className="flex items-center text-base font-semibold text-white" style={{ textShadow: `0 0 6px ${neonColor}` }}> <ListChecks size={16} className="mr-2" /> Cópias Salvas </CardTitle> </CardHeader>
                             <CardContent className="flex-grow p-0 overflow-hidden"> {/* Área de conteúdo principal que permite scroll */}
                                <ScrollArea className="h-full px-4 py-2"> {/* Scroll dentro do conteúdo */}
                                     {(isLoading && copies.length === 0) || isFetchingData ? (
                                         <div className="flex justify-center items-center h-40"> <Loader2 className="h-6 w-6 animate-spin text-primary" /> </div>
                                     ) : !formData.campaign_id ? (
                                         <p className="text-center text-gray-400 p-6 text-xs">Selecione uma campanha para ver as cópias.</p>
                                     ) : copies.length === 0 ? (
                                         <p className="text-center text-gray-400 p-6 text-xs">Nenhuma cópia encontrada para esta campanha.</p>
                                     ) : (
                                         <div className="space-y-2">
                                            {copies.map((copy) => (
                                                <Card key={copy.id} className={cn( "cursor-pointer transition-all duration-150 ease-out", "bg-[#181a1f]/70 border border-[hsl(var(--border))]/20", "hover:bg-[#1E90FF]/10 hover:border-[hsl(var(--primary))]/40", selectedCopy?.id === copy.id && "ring-1 ring-[hsl(var(--primary))] bg-[#1E90FF]/15 border-[hsl(var(--primary))]/50" )} onClick={() => handleSelectCopy(copy)} >
                                                     <CardContent className="p-2 space-y-1">
                                                         <div className="flex justify-between items-start gap-2">
                                                            <p className="text-xs font-semibold text-white truncate flex-1 pr-1" title={copy.title}>{copy.title}</p>
                                                            <div className="flex gap-1 flex-shrink-0">
                                                                 <Button variant="ghost" size="icon" className="h-5 w-5 text-gray-400 hover:text-white p-0.5" onClick={(e) => { e.stopPropagation(); copyToClipboard(copy.content); }} title="Copiar Conteúdo"><ClipboardCopy size={11} /></Button>
                                                                 <Button variant="ghost" size="icon" className="h-5 w-5 text-red-500 hover:text-red-400 hover:bg-red-900/30 p-0.5" onClick={(e) => { e.stopPropagation(); handleDeleteCopy(copy.id); }} title="Excluir Cópia" disabled={isLoading}><Trash2 size={11}/></Button>
                                                            </div>
                                                         </div>
                                                         <p className="text-[11px] text-gray-400 line-clamp-2" title={copy.content}>{copy.content}</p>
                                                         <div className="flex justify-between items-center pt-1 gap-2">
                                                            <Badge className={getStatusBadgeClass(copy.status)}>{copy.status || 'draft'}</Badge>
                                                            <p className="text-[10px] text-gray-500 truncate" title={`CTA: ${copy.cta}`}>CTA: {copy.cta || 'N/A'}</p>
                                                         </div>
                                                     </CardContent>
                                                </Card>
                                            ))}
                                         </div>
                                     )}
                                </ScrollArea>
                             </CardContent>
                             {/* Footer removido da lista, botão Nova Cópia movido para o Form */}
                         </Card>
                    </div> {/* Fim Coluna Direita */}

                </div> {/* Fim Grid Principal */}
            </div> {/* Fim Container Página */}
        </Layout>
    );
}
