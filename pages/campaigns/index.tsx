// pages/campaigns/index.tsx
import React, { useState, useEffect, useCallback } from 'react'; // Mantidos imports básicos
import Head from 'next/head';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/router';
import Layout from '@/components/layout'; // Importa o Layout
import { Button } from "@/components/ui/button"; // Importa Button para o teste
import { Loader2 } from 'lucide-react'; // Importa Loader2 para o loading
// Removidos imports não utilizados na versão simplificada (Card, Input, Label, etc.)
// Removida importação da interface Campaign
// Removida importação de axios
// Removida importação de useToast
// Removida importação de cn
// Removida importação de MultiSelectPopover
// Removida importação de ScrollArea

export default function CampaignPageSimplifiedTest() { // Nome diferente para clareza (opcional)
    // Estados e Hooks essenciais
    const { isAuthenticated, isLoading: authLoading } = useAuth();
    const router = useRouter();
    const [isLoading, setIsLoading] = useState<boolean>(true); // Estado de loading simplificado

    // Efeito apenas para autenticação e controle de loading
    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            router.push('/login');
            return; // Importante retornar após redirecionar
        }
        if (!authLoading && isAuthenticated) {
            // Simula o fim do carregamento da página após a verificação de auth
            setIsLoading(false);
        }
    }, [authLoading, isAuthenticated, router]);

    // Renderização Condicional (Auth Loading)
    if (authLoading || isLoading) { // Verifica ambos os loadings
        return (
            <Layout>
                <div className="flex h-screen w-full items-center justify-center"> {/* h-screen aqui */}
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <span className="ml-2 text-muted-foreground">
                        {authLoading ? 'Verificando...' : 'Carregando Página...'}
                    </span>
                </div>
            </Layout>
        );
    }

    // Proteção extra caso useEffect não tenha redirecionado a tempo
    if (!isAuthenticated) {
        return null;
    }

    // <<<--- CONTEÚDO PRINCIPAL SIMPLIFICADO --->>>
    return (
        <Layout>
            <Head><title>Teste Campanha - USBMKT</title></Head>
            <div className="p-6">
                <h1 className="text-2xl font-bold text-white">Página de Campanhas - Teste Simples</h1>
                <p className="text-gray-400 mt-4">Se você vê isso e não há erro "React.Children.only" no console, o problema está no conteúdo complexo original removido desta página (lista ou formulário).</p>
                {/* Adiciona um botão simples para garantir que as interações básicas funcionam */}
                <Button className="mt-4" onClick={() => alert('Botão funciona!')}>Botão Teste</Button>
            </div>
        </Layout>
    );
    // <<<--- FIM DO CONTEÚDO SIMPLIFICADO --->>>
}
