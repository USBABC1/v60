// pages/zap.tsx
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button"; // Importação do Button
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea, TextareaProps } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import Sidebar from "@/components/ui/sidebar";
import ElementCard from "@/components/dashboard/ElementCard"; // Importação do ElementCard
import { cn } from "@/lib/utils";
import { Users, Settings, BarChart2, Plus, RefreshCw, Send, Smartphone, PlugZap, Unplug, Save, Play, Square, Check, Activity, Workflow, Target, Hourglass, Bell, ShieldCheck, UserCircle, Search, Clock, HelpCircle, ArrowRight, X } from 'lucide-react'; // Ícones relevantes
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"; // Manter TooltipProvider importado
import { ReactFlowProvider } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dynamic from 'next/dynamic';
import { ScrollArea } from "@/components/ui/scroll-area";
import { AppSettings, Contact } from '@/types/zap';
import { IconWithGlow, NEON_COLOR, baseButtonSelectStyle, baseCardStyle, baseInputInsetStyle, popoverContentStyle } from '@/components/flow/utils';
// Importar o LeftSidebarProvider e o hook
import { LeftSidebarProvider, useLeftSidebarContext } from '@/context/LeftSidebarContext';
import { useAuth } from '@/context/AuthContext'; // Importar useAuth
import { useRouter } from 'next/router'; // Adicionado: Importar useRouter

// --- Componentes Dinâmicos ---
const QRCodeDynamic = dynamic(() => import('qrcode.react').then(mod => mod.QRCodeSVG), {
  ssr: false,
  loading: () => <p className="text-xs text-gray-400" style={{ textShadow: `0 0 4px ${NEON_COLOR}` }}>Carregando QR Code...</p>
});

// --- Componente Principal (WhatsAppDashboard) ---
function WhatsAppDashboard() {
    const { toast } = useToast();
    // Autenticação e Router devem estar no wrapper ou _app
    // const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
    // const router = useRouter(); // useRouter agora está no wrapper WhatsAppPage

    const [activeTab, setActiveTab] = useState("dashboard");
    const [isConnected, setIsConnected] = useState(false);
    const [qrCode, setQrCode] = useState<string | null>(null);
    const [isConnecting, setIsConnecting] = useState(false);
    const [settings, setSettings] = useState<AppSettings>({ defaultMessageDelayMs: 500, unknownMessageResponse: 'ignore', defaultReplyMessage: 'Desculpe, não entendi.', adminForwardNumber: '', defaultInputTimeoutSeconds: 60, enableBusinessHours: false, businessHoursStart: '09:00', businessHoursEnd: '18:00', outsideHoursMessage: 'Atendimento fora do horário.', });
    const [isSavingSettings, setIsSavingSettings] = useState(false);
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [isLoadingContacts, setIsLoadingContacts] = useState(false);
    const [hasAttemptedContactFetch, setHasAttemptedContactFetch] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [contactFetchTimeoutId, setContactFetchTimeoutId] = useState<NodeJS.Timeout | null>(null);

    // Usar o contexto da sidebar esquerda para a margem do main
    const { isLeftCollapsed } = useLeftSidebarContext(); // Usar o hook do contexto

    // Larguras da sidebar esquerda (ajuste conforme o CSS real)
    const leftSidebarWidthExpanded = "60"; // Tailwind: ml-60
    const leftSidebarWidthCollapsed = "16"; // Tailwind: ml-16

    // Classe de margem esquerda dinâmica
    const marginLeftClass = isLeftCollapsed ? `ml-${leftSidebarWidthCollapsed}` : `ml-${leftSidebarWidthExpanded}`;

    // Redirecionar se não autenticado (após carregar) - Mover para o wrapper ou _app se necessário
    // useEffect(() => {
    //     if (!isAuthLoading && !isAuthenticated) {
    //         router.push('/login');
    //     }
    // }, [isAuthenticated, isAuthLoading, router]);


    // --- Funções de Conexão ---
    const checkConnectionStatus = useCallback(async () => {
        try {
            const response = await fetch('/api/whatsapp/status');
            if (!response.ok) { throw new Error('Falha ao verificar status'); }
            const data = await response.json();
            setIsConnected(data.status === 'connected');
            setQrCode(data.qrCodeString || null);
            setIsConnecting(data.status === 'connecting');
        } catch (error: any) {
            console.error("[checkConnectionStatus] Erro:", error.message);
            setIsConnected(false); setQrCode(null); setIsConnecting(false);
        }
    }, []);

    useEffect(() => { checkConnectionStatus(); const intervalId = setInterval(checkConnectionStatus, 7000); return () => clearInterval(intervalId); }, [checkConnectionStatus]);

    const connectWhatsApp = useCallback(async () => {
        if (isConnecting || isConnected) return;
        toast({ title: "Iniciando conexão..." });
        setIsConnecting(true); setQrCode(null);
        try {
            const response = await fetch('/api/whatsapp/connect', { method: 'POST' });
            if (!response.ok) { let errMsg = 'Falha conexão'; try { const err = await response.json(); errMsg = err.message || errMsg; } catch(e){} throw new Error(errMsg); }
            toast({ title: "Solicitação enviada! Aguarde o QR Code." });
        } catch (error: any) {
            toast({ title: "Erro Conexão", description: error.message, variant: "destructive" });
            setIsConnecting(false);
        }
    }, [toast, isConnecting, isConnected]);

    const disconnectWhatsApp = useCallback(async () => {
        if (!isConnected) return;
        toast({ title: "Desconectando..." });
        setIsConnecting(true);
        try {
            const response = await fetch('/api/whatsapp/disconnect', { method: 'POST' });
            if (!response.ok) { let errMsg = 'Falha desconexão'; try { const err = await response.json(); errMsg = err.message || errMsg; } catch(e){} throw new Error(errMsg); }
            toast({ title: "WhatsApp Desconectado" });
            setContacts([]); setHasAttemptedContactFetch(false); setIsConnected(false);
        } catch (error: any) {
            toast({ title: "Erro Desconexão", description: error.message, variant: "destructive" });
        } finally {
            setIsConnecting(false);
        }
    }, [toast, isConnected]);

    // --- Funções de Contatos ---
    const fetchContacts = useCallback(async () => {
        if (contactFetchTimeoutId) { clearTimeout(contactFetchTimeoutId); setContactFetchTimeoutId(null); }
        if (isLoadingContacts || !isConnected) { if (!isConnected) setHasAttemptedContactFetch(false); return; }
        setIsLoadingContacts(true); setHasAttemptedContactFetch(true);
        try {
            const response = await fetch('/api/whatsapp/contacts');
            if (!response.ok) { const errData = await response.text(); let errMsg = `Falha (Status: ${response.status})`; try { const errJson = JSON.parse(errData); errMsg = errJson.message || errMsg; } catch (e) { errMsg = `${errMsg}: ${errData}`; } throw new Error(errMsg); }
            const data: Contact[] = await response.json();
            data.sort((a, b) => (a.name || a.notify || a.jid).localeCompare(b.name || b.notify || b.jid));
            setContacts(data);
        } catch (error: any) {
            toast({ title: "Erro ao Carregar Contatos", description: error.message, variant: "destructive" }); setContacts([]);
        } finally { setIsLoadingContacts(false); }
    }, [isConnected, isLoadingContacts, toast, contactFetchTimeoutId]);

    useEffect(() => {
        if (contactFetchTimeoutId) { clearTimeout(contactFetchTimeoutId); setContactFetchTimeoutId(null); }
        if (activeTab === 'contacts' && isConnected && !isLoadingContacts && !hasAttemptedContactFetch) {
            const timeoutId = setTimeout(() => { fetchContacts(); setContactFetchTimeoutId(null); }, 3000);
            setContactFetchTimeoutId(timeoutId);
        }
        if (activeTab !== 'contacts' || !isConnected) {
            if (hasAttemptedContactFetch || contactFetchTimeoutId) { if (contactFetchTimeoutId) clearTimeout(contactFetchTimeoutId); setContactFetchTimeoutId(null); setHasAttemptedContactFetch(false); }
        }
        return () => { if (contactFetchTimeoutId) { clearTimeout(contactFetchTimeoutId); } };
    }, [activeTab, isConnected, isLoadingContacts, hasAttemptedContactFetch, fetchContacts, contactFetchTimeoutId]);

    useEffect(() => { if (!isConnected) { setContacts([]); if (contactFetchTimeoutId) { clearTimeout(contactFetchTimeoutId); setContactFetchTimeoutId(null); } } }, [isConnected, contactFetchTimeoutId]);

    const filteredContacts = useMemo(() => {
        if (!searchTerm) return contacts;
        const lowerSearchTerm = searchTerm.toLowerCase();
        return contacts.filter(c =>
            (c.name && c.name.toLowerCase().includes(lowerSearchTerm)) ||
            (c.notify && c.notify.toLowerCase().includes(lowerSearchTerm)) ||
            c.jid.includes(lowerSearchTerm)
        );
    }, [contacts, searchTerm]);

    // --- Funções de Configurações ---
    const handleSettingChange = useCallback((key: keyof AppSettings, value: any) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    }, []);

    const saveSettings = useCallback(async () => {
        setIsSavingSettings(true);
        console.log("Salvando configurações (simulado):", settings);
        // TODO: Implementar chamada API real para salvar settings
        try {
            await new Promise(resolve => setTimeout(resolve, 1000));
             toast({ title: "Configurações Salvas (Simulado)" });
        } catch (error: any) {
             toast({ title: "Erro ao Salvar Configurações", description: error.message, variant: "destructive" });
        } finally {
            setIsSavingSettings(false);
        }
    }, [settings, toast]);

    useEffect(() => {
        console.log("Carregando configurações (simulado)...");
    }, [/* toast */]);


    // --- Outros ---
    const dashboardStatsValues = useMemo(() => ({
        activeConversations: Math.floor(Math.random() * 5),
    }), []);

    // Renderizar null ou loading se autenticação estiver pendente
    // if (isAuthLoading || !isAuthenticated) {
    //     return null; // Ou um spinner de loading global
    // }


    return (
        // TooltipProvider REMOVIDO daqui
        <div className="flex h-screen bg-[#1a1a1a]">
            {/* SIDEBAR (USA CONTEXTO INTERNAMENTE) - NÃO PASSE MAIS PROPS isCollapsed/toggleSidebar */}
            <Sidebar />
            {/* MAIN COM MARGEM ESQUERDA DINÂMICA (DO CONTEXTO) */}
            <main className={cn(
                `flex-1 transition-all duration-300 ease-in-out ${marginLeftClass} p-4 flex flex-col gap-4 overflow-y-auto`
                // Agente MCP é um painel fixo global, NÃO afeta a margem direita aqui
            )}>
                 {/* Top Bar */}
                 <div className="flex justify-between items-center flex-shrink-0">
                         <h1 className="text-xl md:text-2xl font-bold text-white" style={{ textShadow: `0 0 6px ${NEON_COLOR}, 0 0 10px ${NEON_COLOR}` }}>
                             WhatsApp Dashboard
                         </h1>
                         {isConnecting && !qrCode ? (
                            <Button variant="secondary" size="sm" className={cn(baseButtonSelectStyle, 'opacity-70 cursor-not-allowed h-8 px-3')} disabled> <Activity className='mr-2 h-4 w-4 animate-spin' style={{ filter: `drop-shadow(0 0 4px ${NEON_COLOR})` }}/> Conectando... </Button>
                         ) : isConnected ? (
                            <Button onClick={disconnectWhatsApp} variant="destructive" size="sm" className={cn(baseButtonSelectStyle, 'hover:!bg-red-500/30 !text-red-400 h-8 px-3')} disabled={isConnecting}> <Unplug className='mr-2 h-4 w-4' style={{ filter: `drop-shadow(0 0 4px #ef4444)` }}/> Desconectar </Button>
                         ) : (
                            <Button onClick={connectWhatsApp} variant="default" size="sm" className={cn(baseButtonSelectStyle, `hover:!bg-[${NEON_COLOR}]/30 h-8 px-3`)} disabled={isConnecting}> <PlugZap className='mr-2 h-4 w-4' style={{ filter: `drop-shadow(0 0 4px ${NEON_COLOR})` }}/> Conectar WhatsApp </Button>
                         )}
                     </div>

                     {/* Abas */}
                     <Tabs defaultValue="dashboard" value={activeTab} onValueChange={setActiveTab} className="flex-grow flex flex-col space-y-3 min-h-0">
                        <TabsList className={cn("p-1 flex-shrink-0 rounded-lg w-full justify-start", baseInputInsetStyle)}>
                            <TabsTrigger value="dashboard" className={cn("tab-trigger text-xs px-3 py-1.5 rounded", baseButtonSelectStyle, `data-[state=active]:!shadow-[inset_2px_2px_4px_rgba(0,0,0,0.3),inset_-2px_-2px_4px_rgba(255,255,255,0.05)] data-[state=active]:!bg-[${NEON_COLOR}]/20`)} style={{ textShadow: `0 0 4px ${NEON_COLOR}` }}> <BarChart2 className="tab-icon h-3.5 w-3.5 mr-1.5" style={{ filter: `drop-shadow(0 0 4px ${NEON_COLOR})` }}/>Dashboard </TabsTrigger>
                            <TabsTrigger value="contacts" className={cn("tab-trigger text-xs px-3 py-1.5 rounded", baseButtonSelectStyle, `data-[state=active]:!shadow-[inset_2px_2px_4px_rgba(0,0,0,0.3),inset_-2px_-2px_4px_rgba(255,255,255,0.05)] data-[state=active]:!bg-[${NEON_COLOR}]/20`)} style={{ textShadow: `0 0 4px ${NEON_COLOR}` }}> <Users className="tab-icon h-3.5 w-3.5 mr-1.5" style={{ filter: `drop-shadow(0 0 4px ${NEON_COLOR})` }}/>Contatos </TabsTrigger>
                            <TabsTrigger value="settings" className={cn("tab-trigger text-xs px-3 py-1.5 rounded", baseButtonSelectStyle, `data-[state=active]:!shadow-[inset_2px_2px_4px_rgba(0,0,0,0.3),inset_-2px_-2px_4px_rgba(255,255,255,0.05)] data-[state=active]:!bg-[${NEON_COLOR}]/20`)} style={{ textShadow: `0 0 4px ${NEON_COLOR}` }}> <Settings className="tab-icon h-3.5 w-3.5 mr-1.5" style={{ filter: `drop-shadow(0 0 4px ${NEON_COLOR})` }}/>Config. </TabsTrigger>
                        </TabsList>

                        {/* Conteúdo da Aba Dashboard */}
                        <TabsContent value="dashboard" className="flex-grow overflow-y-auto space-y-4 pr-1 custom-scrollbar min-h-0">
                             {!isConnected && !isConnecting && !qrCode && ( <Card className={cn(baseCardStyle, "h-40 flex items-center justify-center")}> <p className="text-gray-400 text-center text-sm" style={{ textShadow: `0 0 4px ${NEON_COLOR}50` }}>WhatsApp Desconectado.<br/>Clique em "Conectar WhatsApp" acima.</p> </Card> )}
                             {isConnecting && !qrCode && !isConnected && ( <Card className={cn(baseCardStyle, "h-40 flex items-center justify-center")}> <Activity className="h-5 w-5 animate-spin mr-2 text-[#1E90FF]" style={{ filter: `drop-shadow(0 0 5px ${NEON_COLOR})` }}/><p className="text-gray-400 text-sm" style={{ textShadow: `0 0 4px ${NEON_COLOR}50` }}>Solicitando conexão, aguarde...</p></Card> )}
                             {qrCode && !isConnected && ( <div className={cn(baseCardStyle, "p-4 flex flex-col items-center justify-center")}> <p className="text-white text-sm mb-2" style={{ textShadow: `0 0 4px ${NEON_COLOR}` }}>Escaneie o QR Code com seu WhatsApp:</p> <div className="bg-white p-2 rounded"> <QRCodeDynamic value={qrCode} size={192} level={"L"} /> </div> <p className="text-xs text-gray-400 mt-2" style={{ textShadow: `0 0 4px ${NEON_COLOR}50` }}>Aguardando leitura...</p> </div> )}

                            {isConnected && (
                                <div className='space-y-4'>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                        <ElementCard icon={Check} label="Status" value="Conectado" iconColorClass='text-green-500'/>
                                        <ElementCard icon={Users} label="Conversas Ativas" value={dashboardStatsValues.activeConversations.toString()} />
                                        <ElementCard icon={Workflow} label="Fluxos do Bot" value={"Gerenciar"} actionComponent={
                                            <Link href="/flow" passHref>
                                                <Button className={cn(baseButtonSelectStyle, `hover:!bg-[${NEON_COLOR}]/30 h-6 text-[10px] px-2 rounded`)}><ArrowRight className="h-3 w-3" /></Button>
                                        </Link>
                                        } />
                                    </div>
                                    <div className="mt-6 text-center">
                                         <Link href="/flow" passHref>
                                             <Button className={cn(baseButtonSelectStyle, `hover:!bg-[${NEON_COLOR}]/30 h-10 text-base px-6 rounded-lg`)}>
                                                 <Workflow className="mr-2 h-5 w-5" /> Acessar Editor de Fluxos
                                             </Button>
                                         </Link>
                                    </div>
                                    <Card className={cn(baseCardStyle, "mt-6")}>
                                        <CardHeader><CardTitle className="text-sm font-medium text-white" style={{ textShadow: `0 0 5px ${NEON_COLOR}` }}>Atividade Recente</CardTitle></CardHeader>
                                        <CardContent><p className='text-gray-400 text-xs' style={{ textShadow: `0 0 4px ${NEON_COLOR}50` }}>Gráficos e logs de atividade aqui...</p></CardContent>
                                    </Card>
                                </div>
                            )}
                        </TabsContent>

                        {/* Conteúdo da Aba Contatos */}
                         <TabsContent value="contacts" className="flex-grow flex flex-col space-y-3 m-0 p-0 border-none rounded-lg overflow-hidden min-h-0">
                            <Card className={cn(baseCardStyle, "flex flex-col h-full")}>
                                <CardHeader className="flex-shrink-0 border-b border-[#1E90FF]/20 pb-2">
                                    <div className="flex justify-between items-center">
                                        <CardTitle className="text-base font-semibold text-white flex items-center" style={{ textShadow: `0 0 5px ${NEON_COLOR}` }}>
                                            <IconWithGlow icon={Users} className="mr-2 h-5 w-5"/> Contatos ({contacts.length})
                                        </CardTitle>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button
                                                    variant="ghost" size="icon"
                                                    onClick={() => { if (contactFetchTimeoutId) clearTimeout(contactFetchTimeoutId); setContactFetchTimeoutId(null); setHasAttemptedContactFetch(false); fetchContacts(); }}
                                                    disabled={!isConnected || isLoadingContacts}
                                                    className={cn(baseButtonSelectStyle, "w-8 h-8 rounded")} >
                                                    {isLoadingContacts ? <Activity className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent className={cn(popoverContentStyle, 'text-xs')}>Atualizar Lista</TooltipContent>
                                        </Tooltip>
                                    </div>
                                     <div className="relative mt-2">
                                        <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                                        <Input type="search" placeholder="Buscar por nome ou número..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className={cn(baseInputInsetStyle, "h-8 text-xs rounded pl-8")} disabled={!isConnected && !isLoadingContacts} />
                                    </div>
                                </CardHeader>
                                <CardContent className="flex-grow p-0 overflow-hidden">
                                    <ScrollArea className="h-full">
                                        <div className="p-3 space-y-2">
                                            {!isConnected ? ( <p className='text-gray-400 text-center text-xs py-10' style={{ textShadow: `0 0 4px ${NEON_COLOR}50` }}>Conecte o WhatsApp para ver os contatos.</p> )
                                            : isLoadingContacts ? ( <div className='flex justify-center items-center py-10'><Activity className="h-5 w-5 animate-spin mr-2 text-[#1E90FF]" style={{ filter: `drop-shadow(0 0 5px ${NEON_COLOR})` }}/><p className="text-gray-400 text-sm" style={{ textShadow: `0 0 4px ${NEON_COLOR}50` }}>Carregando contatos...</p></div> )
                                            : contacts.length === 0 && hasAttemptedContactFetch ? ( <p className='text-gray-400 text-center text-xs py-10' style={{ textShadow: `0 0 4px ${NEON_COLOR}50` }}>Nenhum contato sincronizado.<br/>Tente atualizar.</p> )
                                            : filteredContacts.length === 0 && searchTerm ? ( <p className='text-gray-400 text-center text-xs py-10' style={{ textShadow: `0 0 4px ${NEON_COLOR}50` }}>Nenhum contato encontrado para "{searchTerm}".</p> )
                                            : filteredContacts.length === 0 && contacts.length > 0 && !searchTerm ? ( <p className='text-gray-400 text-center text-xs py-10' style={{ textShadow: `0 0 4px ${NEON_COLOR}50` }}>Contatos carregados, mas nenhum visível.</p> )
                                            : filteredContacts.length === 0 && !hasAttemptedContactFetch && !isLoadingContacts ? ( <p className='text-gray-400 text-center text-xs py-10' style={{ textShadow: `0 0 4px ${NEON_COLOR}50` }}>Clique em <RefreshCw className="inline h-3 w-3 mx-1" /> para carregar.</p> )
                                            : (
                                                filteredContacts.map(contact => (
                                                    <div key={contact.jid} className={cn(baseCardStyle, 'p-2 flex items-center space-x-3 hover:bg-[#1E90FF]/10 transition-colors duration-150 rounded-md cursor-default')}>
                                                        <div className="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0">
                                                            {contact.imgUrl ? ( <img src={contact.imgUrl} alt="Avatar" className="w-full h-full rounded-full object-cover" onError={(e) => (e.currentTarget.style.display = 'none')} onLoad={(e) => (e.currentTarget.style.display = 'block')} style={{ display: 'none' }} /> ) : ( <UserCircle className="h-4 w-4 text-gray-400" /> )}
                                                        </div>
                                                        <div className="flex-grow overflow-hidden">
                                                            <p className="text-xs font-medium text-white truncate" title={contact.name || contact.notify || contact.jid.split('@')[0]} style={{ textShadow: `0 0 4px ${NEON_COLOR}` }}>{contact.name || contact.notify || 'Nome Desconhecido'}</p>
                                                            <p className="text-[10px] text-gray-400" title={contact.jid} style={{ textShadow: `0 0 3px ${NEON_COLOR}50` }}>{contact.jid.split('@')[0]}</p>
                                                        </div>
                                                         <Tooltip>
                                                             <TooltipTrigger asChild>
                                                                 <Button variant="ghost" size="icon" className={cn(baseButtonSelectStyle, "w-6 h-6 rounded hover:!bg-[${NEON_COLOR}]/30")} onClick={() => alert(`Iniciar conversa com ${contact.jid} (Não implementado)`)}>
                                                                     <Send className="h-3 w-3" />
                                                                 </Button>
                                                             </TooltipTrigger>
                                                             <TooltipContent className={cn(popoverContentStyle, 'text-xs')}>Enviar Mensagem</TooltipContent>
                                                         </Tooltip>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </ScrollArea>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        {/* Conteúdo da Aba Configurações */}
                        <TabsContent value="settings" className="flex-grow overflow-y-auto space-y-4 pr-1 custom-scrollbar min-h-0">
                             <Card className={cn(baseCardStyle)}>
                                <CardHeader>
                                    <CardTitle className="text-base font-semibold text-white flex items-center" style={{ textShadow: `0 0 5px ${NEON_COLOR}` }}>
                                        <IconWithGlow icon={Settings} className="mr-2 h-5 w-5"/>Configurações Gerais
                                    </CardTitle>
                                    <CardDescription className="text-xs text-gray-400" style={{ textShadow: `0 0 3px ${NEON_COLOR}50` }}>Ajustes globais do comportamento do bot.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-5">
                                    <div className="space-y-3">
                                        <h4 className='text-sm font-medium text-white border-b border-[#1E90FF]/20 pb-1 mb-2' style={{ textShadow: `0 0 4px ${NEON_COLOR}` }}>Comportamento</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3 items-center">
                                            <div className="space-y-1">
                                                <Label className="text-xs text-gray-300 flex items-center" htmlFor="defaultDelay" style={{ textShadow: `0 0 3px ${NEON_COLOR}50` }}><Clock className="mr-1.5 h-3.5 w-3.5"/> Atraso Padrão (ms)</Label>
                                                <Input id="defaultDelay" type="number" value={settings.defaultMessageDelayMs} onChange={(e) => handleSettingChange('defaultMessageDelayMs', parseInt(e.target.value) || 0)} className={cn(baseInputInsetStyle, "h-8 text-xs rounded")} placeholder="Ex: 500" />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-xs text-gray-300 flex items-center" htmlFor="inputTimeout" style={{ textShadow: `0 0 3px ${NEON_COLOR}50` }}><Hourglass className="mr-1.5 h-3.5 w-3.5"/> Timeout Espera Input (s)</Label>
                                                <Input id="inputTimeout" type="number" value={settings.defaultInputTimeoutSeconds} onChange={(e) => handleSettingChange('defaultInputTimeoutSeconds', parseInt(e.target.value) || 0)} className={cn(baseInputInsetStyle, "h-8 text-xs rounded")} placeholder="Ex: 60" />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-xs text-gray-300 flex items-center" htmlFor="unknownResponse" style={{ textShadow: `0 0 3px ${NEON_COLOR}50` }}><HelpCircle className="mr-1.5 h-3.5 w-3.5"/> Msg Desconhecida</Label>
                                                <Select value={settings.unknownMessageResponse} onValueChange={(v: AppSettings['unknownMessageResponse']) => handleSettingChange('unknownMessageResponse', v)}>
                                                    <SelectTrigger id="unknownResponse" className={cn(baseButtonSelectStyle, "h-8 text-xs rounded")}> <SelectValue /> </SelectTrigger>
                                                    <SelectContent className={cn(popoverContentStyle)}>
                                                        <SelectItem value="ignore" className="text-xs hover:!bg-[rgba(30,144,255,0.2)] focus:!bg-[rgba(30,144,255,0.2)]">Ignorar</SelectItem>
                                                        <SelectItem value="defaultReply" className="text-xs hover:!bg-[rgba(30,144,255,0.2)] focus:!bg-[rgba(30,144,255,0.2)]">Resposta Padrão</SelectItem>
                                                        <SelectItem value="forwardAdmin" className="text-xs hover:!bg-[rgba(30,144,255,0.2)] focus:!bg-[rgba(30,144,255,0.2)]">Encaminhar Admin</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            {settings.unknownMessageResponse === 'forwardAdmin' && (
                                                <div className="space-y-1">
                                                    <Label className="text-xs text-gray-300 flex items-center" htmlFor="adminNumber" style={{ textShadow: `0 0 3px ${NEON_COLOR}50` }}><Smartphone className="mr-1.5 h-3.5 w-3.5"/> Nº Admin (JID)</Label>
                                                    <Input id="adminNumber" value={settings.adminForwardNumber} onChange={(e) => handleSettingChange('adminForwardNumber', e.target.value)} className={cn(baseInputInsetStyle, "h-8 text-xs rounded")} placeholder="5511999998888@s.whatsapp.net" />
                                                </div>
                                            )}
                                        </div>
                                        {settings.unknownMessageResponse === 'defaultReply' && (
                                            <div className="space-y-1">
                                                <Label className="text-xs text-gray-300 flex items-center" htmlFor="defaultReplyMsg" style={{ textShadow: `0 0 3px ${NEON_COLOR}50` }}><Send className="mr-1.5 h-3.5 w-3.5"/> Mensagem Padrão</Label>
                                                <Textarea id="defaultReplyMsg" value={settings.defaultReplyMessage} onChange={(e) => handleSettingChange('defaultReplyMessage', e.target.value)} className={cn(baseInputInsetStyle, "text-xs rounded min-h-[60px]")} placeholder="Sua mensagem padrão..." rows={2} />
                                            </div>
                                        )}
                                    </div>
                                    <div className="space-y-3 pt-3 border-t border-[#1E90FF]/10">
                                        <div className='flex justify-between items-center'>
                                            <h4 className='text-sm font-medium text-white' style={{ textShadow: `0 0 4px ${NEON_COLOR}` }}>Horário Comercial</h4>
                                            <Switch id="enableBusinessHours" checked={settings.enableBusinessHours} onCheckedChange={(checked) => handleSettingChange('enableBusinessHours', checked)} className="data-[state=checked]:bg-green-600 data-[state=unchecked]:bg-gray-600 border-transparent" />
                                        </div>
                                        {settings.enableBusinessHours && (
                                            <div className="space-y-3">
                                                 <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3 items-center">
                                                    <div className="space-y-1">
                                                        <Label className="text-xs text-gray-300 flex items-center" htmlFor="bhStart" style={{ textShadow: `0 0 3px ${NEON_COLOR}50` }}><Play className="mr-1.5 h-3.5 w-3.5"/> Início (HH:MM)</Label>
                                                        <Input id="bhStart" type="time" value={settings.businessHoursStart} onChange={(e) => handleSettingChange('businessHoursStart', e.target.value)} className={cn(baseInputInsetStyle, "h-8 text-xs rounded")} />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <Label className="text-xs text-gray-300 flex items-center" htmlFor="bhEnd" style={{ textShadow: `0 0 3px ${NEON_COLOR}50` }}><Square className="mr-1.5 h-3.5 w-3.5"/> Fim (HH:MM)</Label>
                                                        <Input id="bhEnd" type="time" value={settings.businessHoursEnd} onChange={(e) => handleSettingChange('businessHoursEnd', e.target.value)} className={cn(baseInputInsetStyle, "h-8 text-xs rounded")} />
                                                    </div>
                                                 </div>
                                                <div className="space-y-1">
                                                    <Label className="text-xs text-gray-300 flex items-center" htmlFor="outsideHoursMsg" style={{ textShadow: `0 0 3px ${NEON_COLOR}50` }}><Send className="mr-1.5 h-3.5 w-3.5"/> Mensagem Fora do Horário</Label>
                                                    <Textarea id="outsideHoursMsg" value={settings.outsideHoursMessage} onChange={(e) => handleSettingChange('outsideHoursMessage', e.target.value)} className={cn(baseInputInsetStyle, "text-xs rounded min-h-[60px]")} placeholder="Sua mensagem fora do horário..." rows={2} />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                     <div className="flex justify-end pt-4 border-t border-[#1E90FF]/10">
                                         <Button onClick={saveSettings} className={cn(baseButtonSelectStyle, `hover:!bg-[${NEON_COLOR}]/30 h-9 text-sm px-4 rounded`)} disabled={isSavingSettings}>
                                            {isSavingSettings ? <Activity className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                            {isSavingSettings ? "Salvando..." : "Salvar Configurações"}
                                         </Button>
                                     </div>
                                </CardContent>
                             </Card>
                            <Card className={cn(baseCardStyle)}>
                                <CardHeader><CardTitle className="text-base font-semibold text-white flex items-center" style={{ textShadow: `0 0 5px ${NEON_COLOR}` }}><Bell className="mr-2 h-5 w-5"/> Notificações</CardTitle></CardHeader>
                                <CardContent><p className='text-gray-400 text-xs' style={{ textShadow: `0 0 4px ${NEON_COLOR}50` }}>Configurações de notificação - Futuro.</p></CardContent>
                            </Card>
                             <Card className={cn(baseCardStyle)}>
                                <CardHeader><CardTitle className="text-base font-semibold text-white flex items-center" style={{ textShadow: `0 0 5px ${NEON_COLOR}` }}><ShieldCheck className="mr-2 h-5 w-5"/> Segurança & API</CardTitle></CardHeader>
                                <CardContent><p className='text-gray-400 text-xs' style={{ textShadow: `0 0 4px ${NEON_COLOR}50` }}>Configurações de API e segurança - Futuro.</p></CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>
                </main>
            </div>
        // TooltipProvider REMOVIDO daqui
    );
}

// --- Wrapper da Página ---
export default function WhatsAppPage() {
    const { isAuthenticated, isLoading } = useAuth();
    const router = useRouter(); // Adicionado: Usar useRouter aqui

    // Redirecionar se não autenticado (após carregar)
    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            router.push('/login');
        }
    }, [isAuthenticated, isLoading, router]);

    if (isLoading || !isAuthenticated) {
        // Renderizar um placeholder ou null enquanto carrega/redireciona
        return null;
    }

    return (
        // Envolver a página com LeftSidebarProvider E TooltipProvider
        <LeftSidebarProvider>
            <ReactFlowProvider>
                 <TooltipProvider delayDuration={0}> {/* TooltipProvider MOVIDO para cá */}
                    <WhatsAppDashboard />
                 </TooltipProvider> {/* TooltipProvider FECHADO aqui */}
            </ReactFlowProvider>
        </LeftSidebarProvider>
    );
}
