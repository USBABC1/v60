// pages/export.tsx
import React, { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/router';
import Layout from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { DateRange } from "react-day-picker";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { Download, Loader2, FileText, BarChart3, DollarSign, Filter, TrendingUp, LineChart, Calendar as CalendarIcon } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
// *** CORREÇÃO: Importa AxiosResponse junto com AxiosError ***
import axios, { AxiosError, AxiosResponse } from 'axios';
import { format, subDays, isValid, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// --- Interfaces e Constantes ---
interface jsPDFWithAutoTable extends jsPDF {
  lastAutoTable?: { finalY: number };
}
interface ReportLoadingState { campaigns: boolean; budget: boolean; metrics: boolean; funnel: boolean; ltv: boolean; general: boolean; }
interface CampaignSelectItem { id: string; name: string; }
type ReportType = keyof ReportLoadingState;
const PDF_THEME = { BACKGROUND: [255, 255, 255] as [number, number, number], TEXT: [33, 37, 41] as [number, number, number], TEXT_MUTED: [108, 117, 125] as [number, number, number], PRIMARY: [0, 123, 255] as [number, number, number], SECONDARY: [108, 117, 125] as [number, number, number], ERROR: [220, 53, 69] as [number, number, number], SUCCESS: [25, 135, 84] as [number, number, number], WARNING: [255, 193, 7] as [number, number, number], INFO: [13, 202, 240] as [number, number, number], TABLE_HEADER_BG: [233, 236, 239] as [number, number, number], TABLE_HEADER_TEXT: [73, 80, 87] as [number, number, number], TABLE_BORDER: [222, 226, 230] as [number, number, number], TABLE_ALT_BG: [248, 249, 250] as [number, number, number] };
const DATE_FORMAT_DISPLAY = 'dd/MM/yyyy'; const DATE_FORMAT_API = 'yyyy-MM-dd'; const DEFAULT_PERIOD_DAYS = 14;
const LOGO_PATH = '/logo.png'; const LOGO_WIDTH_MM = 30; const LOGO_HEIGHT_MM = 12; const PAGE_MARGIN = 15; const FOOTER_HEIGHT = 15;
const formatCurrency = (v: any): string => v == null || isNaN(v) ? 'R$ 0,00' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const formatNumber = (v: any): string => v == null || isNaN(v) ? '0' : Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 0 });
const formatPercentage = (v: any): string => v == null || isNaN(v) ? '0.0%' : `${Number(v).toFixed(1)}%`;
const formatDecimal = (v: any, d = 2): string => { if (v == null || isNaN(v)) return (0).toFixed(d); if (!isFinite(v)) return 'N/A'; return Number(v).toFixed(d); };
const getBaseTableOptions = (startY: number, logoUrl: string | null): any => ({ startY: startY, theme: 'striped', styles: { font: 'helvetica', fontSize: 9, cellPadding: 2.8, textColor: PDF_THEME.TEXT, valign: 'middle', }, headStyles: { fillColor: PDF_THEME.TABLE_HEADER_BG, textColor: PDF_THEME.TABLE_HEADER_TEXT, fontStyle: 'bold', halign: 'center', fontSize: 9.5, lineWidth: 0.1, lineColor: PDF_THEME.SECONDARY, }, bodyStyles: { fillColor: PDF_THEME.BACKGROUND, textColor: PDF_THEME.TEXT, lineWidth: 0.1, lineColor: PDF_THEME.TABLE_BORDER, }, alternateRowStyles: { fillColor: PDF_THEME.TABLE_ALT_BG, }, margin: { top: PAGE_MARGIN + (logoUrl ? LOGO_HEIGHT_MM + 12 : 17), bottom: FOOTER_HEIGHT + PAGE_MARGIN, left: PAGE_MARGIN, right: PAGE_MARGIN } });

// --- Define a type guard para verificar se o objeto tem a propriedade 'error' ---
// *** CORREÇÃO: Usa AxiosResponse que agora está importado ***
type ApiResult = AxiosResponse<any, any> | { error: any; data: null };
function hasError(result: ApiResult): result is { error: any; data: null } {
    return (result as { error: any }).error !== undefined;
}
// ------------------------------------------------------------------------------

export default function ExportPage() {
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [campaigns, setCampaigns] = useState<CampaignSelectItem[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('all');
  const [campaignsLoading, setCampaignsLoading] = useState<boolean>(true);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => { const e=new Date(); const s=subDays(e, DEFAULT_PERIOD_DAYS - 1); return { from: s, to: e }; });
  const [isLoading, setIsLoading] = useState<ReportLoadingState>({ campaigns: false, budget: false, metrics: false, funnel: false, ltv: false, general: false });
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [popoverOpen, setPopoverOpen] = useState(false);

  const cardStyle="bg-[#141414]/80 backdrop-blur-sm shadow-[5px_5px_10px_rgba(0,0,0,0.4),-5px_-5px_10px_rgba(255,255,255,0.05)] rounded-lg border border-[hsl(var(--border))]/30";const primaryButtonStyle=`bg-gradient-to-r from-[hsl(var(--primary))] to-[#4682B4] hover:from-[#4682B4] hover:to-[hsl(var(--primary))] text-primary-foreground font-semibold shadow-[0_4px_10px_rgba(30,144,255,0.4)] transition-all duration-300 ease-in-out transform hover:scale-[1.03] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#0e1015] focus:ring-[#5ca2e2]`;const titleStyle="text-base font-semibold text-white";const neumorphicBaseStyle="bg-[#141414] border-none text-white shadow-[3px_3px_6px_rgba(0,0,0,0.3),-3px_-3px_6px_rgba(255,255,255,0.05)]";const selectTriggerStyle=cn(neumorphicBaseStyle,`hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.3),inset_-2px_-2px_4px_rgba(255,255,255,0.05)] hover:bg-[#1E90FF]/10 focus:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.3),inset_-2px_-2px_4px_rgba(255,255,255,0.05)]`);const popoverContentStyle=`bg-[#1e2128] border-[#1E90FF]/30 text-white`;

  useEffect(() => {
    if (!authLoading && !isAuthenticated) { router.push('/login'); }
    if (!authLoading && isAuthenticated) { if(campaigns.length === 0) fetchCampaignsClient(); if(!logoDataUrl) loadLogo(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isAuthenticated, router]); // Removido campaigns.length e logoDataUrl para evitar re-execução desnecessária

  const loadLogo = useCallback(()=>{const c=document.createElement('canvas');const x=c.getContext('2d');const i=new Image();i.crossOrigin="Anonymous";i.src=LOGO_PATH;i.onload=()=>{c.width=i.naturalWidth||250;c.height=i.naturalHeight||100;if(x){x.drawImage(i,0,0,c.width,c.height);try{setLogoDataUrl(c.toDataURL('image/png'))}catch(e){console.error("Erro dataURL logo:",e)}}};i.onerror=()=>{console.error("Erro carregar logo:", LOGO_PATH)}},[]);
  const fetchCampaignsClient = useCallback(async () => { setCampaignsLoading(true); try { const r=await axios.get<CampaignSelectItem[]>('/api/campaigns?fields=id,name'); setCampaigns(r.data || []); if(r.data && r.data.length > 0 && selectedCampaignId === '') {setSelectedCampaignId('all');} else if (!r.data || r.data.length === 0) {setSelectedCampaignId('all');} }catch(e:unknown){let d="Falha buscar.";if(axios.isAxiosError(e))d=e.response?.data?.message||e.message||d;else if(e instanceof Error)d=e.message;toast({title:"Erro Rede",description:d,variant:"destructive"});setCampaigns([]);}finally{setCampaignsLoading(false);}}, [toast, selectedCampaignId]);
  const getFormattedDateRange = (): { start: string; end: string } | null => { const { from, to } = dateRange ?? {}; if (from && to && isValid(from) && isValid(to)) { return { start: format(from, DATE_FORMAT_API), end: format(to, DATE_FORMAT_API) }; } return null; };
  const getDisplayDateRange = (): string => { const { from, to } = dateRange ?? {}; if (from && to && isValid(from) && isValid(to)) { return `Per: ${format(from, DATE_FORMAT_DISPLAY)} a ${format(to, DATE_FORMAT_DISPLAY)}`; } if (from && isValid(from)) { return `Data: ${format(from, DATE_FORMAT_DISPLAY)}`; } return 'Selec. período'; };

  const addPdfHeaderFooter = (doc: jsPDFWithAutoTable, pageNum: number, totalPages: number, title: string, campaignName: string, dateRangeStr: string) => {
    const h = doc.internal.pageSize.height;
    const w = doc.internal.pageSize.width;
    if (logoDataUrl) {
      try { doc.addImage(logoDataUrl, 'PNG', PAGE_MARGIN, PAGE_MARGIN - 8, LOGO_WIDTH_MM, LOGO_HEIGHT_MM) } catch (e) { console.error("Erro ao adicionar logo ao PDF:", e); }
    }
    const tY = PAGE_MARGIN + (logoDataUrl ? LOGO_HEIGHT_MM - 4 : 0);
    doc.setFontSize(18).setFont('helvetica', 'bold').setTextColor(PDF_THEME.PRIMARY[0], PDF_THEME.PRIMARY[1], PDF_THEME.PRIMARY[2]).text(title, w / 2, tY, { align: 'center' });
    doc.setFontSize(10).setFont('helvetica', 'normal').setTextColor(PDF_THEME.TEXT_MUTED[0], PDF_THEME.TEXT_MUTED[1], PDF_THEME.TEXT_MUTED[2]).text(`${campaignName} | ${dateRangeStr}`, w / 2, tY + 6, { align: 'center' });
    doc.setDrawColor(PDF_THEME.TABLE_BORDER[0], PDF_THEME.TABLE_BORDER[1], PDF_THEME.TABLE_BORDER[2]).setLineWidth(0.1).line(PAGE_MARGIN, tY + 10, w - PAGE_MARGIN, tY + 10);
    const fY = h - 8;
    const gD = format(new Date(), "dd/MM/yy HH:mm");
    doc.setFontSize(8).setTextColor(PDF_THEME.TEXT_MUTED[0], PDF_THEME.TEXT_MUTED[1], PDF_THEME.TEXT_MUTED[2]).text("Gerado por USBMKT", PAGE_MARGIN, fY).text(gD, w / 2, fY, { align: 'center' }).text(`Pág ${pageNum}/${totalPages}`, w - PAGE_MARGIN, fY, { align: 'right' });
  };

  const addPdfText = (doc: jsPDFWithAutoTable, text: string, x: number, y: number, options: any = {}, size: number = 10, style: string = 'normal', color: number[] = PDF_THEME.TEXT): { y: number, addedPage: boolean } => {
    const pH = doc.internal.pageSize.height;
    const pW = doc.internal.pageSize.width;
    const csY = PAGE_MARGIN + (logoDataUrl ? LOGO_HEIGHT_MM + 12 : 17);
    const ceY = pH - FOOTER_HEIGHT - PAGE_MARGIN;
    const lH = (size / doc.internal.scaleFactor) * 1.25; // Ajustado para espaçamento
    doc.setFontSize(size).setFont('helvetica', style).setTextColor(color[0], color[1], color[2]);
    const ls = doc.splitTextToSize(text, options.maxWidth || (pW - x - PAGE_MARGIN));
    const nH = ls.length * lH;
    let cY = y < csY ? csY : y;
    let aP = false;
    if (cY + nH > ceY) {
      doc.addPage();
      const cP = doc.internal.pages.length; // Número da nova página
      addPdfHeaderFooter(doc, cP, cP, "Continuação...", "", ""); // Cabeçalho/rodapé na nova página
      cY = csY; // Reseta Y para topo
      aP = true;
    }
    doc.text(ls, x, cY, options);
    return { y: cY + nH, addedPage: aP };
  };

  const addSectionTitle = (doc: jsPDFWithAutoTable, title: string, y: number): number => {
    const pH = doc.internal.pageSize.height;
    const ceY = pH - FOOTER_HEIGHT - PAGE_MARGIN;
    let currentY = y;
    const titleHeight = 12; // Espaço estimado para título + linha + margem
    if (currentY + titleHeight > ceY) {
        doc.addPage();
        const cP = doc.internal.pages.length;
        addPdfHeaderFooter(doc, cP, cP, "Continuação...", "", "");
        currentY = PAGE_MARGIN + (logoDataUrl ? LOGO_HEIGHT_MM + 12 : 17);
    }
    doc.setFontSize(14).setFont('helvetica', 'bold').setTextColor(PDF_THEME.PRIMARY[0], PDF_THEME.PRIMARY[1], PDF_THEME.PRIMARY[2]);
    doc.text(title, PAGE_MARGIN, currentY + 4);
    doc.setDrawColor(PDF_THEME.PRIMARY[0], PDF_THEME.PRIMARY[1], PDF_THEME.PRIMARY[2]).setLineWidth(0.4).line(PAGE_MARGIN, currentY + 5.5, PAGE_MARGIN + 40, currentY + 5.5);
    return currentY + titleHeight;
  };

  const addImageFromDataUrl = (doc: jsPDFWithAutoTable, imageUrl: string | undefined | null, y: number, placeholderText: string, desiredWidthMm = 90): {y: number} => {
    let currentY = y;
    const pH = doc.internal.pageSize.height;
    const ceY = pH - FOOTER_HEIGHT - PAGE_MARGIN;

    if (imageUrl && imageUrl.startsWith('data:image/')) {
      try {
        const imgProps = doc.getImageProperties(imageUrl);
        const aspectRatio = imgProps.width / imgProps.height;
        let chartWidthMm = Math.min(desiredWidthMm, doc.internal.pageSize.width - PAGE_MARGIN * 2);
        let chartHeightMm = chartWidthMm / aspectRatio;
        const availableHeight = ceY - currentY - 5; // Espaço disponível

        if (chartHeightMm > availableHeight) { // Se não couber
            if (availableHeight < 20) { // Se o espaço restante for muito pequeno, adiciona nova página
                doc.addPage();
                const cP = doc.internal.pages.length;
                addPdfHeaderFooter(doc, cP, cP, "Continuação...", "", "");
                currentY = PAGE_MARGIN + (logoDataUrl ? LOGO_HEIGHT_MM + 12 : 17);
                // Recalcula altura e largura na nova página
                chartWidthMm = Math.min(desiredWidthMm, doc.internal.pageSize.width - PAGE_MARGIN * 2);
                chartHeightMm = chartWidthMm / aspectRatio;
                const newAvailableHeight = ceY - currentY - 5;
                 if(chartHeightMm > newAvailableHeight){ // Redimensiona se ainda não couber na página nova
                    chartHeightMm = Math.max(newAvailableHeight, 10);
                    chartWidthMm = chartHeightMm * aspectRatio;
                 }
            } else { // Tenta redimensionar para caber no espaço restante
                chartHeightMm = Math.max(availableHeight, 10);
                chartWidthMm = chartHeightMm * aspectRatio;
                if(chartWidthMm > doc.internal.pageSize.width - PAGE_MARGIN * 2){ // Ajusta largura se passar
                    chartWidthMm = doc.internal.pageSize.width - PAGE_MARGIN * 2;
                    chartHeightMm = chartWidthMm / aspectRatio;
                }
            }
        }
        const chartX = (doc.internal.pageSize.width - chartWidthMm) / 2;
        doc.addImage(imageUrl, imgProps.fileType || 'PNG', chartX, currentY, chartWidthMm, chartHeightMm);
        currentY += chartHeightMm + 8;
      } catch (imgError) {
        console.error(`Erro ao adicionar imagem (${placeholderText}):`, imgError);
        currentY = addPdfText(doc, `[Erro ao carregar gráfico: ${placeholderText}]`, PAGE_MARGIN, currentY, {}, 9, 'italic', PDF_THEME.ERROR).y + 5;
      }
    } else {
      currentY = addPdfText(doc, `[${placeholderText}: Gráfico Indisponível]`, PAGE_MARGIN, currentY, { align: 'center'}, 9, 'italic', PDF_THEME.TEXT_MUTED).y + 8;
    }
    return { y: currentY };
  };


  const addCampaignsContent = (doc: jsPDFWithAutoTable, data: any[], currentY: number): { y: number } => {
    let y = addSectionTitle(doc, "Campanhas", currentY);
    if (!Array.isArray(data) || data.length === 0) {
      return { y: addPdfText(doc, "Nenhuma campanha encontrada para os filtros selecionados.", PAGE_MARGIN, y, {}, 10, 'italic', PDF_THEME.TEXT_MUTED).y + 5 };
    }
    try {
      const head = [['Nome', 'Plat.', 'Objetivo', 'Orç Total', 'Orç Diário', 'Duração (d)']];
      const body = data.map(c => [
        c?.name ?? 'N/A',
        (Array.isArray(c?.platform) ? c.platform.join(', ') : c?.platform) ?? 'N/A',
        (Array.isArray(c?.objective) ? c.objective.join(', ') : c?.objective) ?? 'N/A',
        typeof c?.budget === 'number' ? formatCurrency(c.budget) : 'N/A',
        typeof c?.daily_budget === 'number' ? formatCurrency(c.daily_budget) : 'N/A',
        c?.duration ?? 'N/A'
      ]);
      autoTable(doc, {
        ...getBaseTableOptions(y, logoDataUrl),
        head: head,
        body: body,
        columnStyles: { 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'center' } }
      });
      return { y: (doc.lastAutoTable?.finalY ?? y) + 12 };
    } catch (e: unknown) {
      const errorDetail = (e instanceof Error ? e.message : 'Erro desconhecido');
      return { y: addPdfText(doc, `Erro ao gerar tabela de Campanhas: ${errorDetail}`, PAGE_MARGIN, y, {}, 10, 'normal', PDF_THEME.ERROR).y + 5 };
    }
  };

  const addBudgetContent = (doc: jsPDFWithAutoTable, data: any, currentY: number): { y: number } => {
    let y = addSectionTitle(doc, "Orçamento", currentY);
    if (!data || typeof data !== 'object') {
      return { y: addPdfText(doc, "Dados de orçamento inválidos ou não encontrados.", PAGE_MARGIN, y, {}, 10, 'italic', PDF_THEME.TEXT_MUTED).y + 5 };
    }
    y = addPdfText(doc, `Orçamento Total: ${data.totalBudgetFmt ?? 'N/A'}`, PAGE_MARGIN, y, {}, 11, 'bold', PDF_THEME.PRIMARY).y + 6;
    const budgetItems = [
      { l: 'Tráfego Pago:', v: data.trafficCostFmt, p: data.trafficPerc },
      { l: 'Criativos/Design:', v: data.creativeCostFmt, p: data.creativePerc },
      { l: 'Custos Operacionais:', v: data.operationalCostFmt, p: data.opPerc },
      { l: 'Margem de Lucro Esperada:', v: data.profitFmt, p: data.profitPerc },
    ];
    budgetItems.forEach(item => {
      y = addPdfText(doc, `${item.l} ${item.v ?? 'N/A'} (${formatPercentage(item.p)})`, PAGE_MARGIN + 5, y, {}, 9).y + 1.5;
    });
    if (data.unallocatedValue != null && !isNaN(data.unallocatedValue) && data.unallocatedValue > 0.01) {
      y = addPdfText(doc, `- Não Alocado: ${data.unallocatedFmt ?? 'N/A'} (${formatPercentage(data.unallocatedPerc)})`, PAGE_MARGIN + 5, y, {}, 8, 'italic', PDF_THEME.TEXT_MUTED).y + 1.5;
    }
    y = addImageFromDataUrl(doc, data.chartImageUrl, y + 4, "Gráfico Pizza Orçamento").y;
    return { y: y + 5 };
  };


  const addFunnelContent = (doc: jsPDFWithAutoTable, data: any, currentY: number): { y: number } => {
    let y = addSectionTitle(doc, `Funil: ${data.clientName || 'Cliente'} | ${data.productName || 'Produto'}`, currentY);
    if (!data || typeof data !== 'object') {
      return { y: addPdfText(doc, "Dados do funil inválidos ou não encontrados.", PAGE_MARGIN, y, {}, 10, 'italic', PDF_THEME.TEXT_MUTED).y + 5 };
    }

    if (data.funnelData && Array.isArray(data.funnelData) && data.funnelData.length > 0) {
      y = addPdfText(doc, "Etapas (Estimativa Diária):", PAGE_MARGIN, y, {}, 10, 'bold', PDF_THEME.SECONDARY).y + 2;
      const stagesBody = data.funnelData.map((s: any) => [s.name || '?', s.displayValue ?? formatNumber(s.value)]);
      autoTable(doc, {
        ...getBaseTableOptions(y, logoDataUrl),
        head: [['Etapa', 'Valor/Dia']],
        body: stagesBody,
        tableWidth: 'wrap',
        styles: { fontSize: 8.5 },
        headStyles: { fontSize: 9 },
        columnStyles: { 1: { halign: 'right' } }
      });
      y = (doc.lastAutoTable?.finalY ?? y) + 8;
    } else {
      y = addPdfText(doc, "Dados das etapas do funil não disponíveis.", PAGE_MARGIN, y, {}, 10, 'italic', PDF_THEME.TEXT_MUTED).y + 4;
    }

    y = addImageFromDataUrl(doc, data.chartImageUrl, y, "Visualização Funil", 70).y;

    y = addPdfText(doc, "Resumo Financeiro (Estimativa):", PAGE_MARGIN, y, {}, 10, 'bold', PDF_THEME.SECONDARY).y + 2;
    const summaryBody = [
      ['Volume (D/S/M)', `${formatNumber(data.volume?.daily)} / ${formatNumber(data.volume?.weekly)} / ${formatNumber(data.volume?.monthly)}`],
      ['Faturamento (D/S/M)', `${formatCurrency(data.revenue?.daily)} / ${formatCurrency(data.revenue?.weekly)} / ${formatCurrency(data.revenue?.monthly)}`],
      ['Lucro (D/S/M)', `${formatCurrency(data.profit?.daily)} / ${formatCurrency(data.profit?.weekly)} / ${formatCurrency(data.profit?.monthly)}`],
    ];
    autoTable(doc, {
      ...getBaseTableOptions(y, logoDataUrl),
      head: [['Indicador', 'Estimativa']],
      body: summaryBody,
      styles: { fontSize: 8.5 },
      headStyles: { fontSize: 9 },
      columnStyles: { 0: { fontStyle: 'bold' }, 1: { halign: 'right' } }
    });
    return { y: (doc.lastAutoTable?.finalY ?? y) + 12 };
  };


  const addMetricsContent = (doc: jsPDFWithAutoTable, data: any, currentY: number): { y: number } => {
    let y = addSectionTitle(doc, "Métricas", currentY);
    if (!data || !data.totals) {
      return { y: addPdfText(doc, "Dados de métricas inválidos ou não encontrados.", PAGE_MARGIN, y, {}, 10, 'italic', PDF_THEME.TEXT_MUTED).y + 5 };
    }
    const t = data.totals;
    const totalsBody = [
      ['Cliques', formatNumber(t.clicks)],
      ['Impressões', formatNumber(t.impressions)],
      ['Conversões', formatNumber(t.conversions)],
      ['Custo Total', formatCurrency(t.cost)],
      ['Receita Total', formatCurrency(t.revenue)],
      ['CTR', `${formatDecimal(t.ctr, 2)}%`],
      ['CPC Médio', formatCurrency(t.cpc)],
      ['Taxa de Conversão', `${formatDecimal(t.conversionRate, 2)}%`],
      ['Custo por Conversão', formatCurrency(t.costPerConversion)],
      ['ROI', !isFinite(t.roi ?? NaN) ? 'N/A' : `${formatDecimal(t.roi, 1)}%`],
    ];
    autoTable(doc, {
      ...getBaseTableOptions(y, logoDataUrl),
      head: [['Métrica', 'Valor Total']],
      body: totalsBody,
      columnStyles: { 0: { fontStyle: 'bold' }, 1: { halign: 'right' } }
    });
    y = (doc.lastAutoTable?.finalY ?? y) + 8;

    y = addImageFromDataUrl(doc, data.chartImageUrl, y, "Evolução Diária", 180).y;

    if (data.dailyData && Array.isArray(data.dailyData) && data.dailyData.length > 0) {
      y = addPdfText(doc, "Detalhes Diários:", PAGE_MARGIN, y, {}, 10, 'bold', PDF_THEME.SECONDARY).y + 2;
      try {
        const dailyBody = data.dailyData.map((d: any) => {
          let formattedDate = 'Data Inválida';
          try {
            if (typeof d.date === 'string' && d.date.match(/^\d{4}-\d{2}-\d{2}/)) {
              const parsedDate = parseISO(d.date);
              if (isValid(parsedDate)) formattedDate = format(parsedDate, DATE_FORMAT_DISPLAY);
            } else if (d.date instanceof Date && isValid(d.date)) {
              formattedDate = format(d.date, DATE_FORMAT_DISPLAY);
            }
          } catch (e) { /* Mantém 'Data Inválida' */ }
          return [
            formattedDate,
            formatNumber(d.clicks),
            formatNumber(d.conversions),
            formatCurrency(d.cost),
            formatCurrency(d.revenue)
          ];
        });
        autoTable(doc, {
          ...getBaseTableOptions(y, logoDataUrl),
          head: [['Data', 'Cliques', 'Conv', 'Custo', 'Receita']],
          body: dailyBody,
          styles: { fontSize: 8 },
          headStyles: { fontSize: 8.5 }
        });
        y = (doc.lastAutoTable?.finalY ?? y) + 10;
      } catch (e: unknown) {
        const errorDetail = (e instanceof Error ? e.message : 'Erro desconhecido');
        y = addPdfText(doc, `Erro ao gerar tabela diária: ${errorDetail}.`, PAGE_MARGIN, y, {}, 10, 'normal', PDF_THEME.ERROR).y + 5;
      }
    } else {
      y = addPdfText(doc, "Nenhum dado diário disponível para o período selecionado.", PAGE_MARGIN, y, {}, 10, 'italic', PDF_THEME.TEXT_MUTED).y + 5;
    }
    return { y };
  };

  const addLtvContent = (doc: jsPDFWithAutoTable, data: any, currentY: number): { y: number } => {
    let y = addSectionTitle(doc, "Lifetime Value (LTV)", currentY);
    if (!data?.inputs || data.result === undefined || data.result === null) {
      return { y: addPdfText(doc, "Dados de LTV inválidos ou não encontrados.", PAGE_MARGIN, y, {}, 10, 'italic', PDF_THEME.TEXT_MUTED).y + 5 }
    }
    y = addPdfText(doc, `Parâmetros Utilizados:`, PAGE_MARGIN, y, {}, 10, 'bold', PDF_THEME.SECONDARY).y + 2;
    y = addPdfText(doc, ` • Ticket Médio: ${formatCurrency(data.inputs.avgTicket)}`, PAGE_MARGIN + 3, y).y + 1;
    y = addPdfText(doc, ` • Frequência de Compra (por mês): ${formatDecimal(data.inputs.purchaseFrequency, 1)}`, PAGE_MARGIN + 3, y).y + 1;
    y = addPdfText(doc, ` • Tempo de Vida do Cliente (meses): ${formatNumber(data.inputs.customerLifespan)}`, PAGE_MARGIN + 3, y).y + 8;

    doc.setFillColor(230, 245, 255);
    doc.setDrawColor(PDF_THEME.PRIMARY[0], PDF_THEME.PRIMARY[1], PDF_THEME.PRIMARY[2]);
    doc.setLineWidth(0.3);
    doc.roundedRect(PAGE_MARGIN, y - 4, doc.internal.pageSize.width - PAGE_MARGIN * 2, 14, 3, 3, 'FD');

    y = addPdfText(doc, `LTV Estimado: ${formatCurrency(data.result)}`, doc.internal.pageSize.width / 2, y, { align: 'center' }, 12, 'bold', PDF_THEME.PRIMARY).y;
    return { y: y + 12 };
  };

  const addGeneralContent = (doc: jsPDFWithAutoTable, data: any, currentY: number): { y: number } => {
    let y = addSectionTitle(doc, "Resumo Geral", currentY);
    if (!data) { return { y: addPdfText(doc, "Dados gerais não encontrados.", PAGE_MARGIN, y, {}, 10, 'italic', PDF_THEME.TEXT_MUTED).y + 5 } }

    const itemSize = 9;
    const boldStyle = 'bold';

    if (data.metrics?.totals) {
      y = addPdfText(doc, "Métricas Principais:", PAGE_MARGIN + 2, y, {}, 10, boldStyle, PDF_THEME.SECONDARY).y + 1.5;
      const t = data.metrics.totals;
      y = addPdfText(doc, ` Custo Total: ${formatCurrency(t.cost)} | Receita Total: ${formatCurrency(t.revenue)}`, PAGE_MARGIN + 4, y, {}, itemSize).y;
      const roi = !isFinite(t.roi ?? NaN) ? 'N/A' : `${formatDecimal(t.roi, 1)}%`;
      y = addPdfText(doc, ` ROI: ${roi} | Conversões: ${formatNumber(t.conversions)}`, PAGE_MARGIN + 4, y, {}, itemSize).y;
    } else {
      y = addPdfText(doc, "Métricas não disponíveis.", PAGE_MARGIN + 2, y, {}, 9, 'italic', PDF_THEME.TEXT_MUTED).y;
    }
    y += 3;

    if (data.funnel) {
      y = addPdfText(doc, "Funil (Estimativa Diária):", PAGE_MARGIN + 2, y, {}, 10, boldStyle, PDF_THEME.SECONDARY).y + 1.5;
      y = addPdfText(doc, ` Vendas: ${formatNumber(data.funnel.volume?.daily)} | Faturamento: ${formatCurrency(data.funnel.revenue?.daily)} | Lucro: ${formatCurrency(data.funnel.profit?.daily)}`, PAGE_MARGIN + 4, y, {}, itemSize).y;
    } else {
      y = addPdfText(doc, "Funil não disponível.", PAGE_MARGIN + 2, y, {}, 9, 'italic', PDF_THEME.TEXT_MUTED).y;
    }
    y += 3;

    if (data.ltv?.result != null || data.funnel?.clientName) {
      y = addPdfText(doc, "Cliente & LTV:", PAGE_MARGIN + 2, y, {}, 10, boldStyle, PDF_THEME.SECONDARY).y + 1.5;
      if (data.ltv?.result != null) {
        y = addPdfText(doc, ` LTV Estimado: ${formatCurrency(data.ltv.result)}`, PAGE_MARGIN + 4, y, {}, itemSize, boldStyle, PDF_THEME.SUCCESS).y;
      } else {
        y = addPdfText(doc, "- LTV não disponível.", PAGE_MARGIN + 4, y, {}, 9, 'italic', PDF_THEME.TEXT_MUTED).y;
      }
      if (data.funnel?.clientName) {
        y = addPdfText(doc, ` Cliente: ${data.funnel.clientName} | Produto: ${data.funnel.productName || 'N/A'}`, PAGE_MARGIN + 4, y, {}, itemSize).y;
      }
    } else {
      y = addPdfText(doc, "Dados de Cliente/LTV não disponíveis.", PAGE_MARGIN + 2, y, {}, 9, 'italic', PDF_THEME.TEXT_MUTED).y;
    }
    y += 3;

    if (data.budget) {
      y = addPdfText(doc, "Orçamento:", PAGE_MARGIN + 2, y, {}, 10, boldStyle, PDF_THEME.SECONDARY).y + 1.5;
      y = addPdfText(doc, `- Orçamento Total: ${data.budget.totalBudgetFmt ?? 'N/A'} | % Tráfego: ${formatPercentage(data.budget.trafficPerc)}`, PAGE_MARGIN + 4, y, {}, itemSize).y;
      y = addPdfText(doc, `- % Criativos: ${formatPercentage(data.budget.creativePerc)} | % Operacional: ${formatPercentage(data.budget.opPerc)}`, PAGE_MARGIN + 4, y, {}, itemSize).y;
    } else {
      y = addPdfText(doc, "Orçamento não disponível.", PAGE_MARGIN + 2, y, {}, 9, 'italic', PDF_THEME.TEXT_MUTED).y;
    }
    return { y: y + 10 };
  };

  const generatePdf = async (reportType: ReportType) => {
    if (authLoading) return;
    if (!dateRange?.from || !dateRange?.to) {
      toast({ title: "Seleção de Período Necessária", description: "Por favor, selecione um período de datas.", variant: "destructive" });
      return;
    }
    setIsLoading(prev => ({ ...prev, [reportType]: true }));
    const dateRangeFormatted = getFormattedDateRange();
    if (!dateRangeFormatted) {
      toast({ title: "Erro de Data", description: "Período de datas inválido.", variant: "destructive" });
      setIsLoading(prev => ({ ...prev, [reportType]: false }));
      return;
    }

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }) as jsPDFWithAutoTable;
    let totalPages = 1;
    const campaignName = selectedCampaignId === 'all' ? 'Todas Campanhas' : campaigns.find(c => c.id === selectedCampaignId)?.name || 'Campanha Específica';
    const dateRangeStr = getDisplayDateRange();
    let title = "Relatório";
    let data: any = null;
    let currentY = PAGE_MARGIN + (logoDataUrl ? LOGO_HEIGHT_MM + 12 : 17);
    let errorMessage = '';
    const backendMessage = " Verifique se as APIs de backend estão rodando.";

    try {
      switch (reportType) {
        case 'campaigns': title = "Relatório de Campanhas"; break;
        case 'budget': title = "Relatório de Orçamento"; break;
        case 'metrics': title = "Relatório de Métricas"; break;
        case 'funnel': title = "Relatório de Funil"; break;
        case 'ltv': title = "Relatório de LTV"; break;
        case 'general': title = "Relatório Geral"; break;
      }

      addPdfHeaderFooter(doc, 1, totalPages, title, campaignName, dateRangeStr);

      const params = {
        startDate: dateRangeFormatted.start,
        endDate: dateRangeFormatted.end,
        campaignId: selectedCampaignId === 'all' ? undefined : selectedCampaignId
      };
      const requiresBackend = ['budget', 'metrics', 'funnel', 'ltv', 'general'].includes(reportType);

      switch (reportType) {
        case 'campaigns':
          try {
            const response = await axios.get('/api/campaigns', { params });
            if (!Array.isArray(response.data)) throw new Error("Formato de dados de campanhas inválido recebido da API.");
            data = response.data;
            currentY = addCampaignsContent(doc, data, currentY).y;
          } catch (e: unknown) {
            errorMessage = (axios.isAxiosError(e) ? e.response?.data?.message : (e instanceof Error ? e.message : 'Erro desconhecido'));
            console.error("Erro ao buscar campanhas:", e);
            currentY = addPdfText(doc, `Erro ao buscar dados de Campanhas: ${errorMessage}.`, PAGE_MARGIN, currentY, {}, 10, 'normal', PDF_THEME.ERROR).y;
          }
          break;
        case 'budget':
          try {
            const response = await axios.get(`/api/budget`, { params });
            data = response.data;
            currentY = addBudgetContent(doc, data, currentY).y;
          } catch (e: unknown) {
            errorMessage = (axios.isAxiosError(e) ? e.response?.data?.message : (e instanceof Error ? e.message : 'Erro desconhecido'));
            console.error("Erro ao buscar orçamento:", e);
            currentY = addPdfText(doc, `Erro ao buscar dados de Orçamento: ${errorMessage}.${requiresBackend ? backendMessage : ''}`, PAGE_MARGIN, currentY, {}, 10, 'normal', PDF_THEME.ERROR).y;
          }
          break;
        case 'metrics':
           try {
            const response = await axios.get(`/api/metrics`, { params });
            data = response.data;
            currentY = addMetricsContent(doc, data, currentY).y;
          } catch (e: unknown) {
            errorMessage = (axios.isAxiosError(e) ? e.response?.data?.message : (e instanceof Error ? e.message : 'Erro desconhecido'));
            console.error("Erro ao buscar métricas:", e);
            currentY = addPdfText(doc, `Erro ao buscar dados de Métricas: ${errorMessage}.${requiresBackend ? backendMessage : ''}`, PAGE_MARGIN, currentY, {}, 10, 'normal', PDF_THEME.ERROR).y;
          }
          break;
        case 'funnel':
           try {
            const response = await axios.get(`/api/funnel`, { params });
            data = response.data;
            currentY = addFunnelContent(doc, data, currentY).y;
          } catch (e: unknown) {
            errorMessage = (axios.isAxiosError(e) ? e.response?.data?.message : (e instanceof Error ? e.message : 'Erro desconhecido'));
            console.error("Erro ao buscar funil:", e);
            currentY = addPdfText(doc, `Erro ao buscar dados do Funil: ${errorMessage}.${requiresBackend ? backendMessage : ''}`, PAGE_MARGIN, currentY, {}, 10, 'normal', PDF_THEME.ERROR).y;
          }
          break;
        case 'ltv':
           try {
            const response = await axios.get(`/api/ltv`, { params });
            data = response.data;
            currentY = addLtvContent(doc, data, currentY).y;
          } catch (e: unknown) {
            errorMessage = (axios.isAxiosError(e) ? e.response?.data?.message : (e instanceof Error ? e.message : 'Erro desconhecido'));
            console.error("Erro ao buscar LTV:", e);
            currentY = addPdfText(doc, `Erro ao buscar dados de LTV: ${errorMessage}.${requiresBackend ? backendMessage : ''}`, PAGE_MARGIN, currentY, {}, 10, 'normal', PDF_THEME.ERROR).y;
          }
          break;
        case 'general':
          try {
            const apiResults = await Promise.all([
              axios.get('/api/metrics', { params }).catch(e => ({ error: e, data: null })),
              axios.get('/api/funnel', { params }).catch(e => ({ error: e, data: null })),
              axios.get('/api/ltv', { params }).catch(e => ({ error: e, data: null })),
              axios.get('/api/budget', { params }).catch(e => ({ error: e, data: null }))
            ]);
             // *** Usa o type guard hasError ***
             const errors = apiResults.filter(hasError);
             if (errors.length > 0) {
               errorMessage = errors.map(e => (axios.isAxiosError(e.error) ? e.error.response?.data?.message : (e.error instanceof Error ? e.error.message : 'Erro API'))).join('; ');
               throw new Error(`Falha ao buscar dados gerais: ${errorMessage}`);
             }
            // Se não houver erros, extrai os dados (agora seguro devido ao type guard)
            data = {
                metrics: (apiResults[0] as AxiosResponse).data,
                funnel: (apiResults[1] as AxiosResponse).data,
                ltv: (apiResults[2] as AxiosResponse).data,
                budget: (apiResults[3] as AxiosResponse).data
            };
            currentY = addGeneralContent(doc, data, currentY).y;
          } catch (e: unknown) {
             if (!errorMessage) errorMessage = 'Falha ao buscar dados gerais.';
             if (e instanceof Error && !errorMessage.includes(e.message)) errorMessage += ` (${e.message})`;
             console.error("Erro ao buscar dados gerais:", e);
             currentY = addPdfText(doc, `Erro: ${errorMessage}.${backendMessage}`, PAGE_MARGIN, currentY, {}, 10, 'normal', PDF_THEME.ERROR).y;
          }
          break;
        default:
          throw new Error(`Tipo de relatório inválido: ${reportType}`);
      }

      if (!errorMessage) {
        addPdfText(doc, "Relatório concluído.", PAGE_MARGIN, currentY + 8, {}, 9, 'italic', PDF_THEME.TEXT_MUTED);
      }

      totalPages = doc.internal.pages.length;
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        addPdfHeaderFooter(doc, i, totalPages, title, campaignName, dateRangeStr);
      }

      const safeName = campaignName.replace(/[^a-zA-Z0-9]/g, '_');
      const finalTitle = title.replace(/\s+/g, '_');
      const fileName = `${finalTitle}_${safeName}_${dateRangeFormatted.start}_a_${dateRangeFormatted.end}.pdf`;
      doc.save(fileName);

      if (!errorMessage) {
        toast({ title: "Sucesso!", description: `${title} exportado como ${fileName}` });
      } else {
           toast({ title: "Erro na Geração", description: `Ocorreram erros ao buscar dados: ${errorMessage}`, variant: "destructive" });
      }

    } catch (error: any) {
      console.error(`Erro GERAL ao gerar PDF para ${reportType}:`, error);
      if (!errorMessage) {
        errorMessage = error.message || 'Erro desconhecido ao gerar PDF.';
      }
      toast({ title: "Erro Crítico na Geração do PDF", description: `Falha: ${errorMessage}.`, variant: "destructive" });
      try {
        const errorDoc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
        addPdfHeaderFooter(errorDoc as jsPDFWithAutoTable, 1, 1, "ERRO NA GERAÇÃO", campaignName, dateRangeStr);
        addPdfText(errorDoc as jsPDFWithAutoTable, `Erro Crítico ao gerar o relatório:\n${errorMessage}`, PAGE_MARGIN, PAGE_MARGIN + (logoDataUrl ? LOGO_HEIGHT_MM + 12 : 17), {}, 10, 'bold', PDF_THEME.ERROR);
        errorDoc.save(`ERRO_${reportType}.pdf`);
      } catch (finalError) {
        console.error("Falha ao gerar PDF de erro:", finalError);
      }
    } finally {
      setIsLoading(prev => ({ ...prev, [reportType]: false }));
    }
  };

  // --- Renderização ---
  if (authLoading) { return ( <Layout><div className="flex h-[calc(100vh-100px)] w-full items-center justify-center"> <Loader2 className="h-8 w-8 animate-spin text-primary" /><span className="ml-3 text-muted-foreground">Verificando acesso...</span> </div></Layout> ); }
  if (!isAuthenticated) { return null; }

  return (
    <Layout>
       <Head> <title>Exportar Relatórios | USBMKT</title> </Head>
       <div className="container mx-auto p-4 py-6">
        <h1 className="text-2xl font-bold mb-6 text-white">Exportar Relatórios</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <Card className={cardStyle}> <CardHeader className="pb-2"> <CardTitle className={titleStyle}>Filtros</CardTitle> <CardDescription className="text-slate-400">Selecione os critérios para o relatório</CardDescription> </CardHeader> <CardContent> <div className="grid gap-3"> <div className="space-y-1.5"> <Label htmlFor="campaign" className="text-sm font-medium text-slate-300">Campanha</Label> <Select value={selectedCampaignId} onValueChange={setSelectedCampaignId} disabled={campaignsLoading||Object.values(isLoading).some(Boolean)} > <SelectTrigger id="campaign" className={selectTriggerStyle} aria-label="Selecionar Campanha"> <SelectValue placeholder={campaignsLoading ? "Carregando..." : "Selecione..."} /> </SelectTrigger> <SelectContent className={`${popoverContentStyle} z-50`}> {campaignsLoading ? ( <SelectItem value="loading" disabled>Carregando...</SelectItem> ) : ( <> <SelectItem value="all">Todas Campanhas</SelectItem> {campaigns.length > 0 ? campaigns.map((c) => ( <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem> )) : ( <SelectItem value="no-camps" disabled>Nenhuma campanha encontrada</SelectItem> )} </> )} </SelectContent> </Select> </div> <div className="space-y-1.5"> <Label htmlFor="datePeriod" className="text-sm font-medium text-slate-300">Período</Label>
              <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button id="datePeriod" variant={"outline"} className={cn("w-full justify-start text-left font-normal", selectTriggerStyle, !dateRange && "text-muted-foreground", "h-9 px-3 text-sm")} disabled={Object.values(isLoading).some(Boolean)} > <CalendarIcon className="mr-2 h-4 w-4" /> {getDisplayDateRange()} </Button>
                  </PopoverTrigger>
                  <PopoverContent className={cn(popoverContentStyle, "w-auto p-0 z-50")} align="start"> <Calendar initialFocus mode="range" defaultMonth={dateRange?.from} selected={dateRange} onSelect={(range) => { setDateRange(range); setPopoverOpen(false); }} numberOfMonths={2} locale={ptBR} disabled={Object.values(isLoading).some(Boolean)} className="text-white [&>div>table>tbody>tr>td>button]:text-white [&>div>table>tbody>tr>td>button]:border-[#1E90FF]/20 [&>div>table>thead>tr>th]:text-gray-400 [&>div>div>button]:text-white [&>div>div>button:hover]:bg-[#1E90FF]/20 [&>div>div>div]:text-white" /> </PopoverContent>
              </Popover>
           </div> </div> </CardContent> </Card>
           <Card className={cardStyle}> <CardHeader className="pb-2"> <CardTitle className={titleStyle}>Informações</CardTitle> <CardDescription className="text-slate-400">Tipos de Relatórios Disponíveis</CardDescription> </CardHeader> <CardContent className="space-y-2 text-xs text-slate-300"> <p><span className="font-medium text-white">Campanhas:</span> Lista detalhes das campanhas selecionadas.</p> <p><span className="font-medium text-white">Orçamento:</span> Distribuição de gastos e gráfico*. <span className="text-red-500 text-[10px]">(API Req.)</span></p> <p><span className="font-medium text-white">Métricas:</span> KPIs principais e gráfico de evolução*. <span className="text-red-500 text-[10px]">(API Req.)</span></p> <p><span className="font-medium text-white">Funil:</span> Visualização das etapas de conversão. <span className="text-red-500 text-[10px]">(API Req.)</span></p> <p><span className="font-medium text-white">LTV:</span> Estimativa do valor do tempo de vida do cliente. <span className="text-red-500 text-[10px]">(API Req.)</span></p> <p><span className="font-medium text-white">Geral:</span> Resumo consolidado de todos os relatórios. <span className="text-red-500 text-[10px]">(API Req.)</span></p> <p className="mt-2 text-yellow-500 text-[11px]">Nota: <span className="text-red-500">(API Req.)</span> = Requer que as APIs de backend estejam rodando.<br/> * Gráficos podem requerer processamento no backend.</p> </CardContent> </Card>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(['campaigns', 'budget', 'metrics', 'funnel', 'ltv', 'general'] as ReportType[]).map((reportType) => { const cfg = { campaigns: { title: "Campanhas", i: FileText, d: "Lista e detalhes" }, budget: { title: "Orçamento", i: DollarSign, d: "Distribuição de gastos" }, metrics: { title: "Métricas", i: BarChart3, d: "KPIs e evolução" }, funnel: { title: "Funil", i: Filter, d: "Etapas de conversão" }, ltv: { title: "LTV", i: TrendingUp, d: "Valor do cliente" }, general: { title: "Geral", i: LineChart, d: "Resumo consolidado" }, }[reportType]; const Icon = cfg.i; const reqB = ['budget','metrics','funnel','ltv','general'].includes(reportType); return ( <Card key={reportType} className={`${cardStyle} hover:shadow-[0_5px_15px_rgba(30,144,255,0.2)]`}> <CardHeader className="pb-2"> <CardTitle className="flex items-center gap-2"> <Icon className="h-5 w-5 text-[#1E90FF]" /> <span className={titleStyle}>{cfg.title}</span> </CardTitle> <CardDescription className="text-slate-400 text-xs">{cfg.d}{reqB && <span className="text-red-500 ml-1 text-[10px]">(API)</span>}</CardDescription> </CardHeader> <CardContent className="pt-4"> <Button onClick={() => generatePdf(reportType)} disabled={isLoading[reportType] || campaignsLoading || !dateRange?.from || !dateRange?.to} className={`${primaryButtonStyle} w-full`} > {isLoading[reportType] ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />} Exportar PDF </Button> </CardContent> </Card> ); })}
        </div>
      </div>
    </Layout>
  );
}
