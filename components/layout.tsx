// components/layout.tsx
import { ReactNode, useState } from 'react';
import { useRouter } from 'next/router';
import Sidebar from './ui/sidebar'; // Sidebar Esquerda
import { cn } from '@/lib/utils';
// Manter contexto da Sidebar Esquerda
import { LeftSidebarProvider, useLeftSidebarContext } from '../context/LeftSidebarContext';

// Componente interno para MainContent (Ajusta APENAS margem ESQUERDA)
function MainContent({ children }: { children: ReactNode }) {
  const { isLeftCollapsed } = useLeftSidebarContext(); // Usar o hook do contexto da sidebar esquerda

  // Larguras da sidebar esquerda (ajuste conforme o CSS real)
  const leftSidebarWidthExpanded = "60"; // Tailwind: ml-60
  const leftSidebarWidthCollapsed = "16"; // Tailwind: ml-16

  // Classes de margem dinâmicas
  const marginLeftClass = isLeftCollapsed ? `ml-${leftSidebarWidthCollapsed}` : `ml-${leftSidebarWidthExpanded}`;

  return (
    // Aplica APENAS margem esquerda dinâmica
    <main className={cn(
        "flex-1 overflow-auto relative transition-all duration-300 ease-in-out",
        marginLeftClass // Margem esquerda dinâmica
        )}>
      {children}
    </main>
  );
}

export default function Layout({ children }: { children: ReactNode }) {
  // Estado local para sidebar esquerda (Mantido, mas o estado do contexto é o que importa para a margem)
  // O estado local aqui pode ser removido se o toggle for feito apenas dentro da Sidebar usando o contexto.
  // Mas se o toggle for feito por um botão FORA da Sidebar, o estado local ou outro contexto seria necessário.
  // Vamos manter o estado local por enquanto, assumindo que o toggle pode ser feito fora da Sidebar.
  const [isLeftSidebarCollapsed, setIsLeftSidebarCollapsed] = useState(false);
  const { pathname } = useRouter();
  const isBuilderPage = pathname === '/builder';
  const toggleLeftSidebar = () => setIsLeftSidebarCollapsed(!isLeftSidebarCollapsed);


  return (
    // Envolver APENAS com o LeftSidebarProvider
    <LeftSidebarProvider>
            <div className="flex h-screen bg-background text-foreground overflow-hidden">

                {/* 1. Sidebar Esquerda (USA CONTEXTO INTERNAMENTE) */}
                {/* A Sidebar usará o LeftSidebarContext */}
                <Sidebar
                  // REMOVIDO: isCollapsed={isLeftSidebarCollapsed}
                  // REMOVIDO: toggleSidebar={toggleLeftSidebar}
                  isHidden={isBuilderPage}
                />

                {/* 2. Conteúdo Principal (Usa MainContent que ajusta APENAS a margem esquerda) */}
                 <MainContent>{children}</MainContent>

                {/* Agente MCP é um painel fixo global em _app.tsx, NÃO renderizado aqui */}

            </div>
    </LeftSidebarProvider>
  );
}
