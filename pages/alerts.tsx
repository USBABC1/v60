// pages/alerts.tsx
import React, { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { useAuth } from '@/context/AuthContext'; // <<< AUTENTICAÇÃO
import { useRouter } from 'next/router';       // <<< AUTENTICAÇÃO
import Layout from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { Bell, Info, AlertTriangle, CheckCircle2, AlertCircle, Clock, Eye, Filter, Trash2, Loader2 } from 'lucide-react'; // <<< AUTENTICAÇÃO (Loader2)
import { cn } from "@/lib/utils";
import { format, parseISO, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import axios from 'axios'; // Usar axios

// --- Tipos e Mock (como antes) ---
interface AlertItem { id?: number | string; type: string; message: string; metric?: string | null; value?: number | string | null; threshold?: number | string | null; created_date: string; read: boolean; campaignId?: string | null; campaignName?: string | null; }
// const Alert = { /* ... (mock como antes, se necessário) ... */ list: async(): Promise<AlertItem[]> => {return[];}, create: async(d:any): Promise<AlertItem> => ({id:''+Date.now(),...d}), update: async(id:any,d:any): Promise<AlertItem> => ({id,...d}), delete: async(id:any): Promise<{id:any}> => ({id}) };

export default function AlertsPage() {
  // --- Autenticação e Roteamento ---
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const router = useRouter();

  // --- Estados da Página ---
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [filteredAlerts, setFilteredAlerts] = useState<AlertItem[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true); // Loading inicial dos alertas
  const [actionLoading, setActionLoading] = useState<{ [key: string]: boolean }>({});
  const { toast } = useToast();

  // --- Lógica de Proteção de Rota ---
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      console.log(`[Auth Guard /alerts] Usuário não autenticado, redirecionando para /login`);
      router.push('/login');
    }
    // Carrega dados se autenticado e ainda não carregou
    if (!authLoading && isAuthenticated && loading) { // Usa 'loading' para evitar recarga dupla
        loadData();
    }
  }, [authLoading, isAuthenticated, router, loading]); // Adicionado 'loading'

  // --- Funções da Página ---
  const loadData = useCallback(async () => { setLoading(true); try { const response = await axios.get<AlertItem[]>('/api/alerts'); const alertData = response.data; if (!Array.isArray(alertData)) throw new Error("Dados inválidos da API"); const validatedData = alertData.map(a => ({ ...a, read: Boolean(a.read), created_date: a.created_date || new Date().toISOString() })); setAlerts(validatedData); } catch (error: any) { console.error('Erro ao buscar alertas:', error); toast({ variant: "destructive", title: "Erro", description: error.message || "Falha ao carregar alertas." }); setAlerts([]); } finally { setLoading(false); } }, [toast]);
  const applyFilter = useCallback(() => { if (filter === "all") { setFilteredAlerts(alerts); } else if (filter === "unread") { setFilteredAlerts(alerts.filter(a => !a.read)); } else { setFilteredAlerts(alerts.filter(a => a.type === filter)); } }, [alerts, filter]);
  const markAsRead = useCallback(async (alertId?: number | string) => { if (!alertId) return; setActionLoading(prev => ({ ...prev, [`read-${alertId}`]: true })); try { await axios.put(`/api/alerts?id=${alertId}`, { read: true }); setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, read: true } : a)); toast({ title: "Marcado como lido" }); } catch (error: any) { toast({ variant: "destructive", title: "Erro", description: `Falha ao marcar: ${error.message}` }); } finally { setActionLoading(prev => ({ ...prev, [`read-${alertId}`]: false })); } }, [toast]);
  const markAllAsRead = useCallback(async () => { const unreadIds = alerts.filter(a => !a.read).map(a => a.id); if (unreadIds.length === 0) return; setActionLoading(prev => ({ ...prev, readAll: true })); try { await axios.put('/api/alerts/mark-all-read'); setAlerts(prev => prev.map(a => ({ ...a, read: true }))); toast({ title: "Todos marcados" }); } catch (error: any) { toast({ variant: "destructive", title: "Erro", description: `Falha: ${error.message}` }); } finally { setActionLoading(prev => ({ ...prev, readAll: false })); } }, [alerts, toast]);
  const deleteAlert = useCallback(async (alertId?: number | string) => { if (!alertId) return; if (!confirm("Excluir alerta?")) return; setActionLoading(prev => ({ ...prev, [`delete-${alertId}`]: true })); try { await axios.delete(`/api/alerts?id=${alertId}`); setAlerts(prev => prev.filter(a => a.id !== alertId)); toast({ title: "Alerta Excluído", variant: 'destructive' }); } catch (error: any) { toast({ variant: "destructive", title: "Erro", description: `Falha: ${error.message}` }); } finally { setActionLoading(prev => ({ ...prev, [`delete-${alertId}`]: false })); } }, [toast]);
  const clearAllAlerts = useCallback(async () => { if (alerts.length === 0) return; if (!confirm("Excluir TODOS os alertas?")) return; setActionLoading(prev => ({ ...prev, clearAll: true })); try { await axios.delete('/api/alerts/clear-all'); setAlerts([]); toast({ title: "Alertas Limpos", variant: "destructive" }); } catch (error: any) { toast({ variant: "destructive", title: "Erro", description: `Falha: ${error.message}` }); } finally { setActionLoading(prev => ({ ...prev, clearAll: false })); } }, [alerts, toast]);
  const getAlertIcon = (type: string = 'info') => { const props = { className: "h-5 w-5", style: { filter: `drop-shadow(0 0 4px ${neonColor})` }}; switch(type.toLowerCase()){ case 'error': case 'destructive': return <AlertCircle {...props} className="text-red-500"/>; case 'warning': return <AlertTriangle {...props} className="text-yellow-500"/>; case 'success': return <CheckCircle2 {...props} className="text-green-500"/>; default: return <Info {...props} className="text-blue-500"/>; } };
  const formatDate = (dateString: string | undefined): string => { if (!dateString) return 'Data desconhecida'; try { const date = parseISO(dateString); if (!isValid(date)) return 'Data inválida'; return format(date, "dd/MM/yy HH:mm", { locale: ptBR }); } catch { return 'Erro na data'; } };
  useEffect(() => { applyFilter(); }, [applyFilter, alerts, filter]);

  // --- Estilos (como antes) ---
  const neonColor = '#1E90FF'; const neonRedColor = '#FF4444';
  const neoButtonBase = "border-[#2d62a3]/40 text-gray-300 bg-[#141414] shadow-[2px_2px_5px_rgba(0,0,0,0.4),-2px_-2px_5px_rgba(255,255,255,0.05)] hover:bg-[#1E90FF]/10 hover:text-white active:shadow-[inset_1px_1px_2px_rgba(0,0,0,0.3),inset_-1px_-1px_2px_rgba(255,255,255,0.03)] active:scale-[0.98] transition-all duration-150 h-8 px-3 text-xs";
  const neoButtonActive = "bg-[#1E90FF]/30 !text-white shadow-[inset_1px_1px_2px_rgba(0,0,0,0.3),inset_-1px_-1px_2px_rgba(255,255,255,0.03)] ring-1 ring-[#1E90FF]/50";
  const neoButtonError = "!bg-red-600/30 !text-red-300 ring-1 ring-red-500/50";
  const cardStyle = "bg-[#141414]/80 backdrop-blur-sm shadow-[5px_5px_10px_rgba(0,0,0,0.4),-5px_-5px_10px_rgba(255,255,255,0.05)] rounded-lg border-none";

   // --- Renderização Condicional (Auth Loading) ---
   if (authLoading) {
    return (
      <Layout>
         <div className="flex h-[calc(100vh-100px)] w-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-3 text-muted-foreground">Verificando acesso...</span>
        </div>
      </Layout>
    );
  }
  if (!isAuthenticated) { return null; } // Proteção

  // --- Renderização Principal ---
  return (
    <Layout>
      <Head><title>Alertas - USBMKT</title></Head>
      <div className="space-y-6 p-4 md:p-6">
        <h1 className="text-2xl font-black bg-gradient-to-r from-[#3a7ebf] to-[#5ca2e2] text-transparent bg-clip-text" style={{ filter: `drop-shadow(0 0 8px ${neonColor})` }}>
          Alertas e Notificações
        </h1>
        {/* Filtros e Ações */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex flex-wrap gap-2"> <Button variant="outline" onClick={() => setFilter("all")} className={cn(neoButtonBase, filter === "all" && neoButtonActive)}> <Bell className="mr-2 h-4 w-4" /> Todos </Button> <Button variant="outline" onClick={() => setFilter("unread")} className={cn(neoButtonBase, filter === "unread" && neoButtonActive)}> <Eye className="mr-2 h-4 w-4" /> Não Lidos {alerts.filter(a => !a.read).length > 0 && ( <Badge className="ml-2 bg-red-500 text-white px-1.5 text-[10px]">{alerts.filter(a => !a.read).length}</Badge> )} </Button> <Button variant="outline" onClick={() => setFilter("error")} className={cn(neoButtonBase, filter === "error" && neoButtonError)}> <AlertCircle className="mr-2 h-4 w-4" /> Críticos </Button> <Button variant="outline" onClick={() => setFilter("warning")} className={cn(neoButtonBase, filter === "warning" && '!bg-yellow-600/30 !text-yellow-300 ring-1 ring-yellow-500/50')}> <AlertTriangle className="mr-2 h-4 w-4" /> Avisos </Button> <Button variant="outline" onClick={() => setFilter("success")} className={cn(neoButtonBase, filter === "success" && '!bg-green-600/30 !text-green-300 ring-1 ring-green-500/50')}> <CheckCircle2 className="mr-2 h-4 w-4" /> Sucesso </Button> <Button variant="outline" onClick={() => setFilter("info")} className={cn(neoButtonBase, filter === "info" && '!bg-blue-600/30 !text-blue-300 ring-1 ring-blue-500/50')}> <Info className="mr-2 h-4 w-4" /> Info </Button> </div>
          <div className="flex gap-2"> <Button variant="outline" onClick={markAllAsRead} className={neoButtonBase} disabled={!alerts.some(a => !a.read) || actionLoading['readAll']}> {actionLoading['readAll'] ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <CheckCircle2 className="mr-2 h-4 w-4" />} Marcar Lidos </Button> <Button variant="destructive" onClick={clearAllAlerts} className={cn(neoButtonBase, "!border-red-600/50 !text-red-400 hover:!bg-red-900/30")} disabled={alerts.length === 0 || actionLoading['clearAll']}> {actionLoading['clearAll'] ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Trash2 className="mr-2 h-4 w-4" />} Limpar Tudo </Button> </div>
        </div>
        {/* Card Principal com Alertas */}
        <Card className={cn(cardStyle, "neo-brutal")}>
          <CardHeader> <CardTitle className="text-white" style={{ textShadow: `0 0 5px ${neonColor}` }}>Lista de Alertas</CardTitle> </CardHeader>
          <CardContent>
            {loading ? ( <div className="text-center p-8"><Loader2 className="h-6 w-6 animate-spin text-primary mx-auto"/></div> ) : (
              <> {filteredAlerts.length === 0 ? ( <div className="text-center p-8 text-gray-500">Nenhuma notificação encontrada {filter !== 'all' ? `para o filtro "${filter}"` : ''}.</div> ) : (
                  <ScrollArea className="h-[60vh] pr-4">
                    <div className="space-y-4">
                      {filteredAlerts.map((alert) => {
                        const isReading = actionLoading[`read-${alert.id}`];
                        const isDeleting = actionLoading[`delete-${alert.id}`];
                        return (
                          <div key={alert.id} className={cn( "p-4 rounded-lg border transition-opacity duration-300", "bg-[#101010]/50", alert.read ? "opacity-60 border-[#1E90FF]/10" : `border-[#1E90FF]/30 shadow-[0_0_10px_${neonColor}33]` )} >
                            <div className="flex items-start gap-4">
                              <div className={cn("p-2 rounded-full", alert.read ? 'bg-gray-800/50' : 'bg-[#1E90FF]/20')} style={{ boxShadow: alert.read ? 'none' : `inset 0 0 5px ${neonColor}50` }}> {getAlertIcon(alert.type)} </div>
                              <div className="flex-1">
                                <div className="flex justify-between items-start mb-1">
                                  <p className={cn("font-semibold text-sm", alert.read ? "text-gray-400" : "text-white")} style={{ textShadow: `0 0 4px ${alert.read ? 'transparent' : neonColor}` }}> {alert.message} </p>
                                  <span className="text-xs text-gray-500 flex-shrink-0 ml-2 whitespace-nowrap"> <Clock className="inline h-3 w-3 mr-1"/> {formatDate(alert.created_date)} </span>
                                </div>
                                {(alert.metric || alert.campaignName) && ( <div className="mt-1 flex items-center gap-2 flex-wrap"> {alert.campaignName && <Badge variant="secondary" className="bg-purple-900/50 border-purple-600/50 text-purple-300">{alert.campaignName}</Badge>} {alert.metric && <Badge variant="secondary" className="bg-slate-700/50 border-slate-600/50">{alert.metric}: {alert.value?.toString()}</Badge>} {alert.threshold && <Badge variant="outline" className="border-dashed border-slate-600">Meta: {alert.threshold?.toString()}</Badge>} </div> )}
                                <div className="mt-3 flex justify-end items-center gap-2">
                                  <Button size="sm" onClick={() => markAsRead(alert.id)} disabled={alert.read || isReading || isDeleting} className={cn(neoButtonBase, "h-7 px-2 text-xs", alert.read && "opacity-50 cursor-not-allowed")}> {isReading ? <Loader2 className="mr-1 h-3 w-3 animate-spin"/> : <Eye className="mr-1 h-3 w-3" />} {alert.read ? "Lido" : "Marcar Lido"} </Button>
                                  <Button variant="ghost" size="icon" onClick={() => deleteAlert(alert.id)} className="text-red-500 hover:text-red-400 hover:bg-red-900/20 h-7 w-7" disabled={isDeleting || isReading}> {isDeleting ? <Loader2 className="h-4 w-4 animate-spin"/> : <Trash2 className="h-4 w-4"/>} </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
              )} </>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
} // <<< CHAVE DE FECHAMENTO ADICIONADA