// components/LoginRegisterForm.tsx
"use client";

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import axios, { AxiosError } from 'axios'; // Import AxiosError
import { Loader2 } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

export default function LoginRegisterForm() {
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth(); // Pega a função login do contexto
  const { toast } = useToast();

  // --- Estilos ---
  const neonColor = '#1E90FF';
  const neonRedColor = '#FF4444';
  const cardStyle = "bg-[#141414]/90 backdrop-blur-sm border border-slate-700/50 shadow-xl";
  const inputStyle = "bg-slate-800/50 border-slate-700/80 text-white focus:ring-2 focus:ring-[#1E90FF] focus:ring-offset-2 focus:ring-offset-[#0e1015] focus:border-[#1E90FF]/50 h-9 placeholder:text-slate-500";
  const buttonStyle = "bg-gradient-to-r from-[#1E90FF] to-[#4682B4] hover:from-[#4682B4] hover:to-[#1E90FF] text-white h-10 font-semibold shadow-[0_2px_8px_rgba(30,144,255,0.4)] transition-all duration-200 ease-out transform hover:scale-[1.02] disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none";
  const linkButtonStyle = "text-xs text-slate-400 hover:text-[#1E90FF] hover:underline";
  const labelStyle = "text-sm text-slate-300";

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    console.log('[Login Form] Iniciando submissão de login...'); // Log
    try {
      const response = await axios.post('/api/login', { username, password });
      console.log('[Login Form] Resposta da API de login:', response.status, response.data);

      if (response.data.token) {
        toast({ title: "Sucesso!", description: response.data.message || "Login realizado." });
        console.log('[Login Form] Chamando login() do AuthContext...'); // Log
        login(response.data.token); // Chama login do contexto
        // NÃO chama setLoading(false) aqui, pois o redirecionamento é esperado
      } else {
         console.error('[Login Form] Resposta da API sem token.');
         throw new Error(response.data.message || "Resposta inválida da API de login.");
      }

    } catch (err: unknown) { // Usar unknown para melhor type checking
      let errMsg = 'Falha na comunicação com o servidor.'; // Default error
      if (axios.isAxiosError(err)) { // Verifica se é um erro Axios
          errMsg = err.response?.data?.message || err.message || errMsg;
          console.error('[Login Form] Erro Axios no login:', err.response?.status, err.response?.data || err.message);
      } else if (err instanceof Error) { // Verifica se é um erro JS padrão
          errMsg = err.message || errMsg;
           console.error('[Login Form] Erro JS no login:', err.message);
      } else {
          console.error('[Login Form] Erro desconhecido no login:', err);
      }

      setError(errMsg);
      toast({ title: "Erro de Login", description: errMsg, variant: "destructive" });
      setLoading(false); // <<< IMPORTANTE: Libera o botão APENAS em caso de ERRO no login
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    if (password !== confirmPassword) { setError('As senhas não coincidem.'); return; }
    if (password.length < 6) { setError('A senha deve ter pelo menos 6 caracteres.'); return; }
    if (username.length < 3) { setError('O nome de usuário deve ter pelo menos 3 caracteres.'); return; }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) { setError('Nome de usuário inválido (letras, números, _).'); return; }
    setLoading(true);
    console.log('[Register Form] Iniciando submissão de registro...'); // Log
    try {
      const response = await axios.post('/api/register', { username, password });
      console.log('[Register Form] Resposta da API de registro:', response.status, response.data);
      toast({ title: "Sucesso!", description: response.data.message || "Conta criada. Faça login." });
      setIsRegistering(false);
      setPassword(''); setConfirmPassword(''); setError('');
    } catch (err: unknown) { // Usar unknown
        let errMsg = 'Falha no registro.';
        if (axios.isAxiosError(err)) {
             errMsg = err.response?.data?.message || err.message || errMsg;
             console.error('[Register Form] Erro Axios no registro:', err.response?.status, err.response?.data || err.message);
        } else if (err instanceof Error) {
             errMsg = err.message || errMsg;
             console.error('[Register Form] Erro JS no registro:', err.message);
        } else {
             console.error('[Register Form] Erro desconhecido no registro:', err);
        }
      setError(errMsg);
      toast({ title: "Erro de Registro", description: errMsg, variant: "destructive" });
    } finally {
      setLoading(false); // Libera o botão após tentativa de registro (sucesso ou falha)
    }
  };

  return (
    <div className="flex items-center justify-center h-full p-4">
      <Card className={cn("w-full max-w-sm", cardStyle)}>
        {/* CardHeader, CardContent, CardFooter como antes */}
         <CardHeader className="text-center pt-6 pb-4"> <CardTitle className="text-2xl font-bold text-white" style={{ textShadow: `0 0 6px ${neonColor}` }}> {isRegistering ? 'Criar Conta' : 'Login USBMKT'} </CardTitle> <CardDescription className="text-slate-400 text-sm pt-1"> {isRegistering ? 'Preencha os dados para registrar.' : 'Acesse sua conta para continuar.'} </CardDescription> </CardHeader>
         <CardContent className="px-6 pb-4"> <form onSubmit={isRegistering ? handleRegisterSubmit : handleLoginSubmit} className="space-y-4"> <div className="space-y-1"> <Label htmlFor="username" className={labelStyle}>Usuário</Label> <Input id="username" name="username" type="text" value={username} onChange={(e) => setUsername(e.target.value)} required className={cn(inputStyle)} placeholder="seu_usuario" autoComplete="username" /> </div> <div className="space-y-1"> <Label htmlFor="password" className={labelStyle}>Senha</Label> <Input id="password" name="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className={cn(inputStyle)} placeholder="********" autoComplete={isRegistering ? "new-password" : "current-password"} /> </div> {isRegistering && ( <div className="space-y-1"> <Label htmlFor="confirmPassword" className={labelStyle}>Confirmar Senha</Label> <Input id="confirmPassword" name="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required className={cn(inputStyle)} placeholder="********" autoComplete="new-password" /> </div> )} {error && <p className="text-xs text-red-500 text-center pt-1" style={{ textShadow: `0 0 3px ${neonRedColor}` }}>{error}</p>} <Button type="submit" className={cn(buttonStyle, "w-full mt-2")} disabled={loading}> {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : (isRegistering ? 'Registrar' : 'Entrar')} </Button> </form> </CardContent>
         <CardFooter className="flex justify-center pb-6 pt-2"> <Button variant="link" onClick={() => { setIsRegistering(!isRegistering); setError(''); setPassword(''); setConfirmPassword(''); }} className={cn(linkButtonStyle)} type="button" > {isRegistering ? 'Já tem uma conta? Faça Login' : 'Não tem conta? Registre-se'} </Button> </CardFooter>
      </Card>
    </div>
  );
}