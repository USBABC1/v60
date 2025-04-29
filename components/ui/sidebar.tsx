// components/ui/sidebar.tsx
"use client";
import React from "react";
import Link from "next/link";
import { usePathname } from 'next/navigation';
import { cn } from "@/lib/utils";
// Importe TODOS os ícones Lucide que você usa na lista navItems e no botão
import {
  LayoutDashboard, Target, DollarSign, BarChart3, CalendarDays, FileText,
  Lightbulb, LineChart, TrendingUp, Bell, MessageSquare, Settings, LifeBuoy, Power,
  Filter, Upload, ChevronLeft, ChevronRight, Image as ImageIcon, Video, Type, ListChecks, Clock, Variable, Waypoints, HelpCircle, RadioTower,
  UserCheck, LogOut, Workflow, Users, BarChart2, Square, Eye, Map, Share2, Pencil,
  Check, X, GripVertical, List, Grid, ExternalLink, Paperclip, Save, Sparkles, Bot
} from "lucide-react";
import Image from "next/image";
// IMPORTAR O HOOK DO CONTEXTO DA SIDEBAR ESQUERDA
import { useLeftSidebarContext } from '../../context/LeftSidebarContext'; // Importar o hook
// Importar estilos utilitários - Ajuste o caminho se necessário
import { NEON_COLOR, baseButtonSelectStyle, baseInputInsetStyle, popoverContentStyle, baseCardStyle } from '@/components/flow/utils';

// --- Interfaces e Constantes ---
interface NavItem { href: string; icon: React.ComponentType<React.SVGProps<SVGSVGElement>>; label: string; }
const neonColor = NEON_COLOR; // Usar a cor neon do utilitário
const navItems: NavItem[] = [ /* ... Sua lista completa de navItems ... */
    { href: "/", icon: LayoutDashboard, label: "Painel" }, // Renomeado para "Painel" conforme imagem
    { href: "/Campaign", icon: Target, label: "Campanhas" },
    { href: "/Budget", icon: DollarSign, label: "Orçamento" },
    { href: "/Funnel", icon: Filter, label: "Funil" },
    { href: "/Dates", icon: CalendarDays, label: "Datas" },
    { href: "/CopyPage", icon: FileText, label: "Copy" },
    { href: "/Suggestions", icon: Lightbulb, label: "Sugestões" }, // Renomeado para "Sugestões"
    { href: "/Metrics", icon: BarChart3, label: "Métricas" }, // Ordem ajustada conforme imagem
    { href: "/Projection", icon: TrendingUp, label: "Projeções" }, // Renomeado para "Projeções", ordem ajustada
    { href: "/alerts", icon: Bell, label: "Alertas" },
    { href: "/ltv", icon: LineChart, label: "LTV" }, // Ordem ajustada
    { href: "/creatives", icon: ImageIcon, label: "Criativos" }, // Ordem ajustada
    { href: "/Chat", icon: MessageSquare, label: "Chat IA" }, // Se Chat IA for uma página separada do MCP
    { href: "/zap", icon: MessageSquare, label: "Zap" },
    { href: "/builder", icon: Pencil, label: "Webpage" },
    { href: "/export", icon: Upload, label: "Exportar" },
    // Adicionar item para o Agente MCP se ele tiver uma página dedicada, senão remover
    // { href: "/mcp-agent-page", icon: Bot, label: "Agente MCP" },
];

// REMOVIDO: Props RESTAURADAS - Sidebar não recebe mais isCollapsed/toggleSidebar como props
interface SidebarProps {
  isHidden?: boolean; // Mantém apenas a prop para esconder
}

const Sidebar: React.FC<SidebarProps> = ({ isHidden }) => {
  // <<< USA O HOOK DO CONTEXTO >>>
  const { isLeftCollapsed, toggleLeftCollapse } = useLeftSidebarContext();

  if (isHidden) {
    return null; // Mantém retorno null para esconder
  }

  const pathname = usePathname();
  // <<< Define a largura baseada no ESTADO DO CONTEXTO >>>
  const sidebarWidthClass = isLeftCollapsed ? "w-16" : "w-60";
  const iconNeonFilterStyle = { filter: `drop-shadow(0 0 4px ${NEON_COLOR})` };
  const textNeonStyle = { textShadow: `0 0 4px ${NEON_COLOR}` }; // Estilo para o texto neon


  return (
    // Estrutura <aside> com estilos neomorphic escuros (baseCardStyle) e borda sutil
    <aside className={cn(
        "fixed inset-y-0 left-0 z-50 flex h-full flex-col",
        baseCardStyle, // Usa o estilo base de card para o fundo neomorphic e sombra escura (outset)
        "border-r border-[#1E90FF]/20", // Borda sutil à direita
        sidebarWidthClass,
        "transition-all duration-300 ease-in-out"
        )}
        >
        {/* Header com Logo (usa estado do contexto 'isLeftCollapsed') */}
        <div className={cn(
            "flex items-center border-b border-[#2D62A3]/20 p-2 relative flex-shrink-0", // Borda inferior
            isLeftCollapsed ? "h-16 justify-center" : "h-20 justify-center"
            )}>
          <Link href="/" className={cn( "flex items-center justify-center w-full h-full", isLeftCollapsed ? 'max-w-[44px]' : 'max-w-[180px]' )}>
              <div className={cn("relative", isLeftCollapsed ? "w-[44px] h-[44px]" : "w-[180px] h-[50px]")}>
                  {/* Imagem do Logo com filtro neon */}
                  <Image src="/logo.png" alt="Logo USBMKT" fill className="object-contain" style={{ filter: `drop-shadow(0 0 10px ${neonColor})` }} priority sizes={isLeftCollapsed ? "44px" : "180px"} />
              </div>
          </Link>
        </div>

        {/* Navegação Principal (usa estado do contexto 'isLeftCollapsed', sem tooltips) */}
        <nav className="flex-grow overflow-y-auto overflow-x-hidden px-2 py-2 space-y-1 custom-scrollbar">
           {navItems.map((item) => {
              const isActive = pathname === item.href;
              // Estilo base para cada item de navegação (botão flutuante neomorphic)
              const navItemBaseStyle = cn(
                  "group flex items-center rounded-md",
                  baseCardStyle, // Fundo escuro e sombra outset
                  "p-2", // Padding interno
                  isLeftCollapsed ? "justify-center w-10 h-10" : "justify-start w-full h-auto", // Tamanho e alinhamento
                  "transition-all duration-150 ease-out",
                  // Aplicar a classe de sombra combinada no hover e ativo
                  `hover:neumorphic-neon-outset-glow`,
                  isActive && `neumorphic-neon-outset-glow` // Aplicar também quando ativo
              );

              const linkContent = ( <>
                  {/* Ícone com estilo neon */}
                  <item.icon className={cn(
                      "shrink-0",
                      isLeftCollapsed ? "h-5 w-5" : "h-4 w-4 mr-2", // Tamanho do ícone
                      isActive ? `text-white` : `text-[${NEON_COLOR}]` // Cor do ícone
                  )} style={ isActive ? {} : iconNeonFilterStyle } /> {/* Aplicar brilho neon quando NÃO ativo */}

                  {!isLeftCollapsed && (
                      <span className={cn(
                          "truncate font-medium",
                          "text-xs", // Tamanho da fonte MENOR para ambos os estados expandido/colapsado
                          isActive ? "text-white" : "text-gray-400 group-hover:text-white" // Cor do texto
                      )}
                       style={isActive ? {} : textNeonStyle} // Aplicar brilho neon ao texto quando NÃO ativo
                      >
                          {item.label}
                      </span>
                  )}
              </> );
              return (
                  <Link key={item.href} href={item.href} className={navItemBaseStyle} aria-current={isActive ? "page" : undefined} >
                      {linkContent}
                  </Link>
              );
            })}
        </nav>

        {/* Botão Recolher/Expandir (usa função do contexto 'toggleLeftCollapse' e estado 'isLeftCollapsed') */}
        <div className="border-t border-[#2D62A3]/20 p-2 mt-auto flex-shrink-0"> {/* Borda superior */}
            <button onClick={toggleLeftCollapse} className={cn(
                "group flex items-center rounded-md h-8 text-sm w-full", // Tamanho e fonte
                baseButtonSelectStyle, // Estilo base do botão (fundo escuro, sombra outset)
                isLeftCollapsed ? "justify-center" : "justify-start pl-3",
                `hover:!bg-[${NEON_COLOR}]/20` // Fundo neon no hover (manter este ou mudar para sombra?) - Manter fundo neon no hover do botão recolher/expandir por enquanto.
                )} aria-label={isLeftCollapsed ? "Expandir sidebar" : "Recolher sidebar"} >
                {isLeftCollapsed ? (
                    <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-white" /> // Cor do ícone
                ) : (
                    <>
                        <ChevronLeft className="h-4 w-4 mr-2 text-gray-400 group-hover:text-white" /> {/* Cor do ícone */}
                        <span className="text-gray-400 group-hover:text-white">Recolher</span> {/* Cor do texto */}
                    </>
                )}
            </button>
        </div>
      </aside>
  );
};

export default Sidebar;
