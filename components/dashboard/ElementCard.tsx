// components/dashboard/ElementCard.tsx
import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { cn } from '@/lib/utils';
import { LucideProps } from 'lucide-react';

// Definir um tipo mais específico para o ícone que aceita className e strokeWidth
type IconType = React.ForwardRefExoticComponent<Omit<LucideProps, "ref"> & React.RefAttributes<SVGSVGElement>>;

// 1. ADICIONE a propriedade 'actionComponent' à interface
export interface ElementCardProps {
  icon: IconType;
  label: string;
  onClick?: () => void;
  iconColorClass?: string;
  children?: React.ReactNode;
  value?: string | number;
  actionComponent?: React.ReactNode; // <<< ADICIONADO AQUI (opcional)
  className?: string; // Adicionado para permitir classes externas
}

const ElementCard: React.FC<ElementCardProps> = ({
    icon: IconComponent,
    label,
    onClick,
    iconColorClass = 'text-primary', // Cor padrão pode ser ajustada
    children,
    value,
    actionComponent, // <<< RECEBA A PROP AQUI
    className        // <<< RECEBA A PROP className
}) => {
  // Aplicar classes neumórficas ou outras diretamente aqui ou via `className` prop
  // Use as classes base se desejar, mas o Card padrão já tem seus estilos.
  // O estilo antigo 'card' e 'card-interactive' pode não ser necessário se usar ShadCN Card.
  const cardClasses = cn(
    "p-3", // Padding
    "flex flex-col items-center justify-center", // Layout interno
    "h-28 w-full", // Tamanho fixo (ajuste se necessário)
    "text-center",
    onClick ? "cursor-pointer hover:bg-accent/50 transition-colors" : "", // Estilo interativo básico
    className // Permite sobrescrever/adicionar classes de fora
  );

  return (
    <Card className={cardClasses} onClick={onClick}>
      {/* CardContent já está dentro do Card, não precisa aninhar */}
      {/* Removido CardContent redundante, aplicado flex diretamente no Card */}
        <IconComponent className={cn("h-6 w-6 mb-1", iconColorClass)} strokeWidth={1.5} />
        <span className="text-xs font-semibold text-muted-foreground">{label}</span>
         {value !== undefined && (
             <span className="text-lg font-bold text-foreground mt-0.5">{value}</span>
         )}
         {children}
         {/* 3. RENDERIZE o actionComponent se ele existir */}
         {actionComponent && (
             <div className="mt-auto pt-1"> {/* Coloca o botão na parte inferior */}
                 {actionComponent}
            </div>
         )}
    </Card>
  );
};

export default ElementCard;
