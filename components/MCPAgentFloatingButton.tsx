// components/MCPAgentFloatingButton.tsx
"use client";
import React from 'react';
import { Button } from '@/components/ui/button'; // Assumindo que você tem um componente Button
import Image from 'next/image'; // Importar componente Image
import { useMCPAgentContext } from '@/context/MCPAgentContext'; // Usar o contexto para abrir/fechar
// Importar estilo neon se existir
import { NEON_COLOR } from '@/components/flow/utils'; // Ajuste o caminho conforme necessário
import { cn } from '@/lib/utils'; // Importar cn

const MCPAgentFloatingButton: React.FC = () => {
  // Usar o nome correto do estado e da função toggle do contexto
  const { toggleAgentPanel, isAgentPanelOpen } = useMCPAgentContext();

  // Não renderiza se o painel já estiver aberto
  if (isAgentPanelOpen) {
    return null;
  }

  // Estilo neon para a imagem do botão
  const iconNeonFilterStyle = { filter: `drop-shadow(0 0 4px ${NEON_COLOR})` };


  return (
    <Button
      onClick={toggleAgentPanel}
      // Garantir que o botão está fixo e no topo de outros elementos
      className={cn(
        "fixed bottom-6 right-6 rounded-full p-3 shadow-lg z-50", // Posição, forma, sombra, z-index
        "bg-blue-600 hover:bg-blue-700 text-white", // Cores
        "w-12 h-12", // Tamanho fixo para o botão
        "flex items-center justify-center" // Centralizar conteúdo
        )}
      size="icon" // Se o seu Button suporta size="icon"
      aria-label="Abrir Agente IA"
    >
      {/* Usar a imagem character.png, tamanho ajustado e formato circular */}
      <div className="relative h-8 w-8 rounded-full overflow-hidden bg-gray-700 flex items-center justify-center" style={iconNeonFilterStyle}> {/* Container para aplicar o filtro e formato circular */}
          <Image src="/character.png" alt="MCP Agent" fill style={{ objectFit: 'cover' }} sizes="32px" /> {/* Usar objectFit cover */}
      </div>
    </Button>
  );
};

export default MCPAgentFloatingButton;
