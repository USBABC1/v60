// components/dashboard/PeriodSelector.tsx
import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button'; // Importar Button
import { cn } from '@/lib/utils'; // Importar cn

interface PeriodSelectorProps {
  startDate: string;
  endDate: string;
  onPrevious: () => void;
  onNext: () => void;
  isNextDisabled?: boolean; // Propriedade adicionada aqui
}

const PeriodSelector: React.FC<PeriodSelectorProps> = ({
    startDate,
    endDate,
    onPrevious,
    onNext,
    isNextDisabled = false // Receber a propriedade
}) => {
  const neonColor = '#1E90FF';
  return (
    <div className="flex items-center justify-center gap-2 p-1 rounded-lg bg-background/50 shadow-[var(--neumorphic-shadow-inset-sm)]">
      <Button
         variant="ghost" size="icon"
         onClick={onPrevious}
         className="h-7 w-7 text-muted-foreground hover:bg-accent neumorphic-icon-button"
         aria-label="Período anterior"
       >
         {/* Ícone com Neon */}
        <ChevronLeft className="h-4 w-4" style={{ filter: `drop-shadow(0 0 4px ${neonColor})` }}/>
      </Button>
      {/* Texto com Neon */}
      <span
       className="text-xs font-medium text-foreground tabular-nums px-2"
       style={{ textShadow: `0 0 4px ${neonColor}` }}
      >
        {startDate} - {endDate}
      </span>
      <Button
         variant="ghost" size="icon"
         onClick={onNext}
         disabled={isNextDisabled} // Usar a propriedade para desabilitar
         className={cn(
            "h-7 w-7 text-muted-foreground hover:bg-accent neumorphic-icon-button",
             isNextDisabled && "opacity-50 cursor-not-allowed"
         )}
         aria-label="Próximo período"
       >
         {/* Ícone com Neon */}
        <ChevronRight className="h-4 w-4" style={{ filter: `drop-shadow(0 0 4px ${neonColor})` }}/>
      </Button>
    </div>
  );
};

export default PeriodSelector;