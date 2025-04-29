// pages/login.tsx
import React from 'react';
import Head from 'next/head';
import LoginRegisterForm from '@/components/LoginRegisterForm'; // Importa o formulário
import { cn } from "@/lib/utils"; // Para o background

// Esta página NÃO usa o Layout principal da aplicação
export default function LoginPage() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background"> {/* Usa cor de fundo global */}
       <Head>
         <title>Login / Registro - USBMKT</title>
         <meta name="description" content="Acesse ou crie sua conta USBMKT" />
      </Head>
      <LoginRegisterForm /> {/* Renderiza apenas o formulário */}
    </div>
  );
}