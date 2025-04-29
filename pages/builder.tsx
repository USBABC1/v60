// pages/builder.tsx
import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/router';
import Sidebar from '@/components/ui/sidebar'; // Corrigido para importação padrão
import LayoutBuilder from '@/components/layout-builder'; // Corrigido para importação padrão
// REMOVIDO: import { LeftSidebarProvider, useLeftSidebar } from '@/context/LeftSidebarContext'; // Não precisa mais importar o contexto aqui

// REMOVIDO: Componente interno BuilderMainContent que usava useLeftSidebar

const BuilderPage: React.FC = () => {
    const { isAuthenticated, isLoading } = useAuth();
    const router = useRouter();

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

    // Renderizar o layout do builder (que gerencia o estado da sidebar localmente)
    return (
        // REMOVIDO: LeftSidebarProvider
        <LayoutBuilder> {/* LayoutBuilder agora gerencia a sidebar esquerda */}
            <Head>
                <title>Builder - USBMKT</title>
                <meta name="description" content="Visual builder for marketing assets" />
            </Head>
            {/* O conteúdo do builder vai direto para o LayoutBuilder */}
            <div className="p-4">
                <h1>Visual Builder</h1>
                <p>Integrar GrapesJS aqui...</p>
                {/* A sidebar é gerenciada DENTRO de LayoutBuilder agora */}
            </div>
        </LayoutBuilder>
        // REMOVIDO: LeftSidebarProvider
    );
};

export default BuilderPage;
