// components/layout-builder.tsx
import Sidebar from '@/components/ui/sidebar';
import { useState, ReactNode } from 'react';
import { cn } from '@/lib/utils';
// Importar o LeftSidebarProvider para envolver o layout
import { LeftSidebarProvider, useLeftSidebarContext } from '../context/LeftSidebarContext'; // Importar o contexto

export default function BuilderLayout({ children }: { children: React.ReactNode }) {
  // Usar o contexto da sidebar esquerda
  const { isLeftCollapsed } = useLeftSidebarContext();

  const leftSidebarWidthExpanded = "60"; // Tailwind: ml-60
  const leftSidebarWidthCollapsed = "16"; // Tailwind: ml-16

  // Classe de margem esquerda dinâmica
  const marginLeftClass = isLeftCollapsed ? `ml-${leftSidebarWidthCollapsed}` : `ml-${leftSidebarWidthExpanded}`;

  return (
    // Envolver APENAS com o LeftSidebarProvider
    <LeftSidebarProvider>
            <div className="flex h-screen bg-[#1a1a1a] text-white overflow-hidden">
              {/* SIDEBAR ESQUERDA (USA CONTEXTO INTERNAMENTE) */}
              <Sidebar isHidden={false} />
              {/* MAIN COM MARGEM ESQUERDA DINÂMICA */}
              <main className={cn(
                  "flex-1 transition-all duration-300 ease-in-out overflow-hidden",
                  marginLeftClass
              )}>
                {children} {/* O editor GrapesJS será renderizado aqui */}
              </main>
               {/* Agente MCP é um painel fixo global em _app.tsx, NÃO renderizado aqui */}
            </div>
    </LeftSidebarProvider>
  );
}
