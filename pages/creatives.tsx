// pages/creatives.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import Head from 'next/head';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/router';
import Layout from '@/components/layout';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MultiSelectPopover } from "@/components/ui/multi-select-popover"; // Assuming this path is correct
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader2, PlusCircle, Image as ImageIcon, Video, Type, Filter, Search, Calendar as CalendarIcon, Edit, Trash2, GripVertical, List, Grid, ExternalLink, Clock, HelpCircle, Copy as CopyIcon, Save, FileText, Upload, Paperclip, AlertCircle } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import axios from 'axios';
import { format, parseISO, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import dynamic from 'next/dynamic';

const ReactPlayer = dynamic(() => import('react-player/lazy'), { ssr: false });

type CampaignOption = { id: string; name: string; };
type CreativeType = 'image' | 'video' | 'headline' | 'body' | 'cta';
type CreativeStatus = 'draft' | 'active' | 'archived';
interface Creative { id: string; name: string; campaign_id?: string | null; campaignName?: string; type: CreativeType; content: string; comments?: string | null; status?: CreativeStatus; platform?: string[] | string; format?: string; publish_date?: string | null; created_at?: string; updated_at?: string; originalFilename?: string; }
const CREATIVE_TYPES: { value: CreativeType; label: string; icon: React.ElementType }[] = [ { value: 'image', label: 'Imagem', icon: ImageIcon }, { value: 'video', label: 'Vídeo', icon: Video }, { value: 'headline', label: 'Título', icon: Type }, { value: 'body', label: 'Corpo', icon: Type }, { value: 'cta', label: 'CTA', icon: Type }, ];
const PLATFORM_OPTIONS = [ { value: "meta", label: "Meta (FB/IG)" }, { value: "google", label: "Google" }, { value: "tiktok", label: "TikTok" }, { value: "linkedin", label: "LinkedIn" }, { value: "other", label: "Outra" }, ];
const STATUS_OPTIONS: { value: CreativeStatus; label: string }[] = [ { value: 'draft', label: 'Rascunho'}, { value: 'active', label: 'Ativo'}, { value: 'archived', label: 'Arquivado'} ];
const safeJsonParse = (str: string | string[] | undefined | null): string[] => { if (Array.isArray(str)) return str; if (typeof str !== 'string' || !str.trim()) return []; try { const parsed = JSON.parse(str); return Array.isArray(parsed) ? parsed : []; } catch (e) { if (str.includes(',')) { return str.split(',').map(s => s.trim()).filter(Boolean); } return []; } };

export default function CreativesPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [creatives, setCreatives] = useState<Creative[]>([]);
  const [filteredCreatives, setFilteredCreatives] = useState<Creative[]>([]);
  const [campaignOptions, setCampaignOptions] = useState<CampaignOption[]>([]);
  const [selectedCreative, setSelectedCreative] = useState<Creative | null>(null);
  const [filterCampaign, setFilterCampaign] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [viewMode, setViewMode] = useState<'grid' | 'list'>("grid");
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [formData, setFormData] = useState<Partial<Creative>>({});
  const [formDate, setFormDate] = useState<Date | undefined>(undefined);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [campaignsLoading, setCampaignsLoading] = useState<boolean>(true);
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [isDetailOpen, setIsDetailOpen] = useState<boolean>(false);
  const [selectedCreativeDetail, setSelectedCreativeDetail] = useState<Creative | null>(null);
  const [detailComment, setDetailComment] = useState<string>('');
  const [isSavingComment, setIsSavingComment] = useState<boolean>(false);
  const [playerKey, setPlayerKey] = useState<number>(0);

   const neonColor = '#1E90FF';
   const cardStyle = "bg-[#141414]/80 backdrop-blur-sm shadow-[5px_5px_10px_rgba(0,0,0,0.4),-5px_-5px_10px_rgba(255,255,255,0.05)] rounded-lg border-none";
   const neumorphicInputStyle = "bg-[#141414] text-white shadow-[inset_2px_2px_4px_rgba(0,0,0,0.3),inset_-2px_-2px_4px_rgba(255,255,255,0.05)] placeholder:text-gray-500 border-none focus:ring-2 focus:ring-[#1E90FF] focus:ring-offset-2 focus:ring-offset-[#0e1015] h-9";
   const neumorphicButtonStyle = "bg-[#141414] border-none text-white shadow-[3px_3px_6px_rgba(0,0,0,0.3),-3px_-3px_6px_rgba(255,255,255,0.05)] hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.3),inset_-2px_-2px_4px_rgba(255,255,255,0.05)] hover:bg-[#1E90FF]/80 active:scale-[0.98] active:brightness-95 transition-all duration-150 ease-out";
   const primaryButtonStyle = `bg-gradient-to-r from-[${neonColor}] to-[#4682B4] hover:from-[#4682B4] hover:to-[${neonColor}] text-white font-semibold shadow-[0_4px_10px_rgba(30,144,255,0.4)]`;
   const labelStyle = "text-xs text-gray-300";
   const titleStyle = "text-base font-semibold text-white";
   const popoverContentStyle=`bg-[#1e2128] border-[#1E90FF]/30 text-white`; // This might not be used directly anymore
   const statusColors: { [key: string]: string } = { draft: 'bg-gray-600/80 border-gray-500/50', active: `bg-green-600/80 border-green-500/50 text-green-100 shadow-[0_0_5px_#32CD32]`, archived: 'bg-slate-700/80 border-slate-600/50 text-slate-300', };
   const getStatusBadgeClass = (status?: string) => cn("absolute top-1 left-1 text-[9px] border px-1.5 py-0 h-4 inline-flex items-center rounded-full shadow-sm leading-none", statusColors[status || 'draft'] || statusColors['draft']);
   const neumorphicTextAreaStyle = cn(neumorphicInputStyle, "min-h-[80px] py-2");

   const loadInitialData = useCallback(async () => {
     setIsLoading(true);
     setCampaignsLoading(true);
     try {
       const [campaignRes, creativeRes] = await Promise.all([
         axios.get<CampaignOption[]>('/api/campaigns?fields=id,name'),
         axios.get<Creative[]>('/api/creatives')
       ]);
       setCampaignOptions(campaignRes.data || []);
       setCreatives((creativeRes.data || []).map(c => ({
         ...c,
         platform: safeJsonParse(c.platform),
         content: typeof c.content === 'string' ? c.content : '',
         comments: c.comments ?? null,
       })));
     } catch (error: any) {
       toast({
         title: "Erro",
         description: "Falha load data.",
         variant: "destructive"
       });
     } finally {
       setIsLoading(false);
       setCampaignsLoading(false);
     }
   }, [toast]);

   useEffect(() => {
     if (!authLoading && !isAuthenticated) {
       router.push('/login');
     }
     if (!authLoading && isAuthenticated && isLoading) {
       loadInitialData();
     }
   }, [authLoading, isAuthenticated, router, isLoading, loadInitialData]);

   const filterAndSearchCreatives = useCallback(() => {
     let result = creatives;
     if (filterCampaign !== 'all') {
       result = result.filter(c => c.campaign_id === filterCampaign);
     }
     if (filterType !== 'all') {
       result = result.filter(c => c.type === filterType);
     }
     if (searchTerm) {
       const lowerSearch = searchTerm.toLowerCase();
       result = result.filter(c =>
         c.name.toLowerCase().includes(lowerSearch) ||
         (c.content && typeof c.content === 'string' && c.content.toLowerCase().includes(lowerSearch)) ||
         (c.campaign_id && campaignOptions.find(co => co.id === c.campaign_id)?.name.toLowerCase().includes(lowerSearch))
       );
     }
     setFilteredCreatives(result);
   }, [creatives, filterCampaign, filterType, searchTerm, campaignOptions]);

   useEffect(() => {
     filterAndSearchCreatives();
   }, [filterAndSearchCreatives]);

   const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
     const { name, value } = e.target;
     setFormData(prev => ({ ...prev, [name]: value }));
   };

   const handleSelectChange = (name: keyof Partial<Creative>) => (value: string) => {
     setFormData(prev => ({ ...prev, [name]: value === 'none' ? null : value }));
   };

   const handleMultiSelectChange = (name: 'platform') => (values: string[]) => {
     setFormData(prev => ({ ...prev, [name]: values }));
   };

   const handleDateChange = (date: Date | undefined) => {
     setFormDate(date);
     setFormData(prev => ({ ...prev, publish_date: date ? date.toISOString() : null }));
   };

   const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
     if (e.target.files && e.target.files.length > 0) {
       const file = e.target.files[0];
       if (formData.type === 'image' && !file.type.startsWith('image/')) {
         toast({ title: "Erro", description: "Selecione imagem.", variant: "destructive" });
         return;
       }
       if (formData.type === 'video' && !file.type.startsWith('video/')) {
         toast({ title: "Erro", description: "Selecione vídeo.", variant: "destructive" });
         return;
       }
       setFileToUpload(file);
       if (!formData.name) {
         setFormData(prev => ({ ...prev, name: file.name.replace(/\.[^/.]+$/, "") }));
       }
       setFormData(prev => ({ ...prev, content: '' }));
     } else {
       setFileToUpload(null);
     }
   };

   const openForm = (creative: Creative | null = null) => {
     setFileToUpload(null);
     if (creative) {
       setSelectedCreative(creative);
       setFormData({
         ...creative,
         platform: safeJsonParse(creative.platform),
         publish_date: creative.publish_date || null,
       });
        setFormDate(creative.publish_date && isValid(parseISO(creative.publish_date)) ? parseISO(creative.publish_date) : undefined);
     } else {
       setSelectedCreative(null);
       setFormData({ type: 'image', status: 'draft' });
       setFormDate(undefined);
     }
     setIsFormOpen(true);
   };

   const closeForm = () => {
     setIsFormOpen(false);
     setSelectedCreative(null);
     setFormData({});
     setFormDate(undefined);
     setFileToUpload(null);
   };

   const handleSave = async (e: React.FormEvent) => {
     e.preventDefault();
     if (!formData.name || !formData.type) {
       toast({ title: "Erro", description: "Nome e Tipo são obrigatórios.", variant: "destructive" });
       return;
     }
     const isMedia = ['image', 'video'].includes(formData.type);
     const hasContent = formData.content?.trim();

     if (isMedia && !fileToUpload && !hasContent) {
       toast({ title: "Erro", description: "Arquivo ou URL é obrigatório para Imagem/Vídeo.", variant: "destructive" });
       return;
     }
     if (!isMedia && !hasContent) {
       toast({ title: "Erro", description: "Texto é obrigatório para este tipo.", variant: "destructive" });
       return;
     }

     setIsSaving(true);
     let finalContent = formData.content || '';
     let finalOriginalFilename = selectedCreative?.originalFilename;

     try {
       if (isMedia && fileToUpload) {
         const uploadFormData = new FormData();
         uploadFormData.append('creativeFile', fileToUpload);
         if (formData.name) uploadFormData.append('name', formData.name);
         if (formData.campaign_id) uploadFormData.append('campaign_id', formData.campaign_id);

         const uploadResponse = await axios.post('/api/upload', uploadFormData, {
           headers: { 'Content-Type': 'multipart/form-data' }
         });

         if (!uploadResponse.data?.success || !uploadResponse.data?.filePath) {
           throw new Error(uploadResponse.data?.message || "Falha no upload do arquivo.");
         }

         finalContent = uploadResponse.data.filePath;
         finalOriginalFilename = uploadResponse.data.originalName;
       }

       const dataToSave: Partial<Omit<Creative, 'id' | 'created_at' | 'updated_at' | 'campaignName'>> = {
         ...formData,
         content: finalContent,
         originalFilename: finalOriginalFilename,
         platform: Array.isArray(formData.platform) ? JSON.stringify(formData.platform) : null,
         publish_date: formData.publish_date ? new Date(formData.publish_date).toISOString().split('.')[0]+"Z" : null,
         comments: formData.comments?.trim() === '' ? null : formData.comments,
       };

       let response;
       let savedCreative: Creative;

       if (selectedCreative) {
         response = await axios.put(`/api/creatives?id=${selectedCreative.id}`, dataToSave);
         savedCreative = response.data;
         savedCreative.platform = safeJsonParse(savedCreative.platform);
         savedCreative.content = typeof savedCreative.content === 'string' ? savedCreative.content : '';
         savedCreative.comments = savedCreative.comments ?? null;
         setCreatives(prev => prev.map(c => c.id === selectedCreative.id ? savedCreative : c));
         toast({ title: "Sucesso", description: "Criativo atualizado." });
       } else {
         response = await axios.post('/api/creatives', dataToSave);
         savedCreative = response.data;
         savedCreative.platform = safeJsonParse(savedCreative.platform);
         savedCreative.content = typeof savedCreative.content === 'string' ? savedCreative.content : '';
         savedCreative.comments = savedCreative.comments ?? null;
         setCreatives(prev => [savedCreative, ...prev]);
         toast({ title: "Sucesso", description: "Novo criativo adicionado." });
       }

       closeForm();
     } catch (error: any) {
       toast({
         title: "Erro ao Salvar",
         description: error.response?.data?.message || error.message || "Falha desconhecida.",
         variant: "destructive"
       });
     } finally {
       setIsSaving(false);
     }
   };

   const handleDelete = async (id: string) => {
     if (!confirm("Excluir?")) return;
     setIsDeleting(id);
     try {
       await axios.delete(`/api/creatives?id=${id}`);
       setCreatives(prev => prev.filter(c => c.id !== id));
       toast({ title: "Excluído", variant: "destructive" });
       if (selectedCreative?.id === id) {
         closeForm();
       }
       if(selectedCreativeDetail?.id === id){
           closeCreativeDetail();
       }
     } catch (error: any) {
       toast({
         title: "Erro",
         description: error.response?.data?.message || "Falha.",
         variant: "destructive"
       });
     } finally {
       setIsDeleting(null);
     }
   };

   const openCreativeDetail = (creative: Creative) => {
     setSelectedCreativeDetail(creative);
     setDetailComment(creative.comments || '');
     setIsDetailOpen(true);
     setPlayerKey(prevKey => prevKey + 1);
   };

   const closeCreativeDetail = () => {
     setIsDetailOpen(false);
     setSelectedCreativeDetail(null);
   };

   const handleSaveComment = async () => {
     if (!selectedCreativeDetail) return;
     setIsSavingComment(true);
     try {
       const creativeId = selectedCreativeDetail.id;
       await axios.put(`/api/creatives?id=${creativeId}`, { comments: detailComment });
       toast({ title: "Sucesso", description: "Comentário salvo." });
       setCreatives(prev => prev.map(c => c.id === creativeId ? { ...c, comments: detailComment || null } : c));
       setSelectedCreativeDetail(prev => prev ? { ...prev, comments: detailComment || null } : null);
     } catch (error: any) {
       toast({ title: "Erro", description: "Falha ao salvar comentário.", variant: "destructive" });
     } finally {
       setIsSavingComment(false);
     }
   };

   const getCreativePreview = (creative: Creative) => {
     const baseStyle = "w-full h-full object-contain bg-gray-900/50";
     const textStyle = "w-full h-full p-2 text-[10px] overflow-hidden text-ellipsis bg-gray-800/50 text-gray-300 flex items-center justify-center text-center";
     const iconContainerStyle = cn(baseStyle, "flex items-center justify-center", viewMode === 'list' ? '!h-16 !w-16 !rounded-md' : '!rounded-t-md');
     const mediaStyle = cn(baseStyle, viewMode === 'list' ? '!h-16 !w-16 !rounded-md' : '!rounded-t-md');
     const contentString = (typeof creative.content === 'string' ? creative.content : '').trim();

     try {
       if (!contentString && ['image', 'video', 'headline', 'body', 'cta'].includes(creative.type)) {
         return <div className={iconContainerStyle} title={`Conteúdo vazio (${creative.type})`}><AlertCircle className="h-6 w-6 text-yellow-500"/></div>;
       }

       let src = '/placeholder.png';
       let isValidSrc = false;
       let isLocalFile = false;

       if (contentString.startsWith('/uploads/')) {
         src = `/api/file${contentString}`;
         isValidSrc = true;
         isLocalFile = true;
       } else if (contentString.startsWith('http')) {
         src = contentString;
         isValidSrc = true;
       } else if (['headline', 'body', 'cta'].includes(creative.type)){
         isValidSrc = true;
       }

       if (creative.type === 'image' && isValidSrc && src !== '/placeholder.png') {
         return <img key={`${creative.id}-img-preview`} src={src} alt={creative.name} className={mediaStyle} loading="lazy" onError={(e) => { e.currentTarget.src = '/placeholder.png'; e.currentTarget.alt = 'Erro Img'; }} />;
       }

       if (creative.type === 'video' && isValidSrc && isLocalFile) {
         const thumbSrc = src.replace(/\.[^/.]+$/, "-thumb.jpg");
         return <img key={`${creative.id}-thumb-preview`} src={thumbSrc} alt={`${creative.name} (thumbnail)`} className={mediaStyle} loading="lazy" onError={(e) => {
           const target = e.currentTarget;
           target.onerror = null;
           const parent = target.parentElement;
           if (parent) {
             parent.innerHTML = '';
             const iconDiv = document.createElement('div');
             iconDiv.className = iconContainerStyle;
             iconDiv.title = creative.originalFilename || creative.name;
             iconDiv.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-video h-6 w-6 text-gray-400"><path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2" ry="2"/></svg>`;
             parent.appendChild(iconDiv);
           }
         }} />;
       }

       if (creative.type === 'video' && isValidSrc && !isLocalFile) {
         return <div className={iconContainerStyle} title={creative.name}><Video className="h-6 w-6 text-gray-400"/></div>;
       }

       if (['headline', 'body', 'cta'].includes(creative.type) && isValidSrc) {
         return <div className={cn(textStyle, viewMode === 'list' ? '!h-16 !w-16 !rounded-md' : '!rounded-t-md')} title={contentString}>{contentString}</div>;
       }

       return <div className={iconContainerStyle} title={`Conteúdo ou tipo inválido (${creative.type})`}><FileText className="h-6 w-6 text-gray-500"/></div>;
     } catch (error) {
       return <div className={iconContainerStyle} title="Erro inesperado no preview"><AlertCircle className="h-6 w-6 text-red-600"/></div>;
     }
   };

  const getVideoUrl = (content: string) => {
    if (content.startsWith('/uploads/')) {
      return `/api/file${content}`;
    }
    return content;
  };

  if (authLoading || isLoading) {
    return (
      <Layout>
        <div className="flex h-[calc(100vh-100px)] w-full items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-3 text-muted-foreground">{authLoading ? 'Verificando...' : 'Carregando...'}</span>
        </div>
      </Layout>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <Layout>
      <Head><title>Criativos - USBMKT</title></Head>
      <TooltipProvider delayDuration={0}>
        <div className="space-y-4 p-4 md:p-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-4">
            <h1 className="text-2xl font-black text-white" style={{ textShadow: `0 0 8px ${neonColor}` }}>Gerenciador de Criativos</h1>
            <Button className={cn(primaryButtonStyle, "h-9 text-sm")} onClick={() => openForm()}>
              <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Criativo
            </Button>
          </div>

          <Card className={cn(cardStyle, "p-3")}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
              <div>
                <Label htmlFor="filterCampaign" className={cn(labelStyle, "mb-1")}>Campanha</Label>
                <Select value={filterCampaign} onValueChange={setFilterCampaign} disabled={campaignsLoading}>
                  <SelectTrigger id="filterCampaign" className={cn(neumorphicInputStyle, "h-8 text-xs")} aria-label="Filtrar por Campanha">
                    <SelectValue placeholder={campaignsLoading ? "Carregando...": "Filtrar..."} />
                  </SelectTrigger>
                  <SelectContent className={cn(popoverContentStyle)}>
                    <SelectItem value="all">Todas</SelectItem>
                    {campaignOptions.map(c => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                    {!campaignsLoading && campaignOptions.length === 0 && <SelectItem value="none" disabled>Nenhuma campanha</SelectItem>}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="filterType" className={cn(labelStyle, "mb-1")}>Tipo</Label>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger id="filterType" className={cn(neumorphicInputStyle, "h-8 text-xs")} aria-label="Filtrar por Tipo">
                    <SelectValue placeholder="Filtrar..." />
                  </SelectTrigger>
                  <SelectContent className={cn(popoverContentStyle)}>
                    <SelectItem value="all">Todos</SelectItem>
                    {CREATIVE_TYPES.map(t => (<SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>

              <div className="relative lg:col-span-2">
                <Label htmlFor="searchTerm" className={cn(labelStyle, "mb-1")}>Buscar</Label>
                <Search className="absolute left-2 top-[calc(50%+2px)] h-4 w-4 text-gray-400" />
                <Input id="searchTerm" name="searchTerm" autoComplete="off" placeholder="Nome, conteúdo, campanha..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className={cn(neumorphicInputStyle, "h-8 text-xs pl-8")} />
              </div>
            </div>
          </Card>

          {isLoading ? (
            <div className="text-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" /></div>
          ) : filteredCreatives.length === 0 ? (
            <Card className={cn(cardStyle, "p-10 text-center")}><p className="text-gray-500">Nenhum criativo encontrado com os critérios atuais.</p></Card>
          ) : (
            <div className="flex justify-between mb-3 items-center">
              <div className="text-sm text-gray-400">{filteredCreatives.length} criativos encontrados</div>
              <div className="flex items-center gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" className={cn("h-8 w-8 p-0", viewMode === 'grid' ? "text-[#1E90FF] bg-blue-950/20" : "text-gray-400")} onClick={() => setViewMode('grid')}>
                      <Grid className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className={cn(popoverContentStyle, "text-xs p-1")}>Visualização em Grade</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" className={cn("h-8 w-8 p-0", viewMode === 'list' ? "text-[#1E90FF] bg-blue-950/20" : "text-gray-400")} onClick={() => setViewMode('list')}>
                      <List className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className={cn(popoverContentStyle, "text-xs p-1")}>Visualização em Lista</TooltipContent>
                </Tooltip>
              </div>
            </div>
          )}

          {filteredCreatives.length > 0 && (
            <div className={cn( viewMode === 'grid' ? "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4" : "flex flex-col gap-2" )}>
              {filteredCreatives.map(creative => (
                <Card key={creative.id} className={cn( cardStyle, viewMode === 'list' ? "flex flex-row items-center p-2" : "overflow-hidden", "transition-all duration-200 hover:shadow-[0_0_8px_rgba(30,144,255,0.4)] cursor-pointer relative" )} onClick={() => openCreativeDetail(creative)} >
                     {creative.status && <div className={getStatusBadgeClass(creative.status)}>{STATUS_OPTIONS.find(s => s.value === creative.status)?.label || 'Rascunho'}</div>}
                    {viewMode === 'grid' ? (
                        <>
                            <div className="aspect-square max-h-[200px] relative overflow-hidden"> {getCreativePreview(creative)} </div>
                            <CardContent className="p-3">
                                <h3 className="text-sm font-medium truncate text-white">{creative.name}</h3>
                                <div className="flex items-center gap-1 mt-1">
                                    {React.createElement( CREATIVE_TYPES.find(t => t.value === creative.type)?.icon || 'span', { className: "h-3 w-3 text-gray-400" } )}
                                    <span className="text-xs text-gray-400"> {CREATIVE_TYPES.find(t => t.value === creative.type)?.label || creative.type} </span>
                                </div>
                                {creative.campaign_id && ( <div className="text-[10px] truncate mt-1 text-gray-500"> {campaignOptions.find(c => c.id === creative.campaign_id)?.name || 'Campanha desconhecida'} </div> )}
                                {creative.comments && (
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                             <div className="absolute bottom-1 right-1"><FileText className="h-3 w-3 text-[#1E90FF]" /></div>
                                        </TooltipTrigger>
                                        <TooltipContent className={cn(popoverContentStyle, "text-xs p-1")}>Possui comentários</TooltipContent>
                                    </Tooltip>
                                )}
                            </CardContent>
                        </>
                    ) : (
                    <>
                        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md"> {getCreativePreview(creative)} </div>
                        <div className="ml-3 flex-1 min-w-0">
                            <h3 className="text-sm font-medium truncate text-white">{creative.name}</h3>
                            <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
                                <span className="flex items-center gap-1"> {React.createElement( CREATIVE_TYPES.find(t => t.value === creative.type)?.icon || 'span', { className: "h-3 w-3" } )} <span>{CREATIVE_TYPES.find(t => t.value === creative.type)?.label || creative.type}</span> </span>
                                {creative.campaign_id && ( <span className="truncate text-gray-500"> {campaignOptions.find(c => c.id === creative.campaign_id)?.name || 'Campanha desconhecida'} </span> )}
                            </div>
                        </div>
                        {creative.comments && (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                     <div className="mr-2"><FileText className="h-3 w-3 text-[#1E90FF]" /></div>
                                </TooltipTrigger>
                                <TooltipContent className={cn(popoverContentStyle, "text-xs p-1")}>Possui comentários</TooltipContent>
                            </Tooltip>
                        )}
                    </>
                    )}
                </Card>
              ))}
            </div>
          )}
        </div>
      </TooltipProvider>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className={cn(cardStyle, "max-w-2xl md:max-w-3xl")}>
          <DialogHeader>
            <DialogTitle className={titleStyle}>{selectedCreative ? 'Editar Criativo' : 'Novo Criativo'}</DialogTitle>
            <DialogDescription className="text-gray-400 text-sm">
                {selectedCreative ? 'Modifique os detalhes do criativo existente.' : 'Preencha as informações para adicionar um novo criativo.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name" className={labelStyle}>Nome *</Label>
                <Input id="name" name="name" value={formData.name || ''} onChange={handleInputChange} placeholder="Nome do criativo" className={neumorphicInputStyle} required />
              </div>

              <div>
                <Label htmlFor="type" className={labelStyle}>Tipo *</Label>
                <Select value={formData.type || ''} onValueChange={handleSelectChange('type')} required>
                  <SelectTrigger id="type" className={neumorphicInputStyle} aria-label="Tipo de Criativo">
                    <SelectValue placeholder="Selecione o tipo..." />
                  </SelectTrigger>
                  <SelectContent className={popoverContentStyle}>
                    {CREATIVE_TYPES.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        <span className="flex items-center">
                          <type.icon className="mr-2 h-4 w-4" />
                          {type.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="campaign_id" className={labelStyle}>Campanha</Label>
                <Select value={formData.campaign_id || 'none'} onValueChange={handleSelectChange('campaign_id')}>
                  <SelectTrigger id="campaign_id" className={neumorphicInputStyle} aria-label="Campanha">
                    <SelectValue placeholder="Selecione a campanha..." />
                  </SelectTrigger>
                  <SelectContent className={popoverContentStyle}>
                    <SelectItem value="none">Nenhuma</SelectItem>
                    {campaignOptions.map(campaign => (
                      <SelectItem key={campaign.id} value={campaign.id}>{campaign.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="status" className={labelStyle}>Status</Label>
                <Select value={formData.status || 'draft'} onValueChange={handleSelectChange('status')}>
                  <SelectTrigger id="status" className={neumorphicInputStyle} aria-label="Status">
                    <SelectValue placeholder="Selecione o status..." />
                  </SelectTrigger>
                  <SelectContent className={popoverContentStyle}>
                    {STATUS_OPTIONS.map(status => (
                      <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className={labelStyle}>Plataformas</Label>
                <MultiSelectPopover
                  options={PLATFORM_OPTIONS}
                  value={Array.isArray(formData.platform) ? formData.platform : []}
                  onChange={handleMultiSelectChange('platform')}
                  placeholder="Selecione..."
                  className={neumorphicInputStyle}
                  // contentClassName={popoverContentStyle} // <-- LINHA REMOVIDA
                />
              </div>

              <div>
                <Label htmlFor="publish_date" className={labelStyle}>Data de Publicação</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn(neumorphicInputStyle, "w-full justify-start text-left font-normal")} aria-label="Data de Publicação">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formDate ? format(formDate, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecione uma data...'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className={cn(popoverContentStyle, "w-auto p-0")}>
                    <Calendar
                      mode="single"
                      selected={formDate}
                      onSelect={handleDateChange}
                      initialFocus
                      locale={ptBR}
                      className="bg-[#1e2128]"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div>
              {['image', 'video'].includes(formData.type || '') ? (
                <>
                  <Label className={labelStyle}>{formData.type === 'image' ? 'Imagem' : 'Vídeo'} *</Label>
                  <div className="space-y-2">
                    {(formData.content && !fileToUpload) ? (
                      <div className="flex items-center gap-2 mb-2">
                        <div className="max-w-full overflow-hidden text-ellipsis flex-1">
                          <Badge variant="outline" className="flex items-center gap-1 max-w-full overflow-x-hidden">
                            {formData.type === 'image' ? <ImageIcon className="h-3 w-3" /> : <Video className="h-3 w-3" />}
                            <span className="text-xs truncate">
                              {formData.originalFilename || formData.content}
                            </span>
                          </Badge>
                        </div>
                        <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setFormData(prev => ({...prev, content: ''}))}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        {fileToUpload && (
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className="flex items-center gap-1 max-w-full overflow-x-hidden">
                              {formData.type === 'image' ? <ImageIcon className="h-3 w-3" /> : <Video className="h-3 w-3" />}
                              <span className="text-xs truncate">{fileToUpload.name}</span>
                            </Badge>
                            <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setFileToUpload(null)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}

                        <div className="flex gap-2">
                          <Button type="button" className={cn(neumorphicButtonStyle, "flex-1")} onClick={() => fileInputRef.current?.click()}>
                            <Upload className="mr-2 h-4 w-4" />
                            Upload {formData.type === 'image' ? 'Imagem' : 'Vídeo'}
                          </Button>

                          <input
                            ref={fileInputRef}
                            type="file"
                            className="hidden"
                            onChange={handleFileSelected}
                            accept={formData.type === 'image' ? 'image/*' : 'video/*'}
                          />

                          <div className="relative flex-1">
                            <Paperclip className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input
                              placeholder="Ou URL..."
                              name="content"
                              value={fileToUpload ? '' : (formData.content || '')}
                              onChange={handleInputChange}
                              className={cn(neumorphicInputStyle, "pl-8")}
                              disabled={!!fileToUpload}
                            />
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </>
              ) : ['headline', 'body', 'cta'].includes(formData.type || '') ? (
                <>
                  <Label htmlFor="content" className={labelStyle}>Texto *</Label>
                  <Textarea
                    id="content"
                    name="content"
                    value={formData.content || ''}
                    onChange={handleInputChange}
                    placeholder={formData.type === 'headline' ? 'Digite o título...' : formData.type === 'cta' ? 'Digite o CTA...' : 'Digite o texto...'}
                    className={neumorphicTextAreaStyle}
                    required
                  />
                </>
              ) : (
                <div className="text-center py-4 text-sm text-gray-400">
                  Selecione um tipo de criativo
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="comments" className={labelStyle}>Comentários</Label>
              <Textarea
                id="comments"
                name="comments"
                value={formData.comments || ''}
                onChange={handleInputChange}
                placeholder="Comentários, instruções ou notas sobre este criativo..."
                className={neumorphicTextAreaStyle}
              />
            </div>

            <DialogFooter className="gap-2 flex-wrap justify-end">
              <Button type="button" variant="outline" className={neumorphicButtonStyle} onClick={closeForm} disabled={isSaving}>
                Cancelar
              </Button>

              {selectedCreative && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => handleDelete(selectedCreative.id)}
                  disabled={isSaving || !!isDeleting}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  {isDeleting === selectedCreative.id ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Trash2 className="h-4 w-4 mr-1" />}
                  Excluir
                </Button>
              )}

              <Button type="submit" className={primaryButtonStyle} disabled={isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className={cn(cardStyle, "max-w-2xl md:max-w-4xl max-h-[90vh]")}>
          <DialogHeader>
            <DialogTitle className={titleStyle}>
              {selectedCreativeDetail?.name || 'Detalhes do Criativo'}
            </DialogTitle>
            <DialogDescription className="text-gray-400 text-xs flex items-center gap-2">
               {selectedCreativeDetail?.type && (
                <span className="flex items-center gap-1">
                  {React.createElement(
                    CREATIVE_TYPES.find(t => t.value === selectedCreativeDetail.type)?.icon || 'span',
                    { className: "h-3.5 w-3.5" }
                  )}
                  <span>{CREATIVE_TYPES.find(t => t.value === selectedCreativeDetail.type)?.label || selectedCreativeDetail.type}</span>
                </span>
              )}
              {selectedCreativeDetail?.status && (
                <Badge variant="outline" className={cn("text-[10px] h-5", statusColors[selectedCreativeDetail.status] || statusColors['draft'])}>
                  {STATUS_OPTIONS.find(s => s.value === selectedCreativeDetail.status)?.label || 'Rascunho'}
                </Badge>
              )}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[calc(90vh-200px)]">
            <div className="space-y-4 p-1">
              {selectedCreativeDetail?.campaign_id && (
                <div className="text-sm">
                  <Label className={labelStyle}>Campanha</Label>
                  <div className="text-white">
                    {campaignOptions.find(c => c.id === selectedCreativeDetail.campaign_id)?.name || 'Não especificada'}
                  </div>
                </div>
              )}

              {selectedCreativeDetail?.platform && Array.isArray(selectedCreativeDetail.platform) && selectedCreativeDetail.platform.length > 0 && (
                <div className="text-sm">
                  <Label className={labelStyle}>Plataformas</Label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selectedCreativeDetail.platform.map(p => (
                      <Badge key={p} variant="outline" className="text-[10px]">
                        {PLATFORM_OPTIONS.find(opt => opt.value === p)?.label || p}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {selectedCreativeDetail?.publish_date && (
                <div className="text-sm">
                  <Label className={labelStyle}>Data de Publicação</Label>
                  <div className="text-white flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {isValid(parseISO(selectedCreativeDetail.publish_date))
                      ? format(parseISO(selectedCreativeDetail.publish_date), 'dd/MM/yyyy', { locale: ptBR })
                      : selectedCreativeDetail.publish_date
                    }
                  </div>
                </div>
              )}

              <div className="bg-black/30 rounded-lg p-4 relative">
                <Label className={labelStyle}>Conteúdo</Label>

                {selectedCreativeDetail?.type === 'image' && selectedCreativeDetail.content && (
                  <div className="mt-2 text-center">
                    <img
                      src={selectedCreativeDetail.content.startsWith('/uploads/')
                        ? `/api/file${selectedCreativeDetail.content}`
                        : selectedCreativeDetail.content
                      }
                      alt={selectedCreativeDetail.name}
                      className="max-w-full max-h-[400px] object-contain mx-auto rounded"
                      onError={(e) => { e.currentTarget.src = '/placeholder.png'; e.currentTarget.alt = 'Erro ao carregar imagem'; }}
                    />
                    <div className="mt-2 flex justify-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className={neumorphicButtonStyle}
                        onClick={() => window.open(selectedCreativeDetail.content.startsWith('/uploads/')
                          ? `/api/file${selectedCreativeDetail.content}`
                          : selectedCreativeDetail.content, '_blank')}
                      >
                        <ExternalLink className="h-3.5 w-3.5 mr-1" />
                        Abrir Original
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className={neumorphicButtonStyle}
                        onClick={() => { closeCreativeDetail(); openForm(selectedCreativeDetail); }}
                      >
                        <Edit className="h-3.5 w-3.5 mr-1" />
                        Editar
                      </Button>
                    </div>
                  </div>
                )}

                {selectedCreativeDetail?.type === 'video' && selectedCreativeDetail.content && (
                  <div className="mt-2 text-center">
                    <div className="rounded overflow-hidden max-w-full bg-black/50 mx-auto" style={{ maxWidth: '560px' }}>
                      <div className="aspect-video">
                        <ReactPlayer
                          url={getVideoUrl(selectedCreativeDetail.content)}
                          controls
                          width="100%"
                          height="100%"
                          key={playerKey}
                          onError={(e) => console.error("Video error:", e)}
                        />
                      </div>
                    </div>
                    <div className="mt-2 flex justify-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className={neumorphicButtonStyle}
                        onClick={() => window.open(getVideoUrl(selectedCreativeDetail.content), '_blank')}
                      >
                        <ExternalLink className="h-3.5 w-3.5 mr-1" />
                        Abrir Original
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className={neumorphicButtonStyle}
                        onClick={() => { closeCreativeDetail(); openForm(selectedCreativeDetail); }}
                      >
                        <Edit className="h-3.5 w-3.5 mr-1" />
                        Editar
                      </Button>
                    </div>
                  </div>
                )}

                {['headline', 'body', 'cta'].includes(selectedCreativeDetail?.type || '') && selectedCreativeDetail?.content && (
                  <div className="mt-2">
                    <div className="bg-[#0c0c0c] text-white p-3 rounded border border-gray-800 whitespace-pre-wrap">
                      {selectedCreativeDetail.content}
                    </div>
                    <div className="mt-2 flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className={neumorphicButtonStyle}
                        onClick={() => {
                          navigator.clipboard.writeText(selectedCreativeDetail.content);
                          toast({ title: "Copiado", description: "Texto copiado para área de transferência" });
                        }}
                      >
                        <CopyIcon className="h-3.5 w-3.5 mr-1" />
                        Copiar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className={neumorphicButtonStyle}
                        onClick={() => { closeCreativeDetail(); openForm(selectedCreativeDetail); }}
                      >
                        <Edit className="h-3.5 w-3.5 mr-1" />
                        Editar
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label className={labelStyle}>Comentários</Label>
                </div>
                <div className="space-y-2">
                  <Textarea
                    value={detailComment}
                    onChange={(e) => setDetailComment(e.target.value)}
                    placeholder="Adicione comentários, instruções ou notas sobre este criativo..."
                    className={neumorphicTextAreaStyle}
                  />
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      variant="outline"
                      className={cn(primaryButtonStyle, "h-7 px-3 text-xs")}
                      onClick={handleSaveComment}
                      disabled={isSavingComment || detailComment === (selectedCreativeDetail?.comments || '')}
                    >
                      {isSavingComment ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
                      Salvar Comentário
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="mt-4">
            <DialogClose asChild>
              <Button className={neumorphicButtonStyle}>
                Fechar
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
