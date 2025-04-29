import React from 'react';
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
// Importar ícones necessários (exemplo)
import { Info, AlertTriangle, AlertCircle, CheckCircle, Trash2, Check } from 'lucide-react';

// Interface para as propriedades do AlertCard
// ADICIONAR 'export' AQUI
export interface AlertCardProps {
  variant?: 'default' | 'destructive' | 'warning' | 'success'; // Adicionar 'success' se necessário
  message: string;
  timestamp?: string; // Tornar opcional se não for sempre fornecido
  isRead?: boolean;
  onMarkRead?: () => void; // Função para marcar como lido
  onDelete?: () => void;   // Função para deletar
  // Remover 'id' daqui, pois não é passado como prop
}

// Mapeamento de variantes para estilos e ícones
const variantStyles = {
  default: {
    icon: Info,
    bgColor: 'bg-blue-900/30 border-blue-500/50', // Exemplo: fundo azulado escuro, borda azul
    iconColor: 'text-blue-400',
  },
  destructive: {
    icon: AlertCircle,
    bgColor: 'bg-red-900/30 border-red-500/50',
    iconColor: 'text-red-400',
  },
  warning: {
    icon: AlertTriangle,
    bgColor: 'bg-yellow-900/30 border-yellow-500/50',
    iconColor: 'text-yellow-400',
  },
   success: {
    icon: CheckCircle,
    bgColor: 'bg-green-900/30 border-green-500/50',
    iconColor: 'text-green-400',
  },
};


const AlertCard: React.FC<AlertCardProps> = ({
  variant = 'default',
  message,
  timestamp,
  isRead = false,
  onMarkRead,
  onDelete
}) => {

  const styles = variantStyles[variant] || variantStyles.default;
  const IconComponent = styles.icon;

  return (
    <div
      className={cn(
        "flex items-start space-x-4 rounded-lg border p-4 transition-colors",
        styles.bgColor, // Aplica cor de fundo/borda da variante
        isRead ? "opacity-60" : "opacity-100" // Estilo para lido
      )}
    >
      {/* Ícone */}
      <IconComponent className={cn("h-5 w-5 mt-0.5 shrink-0", styles.iconColor)} aria-hidden="true" />

      {/* Conteúdo do Alerta */}
      <div className="flex-1 space-y-1">
        <p className="text-sm font-medium text-foreground">{message}</p>
        {timestamp && (
          <p className="text-xs text-muted-foreground">{timestamp}</p>
        )}
      </div>

      {/* Ações */}
      <div className="flex shrink-0 items-center space-x-2 ml-auto">
        {!isRead && onMarkRead && (
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:bg-accent hover:text-accent-foreground" onClick={onMarkRead} title="Marcar como lido">
            <Check className="h-4 w-4" />
          </Button>
        )}
        {onDelete && (
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={onDelete} title="Excluir alerta">
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
};

export default AlertCard;