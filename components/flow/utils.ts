// utils.ts
// C:\Users\ADM\Desktop\v13-main\components\flow\utils.ts
import React from 'react';
import { cn } from "@/lib/utils";

// Cor Neom usada nos nós e conexões
export const NEON_COLOR = '#1E90FF';

// Componente para adicionar efeito de brilho aos ícones dos nós
// Corrigido: Usando React.createElement para evitar problemas de parsing JSX
export const IconWithGlow: React.FC<{ icon: React.ElementType, className?: string }> = ({ icon: IconComponent, className }) => {
    return React.createElement(IconComponent, {
        className: cn("node-icon", className),
        style: { filter: `drop-shadow(0 0 3px ${NEON_COLOR}99)` }
        // Não há children, então não precisamos do terceiro argumento para createElement
    });
};


// Adicione outras funções ou constantes utilitárias específicas do fluxo aqui, se necessário.
// Por exemplo, estilos compartilhados:
export const baseButtonSelectStyle = `bg-[#141414] border-none text-white shadow-[3px_3px_6px_rgba(0,0,0,0.3),-3px_-3px_6px_rgba(255,255,255,0.05)] hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.3),inset_-2px_-2px_4px_rgba(255,255,255,0.05)] hover:bg-[${NEON_COLOR}]/20 focus:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.3),inset_-2px_-2px_4px_rgba(255,255,255,0.05)]`;
export const baseCardStyle = `bg-[#141414] border-none shadow-[5px_5px_10px_rgba(0,0,0,0.4),-5px_-5px_10px_rgba(255,255,255,0.05)] rounded-lg`;
export const baseInputInsetStyle = `bg-[#101010] border-none text-white placeholder:text-gray-500 shadow-[inset_2px_2px_4px_rgba(0,0,0,0.3),inset_-2px_-2px_4px_rgba(255,255,255,0.05)] focus:shadow-[3px_3px_6px_rgba(0,0,0,0.3),-3px_-3px_6px_rgba(255,255,255,0.05)] focus:ring-1 focus:ring-[${NEON_COLOR}]/50 focus:bg-[#141414]`;
export const popoverContentStyle = `bg-[#1e2128] border-[${NEON_COLOR}]/30 text-white`;