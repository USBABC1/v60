// pages/login.tsx
import React from 'react';
import Head from 'next/head';
import { LoginRegisterForm } from '@/components/LoginRegisterForm'; // Importa o formulário com chaves
import { cn } from "@/lib/utils"; // Para o background

const LoginPage: React.FC = () => {
  return (
    <>
      <Head>
        <title>Login | USBMKT</title>
        <meta name="description" content="Faça login ou registre-se no USBMKT" />
      </Head>
      <main className={cn("flex min-h-screen items-center justify-center p-4", "bg-gray-900")}>
        <LoginRegisterForm />
      </main>
    </>
  );
};

export default LoginPage;
