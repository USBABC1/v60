import React, { useState, useEffect, useRef, useCallback } from 'react';
import Head from 'next/head';
import Layout from '@/components/layout';
import type { Campaign } from '@/entities/Campaign';
import { useRouter } from 'next/router';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress"; // Import Progress if needed elsewhere, not used currently
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea"; // Import Textarea if needed elsewhere, not used currently
import { Switch } from "@/components/ui/switch";     // Import Switch if needed elsewhere, not used currently
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import axios from 'axios';
import { Send, User, Sparkles, Brain, Database, RefreshCw, Cpu, Zap, Upload, History, Trash2, Save, RotateCw, Loader2, Bot, Lightbulb, MessageSquare, Settings, Filter, Server, Globe, KeyRound } from 'lucide-react';
import ChatMessage from '@/components/ChatMessage';
import { Message } from '@/types/chat';
import { useAuth } from '@/context/AuthContext';

interface Conversation { id: string; title: string; date: string; messages: Message[]; }
interface SimpleCampaignChatInfo { id?: string | number; name?: string | null; platform?: string | null; daily_budget?: number | null; duration?: number | null; objective?: string | null; }
interface CopyInfo { id?: string | number; campaign_id?: string | number; title?: string | null; cta?: string | null; target_audience?: string | null; content?: string | null; }
interface ChatPageProps {}
// Assuming Campaign might have id as string OR number based on the error
type CampaignOption = Pick<Campaign, 'id' | 'name'>; // Ensure Campaign['id'] is correctly typed in its definition
interface ModelSettings { providerType: 'local' | 'openai' | 'gemini' | 'custom'; localServerUrl: string; apiKey: string; customApiUrl: string; temperature: number; maxTokens: number; repetitionPenalty: number; localModelName?: string; }

export default function ChatPage({ }: ChatPageProps) {
    const { isAuthenticated, isLoading: authLoading } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [messages, setMessages] = useState<Message[]>([{ role: 'assistant', content: 'Olá! Sou o assistente USBABC IA. Como posso ajudar?' }]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [context, setContext] = useState('Aguardando dados...');
    const [modelSettings, setModelSettings] = useState<ModelSettings>({ providerType: 'local', localServerUrl: 'http://127.0.0.1:8001', apiKey: '', customApiUrl: '', temperature: 0.7, maxTokens: 1000, repetitionPenalty: 1.2, localModelName: undefined });
    const [modelStatus, setModelStatus] = useState('Verificando...');
    const [savedConversations, setSavedConversations] = useState<Conversation[]>([]);
    const [activeTab, setActiveTab] = useState("chat");
    const [promptInput, setPromptInput] = useState('');
    const [iaMessages, setIaMessages] = useState<Message[]>([]);
    const [iaChatLoading, setIaChatLoading] = useState(false);
    const [campaignOptions, setCampaignOptions] = useState<CampaignOption[]>([]);
    const [contextCampaignId, setContextCampaignId] = useState<string>("__general__"); // Ensure this stays string as Select value will be string
    const [contextLoading, setContextLoading] = useState<boolean>(false);
    const [campaignsLoading, setCampaignsLoading] = useState<boolean>(true);
    const [pageError, setPageError] = useState<string | null>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [loadingModel, setLoadingModel] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [localModelOptions, setLocalModelOptions] = useState<string[]>(['TinyLlama-1.1B-Chat-v1.0', 'Mistral-7B-Instruct-v0.1', 'Gemma-2B-it']);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const chatIaEndRef = useRef<HTMLDivElement>(null);
    const chatIaScrollRef = useRef<HTMLDivElement>(null);
    const API_LLM_URL = '/api/llm';
    const API_CAMPAIGNS_URL = '/api/campaigns';
    const API_COPIES_URL = '/api/copies';

    const neonColor = '#1E90FF';
    const neonColorMuted = '#4682B4';
    const cardStyle = "bg-[#141414]/80 backdrop-blur-sm shadow-[5px_5px_10px_rgba(0,0,0,0.4),-5px_-5px_10px_rgba(255,255,255,0.05)] rounded-lg border-none";
    const insetCardStyle = "bg-[#141414]/50 shadow-[inset_1px_1px_2px_rgba(0,0,0,0.3),inset_-1px_-1px_2px_rgba(255,255,255,0.03)] rounded-md border-none";
    const neumorphicInputStyle = "bg-[#141414] text-white shadow-[inset_2px_2px_4px_rgba(0,0,0,0.3),inset_-2px_-2px_4px_rgba(255,255,255,0.05)] placeholder:text-gray-500 border-none focus:ring-2 focus:ring-[#1E90FF] focus:ring-offset-2 focus:ring-offset-[#0e1015] h-9 text-sm px-3 py-2";
    const neumorphicTextAreaStyle = cn(neumorphicInputStyle, "min-h-[80px] py-2"); // Kept if needed
    const neumorphicButtonStyle = "bg-[#141414] border-none text-white shadow-[3px_3px_6px_rgba(0,0,0,0.3),-3px_-3px_6px_rgba(255,255,255,0.05)] hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.3),inset_-2px_-2px_4px_rgba(255,255,255,0.05)] hover:bg-[#1E90FF]/80 active:scale-[0.98] active:brightness-95 transition-all duration-150 ease-out h-9 px-3 text-sm";
    const neumorphicGhostButtonStyle = cn(neumorphicButtonStyle, "bg-transparent shadow-none hover:bg-[#1E90FF]/20 hover:text-[#1E90FF] h-8 w-8 p-0");
    const primaryNeumorphicButtonStyle = cn(neumorphicButtonStyle, "bg-[#1E90FF]/80 hover:bg-[#1E90FF]/100");
    const tabsListStyle = "bg-[#141414]/70 shadow-[inset_2px_2px_4px_rgba(0,0,0,0.3),inset_-2px_-2px_4px_rgba(255,255,255,0.05)] rounded-lg p-1 h-auto";
    const tabsTriggerStyle = "data-[state=active]:bg-[#1E90FF]/30 data-[state=active]:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.3),inset_-1px_-1px_2px_rgba(255,255,255,0.05)] data-[state=active]:text-white text-gray-400 hover:text-white hover:bg-[#1E90FF]/10 rounded-md px-3 py-1.5 text-sm transition-all duration-150";
    const iconStyle = { filter: `drop-shadow(0 0 3px ${neonColorMuted})` };
    const primaryIconStyle = { filter: `drop-shadow(0 0 3px ${neonColor})` };
    const neumorphicSliderStyle = "[&>span:first-child]:bg-[#141414] [&>span:first-child]:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.3),inset_-2px_-2px_4px_rgba(255,255,255,0.05)] [&>span:first-child]:h-2 [&>span>span]:bg-[#1E90FF] [&>span>span]:shadow-[3px_3px_6px_rgba(0,0,0,0.3),-3px_-3px_6px_rgba(255,255,255,0.05)] [&>span>span]:h-4 [&>span>span]:w-4 [&>span>span]:border-none";

    const loadSettingsFromLocal = useCallback(() => {
        try {
            const savedSettings = localStorage.getItem('llmSettings');
            if (savedSettings) {
                const parsedSettings = JSON.parse(savedSettings);
                setModelSettings(prev => ({ ...prev, ...parsedSettings }));
            }
        } catch (e) {
            console.error("Erro ao carregar configurações:", e);
        }
    }, []);

    const fetchCampaignOptions = useCallback(async () => {
        setCampaignsLoading(true);
        setPageError(null);
        try {
            // Fetch only id and name
            const response = await axios.get<CampaignOption[]>(`${API_CAMPAIGNS_URL}?fields=id,name`);
            if (response.status !== 200 || !Array.isArray(response.data)) {
                throw new Error(`Falha ao buscar campanhas (Status: ${response.status})`);
            }
            // Filter out any options without a valid id or name just in case
            const validOptions = response.data.filter(camp => camp.id != null && camp.name != null);
            setCampaignOptions(validOptions);
        } catch (error: any) {
            const errorMsg = error.response?.data?.message || error.message || "Falha ao buscar campanhas.";
            setPageError(`Erro Crítico ao Carregar Campanhas: ${errorMsg}. Verifique console do servidor (API / DB).`);
            toast({ title: "Erro Crítico de Dados", description: errorMsg, variant: "destructive", duration: 10000 });
            setCampaignOptions([]);
        } finally {
            setCampaignsLoading(false);
        }
    }, [API_CAMPAIGNS_URL, toast]);

    const generateContext = useCallback(async () => {
        if (campaignsLoading || !isAuthenticated || contextLoading) return; // Add contextLoading check

        setContextLoading(true);
        let contextData = "Contexto não disponível.";

        try {
            if (contextCampaignId === "__general__") {
                // Fetch general context
                const campaignsResponse = await axios.get(`${API_CAMPAIGNS_URL}?limit=3&sort=created_at:desc`);
                const campaigns: SimpleCampaignChatInfo[] = campaignsResponse.data;

                let campaignSummary = "Resumo das 3 campanhas mais recentes:\n";
                if (campaigns.length === 0) {
                    campaignSummary += "Nenhuma campanha disponível.\n";
                } else {
                    campaigns.forEach((camp, i) => {
                        campaignSummary += `${i + 1}. Nome: ${camp.name || 'N/A'}, Plataforma: ${camp.platform || 'N/A'}, Objetivo: ${camp.objective || 'N/A'}\n`;
                    });
                }

                const copiesResponse = await axios.get(`${API_COPIES_URL}?limit=3&sort=created_at:desc`);
                const copies: CopyInfo[] = copiesResponse.data;

                let copySummary = "\nResume dos 3 textos mais recentes:\n";
                if (copies.length === 0) {
                    copySummary += "Nenhum texto disponível.\n";
                } else {
                    copies.forEach((copy, i) => {
                        copySummary += `${i + 1}. Título: ${copy.title || 'N/A'}, Público: ${copy.target_audience || 'N/A'}\n`;
                        if (copy.content) {
                            const shortContent = copy.content.length > 100 ? copy.content.substring(0, 100) + "..." : copy.content;
                            copySummary += `   Conteúdo: ${shortContent}\n`;
                        }
                    });
                }

                contextData = campaignSummary + copySummary;
            } else {
                 // Fetch specific campaign context
                const campaignResponse = await axios.get(`${API_CAMPAIGNS_URL}/${contextCampaignId}`);
                const campaign = campaignResponse.data;

                let campaignDetail = `Detalhes da Campanha "${campaign.name || 'N/A'}":\n`;
                campaignDetail += `Plataforma: ${campaign.platform || 'N/A'}\n`;
                campaignDetail += `Orçamento: R$ ${campaign.daily_budget != null ? campaign.daily_budget.toFixed(2) : 'N/A'} / dia\n`;
                campaignDetail += `Duração: ${campaign.duration || 'N/A'} dias\n`;
                campaignDetail += `Objetivo: ${campaign.objective || 'N/A'}\n`;

                const copiesResponse = await axios.get(`${API_COPIES_URL}?campaign_id=${contextCampaignId}`);
                const copies: CopyInfo[] = copiesResponse.data;

                let copySummary = "\nTextos desta campanha:\n";
                if (copies.length === 0) {
                    copySummary += "Nenhum texto disponível para esta campanha.\n";
                } else {
                    copies.forEach((copy, i) => {
                        copySummary += `${i + 1}. Título: ${copy.title || 'N/A'}, CTA: ${copy.cta || 'N/A'}\n`;
                        copySummary += `   Público: ${copy.target_audience || 'N/A'}\n`;
                        if (copy.content) {
                            const shortContent = copy.content.length > 150 ? copy.content.substring(0, 150) + "..." : copy.content;
                            copySummary += `   Conteúdo: ${shortContent}\n`;
                        }
                    });
                }

                contextData = campaignDetail + copySummary;
            }
        } catch (error: any) {
            const errorMsg = error.response?.data?.message || error.message || "Erro desconhecido";
            contextData = `Erro ao carregar contexto: ${errorMsg}`;
            console.error("Erro ao gerar contexto:", error); // Log detailed error
            toast({ title: "Erro ao carregar contexto", description: errorMsg, variant: "destructive" });
        } finally {
            setContext(contextData);
            setContextLoading(false);
        }
    // Removed campaignOptions from dependencies as it doesn't directly influence context generation logic itself, only selection
    }, [API_CAMPAIGNS_URL, API_COPIES_URL, contextCampaignId, toast, campaignsLoading, isAuthenticated, contextLoading]);

    const checkModelStatus = useCallback(async () => {
        setModelStatus('Verificando...');

        try {
            if (modelSettings.providerType === 'local') {
                try {
                    const response = await axios.get(`${modelSettings.localServerUrl}/health`, { timeout: 3000 });
                    if (response.data?.status === 'ok') {
                        const modelName = response.data?.model || modelSettings.localModelName || 'padrão';
                        setModelStatus(`Local Ativo (${modelName})`);
                    } else {
                         setModelStatus(`Servidor Local: Erro (${response.status})`);
                    }
                } catch (error: any) {
                     if (axios.isAxiosError(error) && error.code === 'ECONNABORTED') {
                         setModelStatus('Servidor Local: Timeout');
                     } else if (axios.isAxiosError(error) && error.response) {
                         setModelStatus(`Servidor Local: Erro (${error.response.status})`);
                     } else if (axios.isAxiosError(error) && error.request) {
                         setModelStatus('Servidor Local: Offline');
                     } else {
                         setModelStatus('Servidor Local: Erro Desconhecido');
                     }
                     console.error("Erro ao verificar servidor local:", error);
                }
            } else if (modelSettings.providerType === 'openai') {
                setModelStatus(modelSettings.apiKey ? 'API OpenAI configurada' : 'API OpenAI: Sem Chave!');
            } else if (modelSettings.providerType === 'gemini') {
                setModelStatus(modelSettings.apiKey ? 'API Gemini configurada' : 'API Gemini: Sem Chave!');
            } else if (modelSettings.providerType === 'custom') {
                setModelStatus(modelSettings.customApiUrl ? 'API Custom configurada' : 'API Custom: Sem URL!');
            } else {
                 setModelStatus('Tipo de Provedor Inválido');
            }
        } catch (error) {
            console.error("Erro inesperado ao verificar status:", error);
            setModelStatus('Erro ao verificar');
        }
    }, [modelSettings]); // Depend on the whole settings object

    const handleSettingsChange = (key: keyof ModelSettings, value: any) => {
        setModelSettings(prev => ({ ...prev, [key]: value }));
    };

    const saveSettingsToLocal = () => {
        try {
            localStorage.setItem('llmSettings', JSON.stringify(modelSettings));
            toast({ title: "Configurações salvas", description: "Suas preferências foram salvas localmente" });
            checkModelStatus(); // Re-check status after saving potentially new settings
        } catch (e) {
            console.error("Erro ao salvar configurações:", e);
            toast({ title: "Erro ao salvar", description: "Não foi possível salvar as configurações", variant: "destructive" });
        }
    };

    const scrollToBottom = (ref: React.RefObject<HTMLDivElement>) => {
        ref.current?.scrollIntoView({ behavior: "smooth" });
    };

    const handleSendMessage = async () => {
        if (!input.trim() || loading) return;

        const userMessage: Message = { role: 'user', content: input.trim() };
        setMessages(prev => [...prev, userMessage]);
        setLoading(true);
        setInput('');

        try {
            // Ensure context is not in loading state before sending
            const currentContext = contextLoading ? "Aguardando carregamento do contexto..." : context;
            const contextInfo = `CONTEXTO DE MARKETING:\n${currentContext}\n\nBASEADO NO CONTEXTO ACIMA, RESPONDA:`;
            const prompt = `${contextInfo}\n\n${userMessage.content}`;

            const response = await callApiLLM(prompt);
            const assistantResponse: Message = { role: 'assistant', content: response?.text || "Desculpe, não consegui processar sua solicitação." };

            setMessages(prev => [...prev, assistantResponse]);
        } catch (error: any) {
            const errorMsg = error.response?.data?.error || error.message || 'Falha ao processar resposta';
            setMessages(prev => [...prev, { role: 'assistant', content: `Erro: ${errorMsg}` }]);
            toast({ title: "Erro na Comunicação com IA", description: errorMsg, variant: "destructive", duration: 7000 });
            console.error("Erro ao enviar mensagem:", error);
        } finally {
            setLoading(false);
            // Use requestAnimationFrame for smoother scroll after state update
            requestAnimationFrame(() => scrollToBottom(chatEndRef));
        }
    };

    const callApiLLM = async (prompt: string, response_json_schema?: object): Promise<any> => {
        let requestBody: any = {
            prompt,
            provider: modelSettings.providerType,
            temperature: modelSettings.temperature,
            max_tokens: modelSettings.maxTokens,
            repetition_penalty: modelSettings.repetitionPenalty,
        };

        if (response_json_schema) {
            requestBody.response_format = { type: "json_object", schema: response_json_schema };
        }

        switch (modelSettings.providerType) {
            case 'local':
                requestBody.url = modelSettings.localServerUrl;
                if (modelSettings.localModelName) {
                    requestBody.model = modelSettings.localModelName;
                }
                break;
            case 'openai':
            case 'gemini':
            case 'custom':
                if (!modelSettings.apiKey) {
                    throw new Error(`Chave API necessária para o provedor ${modelSettings.providerType}`);
                }
                requestBody.api_key = modelSettings.apiKey;
                if (modelSettings.providerType === 'custom') {
                    if (!modelSettings.customApiUrl) {
                        throw new Error("URL da API Customizada necessária");
                    }
                    requestBody.url = modelSettings.customApiUrl;
                }
                break;
            default:
                 throw new Error("Provedor de IA inválido selecionado nas configurações.");
        }

        console.log("Enviando para API LLM:", requestBody); // Log para debug

        try {
            const response = await axios.post(API_LLM_URL, requestBody, { timeout: 60000 }); // Aumentar timeout
            console.log("Resposta da API LLM:", response.data); // Log para debug
            return response.data;
        } catch (error: any) {
            console.error("Erro detalhado na chamada da API LLM:", error.response?.data || error.message || error);
            // Re-throw a potentially more user-friendly error or the original error
            if (axios.isAxiosError(error) && error.response?.data?.error) {
                throw new Error(error.response.data.error);
            } else if (axios.isAxiosError(error) && error.message) {
                throw new Error(`Erro de rede ou API: ${error.message}`);
            }
            throw error; // Re-throw original if no better message found
        }
    };


    const handleSendIaMessage = async () => {
        if (!promptInput.trim() || iaChatLoading) return;

        const userMessage: Message = { role: 'user', content: promptInput.trim() };
        setIaMessages(prev => [...prev, userMessage]);
        setIaChatLoading(true);
        setPromptInput('');

        try {
            const response = await callApiLLM(userMessage.content);
            const assistantResponse: Message = { role: 'assistant', content: response?.text || "Desculpe, não consegui processar sua solicitação." };

            setIaMessages(prev => [...prev, assistantResponse]);
        } catch (error: any) {
             const errorMsg = error.response?.data?.error || error.message || 'Falha ao processar resposta';
            setIaMessages(prev => [...prev, { role: 'assistant', content: `Erro: ${errorMsg}` }]);
            toast({ title: "Erro na Comunicação com IA", description: errorMsg, variant: "destructive", duration: 7000 });
            console.error("Erro ao enviar mensagem IA direta:", error);
        } finally {
            setIaChatLoading(false);
             requestAnimationFrame(() => scrollToBottom(chatIaEndRef));
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (activeTab === 'chat') {
                handleSendMessage();
            } else if (activeTab === 'ia-chat') {
                handleSendIaMessage();
            }
        }
    };

    const saveConversation = () => {
        if (messages.length <= 1) {
            toast({ title: "Conversa vazia", description: "Não há mensagens para salvar", variant: "default" });
            return;
        }

        const newConversation: Conversation = {
            id: Date.now().toString(),
            title: messages[1]?.content.substring(0, 30) + (messages[1]?.content.length > 30 ? '...' : '') || "Conversa", // Handle potential undefined message[1]
            date: new Date().toISOString(),
            messages: [...messages]
        };

        const updatedConversations = [...savedConversations, newConversation];
        setSavedConversations(updatedConversations);
        try {
             localStorage.setItem('savedConversations', JSON.stringify(updatedConversations));
             toast({ title: "Conversa salva", description: "Você pode acessá-la na aba Histórico" });
        } catch (e) {
             console.error("Erro ao salvar conversa no localStorage:", e);
             toast({ title: "Erro ao Salvar", description: "Não foi possível salvar no localStorage.", variant: "destructive" });
        }
    };

    const loadSavedConversations = useCallback(() => { // Use useCallback
        try {
            const saved = localStorage.getItem('savedConversations');
            if (saved) {
                const parsed = JSON.parse(saved);
                // Basic validation
                if (Array.isArray(parsed)) {
                    setSavedConversations(parsed);
                } else {
                     console.error("Formato inválido das conversas salvas.");
                     localStorage.removeItem('savedConversations'); // Clear invalid data
                }
            }
        } catch (e) {
            console.error("Erro ao carregar conversas:", e);
             toast({ title: "Erro ao Carregar Histórico", description: "Não foi possível ler o histórico salvo.", variant: "destructive" });
        }
    }, [toast]); // Add toast as dependency

    const loadConversation = (id: string) => {
        const conversation = savedConversations.find(conv => conv.id === id);
        if (conversation) {
            setMessages(conversation.messages);
            setActiveTab('chat'); // Switch to chat tab when loading
            toast({ title: "Conversa carregada", description: `Conversa "${conversation.title}" restaurada.` });
            requestAnimationFrame(() => scrollToBottom(chatEndRef)); // Scroll after loading
        } else {
             toast({ title: "Erro", description: "Conversa não encontrada.", variant: "destructive" });
        }
    };

    const deleteConversation = (id: string) => {
        const updatedConversations = savedConversations.filter(conv => conv.id !== id);
        setSavedConversations(updatedConversations);
         try {
             localStorage.setItem('savedConversations', JSON.stringify(updatedConversations));
             toast({ title: "Conversa removida", description: "A conversa foi removida do histórico" });
         } catch (e) {
             console.error("Erro ao remover conversa do localStorage:", e);
             toast({ title: "Erro ao Remover", description: "Não foi possível atualizar o histórico salvo.", variant: "destructive" });
         }
    };

    const clearConversation = () => {
        setMessages([{ role: 'assistant', content: 'Chat limpo. Como posso ajudar?' }]);
        toast({ title: "Chat limpo", description: "Todas as mensagens foram removidas" });
    };

    const clearIaConversation = () => {
        setIaMessages([]);
        toast({ title: "Chat IA limpo", description: "Todas as mensagens foram removidas" });
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            // Basic validation (optional)
            const allowedExtensions = ['.gguf', '.bin', '.onnx', '.safetensors'];
            const fileExtension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
            if (!allowedExtensions.includes(fileExtension)) {
                toast({ title: "Tipo de Arquivo Inválido", description: `Selecione um arquivo com extensão: ${allowedExtensions.join(', ')}`, variant: "destructive" });
                setSelectedFile(null); // Clear selection
                if (fileInputRef.current) fileInputRef.current.value = ""; // Reset file input
                return;
            }
            setSelectedFile(file);
            toast({ title: "Arquivo Selecionado", description: file.name });
        } else {
             setSelectedFile(null);
        }
    };

    const loadLocalModel = async () => {
        if (!selectedFile) {
             toast({ title: "Nenhum Arquivo", description: "Selecione um arquivo de modelo primeiro.", variant: "destructive" });
             return;
        }

        setLoadingModel(true);
        try {
            // Simulate configuration - NO ACTUAL UPLOAD/LOADING happens here
            await new Promise(resolve => setTimeout(resolve, 500)); // Short delay simulation

            const modelName = selectedFile.name.replace(/\.(gguf|bin|onnx|safetensors)$/i, ''); // Case-insensitive replace
            handleSettingsChange('localModelName', modelName);

            // Add to options if not present
            setLocalModelOptions(prev => {
                if (!prev.includes(modelName)) {
                    return [...prev, modelName];
                }
                return prev;
            });

            toast({ title: "Modelo Configurado", description: `Nome do modelo definido como: ${modelName}. Salve as configurações para usar.`, duration: 5000 });
            setSelectedFile(null); // Clear selection after "loading"
            if (fileInputRef.current) fileInputRef.current.value = ""; // Reset file input

        } catch (e) {
            console.error("Erro ao configurar nome do modelo:", e);
            toast({ title: "Erro ao Configurar", description: "Ocorreu um erro ao definir o nome do modelo.", variant: "destructive" });
        } finally {
            setLoadingModel(false);
        }
    };

    // --- useEffect Hooks ---

    // Authentication Check & Initial Data Load
    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            router.push('/login');
        } else if (!authLoading && isAuthenticated) {
            loadSavedConversations();
            loadSettingsFromLocal(); // Load settings before fetching options/context
            fetchCampaignOptions(); // Fetch campaign options
        }
    }, [authLoading, isAuthenticated, router, loadSavedConversations, loadSettingsFromLocal, fetchCampaignOptions]);

    // Generate Context when dependencies change and ready
     useEffect(() => {
        // Only generate context if authenticated, campaigns are not loading, no page error,
        // and either the campaign ID changed or the initial load is complete.
        if (isAuthenticated && !campaignsLoading && !pageError) {
            generateContext();
        }
        // Intentionally excluding generateContext from deps array if it causes loops,
        // but ensure all *its* dependencies are correctly listed in its useCallback.
    }, [isAuthenticated, campaignsLoading, pageError, contextCampaignId]); // Add generateContext here if safe


    // Check Model Status initially and when settings change
    useEffect(() => {
        checkModelStatus();
    }, [modelSettings, checkModelStatus]); // Depend on modelSettings and the function itself

    // Scroll main chat
    useEffect(() => {
        scrollToBottom(chatEndRef);
    }, [messages]); // Trigger scroll when messages update

    // Scroll IA chat
    useEffect(() => {
        scrollToBottom(chatIaEndRef);
    }, [iaMessages]); // Trigger scroll when IA messages update

    // --- Render Logic ---

    if (authLoading) {
        return (
            <Layout>
                <div className="flex h-[calc(100vh-100px)] w-full items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <span className="ml-3 text-muted-foreground">Verificando autenticação...</span>
                </div>
            </Layout>
        );
    }

    // No need to render anything if redirecting
    if (!isAuthenticated && !authLoading) {
        return null;
    }

     // Show loading indicator while campaigns are loading AFTER auth check
     if (campaignsLoading) {
        return (
            <Layout>
                <div className="flex h-[calc(100vh-100px)] w-full items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <span className="ml-3 text-muted-foreground">Carregando dados de campanha...</span>
                </div>
            </Layout>
        );
    }

    // Show critical error page
    if (pageError) {
        return (
            <Layout>
                <div className="flex h-[calc(100vh-100px)] w-full items-center justify-center text-center text-red-400 p-6">
                    <div>
                        <h2 className="text-lg font-semibold mb-2">Erro Crítico</h2>
                        <p className="text-sm">{pageError}</p>
                        <Button onClick={fetchCampaignOptions} className={cn(primaryNeumorphicButtonStyle, 'mt-4')}>
                            <RefreshCw className="mr-2 h-4 w-4" /> Tentar Recarregar
                        </Button>
                    </div>
                </div>
            </Layout>
        );
    }

    // Main Page Render
    return (
        <Layout>
            <Head>
                <title>Chat IA - USBMKT</title>
            </Head>
            <div className="space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between mb-2">
                    <h1 className="text-2xl font-black text-white" style={{ textShadow: `0 0 8px ${neonColor}` }}>
                        USBABC IA MKT DIGITAL
                    </h1>
                    <div className={cn(insetCardStyle, "p-1.5 px-3 rounded-full flex items-center gap-1.5 text-xs")}>
                        <Zap className={cn("h-3.5 w-3.5 flex-shrink-0", modelStatus.includes('Ativo') ? 'text-green-400 animate-pulse' : modelStatus.includes('API') ? 'text-blue-400' : modelStatus.includes('offline') || modelStatus.includes('Erro') || modelStatus.includes('Sem') || modelStatus.includes('Timeout') ? 'text-red-400' : 'text-yellow-400')} style={primaryIconStyle} />
                        <span className="text-gray-300 truncate" title={modelStatus}>{modelStatus}</span>
                        <Button variant="ghost" size="icon" className={cn(neumorphicGhostButtonStyle, "h-5 w-5 p-0 flex-shrink-0")} onClick={checkModelStatus} title="Verificar Status Novamente">
                            <RefreshCw className="h-3 w-3" />
                        </Button>
                    </div>
                </div>

                {/* Main Grid */}
                <div className="grid gap-4 lg:grid-cols-4">
                    {/* Left Column (Tabs) */}
                    <div className="lg:col-span-3 space-y-4">
                        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                            <TabsList className={cn(tabsListStyle, "grid grid-cols-4")}>
                                <TabsTrigger value="chat" className={tabsTriggerStyle}>Chat Principal</TabsTrigger>
                                <TabsTrigger value="ia-chat" className={tabsTriggerStyle}>Chat IA Direto</TabsTrigger>
                                <TabsTrigger value="history" className={tabsTriggerStyle}>Histórico</TabsTrigger>
                                <TabsTrigger value="settings" className={tabsTriggerStyle}>Configurações</TabsTrigger>
                            </TabsList>

                            {/* Tab: Chat Principal */}
                            <TabsContent value="chat">
                                <Card className={cn(cardStyle, "overflow-hidden")}>
                                    <CardHeader className="flex flex-row items-center justify-between p-3 border-b border-[#1E90FF]/20">
                                        <div className="flex items-center gap-2">
                                            <div className={cn(insetCardStyle, "p-1.5 rounded-md flex-shrink-0")}>
                                                <Brain className="h-5 w-5 text-primary" style={primaryIconStyle} />
                                            </div>
                                            <CardTitle className="text-base font-semibold text-white truncate" style={{ textShadow: `0 0 5px ${neonColorMuted}` }}>
                                                 Chat com Contexto
                                             </CardTitle>
                                        </div>
                                        <div className="flex items-center gap-1 flex-shrink-0">
                                             <Select
                                                value={contextCampaignId}
                                                onValueChange={(val) => setContextCampaignId(val)} // generateContext is called via useEffect
                                                disabled={contextLoading || campaignsLoading} // Disable while loading
                                            >
                                                <SelectTrigger className={cn(neumorphicInputStyle, "h-7 w-[160px] md:w-[180px] bg-[#141414]/60 text-xs")} title={contextCampaignId === "__general__" ? "Contexto Geral" : campaignOptions.find(c => String(c.id) === contextCampaignId)?.name ?? "Selecionar Contexto"}>
                                                    <SelectValue placeholder="Selecione o contexto" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="__general__">Contexto Geral</SelectItem>
                                                    {campaignOptions.map(camp => (
                                                         // *** CORREÇÃO APLICADA AQUI ***
                                                        <SelectItem key={String(camp.id)} value={String(camp.id)}>{camp.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <Button onClick={generateContext} variant="ghost" size="icon" className={cn(neumorphicGhostButtonStyle)} title="Recarregar Contexto" disabled={contextLoading}>
                                                {contextLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />}
                                            </Button>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="p-0">
                                        <div className="grid grid-cols-1 md:grid-cols-3">
                                            {/* Chat Area */}
                                            <div className="md:col-span-2 overflow-hidden border-b md:border-r md:border-b-0 border-[#1E90FF]/10">
                                                <ScrollArea className="h-[calc(100vh-380px)] md:h-[calc(100vh-280px)] p-4">
                                                    <div className="space-y-4">
                                                        {messages.map((msg, i) => (
                                                            <ChatMessage key={i} message={msg} />
                                                        ))}
                                                        {loading && (
                                                            <div className="flex items-center justify-start py-2 pl-2">
                                                                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                                                                <span className="ml-2 text-sm text-muted-foreground">Pensando...</span>
                                                            </div>
                                                        )}
                                                        <div ref={chatEndRef} />
                                                    </div>
                                                </ScrollArea>
                                            </div>
                                            {/* Context Area */}
                                            <div className={cn(insetCardStyle, "md:col-span-1 p-3")}>
                                                <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5 text-primary">
                                                    <Database className="h-4 w-4" style={primaryIconStyle} />
                                                    Contexto de Marketing
                                                </h3>
                                                <ScrollArea className="h-[150px] md:h-[calc(100vh-330px)]">
                                                    <div className="text-xs text-gray-400 whitespace-pre-wrap font-mono break-words">
                                                        {contextLoading ? (
                                                            <div className="flex items-center justify-center py-8">
                                                                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                                                                <span className="ml-2">Carregando...</span>
                                                            </div>
                                                        ) : context}
                                                    </div>
                                                </ScrollArea>
                                            </div>
                                        </div>
                                    </CardContent>
                                    <CardFooter className="p-2 flex items-center gap-2 border-t border-[#1E90FF]/20">
                                        <Input
                                            value={input}
                                            onChange={(e) => setInput(e.target.value)}
                                            onKeyDown={handleKeyDown}
                                            placeholder="Digite sua mensagem aqui..."
                                            className={cn(neumorphicInputStyle, "flex-1")}
                                            disabled={loading || contextLoading}
                                        />
                                        <Button onClick={handleSendMessage} className={cn(primaryNeumorphicButtonStyle, "min-w-[40px]")} disabled={loading || !input.trim() || contextLoading}>
                                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                        </Button>
                                        <Button onClick={saveConversation} variant="ghost" size="icon" className={cn(neumorphicGhostButtonStyle)} title="Salvar Conversa">
                                            <Save className="h-4 w-4" />
                                        </Button>
                                        <Button onClick={clearConversation} variant="ghost" size="icon" className={cn(neumorphicGhostButtonStyle)} title="Limpar Chat">
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </CardFooter>
                                </Card>
                            </TabsContent>

                           {/* Tab: Chat IA Direto */}
                           <TabsContent value="ia-chat">
                                <Card className={cn(cardStyle, "overflow-hidden")}>
                                    <CardHeader className="flex flex-row items-center justify-between p-3 border-b border-[#1E90FF]/20">
                                        <div className="flex items-center gap-2">
                                            <div className={cn(insetCardStyle, "p-1.5 rounded-md flex-shrink-0")}>
                                                <Bot className="h-5 w-5 text-primary" style={primaryIconStyle} />
                                            </div>
                                            <CardTitle className="text-base font-semibold text-white truncate" style={{ textShadow: `0 0 5px ${neonColorMuted}` }}>
                                                Chat IA Direto (Sem Contexto)
                                            </CardTitle>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="p-0">
                                        <ScrollArea className="h-[calc(100vh-280px)] p-4" ref={chatIaScrollRef}>
                                            <div className="space-y-4">
                                                {iaMessages.length === 0 && (
                                                    <div className="flex flex-col items-center justify-center h-40 text-muted-foreground text-center">
                                                        <Lightbulb className="h-8 w-8 mb-2 text-primary/40" style={primaryIconStyle} />
                                                        <p className="text-sm">
                                                            Converse diretamente com a IA. <br /> Sem contexto de campanhas aplicado.
                                                        </p>
                                                    </div>
                                                )}
                                                {iaMessages.map((msg, i) => (
                                                    <ChatMessage key={i} message={msg} />
                                                ))}
                                                {iaChatLoading && (
                                                     <div className="flex items-center justify-start py-2 pl-2">
                                                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                                                        <span className="ml-2 text-sm text-muted-foreground">Pensando...</span>
                                                    </div>
                                                )}
                                                <div ref={chatIaEndRef} />
                                            </div>
                                        </ScrollArea>
                                    </CardContent>
                                    <CardFooter className="p-2 flex items-center gap-2 border-t border-[#1E90FF]/20">
                                        <Input
                                            value={promptInput}
                                            onChange={(e) => setPromptInput(e.target.value)}
                                            onKeyDown={handleKeyDown}
                                            placeholder="Faça uma pergunta direta à IA..."
                                            className={cn(neumorphicInputStyle, "flex-1")}
                                            disabled={iaChatLoading}
                                        />
                                        <Button onClick={handleSendIaMessage} className={cn(primaryNeumorphicButtonStyle, "min-w-[40px]")} disabled={iaChatLoading || !promptInput.trim()}>
                                            {iaChatLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                        </Button>
                                         <Button onClick={clearIaConversation} variant="ghost" size="icon" className={cn(neumorphicGhostButtonStyle)} title="Limpar Chat IA Direto">
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </CardFooter>
                                </Card>
                            </TabsContent>

                             {/* Tab: Histórico */}
                             <TabsContent value="history">
                                <Card className={cn(cardStyle)}>
                                    <CardHeader className="p-4">
                                        <CardTitle className="text-base font-semibold flex items-center gap-2">
                                            <History className="h-5 w-5" style={primaryIconStyle} />
                                            Histórico de Conversas Salvas
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-4 pt-0">
                                        <ScrollArea className="h-[calc(100vh-300px)] pr-3"> {/* Add padding-right for scrollbar */}
                                            {savedConversations.length === 0 ? (
                                                <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                                                    <MessageSquare className="h-8 w-8 mb-2 opacity-50" />
                                                    <p className="text-center text-sm">Nenhuma conversa salva ainda.</p>
                                                </div>
                                            ) : (
                                                <div className="space-y-2">
                                                    {/* Sort conversations by date, newest first */}
                                                    {[...savedConversations].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((conv) => (
                                                        <Card key={conv.id} className={cn(insetCardStyle, "p-3")}>
                                                            <div className="flex items-center justify-between gap-2">
                                                                <div className="flex-1 overflow-hidden">
                                                                    <h3 className="text-sm font-medium truncate" title={conv.title}>{conv.title}</h3>
                                                                    <p className="text-xs text-muted-foreground">
                                                                        {format(parseISO(conv.date), "dd/MM/yy HH:mm", { locale: ptBR })}
                                                                    </p>
                                                                </div>
                                                                <div className="flex gap-1 flex-shrink-0">
                                                                    <Button
                                                                        onClick={() => loadConversation(conv.id)}
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className={cn(neumorphicGhostButtonStyle, "h-7 w-7")}
                                                                        title="Carregar Conversa"
                                                                    >
                                                                        <MessageSquare className="h-3.5 w-3.5" />
                                                                    </Button>
                                                                    <Button
                                                                        onClick={() => deleteConversation(conv.id)}
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className={cn(neumorphicGhostButtonStyle, "h-7 w-7 text-red-500 hover:text-red-400 hover:bg-red-900/30")}
                                                                        title="Excluir Conversa"
                                                                    >
                                                                        <Trash2 className="h-3.5 w-3.5" />
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        </Card>
                                                    ))}
                                                </div>
                                            )}
                                        </ScrollArea>
                                    </CardContent>
                                </Card>
                            </TabsContent>

                            {/* Tab: Configurações */}
                            <TabsContent value="settings">
                                <Card className={cn(cardStyle)}>
                                    <CardHeader className="p-4">
                                        <CardTitle className="text-base font-semibold flex items-center gap-2">
                                            <Settings className="h-5 w-5" style={primaryIconStyle} />
                                            Configurações do Sistema IA
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="px-4 pb-4 pt-0 space-y-6"> {/* Increased spacing */}
                                        {/* General Settings */}
                                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                            {/* Provider Selection */}
                                            <div className="space-y-1">
                                                <Label htmlFor="provider-type">Provedor IA</Label>
                                                <Select
                                                    value={modelSettings.providerType}
                                                    onValueChange={(val: ModelSettings['providerType']) => handleSettingsChange('providerType', val)}
                                                >
                                                    <SelectTrigger id="provider-type" className={neumorphicInputStyle}>
                                                        <SelectValue placeholder="Selecione o provedor" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="local">
                                                            <div className="flex items-center gap-2"><Server className="h-4 w-4" /><span>Local</span></div>
                                                        </SelectItem>
                                                        <SelectItem value="openai">
                                                            <div className="flex items-center gap-2"><Globe className="h-4 w-4" /><span>OpenAI API</span></div>
                                                        </SelectItem>
                                                        <SelectItem value="gemini">
                                                            <div className="flex items-center gap-2"><Cpu className="h-4 w-4" /><span>Gemini API</span></div>
                                                        </SelectItem>
                                                         <SelectItem value="custom">
                                                             <div className="flex items-center gap-2"><Filter className="h-4 w-4" /><span>Custom API</span></div>
                                                         </SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            {/* Conditional Inputs based on Provider */}
                                             {modelSettings.providerType === 'local' && (
                                                <>
                                                    <div className="space-y-1">
                                                        <Label htmlFor="local-server-url">URL Servidor Local</Label>
                                                        <Input
                                                            id="local-server-url"
                                                            value={modelSettings.localServerUrl}
                                                            onChange={(e) => handleSettingsChange('localServerUrl', e.target.value)}
                                                            className={neumorphicInputStyle}
                                                            placeholder="http://127.0.0.1:8001"
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <Label htmlFor="local-model">Modelo Local Ativo</Label>
                                                        <Select
                                                            value={modelSettings.localModelName ?? ""} // Use empty string if undefined
                                                            onValueChange={(val) => handleSettingsChange('localModelName', val === "" ? undefined : val)} // Set to undefined if empty
                                                        >
                                                            <SelectTrigger id="local-model" className={neumorphicInputStyle}>
                                                                <SelectValue placeholder="Auto ou selecione" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="">Automático (padrão do servidor)</SelectItem>
                                                                {localModelOptions.map((model) => (
                                                                    <SelectItem key={model} value={model}>{model}</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                         <p className="text-xs text-muted-foreground pt-1">Se vazio, usa o modelo padrão do servidor local.</p>
                                                    </div>
                                                </>
                                            )}

                                            {(modelSettings.providerType === 'openai' || modelSettings.providerType === 'gemini' || modelSettings.providerType === 'custom') && (
                                                <div className="space-y-1 lg:col-span-2">
                                                    <Label htmlFor="api-key" className="flex items-center gap-1">
                                                        <KeyRound className="h-3.5 w-3.5" /> Chave API ({modelSettings.providerType})
                                                    </Label>
                                                    <Input
                                                        id="api-key"
                                                        value={modelSettings.apiKey}
                                                        onChange={(e) => handleSettingsChange('apiKey', e.target.value)}
                                                        type="password"
                                                        className={neumorphicInputStyle}
                                                        placeholder="Cole sua chave de API aqui"
                                                    />
                                                </div>
                                            )}

                                            {modelSettings.providerType === 'custom' && (
                                                <div className="space-y-1 lg:col-span-3">
                                                    <Label htmlFor="custom-api-url">URL API Customizada</Label>
                                                    <Input
                                                        id="custom-api-url"
                                                        value={modelSettings.customApiUrl}
                                                        onChange={(e) => handleSettingsChange('customApiUrl', e.target.value)}
                                                        className={neumorphicInputStyle}
                                                        placeholder="https://api.exemplo.com/v1/chat/completions"
                                                    />
                                                </div>
                                            )}
                                        </div>

                                        {/* Common LLM Parameters */}
                                         <div className="grid gap-4 md:grid-cols-3">
                                              <div className="space-y-1">
                                                <Label htmlFor="temperature" className="flex justify-between">
                                                    <span>Temperatura</span>
                                                    <span className="text-muted-foreground text-xs">{modelSettings.temperature.toFixed(1)}</span>
                                                </Label>
                                                <Slider
                                                    id="temperature"
                                                    value={[modelSettings.temperature]}
                                                    min={0} max={2} step={0.1}
                                                    onValueChange={([value]) => handleSettingsChange('temperature', value)}
                                                    className={cn(neumorphicSliderStyle, "py-2")}
                                                />
                                                <div className="flex justify-between text-xs text-muted-foreground">
                                                    <span>Preciso</span>
                                                    <span>Criativo</span>
                                                </div>
                                            </div>
                                             <div className="space-y-1">
                                                <Label htmlFor="max-tokens" className="flex justify-between">
                                                    <span>Tam. Máx. Resposta</span>
                                                    <span className="text-muted-foreground text-xs">{modelSettings.maxTokens} tokens</span>
                                                </Label>
                                                <Slider
                                                    id="max-tokens"
                                                    value={[modelSettings.maxTokens]}
                                                    min={100} max={8000} step={100} // Increased max
                                                    onValueChange={([value]) => handleSettingsChange('maxTokens', value)}
                                                    className={cn(neumorphicSliderStyle, "py-2")}
                                                />
                                                 <div className="flex justify-between text-xs text-muted-foreground">
                                                    <span>Curto</span>
                                                    <span>Longo</span>
                                                </div>
                                            </div>
                                             <div className="space-y-1">
                                                 <Label htmlFor="repetition-penalty" className="flex justify-between">
                                                    <span>Penal. Repetição</span>
                                                    <span className="text-muted-foreground text-xs">{modelSettings.repetitionPenalty.toFixed(1)}</span>
                                                </Label>
                                                <Slider
                                                    id="repetition-penalty"
                                                    value={[modelSettings.repetitionPenalty]}
                                                    min={1.0} max={2.0} step={0.1}
                                                    onValueChange={([value]) => handleSettingsChange('repetitionPenalty', value)}
                                                    className={cn(neumorphicSliderStyle, "py-2")}
                                                />
                                                <div className="flex justify-between text-xs text-muted-foreground">
                                                    <span>Permitir</span>
                                                    <span>Evitar</span>
                                                </div>
                                            </div>
                                         </div>

                                        {/* Local Model "Upload" (Configuration) */}
                                         {modelSettings.providerType === 'local' && (
                                            <div className="pt-4 border-t border-[#1E90FF]/10">
                                                <h3 className="text-sm font-semibold mb-3">Configurar Nome de Modelo Local</h3>
                                                <div className="grid gap-4 md:grid-cols-2">
                                                    <div className="space-y-1">
                                                        <Label htmlFor="file-upload">Selecionar Arquivo de Modelo</Label>
                                                        <div className="flex gap-2 items-center">
                                                            <Input
                                                                id="file-upload"
                                                                type="file"
                                                                ref={fileInputRef}
                                                                onChange={handleFileChange}
                                                                className={cn(neumorphicInputStyle, "text-xs flex-1")}
                                                                accept=".gguf,.bin,.onnx,.safetensors"
                                                            />
                                                            <Button
                                                                onClick={loadLocalModel}
                                                                className={cn(neumorphicButtonStyle)}
                                                                disabled={!selectedFile || loadingModel}
                                                                title="Definir nome do modelo com base no arquivo selecionado"
                                                            >
                                                                {loadingModel ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                                                                <span className="sr-only">Configurar Nome</span>
                                                            </Button>
                                                        </div>
                                                         <p className="text-xs text-muted-foreground pt-1">
                                                            Apenas configura o nome na lista acima (não faz upload real).
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                         )}

                                        {/* Save and Test */}
                                        <div className="pt-4 border-t border-[#1E90FF]/10 flex flex-col md:flex-row justify-between items-center gap-4">
                                             <div className={cn(insetCardStyle, "p-2 text-xs text-muted-foreground w-full md:w-auto")}>
                                                <span className="font-medium text-gray-300">Status Atual: </span>
                                                <span className={cn(modelStatus.includes('Ativo') ? 'text-green-400' : modelStatus.includes('offline') || modelStatus.includes('Erro') || modelStatus.includes('Sem') || modelStatus.includes('Timeout') ? 'text-red-400' : 'text-yellow-400', "font-semibold")}>
                                                    {modelStatus}
                                                </span>
                                            </div>
                                            <Button
                                                onClick={saveSettingsToLocal}
                                                className={cn(primaryNeumorphicButtonStyle, "w-full md:w-auto")}
                                            >
                                                <Save className="h-4 w-4 mr-2" /> Salvar e Testar Conexão
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            </TabsContent>
                        </Tabs>
                    </div>

                    {/* Right Column (Suggestions & Tips) */}
                    <div className="space-y-4">
                        {/* Prompt Suggestions */}
                        <Card className={cn(cardStyle)}>
                            <CardHeader className="p-3">
                                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                    <Sparkles className="h-4 w-4" style={primaryIconStyle} />
                                    Sugestões de Prompts
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-3 pt-0">
                                <div className="space-y-2 text-sm">
                                    {[
                                        "Crie 3 títulos atrativos para um anúncio de Facebook sobre venda de cursos de marketing digital.",
                                        "Analise o público-alvo ideal para uma campanha de marketing de imóveis de luxo.",
                                        "Sugira 5 CTAs eficazes para uma landing page de venda de infoprodutos.",
                                        "Crie um texto persuasivo de 3 parágrafos para email marketing sobre um workshop gratuito.",
                                        "Quais são as melhores estratégias de remarketing para e-commerce em 2025?",
                                        "Gere ideias de conteúdo para um blog sobre inteligência artificial aplicada ao marketing."
                                    ].map((prompt, index) => (
                                        <Button
                                            key={index}
                                            variant="ghost"
                                            className={cn(insetCardStyle, "w-full justify-start text-left text-xs p-2 h-auto hover:bg-[#1E90FF]/10 hover:text-white")}
                                            onClick={() => { setInput(prompt); setActiveTab('chat'); }}
                                            title={`Usar no Chat Principal: ${prompt}`}
                                        >
                                            {prompt}
                                        </Button>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Usage Tips */}
                        <Card className={cn(cardStyle)}>
                            <CardHeader className="p-3">
                                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                    <User className="h-4 w-4" style={primaryIconStyle} />
                                    Dicas de Uso
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-3 pt-0">
                                <ul className="space-y-1.5 text-xs text-muted-foreground list-disc list-inside">
                                    <li>Selecione uma campanha no "Chat Principal" para respostas com contexto.</li>
                                    <li>Use o "Chat IA Direto" para perguntas gerais ou sem contexto específico.</li>
                                    <li>Salve conversas importantes no "Histórico".</li>
                                    <li>Ajuste "Temperatura" nas Configurações (maior = mais criativo, menor = mais factual).</li>
                                    <li>Detalhe bem suas perguntas para obter melhores resultados.</li>
                                    <li>Verifique o status do modelo IA no topo da página.</li>
                                </ul>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </Layout>
    );
}
