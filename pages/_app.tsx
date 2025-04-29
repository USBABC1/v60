// pages/_app.tsx
import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { AuthProvider } from "@/context/AuthContext";
import { MCPAgentProvider } from "@/context/MCPAgentContext"; // Importar o Provider do Agente
import MCPAgentFloatingButton from "@/components/MCPAgentFloatingButton"; // Importar o botão flutuante
import MCPAgent from "@/components/MCPAgent"; // Corrigido: Importar o componente principal do Agente (agora um painel fixo)
// REMOVIDO: import { LeftSidebarProvider } from "@/context/LeftSidebarContext"; // LeftSidebarProvider agora está nos layouts

export default function App({ Component, pageProps }: AppProps) {
  return (
    <AuthProvider>
      {/* Envolver a aplicação com o Provider do Agente MCP */}
      <MCPAgentProvider>
        {/* REMOVIDO: LeftSidebarProvider */}
        <Component {...pageProps} />
        {/* Adicionar o botão flutuante e o painel para estarem presentes em todas as páginas */}
        <MCPAgentFloatingButton />
        <MCPAgent /> {/* Usar o componente principal do Agente (agora um painel fixo) */}
      </MCPAgentProvider>
    </AuthProvider>
  );
}
