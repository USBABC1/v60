// pages/confirm-email.tsx
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"; // Usando componentes shadcn/ui
import { cn } from '@/lib/utils'; // Para utilitários de classe

const ConfirmEmailPage: React.FC = () => {
    const router = useRouter();
    const { token } = router.query;
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [message, setMessage] = useState('');

    useEffect(() => {
        if (!token || typeof token !== 'string') {
            if (!router.isReady) return; // Espera o router estar pronto
            setStatus('error');
            setMessage('Token de confirmação ausente na URL.');
            return;
        }

        const confirmEmail = async () => {
            try {
                // Construir a URL da API dinamicamente usando NEXT_PUBLIC_API_URL
                const apiUrl = `${process.env.NEXT_PUBLIC_API_URL}/api/auth/confirm-email?token=${encodeURIComponent(token)}`;
                const response = await axios.get(apiUrl);
                setStatus('success');
                setMessage(response.data.message || 'E-mail confirmado com sucesso!');
            } catch (error: any) {
                setStatus('error');
                setMessage(error.response?.data?.error || 'Erro ao confirmar e-mail. O token pode ser inválido ou já ter sido usado.');
                console.error("Erro na página de confirmação:", error);
            }
        };

        if (token && router.isReady) { // Garante que o token está disponível e o router pronto
            confirmEmail();
        }

    }, [token, router.isReady]); // Dependências: token e router.isReady

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-900 p-4">
            <Card className={cn("w-full max-w-sm", "bg-gray-800 text-white border-gray-700")}>
                <CardHeader>
                    <CardTitle className="text-center text-xl font-bold">Confirmação de E-mail</CardTitle>
                </CardHeader>
                <CardContent className="text-center">
                    {status === 'loading' && (
                        <div className="flex flex-col items-center">
                            <Loader2 className="h-8 w-8 animate-spin text-blue-500 mb-4" />
                            <p>Confirmando seu e-mail...</p>
                        </div>
                    )}
                    {status === 'success' && (
                        <div className="text-green-500">
                            <p>{message}</p>
                            <p className="mt-4">Você pode fechar esta página ou <a href="/login" className="text-blue-400 hover:underline">fazer login</a>.</p>
                        </div>
                    )}
                    {status === 'error' && (
                        <div className="text-red-500">
                            <p>{message}</p>
                            <p className="mt-4">Por favor, tente novamente ou entre em contato com o suporte.</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default ConfirmEmailPage;
